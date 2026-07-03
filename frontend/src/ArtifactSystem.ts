// Artifact system — map-granted, run-long modifiers (the Hades-boon / StS-relic
// layer). Distinct from the three existing build systems:
//   • ItemSystem items      = bought in the shop, additive stat stacks
//   • TransformationSystem   = passive set bonuses (3 melee → Berserker)
//   • EvolutionSystem        = weapon evolutions (base + catalyst + level)
// Artifacts are NOT bought and NOT set-triggered — you *route* to them on the
// map (events, treasure, elites, boss). They come in two flavours:
//   1. Numeric-but-huge  — big stat swings baked into PlayerStats.artifact* fields.
//   2. Rule-changing     — a flag the combat loop checks at named hook points
//      (glassCannon, secondWind, vampiric, momentum, berserk, thorns, overcharge).
//
// This module is self-contained: it holds the registry + the run's held list and
// knows how to fold its static contributions into a PlayerStats. The dynamic /
// hook effects are read by Game.ts at the relevant combat sites.

import type { PlayerStats } from './ItemSystem';

export type ArtifactRarity = 'rare' | 'epic' | 'legendary';

/** Rule-changing behaviours the combat loop hooks into. */
export type ArtifactFlag =
  | 'glassCannon'   // take more damage, deal more
  | 'secondWind'    // survive the first lethal hit of each wave at 1 HP
  | 'vampiric'      // kills heal a flat amount
  | 'momentum'      // damage ramps while moving
  | 'berserk'       // fire rate rises as HP drops
  | 'thorns'        // reflect a share of contact damage
  | 'overcharge';   // every Nth shot fires a free nova

export interface Artifact {
  id: string;
  name: string;
  desc: string;       // player-facing, one line
  icon: string;       // short glyph drawn on the node/card
  rarity: ArtifactRarity;
  // ---- static stat contributions (folded into PlayerStats on grant) ----
  damageMult?: number;
  fireRateMult?: number;
  speedMult?: number;
  maxHealthBonus?: number;
  critChanceBonus?: number;
  critMultMult?: number;
  xpMult?: number;
  // ---- rule-changing behaviour ----
  flags?: ArtifactFlag[];
  // Tuning knobs read by the hooks (all optional, sensible defaults in Game).
  glassTakenMult?: number;   // glassCannon: incoming damage ×
  vampHeal?: number;         // vampiric: HP per kill
  momentumBonus?: number;    // momentum: extra damage frac at full ramp
  berserkBonus?: number;     // berserk: extra fire-rate frac at 1 HP
  thornsFrac?: number;       // thorns: fraction of contact damage reflected
  overchargeEvery?: number;  // overcharge: shot count between free novas
}

// The roster. A deliberate mix of numeric-huge and rule-changing so the layer
// never feels like "just more items". High-impact; the first 10 include the
// rule-changing flags, the rest are big pure-stat swings.
export const ARTIFACTS: Artifact[] = [
  {
    id: 'glass_cannon', name: 'Glass Cannon', icon: '💥', rarity: 'epic',
    desc: 'Deal +120% damage, but take +60% damage.',
    damageMult: 2.2, flags: ['glassCannon'], glassTakenMult: 1.6,
  },
  {
    id: 'titans_heart', name: "Titan's Heart", icon: '❤️', rarity: 'rare',
    desc: '+80% max health, but -15% move speed.',
    maxHealthBonus: 80, speedMult: 0.85,
  },
  {
    id: 'scholars_codex', name: "Scholar's Codex", icon: '📖', rarity: 'rare',
    desc: 'Double all XP gained.',
    xpMult: 2,
  },
  {
    id: 'fleetfoot', name: 'Fleetfoot Charm', icon: '🪶', rarity: 'rare',
    desc: '+30% move speed and +20% fire rate.',
    speedMult: 1.3, fireRateMult: 1.2,
  },
  {
    id: 'executioner', name: "Executioner's Mark", icon: '💀', rarity: 'epic',
    desc: '+12% crit chance and +75% crit damage.',
    critChanceBonus: 0.12, critMultMult: 1.75,
  },
  {
    id: 'second_wind', name: 'Second Wind', icon: '🌬️', rarity: 'legendary',
    desc: 'The first lethal hit each wave leaves you at 1 HP instead of dying.',
    flags: ['secondWind'],
  },
  {
    id: 'vampiric_field', name: 'Vampiric Field', icon: '🧛', rarity: 'epic',
    desc: 'Every kill heals 2 HP.',
    flags: ['vampiric'], vampHeal: 2,
  },
  {
    id: 'momentum', name: 'Momentum Engine', icon: '🚀', rarity: 'epic',
    desc: 'Deal up to +50% damage the longer you keep moving.',
    flags: ['momentum'], momentumBonus: 0.5,
  },
  {
    id: 'berserk_core', name: 'Berserk Core', icon: '😡', rarity: 'epic',
    desc: 'The lower your health, the faster you fire (up to +80%).',
    flags: ['berserk'], berserkBonus: 0.8,
  },
  {
    id: 'spiked_aura', name: 'Spiked Aura', icon: '🦔', rarity: 'rare',
    desc: 'Reflect 40% of contact damage back to attackers.',
    flags: ['thorns'], thornsFrac: 0.4,
  },
  // ---- expanded roster (pure-stat, high-impact) ----
  {
    id: 'ironbark_totem', name: 'Ironbark Totem', icon: '🌵', rarity: 'rare',
    desc: '+45 max health and +10% damage.',
    maxHealthBonus: 45, damageMult: 1.1,
  },
  {
    id: 'duelists_edge', name: "Duelist's Edge", icon: '⚔️', rarity: 'rare',
    desc: '+25% damage and +8% crit chance.',
    damageMult: 1.25, critChanceBonus: 0.08,
  },
  {
    id: 'stormcaller', name: 'Stormcaller', icon: '⚡', rarity: 'epic',
    desc: '+40% fire rate and +15% move speed.',
    fireRateMult: 1.4, speedMult: 1.15,
  },
  {
    id: 'assassins_guile', name: "Assassin's Guile", icon: '🗡️', rarity: 'epic',
    desc: '+18% crit chance and +40% crit damage.',
    critChanceBonus: 0.18, critMultMult: 1.4,
  },
  {
    id: 'warlords_banner', name: "Warlord's Banner", icon: '🚩', rarity: 'epic',
    desc: '+45% damage and +20 max health.',
    damageMult: 1.45, maxHealthBonus: 20,
  },
  {
    id: 'prodigys_insight', name: "Prodigy's Insight", icon: '👁️', rarity: 'rare',
    desc: '+60% XP gained and +12% fire rate.',
    xpMult: 1.6, fireRateMult: 1.12,
  },
  {
    id: 'windrunner_boots', name: 'Windrunner Boots', icon: '👟', rarity: 'rare',
    desc: '+35% move speed and +25% XP gained.',
    speedMult: 1.35, xpMult: 1.25,
  },
  {
    id: 'colossus_plating', name: 'Colossus Plating', icon: '🪨', rarity: 'epic',
    desc: '+90 max health, but -10% move speed.',
    maxHealthBonus: 90, speedMult: 0.9,
  },
  {
    id: 'snipers_focus', name: "Sniper's Focus", icon: '🎯', rarity: 'rare',
    desc: '+100% crit damage.',
    critMultMult: 2.0,
  },
  {
    id: 'crown_of_slaughter', name: 'Crown of Slaughter', icon: '👑', rarity: 'legendary',
    desc: '+25% damage, +15% crit chance and +80% crit damage.',
    damageMult: 1.25, critChanceBonus: 0.15, critMultMult: 1.8,
  },
];

