// Pickup entities (health orbs, XP gems, etc.)

import { circleCollision } from './utils';
import { SpriteSheet } from './sprites';

export class HealthOrb {
  static nextId = 0;

  id: number;
  x: number;
  y: number;
  radius: number = 8;
  healAmount: number = 20;
  dead: boolean = false;

  // Animation
  pulseOffset: number = 0;

  constructor(x: number, y: number) {
    this.id = HealthOrb.nextId++;
    this.x = x;
    this.y = y;
    this.pulseOffset = Math.random() * Math.PI * 2; // Random start phase
  }

  update(dt: number): void {
    this.pulseOffset += dt * 4; // Pulse speed
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const pulse = Math.sin(this.pulseOffset) * 0.15 + 1; // Smaller pulse for pixel art

    // STARDEW STYLE: Pixel art health orb - no gradients, no smooth circles, no glow
    const sprite = SpriteSheet.get('health_orb');
    if (sprite) {
      ctx.imageSmoothingEnabled = false;

      // Scale sprite slightly for pulse effect
      const scaledWidth = sprite.width * pulse;
      const scaledHeight = sprite.height * pulse;

      ctx.drawImage(
        sprite,
        Math.floor(this.x - scaledWidth / 2),
        Math.floor(this.y - scaledHeight / 2),
        Math.floor(scaledWidth),
        Math.floor(scaledHeight)
      );
    }

    ctx.restore();
  }

  collidesWith(x: number, y: number, radius: number): boolean {
    return circleCollision(
      { x: this.x, y: this.y, radius: this.radius },
      { x, y, radius }
    );
  }
}

// Tiny XP gem dropped by a slain enemy (Vampire Survivors style). It pops out a
// little on spawn, then — once the player is within magnet range — homes in and
// accelerates until collected. Carries the XP value so it's granted on pickup,
// not on kill, which is what makes the collection loop feel good.
export class XPOrb {
  static nextId = 0;

  id: number;
  x: number;
  y: number;
  radius: number = 6;
  xpAmount: number;
  dead: boolean = false;

  private vx: number;
  private vy: number;
  homing: boolean = false;
  private homeSpeed: number = 260; // ramps up once homing so it always catches the player
  pulseOffset: number = 0;

  constructor(x: number, y: number, xpAmount: number) {
    this.id = XPOrb.nextId++;
    this.x = x;
    this.y = y;
    this.xpAmount = xpAmount;
    this.radius = XPOrb.radiusFor(xpAmount);
    // Small random outward pop so a cluster of orbs scatters instead of stacking.
    const a = Math.random() * Math.PI * 2;
    const pop = 40 + Math.random() * 60;
    this.vx = Math.cos(a) * pop;
    this.vy = Math.sin(a) * pop;
    this.pulseOffset = Math.random() * Math.PI * 2;
  }

  // Pickup radius grows (gently) with value so a merged, higher-value gem reads as
  // a chunkier crystal and is easier to vacuum up. Log scale keeps a big merge from
  // ballooning off-screen.
  static radiusFor(xpAmount: number): number {
    return 6 + Math.min(10, Math.log2(Math.max(1, xpAmount)) * 2.2);
  }

  // Fold another gem's value into this one and regrow. Used by the density-merge
  // pass so a littered floor collapses into fewer, bigger, cheaper-to-draw orbs.
  absorb(other: XPOrb): void {
    this.xpAmount += other.xpAmount;
    this.radius = XPOrb.radiusFor(this.xpAmount);
    other.dead = true;
  }

  // Returns true when it has reached the player and should be collected.
  update(dt: number, px: number, py: number, magnetRadius: number): boolean {
    this.pulseOffset += dt * 8;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (this.homing || dist < magnetRadius) {
      this.homing = true;
      // Accelerate while homing so a moving player can't outrun its own gems.
      this.homeSpeed = Math.min(900, this.homeSpeed + 900 * dt);
      this.vx = (dx / dist) * this.homeSpeed;
      this.vy = (dy / dist) * this.homeSpeed;
    } else {
      // Friction on the spawn pop until the player comes into range.
      this.vx *= 0.9;
      this.vy *= 0.9;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    return dist < this.radius + 14; // generous pickup contact vs the player body
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const pulse = Math.sin(this.pulseOffset) * 0.2 + 1;
    // Pixel-art XP gem sprite (blue crystal). Sized to ~3.2x the pickup radius
    // so the gems read as chunky pixel crystals rather than specks.
    const sprite = SpriteSheet.get('xp')!;
    const size = this.radius * 3.2 * pulse;
    ctx.drawImage(
      sprite,
      Math.round(this.x - size / 2),
      Math.round(this.y - size / 2),
      Math.round(size),
      Math.round(size)
    );
    ctx.restore();
  }
}

// Gold coin dropped by a slain enemy. Same pop → magnet → home behaviour as the
// XP gem, but carries a gold value granted on pickup instead of at the moment of
// the kill — so money now has to be vacuumed up like XP rather than auto-banking.
export class CoinPickup {
  static nextId = 0;

