/**
 * VillageScene — the between-runs "base" that replaces the flat souls-upgrade
 * grid with a walkable, camera-scrolling pixel-art village (Hades / Cult-of-the-
 * Lamb feel; design: work/roguelite-game/DESIGN-BASE-BUILDING.md).
 *
 * It is a NEW VIEW over the existing economy — it reuses MetaProgression's souls
 * and the same purchaseUpgrade() calls, so balance is untouched. The 19 permanent
 * upgrades are grouped into 8 themed buildings; each building visibly tiers up as
 * you invest, and a maxed building reaches a golden "hero" state. Walk up to a
 * building (or the central Shrine) to interact; the Shrine embarks on a run.
 */

import type { Scene } from './scenes/Scene';
import type { Renderer } from './Renderer';
import type { Input } from './Input';
import type { AudioManager } from './AudioManager';
import type { MetaProgression } from './MetaProgression';
import { SpriteSheet } from './sprites';
import { paintTerrain, type TerrainConfig } from './pixel/terrain';
import { drawPanel, WOOD_THEME, DARK_WOOD_THEME } from './pixel/panel';

export interface VillageDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;
  audio: AudioManager;
  meta: MetaProgression;
  onEmbark: () => void;
  onBack: () => void;
}

type Rect = { x: number; y: number; width: number; height: number };
type BuildingKind =
  | 'forge' | 'infirmary' | 'armory' | 'market'
  | 'academy' | 'stables' | 'vault' | 'wartable';

interface BuildingPalette {
  wall: string; wallLt: string; wallDk: string;
  roof: string; roofDk: string; trim: string; glow: string;
}

interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  kind: BuildingKind;
  fx: number; // fractional world position (0..1) of the ground anchor
  fy: number;
  upgradeIds: string[];
  pal: BuildingPalette;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
}

// Grass ground for the village — same warm palette family as the arena, with a
// touch more path-dirt so the plaza reads as a settled place.
const VILLAGE_GROUND: TerrainConfig = {
  artScale: 8,
  tones: { base: '#5f9e38', light: '#72b84a', dark: '#4f8a2f' },
  patches: {
    colors: { base: '#a97c50', dark: '#8f6742', light: '#c19467' },
    cellSize: 64, chance: 0.5, minRadius: 6, maxRadius: 15, salt: 41,
  },
  decorations: [
    { grid: [[1, 2, 1], [1, 1, 1]], palette: ['transparent', '#3f7322', '#8ed95e'], cellSize: 17, chance: 0.16, salt: 61 },
    { grid: [[2, 0], [1, 1]], palette: ['transparent', '#3f7322', '#8ed95e'], cellSize: 15, chance: 0.13, salt: 83 },
    { grid: [[0, 1, 0], [1, 2, 1], [0, 1, 0]], palette: ['transparent', '#f2d94e', '#c9720f'], cellSize: 70, chance: 0.10, salt: 121 },
    { grid: [[0, 1, 0], [1, 2, 1], [0, 1, 0]], palette: ['transparent', '#e88fb0', '#c9720f'], cellSize: 78, chance: 0.09, salt: 141 },
  ],
};

const PALETTES: Record<BuildingKind, BuildingPalette> = {
  forge:     { wall: '#5c5048', wallLt: '#726458', wallDk: '#3f362f', roof: '#8a3030', roofDk: '#5e1f1f', trim: '#e8a13a', glow: '#ff8a2a' },
  infirmary: { wall: '#d8c6a0', wallLt: '#ecdcb6', wallDk: '#b39f78', roof: '#4a7c3a', roofDk: '#345a28', trim: '#e85d5d', glow: '#ffe6a0' },
  armory:    { wall: '#8f8f86', wallLt: '#abab9f', wallDk: '#6c6c64', roof: '#3f5a86', roofDk: '#2b3f60', trim: '#cfd6df', glow: '#bcd2ff' },
  market:    { wall: '#c79a55', wallLt: '#e0b56e', wallDk: '#9c7640', roof: '#b8433f', roofDk: '#8a2e2b', trim: '#f2d05a', glow: '#ffe08a' },
  academy:   { wall: '#5a5a8c', wallLt: '#7272a6', wallDk: '#3f3f66', roof: '#3a3a6b', roofDk: '#28284d', trim: '#b197fc', glow: '#c9b8ff' },
  stables:   { wall: '#9a6a3e', wallLt: '#b98756', wallDk: '#734d2a', roof: '#b8433f', roofDk: '#8a2e2b', trim: '#e8c98a', glow: '#ffe6a0' },
  vault:     { wall: '#6b5a2e', wallLt: '#8a7640', wallDk: '#4c3f1e', roof: '#caa63a', roofDk: '#9c7e28', trim: '#ffe26a', glow: '#ffd24a' },
  wartable:  { wall: '#4a6b3a', wallLt: '#5f8748', wallDk: '#354f28', roof: '#6b4a2a', roofDk: '#4c341c', trim: '#e8c05a', glow: '#ffe0a0' },
};

