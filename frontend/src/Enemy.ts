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

    // Shadow
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.typeData.color;

    // Body
    ctx.fillStyle = this.typeData.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.typeData.radius, 0, Math.PI * 2);
    ctx.fill();

    // Health bar
    if (this.health < this.maxHealth) {
      const barWidth = this.typeData.radius * 2;
      const barHeight = 4;
      const barY = this.y - this.typeData.radius - 8;

      ctx.fillStyle = '#000000';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);

      const healthPercent = this.health / this.maxHealth;
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(this.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);
    }

    // Type indicator
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
