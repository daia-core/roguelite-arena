// SKILL TREE — replaces the old level-up 1-of-3 item pick (Felix, 2026-07-05).
//
// Each level-up grants 1 skill point (SP). Points bank during a wave (no mid-wave
// interruption — same rule as the old banked item picks) and are spent on the
// between-waves tree screen. Progression is persistent within the run.
//
// The tree does NOT reach into combat directly: it folds its node ranks into the
// identity-default `skill*` bonus fields on PlayerStats (exactly like ArtifactSystem
// does with its `artifact*` fields), so getDamage/getFireRate/etc. pick the bonuses up
// at read-time. That keeps items/duos/artifacts/transformations completely untouched.

import type { PlayerStats } from './ItemSystem';

export type SkillBranch = 'offense' | 'defense' | 'utility';

export interface SkillNode {
  id: string;
  name: string;
  branch: SkillBranch;
  /** UI ordering within the branch column (0 = top). */
  tier: number;
  maxRank: number;
  /** Node id that must have >=1 rank before this unlocks. null = always available. */
  requires: string | null;
  /** Per-rank description shown on the card. */
  desc: string;
  icon: string;
}

/** Aggregated per-rank effect a node applies to the PlayerStats skill* fields.
 *  A node's total effect = (its per-rank effect) applied `rank` times. */
type NodeEffect = (rank: number, out: SkillBonuses) => void;

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

function identityBonuses(): SkillBonuses {
  return {
    damageMult: 1, fireRateMult: 1, critChanceBonus: 0, critMultMult: 1,
    maxHealthBonus: 0, armorBonus: 0, speedMult: 1, regenBonus: 0,
    xpMult: 1, pickupMult: 1, goldMult: 1,
  };
}

// ---- NODE DEFINITIONS ----
// Three short vertical chains. A node unlocks when its parent has >=1 rank, so the
// player commits to a branch but can splash across all three. Every node is a numeric
// rank (no boolean keystones in v1 — keeps aggregation + UI trivial and safe).

export const SKILL_NODES: SkillNode[] = [
  // OFFENSE (red)
  { id: 'sharpened',   name: 'Sharpened',   branch: 'offense', tier: 0, maxRank: 5, requires: null,         icon: '⚔️', desc: '+8% damage' },
  { id: 'rapidfire',   name: 'Rapid Fire',  branch: 'offense', tier: 1, maxRank: 5, requires: 'sharpened',  icon: '🔥', desc: '+6% fire rate' },
  { id: 'deadeye',     name: 'Deadeye',     branch: 'offense', tier: 2, maxRank: 5, requires: 'rapidfire',  icon: '🎯', desc: '+4% crit chance' },
  { id: 'executioner', name: 'Executioner', branch: 'offense', tier: 3, maxRank: 4, requires: 'deadeye',    icon: '💀', desc: '+25% crit damage' },

  // DEFENSE (blue)
  { id: 'vitality',    name: 'Vitality',     branch: 'defense', tier: 0, maxRank: 5, requires: null,        icon: '❤️', desc: '+20 max HP' },
  { id: 'ironhide',    name: 'Ironhide',     branch: 'defense', tier: 1, maxRank: 5, requires: 'vitality',  icon: '🛡️', desc: '+2 armor' },
  { id: 'regen',       name: 'Regeneration', branch: 'defense', tier: 2, maxRank: 5, requires: 'ironhide',  icon: '💚', desc: '+0.5 HP/s' },
  { id: 'bulwark',     name: 'Bulwark',      branch: 'defense', tier: 3, maxRank: 4, requires: 'regen',     icon: '🏰', desc: '+6% max HP & +1 armor' },

  // UTILITY (green)
  { id: 'swift',       name: 'Swift',   branch: 'utility', tier: 0, maxRank: 5, requires: null,       icon: '💨', desc: '+5% move speed' },
  { id: 'greed',       name: 'Greed',   branch: 'utility', tier: 1, maxRank: 5, requires: 'swift',    icon: '💰', desc: '+10% gold' },
  { id: 'scholar',     name: 'Scholar', branch: 'utility', tier: 2, maxRank: 5, requires: 'greed',    icon: '📖', desc: '+8% XP' },
  { id: 'magnet',      name: 'Magnet',  branch: 'utility', tier: 3, maxRank: 5, requires: 'scholar',  icon: '🧲', desc: '+15% pickup range' },
];

