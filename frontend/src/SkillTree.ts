// SKILL TREE — a massive, PoE-style passive web (Felix, 2026-07-06).
//
// Replaces the old level-up 1-of-3 item pick and the first small 3-column tree.
// Each level-up grants 1 skill point (SP). Points bank during a wave (no mid-wave
// interruption) and are spent on a between-waves web screen the player pans & zooms.
//
// PoE concepts folded in (per Felix's guide review):
//   • CLASS START NODES  — each starting class begins at a different entry point.
//   • TRAVEL / MINOR nodes — small stat bumps that form the connective web.
//   • NOTABLES           — meaningful cluster anchors (bigger, combined effects).
//   • KEYSTONES          — build-defining outer nodes with a real trade-off.
//   • CONNECTED ALLOCATION — a node can only be taken if it neighbours an already
//     allocated node (or is your class start), so you path OUTWARD through the web.
//
// Like ArtifactSystem, the tree never reaches into combat directly: it folds its
// allocated nodes into the identity-default `skill*` fields on PlayerStats, which the
// getters pick up at read-time. Items/duos/artifacts/transformations stay untouched.

import type { PlayerStats } from './ItemSystem';

export type SkillNodeType = 'start' | 'minor' | 'notable' | 'keystone';

/** The stat fields a node can move. Mirrors the `skill*` PlayerStats fields. */
export interface SkillBonuses {
  damageMult: number;
  fireRateMult: number;
  critChanceBonus: number;
  critMultMult: number;
  maxHealthBonus: number;
  armorBonus: number;
  speedMult: number;
  regenBonus: number;
  xpMult: number;
  pickupMult: number;
  goldMult: number;
  // ---- BEHAVIOR grants (build-defining) — accumulate additively; 0 = off. ----
  piercingAdd: number;      // extra projectile pierces
  multishotAdd: number;     // extra projectiles per shot
  lifestealAdd: number;     // fraction of damage healed
  thornsAdd: number;        // reflect fraction
  chainAdd: number;         // chain-lightning chance
  executeAdd: number;       // execute-below-HP-fraction threshold
  knockbackAdd: number;     // knockback force
  explosionOnHit: number;   // >0 → grant on-hit/on-kill explosions
}

type BonusField = keyof SkillBonuses;

/** A single stat delta a node applies when allocated. `mul` multiplies, `add` adds. */
export interface SkillDelta {
  field: BonusField;
  mul?: number;
  add?: number;
}

export interface SkillNode {
  id: string;
  name: string;
  type: SkillNodeType;
  /** Thematic arm this node belongs to (for colour). */
  arm: string;
  /** Position in tree-space units (center of the web is 0,0). */
  x: number;
  y: number;
  icon: string;
  /** Stat deltas applied when allocated (empty for pure start/travel waypoints). */
  deltas: SkillDelta[];
  /** Human-readable effect line, precomputed from deltas. */
  desc: string;
  /** For `start` nodes: which class begins here. */
  classId?: string;
}

function identityBonuses(): SkillBonuses {
  return {
    damageMult: 1, fireRateMult: 1, critChanceBonus: 0, critMultMult: 1,
    maxHealthBonus: 0, armorBonus: 0, speedMult: 1, regenBonus: 0,
    xpMult: 1, pickupMult: 1, goldMult: 1,
    piercingAdd: 0, multishotAdd: 0, lifestealAdd: 0, thornsAdd: 0,
    chainAdd: 0, executeAdd: 0, knockbackAdd: 0, explosionOnHit: 0,
  };
}

// ---------------------------------------------------------------------------
// TREE DATA — built procedurally so the layout stays consistent and the graph
// is guaranteed connected. Six thematic arms radiate from a central hub; a ring
// of "gateway" nodes links the arms into one web, and each class starts at a
// different entry point.
// ---------------------------------------------------------------------------

export interface SkillArm { key: string; label: string; color: string; }

