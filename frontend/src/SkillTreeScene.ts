/**
 * SkillTreeScene — the between-wave skill-tree screen (step 12 of Game.ts de-god-classing).
 *
 * Owns all st* state (pan, zoom, pointer tracking, selection) and the
 * full render/input loop for the 'skilltree' GameState.  Game.ts retains
 * the SkillTree instance (it's shared state that also drives player stats)
 * and a thin openSkillTree() entry point that hands off to scene.open().
 */

import { SkillTree, SKILL_NODES, SKILL_EDGES, ARM_COLOR, getNode, type SkillNode } from './SkillTree';
import { PlayerStats } from './ItemSystem';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { pointInRect } from './utils';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';
import type { Scene } from './scenes/Scene';

// ─── Deps ─────────────────────────────────────────────────────────────────────

export interface SkillTreeSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;

  /** The live SkillTree instance (shared with Game — allocations take effect immediately). */
  getSkillTree(): SkillTree;
  /** The live PlayerStats object — recomputeInto() mutates it in place. */
  getPlayerStats(): PlayerStats;

  /**
   * Called after a node is successfully allocated.
   * Game handles: refreshMaxHealth() + audio.playLevelUp() + screenEffects.flash(armColor).
   */
  onNodeAllocated(armColor: string): void;

  /**
   * Called when the player hits Continue.
   * returnToShop=true  → Game transitions to 'shop'
   * returnToShop=false → Game transitions to 'playing'
   */
  onFinish(returnToShop: boolean): void;
}

// ─── SkillTreeScene ───────────────────────────────────────────────────────────