// The content spine: 8 themed buildings covering all 19 permanent upgrades.
// Positions form a settlement around a central plaza + Shrine.
const BUILDINGS: BuildingDef[] = [
  { id: 'forge',     name: 'The Forge',     icon: '🔥', kind: 'forge',     fx: 0.20, fy: 0.30, upgradeIds: ['starting_damage', 'starting_fire_rate', 'starting_crit'], pal: PALETTES.forge },
  { id: 'armory',    name: 'The Armory',    icon: '🛡️', kind: 'armory',    fx: 0.50, fy: 0.22, upgradeIds: ['starting_armor', 'boss_damage'], pal: PALETTES.armory },
  { id: 'infirmary', name: 'The Infirmary', icon: '❤️', kind: 'infirmary', fx: 0.80, fy: 0.30, upgradeIds: ['starting_health', 'starting_regen', 'permanent_shield'], pal: PALETTES.infirmary },
  { id: 'market',    name: 'The Market',    icon: '💰', kind: 'market',    fx: 0.16, fy: 0.60, upgradeIds: ['starting_gold', 'gold_gain', 'shop_discount', 'reroll_discount'], pal: PALETTES.market },
  { id: 'academy',   name: 'The Academy',   icon: '⭐', kind: 'academy',   fx: 0.84, fy: 0.60, upgradeIds: ['xp_gain', 'double_level_ups'], pal: PALETTES.academy },
  { id: 'stables',   name: 'The Stables',   icon: '👟', kind: 'stables',   fx: 0.24, fy: 0.84, upgradeIds: ['starting_speed'], pal: PALETTES.stables },
  { id: 'wartable',  name: 'The War Table', icon: '👑', kind: 'wartable',  fx: 0.50, fy: 0.86, upgradeIds: ['elite_rewards', 'wave_skip'], pal: PALETTES.wartable },
  { id: 'vault',     name: 'The Vault',     icon: '🎁', kind: 'vault',     fx: 0.76, fy: 0.84, upgradeIds: ['starting_item', 'starting_legendary'], pal: PALETTES.vault },
];

const SHRINE_FX = 0.50;
const SHRINE_FY = 0.54;

export class VillageScene implements Scene {
  private d: VillageDeps;

  // World / camera (all in canvas px, recomputed each frame from canvas size)
  private worldW = 0;
  private worldH = 0;
  private camX = 0;
  private camY = 0;

  // Player avatar (world coords, at the feet)
  private px = 0;
  private py = 0;
  private facing = 1;
  private walkPhase = 0;
  private spawned = false;

  // Cached ground for the whole world, rebuilt only when world size changes.
  private ground: HTMLCanvasElement | null = null;
  private groundKey = '';

  private particles: Particle[] = [];
  private smokeTimer = 0;
  private t = 0;

  // Interaction
  private openId: string | null = null; // building whose panel is open
  private nearId: string | null = null; // building/shrine currently in range
  // After closing a panel the avatar is still standing in that building's reach,
  // and on mobile the very touch used to walk away sets mouseDown — which would
  // instantly re-open the same panel, trapping the player. Suppress re-opening
  // THIS building until the avatar has physically left its reach once.
  private suppressId: string | null = null;

  // Layout scratch reused by draw + update so hit-tests match visuals exactly.
  private buyRects: { id: string; rect: Rect }[] = [];
  private closeRect: Rect | null = null;
  private backRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private embarkRect: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor(deps: VillageDeps) {
    this.d = deps;
  }

  /** Called whenever the scene becomes active, to (re)spawn the avatar. */
  enter(_prev?: string): void {
    this.recomputeWorld();
    if (!this.spawned) {
      this.px = SHRINE_FX * this.worldW;
      this.py = (SHRINE_FY + 0.10) * this.worldH;
      this.spawned = true;
    }
    this.openId = null;
    this.suppressId = null;
  }

  private s(v: number): number {
    const zoom = this.d.canvas.clientWidth ? this.d.canvas.width / this.d.canvas.clientWidth : 1;
    return Math.round(v * zoom);
  }

  private get isMobile(): boolean {
    const zoom = this.d.canvas.clientWidth ? this.d.canvas.width / this.d.canvas.clientWidth : 1;
    return this.d.canvas.width / zoom < 800;
  }

  private recomputeWorld(): void {
    const W = this.d.canvas.width;
    const H = this.d.canvas.height;
    // The base is larger than one screen so the camera scrolls as you walk.
    this.worldW = W + this.s(1000);
    this.worldH = H + this.s(700);
    this.ensureGround();
  }

  private ensureGround(): void {
    const key = `${this.worldW}x${this.worldH}`;
    if (this.ground && this.groundKey === key) return;
    const cv = document.createElement('canvas');
    cv.width = this.worldW;
    cv.height = this.worldH;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    paintTerrain(g, this.worldW, this.worldH, VILLAGE_GROUND);
    this.paintPaths(g);
    this.ground = cv;
    this.groundKey = key;
  }

