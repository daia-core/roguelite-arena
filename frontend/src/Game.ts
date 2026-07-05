// Main game state machine

import { Player } from './Player';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { MeleeAttack } from './MeleeAttack';
import { Particle, DamageNumber } from './Particle';
import { WaveManager } from './WaveManager';
import { PlayerStats, ItemDatabase, getItemKinds, type Item } from './ItemSystem';
import { STARTING_CLASSES, type StartingClass } from './Classes';
import { SaveManager } from './SaveManager';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { pointInRect, formatShort, segmentCircleHit } from './utils';
import { HealthOrb, XPOrb, CoinPickup } from './Pickup';
import { OrbitingOrb, Bomb, Shockwave } from './Weapons';
import { AoeZone } from './AoeZone';
import { MetaProgression } from './MetaProgression';
import { ObjectPool } from './ObjectPool';
import { Quadtree } from './Quadtree';
import { PerformanceMonitor } from './PerformanceMonitor';
import { QualityManager } from './QualityManager';
import { EntityCuller } from './EntityCuller';
import { PathfindingSystem } from './PathfindingSystem';
import { ScreenEffects } from './ScreenEffects';
import { ParticleBatchRenderer } from './ParticleBatchRenderer';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';
import { DUO_COMBOS } from './DuoSystem';
import { UISprites } from './UISprites';
import { MapSystem, nodeIcon, nodeLabel, serializeMap, deserializeMap, type NodeType } from './MapSystem';
import { ArtifactSystem, ARTIFACTS, ROLLABLE_ARTIFACTS, getArtifactById, type Artifact } from './ArtifactSystem';
import { randomEvent, EVENTS, type GameEvent, type EventEffect, type EventOption } from './EventSystem';
import { EvolutionSystem, type Evolution } from './EvolutionSystem';
import { VillageScene } from './VillageScene';
import type { Scene } from './scenes/Scene';
import { MenuScene } from './scenes/MenuScene';

// The map/node meta-layer adds three between-wave screens on top of the core loop:
//   'map'    — the Slay-the-Spire-style branching node picker (route your run)
//   'event'  — a `?` node's text choice screen
//   'reward' — a "pick 1 of 3 artifacts" screen (treasure / elite / boss spoils)
//   'rest'   — a campfire node: heal or upgrade
export type GameState =
  | 'menu' | 'classselect' | 'playing' | 'shop' | 'paused' | 'gameover' | 'village'
  | 'map' | 'event' | 'reward' | 'rest' | 'levelup';

export class Game {
  // Shared context read by extracted Scenes (see scenes/Scene.ts). `readonly` because
  // both are assigned exactly once in the constructor.
  readonly canvas: HTMLCanvasElement;
  readonly renderer: Renderer;
  private input: Input;

  // Per-screen scenes extracted out of Game (incremental de-god-classing). A state with
  // a registered scene is dispatched to it; the rest still live in the update/draw switch
  // until they're extracted in turn. See ARCHITECTURE-REVIEW.md.
  private scenes: Partial<Record<GameState, Scene>> = {};
  private audio: AudioManager;

  // Hidden probe that reads the device safe-area insets (notch / status bar) so the
  // top-anchored canvas HUD can be pushed clear of them in portrait on phones.
  private safeAreaProbe: HTMLElement | null = null;

  state: GameState = 'menu';
  // The starting class picked for the current run (class-select screen). Purely for
  // reference/telemetry; the class's effects are baked into stats/items at run start.
  private selectedClassId: string = 'gunner';
  // Tracks the state seen on the previous update tick, to detect screen changes
  // (used to disarm a held press so it can't carry a click into the new screen).
  private lastUpdateState: GameState = 'menu';

  // Game entities
  player: Player | null = null;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  meleeAttacks: MeleeAttack[] = [];
  particles: Particle[] = [];
  damageNumbers: DamageNumber[] = [];
  healthOrbs: HealthOrb[] = [];
  xpOrbs: XPOrb[] = [];
  coins: CoinPickup[] = [];

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
  private villageScene: VillageScene | null = null;
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

  // GAME FEEL: Screen effects (colored flash only — no shake, no time-warp)
  private screenEffects: ScreenEffects;

  // PERFORMANCE: Batch particle rendering (40-60% faster)
  private particleBatchRenderer: ParticleBatchRenderer;

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
  // The concrete item/artifact an event granted, so the result screen can show a
  // proper card (name + rarity + what it does) instead of just a line of text.
  private eventReward: { name: string; rarity: string; desc: string; icon: string; artifactId?: string } | null = null;
  rewardChoices: Artifact[] = [];            // the 1-of-3 artifact offer
  rewardTitle: string = '';                  // header for the reward screen
  rewardSkippable: boolean = false;          // show a Skip button (elite/treasure/boss)
  private rewardThen: (() => void) | null = null; // what to do once an artifact is picked
  // ---- LEVEL-UP pick-1-of-3 state (mirrors the reward screen) ----
  // On level-up the sim pauses and the player picks ONE of three rolled items,
  // making each level a real build decision instead of a silent stat bump. Extra
  // level-ups earned while the screen is open queue up (pendingLevelups) and open
  // back-to-back, so a big XP orb never eats a choice.
  levelupChoices: Item[] = [];               // the 1-of-3 item offer
  private pendingLevelups: number = 0;        // level-ups still owed a choice screen
  private pendingWaveArtifact: boolean = false;   // elite/boss wave grants spoils on clear
  restResolved: boolean = false;             // rest node: an option has been taken
  restResultText: string = '';               // rest node outcome line
  // Momentum artifact: seconds the player has been continuously moving.
  private momentumTime: number = 0;

  // ---- Conditional-item run state (drives the triggered-damage items) ----
  // Grindstone: whole waves cleared this run (permanent per-wave ramp).
  private wavesSurvived: number = 0;
  // Killing Spree: a decaying on-kill damage stack. Each kill adds one (up to
  // KILL_STACK_MAX) and refreshes the grace timer; after KILL_STACK_GRACE seconds
  // without a kill the stacks drain away, so the bonus rewards sustained pace.
  private killStackCount: number = 0;
  private killStackTimer: number = 0;
  private static readonly KILL_STACK_MAX = 20;      // ceiling on stacks
  private static readonly KILL_STACK_GRACE = 2.0;   // seconds before stacks start draining
  private static readonly KILL_STACK_DRAIN = 12;    // stacks lost per second once draining
  private static readonly LOW_HP_THRESHOLD = 0.35;  // "low HP" = at/under 35% max
  private static readonly HIGH_HP_THRESHOLD = 0.90; // "high HP" = at/over 90% max
  private static readonly GOLD_SCALE_PER = 100;     // gold per +1 unit of goldScaleDamage
  private static readonly GOLD_SCALE_CAP = 2.0;     // cap the gold-scaling factor at +200% dmg
  // Soul Tithe: a run-long on-kill milestone counter (only ticks while the item is held).
  private soulTitheKills: number = 0;               // kills banked since owning Soul Tithe
  private soulTitheStacks: number = 0;              // permanent +dmg stacks earned this run
  private static readonly SOUL_TITHE_ORB_EVERY = 10;   // drop a health orb every Nth kill
  private static readonly SOUL_TITHE_DMG_EVERY = 50;    // bank a permanent stack every Nth kill
  private static readonly SOUL_TITHE_DMG_PER = 0.01;    // +1% damage per banked stack (uncapped)
  // Ceremonial Daggers: on-kill homing spectral daggers. Bounded to one generation per
  // primary kill (a dagger's own kill never spawns more) so dense packs can't cascade.
  private static readonly DAGGER_DMG_MULT = 0.5;   // each dagger does 50% of current shot damage
  private static readonly DAGGER_SPEED = 320;      // px/s (fast, so daggers connect quickly)
  private static readonly DAGGER_TURN = 4.0;       // homing turn rate (rad/s) — tight seek
  // Pen Nib (Loaded Shot): every Nth primary volley is a "loaded shot" — triple damage and
  // pierces all. Only the primary shot counts (multicast bonus volleys don't), so the rhythm
  // stays predictable and telegraphed.
  private shotsFired: number = 0;                  // primary volleys fired while Pen Nib held
  private static readonly LOADED_SHOT_EVERY = 10;  // every Nth shot is loaded
  private static readonly LOADED_SHOT_MULT = 3;    // loaded shot damage multiplier

  // Enemy armor penetration (see Player.takeDamage). Dodgeable ranged/AoE threats
  // pierce half the player's armor so an armor-stack build can't chip them to ~1 HP;
  // unavoidable contact hits pierce less. (Felix, 2026-07-05: ranged felt like 1 HP.)
  private static readonly RANGED_ARMOR_PEN = 0.5;
  private static readonly CONTACT_ARMOR_PEN = 0.25;

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

  // Weapon evolutions (VS-style): base weapon + catalyst passive at wave 8+ → a
  // signature evolved weapon. Triggered at wave-clear (checkWeaponEvolution).
  private evolutionSystem = new EvolutionSystem();
  evolutionBannerTimer: number = 0;
  evolutionBannerText: string = '';

  // GAME FEEL: hit-stop (freeze-frame "punch"). Set only on genuinely impactful
  // kills — bosses and elites/minibosses — NEVER on fodder: the arena clears
  // thousands of trash enemies per second, so a per-kill freeze would stutter
  // the game constantly. While >0, the playing sim runs at dt=0 (frozen) but the
  // frame still renders, so the kill's flash/particles hang for a beat.
  hitPauseTimer: number = 0;
  private static readonly HIT_PAUSE_MAX = 0.13; // hard ceiling — gameplay never freezes longer

  constructor(canvas: HTMLCanvasElement) {
    // Dev/QA hook: lets tooling (screenshot scripts, the shots-qa harness)
    // inspect and force game state. Not a public API.
    (window as unknown as { __game: Game }).__game = this;
    (window as unknown as { __ItemDatabase: typeof ItemDatabase }).__ItemDatabase = ItemDatabase;
    (window as unknown as { __EVENTS: typeof EVENTS }).__EVENTS = EVENTS;
    (window as unknown as { __ARTIFACTS: typeof ARTIFACTS }).__ARTIFACTS = ARTIFACTS;
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

    // Register extracted per-screen scenes (menu is the pilot; more to follow).
    this.scenes.menu = new MenuScene(this);

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
        this.openClassSelect();
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

    // Village button (the walkable base — replaces the flat upgrades grid)
    const upgradesBtn = document.getElementById('upgradesBtn');
    if (upgradesBtn) {
      upgradesBtn.addEventListener('click', () => {
        this.enterVillage();
      });
    }
  }

  /** Open the class-select screen (user-facing entry: menu button, retry, embark). */
  openClassSelect(): void {
    this.state = 'classselect';
  }

  /**
   * Start a run directly with the default (Gunner) class. Kept as the stable entry
   * point for headless QA and any caller that just wants a run — the class-select UI
   * routes through openClassSelect() → beginRun() instead. Gunner has no start item
   * and a neutral tilt, so this is identical to the pre-class default run.
   */
  startNewGame(): void {
    this.beginRun(STARTING_CLASSES[0]);
  }

  /** Build a fresh run and apply the chosen starting class, then open the map. */
  beginRun(cls: StartingClass): void {
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
      // Route into baseMaxHealth (what getMaxHealth reads) — refreshMaxHealth() below
      // recomputes player.maxHealth from stats, so a direct player.maxHealth write here
      // was silently discarded, making the purchased health upgrade a no-op.
      this.playerStats.baseMaxHealth += healthBonus;
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
    this.coins = [];
    this.resetAuxWeapons();
    this.kills = 0;
    this.hitPauseTimer = 0;
    this.bossKills = 0;
    this.soulsEarnedThisRun = 0;
    // Reset conditional-item run state (fresh run = no ramp, no kill streak).
    this.wavesSurvived = 0;
    this.killStackCount = 0;
    this.killStackTimer = 0;
    this.soulTitheKills = 0;
    this.soulTitheStacks = 0;
    this.shotsFired = 0;

    this.waveManager.reset();
    // The map layer drives wave numbers now: the first battle node starts wave
    // waveSkip+1, so seed the counter at waveSkip and open the act-1 map.
    this.waveManager.currentWave = this.metaProgression.getWaveSkip();
    this.artifacts.reset();
    this.artifacts.applyStatic(this.playerStats);
    this.mapSystem.reset();
    this.mapSystem.generateAct(1);

    // Apply the chosen starting class LAST (after meta bonuses/artifacts), so the
    // class's stat tilt layers on top and its start item is present before we lock
    // in max health below.
    this.applyClass(cls);

    this.refreshMaxHealth();
    this.pendingWaveArtifact = false;

    this.state = 'map';
  }

