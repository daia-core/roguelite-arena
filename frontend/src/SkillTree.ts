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

// Per-arm flavour: which minor kinds fill its primary / secondary slots, its two
// notables, and its build-defining keystone (with a genuine trade-off).
interface ArmDef {
  primary: string;
  secondary: string;
  notables: { name: string; icon: string; deltas: SkillDelta[]; desc: string }[];
  keystone: { name: string; icon: string; deltas: SkillDelta[]; desc: string };
}

const ARM_DEFS: Record<string, ArmDef> = {
  might: {
    primary: 'dmg', secondary: 'cmul',
    notables: [
      { name: 'Brutality', icon: '🪓', deltas: [{ field: 'damageMult', mul: 1.15 }], desc: '+15% Damage' },
      { name: 'Overpower', icon: '👊', deltas: [{ field: 'damageMult', mul: 1.10 }, { field: 'critMultMult', mul: 1.15 }], desc: '+10% Damage, +15% Crit Dmg' },
    ],
    keystone: { name: 'Overwhelm', icon: '💥', deltas: [{ field: 'damageMult', mul: 1.45 }, { field: 'fireRateMult', mul: 0.80 }], desc: '+45% Damage, but -20% Fire Rate' },
  },
  precision: {
    primary: 'crit', secondary: 'cmul',
    notables: [
      { name: 'Deadeye', icon: '🎯', deltas: [{ field: 'critChanceBonus', add: 0.06 }], desc: '+6% Crit Chance' },
      { name: 'Bloodletting', icon: '🩸', deltas: [{ field: 'critMultMult', mul: 1.30 }], desc: '+30% Crit Damage' },
    ],
    keystone: { name: 'Assassinate', icon: '🗡️', deltas: [{ field: 'critMultMult', mul: 2.0 }, { field: 'fireRateMult', mul: 0.75 }], desc: '+100% Crit Damage, but -25% Fire Rate' },
  },
  alacrity: {
    primary: 'rate', secondary: 'spd',
    notables: [
      { name: 'Rapid Fire', icon: '🔥', deltas: [{ field: 'fireRateMult', mul: 1.15 }], desc: '+15% Fire Rate' },
      { name: 'Fleet Foot', icon: '🏃', deltas: [{ field: 'speedMult', mul: 1.10 }, { field: 'fireRateMult', mul: 1.06 }], desc: '+10% Move Speed, +6% Fire Rate' },
    ],
    keystone: { name: 'Frenzy', icon: '⚡', deltas: [{ field: 'fireRateMult', mul: 1.50 }, { field: 'damageMult', mul: 0.80 }], desc: '+50% Fire Rate, but -20% Damage' },
  },
  fortune: {
    primary: 'gold', secondary: 'xp',
    notables: [
      { name: 'Prospector', icon: '💰', deltas: [{ field: 'goldMult', mul: 1.20 }], desc: '+20% Gold' },
      { name: 'Scholar', icon: '📚', deltas: [{ field: 'xpMult', mul: 1.15 }, { field: 'pickupMult', mul: 1.15 }], desc: '+15% XP, +15% Pickup' },
    ],
    keystone: { name: 'Treasure Hunter', icon: '🏆', deltas: [{ field: 'goldMult', mul: 1.40 }, { field: 'xpMult', mul: 1.30 }, { field: 'damageMult', mul: 0.85 }], desc: '+40% Gold, +30% XP, but -15% Damage' },
  },
  vitality: {
    primary: 'hp', secondary: 'regen',
    notables: [
      { name: 'Constitution', icon: '❤️', deltas: [{ field: 'maxHealthBonus', add: 40 }], desc: '+40 Max HP' },
      { name: 'Recovery', icon: '💚', deltas: [{ field: 'regenBonus', add: 1.2 }, { field: 'maxHealthBonus', add: 20 }], desc: '+1.2 HP/s, +20 Max HP' },
    ],
    keystone: { name: 'Juggernaut', icon: '🐘', deltas: [{ field: 'maxHealthBonus', add: 90 }, { field: 'speedMult', mul: 0.85 }], desc: '+90 Max HP, but -15% Move Speed' },
  },
  aegis: {
    primary: 'arm', secondary: 'hp',
    notables: [
      { name: 'Ironhide', icon: '🛡️', deltas: [{ field: 'armorBonus', add: 6 }], desc: '+6 Armor' },
      { name: 'Fortress', icon: '🏰', deltas: [{ field: 'armorBonus', add: 4 }, { field: 'maxHealthBonus', add: 25 }], desc: '+4 Armor, +25 Max HP' },
    ],
    keystone: { name: 'Bulwark', icon: '🐢', deltas: [{ field: 'armorBonus', add: 12 }, { field: 'regenBonus', add: 3 }, { field: 'speedMult', mul: 0.75 }], desc: '+12 Armor, +3 HP/s, but -25% Move Speed' },
  },
};