  // Warm dirt plaza + radial paths from the Shrine to each building plot.
  private paintPaths(g: CanvasRenderingContext2D): void {
    const cx = SHRINE_FX * this.worldW;
    const cy = SHRINE_FY * this.worldH;
    const pathW = this.s(26);
    const stamp = (x: number, y: number, r: number) => {
      for (let dy = -r; dy <= r; dy += 4) {
        for (let dx = -r; dx <= r; dx += 4) {
          if (dx * dx + dy * dy > r * r) continue;
          const n = (Math.sin((x + dx) * 0.7) + Math.cos((y + dy) * 0.9));
          g.fillStyle = n > 0.6 ? '#c19467' : n < -0.6 ? '#8f6742' : '#a97c50';
          g.fillRect(Math.round(x + dx), Math.round(y + dy), 4, 4);
        }
      }
    };
    // plaza
    stamp(cx, cy, this.s(90));
    for (const b of BUILDINGS) {
      const bx = b.fx * this.worldW;
      const by = b.fy * this.worldH;
      const steps = Math.hypot(bx - cx, by - cy) / (pathW * 0.5);
      for (let i = 0; i <= steps; i++) {
        const x = cx + (bx - cx) * (i / steps);
        const y = cy + (by - cy) * (i / steps);
        stamp(x, y, pathW * 0.5);
      }
    }
  }

  // ---- economy helpers -------------------------------------------------------

  private levels(def: BuildingDef): { cur: number; max: number; frac: number } {
    let cur = 0, max = 0;
    for (const id of def.upgradeIds) {
      const u = this.d.meta.getUpgrade(id);
      if (!u) continue;
      cur += u.currentLevel;
      max += u.maxLevel;
    }
    return { cur, max, frac: max ? cur / max : 0 };
  }

  /** Discrete visual tier 0..4 (4 = fully maxed golden hero state). */
  private tierOf(frac: number): number {
    if (frac <= 0) return 0;
    if (frac >= 1) return 4;
    if (frac < 0.34) return 1;
    if (frac < 0.67) return 2;
    return 3;
  }

  // ---- update ----------------------------------------------------------------

  update(dt: number): void {
    this.t += dt;
    this.recomputeWorld();
    const input = this.d.input;

    if (this.openId) {
      this.handlePanelInput();
      this.updateParticles(dt);
      return; // movement frozen while a building panel is open
    }

    // Walk (WASD on desktop, floating joystick on mobile — both via the vector).
    const mv = input.getMovementVector();
    const speed = this.s(300);
    if (Math.abs(mv.x) > 0.01 || Math.abs(mv.y) > 0.01) {
      this.px += mv.x * speed * dt;
      this.py += mv.y * speed * dt;
      if (Math.abs(mv.x) > 0.05) this.facing = mv.x < 0 ? -1 : 1;
      this.walkPhase += dt * 10;
    }
    const m = this.s(40);
    this.px = Math.max(m, Math.min(this.worldW - m, this.px));
    this.py = Math.max(this.s(60), Math.min(this.worldH - m, this.py));

    // Follow-camera, clamped to world bounds.
    const W = this.d.canvas.width, H = this.d.canvas.height;
    this.camX = Math.max(0, Math.min(this.worldW - W, this.px - W / 2));
    this.camY = Math.max(0, Math.min(this.worldH - H, this.py - H / 2));
    if (this.worldW < W) this.camX = (this.worldW - W) / 2;
    if (this.worldH < H) this.camY = (this.worldH - H) / 2;

    // Nearest interactable (building or shrine) within reach of the avatar.
    this.nearId = this.findNearest();
    // Re-arm the just-closed building only once the avatar walks out of its reach.
    if (this.suppressId && this.nearId !== this.suppressId) this.suppressId = null;

    this.updateParticles(dt);

    // Screen-space UI buttons (top bar) — handle before world taps.
    const mx = input.mouseX, my = input.mouseY;
    if (input.mouseDown && this.pointIn(mx, my, this.backRect)) {
      input.mouseDown = false;
      this.d.onBack();
      return;
    }
    if (input.mouseDown && this.pointIn(mx, my, this.embarkRect)) {
      input.mouseDown = false;
      this.d.onEmbark();
      return;
    }

    // Walk-up interaction: tap opens the nearest building panel / embarks at Shrine.
    if (input.mouseDown && this.nearId && this.nearId !== this.suppressId) {
      input.mouseDown = false;
      if (this.nearId === 'shrine') {
        this.d.onEmbark();
      } else {
        this.openId = this.nearId;
        this.d.audio.playPurchase();
      }
    }
  }

  private findNearest(): string | null {
    const reach = this.s(115);
    let best: string | null = null;
    let bestD = reach * reach;
    const shrineX = SHRINE_FX * this.worldW, shrineY = SHRINE_FY * this.worldH;
    const sd = (this.px - shrineX) ** 2 + (this.py - shrineY) ** 2;
    if (sd < bestD) { bestD = sd; best = 'shrine'; }
    for (const b of BUILDINGS) {
      const bx = b.fx * this.worldW, by = b.fy * this.worldH;
      const d = (this.px - bx) ** 2 + (this.py - by) ** 2;
      if (d < bestD) { bestD = d; best = b.id; }
    }
    return best;
  }