export const SKILL_ARMS: SkillArm[] = [
  { key: 'might',     label: 'MIGHT',     color: '#ff6b5c' }, // damage
  { key: 'precision', label: 'PRECISION', color: '#ffd43b' }, // crit
  { key: 'alacrity',  label: 'ALACRITY',  color: '#69db7c' }, // fire rate / speed
  { key: 'fortune',   label: 'FORTUNE',   color: '#b197fc' }, // gold / xp / pickup
  { key: 'vitality',  label: 'VITALITY',  color: '#74c0fc' }, // max HP / regen
  { key: 'aegis',     label: 'AEGIS',     color: '#3bc9db' }, // armor / defense
];

export const ARM_COLOR: Record<string, string> =
  Object.fromEntries(SKILL_ARMS.map(a => [a.key, a.color]));
export const ARM_LABEL: Record<string, string> =
  Object.fromEntries(SKILL_ARMS.map(a => [a.key, a.label]));

// Minor-node presets keyed by a short "kind". label/icon feed the card + desc.
const MINOR_KIND: Record<string, { name: string; delta: SkillDelta; label: string; icon: string }> = {
  dmg:   { name: 'Damage',    delta: { field: 'damageMult',      mul: 1.04 }, label: '+4% Damage',    icon: '⚔️' },
  crit:  { name: 'Crit',      delta: { field: 'critChanceBonus', add: 0.02 }, label: '+2% Crit',      icon: '🎯' },
  cmul:  { name: 'Crit Dmg',  delta: { field: 'critMultMult',    mul: 1.08 }, label: '+8% Crit Dmg',  icon: '💢' },
  rate:  { name: 'Fire Rate', delta: { field: 'fireRateMult',    mul: 1.04 }, label: '+4% Fire Rate', icon: '🔥' },
  spd:   { name: 'Move Spd',  delta: { field: 'speedMult',       mul: 1.03 }, label: '+3% Move Spd',  icon: '💨' },
  hp:    { name: 'Max HP',    delta: { field: 'maxHealthBonus',  add: 12   }, label: '+12 Max HP',    icon: '❤️' },
  arm:   { name: 'Armor',     delta: { field: 'armorBonus',      add: 2    }, label: '+2 Armor',      icon: '🛡️' },
  regen: { name: 'Regen',     delta: { field: 'regenBonus',      add: 0.3  }, label: '+0.3 HP/s',     icon: '💚' },
  gold:  { name: 'Gold',      delta: { field: 'goldMult',        mul: 1.05 }, label: '+5% Gold',      icon: '💰' },
  xp:    { name: 'XP',        delta: { field: 'xpMult',          mul: 1.05 }, label: '+5% XP',        icon: '📖' },
  pick:  { name: 'Pickup',    delta: { field: 'pickupMult',      mul: 1.08 }, label: '+8% Pickup',    icon: '🧲' },
};

// Per-arm flavour. Each arm now has a WIDE and DEEP layout: two parallel lanes of
// travel minors (its primary + secondary kind), FOUR notables (each anchoring a
// small pod of extra minors), and THREE build-defining keystones at the rim — a mix
// of stat trade-offs and genuine behaviour grants (pierce, multishot, lifesteal,
// thorns, chain, execute, explosions). This is the PoE "way way larger" pass.
interface NotableDef { name: string; icon: string; deltas: SkillDelta[]; desc: string }
interface KeystoneDef { name: string; icon: string; deltas: SkillDelta[]; desc: string }
interface ArmDef {
  primary: string;            // kind filling lane A minors
  secondary: string;          // kind filling lane B minors
  pod: string;                // kind filling the little pods hung off notables
  notables: NotableDef[];     // exactly 4 (nA..nD)
  keystones: KeystoneDef[];   // exactly 3 (kL, kM, kR)
}

