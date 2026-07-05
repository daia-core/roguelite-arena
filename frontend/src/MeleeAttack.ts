// Melee attack entity — a single swing. It carries the swing's geometry (centre
// angle, arc width, reach) and a STYLE that decides how the swing reads and hits:
//
//   arc    — a directional sweeping slash: a blade sprite rotates across the arc.
//   thrust — a narrow forward lunge: the weapon stabs out along the aim line and back.
//   spin   — a full 360° whirl: the blade orbits the player once.
//   slam   — an overhead smash onto a circular zone out in front.
//
// Every style draws (1) a translucent AoE highlight of the exact zone it damages,
// so the player can read the danger area, and (2) an animated pixel weapon sprite
// sweeping/lunging/whirling through the motion. Game.ts still owns damage
// application; this entity only animates and answers the hit test.

import type { MeleeStyle } from './items/types';
import { SpriteSheet } from './sprites';

// Which in-world weapon sprite each style swings. These are the full-size
// 'weapon_*' sprites (blade/axe/spear), drawn pointing +x with the grip at the
// left, so we can rotate them to the swing angle.
const STYLE_SPRITE: Record<MeleeStyle, string> = {
  arc: 'weapon_blade',
  spin: 'weapon_axe',
  thrust: 'weapon_spear',
  slam: 'weapon_axe',
};

export class MeleeAttack {
  x: number;
  y: number;
  angle: number; // Center/aim angle
  arc: number; // Total arc in radians (width of the swing)
  range: number;
  damage: number;
  lifetime: number;
  dead: boolean = false;
  knockback: number;
  style: MeleeStyle;
  maxLifetime: number = 0.2; // 200ms swing duration
  hitEnemies: Set<number> = new Set(); // Track hit enemies

