// Achievements → item/equipment unlocks (Felix, 2026-07-07).
//
// "Add achievements which unlocks new items & equipment. For example beat wave X with class X
//  unlocks an amulet that is good for that class. Also make it possible to disable unlocks by
//  clicking them ... they are filling the item pool with items/equipment you dont want."
//
// Two jobs, both persisted to localStorage so they survive across runs/sessions:
//   1. UNLOCK — a milestone (reach wave N, optionally as a specific class) flips a normally
//      locked catalog item to `unlocked: true`, so it starts appearing in the shop pool.
//   2. DISABLE — the player can click any unlocked reward to toggle it off. A disabled item is
//      still "earned" (stays lit in the achievements screen) but is pulled from the shop pool so
//      it stops diluting the offers during a targeted run.
//
// This module owns the truth; ItemDatabase just reads two things from it on demand — which items
// are unlocked (via unlockItem) and which are disabled (via setDisabledItems). One-directional
// dependency (AchievementSystem → ItemDatabase), no import cycle.

import { ItemDatabase } from './ItemSystem';

/** Per-run statistics passed to rich achievement checks at game-over. */
export interface RunStats {
  classId: string;
  wavesReached: number;
  enemiesKilled: number;
  bossesDefeated: number;
  runDurationMs: number;
  itemsCollected: number;
  goldEarned: number;
}

/** Cumulative stats across ALL runs — persisted in localStorage. */
export interface CumulativeStats {
  totalKills: number;
  classesReachedWave5: string[];  // class ids that cleared wave 5+
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Catalog item id flipped to unlocked when earned. */
  unlocksItemId: string;
  // --- Simple (wave-based) trigger ---
  /** Required starting class id, or undefined = any class counts. Only used when `wave` is set. */
  classId?: string;
  /** Reach (>=) this wave in a single run to earn it. Mutually exclusive with `check`. */
  wave?: number;
  // --- Rich trigger ---
  /** Custom check evaluated at game-over. Receives per-run stats + cumulative cross-run stats. */
  check?: (stats: RunStats, cumulative: CumulativeStats) => boolean;
}

const ALL_CLASS_IDS = ['gunner', 'berserker', 'arcanist', 'ranger', 'prospector', 'reaver', 'brawler'];