const ARM_DEFS: Record<string, ArmDef> = {
  might: {
    primary: 'dmg', secondary: 'cmul', pod: 'dmg',
    notables: [
      { name: 'Brutality',   icon: '🪓', deltas: [{ field: 'damageMult', mul: 1.15 }], desc: '+15% Damage' },
      { name: 'Overpower',   icon: '👊', deltas: [{ field: 'damageMult', mul: 1.10 }, { field: 'critMultMult', mul: 1.15 }], desc: '+10% Damage, +15% Crit Dmg' },
      { name: 'War Cry',     icon: '📣', deltas: [{ field: 'damageMult', mul: 1.12 }, { field: 'knockbackAdd', add: 60 }], desc: '+12% Damage, +60 Knockback' },
      { name: 'Executioner', icon: '🔨', deltas: [{ field: 'executeAdd', add: 0.08 }, { field: 'damageMult', mul: 1.08 }], desc: 'Execute enemies below 8% HP, +8% Damage' },
    ],
    keystones: [
      { name: 'Overwhelm', icon: '💥', deltas: [{ field: 'damageMult', mul: 1.45 }, { field: 'fireRateMult', mul: 0.80 }], desc: '+45% Damage, but -20% Fire Rate' },
      { name: 'Cull the Weak', icon: '☠️', deltas: [{ field: 'executeAdd', add: 0.15 }, { field: 'critMultMult', mul: 1.20 }], desc: 'Instantly kill enemies below 15% HP, +20% Crit Dmg' },
      { name: 'Cataclysm', icon: '🌋', deltas: [{ field: 'explosionOnHit', add: 1 }, { field: 'fireRateMult', mul: 0.85 }], desc: 'Hits explode in an area, but -15% Fire Rate' },
    ],
  },
  precision: {
    primary: 'crit', secondary: 'cmul', pod: 'crit',
    notables: [
      { name: 'Deadeye',     icon: '🎯', deltas: [{ field: 'critChanceBonus', add: 0.06 }], desc: '+6% Crit Chance' },
      { name: 'Bloodletting',icon: '🩸', deltas: [{ field: 'critMultMult', mul: 1.30 }], desc: '+30% Crit Damage' },
      { name: 'Piercer',     icon: '➹', deltas: [{ field: 'piercingAdd', add: 1 }, { field: 'critChanceBonus', add: 0.03 }], desc: 'Projectiles pierce +1, +3% Crit' },
      { name: 'Arc Weaver',  icon: '🌩️', deltas: [{ field: 'chainAdd', add: 0.20 }, { field: 'critChanceBonus', add: 0.03 }], desc: '+20% Chain Lightning, +3% Crit' },
    ],
    keystones: [
      { name: 'Assassinate', icon: '🗡️', deltas: [{ field: 'critMultMult', mul: 2.0 }, { field: 'fireRateMult', mul: 0.75 }], desc: '+100% Crit Damage, but -25% Fire Rate' },
      { name: 'Splintering Rounds', icon: '🏹', deltas: [{ field: 'piercingAdd', add: 3 }, { field: 'damageMult', mul: 0.90 }], desc: 'Projectiles pierce +3 enemies, but -10% Damage' },
      { name: 'Storm Caller', icon: '⛈️', deltas: [{ field: 'chainAdd', add: 0.60 }, { field: 'critChanceBonus', add: 0.05 }], desc: '+60% Chain Lightning, +5% Crit Chance' },
    ],
  },
  alacrity: {
    primary: 'rate', secondary: 'spd', pod: 'rate',
    notables: [
      { name: 'Rapid Fire',  icon: '🔥', deltas: [{ field: 'fireRateMult', mul: 1.15 }], desc: '+15% Fire Rate' },
      { name: 'Fleet Foot',  icon: '🏃', deltas: [{ field: 'speedMult', mul: 1.10 }, { field: 'fireRateMult', mul: 1.06 }], desc: '+10% Move Speed, +6% Fire Rate' },
      { name: 'Volley',      icon: '🎇', deltas: [{ field: 'multishotAdd', add: 1 }, { field: 'damageMult', mul: 0.96 }], desc: '+1 Projectile, -4% Damage' },
      { name: 'Momentum',    icon: '🌀', deltas: [{ field: 'speedMult', mul: 1.08 }, { field: 'fireRateMult', mul: 1.08 }], desc: '+8% Move Speed, +8% Fire Rate' },
    ],
    keystones: [
      { name: 'Frenzy', icon: '⚡', deltas: [{ field: 'fireRateMult', mul: 1.50 }, { field: 'damageMult', mul: 0.80 }], desc: '+50% Fire Rate, but -20% Damage' },
      { name: 'Saturation Fire', icon: '🎆', deltas: [{ field: 'multishotAdd', add: 2 }, { field: 'fireRateMult', mul: 0.85 }], desc: '+2 Projectiles, but -15% Fire Rate' },
      { name: 'Blitz', icon: '💨', deltas: [{ field: 'speedMult', mul: 1.30 }, { field: 'fireRateMult', mul: 1.15 }, { field: 'maxHealthBonus', add: -30 }], desc: '+30% Move Speed, +15% Fire Rate, but -30 Max HP' },
    ],
  },
  fortune: {
    primary: 'gold', secondary: 'xp', pod: 'pick',
    notables: [
      { name: 'Prospector',  icon: '💰', deltas: [{ field: 'goldMult', mul: 1.20 }], desc: '+20% Gold' },
      { name: 'Scholar',     icon: '📚', deltas: [{ field: 'xpMult', mul: 1.15 }, { field: 'pickupMult', mul: 1.15 }], desc: '+15% XP, +15% Pickup' },
      { name: 'Magnetist',   icon: '🧲', deltas: [{ field: 'pickupMult', mul: 1.30 }], desc: '+30% Pickup Radius' },
      { name: 'Windfall',    icon: '🍀', deltas: [{ field: 'goldMult', mul: 1.15 }, { field: 'xpMult', mul: 1.10 }], desc: '+15% Gold, +10% XP' },
    ],
    keystones: [
      { name: 'Treasure Hunter', icon: '🏆', deltas: [{ field: 'goldMult', mul: 1.40 }, { field: 'xpMult', mul: 1.30 }, { field: 'damageMult', mul: 0.85 }], desc: '+40% Gold, +30% XP, but -15% Damage' },
      { name: 'Blood Money', icon: '🪙', deltas: [{ field: 'goldMult', mul: 1.60 }, { field: 'lifestealAdd', add: 0.05 }, { field: 'maxHealthBonus', add: -25 }], desc: '+60% Gold, +5% Lifesteal, but -25 Max HP' },
      { name: 'Scavenger', icon: '🦅', deltas: [{ field: 'pickupMult', mul: 1.60 }, { field: 'xpMult', mul: 1.25 }, { field: 'regenBonus', add: 1.5 }], desc: '+60% Pickup, +25% XP, +1.5 HP/s' },
    ],
  },
  vitality: {
    primary: 'hp', secondary: 'regen', pod: 'hp',
    notables: [
      { name: 'Constitution',icon: '❤️', deltas: [{ field: 'maxHealthBonus', add: 40 }], desc: '+40 Max HP' },
      { name: 'Recovery',    icon: '💚', deltas: [{ field: 'regenBonus', add: 1.2 }, { field: 'maxHealthBonus', add: 20 }], desc: '+1.2 HP/s, +20 Max HP' },
      { name: 'Bloodthirst', icon: '🧛', deltas: [{ field: 'lifestealAdd', add: 0.05 }, { field: 'maxHealthBonus', add: 15 }], desc: '+5% Lifesteal, +15 Max HP' },
      { name: 'Vigor',       icon: '🌿', deltas: [{ field: 'regenBonus', add: 2.0 }], desc: '+2.0 HP/s' },
    ],
    keystones: [
      { name: 'Juggernaut', icon: '🐘', deltas: [{ field: 'maxHealthBonus', add: 90 }, { field: 'speedMult', mul: 0.85 }], desc: '+90 Max HP, but -15% Move Speed' },
      { name: 'Sanguine Pact', icon: '🩸', deltas: [{ field: 'lifestealAdd', add: 0.12 }, { field: 'maxHealthBonus', add: 30 }], desc: '+12% Lifesteal, +30 Max HP' },
      { name: 'Undying', icon: '♾️', deltas: [{ field: 'regenBonus', add: 6 }, { field: 'maxHealthBonus', add: 40 }, { field: 'damageMult', mul: 0.85 }], desc: '+6 HP/s, +40 Max HP, but -15% Damage' },
    ],
  },
  aegis: {
    primary: 'arm', secondary: 'hp', pod: 'arm',
    notables: [
      { name: 'Ironhide',    icon: '🛡️', deltas: [{ field: 'armorBonus', add: 6 }], desc: '+6 Armor' },
      { name: 'Fortress',    icon: '🏰', deltas: [{ field: 'armorBonus', add: 4 }, { field: 'maxHealthBonus', add: 25 }], desc: '+4 Armor, +25 Max HP' },
      { name: 'Spiked Mail', icon: '🦔', deltas: [{ field: 'thornsAdd', add: 0.20 }, { field: 'armorBonus', add: 3 }], desc: '+20% Thorns, +3 Armor' },
      { name: 'Bracing',     icon: '💪', deltas: [{ field: 'knockbackAdd', add: 80 }, { field: 'armorBonus', add: 3 }], desc: '+80 Knockback, +3 Armor' },
    ],
    keystones: [
      { name: 'Bulwark', icon: '🐢', deltas: [{ field: 'armorBonus', add: 12 }, { field: 'regenBonus', add: 3 }, { field: 'speedMult', mul: 0.75 }], desc: '+12 Armor, +3 HP/s, but -25% Move Speed' },
      { name: 'Retribution', icon: '🔥', deltas: [{ field: 'thornsAdd', add: 0.60 }, { field: 'armorBonus', add: 6 }], desc: '+60% Thorns (reflect damage), +6 Armor' },
      { name: 'Immovable', icon: '🗿', deltas: [{ field: 'knockbackAdd', add: 220 }, { field: 'armorBonus', add: 8 }, { field: 'fireRateMult', mul: 0.90 }], desc: 'Massive knockback, +8 Armor, but -10% Fire Rate' },
    ],
  },
};