  id: number;
  x: number;
  y: number;
  radius: number = 6;
  goldAmount: number;
  dead: boolean = false;

  private vx: number;
  private vy: number;
  homing: boolean = false;
  private homeSpeed: number = 260;
  pulseOffset: number = 0;

  constructor(x: number, y: number, goldAmount: number) {
    this.id = CoinPickup.nextId++;
    this.x = x;
    this.y = y;
    this.goldAmount = goldAmount;
    this.radius = CoinPickup.radiusFor(goldAmount);
    const a = Math.random() * Math.PI * 2;
    const pop = 40 + Math.random() * 60;
    this.vx = Math.cos(a) * pop;
    this.vy = Math.sin(a) * pop;
    this.pulseOffset = Math.random() * Math.PI * 2;
  }

  // Bigger coin for a bigger pile — same gentle log growth as XP gems.
  static radiusFor(goldAmount: number): number {
    return 6 + Math.min(10, Math.log2(Math.max(1, goldAmount)) * 2.2);
  }

  // Merge another coin's value into this one (density-merge pass).
  absorb(other: CoinPickup): void {
    this.goldAmount += other.goldAmount;
    this.radius = CoinPickup.radiusFor(this.goldAmount);
    other.dead = true;
  }

  // Returns true when it has reached the player and should be collected.
  update(dt: number, px: number, py: number, magnetRadius: number): boolean {
    this.pulseOffset += dt * 8;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (this.homing || dist < magnetRadius) {
      this.homing = true;
      this.homeSpeed = Math.min(900, this.homeSpeed + 900 * dt);
      this.vx = (dx / dist) * this.homeSpeed;
      this.vy = (dy / dist) * this.homeSpeed;
    } else {
      this.vx *= 0.9;
      this.vy *= 0.9;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    return dist < this.radius + 14;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const pulse = Math.sin(this.pulseOffset) * 0.2 + 1;
    const sprite = SpriteSheet.get('gold')!;
    const size = this.radius * 3.2 * pulse;
    ctx.drawImage(
      sprite,
      Math.round(this.x - size / 2),
      Math.round(this.y - size / 2),
      Math.round(size),
      Math.round(size)
    );
    ctx.restore();
  }
}

// Density merge for loose drops (XP gems / coins). When the floor is littered,
// nearby not-yet-homing pickups collapse into a single higher-value orb — fewer
// entities to update/draw (perf) and one bigger orb to grab (QoL). Homing orbs
// (already flying to the player) are left alone so a merge never yanks a pickup
// off its collection path.
//
// O(n) via a coarse spatial hash: bucket by cell, then only compare within a
// cell and its already-processed neighbours. The `dead` flag is set on absorbed
// orbs; the caller's existing removeDeadEntities sweep reclaims them the same
// frame, so no orb is ever both dead and live-processed.
interface MergeableOrb {
  x: number;
  y: number;
  radius: number;
  dead: boolean;
  homing: boolean;
  absorb(other: any): void;
}

export function mergeOrbs<T extends MergeableOrb>(
  orbs: T[],
  opts: { minCount: number; mergeDist: number; cellSize: number }
): number {
  // Only kick in once the floor is genuinely littered — a handful of orbs should
  // stay as separate satisfying pops.
  if (orbs.length < opts.minCount) return 0;

  const { mergeDist, cellSize } = opts;
  const mergeDistSq = mergeDist * mergeDist;
  // Map cell key -> index of the surviving "anchor" orb in that cell.
  const anchors = new Map<number, number>();
  const cellCols = 100000; // large stride to combine (cx, cy) into one integer key
  let merged = 0;

  for (let i = 0; i < orbs.length; i++) {
    const orb = orbs[i];
    if (orb.dead || orb.homing) continue;

    const cx = Math.floor(orb.x / cellSize);
    const cy = Math.floor(orb.y / cellSize);

    // Look for an anchor in this cell or the 8 neighbours to merge into.
    let target: T | null = null;
    for (let ox = -1; ox <= 1 && !target; ox++) {
      for (let oy = -1; oy <= 1 && !target; oy++) {
        const key = (cx + ox) * cellCols + (cy + oy);
        const ai = anchors.get(key);
        if (ai === undefined) continue;
        const anchor = orbs[ai];
        if (anchor.dead || anchor === orb) continue;
        const dx = anchor.x - orb.x;
        const dy = anchor.y - orb.y;
        if (dx * dx + dy * dy <= mergeDistSq) target = anchor;
      }
    }

    if (target) {
      target.absorb(orb); // sets orb.dead = true
      merged++;
    } else {
      // No anchor nearby — this orb becomes its cell's anchor.
      anchors.set(cx * cellCols + cy, i);
    }
  }

  return merged;
}