  constructor(
    x: number,
    y: number,
    angle: number,
    arc: number,
    range: number,
    damage: number,
    knockback: number = 0,
    style: MeleeStyle = 'arc'
  ) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.arc = arc;
    this.range = range;
    this.damage = damage;
    this.knockback = knockback;
    this.style = style;
    this.lifetime = this.maxLifetime;
  }

  update(dt: number, playerX: number, playerY: number): void {
    // Follow player position
    this.x = playerX;
    this.y = playerY;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  /** 0→1 progress through the swing. */
  private progress(): number {
    return Math.min(1, Math.max(0, 1 - this.lifetime / this.maxLifetime));
  }

  // ---- Hit test: the damage zone. Matches what the highlight draws. ----
  // A thrust reaches full range only along a narrow forward capsule; slam/spin/arc
  // use the angular wedge. The swing lands over its whole lifetime, so the zone is
  // the full shape (not the momentary sprite position) — the sprite is just juice.
  isPointInArc(x: number, y: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.range) return false;
    if (this.style === 'spin') return true; // full circle within range

    const pointAngle = Math.atan2(dy, dx);
    // Thrust: a tight forward jab — clamp the effective arc narrow regardless of
    // the swing's configured width so a spear pokes a line, not a fan.
    const effArc = this.style === 'thrust' ? Math.min(this.arc, Math.PI * 0.28) : this.arc;

    const norm = (a: number) => {
      while (a < -Math.PI) a += Math.PI * 2;
      while (a > Math.PI) a -= Math.PI * 2;
      return a;
    };
    const delta = norm(pointAngle - this.angle);
    return Math.abs(delta) <= effArc / 2;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const p = this.progress();
    // Bell curve: fades in, peaks mid-swing, fades out.
    const fade = Math.sin(p * Math.PI);

    switch (this.style) {
      case 'thrust': this.drawThrust(ctx, p, fade); break;
      case 'spin': this.drawSpin(ctx, p, fade); break;
      case 'slam': this.drawSlam(ctx, p, fade); break;
      default: this.drawArc(ctx, p, fade); break;
    }
    ctx.restore();
  }

  // ---- Shared pixel helpers (pure pixel-art, dithered — no smooth alpha) ----

  /** A single pixel-art quad, floored to the grid. */
  private px(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x - s / 2), Math.floor(y - s / 2), Math.ceil(s), Math.ceil(s));
  }

  /**
   * A blade/weapon rendered as a run of pixels from the pivot outward along `ang`,
   * from `r0` to `r1`. `edge` colours the outer half (the sharp edge / glow).
   */
  private blade(ctx: CanvasRenderingContext2D, ang: number, r0: number, r1: number, body: string, edge: string): void {
    const step = 7;
    for (let r = r0; r <= r1; r += step) {
      const t = (r - r0) / Math.max(1, r1 - r0);
      const bx = this.x + Math.cos(ang) * r;
      const by = this.y + Math.sin(ang) * r;
      this.px(ctx, bx, by, 8, t > 0.55 ? edge : body);
      // Slight cross-thickness so the blade reads as a shape, not a line.
      const perp = ang + Math.PI / 2;
      const w = 4 - t * 2; // tapers toward the tip
      this.px(ctx, bx + Math.cos(perp) * w, by + Math.sin(perp) * w, 5, body);
    }
    // A bright tip.
    this.px(ctx, this.x + Math.cos(ang) * r1, this.y + Math.sin(ang) * r1, 6, '#ffffff');
  }

  /**
   * Draw a full in-world weapon SPRITE pointing along `ang`, its grip at the pivot
   * (r0) and its striking end reaching `reach`. The sprite is authored pointing +x,
   * so we translate to the pivot, rotate to `ang`, and scale its length to `reach`.
   * `alpha` fades trailing after-images (kept in coarse steps so it stays pixel-art).
   */
  private drawWeaponSprite(ctx: CanvasRenderingContext2D, spriteName: string, ang: number, r0: number, reach: number, alpha: number): void {
    const sprite = SpriteSheet.get(spriteName);
    if (!sprite) { // fallback to the procedural blade if the sprite is missing
      this.blade(ctx, ang, r0, reach, '#c9853d', '#ffe0a0');
      return;
    }
    const len = reach - r0;
    const aspect = sprite.height / sprite.width;
    const h = len * aspect;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(this.x + Math.cos(ang) * r0, this.y + Math.sin(ang) * r0);
    ctx.rotate(ang);
    ctx.drawImage(sprite, 0, -h / 2, Math.floor(len), Math.floor(h));
    ctx.restore();
  }

  // ---- ARC: sweeping slash. Highlight = wedge; sprite = blade rotating across arc. ----
  private drawArc(ctx: CanvasRenderingContext2D, p: number, fade: number): void {
    const start = this.angle - this.arc / 2;
    const end = this.angle + this.arc / 2;

    // AoE highlight: a dithered wedge fill of the swing zone. White reads as "MY reach"
    // (Felix, 2026-07-05) — warm/red danger colours are reserved for enemy & boss telegraphs.
    this.fillWedge(ctx, start, end, this.range, fade * 0.5, '#ffffff');

    // The blade sprite sweeps across the arc, with a couple of faded after-images
    // behind the leading edge to read as motion.
    const sprite = STYLE_SPRITE[this.style];
    const lead = start + this.arc * p;
    for (let k = 2; k >= 0; k--) {
      const a = lead - k * (this.arc * 0.14);
      if (a < start) continue;
      this.drawWeaponSprite(ctx, sprite, a, 10, this.range, k === 0 ? 1 : 0.28 * fade);
    }
  }

  // ---- THRUST: forward lunge. Highlight = narrow capsule; sprite = spear stabbing out. ----
  private drawThrust(ctx: CanvasRenderingContext2D, p: number, fade: number): void {
    const halfArc = Math.min(this.arc, Math.PI * 0.28) / 2;
    // Highlight the reachable forward lane (white = my attack zone).
    this.fillWedge(ctx, this.angle - halfArc, this.angle + halfArc, this.range, fade * 0.5, '#ffffff');

    // The spear sprite lunges out to full reach at mid-swing, then recoils.
    const lunge = Math.sin(p * Math.PI);
    const tip = this.range * (0.35 + 0.65 * lunge);
    // The grip trails behind the player a touch on the extend for a stab feel.
    const grip = -8 + 8 * (1 - lunge);
    this.drawWeaponSprite(ctx, STYLE_SPRITE[this.style], this.angle, grip, tip, 1);
    // A bright impact flash at the tip while extended.
    if (lunge > 0.4) {
      const hx = this.x + Math.cos(this.angle) * tip;
      const hy = this.y + Math.sin(this.angle) * tip;
      this.px(ctx, hx, hy, 7, '#eaf6ff');
    }
  }

  // ---- SPIN: full 360° whirl. Highlight = ring/disc; sprite = blade orbiting once. ----
  private drawSpin(ctx: CanvasRenderingContext2D, p: number, fade: number): void {
    // Highlight the whole circle it hits (dithered disc edge; white = my attack zone).
    this.fillRing(ctx, this.range, fade * 0.5, '#ffffff');

    // The axe sprite orbits a full turn over the lifetime, trailing after-images.
    const sprite = STYLE_SPRITE[this.style];
    const spin = this.angle + Math.PI * 2 * p;
    for (let k = 4; k >= 0; k--) {
      const a = spin - k * 0.45;
      this.drawWeaponSprite(ctx, sprite, a, 8, this.range, k === 0 ? 1 : 0.22 * fade);
    }
  }

  // ---- SLAM: overhead smash onto a disc out front. Highlight = disc; sprite = hammer drop. ----
  private drawSlam(ctx: CanvasRenderingContext2D, p: number, fade: number): void {
    // The impact disc sits at the far end of the swing, centred on the aim line.
    const cx = this.x + Math.cos(this.angle) * this.range * 0.6;
    const cy = this.y + Math.sin(this.angle) * this.range * 0.6;
    const discR = this.range * 0.55;
    // White = my attack zone (warm/red stays exclusive to enemy & boss telegraphs).
    this.fillDisc(ctx, cx, cy, discR, fade * 0.55, '#ffffff');

    // Hammer falls: the weapon sprite rises then crashes down onto the disc by
    // mid-swing; shockwave pixels ring out after impact. A downward "wind-up angle"
    // lifts it before the strike, then it lands pointing at the disc.
    const drop = Math.min(1, p / 0.5); // reaches the ground at p=0.5
    const headDist = this.range * (0.95 - 0.35 * drop);
    // Wind-up: raise the swing angle back toward the player before it falls.
    const windup = (1 - drop) * -0.5; // radians of lift, gone by impact
    this.drawWeaponSprite(ctx, STYLE_SPRITE[this.style], this.angle + windup, 6, headDist, 1);
    // Post-impact shock ring.
    if (p > 0.5) {
      const shock = (p - 0.5) / 0.5;
      const rr = discR * shock;
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        if ((i % 3) / 3 > (1 - shock)) continue;
        const a = (Math.PI * 2 * i) / steps;
        this.px(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 6, i % 2 ? '#ffd27a' : '#ffffff');
      }
    }
  }

  // ---- Highlight primitives (dithered fills, pure pixel-art) ----

  private fillWedge(ctx: CanvasRenderingContext2D, start: number, end: number, radius: number, strength: number, color: string): void {
    if (strength <= 0.02) return;
    const rings = Math.max(6, Math.floor(radius / 12));
    const arcW = end - start;
    for (let ri = 1; ri <= rings; ri++) {
      const r = (radius * ri) / rings;
      const seg = Math.max(6, Math.floor((arcW * r) / 12));
      for (let si = 0; si <= seg; si++) {
        // Dither by position + strength so the fill thins as it fades.
        if (((ri + si) % 2) === 0 && strength < 0.5) continue;
        if (((ri * 3 + si) % 3) === 0 && strength < 0.32) continue;
        const a = start + (arcW * si) / seg;
        this.px(ctx, this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, 6, color);
      }
    }
  }

  private fillRing(ctx: CanvasRenderingContext2D, radius: number, strength: number, color: string): void {
    this.fillWedge(ctx, 0, Math.PI * 2, radius, strength, color);
  }

  private fillDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, strength: number, color: string): void {
    if (strength <= 0.02) return;
    const rings = Math.max(4, Math.floor(radius / 12));
    for (let ri = 1; ri <= rings; ri++) {
      const r = (radius * ri) / rings;
      const seg = Math.max(6, Math.floor((Math.PI * 2 * r) / 12));
      for (let si = 0; si < seg; si++) {
        if (((ri + si) % 2) === 0 && strength < 0.5) continue;
        if (((ri * 3 + si) % 3) === 0 && strength < 0.35) continue;
        const a = (Math.PI * 2 * si) / seg;
        this.px(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 6, color);
      }
    }
  }

  markHit(enemyId: number): void {
    this.hitEnemies.add(enemyId);
  }

  hasHit(enemyId: number): boolean {
    return this.hitEnemies.has(enemyId);
  }
}
