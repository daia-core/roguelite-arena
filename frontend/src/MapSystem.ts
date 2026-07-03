// Map / node meta-layer — the "Slay the Spire between waves" routing puzzle.
//
// The old loop was linear: wave -> shop -> next wave. This inserts a branching
// node map the player routes through: after each shop they open the map and pick
// which node to advance to. Node flavour (battle / elite / event / treasure /
// rest / boss) decides risk + reward; the global wave counter keeps advancing so
// the numeric difficulty ramp Felix already tuned stays intact — the map only
// chooses flavour + reward at each step (see DESIGN-MAP-NODE-LAYER.md §3).
//
// This module is pure data + geometry: generation, reachability, and a layout
// helper that maps nodes to screen positions (so draw AND hit-testing agree).
// Game.ts owns the actual rendering and resolves a picked node into game state.

import { randomInt } from './utils';

export type NodeType = 'battle' | 'elite' | 'event' | 'treasure' | 'rest' | 'boss';

export interface MapNode {
  id: string;
  /** Progression level: 0 = first pick, COLS = the act boss. Rendered bottom→top. */
  level: number;
  /** Slot within the level (0..count-1), used only for layout spread. */
  slot: number;
  type: NodeType;
  /** Ids of nodes in the next level reachable from here. */
  edges: string[];
  visited: boolean;
}

export interface ActMap {
  act: number;
  nodes: MapNode[];
  /** null before the first pick; otherwise the node the player currently sits on. */
  currentId: string | null;
  /** Number of battle/choice levels before the boss level. */
  levels: number;
}

/** A node's resolved screen geometry (shared by draw + input). */
export interface NodePlacement {
  x: number;
  y: number;
  r: number;
}

const ICONS: Record<NodeType, string> = {
  battle: '\u2694',    // crossed swords
  elite: '\u2620',     // skull & crossbones
  event: '?',
  treasure: '\u25C6',  // filled diamond (chest stand-in)
  rest: '\u263C',      // campfire / sun
  boss: '\u2660',      // large spade (big skull stand-in)
};

const LABELS: Record<NodeType, string> = {
  battle: 'Battle',
  elite: 'Elite',
  event: 'Event',
  treasure: 'Treasure',
  rest: 'Rest',
  boss: 'Boss',
};

export function nodeIcon(t: NodeType): string { return ICONS[t]; }
export function nodeLabel(t: NodeType): string { return LABELS[t]; }

export class MapSystem {
  map: ActMap | null = null;

  reset(): void {
    this.map = null;
  }

  /** Number of choice levels per act (before the boss). Compact per §3.1. */
  private levelsForAct(_act: number): number {
    return 6;
  }

  /**
   * Generate one act as a branching graph. Level 0 has 2-3 plain battle starts;
   * middle levels mix flavour under the StS-adapted distribution rules (§5); the
   * final level is a single boss. Edges only connect adjacent levels and never
   * cross, and every node is guaranteed reachable.
   */
  generateAct(act: number): ActMap {
    const levels = this.levelsForAct(act);
    const grid: MapNode[][] = [];

    // --- 1. node counts + placeholder nodes per level ---
    for (let lvl = 0; lvl <= levels; lvl++) {
      let count: number;
      if (lvl === levels) count = 1;            // boss level — single node
      else if (lvl === 0) count = randomInt(2, 3); // >=2 distinct starts
      else count = randomInt(2, 3);
      const row: MapNode[] = [];
      for (let slot = 0; slot < count; slot++) {
        row.push({
          id: `a${act}-l${lvl}-s${slot}`,
          level: lvl, slot,
          type: 'battle', // provisional; assigned below
          edges: [],
          visited: false,
        });
      }
      grid.push(row);
    }

    // --- 2. assign node types under the distribution rules ---
    const midStart = Math.floor(levels / 3);
    const topStart = Math.ceil((levels * 2) / 3);
    let treasurePlaced = false;
    let restPlaced = false;

    for (let lvl = 0; lvl <= levels; lvl++) {
      for (const node of grid[lvl]) {
        if (lvl === levels) { node.type = 'boss'; continue; }
        if (lvl === 0) { node.type = 'battle'; continue; } // ease-in
        node.type = this.rollNodeType(lvl, levels);
      }
    }

    // Guarantee exactly one treasure in the middle third and one rest in the top
    // third (but never the level right before the boss), overriding a battle slot.
    const forceType = (lvlFrom: number, lvlTo: number, type: NodeType): boolean => {
      for (let lvl = lvlFrom; lvl <= lvlTo; lvl++) {
        const battles = grid[lvl]?.filter(n => n.type === 'battle');
        if (battles && battles.length) {
          battles[randomInt(0, battles.length - 1)].type = type;
          return true;
        }
      }
      return false;
    };
    // Clear any organically-rolled treasures/rests first so we control placement.
    for (let lvl = 1; lvl < levels; lvl++)
      for (const n of grid[lvl]) if (n.type === 'treasure' || n.type === 'rest') n.type = 'battle';
    treasurePlaced = forceType(Math.max(1, midStart), Math.min(levels - 1, topStart), 'treasure');
    // Rest sits in the top third but never on the level immediately before the boss.
    restPlaced = forceType(topStart, levels - 2, 'rest');
    // Fallbacks if the thirds were too small to place them.
    if (!treasurePlaced) forceType(1, levels - 1, 'treasure');
    if (!restPlaced) forceType(1, levels - 2, 'rest');

    // --- 3. connect adjacent levels (no crossing, full reachability) ---
    for (let lvl = 0; lvl < levels; lvl++) {
      const cur = grid[lvl];
      const nxt = grid[lvl + 1];
      // Each current node connects to 1-2 nearest next-level nodes by slot ratio.
      for (const node of cur) {
        const nearest = this.nearestSlot(node, cur.length, nxt.length);
        const targets = new Set<number>([nearest]);
        if (nxt.length > 1 && Math.random() < 0.5) {
          const alt = Math.min(nxt.length - 1, Math.max(0, nearest + (Math.random() < 0.5 ? 1 : -1)));
          targets.add(alt);
        }
        for (const t of targets) node.edges.push(nxt[t].id);
      }
      // Ensure every next-level node has >=1 incoming edge.
      for (let t = 0; t < nxt.length; t++) {
        const hasIncoming = cur.some(n => n.edges.includes(nxt[t].id));
        if (!hasIncoming) {
          // hook it up from the current node whose nearest slot is closest to t.
          let best = cur[0];
          let bestDist = Infinity;
          for (const n of cur) {
            const d = Math.abs(this.nearestSlot(n, cur.length, nxt.length) - t);
            if (d < bestDist) { bestDist = d; best = n; }
          }
          best.edges.push(nxt[t].id);
        }
      }
      // Anti-degenerate rule: if a node's two edges resolve to the SAME type, try
      // to repoint one to a differently-typed sibling so every fork is a real choice.
      for (const node of cur) {
        if (node.edges.length === 2) {
          const [a, b] = node.edges.map(id => nxt.find(n => n.id === id)!);
          if (a.type === b.type) {
            const diff = nxt.find(n => n.type !== a.type && !node.edges.includes(n.id));
            if (diff) node.edges[1] = diff.id;
          }
        }
      }
      // De-dup edges.
      for (const node of cur) node.edges = [...new Set(node.edges)];
    }

    const flat = grid.flat();
    this.map = { act, nodes: flat, currentId: null, levels };
    return this.map;
  }

