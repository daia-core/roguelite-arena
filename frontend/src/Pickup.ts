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