// The roster. Seven class-signature unlocks (beat wave 10 as that class → its tailor-made gear)
// plus two class-neutral endurance relics (wave-based), then five milestone achievements that
// use per-run or cross-run stats for richer triggers.
// Ordered class-first so the achievements screen reads as "one per class, then the milestones".
export const ACHIEVEMENTS: Achievement[] = [
  // --- Class mastery (wave-based) ---
  { id: 'ach_gunner',      name: 'Jack of All Trades',  desc: 'Reach wave 10 as the Gunner',      icon: '🔫', classId: 'gunner',      wave: 10, unlocksItemId: 'ach_gunners_bandolier'   },
  { id: 'ach_berserker',   name: 'Blood and Thunder',   desc: 'Reach wave 10 as the Berserker',   icon: '🪓', classId: 'berserker',   wave: 10, unlocksItemId: 'ach_berserkers_totem'    },
  { id: 'ach_arcanist',    name: 'Line of Sight',       desc: 'Reach wave 10 as the Arcanist',    icon: '⚡', classId: 'arcanist',    wave: 10, unlocksItemId: 'ach_arcanists_focus'     },
  { id: 'ach_ranger',      name: 'Never Stop Moving',   desc: 'Reach wave 10 as the Ranger',      icon: '🎯', classId: 'ranger',      wave: 10, unlocksItemId: 'ach_rangers_quiver'      },
  { id: 'ach_prospector',  name: 'Struck It Rich',      desc: 'Reach wave 10 as the Prospector',  icon: '💰', classId: 'prospector',  wave: 10, unlocksItemId: 'ach_prospectors_lockbox' },
  { id: 'ach_reaver',      name: 'Last One Standing',   desc: 'Reach wave 10 as the Reaver',      icon: '🩸', classId: 'reaver',      wave: 10, unlocksItemId: 'ach_reavers_chalice'     },
  { id: 'ach_brawler',     name: 'Immovable Object',    desc: 'Reach wave 10 as the Brawler',     icon: '🗡️', classId: 'brawler',     wave: 10, unlocksItemId: 'ach_brawlers_warplate'   },
  // --- Endurance (wave-based, any class) ---
  { id: 'ach_wave15',      name: 'Seasoned Survivor',   desc: 'Reach wave 15 with any class',     icon: '🍀', wave: 15, unlocksItemId: 'ach_survivors_charm' },
  { id: 'ach_wave20',      name: 'Battle Veteran',      desc: 'Reach wave 20 with any class',     icon: '🏅', wave: 20, unlocksItemId: 'ach_veterans_medal'  },
  // --- Milestone achievements (rich check) ---
  {
    id: 'ach_first_boss',
    name: 'Boss Slayer',
    desc: 'Defeat your first boss',
    icon: '👑',
    unlocksItemId: 'ach_first_boss_reward',
    check: (s) => s.bossesDefeated >= 1,
  },
  {
    id: 'ach_blood_bath',
    name: 'Blood Bath',
    desc: 'Kill 1000 enemies total (across all runs)',
    icon: '🩸',
    unlocksItemId: 'ach_blood_bath_reward',
    check: (_s, c) => c.totalKills >= 1000,
  },
  {
    id: 'ach_speed_run',
    name: 'Sprint',
    desc: 'Reach wave 5 in under 3 minutes 30 seconds',
    icon: '⚡',
    unlocksItemId: 'ach_speed_run_reward',
    check: (s) => s.wavesReached >= 5 && s.runDurationMs > 0 && s.runDurationMs <= 210_000,
  },
  {
    id: 'ach_collector',
    name: 'Hoarder',
    desc: 'Own 10 or more items at the end of a run',
    icon: '🎒',
    unlocksItemId: 'ach_collector_reward',
    check: (s) => s.itemsCollected >= 10,
  },
  {
    id: 'ach_all_classes',
    name: 'Renaissance',
    desc: 'Reach wave 5 with all 7 classes',
    icon: '👑',
    unlocksItemId: 'ach_all_classes_reward',
    check: (_s, c) => ALL_CLASS_IDS.every(cls => c.classesReachedWave5.includes(cls)),
  },
];

interface AchievementSave {
  unlocked: string[];  // earned achievement ids
  disabled: string[];  // item ids the player has toggled OFF (out of the shop pool)
  cumulative?: {
    totalKills: number;
    classesReachedWave5: string[];
  };
}

export class AchievementSystem {
  private static STORAGE_KEY = 'roguelite_achievements';

  private static earned = new Set<string>();       // achievement ids
  private static disabledItems = new Set<string>(); // catalog item ids
  private static cumulative: CumulativeStats = { totalKills: 0, classesReachedWave5: [] };
  private static loaded = false;

