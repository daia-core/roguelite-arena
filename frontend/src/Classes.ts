// Starting classes (Brotato-inspired) — the loadout you pick when a run begins.
//
// Each class is a STARTING TILT, not a straitjacket: it seeds a weapon feel and a
// stat lean, then the run's items take over. A class is defined purely as data —
// an optional starting weapon-item id (pulled from the catalog) plus flat/percent
// stat tweaks applied to the fresh PlayerStats. Game.applyClass() reads this; nothing
// here has behaviour. Keeping it data-only means adding a class is a one-object edit.

export interface StartingClass {
  id: string;
  name: string;
  icon: string;           // emoji shown on the pick card
  blurb: string;          // one-line pitch
  /** Catalog item id granted at run start (its weaponType sets the attack feel). */
  startItemId?: string;
  // Multiplicative tweaks to the fresh base stats (1 = unchanged).
  damageMult?: number;
  fireRateMult?: number;
  speedMult?: number;
  // Additive tweaks.
  maxHealthBonus?: number;
  armorBonus?: number;
  critChanceBonus?: number;
  startGoldBonus?: number;
}

// The roster (2026-07-07 rework — "more diverse & run-defining"). SEVEN classes, each
// pairing a DISTINCT weapon feel with a DISTINCT skill-tree START POSITION, so the very
// first pick already tilts the whole run toward a build. `gunner` starts at the tree's
// central hub (flexible, can commit any direction); every other class starts just inside
// ONE of the six themed arms (SkillTree.CLASS_START_ARM), so its opening skill points
// flow naturally toward that arm's build-defining keystones. Weapons span the whole
// arsenal — auto-aim, spread, beam, orbital, and three different melee styles (slam,
// thrust, arc) — so no two classes fight the same way. Data-only; Game.applyClass reads it.
export const STARTING_CLASSES: StartingClass[] = [
  {
    id: 'gunner',
    name: 'Gunner',
    icon: '🔫',
    blurb: 'Auto-aim all-rounder. Starts at the skill-tree hub, free to commit any direction — plus a fatter starting purse to bankroll the build you choose.',
    // No startItemId: keeps the default auto-aim gun. Hub start = maximum flexibility;
    // the extra gold + touch of crit make "flexible" an identity, not just "nothing".
    startGoldBonus: 35,
    critChanceBonus: 0.03,
  },
  {
    id: 'berserker',
    name: 'Berserker',
    icon: '🪓',
    blurb: 'Crashing Maul: slow, earth-shaking overhead slams with huge knockback. Starts in MIGHT — raw damage and execute. Hits like a truck, swings like one too.',
    startItemId: 'melee_hammer_t2',   // slam-style heavy melee (silences the gun)
    damageMult: 1.14,
    maxHealthBonus: 30,
    speedMult: 0.95,                   // heavy — a touch slower
  },
  {
    id: 'arcanist',
    name: 'Arcanist',
    icon: '⚡',
    blurb: 'Beam Rifle: a piercing laser that skewers whole lines. Starts in PRECISION — crit, pierce and chain lightning. A glass cannon that melts rows at once.',
    startItemId: 'laser_weapon_t3',
    damageMult: 1.12,
    maxHealthBonus: -20,              // glass cannon
    critChanceBonus: 0.06,
  },
  {
    id: 'ranger',
    name: 'Ranger',
    icon: '🎯',
    blurb: 'Scatter Gun: a wide close-range spread. Starts in ALACRITY — fire rate, move speed and extra projectiles. A mobile skirmisher who shreds packs and never stops moving.',
    startItemId: 'shotgun_weapon_t2',
    speedMult: 1.12,
    fireRateMult: 1.06,
  },
  {
    id: 'prospector',
    name: 'Prospector',
    icon: '💰',
    blurb: 'Satellite Orbs orbit and grind while you get rich. Starts in FORTUNE — gold, XP and pickup. Weak turn one, but snowballs through the shop into an avalanche.',
    startItemId: 'orbital_weapon_t3',
    startGoldBonus: 80,
    speedMult: 1.05,
  },
  {
    id: 'reaver',
    name: 'Reaver',
    icon: '🩸',
    blurb: 'Piercing Lance: long forward thrusts that run enemies through. Starts in VITALITY — health, regen and lifesteal. Wade in and outlast them, healing off every kill.',
    startItemId: 'melee_spear_t2',    // thrust-style piercing melee
    maxHealthBonus: 35,
    damageMult: 1.05,
  },
  {
    id: 'brawler',
    name: 'Brawler',
    icon: '🗡️',
    blurb: "Brawler's Cleaver: fast, wide sweeping cleaves. Starts in AEGIS — armor, thorns and knockback. A walking fortress that punishes every enemy foolish enough to touch it.",
    startItemId: 'brawler_blade_t1',  // arc-style fast melee
    maxHealthBonus: 40,
    armorBonus: 12,
    speedMult: 1.06,
  },
];

export function getClassById(id: string): StartingClass | undefined {
  return STARTING_CLASSES.find(c => c.id === id);
}
