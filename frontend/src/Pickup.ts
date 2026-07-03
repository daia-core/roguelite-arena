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
  radius: number = 4;
  xpAmount: number;
  dead: boolean = false;

  private vx: number;
  private vy: number;
  private homing: boolean = false;
  private homeSpeed: number = 260; // ramps up once homing so it always catches the player
  pulseOffset: number = 0;

  constructor(x: number, y: number, xpAmount: number) {
    this.id = XPOrb.nextId++;
    this.x = x;
    this.y = y;
    this.xpAmount = xpAmount;
    // Small random outward pop so a cluster of orbs scatters instead of stacking.
    const a = Math.random() * Math.PI * 2;
    const pop = 40 + Math.random() * 60;
    this.vx = Math.cos(a) * pop;
    this.vy = Math.sin(a) * pop;
    this.pulseOffset = Math.random() * Math.PI * 2;
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
    // Pixel-art XP gem sprite (blue crystal). Sized to ~2.6x the pickup radius.
    const sprite = SpriteSheet.get('xp')!;
    const size = this.radius * 2.6 * pulse;
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