// Which arm each non-gunner class starts adjacent to (gunner starts at the center hub).
const CLASS_START_ARM: Record<string, string> = {
  ranger: 'alacrity',   // speed / fire-rate skirmisher
  brawler: 'aegis',     // armor / HP bruiser
  arcanist: 'might',    // glass-cannon damage
};

// Relative slot template applied to every arm. (radius, angleOffset°, role).
// role: 'p' = primary(laneA) minor, 's' = secondary(laneB) minor, 'pod' = pod minor,
//       'nA'..'nD' = the four notables, 'kL'/'kM'/'kR' = the three rim keystones.
// The arm fans out as TWO parallel lanes (A left, B right) climbing eight rings,
// with notables punctuating each lane and small pods hung off the mid notables —
// giving many alternate routes to the rim (the "more paths" ask).
interface Slot { key: string; r: number; off: number; role: string; }
const ARM_TEMPLATE: Slot[] = [
  { key: 'gate', r: 150, off: 0,   role: 'p'   },
  // Ring 1 — lanes split.
  { key: 'a1',   r: 250, off: -12, role: 'p'   },
  { key: 'b1',   r: 250, off: 12,  role: 's'   },
  // Ring 2 — first notables anchor each lane.
  { key: 'nA',   r: 355, off: -14, role: 'nA'  },
  { key: 'nB',   r: 355, off: 14,  role: 'nB'  },
  { key: 'mid2', r: 355, off: 0,   role: 'pod' },
  // Ring 3 — travel + pod hangers off the notables.
  { key: 'a3',   r: 460, off: -12, role: 's'   },
  { key: 'b3',   r: 460, off: 12,  role: 'p'   },
  { key: 'pA',   r: 430, off: -26, role: 'pod' },
  { key: 'pB',   r: 430, off: 26,  role: 'pod' },
  // Ring 4 — second notables.
  { key: 'nC',   r: 565, off: -13, role: 'nC'  },
  { key: 'nD',   r: 565, off: 13,  role: 'nD'  },
  { key: 'mid4', r: 565, off: 0,   role: 'pod' },
  // Ring 5 — travel converging toward the rim.
  { key: 'a5',   r: 670, off: -14, role: 'p'   },
  { key: 'b5',   r: 670, off: 14,  role: 's'   },
  { key: 'mid5', r: 670, off: 0,   role: 'pod' },
  // Ring 6 — rim approach.
  { key: 'a6',   r: 775, off: -18, role: 's'   },
  { key: 'b6',   r: 775, off: 18,  role: 'p'   },
  { key: 'mid6', r: 775, off: 0,   role: 'pod' },
  // Ring 7 — the three keystones at the outer rim.
  { key: 'kL',   r: 885, off: -22, role: 'kL'  },
  { key: 'kM',   r: 900, off: 0,   role: 'kM'  },
  { key: 'kR',   r: 885, off: 22,  role: 'kR'  },
];

