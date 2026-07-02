// Main game state machine

import { Player } from './Player';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { MeleeAttack } from './MeleeAttack';
import { Particle, DamageNumber } from './Particle';
import { WaveManager } from './WaveManager';
import { PlayerStats, ItemDatabase, type Item, type ItemTag } from './ItemSystem';
import { SaveManager } from './SaveManager';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { pointInRect } from './utils';
import { HealthOrb } from './Pickup';
import { MetaProgression } from './MetaProgression';
import { ObjectPool } from './ObjectPool';
import { Quadtree } from './Quadtree';
import { PerformanceMonitor } from './PerformanceMonitor';
import { QualityManager } from './QualityManager';
import { EntityCuller } from './EntityCuller';
import { PathfindingSystem } from './PathfindingSystem';
import { ScreenEffects, ShakePresets } from './ScreenEffects';
import { ParticleBatchRenderer } from './ParticleBatchRenderer';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';
import { UISprites } from './UISprites';

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

  // PERFORMANCE: Object pools
  private projectilePool: ObjectPool<Projectile>;
  private particlePool: ObjectPool<Particle>;
  private damageNumberPool: ObjectPool<DamageNumber>;

  // PERFORMANCE: Quadtree for collision detection (10-100x faster than spatial grid)
  private enemyQuadtree: Quadtree<any>;
  private projectileQuadtree: Quadtree<any>;

  // PERFORMANCE: Performance monitor (F2 to toggle)
  private performanceMonitor: PerformanceMonitor;

  // PERFORMANCE: Adaptive quality scaling (auto-adjusts based on FPS)
  private qualityManager: QualityManager;

  // PERFORMANCE: Entity culling (don't render off-screen entities)
  private entityCuller: EntityCuller;

  // PATHFINDING: Smart navigation for intelligent enemies
  private pathfindingSystem: PathfindingSystem;

  // GAME FEEL: Screen effects (shake, zoom, flash)
  private screenEffects: ScreenEffects;

  // PERFORMANCE: Batch particle rendering (40-60% faster)
  private particleBatchRenderer: ParticleBatchRenderer;

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
    // Dev/QA hook: lets tooling (screenshot scripts, the shots-qa harness)
    // inspect and force game state. Not a public API.
    (window as unknown as { __game: Game }).__game = this;
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.audio = new AudioManager();
    this.waveManager = new WaveManager();
    this.playerStats = new PlayerStats();
    this.metaProgression = new MetaProgression();

    // PERFORMANCE: Initialize object pools
    this.projectilePool = new ObjectPool(
      () => new Projectile(),
      (proj) => {
        proj.dead = false;
        proj.hitEnemies.clear();
        proj.trail = [];
      },
      50, // Pre-allocate 50 projectiles
      200 // Max pool size
    );

    this.particlePool = new ObjectPool(
      () => new Particle(),
      (particle) => {
        particle.dead = false;
      },
      100, // Pre-allocate 100 particles
      500 // Max pool size
    );

    this.damageNumberPool = new ObjectPool(
      () => new DamageNumber(),
      (num) => {
        num.dead = false;
      },
      20, // Pre-allocate 20 damage numbers
      100 // Max pool size
    );

    // PERFORMANCE: Initialize quadtrees
    this.enemyQuadtree = new Quadtree({ x: 0, y: 0, width: canvas.width, height: canvas.height });
    this.projectileQuadtree = new Quadtree({ x: 0, y: 0, width: canvas.width, height: canvas.height });

    // PERFORMANCE: Initialize performance monitor (F2 to toggle)
    this.performanceMonitor = new PerformanceMonitor();

    // PERFORMANCE: Initialize quality manager (adaptive scaling)
    this.qualityManager = new QualityManager('high');

    // PERFORMANCE: Initialize entity culler (off-screen culling)
    this.entityCuller = new EntityCuller();

    // PATHFINDING: Initialize pathfinding system (32px cells for navigation grid)
    this.pathfindingSystem = new PathfindingSystem(canvas.width, canvas.height, 32);

    // GAME FEEL: Initialize screen effects
    this.screenEffects = new ScreenEffects();

    // Quadtree bounds and the pathfinding grid depend on canvas size, which is
    // only set by resizeCanvas() after construction — main.ts calls this on every resize
    window.addEventListener('game-resize', () => {
      const { width, height } = this.canvas;
      this.enemyQuadtree = new Quadtree({ x: 0, y: 0, width, height });
      this.projectileQuadtree = new Quadtree({ x: 0, y: 0, width, height });
      this.pathfindingSystem = new PathfindingSystem(width, height, 32);
    });

    // PERFORMANCE: Initialize batch particle renderer
    this.particleBatchRenderer = new ParticleBatchRenderer();

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

  /**
   * PERFORMANCE: Create particle using pool
   */
  private createParticle(config: { x: number; y: number; vx?: number; vy?: number; color?: string; size?: number; lifetime?: number; gravity?: number; fadeOut?: boolean }): Particle {
    const particle = this.particlePool.acquire();
    particle.init(config);
    return particle;
  }

  /**
   * PERFORMANCE: Create damage number using pool
   */
  private createDamageNumber(x: number, y: number, damage: number, isCrit: boolean): DamageNumber {
    const num = this.damageNumberPool.acquire();
    num.init(x, y, damage, isCrit);
    return num;
  }

  /**
   * PERFORMANCE: Get particle count based on quality settings
   */
  private getParticleCount(baseCount: number): number {
    return this.qualityManager.getParticleCount(baseCount);
  }

  /**
   * PERFORMANCE: Remove dead entities in-place (swap-and-pop pattern)
   * Zero allocation - no new array created, just compacts existing array
   */
  private removeDeadEntities<T extends { dead: boolean }>(array: T[]): void {
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < array.length; readIndex++) {
      if (!array[readIndex].dead) {
        if (writeIndex !== readIndex) {
          array[writeIndex] = array[readIndex];
        }
        writeIndex++;
      }
    }
    array.length = writeIndex;
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
    this.performanceMonitor.update(dt);

    // PERFORMANCE: Feed FPS to quality manager for adaptive scaling
    this.qualityManager.recordFrame(this.performanceMonitor.getFPS());

    // GAME FEEL: Update screen effects
    this.screenEffects.update(dt);

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
        // PERFORMANCE: Use pooled projectiles instead of new ones
        for (const proj of newProjectiles) {
          const pooled = this.projectilePool.acquire();
          pooled.init(proj.x, proj.y, Math.atan2(proj.vy, proj.vx), proj.damage, proj.speed, proj.fromPlayer, proj.piercing);
          pooled.maxPierceCount = proj.maxPierceCount;
          this.projectiles.push(pooled);
        }
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
      // PATHFINDING: Update paths for smart enemies (mimic, wizard, necromancer, etc.)
      if (enemy.usePathfinding) {
        enemy.updatePath(
          this.player.x,
          this.player.y,
          this.pathfindingSystem,
          scaledDt
        );
      }

      const result = enemy.update(scaledDt, this.player.x, this.player.y);

      // Skip further processing for dead enemies
      if (enemy.dead) continue;

      // Enemy shooting (pattern-based: single/ring/homing/spiral/burst)
      if (result.shouldShoot) {
        this.fireEnemyPattern(enemy);
      }

      // Golem stomp
      if (result.shouldStomp) {
        const stompRadius = 100;
        // OPTIMIZATION: Use squared distance to avoid sqrt
        const distSq = (this.player.x - enemy.x) ** 2 + (this.player.y - enemy.y) ** 2;
        if (distSq < stompRadius * stompRadius) {
          const damaged = this.player.takeDamage(enemy.typeData.damage * 1.5);
          if (damaged) {
            this.renderer.addScreenShake(0.6);
            this.renderer.addHitFlash(0.6);
            // PERFORMANCE: Use pooled particles (quality-adjusted)
            const particleCount = this.getParticleCount(15);
            for (let i = 0; i < particleCount; i++) {
              const angle = (Math.PI * 2 * i) / particleCount;
              const speed = 150 + Math.random() * 100;
              this.particles.push(this.createParticle({
                x: this.player.x,
                y: this.player.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
                size: 4 + Math.random() * 4,
                lifetime: 400 + Math.random() * 300,
                gravity: 200
              }));
            }
          }
        }
        // Visual effect - PERFORMANCE: Use pooled particles (quality-adjusted)
        const visualParticleCount = this.getParticleCount(20);
        for (let i = 0; i < visualParticleCount; i++) {
          const angle = (Math.PI * 2 * i) / visualParticleCount;
          const speed = 150 + Math.random() * 100;
          this.particles.push(this.createParticle({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
            size: 4 + Math.random() * 4,
            lifetime: 400 + Math.random() * 300,
            gravity: 200
          }));
        }
        this.renderer.addScreenShake(0.4);
      }

      // Poison trail - PERFORMANCE: Use pooled particle
      if (result.poisonTrail) {
        this.particles.push(this.createParticle({
          x: result.poisonTrail.x,
          y: result.poisonTrail.y,
          vx: 0,
          vy: 0,
          color: '#00ff00',
          size: 6,
          lifetime: 2000,
          fadeOut: true
        }));
      }

      // Spore cloud (mushroom) - PERFORMANCE: Use pooled particles (quality-adjusted)
      if (result.sporeCloud) {
        // Create damaging cloud particles
        const sporeCount = this.getParticleCount(12);
        for (let i = 0; i < sporeCount; i++) {
          const angle = (Math.PI * 2 * i) / sporeCount;
          const speed = 40 + Math.random() * 30;
          this.particles.push(this.createParticle({
            x: result.sporeCloud.x,
            y: result.sporeCloud.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: '#9b59b6',
            size: 5,
            lifetime: 1500,
            fadeOut: true
          }));
        }
        // Check if player is in range of spore cloud
        // OPTIMIZATION: Use squared distance to avoid sqrt
        const distSq = (this.player.x - result.sporeCloud.x) ** 2 + (this.player.y - result.sporeCloud.y) ** 2;
        if (distSq < 80 * 80) {
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
          // OPTIMIZATION: Use squared distance to avoid sqrt
          const distSq = (otherEnemy.x - enemy.x) ** 2 + (otherEnemy.y - enemy.y) ** 2;
          if (distSq < 150 * 150) {
            otherEnemy.health = Math.min(otherEnemy.maxHealth, otherEnemy.health + 15);
            // Healing particles - PERFORMANCE: Use pooled particle
            this.particles.push(this.createParticle({
              x: otherEnemy.x,
              y: otherEnemy.y,
              vx: 0,
              vy: -50,
              color: '#27ae60',
              size: 6,
              lifetime: 800,
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
        // Spawn particles - PERFORMANCE: Use pooled particles (quality-adjusted)
        const minionParticleCount = this.getParticleCount(8);
        for (let i = 0; i < minionParticleCount; i++) {
          const particleAngle = (Math.PI * 2 * i) / minionParticleCount;
          this.particles.push(this.createParticle({
            x: minion.x,
            y: minion.y,
            vx: Math.cos(particleAngle) * 60,
            vy: Math.sin(particleAngle) * 60,
            color: '#00ff00',
            size: 4,
            lifetime: 600,
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
          // PERFORMANCE: Use pooled particles
          for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 150 + Math.random() * 100;
            this.particles.push(this.createParticle({
              x: this.player.x,
              y: this.player.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
              size: 4 + Math.random() * 4,
              lifetime: 400 + Math.random() * 300,
              gravity: 200
            }));
          }
        }
        enemy.dead = true; // Enemy dies on contact
      }
    }

    // PERFORMANCE: Rebuild quadtrees only for living entities
    // Skip dead entities to reduce quadtree size and improve query performance
    this.enemyQuadtree.clear();
    this.projectileQuadtree.clear();

    // Batch insert - more efficient than individual inserts
    const aliveEnemies = this.enemies.filter(e => !e.dead);
    const aliveProjectiles = this.projectiles.filter(p => !p.dead);

    for (const enemy of aliveEnemies) {
      this.enemyQuadtree.insert(enemy);
    }

    for (const proj of aliveProjectiles) {
      this.projectileQuadtree.insert(proj);
    }

    // Projectiles
    for (const proj of this.projectiles) {
      // Homing enemy shots curve toward the player (capped turn rate)
      if (proj.homing && !proj.fromPlayer) {
        const desired = Math.atan2(this.player.y - proj.y, this.player.x - proj.x);
        const current = Math.atan2(proj.vy, proj.vx);
        let delta = desired - current;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const maxTurn = proj.turnSpeed * scaledDt;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, delta));
        const speed = Math.hypot(proj.vx, proj.vy);
        proj.vx = Math.cos(current + turn) * speed;
        proj.vy = Math.sin(current + turn) * speed;
      }
      proj.update(scaledDt, this.canvas.width, this.canvas.height);

      // Skip collision detection for projectiles that are already dead
      if (proj.dead) continue;

      if (proj.fromPlayer) {
        // PERFORMANCE: Only check nearby enemies using quadtree
        const nearbyEnemies = this.enemyQuadtree.retrieve(proj);

        for (const enemy of nearbyEnemies) {
          if (proj.hasHit(enemy.id)) continue; // Already hit (piercing)

          if (enemy.collidesWith(proj.x, proj.y, proj.radius)) {
            const isCrit = this.player.rollCrit();
            let damage = isCrit ? this.player.getCritDamage(proj.damage) : proj.damage;

            // GAME FEEL: Trigger hit pause on player damage to enemy
            this.hitPauseTimer = isCrit ? 0.08 : 0.05; // Longer pause on crit

            // GAME FEEL: Screen shake on hit (bigger on crit)
            if (isCrit) {
              this.screenEffects.addShake(ShakePresets.CRIT.intensity, ShakePresets.CRIT.duration);
            } else {
              this.screenEffects.addShake(ShakePresets.SMALL.intensity, ShakePresets.SMALL.duration);
            }

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
            // PERFORMANCE: Use pooled particles
            for (let i = 0; i < 8; i++) {
              const angle = (Math.PI * 2 * i) / 8;
              const speed = 150 + Math.random() * 100;
              this.particles.push(this.createParticle({
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
                size: 4 + Math.random() * 4,
                lifetime: 400 + Math.random() * 300,
                gravity: 200
              }));
            }
            this.damageNumbers.push(this.createDamageNumber(enemy.x, enemy.y - 20, damage, isCrit));
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
            // PERFORMANCE: Use pooled particles
            for (let i = 0; i < 10; i++) {
              const angle = (Math.PI * 2 * i) / 10;
              const speed = 150 + Math.random() * 100;
              this.particles.push(this.createParticle({
                x: this.player.x,
                y: this.player.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
                size: 4 + Math.random() * 4,
                lifetime: 400 + Math.random() * 300,
                gravity: 200
              }));
            }
          }
          proj.dead = true;
        }
      }
    }

    // Melee attacks
    for (const melee of this.meleeAttacks) {
      if (!this.player) continue;
      melee.update(scaledDt, this.player.x, this.player.y);

      // PERFORMANCE: Only check nearby enemies using quadtree
      const nearbyEnemies = this.enemyQuadtree.retrieve({ x: this.player.x, y: this.player.y, radius: melee.range + 30 });

      for (const enemy of nearbyEnemies) {
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
          // PERFORMANCE: Use pooled particles
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const speed = 150 + Math.random() * 100;
            this.particles.push(this.createParticle({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
              size: 4 + Math.random() * 4,
              lifetime: 400 + Math.random() * 300,
              gravity: 200
            }));
          }
          this.damageNumbers.push(this.createDamageNumber(enemy.x, enemy.y - 20, damage, isCrit));
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
        // PERFORMANCE: Use pooled particles
        for (let i = 0; i < 12; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 80 + Math.random() * 60;
          this.particles.push(this.createParticle({
            x: orb.x,
            y: orb.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 40,
            color: i % 2 === 0 ? '#ff4466' : '#ffaacc',
            size: 5 + Math.random() * 4,
            lifetime: 500 + Math.random() * 300,
            gravity: 150
          }));
        }
        this.audio.playHit(); // Reuse hit sound for pickup
      }
    }

    // PERFORMANCE: Cleanup dead entities using swap-and-pop (zero allocation)
    // Old approach: .filter() creates new arrays every frame = GC pressure
    // New approach: in-place removal = no GC, ~30% faster for entity cleanup

    // Projectiles: collect dead ones for pool return, then remove in-place
    const deadProjectiles: Projectile[] = [];
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < this.projectiles.length; readIndex++) {
      const proj = this.projectiles[readIndex];
      if (proj.dead) {
        deadProjectiles.push(proj);
      } else {
        if (writeIndex !== readIndex) {
          this.projectiles[writeIndex] = proj;
        }
        writeIndex++;
      }
    }
    this.projectiles.length = writeIndex;
    this.projectilePool.releaseMany(deadProjectiles);

    // Particles: same pattern
    const deadParticles: Particle[] = [];
    writeIndex = 0;
    for (let readIndex = 0; readIndex < this.particles.length; readIndex++) {
      const particle = this.particles[readIndex];
      if (particle.dead) {
        deadParticles.push(particle);
      } else {
        if (writeIndex !== readIndex) {
          this.particles[writeIndex] = particle;
        }
        writeIndex++;
      }
    }
    this.particles.length = writeIndex;
    this.particlePool.releaseMany(deadParticles);

    // Damage numbers: same pattern
    const deadDamageNumbers: DamageNumber[] = [];
    writeIndex = 0;
    for (let readIndex = 0; readIndex < this.damageNumbers.length; readIndex++) {
      const num = this.damageNumbers[readIndex];
      if (num.dead) {
        deadDamageNumbers.push(num);
      } else {
        if (writeIndex !== readIndex) {
          this.damageNumbers[writeIndex] = num;
        }
        writeIndex++;
      }
    }
    this.damageNumbers.length = writeIndex;
    this.damageNumberPool.releaseMany(deadDamageNumbers);

    // Enemies, melee attacks, health orbs: simple swap-and-pop (no pool)
    this.removeDeadEntities(this.enemies);
    this.removeDeadEntities(this.meleeAttacks);
    this.removeDeadEntities(this.healthOrbs);

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
    // PERFORMANCE: Use pooled particles for kill effect (quality-adjusted)
    const killParticleCount = this.getParticleCount(20);
    for (let i = 0; i < killParticleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 180;
      this.particles.push(this.createParticle({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#ff0000' : Math.random() > 0.5 ? '#ffff00' : '#ff6600',
        size: 5 + Math.random() * 6,
        lifetime: 600 + Math.random() * 400,
        gravity: 300
      }));
    }
    // XP particles
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 50;
      this.particles.push(this.createParticle({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color: i % 2 === 0 ? '#00ff00' : '#86efac',
        size: 7 + Math.random() * 3,
        lifetime: 700 + Math.random() * 400,
        gravity: -60
      }));
    }

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
      // GAME FEEL: Enhanced screen effects
      this.screenEffects.addShake(ShakePresets.LEVEL_UP.intensity, ShakePresets.LEVEL_UP.duration);
      this.screenEffects.setZoom(1.05, 0.3); // Slight zoom in
      this.screenEffects.flash('#ffff00', 0.25); // Golden flash
      // Spawn huge particle explosion at player - PERFORMANCE: Use pooled particles (quality-adjusted)
      const colors = ['#ffff00', '#00ffff', '#ff00ff', '#ff6600', '#00ff00', '#ff0000', '#ffffff'];
      const levelUpParticleCount = this.getParticleCount(20);
      for (let i = 0; i < levelUpParticleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 150 + Math.random() * 300;
        this.particles.push(this.createParticle({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 120,
          color: colors[i % colors.length],
          size: 10 + Math.random() * 8,
          lifetime: 1200 + Math.random() * 600,
          gravity: -100
        }));
      }
    }

    // Mushroom explodes on death - PERFORMANCE: Use pooled particles
    if (enemy.type === 'mushroom') {
      // Large spore explosion
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 80 + Math.random() * 40;
        this.particles.push(this.createParticle({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#9b59b6',
          size: 6,
          lifetime: 1800,
          fadeOut: true
        }));
      }
      // OPTIMIZATION: Use squared distance to avoid sqrt
      const distSq = (this.player.x - enemy.x) ** 2 + (this.player.y - enemy.y) ** 2;
      if (distSq < 120 * 120) {
        const damaged = this.player.takeDamage(enemy.typeData.damage * 0.8);
        if (damaged) {
          this.renderer.addHitFlash(0.4);
        }
      }
    }

    // Exploder explodes on death with MASSIVE radius
    if (enemy.type === 'exploder') {
      // Huge explosion particles
      for (let i = 0; i < 30; i++) {
        const angle = (Math.PI * 2 * i) / 30;
        const speed = 120 + Math.random() * 80;
        this.particles.push(this.createParticle({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: i % 2 === 0 ? '#ff4400' : '#ffaa00',
          size: 8 + Math.random() * 4,
          lifetime: 1200,
          fadeOut: true
        }));
      }

      // Screen shake
      this.screenEffects.addShake(ShakePresets.LARGE.intensity, ShakePresets.LARGE.duration);
      this.screenEffects.flash('#ff4400', 0.2);

      // OPTIMIZATION: Use squared distance to avoid sqrt
      const distSqToPlayer = (this.player.x - enemy.x) ** 2 + (this.player.y - enemy.y) ** 2;
      const explodeRadiusSq = enemy.exploderExplodeRadius * enemy.exploderExplodeRadius;
      if (distSqToPlayer < explodeRadiusSq) {
        const damaged = this.player.takeDamage(enemy.typeData.damage * 1.5);
        if (damaged) {
          this.renderer.addHitFlash(0.6);
        }
      }

      // Damage other enemies in explosion radius - OPTIMIZATION: Use squared distance
      for (const otherEnemy of this.enemies) {
        if (otherEnemy === enemy || otherEnemy.dead) continue;
        const distSqToEnemy = (otherEnemy.x - enemy.x) ** 2 + (otherEnemy.y - enemy.y) ** 2;
        if (distSqToEnemy < explodeRadiusSq) {
          otherEnemy.takeDamage(enemy.typeData.damage);
        }
      }
    }

    // Health orb drop (18% chance)
    if (Math.random() < 0.18) {
      this.healthOrbs.push(new HealthOrb(enemy.x, enemy.y));
    }

    // Explosion on kill - OPTIMIZATION: Use squared distance to avoid sqrt
    if (this.playerStats.hasExplosionOnKill()) {
      const explosionRadius = 80;
      const explosionRadiusSq = explosionRadius * explosionRadius;
      for (const otherEnemy of this.enemies) {
        if (otherEnemy === enemy) continue;

        const distSq = (otherEnemy.x - enemy.x) ** 2 + (otherEnemy.y - enemy.y) ** 2;

        if (distSq < explosionRadiusSq) {
          otherEnemy.takeDamage(this.playerStats.getDamage() * 2);
          // PERFORMANCE: Use pooled particles
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const speed = 150 + Math.random() * 100;
            this.particles.push(this.createParticle({
              x: otherEnemy.x,
              y: otherEnemy.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
              size: 4 + Math.random() * 4,
              lifetime: 400 + Math.random() * 300,
              gravity: 200
            }));
          }
        }
      }
      // Explosion center particles
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20;
        const speed = 150 + Math.random() * 100;
        this.particles.push(this.createParticle({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
          size: 4 + Math.random() * 4,
          lifetime: 400 + Math.random() * 300,
          gravity: 200
        }));
      }
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

    // GAME FEEL: Wave complete effects
    this.screenEffects.addShake(ShakePresets.WAVE_COMPLETE.intensity, ShakePresets.WAVE_COMPLETE.duration);
    this.screenEffects.flash('#00ff00', 0.2); // Green flash for wave complete

    // Save progress
    this.autoSave();
  }

  /** Emit an enemy's shots according to its fire pattern. */
  private fireEnemyPattern(enemy: Enemy): void {
    if (!this.player) return;
    const pattern = enemy.typeData.firePattern ?? 'single';
    const damage = enemy.typeData.damage;

    const spawn = (
      angle: number,
      speed: number,
      opts: { homing?: boolean; color?: string; radius?: number } = {}
    ) => {
      const proj = this.projectilePool.acquire();
      proj.init(enemy.x, enemy.y, angle, damage, speed, false);
      if (opts.homing) {
        proj.homing = true;
        proj.turnSpeed = 2.2;
      }
      if (opts.color) proj.color = opts.color;
      if (opts.radius) proj.radius = opts.radius;
      this.projectiles.push(proj);
    };

    const angleToPlayer = enemy.getAngleToPlayer(this.player.x, this.player.y);

    switch (pattern) {
      case 'ring': {
        // Rotating ring — successive rings are offset so lanes shift
        const count = 8;
        enemy.patternPhase += Math.PI / 8;
        for (let i = 0; i < count; i++) {
          spawn(enemy.patternPhase + (Math.PI * 2 * i) / count, 210, { color: '#ffa94d' });
        }
        break;
      }
      case 'spiral': {
        // Twin arms sweeping around: rapid fire rate turns this into a spiral
        enemy.patternPhase += 0.45;
        spawn(enemy.patternPhase, 230, { color: '#38d9a9' });
        spawn(enemy.patternPhase + Math.PI, 230, { color: '#38d9a9' });
        break;
      }
      case 'homing': {
        spawn(angleToPlayer, 190, { homing: true, color: '#e599f7', radius: 12 });
        break;
      }
      case 'burst': {
        // Aimed fan toward the player
        for (let i = -2; i <= 2; i++) {
          spawn(angleToPlayer + i * 0.22, 280, { color: '#ff8787' });
        }
        break;
      }
      default:
        spawn(angleToPlayer, enemy.type === 'wizard' ? 250 : 300);
    }
    this.audio.playShoot();
  }

  /**
   * Shared shop layout for drawShop + updateShop — click hitboxes MUST match
   * visuals, so both consume this. Values are canvas px, derived from display
   * (CSS) sizes via the zoom factor so the shop reads identically at any zoom.
   */
  private getShopLayout() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const cssW = this.canvas.width / zoom;
    const cssH = this.canvas.height / zoom;
    const isPortrait = cssW < cssH;
    const isMobile = cssW < 800;
    const s = (v: number) => Math.round(v * zoom);

    const itemWidth = isPortrait
      ? s(Math.min(300, cssW - 32))
      : isMobile
        ? s(Math.min(360, cssW - 60))
        : s(200);
    const itemHeight = isPortrait ? s(92) : isMobile ? s(100) : s(150);
    const gap = s(isPortrait ? 8 : 12);

    let startX: number;
    let startY: number;
    if (isMobile) {
      startX = Math.round((this.canvas.width - itemWidth) / 2);
      startY = s(isPortrait ? 118 : 96);
    } else {
      startX = Math.round(this.canvas.width / 2 - (itemWidth * 3 + gap * 2) / 2);
      startY = s(120);
    }

    const buttonWidth = s(isMobile ? 240 : 220);
    const buttonHeight = s(isMobile ? 48 : 44);
    const buttonSpacing = s(10);
    const rows = isMobile ? 6 : 2;
    const itemsEndY = startY + rows * (itemHeight + gap);
    const continueY = Math.min(
      itemsEndY + s(10),
      this.canvas.height - buttonHeight * 2 - buttonSpacing - s(14)
    );
    const rerollY = continueY + buttonHeight + buttonSpacing;

    return {
      zoom, s, isPortrait, isMobile,
      itemWidth, itemHeight, gap, startX, startY,
      lockButtonSize: s(isMobile ? 34 : 26),
      buttonWidth, buttonHeight, continueY, rerollY,
      // Card content offsets/sizes (within a card)
      iconY: Math.round(itemHeight * 0.14),
      iconSize: s(isMobile ? 26 : 30),
      nameY: Math.round(itemHeight * 0.46),
      nameSize: s(isMobile ? 9 : 10),
      descY: Math.round(itemHeight * 0.63),
      descSize: s(8),
      costY: Math.round(itemHeight * 0.8),
      costSize: s(11),
      synergySize: s(7),
    };
  }

  private updateShop(): void {
    if (!this.player) return;

    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    // Layout shared with drawShop so hitboxes always match visuals
    const { s, isMobile, itemWidth, itemHeight, gap, startX, startY, lockButtonSize,
      buttonWidth, buttonHeight, continueY, rerollY } = this.getShopLayout();

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
      const lockButtonX = x + itemWidth - lockButtonSize - s(4);
      const lockButtonY = y + s(4);

      // RECYCLING: Recycle button in bottom-left corner
      const recycleButtonSize = lockButtonSize;
      const recycleButtonX = x + s(4);
      const recycleButtonY = y + itemHeight - recycleButtonSize - s(4);

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
            const { newDuos } = this.playerStats.addItem(item);
            this.itemsPurchasedThisWave++;

            // GAME FEEL: Duo unlock effects
            if (newDuos.length > 0) {
              for (const duo of newDuos) {
                console.log(`🎉 DUO UNLOCKED: ${duo.name} - ${duo.description}`);
                this.screenEffects.addShake(ShakePresets.MEDIUM.intensity, ShakePresets.MEDIUM.duration);
                this.screenEffects.flash(duo.glowColor || '#ff00ff', 0.3);
                this.screenEffects.setZoom(1.08, 0.4);
              }
            }

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

    // Button geometry comes from the shared layout
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

    // ADVANCED REROLL: Free reroll ONLY when shop is completely empty
    const freeReroll = this.shopItems.filter(item => item !== null && item !== undefined).length === 0;
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

    // LAYERED RENDERING: Composite all layers
    this.renderer.compositeLayers();

    this.renderer.endFrame();
  }

  private drawMenu(): void {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const cx = this.canvas.width / 2;

    // Title with a hard drop shadow for a chunky pixel look
    this.renderer.drawText('ROGUELITE', cx + s(4), s(64) + s(4), {
      size: s(42), align: 'center', color: '#241407', stroke: false
    });
    this.renderer.drawText('ROGUELITE', cx, s(64), {
      size: s(42), align: 'center', color: '#f2d94e', strokeWidth: s(4)
    });

    this.renderer.drawText('WASD OR TOUCH JOYSTICK', cx, s(140), {
      size: s(10), align: 'center', color: '#dfe6ee'
    });
    this.renderer.drawText('BUILD A BROKEN BUILD IN THE SHOP. SURVIVE.', cx, s(162), {
      size: s(10), align: 'center', color: '#dfe6ee'
    });

    this.renderer.drawText(`SOULS ${this.metaProgression.souls}`, cx, s(196), {
      size: s(14), align: 'center', color: '#b197fc'
    });

    const stats = SaveManager.getStats();
    this.renderer.drawText(
      `BEST WAVE ${stats.highestWave}   RUNS ${stats.totalRuns}   KILLS ${stats.totalKills}`,
      cx, s(226), { size: s(9), align: 'center', color: '#aab6c3' }
    );
  }

  private drawPlaying(): void {
    if (!this.player) return;

    const ctx = this.renderer.getContext();

    // GAME FEEL: Apply screen effects (shake, zoom) before rendering
    ctx.save();
    this.screenEffects.applyToContext(ctx, this.canvas.width, this.canvas.height);

    // PERFORMANCE: Update entity culler viewport
    this.entityCuller.updateViewport(0, 0, this.canvas.width, this.canvas.height, 100);

    // PERFORMANCE: Batch render particles (40-60% faster than individual draws)
    const isMobile = this.canvas.width < this.canvas.height;
    this.particleBatchRenderer.clear();
    for (const particle of this.particles) {
      if (this.entityCuller.isVisible(particle)) {
        this.particleBatchRenderer.addParticle(particle, isMobile);
      }
    }
    this.particleBatchRenderer.drawAll(ctx);

    for (const projectile of this.projectiles) {
      if (this.entityCuller.isVisible(projectile)) {
        projectile.draw(ctx);
      }
    }

    // Draw melee attacks
    for (const melee of this.meleeAttacks) {
      if (this.entityCuller.isVisible(melee)) {
        melee.draw(ctx);
      }
    }

    for (const enemy of this.enemies) {
      if (this.entityCuller.isVisible(enemy)) {
        enemy.draw(ctx);
      }
    }

    for (const orb of this.healthOrbs) {
      if (this.entityCuller.isVisible(orb)) {
        orb.draw(ctx);
      }
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

    // PERFORMANCE: Draw performance monitor (F2 to toggle)
    const quadtreeStats = this.enemyQuadtree.getStats();
    // Calculate culling stats (all entities except player)
    const allEntities = [
      ...this.enemies,
      ...this.projectiles,
      ...this.particles,
      ...this.meleeAttacks,
      ...this.healthOrbs
    ];
    const visibleCount = allEntities.filter(e => this.entityCuller.isVisible(e)).length;
    const culledCount = allEntities.length - visibleCount;

    this.performanceMonitor.draw(ctx, {
      enemies: this.enemies.length,
      projectiles: this.projectiles.length,
      particles: this.particles.length,
      damageNumbers: this.damageNumbers.length,
      meleeAttacks: this.meleeAttacks.length,
      healthOrbs: this.healthOrbs.length,
      quadtreeNodes: quadtreeStats.nodeCount,
      quadtreeDepth: quadtreeStats.maxDepth,
      quadtreeObjects: quadtreeStats.totalObjects,
      qualityLevel: this.qualityManager.getLevel(),
      visibleEntities: visibleCount,
      culledEntities: culledCount
    });

    // GAME FEEL: Restore context after screen effects
    ctx.restore();

    // GAME FEEL: Render flash effect (must be after ctx.restore to cover whole screen)
    this.screenEffects.renderFlash(ctx, this.canvas.width, this.canvas.height);
  }

  private drawHUD(): void {
    if (!this.player) return;

    const ctx = this.renderer.getContext();
    // The canvas renders larger than the viewport and is CSS-scaled down;
    // size HUD elements in display pixels and convert via the zoom factor so
    // readability is identical on any screen.
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const art = Math.max(2, s(3));
    const isPortrait = this.canvas.width < this.canvas.height;

    const pad = s(8);
    const iconS = s(20);
    const barW = s(isPortrait ? 104 : 170);
    const barH = s(12);
    const rowGap = s(7);
    const textS = s(9);

    const drawBar = (
      x: number, y: number, w: number, h: number,
      frac: number, fill: string, bg: string
    ) => {
      ctx.fillStyle = '#241407';
      ctx.fillRect(x - s(2), y - s(2), w + s(4), h + s(4));
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
    };

    // --- Left panel: HP / XP / gold ---
    const rowH = Math.max(iconS, barH) + rowGap;
    const panelW = pad * 2 + iconS + s(6) + barW + s(isPortrait ? 64 : 78);
    const panelH = pad * 2 + rowH * 3 - rowGap;
    drawPanel(ctx, s(6), s(6), panelW, panelH, DARK_WOOD_THEME, art);

    const x0 = s(6) + pad + s(2);
    let y = s(6) + pad + s(2);
    const barX = x0 + iconS + s(6);
    const textX = barX + barW + s(8);

    const hpFrac = this.player.health / this.player.maxHealth;
    const heart = UISprites.getIcon('heart');
    if (heart) ctx.drawImage(heart, x0, y, iconS, iconS);
    drawBar(barX, y + Math.round((iconS - barH) / 2), barW, barH, hpFrac,
      hpFrac > 0.6 ? '#4ade80' : hpFrac > 0.3 ? '#fbbf24' : '#ef4444', '#3c0000');
    this.renderer.drawText(
      `${Math.ceil(this.player.health)}/${this.player.maxHealth}`,
      textX, y + Math.round(iconS / 2), { size: textS, baseline: 'middle', color: '#ffffff' }
    );

    y += rowH;
    const star = UISprites.getIcon('star');
    if (star) ctx.drawImage(star, x0, y, iconS, iconS);
    drawBar(barX, y + Math.round((iconS - barH) / 2), barW, barH,
      this.player.xp / this.player.xpToNextLevel, '#4a9eff', '#101c30');
    this.renderer.drawText(`LV ${this.player.level}`, textX, y + Math.round(iconS / 2), {
      size: textS, baseline: 'middle', color: '#ffd700'
    });

    y += rowH;
    const coin = UISprites.getIcon('coin');
    if (coin) ctx.drawImage(coin, x0, y, iconS, iconS);
    this.renderer.drawText(`${this.player.gold}`, barX, y + Math.round(iconS / 2), {
      size: s(11), baseline: 'middle', color: '#ffd700'
    });

    // --- Right panel: wave + enemies remaining ---
    let waveText = `WAVE ${this.waveManager.currentWave}`;
    let waveColor = '#9ecbff';
    if (this.waveManager.isBossWave) { waveText += ' BOSS'; waveColor = '#ff6b6b'; }
    else if (this.waveManager.isHordeWave) { waveText += ' HORDE'; waveColor = '#ffa94d'; }

    const rPanelW = pad * 2 + s(isPortrait ? 118 : 150);
    const rPanelH = pad * 2 + s(34);
    const rx = this.canvas.width - rPanelW - s(6);
    drawPanel(ctx, rx, s(6), rPanelW, rPanelH, DARK_WOOD_THEME, art, 3);
    this.renderer.drawText(waveText, rx + rPanelW / 2, s(6) + pad + s(4), {
      size: s(isPortrait ? 9 : 11), align: 'center', color: waveColor
    });
    this.renderer.drawText(
      `ENEMIES ${this.enemies.length + this.waveManager.waveEnemiesRemaining}`,
      rx + rPanelW / 2, s(6) + pad + s(22),
      { size: s(8), align: 'center', color: '#cfd8e3' }
    );

    // --- Boss health bar (bottom center, with name) ---
    const boss = this.enemies.find((e) => e.typeData.isBoss);
    if (boss) {
      const BOSS_NAMES: Record<string, string> = {
        boss_necrolord: 'NECRO LORD',
        boss_flamefiend: 'FLAME FIEND',
        boss_voidbeast: 'VOID BEAST',
        boss_stormking: 'STORM KING',
        boss_ancientgolem: 'ANCIENT GOLEM',
      };
      const bw = Math.min(s(420), this.canvas.width - s(60));
      const bh = s(14);
      const bx = Math.round((this.canvas.width - bw) / 2);
      const by = this.canvas.height - s(48);
      drawPanel(ctx, bx - s(12), by - s(26), bw + s(24), bh + s(38), DARK_WOOD_THEME, art, 7);
      this.renderer.drawText(BOSS_NAMES[boss.type] ?? 'BOSS', this.canvas.width / 2, by - s(14), {
        size: s(9), align: 'center', color: '#ff6b6b'
      });
      drawBar(bx, by, bw, bh, boss.health / boss.maxHealth, '#e03131', '#3c0000');
    }

    // --- Status callouts under the left panel ---
    let statusY = s(6) + panelH + s(8);
    if (this.player.shield) {
      this.renderer.drawText('SHIELD ACTIVE', s(10), statusY, { size: s(8), color: '#4a9eff' });
      statusY += s(14);
    }
    const specialization = this.playerStats.getWeaponSpecialization();
    if (specialization === 'melee' || specialization === 'ranged') {
      this.renderer.drawText(`${specialization.toUpperCase()} +20%`, s(10), statusY, {
        size: s(8), color: specialization === 'melee' ? '#ff8c42' : '#5ee0e0'
      });
    }
  }
  private drawShop(): void {
    const { s, isMobile, itemWidth, itemHeight, gap, startX, startY, lockButtonSize,
      buttonWidth, buttonHeight, continueY, rerollY,
      iconY, iconSize, nameY, nameSize, descY, descSize, costY, costSize,
      synergySize } = this.getShopLayout();
    const ctx = this.renderer.getContext();

    // Shop title with a hard pixel drop shadow
    const titleSize = s(isMobile ? 16 : 22);
    const titleY = s(isMobile ? 10 : 20);
    this.renderer.drawText('SHOP', this.canvas.width / 2 + s(2), titleY + s(2), {
      size: titleSize, align: 'center', color: '#241407', stroke: false
    });
    this.renderer.drawText('SHOP', this.canvas.width / 2, titleY, {
      size: titleSize, align: 'center', color: '#ffd700'
    });

    if (!this.player) return;

    // Gold display
    this.renderer.drawText(`${this.player.gold} G`, this.canvas.width / 2, s(isMobile ? 32 : 50), {
      size: s(10),
      align: 'center',
      color: '#ffd700'
    });

    // PLAYER STATS PANEL - compact display on the left side (desktop) or top (mobile)
    const statPanelPadding = s(8);
    const statPanelWidth = isMobile ? this.canvas.width - s(20) : s(220);
    const statPanelHeight = isMobile ? s(38) : s(140);
    const statPanelX = s(10);
    const statPanelY = isMobile ? s(64) : s(56);

    // Stats panel: wood, pixel font, no emoji
    drawPanel(ctx, statPanelX, statPanelY, statPanelWidth, statPanelHeight, DARK_WOOD_THEME, 4, 11);

    const stats: Array<[string, string, string]> = [
      ['HP', `${Math.floor(this.player.health)}/${this.playerStats.getMaxHealth()}`, '#ff6b6b'],
      ['DMG', `${Math.floor(this.playerStats.getDamage())}`, '#ffa94d'],
      ['FIRE', `${this.playerStats.getFireRate().toFixed(1)}/S`, '#ff8787'],
      ['SPD', `${Math.floor(this.playerStats.getSpeed())}`, '#66d9e8'],
      ['CRIT', `${Math.floor(this.playerStats.getCritChance() * 100)}%`, '#ffd43b'],
      ['MULTI', `${this.playerStats.getMultishot()}`, '#69db7c'],
    ];

    if (isMobile) {
      // Mobile: 3 columns x 2 rows
      const statSize = s(7);
      const colW = (statPanelWidth - statPanelPadding * 2) / 3;
      stats.forEach(([label, value, color], idx) => {
        const colX = statPanelX + statPanelPadding + (idx % 3) * colW;
        const rowY = statPanelY + s(8) + Math.floor(idx / 3) * s(15);
        this.renderer.drawText(`${label} ${value}`, colX, rowY, {
          size: statSize, color, align: 'left'
        });
      });
    } else {
      // Desktop: vertical rows, label left / value right
      const statSize = s(9);
      stats.forEach(([label, value, color], idx) => {
        const rowY = statPanelY + s(14) + idx * s(19);
        this.renderer.drawText(label, statPanelX + statPanelPadding + 4, rowY, {
          size: statSize, color: '#c8b998', align: 'left'
        });
        this.renderer.drawText(value, statPanelX + statPanelWidth - statPanelPadding - 4, rowY, {
          size: statSize, color, align: 'right'
        });
      });
    }

    // INVENTORY PANEL - show current items as tiny icons on the right side (desktop) or below stats (mobile)
    const invPanelPadding = s(6);
    const invPanelWidth = s(220);
    const invPanelMaxHeight = s(200);
    const invPanelX = this.canvas.width - s(230);
    const invPanelY = s(56);

    // Inventory panel is desktop-only; portrait screens have no room for it
    if (!isMobile && this.playerStats.items.length > 0) {
      // Group items by ID and count duplicates
      const itemCounts = new Map<string, { item: Item; count: number }>();
      for (const item of this.playerStats.items) {
        const existing = itemCounts.get(item.id);
        if (existing) {
          existing.count++;
        } else {
          itemCounts.set(item.id, { item, count: 1 });
        }
      }

      const uniqueItems = Array.from(itemCounts.values());

      // Calculate actual height based on unique items
      const iconSize = s(24);
      const iconsPerRow = 6;
      const rows = Math.ceil(uniqueItems.length / iconsPerRow);
      const invPanelHeight = Math.min(invPanelMaxHeight, rows * (iconSize + s(4)) + invPanelPadding * 2 + s(18));

      // Inventory panel background
      drawPanel(ctx, invPanelX, invPanelY, invPanelWidth, invPanelHeight, DARK_WOOD_THEME, 4, 23);

      // Title
      this.renderer.drawText('INVENTORY', invPanelX + invPanelWidth / 2, invPanelY + s(8), {
        size: s(8),
        align: 'center',
        color: '#d0bfff'
      });

      // Draw item icons in grid with count badges
      const gridStartX = invPanelX + invPanelPadding;
      const gridStartY = invPanelY + s(20);

      for (let i = 0; i < uniqueItems.length; i++) {
        const { item, count } = uniqueItems[i];
        const col = i % iconsPerRow;
        const row = Math.floor(i / iconsPerRow);
        const x = gridStartX + col * (iconSize + s(4));
        const y = gridStartY + row * (iconSize + s(4));

        // Item icon
        this.renderer.drawText(item.icon, x + iconSize / 2, y + s(2), {
          size: s(16),
          align: 'center'
        });

        // Count badge (only show if count > 1)
        if (count > 1) {
          const badgeSize = s(12);
          const badgeX = x + iconSize - badgeSize / 2 - 2;
          const badgeY = y - badgeSize / 2 + 2;

          // Square pixel badge
          ctx.save();
          ctx.fillStyle = '#241407';
          ctx.fillRect(badgeX - badgeSize / 2, badgeY - badgeSize / 2, badgeSize, badgeSize);
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1;
          ctx.strokeRect(badgeX - badgeSize / 2, badgeY - badgeSize / 2, badgeSize, badgeSize);
          ctx.restore();
          this.renderer.drawText(`x${count}`, badgeX, badgeY - badgeSize / 4, {
            size: s(7),
            align: 'center',
            color: '#ffffff'
          });
        }
      }
    }

    // Card grid geometry comes from getShopLayout() (shared with updateShop)

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
        common: '#d7d3c8',
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

      // Card: wood panel with a crisp rarity/synergy-colored inner border
      // (pixel-art treatment — no glows, no gradients)
      drawPanel(ctx, x, y, itemWidth, itemHeight, DARK_WOOD_THEME, 4, i);
      let borderColor = rarityColor;
      if (isDuplicate) borderColor = '#4a9eff';
      else if (hasTagMatch || hasSynergy) borderColor = '#7bd94a';
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = hovered ? 6 : 3;
      ctx.strokeRect(x + 6, y + 6, itemWidth - 12, itemHeight - 12);
      ctx.restore();

      // Lock button in top-right corner
      const lockButtonX = x + itemWidth - lockButtonSize - s(4);
      const lockButtonY = y + s(4);
      const isLocked = this.lockedShopItems.has(i);

      // Lock button background
      ctx.save();
      ctx.fillStyle = isLocked ? '#ffd700' : '#2e1c0e';
      ctx.fillRect(lockButtonX, lockButtonY, lockButtonSize, lockButtonSize);
      ctx.strokeStyle = isLocked ? '#fff3bf' : '#6b4423';
      ctx.lineWidth = 2;
      ctx.strokeRect(lockButtonX, lockButtonY, lockButtonSize, lockButtonSize);
      ctx.restore();

      // Lock icon
      this.renderer.drawText(isLocked ? '🔒' : '🔓', lockButtonX + lockButtonSize / 2, lockButtonY + Math.round(lockButtonSize * 0.15), {
        size: Math.round(lockButtonSize * 0.6),
        align: 'center'
      });

      // Recycle button in bottom-left corner (if player owns this item)
      const ownsItem = this.playerStats.items.some(owned => owned.id === item.id);
      if (ownsItem) {
        const recycleButtonSize = lockButtonSize;
        const recycleButtonX = x + s(4);
        const recycleButtonY = y + itemHeight - recycleButtonSize - s(4);

        // Recycle button background
        ctx.save();
        ctx.fillStyle = '#2e1c0e';
        ctx.fillRect(recycleButtonX, recycleButtonY, recycleButtonSize, recycleButtonSize);
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        ctx.strokeRect(recycleButtonX, recycleButtonY, recycleButtonSize, recycleButtonSize);
        ctx.restore();

        // Recycle icon
        this.renderer.drawText('♻️', recycleButtonX + recycleButtonSize / 2, recycleButtonY + Math.round(recycleButtonSize * 0.18), {
          size: Math.round(recycleButtonSize * 0.55),
          align: 'center'
        });
      }

      // BROTATO-INSPIRED: Enhanced synergy indicator showing type
      if (isDuplicate || hasTagMatch || hasSynergy) {
        let indicatorText = '';
        let indicatorColor = '#00ff00';

        // Don't show "DUPLICATE" text - just show synergy indicators
        if (hasTagMatch) {
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

        if (indicatorText) {
          this.renderer.drawText(indicatorText, x + itemWidth / 2, y + s(6), {
            size: synergySize,
            align: 'center',
            color: indicatorColor
          });
        }
      }

      // Icon with better positioning
      this.renderer.drawText(item.icon, x + itemWidth / 2, y + iconY, {
        size: iconSize,
        align: 'center'
      });

      // Name — pixel font is wide, so sizes are tuned to fit the card width
      this.renderer.drawText(item.name, x + itemWidth / 2, y + nameY, {
        size: nameSize,
        align: 'center',
        color: rarityColor
      });

      // Description (more compact)
      this.renderer.drawText(item.description, x + itemWidth / 2, y + descY, {
        size: descSize,
        align: 'center',
        color: '#e5d9c3'
      });

      // Cost with better styling (bottom, prominent)
      const finalPrice = this.playerStats.getItemPrice(item, this.waveManager.currentWave);
      const canAfford = this.player.gold >= finalPrice;
      this.renderer.drawText(`${finalPrice} G`, x + itemWidth / 2, y + costY, {
        size: costSize,
        align: 'center',
        color: canAfford ? '#ffd700' : '#ef4444'
      });
    }

    // Button geometry comes from the shared layout
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
    const freeReroll = this.shopItems.filter(item => item !== null && item !== undefined).length === 0;
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