  /** Weighted flavour roll for a middle-level node (treasure/rest placed separately). */
  private rollNodeType(lvl: number, _levels: number): NodeType {
    const r = Math.random();
    // Elites only from level 2 onward.
    if (lvl >= 2 && r < 0.22) return 'elite';
    if (r < 0.45) return 'event';
    return 'battle';
  }

  /** Nearest next-level slot for a node, matched by fractional position. */
  private nearestSlot(node: MapNode, curCount: number, nextCount: number): number {
    if (nextCount === 1) return 0;
    const frac = curCount === 1 ? 0.5 : node.slot / (curCount - 1);
    return Math.round(frac * (nextCount - 1));
  }

  nodeById(id: string): MapNode | undefined {
    return this.map?.nodes.find(n => n.id === id);
  }

  /** Ids the player may pick right now: level-0 nodes at act start, else current node's edges. */
  reachable(): string[] {
    if (!this.map) return [];
    if (this.map.currentId === null) {
      return this.map.nodes.filter(n => n.level === 0).map(n => n.id);
    }
    const cur = this.nodeById(this.map.currentId);
    return cur ? [...cur.edges] : [];
  }

  canPick(id: string): boolean {
    return this.reachable().includes(id);
  }

  /** Advance onto a reachable node; marks it visited and returns it (or null if illegal). */
  pick(id: string): MapNode | null {
    if (!this.map || !this.canPick(id)) return null;
    const node = this.nodeById(id);
    if (!node) return null;
    node.visited = true;
    this.map.currentId = id;
    return node;
  }

  /** True once the player has cleared the boss node of the act. */
  isActComplete(): boolean {
    if (!this.map || this.map.currentId === null) return false;
    return this.nodeById(this.map.currentId)?.type === 'boss';
  }

  /**
   * Screen geometry for every node. Rendered bottom→top (level 0 low, boss high),
   * columns spread across the width. Both drawMap and input hit-testing call this
   * so they always agree. `s` scales a base pixel value by the canvas zoom.
   */
  layout(width: number, height: number, s: (v: number) => number): Map<string, NodePlacement> {
    const out = new Map<string, NodePlacement>();
    if (!this.map) return out;
    const levels = this.map.levels;
    const topPad = s(96);
    const botPad = s(120);
    const usableH = height - topPad - botPad;
    const r = s(24);
    for (const node of this.map.nodes) {
      // level 0 at the bottom, boss (level == levels) at the top
      const t = levels === 0 ? 0 : node.level / levels;
      const y = height - botPad - t * usableH;
      const row = this.map.nodes.filter(n => n.level === node.level);
      const n = row.length;
      const marginX = s(60);
      const spanX = width - marginX * 2;
      const x = n === 1 ? width / 2 : marginX + (spanX * node.slot) / (n - 1);
      out.set(node.id, { x, y, r });
    }
    return out;
  }
}

// ---- Serialisation for SaveManager (persist mid-act runs) ----

export function serializeMap(map: ActMap | null): any {
  if (!map) return null;
  return {
    act: map.act,
    currentId: map.currentId,
    levels: map.levels,
    nodes: map.nodes.map(n => ({
      id: n.id, level: n.level, slot: n.slot, type: n.type,
      edges: n.edges, visited: n.visited,
    })),
  };
}

export function deserializeMap(data: any): ActMap | null {
  if (!data || !Array.isArray(data.nodes)) return null;
  return {
    act: data.act ?? 1,
    currentId: data.currentId ?? null,
    levels: data.levels ?? 6,
    nodes: data.nodes.map((n: any) => ({
      id: n.id, level: n.level, slot: n.slot, type: n.type,
      edges: Array.isArray(n.edges) ? n.edges : [],
      visited: !!n.visited,
    })),
  };
}