// Intra-arm edges by slot key. Two lanes with rungs between them = a real web.
const ARM_EDGES: [string, string][] = [
  ['gate', 'a1'], ['gate', 'b1'],
  ['a1', 'nA'], ['b1', 'nB'],
  ['a1', 'mid2'], ['b1', 'mid2'],
  ['nA', 'a3'], ['nB', 'b3'],
  ['nA', 'pA'], ['nB', 'pB'],
  ['mid2', 'a3'], ['mid2', 'b3'],
  ['a3', 'nC'], ['b3', 'nD'],
  ['a3', 'mid4'], ['b3', 'mid4'],
  ['nC', 'a5'], ['nD', 'b5'],
  ['mid4', 'a5'], ['mid4', 'b5'],
  ['a5', 'mid5'], ['b5', 'mid5'],
  ['a5', 'a6'], ['b5', 'b6'],
  ['mid5', 'a6'], ['mid5', 'b6'],
  ['a6', 'kL'], ['a6', 'mid6'], ['b6', 'kR'], ['b6', 'mid6'],
  ['mid6', 'kM'], ['kL', 'kM'], ['kM', 'kR'],
];

function deg2rad(d: number): number { return (d * Math.PI) / 180; }

function buildTree(): { nodes: SkillNode[]; edges: [string, string][] } {
  const nodes: SkillNode[] = [];
  const edges: [string, string][] = [];

  // Central hub = gunner's start (balanced, in the middle of everything).
  nodes.push({
    id: 'start_gunner', name: 'Gunner', type: 'start', arm: 'core',
    x: 0, y: 0, icon: '🔫', deltas: [], desc: 'Balanced start', classId: 'gunner',
  });

  const armCount = SKILL_ARMS.length;
  const gatewayIds: string[] = [];

  SKILL_ARMS.forEach((arm, ai) => {
    const base = (360 / armCount) * ai;      // arm base angle
    const def = ARM_DEFS[arm.key];
    const slotId = (k: string) => `${arm.key}_${k}`;

    for (const slot of ARM_TEMPLATE) {
      const theta = deg2rad(base + slot.off);
      const x = Math.round(Math.cos(theta) * slot.r);
      const y = Math.round(Math.sin(theta) * slot.r);
      const id = slotId(slot.key);

      const NOTABLE_IDX: Record<string, number> = { nA: 0, nB: 1, nC: 2, nD: 3 };
      const KEYSTONE_IDX: Record<string, number> = { kL: 0, kM: 1, kR: 2 };

      let node: SkillNode;
      if (slot.role in KEYSTONE_IDX) {
        const k = def.keystones[KEYSTONE_IDX[slot.role]];
        node = { id, name: k.name, type: 'keystone', arm: arm.key, x, y, icon: k.icon, deltas: k.deltas, desc: k.desc };
      } else if (slot.role in NOTABLE_IDX) {
        const n = def.notables[NOTABLE_IDX[slot.role]];
        node = { id, name: n.name, type: 'notable', arm: arm.key, x, y, icon: n.icon, deltas: n.deltas, desc: n.desc };
      } else {
        const kindKey = slot.role === 'p' ? def.primary : slot.role === 's' ? def.secondary : def.pod;
        const kind = MINOR_KIND[kindKey];
        node = { id, name: kind.name, type: 'minor', arm: arm.key, x, y, icon: kind.icon, deltas: [kind.delta], desc: kind.label };
      }
      nodes.push(node);
    }

    // Intra-arm edges.
    for (const [a, b] of ARM_EDGES) edges.push([slotId(a), slotId(b)]);
    // Hub → gateway.
    edges.push(['start_gunner', slotId('gate')]);
    gatewayIds.push(slotId('gate'));
  });

  // Ring edges linking adjacent gateways into one web (inner loop).
  for (let i = 0; i < gatewayIds.length; i++) {
    edges.push([gatewayIds[i], gatewayIds[(i + 1) % gatewayIds.length]]);
  }

  // Cross-arm BRIDGE edges — link each arm's outer travel to the next arm's, so the
  // rim forms a loop and you can path between neighbouring themes without returning
  // to the hub (the PoE "wheel" feel + more routes to distant keystones).
  for (let i = 0; i < armCount; i++) {
    const a = SKILL_ARMS[i].key;
    const b = SKILL_ARMS[(i + 1) % armCount].key;
    edges.push([`${a}_b5`, `${b}_a5`]);   // mid-outer ring bridge
    edges.push([`${a}_b3`, `${b}_a3`]);   // mid ring bridge
  }

  // Non-gunner class start nodes, each just inside its thematic arm's gateway.
  const classIcon: Record<string, string> = { ranger: '🎯', brawler: '🗡️', arcanist: '⚡' };
  const className: Record<string, string> = { ranger: 'Ranger', brawler: 'Brawler', arcanist: 'Arcanist' };
  for (const [cls, armKey] of Object.entries(CLASS_START_ARM)) {
    const ai = SKILL_ARMS.findIndex(a => a.key === armKey);
    const theta = deg2rad((360 / armCount) * ai);
    const x = Math.round(Math.cos(theta) * 80);
    const y = Math.round(Math.sin(theta) * 80);
    const id = `start_${cls}`;
    nodes.push({ id, name: className[cls], type: 'start', arm: armKey, x, y, icon: classIcon[cls], deltas: [], desc: `${className[cls]} start`, classId: cls });
    edges.push([id, `${armKey}_gate`]);
  }

  return { nodes, edges };
}

