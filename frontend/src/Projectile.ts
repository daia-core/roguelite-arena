// Projectile entity (player and enemy bullets)

import { SpriteSheet } from './sprites';

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  speed: number;
  color: string;
  fromPlayer: boolean;
  piercing: boolean;
  lifetime: number;
  dead: boolean = false;
  hitEnemies: Set<number> = new Set(); // Track hit enemies for piercing
  trail: Array<{ x: number; y: number; age: number }> = []; // Trail effect
  maxPierceCount: number = 0;
  pierceCount: number = 0;

  constructor(
    x: number = 0,
    y: number = 0,
    angle: number = 0,
    damage: number = 0,
    speed: number = 0,
    fromPlayer: boolean = true,
    piercing: boolean = false
  ) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = fromPlayer ? 9 : 10;
    this.damage = damage;
    this.color = fromPlayer ? '#00ffff' : '#ff0000';
    this.fromPlayer = fromPlayer;
    this.piercing = piercing;
    this.lifetime = 3000; // 3 seconds max
  }

  /**
   * Initialize/reinitialize projectile (for object pooling)
   */
  init(
    x: number,
    y: number,
    angle: number,
    damage: number,
    speed: number,
    fromPlayer: boolean,
    piercing: boolean = false
  ): void {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = fromPlayer ? 9 : 10;
    this.damage = damage;
    this.color = fromPlayer ? '#00ffff' : '#ff0000';
    this.fromPlayer = fromPlayer;
    this.piercing = piercing;
    this.lifetime = 3000;
    this.dead = false;
    this.hitEnemies.clear();
    this.trail = [];
    this.maxPierceCount = 0;
    this.pierceCount = 0;
  }

  update(dt: number, canvasWidth: number, canvasHeight: number): void {
    // PERFORMANCE: Only add trail points every 2nd frame to reduce rendering load
    if (Math.random() > 0.5) {
      this.trail.push({ x: this.x, y: this.y, age: 0 });
    }

    // Update trail ages and remove old ones
    this.trail = this.trail.filter(point => {
      point.age += dt;
      return point.age < 0.12; // Shorter trail (150ms → 120ms) for performance
    });

    // PERFORMANCE: Limit trail to 4 points instead of 8
    if (this.trail.length > 4) {
      this.trail.shift();
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.lifetime -= dt * 1000;
    if (this.lifetime <= 0) {
      this.dead = true;
    }

    // Kill if out of bounds
    if (this.x < -50 || this.x > canvasWidth + 50 ||
        this.y < -50 || this.y > canvasHeight + 50) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // PERFORMANCE: Simplified trail rendering (no shadow blur per point)
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 0; // Disable shadow blur for trail points
    for (let i = 0; i < this.trail.length; i++) {
      const point = this.trail[i];
      const alpha = 1 - (point.age / 0.12);
      const size = this.radius * (0.5 + alpha * 0.5);

      ctx.fillStyle = this.color + Math.floor(alpha * 80).toString(16).padStart(2, '0');
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    const spriteName = this.fromPlayer ? 'bullet' : 'enemy_bullet';
    const sprite = SpriteSheet.get(spriteName);

    if (sprite) {
      // PERFORMANCE: Reduced shadow blur (15 → 8)
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.globalCompositeOperation = 'lighter';

      // Draw sprite
      ctx.drawImage(
        sprite,
        this.x - sprite.width / 2,
        this.y - sprite.height / 2
      );
    } else {
      // PERFORMANCE: Simplified fallback (single gradient, reduced shadow blur)
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      ctx.globalCompositeOperation = 'lighter';

      // Single gradient (no outer glow)
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.4, this.color);
      gradient.addColorStop(1, this.color + '88');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  markHit(enemyId?: number): void {
    if (this.piercing && enemyId !== undefined) {
      this.hitEnemies.add(enemyId);
      this.pierceCount++;
      if (this.pierceCount > this.maxPierceCount) {
        this.dead = true;
      }
    } else {
      this.dead = true;
    }
  }

  hasHit(enemyId: number): boolean {
    return this.hitEnemies.has(enemyId);
  }
}