export class SkillTreeScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly deps: SkillTreeSceneDeps;

  // ── Pan / zoom / pointer state ────────────────────────────────────────────
  private panX: number = 0;
  private panY: number = 0;
  private zoom: number = 0.5;
  private pointerActive: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private downX: number = 0;
  private downY: number = 0;
  private dragDist: number = 0;
  private pinchDist: number = 0;         // previous-frame spread (0 = not pinching)
  private selected: string | null = null; // last-tapped node id (for the info panel)

  // Carried across the open() → Continue cycle: did the player open the tree
  // via the shop-break shortcut?  If so, Continue returns to the shop.
  private returnToShop: boolean = false;

  constructor(deps: SkillTreeSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.deps = deps;
  }

  // ─── Entry point ──────────────────────────────────────────────────────────

  /**
   * Called by Game.openSkillTree(fromShop) before setting state = 'skilltree'.
   * Resets pointer/drag state and frames the start node.
   */
  open(fromShop: boolean): void {
    this.returnToShop = fromShop;
    this.pointerActive = false;
    this.dragDist = 0;
    this.centerOnStart();
    this.input.disarmUntilRelease(); // a held finger from the shop can't insta-tap a node
  }

  // ─── Scene interface ──────────────────────────────────────────────────────

  update(_dt: number): void {
    const mx = this.input.mouseX, my = this.input.mouseY;
    const down = this.input.mouseDown;
    const { s } = this.stView();

    // Two-finger pinch-zoom about the midpoint.  While active, the single-pointer
    // pan/tap path is suppressed so lifting a finger can't register as a tap.
    const pinch = this.input.getPinch();
    if (pinch) {
      if (this.pinchDist > 0 && pinch.dist > 0) {
        this.zoomAbout(pinch.dist / this.pinchDist, pinch.cx, pinch.cy);
      }
      this.pinchDist = pinch.dist;
      this.pointerActive = false;
      return;
    }
    this.pinchDist = 0;

    if (down && !this.pointerActive) {
      // Press start — record anchor to distinguish tap from pan on release.
      this.pointerActive = true;
      this.downX = mx; this.downY = my;
      this.lastX = mx; this.lastY = my;
      this.dragDist = 0;
    } else if (down && this.pointerActive) {
      // Held — drag pans the web.
      const dx = mx - this.lastX, dy = my - this.lastY;
      this.panX += dx; this.panY += dy;
      this.dragDist += Math.abs(dx) + Math.abs(dy);
      this.lastX = mx; this.lastY = my;
    } else if (!down && this.pointerActive) {
      // Release — small-travel press = tap.
      this.pointerActive = false;
      if (this.dragDist <= s(6)) this.handleTap(this.downX, this.downY);
    }
  }

  draw(): void {
    const ctx = this.renderer.getContext();
    const V = this.stView();
    const { s, W, isMobile } = V;
    const Z = this.zoom * V.zoom;

    // Dark parchment backdrop (same as RewardScene / ShopScene).
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    const skillTree = this.deps.getSkillTree();

    const screenOf = (n: SkillNode) => ({
      x: V.cx + this.panX + n.x * Z,
      y: V.cy + this.panY + n.y * Z,
    });
    const zScale = Math.min(1.4, Math.max(0.6, this.zoom / 0.5));

    // ── Web (edges + nodes), clipped to the band between header and info panel ──
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, V.topBand, W, V.infoY - V.topBand);
    ctx.clip();

    // Edges first so nodes sit on top.
    ctx.lineWidth = Math.max(1, s(1.2) * zScale);
    for (const [a, b] of SKILL_EDGES) {
      const na = getNode(a), nb = getNode(b);
      if (!na || !nb) continue;
      const pa = screenOf(na), pb = screenOf(nb);
      if ((pa.x < -60 && pb.x < -60) || (pa.x > W + 60 && pb.x > W + 60)) continue;
      const both  = skillTree.isAllocated(a) && skillTree.isAllocated(b);
      const either = skillTree.isAllocated(a) || skillTree.isAllocated(b);
      ctx.strokeStyle = both ? '#ffe9a8' : either ? '#8a7a52' : '#3a3020';
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }

    // Nodes.
    const showLabels = this.zoom >= 0.42;
    for (const node of SKILL_NODES) {
      const p = screenOf(node);
      const r = this.nodeRadius(node);
      if (p.x < -r * 2 || p.x > W + r * 2 || p.y < V.topBand - r * 2 || p.y > V.infoY + r * 2) continue;
      const alloc    = skillTree.isAllocated(node.id);
      const reachable = skillTree.isReachable(node.id);
      const canAlloc  = skillTree.canAllocate(node.id);
      const armColor  = node.arm === 'core' ? '#ffd700' : (ARM_COLOR[node.arm] || '#c8b998');

      ctx.save();
      ctx.beginPath();
      if (node.type === 'keystone') {
        ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y);
        ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y); ctx.closePath();
      } else if (node.type === 'start') {
        ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
      } else {
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle   = alloc ? armColor : canAlloc ? '#2a2416' : reachable ? '#231d12' : '#181206';
      ctx.fill();
      ctx.lineWidth   = Math.max(1, s(canAlloc ? 2.2 : 1.4));
      ctx.strokeStyle = alloc ? '#fff4cf' : canAlloc ? armColor : reachable ? '#6b5d47' : '#3a3020';
      ctx.stroke();
      if (this.selected === node.id) {
        ctx.lineWidth   = Math.max(1, s(1.5));
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, r + s(3), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();

      if (r >= s(9)) {
        this.renderer.drawText(node.icon, p.x, p.y + r * 0.35, {
          size: Math.round(r * 1.1), align: 'center',
          color: alloc ? '#1a1206' : '#ffffff',
        });
      }
      if (showLabels && node.type !== 'minor') {
        this.renderer.drawText(node.name, p.x, p.y + r + s(9), {
          size: s(isMobile ? 7 : 8), align: 'center',
          color: alloc ? armColor : reachable ? '#d8c9a8' : '#6b5d47',
        });
      }
    }
    ctx.restore(); // unclip

    // ── Header ────────────────────────────────────────────────────────────────
    const pts = skillTree.availablePoints;
    this.renderer.drawText('SKILL TREE', W / 2, s(isMobile ? 15 : 21), {
      size: s(isMobile ? 13 : 18), align: 'center', color: '#ffd700',
    });
    this.renderer.drawText(
      pts > 0
        ? `${pts} point${pts === 1 ? '' : 's'} · drag to pan · tap a lit node`
        : 'drag to pan · tap a node to inspect',
      W / 2, s(isMobile ? 29 : 39), {
        size: s(isMobile ? 7 : 9), align: 'center',
        color: pts > 0 ? '#a8e063' : '#c8b998',
      }
    );

    // ── Zoom / recenter buttons ───────────────────────────────────────────────
    const B = this.stButtons();
    const iconBtn = (rct: { x: number; y: number; width: number; height: number }, label: string) => {
      ctx.save();
      ctx.fillStyle   = 'rgba(20,14,6,0.85)';
      ctx.fillRect(rct.x, rct.y, rct.width, rct.height);
      ctx.strokeStyle = '#c8a15a';
      ctx.lineWidth   = Math.max(1, s(1.4));
      ctx.strokeRect(rct.x, rct.y, rct.width, rct.height);
      ctx.restore();
      this.renderer.drawText(label, rct.x + rct.width / 2, rct.y + rct.height / 2 + s(5), {
        size: s(isMobile ? 15 : 18), align: 'center', color: '#ffd700',
      });
    };
    iconBtn(B.zoomIn,   '+');
    iconBtn(B.zoomOut,  '\u2212');
    iconBtn(B.recenter, '\u2302');

    // ── Info panel for the selected node ──────────────────────────────────────
    drawPanel(ctx, V.btnX, V.infoY, V.btnW, V.infoH, DARK_WOOD_THEME, 71, 55);
    const sel = this.selected ? getNode(this.selected) : null;
    if (sel) {
      const selAlloc  = skillTree.isAllocated(sel.id);
      const selCan    = skillTree.canAllocate(sel.id);
      const selReach  = skillTree.isReachable(sel.id);
      const status    = sel.type === 'start' ? 'START'
        : selAlloc  ? 'ALLOCATED'
        : selCan    ? 'TAP TO ALLOCATE'
        : selReach  ? (pts > 0 ? '' : 'NEED A POINT')
        : 'LOCKED';
      const armColor  = sel.arm === 'core' ? '#ffd700' : (ARM_COLOR[sel.arm] || '#c8b998');
      this.renderer.drawText(`${sel.icon} ${sel.name}`, V.btnX + s(8), V.infoY + s(isMobile ? 15 : 17), {
        size: s(isMobile ? 9 : 11), align: 'left', color: armColor,
      });
      this.renderer.drawText(sel.desc || 'Travel node', V.btnX + s(8), V.infoY + s(isMobile ? 29 : 33), {
        size: s(isMobile ? 8 : 9), align: 'left', color: '#d8c9a8',
      });
      if (status) this.renderer.drawText(status, V.btnX + V.btnW - s(8), V.infoY + s(isMobile ? 15 : 17), {
        size: s(isMobile ? 7 : 8), align: 'right',
        color: selAlloc ? '#a8e063' : selCan ? '#ffd700' : '#c8a15a',
      });
    } else {
      this.renderer.drawText('Tap a node to inspect it', V.btnX + V.btnW / 2, V.infoY + V.infoH / 2 + s(3), {
        size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998',
      });
    }

    // ── Continue button ───────────────────────────────────────────────────────
    drawPanel(ctx, V.btnX, V.btnY, V.btnW, V.btnH, DARK_WOOD_THEME, 91, 60);
    this.renderer.drawText(
      pts > 0 ? 'CONTINUE (points banked)' : 'CONTINUE',
      W / 2, V.btnY + V.btnH / 2 + s(4),
      { size: s(isMobile ? 10 : 13), align: 'center', color: '#ffd700' }
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Resolve a tap: Continue / zoom / recenter buttons first, then a node hit-test. */
  private handleTap(x: number, y: number): void {
    const V = this.stView();
    if (pointInRect(x, y, { x: V.btnX, y: V.btnY, width: V.btnW, height: V.btnH })) {
      this.deps.onFinish(this.returnToShop);
      this.returnToShop = false;
      return;
    }
    const B = this.stButtons();
    if (pointInRect(x, y, B.zoomIn))   { this.applyZoom(1.25); return; }
    if (pointInRect(x, y, B.zoomOut))  { this.applyZoom(0.8);  return; }
    if (pointInRect(x, y, B.recenter)) { this.centerOnStart();  return; }

    const Z = this.zoom * this.stView().zoom;
    let hit: SkillNode | null = null;
    for (const node of SKILL_NODES) {
      const sx = V.cx + this.panX + node.x * Z;
      const sy = V.cy + this.panY + node.y * Z;
      const r  = this.nodeRadius(node);
      if (Math.hypot(x - sx, y - sy) <= r + V.s(4)) { hit = node; break; }
    }
    if (!hit) return;

    this.selected = hit.id;
    const skillTree = this.deps.getSkillTree();
    if (skillTree.allocate(hit.id)) {
      skillTree.recomputeInto(this.deps.getPlayerStats());
      const armColor = hit.arm === 'core' ? '#ffd700' : (ARM_COLOR[hit.arm] || '#ffd700');
      this.deps.onNodeAllocated(armColor);
    }
  }

  /** Frame the current class's start node at the default zoom. */
  private centerOnStart(): void {
    const { isMobile, zoom } = this.screenScale();
    this.zoom = isMobile ? 0.42 : 0.6;
    const skillTree = this.deps.getSkillTree();
    const start = getNode(skillTree.startId);
    const Z = this.zoom * zoom;
    this.panX = start ? -start.x * Z : 0;
    this.panY = start ? -start.y * Z : 0;
    this.selected = skillTree.startId;
  }

  /** Zoom about the view centre (keeps the centred tree-point fixed). */
  private applyZoom(factor: number): void {
    const nz = Math.min(1.4, Math.max(0.16, this.zoom * factor));
    const f  = nz / this.zoom;
    this.panX *= f;
    this.panY *= f;
    this.zoom  = nz;
  }

  /** Zoom about an arbitrary screen point — keeps the tree-point under it fixed (pinch feel). */
  private zoomAbout(factor: number, sx: number, sy: number): void {
    const nz = Math.min(1.4, Math.max(0.16, this.zoom * factor));
    if (nz === this.zoom) return;
    const { zoom } = this.screenScale();
    const V  = this.stView();
    const Z  = this.zoom * zoom;
    const Zn = nz * zoom;
    const tx = (sx - V.cx - this.panX) / Z;
    const ty = (sy - V.cy - this.panY) / Z;
    this.panX = sx - V.cx - tx * Zn;
    this.panY = sy - V.cy - ty * Zn;
    this.zoom  = nz;
  }

  /** Screen geometry: header + pannable web band + info panel + Continue button. */
  private stView() {
    const { s, W, H, isMobile, zoom } = this.screenScale();
    const topBand = s(isMobile ? 46 : 56);
    const btnH    = s(isMobile ? 44 : 46);
    const btnW    = Math.min(W - s(40), s(isMobile ? 260 : 360));
    const btnX    = (W - btnW) / 2;
    const infoH   = s(isMobile ? 44 : 50);
    const btnY    = H - btnH - s(8);
    const infoY   = btnY - infoH - s(6);
    const cx      = W / 2;
    const cy      = topBand + (infoY - topBand) / 2;
    return { s, W, H, isMobile, zoom, topBand, btnH, btnW, btnX, btnY, infoH, infoY, cx, cy };
  }

  /** Right-edge zoom-in / zoom-out / recenter buttons. */
  private stButtons() {
    const V      = this.stView();
    const { s, W, isMobile } = V;
    const bs     = s(isMobile ? 34 : 40);
    const gap    = s(8);
    const rx     = W - bs - s(8);
    const midY   = V.cy;
    return {
      bs,
      zoomIn:   { x: rx, y: midY - bs * 1.5 - gap, width: bs, height: bs },
      zoomOut:  { x: rx, y: midY - bs * 0.5,        width: bs, height: bs },
      recenter: { x: rx, y: midY + bs * 0.5 + gap,  width: bs, height: bs },
    };
  }

  /** On-screen radius of a node (by type), scaled mildly with zoom. */
  private nodeRadius(node: SkillNode): number {
    const { s } = this.screenScale();
    const base = node.type === 'keystone' ? 15
               : node.type === 'start'    ? 15
               : node.type === 'notable'  ? 11
               : 6.5;
    const zs = Math.min(1.5, Math.max(0.6, this.zoom / 0.5));
    return s(base) * zs;
  }

  /** DPI-aware scale helpers — mirrors Game.ts screenScale(). */
  private screenScale() {
    const zoom    = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s       = (v: number) => Math.round(v * zoom);
    const W       = this.canvas.width;
    const H       = this.canvas.height;
    const isMobile = W / zoom < 800;
    return { zoom, s, W, H, isMobile };
  }
}