const _tree = buildTree();
export const SKILL_NODES: SkillNode[] = _tree.nodes;
export const SKILL_EDGES: [string, string][] = _tree.edges;

const NODE_BY_ID: Record<string, SkillNode> = Object.fromEntries(SKILL_NODES.map(n => [n.id, n]));

// Undirected adjacency map.
const ADJ: Record<string, string[]> = {};
for (const n of SKILL_NODES) ADJ[n.id] = [];
for (const [a, b] of SKILL_EDGES) {
  if (ADJ[a] && !ADJ[a].includes(b)) ADJ[a].push(b);
  if (ADJ[b] && !ADJ[b].includes(a)) ADJ[b].push(a);
}

/** The start node id for a class (falls back to the gunner hub). */
export function startNodeForClass(classId: string | undefined): string {
  const n = SKILL_NODES.find(nd => nd.type === 'start' && nd.classId === classId);
  return n ? n.id : 'start_gunner';
}

export function getNode(id: string): SkillNode | undefined { return NODE_BY_ID[id]; }
export function neighborsOf(id: string): string[] { return ADJ[id] || []; }

export class SkillTree {
  availablePoints: number = 0;
  totalEarned: number = 0;
  /** Set of allocated node ids (includes the class start). */
  allocated: Set<string> = new Set();
  /** The class start node this run pathing anchors on. */
  startId: string = 'start_gunner';

