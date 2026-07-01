// Enemy entity with AI and different types

import { circleCollision } from './utils';

export type EnemyType = 'basic' | 'fast' | 'tank' | 'shooter';

export interface EnemyTypeData {
  health: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  xpValue: number;
  goldValue: number;
  shootRate?: number; // Shots per second (for shooter type)
}

const ENEMY_TYPES: Record<EnemyType, EnemyTypeData> = {
  basic: {
    health: 30,
    speed: 80,
    damage: 10,
    radius: 12,
    color: '#ff0000',
    xpValue: 10,
    goldValue: 5
  },
  fast: {
    health: 15,
    speed: 150,
    damage: 5,
    radius: 10,
    color: '#ff00ff',
    xpValue: 8,
    goldValue: 3
  },
  tank: {
    health: 100,
    speed: 50,
    damage: 20,
    radius: 18,
    color: '#aa0000',
    xpValue: 30,
    goldValue: 15
  },
  shooter: {
    health: 25,
    speed: 60,
    damage: 8,
    radius: 11,
    color: '#ffaa00',
    xpValue: 15,
    goldValue: 8,
    shootRate: 0.5
  }
};

export class Enemy {
  static nextId = 0;

  id: number;
  x: number;
  y: number;
  type: EnemyType;
  typeData: EnemyTypeData;
  health: number;
  maxHealth: number;
  dead: boolean = false;

  // Shooter specific
  shootCooldown: number = 0;

  constructor(x: number, y: number, type: EnemyType, waveMultiplier: number = 1) {
    this.id = Enemy.nextId++;
    this.x = x;
    this.y = y;
    this.type = type;
    this.typeData = { ...ENEMY_TYPES[type] };

    // Scale with wave
    this.typeData.health *= waveMultiplier;
    this.typeData.damage *= waveMultiplier;
    this.typeData.speed *= (1 + (waveMultiplier - 1) * 0.3); // Speed scales slower

    this.maxHealth = this.typeData.health;
    this.health = this.maxHealth;
  }

  update(dt: number, playerX: number, playerY: number): { shouldShoot: boolean } {
    // Move toward player (simple pathfinding)
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;

      // Don't move if shooter and in range
      const shouldMove = this.type !== 'shooter' || dist > 300;

      if (shouldMove) {
        this.x += nx * this.typeData.speed * dt;
        this.y += ny * this.typeData.speed * dt;
      }
    }

    // Shooter logic
    let shouldShoot = false;
    if (this.type === 'shooter' && this.typeData.shootRate) {
      this.shootCooldown -= dt;
      if (this.shootCooldown <= 0 && dist > 50 && dist < 400) {
        shouldShoot = true;
        this.shootCooldown = 1 / this.typeData.shootRate;
      }
    }

    return { shouldShoot };
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Glow effect
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.typeData.color;

    // Body with radial gradient
    const gradient = ctx.createRadialGradient(
      this.x - this.typeData.radius * 0.3,
      this.y - this.typeData.radius * 0.3,
      0,
      this.x,
      this.y,
      this.typeData.radius
    );

    // Different gradients per type
    if (this.type === 'tank') {
      gradient.addColorStop(0, '#ff6666');
      gradient.addColorStop(0.5, '#cc0000');
      gradient.addColorStop(1, '#660000');
    } else if (this.type === 'fast') {
      gradient.addColorStop(0, '#ff88ff');
      gradient.addColorStop(0.5, '#ff00ff');
      gradient.addColorStop(1, '#880088');
    } else if (this.type === 'shooter') {
      gradient.addColorStop(0, '#ffcc66');
      gradient.addColorStop(0.5, '#ffaa00');
      gradient.addColorStop(1, '#aa6600');
    } else {
      gradient.addColorStop(0, '#ff8888');
      gradient.addColorStop(0.5, '#ff0000');
      gradient.addColorStop(1, '#880000');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.typeData.radius, 0, Math.PI * 2);
    ctx.fill();

    // Health bar (always show)
    const barWidth = this.typeData.radius * 2.4;
    const barHeight = 5;
    const barY = this.y - this.typeData.radius - 12;

    // Background
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    // Health
    const healthPercent = this.health / this.maxHealth;
    const healthColor = healthPercent > 0.6 ? '#00ff00' : healthPercent > 0.3 ? '#ffff00' : '#ff0000';
    ctx.fillStyle = healthColor;
    ctx.shadowBlur = 5;
    ctx.shadowColor = healthColor;
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    // Type indicator
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${this.typeData.radius}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = this.type === 'shooter' ? '🔫' : this.type === 'tank' ? '🛡️' : this.type === 'fast' ? '⚡' : '👾';
    ctx.fillText(icon, this.x, this.y);

    ctx.restore();
  }

  getAngleToPlayer(playerX: number, playerY: number): number {
    return Math.atan2(playerY - this.y, playerX - this.x);
  }

  collidesWith(x: number, y: number, radius: number): boolean {
    return circleCollision(
      { x: this.x, y: this.y, radius: this.typeData.radius },
      { x, y, radius }
    );
  }
}
