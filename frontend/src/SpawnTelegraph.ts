import type { Enemy } from './Enemy';

/**
 * A telegraphed spawn point. Before an enemy appears, its landing spot is marked
 * for {@link SpawnTelegraph.DURATION} seconds with a red blinking X (Brotato-style
 * spawn warning). When the timer elapses, `ready` flips true and the owner
 * (WaveManager, via Game) materializes the enemy exactly here.
 *
 * The enemy is not constructed up front — instead the telegraph carries a
 * zero-arg factory so all wave-scaling/modifier logic still runs at the moment
 * of the real spawn (identical to the old direct-spawn path), and worm-chain
 * linkage is preserved by building a whole formation's enemies in one factory.
 */
export class SpawnTelegraph {
  /** Seconds the X blinks before the enemy(s) appear. */
  static readonly DURATION = 2.0;

  /** World-space size of one rendered pixel cell (matches AoeZone's chunky look). */
  private static readonly PX = 6;

  x: number;
  y: number;
  /** Half-length of each arm of the X, in world units (scales with formation danger). */
  size: number;
  timer: number = SpawnTelegraph.DURATION;
  /** Set true once the timer elapses; consumed + removed by the owner. */
  ready: boolean = false;
  dead: boolean = false;
  /** Builds the enemy(s) to drop at this spot. Called once when `ready`. */
  readonly spawn: () => Enemy[];
  /** How many enemies this telegraph will produce (for budget accounting up front). */
  readonly pledged: number;

  constructor(x: number, y: number, spawn: () => Enemy[], pledged = 1, size = 20) {
    this.x = x;
    this.y = y;
    this.spawn = spawn;
    this.pledged = pledged;
    this.size = size;
  }

  update(dt: number): void {
    if (this.ready || this.dead) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      this.ready = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const px = SpawnTelegraph.PX;
    // Blink faster as the spawn approaches (urgency ramp): ~2.2 Hz → ~7 Hz.
    const urgency = 1 - this.timer / SpawnTelegraph.DURATION; // 0 → 1
    const blinkHz = 2.2 + urgency * 4.8;
    const blink = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * blinkHz * Math.PI * 2);
    // Never fully invisible — floor keeps the mark readable at a glance.
    const alpha = 0.3 + 0.6 * blink;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Faint danger footprint under the X so the spot reads even between blinks.
    ctx.globalAlpha = 0.1 + 0.12 * urgency;
    ctx.fillStyle = '#ff2a2a';
    const foot = this.size + px;
    ctx.fillRect(
      Math.floor((this.x - foot) / px) * px,
      Math.floor((this.y - foot) / px) * px,
      Math.ceil((foot * 2) / px) * px,
      Math.ceil((foot * 2) / px) * px
    );

    // The blinking red X — two chunky pixel diagonals.
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff3030';
    this.drawX(ctx, px);
    // Brighter core stroke on top for punch.
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = '#ff8080';
    this.drawX(ctx, px, true);

    ctx.restore();
  }

  /**
   * Rasterize an X as pixel-aligned cells along both diagonals. `thin` draws just
   * the 1-cell core for the bright highlight pass.
   */
  private drawX(ctx: CanvasRenderingContext2D, px: number, thin = false): void {
    const arm = this.size;
    const steps = Math.max(1, Math.round((arm * 2) / px));
    const band = thin ? 0 : 1; // extra cells perpendicular for a thicker arm
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0 → 1 along the arm span
      const d = -arm + t * arm * 2;
      // Diagonal 1 (top-left → bottom-right) and diagonal 2 (top-right → bottom-left).
      this.cell(ctx, this.x + d, this.y + d, px, band);
      this.cell(ctx, this.x + d, this.y - d, px, band);
    }
  }

  /** Fill a px-snapped cell (plus optional perpendicular band cells) at a world point. */
  private cell(ctx: CanvasRenderingContext2D, wx: number, wy: number, px: number, band: number): void {
    const gx = Math.floor(wx / px) * px;
    const gy = Math.floor(wy / px) * px;
    for (let by = -band; by <= band; by++) {
      ctx.fillRect(gx, gy + by * px, px, px);
    }
  }
}