  /** Reset for a fresh run of the given class (start node auto-allocated, free). */
  reset(classId?: string): void {
    this.availablePoints = 0;
    this.totalEarned = 0;
    this.startId = startNodeForClass(classId);
    this.allocated = new Set([this.startId]);
  }

  /** Re-anchor to a class start mid-setup (keeps points; used by beginRun order). */
  setClass(classId: string): void {
    this.startId = startNodeForClass(classId);
    this.allocated = new Set([this.startId]);
  }

  grantPoints(n: number = 1): void {
    this.availablePoints += n;
    this.totalEarned += n;
  }

  isAllocated(id: string): boolean { return this.allocated.has(id); }

  /** A node is reachable (allocatable-if-affordable) when a neighbour is allocated. */
  isReachable(id: string): boolean {
    if (this.allocated.has(id)) return true;
    for (const nb of neighborsOf(id)) if (this.allocated.has(nb)) return true;
    return false;
  }

  /** Can a point be spent on this node right now? */
  canAllocate(id: string): boolean {
    const node = NODE_BY_ID[id];
    if (!node) return false;
    if (node.type === 'start') return false;   // starts are free entry points, not bought
    if (this.allocated.has(id)) return false;
    if (this.availablePoints <= 0) return false;
    return this.isReachable(id);
  }