  private handlePanelInput(): void {
    const input = this.d.input;
    if (!input.mouseDown) return;
    const mx = input.mouseX, my = input.mouseY;
    if (this.closeRect && this.pointIn(mx, my, this.closeRect)) {
      input.mouseDown = false;
      this.suppressId = this.openId; // block instant re-open until we leave its reach
      this.openId = null;
      return;
    }
    for (const b of this.buyRects) {
      if (this.pointIn(mx, my, b.rect)) {
        input.mouseDown = false;
        if (this.d.meta.canPurchaseUpgrade(b.id)) {
          this.d.meta.purchaseUpgrade(b.id);
          this.d.audio.playPurchase();
        }
        return;
      }
    }
  }

  private updateParticles(dt: number): void {
    // Spawn forge/chimney smoke + lantern embers from built buildings.
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.12;
      for (const b of BUILDINGS) {
        const { frac } = this.levels(b);
        if (frac <= 0) continue;
        if (b.kind === 'forge' || Math.random() < 0.15 * frac) {
          const bx = b.fx * this.worldW;
          const by = b.fy * this.worldH;
          const bw = this.s(this.isMobile ? 96 : 132);
          const topY = by - bw * 0.9;
          const smoke = b.kind === 'forge';
          this.particles.push({
            x: bx + (smoke ? bw * 0.28 : (Math.random() - 0.5) * bw * 0.5),
            y: topY,
            vx: (Math.random() - 0.5) * this.s(12),
            vy: -this.s(smoke ? 34 : 20) - Math.random() * this.s(14),
            life: 0, max: smoke ? 1.6 : 1.0,
            size: this.s(smoke ? 5 : 3),
            color: smoke ? '#6b6b6b' : b.pal.glow,
          });
        }
      }
      if (this.particles.length > 90) this.particles.splice(0, this.particles.length - 90);
    }
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += this.s(4) * dt; // slight buoyant decel
    }
    this.particles = this.particles.filter(p => p.life < p.max);
  }

  private pointIn(x: number, y: number, r: Rect | null): boolean {
    return !!r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
  }

  /** Blend two #rrggbb colors by t (0..1). */
  private mix(a: string, b: string, t: number): string {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // ---- draw ------------------------------------------------------------------

  draw(): void {
    const ctx = this.d.renderer.getContext();
    const W = this.d.canvas.width, H = this.d.canvas.height;

    // Ground (blit the visible camera slice of the cached world ground).
    if (this.ground) {
      ctx.drawImage(this.ground, this.camX, this.camY, W, H, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#5f9e38';
      ctx.fillRect(0, 0, W, H);
    }

    // Collect y-sorted drawables so the avatar correctly overlaps buildings.
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];

    const shrineX = SHRINE_FX * this.worldW - this.camX;
    const shrineY = SHRINE_FY * this.worldH - this.camY;
    items.push({ y: shrineY, draw: () => this.drawShrine(ctx, shrineX, shrineY) });

    for (const b of BUILDINGS) {
      const sx = b.fx * this.worldW - this.camX;
      const sy = b.fy * this.worldH - this.camY;
      // cull off-screen
      if (sx < -this.s(200) || sx > W + this.s(200) || sy < -this.s(320) || sy > H + this.s(200)) continue;
      const near = this.nearId === b.id && !this.openId;
      items.push({ y: sy, draw: () => this.drawBuilding(ctx, sx, sy, b, near) });
    }

    const avX = this.px - this.camX;
    const avY = this.py - this.camY;
    items.push({ y: avY, draw: () => this.drawAvatar(ctx, avX, avY) });

    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // Smoke / embers on top of structures.
    this.drawParticles(ctx);

    // Floating prompt above whatever is in range.
    if (this.nearId && !this.openId) this.drawPrompt(ctx, W);

    // Warm ambient tint + soft vignette for mood (screen space).
    this.drawAmbient(ctx, W, H);

    // Top bar (souls + back + embark) always on top.
    this.drawTopBar(ctx, W);

    // Touch joystick (mobile) — only visible while walking, never over a panel.
    if (!this.openId) this.d.input.drawJoystick(ctx);

    // Building upgrade panel (modal) on very top.
    if (this.openId) this.drawPanel(ctx, W, H);
  }

  private drawAvatar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const sprite = SpriteSheet.get('player');
    const bob = Math.sin(this.walkPhase) * this.s(2);
    // ground shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + this.s(2), this.s(16), this.s(6), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (sprite) {
      const scale = this.s(1) * (this.isMobile ? 0.6 : 0.72);
      const w = sprite.width * scale, h = sprite.height * scale;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (this.facing < 0) {
        ctx.translate(x, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -w / 2, y - h + bob, w, h);
      } else {
        ctx.drawImage(sprite, x - w / 2, y - h + bob, w, h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#e8d5a8';
      ctx.fillRect(x - this.s(8), y - this.s(28) + bob, this.s(16), this.s(28));
    }
  }

  // Distinctive, tiered pixel structure. Grows from an inviting foundation (tier
  // 0) through modest/improved builds to a golden hero state (tier 4).
  private drawBuilding(ctx: CanvasRenderingContext2D, ax: number, ay: number, def: BuildingDef, near: boolean): void {
    const { frac } = this.levels(def);
    const tier = this.tierOf(frac);
    const bw = this.s(this.isMobile ? 96 : 132);
    const R = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
    };

    // Plot shadow.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(ax, ay + this.s(4), bw * 0.62, this.s(12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Stone plot rim (always present — an occupied plot).
    R(ax - bw * 0.6, ay - this.s(6), bw * 1.2, this.s(10), '#7a6a52');
    R(ax - bw * 0.6, ay - this.s(6), bw * 1.2, this.s(3), '#94866c');

    const pal = def.pal;

    if (tier === 0) {
      // Inviting foundation: corner posts + scaffold + a "?" parchment sign.
      const fh = this.s(30);
      R(ax - bw * 0.5, ay - fh, this.s(8), fh, '#6b4a2a');
      R(ax + bw * 0.5 - this.s(8), ay - fh, this.s(8), fh, '#6b4a2a');
      R(ax - bw * 0.5, ay - fh, bw, this.s(6), '#7a4e2a');
      R(ax - bw * 0.28, ay - this.s(20), bw * 0.56, this.s(14), '#c9b17a');
      ctx.fillStyle = '#5a4426';
      this.d.renderer.drawText('?', ax, ay - this.s(20), { size: this.s(11), align: 'center', color: '#5a4426', stroke: false });
      this.drawSign(ctx, ax, ay, def, bw, false);
      if (near) this.outline(ctx, ax - bw * 0.62, ay - fh - this.s(8), bw * 1.24, fh + this.s(14));
      return;
    }

    // Built structure. Height grows with tier.
    const bh = this.s(38) + tier * this.s(20);
    const bx = ax - bw / 2;
    const by = ay - bh;

    // Walls with bevel (light left / dark right; top-left light source).
    R(bx, by, bw, bh, pal.wall);
    R(bx, by, this.s(4), bh, pal.wallLt);
    R(bx + bw - this.s(4), by, this.s(4), bh, pal.wallDk);
    R(bx, ay - this.s(4), bw, this.s(4), pal.wallDk);

    // Windows (more, and lit, as tier rises).
    const winCount = Math.min(tier, 3);
    const lit = tier >= 2;
    const flick = 0.75 + Math.sin(this.t * 6 + ax) * 0.1;
    for (let i = 0; i < winCount; i++) {
      const wx = bx + bw * (0.24 + i * 0.26);
      const wy = by + bh * 0.28;
      const ws = this.s(11);
      R(wx - this.s(1), wy - this.s(1), ws + this.s(2), ws + this.s(2), '#2a2118');
      R(wx, wy, ws, ws, lit ? this.mix(pal.glow, '#fff2b0', flick) : '#3a3f4a');
    }

    // Door.
    const dw = this.s(16), dh = bh * 0.42;
    R(ax - dw / 2, ay - dh, dw, dh, '#3a2a1a');
    R(ax - dw / 2, ay - dh, dw, this.s(3), pal.trim);

    // Roof — kind-specific silhouette.
    this.drawRoof(ctx, R, def, bx, by, bw, tier);

    // Themed prop out front.
    this.drawProp(ctx, R, def, ax, ay, bw, tier);

    // Maxed golden hero state: trim outline, banners, flag, sparkles.
    if (tier === 4) {
      ctx.save();
      ctx.strokeStyle = '#ffe26a';
      ctx.lineWidth = this.s(2);
      ctx.strokeRect(Math.round(bx) - this.s(2), Math.round(by) - this.s(2), Math.round(bw) + this.s(4), Math.round(bh) + this.s(4));
      ctx.restore();
      this.drawBanner(ctx, R, bx + this.s(6), by, def, -1);
      this.drawBanner(ctx, R, bx + bw - this.s(12), by, def, 1);
      const tw = Math.sin(this.t * 4 + ax) * 0.5 + 0.5;
      R(ax - this.s(1), by - this.s(26) - tw * this.s(3), this.s(3), this.s(3), '#fff2b0');
    }

    this.drawSign(ctx, ax, ay, def, bw, tier === 4);
    if (near) this.outline(ctx, bx - this.s(4), by - this.s(30), bw + this.s(8), bh + this.s(36));
  }

  private drawRoof(_ctx: CanvasRenderingContext2D, R: (x: number, y: number, w: number, h: number, c: string) => void, def: BuildingDef, bx: number, by: number, bw: number, tier: number): void {
    const pal = def.pal;
    const rh = this.s(22);
    switch (def.kind) {
      case 'academy': { // tall arcane tower cap (cone)
        for (let i = 0; i < rh; i++) {
          const w = bw * (1 - i / rh) * 0.5;
          R(bx + bw / 2 - w, by - i - this.s(6), w * 2, 1, i < rh * 0.4 ? pal.roofDk : pal.roof);
        }
        R(bx + bw / 2 - this.s(2), by - rh - this.s(12), this.s(4), this.s(8), pal.trim);
        break;
      }
      case 'armory': { // crenellated stone keep
        R(bx - this.s(3), by - this.s(10), bw + this.s(6), this.s(12), pal.roof);
        for (let i = 0; i < 5; i++) R(bx + i * (bw / 5) + this.s(2), by - this.s(18), bw / 10, this.s(8), pal.roofDk);
        break;
      }
      case 'market': { // striped awning
        for (let i = 0; i < 8; i++) R(bx + i * (bw / 8), by - this.s(8), bw / 8, this.s(10), i % 2 ? '#f2f0e6' : pal.roof);
        R(bx - this.s(4), by - this.s(10), bw + this.s(8), this.s(3), pal.roofDk);
        break;
      }
      case 'wartable': { // canvas tent peak
        for (let i = 0; i < rh; i++) {
          const w = bw * (1 - i / rh) * 0.58;
          R(bx + bw / 2 - w, by - i, w * 2, 1, i % 3 === 0 ? pal.roofDk : pal.roof);
        }
        break;
      }
      case 'vault': { // gilded dome
        for (let i = 0; i < rh; i++) {
          const k = i / rh;
          const w = bw * 0.5 * Math.sqrt(1 - k * k);
          R(bx + bw / 2 - w, by - i - this.s(2), w * 2, 2, k < 0.4 ? pal.roof : pal.roofDk);
        }
        R(bx + bw / 2 - this.s(2), by - rh - this.s(6), this.s(4), this.s(6), '#fff2b0');
        break;
      }
      case 'forge': { // low roof + smoking chimney
        R(bx - this.s(3), by - this.s(10), bw + this.s(6), this.s(12), pal.roof);
        R(bx + bw * 0.7, by - this.s(26), this.s(12), this.s(18), pal.wallDk);
        R(bx + bw * 0.7, by - this.s(28), this.s(12), this.s(4), '#2a2118');
        break;
      }
      default: { // pitched gable roof (infirmary / stables)
        for (let i = 0; i < rh; i++) {
          const w = bw * (1 - i / rh) * 0.56 + bw * 0.02;
          R(bx + bw / 2 - w, by - i, w * 2, 1, i < rh * 0.35 ? pal.roofDk : pal.roof);
        }
        R(bx - this.s(4), by - this.s(2), bw + this.s(8), this.s(4), pal.roofDk);
        if (tier >= 2 && def.kind === 'infirmary') { // red cross
          R(bx + bw / 2 - this.s(2), by - this.s(16), this.s(4), this.s(10), pal.trim);
          R(bx + bw / 2 - this.s(5), by - this.s(13), this.s(10), this.s(4), pal.trim);
        }
      }
    }
  }

  private drawProp(_ctx: CanvasRenderingContext2D, R: (x: number, y: number, w: number, h: number, c: string) => void, def: BuildingDef, ax: number, ay: number, bw: number, tier: number): void {
    const pal = def.pal;
    const glow = tier >= 3;
    switch (def.kind) {
      case 'forge': { // anvil, glowing when hot
        R(ax - bw * 0.5, ay - this.s(14), this.s(18), this.s(6), '#3a3a3a');
        R(ax - bw * 0.5 + this.s(4), ay - this.s(8), this.s(8), this.s(8), '#2a2a2a');
        if (glow) R(ax - bw * 0.5 + this.s(2), ay - this.s(16), this.s(12), this.s(3), pal.glow);
        break;
      }
      case 'infirmary': { // herb garden boxes
        R(ax + bw * 0.34, ay - this.s(8), this.s(16), this.s(8), '#6b4a2a');
        R(ax + bw * 0.36, ay - this.s(12), this.s(4), this.s(5), '#4a7c3a');
        R(ax + bw * 0.42, ay - this.s(13), this.s(4), this.s(6), '#4a7c3a');
        break;
      }
      case 'armory': { // weapon rack
        R(ax + bw * 0.34, ay - this.s(20), this.s(2), this.s(20), '#6b4a2a');
        R(ax + bw * 0.4, ay - this.s(20), this.s(2), this.s(20), '#cfd6df');
        break;
      }
      case 'market': { // coin sign
        R(ax - bw * 0.5, ay - this.s(22), this.s(14), this.s(14), pal.trim);
        this.d.renderer.drawText('$', ax - bw * 0.5 + this.s(7), ay - this.s(20), { size: this.s(9), align: 'center', color: '#7a4e10', stroke: false });
        break;
      }
      case 'academy': { // candle-lit book stand
        R(ax + bw * 0.34, ay - this.s(10), this.s(14), this.s(8), '#6b4a2a');
        if (glow) R(ax + bw * 0.4, ay - this.s(16), this.s(2), this.s(6), pal.glow);
        break;
      }
      case 'stables': { // hay bale + fence
        R(ax + bw * 0.34, ay - this.s(9), this.s(12), this.s(9), '#d8b24a');
        R(ax + bw * 0.34, ay - this.s(6), this.s(12), this.s(1), '#a8842a');
        break;
      }
      case 'vault': { // treasure chest
        R(ax - bw * 0.5, ay - this.s(11), this.s(16), this.s(11), '#6b4a2a');
        R(ax - bw * 0.5, ay - this.s(11), this.s(16), this.s(4), pal.trim);
        break;
      }
      case 'wartable': { // planted banner
        R(ax - bw * 0.5, ay - this.s(24), this.s(2), this.s(24), '#6b4a2a');
        R(ax - bw * 0.5, ay - this.s(24), this.s(10), this.s(8), pal.trim);
        break;
      }
    }
  }

  private drawBanner(_ctx: CanvasRenderingContext2D, R: (x: number, y: number, w: number, h: number, c: string) => void, x: number, y: number, def: BuildingDef, side: number): void {
    const wobble = Math.sin(this.t * 3 + x) * this.s(1) * side;
    R(x, y - this.s(4), this.s(6), this.s(18) + wobble, def.pal.trim);
    R(x, y + this.s(14), this.s(6), this.s(4), def.pal.roofDk);
  }

  private drawSign(ctx: CanvasRenderingContext2D, ax: number, ay: number, def: BuildingDef, bw: number, gold: boolean): void {
    const w = bw * 0.9, h = this.s(16);
    const x = ax - w / 2, y = ay + this.s(6);
    drawPanel(ctx, x, y, w, h, gold ? WOOD_THEME : DARK_WOOD_THEME, 3, def.name.length);
    this.d.renderer.drawText(def.name, ax, y + h / 2 - this.s(4), {
      size: this.s(this.isMobile ? 6 : 7), align: 'center', color: gold ? '#ffe26a' : '#f4e6c2',
      maxWidth: w - this.s(6),
    });
  }

  private outline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.save();
    ctx.strokeStyle = `rgba(255,242,176,${0.5 + Math.sin(this.t * 5) * 0.3})`;
    ctx.lineWidth = this.s(2);
    ctx.strokeRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    ctx.restore();
  }

  private drawShrine(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const R = (px: number, py: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c; ctx.fillRect(Math.round(px), Math.round(py), Math.ceil(w), Math.ceil(h));
    };
    // shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + this.s(4), this.s(30), this.s(9), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // stone base + brazier
    R(x - this.s(22), y - this.s(8), this.s(44), this.s(12), '#7a6a52');
    R(x - this.s(22), y - this.s(8), this.s(44), this.s(3), '#94866c');
    R(x - this.s(10), y - this.s(30), this.s(20), this.s(22), '#5c5048');
    R(x - this.s(10), y - this.s(30), this.s(4), this.s(22), '#726458');
    // flame
    const f = Math.sin(this.t * 8) * this.s(3);
    R(x - this.s(7), y - this.s(42) - f, this.s(14), this.s(14) + f, '#ff8a2a');
    R(x - this.s(4), y - this.s(46) - f, this.s(8), this.s(12) + f, '#ffd24a');
    R(x - this.s(2), y - this.s(48) - f, this.s(4), this.s(8), '#fff2b0');
    // souls label on the shrine
    this.d.renderer.drawText(`✦ ${this.d.meta.souls}`, x, y + this.s(8), {
      size: this.s(this.isMobile ? 8 : 9), align: 'center', color: '#ffd43b',
    });
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      const sx = p.x - this.camX, sy = p.y - this.camY;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a) * (p.color === '#6b6b6b' ? 0.5 : 0.9);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(sx), Math.round(sy), p.size, p.size);
      ctx.restore();
    }
  }

  private drawPrompt(ctx: CanvasRenderingContext2D, _W: number): void {
    let wx: number, wy: number, label: string;
    if (this.nearId === 'shrine') {
      wx = SHRINE_FX * this.worldW; wy = SHRINE_FY * this.worldH;
      label = '▶ EMBARK';
    } else {
      const b = BUILDINGS.find(x => x.id === this.nearId)!;
      wx = b.fx * this.worldW; wy = b.fy * this.worldH;
      label = `▶ ${b.name}`;
    }
    const sx = wx - this.camX;
    const sy = wy - this.camY - this.s(this.nearId === 'shrine' ? 58 : 96);
    const pw = this.s(this.isMobile ? 96 : 118), ph = this.s(18);
    const bob = Math.sin(this.t * 4) * this.s(2);
    drawPanel(ctx, sx - pw / 2, sy + bob, pw, ph, WOOD_THEME, 3, 7);
    this.d.renderer.drawText(label, sx, sy + ph / 2 - this.s(4) + bob, {
      size: this.s(this.isMobile ? 6 : 7), align: 'center', color: '#ffe6a0', maxWidth: pw - this.s(6),
    });
  }

  private drawAmbient(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffcf7a'; // warm dawn wash
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // dithered edge vignette
    ctx.save();
    ctx.fillStyle = 'rgba(20,12,4,0.5)';
    const fade = this.s(60), step = 4;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const d = Math.min(x, y, W - x, H - y);
        if (d >= fade) continue;
        if ((x + y) % (step * 2) === 0 && Math.random() < (1 - d / fade) * 0.5) {
          ctx.fillRect(x, y, step, step);
        }
      }
    }
    ctx.restore();
  }

  private drawTopBar(_ctx: CanvasRenderingContext2D, W: number): void {
    const mobile = this.isMobile;
    // Back button (top-left)
    const bw = this.s(mobile ? 78 : 96), bh = this.s(mobile ? 30 : 34);
    this.backRect = { x: this.s(10), y: this.s(10), width: bw, height: bh };
    this.d.renderer.drawButton(this.backRect.x, this.backRect.y, bw, bh, '‹ Menu', false, true, mobile);
    // Embark button (top-right)
    this.embarkRect = { x: W - bw - this.s(10), y: this.s(10), width: bw, height: bh };
    this.d.renderer.drawButton(this.embarkRect.x, this.embarkRect.y, bw, bh, '▶ Play', false, true, mobile);
    // Souls + title (top-center)
    this.d.renderer.drawText('YOUR VILLAGE', W / 2, this.s(12), {
      size: this.s(mobile ? 9 : 12), align: 'center', color: '#f4e6c2',
    });
    this.d.renderer.drawText(`✦ ${this.d.meta.souls} SOULS`, W / 2, this.s(mobile ? 26 : 30), {
      size: this.s(mobile ? 8 : 9), align: 'center', color: '#ffd43b',
    });
  }

  private drawPanel(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const def = BUILDINGS.find(b => b.id === this.openId);
    if (!def) { this.openId = null; return; }
    const mobile = this.isMobile;

    // scrim
    ctx.save();
    ctx.fillStyle = 'rgba(8,5,2,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const rows = def.upgradeIds.length;
    const pw = Math.min(W - this.s(24), this.s(mobile ? 360 : 460));
    const rowH = this.s(mobile ? 62 : 58);
    const headH = this.s(52);
    const ph = headH + rows * (rowH + this.s(6)) + this.s(50);
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;

    drawPanel(ctx, px, py, pw, ph, DARK_WOOD_THEME, 4, 3);

    this.d.renderer.drawText(def.name, W / 2, py + this.s(12), {
      size: this.s(mobile ? 11 : 14), align: 'center', color: '#ffe26a', maxWidth: pw - this.s(20),
    });
    this.d.renderer.drawText(`✦ ${this.d.meta.souls} souls`, W / 2, py + this.s(32), {
      size: this.s(mobile ? 8 : 9), align: 'center', color: '#ffd43b',
    });

    this.buyRects = [];
    let ry = py + headH;
    for (const id of def.upgradeIds) {
      const u = this.d.meta.getUpgrade(id);
      if (!u) continue;
      const rx = px + this.s(12);
      const rw = pw - this.s(24);
      const isMax = u.currentLevel >= u.maxLevel;
      const canAfford = this.d.meta.canPurchaseUpgrade(id);

      drawPanel(ctx, rx, ry, rw, rowH, WOOD_THEME, 3, id.length);
      ctx.save();
      ctx.strokeStyle = isMax ? '#ffd43b' : canAfford ? '#7bd94a' : '#55534c';
      ctx.lineWidth = this.s(2);
      ctx.strokeRect(Math.round(rx) + this.s(3), Math.round(ry) + this.s(3), Math.round(rw) - this.s(6), Math.round(rowH) - this.s(6));
      ctx.restore();

      this.d.renderer.drawItemIcon(u.icon, rx + this.s(10), ry + this.s(8), this.s(14), 'left');
      this.d.renderer.drawText(u.name.toUpperCase(), rx + this.s(30), ry + this.s(9), {
        size: this.s(mobile ? 7 : 8), color: '#f4e6c2', maxWidth: rw * 0.5,
      });
      this.d.renderer.drawText(`${u.currentLevel}/${u.maxLevel}`, rx + rw - this.s(76), ry + this.s(9), {
        size: this.s(mobile ? 7 : 8), color: isMax ? '#ffd43b' : '#aab6c3',
      });
      this.d.renderer.drawWrappedText(u.description, rx + this.s(30), ry + this.s(26), {
        size: this.s(mobile ? 6 : 7), color: '#c8b998',
        maxWidth: rw - this.s(120), maxLines: 2,
      });

      // Buy / MAX button on the right.
      const btnW = this.s(66), btnH = rowH - this.s(16);
      const btnX = rx + rw - btnW - this.s(8), btnY = ry + this.s(8);
      if (isMax) {
        this.d.renderer.drawText('MAX', btnX + btnW / 2, btnY + btnH / 2 - this.s(4), {
          size: this.s(8), align: 'center', color: '#ffd43b',
        });
      } else {
        const cost = u.costs[u.currentLevel];
        this.d.renderer.drawButton(btnX, btnY, btnW, btnH, `${cost}✦`, false, canAfford, mobile);
        this.buyRects.push({ id, rect: { x: btnX, y: btnY, width: btnW, height: btnH } });
      }
      ry += rowH + this.s(6);
    }

    // Close button.
    const cw = this.s(120), ch = this.s(mobile ? 34 : 36);
    this.closeRect = { x: W / 2 - cw / 2, y: py + ph - ch - this.s(10), width: cw, height: ch };
    this.d.renderer.drawButton(this.closeRect.x, this.closeRect.y, cw, ch, 'Close', false, true, mobile);
  }
}