export function getArtifactById(id: string): Artifact | undefined {
  return ARTIFACTS.find(a => a.id === id);
}

export class ArtifactSystem {
  held: Artifact[] = [];

  reset(): void {
    this.held = [];
  }

  has(id: string): boolean {
    return this.held.some(a => a.id === id);
  }

  hasFlag(flag: ArtifactFlag): boolean {
    return this.held.some(a => a.flags?.includes(flag));
  }

  /** First held artifact carrying a flag (to read its tuning knobs). */
  private withFlag(flag: ArtifactFlag): Artifact | undefined {
    return this.held.find(a => a.flags?.includes(flag));
  }

  /** Add an artifact (ignoring duplicates) and re-fold static stats. */
  add(artifact: Artifact, stats: PlayerStats): boolean {
    if (this.has(artifact.id)) return false;
    this.held.push(artifact);
    this.applyStatic(stats);
    return true;
  }

  /**
   * Recompute the artifact* contribution fields on PlayerStats from scratch, so
   * this is idempotent and safe to call after any change (grant / restore).
   */
  applyStatic(stats: PlayerStats): void {
    let dmg = 1, fire = 1, spd = 1, hp = 0, critC = 0, critM = 1, xp = 1;
    for (const a of this.held) {
      if (a.damageMult) dmg *= a.damageMult;
      if (a.fireRateMult) fire *= a.fireRateMult;
      if (a.speedMult) spd *= a.speedMult;
      if (a.maxHealthBonus) hp += a.maxHealthBonus;
      if (a.critChanceBonus) critC += a.critChanceBonus;
      if (a.critMultMult) critM *= a.critMultMult;
      if (a.xpMult) xp *= a.xpMult;
    }
    stats.artifactDamageMult = dmg;
    stats.artifactFireRateMult = fire;
    stats.artifactSpeedMult = spd;
    stats.artifactMaxHealthBonus = hp;
    stats.artifactCritChanceBonus = critC;
    stats.artifactCritMultMult = critM;
    stats.artifactXpMult = xp;
  }

  // ---- Hook parameters read by Game.ts at combat sites ----

  /** Multiplier applied to incoming player damage (glass cannon). */
  incomingDamageMult(): number {
    const a = this.withFlag('glassCannon');
    return a?.glassTakenMult ?? 1;
  }

  /** HP restored per kill (vampiric field). 0 if not held. */
  killHeal(): number {
    const a = this.withFlag('vampiric');
    return a?.vampHeal ?? 0;
  }

  /** Fraction of contact damage reflected (spiked aura). 0 if not held. */
  thornsFraction(): number {
    const a = this.withFlag('thorns');
    return a?.thornsFrac ?? 0;
  }

  /** Extra damage fraction at full movement ramp (momentum). 0 if not held. */
  momentumBonus(): number {
    const a = this.withFlag('momentum');
    return a?.momentumBonus ?? 0;
  }

  /** Extra fire-rate fraction at 1 HP (berserk). 0 if not held. */
  berserkBonus(): number {
    const a = this.withFlag('berserk');
    return a?.berserkBonus ?? 0;
  }

  hasSecondWind(): boolean {
    return this.hasFlag('secondWind');
  }
}