  /** Fold a starting class's weapon + stat tilt into the freshly-built run. */
  private applyClass(cls: StartingClass): void {
    if (!this.player) return;
    this.selectedClassId = cls.id;
    // Grant the class's starting weapon item (its weaponType sets the attack feel).
    if (cls.startItemId) {
      const item = ItemDatabase.getItemById(cls.startItemId);
      if (item) this.playerStats.addItem(item);
    }
    // Stat tilt — multiplicative on the base stats, additive on health/armor/crit/gold.
    if (cls.damageMult) this.player.stats.baseDamage *= cls.damageMult;
    if (cls.fireRateMult) this.player.stats.baseFireRate *= cls.fireRateMult;
    if (cls.speedMult) this.player.stats.baseSpeed *= cls.speedMult;
    if (cls.critChanceBonus) this.player.stats.baseCritChance += cls.critChanceBonus;
    if (cls.armorBonus) this.playerStats.metaArmor += cls.armorBonus;
    if (cls.startGoldBonus) this.player.gold += cls.startGoldBonus;
    // Health goes on baseMaxHealth (the source getMaxHealth reads) — refreshMaxHealth()
    // runs right after applyClass and recomputes player.maxHealth from stats, so writing
    // player.maxHealth directly here would be immediately overwritten. Floor at 1 so a
    // negative glass-cannon tilt can never zero out the pool.
    if (cls.maxHealthBonus) {
      this.playerStats.baseMaxHealth = Math.max(1, this.playerStats.baseMaxHealth + cls.maxHealthBonus);
    }
  }

  /** The class id chosen for the current run (QA/telemetry). */
  getSelectedClassId(): string {
    return this.selectedClassId;
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
    this.coins = [];
    this.resetAuxWeapons();
    this.kills = 0;
    this.hitPauseTimer = 0;

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

    // Evolution banner ticks in every state (it is set at wave-clear and must keep
    // counting down while the shop/reward screen is shown, where updatePlaying doesn't run).
    if (this.evolutionBannerTimer > 0) this.evolutionBannerTimer -= dt;

    // On any screen change, disarm a held press so a finger/button that was
    // already down (e.g. holding to move when a wave ends → shop) can't register
    // as a click in the new screen. A fresh touchdown is then required.
    if (this.state !== this.lastUpdateState) {
      this.input.disarmUntilRelease();
      this.lastUpdateState = this.state;
    }

    // Extracted scenes handle their own update; the rest stay in the switch below.
    const activeScene = this.scenes[this.state];
    if (activeScene) {
      activeScene.update(dt);
      return;
    }

    switch (this.state) {
      case 'playing': {
        // Hit-stop: while the freeze window is active, drain it with REAL time but
        // advance the gameplay sim by 0 this frame. draw() still runs (main loop),
        // so the impact frame — kill particles, hit flash — hangs for a beat.
        let simDt = dt;
        if (this.hitPauseTimer > 0) {
          this.hitPauseTimer -= dt;
          simDt = 0;
        }
        this.updatePlaying(simDt);
        break;
      }
      case 'shop':
        this.updateShop();
        break;
      case 'paused':
        this.updatePaused();
        break;
      case 'gameover':
        this.updateGameOver();
        break;
      case 'village':
        this.updateVillage(dt);
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
      case 'levelup':
        this.updateLevelup();
        break;
      case 'rest':
        this.updateRest();
        break;
      case 'classselect':
        this.updateClassSelect();
        break;
    }
  }

  private updatePlaying(dt: number): void {
    if (!this.player) return;

    // Gear button (top-right) opens the pause/menu overlay. Checked before any
    // gameplay input so a tap on it never leaks through to movement/shooting.
    if (this.input.mouseDown && pointInRect(this.input.mouseX, this.input.mouseY, this.gearButtonRect())) {
      this.state = 'paused';
      this.input.mouseDown = false;
      return;
    }

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
    this.updateRuntimeModifiers(dt, movement.x !== 0 || movement.y !== 0);

    // Player update
    this.player.update(dt, movement.x, movement.y, this.worldWidth, this.worldHeight);

    // Health regen (items + meta) — previously sold but never ticked.
    // BALANCE 2026-07-03: regen was UNBOUNDED and enemies don't scale against it, so a
    // heavy stack out-healed most enemy DPS (immortality, same class as the armor/economy
    // runaways). Cap it at 5% of max HP per second — generous enough to feel impactful,
    // never enough to tank a scaled wave passively. Scaling with maxHealth keeps the cap
    // relevant deep into a run instead of a flat number that goes irrelevant late.
    const rawRegen = this.playerStats.getHealthRegen() + this.metaProgression.getStartingRegenBonus();
    const regen = Math.min(rawRegen, this.player.maxHealth * 0.05);
    if (regen > 0 && this.player.health < this.player.maxHealth) {
      this.player.heal(regen * dt);
    }

    // Dodge popups so Evasion items visibly do something
    if (this.player.pendingDodges > 0) this.audio.playDodge();
    while (this.player.pendingDodges > 0) {
      this.player.pendingDodges--;
      this.damageNumbers.push(
        this.createDamageNumber(this.player.x, this.player.y - 24, 'DODGE', false, '#66d9e8')
      );
    }

    // Player shooting — the ranged weapon ALWAYS fires. Melee is a separate
    // stacking swing (see updatePlayerSwing in updateAuxWeapons), so a melee build
    // still shoots a weak gun instead of losing projectiles entirely.
    const newProjectiles = this.player.tryShoot(this.enemies);
    if (newProjectiles.length > 0) {
      // Pen Nib (Loaded Shot): count primary volleys and make every Nth a loaded shot —
      // triple damage + pierces every enemy. Bonus multicast volleys pass loaded=false.
      let loaded = false;
      if (this.playerStats.hasLoadedShot()) {
        this.shotsFired++;
        if (this.shotsFired % Game.LOADED_SHOT_EVERY === 0) loaded = true;
      }
      const spawnVolley = (volley: typeof newProjectiles, isLoaded: boolean = false) => {
        // PERFORMANCE: Use pooled projectiles instead of new ones
        for (const proj of volley) {
          const pooled = this.projectilePool.acquire();
          pooled.init(
            proj.x, proj.y, Math.atan2(proj.vy, proj.vx),
            isLoaded ? proj.damage * Game.LOADED_SHOT_MULT : proj.damage,
            proj.speed, proj.fromPlayer, isLoaded ? true : proj.piercing
          );
          pooled.maxPierceCount = isLoaded ? 999 : proj.maxPierceCount;
          pooled.homing = proj.homing;
          pooled.turnSpeed = proj.turnSpeed;
          if (isLoaded) { pooled.color = '#ffd43b'; pooled.radius = 13; } // fat golden loaded round
          this.projectiles.push(pooled);
        }
      };
      spawnVolley(newProjectiles, loaded);
      // Multicast: a chance to instantly fire a bonus volley (re-aimed at live enemies).
      // Rolls repeatedly so stacked multicast can chain more than one extra volley.
      // Only the FIRST roll gets Fourleaf's roll-twice luck (rollProc); the subsequent
      // decaying rolls stay plain so the charm can't compound into an infinite volley.
      let mc = this.playerStats.getMulticastChance();
      let guard = 0;
      let firstRoll = true;
      while (mc > 0 && (firstRoll ? this.playerStats.rollProc(mc) : Math.random() < mc) && guard++ < 4) {
        firstRoll = false;
        spawnVolley(this.player.tryShoot(this.enemies, true));
        mc -= 0.15; // each extra volley is a little less likely, keeps it bounded
      }
      this.audio.playShoot();
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
    //   }
    // }

    // Wave manager
    this.enemies = this.waveManager.update(dt, this.enemies, this.worldWidth, this.worldHeight);

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
          dt
        );
      }

      // Status effects (wired item mechanics: Frost Orb, Toxic Vial, Ignite, Bleed, Doom...).
      // All DoTs run through tickDoT so Wound (woundMult) amplifies every one uniformly and
      // a DoT kill routes through killByDot (which handles poison-spread).
      if (enemy.frozenTimer > 0) enemy.frozenTimer -= dt;
      let dotDamage = 0;
      if (enemy.poisonTimer > 0) { enemy.poisonTimer -= dt; dotDamage += 7 * dt; }
      if (enemy.burnTimer > 0) { enemy.burnTimer -= dt; dotDamage += 16 * dt; } // Ignite: hurts fast, burns out fast
      if (enemy.bleedTimer > 0) {
        enemy.bleedTimer -= dt;
        // Bleed hits harder while the enemy is moving (punishes rushers).
        const moved = Math.hypot(enemy.x - enemy.lastX, enemy.y - enemy.lastY);
        dotDamage += (6 + Math.min(18, moved * 1.5)) * dt;
      }
      enemy.lastX = enemy.x; enemy.lastY = enemy.y;
      if (dotDamage > 0) {
        enemy.health -= dotDamage * enemy.woundMult;
        if (enemy.health <= 0 && !enemy.dead) { this.killByDot(enemy); continue; }
      }
      // Doom: stores damage, then detonates. Executes if the stored payload >= remaining HP.
      if (enemy.doomTimer > 0) {
        enemy.doomTimer -= dt;
        if (enemy.doomTimer <= 0 && enemy.doomStored > 0 && !enemy.dead) {
          const payload = enemy.doomStored * enemy.woundMult;
          enemy.doomStored = 0;
          this.renderer.addImpactFlash(enemy.x, enemy.y);
          if (payload >= enemy.health) {
            enemy.health = 0;
            this.damageNumbers.push(this.createDamageNumber(enemy.x, enemy.y - 20, payload, true, '#b06bff'));
            this.killByDot(enemy);
            continue;
          } else {
            enemy.health -= payload;
            this.damageNumbers.push(this.createDamageNumber(enemy.x, enemy.y - 20, payload, false, '#b06bff'));
            if (enemy.health <= 0 && !enemy.dead) { this.killByDot(enemy); continue; }
          }
        }
      }

      const result = enemy.update(dt, this.player.x, this.player.y);

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
          const damaged = this.player.takeDamage(enemy.typeData.damage * 1.5, Game.RANGED_ARMOR_PEN);
          if (damaged) {
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
          const damaged = this.player.takeDamage(enemy.typeData.damage * 0.5, Game.RANGED_ARMOR_PEN);
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
      enemy.contactCooldown -= dt;
      if (enemy.contactCooldown <= 0 && enemy.collidesWith(this.player.x, this.player.y, this.player.radius)) {
        enemy.contactCooldown = 0.8;
        const damaged = this.player.takeDamage(enemy.typeData.damage, Game.CONTACT_ARMOR_PEN);
        if (damaged) {
          this.applyThorns(enemy.typeData.damage, enemy);
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
        const maxTurn = proj.turnSpeed * dt;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, delta));
        const speed = Math.hypot(proj.vx, proj.vy);
        proj.vx = Math.cos(current + turn) * speed;
        proj.vy = Math.sin(current + turn) * speed;
      }
      // Capture pre-move position so we can sweep the whole path this frame
      // (fast projectiles + the loop's dt cap can otherwise tunnel past small enemies).
      const px0 = proj.x, py0 = proj.y;
      proj.update(dt, this.worldWidth, this.worldHeight);

      // Skip collision detection for projectiles that are already dead
      if (proj.dead) continue;

