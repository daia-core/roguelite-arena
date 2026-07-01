// Main game state machine

import { Player } from './Player';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { MeleeAttack } from './MeleeAttack';
import { Particle, DamageNumber, spawnHitParticles, spawnKillParticles, spawnXPParticles, spawnHealthOrbParticles, spawnLevelUpParticles } from './Particle';
import { WaveManager } from './WaveManager';
import { PlayerStats, ItemDatabase, type Item, type ItemTag } from './ItemSystem';
import { SaveManager } from './SaveManager';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { pointInRect } from './utils';
import { HealthOrb } from './Pickup';
import { MetaProgression } from './MetaProgression';

export type GameState = 'menu' | 'playing' | 'shop' | 'paused' | 'gameover' | 'upgrades';

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private input: Input;
  private audio: AudioManager;

  state: GameState = 'menu';

  // Game entities
  player: Player | null = null;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  meleeAttacks: MeleeAttack[] = [];
  particles: Particle[] = [];
  damageNumbers: DamageNumber[] = [];
  healthOrbs: HealthOrb[] = [];

  // Systems
  waveManager: WaveManager;
  playerStats: PlayerStats;
  metaProgression: MetaProgression;

  // GAME FEEL: Hit pause / time scale system
  timeScale: number = 1.0;
  hitPauseTimer: number = 0;

  // Shop state - ADVANCED BROTATO-LEVEL MECHANICS
  shopItems: Item[] = [];
  selectedShopItem: number = -1;
  shopRerollCost: number = 2;
  shopRerolls: number = 0;
  lockedShopItems: Set<number> = new Set(); // FREE locking (no 5g cost)
  itemsPurchasedThisWave: number = 0; // Track for free reroll bonus

  // Stats
  kills: number = 0;
  bossKills: number = 0;
  soulsEarnedThisRun: number = 0;

  // Game over details
  gameOverStats: {
    wavesReached: number;
    enemiesKilled: number;
    goldEarned: number;
    itemsCollected: number;
    soulsEarned: number;
  } = {
    wavesReached: 0,
    enemiesKilled: 0,
    goldEarned: 0,
    itemsCollected: 0,
    soulsEarned: 0
  };

  // Pause
  pauseRequested: boolean = false;

  // Wave modifier announcement
  waveModifierTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.audio = new AudioManager();
    this.waveManager = new WaveManager();
    this.playerStats = new PlayerStats();
    this.metaProgression = new MetaProgression();

    // Connect input to game state
    this.input.setGameStateGetter(() => this.state);

    // Escape key for pause
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.state === 'playing') {
          this.state = 'paused';
        } else if (this.state === 'paused') {
          this.state = 'playing';
        }
      }
    });

    this.setupUI();
  }

  private setupUI(): void {
    // Start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.startNewGame();
      });
    }

    // Continue button
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this.continueGame();
      });

      // Show/hide based on saved game
      continueBtn.style.display = SaveManager.hasSavedRun() ? 'block' : 'none';
    }

    // Upgrades button
    const upgradesBtn = document.getElementById('upgradesBtn');
    if (upgradesBtn) {
      upgradesBtn.addEventListener('click', () => {
        this.state = 'upgrades';
      });
    }
  }

  startNewGame(): void {
    SaveManager.clearRun();

    this.playerStats = new PlayerStats();

    // Apply meta-progression starting item
    if (this.metaProgression.hasStartingItem()) {
      const commonItems = ItemDatabase.getItemsByRarity('common');
      if (commonItems.length > 0) {
        const randomItem = commonItems[Math.floor(Math.random() * commonItems.length)];
        this.playerStats.addItem(randomItem);
      }
    }

    this.player = new Player(this.canvas.width / 2, this.canvas.height / 2, this.playerStats);

    // Apply meta-progression bonuses
    const damageBonus = this.metaProgression.getStartingDamageBonus();
    if (damageBonus > 0) {
      this.player.stats.baseDamage *= (1 + damageBonus);
    }

    const healthBonus = this.metaProgression.getStartingHealthBonus();
    if (healthBonus > 0) {
      this.player.maxHealth += healthBonus;
      this.player.health = this.player.maxHealth;
    }

    // Starting gold: 20g (can buy 1 cheap item immediately)
    this.player.gold = 20;

    const goldBonus = this.metaProgression.getStartingGoldBonus();
    if (goldBonus > 0) {
      this.player.gold += goldBonus;
    }

    this.enemies = [];
    this.projectiles = [];
    this.meleeAttacks = [];
    this.particles = [];
    this.damageNumbers = [];
    this.healthOrbs = [];
    this.kills = 0;
    this.bossKills = 0;
    this.soulsEarnedThisRun = 0;

    this.waveManager.reset();
    this.waveManager.startWave(1);
    this.waveModifierTimer = 3;

    this.state = 'playing';
  }

  continueGame(): void {
    const save = SaveManager.loadRun();

    this.playerStats = new PlayerStats();

    // Restore items
    if (save.items) {
      save.items.forEach(itemId => {
        const item = ItemDatabase.getItemById(itemId);
        if (item) this.playerStats.addItem(item);
      });
    }

    this.player = new Player(this.canvas.width / 2, this.canvas.height / 2, this.playerStats);

    // Restore stats
    if (save.level) {
      this.player.level = save.level;
      this.player.xp = save.xp ?? 0;
      this.player.xpToNextLevel = 100 * Math.pow(1.5, save.level - 1);
    }
    if (save.gold !== undefined) this.player.gold = save.gold;
    if (save.health !== undefined) this.player.health = save.health;

    this.enemies = [];
    this.projectiles = [];
    this.meleeAttacks = [];
    this.particles = [];
    this.damageNumbers = [];
    this.healthOrbs = [];
    this.kills = 0;

    const wave = save.wave ?? 1;
    this.waveManager.reset();
    this.waveManager.startWave(wave);

    this.state = 'playing';
  }

  update(dt: number): void {
    this.renderer.update(dt);

    switch (this.state) {
      case 'menu':
        this.updateMenu();
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'shop':
        this.updateShop();
        break;
      case 'paused':
        this.updatePaused();
        break;
      case 'gameover':
        this.updateGameOver();
        break;
      case 'upgrades':
        this.updateUpgrades();
        break;
    }
  }

  private updateMenu(): void {
    // Update continue button visibility
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.style.display = SaveManager.hasSavedRun() ? 'block' : 'none';
    }
  }

  private updatePlaying(dt: number): void {
    if (!this.player) return;

    // GAME FEEL: Hit pause / time scale
    if (this.hitPauseTimer > 0) {
      this.hitPauseTimer -= dt;
      this.timeScale = 0.05; // Almost frozen during hit pause
    } else {
      this.timeScale = 1.0;
    }

    // Apply time scale to delta time
    const scaledDt = dt * this.timeScale;

    // Wave modifier announcement timer
    if (this.waveModifierTimer > 0) {
      this.waveModifierTimer -= dt; // UI timers not affected by time scale
    }

    // Input
    const movement = this.input.getMovementVector();

    // Player update
    this.player.update(scaledDt, movement.x, movement.y, this.canvas.width, this.canvas.height);

    // Player shooting
    const weaponType = this.playerStats.getWeaponType();
    if (weaponType === 'melee') {
      // Melee attack
      const meleeAttack = this.player.tryMeleeAttack(this.enemies);
      if (meleeAttack) {
        this.meleeAttacks.push(meleeAttack);
        this.audio.playShoot();
      }
    } else {
      // Ranged attack
      const newProjectiles = this.player.tryShoot(this.enemies);
      if (newProjectiles.length > 0) {
        this.projectiles.push(...newProjectiles);
        this.audio.playShoot();
      }
    }

    // Abilities
    // Dash/Blast abilities removed - shop upgrading is the core loop
    // if (this.input.consumeDash()) {
    //   if (this.player.tryDash()) {
    //     this.audio.playDash();
    //   }
    // }

    // if (this.input.consumeBlast()) {
    //   const blast = this.player.tryBlast();
    //   if (blast.success) {
    //     this.audio.playBlast();
    //     this.handleBlastDamage(blast.damage, blast.radius);
    //     this.renderer.addScreenShake(0.5); // Bigger shake for blast ability
    //   }
    // }

    // Wave manager
    this.enemies = this.waveManager.update(scaledDt, this.enemies, this.canvas.width, this.canvas.height);

    // Enemies
    for (const enemy of this.enemies) {
      const result = enemy.update(scaledDt, this.player.x, this.player.y);

      // Enemy shooting
      if (result.shouldShoot) {
        const angle = enemy.getAngleToPlayer(this.player.x, this.player.y);
        // Wizard fires homing projectiles (slightly curved toward player - handled in projectile update)
        this.projectiles.push(new Projectile(
          enemy.x,
          enemy.y,
          angle,
          enemy.typeData.damage,
          enemy.type === 'wizard' ? 250 : 300,
          false
        ));
        this.audio.playShoot();
      }

      // Golem stomp
      if (result.shouldStomp) {
        const stompRadius = 100;
        const dist = Math.sqrt(
          (this.player.x - enemy.x) ** 2 + (this.player.y - enemy.y) ** 2
        );
        if (dist < stompRadius) {
          const damaged = this.player.takeDamage(enemy.typeData.damage * 1.5);
          if (damaged) {
            this.renderer.addScreenShake(0.6);
            this.renderer.addHitFlash(0.6);
            this.particles.push(...spawnHitParticles(this.player.x, this.player.y, 15));
          }
        }
        // Visual effect
        this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 25));
        this.renderer.addScreenShake(0.4);
      }

      // Poison trail
      if (result.poisonTrail) {
        this.particles.push(new Particle({
          x: result.poisonTrail.x,
          y: result.poisonTrail.y,
          vx: 0,
          vy: 0,
          color: '#00ff00',
          size: 6,
          lifetime: 2,
          fadeOut: true
        }));
      }

      // Spore cloud (mushroom)
      if (result.sporeCloud) {
        // Create damaging cloud particles
        for (let i = 0; i < 12; i++) {
          const angle = (Math.PI * 2 * i) / 12;
          const speed = 40 + Math.random() * 30;
          this.particles.push(new Particle({
            x: result.sporeCloud.x,
            y: result.sporeCloud.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: '#9b59b6',
            size: 5,
            lifetime: 1.5,
            fadeOut: true
          }));
        }
        // Check if player is in range of spore cloud
        const dist = Math.sqrt(
          (this.player.x - result.sporeCloud.x) ** 2 + (this.player.y - result.sporeCloud.y) ** 2
        );
        if (dist < 80) {
          const damaged = this.player.takeDamage(enemy.typeData.damage * 0.5);
          if (damaged) {
            this.renderer.addHitFlash(0.3);
          }
        }
      }

      // Druid healing
      if (result.shouldHeal) {
        // Find nearby enemies to heal
        for (const otherEnemy of this.enemies) {
          if (otherEnemy.id === enemy.id) continue;
          const dist = Math.sqrt(
            (otherEnemy.x - enemy.x) ** 2 + (otherEnemy.y - enemy.y) ** 2
          );
          if (dist < 150) {
            otherEnemy.health = Math.min(otherEnemy.maxHealth, otherEnemy.health + 15);
            // Healing particles
            this.particles.push(new Particle({
              x: otherEnemy.x,
              y: otherEnemy.y,
              vx: 0,
              vy: -50,
              color: '#27ae60',
              size: 6,
              lifetime: 0.8,
              fadeOut: true
            }));
          }
        }
      }

      // NecroEgg spawning
      if (result.shouldSpawnMinion) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 40;
        const minion = new Enemy(
          enemy.x + Math.cos(angle) * dist,
          enemy.y + Math.sin(angle) * dist,
          'skeleton',
          0.4
        );
        minion.typeData.health = 30;
        minion.typeData.damage = 4;
        minion.maxHealth = minion.typeData.health;
        minion.health = minion.maxHealth;
        this.enemies.push(minion);
        // Spawn particles
        for (let i = 0; i < 8; i++) {
          const particleAngle = (Math.PI * 2 * i) / 8;
          this.particles.push(new Particle({
            x: minion.x,
            y: minion.y,
            vx: Math.cos(particleAngle) * 60,
            vy: Math.sin(particleAngle) * 60,
            color: '#00ff00',
            size: 4,
            lifetime: 0.6,
            fadeOut: true
          }));
        }
      }

      // Check wall collision for cyclops
      enemy.checkWallCollision(this.canvas.width, this.canvas.height);

      // Enemy-player collision
      if (enemy.collidesWith(this.player.x, this.player.y, this.player.radius)) {
        const damaged = this.player.takeDamage(enemy.typeData.damage);
        if (damaged) {
          this.renderer.addScreenShake(0.3);
          this.renderer.addHitFlash(0.5);
          this.particles.push(...spawnHitParticles(this.player.x, this.player.y, 12));
        }
        enemy.dead = true; // Enemy dies on contact
      }
    }

    // Projectiles
    for (const proj of this.projectiles) {
      proj.update(scaledDt, this.canvas.width, this.canvas.height);

      if (proj.fromPlayer) {
        // Player projectile hits enemies
        for (const enemy of this.enemies) {
          if (proj.hasHit(enemy.id)) continue; // Already hit (piercing)

          if (enemy.collidesWith(proj.x, proj.y, proj.radius)) {
            const isCrit = this.player.rollCrit();
            let damage = isCrit ? this.player.getCritDamage(proj.damage) : proj.damage;

            // GAME FEEL: Trigger hit pause on player damage to enemy
            this.hitPauseTimer = isCrit ? 0.08 : 0.05; // Longer pause on crit

            const splits = enemy.takeDamage(damage);
            if (splits && splits.length > 0) {
              this.enemies.push(...splits);
            }
            proj.markHit(enemy.id);

            // GAME FEEL: Enhanced knockback physics
            const knockback = this.playerStats.getKnockback();
            // Golem is immune to knockback
            if (knockback > 0 && enemy.type !== 'golem') {
              const angle = Math.atan2(enemy.y - proj.y, enemy.x - proj.x);
              // Apply knockback as velocity (Enemy.ts will handle decay)
              enemy.applyKnockback(Math.cos(angle) * 300, Math.sin(angle) * 300);
            }

            // Lifesteal
            const lifesteal = this.playerStats.getLifesteal();
            if (lifesteal > 0) {
              this.player.heal(damage * lifesteal);
            }

            this.audio.playHit();
            // GAME FEEL: More particles on every hit
            this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 8));
            this.damageNumbers.push(new DamageNumber(enemy.x, enemy.y - 20, damage, isCrit));
            // GAME FEEL: More shake on all hits
            this.renderer.addScreenShake(isCrit ? 0.25 : 0.15);
            this.renderer.addImpactFlash(enemy.x, enemy.y);

            if (enemy.dead) {
              this.handleEnemyKill(enemy);
            }
          }
        }
      } else {
        // Enemy projectile hits player
        if (this.player.collidesWith(proj.x, proj.y, proj.radius)) {
          const damaged = this.player.takeDamage(proj.damage);
          if (damaged) {
            this.renderer.addScreenShake(0.25);
            this.renderer.addHitFlash(0.4);
            this.particles.push(...spawnHitParticles(this.player.x, this.player.y, 10));
          }
          proj.dead = true;
        }
      }
    }

    // Melee attacks
    for (const melee of this.meleeAttacks) {
      if (!this.player) continue;
      melee.update(scaledDt, this.player.x, this.player.y);

      // Check hits on enemies
      for (const enemy of this.enemies) {
        if (melee.hasHit(enemy.id)) continue; // Already hit

        if (melee.isPointInArc(enemy.x, enemy.y)) {
          const isCrit = this.player.rollCrit();
          let damage = isCrit ? this.player.getCritDamage(melee.damage) : melee.damage;

          // Hit pause
          this.hitPauseTimer = isCrit ? 0.08 : 0.05;

          const splits = enemy.takeDamage(damage);
          if (splits && splits.length > 0) {
            this.enemies.push(...splits);
          }
          melee.markHit(enemy.id);

          // Knockback
          if (melee.knockback > 0 && enemy.type !== 'golem') {
            const angle = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
            enemy.applyKnockback(Math.cos(angle) * melee.knockback, Math.sin(angle) * melee.knockback);
          }

          // Lifesteal
          const lifesteal = this.playerStats.getLifesteal();
          if (lifesteal > 0) {
            this.player.heal(damage * lifesteal);
          }

          this.audio.playHit();
          this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 8));
          this.damageNumbers.push(new DamageNumber(enemy.x, enemy.y - 20, damage, isCrit));
          this.renderer.addScreenShake(isCrit ? 0.25 : 0.15);
          this.renderer.addImpactFlash(enemy.x, enemy.y);

          if (enemy.dead) {
            this.handleEnemyKill(enemy);
          }
        }
      }
    }

    // Particles
    for (const particle of this.particles) {
      particle.update(scaledDt);
    }

    // Damage numbers
    for (const num of this.damageNumbers) {
      num.update(scaledDt);
    }

    // Health orbs
    for (const orb of this.healthOrbs) {
      orb.update(scaledDt);

      // Check pickup collision
      if (orb.collidesWith(this.player.x, this.player.y, this.player.radius)) {
        this.player.heal(orb.healAmount);
        orb.dead = true;
        this.particles.push(...spawnHealthOrbParticles(orb.x, orb.y));
        this.audio.playHit(); // Reuse hit sound for pickup
      }
    }

    // Cleanup dead entities
    this.enemies = this.enemies.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.meleeAttacks = this.meleeAttacks.filter(m => !m.dead);
    this.particles = this.particles.filter(p => !p.dead);
    this.damageNumbers = this.damageNumbers.filter(n => !n.dead);
    this.healthOrbs = this.healthOrbs.filter(o => !o.dead);

    // Check wave completion
    if (this.waveManager.isWaveComplete()) {
      this.enterShop();
    }

    // Check game over
    if (this.player.dead) {
      this.gameOver();
    }

    // Auto-save
    this.autoSave();
  }

  // Dash/Blast abilities removed - keeping method commented for potential future use
  // private handleBlastDamage(damage: number, radius: number): void {
  //   if (!this.player) return;

  //   let hitCount = 0;
  //   for (const enemy of this.enemies) {
  //     const dist = Math.sqrt(
  //       (enemy.x - this.player.x) ** 2 + (enemy.y - this.player.y) ** 2
  //     );

  //     if (dist < radius + enemy.typeData.radius) {
  //       const splits = enemy.takeDamage(damage);
  //       if (splits && splits.length > 0) {
  //         this.enemies.push(...splits);
  //       }
  //       this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 8));
  //       hitCount++;

  //       // GAME FEEL: Knockback enemies hit by blast
  //       const angle = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
  //       enemy.applyKnockback(Math.cos(angle) * 400, Math.sin(angle) * 400);

  //       if (enemy.dead) {
  //         this.handleEnemyKill(enemy);
  //       }
  //     }
  //   }

  //   // GAME FEEL: Extra shake based on how many enemies were hit
  //   if (hitCount > 0) {
  //     this.renderer.addScreenShake(0.3 + Math.min(hitCount * 0.1, 0.5));
  //   }

  //   // Visual effect
  //   this.particles.push(...spawnHitParticles(this.player.x, this.player.y, 30));
  // }

  private handleEnemyKill(enemy: Enemy): void {
    if (!this.player) return;

    this.kills++;

    // Track boss kills
    if (enemy.type === 'demon') {
      this.bossKills++;
      this.renderer.addScreenShake(0.8); // Extreme shake for boss death
    }

    this.audio.playKill();
    this.particles.push(...spawnKillParticles(enemy.x, enemy.y));
    this.particles.push(...spawnXPParticles(enemy.x, enemy.y));

    // GAME FEEL: Enhanced shake on all kills (bigger than just hits)
    const shakeAmount = enemy.type === 'demon' ? 0.8 :
                       (enemy.type === 'troll' || enemy.type === 'golem') ? 0.5 : 0.3;
    this.renderer.addScreenShake(shakeAmount);

    // XP and gold with meta-progression multipliers
    const xpMultiplier = this.metaProgression.getXPGainMultiplier();
    const goldMultiplier = this.metaProgression.getGoldGainMultiplier();

    // Apply modifiers from wave type
    let finalXP = enemy.typeData.xpValue * xpMultiplier;
    let finalGold = enemy.typeData.goldValue * goldMultiplier;

    if (this.waveManager.waveModifier === 'elite') {
      finalGold *= 1.5;
      finalXP *= 1.5;
    } else if (this.waveManager.waveModifier === 'tank') {
      finalGold *= 2;
      finalXP *= 2;
    }

    // Mimic drops 2x gold
    if (enemy.type === 'mimic') {
      finalGold *= 2;
    }

    const leveledUp = this.player.addXP(Math.floor(finalXP));
    this.player.addGold(Math.floor(finalGold));

    if (leveledUp) {
      this.audio.playLevelUp();
      // VAMPIRE SURVIVORS JUICE: Make level-ups feel MASSIVE
      this.renderer.addScreenShake(0.6); // Much bigger shake
      this.renderer.addHitFlash(0.4); // Screen flash
      // Spawn huge particle explosion at player
      this.particles.push(...spawnLevelUpParticles(this.player.x, this.player.y));
    }

    // Mushroom explodes on death
    if (enemy.type === 'mushroom') {
      // Large spore explosion
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 80 + Math.random() * 40;
        this.particles.push(new Particle({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#9b59b6',
          size: 6,
          lifetime: 1.8,
          fadeOut: true
        }));
      }
      // Damage player if close
      const dist = Math.sqrt(
        (this.player.x - enemy.x) ** 2 + (this.player.y - enemy.y) ** 2
      );
      if (dist < 120) {
        const damaged = this.player.takeDamage(enemy.typeData.damage * 0.8);
        if (damaged) {
          this.renderer.addHitFlash(0.4);
        }
      }
    }

    // Health orb drop (18% chance)
    if (Math.random() < 0.18) {
      this.healthOrbs.push(new HealthOrb(enemy.x, enemy.y));
    }

    // Explosion on kill
    if (this.playerStats.hasExplosionOnKill()) {
      const explosionRadius = 80;
      for (const otherEnemy of this.enemies) {
        if (otherEnemy === enemy) continue;

        const dist = Math.sqrt(
          (otherEnemy.x - enemy.x) ** 2 + (otherEnemy.y - enemy.y) ** 2
        );

        if (dist < explosionRadius) {
          otherEnemy.takeDamage(this.playerStats.getDamage() * 2);
          this.particles.push(...spawnHitParticles(otherEnemy.x, otherEnemy.y));
        }
      }
      this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 20));
    }
  }

  private enterShop(): void {
    // BROTATO-INSPIRED: Preserve locked items from previous shop (FREE locking)
    const lockedItems: Item[] = [];
    for (const index of this.lockedShopItems) {
      if (this.shopItems[index]) {
        lockedItems.push(this.shopItems[index]);
      }
    }

    // ADVANCED: 6 shop slots (was 4)
    const shopSlotCount = 6;

    // Generate new items for unlocked slots - BROTATO-WEIGHTED for synergy promotion
    const currentWave = this.waveManager.currentWave;
    const newItems = ItemDatabase.getWeightedShopItems(
      shopSlotCount - lockedItems.length,
      currentWave,
      this.playerStats.items // Pass owned items for weighted generation
    );
    this.shopItems = [];

    // Rebuild shop: locked items first, then new items
    let lockedIndex = 0;
    for (let i = 0; i < shopSlotCount; i++) {
      if (this.lockedShopItems.has(i) && lockedIndex < lockedItems.length) {
        this.shopItems.push(lockedItems[lockedIndex++]);
      } else {
        this.shopItems.push(newItems.shift()!);
      }
    }

    this.selectedShopItem = -1;

    // BROTATO-LEVEL REROLL COST: Wave-scaled formula
    const wave = currentWave;
    const baseRerollCost = Math.floor(wave * 0.75) + 1; // Wave 1: 1g, Wave 5: 5g, etc.

    // Apply item-based reroll discount
    const rerollDiscount = this.playerStats.getRerollDiscount();
    this.shopRerollCost = Math.max(1, Math.floor(baseRerollCost * (1 - rerollDiscount)));

    this.shopRerolls = 0;
    this.itemsPurchasedThisWave = 0; // Reset purchase counter

    this.state = 'shop';
    this.audio.playWaveComplete();

    // Save progress
    this.autoSave();
  }

  private updateShop(): void {
    if (!this.player) return;

    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    // Responsive layout - 6 shop slots
    const isPortrait = this.canvas.width < this.canvas.height;
    const isMobile = this.canvas.width < 800;
    const itemWidth = isPortrait ? Math.min(280, this.canvas.width - 40) : isMobile ? Math.min(360, this.canvas.width - 40) : 180;
    const itemHeight = isPortrait ? 185 : isMobile ? 210 : 140; // Taller for recycle button
    const gap = isPortrait ? 10 : isMobile ? 16 : 18;

    let startX: number, startY: number;

    if (isMobile) {
      // Vertical stack on mobile (6 items)
      startX = (this.canvas.width - itemWidth) / 2;
      startY = isPortrait ? 110 : 145;
    } else {
      // Desktop: 3x2 grid for 6 items
      const gridCols = 3;
      startX = this.canvas.width / 2 - (itemWidth * gridCols + gap * (gridCols - 1)) / 2;
      startY = 180;
    }

    this.selectedShopItem = -1;

    for (let i = 0; i < this.shopItems.length; i++) {
      const item = this.shopItems[i];

      // Skip empty slots (purchased items)
      if (!item) continue;

      // Desktop: 3x2 grid layout
      const gridCol = isMobile ? 0 : i % 3;
      const gridRow = isMobile ? i : Math.floor(i / 3);

      const x = isMobile ? startX : startX + gridCol * (itemWidth + gap);
      const y = isMobile ? startY + i * (itemHeight + gap) : startY + gridRow * (itemHeight + gap);

      // FREE LOCKING: Lock button in top-right corner (NO 5g cost)
      const lockButtonSize = isMobile ? 50 : 28;
      const lockButtonX = x + itemWidth - lockButtonSize - 5;
      const lockButtonY = y + 5;

      // RECYCLING: Recycle button in bottom-left corner
      const recycleButtonSize = isMobile ? 50 : 28;
      const recycleButtonX = x + 5;
      const recycleButtonY = y + itemHeight - recycleButtonSize - 5;

      // Check recycle button (if player owns this item type)
      const ownsItem = this.playerStats.items.some(owned => owned.id === item.id);
      if (ownsItem && pointInRect(mouseX, mouseY, { x: recycleButtonX, y: recycleButtonY, width: recycleButtonSize, height: recycleButtonSize })) {
        if (this.input.mouseDown) {
          // Recycle item: remove from inventory, get 25% gold back (+ recycle bonus)
          const recycleValue = this.playerStats.getRecycleValue(item);
          this.player.gold += recycleValue;
          this.playerStats.removeItem(item.id);

          // Update player stats
          this.player.maxHealth = this.playerStats.getMaxHealth();
          if (this.player.health > this.player.maxHealth) {
            this.player.health = this.player.maxHealth;
          }

          this.audio.playPurchase();
          this.input.mouseDown = false;
        }
      }
      // Check lock button (FREE - no cost)
      else if (pointInRect(mouseX, mouseY, { x: lockButtonX, y: lockButtonY, width: lockButtonSize, height: lockButtonSize })) {
        if (this.input.mouseDown) {
          if (this.lockedShopItems.has(i)) {
            // Unlock (free)
            this.lockedShopItems.delete(i);
          } else {
            // Lock (FREE in Brotato-level shop)
            this.lockedShopItems.add(i);
          }
          this.audio.playPurchase();
          this.input.mouseDown = false;
        }
      }
      // Check item purchase
      else if (pointInRect(mouseX, mouseY, { x, y, width: itemWidth, height: itemHeight })) {
        this.selectedShopItem = i;

        if (this.input.mouseDown) {
          // DYNAMIC PRICING: Calculate wave-scaled price with shop discount
          const finalPrice = this.playerStats.getItemPrice(item, this.waveManager.currentWave);

          if (this.player.gold >= finalPrice) {
            this.player.gold -= finalPrice;
            this.playerStats.addItem(item);
            this.itemsPurchasedThisWave++;

            // Update player max health if needed
            if (item.maxHealthBonus) {
              const oldMax = this.player.maxHealth;
              this.player.maxHealth = this.playerStats.getMaxHealth();
              const healthPercent = this.player.health / oldMax;
              this.player.health = this.player.maxHealth * healthPercent;
            }

            // Add shield
            if (item.shield) {
              this.player.shield = true;
            }

            // Clear lock on purchased item
            this.lockedShopItems.delete(i);

            // BUG FIX: Mark slot as empty (null) instead of removing to preserve indices
            // Reroll will refill these empty slots
            this.shopItems[i] = null as any; // Temporarily null, reroll fills it

            this.audio.playPurchase();
            this.input.mouseDown = false;
          }
        }
      }
    }

    // Button positioning
    const buttonWidth = isMobile ? 320 : 200;
    const buttonHeight = isMobile ? 70 : 50;
    const buttonSpacing = 14;

    // Calculate button Y positions - ensure they fit on screen
    const gridRows = isMobile ? this.shopItems.length : 2; // Desktop: 2 rows for 6 items
    const itemsEndY = isMobile ? startY + this.shopItems.length * (itemHeight + gap) : startY + gridRows * (itemHeight + gap);
    const continueY = isMobile ? Math.min(itemsEndY + 15, this.canvas.height - buttonHeight * 2 - buttonSpacing - 20) : itemsEndY + 25;
    const rerollY = continueY + buttonHeight + buttonSpacing;

    // Continue button (Next Wave)
    const continueBtn = {
      x: this.canvas.width / 2 - buttonWidth / 2,
      y: continueY,
      width: buttonWidth,
      height: buttonHeight
    };

    if (pointInRect(mouseX, mouseY, continueBtn) && this.input.mouseDown) {
      this.startNextWave();
      this.input.mouseDown = false;
    }

    // ADVANCED REROLL: Free reroll bonus if bought all 6 items
    const freeReroll = this.itemsPurchasedThisWave >= 6;
    const effectiveRerollCost = freeReroll ? 0 : this.shopRerollCost;

    // Reroll button
    const rerollBtn = {
      x: this.canvas.width / 2 - buttonWidth / 2,
      y: rerollY,
      width: buttonWidth,
      height: buttonHeight
    };

    if (pointInRect(mouseX, mouseY, rerollBtn) && this.input.mouseDown) {
      if (this.player.gold >= effectiveRerollCost) {
        this.player.gold -= effectiveRerollCost;

        // BUG FIX: Rebuild shop to full 6 slots (purchased items were removed via splice)
        const shopSlotCount = 6;
        const newShopItems: Item[] = [];

        // Keep locked items in their original positions
        const lockedItems: Map<number, Item> = new Map();
        for (const index of this.lockedShopItems) {
          if (this.shopItems[index]) {
            lockedItems.set(index, this.shopItems[index]);
          }
        }

        // Generate new items for unlocked slots (BROTATO-STYLE WEIGHTED)
        const unlockedSlotCount = shopSlotCount - lockedItems.size;
        const newItems = ItemDatabase.getWeightedShopItems(
          unlockedSlotCount,
          this.waveManager.currentWave,
          this.playerStats.items // Pass owned items for tag weighting
        );

        // Rebuild shop: place locked items at their positions, fill rest with new items
        let newItemIndex = 0;
        for (let i = 0; i < shopSlotCount; i++) {
          if (lockedItems.has(i)) {
            newShopItems.push(lockedItems.get(i)!);
          } else {
            newShopItems.push(newItems[newItemIndex++]);
          }
        }

        this.shopItems = newShopItems;

        // DYNAMIC REROLL COST: Scale per reroll this wave
        const wave = this.waveManager.currentWave;
        const rerollScaling = Math.floor(wave * 0.4); // +0.4g per wave per reroll
        this.shopRerollCost += rerollScaling;

        this.shopRerolls++;
        this.audio.playPurchase();
        this.input.mouseDown = false;
      }
    }
  }

  private startNextWave(): void {
    this.waveManager.startWave(this.waveManager.currentWave + 1);
    this.waveModifierTimer = 3; // Show wave modifier for 3 seconds
    this.state = 'playing';

    // Reset mouse state to prevent accidental clicks
    this.input.mouseDown = false;
  }

  private updatePaused(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    const buttonWidth = 200;
    const buttonHeight = 50;
    const spacing = 20;

    // Resume button
    const resumeBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: 250, width: buttonWidth, height: buttonHeight };
    // Restart button
    const restartBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: 250 + buttonHeight + spacing, width: buttonWidth, height: buttonHeight };
    // Main menu button
    const menuBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: 250 + (buttonHeight + spacing) * 2, width: buttonWidth, height: buttonHeight };

    if (pointInRect(mouseX, mouseY, resumeBtn) && this.input.mouseDown) {
      this.state = 'playing';
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, restartBtn) && this.input.mouseDown) {
      this.startNewGame();
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, menuBtn) && this.input.mouseDown) {
      this.state = 'menu';
      SaveManager.clearRun();
      this.input.mouseDown = false;
    }
  }

  private updateUpgrades(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    const isMobile = this.canvas.width < 800;
    const upgradeWidth = isMobile ? Math.min(350, this.canvas.width - 40) : 320;
    const upgradeHeight = isMobile ? 120 : 100;
    const gap = 15;

    const upgrades = this.metaProgression.getAllUpgrades();
    const startX = (this.canvas.width - upgradeWidth) / 2;
    const startY = 140;

    for (let i = 0; i < upgrades.length; i++) {
      const upgrade = upgrades[i];
      const x = startX;
      const y = startY + i * (upgradeHeight + gap);

      if (pointInRect(mouseX, mouseY, { x, y, width: upgradeWidth, height: upgradeHeight })) {
        if (this.input.mouseDown && this.metaProgression.canPurchaseUpgrade(upgrade.id)) {
          this.metaProgression.purchaseUpgrade(upgrade.id);
          this.audio.playPurchase();
          this.input.mouseDown = false;
        }
      }
    }

    // Back button
    const backBtn = { x: this.canvas.width / 2 - 100, y: this.canvas.height - 80, width: 200, height: 50 };
    if (pointInRect(mouseX, mouseY, backBtn) && this.input.mouseDown) {
      this.state = 'menu';
      this.input.mouseDown = false;
    }
  }

  private updateGameOver(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    const buttonWidth = 200;
    const buttonHeight = 50;
    const spacing = 20;
    const startY = this.canvas.height - 200;

    // Try again button
    const retryBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: startY, width: buttonWidth, height: buttonHeight };
    // Upgrades button
    const upgradesBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: startY + buttonHeight + spacing, width: buttonWidth, height: buttonHeight };
    // Main menu button
    const menuBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: startY + (buttonHeight + spacing) * 2, width: buttonWidth, height: buttonHeight };

    if (pointInRect(mouseX, mouseY, retryBtn) && this.input.mouseDown) {
      this.startNewGame();
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, upgradesBtn) && this.input.mouseDown) {
      this.state = 'upgrades';
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, menuBtn) && this.input.mouseDown) {
      this.state = 'menu';
      this.input.mouseDown = false;
    }
  }

  private gameOver(): void {
    this.state = 'gameover';
    this.audio.playGameOver();

    // Calculate souls earned
    this.soulsEarnedThisRun = MetaProgression.calculateSoulsEarned(
      this.waveManager.currentWave,
      this.bossKills
    );
    this.metaProgression.addSouls(this.soulsEarnedThisRun);

    // Store game over stats
    this.gameOverStats = {
      wavesReached: this.waveManager.currentWave,
      enemiesKilled: this.kills,
      goldEarned: this.player?.gold ?? 0,
      itemsCollected: this.playerStats.items.length,
      soulsEarned: this.soulsEarnedThisRun
    };

    // Update meta stats
    SaveManager.updateMetaAfterRun(this.waveManager.currentWave, this.kills);
    SaveManager.clearRun();
  }

  private autoSave(): void {
    if (!this.player || this.state !== 'playing') return;

    SaveManager.saveRun({
      wave: this.waveManager.currentWave,
      xp: this.player.xp,
      level: this.player.level,
      gold: this.player.gold,
      health: this.player.health,
      items: this.playerStats.items.map(item => item.id)
    });
  }

  draw(): void {
    this.renderer.clear();
    this.renderer.beginFrame();

    switch (this.state) {
      case 'menu':
        this.drawMenu();
        break;
      case 'playing':
        this.drawPlaying();
        break;
      case 'shop':
        this.drawShop();
        break;
      case 'paused':
        this.drawPaused();
        break;
      case 'gameover':
        this.drawGameOver();
        break;
      case 'upgrades':
        this.drawUpgrades();
        break;
    }

    this.renderer.endFrame();
  }

  private drawMenu(): void {
    this.renderer.drawText('ROGUELITE', this.canvas.width / 2, 100, {
      size: 48,
      bold: true,
      align: 'center',
      color: '#00ff00'
    });

    this.renderer.drawText('Controls: WASD or Touch Joystick', this.canvas.width / 2, 200, {
      size: 16,
      align: 'center'
    });

    this.renderer.drawText('Build synergistic items in the shop to survive!', this.canvas.width / 2, 230, {
      size: 16,
      align: 'center'
    });

    // Souls display
    this.renderer.drawText(`Souls: ${this.metaProgression.souls}`, this.canvas.width / 2, 270, {
      size: 24,
      bold: true,
      align: 'center',
      color: '#9370db'
    });

    // Stats
    const stats = SaveManager.getStats();
    this.renderer.drawText(`Highest Wave: ${stats.highestWave}`, this.canvas.width / 2, 320, {
      size: 18,
      align: 'center'
    });

    this.renderer.drawText(`Total Runs: ${stats.totalRuns}`, this.canvas.width / 2, 350, {
      size: 18,
      align: 'center'
    });

    this.renderer.drawText(`Total Kills: ${stats.totalKills}`, this.canvas.width / 2, 380, {
      size: 18,
      align: 'center'
    });
  }

  private drawPlaying(): void {
    if (!this.player) return;

    const ctx = this.renderer.getContext();

    // Draw entities
    for (const particle of this.particles) {
      particle.draw(ctx);
    }

    for (const projectile of this.projectiles) {
      projectile.draw(ctx);
    }

    // Draw melee attacks
    for (const melee of this.meleeAttacks) {
      melee.draw(ctx);
    }

    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }

    for (const orb of this.healthOrbs) {
      orb.draw(ctx);
    }

    this.player.draw(ctx);

    for (const num of this.damageNumbers) {
      num.draw(ctx);
    }

    // Draw joystick
    this.input.drawJoystick(ctx);

    // Draw UI
    this.drawHUD();

    // Draw wave modifier announcement
    if (this.waveModifierTimer > 0 && this.waveManager.waveModifierText) {
      const alpha = Math.min(1, this.waveModifierTimer);
      const ctx = this.renderer.getContext();
      ctx.save();
      ctx.globalAlpha = alpha;

      const modifierColor = this.waveManager.waveModifier === 'horde' ? '#ff6600' :
                           this.waveManager.waveModifier === 'elite' ? '#ff00ff' :
                           this.waveManager.waveModifier === 'speed' ? '#00ffff' :
                           this.waveManager.waveModifier === 'tank' ? '#888888' :
                           this.waveManager.waveModifier === 'chaos' ? '#ff0000' :
                           this.waveManager.isBossWave ? '#ff0000' : '#ffff00';

      this.renderer.drawText(this.waveManager.waveModifierText, this.canvas.width / 2, this.canvas.height / 2 - 50, {
        size: 32,
        bold: true,
        align: 'center',
        color: modifierColor
      });

      ctx.restore();
    }
  }

  private drawHUD(): void {
    if (!this.player) return;

    const ctx = this.renderer.getContext();
    const isMobile = this.canvas.width < this.canvas.height;

    // Mobile-optimized padding and sizing
    const topPadding = isMobile ? 16 : 10;
    const sidePadding = isMobile ? 16 : 10;

    // Larger HUD elements for mobile readability
    const barHeight = isMobile ? 22 : 12;
    const barWidth = isMobile ? Math.min(200, this.canvas.width * 0.45) : 180;

    // Top bar background - larger on mobile
    const hudBgHeight = isMobile ? 90 : 56;
    this.renderer.drawRoundedRect(0, 0, this.canvas.width, hudBgHeight, 0, 'rgba(0, 0, 0, 0.65)');
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, hudBgHeight - 1, this.canvas.width, 1);
    ctx.restore();

    // Health bar - larger icons and text on mobile
    const iconSize = isMobile ? 24 : 14;
    this.renderer.drawText('❤', sidePadding + 2, topPadding, { size: iconSize, bold: true, color: '#ef4444' });
    this.renderer.drawHealthBar(sidePadding + (isMobile ? 30 : 20), topPadding + 1, barWidth, barHeight, this.player.health, this.player.maxHealth);

    const hpValueSize = isMobile ? 16 : 11;
    this.renderer.drawText(`${Math.ceil(this.player.health)}/${this.player.maxHealth}`, sidePadding + (isMobile ? 30 : 20) + barWidth + 6, topPadding + 2, {
      size: hpValueSize,
      bold: true,
      color: '#ffffff'
    });

    // XP bar - directly below health
    const xpOffset = isMobile ? 30 : 20;
    this.renderer.drawText('⭐', sidePadding + 2, topPadding + xpOffset, { size: iconSize, bold: true, color: '#ffd700' });
    this.renderer.drawProgressBar(sidePadding + (isMobile ? 30 : 20), topPadding + xpOffset + 1, barWidth, barHeight, this.player.xp / this.player.xpToNextLevel, '#4ade80');

    const levelSize = isMobile ? 16 : 11;
    this.renderer.drawText(`Lv ${this.player.level}`, sidePadding + (isMobile ? 30 : 20) + barWidth + 6, topPadding + xpOffset + 2, {
      size: levelSize,
      bold: true,
      color: '#ffd700'
    });

    // Gold - compact, below XP
    const goldOffset = isMobile ? 60 : 40;
    const goldSize = isMobile ? 18 : 13;
    this.renderer.drawText(`💰 ${this.player.gold}`, sidePadding + 2, topPadding + goldOffset, {
      size: goldSize,
      bold: true,
      color: '#ffd700'
    });

    // Wave info (top right) - clean, compact
    let waveText = `Wave ${this.waveManager.currentWave}`;
    let waveColor = '#4a9eff';
    let waveIcon = '🌊';

    if (this.waveManager.isBossWave) {
      waveText = `Wave ${this.waveManager.currentWave} BOSS`;
      waveColor = '#ef4444';
      waveIcon = '👹';
    } else if (this.waveManager.isHordeWave) {
      waveText = `Wave ${this.waveManager.currentWave} HORDE`;
      waveColor = '#f97316';
      waveIcon = '⚡';
    }

    const waveSize = isMobile ? 20 : 16;
    this.renderer.drawText(`${waveIcon} ${waveText}`, this.canvas.width - sidePadding, topPadding + 2, {
      size: waveSize,
      bold: true,
      align: 'right',
      color: waveColor
    });

    const enemySize = isMobile ? 16 : 12;
    this.renderer.drawText(`Enemies: ${this.enemies.length + this.waveManager.waveEnemiesRemaining}`, this.canvas.width - sidePadding, topPadding + xpOffset + 2, {
      size: enemySize,
      align: 'right',
      color: '#cccccc'
    });

    // Ability cooldowns - NO LONGER SHOWN IN HUD (buttons handle this)
    // Removed the large ability boxes from bottom-left

    // Shield indicator (center, compact)
    if (this.player.shield) {
      const shieldSize = isMobile ? 18 : 14;
      this.renderer.drawText('🛡️ SHIELD', this.canvas.width / 2, topPadding + goldOffset, {
        size: shieldSize,
        bold: true,
        align: 'center',
        color: '#4a9eff'
      });
    }

    // Weapon specialization (if active, show below wave on right side)
    const specialization = this.playerStats.getWeaponSpecialization();
    if (specialization === 'melee' || specialization === 'ranged') {
      const specSize = isMobile ? 13 : 11;
      const specIcon = specialization === 'melee' ? '⚔️' : '🏹';
      const specColor = specialization === 'melee' ? '#ff6600' : '#00ffff';
      this.renderer.drawText(`${specIcon} ${specialization.toUpperCase()} +20%`, this.canvas.width - sidePadding, topPadding + goldOffset, {
        size: specSize,
        bold: true,
        align: 'right',
        color: specColor
      });
    }
  }

  private drawShop(): void {
    const isPortrait = this.canvas.width < this.canvas.height;
    const isMobile = this.canvas.width < 800;
    const ctx = this.renderer.getContext();

    // Shop title with fancy styling
    this.renderer.drawText('SHOP', this.canvas.width / 2, isMobile ? 20 : 40, {
      size: isMobile ? 48 : 40,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    if (!this.player) return;

    // Gold display with icon
    this.renderer.drawText(`💰 ${this.player.gold}`, this.canvas.width / 2, isMobile ? 55 : 75, {
      size: isMobile ? 24 : 20,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    // PLAYER STATS PANEL - compact display on the left side (desktop) or top (mobile)
    const statPanelPadding = 8;
    const statPanelWidth = isMobile ? this.canvas.width - 20 : 220;
    const statPanelHeight = isMobile ? 65 : 140;
    const statPanelX = isMobile ? 10 : 10;
    const statPanelY = isMobile ? 85 : 40;

    // Stats panel background
    ctx.save();
    const statGradient = ctx.createLinearGradient(statPanelX, statPanelY, statPanelX, statPanelY + statPanelHeight);
    statGradient.addColorStop(0, 'rgba(40, 40, 40, 0.9)');
    statGradient.addColorStop(1, 'rgba(20, 20, 20, 0.9)');
    this.renderer.drawRoundedRect(statPanelX, statPanelY, statPanelWidth, statPanelHeight, 6, statGradient);
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    this.renderer['drawRoundedRectPath'](statPanelX, statPanelY, statPanelWidth, statPanelHeight, 6);
    ctx.stroke();
    ctx.restore();

    // Stats content - larger on mobile for readability
    const statSize = isMobile ? 16 : 13; // BALANCE: Increased from 14 to 16 for mobile readability
    const statLineHeight = isMobile ? 22 : 18; // Increased spacing for larger text
    const statStartY = statPanelY + statPanelPadding + statLineHeight;

    if (isMobile) {
      // Mobile: horizontal layout, 2 rows
      const col1X = statPanelX + statPanelPadding;
      const col2X = statPanelX + statPanelWidth / 3 + statPanelPadding;
      const col3X = statPanelX + (statPanelWidth * 2 / 3) + statPanelPadding;

      this.renderer.drawText(`❤️${Math.floor(this.player.health)}/${this.playerStats.getMaxHealth()}`, col1X, statStartY, {
        size: statSize, color: '#ff6b6b', align: 'left'
      });
      this.renderer.drawText(`⚔️${Math.floor(this.playerStats.getDamage())}`, col2X, statStartY, {
        size: statSize, color: '#ffa500', align: 'left'
      });
      this.renderer.drawText(`🔥${this.playerStats.getFireRate().toFixed(1)}/s`, col3X, statStartY, {
        size: statSize, color: '#ff4444', align: 'left'
      });

      this.renderer.drawText(`💨${Math.floor(this.playerStats.getSpeed())}`, col1X, statStartY + statLineHeight, {
        size: statSize, color: '#88ffff', align: 'left'
      });
      this.renderer.drawText(`💥${Math.floor(this.playerStats.getCritChance() * 100)}%`, col2X, statStartY + statLineHeight, {
        size: statSize, color: '#ffff00', align: 'left'
      });
      this.renderer.drawText(`🎯${this.playerStats.getMultishot()}x`, col3X, statStartY + statLineHeight, {
        size: statSize, color: '#00ff00', align: 'left'
      });
    } else {
      // Desktop: vertical layout
      const statX = statPanelX + statPanelPadding;
      let currentY = statStartY;

      this.renderer.drawText(`❤️ HP: ${Math.floor(this.player.health)}/${this.playerStats.getMaxHealth()}`, statX, currentY, {
        size: statSize, color: '#ff6b6b', align: 'left'
      });
      currentY += statLineHeight;

      this.renderer.drawText(`⚔️ DMG: ${Math.floor(this.playerStats.getDamage())}`, statX, currentY, {
        size: statSize, color: '#ffa500', align: 'left'
      });
      currentY += statLineHeight;

      this.renderer.drawText(`🔥 Fire: ${this.playerStats.getFireRate().toFixed(1)}/s`, statX, currentY, {
        size: statSize, color: '#ff4444', align: 'left'
      });
      currentY += statLineHeight;

      this.renderer.drawText(`💨 Speed: ${Math.floor(this.playerStats.getSpeed())}`, statX, currentY, {
        size: statSize, color: '#88ffff', align: 'left'
      });
      currentY += statLineHeight;

      this.renderer.drawText(`💥 Crit: ${Math.floor(this.playerStats.getCritChance() * 100)}%`, statX, currentY, {
        size: statSize, color: '#ffff00', align: 'left'
      });
      currentY += statLineHeight;

      this.renderer.drawText(`🎯 Multi: ${this.playerStats.getMultishot()}`, statX, currentY, {
        size: statSize, color: '#00ff00', align: 'left'
      });
    }

    // INVENTORY PANEL - show current items as tiny icons on the right side (desktop) or below stats (mobile)
    const invPanelPadding = 6;
    const invPanelWidth = isMobile ? this.canvas.width - 20 : 220;
    const invPanelMaxHeight = isMobile ? 80 : 200;
    const invPanelX = isMobile ? 10 : this.canvas.width - 230;
    const invPanelY = isMobile ? 155 : 40;

    if (this.playerStats.items.length > 0) {
      // Calculate actual height based on items
      const iconSize = isMobile ? 28 : 24;
      const iconsPerRow = isMobile ? Math.floor((invPanelWidth - invPanelPadding * 2) / (iconSize + 4)) : 6;
      const rows = Math.ceil(this.playerStats.items.length / iconsPerRow);
      const invPanelHeight = Math.min(invPanelMaxHeight, rows * (iconSize + 4) + invPanelPadding * 2 + 18);

      // Inventory panel background
      ctx.save();
      const invGradient = ctx.createLinearGradient(invPanelX, invPanelY, invPanelX, invPanelY + invPanelHeight);
      invGradient.addColorStop(0, 'rgba(40, 40, 40, 0.9)');
      invGradient.addColorStop(1, 'rgba(20, 20, 20, 0.9)');
      this.renderer.drawRoundedRect(invPanelX, invPanelY, invPanelWidth, invPanelHeight, 6, invGradient);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      this.renderer['drawRoundedRectPath'](invPanelX, invPanelY, invPanelWidth, invPanelHeight, 6);
      ctx.stroke();
      ctx.restore();

      // Title
      this.renderer.drawText('Inventory', invPanelX + invPanelWidth / 2, invPanelY + 12, {
        size: isMobile ? 14 : 11,
        bold: true,
        align: 'center',
        color: '#a855f7'
      });

      // Draw item icons in grid
      const gridStartX = invPanelX + invPanelPadding;
      const gridStartY = invPanelY + 22;

      for (let i = 0; i < this.playerStats.items.length; i++) {
        const item = this.playerStats.items[i];
        const col = i % iconsPerRow;
        const row = Math.floor(i / iconsPerRow);
        const x = gridStartX + col * (iconSize + 4);
        const y = gridStartY + row * (iconSize + 4);

        // Item icon
        this.renderer.drawText(item.icon, x + iconSize / 2, y + 2, {
          size: isMobile ? 20 : 18,
          align: 'center'
        });
      }
    }

    // Draw shop items - responsive layout (MUST MATCH updateShop positions)
    const itemWidth = isPortrait ? Math.min(280, this.canvas.width - 40) : isMobile ? Math.min(360, this.canvas.width - 40) : 180;
    const itemHeight = isPortrait ? 185 : isMobile ? 210 : 140;
    const gap = isPortrait ? 10 : isMobile ? 16 : 18;

    let startX: number, startY: number;

    if (isMobile) {
      // Vertical stack on mobile - adjust for stats/inventory panels
      startX = (this.canvas.width - itemWidth) / 2;
      startY = isPortrait ? 245 : 145; // Adjusted to account for stats and inventory panels
    } else {
      // Desktop: 3x2 grid for 6 items
      const gridCols = 3;
      startX = this.canvas.width / 2 - (itemWidth * gridCols + gap * (gridCols - 1)) / 2;
      startY = 200;
    }

    for (let i = 0; i < this.shopItems.length; i++) {
      const item = this.shopItems[i];

      // Skip empty slots (purchased items)
      if (!item) continue;

      // Desktop: 3x2 grid layout
      const gridCol = isMobile ? 0 : i % 3;
      const gridRow = isMobile ? i : Math.floor(i / 3);

      const x = isMobile ? startX : startX + gridCol * (itemWidth + gap);
      const y = isMobile ? startY + i * (itemHeight + gap) : startY + gridRow * (itemHeight + gap);
      const hovered = this.selectedShopItem === i;

      // Rarity colors with better palette
      const rarityColors: Record<string, string> = {
        common: '#888888',
        rare: '#4a9eff',
        epic: '#a855f7',
        legendary: '#ffd700'
      };
      const rarityColor = rarityColors[item.rarity] ?? '#ffffff';

      // BROTATO-INSPIRED: Enhanced synergy detection
      const hasSynergy = this.playerStats.hasSynergyWith(item);
      const ownedTags = [...new Set(this.playerStats.items.flatMap(i => i.tags))];
      const matchingTags = item.tags.filter(tag => ownedTags.includes(tag));
      const hasTagMatch = matchingTags.length > 0;
      const isDuplicate = this.playerStats.items.some(owned => owned.id === item.id);

      // Card shadow/glow effect - different colors for different synergy types
      const cardRadius = 6; // Rounded corners for cards
      if (hovered || hasSynergy || hasTagMatch) {
        ctx.save();
        let glowColor = rarityColor;
        let glowIntensity = 20;

        if (isDuplicate) {
          // Same exact item = blue glow
          glowColor = '#0088ff';
          glowIntensity = 25;
        } else if (hasTagMatch) {
          // Tag match = green synergy glow
          glowColor = '#00ff00';
          glowIntensity = 30;
        } else if (hasSynergy) {
          // Other synergy = yellow glow
          glowColor = '#ffff00';
          glowIntensity = 25;
        }

        ctx.shadowBlur = hovered ? glowIntensity + 5 : glowIntensity;
        ctx.shadowColor = glowColor;
        this.renderer.drawRoundedRect(x - 2, y - 2, itemWidth + 4, itemHeight + 4, cardRadius + 2, '#2a2a2a');
        ctx.restore();
      }

      // Background with gradient - rounded
      const gradient = ctx.createLinearGradient(x, y, x, y + itemHeight);
      gradient.addColorStop(0, hovered ? '#3a3a3a' : '#222222');
      gradient.addColorStop(1, hovered ? '#2a2a2a' : '#1a1a1a');
      ctx.fillStyle = gradient;
      this.renderer.drawRoundedRect(x, y, itemWidth, itemHeight, cardRadius, gradient);

      // Border with rarity color (thicker for better visibility) - rounded
      ctx.strokeStyle = rarityColor;
      ctx.lineWidth = hovered ? 5 : 4;
      this.renderer['drawRoundedRectPath'](x, y, itemWidth, itemHeight, cardRadius);
      ctx.stroke();

      // Inner shadow for depth - rounded
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      this.renderer['drawRoundedRectPath'](x + 2, y + 2, itemWidth - 4, itemHeight - 4, Math.max(0, cardRadius - 2));
      ctx.stroke();

      // Lock button in top-right corner
      const lockButtonSize = isMobile ? 50 : 28;
      const lockButtonX = x + itemWidth - lockButtonSize - 5;
      const lockButtonY = y + 5;
      const isLocked = this.lockedShopItems.has(i);
      const lockRadius = 6;

      // Lock button background - rounded
      ctx.save();
      this.renderer.drawRoundedRect(lockButtonX, lockButtonY, lockButtonSize, lockButtonSize, lockRadius, isLocked ? '#ffd700' : '#2a2a2a');
      ctx.strokeStyle = isLocked ? '#ffff00' : '#666666';
      ctx.lineWidth = 2;
      this.renderer['drawRoundedRectPath'](lockButtonX, lockButtonY, lockButtonSize, lockButtonSize, lockRadius);
      ctx.stroke();
      ctx.restore();

      // Lock icon
      this.renderer.drawText(isLocked ? '🔒' : '🔓', lockButtonX + lockButtonSize / 2, lockButtonY + (isMobile ? 8 : 2), {
        size: isMobile ? 32 : 20,
        align: 'center'
      });

      // Recycle button in bottom-left corner (if player owns this item)
      const ownsItem = this.playerStats.items.some(owned => owned.id === item.id);
      if (ownsItem) {
        const recycleButtonSize = isMobile ? 50 : 28;
        const recycleButtonX = x + 5;
        const recycleButtonY = y + itemHeight - recycleButtonSize - 5;

        // Recycle button background
        ctx.save();
        this.renderer.drawRoundedRect(recycleButtonX, recycleButtonY, recycleButtonSize, recycleButtonSize, lockRadius, '#2a2a2a');
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        this.renderer['drawRoundedRectPath'](recycleButtonX, recycleButtonY, recycleButtonSize, recycleButtonSize, lockRadius);
        ctx.stroke();
        ctx.restore();

        // Recycle icon
        this.renderer.drawText('♻️', recycleButtonX + recycleButtonSize / 2, recycleButtonY + (isMobile ? 8 : 2), {
          size: isMobile ? 28 : 18,
          align: 'center'
        });
      }

      // BROTATO-INSPIRED: Enhanced synergy indicator showing type
      if (isDuplicate || hasTagMatch || hasSynergy) {
        let indicatorText = '';
        let indicatorColor = '#00ff00';

        if (isDuplicate) {
          indicatorText = '🔄 DUPLICATE';
          indicatorColor = '#0088ff';
        } else if (hasTagMatch) {
          // Show which tags match
          const tagIcons: Record<ItemTag, string> = {
            melee: '⚔️',
            ranged: '🏹',
            defensive: '🛡️',
            economic: '💰',
            elemental: '🔥',
            utility: '🔧'
          };
          const matchIcons = matchingTags.map(t => tagIcons[t] || '⚡').join('');
          indicatorText = `${matchIcons} SYNERGY`;
          indicatorColor = '#00ff00';
        } else if (hasSynergy) {
          indicatorText = '⚡ SYNERGY';
          indicatorColor = '#ffff00';
        }

        this.renderer.drawText(indicatorText, x + itemWidth / 2, y + 8, {
          size: isPortrait ? 13 : isMobile ? 18 : 12,
          bold: true,
          align: 'center',
          color: indicatorColor
        });
      }

      // Icon with better positioning
      this.renderer.drawText(item.icon, x + itemWidth / 2, y + (isPortrait ? 25 : isMobile ? 20 : 15), {
        size: isPortrait ? 44 : isMobile ? 68 : 32, // Reduced from 48 to 44 for portrait
        align: 'center'
      });

      // Name with better contrast
      this.renderer.drawText(item.name, x + itemWidth / 2, y + (isPortrait ? 80 : isMobile ? 95 : 55), {
        size: isPortrait ? 18 : isMobile ? 26 : 16, // Reduced from 20 to 18
        bold: true,
        align: 'center',
        color: rarityColor
      });

      // Description (more compact)
      this.renderer.drawText(item.description, x + itemWidth / 2, y + (isPortrait ? 105 : isMobile ? 125 : 75), {
        size: isPortrait ? 13 : isMobile ? 20 : 12, // Reduced from 14 to 13
        align: 'center',
        color: '#cccccc'
      });

      // Cost with better styling (bottom, prominent)
      const finalPrice = this.playerStats.getItemPrice(item, this.waveManager.currentWave);
      const canAfford = this.player.gold >= finalPrice;
      this.renderer.drawText(`💰 ${finalPrice}`, x + itemWidth / 2, y + (isPortrait ? 160 : isMobile ? 180 : 115), {
        size: isPortrait ? 20 : isMobile ? 28 : 16,
        bold: true,
        align: 'center',
        color: canAfford ? '#ffd700' : '#ef4444'
      });
    }

    // Button dimensions and positioning - MUST MATCH updateShop
    const buttonWidth = isMobile ? 320 : 200;
    const buttonHeight = isMobile ? 70 : 50;
    const buttonSpacing = 14;

    // Calculate button Y positions - ensure they fit on screen
    const gridRows = isMobile ? this.shopItems.length : 2; // Desktop: 2 rows for 6 items
    const itemsEndY = isMobile ? startY + this.shopItems.length * (itemHeight + gap) : startY + gridRows * (itemHeight + gap);
    const continueY = isMobile ? Math.min(itemsEndY + 15, this.canvas.height - buttonHeight * 2 - buttonSpacing - 20) : itemsEndY + 25;
    const rerollY = continueY + buttonHeight + buttonSpacing;

    // Continue button (Next Wave) - ALWAYS FIRST
    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      continueY,
      buttonWidth,
      buttonHeight,
      'Next Wave',
      false,
      true,
      isMobile
    );

    // Reroll button - ALWAYS SECOND (below continue)
    const freeReroll = this.itemsPurchasedThisWave >= 6;
    const effectiveRerollCost = freeReroll ? 0 : this.shopRerollCost;
    const canAffordReroll = this.player.gold >= effectiveRerollCost;
    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      rerollY,
      buttonWidth,
      buttonHeight,
      freeReroll ? 'Reroll (FREE)' : `Reroll (${this.shopRerollCost}g)`,
      false,
      canAffordReroll,
      isMobile
    );
  }

  private drawPaused(): void {
    const ctx = this.renderer.getContext();
    const isMobile = this.canvas.width < 800;

    // Dim background with stronger overlay
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Pause menu panel
    const panelWidth = isMobile ? Math.min(400, this.canvas.width - 40) : 500;
    const panelHeight = isMobile ? 450 : 400;
    const panelX = (this.canvas.width - panelWidth) / 2;
    const panelY = (this.canvas.height - panelHeight) / 2;

    // Panel background with gradient
    const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    gradient.addColorStop(0, '#2a2a2a');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Panel border
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 4;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Inner border for depth
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);

    // Title
    this.renderer.drawText('⏸ PAUSED', this.canvas.width / 2, panelY + 60, {
      size: isMobile ? 56 : 64,
      bold: true,
      align: 'center',
      color: '#4a9eff'
    });

    const buttonWidth = isMobile ? Math.min(300, panelWidth - 40) : 280;
    const buttonHeight = isMobile ? 70 : 60;
    const spacing = 20;
    const startY = panelY + 150;

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY,
      buttonWidth,
      buttonHeight,
      'Resume',
      false,
      true,
      isMobile
    );

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY + buttonHeight + spacing,
      buttonWidth,
      buttonHeight,
      'Restart Run',
      false,
      true,
      isMobile
    );

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY + (buttonHeight + spacing) * 2,
      buttonWidth,
      buttonHeight,
      'Main Menu',
      false,
      true,
      isMobile
    );
  }

  private drawUpgrades(): void {
    this.renderer.drawText('PERMANENT UPGRADES', this.canvas.width / 2, 50, {
      size: 36,
      bold: true,
      align: 'center',
      color: '#9370db'
    });

    this.renderer.drawText(`Souls: ${this.metaProgression.souls}`, this.canvas.width / 2, 100, {
      size: 24,
      bold: true,
      align: 'center',
      color: '#ffff00'
    });

    const isMobile = this.canvas.width < 800;
    const upgradeWidth = isMobile ? Math.min(350, this.canvas.width - 40) : 320;
    const upgradeHeight = isMobile ? 120 : 100;
    const gap = 15;

    const upgrades = this.metaProgression.getAllUpgrades();
    const startX = (this.canvas.width - upgradeWidth) / 2;
    const startY = 140;

    const ctx = this.renderer.getContext();

    for (let i = 0; i < upgrades.length; i++) {
      const upgrade = upgrades[i];
      const x = startX;
      const y = startY + i * (upgradeHeight + gap);

      const isMaxLevel = upgrade.currentLevel >= upgrade.maxLevel;
      const canAfford = this.metaProgression.canPurchaseUpgrade(upgrade.id);

      // Background
      ctx.fillStyle = canAfford ? '#2d4a2d' : isMaxLevel ? '#4a4a2d' : '#2a2a2a';
      ctx.fillRect(x, y, upgradeWidth, upgradeHeight);

      // Border
      ctx.strokeStyle = isMaxLevel ? '#ffff00' : canAfford ? '#00ff00' : '#666666';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, upgradeWidth, upgradeHeight);

      // Icon
      this.renderer.drawText(upgrade.icon, x + 20, y + 20, {
        size: 32
      });

      // Name
      this.renderer.drawText(upgrade.name, x + 70, y + 20, {
        size: 16,
        bold: true
      });

      // Level
      this.renderer.drawText(`[${upgrade.currentLevel}/${upgrade.maxLevel}]`, x + upgradeWidth - 60, y + 20, {
        size: 14,
        color: isMaxLevel ? '#ffff00' : '#ffffff'
      });

      // Description
      this.renderer.drawText(upgrade.description, x + 70, y + 45, {
        size: 12,
        color: '#aaaaaa'
      });

      // Cost
      if (!isMaxLevel) {
        const cost = upgrade.costs[upgrade.currentLevel];
        this.renderer.drawText(`Cost: ${cost} souls`, x + 70, y + 70, {
          size: 14,
          bold: true,
          color: canAfford ? '#00ff00' : '#ff0000'
        });
      } else {
        this.renderer.drawText('MAX LEVEL', x + 70, y + 70, {
          size: 14,
          bold: true,
          color: '#ffff00'
        });
      }
    }

    // Back button
    this.renderer.drawButton(
      this.canvas.width / 2 - 100,
      this.canvas.height - 80,
      200,
      50,
      'Back to Menu',
      false
    );
  }

  private drawGameOver(): void {
    const ctx = this.renderer.getContext();
    const isMobile = this.canvas.width < 800;

    // Dramatic dark overlay
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Title with pulsing effect
    const pulseScale = 1 + Math.sin(Date.now() / 300) * 0.05;
    ctx.save();
    ctx.translate(this.canvas.width / 2, isMobile ? 60 : 80);
    ctx.scale(pulseScale, pulseScale);
    this.renderer.drawText('💀 GAME OVER', 0, 0, {
      size: isMobile ? 56 : 72,
      bold: true,
      align: 'center',
      color: '#ef4444'
    });
    ctx.restore();

    // Stats panel
    const panelWidth = isMobile ? Math.min(380, this.canvas.width - 40) : 500;
    const panelHeight = isMobile ? 380 : 320;
    const panelX = (this.canvas.width - panelWidth) / 2;
    const panelY = isMobile ? 140 : 170;

    // Panel background with gradient
    const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    gradient.addColorStop(0, '#2a2a2a');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Panel border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);

    // Stats with icons
    const statsY = panelY + 50;
    const lineSpacing = isMobile ? 45 : 40;
    const statSize = isMobile ? 24 : 22;

    this.renderer.drawText(`🌊 Wave: ${this.gameOverStats.wavesReached}`, this.canvas.width / 2, statsY, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#4a9eff'
    });

    this.renderer.drawText(`⚔️ Kills: ${this.gameOverStats.enemiesKilled}`, this.canvas.width / 2, statsY + lineSpacing, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ef4444'
    });

    this.renderer.drawText(`💰 Gold: ${this.gameOverStats.goldEarned}`, this.canvas.width / 2, statsY + lineSpacing * 2, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    this.renderer.drawText(`🎁 Items: ${this.gameOverStats.itemsCollected}`, this.canvas.width / 2, statsY + lineSpacing * 3, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#a855f7'
    });

    // Souls earned (highlighted prominently)
    const soulsY = statsY + lineSpacing * 4 + 20;
    ctx.save();
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#9370db';
    this.renderer.drawText(`✨ Souls Earned: ${this.gameOverStats.soulsEarned} ✨`, this.canvas.width / 2, soulsY, {
      size: isMobile ? 32 : 36,
      bold: true,
      align: 'center',
      color: '#c084fc'
    });
    ctx.restore();

    // Buttons
    const buttonWidth = isMobile ? Math.min(300, this.canvas.width - 60) : 260;
    const buttonHeight = isMobile ? 70 : 60;
    const spacing = 18;
    const startY = this.canvas.height - (isMobile ? 240 : 220);

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY,
      buttonWidth,
      buttonHeight,
      'Try Again',
      false,
      true,
      isMobile
    );

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY + buttonHeight + spacing,
      buttonWidth,
      buttonHeight,
      'View Upgrades',
      false,
      true,
      isMobile
    );

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY + (buttonHeight + spacing) * 2,
      buttonWidth,
      buttonHeight,
      'Main Menu',
      false,
      true,
      isMobile
    );
  }
}
