import type { Scene } from './scenes/Scene';
import type { GameState } from './Game';
import type { Renderer } from './Renderer';
import type { Input } from './Input';
import { MapSystem, nodeIcon, nodeLabel, type NodeType } from './MapSystem';

/**
 * MapScene — the Slay-the-Spire-style node-routing screen shown between encounters.
 *
 * Step 3 of the incremental Game.ts de-god-classing (see ARCHITECTURE-REVIEW.md).
 * Logic moved verbatim from Game.drawMap / Game.updateMap; the only change is
 * reading shared context off deps rather than `this` (Game).
 *
 * Game.ts remains responsible for the state transition into 'map'
 * (toMapFromShop, which generates a new act if the previous one is complete)
 * and for resolving a picked node into the appropriate game state (onNodePicked).
 */
export interface MapSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;
  mapSystem: MapSystem;
  /** Called when the player picks a reachable node; Game.ts resolves it to the right state. */
  onNodePicked: (nodeId: string) => void;
}

export class MapScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly mapSystem: MapSystem;
  private readonly onNodePicked: (nodeId: string) => void;

  constructor(deps: MapSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.mapSystem = deps.mapSystem;
    this.onNodePicked = deps.onNodePicked;
  }

  enter(_prev: GameState): void {
    // Disarm any held press that triggered the transition so it can't
    // immediately register as a tap in the new screen.
    this.input.mouseDown = false;
  }

  update(_dt: number): void {
    if (!this.input.mouseDown) return;
    const { s, W, H } = this.screenScale();
    const placements = this.mapSystem.layout(W, H, s);
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    for (const id of this.mapSystem.reachable()) {
      const p = placements.get(id);
      if (!p) continue;
      const dx = mx - p.x;
      const dy = my - p.y;
      const hit = p.r * 1.6; // generous tap target for mobile
      if (dx * dx + dy * dy <= hit * hit) {
        this.input.mouseDown = false;
        this.onNodePicked(id);
        return;
      }
    }
  }

  draw(): void {
    const ctx = this.renderer.getContext();
    const { s, W, H, isMobile } = this.screenScale();

    // Dark parchment backdrop
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const map = this.mapSystem.map;
    if (!map) return;

    this.renderer.drawText('CHOOSE YOUR PATH', W / 2, s(28), {
      size: s(isMobile ? 15 : 22), align: 'center', color: '#ffd700',
    });
    this.renderer.drawText(`Act ${map.act}`, W / 2, s(28) + s(isMobile ? 16 : 22), {
      size: s(isMobile ? 9 : 11), align: 'center', color: '#c8b998',
    });

    const placements = this.mapSystem.layout(W, H, s);
    const reachable = new Set(this.mapSystem.reachable());

    // Edges first (behind the nodes). Live edges (from the current node to a
    // pickable node) glow gold; the rest are dim brown scaffolding.
    ctx.save();
    ctx.lineWidth = Math.max(1, s(2));
    for (const node of map.nodes) {
      const from = placements.get(node.id);
      if (!from) continue;
      for (const eid of node.edges) {
        const to = placements.get(eid);
        if (!to) continue;
        const live = map.currentId === node.id && reachable.has(eid);
        ctx.strokeStyle = live ? 'rgba(242,217,78,0.9)' : 'rgba(120,90,50,0.35)';
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    const colors: Record<NodeType, string> = {
      battle: '#c0855a', elite: '#d9534f', event: '#5bc0de',
      treasure: '#f2d94e', rest: '#8ce99a', boss: '#b06bd9',
    };

    for (const node of map.nodes) {
      const p = placements.get(node.id);
      if (!p) continue;
      const canPick = reachable.has(node.id);
      const isCurrent = map.currentId === node.id;
      ctx.save();
      ctx.globalAlpha = (canPick || isCurrent || node.visited) ? 1 : 0.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = (node.visited && !isCurrent) ? '#3a2c1a' : colors[node.type];
      ctx.fill();
      ctx.lineWidth = s(canPick ? 3 : 2);
      ctx.strokeStyle = isCurrent ? '#ffffff' : (canPick ? '#fff2b0' : '#2a1c0e');
      ctx.stroke();
      ctx.restore();

      this.renderer.drawText(nodeIcon(node.type), p.x, p.y - s(5), {
        size: s(isMobile ? 14 : 17), align: 'center', color: '#1a1008',
      });
      this.renderer.drawText(nodeLabel(node.type), p.x, p.y + p.r + s(3), {
        size: s(isMobile ? 7 : 8), align: 'center', color: canPick ? '#ffffff' : '#9a8a6a',
      });
    }

    this.renderer.drawText(
      map.currentId ? 'Tap a lit node to advance' : 'Tap a starting node',
      W / 2, H - s(22), { size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998' },
    );
  }

  /** Zoom/scale helpers — same computation as Game.screenScale(). */
  private screenScale() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;
    return { zoom, s, W, H, isMobile };
  }
}
