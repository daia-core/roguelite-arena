// Telegraphed area-of-effect attack.
//
// An AoE zone paints a red danger marker on the ground for `telegraph` seconds so
// the player can walk out of it, then "detonates": for `activeTime` seconds after
// the telegraph it deals damage to the player if they're inside `radius`. Used by
// bosses, mini-bosses and the new ranged/AoE enemies for fair, readable attacks.
//
// All coordinates are WORLD space (Game draws these under the same 1/WORLD_SCALE
// transform as enemies), so positions line up 1:1 with enemies and the player.

export type AoeShape = 'circle' | 'ring';

export class AoeZone {
  x: number;
  y: number;
  radius: number;
  damage: number;
  /** Seconds of red warning before the hit lands. */
  telegraph: number;
  /** Total telegraph duration (kept for progress rendering). */
  private telegraphTotal: number;
  /** Seconds the damaging pulse stays active after the telegraph. */
  activeTime: number;
  shape: AoeShape;
  /** Ring inner-radius fraction (only used when shape === 'ring'). */
  innerFrac: number;
  color: string;
  /** True once the telegraph elapses and the zone is dealing damage. */
  detonated: boolean = false;
  /** Set true the first frame it detonates so Game can spawn the burst FX once. */
  justDetonated: boolean = false;
  dead: boolean = false;
  /** Guards single-hit zones so one detonation can't tick damage every frame. */
  private hasHitPlayer: boolean = false;
  /** If true, only damages the player once (a burst); else damages while active. */
  singleHit: boolean;

  constructor(
    x: number,
    y: number,
    radius: number,
    damage: number,
    telegraph: number = 1.0,
    opts: {
      activeTime?: number;
      shape?: AoeShape;
      innerFrac?: number;
      color?: string;
      singleHit?: boolean;
    } = {}
  ) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.telegraph = telegraph;
    this.telegraphTotal = telegraph;
    this.activeTime = opts.activeTime ?? 0.35;
    this.shape = opts.shape ?? 'circle';
    this.innerFrac = opts.innerFrac ?? 0.55;
    this.color = opts.color ?? '#ff3b3b';
    this.singleHit = opts.singleHit ?? true;
  }

  /** Fraction 0..1 of the telegraph elapsed (for the fill/pulse animation). */
  get fillProgress(): number {
    if (this.detonated) return 1;
    return 1 - this.telegraph / this.telegraphTotal;
  }

  update(dt: number): void {
    this.justDetonated = false;
    if (!this.detonated) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) {
        this.detonated = true;
        this.justDetonated = true;
      }
      return;
    }
    this.activeTime -= dt;
    if (this.activeTime <= 0) this.dead = true;
  }

  /**
   * Returns the damage to apply to the player this frame, or 0. Handles the
   * single-hit guard so a burst only lands once. Caller passes player position.
   */
  damageToPlayer(px: number, py: number, pr: number): number {
    if (!this.detonated || this.dead) return 0;
    if (this.singleHit && this.hasHitPlayer) return 0;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    let inside: boolean;
    if (this.shape === 'ring') {
      const inner = this.radius * this.innerFrac;
      inside = dist <= this.radius + pr && dist >= inner - pr;
    } else {
      inside = dist <= this.radius + pr;
    }
    if (!inside) return 0;
    this.hasHitPlayer = true;
    return this.damage;
  }

  /** World-space size of one rendered pixel cell (matches the nova/Shockwave look). */
  private static readonly PX = 6;

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Pixel-art rendering: no smoothing, quantized chunky cells (not smooth arcs).
    ctx.imageSmoothingEnabled = false;
    if (!this.detonated) {
      // Telegraph phase: chunky red danger fill + growing "loading" fill + pulsing pixel border.
      const p = this.fillProgress;
      const pulse = 0.35 + 0.25 * Math.sin(performance.now() / 90);
      // Faint danger area over the whole zone.
      ctx.globalAlpha = 0.14 + 0.16 * p;
      ctx.fillStyle = this.color;
      this.fillArea(ctx, this.radius);
      // Growing inner fill that reaches the edge exactly at impact.
      ctx.globalAlpha = 0.22 + 0.2 * p;
      this.fillArea(ctx, this.radius * p);
      // Pulsing chunky-pixel border ring.
      ctx.globalAlpha = 0.6 + pulse * 0.4;
      this.strokeRing(ctx, this.radius, AoeZone.PX * 1.5);
    } else {
      // Detonation flash: bright, fading fast over the active window.
      const a = Math.max(0, this.activeTime / 0.35);
      ctx.globalAlpha = 0.5 * a;
      ctx.fillStyle = '#ffd0d0';
      this.fillArea(ctx, this.radius);
      ctx.globalAlpha = 0.9 * a;
      ctx.fillStyle = '#ffffff';
      this.strokeRing(ctx, this.radius, AoeZone.PX * 1.5);
    }
    ctx.restore();
  }

  /** Fill the zone's area (disc, or annulus when shape === 'ring') as quantized pixels. */
  private fillArea(ctx: CanvasRenderingContext2D, r: number): void {
    if (r <= 0) return;
    const inner = this.shape === 'ring' ? r * this.innerFrac : 0;
    this.scanFill(ctx, r, inner);
  }

  /** Draw a chunky-pixel outline band of `thickness` at outer radius `r`. */
  private strokeRing(ctx: CanvasRenderingContext2D, r: number, thickness: number): void {
    if (r <= 0) return;
    this.scanFill(ctx, r, Math.max(0, r - thickness));
  }

  /**
   * Rasterize a disc (innerR = 0) or annulus into pixel-aligned scanlines, one
   * fillRect per row snapped to the PX grid — a chunky, no-antialias pixel shape.
   */
  private scanFill(ctx: CanvasRenderingContext2D, outerR: number, innerR: number): void {
    const px = AoeZone.PX;
    const cx = this.x;
    const cy = this.y;
    const startY = Math.floor((cy - outerR) / px) * px;
    const endY = Math.ceil((cy + outerR) / px) * px;
    for (let yy = startY; yy < endY; yy += px) {
      const dy = yy + px / 2 - cy;
      const ad = Math.abs(dy);
      if (ad > outerR) continue;
      const outerHalf = Math.sqrt(outerR * outerR - dy * dy);
      if (innerR > 0 && ad < innerR) {
        // Annulus row: two side bands leaving the hole in the middle.
        const innerHalf = Math.sqrt(innerR * innerR - dy * dy);
        const bandW = Math.max(px, Math.ceil((outerHalf - innerHalf) / px) * px);
        const lx = Math.floor((cx - outerHalf) / px) * px;
        ctx.fillRect(lx, yy, bandW, px);
        const rx = Math.floor((cx + innerHalf) / px) * px;
        ctx.fillRect(rx, yy, bandW, px);
      } else {
        const lx = Math.floor((cx - outerHalf) / px) * px;
        const w = Math.max(px, Math.ceil((2 * outerHalf) / px) * px);
        ctx.fillRect(lx, yy, w, px);
      }
    }
  }
}
