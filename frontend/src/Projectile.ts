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
  // Enemy pattern shots: homing projectiles curve toward the player (steered
  // by Game, which knows the player position)
  homing: boolean = false;
  turnSpeed: number = 0;

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
    // Player shots live long enough to cross the arena (a kiting player at
    // one edge could otherwise never reach a boss at the other)
    this.lifetime = fromPlayer ? 4500 : 3000;
    this.dead = false;
    this.hitEnemies.clear();
    this.trail = [];
    this.maxPierceCount = 0;
    this.pierceCount = 0;
    this.homing = false;
    this.turnSpeed = 0;
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
    ctx.imageSmoothingEnabled = false;

    // PIXEL ART TRAIL: Use dithering for fade effect, NO alpha blending
    const trailPixelSize = 6;
    for (let i = 0; i < this.trail.length; i++) {
      const point = this.trail[i];
      const fadeProgress = point.age / 0.12; // 0 = new, 1 = old

      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      ctx.fillStyle = this.color;

      // Dithered fade: as trail ages, draw fewer pixels in a checkerboard pattern
      if (fadeProgress < 0.33) {
        // First third: full square
        ctx.fillRect(x - trailPixelSize / 2, y - trailPixelSize / 2, trailPixelSize, trailPixelSize);
      } else if (fadeProgress < 0.66) {
        // Middle third: 50% checkerboard dither
        for (let dx = 0; dx < trailPixelSize; dx += 2) {
          for (let dy = 0; dy < trailPixelSize; dy += 2) {
            if ((dx + dy) % 4 === 0) {
              ctx.fillRect(x - trailPixelSize / 2 + dx, y - trailPixelSize / 2 + dy, 2, 2);
            }
          }
        }
      } else {
        // Final third: 25% sparse dither
        for (let dx = 0; dx < trailPixelSize; dx += 2) {
          for (let dy = 0; dy < trailPixelSize; dy += 2) {
            if ((dx + dy) % 8 === 0) {
              ctx.fillRect(x - trailPixelSize / 2 + dx, y - trailPixelSize / 2 + dy, 2, 2);
            }
          }
        }
      }
    }

    const spriteName = this.fromPlayer ? 'bullet' : 'enemy_bullet';
    const sprite = SpriteSheet.get(spriteName);

    if (sprite) {
      // PIXEL ART: Just draw the sprite, no glow, no outlines, no smooth effects
      ctx.drawImage(
        sprite,
        Math.floor(this.x - sprite.width / 2),
        Math.floor(this.y - sprite.height / 2)
      );
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
