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
  // A CURSE — a devil-deal downside artifact. Curses fold their (negative) stats
  // through the exact same static path as any artifact; the only difference is they
  // are excluded from the RANDOM artifact pools, so they arrive ONLY as the price of
  // a devil deal (paired with a strong boon in the same event option).
  curse?: boolean;
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
  // ---- SOULSTONE EXPANSION: support-skill boons (Might / Bloodlust / Empower / Frenzy) ----
  // Big run-long stat swings adapting Soulstone's support actives. Pure-stat so they fold
  // through the existing static path; a mix of rarities keeps the reward pool varied.
  { id: 'might_totem', name: 'Totem of Might', icon: '💪', rarity: 'epic', desc: '+55% damage.', damageMult: 1.55 },
  { id: 'bloodlust_idol', name: 'Bloodlust Idol', icon: '🩸', rarity: 'epic', desc: '+30% fire rate and +20% move speed.', fireRateMult: 1.3, speedMult: 1.2 },
  { id: 'empower_sigil', name: 'Empowerment Sigil', icon: '✨', rarity: 'rare', desc: '+30% damage and +10% crit chance.', damageMult: 1.3, critChanceBonus: 0.1 },
  { id: 'frenzy_core', name: 'Frenzy Core', icon: '🌀', rarity: 'epic', desc: '+50% fire rate.', fireRateMult: 1.5 },
  { id: 'ancestral_boon', name: 'Ancestral Boon', icon: '🗿', rarity: 'rare', desc: '+40% XP and +25 max health.', xpMult: 1.4, maxHealthBonus: 25 },
  { id: 'warcry_pendant', name: 'Warcry Pendant', icon: '📢', rarity: 'rare', desc: '+35% damage, but -8% move speed.', damageMult: 1.35, speedMult: 0.92 },
  { id: 'zealots_fervor', name: "Zealot's Fervor", icon: '🔥', rarity: 'epic', desc: '+25% fire rate and +30% crit damage.', fireRateMult: 1.25, critMultMult: 1.3 },
  { id: 'giants_vigor', name: "Giant's Vigor", icon: '🧌', rarity: 'rare', desc: '+70 max health.', maxHealthBonus: 70 },
  { id: 'hunters_mark_relic', name: "Hunter's Mark", icon: '🏹', rarity: 'rare', desc: '+15% crit chance.', critChanceBonus: 0.15 },
  { id: 'berserkers_roar', name: "Berserker's Roar", icon: '🦁', rarity: 'legendary', desc: '+60% damage, but -20 max health.', damageMult: 1.6, maxHealthBonus: -20 },
  { id: 'sages_wisdom', name: "Sage's Wisdom", icon: '🧠', rarity: 'epic', desc: '+90% XP gained.', xpMult: 1.9 },
  { id: 'phoenix_feather', name: 'Phoenix Feather', icon: '🪶', rarity: 'legendary', desc: 'Survive the first lethal hit each wave, and +20% damage.', flags: ['secondWind'], damageMult: 1.2 },
  { id: 'bloodpact_relic', name: 'Bloodpact Relic', icon: '🧛', rarity: 'epic', desc: 'Every kill heals 3 HP, and +15% damage.', flags: ['vampiric'], vampHeal: 3, damageMult: 1.15 },
  { id: 'juggernaut_core', name: 'Juggernaut Core', icon: '🚂', rarity: 'legendary', desc: 'Damage ramps up to +65% while moving.', flags: ['momentum'], momentumBonus: 0.65 },
  { id: 'deaths_wager', name: "Death's Wager", icon: '☠️', rarity: 'legendary', desc: 'Fire rate climbs up to +100% as HP falls.', flags: ['berserk'], berserkBonus: 1.0 },
  { id: 'reactive_carapace', name: 'Reactive Carapace', icon: '🐢', rarity: 'epic', desc: 'Reflect 55% of contact damage, and +30 max health.', flags: ['thorns'], thornsFrac: 0.55, maxHealthBonus: 30 },
  { id: 'overcharge_battery', name: 'Overcharge Battery', icon: '🔋', rarity: 'epic', desc: 'Every 6th shot fires a free nova.', flags: ['overcharge'], overchargeEvery: 6 },
  { id: 'gale_talisman', name: 'Gale Talisman', icon: '🌬️', rarity: 'rare', desc: '+28% move speed.', speedMult: 1.28 },
  { id: 'ironclad_crest', name: 'Ironclad Crest', icon: '⚙️', rarity: 'rare', desc: '+55 max health and +10% damage.', maxHealthBonus: 55, damageMult: 1.1 },
  { id: 'volcanic_heart', name: 'Volcanic Heart', icon: '🌋', rarity: 'legendary', desc: '+70% damage, but take +25% damage.', damageMult: 1.7, flags: ['glassCannon'], glassTakenMult: 1.25 },
  { id: 'twin_moons', name: 'Twin Moons', icon: '🌙', rarity: 'epic', desc: '+20% crit chance and +60% crit damage.', critChanceBonus: 0.2, critMultMult: 1.6 },
  { id: 'oracles_eye', name: "Oracle's Eye", icon: '🔮', rarity: 'rare', desc: '+50% XP and +12% fire rate.', xpMult: 1.5, fireRateMult: 1.12 },
  { id: 'titanforged_aegis', name: 'Titanforged Aegis', icon: '🛡️', rarity: 'legendary', desc: '+120 max health, but -15% fire rate.', maxHealthBonus: 120, fireRateMult: 0.85 },
  { id: 'reapers_harvest', name: "Reaper's Harvest", icon: '🌾', rarity: 'legendary', desc: 'Kills heal 4 HP, and +25% move speed.', flags: ['vampiric'], vampHeal: 4, speedMult: 1.25 },

  // ---- CURSES (devil-deal downsides — never in the random pool) ----
  {
    id: 'curse_frailty', name: 'Curse of Frailty', icon: '💔', rarity: 'legendary',
    desc: 'Take +50% damage from everything, permanently.',
    curse: true, flags: ['glassCannon'], glassTakenMult: 1.5,
  },
  { id: 'curse_glass_bones', name: 'Curse of Glass Bones', icon: '🦴', rarity: 'legendary', desc: '-45 max health, permanently.', curse: true, maxHealthBonus: -45 },
  { id: 'curse_myopia', name: 'Curse of Myopia', icon: '👓', rarity: 'legendary', desc: '-12% crit chance, permanently.', curse: true, critChanceBonus: -0.12 },
  { id: 'curse_famine', name: 'Curse of Famine', icon: '🍂', rarity: 'legendary', desc: '-40% XP gained, permanently.', curse: true, xpMult: 0.6 },
  {
    id: 'curse_sloth', name: 'Curse of Sloth', icon: '🐢', rarity: 'legendary',
    desc: '-30% move speed, permanently.',
    curse: true, speedMult: 0.7,
  },
  {
    id: 'curse_dullness', name: 'Curse of Dullness', icon: '🌫️', rarity: 'legendary',
    desc: '-25% fire rate, permanently.',
    curse: true, fireRateMult: 0.75,
  },
  // curse_torpor and curse_entropy: unique curses for devil_rot_crown and cursed_reliquary
  // (separate IDs prevent the "already-bears-this-curse → grant nothing" guard from
  // blocking boons when two *different* devil events share a curse id).
  // Distinct mechanical effects avoid silent stacking with curse_sloth / curse_famine.
  {
    id: 'curse_torpor', name: 'Curse of Torpor', icon: '🌿', rarity: 'legendary',
    desc: '-25% damage output, permanently.',
    curse: true, damageMult: 0.75,
  },
  {
    id: 'curse_entropy', name: 'Curse of Entropy', icon: '⌛', rarity: 'legendary',
    desc: '-55 max health, permanently.',
    curse: true, maxHealthBonus: -55,
  },
];

export function getArtifactById(id: string): Artifact | undefined {
  return ARTIFACTS.find(a => a.id === id);
}

/** Artifacts eligible for the RANDOM reward pools — excludes devil-deal curses. */
export const ROLLABLE_ARTIFACTS: Artifact[] = ARTIFACTS.filter(a => !a.curse);

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

  /** Shot interval for the free nova (overcharge). 0 if not held. */
  overchargeEvery(): number {
    const a = this.withFlag('overcharge');
    return a?.overchargeEvery ?? 0;
  }
}
