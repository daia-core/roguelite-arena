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

// The roster. `gunner` is the classic all-rounder (matches the old default run, so
// picking it changes nothing from before). The others each open a distinct playstyle
// from turn one — the point of the pick.
export const STARTING_CLASSES: StartingClass[] = [
  {
    id: 'gunner',
    name: 'Gunner',
    icon: '🔫',
    blurb: 'Balanced auto-aim. A safe all-rounder — no starting weapon, pure stats.',
    // No startItemId: keeps the default auto-aim gun (identical to the pre-class run).
    damageMult: 1,
  },
  {
    id: 'ranger',
    name: 'Ranger',
    icon: '🎯',
    blurb: 'Scatter Gun start: a wide spread that shreds packs up close.',
    startItemId: 'shotgun_weapon_t2',
    speedMult: 1.1,        // mobile skirmisher
    fireRateMult: 1.05,
  },
  {
    id: 'brawler',
    name: 'Brawler',
    icon: '🗡️',
    blurb: 'Pure melee: no gun, a heavy swing, extra health & armor. Get in close.',
    startItemId: 'brawler_blade_t1',
    maxHealthBonus: 40,
    armorBonus: 12,
    speedMult: 1.08,       // needs to close distance
  },
  {
    id: 'arcanist',
    name: 'Arcanist',
    icon: '⚡',
    blurb: 'Beam Rifle start: a piercing laser and a glass-cannon damage tilt.',
    startItemId: 'laser_weapon_t3',
    damageMult: 1.15,
    maxHealthBonus: -20,   // glass cannon
    critChanceBonus: 0.05,
  },
];

export function getClassById(id: string): StartingClass | undefined {
  return STARTING_CLASSES.find(c => c.id === id);
}