  /** Read persisted state and reflect it into ItemDatabase. Safe to call more than once. */
  static load(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data: AchievementSave = JSON.parse(saved);
        this.earned = new Set(data.unlocked ?? []);
        this.disabledItems = new Set(data.disabled ?? []);
        this.cumulative = {
          totalKills: data.cumulative?.totalKills ?? 0,
          classesReachedWave5: data.cumulative?.classesReachedWave5 ?? [],
        };
      }
    } catch (e) {
      console.error('Failed to load achievements:', e);
    }
    this.loaded = true;
    this.applyToDatabase();
  }

  private static save(): void {
    const data: AchievementSave = {
      unlocked: [...this.earned],
      disabled: [...this.disabledItems],
      cumulative: {
        totalKills: this.cumulative.totalKills,
        classesReachedWave5: [...this.cumulative.classesReachedWave5],
      },
    };
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save achievements:', e);
    }
  }

  /** Flip every earned achievement's item to unlocked and push the disabled set into the pool. */
  private static applyToDatabase(): void {
    for (const ach of ACHIEVEMENTS) {
      if (this.earned.has(ach.id)) ItemDatabase.unlockItem(ach.unlocksItemId);
    }
    ItemDatabase.setDisabledItems(this.disabledItems);
  }

  /**
   * Evaluate a finished run with full stats against every not-yet-earned achievement.
   * Updates cumulative tracking, then checks both wave-based and rich achievements.
   * Returns the list newly earned this run (for a toast). Called from gameOver().
   */
  static checkRunFull(stats: RunStats): Achievement[] {
    if (!this.loaded) this.load();

    // Update cumulative stats first so cross-run achievements see this run's contribution.
    this.cumulative.totalKills += stats.enemiesKilled;
    if (stats.wavesReached >= 5 && !this.cumulative.classesReachedWave5.includes(stats.classId)) {
      this.cumulative.classesReachedWave5.push(stats.classId);
    }

    const newlyEarned: Achievement[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.earned.has(ach.id)) continue;

      let earned = false;
      if (ach.check) {
        // Rich check — receives both per-run stats and cumulative cross-run state.
        earned = ach.check(stats, this.cumulative);
      } else if (ach.wave !== undefined) {
        // Simple wave-based check (original behaviour).
        const classOk = ach.classId === undefined || ach.classId === stats.classId;
        earned = classOk && stats.wavesReached >= ach.wave;
      }

      if (earned) {
        this.earned.add(ach.id);
        ItemDatabase.unlockItem(ach.unlocksItemId);
        newlyEarned.push(ach);
      }
    }

    if (newlyEarned.length > 0 || stats.enemiesKilled > 0) this.save();
    return newlyEarned;
  }

  /**
   * Legacy wave-only check for backward-compatibility (used by QA scripts).
   * Prefer checkRunFull() in production code — it handles rich achievements too.
   */
  static checkRun(classId: string, waveReached: number): Achievement[] {
    if (!this.loaded) this.load();
    const newlyEarned: Achievement[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.earned.has(ach.id)) continue;
      // Only evaluate simple wave-based achievements (skip rich-check ones).
      if (ach.wave === undefined || ach.check) continue;
      const classOk = ach.classId === undefined || ach.classId === classId;
      if (classOk && waveReached >= ach.wave) {
        this.earned.add(ach.id);
        ItemDatabase.unlockItem(ach.unlocksItemId);
        newlyEarned.push(ach);
      }
    }
    if (newlyEarned.length > 0) this.save();
    return newlyEarned;
  }

  static isEarned(achievementId: string): boolean {
    return this.earned.has(achievementId);
  }

  static isItemDisabled(itemId: string): boolean {
    return this.disabledItems.has(itemId);
  }

  /** Toggle an unlocked reward item in/out of the shop pool. Persists + updates the database. */
  static toggleItemDisabled(itemId: string): void {
    if (this.disabledItems.has(itemId)) this.disabledItems.delete(itemId);
    else this.disabledItems.add(itemId);
    ItemDatabase.setDisabledItems(this.disabledItems);
    this.save();
  }

  static earnedCount(): number {
    return this.earned.size;
  }

  /** Current cumulative stats (readable by UI). */
  static getCumulative(): CumulativeStats {
    return { ...this.cumulative, classesReachedWave5: [...this.cumulative.classesReachedWave5] };
  }

  /** Test-only: wipe persisted state (used by headless QA to start from a clean slate). */
  static __resetForTest(): void {
    this.earned.clear();
    this.disabledItems.clear();
    this.cumulative = { totalKills: 0, classesReachedWave5: [] };
    ItemDatabase.setDisabledItems(this.disabledItems);
    try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ }
  }
}