      if (proj.fromPlayer) {
        // PERFORMANCE: Only check nearby enemies using quadtree.
        // Query the WHOLE swept segment (px0,py0 -> proj.x,proj.y), not just the
        // endpoint: a fast projectile sweeps through cells its endpoint box never
        // touches, so an enemy sitting mid-path in another quadtree cell was never a
        // candidate and segmentCircleHit never got to test it — the projectile
        // visibly passed through. Pad by the largest enemy radius so a swept-past
        // enemy whose centre is just outside the path is still returned.
        const minX = Math.min(px0, proj.x), maxX = Math.max(px0, proj.x);
        const minY = Math.min(py0, proj.y), maxY = Math.max(py0, proj.y);
        const pad = 90; // >= largest enemy radius
        const nearbyEnemies = this.enemyQuadtree.retrieve({
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          width: (maxX - minX) + pad * 2,
          height: (maxY - minY) + pad * 2,
        } as any);

        for (const enemy of nearbyEnemies) {
          if (enemy.dead) continue; // Corpse still in this frame's quadtree — don't re-kill
          if (proj.hasHit(enemy.id)) continue; // Already hit (piercing)

          if (segmentCircleHit(px0, py0, proj.x, proj.y, enemy.x, enemy.y, enemy.typeData.radius + proj.radius)) {
            const isCrit = this.player.rollCrit();
            let damage = isCrit ? this.player.getCritDamage(proj.damage) : proj.damage;
            if (enemy.typeData.isBoss) {
              damage *= this.metaProgression.getBossDamageMultiplier();
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
            // GAME FEEL: impact flash on every hit
            this.renderer.addImpactFlash(enemy.x, enemy.y);

            // EXECUTE: if the hit left a non-boss enemy at/under the execute
            // threshold, finish it instantly. Routes through the normal kill path
            // so it still grants XP/gold and feeds Killing Spree. Bosses/minibosses
            // are immune — instakilling a boss would trivialise the run's checks.
            if (!enemy.dead && !enemy.typeData.isBoss && !enemy.isMiniboss) {
              const execFrac = this.playerStats.getExecuteThreshold();
              if (execFrac > 0 && enemy.health <= enemy.maxHealth * execFrac) {
                enemy.dead = true;
                this.spawnExecuteBurst(enemy.x, enemy.y);
              }
            }

            if (enemy.dead) {
              this.handleEnemyKill(enemy, proj.isDagger);
            } else {
              this.applyOnHitEffects(enemy, damage, proj.isDagger);
            }
          }
        }
      } else {
        // Enemy projectile hits player
        if (segmentCircleHit(px0, py0, proj.x, proj.y, this.player.x, this.player.y, this.player.radius + proj.radius)) {
          const damaged = this.player.takeDamage(proj.damage, Game.RANGED_ARMOR_PEN);
          if (damaged) {
            this.applyThorns(proj.damage);
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
      melee.update(dt, this.player.x, this.player.y);

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
          this.renderer.addImpactFlash(enemy.x, enemy.y);

          if (enemy.dead) {
            this.handleEnemyKill(enemy);
          } else {
            // Melee swings apply on-hit statuses too (chain/freeze/poison/burn/bleed/doom/wound),
            // so a melee/DoT hybrid build actually procs its statuses — not just ranged.
            this.applyOnHitEffects(enemy, damage);
          }
        }
      }
    }

    // AUXILIARY STACKING WEAPONS — orbiting orbs, dropped bombs, nova pulses and a
    // whirling melee arc. These run in ADDITION to the primary weapon each frame.
    this.updateAuxWeapons(dt);

    // Particles
    for (const particle of this.particles) {
      particle.update(dt);
    }

    // Damage numbers
    for (const num of this.damageNumbers) {
      num.update(dt);
    }

    // Health orbs — magnet attraction (getXPMagnet drives a real pickup range)
    const pickupMagnet = this.playerStats.getXPMagnet();
    const attractRadius = 60 * pickupMagnet; // baseline vacuum, widened by magnet items
    for (const orb of this.healthOrbs) {
      orb.update(dt);

      // Pull orbs within attraction range toward the player (speed ramps as they close in)
      const dx = this.player.x - orb.x;
      const dy = this.player.y - orb.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist <= attractRadius) {
        const pull = 170 + (1 - dist / attractRadius) * 300; // 170..470 px/s, faster than the player
        const step = Math.min(dist, pull * dt);
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
      if (orb.update(dt, this.player.x, this.player.y, xpMagnetRadius)) {
        this.grantXP(orb.xpAmount);
        orb.dead = true;
      }
    }

    // Coins — same magnet-and-home behaviour as XP; gold is banked on pickup, not
    // at the moment of the kill, so money has to be vacuumed up like the gems.
    for (const coin of this.coins) {
      if (coin.update(dt, this.player.x, this.player.y, xpMagnetRadius)) {
        this.player.addGold(coin.goldAmount);
        coin.dead = true;
        this.audio.playItemPickup();
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
    this.removeDeadEntities(this.coins);
    this.removeDeadEntities(this.bombs);
    this.removeDeadEntities(this.shockwaves);
    this.updateAoeZones(dt);
    this.removeDeadEntities(this.aoeZones);

    // Check wave completion
    if (this.waveManager.isWaveComplete()) {
      // VS-style weapon evolution: if a committed weapon+catalyst build has come of
      // age (wave 8+), upgrade the weapon in-place before the reward/shop screens.
      this.checkWeaponEvolution();
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

  // VS-STYLE WEAPON EVOLUTION. Called on wave-clear: if a committed build owns a base
  // weapon + its catalyst passive and has reached the required wave, upgrade the weapon
  // in-place into its signature evolved form. The evolved item (unlocked:false) is never
  // shop-rollable, so it is obtainable ONLY here — reachable because every base weapon and
  // catalyst is a normal shop-obtainable item. One evolution per wave-clear keeps each a
  // distinct moment. See EvolutionSystem.ts.
  private checkWeaponEvolution(): void {
    const wave = this.waveManager.currentWave;
    const available: Evolution[] = this.evolutionSystem.checkEvolutions(this.playerStats.items, wave);
    if (available.length === 0) return;

    const evo = available[0];
    const evolved = ItemDatabase.getItemById(evo.evolvedWeaponId);
    const base = this.playerStats.items.find(i => i.id === evo.baseWeaponId);
    if (!evolved || !base) return; // guard: never fire against a missing item

    // Replace the base weapon with the evolved weapon; the catalyst is kept so its
    // effect stacks on top of the upgrade. removeItem/addItem both recompute stats.
    this.playerStats.removeItem(evo.baseWeaponId);
    this.playerStats.addItem(evolved);
    // Orbital/aux weapon counts can change (e.g. 3 → 7 orbs), so rebuild the aux pool.
    this.resetAuxWeapons();

    // Feedback: a prominent banner (drawn over both the playing and shop screens) + the
    // triumphant transformation sting so the payoff reads loud.
    this.evolutionBannerText = `WEAPON EVOLVED — ${evo.name}!`;
    this.evolutionBannerTimer = 3.5;
    this.audio.playTransformation();
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
        this.bombs.push(new Bomb(px, py, 0.9, 110 * this.playerStats.getAoeRadiusMult(), this.playerStats.getBombDamage()));
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
        this.shockwaves.push(new Shockwave(px, py, 240 * this.playerStats.getAoeRadiusMult(), this.playerStats.getNovaDamage()));
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

    // --- Default melee swing: EVERY player swings on its own timer toward the
    //     nearest enemy in reach, independent of the always-firing gun. Melee items
    //     shape its damage/reach/arc/speed and can turn it into a full-circle AOE
    //     quake (swingAoe). A swing only fires when an enemy is actually in range,
    //     so it never wastes cooldown on empty air. ---
    this.auxMeleeTimer -= dt;
    if (this.auxMeleeTimer <= 0 && this.enemies.length > 0) {
      const range = this.playerStats.getSwingRange();
      const aoe = this.playerStats.getSwingAoe();
      const reach = range + aoe; // an AOE swing can connect from further out
      let nearest: Enemy | null = null;
      let nd = Infinity;
      for (const e of this.enemies) {
        const d = (e.x - px) ** 2 + (e.y - py) ** 2;
        if (d < nd) { nd = d; nearest = e; }
      }
      // Only swing when something is within reach (+ its own radius); otherwise wait.
      if (nearest && nd <= (reach + nearest.radius) ** 2) {
        const angle = Math.atan2(nearest.y - py, nearest.x - px);
        const dmg = this.playerStats.getSwingDamage();
        const kb = this.playerStats.getSwingKnockback();
        // The equipped weapon's STYLE decides how the swing reads and hits: a spear
        // thrusts a narrow lane, a hammer slams a disc, a heavy blade / AOE swing
        // whirls a full circle, everything else arcs. Pushed through the shared
        // meleeAttacks pipeline (collision/knockback/kill) regardless of style.
        const style = this.playerStats.getMeleeStyle();
        // A spin whirls the full circle; every other style sweeps its configured arc.
        const arc = style === 'spin' ? Math.PI * 2 : this.playerStats.getSwingArc();
        this.meleeAttacks.push(new MeleeAttack(px, py, angle, arc, reach, dmg, kb, style));
      }
      this.auxMeleeTimer = this.playerStats.getSwingInterval();
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
        const damaged = this.player.takeDamage(dmg, Game.RANGED_ARMOR_PEN);
        if (damaged) {
          this.applyThorns(dmg);
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
    this.spawnLevelupBurst();
    // Each level-up owes the player a pick-1-of-3. Queue it; open the screen now if
    // one isn't already up (extra levels earned mid-screen open back-to-back).
    this.pendingLevelups++;
    if (this.state !== 'levelup') this.openNextLevelup();
  }

  /** Vampire-Survivors level-up juice — sound, flash, and a burst of confetti. */
  private spawnLevelupBurst(): void {
    if (!this.player) return;
    this.audio.playLevelUp();
    this.renderer.addHitFlash(0.4);
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

  /** Roll 3 items and open the level-up choice screen for one owed level-up.
   *  If the pool is exhausted (nothing left to offer) the level-up passes silently. */
  private openNextLevelup(): void {
    if (this.pendingLevelups <= 0) return;
    this.pendingLevelups--;
    const choices = ItemDatabase.getWeightedShopItems(
      3,
      this.waveManager.currentWave,
      this.playerStats.items,
      this.playerStats.getLuck(),
      this.playerStats
    ).filter(Boolean);
    if (choices.length === 0) {
      // Nothing eligible to offer (e.g. weapon locked + all non-stackables owned) —
      // don't trap the player on an empty screen; drain any remaining owed levels too.
      if (this.pendingLevelups > 0) { this.openNextLevelup(); return; }
      if (this.state === 'levelup') this.state = 'playing';
      return;
    }
    this.levelupChoices = choices;
    this.state = 'levelup';
    this.input.mouseDown = false;
  }

  /** Grant the chosen level-up item, firing the same duo/transformation/HP/shield
   *  side effects the shop does (minus gold/pricing), then advance the queue. */
  private grantLevelupItem(item: Item): void {
    if (!this.player) return;
    const { newDuos, newTransformations } = this.playerStats.addItem(item);
    if (newDuos.length > 0) {
      this.audio.playDuoUnlock();
      for (const duo of newDuos) this.screenEffects.flash(duo.glowColor || '#ff00ff', 0.3);
    }
    if (newTransformations.length > 0) this.audio.playTransformation();
    if (item.maxHealthBonus) {
      const oldMax = this.player.maxHealth;
      this.player.maxHealth = this.playerStats.getMaxHealth();
      const healthPercent = this.player.health / oldMax;
      this.player.health = this.player.maxHealth * healthPercent;
    }
    if (item.shield) this.player.shield = true;

    this.levelupChoices = [];
    // Chain to the next owed level-up, or return to the fight.
    if (this.pendingLevelups > 0) this.openNextLevelup();
    else this.state = 'playing';
  }

  private updateLevelup(): void {
    if (!this.input.mouseDown) return;
    const { s, W, isMobile } = this.screenScale();
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
    const cardH = s(isMobile ? 74 : 68);
    const gap = s(12);
    const x0 = (W - cardW) / 2;
    const topY = s(isMobile ? 72 : 92);
    const mx = this.input.mouseX;
    const my = this.input.mouseY;

    for (let i = 0; i < this.levelupChoices.length; i++) {
      const y = topY + i * (cardH + gap);
      if (pointInRect(mx, my, { x: x0, y, width: cardW, height: cardH })) {
        this.input.mouseDown = false;
        this.grantLevelupItem(this.levelupChoices[i]);
        return;
      }
    }
  }

  private drawLevelup(): void {
    const ctx = this.renderer.getContext();
    const { s, W, isMobile } = this.screenScale();
    this.paintBackdrop();

    const lvl = this.player ? this.player.level : 1;
    this.renderer.drawText(`LEVEL ${lvl} — CHOOSE AN UPGRADE`, W / 2, s(isMobile ? 26 : 34), { size: s(isMobile ? 13 : 20), align: 'center', color: '#ffd700' });
    this.renderer.drawText('Pick one to keep for the run', W / 2, s(isMobile ? 26 : 34) + s(isMobile ? 16 : 20), { size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998' });

    const rarityColor: Record<string, string> = { common: '#c8c8c8', rare: '#74c0fc', epic: '#b06bd9', legendary: '#f2b04e' };
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
    const cardH = s(isMobile ? 74 : 68);
    const gap = s(12);
    const x0 = (W - cardW) / 2;
    const topY = s(isMobile ? 72 : 92);
    const bodyPx = s(isMobile ? 8 : 9);

    const iconBox = s(isMobile ? 28 : 30);
    const textX = x0 + s(12) + iconBox + s(8);
    const textW = cardW - (textX - x0) - s(12);
    this.levelupChoices.forEach((item, i) => {
      const y = topY + i * (cardH + gap);
      drawPanel(ctx, x0, y, cardW, cardH, DARK_WOOD_THEME, 11 + i, 53);
      this.renderer.drawItemIcon(item.icon, x0 + s(12) + iconBox / 2, y + (cardH - iconBox) / 2, iconBox, 'center');
      this.renderer.drawText(item.name, textX, y + s(isMobile ? 16 : 18), { size: s(isMobile ? 11 : 13), align: 'left', color: rarityColor[item.rarity] || '#ffffff' });
      this.renderer.drawText(item.rarity.toUpperCase(), x0 + cardW - s(12), y + s(isMobile ? 16 : 18), { size: s(7), align: 'right', color: rarityColor[item.rarity] || '#ffffff' });
      for (const [li, line] of this.wrapText(item.description, textW, bodyPx).entries()) {
        this.renderer.drawText(line, textX, y + s(isMobile ? 34 : 36) + li * (bodyPx + s(3)), { size: bodyPx, align: 'left', color: '#d8c9a8' });
      }
    });
  }

  // ==================== CLASS SELECT ====================
  // Shown at the start of every run (startNewGame → 'classselect'). Picking a card
  // calls beginRun(cls), which builds the run with that class's weapon + stat tilt.

  /** Shared card layout so draw() visuals and update() hitboxes never drift apart. */
  private classCardLayout() {
    const { s, W } = this.screenScale();
    const isMobile = this.screenScale().isMobile;
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
    const cardH = s(isMobile ? 70 : 66);
    const gap = s(12);
    const x0 = (W - cardW) / 2;
    const topY = s(isMobile ? 64 : 88);
    return { s, W, isMobile, cardW, cardH, gap, x0, topY };
  }

  private updateClassSelect(): void {
    if (!this.input.mouseDown) return;
    const { cardW, cardH, gap, x0, topY } = this.classCardLayout();
    const mx = this.input.mouseX, my = this.input.mouseY;
    for (let i = 0; i < STARTING_CLASSES.length; i++) {
      const y = topY + i * (cardH + gap);
      if (pointInRect(mx, my, { x: x0, y, width: cardW, height: cardH })) {
        this.input.mouseDown = false;
        this.beginRun(STARTING_CLASSES[i]);
        return;
      }
    }
  }

  private drawClassSelect(): void {
    const ctx = this.renderer.getContext();
    const { s, W, isMobile, cardW, cardH, gap, x0, topY } = this.classCardLayout();
    this.paintBackdrop();

    this.renderer.drawText('CHOOSE YOUR CLASS', W / 2, s(isMobile ? 26 : 34), { size: s(isMobile ? 14 : 20), align: 'center', color: '#ffd700' });
    this.renderer.drawText('Your starting weapon & stat tilt for the run', W / 2, s(isMobile ? 26 : 34) + s(isMobile ? 16 : 20), { size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998' });

    const bodyPx = s(isMobile ? 8 : 9);
    const iconBox = s(isMobile ? 30 : 32);
    const textX = x0 + s(12) + iconBox + s(8);
    const textW = cardW - (textX - x0) - s(12);

    STARTING_CLASSES.forEach((cls, i) => {
      const y = topY + i * (cardH + gap);
      drawPanel(ctx, x0, y, cardW, cardH, DARK_WOOD_THEME, 11 + i, 53);
      this.renderer.drawText(cls.icon, x0 + s(12) + iconBox / 2, y + cardH / 2 + s(4), { size: iconBox, align: 'center', color: '#ffffff' });
      this.renderer.drawText(cls.name, textX, y + s(isMobile ? 16 : 18), { size: s(isMobile ? 12 : 14), align: 'left', color: '#ffd700' });
      for (const [li, line] of this.wrapText(cls.blurb, textW, bodyPx).entries()) {
        this.renderer.drawText(line, textX, y + s(isMobile ? 32 : 34) + li * (bodyPx + s(3)), { size: bodyPx, align: 'left', color: '#d8c9a8' });
      }
    });
  }

  /** Arm a hit-stop freeze, taking the longer of any overlapping request and
   *  clamping to the hard ceiling so nothing can stall gameplay unfairly. */
  private triggerHitPause(seconds: number): void {
    if (seconds > this.hitPauseTimer) this.hitPauseTimer = seconds;
    if (this.hitPauseTimer > Game.HIT_PAUSE_MAX) this.hitPauseTimer = Game.HIT_PAUSE_MAX;
  }

  /** Distinct crimson burst + impact flash so an execute reads as more than a normal kill. */
  private spawnExecuteBurst(x: number, y: number): void {
    const count = this.getParticleCount(14);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / Math.max(1, count);
      const speed = 220 + Math.random() * 160;
      this.particles.push(this.createParticle({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: i % 2 === 0 ? '#ff2d55' : '#ffffff',
        size: 5 + Math.random() * 4,
        lifetime: 350 + Math.random() * 250,
        gravity: 120,
      }));
    }
    this.renderer.addImpactFlash(x, y);
  }

  /**
   * Ceremonial Daggers: throw `count` homing spectral daggers from a dead enemy's
   * position. They fan out in an even spread, then home onto the nearest enemies via
   * the standard player-projectile homing path. Each is flagged `isDagger` so its own
   * kill can't spawn more daggers (handleEnemyKill's re-entrancy guard), bounding the
   * chain to one generation per primary kill. Damage scales with the current build.
   */
  private spawnCeremonialDaggers(enemy: Enemy, count: number): void {
    const dmg = this.playerStats.getDamage() * Game.DAGGER_DMG_MULT;
    const base = Math.random() * Math.PI * 2; // random offset so fans don't always align
    for (let i = 0; i < count; i++) {
      const angle = base + (Math.PI * 2 * i) / count;
      const proj = this.projectilePool.acquire();
      proj.init(enemy.x, enemy.y, angle, dmg, Game.DAGGER_SPEED, true);
      proj.homing = true;
      proj.turnSpeed = Game.DAGGER_TURN;
      proj.isDagger = true;
      proj.color = '#d0bfff'; // spectral pale-violet trail
      proj.radius = 7;
      this.projectiles.push(proj);
    }
  }

  private handleEnemyKill(enemy: Enemy, fromDagger: boolean = false): void {
    if (!this.player) return;

    this.kills++;

    // Killing Spree: every kill adds a decaying damage stack and refreshes the grace
    // window. Only meaningful if a killStackDamage item is held, but the counter is
    // cheap to keep always (updateRuntimeModifiers reads it against the held rate).
    this.killStackCount = Math.min(Game.KILL_STACK_MAX, this.killStackCount + 1);
    this.killStackTimer = 0;

    // Soul Tithe: a run-long on-kill milestone. Only counts while the item is held, so
    // it's "every Nth kill SINCE you bought it" — every 10th drops a health orb, every
    // 50th banks a permanent +1% damage stack (folded in updateRuntimeModifiers).
    if (this.playerStats.hasSoulTithe()) {
      this.soulTitheKills++;
      if (this.soulTitheKills % Game.SOUL_TITHE_ORB_EVERY === 0) {
        this.healthOrbs.push(new HealthOrb(enemy.x, enemy.y));
      }
      if (this.soulTitheKills % Game.SOUL_TITHE_DMG_EVERY === 0) {
        this.soulTitheStacks++;
      }
    }

    // Ceremonial Daggers: on kill, throw homing spectral daggers at nearby enemies.
    // RE-ENTRANCY GUARD: a dagger's OWN kill (fromDagger) never spawns more daggers, so
    // the chain is bounded to a single generation per primary kill — a dense pack can't
    // cascade into an exponential dagger storm.
    if (!fromDagger) {
      const daggerCount = this.playerStats.getDaggerCount();
      if (daggerCount > 0) this.spawnCeremonialDaggers(enemy, daggerCount);
    }

    // Track boss kills
    if (enemy.type === 'demon') {
      this.bossKills++;
    }

    // GAME FEEL: freeze-frame punch on impactful kills only. Bosses get a meaty
    // stop (+ a white impact flash); elites/minibosses a lighter tap. Fodder gets
    // nothing — a freeze on every trash kill would stutter the whole arena.
    if (enemy.typeData.isBoss) {
      this.triggerHitPause(0.12);
      this.screenEffects.flash('#ffffff', 0.3);
    } else if (enemy.isMiniboss) {
      this.triggerHitPause(0.06);
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

    // XP and gold now both drop as collectable pickups (granted on pickup, not on
    // kill). Split larger rewards into a few orbs/coins for a satisfying pop,
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

    // Gold drops as coins the player has to vacuum up (same magnet as XP).
    const goldAward = Math.floor(finalGold);
    if (goldAward > 0) {
      const coinCount = Math.min(4, Math.max(1, Math.round(goldAward / 5)));
      const goldPer = Math.floor(goldAward / coinCount);
      let goldRemainder = goldAward - goldPer * coinCount;
      for (let i = 0; i < coinCount; i++) {
        const share = goldPer + (goldRemainder > 0 ? 1 : 0);
        if (goldRemainder > 0) goldRemainder--;
        this.coins.push(new CoinPickup(enemy.x, enemy.y, share));
      }
    }

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
        const damaged = this.player.takeDamage(enemy.typeData.damage * 0.8, Game.RANGED_ARMOR_PEN);
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

      // Damage flash (exploder detonation)
      this.screenEffects.flash('#ff4400', 0.2);

      // OPTIMIZATION: Use squared distance to avoid sqrt
      const distSqToPlayer = (this.player.x - enemy.x) ** 2 + (this.player.y - enemy.y) ** 2;
      const explodeRadiusSq = enemy.exploderExplodeRadius * enemy.exploderExplodeRadius;
      if (distSqToPlayer < explodeRadiusSq) {
        const damaged = this.player.takeDamage(enemy.typeData.damage * 1.5, Game.RANGED_ARMOR_PEN);
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

      // WAR CHEST: a wave-end income engine — bank gold scaling with the wave number, so
      // late waves pay out big and greed/economy builds compound. Additive across copies.
      const warChest = this.playerStats.getWarChest();
      if (warChest > 0) {
        const payout = Math.floor(warChest * wave);
        if (payout > 0) this.player.addGold(payout);
      }
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
      this.playerStats.getLuck(), // Luck tilts the shop toward higher rarities
      this.playerStats // Hide items whose only effect is an already-maxed capped stat
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
    this.screenEffects.flash('#00ff00', 0.2); // Green flash for wave complete

    // Save progress
    this.autoSave();
  }

  /**
   * Kill an enemy from a damage-over-time source. Handles the Poison-Spread build:
   * if a poisoned enemy tagged for spread dies, its poison (and burn/bleed) hops to the
   * nearest living neighbor so a plague build chains through a pack.
   */
  private killByDot(enemy: Enemy): void {
    if (enemy.dead) return;
    enemy.dead = true;
    if (enemy.poisonSpreads) {
      let nearest: Enemy | null = null;
      let bd = 140 * 140;
      for (const other of this.enemies) {
        if (other === enemy || other.dead || other.poisonTimer > 0) continue;
        const d = (other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2;
        if (d < bd) { bd = d; nearest = other; }
      }
      if (nearest) {
        nearest.poisonTimer = 3.0;
        nearest.poisonSpreads = true; // keep the chain going
        nearest.daggerDot = enemy.daggerDot; // carry the origin so a dagger's plague stays bounded
        this.renderer.addImpactFlash(nearest.x, nearest.y);
      }
    }
    // Re-entrancy guard for the async path: if the killing DoT/doom was a dagger's, don't
    // spawn a fresh generation of daggers — mirrors the synchronous proc-kill guard.
    this.handleEnemyKill(enemy, enemy.daggerDot);
  }

  /**
   * On-hit item mechanics (chain lightning, freeze, poison, explosion) —
   * these items existed and were purchasable but had no implementation.
   */
  private applyOnHitEffects(enemy: Enemy, damage: number, fromDagger: boolean = false): void {
    // Elemental damage scales with the elemental-damage stat, so an "elemental mage"
    // build (chain/explosion) is mechanically distinct from raw melee/ranged.
    const elem = this.playerStats.getElementalDamageMult();
    // Chain lightning: arc to the nearest other enemy for 60% damage
    if (this.playerStats.rollProc(this.playerStats.getChainLightningChance())) {
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
        // Re-entrancy guard: propagate the dagger origin so a dagger's chain-kill
        // can't spawn a fresh generation of daggers (bounded to one generation).
        if (nearest.dead) this.handleEnemyKill(nearest, fromDagger);
      }
    }

    // Freeze: halt movement for 1s
    if (this.playerStats.rollProc(this.playerStats.getFreezeChance())) {
      enemy.frozenTimer = 1.0;
    }

    // Poison: DoT for 3s (ticked in the enemy loop)
    if (this.playerStats.hasPoison()) {
      enemy.poisonTimer = 3.0;
      if (this.playerStats.hasPoisonSpread()) enemy.poisonSpreads = true;
      enemy.daggerDot = fromDagger;
    }

    // Burn (Ignite): short, fast fire DoT.
    if (this.playerStats.rollProc(this.playerStats.getBurnChance())) {
      enemy.burnTimer = Math.max(enemy.burnTimer, 2.0);
      enemy.daggerDot = fromDagger;
    }

    // Bleed: DoT that scales with the enemy's movement (punishes rushers).
    if (this.playerStats.rollProc(this.playerStats.getBleedChance())) {
      enemy.bleedTimer = Math.max(enemy.bleedTimer, 4.0);
      enemy.daggerDot = fromDagger;
    }

    // Wound: amplifies EVERY DoT already on the enemy (universal DoT multiplier, capped).
    if (this.playerStats.rollProc(this.playerStats.getWoundChance())) {
      enemy.woundMult = Math.min(3, enemy.woundMult + 0.5);
    }

    // Doom: mark that stores a share of the hit, then detonates — executes if it stored enough.
    if (this.playerStats.rollProc(this.playerStats.getDoomChance())) {
      enemy.doomStored += damage * 1.5 * elem;
      if (enemy.doomTimer <= 0) enemy.doomTimer = 2.5; // fresh 2.5s fuse on first mark
      enemy.daggerDot = fromDagger;
    }

    // Explosion on hit: AoE for 50% damage around the target
    if (this.playerStats.hasExplosionOnHit()) {
      for (const other of this.enemies) {
        if (other === enemy || other.dead) continue;
        if ((other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2 < 80 * 80) {
          const splits = other.takeDamage(damage * 0.5 * elem);
          if (splits && splits.length > 0) this.enemies.push(...splits);
          // Re-entrancy guard: a dagger's explosion-kill can't spawn more daggers.
          if (other.dead) this.handleEnemyKill(other, fromDagger);
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

    const SLOTS = 6;
    // Column count is driven by width, NOT the mobile flag: a wide LANDSCAPE phone
    // uses the 3-wide grid (a 6-tall single column can't fit its short height), only
    // a narrow PORTRAIT screen stacks in one column.
    const cols = isPortrait ? 1 : 3;
    const rows = Math.ceil(SLOTS / cols);

    const gapCss = isPortrait ? 8 : 12;
    const gap = s(gapCss);

    // --- Horizontal fit ---
    // Only true desktop (non-portrait, non-mobile) draws the stats panel as a LEFT
    // column and the inventory as a RIGHT column, so a multi-column grid must sit in
    // the gutter BETWEEN them. Portrait and mobile-landscape put stats as a
    // full-width strip on TOP, so the grid can use the full width (it just starts
    // below the strip via gridTop). Reserving these gutters is the fix for the
    // leftmost card colliding with the side panel on narrower desktop windows.
    const sidePanels = !isPortrait && !isMobile;
    const leftGutterCss = sidePanels ? 242 : 16;   // clears stats panel (x10 + w220 + margin)
    const rightGutterCss = sidePanels ? 240 : 16;  // clears inventory panel (~230 wide + margin)
    const gridRegionWCss = Math.max(60, cssW - leftGutterCss - rightGutterCss);
    const preferredItemWidthCss = isPortrait
      ? Math.min(300, cssW - 32)
      : isMobile ? Math.min(360, cssW - 60) : 200;
    const itemWidthCss = Math.min(
      preferredItemWidthCss,
      (gridRegionWCss - (cols - 1) * gapCss) / cols
    );
    const itemWidth = s(itemWidthCss);
    const rowWidthCss = cols * itemWidthCss + (cols - 1) * gapCss;
    // Centre the grid inside its region (full width in portrait/mobile).
    const startXCss = leftGutterCss + (gridRegionWCss - rowWidthCss) / 2;

    // --- Vertical budget: reserve fixed bands for the header and the button row,
    // then FIT the card rows into what's left. This is the core overlap fix: cards
    // can never grow into the buttons because the button band is subtracted first. ---
    const buttonHeightCss = isMobile ? 48 : 44;
    const buttonSpacingCss = 10;
    const bottomMarginCss = 14;
    const gridToButtonGapCss = 12; // guaranteed clear space between last row and buttons
    // Two button rows: Next Wave (full width), then Reroll + Auto-Buy side by side.
    const buttonBandCss =
      buttonHeightCss * 2 + buttonSpacingCss + bottomMarginCss + gridToButtonGapCss;

    // Top of the card grid, below the title/gold/stats header.
    const gridTopCss = isMobile ? 110 : 120;

    const preferredItemHeightCss = isPortrait ? 92 : isMobile ? 100 : 150;
    const minItemHeightCss = isMobile ? 34 : 70;
    const availForItemsCss = cssH - gridTopCss - buttonBandCss;
    const fittedItemHeightCss = (availForItemsCss - (rows - 1) * gapCss) / rows;
    const itemHeightCss = Math.max(
      minItemHeightCss,
      Math.min(preferredItemHeightCss, fittedItemHeightCss)
    );
    const itemHeight = s(itemHeightCss);

    const startY = s(gridTopCss);
    const startX = s(startXCss);

    const buttonWidth = s(isMobile ? 240 : 220);
    const buttonHeight = s(buttonHeightCss);
    const buttonSpacing = s(buttonSpacingCss);
    const itemsEndY = startY + rows * (itemHeight + gap);
    // Two rows of buttons: Next Wave (full width) then Reroll + Auto-Buy split.
    const continueY = Math.min(
      itemsEndY + s(gridToButtonGapCss - gapCss),
      this.canvas.height - buttonHeight * 2 - buttonSpacing - s(bottomMarginCss)
    );
    const rerollY = continueY + buttonHeight + buttonSpacing;
    // Split the second row into two side-by-side buttons sharing the full-width
    // footprint (Reroll left, Auto-Buy right) with a small gap between them.
    const splitGap = s(10);
    const splitButtonWidth = Math.floor((buttonWidth - splitGap) / 2);
    const rowCenterX = this.canvas.width / 2;
    const rerollX = rowCenterX - buttonWidth / 2 + splitButtonWidth / 2;
    const autoBuyX = rowCenterX + buttonWidth / 2 - splitButtonWidth / 2;

    return {
      zoom, s, isPortrait, isMobile, cols,
      itemWidth, itemHeight, gap, startX, startY,
      lockButtonSize: s(isMobile ? 34 : 26),
      buttonWidth, buttonHeight, continueY, rerollY,
      splitButtonWidth, rerollX, autoBuyX,
      // Card content offsets/sizes (within a card). Portrait/mobile cards are
      // short (~84-100px), so the icon must stay small and the name must clear
      // it — hence smaller mobile iconSize and a name row pushed below the icon.
      iconY: Math.round(itemHeight * 0.12),
      iconSize: s(isMobile ? 20 : 30),
      nameY: Math.round(itemHeight * 0.5),
      nameSize: s(isMobile ? 9 : 10),
      descY: Math.round(itemHeight * 0.66),
      descSize: s(8),
      costY: Math.round(itemHeight * 0.82),
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
    const { s, cols, itemWidth, itemHeight, gap, startX, startY, lockButtonSize,
      buttonWidth, buttonHeight, continueY, rerollY,
      splitButtonWidth, rerollX, autoBuyX } = this.getShopLayout();

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

      // Responsive grid: `cols` columns (1 in portrait, 3 otherwise)
      const gridCol = i % cols;
      const gridRow = Math.floor(i / cols);

      const x = startX + gridCol * (itemWidth + gap);
      const y = startY + gridRow * (itemHeight + gap);

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
          if (this.purchaseShopItem(i)) {
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

    // Reroll button (left half of the second row)
    const rerollBtn = {
      x: rerollX - splitButtonWidth / 2,
      y: rerollY,
      width: splitButtonWidth,
      height: buttonHeight
    };

    if (pointInRect(mouseX, mouseY, rerollBtn) && this.input.mouseDown) {
      if (this.rerollShop()) {
        this.audio.playPurchase();
        this.input.mouseDown = false;
      }
    }

    // Auto-Buy button (right half of the second row) — greedily buy every
    // affordable item, reroll, repeat until neither an item nor a reroll fits.
    const autoBuyBtn = {
      x: autoBuyX - splitButtonWidth / 2,
      y: rerollY,
      width: splitButtonWidth,
      height: buttonHeight
    };

    if (pointInRect(mouseX, mouseY, autoBuyBtn) && this.input.mouseDown) {
      this.autoBuyAll();
      this.input.mouseDown = false;
    }
  }

  /**
   * Buy the shop item in slot `i` if the player can afford it. Returns true on a
   * successful purchase. Shared by the click handler and Auto-Buy so the item
   * effects (duos, health, shield, lock clear) stay in one place. Does NOT play
   * the purchase sound — the caller owns that so Auto-Buy can play it once.
   */
  private purchaseShopItem(i: number): boolean {
    if (!this.player) return false;
    const item = this.shopItems[i];
    if (!item) return false;

    // DYNAMIC PRICING: wave-scaled price with shop discount.
    const finalPrice = this.playerStats.getItemPrice(item, this.waveManager.currentWave);
    if (this.player.gold < finalPrice) return false;

    this.player.gold -= finalPrice;
    const { newDuos, newTransformations } = this.playerStats.addItem(item);
    this.itemsPurchasedThisWave++;

    // GAME FEEL: Duo unlock effects
    if (newDuos.length > 0) {
      this.audio.playDuoUnlock();
      for (const duo of newDuos) {
        console.log(`🎉 DUO UNLOCKED: ${duo.name} - ${duo.description}`);
        this.screenEffects.flash(duo.glowColor || '#ff00ff', 0.3);
      }
    }

    // GAME FEEL: Transformation (tag-mastery) fanfare — a once-per-run milestone
    if (newTransformations.length > 0) {
      this.audio.playTransformation();
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

    // Mark slot empty (null) instead of removing to preserve indices; reroll refills.
    this.shopItems[i] = null as any;
    return true;
  }

  /**
   * Reroll the shop if the player can afford it (free when the shop is empty).
   * Returns true if a reroll happened. Does NOT play the sound (caller owns it).
   */
  private rerollShop(): boolean {
    if (!this.player) return false;

    // ADVANCED REROLL: Free reroll ONLY when shop is completely empty.
    const freeReroll = this.shopItems.filter(item => item !== null && item !== undefined).length === 0;
    const effectiveRerollCost = freeReroll ? 0 : this.shopRerollCost;
    if (this.player.gold < effectiveRerollCost) return false;

    this.player.gold -= effectiveRerollCost;

    // Rebuild shop to full 6 slots, keeping locked items in their positions.
    const shopSlotCount = 6;
    const newShopItems: Item[] = [];
    const lockedItems: Map<number, Item> = new Map();
    for (const index of this.lockedShopItems) {
      if (this.shopItems[index]) {
        lockedItems.set(index, this.shopItems[index]);
      }
    }

    // Generate new items for unlocked slots (BROTATO-STYLE WEIGHTED).
    const unlockedSlotCount = shopSlotCount - lockedItems.size;
    const newItems = ItemDatabase.getWeightedShopItems(
      unlockedSlotCount,
      this.waveManager.currentWave,
      this.playerStats.items,
      this.playerStats.getLuck(),
      this.playerStats // Hide items whose only effect is an already-maxed capped stat
    );

    let newItemIndex = 0;
    for (let i = 0; i < shopSlotCount; i++) {
      if (lockedItems.has(i)) {
        newShopItems.push(lockedItems.get(i)!);
      } else {
        newShopItems.push(newItems[newItemIndex++]);
      }
    }
    this.shopItems = newShopItems;

    // DYNAMIC REROLL COST: scale per reroll this wave (always at least +1).
    const wave = this.waveManager.currentWave;
    const rerollScaling = Math.max(1, Math.floor(wave * 0.4));
    this.shopRerollCost = Math.min(
      this.metaProgression.getRerollDiscount().maxCost,
      this.shopRerollCost + rerollScaling
    );

    this.shopRerolls++;
    return true;
  }

  /**
   * Auto-Buy: greedily buy every affordable item in the shop, then reroll and
   * repeat, until neither another item nor a reroll can be afforded. A hard
   * iteration cap guards against any pathological non-terminating case (e.g. a
   * locked-but-unaffordable card the player can never buy while rerolls stay free).
   */
  private autoBuyAll(): void {
    if (!this.player) return;

    let didAnything = false;
    const MAX_PASSES = 1000;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      // Buy every affordable item in the current shop (cheapest reachable first
      // falls out naturally as gold drops through the slot order).
      let boughtThisPass = false;
      for (let i = 0; i < this.shopItems.length; i++) {
        if (this.purchaseShopItem(i)) {
          boughtThisPass = true;
          didAnything = true;
        }
      }

      // Then try to reroll for a fresh set to buy from.
      if (this.rerollShop()) {
        didAnything = true;
        continue;
      }

      // Can't reroll. If we also bought nothing this pass, we're done.
      if (!boughtThisPass) break;
    }

    if (didAnything) this.audio.playPurchase();
  }

  private startNextWave(opts?: { elite?: boolean; boss?: boolean }): void {
    // ARTIFACT: re-arm Second Wind and reset the momentum ramp at each wave start.
    if (this.player) this.player.secondWindArmed = this.artifacts.hasSecondWind();
    this.momentumTime = 0;
    // Grindstone: one more wave entered. Ramp pays out on (wavesSurvived-1), so
    // wave 1 grants nothing and every wave cleared thereafter adds a permanent tick.
    this.wavesSurvived++;
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
        this.eventReward = null;
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
    const pool = ROLLABLE_ARTIFACTS.filter(a => !this.artifacts.has(a.id));
    if (pool.length === 0) {
      // Nothing left to grant — skip straight to the continuation.
      then();
      return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    this.rewardChoices = shuffled.slice(0, Math.min(3, shuffled.length));
    this.rewardTitle = title;
    this.rewardThen = then;
    this.rewardSkippable = true; // elite/treasure/boss spoils can always be declined
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

  /**
   * Per-frame runtime damage/fire-rate modifiers — the single composition point for
   * every CONDITIONAL bonus (both artifacts and the new triggered items). Each source
   * multiplies into a running factor (identity 1 when not held / condition unmet), so
   * they stack cleanly and getDamage()/getFireRate() just read the product. Artifacts:
   * momentum (moving), berserk (low HP). Items: Grindstone (wave ramp), Last Stand
   * (low HP), Killing Spree (kill streak), Juggernaut (high HP), Miser's Hoard (gold).
   */
  private updateRuntimeModifiers(dt: number, moving: boolean): void {
    if (!this.player) return;
    let dmg = 1;
    let fr = 1;

    const hpFrac = this.player.health / Math.max(1, this.player.maxHealth);

    // --- ARTIFACTS ---
    // Momentum: ramp up over ~3s of continuous movement, reset when standing still.
    const momentumMax = this.artifacts.momentumBonus();
    if (momentumMax > 0) {
      this.momentumTime = moving ? Math.min(3, this.momentumTime + dt) : 0;
      dmg *= 1 + momentumMax * (this.momentumTime / 3);
    }
    // Berserk: extra fire rate as HP drops (0 at full HP, full bonus near death).
    const berserkMax = this.artifacts.berserkBonus();
    if (berserkMax > 0) {
      fr *= 1 + berserkMax * (1 - hpFrac);
    }

    // --- CONDITIONAL ITEMS ---
    // Grindstone: permanent +dmg per wave survived this run (wavesSurvived-1 so wave 1 = 0).
    const waveRamp = this.playerStats.getWaveRampDamage();
    if (waveRamp > 0) {
      dmg *= 1 + waveRamp * Math.max(0, this.wavesSurvived - 1);
    }
    // Last Stand: while at/under the low-HP threshold, +dmg AND +fire rate. Full bonus
    // the moment you cross the line (a clean "danger power" spike, not a gradual ramp).
    const lowHp = this.playerStats.getLowHpPower();
    if (lowHp > 0 && hpFrac <= Game.LOW_HP_THRESHOLD) {
      dmg *= 1 + lowHp;
      fr *= 1 + lowHp;
    }
    // Killing Spree: decaying on-kill stack. Drain once the grace window lapses.
    if (this.killStackCount > 0) {
      this.killStackTimer += dt;
      if (this.killStackTimer > Game.KILL_STACK_GRACE) {
        this.killStackCount = Math.max(0, this.killStackCount - Game.KILL_STACK_DRAIN * dt);
      }
    }
    const killStack = this.playerStats.getKillStackDamage();
    if (killStack > 0 && this.killStackCount > 0) {
      dmg *= 1 + killStack * this.killStackCount;
    }
    // Juggernaut: while at/over the high-HP threshold (staying unhurt), +dmg. The
    // glass-cannon inverse of Last Stand — rewards clean, no-hit play.
    const highHp = this.playerStats.getHighHpPower();
    if (highHp > 0 && hpFrac >= Game.HIGH_HP_THRESHOLD) {
      dmg *= 1 + highHp;
    }
    // Miser's Hoard: +dmg scaling with unspent gold on hand (capped), so hoarding for
    // power trades against spending in the shop — a real, ongoing decision.
    const goldScale = this.playerStats.getGoldScaleDamage();
    if (goldScale > 0) {
      const factor = Math.min(Game.GOLD_SCALE_CAP, goldScale * (this.player.gold / Game.GOLD_SCALE_PER));
      dmg *= 1 + factor;
    }
    // Soul Tithe: permanent +dmg per stack banked from kill milestones this run (uncapped
    // by design — it's the slow "clear speed = a stat" payoff, and stays finite via getDamage's
    // sanity cap). The stacks persist across frames; we just re-fold them each recompute.
    if (this.soulTitheStacks > 0) {
      dmg *= 1 + Game.SOUL_TITHE_DMG_PER * this.soulTitheStacks;
    }

    this.playerStats.runtimeDamageMult = dmg;
    this.playerStats.runtimeFireRateMult = fr;
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

  /** Word-wrap helper — delegates to the renderer's single canonical wrap so draw
   *  and hit-test math share one implementation (see `Renderer.wrapLines`). */
  private wrapText(text: string, maxWidth: number, fontPx: number): string[] {
    return this.renderer.wrapLines(text, maxWidth, fontPx);
  }

  /** The in-run gear button, top-right just under the wave panel. One source of
   *  truth so drawHUD (paints it) and updatePlaying (hit-tests it) never drift. */
  private gearButtonRect(): { x: number; y: number; width: number; height: number } {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const topY = s(6) + this.safeAreaTop(zoom);
    const rPanelH = s(8) * 2 + s(34); // mirrors the wave panel height in drawHUD
    const size = s(34);
    return {
      x: this.canvas.width - size - s(6),
      y: topY + rPanelH + s(6),
      width: size,
      height: size,
    };
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

  /** Shared rarity → colour for reward/event cards. */
  private static readonly RARITY_COLOR: Record<string, string> = {
    common: '#cbd5e1', rare: '#74c0fc', epic: '#b06bd9', legendary: '#f2b04e',
  };

  /** Height of the event-result reward card (0 if the event granted no item). */
  private eventRewardCardHeight(cardW: number, s: (v: number) => number, isMobile: boolean): number {
    if (!this.eventReward) return 0;
    const bodyPx = s(isMobile ? 8 : 9);
    const descLines = this.wrapText(this.eventReward.desc, cardW - s(24), bodyPx).length;
    return s(isMobile ? 32 : 34) + descLines * (bodyPx + s(3)) + s(10);
  }

  /** Draw the card showing exactly which item/artifact an event just granted. */
  private drawEventRewardCard(x0: number, y: number, cardW: number, s: (v: number) => number, isMobile: boolean): void {
    if (!this.eventReward) return;
    const ctx = this.renderer.getContext();
    const h = this.eventRewardCardHeight(cardW, s, isMobile);
    drawPanel(ctx, x0, y, cardW, h, DARK_WOOD_THEME, 23, 67);
    const color = Game.RARITY_COLOR[this.eventReward.rarity] || '#ffffff';
    const iconBox = s(isMobile ? 26 : 28);
    const textX = x0 + s(12) + iconBox + s(8);
    const textW = cardW - (textX - x0) - s(12);
    if (this.eventReward.artifactId) {
      this.renderer.drawArtifactIcon(this.eventReward.artifactId, x0 + s(12), y + (h - iconBox) / 2, iconBox, 'left');
    } else {
      this.renderer.drawItemIcon(this.eventReward.icon, x0 + s(12), y + (h - iconBox) / 2, iconBox, 'left');
    }
    this.renderer.drawText(this.eventReward.name, textX, y + s(isMobile ? 15 : 17), { size: s(isMobile ? 11 : 13), align: 'left', color });
    this.renderer.drawText(this.eventReward.rarity.toUpperCase(), x0 + cardW - s(12), y + s(isMobile ? 15 : 17), { size: s(7), align: 'right', color });
    const bodyPx = s(isMobile ? 8 : 9);
    for (const [li, line] of this.wrapText(this.eventReward.desc, textW, bodyPx).entries()) {
      this.renderer.drawText(line, textX, y + s(isMobile ? 32 : 34) + li * (bodyPx + s(3)), { size: bodyPx, align: 'left', color: '#d8c9a8' });
    }
  }

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
    const titlePx = s(isMobile ? 14 : 18);
    for (const line of this.wrapText(ev.title, contentW - s(24), titlePx)) {
      this.renderer.drawText(line, W / 2, y, { size: titlePx, align: 'center', color: '#ffd700' });
      y += titlePx + s(4);
    }
    y += s(isMobile ? 6 : 8);

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
      y += s(10);
      const cardW = contentW - s(16);
      if (this.eventReward) {
        this.drawEventRewardCard((W - cardW) / 2, y, cardW, s, isMobile);
        y += this.eventRewardCardHeight(cardW, s, isMobile);
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
    const titlePx = s(isMobile ? 14 : 18);
    const titleLines = this.wrapText(ev.title, contentW - s(24), titlePx).length;
    let y = s(isMobile ? 26 : 34) + titleLines * (titlePx + s(4)) + s(isMobile ? 6 : 8);
    const bodyPx = s(isMobile ? 9 : 11);
    y += this.wrapText(ev.text, contentW - s(24), bodyPx).length * (bodyPx + s(5));
    y += s(10);

    if (this.eventResultText === null) {
      const rects = this.columnRects(ev.options.length, y, s, W, isMobile);
      for (let i = 0; i < ev.options.length; i++) {
        if (pointInRect(mx, my, rects[i])) {
          this.input.mouseDown = false;
          this.applyEventOption(ev.options[i]);
          return;
        }
      }
    } else {
      y += this.wrapText(this.eventResultText, contentW - s(24), bodyPx).length * (bodyPx + s(5)) + s(10);
      const cardW = contentW - s(16);
      if (this.eventReward) y += this.eventRewardCardHeight(cardW, s, isMobile);
      y += s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      if (pointInRect(mx, my, r)) {
        this.input.mouseDown = false;
        this.currentEvent = null;
        this.eventResultText = null;
        this.eventReward = null;
        this.state = 'map';
      }
    }
    void H;
  }

  /** Apply a chosen event option's effects and set the result text.
   *  Devil-deal integrity: a pact's boon is PRICED by a permanent curse. If the player
   *  already bears that curse (a recurring devil event drawn again), the price is already
   *  paid — handing out the boon a second time for free would let a run farm boons and gut
   *  the "permanent price" risk axis. So an already-held-curse pact grants nothing. */
  private applyEventOption(opt: EventOption): void {
    const curseEff = opt.effects.find(e => e.kind === 'curse');
    if (curseEff && curseEff.kind === 'curse' && this.artifacts.has(curseEff.id)) {
      this.eventReward = null;
      this.eventResultText = 'You already bear this mark. The devil has nothing left to sell you.';
      return;
    }
    for (const eff of opt.effects) this.applyEventEffect(eff);
    this.eventResultText = opt.result;
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
        const pool = ROLLABLE_ARTIFACTS.filter(a => !this.artifacts.has(a.id));
        if (pool.length) {
          const picked = pool[Math.floor(Math.random() * pool.length)];
          this.grantArtifact(picked);
          this.eventReward = { name: picked.name, rarity: picked.rarity, desc: picked.desc, icon: picked.icon, artifactId: picked.id };
        }
        break;
      }
      case 'curse': {
        // Devil-deal price: grant a SPECIFIC named curse artifact. Idempotent — if the
        // player already carries it, grantArtifact's dedupe simply no-ops.
        const curse = getArtifactById(effect.id);
        if (curse) this.grantArtifact(curse);
        break;
      }
      case 'item': {
        const items = ItemDatabase.getWeightedShopItems(1, this.waveManager.currentWave, this.playerStats.items, this.playerStats.getLuck(), this.playerStats);
        if (items[0]) {
          this.playerStats.addItem(items[0]);
          this.refreshMaxHealth();
          this.eventReward = { name: items[0].name, rarity: items[0].rarity, desc: items[0].description, icon: items[0].icon };
        }
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

    const iconBox = s(isMobile ? 28 : 30);
    const textX = x0 + s(12) + iconBox + s(8);
    const textW = cardW - (textX - x0) - s(12);
    this.rewardChoices.forEach((a, i) => {
      const y = topY + i * (cardH + gap);
      drawPanel(ctx, x0, y, cardW, cardH, DARK_WOOD_THEME, 11 + i, 53);
      this.renderer.drawArtifactIcon(a.id, x0 + s(12), y + (cardH - iconBox) / 2, iconBox, 'left');
      this.renderer.drawText(a.name, textX, y + s(isMobile ? 16 : 18), { size: s(isMobile ? 11 : 13), align: 'left', color: rarityColor[a.rarity] || '#ffffff' });
      this.renderer.drawText(a.rarity.toUpperCase(), x0 + cardW - s(12), y + s(isMobile ? 16 : 18), { size: s(7), align: 'right', color: rarityColor[a.rarity] || '#ffffff' });
      for (const [li, line] of this.wrapText(a.desc, textW, bodyPx).entries()) {
        this.renderer.drawText(line, textX, y + s(isMobile ? 34 : 36) + li * (bodyPx + s(3)), { size: bodyPx, align: 'left', color: '#d8c9a8' });
      }
    });

    // Optional Skip — decline the artifact (e.g. to keep a tight, focused build).
    if (this.rewardSkippable) {
      const skipY = topY + this.rewardChoices.length * (cardH + gap) + s(4);
      const r = this.columnRects(1, skipY, s, W, isMobile)[0];
      this.renderer.drawButton(r.x, r.y, r.width, r.height, 'Skip', false, true, isMobile);
    }
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
        this.rewardSkippable = false;
        if (then) then();
        return;
      }
    }

    // Skip button (same geometry as the draw pass).
    if (this.rewardSkippable) {
      const skipY = topY + this.rewardChoices.length * (cardH + gap) + s(4);
      const r = this.columnRects(1, skipY, s, W, isMobile)[0];
      if (pointInRect(mx, my, r)) {
        this.input.mouseDown = false;
        const then = this.rewardThen;
        this.rewardChoices = [];
        this.rewardThen = null;
        this.rewardSkippable = false;
        if (then) then();
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

  // Pause/menu overlay buttons — shared geometry so drawPaused and updatePaused
  // can never drift (the old code drew centred but hit-tested at a fixed y).
  private pausedTopY(s: (v: number) => number, isMobile: boolean): number {
    return s(isMobile ? 150 : 172);
  }

  private updatePaused(): void {
    if (!this.input.mouseDown) return;
    const { s, W, isMobile } = this.screenScale();
    const rects = this.columnRects(5, this.pausedTopY(s, isMobile), s, W, isMobile);
    const mx = this.input.mouseX;
    const my = this.input.mouseY;

    if (pointInRect(mx, my, rects[0])) {          // Resume
      this.state = 'playing';
      this.input.mouseDown = false;
    } else if (pointInRect(mx, my, rects[1])) {   // Sound toggle
      this.audio.toggle();
      this.input.mouseDown = false;
    } else if (pointInRect(mx, my, rects[2])) {   // End Run — cash out souls now
      this.input.mouseDown = false;
      this.gameOver();
    } else if (pointInRect(mx, my, rects[3])) {   // Restart Run
      this.input.mouseDown = false;
      this.openClassSelect();
    } else if (pointInRect(mx, my, rects[4])) {   // Main Menu (abandons the run)
      this.input.mouseDown = false;
      this.state = 'menu';
      SaveManager.clearRun();
    }
  }

  /** Lazily build the walkable village and enter it (replaces the old grid). */
  private enterVillage(): void {
    if (!this.villageScene) {
      this.villageScene = new VillageScene({
        canvas: this.canvas,
        renderer: this.renderer,
        input: this.input,
        audio: this.audio,
        meta: this.metaProgression,
        onEmbark: () => this.openClassSelect(),
        onBack: () => { this.state = 'menu'; },
      });
    }
    this.villageScene.enter();
    this.state = 'village';
  }

  private updateVillage(dt: number): void {
    this.villageScene?.update(dt);
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
      this.openClassSelect();
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, upgradesBtn) && this.input.mouseDown) {
      this.enterVillage();
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

    // Extracted scenes draw themselves; the rest stay in the switch below. The
    // evolution banner + layer composite after this still run for every state.
    const activeScene = this.scenes[this.state];
    if (activeScene) {
      activeScene.draw();
    } else {
    switch (this.state) {
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
      case 'village':
        this.drawVillage();
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
      case 'levelup':
        this.drawLevelup();
        break;
      case 'rest':
        this.drawRest();
        break;
      case 'classselect':
        this.drawClassSelect();
        break;
    }
    }

    // Weapon-evolution banner: a top-level overlay so it reads over BOTH the playing
    // screen and the shop/reward screen the wave-clear transitions into.
    this.drawEvolutionBanner();

    // LAYERED RENDERING: Composite all layers
    this.renderer.compositeLayers();

    this.renderer.endFrame();
  }

  // Prominent gold banner shown for a few seconds after a weapon evolves. Drawn over
  // whatever screen is active (playing → shop), so the payoff is never missed.
  private drawEvolutionBanner(): void {
    if (this.evolutionBannerTimer <= 0 || !this.evolutionBannerText) return;
    const ctx = this.renderer.getContext();
    const alpha = Math.min(1, this.evolutionBannerTimer / 0.6); // fade out over the last 0.6s
    ctx.save();
    ctx.globalAlpha = alpha;
    // Subtle darkened strip behind the text for legibility over busy backdrops.
    const cx = this.canvas.width / 2;
    const y = this.canvas.height * 0.18;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, y - 30, this.canvas.width, 60);
    this.renderer.drawText(this.evolutionBannerText, cx, y, {
      size: 30,
      bold: true,
      align: 'center',
      color: '#ffd43b',
      // Auto-shrink so the (variable-length) name never clips off narrow portrait.
      maxWidth: this.canvas.width - 40
    });
    ctx.restore();
  }

  private drawPlaying(): void {
    if (!this.player) return;

    const ctx = this.renderer.getContext();

    ctx.save();

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

    for (const coin of this.coins) {
      if (this.entityCuller.isVisible(coin)) {
        coin.draw(ctx);
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
      ...this.xpOrbs,
      ...this.coins
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
      xpOrbs: this.xpOrbs.length + this.coins.length,
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

  // Reads the device's top safe-area inset (notch / status bar) in *canvas* pixels.
  // The HTML controls already respect env(safe-area-inset-*); the canvas HUD didn't,
  // so on a notched phone in portrait the top panels were drawn under the status bar.
  //
  // env(safe-area-inset-top) only reports a value with viewport-fit=cover (now set),
  // and even then Android Chrome usually reports 0 for its status bar — so in portrait
  // we also apply a minimum clearance band so the HUD never tucks under the status bar
  // on a phone. Landscape/desktop keep the raw inset (no wasted vertical space).
  private safeAreaTop(zoom: number): number {
    if (!this.safeAreaProbe) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);' +
        'pointer-events:none;visibility:hidden;';
      document.body.appendChild(el);
      this.safeAreaProbe = el;
    }
    const cssInset = this.safeAreaProbe.getBoundingClientRect().height; // display px
    const isPortrait = this.canvas.width < this.canvas.height;
    // ~status-bar height in display px; only reserved in portrait on a phone.
    const portraitFloor = isPortrait ? 24 : 0;
    return Math.round(Math.max(cssInset, portraitFloor) * zoom);
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
    // Top origin for HUD panels: base margin plus the device safe-area inset so the
    // notch / status bar never clips the HP/wave panels in portrait.
    const topY = s(6) + this.safeAreaTop(zoom);

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
    drawPanel(ctx, s(6), topY, panelW, panelH, DARK_WOOD_THEME, art);

    const x0 = s(6) + pad + s(2);
    let y = topY + pad + s(2);
    const barX = x0 + iconS + s(6);
    const textX = barX + barW + s(8);

    const hpFrac = this.player.health / this.player.maxHealth;
    const heart = UISprites.getIcon('heart');
    if (heart) ctx.drawImage(heart, x0, y, iconS, iconS);
    drawBar(barX, y + Math.round((iconS - barH) / 2), barW, barH, hpFrac,
      hpFrac > 0.6 ? '#4ade80' : hpFrac > 0.3 ? '#fbbf24' : '#ef4444', '#3c0000');
    this.renderer.drawText(
      `${formatShort(Math.ceil(this.player.health))}/${formatShort(this.player.maxHealth)}`,
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
    this.renderer.drawText(`${formatShort(this.player.gold)}`, barX, y + Math.round(iconS / 2), {
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
    drawPanel(ctx, rx, topY, rPanelW, rPanelH, DARK_WOOD_THEME, art, 3);
    this.renderer.drawText(waveText, rx + rPanelW / 2, topY + pad + s(4), {
      size: s(isPortrait ? 9 : 11), align: 'center', color: waveColor
    });
    const t = Math.max(0, Math.ceil(this.waveManager.waveTimer));
    const timerText = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.renderer.drawText(
      `${timerText}  ·  ${this.enemies.length + this.waveManager.waveEnemiesRemaining}`,
      rx + rPanelW / 2, topY + pad + s(22),
      { size: s(8), align: 'center', color: t <= 5 ? '#ffd43b' : '#cfd8e3' }
    );

    // --- Gear button (opens the pause/menu overlay to cash out souls, restart, etc.) ---
    const g = this.gearButtonRect();
    drawPanel(ctx, g.x, g.y, g.width, g.height, DARK_WOOD_THEME, art, 9);
    this.renderer.drawText('\u2699', g.x + g.width / 2, g.y + g.height / 2 + s(1), {
      size: s(18), align: 'center', baseline: 'middle', color: '#ffe8b0'
    });

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
    let statusY = topY + panelH + s(8);
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
    const { s, isMobile, cols, itemWidth, itemHeight, gap, startX, startY, lockButtonSize,
      buttonWidth, buttonHeight, continueY, rerollY,
      splitButtonWidth, rerollX, autoBuyX,
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

    // formatShort on every numeric field so deep-run values stay readable and never
    // render as raw floats or scientific notation (the stats-panel bug Felix flagged).
    const fr = this.playerStats.getFireRate();
    const stats: Array<[string, string, string]> = [
      ['HP', `${formatShort(Math.ceil(this.player.health))}/${formatShort(this.playerStats.getMaxHealth())}`, '#ff6b6b'],
      ['DMG', `${formatShort(this.playerStats.getDamage())}`, '#ffa94d'],
      ['FIRE', `${fr >= 1000 ? formatShort(fr) : fr.toFixed(1)}/S`, '#ff8787'],
      ['SPD', `${formatShort(this.playerStats.getSpeed())}`, '#66d9e8'],
      ['CRIT', `${formatShort(Math.floor(this.playerStats.getCritChance() * 100))}%`, '#ffd43b'],
      ['MULTI', `${formatShort(this.playerStats.getMultishot())}`, '#69db7c'],
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

        // Item icon (pixel-art sprite)
        this.renderer.drawItemIcon(item.icon, x + iconSize / 2, y + s(2), s(18));

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

      // Responsive grid: `cols` columns (1 in portrait, 3 otherwise)
      const gridCol = i % cols;
      const gridRow = Math.floor(i / cols);

      const x = startX + gridCol * (itemWidth + gap);
      const y = startY + gridRow * (itemHeight + gap);
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
      this.renderer.drawItemIcon(isLocked ? '🔒' : '🔓', lockButtonX + lockButtonSize / 2, lockButtonY + Math.round(lockButtonSize * 0.12), Math.round(lockButtonSize * 0.76), 'center');

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
        this.renderer.drawItemIcon('♻️', recycleButtonX + recycleButtonSize / 2, recycleButtonY + Math.round(recycleButtonSize * 0.12), Math.round(recycleButtonSize * 0.76), 'center');
      }

      // Synergy indicator — NAME the combo so it's legible, not a vague "SYNERGY".
      // Priority: completes a named duo > teaches an unowned duo pairing > tag synergy.
      if (completesDuo || duoInfo || hasTagMatch || hasSynergy) {
        let indicatorText = '';
        let indicatorColor = '#00ff00';
        if (completesDuo && duoInfo) {
          // You own the partner — buying this fires the combo now.
          indicatorText = duoInfo.name.toUpperCase();
          indicatorColor = '#ffd43b';
        } else if (duoInfo) {
          // Part of a named combo you don't have the partner for yet — teach the pairing.
          indicatorText = `+ ${duoInfo.partner}`;
          indicatorColor = '#74c0fc';
        } else if (hasTagMatch) {
          // Show which tags match (as uppercase text, not emoji)
          const tagLabel = matchingTags.map(t => t.toUpperCase()).join('/');
          indicatorText = `${tagLabel} FIT`;
          indicatorColor = '#7bd94a';
        } else if (hasSynergy) {
          indicatorText = 'GOOD FIT';
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

      // Icon with better positioning (pixel-art sprite)
      this.renderer.drawItemIcon(item.icon, x + itemWidth / 2, y + iconY, iconSize);

      // Name — pixel font is wide, so sizes are tuned to fit the card width
      this.renderer.drawText(item.name, x + itemWidth / 2, y + nameY, {
        size: nameSize,
        align: 'center',
        color: rarityColor
      });

      // Category chips (weapon / passive / active) — at-a-glance "what does this item do".
      const kindColors: Record<string, string> = { weapon: '#f0637a', passive: '#6aa9ff', active: '#ffc14d' };
      const kinds = getItemKinds(item);
      const chipSize = Math.max(6, Math.round(nameSize * 0.5));
      const chipLabel = kinds.map(k => k.toUpperCase()).join('  ');
      // Sit the chip row in the gap between the name and the description so it scales
      // with card height and never collides with either row.
      const chipY = nameY + Math.round((descY - nameY) * 0.58);
      this.renderer.drawText(chipLabel, x + itemWidth / 2, y + chipY, {
        size: chipSize,
        align: 'center',
        color: kinds.length === 1 ? kindColors[kinds[0]] : '#cbb892',
      });

      // Description (more compact) — swapped for the combo payoff when you'd complete a duo,
      // so the card tells you WHAT the synergy does at the moment of decision, not just its name.
      // Wrapped through the standardized text-box primitive: it fills the space between the
      // description row and the cost row, wrapping onto as many lines as fit and shrinking only
      // as a last resort — so a long description never overflows the card (portrait) or shrinks
      // to an unreadable single line, however long the copy.
      const descMaxW = itemWidth - s(12);
      const descLineH = descSize + Math.max(2, Math.round(descSize * 0.35));
      const descMaxLines = Math.max(1, Math.floor((costY - descY) / descLineH));
      this.renderer.drawWrappedText(
        completesDuo && duoInfo ? duoInfo.effect : item.description,
        x + itemWidth / 2, y + descY,
        {
          size: descSize,
          align: 'center',
          color: completesDuo && duoInfo ? '#ffe066' : '#e5d9c3',
          maxWidth: descMaxW,
          maxLines: descMaxLines,
        }
      );

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

    // Second row: Reroll (left half) + Auto-Buy (right half), side by side.
    const freeReroll = this.shopItems.filter(item => item !== null && item !== undefined).length === 0;
    const effectiveRerollCost = freeReroll ? 0 : this.shopRerollCost;
    const canAffordReroll = this.player.gold >= effectiveRerollCost;
    this.renderer.drawButton(
      rerollX - splitButtonWidth / 2,
      rerollY,
      splitButtonWidth,
      buttonHeight,
      freeReroll ? 'Reroll (FREE)' : `Reroll (${this.shopRerollCost}g)`,
      false,
      canAffordReroll,
      isMobile
    );

    // Auto-Buy — enabled when the player can afford at least the cheapest shop
    // item OR a reroll.
    const cheapestPrice = this.shopItems.reduce((min, it) => {
      if (!it) return min;
      const p = this.playerStats.getItemPrice(it, this.waveManager.currentWave);
      return Math.min(min, p);
    }, Infinity);
    const canAutoBuy = this.player.gold >= cheapestPrice || canAffordReroll;
    this.renderer.drawButton(
      autoBuyX - splitButtonWidth / 2,
      rerollY,
      splitButtonWidth,
      buttonHeight,
      'Auto-Buy',
      false,
      canAutoBuy,
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
    // All numeric formatting routes through formatShort so deep-run values stay
    // readable (K/M/B/T) and never render as raw floats or scientific notation
    // (e.g. "2979.5297" or "6.82e+278" — the pre-cap ugliness Felix flagged).
    const num = (v: number) => formatShort(v);
    const pct = (v: number) => `${formatShort(Math.round(v * 100))}%`;
    const mult = (v: number) => (v >= 1000 ? `${formatShort(v)}x` : `${v.toFixed(2)}x`);
    const rate = (v: number, dp: number, suf: string) =>
      `${v >= 1000 ? formatShort(v) : v.toFixed(dp)}${suf}`;
    type Row = [string, string, boolean];
    const groups: Array<[string, string, Row[]]> = [
      ['OFFENSE', '#ffa94d', [
        ['Damage', num(ps.getDamage()), true],
        ['Fire Rate', rate(ps.getFireRate(), 2, '/s'), true],
        ['Multishot', `+${num(ps.getMultishot())}`, ps.getMultishot() > 0],
        ['Crit Chance', pct(ps.getCritChance()), true],
        ['Crit Damage', mult(ps.getCritMultiplier()), true],
        ['Piercing', num(ps.getPiercing()), ps.getPiercing() > 0],
        ['Knockback', num(ps.getKnockback()), ps.getKnockback() > 0],
        ['Projectile Speed', num(ps.getProjectileSpeed()), false],
        ['Melee Dmg', mult(ps.getMeleeDamageMult()), ps.getMeleeDamageMult() > 1.001],
        ['Ranged Dmg', mult(ps.getRangedDamageMult()), ps.getRangedDamageMult() > 1.001],
        ['Elemental Dmg', mult(ps.getElementalDamageMult()), ps.getElementalDamageMult() > 1.001],
      ]],
      ['DEFENSE', '#74c0fc', [
        ['Max Health', num(ps.getMaxHealth()), true],
        ['Armor', num(ps.getArmor()), ps.getArmor() > 0],
        ['Dodge', pct(ps.getDodgeChance()), ps.getDodgeChance() > 0],
        ['HP Regen', rate(ps.getHealthRegen(), 1, '/s'), ps.getHealthRegen() > 0],
        ['Shield', ps.hasShield() ? 'YES' : '-', ps.hasShield()],
        ['Lifesteal', pct(ps.getLifesteal()), ps.getLifesteal() > 0],
        ['Thorns', num(ps.getThorns()), ps.getThorns() > 0],
      ]],
      ['UTILITY', '#8ce99a', [
        ['Move Speed', num(ps.getSpeed()), true],
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
        ['Orbit Orbs', num(ps.getOrbitOrbCount()), ps.getOrbitOrbCount() > 0],
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
    // Wrap through the renderer's single canonical wrap (font-load-safe 1 em/glyph
    // estimate) so the combos guide breaks lines identically to every other panel.
    const wrap = (text: string, px: number, maxW: number): string[] =>
      this.renderer.wrapLines(text, maxW, px);

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
        this.renderer.drawItemIcon(duo.icon, x0, y - s(1), bodySize + s(2), 'left');
        this.renderer.drawText(duo.name, x0 + bodySize + s(4), y, {
          size: bodySize, align: 'left', color: '#ffe066', maxWidth: contentW - bodySize - s(4)
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
        this.renderer.drawItemIcon(duo.icon, x0, y - s(1), bodySize + s(2), 'left');
        this.renderer.drawText(duo.name, x0 + bodySize + s(4), y, {
          size: bodySize, align: 'left', color: '#74c0fc', maxWidth: contentW - bodySize - s(4)
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
    // Keep the frozen arena visible behind the overlay so pause reads as "stopped
    // mid-run", not a blank screen.
    this.drawPlaying();

    const ctx = this.renderer.getContext();
    const { s, W, H, isMobile } = this.screenScale();

    // Dim the arena.
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const titleY = s(isMobile ? 96 : 100);
    this.renderer.drawText('PAUSED', W / 2, titleY, {
      size: s(isMobile ? 26 : 40), bold: true, align: 'center', color: '#ffd700',
    });

    // Make "End Run" an informed choice: show what banking now is worth.
    const souls = MetaProgression.calculateSoulsEarned(this.waveManager.currentWave, this.bossKills);
    this.renderer.drawText(
      `Wave ${this.waveManager.currentWave}  ·  end now to bank ${souls} souls`,
      W / 2, titleY + s(isMobile ? 24 : 34),
      { size: s(isMobile ? 10 : 12), align: 'center', color: '#c8b998' }
    );

    const labels = [
      'Resume',
      this.audio.isEnabled() ? 'Sound: On' : 'Sound: Off',
      'End Run',
      'Restart Run',
      'Main Menu',
    ];
    const rects = this.columnRects(labels.length, this.pausedTopY(s, isMobile), s, W, isMobile);
    for (let i = 0; i < labels.length; i++) {
      const r = rects[i];
      this.renderer.drawButton(r.x, r.y, r.width, r.height, labels[i], false, true, isMobile);
    }
  }

  private drawVillage(): void {
    this.villageScene?.draw();
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
    this.renderer.drawText('GAME OVER', 0, 0, {
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

    this.renderer.drawText(`Wave: ${this.gameOverStats.wavesReached}`, this.canvas.width / 2, statsY, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#4a9eff'
    });

    this.renderer.drawText(`Kills: ${this.gameOverStats.enemiesKilled}`, this.canvas.width / 2, statsY + lineSpacing, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ef4444'
    });

    this.renderer.drawText(`Gold: ${this.gameOverStats.goldEarned}`, this.canvas.width / 2, statsY + lineSpacing * 2, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    this.renderer.drawText(`Items: ${this.gameOverStats.itemsCollected}`, this.canvas.width / 2, statsY + lineSpacing * 3, {
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
    this.renderer.drawText(`Souls Earned: ${this.gameOverStats.soulsEarned}`, this.canvas.width / 2, soulsY, {
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
