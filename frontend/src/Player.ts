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

  // ARTIFACT hooks (set by Game from the ArtifactSystem):
  //  • incomingDamageMult — Glass Cannon scales incoming damage up.
  //  • secondWindArmed — Second Wind: the first lethal hit each wave leaves you at
  //    1 HP instead of dying; consumed on use, re-armed at each wave start.
  incomingDamageMult: number = 1;
  secondWindArmed: boolean = false;
  /** Set for one frame when Second Wind saves you, so Game can flash feedback. */
  secondWindTriggered: boolean = false;

  // GAME FEEL: Invincibility frames
  invincibilityTimer: number = 0;
  /** Dodged hits waiting for a "DODGE" popup (consumed by Game). */
  pendingDodges: number = 0;
  invincibilityDuration: number = 0.5; // 500ms of i-frames

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
    this.invincibilityTimer = Math.max(0, this.invincibilityTimer - dt);

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

  // Auto-attack nearest enemy (supports different weapon types)
  tryShoot(enemies: Enemy[], forceFire: boolean = false): Projectile[] {
    // forceFire = a bonus volley (e.g. Multicast) that fires the same frame and
    // must NOT be gated by, or reset, the normal fire cooldown.
    if ((!forceFire && this.shootCooldown > 0) || enemies.length === 0) return [];

    // Find nearest enemy
    let nearest: Enemy | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      const dist = Math.sqrt(
        (enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2
      );
      // Bosses count as closer than they are so trash can't fully soak
      // the auto-aim during boss fights
      const effDist = enemy.typeData.isBoss ? dist * 0.55 : dist;
      if (effDist < nearestDist) {
        nearestDist = effDist;
        nearest = enemy;
      }
    }

    if (!nearest) return [];

    const weaponType = this.stats.getWeaponType();
    const angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
    const damage = this.stats.getRangedDamage();
    const speed = this.stats.getProjectileSpeed();
    const piercingCount = this.stats.getPiercing();

    const projectiles: Projectile[] = [];

    // Different attack patterns based on weapon type
    if (weaponType === 'shotgun') {
      // Shotgun: Wide spread of pellets
      const pelletCount = 1 + this.stats.getMultishot();
      const spreadAngle = 0.6; // Total spread in radians
      const angleStep = spreadAngle / Math.max(1, pelletCount - 1);
      const startAngle = angle - spreadAngle / 2;

      for (let i = 0; i < pelletCount; i++) {
        const pelletAngle = startAngle + i * angleStep;
        const proj = new Projectile(this.x, this.y, pelletAngle, damage, speed, true, piercingCount > 0);
        proj.maxPierceCount = piercingCount;
        projectiles.push(proj);
      }
    } else if (weaponType === 'orbital') {
      // Orbital: Rotating projectiles (handled differently - no projectiles, orbitals are persistent)
      // For now, create fast-moving circular projectiles
      const orbitCount = 1 + this.stats.getMultishot();
      const angleStep = (Math.PI * 2) / orbitCount;

      for (let i = 0; i < orbitCount; i++) {
        const orbitAngle = i * angleStep + Date.now() * 0.003; // Rotate over time
        const proj = new Projectile(this.x, this.y, orbitAngle, damage, speed * 0.5, true, piercingCount > 0);
        proj.maxPierceCount = piercingCount;
        projectiles.push(proj);
      }
    } else if (weaponType === 'laser') {
      // Laser: Fast, piercing beam
      const proj = new Projectile(this.x, this.y, angle, damage, speed, true, true);
      proj.maxPierceCount = 999; // Laser pierces everything
      proj.radius = 6; // Thinner
      proj.color = '#00ffff';
      projectiles.push(proj);
    } else {
      // Default: Auto-aim bullets
      const mainProj = new Projectile(this.x, this.y, angle, damage, speed, true, piercingCount > 0);
      mainProj.maxPierceCount = piercingCount;
      if (this.stats.hasHoming()) {
        mainProj.homing = true;
        mainProj.turnSpeed = 3.5;
      }
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
    }

    // Reset cooldown (bonus/forced volleys don't touch the cadence)
    if (!forceFire) this.shootCooldown = 1 / this.stats.getFireRate();

    return projectiles;
  }

  // Dash ability
  tryDash(): boolean {
    if (this.dashCooldown > 0) return false;

    this.dashDuration = 0.2; // 200ms dash
    this.dashCooldown = 3; // 3 second cooldown
    // GAME FEEL: Grant invincibility frames during dash
    this.invincibilityTimer = Math.max(this.invincibilityTimer, 0.2);
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
    // GAME FEEL: Invincibility frames prevent damage
    if (this.invincibilityTimer > 0) {
      return false; // No damage taken during i-frames
    }

    // Dodge chance (Evasion Cloak etc.) — Game reads pendingDodges for the
    // "DODGE" popup so the miss is visible
    if (Math.random() < this.stats.getDodgeChance()) {
      this.pendingDodges++;
      this.invincibilityTimer = this.invincibilityDuration * 0.5;
      return false;
    }

    // Shield absorbs hit
    if (this.shield) {
      this.shield = false;
      this.invincibilityTimer = this.invincibilityDuration; // Grant i-frames even on shield break
      return false; // No damage taken
    }

    // ARTIFACT: Glass Cannon multiplies incoming damage (applied before armor so
    // armor still shaves the same flat amount off the scaled hit).
    amount *= this.incomingDamageMult;

    // Armor: PERCENTAGE damage mitigation (Brotato-style), not flat subtraction.
    // Flat subtraction was degenerate: with the game's many-weak-hits design (enemy
    // contact 6-15) and persistent meta armor of up to +15, every early hit was floored
    // to the min-1 — the player took almost no damage regardless of in-run stats. A
    // diminishing-returns curve keeps each armor point meaningful (armor 5 = ~20% less,
    // 10 = ~33%, 15 = ~43%, 25 = ~56%) without ever making small hits free.
    // BALANCE 2026-07-03: armor is otherwise UNBOUNDED and enemies have no armor-pen,
    // so a heavy stack (armor 200 = 91%, 380 = 95%) trended toward immortality — the
    // same counter-pressure-less runaway the economy caps fixed. Floor the multiplier
    // at 0.10 → armor caps at 90% mitigation; each point still matters up to the cap.
    const armor = this.stats.getArmor();
    if (armor > 0) {
      amount *= Math.max(0.10, 20 / (20 + armor));
    }
    amount = Math.max(1, amount); // a hit always deals at least 1

    this.health -= amount;
    if (this.health <= 0) {
      // ARTIFACT: Second Wind — survive the first lethal hit of the wave at 1 HP.
      if (this.secondWindArmed) {
        this.secondWindArmed = false;
        this.secondWindTriggered = true;
        this.health = 1;
      } else {
        this.health = 0;
        this.dead = true;
      }
    }

    // GAME FEEL: Grant invincibility frames after taking damage
    this.invincibilityTimer = this.invincibilityDuration;

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

    // MODERN ROGUELIKE: Faster early progression (inspired by Vampire Survivors)
    // First 5 levels are 30% faster to get players hooked quickly
    if (this.level <= 5) {
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.35); // 1.5 * 0.7 = ~1.35
    } else {
      // BALANCE: 1.5 stalled leveling around L11 (L13 needed 5+ full waves of
      // XP); 1.25 keeps level-ups flowing into the late game
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.25);
    }

    // Stat boosts on level up
    this.stats.baseDamage += 2;
    this.stats.baseMaxHealth += 10;
    this.maxHealth = this.stats.getMaxHealth();
    this.health = Math.min(this.maxHealth, this.health + 20); // Heal on level up
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const sprite = SpriteSheet.get('player');

    // BROTATO-STYLE: Extra thick dark outline for maximum visibility
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 20, 0, Math.PI * 2);
    ctx.stroke();

    // PURE PIXEL ART: No shadow blur, no smooth alpha
    // Use dithering and solid colors only

    // Shield effect - solid cyan ring
    if (this.shield) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw player sprite with effects
    if (sprite) {
      // Dash effect: draw with 70% dithered pattern
      if (this.dashDuration > 0) {
        const ditherSize = 2;
        ctx.save();
        ctx.beginPath();
        for (let dx = 0; dx < sprite.width; dx += ditherSize) {
          for (let dy = 0; dy < sprite.height; dy += ditherSize) {
            if (((dx + dy) / ditherSize) % 10 <= 6) { // 70% of pixels
              ctx.rect(
                this.x - sprite.width / 2 + dx,
                this.y - sprite.height / 2 + dy,
                ditherSize,
                ditherSize
              );
            }
          }
        }
        ctx.clip();
        ctx.drawImage(sprite, this.x - sprite.width / 2, this.y - sprite.height / 2);
        ctx.restore();
      }
      // Invincibility blink: alternate between visible and 30% dithered
      else if (this.invincibilityTimer > 0) {
        const blinkPhase = Math.floor(this.invincibilityTimer * 10) % 2;
        if (blinkPhase === 0) {
          // Blink phase: draw with sparse dither (30%)
          const ditherSize = 2;
          ctx.save();
          ctx.beginPath();
          for (let dx = 0; dx < sprite.width; dx += ditherSize) {
            for (let dy = 0; dy < sprite.height; dy += ditherSize) {
              if (((dx + dy) / ditherSize) % 3 === 0) { // 33% of pixels
                ctx.rect(
                  this.x - sprite.width / 2 + dx,
                  this.y - sprite.height / 2 + dy,
                  ditherSize,
                  ditherSize
                );
              }
            }
          }
          ctx.clip();
          ctx.drawImage(sprite, this.x - sprite.width / 2, this.y - sprite.height / 2);
          ctx.restore();
        } else {
          // Normal phase: full sprite
          ctx.drawImage(sprite, this.x - sprite.width / 2, this.y - sprite.height / 2);
        }
      }
      // Normal draw
      else {
        ctx.drawImage(sprite, this.x - sprite.width / 2, this.y - sprite.height / 2);
      }
    } else {
      // PIXEL ART FALLBACK: Solid green circle, no gradient
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Black outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
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
