// Enemy entity with AI and different types

import { circleCollision } from './utils';
import { SpriteSheet } from './sprites';

export type EnemyType = 'slime' | 'goblin' | 'skeleton' | 'imp' | 'orc' | 'wraith' | 'necromancer' | 'troll' | 'banshee' | 'demon';

export interface EnemyTypeData {
  health: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  xpValue: number;
  goldValue: number;
  shootRate?: number; // Shots per second (for ranged types)
  spriteName: string;
}

const ENEMY_TYPES: Record<EnemyType, EnemyTypeData> = {
  slime: {
    health: 150,
    speed: 60,
    damage: 8,
    radius: 14,
    color: '#4ade80',
    xpValue: 18, // +50% XP
    goldValue: 12, // +100% gold
    spriteName: 'slime'
  },
  goblin: {
    health: 60,
    speed: 120,
    damage: 6,
    radius: 12,
    color: '#7cb342',
    xpValue: 15, // +50% XP
    goldValue: 10, // +100% gold
    shootRate: 0.4,
    spriteName: 'goblin'
  },
  skeleton: {
    health: 80,
    speed: 70,
    damage: 10,
    radius: 12,
    color: '#e0e0e0',
    xpValue: 23, // +50% XP (rounded)
    goldValue: 16, // +100% gold
    shootRate: 0.8,
    spriteName: 'skeleton'
  },
  imp: {
    health: 70,
    speed: 90,
    damage: 12,
    radius: 11,
    color: '#8b0000',
    xpValue: 27, // +50% XP
    goldValue: 20, // +100% gold
    spriteName: 'imp'
  },
  orc: {
    health: 120,
    speed: 85,
    damage: 15,
    radius: 16,
    color: '#567d46',
    xpValue: 30, // +50% XP
    goldValue: 24, // +100% gold
    spriteName: 'orc'
  },
  wraith: {
    health: 90,
    speed: 80,
    damage: 10,
    radius: 13,
    color: '#9370db',
    xpValue: 38, // +50% XP (rounded)
    goldValue: 30, // +100% gold
    spriteName: 'wraith'
  },
  necromancer: {
    health: 100,
    speed: 60,
    damage: 8,
    radius: 12,
    color: '#2c2c54',
    xpValue: 45, // +50% XP
    goldValue: 36, // +100% gold
    shootRate: 0.5,
    spriteName: 'necromancer'
  },
  troll: {
    health: 200,
    speed: 55,
    damage: 18,
    radius: 18,
    color: '#4a7c59',
    xpValue: 53, // +50% XP (rounded)
    goldValue: 40, // +100% gold
    spriteName: 'troll'
  },
  banshee: {
    health: 75,
    speed: 85,
    damage: 12,
    radius: 13,
    color: '#e0e0e0',
    xpValue: 42, // +50% XP
    goldValue: 32, // +100% gold
    spriteName: 'banshee'
  },
  demon: {
    health: 500,
    speed: 90,
    damage: 20,
    radius: 20,
    color: '#8b0000',
    xpValue: 150, // +50% XP
    goldValue: 100, // +100% gold
    shootRate: 1.5,
    spriteName: 'demon'
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

  // Imp specific (teleporter)
  teleportCooldown: number = 0;

  // Orc specific (charge)
  charging: boolean = false;
  chargeSpeed: number = 0;

  // Wraith specific (phasing)
  invulnerable: boolean = false;
  invulnerableTimer: number = 0;
  phaseCooldown: number = 0;

  // Necromancer specific (summoner)
  summonCooldown: number = 0;

  // Troll specific (regeneration)
  regenTimer: number = 0;

  // Banshee specific (screamer)
  screamCooldown: number = 0;

  // Split tracking for slimes
  canSplit: boolean = true;

  constructor(x: number, y: number, type: EnemyType, waveMultiplier: number = 1, canSplit: boolean = true) {
    this.id = Enemy.nextId++;
    this.x = x;
    this.y = y;
    this.type = type;
    this.typeData = { ...ENEMY_TYPES[type] };
    this.canSplit = canSplit;

    // Scale with wave
    this.typeData.health *= waveMultiplier;
    this.typeData.damage *= waveMultiplier;
    this.typeData.speed *= (1 + (waveMultiplier - 1) * 0.3); // Speed scales slower

    this.maxHealth = this.typeData.health;
    this.health = this.maxHealth;
  }

  update(dt: number, playerX: number, playerY: number): {
    shouldShoot: boolean;
    shouldTeleport?: boolean;
    shouldSummon?: boolean;
    shouldScream?: boolean;
    splitInto?: Enemy[];
  } {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let shouldShoot = false;
    let shouldTeleport = false;
    let shouldSummon = false;
    let shouldScream = false;
    let splitInto: Enemy[] | undefined;

    // Movement behavior based on type
    if (dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;

      let moveSpeed = this.typeData.speed;
      let shouldMove = true;

      // Type-specific movement
      if (this.type === 'skeleton' || this.type === 'goblin' || this.type === 'necromancer') {
        // Ranged units keep distance
        if (dist < 250) {
          // Move away if too close
          this.x -= nx * moveSpeed * dt * 0.5;
          this.y -= ny * moveSpeed * dt * 0.5;
          shouldMove = false;
        } else if (dist > 350) {
          shouldMove = true;
        } else {
          shouldMove = false;
        }
      }

      // Orc charge behavior
      if (this.type === 'orc' && dist < 200 && !this.charging) {
        this.charging = true;
        this.chargeSpeed = moveSpeed * 2.5;
      }

      if (this.charging) {
        moveSpeed = this.chargeSpeed;
        this.chargeSpeed *= 0.95; // Slow down charge
        if (this.chargeSpeed < this.typeData.speed) {
          this.charging = false;
        }
      }

      // Wraith phasing
      if (this.type === 'wraith') {
        this.phaseCooldown -= dt;
        if (this.invulnerable) {
          this.invulnerableTimer -= dt;
          if (this.invulnerableTimer <= 0) {
            this.invulnerable = false;
          }
        }
      }

      if (shouldMove) {
        this.x += nx * moveSpeed * dt;
        this.y += ny * moveSpeed * dt;
      }
    }

    // Shooter logic (skeleton, goblin, necromancer, demon)
    if (this.typeData.shootRate) {
      this.shootCooldown -= dt;
      if (this.shootCooldown <= 0 && dist > 50 && dist < 450) {
        shouldShoot = true;
        this.shootCooldown = 1 / this.typeData.shootRate;
      }
    }

    // Imp teleport
    if (this.type === 'imp') {
      this.teleportCooldown -= dt;
    }

    // Necromancer summon
    if (this.type === 'necromancer') {
      this.summonCooldown -= dt;
      if (this.summonCooldown <= 0) {
        shouldSummon = true;
        this.summonCooldown = 5;
      }
    }

    // Troll regeneration
    if (this.type === 'troll') {
      this.regenTimer += dt;
      if (this.regenTimer >= 0.5) {
        this.health = Math.min(this.maxHealth, this.health + 2);
        this.regenTimer = 0;
      }
    }

    // Banshee scream
    if (this.type === 'banshee') {
      this.screamCooldown -= dt;
      if (this.screamCooldown <= 0 && dist < 200) {
        shouldScream = true;
        this.screamCooldown = 6;
      }
    }

    return { shouldShoot, shouldTeleport, shouldSummon, shouldScream, splitInto };
  }

  takeDamage(amount: number): Enemy[] | null {
    // Wraith invulnerability
    if (this.invulnerable) {
      return null;
    }

    this.health -= amount;

    // Imp teleport on hit
    if (this.type === 'imp' && this.teleportCooldown <= 0 && Math.random() < 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 50;
      this.x += Math.cos(angle) * distance;
      this.y += Math.sin(angle) * distance;
      this.teleportCooldown = 2;
    }

    // Wraith phase on damage
    if (this.type === 'wraith' && this.phaseCooldown <= 0 && Math.random() < 0.3) {
      this.invulnerable = true;
      this.invulnerableTimer = 1;
      this.phaseCooldown = 4;
    }

    if (this.health <= 0) {
      this.dead = true;

      // Slime split mechanic
      if (this.type === 'slime' && this.canSplit && this.typeData.radius > 8) {
        const splits: Enemy[] = [];
        for (let i = 0; i < 2; i++) {
          const angle = (Math.PI * 2 * i) / 2;
          const smallSlime = new Enemy(
            this.x + Math.cos(angle) * 30,
            this.y + Math.sin(angle) * 30,
            'slime',
            1,
            false // Small slimes don't split again
          );
          // Make them smaller and weaker
          smallSlime.typeData.health = this.maxHealth * 0.3;
          smallSlime.typeData.radius = this.typeData.radius * 0.6;
          smallSlime.typeData.damage = this.typeData.damage * 0.6;
          smallSlime.maxHealth = smallSlime.typeData.health;
          smallSlime.health = smallSlime.maxHealth;
          splits.push(smallSlime);
        }
        return splits;
      }
    }

    return null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const sprite = SpriteSheet.get(this.typeData.spriteName);

    if (sprite) {
      // Glow effect
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.typeData.color;

      // Wraith phasing effect
      if (this.invulnerable) {
        ctx.globalAlpha = 0.3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#9370db';
      }

      // Draw sprite
      ctx.drawImage(
        sprite,
        this.x - sprite.width / 2,
        this.y - sprite.height / 2
      );
    } else {
      // Fallback to circle if sprite not found
      const gradient = ctx.createRadialGradient(
        this.x - this.typeData.radius * 0.3,
        this.y - this.typeData.radius * 0.3,
        0,
        this.x,
        this.y,
        this.typeData.radius
      );
      gradient.addColorStop(0, this.typeData.color + 'aa');
      gradient.addColorStop(0.5, this.typeData.color);
      gradient.addColorStop(1, this.typeData.color + '66');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.typeData.radius, 0, Math.PI * 2);
      ctx.fill();
    }

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

  // Create a skeleton minion for necromancer
  static createSkeletonMinion(x: number, y: number): Enemy {
    const minion = new Enemy(x, y, 'skeleton', 0.5);
    minion.typeData.health = 40;
    minion.typeData.damage = 5;
    minion.maxHealth = minion.typeData.health;
    minion.health = minion.maxHealth;
    return minion;
  }
}
