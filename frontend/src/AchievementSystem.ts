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

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Required starting class id, or undefined = any class counts. */
  classId?: string;
  /** Reach (>=) this wave in a single run to earn it. */
  wave: number;
  /** Catalog item id flipped to unlocked when earned. */
  unlocksItemId: string;
}

// The roster. Seven class-signature unlocks (beat wave 10 as that class → its tailor-made gear)
// plus two class-neutral endurance relics. Ordered class-first so the achievements screen reads
// as "one per class, then the milestones".
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'ach_gunner', name: 'Jack of All Trades', desc: 'Reach wave 10 as the Gunner', icon: '🔫', classId: 'gunner', wave: 10, unlocksItemId: 'ach_gunners_bandolier' },
  { id: 'ach_berserker', name: 'Blood and Thunder', desc: 'Reach wave 10 as the Berserker', icon: '🪓', classId: 'berserker', wave: 10, unlocksItemId: 'ach_berserkers_totem' },
  { id: 'ach_arcanist', name: 'Line of Sight', desc: 'Reach wave 10 as the Arcanist', icon: '⚡', classId: 'arcanist', wave: 10, unlocksItemId: 'ach_arcanists_focus' },
  { id: 'ach_ranger', name: 'Never Stop Moving', desc: 'Reach wave 10 as the Ranger', icon: '🎯', classId: 'ranger', wave: 10, unlocksItemId: 'ach_rangers_quiver' },
  { id: 'ach_prospector', name: 'Struck It Rich', desc: 'Reach wave 10 as the Prospector', icon: '💰', classId: 'prospector', wave: 10, unlocksItemId: 'ach_prospectors_lockbox' },
  { id: 'ach_reaver', name: 'Last One Standing', desc: 'Reach wave 10 as the Reaver', icon: '🩸', classId: 'reaver', wave: 10, unlocksItemId: 'ach_reavers_chalice' },
  { id: 'ach_brawler', name: 'Immovable Object', desc: 'Reach wave 10 as the Brawler', icon: '🗡️', classId: 'brawler', wave: 10, unlocksItemId: 'ach_brawlers_warplate' },
  { id: 'ach_wave15', name: 'Seasoned Survivor', desc: 'Reach wave 15 with any class', icon: '🍀', wave: 15, unlocksItemId: 'ach_survivors_charm' },
  { id: 'ach_wave20', name: 'Battle Veteran', desc: 'Reach wave 20 with any class', icon: '🏅', wave: 20, unlocksItemId: 'ach_veterans_medal' },
];

interface AchievementSave {
  unlocked: string[];  // earned achievement ids
  disabled: string[];  // item ids the player has toggled OFF (out of the shop pool)
}

export class AchievementSystem {
  private static STORAGE_KEY = 'roguelite_achievements';

  private static earned = new Set<string>();      // achievement ids
  private static disabledItems = new Set<string>(); // catalog item ids
  private static loaded = false;

  /** Read persisted state and reflect it into ItemDatabase. Safe to call more than once. */
  static load(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data: AchievementSave = JSON.parse(saved);
        this.earned = new Set(data.unlocked ?? []);
        this.disabledItems = new Set(data.disabled ?? []);
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
   * Evaluate a finished run against every not-yet-earned achievement. Returns the list newly
   * earned this run (for a toast), unlocking their items and persisting. Called from gameOver().
   */
  static checkRun(classId: string, waveReached: number): Achievement[] {
    if (!this.loaded) this.load();
    const newlyEarned: Achievement[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.earned.has(ach.id)) continue;
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

  /** Test-only: wipe persisted state (used by headless QA to start from a clean slate). */
  static __resetForTest(): void {
    this.earned.clear();
    this.disabledItems.clear();
    ItemDatabase.setDisabledItems(this.disabledItems);
    try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ }
  }
}
