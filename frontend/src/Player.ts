// Player entity with stats, abilities, and auto-attack

import { PlayerStats } from './ItemSystem';
import { Projectile } from './Projectile';
import { Enemy } from './Enemy';
import { circleCollision } from './utils';
import { SpriteSheet } from './sprites';

export class Player {
  x: number;
  y: number;
  radius: number = 15;

  // Stats
  stats: PlayerStats;
  health: number;
  maxHealth: number;

  // XP and leveling
  xp: number = 0;
  level: number = 1;
  xpToNextLevel: number = 100;

  // Gold
  gold: number = 0;

  // Combat
  shootCooldown: number = 0;
  shield: boolean = false; // Active shield

  // Abilities
  dashCooldown: number = 0;
  dashDuration: number = 0;
  dashSpeed: number = 800;
  blastCooldown: number = 0;

  // Movement
  velocityX: number = 0;
  velocityY: number = 0;

  dead: boolean = false;

  constructor(x: number, y: number, stats: PlayerStats) {
    this.x = x;
    this.y = y;
    this.stats = stats;
    this.maxHealth = stats.getMaxHealth();
    this.health = this.maxHealth;

    // Check for shield item
    if (stats.hasShield()) {
      this.shield = true;
    }
  }

  update(dt: number, inputX: number, inputY: number, canvasWidth: number, canvasHeight: number): void {
    // Cooldowns
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.blastCooldown = Math.max(0, this.blastCooldown - dt);
    this.dashDuration = Math.max(0, this.dashDuration - dt);

    // Movement
    const speed = this.dashDuration > 0 ? this.dashSpeed : this.stats.getSpeed();
    this.velocityX = inputX * speed;
    this.velocityY = inputY * speed;

    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;

    // Keep in bounds
    this.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));
  }

  // Auto-attack nearest enemy
  tryShoot(enemies: Enemy[]): Projectile[] {
    if (this.shootCooldown > 0 || enemies.length === 0) return [];

    // Find nearest enemy
    let nearest: Enemy | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      const dist = Math.sqrt(
        (enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    if (!nearest) return [];

    // Shoot at nearest enemy
    const angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
    const damage = this.stats.getDamage();
    const speed = this.stats.getProjectileSpeed();
    const piercingCount = this.stats.getPiercing();

    const projectiles: Projectile[] = [];

    // Main shot
    const mainProj = new Projectile(this.x, this.y, angle, damage, speed, true, piercingCount > 0);
    mainProj.maxPierceCount = piercingCount;
    projectiles.push(mainProj);

    // Multishot
    const multishot = this.stats.getMultishot();
    if (multishot > 0) {
      const spreadAngle = 0.3; // Radians between shots
      for (let i = 1; i <= multishot; i++) {
        const offset = i % 2 === 0 ? (i / 2) * spreadAngle : -(Math.ceil(i / 2)) * spreadAngle;
        const multishotProj = new Projectile(this.x, this.y, angle + offset, damage, speed, true, piercingCount > 0);
        multishotProj.maxPierceCount = piercingCount;
        projectiles.push(multishotProj);
      }
    }

    // Reset cooldown
    this.shootCooldown = 1 / this.stats.getFireRate();

    return projectiles;
  }

  // Dash ability
  tryDash(): boolean {
    if (this.dashCooldown > 0) return false;

    this.dashDuration = 0.2; // 200ms dash
    this.dashCooldown = 3; // 3 second cooldown
    return true;
  }

  // Blast ability (AoE damage around player)
  tryBlast(): { success: boolean; damage: number; radius: number } {
    if (this.blastCooldown > 0) return { success: false, damage: 0, radius: 0 };

    this.blastCooldown = 5; // 5 second cooldown
    return {
      success: true,
      damage: this.stats.getDamage() * 3,
      radius: 100
    };
  }

  takeDamage(amount: number): boolean {
    // Shield absorbs hit
    if (this.shield) {
      this.shield = false;
      return false; // No damage taken
    }

    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
    return true;
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addXP(amount: number): boolean {
    this.xp += amount;

    if (this.xp >= this.xpToNextLevel) {
      this.levelUp();
      return true;
    }
    return false;
  }

  addGold(amount: number): void {
    this.gold += amount;
  }

  private levelUp(): void {
    this.level++;
    this.xp -= this.xpToNextLevel;
    this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);

    // Stat boosts on level up
    this.stats.baseDamage += 2;
    this.stats.baseMaxHealth += 10;
    this.maxHealth = this.stats.getMaxHealth();
    this.health = Math.min(this.maxHealth, this.health + 20); // Heal on level up
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const sprite = SpriteSheet.get('player');

    // Outer glow effect (pulsing)
    const pulseOffset = Math.sin(Date.now() / 200) * 2;
    ctx.shadowBlur = 20 + pulseOffset;
    ctx.shadowColor = '#4a90e2';

    // Dash effect
    if (this.dashDuration > 0) {
      ctx.globalAlpha = 0.7;
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#00ffff';
    }

    // Shield effect
    if (this.shield) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00ffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw player sprite
    if (sprite) {
      ctx.drawImage(
        sprite,
        this.x - sprite.width / 2,
        this.y - sprite.height / 2
      );
    } else {
      // Fallback to circle
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      gradient.addColorStop(0, '#88ff88');
      gradient.addColorStop(0.6, '#00ff00');
      gradient.addColorStop(1, '#008800');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  collidesWith(x: number, y: number, radius: number): boolean {
    return circleCollision(
      { x: this.x, y: this.y, radius: this.radius },
      { x, y, radius }
    );
  }

  // Check if critical hit
  rollCrit(): boolean {
    return Math.random() < this.stats.getCritChance();
  }

  getCritDamage(baseDamage: number): number {
    return baseDamage * this.stats.getCritMultiplier();
  }
}
