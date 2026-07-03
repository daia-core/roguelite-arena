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

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (!this.detonated) {
      // Telegraph phase: hollow red outline + growing fill + pulsing border.
      const p = this.fillProgress;
      const pulse = 0.35 + 0.25 * Math.sin(performance.now() / 90);
      // Filled danger area growing toward full as impact approaches.
      ctx.globalAlpha = 0.14 + 0.16 * p;
      ctx.fillStyle = this.color;
      this.tracePath(ctx, this.radius);
      ctx.fill();
      // Growing inner fill that reaches the edge exactly at impact (a "loading" cue).
      ctx.globalAlpha = 0.22 + 0.2 * p;
      this.tracePath(ctx, this.radius * p);
      ctx.fill();
      // Pulsing dashed border.
      ctx.globalAlpha = 0.55 + pulse * 0.4;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      this.tracePath(ctx, this.radius);
      ctx.stroke();
    } else {
      // Detonation flash: bright, fading fast over the active window.
      const a = Math.max(0, this.activeTime / 0.35);
      ctx.globalAlpha = 0.45 * a;
      ctx.fillStyle = '#ffd0d0';
      this.tracePath(ctx, this.radius);
      ctx.fill();
      ctx.globalAlpha = 0.8 * a;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.setLineDash([]);
      this.tracePath(ctx, this.radius);
      ctx.stroke();
    }
    ctx.restore();
  }

  private tracePath(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.beginPath();
    if (this.shape === 'ring' && !this.detonated) {
      const inner = r * this.innerFrac;
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.arc(this.x, this.y, inner, 0, Math.PI * 2, true);
    } else {
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    }
  }
}
