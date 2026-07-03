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
import { HealthOrb, XPOrb } from './Pickup';
import { OrbitingOrb, Bomb, Shockwave } from './Weapons';
import { AoeZone } from './AoeZone';
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
import { DUO_COMBOS } from './DuoSystem';
import { UISprites } from './UISprites';
import { MapSystem, nodeIcon, nodeLabel, serializeMap, deserializeMap, type NodeType } from './MapSystem';
import { ArtifactSystem, ARTIFACTS, getArtifactById, type Artifact } from './ArtifactSystem';
import { randomEvent, type GameEvent, type EventEffect } from './EventSystem';

// The map/node meta-layer adds three between-wave screens on top of the core loop:
//   'map'    — the Slay-the-Spire-style branching node picker (route your run)
//   'event'  — a `?` node's text choice screen
//   'reward' — a "pick 1 of 3 artifacts" screen (treasure / elite / boss spoils)
//   'rest'   — a campfire node: heal or upgrade
export type GameState =
  | 'menu' | 'playing' | 'shop' | 'paused' | 'gameover' | 'upgrades'
  | 'map' | 'event' | 'reward' | 'rest';

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
  xpOrbs: XPOrb[] = [];

  // AUXILIARY STACKING WEAPONS — run alongside the primary weapon (never replace it).
  orbitingOrbs: OrbitingOrb[] = [];
  bombs: Bomb[] = [];
  shockwaves: Shockwave[] = [];

  // Telegraphed enemy AoE attacks (red ground markers -> delayed hit).
  aoeZones: AoeZone[] = [];
  private bombTimer: number = 0;
  private novaTimer: number = 0;
  private auxMeleeTimer: number = 0;

  // ZOOM-OUT: the simulation runs in a world 2x the canvas in each dimension and
  // is rendered at 1/scale, so the play area is larger and the player/monsters
  // read smaller (a wider Vampire-Survivors-style battlefield). Gameplay bounds,
  // spawns and the render transform all derive from these — the GUI/HUD is drawn
  // untransformed in screen space.
  private readonly WORLD_SCALE = 2;
  private get worldWidth(): number { return this.canvas.width * this.WORLD_SCALE; }
  private get worldHeight(): number { return this.canvas.height * this.WORLD_SCALE; }

  // Systems
  waveManager: WaveManager;
  playerStats: PlayerStats;
  metaProgression: MetaProgression;
  mapSystem: MapSystem = new MapSystem();
  artifacts: ArtifactSystem = new ArtifactSystem();

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
  lastInterestGained: number = 0; // Gold earned from banking interest this shop (for display)
  showCombosOverlay: boolean = false; // COMBOS guide overlay (explains synergies/duos)
  showStatsPopup: boolean = false; // Full stats breakdown popup (tap the shop stats panel)
  private statsPanelRect: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 };

  // ---- MAP / NODE META-LAYER state ----
  currentEvent: GameEvent | null = null;    // active `?` event, or null
  eventResultText: string | null = null;    // outcome shown after picking an option
  rewardChoices: Artifact[] = [];            // the 1-of-3 artifact offer
  rewardTitle: string = '';                  // header for the reward screen
  private rewardThen: (() => void) | null = null; // what to do once an artifact is picked
  private pendingWaveArtifact: boolean = false;   // elite/boss wave grants spoils on clear
  restResolved: boolean = false;             // rest node: an option has been taken
  restResultText: string = '';               // rest node outcome line
  // Momentum artifact: seconds the player has been continuously moving.
  private momentumTime: number = 0;

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

  // Mid-wave sub-phase banner ("waves-within-waves"): flashes a shorter, lower
  // announcement when the WaveManager advances to a new phase mid-fight.
  phaseBannerTimer: number = 0;
  phaseBannerText: string = '';

  constructor(canvas: HTMLCanvasElement) {
    // Dev/QA hook: lets tooling (screenshot scripts, the shots-qa harness)
    // inspect and force game state. Not a public API.
    (window as unknown as { __game: Game }).__game = this;
    (window as unknown as { __ItemDatabase: typeof ItemDatabase }).__ItemDatabase = ItemDatabase;
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

    // PERFORMANCE: Initialize quadtrees (world-sized, not canvas-sized — the arena is 2x)
    this.enemyQuadtree = new Quadtree({ x: 0, y: 0, width: this.worldWidth, height: this.worldHeight });
    this.projectileQuadtree = new Quadtree({ x: 0, y: 0, width: this.worldWidth, height: this.worldHeight });

    // PERFORMANCE: Initialize performance monitor (F2 to toggle)
    this.performanceMonitor = new PerformanceMonitor();

    // PERFORMANCE: Initialize quality manager (adaptive scaling)
    this.qualityManager = new QualityManager('high');

    // PERFORMANCE: Initialize entity culler (off-screen culling)
    this.entityCuller = new EntityCuller();

    // PATHFINDING: Initialize pathfinding system (32px cells over the full world)
    this.pathfindingSystem = new PathfindingSystem(this.worldWidth, this.worldHeight, 32);

    // GAME FEEL: Initialize screen effects
    this.screenEffects = new ScreenEffects();

    // Quadtree bounds and the pathfinding grid depend on canvas size, which is
    // only set by resizeCanvas() after construction — main.ts calls this on every resize
    window.addEventListener('game-resize', () => {
      const width = this.worldWidth;
      const height = this.worldHeight;
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
  private createDamageNumber(
    x: number,
    y: number,
    damage: number | string,
    isCrit: boolean,
    color?: string
  ): DamageNumber {
    const num = this.damageNumberPool.acquire();
    num.init(x, y, damage, isCrit, color);
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
      const tierItems = ItemDatabase.getItemsByRarity(this.metaProgression.getStartingItemTier());
      if (tierItems.length > 0) {
        const randomItem = tierItems[Math.floor(Math.random() * tierItems.length)];
        this.playerStats.addItem(randomItem);
      }
    }
    if (this.metaProgression.hasStartingLegendary()) {
      const legendaries = ItemDatabase.getItemsByRarity('legendary');
      if (legendaries.length > 0) {
        this.playerStats.addItem(legendaries[Math.floor(Math.random() * legendaries.length)]);
      }
    }

    this.player = new Player(this.worldWidth / 2, this.worldHeight / 2, this.playerStats);

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

    // Remaining meta upgrades — purchasable for weeks but never wired
    const speedBonus = this.metaProgression.getStartingSpeedBonus();
    if (speedBonus > 0) this.player.stats.baseSpeed *= 1 + speedBonus;
    const fireRateBonus = this.metaProgression.getStartingFireRateBonus();
    if (fireRateBonus > 0) this.player.stats.baseFireRate *= 1 + fireRateBonus;
    const critBonus = this.metaProgression.getStartingCritBonus();
    if (critBonus > 0) this.player.stats.baseCritChance += critBonus;
    this.playerStats.metaArmor = this.metaProgression.getStartingArmorBonus();
    this.playerStats.metaShopDiscount = this.metaProgression.getShopDiscountBonus();
    if (this.metaProgression.hasPermanentShield()) this.player.shield = true;

    this.enemies = [];
    this.projectiles = [];
    this.meleeAttacks = [];
    this.particles = [];
    this.damageNumbers = [];
    this.healthOrbs = [];
    this.xpOrbs = [];
    this.resetAuxWeapons();
    this.kills = 0;
    this.bossKills = 0;
    this.soulsEarnedThisRun = 0;

    this.waveManager.reset();
    // The map layer drives wave numbers now: the first battle node starts wave
    // waveSkip+1, so seed the counter at waveSkip and open the act-1 map.
    this.waveManager.currentWave = this.metaProgression.getWaveSkip();
    this.artifacts.reset();
    this.artifacts.applyStatic(this.playerStats);
    this.mapSystem.reset();
    this.mapSystem.generateAct(1);
    this.refreshMaxHealth();
    this.pendingWaveArtifact = false;

    this.state = 'map';
  }

  /** Recompute the player's max health after an artifact changes it, granting the delta. */
  private refreshMaxHealth(): void {
    if (!this.player) return;
    const newMax = this.playerStats.getMaxHealth();
    const delta = newMax - this.player.maxHealth;
    this.player.maxHealth = newMax;
    if (delta > 0) this.player.health += delta; // new HP is granted, not just capacity
    this.player.health = Math.min(this.player.health, this.player.maxHealth);
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

    // Restore held artifacts and fold their static contributions back into stats
    // BEFORE the Player is built so its maxHealth reflects them.
    this.artifacts.reset();
    if (save.artifactIds) {
      for (const id of save.artifactIds) {
        const art = getArtifactById(id);
        if (art) this.artifacts.add(art, this.playerStats);
      }
    }
    this.artifacts.applyStatic(this.playerStats);

    this.player = new Player(this.worldWidth / 2, this.worldHeight / 2, this.playerStats);
    this.syncArtifactStatic();

    // Restore the node-map so routing resumes where it left off.
    const restoredMap = deserializeMap(save.actMap);
    if (restoredMap) this.mapSystem.map = restoredMap;
    else { this.mapSystem.reset(); this.mapSystem.generateAct(1); }

    // Restore stats
    if (save.level) {
      this.player.level = save.level;
      this.player.xp = save.xp ?? 0;
      // Reproduce the piecewise curve (1.35 through L5, then 1.25)
      let xpReq = 100;
      for (let l = 2; l <= save.level; l++) {
        xpReq = Math.floor(xpReq * (l <= 5 ? 1.35 : 1.25));
      }
      this.player.xpToNextLevel = xpReq;
    }
    if (save.gold !== undefined) this.player.gold = save.gold;
    if (save.health !== undefined) this.player.health = save.health;

    this.enemies = [];
    this.projectiles = [];
    this.meleeAttacks = [];
    this.particles = [];
    this.damageNumbers = [];
    this.healthOrbs = [];
    this.xpOrbs = [];
    this.resetAuxWeapons();
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
      case 'map':
        this.updateMap();
        break;
      case 'event':
        this.updateEvent();
        break;
      case 'reward':
        this.updateReward();
        break;
      case 'rest':
        this.updateRest();
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
    if (this.phaseBannerTimer > 0) {
      this.phaseBannerTimer -= dt;
    }

    // Input
    const movement = this.input.getMovementVector();

    // ARTIFACT runtime hooks (momentum ramps damage while moving; berserk ramps
    // fire rate as HP drops). Recomputed every frame; identity when not held.
    this.updateArtifactRuntime(scaledDt, movement.x !== 0 || movement.y !== 0);

    // Player update
    this.player.update(scaledDt, movement.x, movement.y, this.worldWidth, this.worldHeight);

    // Health regen (items + meta) — previously sold but never ticked
    const regen = this.playerStats.getHealthRegen() + this.metaProgression.getStartingRegenBonus();
    if (regen > 0 && this.player.health < this.player.maxHealth) {
      this.player.heal(regen * scaledDt);
    }

    // Dodge popups so Evasion items visibly do something
    while (this.player.pendingDodges > 0) {
      this.player.pendingDodges--;
      this.damageNumbers.push(
        this.createDamageNumber(this.player.x, this.player.y - 24, 'DODGE', false, '#66d9e8')
      );
    }

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
          pooled.homing = proj.homing;
          pooled.turnSpeed = proj.turnSpeed;
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
    this.enemies = this.waveManager.update(scaledDt, this.enemies, this.worldWidth, this.worldHeight);

    // Waves-within-waves: flash the new sub-phase banner when a phase begins.
    if (this.waveManager.phaseJustChanged) {
      this.phaseBannerText = this.waveManager.phaseText;
      this.phaseBannerTimer = 2.4;
    }

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

      // Status effects (wired item mechanics: Frost Orb, Toxic Vial, ...)
      if (enemy.frozenTimer > 0) enemy.frozenTimer -= scaledDt;
      if (enemy.poisonTimer > 0) {
        enemy.poisonTimer -= scaledDt;
        enemy.health -= 7 * scaledDt;
        if (enemy.health <= 0 && !enemy.dead) {
          enemy.dead = true;
          this.handleEnemyKill(enemy);
          continue;
        }
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
        // Cap the battlefield so summoners can't flood (and adds can't
        // farm-feed the player forever)
        if (this.enemies.length > 20) continue;
        const minion = new Enemy(
          enemy.x + Math.cos(angle) * dist,
          enemy.y + Math.sin(angle) * dist,
          'skeleton',
          0.4
        );
        minion.typeData.health = 30;
        minion.typeData.damage = 4;
        // Token rewards: free spawns must not out-earn real enemies
        minion.typeData.xpValue = 5;
        minion.typeData.goldValue = 1;
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

      // Telegraphed AoE attacks (bosses / ranged enemies): spawn a red ground
      // marker at each requested spot; it deals damage only after its warning window.
      if (result.aoeAttacks) {
        for (const a of result.aoeAttacks) {
          this.spawnAoeZone(new AoeZone(a.x, a.y, a.radius, a.damage, a.telegraph, {
            shape: a.shape,
            color: a.color
          }));
        }
      }

      // Egg sac hatched (timer elapsed while it survived): spawn its tougher
      // payload and remove the egg. Killing the egg first prevents this.
      if (enemy.eggShouldHatch && !enemy.dead) {
        this.hatchEgg(enemy);
        continue;
      }

      // Check wall collision for cyclops
      enemy.checkWallCollision(this.worldWidth, this.worldHeight);

      // Enemy-player collision — enemies persist and keep attacking on a
      // cooldown (kamikaze contact made melee pressure evaporate); only
      // true suicide types still die on touch
      enemy.contactCooldown -= scaledDt;
      if (enemy.contactCooldown <= 0 && enemy.collidesWith(this.player.x, this.player.y, this.player.radius)) {
        enemy.contactCooldown = 0.8;
        const damaged = this.player.takeDamage(enemy.typeData.damage);
        if (damaged) {
          this.applyThorns(enemy.typeData.damage, enemy);
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
        if (enemy.type === 'exploder' || enemy.type === 'swarm') {
          enemy.dead = true; // Suicide attackers still trade themselves
        }
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
      // Homing shots curve toward their target (capped turn rate):
      // enemy shots seek the player, player shots seek the nearest enemy
      let homeX = this.player.x;
      let homeY = this.player.y;
      let hasTarget = !proj.fromPlayer;
      if (proj.homing && proj.fromPlayer) {
        let bd = Infinity;
        for (const e of this.enemyQuadtree.retrieve({ x: proj.x, y: proj.y, radius: 350 })) {
          if (e.dead) continue;
          const d = (e.x - proj.x) ** 2 + (e.y - proj.y) ** 2;
          if (d < bd) { bd = d; homeX = e.x; homeY = e.y; hasTarget = true; }
        }
      }
      if (proj.homing && hasTarget) {
        const desired = Math.atan2(homeY - proj.y, homeX - proj.x);
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
      proj.update(scaledDt, this.worldWidth, this.worldHeight);

      // Skip collision detection for projectiles that are already dead
      if (proj.dead) continue;

      if (proj.fromPlayer) {
        // PERFORMANCE: Only check nearby enemies using quadtree
        const nearbyEnemies = this.enemyQuadtree.retrieve(proj);

        for (const enemy of nearbyEnemies) {
          if (enemy.dead) continue; // Corpse still in this frame's quadtree — don't re-kill
          if (proj.hasHit(enemy.id)) continue; // Already hit (piercing)

          if (enemy.collidesWith(proj.x, proj.y, proj.radius)) {
            const isCrit = this.player.rollCrit();
            let damage = isCrit ? this.player.getCritDamage(proj.damage) : proj.damage;
            if (enemy.typeData.isBoss) {
              damage *= this.metaProgression.getBossDamageMultiplier();
            }

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
            } else {
              this.applyOnHitEffects(enemy, damage);
            }
          }
        }
      } else {
        // Enemy projectile hits player
        if (this.player.collidesWith(proj.x, proj.y, proj.radius)) {
          const damaged = this.player.takeDamage(proj.damage);
          if (damaged) {
            this.applyThorns(proj.damage);
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
        if (enemy.dead) continue; // Corpse still in this frame's quadtree — don't re-kill
        if (melee.hasHit(enemy.id)) continue; // Already hit

        if (melee.isPointInArc(enemy.x, enemy.y)) {
          const isCrit = this.player.rollCrit();
          let damage = isCrit ? this.player.getCritDamage(melee.damage) : melee.damage;
          if (enemy.typeData.isBoss) {
            damage *= this.metaProgression.getBossDamageMultiplier();
          }

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

    // AUXILIARY STACKING WEAPONS — orbiting orbs, dropped bombs, nova pulses and a
    // whirling melee arc. These run in ADDITION to the primary weapon each frame.
    this.updateAuxWeapons(scaledDt);

    // Particles
    for (const particle of this.particles) {
      particle.update(scaledDt);
    }

    // Damage numbers
    for (const num of this.damageNumbers) {
      num.update(scaledDt);
    }

    // Health orbs — magnet attraction (getXPMagnet drives a real pickup range)
    const pickupMagnet = this.playerStats.getXPMagnet();
    const attractRadius = 60 * pickupMagnet; // baseline vacuum, widened by magnet items
    for (const orb of this.healthOrbs) {
      orb.update(scaledDt);

      // Pull orbs within attraction range toward the player (speed ramps as they close in)
      const dx = this.player.x - orb.x;
      const dy = this.player.y - orb.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist <= attractRadius) {
        const pull = 170 + (1 - dist / attractRadius) * 300; // 170..470 px/s, faster than the player
        const step = Math.min(dist, pull * scaledDt);
        orb.x += (dx / dist) * step;
        orb.y += (dy / dist) * step;
      }

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

    // XP orbs — the same magnet stat sets how far they start homing. XPOrb.update
    // does the pop-then-home motion itself and returns true once it reaches the player.
    const xpMagnetRadius = 95 * pickupMagnet;
    for (const orb of this.xpOrbs) {
      if (orb.update(scaledDt, this.player.x, this.player.y, xpMagnetRadius)) {
        this.grantXP(orb.xpAmount);
        orb.dead = true;
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
    this.removeDeadEntities(this.xpOrbs);
    this.removeDeadEntities(this.bombs);
    this.removeDeadEntities(this.shockwaves);
    this.updateAoeZones(scaledDt);
    this.removeDeadEntities(this.aoeZones);

    // Check wave completion
    if (this.waveManager.isWaveComplete()) {
      if (this.pendingWaveArtifact) {
        // Elite / boss nodes grant guaranteed spoils: an artifact pick, then the
        // usual shop. Extra gold is added here so the reward feels distinct.
        this.pendingWaveArtifact = false;
        this.player.addGold(40);
        this.offerArtifactReward('VICTORY SPOILS', () => this.enterShop());
      } else {
        this.enterShop();
      }
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

  // Grant XP (from a collected orb) and fire the level-up juice if it triggered.
  // Called at pickup time now that XP drops as gems instead of applying on kill.
  private resetAuxWeapons(): void {
    this.orbitingOrbs = [];
    this.bombs = [];
    this.shockwaves = [];
    this.aoeZones = [];
    this.bombTimer = 0;
    this.novaTimer = 0;
    this.auxMeleeTimer = 0;
  }

  // Apply damage from an auxiliary weapon to one enemy, reusing the same crit /
  // boss-mult / lifesteal / particle / kill flow the primary weapons use so the
  // stacked weapons feel identical in impact.
  private dealAuxDamage(enemy: Enemy, baseDamage: number, hitColor: string): void {
    if (!this.player || enemy.dead) return;
    const isCrit = this.player.rollCrit();
    let damage = isCrit ? this.player.getCritDamage(baseDamage) : baseDamage;
    if (enemy.typeData.isBoss) damage *= this.metaProgression.getBossDamageMultiplier();

    const splits = enemy.takeDamage(damage);
    if (splits && splits.length > 0) this.enemies.push(...splits);

    const lifesteal = this.playerStats.getLifesteal();
    if (lifesteal > 0) this.player.heal(damage * lifesteal);

    this.damageNumbers.push(this.createDamageNumber(enemy.x, enemy.y - 20, damage, isCrit));
    this.renderer.addImpactFlash(enemy.x, enemy.y);
    const pc = this.getParticleCount(5);
    for (let i = 0; i < pc; i++) {
      const a = (Math.PI * 2 * i) / Math.max(1, pc);
      const speed = 120 + Math.random() * 90;
      this.particles.push(this.createParticle({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        color: i % 2 === 0 ? hitColor : '#ffffff',
        size: 3 + Math.random() * 3,
        lifetime: 300 + Math.random() * 200,
        gravity: 120
      }));
    }
    if (enemy.dead) this.handleEnemyKill(enemy);
  }

  private updateAuxWeapons(dt: number): void {
    if (!this.player) return;
    const px = this.player.x;
    const py = this.player.y;

    // --- Orbiting orbs: keep the live array sized to the item count, spin them,
    //     and grind any enemy they overlap (per-enemy re-hit cooldown). ---
    const orbCount = this.playerStats.getOrbitOrbCount();
    if (orbCount !== this.orbitingOrbs.length) {
      // Rebuild with evenly-spaced angles, preserving current spin phase.
      const phase = this.orbitingOrbs[0]?.angle ?? 0;
      this.orbitingOrbs = [];
      for (let i = 0; i < orbCount; i++) {
        this.orbitingOrbs.push(new OrbitingOrb(phase + (Math.PI * 2 * i) / orbCount, 0, 0));
      }
    }
    if (this.orbitingOrbs.length > 0) {
      const orbitRadius = 72;
      const spin = 2.4; // rad/s
      const orbDamage = this.playerStats.getOrbitDamage();
      // All orbs spin at the same rate from evenly-spaced starts, so the ring
      // stays symmetric without re-imposing spacing each frame.
      for (const orb of this.orbitingOrbs) {
        orb.update(dt, px, py, spin, orbitRadius, orbDamage);
      }
      const nearby = this.enemyQuadtree.retrieve({ x: px, y: py, radius: orbitRadius + 40 });
      for (const orb of this.orbitingOrbs) {
        for (const enemy of nearby) {
          if (enemy.dead || !orb.canHit(enemy.id)) continue;
          if (orb.collidesWith(enemy.x, enemy.y, enemy.radius)) {
            orb.markHit(enemy.id);
            this.dealAuxDamage(enemy, orb.damage, '#22e0ff');
          }
        }
      }
    }

    // --- Dropped bombs: on a cooldown, drop one at the player's feet; resolve the
    //     AoE blast the frame the fuse hits zero. ---
    if (this.playerStats.hasBombDrop()) {
      this.bombTimer -= dt;
      if (this.bombTimer <= 0) {
        this.bombs.push(new Bomb(px, py, 0.9, 110, this.playerStats.getBombDamage()));
        this.bombTimer = this.playerStats.getBombCooldown();
      }
    }
    for (const bomb of this.bombs) {
      bomb.update(dt);
      if (bomb.detonated && !bomb.dead) {
        this.detonateBomb(bomb);
        bomb.dead = true;
      }
    }

    // --- Nova pulse: expanding shockwave ring damaging each enemy once. ---
    if (this.playerStats.hasNova()) {
      this.novaTimer -= dt;
      if (this.novaTimer <= 0) {
        this.shockwaves.push(new Shockwave(px, py, 240, this.playerStats.getNovaDamage()));
        this.novaTimer = this.playerStats.getNovaCooldown();
        this.audio.playShoot();
      }
    }
    for (const wave of this.shockwaves) {
      wave.update(dt);
      const nearby = this.enemyQuadtree.retrieve({ x: wave.x, y: wave.y, radius: wave.radius + wave.band });
      for (const enemy of nearby) {
        if (enemy.dead || !wave.canHit(enemy.id)) continue;
        if (wave.ringContains(enemy.x, enemy.y, enemy.radius)) {
          wave.markHit(enemy.id);
          this.dealAuxDamage(enemy, wave.damage, '#a0f0ff');
        }
      }
    }

    // --- Whirling melee arc: swings on its OWN timer toward the nearest enemy,
    //     independent of the primary weapon, so a gun build still gets a blade. ---
    this.auxMeleeTimer -= dt;
    if (this.playerStats.hasAuxMelee() && this.auxMeleeTimer <= 0 && this.enemies.length > 0) {
      let nearest: Enemy | null = null;
      let nd = Infinity;
      for (const e of this.enemies) {
        const d = (e.x - px) ** 2 + (e.y - py) ** 2;
        if (d < nd) { nd = d; nearest = e; }
      }
      if (nearest) {
        const angle = Math.atan2(nearest.y - py, nearest.x - px);
        const dmg = this.playerStats.getAuxMeleeDamage();
        // Wide sweeping arc, pushed through the existing meleeAttacks pipeline so
        // its collision/knockback/kill handling is shared with real melee.
        this.meleeAttacks.push(new MeleeAttack(px, py, angle, Math.PI * 0.9, 95, dmg, 120));
      }
      this.auxMeleeTimer = 1.1;
    }
  }

  // Advance every telegraphed enemy AoE: tick its timer, spawn a burst when it
  // detonates, and damage the player if they're standing in the zone at impact.
  private updateAoeZones(dt: number): void {
    if (!this.player || this.aoeZones.length === 0) return;
    for (const zone of this.aoeZones) {
      zone.update(dt);
      if (zone.justDetonated) {
        // Impact burst FX at the marked spot.
        this.renderer.addScreenShake(0.15);
        for (let i = 0; i < 14; i++) {
          const angle = (Math.PI * 2 * i) / 14;
          const speed = 120 + Math.random() * 160;
          this.particles.push(this.createParticle({
            x: zone.x,
            y: zone.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: i % 2 === 0 ? '#ff5555' : '#ffcc44',
            size: 4 + Math.random() * 5,
            lifetime: 350 + Math.random() * 300,
            gravity: 120
          }));
        }
      }
      const dmg = zone.damageToPlayer(this.player.x, this.player.y, this.player.radius);
      if (dmg > 0) {
        const damaged = this.player.takeDamage(dmg);
        if (damaged) {
          this.applyThorns(dmg);
          this.renderer.addScreenShake(0.35);
          this.renderer.addHitFlash(0.5);
        }
      }
    }
  }

  /** Queue a telegraphed AoE attack (used by bosses / ranged enemies). */
  spawnAoeZone(zone: AoeZone): void {
    this.aoeZones.push(zone);
  }

  private detonateBomb(bomb: Bomb): void {
    const rSq = bomb.blastRadius * bomb.blastRadius;
    const nearby = this.enemyQuadtree.retrieve({ x: bomb.x, y: bomb.y, radius: bomb.blastRadius + 30 });
    for (const enemy of nearby) {
      if (enemy.dead) continue;
      const distSq = (enemy.x - bomb.x) ** 2 + (enemy.y - bomb.y) ** 2;
      if (distSq < rSq) this.dealAuxDamage(enemy, bomb.damage, '#ffaa00');
    }
    // Blast VFX + feedback.
    this.renderer.addScreenShake(0.35);
    this.audio.playHit();
    const pc = this.getParticleCount(24);
    for (let i = 0; i < pc; i++) {
      const a = (Math.PI * 2 * i) / Math.max(1, pc);
      const speed = 180 + Math.random() * 160;
      this.particles.push(this.createParticle({
        x: bomb.x, y: bomb.y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        color: i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? '#ffaa00' : '#ff4400'),
        size: 5 + Math.random() * 5,
        lifetime: 400 + Math.random() * 300,
        gravity: 60
      }));
    }
  }

  private grantXP(amount: number): void {
    if (!this.player) return;
    const leveledUp = this.player.addXP(amount);
    if (!leveledUp) return;
    this.audio.playLevelUp();
    // VAMPIRE SURVIVORS JUICE: Make level-ups feel MASSIVE
    this.renderer.addScreenShake(0.6);
    this.renderer.addHitFlash(0.4);
    this.screenEffects.addShake(ShakePresets.LEVEL_UP.intensity, ShakePresets.LEVEL_UP.duration);
    this.screenEffects.setZoom(1.05, 0.3);
    this.screenEffects.flash('#ffff00', 0.25);
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
    let finalXP = enemy.typeData.xpValue * xpMultiplier * this.playerStats.artifactXpMult;
    let finalGold = enemy.typeData.goldValue * goldMultiplier;
    // Item-based gold bonuses (Coin Purse, Midas Touch, Merchant) — were
    // sold but never applied
    finalGold *= this.playerStats.getGoldBonus();
    if (this.metaProgression.hasDoubleLevelUps()) {
      finalXP *= 2;
    }
    if (this.waveManager.waveModifier === 'elite' || this.waveManager.waveModifier === 'tank') {
      finalGold *= this.metaProgression.getEliteRewardMultiplier();
    }

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

    // XP now drops as collectable gems (granted on pickup, not on kill). Gold
    // stays instant. Split larger rewards into a few orbs for a satisfying pop,
    // capped so a dense wave can't flood the screen with pickups.
    const xpAward = Math.max(1, Math.floor(finalXP));
    const orbCount = Math.min(4, Math.max(1, Math.round(xpAward / 4)));
    const per = Math.floor(xpAward / orbCount);
    let remainder = xpAward - per * orbCount;
    for (let i = 0; i < orbCount; i++) {
      const share = per + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      this.xpOrbs.push(new XPOrb(enemy.x, enemy.y, share));
    }
    this.player.addGold(Math.floor(finalGold));

    // ARTIFACT: Vampiric Field — every kill restores a flat amount of HP.
    const vamp = this.artifacts.killHeal();
    if (vamp > 0) this.player.heal(vamp);

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

    // Segmented worm: when a segment dies, the chain SPLITS. Every body segment
    // that was following the dead one (directly or transitively) is severed; the
    // one immediately behind the break is promoted to a new independent head so
    // the two halves crawl off on their own. Killing the head splits at the neck.
    if (enemy.type === 'wormhead' || enemy.type === 'wormbody') {
      this.splitWorm(enemy);
    }

    // Egg sac: if it was destroyed BEFORE hatching, the threat is neutralised — no
    // spawn. (The dangerous hatch is handled separately when its timer elapses.)

    // Health orb drop (18% base, raised by luck)
    if (Math.random() < 0.18 * (1 + this.playerStats.getLuck())) {
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

  /**
   * Sever a worm chain at the dead segment. Any living segment whose follow-link
   * points (directly or transitively) at the dead one gets severed; the segment
   * that was following the dead one is promoted to a new head so the trailing
   * half crawls off on its own. This is what makes worms "split" on a body hit.
   */
  private splitWorm(dead: Enemy): void {
    // Find the segment that was directly following the one that died.
    const follower = this.enemies.find(
      e => !e.dead && e.type === 'wormbody' && e.wormLeader === dead
    );
    if (follower) {
      // Promote it: it becomes an independent head and drags whatever trails it.
      follower.type = 'wormhead';
      follower.wormIsHead = true;
      follower.wormLeader = null;
      follower.usePathfinding = false;
      // Small green splatter at the break so the split reads clearly.
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 80;
        this.particles.push(this.createParticle({
          x: follower.x,
          y: follower.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.5 ? '#e67e22' : '#d35400',
          size: 4 + Math.random() * 3,
          lifetime: 500 + Math.random() * 300,
          fadeOut: true
        }));
      }
    }
    // If anything else still points at the dead segment as leader (shouldn't
    // after promotion, but guard against stale links), null it so nothing chases a corpse.
    for (const e of this.enemies) {
      if (!e.dead && e.wormLeader === dead && e !== follower) e.wormLeader = null;
    }
  }

  /**
   * Egg sac reached the end of its timer without being killed: replace it with a
   * tougher enemy (its `eggHatchType`) at the egg's position, with a burst FX.
   */
  private hatchEgg(egg: Enemy): void {
    egg.dead = true;
    const spawned = new Enemy(egg.x, egg.y, egg.eggHatchType, 1.0);
    this.enemies.push(spawned);
    // Hatch burst — yellow shell shards.
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 90 + Math.random() * 70;
      this.particles.push(this.createParticle({
        x: egg.x,
        y: egg.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? '#f1c40f' : '#e67e22',
        size: 5 + Math.random() * 4,
        lifetime: 600 + Math.random() * 300,
        fadeOut: true
      }));
    }
    this.renderer.addScreenShake(0.35);
  }

  private enterShop(): void {
    this.showCombosOverlay = false; // always open the shop on the buy screen
    // BANKING INTEREST: reward saving gold — you earn interest on your balance
    // when you reach the shop. Capped so hoarding can't snowball out of control,
    // and it plays against rising shop prices (spend now vs. bank for a big buy).
    if (this.player) {
      const wave = this.waveManager.currentWave;
      const rate = 0.10 + this.playerStats.getInterestBonus(); // base 10% + banker items
      const cap = 10 + wave * 2; // scales with wave so it stays relevant, but bounded
      const interest = Math.min(cap, Math.floor(this.player.gold * rate));
      this.lastInterestGained = interest;
      if (interest > 0) this.player.addGold(interest);
    }

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
      this.playerStats.items, // Pass owned items for weighted generation
      this.playerStats.getLuck() // Luck tilts the shop toward higher rarities
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

    // BROTATO-LEVEL REROLL COST: wave-scaled base + meta policy + item discount
    const wave = currentWave;
    const rerollPolicy = this.metaProgression.getRerollDiscount();
    const baseRerollCost = Math.floor(wave * 0.75) + rerollPolicy.startCost;
    const rerollDiscount = this.playerStats.getRerollDiscount();
    this.shopRerollCost = Math.min(
      rerollPolicy.maxCost,
      Math.max(1, Math.floor(baseRerollCost * (1 - rerollDiscount)))
    );

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

  /**
   * On-hit item mechanics (chain lightning, freeze, poison, explosion) —
   * these items existed and were purchasable but had no implementation.
   */
  private applyOnHitEffects(enemy: Enemy, damage: number): void {
    // Elemental damage scales with the elemental-damage stat, so an "elemental mage"
    // build (chain/explosion) is mechanically distinct from raw melee/ranged.
    const elem = this.playerStats.getElementalDamageMult();
    // Chain lightning: arc to the nearest other enemy for 60% damage
    if (Math.random() < this.playerStats.getChainLightningChance()) {
      let nearest: Enemy | null = null;
      let bd = 200 * 200;
      for (const other of this.enemies) {
        if (other === enemy || other.dead) continue;
        const d = (other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2;
        if (d < bd) { bd = d; nearest = other; }
      }
      if (nearest) {
        const chainDmg = damage * 0.6 * elem;
        const splits = nearest.takeDamage(chainDmg);
        if (splits && splits.length > 0) this.enemies.push(...splits);
        this.damageNumbers.push(
          this.createDamageNumber(nearest.x, nearest.y - 20, chainDmg, false, '#ffd43b')
        );
        if (nearest.dead) this.handleEnemyKill(nearest);
      }
    }

    // Freeze: halt movement for 1s
    if (Math.random() < this.playerStats.getFreezeChance()) {
      enemy.frozenTimer = 1.0;
    }

    // Poison: DoT for 3s (ticked in the enemy loop)
    if (this.playerStats.hasPoison()) {
      enemy.poisonTimer = 3.0;
    }

    // Explosion on hit: AoE for 50% damage around the target
    if (this.playerStats.hasExplosionOnHit()) {
      for (const other of this.enemies) {
        if (other === enemy || other.dead) continue;
        if ((other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2 < 80 * 80) {
          const splits = other.takeDamage(damage * 0.5 * elem);
          if (splits && splits.length > 0) this.enemies.push(...splits);
          if (other.dead) this.handleEnemyKill(other);
        }
      }
      this.renderer.addImpactFlash(enemy.x, enemy.y);
    }
  }

  /** Thorns (Spiked Armor item + Spiked Aura artifact): reflect a share of damage taken. */
  private applyThorns(amount: number, source?: Enemy): void {
    // Item thorns and the Spiked Aura artifact stack additively.
    const thorns = this.playerStats.getThorns() + this.artifacts.thornsFraction();
    if (thorns <= 0 || !this.player) return;
    const reflected = amount * thorns;
    const targets = source
      ? [source]
      : this.enemyQuadtree.retrieve({ x: this.player.x, y: this.player.y, radius: 120 });
    for (const t of targets) {
      if (t.dead) continue;
      const splits = t.takeDamage(reflected);
      if (splits && splits.length > 0) this.enemies.push(...splits);
      if (t.dead) this.handleEnemyKill(t);
    }
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

  // "COMBOS ?" help button — top-left of the shop header (stats panel sits below
  // it on mobile; the inventory panel is top-right on desktop, so left is clear).
  private getCombosButtonRect() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const isMobile = this.canvas.width / zoom < 800;
    const width = s(isMobile ? 96 : 108);
    const height = s(isMobile ? 30 : 30);
    return { x: s(8), y: s(6), width, height };
  }

  private updateShop(): void {
    if (!this.player) return;

    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    // Layout shared with drawShop so hitboxes always match visuals
    const { s, isMobile, itemWidth, itemHeight, gap, startX, startY, lockButtonSize,
      buttonWidth, buttonHeight, continueY, rerollY } = this.getShopLayout();

    this.selectedShopItem = -1;

    // COMBOS guide button (top-right of shop header) — explains synergies/duos.
    const combosBtn = this.getCombosButtonRect();
    // When the overlay is open it owns ALL input: a tap on the button toggles it
    // off, a tap anywhere else closes it. Nothing beneath it is interactable.
    if (this.showCombosOverlay) {
      if (this.input.mouseDown) {
        this.showCombosOverlay = false;
        this.input.mouseDown = false;
      }
      return;
    }
    if (pointInRect(mouseX, mouseY, combosBtn) && this.input.mouseDown) {
      this.showCombosOverlay = true;
      this.input.mouseDown = false;
      return;
    }

    // Full-stats popup: same own-all-input pattern as the combos overlay.
    if (this.showStatsPopup) {
      if (this.input.mouseDown) {
        this.showStatsPopup = false;
        this.input.mouseDown = false;
      }
      return;
    }
    if (pointInRect(mouseX, mouseY, this.statsPanelRect) && this.input.mouseDown) {
      this.showStatsPopup = true;
      this.input.mouseDown = false;
      return;
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
      this.toMapFromShop();
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
          this.playerStats.items, // Pass owned items for tag weighting
          this.playerStats.getLuck() // Luck tilts the shop toward higher rarities
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
        // Always at least +1 — a zero increment allowed unlimited flat-price
        // rerolls on waves 1-2
        const rerollScaling = Math.max(1, Math.floor(wave * 0.4));
        this.shopRerollCost = Math.min(
          this.metaProgression.getRerollDiscount().maxCost,
          this.shopRerollCost + rerollScaling
        );

        this.shopRerolls++;
        this.audio.playPurchase();
        this.input.mouseDown = false;
      }
    }
  }

  private startNextWave(opts?: { elite?: boolean; boss?: boolean }): void {
    // ARTIFACT: re-arm Second Wind and reset the momentum ramp at each wave start.
    if (this.player) this.player.secondWindArmed = this.artifacts.hasSecondWind();
    this.momentumTime = 0;
    this.syncArtifactStatic();

    this.waveManager.startWave(this.waveManager.currentWave + 1, opts);
    this.waveModifierTimer = 3; // Show wave modifier for 3 seconds
    // Always flash the wave's unique intro line (phase 0 text) so every wave
    // reads as named/themed, even the plain ones with no modifier.
    this.phaseBannerText = this.waveManager.phaseText;
    this.phaseBannerTimer = 2.6;
    this.state = 'playing';

    // Reset mouse state to prevent accidental clicks
    this.input.mouseDown = false;
  }

  // ===================================================================
  // MAP / NODE META-LAYER
  // ===================================================================

  /** Open the map after the shop. Generates the next act if the boss was cleared. */
  private toMapFromShop(): void {
    if (this.mapSystem.isActComplete() || !this.mapSystem.map) {
      const nextAct = (this.mapSystem.map?.act ?? 0) + 1;
      this.mapSystem.generateAct(nextAct);
    }
    this.state = 'map';
    this.input.mouseDown = false;
  }

  /** Resolve a picked map node into the appropriate game state / reward. */
  private onMapNodePicked(nodeId: string): void {
    const node = this.mapSystem.pick(nodeId);
    if (!node) return;
    this.input.mouseDown = false;
    switch (node.type) {
      case 'battle':
        this.startNextWave();
        break;
      case 'elite':
        this.pendingWaveArtifact = true;
        this.startNextWave({ elite: true });
        break;
      case 'boss':
        this.pendingWaveArtifact = true;
        this.startNextWave({ boss: true });
        break;
      case 'event':
        this.currentEvent = randomEvent();
        this.eventResultText = null;
        this.state = 'event';
        break;
      case 'treasure':
        // Free artifact pick, no fight; return to the map afterward.
        this.offerArtifactReward('TREASURE', () => { this.state = 'map'; });
        break;
      case 'rest':
        this.restResolved = false;
        this.restResultText = '';
        this.state = 'rest';
        break;
    }
  }

  /** Build a 1-of-3 artifact offer and show the reward screen. */
  private offerArtifactReward(title: string, then: () => void): void {
    const pool = ARTIFACTS.filter(a => !this.artifacts.has(a.id));
    if (pool.length === 0) {
      // Nothing left to grant — skip straight to the continuation.
      then();
      return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    this.rewardChoices = shuffled.slice(0, Math.min(3, shuffled.length));
    this.rewardTitle = title;
    this.rewardThen = then;
    this.state = 'reward';
    this.input.mouseDown = false;
  }

  /** Grant an artifact: fold its static stats in, refresh max HP, sync runtime flags. */
  private grantArtifact(artifact: Artifact): void {
    this.artifacts.add(artifact, this.playerStats);
    this.refreshMaxHealth();
    this.syncArtifactStatic();
    if (this.player) this.player.secondWindArmed = this.artifacts.hasSecondWind();
  }

  /** Push constant (non-per-frame) artifact hooks onto the player. */
  private syncArtifactStatic(): void {
    if (this.player) this.player.incomingDamageMult = this.artifacts.incomingDamageMult();
  }

  /** Per-frame runtime artifact effects: momentum (moving) + berserk (low HP). */
  private updateArtifactRuntime(dt: number, moving: boolean): void {
    if (!this.player) return;
    // Momentum: ramp up over ~3s of continuous movement, reset when standing still.
    const momentumMax = this.artifacts.momentumBonus();
    if (momentumMax > 0) {
      this.momentumTime = moving ? Math.min(3, this.momentumTime + dt) : 0;
      this.playerStats.runtimeDamageMult = 1 + momentumMax * (this.momentumTime / 3);
    } else {
      this.playerStats.runtimeDamageMult = 1;
    }
    // Berserk: extra fire rate as HP drops (0 at full HP, full bonus near death).
    const berserkMax = this.artifacts.berserkBonus();
    if (berserkMax > 0) {
      const missing = 1 - this.player.health / Math.max(1, this.player.maxHealth);
      this.playerStats.runtimeFireRateMult = 1 + berserkMax * missing;
    } else {
      this.playerStats.runtimeFireRateMult = 1;
    }
  }

  // ---- shared UI helpers for the meta-layer screens ----

  /** Zoom-scale helper shared by the map/event/reward/rest screens. */
  private screenScale() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;
    return { zoom, s, W, H, isMobile };
  }

  /** A centred vertical stack of button rects — geometry both draw & update use. */
  private columnRects(n: number, topY: number, s: (v: number) => number, W: number, isMobile: boolean) {
    const bw = Math.min(W - s(40), s(isMobile ? 320 : 440));
    const bh = s(isMobile ? 54 : 48);
    const gap = s(12);
    const x = (W - bw) / 2;
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < n; i++) rects.push({ x, y: topY + i * (bh + gap), width: bw, height: bh });
    return rects;
  }

  /** Word-wrap `text` to `maxWidth` px at the given font size (approximate measure). */
  private wrapText(text: string, maxWidth: number, fontPx: number): string[] {
    const ctx = this.renderer.getContext();
    ctx.save();
    ctx.font = `${fontPx}px sans-serif`;
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  }

  private paintBackdrop(): void {
    const ctx = this.renderer.getContext();
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  // ---- MAP screen ----

  private drawMap(): void {
    const ctx = this.renderer.getContext();
    const { s, W, H, isMobile } = this.screenScale();
    this.paintBackdrop();
    const map = this.mapSystem.map;
    if (!map) return;

    this.renderer.drawText('CHOOSE YOUR PATH', W / 2, s(28), { size: s(isMobile ? 15 : 22), align: 'center', color: '#ffd700' });
    this.renderer.drawText(`Act ${map.act}`, W / 2, s(28) + s(isMobile ? 16 : 22), { size: s(isMobile ? 9 : 11), align: 'center', color: '#c8b998' });

    const placements = this.mapSystem.layout(W, H, s);
    const reachable = new Set(this.mapSystem.reachable());

    // Edges first (behind the nodes). Live edges (from the current node to a
    // pickable node) glow gold; the rest are dim brown scaffolding.
    ctx.save();
    ctx.lineWidth = Math.max(1, s(2));
    for (const node of map.nodes) {
      const from = placements.get(node.id);
      if (!from) continue;
      for (const eid of node.edges) {
        const to = placements.get(eid);
        if (!to) continue;
        const live = map.currentId === node.id && reachable.has(eid);
        ctx.strokeStyle = live ? 'rgba(242,217,78,0.9)' : 'rgba(120,90,50,0.35)';
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    const colors: Record<NodeType, string> = {
      battle: '#c0855a', elite: '#d9534f', event: '#5bc0de',
      treasure: '#f2d94e', rest: '#8ce99a', boss: '#b06bd9',
    };

    for (const node of map.nodes) {
      const p = placements.get(node.id);
      if (!p) continue;
      const canPick = reachable.has(node.id);
      const isCurrent = map.currentId === node.id;
      ctx.save();
      ctx.globalAlpha = (canPick || isCurrent || node.visited) ? 1 : 0.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = (node.visited && !isCurrent) ? '#3a2c1a' : colors[node.type];
      ctx.fill();
      ctx.lineWidth = s(canPick ? 3 : 2);
      ctx.strokeStyle = isCurrent ? '#ffffff' : (canPick ? '#fff2b0' : '#2a1c0e');
      ctx.stroke();
      ctx.restore();

      this.renderer.drawText(nodeIcon(node.type), p.x, p.y - s(5), { size: s(isMobile ? 14 : 17), align: 'center', color: '#1a1008' });
      this.renderer.drawText(nodeLabel(node.type), p.x, p.y + p.r + s(3), { size: s(isMobile ? 7 : 8), align: 'center', color: canPick ? '#ffffff' : '#9a8a6a' });
    }

    this.renderer.drawText(
      map.currentId ? 'Tap a lit node to advance' : 'Tap a starting node',
      W / 2, H - s(22), { size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998' }
    );
  }

  private updateMap(): void {
    if (!this.input.mouseDown) return;
    const { s, W, H } = this.screenScale();
    const placements = this.mapSystem.layout(W, H, s);
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    for (const id of this.mapSystem.reachable()) {
      const p = placements.get(id);
      if (!p) continue;
      const dx = mx - p.x;
      const dy = my - p.y;
      const hit = p.r * 1.6; // generous tap target for mobile
      if (dx * dx + dy * dy <= hit * hit) {
        this.input.mouseDown = false;
        this.onMapNodePicked(id);
        return;
      }
    }
  }

  // ---- EVENT screen ----

  private drawEvent(): void {
    const ctx = this.renderer.getContext();
    const { s, W, H, isMobile } = this.screenScale();
    this.paintBackdrop();
    const ev = this.currentEvent;
    if (!ev) return;

    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 560));
    const x0 = (W - contentW) / 2;
    drawPanel(ctx, x0 - s(8), s(12), contentW + s(16), H - s(24), DARK_WOOD_THEME, 7, 31);

    let y = s(isMobile ? 26 : 34);
    this.renderer.drawText(ev.title, W / 2, y, { size: s(isMobile ? 14 : 18), align: 'center', color: '#ffd700' });
    y += s(isMobile ? 20 : 26);

    const bodyPx = s(isMobile ? 9 : 11);
    for (const line of this.wrapText(ev.text, contentW - s(24), bodyPx)) {
      this.renderer.drawText(line, W / 2, y, { size: bodyPx, align: 'center', color: '#d8c9a8' });
      y += bodyPx + s(5);
    }
    y += s(10);

    if (this.eventResultText === null) {
      const rects = this.columnRects(ev.options.length, y, s, W, isMobile);
      ev.options.forEach((opt, i) => {
        const r = rects[i];
        this.renderer.drawButton(r.x, r.y, r.width, r.height, opt.label, false, true, isMobile);
      });
    } else {
      for (const line of this.wrapText(this.eventResultText, contentW - s(24), bodyPx)) {
        this.renderer.drawText(line, W / 2, y, { size: bodyPx, align: 'center', color: '#8ce99a' });
        y += bodyPx + s(5);
      }
      y += s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      this.renderer.drawButton(r.x, r.y, r.width, r.height, 'Continue', true, true, isMobile);
    }
  }

  private updateEvent(): void {
    if (!this.input.mouseDown) return;
    const ev = this.currentEvent;
    if (!ev) return;
    const { s, W, H, isMobile } = this.screenScale();
    const mx = this.input.mouseX;
    const my = this.input.mouseY;

    // Recompute the same vertical anchor the draw pass uses.
    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 560));
    let y = s(isMobile ? 26 : 34) + s(isMobile ? 20 : 26);
    const bodyPx = s(isMobile ? 9 : 11);
    y += this.wrapText(ev.text, contentW - s(24), bodyPx).length * (bodyPx + s(5));
    y += s(10);

    if (this.eventResultText === null) {
      const rects = this.columnRects(ev.options.length, y, s, W, isMobile);
      for (let i = 0; i < ev.options.length; i++) {
        if (pointInRect(mx, my, rects[i])) {
          this.input.mouseDown = false;
          const opt = ev.options[i];
          for (const eff of opt.effects) this.applyEventEffect(eff);
          this.eventResultText = opt.result;
          return;
        }
      }
    } else {
      y += this.wrapText(this.eventResultText, contentW - s(24), bodyPx).length * (bodyPx + s(5)) + s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      if (pointInRect(mx, my, r)) {
        this.input.mouseDown = false;
        this.currentEvent = null;
        this.eventResultText = null;
        this.state = 'map';
      }
    }
    void H;
  }

  private applyEventEffect(effect: EventEffect): void {
    if (!this.player) return;
    switch (effect.kind) {
      case 'gold':
        this.player.gold = Math.max(0, this.player.gold + effect.amount);
        break;
      case 'heal':
        this.player.health = Math.min(this.player.maxHealth, this.player.health + Math.round(effect.frac * this.player.maxHealth));
        break;
      case 'hurt': {
        const dmg = Math.round(effect.frac * this.player.maxHealth);
        this.player.health = Math.max(1, this.player.health - dmg); // event damage never kills
        break;
      }
      case 'maxHp':
        this.playerStats.baseMaxHealth += effect.amount;
        this.refreshMaxHealth();
        break;
      case 'artifact': {
        const pool = ARTIFACTS.filter(a => !this.artifacts.has(a.id));
        if (pool.length) this.grantArtifact(pool[Math.floor(Math.random() * pool.length)]);
        break;
      }
      case 'item': {
        const items = ItemDatabase.getWeightedShopItems(1, this.waveManager.currentWave, this.playerStats.items, this.playerStats.getLuck());
        if (items[0]) { this.playerStats.addItem(items[0]); this.refreshMaxHealth(); }
        break;
      }
      case 'nothing':
        break;
    }
  }

  // ---- REWARD screen (1-of-3 artifact pick) ----

  private drawReward(): void {
    const ctx = this.renderer.getContext();
    const { s, W, isMobile } = this.screenScale();
    this.paintBackdrop();

    this.renderer.drawText(this.rewardTitle || 'CHOOSE AN ARTIFACT', W / 2, s(isMobile ? 26 : 34), { size: s(isMobile ? 14 : 20), align: 'center', color: '#ffd700' });
    this.renderer.drawText('Artifacts last the whole run', W / 2, s(isMobile ? 26 : 34) + s(isMobile ? 16 : 20), { size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998' });

    const rarityColor: Record<string, string> = { rare: '#74c0fc', epic: '#b06bd9', legendary: '#f2b04e' };
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
    const cardH = s(isMobile ? 74 : 68);
    const gap = s(12);
    const x0 = (W - cardW) / 2;
    const topY = s(isMobile ? 72 : 92);
    const bodyPx = s(isMobile ? 8 : 9);

    this.rewardChoices.forEach((a, i) => {
      const y = topY + i * (cardH + gap);
      drawPanel(ctx, x0, y, cardW, cardH, DARK_WOOD_THEME, 11 + i, 53);
      this.renderer.drawText(a.name, x0 + s(12), y + s(isMobile ? 16 : 18), { size: s(isMobile ? 11 : 13), align: 'left', color: rarityColor[a.rarity] || '#ffffff' });
      this.renderer.drawText(a.rarity.toUpperCase(), x0 + cardW - s(12), y + s(isMobile ? 16 : 18), { size: s(7), align: 'right', color: rarityColor[a.rarity] || '#ffffff' });
      for (const [li, line] of this.wrapText(a.desc, cardW - s(24), bodyPx).entries()) {
        this.renderer.drawText(line, x0 + s(12), y + s(isMobile ? 34 : 36) + li * (bodyPx + s(3)), { size: bodyPx, align: 'left', color: '#d8c9a8' });
      }
    });
  }

  private updateReward(): void {
    if (!this.input.mouseDown) return;
    const { s, W, isMobile } = this.screenScale();
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
    const cardH = s(isMobile ? 74 : 68);
    const gap = s(12);
    const x0 = (W - cardW) / 2;
    const topY = s(isMobile ? 72 : 92);
    const mx = this.input.mouseX;
    const my = this.input.mouseY;

    for (let i = 0; i < this.rewardChoices.length; i++) {
      const y = topY + i * (cardH + gap);
      if (pointInRect(mx, my, { x: x0, y, width: cardW, height: cardH })) {
        this.input.mouseDown = false;
        this.grantArtifact(this.rewardChoices[i]);
        const then = this.rewardThen;
        this.rewardChoices = [];
        this.rewardThen = null;
        if (then) then();
        return;
      }
    }
  }

  // ---- REST screen ----

  private drawRest(): void {
    const ctx = this.renderer.getContext();
    const { s, W, H, isMobile } = this.screenScale();
    this.paintBackdrop();

    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 520));
    const x0 = (W - contentW) / 2;
    drawPanel(ctx, x0 - s(8), s(12), contentW + s(16), H - s(24), DARK_WOOD_THEME, 19, 61);

    let y = s(isMobile ? 30 : 40);
    this.renderer.drawText('A QUIET CAMPFIRE', W / 2, y, { size: s(isMobile ? 14 : 18), align: 'center', color: '#ffd700' });
    y += s(isMobile ? 22 : 28);
    const bodyPx = s(isMobile ? 9 : 11);

    if (!this.restResolved) {
      this.renderer.drawText('Take a moment. Choose one.', W / 2, y, { size: bodyPx, align: 'center', color: '#d8c9a8' });
      y += s(isMobile ? 18 : 22);
      const rects = this.columnRects(2, y, s, W, isMobile);
      this.renderer.drawButton(rects[0].x, rects[0].y, rects[0].width, rects[0].height, 'Rest — heal 40% HP', false, true, isMobile);
      this.renderer.drawButton(rects[1].x, rects[1].y, rects[1].width, rects[1].height, 'Train — +15 max HP', false, true, isMobile);
    } else {
      for (const line of this.wrapText(this.restResultText, contentW - s(24), bodyPx)) {
        this.renderer.drawText(line, W / 2, y, { size: bodyPx, align: 'center', color: '#8ce99a' });
        y += bodyPx + s(5);
      }
      y += s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      this.renderer.drawButton(r.x, r.y, r.width, r.height, 'Continue', true, true, isMobile);
    }
  }

  private updateRest(): void {
    if (!this.input.mouseDown || !this.player) return;
    const { s, W, H, isMobile } = this.screenScale();
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    let y = s(isMobile ? 30 : 40) + s(isMobile ? 22 : 28);
    const bodyPx = s(isMobile ? 9 : 11);

    if (!this.restResolved) {
      y += s(isMobile ? 18 : 22);
      const rects = this.columnRects(2, y, s, W, isMobile);
      if (pointInRect(mx, my, rects[0])) {
        this.input.mouseDown = false;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + Math.round(0.4 * this.player.maxHealth));
        this.restResolved = true;
        this.restResultText = 'You rest by the fire and recover your strength.';
        return;
      }
      if (pointInRect(mx, my, rects[1])) {
        this.input.mouseDown = false;
        this.playerStats.baseMaxHealth += 15;
        this.refreshMaxHealth();
        this.restResolved = true;
        this.restResultText = 'You train through the night. You feel permanently hardier.';
        return;
      }
    } else {
      const contentW = Math.min(W - s(24), s(isMobile ? 372 : 520));
      y += this.wrapText(this.restResultText, contentW - s(24), bodyPx).length * (bodyPx + s(5)) + s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      if (pointInRect(mx, my, r)) {
        this.input.mouseDown = false;
        this.state = 'map';
      }
    }
    void H;
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

  /** Shared grid layout for the meta-upgrades screen (draw + clicks). */
  private getUpgradesLayout() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const cssW = this.canvas.width / zoom;
    const cols = cssW >= 900 ? 3 : 2;
    const gap = s(6);
    const cellW = Math.min(s(300), Math.floor((this.canvas.width - s(20) - gap * (cols - 1)) / cols));
    const cellH = cols === 3 ? s(80) : s(72);
    const gridW = cellW * cols + gap * (cols - 1);
    const startX = Math.round((this.canvas.width - gridW) / 2);
    const startY = s(96);
    const backBtn = { x: s(10), y: s(10), width: s(120), height: s(36) };
    return { s, cols, cellW, cellH, gap, startX, startY, backBtn };
  }

  private updateUpgrades(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;
    const { cols, cellW, cellH, gap, startX, startY, backBtn } = this.getUpgradesLayout();

    const upgrades = this.metaProgression.getAllUpgrades();
    for (let i = 0; i < upgrades.length; i++) {
      const x = startX + (i % cols) * (cellW + gap);
      const y = startY + Math.floor(i / cols) * (cellH + gap);
      if (pointInRect(mouseX, mouseY, { x, y, width: cellW, height: cellH })) {
        if (this.input.mouseDown && this.metaProgression.canPurchaseUpgrade(upgrades[i].id)) {
          this.metaProgression.purchaseUpgrade(upgrades[i].id);
          this.audio.playPurchase();
          this.input.mouseDown = false;
        }
      }
    }

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
      items: this.playerStats.items.map(item => item.id),
      artifactIds: this.artifacts.held.map(a => a.id),
      actMap: serializeMap(this.mapSystem.map)
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
      case 'map':
        this.drawMap();
        break;
      case 'event':
        this.drawEvent();
        break;
      case 'reward':
        this.drawReward();
        break;
      case 'rest':
        this.drawRest();
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

    // Auto-fit long lines to the viewport so they never clip off narrow portrait.
    const textMax = this.canvas.width - s(24);
    this.renderer.drawText('WASD OR TOUCH JOYSTICK', cx, s(140), {
      size: s(10), align: 'center', color: '#dfe6ee', maxWidth: textMax
    });
    this.renderer.drawText('BUILD A BROKEN BUILD IN THE SHOP. SURVIVE.', cx, s(162), {
      size: s(10), align: 'center', color: '#dfe6ee', maxWidth: textMax
    });

    this.renderer.drawText(`SOULS ${this.metaProgression.souls}`, cx, s(196), {
      size: s(14), align: 'center', color: '#b197fc', maxWidth: textMax
    });

    const stats = SaveManager.getStats();
    this.renderer.drawText(
      `BEST WAVE ${stats.highestWave}   RUNS ${stats.totalRuns}   KILLS ${stats.totalKills}`,
      cx, s(226), { size: s(9), align: 'center', color: '#aab6c3', maxWidth: textMax }
    );
  }

  private drawPlaying(): void {
    if (!this.player) return;

    const ctx = this.renderer.getContext();

    // GAME FEEL: Apply screen effects (shake, zoom) before rendering
    ctx.save();
    this.screenEffects.applyToContext(ctx, this.canvas.width, this.canvas.height);

    // PERFORMANCE: Update entity culler viewport
    this.entityCuller.updateViewport(0, 0, this.worldWidth, this.worldHeight, 100);

    // ZOOM-OUT: render the world at 1/scale so the 2x-larger arena fits the screen
    // (player/monsters read smaller, more battlefield visible). GUI is drawn after
    // this transform is restored, so it stays full-size in screen space.
    ctx.save();
    ctx.scale(1 / this.WORLD_SCALE, 1 / this.WORLD_SCALE);

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

    // Ground-level aux weapons (under enemies): nova rings + armed bombs.
    for (const wave of this.shockwaves) wave.draw(ctx);
    for (const bomb of this.bombs) bomb.draw(ctx);

    // Telegraphed enemy AoE markers: on the ground, under enemies, so the red
    // danger zones read as floor markings the player can step out of.
    for (const zone of this.aoeZones) zone.draw(ctx);

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

    for (const orb of this.xpOrbs) {
      if (this.entityCuller.isVisible(orb)) {
        orb.draw(ctx);
      }
    }

    this.player.draw(ctx);

    // Orbiting orbs draw over the player so the ring reads clearly.
    for (const orb of this.orbitingOrbs) orb.draw(ctx);

    for (const num of this.damageNumbers) {
      num.draw(ctx);
    }

    // ZOOM-OUT: end the world transform — everything below is screen-space GUI.
    ctx.restore();

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

    // Mid-wave sub-phase banner (waves-within-waves) — smaller, lower, and it
    // does not fight the main wave banner for the same screen real estate.
    if (this.phaseBannerTimer > 0 && this.phaseBannerText) {
      const alpha = Math.min(1, this.phaseBannerTimer / 0.8);
      const ctx = this.renderer.getContext();
      ctx.save();
      ctx.globalAlpha = alpha;
      this.renderer.drawText(this.phaseBannerText, this.canvas.width / 2, this.canvas.height / 2 + 10, {
        size: 24,
        bold: true,
        align: 'center',
        color: '#ffd24d'
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
      ...this.healthOrbs,
      ...this.xpOrbs
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
      xpOrbs: this.xpOrbs.length,
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
    const t = Math.max(0, Math.ceil(this.waveManager.waveTimer));
    const timerText = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.renderer.drawText(
      `${timerText}  ·  ${this.enemies.length + this.waveManager.waveEnemiesRemaining}`,
      rx + rPanelW / 2, s(6) + pad + s(22),
      { size: s(8), align: 'center', color: t <= 5 ? '#ffd43b' : '#cfd8e3' }
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

  // Duo/combo info for a shop card so synergies are legible: which named combo this item
  // belongs to, its partner, its effect, and whether buying it would COMPLETE the combo.
  // Prefers a duo you can complete now; otherwise surfaces one to teach the pairing.
  private getCardDuoInfo(item: Item): { name: string; partner: string; effect: string; completes: boolean } | null {
    let discovery: { name: string; partner: string; effect: string; completes: boolean } | null = null;
    for (const duo of DUO_COMBOS) {
      const isItem1 = item.id === duo.item1Id;
      const isItem2 = item.id === duo.item2Id;
      if (!isItem1 && !isItem2) continue;
      const partnerId = isItem1 ? duo.item2Id : duo.item1Id;
      const partner = ItemDatabase.getItemById(partnerId);
      const ownsPartner = this.playerStats.items.some(o => o.id === partnerId);
      const effect = duo.specialEffect || duo.description;
      if (ownsPartner) {
        // Buying this completes the combo — highest priority, return immediately.
        return { name: duo.name, partner: partner?.name ?? '?', effect, completes: true };
      }
      // Otherwise remember the first pairing to teach ("combos with X").
      if (!discovery) discovery = { name: duo.name, partner: partner?.name ?? '?', effect, completes: false };
    }
    return discovery;
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

    // COMBOS help button (top-left) — opens the synergy guide. Shows the count of
    // active duos so a live combo is visible at a glance and invites a tap.
    {
      const btn = this.getCombosButtonRect();
      const activeCount = this.playerStats.getActiveDuos().length;
      ctx.save();
      ctx.fillStyle = activeCount > 0 ? '#3d2f12' : '#2e1c0e';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeStyle = activeCount > 0 ? '#ffd43b' : '#c8a15a';
      ctx.lineWidth = 2;
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
      ctx.restore();
      const label = activeCount > 0 ? `COMBOS ${activeCount}★` : 'COMBOS ?';
      this.renderer.drawText(label, btn.x + btn.width / 2, btn.y + Math.round(btn.height * 0.28), {
        size: s(8),
        align: 'center',
        color: activeCount > 0 ? '#ffe066' : '#e5d9c3'
      });
    }

    // Banking interest earned this shop (save-vs-spend feedback)
    if (this.lastInterestGained > 0) {
      this.renderer.drawText(
        `+${this.lastInterestGained}g interest`,
        this.canvas.width / 2, s(isMobile ? 46 : 66),
        { size: s(7), align: 'center', color: '#8ce99a' }
      );
    }

    // PLAYER STATS PANEL - compact display on the left side (desktop) or top (mobile)
    const statPanelPadding = s(8);
    const statPanelWidth = isMobile ? this.canvas.width - s(20) : s(220);
    const statPanelHeight = isMobile ? s(38) : s(140);
    const statPanelX = s(10);
    const statPanelY = isMobile ? s(64) : s(56);

    // Stats panel: wood, pixel font, no emoji
    drawPanel(ctx, statPanelX, statPanelY, statPanelWidth, statPanelHeight, DARK_WOOD_THEME, 4, 11);
    // Remember the panel bounds so updateShop can make it tappable (→ full stats popup).
    this.statsPanelRect = { x: statPanelX, y: statPanelY, width: statPanelWidth, height: statPanelHeight };

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

    // "Tap for all stats" affordance — small hint so players know the panel opens a full breakdown.
    if (isMobile) {
      this.renderer.drawText('TAP ▸ ALL STATS', statPanelX + statPanelWidth - statPanelPadding - 2, statPanelY + statPanelHeight - s(5), {
        size: s(5.5), color: '#ffe08a', align: 'right'
      });
    } else {
      this.renderer.drawText('TAP FOR ALL STATS ▸', statPanelX + statPanelWidth / 2, statPanelY + statPanelHeight - s(9), {
        size: s(7), color: '#ffe08a', align: 'center'
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
      // Named combo this item is part of (its effect + partner + whether buying completes it).
      // Completing a duo is the game's biggest threshold moment → loudest highlight.
      const duoInfo = this.getCardDuoInfo(item);
      const completesDuo = duoInfo?.completes ?? false;

      // Card: wood panel with a crisp rarity/synergy-colored inner border
      // (pixel-art treatment — no glows, no gradients)
      drawPanel(ctx, x, y, itemWidth, itemHeight, DARK_WOOD_THEME, 4, i);
      let borderColor = rarityColor;
      if (completesDuo) borderColor = '#ffd43b';
      else if (isDuplicate) borderColor = '#4a9eff';
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

      // Synergy indicator — NAME the combo so it's legible, not a vague "SYNERGY".
      // Priority: completes a named duo > teaches an unowned duo pairing > tag synergy.
      if (completesDuo || duoInfo || hasTagMatch || hasSynergy) {
        let indicatorText = '';
        let indicatorColor = '#00ff00';
        if (completesDuo && duoInfo) {
          // You own the partner — buying this fires the combo now.
          indicatorText = `⚡ ${duoInfo.name.toUpperCase()}`;
          indicatorColor = '#ffd43b';
        } else if (duoInfo) {
          // Part of a named combo you don't have the partner for yet — teach the pairing.
          indicatorText = `🔗 + ${duoInfo.partner}`;
          indicatorColor = '#74c0fc';
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
          indicatorText = `${matchIcons} FITS BUILD`;
          indicatorColor = '#7bd94a';
        } else if (hasSynergy) {
          indicatorText = '⚡ GOOD FIT';
          indicatorColor = '#7bd94a';
        }

        if (indicatorText) {
          this.renderer.drawText(indicatorText, x + itemWidth / 2, y + s(6), {
            size: synergySize,
            align: 'center',
            color: indicatorColor,
            maxWidth: itemWidth - s(10)
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

      // Description (more compact) — swapped for the combo payoff when you'd complete a duo,
      // so the card tells you WHAT the synergy does at the moment of decision, not just its name.
      if (completesDuo && duoInfo) {
        this.renderer.drawText(duoInfo.effect, x + itemWidth / 2, y + descY, {
          size: descSize,
          align: 'center',
          color: '#ffe066',
          maxWidth: itemWidth - s(12)
        });
      } else {
        this.renderer.drawText(item.description, x + itemWidth / 2, y + descY, {
          size: descSize,
          align: 'center',
          color: '#e5d9c3'
        });
      }

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

    // COMBOS guide overlay draws last so it sits on top of the whole shop.
    if (this.showCombosOverlay) this.drawCombosOverlay();
    // Full-stats popup draws on top of everything (opened by tapping the stats panel).
    if (this.showStatsPopup) this.drawStatsPopup();
  }

  // Full-screen breakdown of EVERY stat and bonus (not just the six on the shop
  // panel). Grouped into Offense / Defense / Utility / Economy / Special, two
  // columns on desktop, one on mobile. Only rows that differ from the base value
  // or are actually active are shown, so the list reads as "what makes YOUR build".
  // Mobile-safe: opened by a tap on the stats panel, dismissed by a tap anywhere.
  private drawStatsPopup(): void {
    const ctx = this.renderer.getContext();
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;
    const ps = this.playerStats;

    // Build grouped rows. Each row is [label, value, alwaysShow?]. A row is shown
    // if alwaysShow OR its value string isn't a "zero/none" default.
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const mult = (v: number) => `${v.toFixed(2)}x`;
    type Row = [string, string, boolean];
    const groups: Array<[string, string, Row[]]> = [
      ['OFFENSE', '#ffa94d', [
        ['Damage', `${Math.floor(ps.getDamage())}`, true],
        ['Fire Rate', `${ps.getFireRate().toFixed(2)}/s`, true],
        ['Multishot', `+${ps.getMultishot()}`, ps.getMultishot() > 0],
        ['Crit Chance', pct(ps.getCritChance()), true],
        ['Crit Damage', mult(ps.getCritMultiplier()), true],
        ['Piercing', `${ps.getPiercing()}`, ps.getPiercing() > 0],
        ['Knockback', `${Math.round(ps.getKnockback())}`, ps.getKnockback() > 0],
        ['Projectile Speed', `${Math.round(ps.getProjectileSpeed())}`, false],
        ['Melee Dmg', mult(ps.getMeleeDamageMult()), ps.getMeleeDamageMult() > 1.001],
        ['Ranged Dmg', mult(ps.getRangedDamageMult()), ps.getRangedDamageMult() > 1.001],
        ['Elemental Dmg', mult(ps.getElementalDamageMult()), ps.getElementalDamageMult() > 1.001],
      ]],
      ['DEFENSE', '#74c0fc', [
        ['Max Health', `${ps.getMaxHealth()}`, true],
        ['Armor', `${Math.round(ps.getArmor())}`, ps.getArmor() > 0],
        ['Dodge', pct(ps.getDodgeChance()), ps.getDodgeChance() > 0],
        ['HP Regen', `${ps.getHealthRegen().toFixed(1)}/s`, ps.getHealthRegen() > 0],
        ['Shield', ps.hasShield() ? 'YES' : '-', ps.hasShield()],
        ['Lifesteal', pct(ps.getLifesteal()), ps.getLifesteal() > 0],
        ['Thorns', `${Math.round(ps.getThorns())}`, ps.getThorns() > 0],
      ]],
      ['UTILITY', '#8ce99a', [
        ['Move Speed', `${Math.round(ps.getSpeed())}`, true],
        ['XP Magnet', mult(ps.getXPMagnet()), ps.getXPMagnet() > 1.001],
      ]],
      ['ECONOMY', '#ffd43b', [
        ['Gold Bonus', pct(ps.getGoldBonus() - 1), ps.getGoldBonus() > 1.001],
        ['Luck', pct(ps.getLuck()), ps.getLuck() > 0],
        ['Shop Discount', pct(ps.getShopDiscount()), ps.getShopDiscount() > 0],
        ['Reroll Discount', pct(ps.getRerollDiscount()), ps.getRerollDiscount() > 0],
        ['Recycle Bonus', pct(ps.getRecycleBonus()), ps.getRecycleBonus() > 0],
        ['Bank Interest', pct(ps.getInterestBonus()), ps.getInterestBonus() > 0],
      ]],
      ['SPECIAL', '#e599f7', [
        ['Chain Lightning', pct(ps.getChainLightningChance()), ps.getChainLightningChance() > 0],
        ['Freeze', pct(ps.getFreezeChance()), ps.getFreezeChance() > 0],
        ['Poison', ps.hasPoison() ? 'YES' : '-', ps.hasPoison()],
        ['Homing', ps.hasHoming() ? 'YES' : '-', ps.hasHoming()],
        ['Explode on Kill', ps.hasExplosionOnKill() ? 'YES' : '-', ps.hasExplosionOnKill()],
        ['Explode on Hit', ps.hasExplosionOnHit() ? 'YES' : '-', ps.hasExplosionOnHit()],
        ['Orbit Orbs', `${ps.getOrbitOrbCount()}`, ps.getOrbitOrbCount() > 0],
        ['Bomb Drop', ps.hasBombDrop() ? 'YES' : '-', ps.hasBombDrop()],
        ['Nova Pulse', ps.hasNova() ? 'YES' : '-', ps.hasNova()],
        ['Aux Melee', ps.hasAuxMelee() ? 'YES' : '-', ps.hasAuxMelee()],
      ]],
    ];

    // Opaque backdrop + framed content column (same treatment as the combos guide).
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 620));
    const x0 = (W - contentW) / 2;
    drawPanel(ctx, x0 - s(8), s(10), contentW + s(16), H - s(20), DARK_WOOD_THEME, 4, 77);

    const headSize = s(isMobile ? 11 : 14);
    const bodySize = s(isMobile ? 7.5 : 9);
    const lineH = bodySize + s(6);
    let y = s(isMobile ? 20 : 28);
    this.renderer.drawText('ALL STATS & BONUSES', W / 2, y, { size: headSize, align: 'center', color: '#ffd700' });
    y += headSize + s(5);
    this.renderer.drawText('Tap anywhere to close', W / 2, y, { size: s(7), align: 'center', color: '#9a8a6a' });
    y += s(7) + s(10);

    // Two columns on desktop, one on mobile. Groups flow top-to-bottom within a
    // column, wrapping to the next column when the first fills the height budget.
    const cols = isMobile ? 1 : 2;
    const colGap = s(16);
    const colW = (contentW - colGap * (cols - 1)) / cols;
    const yStart = y;
    const yBudget = H - s(30);
    let col = 0;
    let cy = yStart;
    const colX = (c: number) => x0 + c * (colW + colGap);

    const drawGroup = (title: string, color: string, rows: Row[]) => {
      const visible = rows.filter(([, , show]) => show);
      if (visible.length === 0) return;
      const blockH = lineH + visible.length * lineH + s(6);
      // Wrap to next column if this group would overflow the height budget.
      if (cy + blockH > yBudget && col < cols - 1) { col++; cy = yStart; }
      const cx = colX(col);
      this.renderer.drawText(title, cx, cy, { size: bodySize, align: 'left', color });
      cy += lineH;
      for (const [label, value] of visible) {
        this.renderer.drawText(label, cx + s(6), cy, { size: bodySize, align: 'left', color: '#c8b998' });
        this.renderer.drawText(value, cx + colW - s(6), cy, { size: bodySize, align: 'right', color: '#ffffff' });
        cy += lineH;
      }
      cy += s(6);
    };

    for (const [title, color, rows] of groups) drawGroup(title, color, rows);
  }

  // Full-screen synergy guide: explains, in plain language, what your active
  // duos do and which owned item + one more item completes another combo, plus
  // a legend for the shop-card highlight colours. Mobile-safe (opened by a tap,
  // dismissed by a tap) — no hover needed.
  private drawCombosOverlay(): void {
    const ctx = this.renderer.getContext();
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;

    const active = this.playerStats.getActiveDuos();
    const potential = this.playerStats.getPotentialDuos();

    // Word-wrap helper (drawText auto-shrinks but doesn't wrap).
    const wrap = (text: string, px: number, maxW: number): string[] => {
      ctx.save();
      ctx.font = `${px}px 'Press Start 2P', 'Courier New', monospace`;
      const words = text.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      ctx.restore();
      return lines;
    };

    const pad = s(16);
    const contentW = Math.min(W - pad * 2, s(isMobile ? 360 : 560));
    const x0 = (W - contentW) / 2;
    let y = s(isMobile ? 20 : 30);
    const bodySize = s(isMobile ? 8 : 9);
    const headSize = s(isMobile ? 11 : 14);
    const lineH = bodySize + s(4);

    // Opaque backdrop — a translucent dim let the shop cards bleed through and
    // fight the text (2026-07-02 QA), so fill the screen solid, then frame the
    // content column in a wood panel so the guide reads as its own screen.
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawPanel(ctx, x0 - s(8), s(10), contentW + s(16), H - s(20), DARK_WOOD_THEME, 4, 77);

    // Title
    this.renderer.drawText('COMBOS GUIDE', W / 2, y, { size: headSize, align: 'center', color: '#ffd700' });
    y += headSize + s(6);
    this.renderer.drawText('Tap anywhere to close', W / 2, y, { size: s(7), align: 'center', color: '#9a8a6a' });
    y += s(7) + s(12);

    // ── Active duos ──
    this.renderer.drawText('ACTIVE NOW', x0, y, { size: bodySize, align: 'left', color: '#8ce99a' });
    y += lineH;
    if (active.length === 0) {
      this.renderer.drawText('None yet — pair items below to trigger one.', x0, y, {
        size: bodySize, align: 'left', color: '#c8b998', maxWidth: contentW
      });
      y += lineH;
    } else {
      for (const duo of active) {
        this.renderer.drawText(`${duo.icon} ${duo.name}`, x0, y, {
          size: bodySize, align: 'left', color: '#ffe066', maxWidth: contentW
        });
        y += lineH;
        for (const l of wrap(duo.specialEffect || duo.description, bodySize, contentW - s(10))) {
          this.renderer.drawText(l, x0 + s(10), y, { size: bodySize, align: 'left', color: '#e5d9c3' });
          y += lineH;
        }
        y += s(3);
      }
    }
    y += s(8);

    // ── Almost-there duos (own one half) ──
    this.renderer.drawText('ONE ITEM AWAY', x0, y, { size: bodySize, align: 'left', color: '#74c0fc' });
    y += lineH;
    if (potential.length === 0) {
      this.renderer.drawText('Buy items to start a combo pairing.', x0, y, {
        size: bodySize, align: 'left', color: '#c8b998', maxWidth: contentW
      });
      y += lineH;
    } else {
      // Cap the list so it never overflows the screen on tiny devices.
      const maxShown = isMobile ? 4 : 6;
      for (const { duo, owned, needed } of potential.slice(0, maxShown)) {
        this.renderer.drawText(`${duo.icon} ${duo.name}`, x0, y, {
          size: bodySize, align: 'left', color: '#74c0fc', maxWidth: contentW
        });
        y += lineH;
        const pairLine = `have ${owned?.name ?? '?'} + get ${needed?.name ?? '?'}`;
        for (const l of wrap(pairLine, bodySize, contentW - s(10))) {
          this.renderer.drawText(l, x0 + s(10), y, { size: bodySize, align: 'left', color: '#a9c9ff' });
          y += lineH;
        }
        for (const l of wrap(`→ ${duo.specialEffect || duo.description}`, bodySize, contentW - s(10))) {
          this.renderer.drawText(l, x0 + s(10), y, { size: bodySize, align: 'left', color: '#e5d9c3' });
          y += lineH;
        }
        y += s(3);
      }
      if (potential.length > maxShown) {
        this.renderer.drawText(`+${potential.length - maxShown} more…`, x0 + s(10), y, {
          size: s(7), align: 'left', color: '#9a8a6a'
        });
        y += lineH;
      }
    }
    y += s(10);

    // ── Legend for the card highlight colours ──
    const legend: Array<[string, string]> = [
      ['#ffd43b', 'Gold border = completes a COMBO'],
      ['#7bd94a', 'Green border = fits your build (tag synergy)'],
      ['#4a9eff', 'Blue border = you already own it (stacks)'],
    ];
    this.renderer.drawText('CARD BORDERS', x0, y, { size: bodySize, align: 'left', color: '#ffd43b' });
    y += lineH;
    for (const [color, text] of legend) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(x0, y, s(10), s(10));
      ctx.restore();
      this.renderer.drawText(text, x0 + s(16), y, {
        size: bodySize, align: 'left', color: '#e5d9c3', maxWidth: contentW - s(16)
      });
      y += lineH;
    }
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
    const { s, cols, cellW, cellH, gap, startX, startY, backBtn } = this.getUpgradesLayout();
    const ctx = this.renderer.getContext();

    this.renderer.drawText('PERMANENT UPGRADES', this.canvas.width / 2 + s(2), s(22) + s(2), {
      size: s(16), align: 'center', color: '#241407', stroke: false
    });
    this.renderer.drawText('PERMANENT UPGRADES', this.canvas.width / 2, s(22), {
      size: s(16), align: 'center', color: '#b197fc'
    });
    this.renderer.drawText(`SOULS ${this.metaProgression.souls}`, this.canvas.width / 2, s(52), {
      size: s(11), align: 'center', color: '#ffd43b'
    });

    const upgrades = this.metaProgression.getAllUpgrades();
    for (let i = 0; i < upgrades.length; i++) {
      const upgrade = upgrades[i];
      const x = startX + (i % cols) * (cellW + gap);
      const y = startY + Math.floor(i / cols) * (cellH + gap);

      const isMaxLevel = upgrade.currentLevel >= upgrade.maxLevel;
      const canAfford = this.metaProgression.canPurchaseUpgrade(upgrade.id);

      drawPanel(ctx, x, y, cellW, cellH, DARK_WOOD_THEME, 4, i);
      ctx.save();
      ctx.strokeStyle = isMaxLevel ? '#ffd43b' : canAfford ? '#7bd94a' : '#55534c';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 5, y + 5, cellW - 10, cellH - 10);
      ctx.restore();

      this.renderer.drawText(upgrade.icon, x + s(10), y + s(10), { size: s(14) });
      this.renderer.drawText(upgrade.name.toUpperCase(), x + s(32), y + s(12), {
        size: s(8), color: '#f4e6c2'
      });
      this.renderer.drawText(`${upgrade.currentLevel}/${upgrade.maxLevel}`, x + cellW - s(10), y + s(12), {
        size: s(8), align: 'right', color: isMaxLevel ? '#ffd43b' : '#aab6c3'
      });
      this.renderer.drawText(upgrade.description, x + s(10), y + s(32), {
        size: s(7), color: '#c8b998'
      });
      if (!isMaxLevel) {
        const cost = upgrade.costs[upgrade.currentLevel];
        this.renderer.drawText(`${cost} SOULS`, x + s(10), y + cellH - s(18), {
          size: s(8), color: canAfford ? '#7bd94a' : '#ff8787'
        });
      } else {
        this.renderer.drawText('MAX', x + s(10), y + cellH - s(18), {
          size: s(8), color: '#ffd43b'
        });
      }
    }

    this.renderer.drawButton(backBtn.x, backBtn.y, backBtn.width, backBtn.height, 'Back', false);
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
