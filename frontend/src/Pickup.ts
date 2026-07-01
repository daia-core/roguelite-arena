// Pickup entities (health orbs, XP gems, etc.)

import { circleCollision } from './utils';

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

    const pulse = Math.sin(this.pulseOffset) * 0.3 + 1; // Pulsing scale
    const size = this.radius * pulse;

    // Outer glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff4466';

    // Main orb (radial gradient for depth)
    const gradient = ctx.createRadialGradient(
      this.x - size * 0.3,
      this.y - size * 0.3,
      0,
      this.x,
      this.y,
      size
    );
    gradient.addColorStop(0, '#ffaacc');
    gradient.addColorStop(0.4, '#ff4466');
    gradient.addColorStop(1, '#aa0033');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.fill();

    // Cross symbol
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const crossSize = size * 0.5;
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - crossSize);
    ctx.lineTo(this.x, this.y + crossSize);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(this.x - crossSize, this.y);
    ctx.lineTo(this.x + crossSize, this.y);
    ctx.stroke();

    ctx.restore();
  }

  collidesWith(x: number, y: number, radius: number): boolean {
    return circleCollision(
      { x: this.x, y: this.y, radius: this.radius },
      { x, y, radius }
    );
  }
}