  /** Spend one point to allocate a node. Returns true if allocated. */
  allocate(id: string): boolean {
    if (!this.canAllocate(id)) return false;
    this.allocated.add(id);
    this.availablePoints--;
    return true;
  }

  computeBonuses(): SkillBonuses {
    const out = identityBonuses();
    for (const id of this.allocated) {
      const node = NODE_BY_ID[id];
      if (!node) continue;
      for (const d of node.deltas) {
        if (d.mul !== undefined) out[d.field] *= d.mul;
        if (d.add !== undefined) out[d.field] += d.add;
      }
    }
    return out;
  }

  recomputeInto(stats: PlayerStats): void {
    const b = this.computeBonuses();
    stats.skillDamageMult = b.damageMult;
    stats.skillFireRateMult = b.fireRateMult;
    stats.skillCritChanceBonus = b.critChanceBonus;
    stats.skillCritMultMult = b.critMultMult;
    stats.skillMaxHealthBonus = b.maxHealthBonus;
    stats.skillArmorBonus = b.armorBonus;
    stats.skillSpeedMult = b.speedMult;
    stats.skillRegenBonus = b.regenBonus;
    stats.skillXpMult = b.xpMult;
    stats.skillPickupMult = b.pickupMult;
    stats.skillGoldMult = b.goldMult;
    // Behavior grants (build-defining keystones/notables).
    stats.skillPiercingAdd = Math.round(b.piercingAdd);
    stats.skillMultishotAdd = Math.round(b.multishotAdd);
    stats.skillLifestealAdd = b.lifestealAdd;
    stats.skillThornsAdd = b.thornsAdd;
    stats.skillChainAdd = b.chainAdd;
    stats.skillExecuteAdd = b.executeAdd;
    stats.skillKnockbackAdd = b.knockbackAdd;
    stats.skillExplosionOnHit = b.explosionOnHit > 0;
  }

  /** Count of allocated non-start nodes (for display). */
  spentCount(): number {
    let n = 0;
    for (const id of this.allocated) if (NODE_BY_ID[id] && NODE_BY_ID[id].type !== 'start') n++;
    return n;
  }

  // ---- SAVE / LOAD (per-run) ----
  serialize(): { availablePoints: number; totalEarned: number; startId: string; allocated: string[] } {
    return {
      availablePoints: this.availablePoints,
      totalEarned: this.totalEarned,
      startId: this.startId,
      allocated: [...this.allocated],
    };
  }

  load(data: { availablePoints?: number; totalEarned?: number; startId?: string; allocated?: string[] } | undefined): void {
    if (!data) return;
    this.availablePoints = data.availablePoints ?? 0;
    this.totalEarned = data.totalEarned ?? 0;
    this.startId = (data.startId && NODE_BY_ID[data.startId]) ? data.startId : 'start_gunner';
    this.allocated = new Set([this.startId]);
    if (Array.isArray(data.allocated)) {
      // Only keep ids that still exist (defensive against an older node set).
      for (const id of data.allocated) if (NODE_BY_ID[id]) this.allocated.add(id);
    }
  }
}