// Per-rank effect for each node id. `rank` is the number of points invested (>=1).
const NODE_EFFECTS: Record<string, NodeEffect> = {
  sharpened:   (r, o) => { o.damageMult *= 1 + 0.08 * r; },
  rapidfire:   (r, o) => { o.fireRateMult *= 1 + 0.06 * r; },
  deadeye:     (r, o) => { o.critChanceBonus += 0.04 * r; },
  executioner: (r, o) => { o.critMultMult *= 1 + 0.25 * r; },

  vitality:    (r, o) => { o.maxHealthBonus += 20 * r; },
  ironhide:    (r, o) => { o.armorBonus += 2 * r; },
  regen:       (r, o) => { o.regenBonus += 0.5 * r; },
  bulwark:     (r, o) => { o.maxHealthBonus += Math.round(100 * 0.06 * r); o.armorBonus += 1 * r; },

  swift:       (r, o) => { o.speedMult *= 1 + 0.05 * r; },
  greed:       (r, o) => { o.goldMult *= 1 + 0.10 * r; },
  scholar:     (r, o) => { o.xpMult *= 1 + 0.08 * r; },
  magnet:      (r, o) => { o.pickupMult *= 1 + 0.15 * r; },
};

export const SKILL_BRANCHES: SkillBranch[] = ['offense', 'defense', 'utility'];
export const BRANCH_LABEL: Record<SkillBranch, string> = {
  offense: 'OFFENSE', defense: 'DEFENSE', utility: 'UTILITY',
};
export const BRANCH_COLOR: Record<SkillBranch, string> = {
  offense: '#ff6b5c', defense: '#74c0fc', utility: '#69db7c',
};

const NODE_BY_ID: Record<string, SkillNode> = Object.fromEntries(SKILL_NODES.map(n => [n.id, n]));

export class SkillTree {
  /** Points still available to spend. */
  availablePoints: number = 0;
  /** Total points ever earned this run (for display). */
  totalEarned: number = 0;
  /** nodeId -> ranks invested. */
  ranks: Record<string, number> = {};

  reset(): void {
    this.availablePoints = 0;
    this.totalEarned = 0;
    this.ranks = {};
  }

  /** Grant `n` skill points (one per level-up). */
  grantPoints(n: number = 1): void {
    this.availablePoints += n;
    this.totalEarned += n;
  }

  rankOf(nodeId: string): number {
    return this.ranks[nodeId] || 0;
  }

  /** A node is unlocked when it has no prerequisite, or its prerequisite has >=1 rank. */
  isUnlocked(nodeId: string): boolean {
    const node = NODE_BY_ID[nodeId];
    if (!node) return false;
    if (!node.requires) return true;
    return this.rankOf(node.requires) >= 1;
  }

  /** Can the player spend a point on this node right now? */
  canSpend(nodeId: string): boolean {
    const node = NODE_BY_ID[nodeId];
    if (!node) return false;
    if (this.availablePoints <= 0) return false;
    if (!this.isUnlocked(nodeId)) return false;
    return this.rankOf(nodeId) < node.maxRank;
  }

  /** Spend one point on a node. Returns true if it was spent. */
  spend(nodeId: string): boolean {
    if (!this.canSpend(nodeId)) return false;
    this.ranks[nodeId] = this.rankOf(nodeId) + 1;
    this.availablePoints--;
    return true;
  }

  /** Fold current ranks into an aggregated bonus bundle. */
  computeBonuses(): SkillBonuses {
    const out = identityBonuses();
    for (const node of SKILL_NODES) {
      const rank = this.rankOf(node.id);
      if (rank <= 0) continue;
      NODE_EFFECTS[node.id]?.(rank, out);
    }
    return out;
  }

  /** Write the aggregated bonuses into PlayerStats' skill* fields (identity when empty). */
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

  // ---- SAVE / LOAD (per-run) ----
  serialize(): { availablePoints: number; totalEarned: number; ranks: Record<string, number> } {
    return { availablePoints: this.availablePoints, totalEarned: this.totalEarned, ranks: { ...this.ranks } };
  }

  load(data: { availablePoints?: number; totalEarned?: number; ranks?: Record<string, number> } | undefined): void {
    if (!data) return;
    this.availablePoints = data.availablePoints ?? 0;
    this.totalEarned = data.totalEarned ?? 0;
    this.ranks = {};
    if (data.ranks) {
      // Only keep ranks for nodes that still exist and within their maxRank (defensive
      // against a stale save from an older node set).
      for (const [id, rank] of Object.entries(data.ranks)) {
        const node = NODE_BY_ID[id];
        if (node && rank > 0) this.ranks[id] = Math.min(rank, node.maxRank);
      }
    }
  }
}

export function getNode(id: string): SkillNode | undefined {
  return NODE_BY_ID[id];
}