// Which arm each non-gunner class starts adjacent to (gunner starts at the center hub).
const CLASS_START_ARM: Record<string, string> = {
  ranger: 'alacrity',   // speed / fire-rate skirmisher
  brawler: 'aegis',     // armor / HP bruiser
  arcanist: 'might',    // glass-cannon damage
};

// Relative slot template applied to every arm. (radius, angleOffset°, role).
// role: 'p' = primary minor, 's' = secondary minor, 'nA'/'nB' = notables, 'key' = keystone.
interface Slot { key: string; r: number; off: number; role: string; }
const ARM_TEMPLATE: Slot[] = [
  { key: 'gate', r: 150, off: 0,   role: 'p'   },
  { key: 't1a',  r: 250, off: -9,  role: 'p'   },
  { key: 't1b',  r: 250, off: 9,   role: 's'   },
  { key: 'nA',   r: 355, off: 0,   role: 'nA'  },
  { key: 't2a',  r: 355, off: -17, role: 's'   },
  { key: 't2b',  r: 355, off: 17,  role: 'p'   },
  { key: 't3a',  r: 460, off: -9,  role: 'p'   },
  { key: 't3b',  r: 460, off: 9,   role: 's'   },
  { key: 't4',   r: 565, off: -11, role: 'p'   },
  { key: 'nB',   r: 565, off: 11,  role: 'nB'  },
  { key: 't5',   r: 670, off: 0,   role: 's'   },
  { key: 't6a',  r: 670, off: -18, role: 's'   },
  { key: 't6b',  r: 670, off: 18,  role: 'p'   },
  { key: 'key',  r: 780, off: 0,   role: 'key' },
];

// Intra-arm edges by slot key.
const ARM_EDGES: [string, string][] = [
  ['gate', 't1a'], ['gate', 't1b'],
  ['t1a', 'nA'], ['t1b', 'nA'],
  ['t1a', 't2a'], ['t1b', 't2b'],
  ['nA', 't3a'], ['nA', 't3b'],
  ['t2a', 't3a'], ['t2b', 't3b'],
  ['t3a', 't4'], ['t3b', 'nB'],
  ['t4', 't5'], ['nB', 't5'],
  ['t5', 't6a'], ['t5', 't6b'],
  ['t6a', 'key'], ['t6b', 'key'],
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

      let node: SkillNode;
      if (slot.role === 'key') {
        node = { id, name: def.keystone.name, type: 'keystone', arm: arm.key, x, y, icon: def.keystone.icon, deltas: def.keystone.deltas, desc: def.keystone.desc };
      } else if (slot.role === 'nA' || slot.role === 'nB') {
        const n = def.notables[slot.role === 'nA' ? 0 : 1];
        node = { id, name: n.name, type: 'notable', arm: arm.key, x, y, icon: n.icon, deltas: n.deltas, desc: n.desc };
      } else {
        const kind = MINOR_KIND[slot.role === 'p' ? def.primary : def.secondary];
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

  // Ring edges linking adjacent gateways into one web.
  for (let i = 0; i < gatewayIds.length; i++) {
    edges.push([gatewayIds[i], gatewayIds[(i + 1) % gatewayIds.length]]);
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
