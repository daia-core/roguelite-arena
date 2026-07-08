// Main game state machine

import { Player } from './Player';
import { Enemy } from './Enemy';
import { rollOnHitProcs } from './StatusEffectEngine';
import { Projectile } from './Projectile';
import { MeleeAttack } from './MeleeAttack';
import { Particle, DamageNumber } from './Particle';
import { WaveManager } from './WaveManager';
import { PlayerStats, ItemDatabase, ItemTier, getItemKinds, classifyItemSlot, slotLabel, itemStatSegments, descRestatesStats, type Item, type EquipHolderKey } from './ItemSystem';
import { STARTING_CLASSES, type StartingClass } from './Classes';
import { SaveManager } from './SaveManager';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { pointInRect, formatShort, segmentCircleHit } from './utils';
import { HealthOrb, XPOrb, CoinPickup, mergeOrbs } from './Pickup';
import { OrbitingOrb, Bomb, Shockwave } from './Weapons';
import { AoeZone } from './AoeZone';
import { SpawnTelegraph } from './SpawnTelegraph';
import { MetaProgression } from './MetaProgression';
import { AchievementSystem, ACHIEVEMENTS, type Achievement, type RunStats } from './AchievementSystem';
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
import { MapSystem, serializeMap, deserializeMap } from './MapSystem';
import { ArtifactSystem, ARTIFACTS, ROLLABLE_ARTIFACTS, getArtifactById, type Artifact } from './ArtifactSystem';
import { EVENTS, type EventEffect, type EventOption } from './EventSystem';
import { EventScene, type EventReward } from './EventScene';
import { EvolutionSystem, type Evolution } from './EvolutionSystem';
import { VillageScene } from './VillageScene';
import { MapScene } from './MapScene';
import { SkillTree, SKILL_NODES, SKILL_EDGES, ARM_COLOR, getNode, neighborsOf, type SkillNode } from './SkillTree';
import { getActiveSkillById } from './ActiveSkillSystem';
import type { Scene } from './scenes/Scene';
import { MenuScene } from './scenes/MenuScene';

// The map/node meta-layer adds three between-wave screens on top of the core loop:
//   'map'    — the Slay-the-Spire-style branching node picker (route your run)
//   'event'  — a `?` node's text choice screen
//   'reward' — a "pick 1 of 3 artifacts" screen (treasure / elite / boss spoils)
//   'rest'   — a campfire node: heal or upgrade
//   'skilltree' — spend banked skill points (replaces the old level-up item pick)
export type GameState =
  | 'menu' | 'classselect' | 'playing' | 'shop' | 'paused' | 'gameover' | 'village'
  | 'map' | 'event' | 'reward' | 'rest' | 'skilltree' | 'achievements';

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
  // Deferred area damage for player skills whose visual delay ≠ instant resolve.
  // Each entry resolves after `delay` seconds — finds enemies in `r` px of (x, y).
  private pendingDmg: Array<{x: number; y: number; r: number; dmg: number; delay: number; color: string}> = [];
  // Persistent player-AoE zones that tick enemy damage while active (poison cloud, circle of power).
  private activeDmgZones: Array<{x: number; y: number; r: number; dmgPerSec: number; remaining: number; color: string}> = [];
  // Telegraphed enemy spawns (red blinking X -> enemy materializes after 2s).
  spawnTelegraphs: SpawnTelegraph[] = [];
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

  // GAME FEEL: Screen effects (colored flash only — no shake, no time-warp)
  private screenEffects: ScreenEffects;

  // PERFORMANCE: Batch particle rendering (40-60% faster)
  private particleBatchRenderer: ParticleBatchRenderer;

  // GAME FEEL: Per-enemy DoT damage accumulators for throttled colored damage numbers.
  // Avoids spawning a number every frame (60/s) while still providing feel feedback.
  private _dotDisplay = new WeakMap<Enemy, {t: number; burn: number; bleed: number; poison: number}>();

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
  rewardChoices: Artifact[] = [];            // the 1-of-3 artifact offer
  rewardTitle: string = '';                  // header for the reward screen
  rewardSkippable: boolean = false;          // show a Skip button (elite/treasure/boss)
  private rewardThen: (() => void) | null = null; // what to do once an artifact is picked
  // ---- SKILL TREE state (replaces the old level-up item pick, Felix 2026-07-05) ----
  // Each level-up grants 1 skill point banked on the tree; points are spent on the
  // between-waves skill-tree screen (never mid-wave). skillTreeReturnsToShop drains
  // banked points at the shop break and lands on the shop, mirroring the old flow.
  skillTree: SkillTree = new SkillTree();
  private skillTreeReturnsToShop: boolean = false; // opened at the shop break → land on the shop on Continue
  // Pan/zoom camera for the PoE-style web screen. panX/panY are canvas-px offsets from
  // the view centre; stZoom is logical-canvas-px per tree-unit. Pointer tracking below
  // distinguishes a drag-to-pan from a tap-to-allocate by accumulated travel distance.
  private stPanX: number = 0;
  private stPanY: number = 0;
  private stZoom: number = 0.5;
  private stPointerActive: boolean = false;
  private stLastX: number = 0;
  private stLastY: number = 0;
  private stDownX: number = 0;
  private stDownY: number = 0;
  private stDragDist: number = 0;
  private stPinchDist: number = 0;             // finger spread on the previous pinch frame (0 = not pinching)
  private stSelected: string | null = null;    // last-tapped node (for the info panel)
  private pendingWaveArtifact: boolean = false;   // elite/boss wave grants spoils on clear
  private pendingEliteCascade: boolean = false;   // elite/boss wave grants a free bonus item in the shop
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
  private overchargeShotCount: number = 0;          // primary volleys fired for overcharge nova tracking

  // Enemy armor penetration (see Player.takeDamage). Dodgeable ranged/AoE threats
  // pierce half the player's armor so an armor-stack build can't chip them to ~1 HP;
  // unavoidable contact hits pierce less. (Felix, 2026-07-05: ranged felt like 1 HP.)
  private static readonly RANGED_ARMOR_PEN = 0.5;
  private static readonly CONTACT_ARMOR_PEN = 0.25;

  // Active Skill System — dual-slot cooldowns (Q = primary, E = secondary).
  private activeSkillCooldown: number = 0;   // slot Q
  private activeSkillCooldownE: number = 0;  // slot E

  // Stats
  kills: number = 0;
  bossKills: number = 0;
  soulsEarnedThisRun: number = 0;
  /** Timestamp (ms) when the current run started — used to compute runDurationMs for achievements. */
  private runStartTime: number = 0;
  // Achievements earned in the just-ended run, surfaced as a banner on the game-over screen.
  private newAchievementsThisRun: Achievement[] = [];

  // Game over details
  gameOverStats: {
    wavesReached: number;
    enemiesKilled: number;
    bossesDefeated: number;
    goldEarned: number;
    itemsCollected: number;
    soulsEarned: number;
    personalBest: number;
  } = {
    wavesReached: 0,
    enemiesKilled: 0,
    bossesDefeated: 0,
    goldEarned: 0,
    itemsCollected: 0,
    soulsEarned: 0,
    personalBest: 0
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

  // Shop toast — transient one-line feedback for equipment-strip actions (equip/bench/
  // sell). Wall-clock timestamped so it fades without threading dt into updateShop.
  private shopToastText: string = '';
  private shopToastAt: number = 0;
  private static readonly SHOP_TOAST_MS = 1800;

  // EQUIPPED-ITEM INSPECT POPUP — tapping an occupied equip slot opens a small card
  // showing the piece's stats, with Unequip (→ stash) and Sell (→ gold) buttons. Modal
  // like the combos/stats overlays: while open it owns all shop input. Anchored near the
  // tapped slot; button hit-rects are captured at draw time (screen-space, same zoom).
  private inspectedEquipKey: EquipHolderKey | null = null;
  private inspectUnequipRect: { x: number; y: number; width: number; height: number } | null = null;
  private inspectSellRect: { x: number; y: number; width: number; height: number } | null = null;

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
    (window as unknown as { __classifyItemSlot: typeof classifyItemSlot }).__classifyItemSlot = classifyItemSlot;
    (window as unknown as { __EVENTS: typeof EVENTS }).__EVENTS = EVENTS;
    (window as unknown as { __ARTIFACTS: typeof ARTIFACTS }).__ARTIFACTS = ARTIFACTS;
    (window as unknown as { __SKILL_NODES: typeof SKILL_NODES }).__SKILL_NODES = SKILL_NODES;
    (window as unknown as { __SKILL_EDGES: typeof SKILL_EDGES }).__SKILL_EDGES = SKILL_EDGES;
    (window as unknown as { __skillNeighbors: typeof neighborsOf }).__skillNeighbors = neighborsOf;
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.audio = new AudioManager();
    this.waveManager = new WaveManager();
    this.playerStats = new PlayerStats();
    this.metaProgression = new MetaProgression();

    // Reflect earned achievements (unlocked reward items) + the player's disabled set into the
    // item database before any shop pool is built, so unlocks are live from the first run.
    AchievementSystem.load();

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

    // Register extracted per-screen scenes. MenuScene was the pilot (step 1);
    // VillageScene is step 2; MapScene is step 3. Pre-constructed so the state
    // machine can dispatch to them without lazy init.
    this.scenes.menu = new MenuScene(this);
    this.scenes.village = new VillageScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      audio: this.audio,
      meta: this.metaProgression,
      onEmbark: () => this.openClassSelect(),
      onBack: () => { this.state = 'menu'; },
    });
    this.scenes.map = new MapScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      mapSystem: this.mapSystem,
      onNodePicked: (id) => this.onMapNodePicked(id),
    });
    this.scenes.event = new EventScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      onOptionPicked: (opt) => this.applyEventOption(opt),
      onDone: () => { this.state = 'map'; },
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

    // Achievements button — milestone unlocks + click-to-disable reward pool.
    const achievementsBtn = document.getElementById('achievementsBtn');
    if (achievementsBtn) {
      achievementsBtn.addEventListener('click', () => {
        this.openAchievements();
      });
    }
  }

  /** Open the achievements screen (milestone unlocks + click-to-disable reward gear). */
  openAchievements(): void {
    this.state = 'achievements';
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
    this.spawnTelegraphs = [];
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
    this.runStartTime = Date.now();
    // Reset conditional-item run state (fresh run = no ramp, no kill streak).
    this.wavesSurvived = 0;
    this.killStackCount = 0;
    this.killStackTimer = 0;
    this.soulTitheKills = 0;
    this.soulTitheStacks = 0;
    this.shotsFired = 0;
    this.overchargeShotCount = 0;
    this.activeSkillCooldown = 0;
    this.activeSkillCooldownE = 0;

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

    // Fresh skill tree for the new run — anchored on the chosen class's START node
    // (applyClass set selectedClassId just above), then push identity bonuses into
    // PlayerStats so no stale skill bonus leaks across runs.
    this.skillTree.reset(this.selectedClassId);
    this.skillTree.recomputeInto(this.playerStats);
    this.skillTreeReturnsToShop = false;
    this.centerSkillTreeOnStart();

    this.refreshMaxHealth();
    this.pendingWaveArtifact = false;
    this.pendingEliteCascade = false;

    this.updateMobileSkillButtons(); // reset to disabled at run start (no scrolls yet)
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

    // Restore the skill tree (points + ranks) and fold its bonuses into stats BEFORE the
    // Player is built so its maxHealth reflects skill investment on resume.
    this.skillTree.reset(this.selectedClassId);
    this.skillTree.load(save.skillTree);
    this.skillTree.recomputeInto(this.playerStats);
    this.skillTreeReturnsToShop = false;
    this.centerSkillTreeOnStart();

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
    this.spawnTelegraphs = [];
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
      case 'reward':
        this.updateReward();
        break;
      case 'skilltree':
        this.updateSkillTree();
        break;
      case 'rest':
        this.updateRest();
        break;
      case 'classselect':
        this.updateClassSelect();
        break;
      case 'achievements':
        this.updateAchievements();
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
          pooled.noTrail = proj.noTrail; // carry the laser's trail-suppression through the pool
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

      // Overcharge Battery: every Nth primary volley fires a free nova burst around the player.
      const ocEvery = this.artifacts.overchargeEvery();
      if (ocEvery > 0 && this.player) {
        this.overchargeShotCount++;
        if (this.overchargeShotCount % ocEvery === 0) {
          const ocDmg = this.playerStats.getDamage() * 3;
          this.spawnAoeZone(new AoeZone(this.player.x, this.player.y, 130, ocDmg, 0.0, {
            color: '#ffd43b', activeTime: 0.2, singleHit: true,
          }));
          this.audio.playHit();
        }
      }
    }

    // Active Skill — Q/mobile blastBtn = slot 1 (primary), E/mobile skillEBtn = slot 2 (secondary).
    if (this.activeSkillCooldown > 0) this.activeSkillCooldown = Math.max(0, this.activeSkillCooldown - dt);
    if (this.activeSkillCooldownE > 0) this.activeSkillCooldownE = Math.max(0, this.activeSkillCooldownE - dt);
    if (this.input.consumeSkill()) {
      this.useActiveSkill('q');
    }
    if (this.input.consumeSkillE()) {
      this.useActiveSkill('e');
    }

    // Dash — 💨 mobile button / Space / Shift. i-frame dodge in the current move
    // direction (or last-faced direction when standing still), 3s cooldown.
    if (this.input.consumeDash()) {
      const mv = this.input.getMovementVector();
      if (this.player.tryDash(mv.x, mv.y)) {
        this.audio.playDash();
      }
    }

    // Wave manager — enemies now spawn via telegraphed in-arena formations (red blinking X).
    this.enemies = this.waveManager.update(
      dt,
      this.enemies,
      this.worldWidth,
      this.worldHeight,
      this.spawnTelegraphs,
      this.player.x,
      this.player.y
    );

    // Tick spawn telegraphs (red blinking X countdown) and cull spent/cancelled ones.
    // WaveManager consumes `ready` telegraphs into real enemies before we prune here.
    for (const tg of this.spawnTelegraphs) tg.update(dt);
    this.removeDeadEntities(this.spawnTelegraphs);

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
      if (enemy.slowTimer > 0) { enemy.slowTimer -= dt; if (enemy.slowTimer <= 0) enemy.slowFactor = 1; }
      let dotDamage = 0;
      let _burnDmg = 0, _bleedDmg = 0, _poisonDmg = 0;
      if (enemy.poisonTimer > 0) { enemy.poisonTimer -= dt; _poisonDmg = 7 * dt; dotDamage += _poisonDmg; }
      if (enemy.burnTimer > 0) { enemy.burnTimer -= dt; _burnDmg = 16 * dt; dotDamage += _burnDmg; } // Ignite: hurts fast, burns out fast
      if (enemy.bleedTimer > 0) {
        enemy.bleedTimer -= dt;
        // Bleed hits harder while the enemy is moving (punishes rushers).
        const moved = Math.hypot(enemy.x - enemy.lastX, enemy.y - enemy.lastY);
        _bleedDmg = (6 + Math.min(18, moved * 1.5)) * dt;
        dotDamage += _bleedDmg;
      }
      enemy.lastX = enemy.x; enemy.lastY = enemy.y;
      if (dotDamage > 0) {
        const wm = enemy.woundMult;
        enemy.health -= dotDamage * wm;
        // GAME FEEL: Throttled colored damage numbers for DoT (max ~2/s per enemy)
        let ds = this._dotDisplay.get(enemy);
        if (!ds) { ds = { t: 0, burn: 0, bleed: 0, poison: 0 }; this._dotDisplay.set(enemy, ds); }
        ds.burn += _burnDmg * wm;
        ds.bleed += _bleedDmg * wm;
        ds.poison += _poisonDmg * wm;
        ds.t -= dt;
        if (ds.t <= 0) {
          const maxV = Math.max(ds.burn, ds.bleed, ds.poison);
          if (maxV >= 1) {
            let dotColor: string, dotAccum: number;
            if (ds.burn >= ds.bleed && ds.burn >= ds.poison) {
              dotColor = '#ff6b1a'; dotAccum = ds.burn;      // Burn: orange
            } else if (ds.bleed >= ds.poison) {
              dotColor = '#cc3333'; dotAccum = ds.bleed;     // Bleed: dark red
            } else {
              dotColor = '#44cc44'; dotAccum = ds.poison;    // Poison: green
            }
            this.damageNumbers.push(this.createDamageNumber(
              enemy.x + (Math.random() - 0.5) * 16, enemy.y - 8, Math.round(dotAccum), false, dotColor
            ));
          }
          ds.burn = 0; ds.bleed = 0; ds.poison = 0; ds.t = 0.45;
        }
        if (enemy.health <= 0 && !enemy.dead) { this.killByDot(enemy); continue; }
      }
      // Doom: stores damage, then detonates. Executes if the stored payload >= remaining HP.
      if (enemy.doomTimer > 0) {
        enemy.doomTimer -= dt;
        if (enemy.doomTimer <= 0 && enemy.doomStored > 0 && !enemy.dead) {
          const payload = enemy.doomStored * enemy.woundMult;
          enemy.doomStored = 0;
          this.renderer.addImpactFlash(enemy.x, enemy.y);
          // GAME FEEL: Doom detonation — purple explosion burst + screen flash
          this.screenEffects.flash('#9040d0', 0.22);
          const _doomPCount = this.getParticleCount(18);
          for (let _di = 0; _di < _doomPCount; _di++) {
            const _dang = (Math.PI * 2 * _di) / _doomPCount;
            const _dspd = 100 + Math.random() * 130;
            this.particles.push(this.createParticle({
              x: enemy.x, y: enemy.y,
              vx: Math.cos(_dang) * _dspd, vy: Math.sin(_dang) * _dspd,
              color: _di % 2 === 0 ? '#b06bff' : '#ff40ff',
              size: 4 + Math.random() * 5, lifetime: 350 + Math.random() * 300, gravity: 80
            }));
          }
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

      // ── New-engine statusFX tick (Fragility, Exposed, Condemned, Brittle, etc.) ──
      {
        const enemyMovedDist = Math.hypot(enemy.x - enemy.lastX, enemy.y - enemy.lastY);
        const fxResult = enemy.statusFX.tick(dt, enemyMovedDist);
        if (fxResult.dotDamage > 0 && !enemy.dead) {
          enemy.health -= fxResult.dotDamage;
          if (enemy.health <= 0) { this.killByDot(enemy); continue; }
        }
        if (fxResult.doomDetonation && !enemy.dead) {
          const { payload } = fxResult.doomDetonation;
          this.renderer.addImpactFlash(enemy.x, enemy.y);
          // GAME FEEL: Doom detonation burst
          this.screenEffects.flash('#9040d0', 0.22);
          const _doomPCount2 = this.getParticleCount(18);
          for (let _dj = 0; _dj < _doomPCount2; _dj++) {
            const _dang2 = (Math.PI * 2 * _dj) / _doomPCount2;
            const _dspd2 = 100 + Math.random() * 130;
            this.particles.push(this.createParticle({
              x: enemy.x, y: enemy.y,
              vx: Math.cos(_dang2) * _dspd2, vy: Math.sin(_dang2) * _dspd2,
              color: _dj % 2 === 0 ? '#b06bff' : '#ff40ff',
              size: 4 + Math.random() * 5, lifetime: 350 + Math.random() * 300, gravity: 80
            }));
          }
          if (payload >= enemy.health) {
            enemy.health = 0;
            this.damageNumbers.push(this.createDamageNumber(enemy.x, enemy.y - 20, payload, true, '#b06bff'));
            this.killByDot(enemy); continue;
          } else {
            enemy.health -= payload;
            this.damageNumbers.push(this.createDamageNumber(enemy.x, enemy.y - 20, payload, false, '#b06bff'));
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

      // Boss phase transition banner — reuses the evolution banner overlay so the
      // moment reads loud over whatever is on screen.
      if (result.bossPhaseChange && result.bossPhaseChange > 1) {
        const BOSS_PHASE_NAMES: Record<string, string> = {
          boss_necrolord:    'NECRO LORD',
          boss_flamefiend:   'FLAME FIEND',
          boss_voidbeast:    'VOID BEAST',
          boss_stormking:    'STORM KING',
          boss_ancientgolem: 'ANCIENT GOLEM',
        };
        const label = result.bossPhaseChange === 2 ? 'PHASE 2' : 'PHASE 3 — ENRAGED';
        this.evolutionBannerText = `${label} — ${BOSS_PHASE_NAMES[enemy.type] ?? 'BOSS'}!`;
        this.evolutionBannerTimer = 2.5;
        this.audio.playTransformation();
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
            // Dazed debuff raises effective crit chance against this enemy
            const sfxBonusCrit = enemy.statusFX.getBonusCritChanceReceived();
            const isCrit = this.player.rollCrit() || (sfxBonusCrit > 0 && Math.random() < sfxBonusCrit);
            let damage = isCrit ? this.player.getCritDamage(proj.damage) : proj.damage;
            // Disoriented debuff amplifies crit damage received
            if (isCrit) {
              const bonusCritDmg = enemy.statusFX.getBonusCritDamageReceived();
              if (bonusCritDmg > 0) damage *= (1 + bonusCritDmg);
            }
            if (enemy.typeData.isBoss) {
              damage *= this.metaProgression.getBossDamageMultiplier();
            }
            // Status-effect damage amplifiers: Fragility (+%all dmg), Exposed (+%direct-hit), Brittle (+flat)
            damage = damage * enemy.statusFX.getIncomingDamageMult() * enemy.statusFX.getDirectHitMult()
                     + enemy.statusFX.getFlatHitBonus();
            // Condemned: 10-stack threshold detonates on next crit for a massive multiplier
            const condemnedBonus = enemy.statusFX.checkCondemned(isCrit);
            if (condemnedBonus > 0) damage *= condemnedBonus;

            const splits = enemy.takeDamage(damage);
            if (splits && splits.length > 0) {
              this.enemies.push(...splits);
            }
            proj.markHit(enemy.id);

            // GAME FEEL: Enhanced knockback physics.
            // Base 450 (up from 300) + 1% per knockback stat point — items that add
            // knockback now meaningfully affect how far enemies scatter.
            const knockback = this.playerStats.getKnockback();
            if (knockback > 0 && enemy.type !== 'golem') {
              const angle = Math.atan2(enemy.y - proj.y, enemy.x - proj.x);
              const impulse = 450 * (1 + knockback * 0.01);
              enemy.applyKnockback(Math.cos(angle) * impulse, Math.sin(angle) * impulse);
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
          const sfxBonusCritM = enemy.statusFX.getBonusCritChanceReceived();
          const isCrit = this.player.rollCrit() || (sfxBonusCritM > 0 && Math.random() < sfxBonusCritM);
          let damage = isCrit ? this.player.getCritDamage(melee.damage) : melee.damage;
          if (isCrit) {
            const bonusCritDmgM = enemy.statusFX.getBonusCritDamageReceived();
            if (bonusCritDmgM > 0) damage *= (1 + bonusCritDmgM);
          }
          if (enemy.typeData.isBoss) {
            damage *= this.metaProgression.getBossDamageMultiplier();
          }
          // Status-effect amplifiers: Fragility, Exposed, Brittle, Condemned
          damage = damage * enemy.statusFX.getIncomingDamageMult() * enemy.statusFX.getDirectHitMult()
                   + enemy.statusFX.getFlatHitBonus();
          const condemnedBonusM = enemy.statusFX.checkCondemned(isCrit);
          if (condemnedBonusM > 0) damage *= condemnedBonusM;

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

    // QoL/perf: once the floor is littered, collapse nearby loose (not-yet-homing)
    // XP gems and coins into fewer, bigger, higher-value orbs — easier to grab and
    // cheaper to update/draw. Absorbed orbs are flagged dead and reclaimed by the
    // swap-and-pop sweep just below, in the same frame.
    mergeOrbs(this.xpOrbs, { minCount: 25, mergeDist: 26, cellSize: 26 });
    mergeOrbs(this.coins, { minCount: 25, mergeDist: 26, cellSize: 26 });

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
    this.resolvePendingDmg(dt);
    this.resolveActiveDmgZones(dt);

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
    this.pendingDmg = [];
    this.activeDmgZones = [];
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

  /**
   * Fire the player's equipped active skill for the given slot.
   *   slot 'q' → primary skill (Q key / mobile blastBtn button), uses activeSkillCooldown
   *   slot 'e' → secondary skill (E key / mobile skillEBtn button), uses activeSkillCooldownE
   * Effects use existing AoeZone / Projectile / Enemy systems — no new infrastructure.
   */
  private useActiveSkill(slot: 'q' | 'e' = 'q'): void {
    const cooldown = slot === 'q' ? this.activeSkillCooldown : this.activeSkillCooldownE;
    if (!this.player || cooldown > 0) return;
    const skillId = slot === 'q'
      ? this.playerStats.getEquippedSkillIdQ()
      : this.playerStats.getEquippedSkillId();
    if (!skillId) return;
    const skill = getActiveSkillById(skillId);
    if (!skill) return;

    if (slot === 'q') this.activeSkillCooldown = skill.cooldown;
    else this.activeSkillCooldownE = skill.cooldown;
    const baseDmg = this.playerStats.getDamage() * skill.baseDamageMultiplier;
    const px = this.player.x;
    const py = this.player.y;

    switch (skill.effect) {
      case 'meteor': {
        // Telegraphed AoE fire drop — 0.8s warning ring, then large impact burst.
        const r = skill.radius ?? 120;
        // Visual telegraph (damage=0 — AoeZone only hits the player).
        this.spawnAoeZone(new AoeZone(px, py, r, 0, 0.8, {
          color: '#ff6b00', activeTime: 0.5, singleHit: false,
        }));
        // Deferred enemy damage at impact time.
        this.pendingDmg.push({ x: px, y: py, r, dmg: baseDmg, delay: 0.8, color: '#ff6b00' });
        break;
      }
      case 'frost_nova': {
        // Instant ring — damages + slows all enemies in radius for 3s.
        const r = skill.radius ?? 150;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d <= r) {
            this.dealAuxDamage(e, baseDmg, '#74c0fc');
            e.frozenTimer = Math.max(e.frozenTimer, 3.0);
          }
        }
        // Visual flash
        this.spawnAoeZone(new AoeZone(px, py, r, 0, 0.0, {
          color: '#74c0fc', activeTime: 0.5, singleHit: true,
        }));
        break;
      }
      case 'chain_lightning': {
        // Bounce between the 6 nearest enemies.
        const targets = [...this.enemies]
          .filter(e => !e.dead)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, 6);
        for (const t of targets) this.dealAuxDamage(t, baseDmg, '#ffd43b');
        break;
      }
      case 'blood_nova': {
        // AoE burst + lifesteal heal.
        const r = skill.radius ?? 130;
        let totalDmg = 0;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - px, e.y - py) <= r) {
            this.dealAuxDamage(e, baseDmg, '#c92a2a');
            totalDmg += baseDmg;
          }
        }
        if (totalDmg > 0) this.player.heal(totalDmg * 0.20);
        this.spawnAoeZone(new AoeZone(px, py, r, 0, 0.0, {
          color: '#9b2335', activeTime: 0.5, singleHit: true,
        }));
        break;
      }
      case 'orbital_strike': {
        // 6 staggered telegraphed impacts spread around the player.
        const r = skill.radius ?? 160;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const ix = px + Math.cos(angle) * r * 0.6;
          const iy = py + Math.sin(angle) * r * 0.6;
          // Visual only (damage=0 — AoeZone only hits the player).
          this.spawnAoeZone(new AoeZone(ix, iy, 55, 0, 0.3 + i * 0.15, {
            color: '#b197fc', activeTime: 0.35, singleHit: true,
          }));
          // Deferred enemy damage at each impact.
          this.pendingDmg.push({ x: ix, y: iy, r: 55, dmg: baseDmg, delay: 0.3 + i * 0.15, color: '#b197fc' });
        }
        break;
      }
      case 'poison_cloud': {
        // Persistent AoE DoT zone — ticks enemy damage for 5 seconds.
        const r = skill.radius ?? 110;
        // Visual zone (damage=0 — AoeZone only hits the player).
        this.spawnAoeZone(new AoeZone(px, py, r, 0, 0.0, {
          color: '#40c057', activeTime: 5.0, singleHit: false,
        }));
        // Persistent enemy damage tick (baseDmg per second for 5s).
        this.activeDmgZones.push({ x: px, y: py, r, dmgPerSec: baseDmg, remaining: 5.0, color: '#40c057' });
        break;
      }
      case 'phoenix_beam': {
        // 3 piercing fire bolts in a tight fan toward the nearest enemy.
        const alive = this.enemies.filter(e => !e.dead);
        if (alive.length === 0) break;
        const nearest = alive.reduce((n, e) =>
          Math.hypot(e.x - px, e.y - py) < Math.hypot(n.x - px, n.y - py) ? e : n
        );
        const angle = Math.atan2(nearest.y - py, nearest.x - px);
        for (let i = -1; i <= 1; i++) {
          const p = new Projectile(px, py, angle + i * 0.14, baseDmg, 520, true, true);
          p.maxPierceCount = 999;
          p.color = '#ff6b00';
          p.radius = 8;
          this.projectiles.push(p);
        }
        break;
      }
      case 'earthquake': {
        // Damage + slow ALL enemies on screen; big visual pulse.
        const count = this.enemies.filter(e => !e.dead).length;
        const perEnemy = count > 0 ? baseDmg / Math.max(1, count) * 2 : baseDmg;
        for (const e of this.enemies) {
          if (e.dead) continue;
          this.dealAuxDamage(e, perEnemy, '#c5aa6a');
          e.frozenTimer = Math.max(e.frozenTimer, 2.0);
        }
        this.spawnAoeZone(new AoeZone(px, py, 900, 0, 0.0, {
          color: '#c5aa6a', activeTime: 0.35, singleHit: true,
        }));
        break;
      }
      case 'shadow_step': {
        // Teleport through the nearest enemy then burst-nova.
        const alive = this.enemies.filter(e => !e.dead);
        if (alive.length === 0) break;
        const near = alive.reduce((n, e) =>
          Math.hypot(e.x - px, e.y - py) < Math.hypot(n.x - px, n.y - py) ? e : n
        );
        const dx = near.x - px, dy = near.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          this.player.x = Math.max(20, Math.min(this.worldWidth - 20, near.x + (dx / dist) * 35));
          this.player.y = Math.max(20, Math.min(this.worldHeight - 20, near.y + (dy / dist) * 35));
          this.player.invincibilityTimer = Math.max(this.player.invincibilityTimer, 0.4);
        }
        const r = skill.radius ?? 90;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - this.player.x, e.y - this.player.y) <= r) {
            this.dealAuxDamage(e, baseDmg, '#845ef7');
          }
        }
        this.spawnAoeZone(new AoeZone(this.player.x, this.player.y, r, 0, 0.0, {
          color: '#845ef7', activeTime: 0.4, singleHit: true,
        }));
        break;
      }
      case 'circle_power': {
        // Persistent ring zone — damages enemies inside it for 5 seconds.
        const rCP = skill.radius ?? 90;
        // Visual ring (damage=0 — AoeZone only hits the player).
        this.spawnAoeZone(new AoeZone(px, py, rCP, 0, 0.0, {
          color: '#ffd43b', activeTime: 5.0, singleHit: false, shape: 'ring',
        }));
        // Persistent enemy damage tick (2× baseDmg per second for 5s).
        this.activeDmgZones.push({ x: px, y: py, r: rCP, dmgPerSec: baseDmg * 2, remaining: 5.0, color: '#ffd43b' });
        break;
      }

      // ── TIER 1 ADDITIONS ─────────────────────────────────────────────────
      case 'arcane_barrage': {
        // 5 homing projectiles fired toward the 5 nearest enemies.
        const targetsAB = [...this.enemies]
          .filter(e => !e.dead)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, 5);
        for (const t of targetsAB) {
          const angle = Math.atan2(t.y - py, t.x - px);
          const p = new Projectile(px, py, angle, baseDmg, 480, false, true);
          p.color = '#cc5de8';
          p.radius = 7;
          this.projectiles.push(p);
        }
        break;
      }
      case 'inferno_aura': {
        // Brief fire ring — damages and applies burnTimer to all nearby.
        const rIA = skill.radius ?? 140;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - px, e.y - py) <= rIA) {
            this.dealAuxDamage(e, baseDmg, '#ff8c00');
            e.burnTimer = Math.max(e.burnTimer, 3.0);
          }
        }
        this.spawnAoeZone(new AoeZone(px, py, rIA, 0, 0.0, {
          color: '#ff6b00', activeTime: 0.6, singleHit: true,
        }));
        break;
      }
      case 'crystal_burst': {
        // Hard-freeze 4 nearest enemies (2s), plus damage.
        const targetsCB = [...this.enemies]
          .filter(e => !e.dead)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, 4);
        for (const t of targetsCB) {
          this.dealAuxDamage(t, baseDmg, '#a5d8ff');
          t.frozenTimer = Math.max(t.frozenTimer, 2.0);
          this.spawnAoeZone(new AoeZone(t.x, t.y, 40, 0, 0.0, {
            color: '#a5d8ff', activeTime: 0.4, singleHit: true,
          }));
        }
        break;
      }

      // ── TIER 2 ADDITIONS ─────────────────────────────────────────────────
      case 'blade_storm': {
        // 8 piercing blades fired in all directions simultaneously.
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const p = new Projectile(px, py, angle, baseDmg, 400, true, false);
          p.maxPierceCount = 999;
          p.color = '#e9ecef';
          p.radius = 10;
          this.projectiles.push(p);
        }
        break;
      }
      case 'lightning_storm': {
        // 5 lightning strikes on random enemies, staggered over 1.5 seconds.
        const aliveLS = this.enemies.filter(e => !e.dead);
        if (aliveLS.length === 0) break;
        for (let i = 0; i < 5; i++) {
          const t = aliveLS[Math.floor(Math.random() * aliveLS.length)];
          // Visual telegraph (damage=0 — AoeZone only hits the player).
          this.spawnAoeZone(new AoeZone(t.x, t.y, 45, 0, i * 0.3, {
            color: '#ffd43b', activeTime: 0.25, singleHit: true,
          }));
          // Deferred enemy damage at impact point.
          this.pendingDmg.push({ x: t.x, y: t.y, r: 45, dmg: baseDmg, delay: i * 0.3, color: '#ffd43b' });
        }
        break;
      }
      case 'void_pulse': {
        // 3 expanding rings of damage — each larger and delayed.
        const rVP = skill.radius ?? 180;
        for (let i = 0; i < 3; i++) {
          const ringR = rVP * (0.5 + i * 0.3);
          // Visual ring (damage=0 — AoeZone only hits the player).
          this.spawnAoeZone(new AoeZone(px, py, ringR, 0, i * 0.25, {
            color: '#7950f2', activeTime: 0.3, singleHit: true,
          }));
          // Deferred enemy damage at ring resolution.
          this.pendingDmg.push({ x: px, y: py, r: ringR, dmg: baseDmg, delay: i * 0.25, color: '#7950f2' });
        }
        break;
      }
      case 'blizzard': {
        // 6 frost shards scattered in large area — each slows and damages.
        const rBZ = skill.radius ?? 200;
        for (let i = 0; i < 6; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * rBZ;
          const ix = px + Math.cos(ang) * dist;
          const iy = py + Math.sin(ang) * dist;
          // Visual shard (damage=0 — AoeZone only hits the player).
          this.spawnAoeZone(new AoeZone(ix, iy, 60, 0, i * 0.2, {
            color: '#74c0fc', activeTime: 0.3, singleHit: true,
          }));
          // Deferred enemy damage + slow at impact.
          this.pendingDmg.push({ x: ix, y: iy, r: 60, dmg: baseDmg, delay: i * 0.2, color: '#74c0fc' });
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (Math.hypot(e.x - ix, e.y - iy) <= 60) {
              e.slowTimer = Math.max(e.slowTimer, 2.5);
              e.slowFactor = Math.min(e.slowFactor, 0.55);
            }
          }
        }
        break;
      }
      case 'gravity_pull': {
        // Yank ALL enemies toward the player, deal damage, then slow.
        const pullSnap = 180;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = px - e.x, dy = py - e.y;
          const distGP = Math.hypot(dx, dy);
          if (distGP > 5) {
            const snap = Math.min(pullSnap, distGP * 0.6);
            e.x += (dx / distGP) * snap;
            e.y += (dy / distGP) * snap;
          }
          this.dealAuxDamage(e, baseDmg, '#845ef7');
          e.slowTimer = Math.max(e.slowTimer, 3.0);
          e.slowFactor = Math.min(e.slowFactor, 0.45);
        }
        this.spawnAoeZone(new AoeZone(px, py, 900, 0, 0.0, {
          color: '#7950f2', activeTime: 0.3, singleHit: true,
        }));
        break;
      }

      // ── TIER 3 ADDITIONS ─────────────────────────────────────────────────
      case 'time_warp': {
        // Freeze ALL for 1s, then extend a heavy slow for 5s afterward.
        for (const e of this.enemies) {
          if (e.dead) continue;
          e.frozenTimer = Math.max(e.frozenTimer, 1.0);
          e.slowTimer = Math.max(e.slowTimer, 6.0);
          e.slowFactor = Math.min(e.slowFactor, 0.25);
        }
        this.spawnAoeZone(new AoeZone(px, py, 900, 0, 0.0, {
          color: '#74c0fc', activeTime: 0.5, singleHit: true,
        }));
        break;
      }
      case 'vampire_burst': {
        // Drain 10 nearest enemies — heal 30% of total damage dealt.
        const targetsVB = [...this.enemies]
          .filter(e => !e.dead)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, 10);
        let totalDmgVB = 0;
        for (const t of targetsVB) {
          this.dealAuxDamage(t, baseDmg, '#c92a2a');
          totalDmgVB += baseDmg;
        }
        if (totalDmgVB > 0 && this.player) this.player.heal(totalDmgVB * 0.30);
        this.spawnAoeZone(new AoeZone(px, py, 280, 0, 0.0, {
          color: '#9b2335', activeTime: 0.4, singleHit: true,
        }));
        break;
      }
      case 'spectral_dash': {
        // 5× rapid dash — teleport to each of 5 nearest enemies and nova-burst.
        const targetsSP = [...this.enemies]
          .filter(e => !e.dead)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, 5);
        if (targetsSP.length === 0) break;
        const rSD = skill.radius ?? 60;
        let lastX = px, lastY = py;
        for (let i = 0; i < targetsSP.length; i++) {
          const t = targetsSP[i];
          // Visual burst (damage=0 — AoeZone only hits the player).
          this.spawnAoeZone(new AoeZone(t.x, t.y, rSD, 0, i * 0.08, {
            color: '#845ef7', activeTime: 0.25, singleHit: true,
          }));
          // Deferred enemy damage at each dash position.
          this.pendingDmg.push({ x: t.x, y: t.y, r: rSD, dmg: baseDmg, delay: i * 0.08, color: '#845ef7' });
          lastX = t.x; lastY = t.y;
        }
        if (this.player) {
          this.player.x = Math.max(20, Math.min(this.worldWidth - 20, lastX));
          this.player.y = Math.max(20, Math.min(this.worldHeight - 20, lastY));
          this.player.invincibilityTimer = Math.max(this.player.invincibilityTimer, 0.6);
        }
        break;
      }
      case 'plague_bomb': {
        // Massive persistent poison zone (8s) + immediate poisonTimer on enemies inside.
        const rPB = skill.radius ?? 140;
        this.spawnAoeZone(new AoeZone(px, py, rPB, baseDmg / 5, 0.0, {
          color: '#40c057', activeTime: 8.0, singleHit: false,
        }));
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - px, e.y - py) <= rPB) {
            e.poisonTimer = Math.max(e.poisonTimer, 6.0);
          }
        }
        break;
      }

      // ── TIER 4 ADDITIONS ─────────────────────────────────────────────────
      case 'black_hole': {
        // 2s gravity sink pulls enemies in, then detonates for massive damage.
        const rBH = skill.radius ?? 250;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const distBH = Math.hypot(e.x - px, e.y - py);
          if (distBH <= rBH && distBH > 5) {
            const dx = px - e.x, dy = py - e.y;
            e.x += (dx / distBH) * 150;
            e.y += (dy / distBH) * 150;
          }
        }
        this.spawnAoeZone(new AoeZone(px, py, rBH * 0.35, 0, 0.0, {
          color: '#212529', activeTime: 2.0, singleHit: false,
        }));
        // Visual detonation flash (damage=0 — AoeZone only hits the player).
        this.spawnAoeZone(new AoeZone(px, py, rBH, 0, 2.0, {
          color: '#7950f2', activeTime: 0.6, singleHit: false,
        }));
        // Deferred enemy damage at detonation.
        this.pendingDmg.push({ x: px, y: py, r: rBH, dmg: baseDmg, delay: 2.0, color: '#7950f2' });
        break;
      }
      case 'curse_wave': {
        // Apply fragility + exposed stacks to every enemy on screen + minor damage.
        for (const e of this.enemies) {
          if (e.dead) continue;
          e.statusFX.apply('fragility', { stacks: 5 });
          e.statusFX.apply('exposed', { stacks: 3 });
          this.dealAuxDamage(e, baseDmg, '#f03e3e');
        }
        this.spawnAoeZone(new AoeZone(px, py, 900, 0, 0.0, {
          color: '#f03e3e', activeTime: 0.5, singleHit: true,
        }));
        break;
      }
      case 'divine_wrath': {
        // 3 holy waves hit ALL enemies — massive damage + extended i-frames.
        if (this.player) this.player.invincibilityTimer = Math.max(this.player.invincibilityTimer, 2.0);
        for (let wave = 0; wave < 3; wave++) {
          // Visual wave (damage=0 — AoeZone only hits the player; player has i-frames anyway).
          this.spawnAoeZone(new AoeZone(px, py, 900, 0, wave * 0.4, {
            color: '#ffd43b', activeTime: 0.3, singleHit: true,
          }));
          // Deferred enemy damage — hits every enemy on screen at wave time.
          this.pendingDmg.push({ x: px, y: py, r: 900, dmg: baseDmg, delay: wave * 0.4, color: '#ffd43b' });
        }
        break;
      }
      case 'armageddon': {
        // 12 meteors rain over 3 seconds — aims at living enemies.
        const rAG = skill.radius ?? 100;
        const aliveAG = this.enemies.filter(e => !e.dead);
        for (let i = 0; i < 12; i++) {
          let ix: number, iy: number;
          if (aliveAG.length > 0) {
            const t = aliveAG[Math.floor(Math.random() * aliveAG.length)];
            ix = t.x + (Math.random() - 0.5) * 60;
            iy = t.y + (Math.random() - 0.5) * 60;
          } else {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * 300;
            ix = px + Math.cos(a) * d;
            iy = py + Math.sin(a) * d;
          }
          // Visual meteor telegraph (damage=0 — AoeZone only hits the player).
          this.spawnAoeZone(new AoeZone(ix, iy, rAG, 0, i * 0.25, {
            color: '#ff6b00', activeTime: 0.45, singleHit: true,
          }));
          // Deferred enemy damage at each impact.
          this.pendingDmg.push({ x: ix, y: iy, r: rAG, dmg: baseDmg, delay: i * 0.25, color: '#ff6b00' });
        }
        break;
      }

      // ── TIER 1 NEW ───────────────────────────────────────────────────────
      case 'thunder_clap': {
        // Explosive repel — blast all nearby enemies outward, stun 1s, AoE damage.
        const rTC = skill.radius ?? 200;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - px, dy = e.y - py;
          const dist = Math.hypot(dx, dy);
          if (dist <= rTC) {
            // Push enemy outward (stronger when closer)
            const pushMag = (1 - dist / rTC) * 220 + 60;
            if (dist > 5) {
              e.x = Math.max(20, Math.min(this.worldWidth - 20, e.x + (dx / dist) * pushMag));
              e.y = Math.max(20, Math.min(this.worldHeight - 20, e.y + (dy / dist) * pushMag));
            }
            e.frozenTimer = Math.max(e.frozenTimer, 1.0); // stun via freeze
            this.dealAuxDamage(e, baseDmg, '#ffd43b');
          }
        }
        this.spawnAoeZone(new AoeZone(px, py, rTC, 0, 0.0, {
          color: '#ffd43b', activeTime: 0.35, singleHit: true,
        }));
        break;
      }

      // ── TIER 2 NEW ───────────────────────────────────────────────────────
      case 'bone_spear': {
        // Massive single piercing bone lance — fired toward the nearest enemy.
        const aliveBS = this.enemies.filter(e => !e.dead);
        if (aliveBS.length === 0) break;
        const nearBS = aliveBS.reduce((n, e) =>
          Math.hypot(e.x - px, e.y - py) < Math.hypot(n.x - px, n.y - py) ? e : n
        );
        const angleBS = Math.atan2(nearBS.y - py, nearBS.x - px);
        const p = new Projectile(px, py, angleBS, baseDmg, 320, true, false);
        p.maxPierceCount = 999;
        p.color = '#e8d5b7';
        p.radius = 18; // visually large
        this.projectiles.push(p);
        break;
      }
      case 'spectral_shield': {
        // 2.5s invincibility bubble + immediate burst nova around the player.
        if (this.player) this.player.invincibilityTimer = Math.max(this.player.invincibilityTimer, 2.5);
        const rSS = skill.radius ?? 160;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - px, e.y - py) <= rSS) {
            this.dealAuxDamage(e, baseDmg, '#74c0fc');
          }
        }
        this.spawnAoeZone(new AoeZone(px, py, rSS, 0, 0.0, {
          color: '#a5d8ff', activeTime: 5.0, singleHit: true, shape: 'ring',
        }));
        break;
      }
      case 'rune_field': {
        // Drop 6 rune detonations at nearest enemy positions, each with 0.5s fuse.
        const alivRF = [...this.enemies]
          .filter(e => !e.dead)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, 6);
        const rRF = skill.radius ?? 70;
        for (let i = 0; i < alivRF.length; i++) {
          const t = alivRF[i];
          const delay = 0.5 + i * 0.1;
          // Visual telegraphed marker (damage=0 — AoeZone only hits the player).
          this.spawnAoeZone(new AoeZone(t.x, t.y, rRF, 0, delay, {
            color: '#ff6b6b', activeTime: 0.4, singleHit: true,
          }));
          // Deferred enemy damage resolved at detonation time.
          this.pendingDmg.push({ x: t.x, y: t.y, r: rRF, dmg: baseDmg, delay, color: '#ff6b6b' });
        }
        // If fewer than 6 enemies, fill with random positions around player
        for (let i = alivRF.length; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const d = 100 + Math.random() * 80;
          const rx = px + Math.cos(ang) * d;
          const ry = py + Math.sin(ang) * d;
          const delay = 0.5 + i * 0.1;
          this.spawnAoeZone(new AoeZone(rx, ry, rRF, 0, delay, {
            color: '#ff6b6b', activeTime: 0.4, singleHit: true,
          }));
          this.pendingDmg.push({ x: rx, y: ry, r: rRF, dmg: baseDmg, delay, color: '#ff6b6b' });
        }
        break;
      }

      // ── TIER 3 NEW ───────────────────────────────────────────────────────
      case 'soul_shatter': {
        // Stack Condemned×12 + Fragility×10 on 8 nearest, then detonation burst.
        const targsSH = [...this.enemies]
          .filter(e => !e.dead)
          .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
          .slice(0, 8);
        for (const t of targsSH) {
          t.statusFX.apply('condemned', { stacks: 12 });
          t.statusFX.apply('fragility', { stacks: 10 });
          t.statusFX.apply('exposed', { stacks: 5 });
        }
        // Detonation burst — hits all 8 and visual flash
        for (const t of targsSH) {
          this.dealAuxDamage(t, baseDmg, '#c92a2a');
          this.spawnAoeZone(new AoeZone(t.x, t.y, 45, 0, 0.0, {
            color: '#9b2335', activeTime: 0.35, singleHit: true,
          }));
        }
        break;
      }
      case 'mirror_strike': {
        // 3 simultaneous strikes hit EVERY enemy on screen.
        const alivMS = this.enemies.filter(e => !e.dead);
        // Visual shockwave rings (damage=0 — AoeZone only hits the player).
        for (let wave = 0; wave < 3; wave++) {
          this.spawnAoeZone(new AoeZone(px, py, 900, 0, wave * 0.3, {
            color: '#e599f7', activeTime: 0.25, singleHit: true,
          }));
        }
        // Actual enemy damage: deal baseDmg to each living enemy (3 waves × baseDmg/3).
        for (const e of alivMS) {
          if (!e.dead) {
            this.dealAuxDamage(e, baseDmg, '#cc5de8');
            // Per-enemy burst visual.
            this.spawnAoeZone(new AoeZone(e.x, e.y, 30, 0, 0.0, {
              color: '#cc5de8', activeTime: 0.25, singleHit: true,
            }));
          }
        }
        break;
      }

      // ── TIER 4 NEW ───────────────────────────────────────────────────────
      case 'doom_comet': {
        // 1.5s warning comet — massive blast + all debuffs on every enemy in radius.
        const rDC = skill.radius ?? 200;
        // Telegraph: 1.5s red warning fill (visual only).
        this.spawnAoeZone(new AoeZone(px, py, rDC, 0, 0.0, {
          color: '#f03e3e', activeTime: 1.5, singleHit: true,
        }));
        // Detonation flash: pure visual, damage=0 (AoeZone only hits the player).
        this.spawnAoeZone(new AoeZone(px, py, rDC, 0, 1.5, {
          color: '#ff8c00', activeTime: 0.6, singleHit: true,
        }));
        // Debuffs applied immediately at cast (pre-mark — amplify the incoming blast).
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - px, e.y - py) <= rDC) {
            e.statusFX.apply('fragility', { stacks: 8 });
            e.statusFX.apply('exposed', { stacks: 6 });
            e.statusFX.apply('condemned', { stacks: 8 });
            e.statusFX.apply('brittle', { stacks: 10 });
            e.burnTimer = Math.max(e.burnTimer, 4.0);
            e.poisonTimer = Math.max(e.poisonTimer, 4.0);
            e.frozenTimer = Math.max(e.frozenTimer, 0.8);
          }
        }
        // Deferred blast damage: resolved 1.5s later against enemies still in radius.
        this.pendingDmg.push({ x: px, y: py, r: rDC, dmg: baseDmg, delay: 1.5, color: '#ff8c00' });
        break;
      }
      case 'hellfire_rain': {
        // 20 hellfire bolts rain down on all living enemies over 4 seconds.
        const rHR = skill.radius ?? 65;
        const aliveHR = this.enemies.filter(e => !e.dead);
        for (let i = 0; i < 20; i++) {
          let ix: number, iy: number;
          if (aliveHR.length > 0) {
            const t = aliveHR[i % aliveHR.length];
            ix = t.x + (Math.random() - 0.5) * 50;
            iy = t.y + (Math.random() - 0.5) * 50;
          } else {
            const a = Math.random() * Math.PI * 2;
            ix = px + Math.cos(a) * (Math.random() * 300);
            iy = py + Math.sin(a) * (Math.random() * 300);
          }
          const delay = i * 0.2;
          // Visual telegraph marker (damage=0 — AoeZone only hits the player).
          this.spawnAoeZone(new AoeZone(ix, iy, rHR, 0, delay, {
            color: '#ff4500', activeTime: 0.4, singleHit: true,
          }));
          // Deferred enemy damage at the bolt's impact position.
          this.pendingDmg.push({ x: ix, y: iy, r: rHR, dmg: baseDmg, delay, color: '#ff4500' });
        }
        break;
      }
    }
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

  /** Tick and resolve deferred area damage from active skills. */
  private resolvePendingDmg(dt: number): void {
    for (let i = this.pendingDmg.length - 1; i >= 0; i--) {
      const job = this.pendingDmg[i];
      job.delay -= dt;
      if (job.delay <= 0) {
        // Find enemies in radius at resolution time (enemies may have moved).
        const nearby = this.enemyQuadtree.retrieve({ x: job.x, y: job.y, radius: job.r + 20 });
        for (const e of nearby) {
          if (!e.dead && Math.hypot(e.x - job.x, e.y - job.y) <= job.r) {
            this.dealAuxDamage(e, job.dmg, job.color);
          }
        }
        this.pendingDmg.splice(i, 1);
      }
    }
  }

  /** Tick persistent player-AoE zones (poison_cloud, circle_power) — deals damage to enemies inside per second. */
  private resolveActiveDmgZones(dt: number): void {
    for (let i = this.activeDmgZones.length - 1; i >= 0; i--) {
      const z = this.activeDmgZones[i];
      z.remaining -= dt;
      if (z.remaining <= 0) { this.activeDmgZones.splice(i, 1); continue; }
      const nearby = this.enemyQuadtree.retrieve({ x: z.x, y: z.y, radius: z.r + 20 });
      for (const e of nearby) {
        if (!e.dead && Math.hypot(e.x - z.x, e.y - z.y) <= z.r) {
          this.dealAuxDamage(e, z.dmgPerSec * dt, z.color);
        }
      }
    }
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
    // Each level-up grants 1 skill point (Felix, 2026-07-05: the level-up system is now a
    // skill tree). We DON'T interrupt the fight — the point banks and the juice
    // (sound/flash/confetti) still fires now; the player spends banked points on the
    // skill-tree screen at the next natural break, the between-waves shop (see enterShop()).
    // A per-level baseline stat bump already happens in Player.levelUp().
    this.skillTree.grantPoints(1);
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

  // ==================== SKILL TREE ====================
  // Replaces the old level-up 1-of-3 item pick. Level-ups bank skill points on
  // this.skillTree; the player spends them here. Opened at the between-waves shop break
  // (fromShop = true → "Continue" lands on the shop) or from the shop's "Skills" button.

  /** Open the skill-tree screen. `fromShop` = drained at the shop break / reopened from
   *  the shop, so Continue returns to the shop rather than back into the fight. */
  private openSkillTree(fromShop: boolean): void {
    this.skillTreeReturnsToShop = fromShop;
    this.state = 'skilltree';
    this.stPointerActive = false;
    this.stDragDist = 0;
    this.centerSkillTreeOnStart();
    this.input.disarmUntilRelease(); // a finger held over from the shop can't insta-tap a node
  }

  /** Leave the tree: land on the shop when opened at the break, otherwise resume play. */
  private finishSkillTree(): void {
    if (this.skillTreeReturnsToShop) {
      this.skillTreeReturnsToShop = false;
      this.state = 'shop';
    } else {
      this.state = 'playing';
    }
  }

  /** Frame the current class's start node in the middle of the web at a default zoom. */
  private centerSkillTreeOnStart(): void {
    const { isMobile, zoom } = this.screenScale();
    this.stZoom = isMobile ? 0.42 : 0.6;
    const start = getNode(this.skillTree.startId);
    const Z = this.stZoom * zoom;
    this.stPanX = start ? -start.x * Z : 0;
    this.stPanY = start ? -start.y * Z : 0;
    this.stSelected = this.skillTree.startId;
  }

  /** Zoom about the view centre (keeps the centred tree-point fixed on screen). */
  private stApplyZoom(factor: number): void {
    const nz = Math.min(1.4, Math.max(0.16, this.stZoom * factor));
    const f = nz / this.stZoom;
    this.stPanX *= f;
    this.stPanY *= f;
    this.stZoom = nz;
  }

  /** Zoom about an arbitrary screen point (sx,sy) — keeps the tree-point under it
   *  fixed, so a pinch feels anchored between the fingers. */
  private stZoomAbout(factor: number, sx: number, sy: number): void {
    const nz = Math.min(1.4, Math.max(0.16, this.stZoom * factor));
    if (nz === this.stZoom) return;
    const { zoom } = this.screenScale();
    const V = this.stView();
    const Z = this.stZoom * zoom;
    const Zn = nz * zoom;
    // Tree-space point currently under (sx,sy) — hold it in place across the zoom.
    const tx = (sx - V.cx - this.stPanX) / Z;
    const ty = (sy - V.cy - this.stPanY) / Z;
    this.stPanX = sx - V.cx - tx * Zn;
    this.stPanY = sy - V.cy - ty * Zn;
    this.stZoom = nz;
  }

  /** Screen geometry: the pannable web band sits between the header and the info panel. */
  private stView() {
    const { s, W, H, isMobile, zoom } = this.screenScale();
    const topBand = s(isMobile ? 46 : 56);
    const btnH = s(isMobile ? 44 : 46);
    const btnW = Math.min(W - s(40), s(isMobile ? 260 : 360));
    const btnX = (W - btnW) / 2;
    const infoH = s(isMobile ? 44 : 50);
    const btnY = H - btnH - s(8);
    const infoY = btnY - infoH - s(6);
    const cx = W / 2;
    const cy = topBand + (infoY - topBand) / 2;
    return { s, W, H, isMobile, zoom, topBand, btnH, btnW, btnX, btnY, infoH, infoY, cx, cy };
  }

  /** Right-edge zoom-in / zoom-out / recenter buttons. */
  private stButtons() {
    const V = this.stView();
    const { s, W, isMobile } = V;
    const bs = s(isMobile ? 34 : 40);
    const gap = s(8);
    const rx = W - bs - s(8);
    const midY = V.cy;
    return {
      bs,
      zoomIn:   { x: rx, y: midY - bs * 1.5 - gap, width: bs, height: bs },
      zoomOut:  { x: rx, y: midY - bs * 0.5,       width: bs, height: bs },
      recenter: { x: rx, y: midY + bs * 0.5 + gap, width: bs, height: bs },
    };
  }

  /** On-screen radius of a node (by type), scaled mildly with zoom. */
  private stNodeRadius(node: SkillNode): number {
    const { s } = this.screenScale();
    const base = node.type === 'keystone' ? 15 : node.type === 'start' ? 15 : node.type === 'notable' ? 11 : 6.5;
    const zs = Math.min(1.5, Math.max(0.6, this.stZoom / 0.5));
    return s(base) * zs;
  }

  private updateSkillTree(): void {
    const mx = this.input.mouseX, my = this.input.mouseY;
    const down = this.input.mouseDown;
    const { s } = this.screenScale();

    // Two fingers → pinch-zoom about the midpoint. Owns input while active: the
    // single-pointer pan/tap logic below is suppressed so lifting a finger can't
    // register a tap or make the web jump.
    const pinch = this.input.getPinch();
    if (pinch) {
      if (this.stPinchDist > 0 && pinch.dist > 0) {
        this.stZoomAbout(pinch.dist / this.stPinchDist, pinch.cx, pinch.cy);
      }
      this.stPinchDist = pinch.dist;
      this.stPointerActive = false;   // abandon any in-progress single-finger pan
      return;
    }
    this.stPinchDist = 0;

    if (down && !this.stPointerActive) {
      // Press start — record the anchor so we can tell a tap from a pan on release.
      this.stPointerActive = true;
      this.stDownX = mx; this.stDownY = my;
      this.stLastX = mx; this.stLastY = my;
      this.stDragDist = 0;
    } else if (down && this.stPointerActive) {
      // Held — drag pans the web.
      const dx = mx - this.stLastX, dy = my - this.stLastY;
      this.stPanX += dx; this.stPanY += dy;
      this.stDragDist += Math.abs(dx) + Math.abs(dy);
      this.stLastX = mx; this.stLastY = my;
    } else if (!down && this.stPointerActive) {
      // Release — a small-travel press counts as a tap.
      this.stPointerActive = false;
      if (this.stDragDist <= s(6)) this.handleSkillTreeTap(this.stDownX, this.stDownY);
    }
  }

  /** Resolve a tap: Continue / zoom / recenter buttons first, else a node hit-test. */
  private handleSkillTreeTap(x: number, y: number): void {
    const V = this.stView();
    if (pointInRect(x, y, { x: V.btnX, y: V.btnY, width: V.btnW, height: V.btnH })) { this.finishSkillTree(); return; }
    const B = this.stButtons();
    if (pointInRect(x, y, B.zoomIn))   { this.stApplyZoom(1.25); return; }
    if (pointInRect(x, y, B.zoomOut))  { this.stApplyZoom(0.8);  return; }
    if (pointInRect(x, y, B.recenter)) { this.centerSkillTreeOnStart(); return; }

    const Z = this.stZoom * V.zoom;
    let hit: SkillNode | null = null;
    for (const node of SKILL_NODES) {
      const sx = V.cx + this.stPanX + node.x * Z;
      const sy = V.cy + this.stPanY + node.y * Z;
      const r = this.stNodeRadius(node);
      if (Math.hypot(x - sx, y - sy) <= r + V.s(4)) { hit = node; break; }
    }
    if (!hit) return;
    this.stSelected = hit.id;
    if (this.skillTree.allocate(hit.id)) {
      this.skillTree.recomputeInto(this.playerStats);
      this.refreshMaxHealth();
      this.audio.playLevelUp();
      this.screenEffects.flash(ARM_COLOR[hit.arm] || '#ffd700', 0.16);
    }
  }

  private drawSkillTree(): void {
    const ctx = this.renderer.getContext();
    const V = this.stView();
    const { s, W, isMobile } = V;
    const Z = this.stZoom * V.zoom;
    this.paintBackdrop();

    const screenOf = (n: SkillNode) => ({ x: V.cx + this.stPanX + n.x * Z, y: V.cy + this.stPanY + n.y * Z });
    const zScale = Math.min(1.4, Math.max(0.6, this.stZoom / 0.5));

    // --- Web (edges + nodes), clipped to the band between header and info panel. ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, V.topBand, W, V.infoY - V.topBand);
    ctx.clip();

    // Edges first so nodes sit on top.
    ctx.lineWidth = Math.max(1, s(1.2) * zScale);
    for (const [a, b] of SKILL_EDGES) {
      const na = getNode(a), nb = getNode(b);
      if (!na || !nb) continue;
      const pa = screenOf(na), pb = screenOf(nb);
      if ((pa.x < -60 && pb.x < -60) || (pa.x > W + 60 && pb.x > W + 60)) continue;
      const both = this.skillTree.isAllocated(a) && this.skillTree.isAllocated(b);
      const either = this.skillTree.isAllocated(a) || this.skillTree.isAllocated(b);
      ctx.strokeStyle = both ? '#ffe9a8' : either ? '#8a7a52' : '#3a3020';
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }

    // Nodes.
    const showLabels = this.stZoom >= 0.42;
    for (const node of SKILL_NODES) {
      const p = screenOf(node);
      const r = this.stNodeRadius(node);
      if (p.x < -r * 2 || p.x > W + r * 2 || p.y < V.topBand - r * 2 || p.y > V.infoY + r * 2) continue;
      const alloc = this.skillTree.isAllocated(node.id);
      const reachable = this.skillTree.isReachable(node.id);
      const canAlloc = this.skillTree.canAllocate(node.id);
      const armColor = node.arm === 'core' ? '#ffd700' : (ARM_COLOR[node.arm] || '#c8b998');

      ctx.save();
      ctx.beginPath();
      if (node.type === 'keystone') {
        ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r, p.y); ctx.closePath();
      } else if (node.type === 'start') {
        ctx.rect(p.x - r, p.y - r, r * 2, r * 2);
      } else {
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = alloc ? armColor : canAlloc ? '#2a2416' : reachable ? '#231d12' : '#181206';
      ctx.fill();
      ctx.lineWidth = Math.max(1, s(canAlloc ? 2.2 : 1.4));
      ctx.strokeStyle = alloc ? '#fff4cf' : canAlloc ? armColor : reachable ? '#6b5d47' : '#3a3020';
      ctx.stroke();
      if (this.stSelected === node.id) {
        ctx.lineWidth = Math.max(1, s(1.5));
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, r + s(3), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();

      if (r >= s(9)) {
        this.renderer.drawText(node.icon, p.x, p.y + r * 0.35, { size: Math.round(r * 1.1), align: 'center', color: alloc ? '#1a1206' : '#ffffff' });
      }
      if (showLabels && node.type !== 'minor') {
        this.renderer.drawText(node.name, p.x, p.y + r + s(9), { size: s(isMobile ? 7 : 8), align: 'center', color: alloc ? armColor : reachable ? '#d8c9a8' : '#6b5d47' });
      }
    }
    ctx.restore(); // unclip

    // --- Header ---
    const pts = this.skillTree.availablePoints;
    this.renderer.drawText('SKILL TREE', W / 2, s(isMobile ? 15 : 21), { size: s(isMobile ? 13 : 18), align: 'center', color: '#ffd700' });
    this.renderer.drawText(
      pts > 0 ? `${pts} point${pts === 1 ? '' : 's'} · drag to pan · tap a lit node` : 'drag to pan · tap a node to inspect',
      W / 2, s(isMobile ? 29 : 39), { size: s(isMobile ? 7 : 9), align: 'center', color: pts > 0 ? '#a8e063' : '#c8b998' }
    );

    // --- Zoom / recenter buttons ---
    const B = this.stButtons();
    const iconBtn = (rct: { x: number; y: number; width: number; height: number }, label: string) => {
      ctx.save();
      ctx.fillStyle = 'rgba(20,14,6,0.85)';
      ctx.fillRect(rct.x, rct.y, rct.width, rct.height);
      ctx.strokeStyle = '#c8a15a';
      ctx.lineWidth = Math.max(1, s(1.4));
      ctx.strokeRect(rct.x, rct.y, rct.width, rct.height);
      ctx.restore();
      this.renderer.drawText(label, rct.x + rct.width / 2, rct.y + rct.height / 2 + s(5), { size: s(isMobile ? 15 : 18), align: 'center', color: '#ffd700' });
    };
    iconBtn(B.zoomIn, '+');
    iconBtn(B.zoomOut, '\u2212');
    iconBtn(B.recenter, '\u2302');

    // --- Info panel for the selected node ---
    drawPanel(ctx, V.btnX, V.infoY, V.btnW, V.infoH, DARK_WOOD_THEME, 71, 55);
    const sel = this.stSelected ? getNode(this.stSelected) : null;
    if (sel) {
      const selAlloc = this.skillTree.isAllocated(sel.id);
      const selCan = this.skillTree.canAllocate(sel.id);
      const selReach = this.skillTree.isReachable(sel.id);
      const status = sel.type === 'start' ? 'START'
        : selAlloc ? 'ALLOCATED'
        : selCan ? 'TAP TO ALLOCATE'
        : selReach ? (pts > 0 ? '' : 'NEED A POINT')
        : 'LOCKED';
      const armColor = sel.arm === 'core' ? '#ffd700' : (ARM_COLOR[sel.arm] || '#c8b998');
      this.renderer.drawText(`${sel.icon} ${sel.name}`, V.btnX + s(8), V.infoY + s(isMobile ? 15 : 17), { size: s(isMobile ? 9 : 11), align: 'left', color: armColor });
      this.renderer.drawText(sel.desc || 'Travel node', V.btnX + s(8), V.infoY + s(isMobile ? 29 : 33), { size: s(isMobile ? 8 : 9), align: 'left', color: '#d8c9a8' });
      if (status) this.renderer.drawText(status, V.btnX + V.btnW - s(8), V.infoY + s(isMobile ? 15 : 17), { size: s(isMobile ? 7 : 8), align: 'right', color: selAlloc ? '#a8e063' : selCan ? '#ffd700' : '#c8a15a' });
    } else {
      this.renderer.drawText('Tap a node to inspect it', V.btnX + V.btnW / 2, V.infoY + V.infoH / 2 + s(3), { size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998' });
    }

    // --- Continue button ---
    drawPanel(ctx, V.btnX, V.btnY, V.btnW, V.btnH, DARK_WOOD_THEME, 91, 60);
    this.renderer.drawText(pts > 0 ? 'CONTINUE (points banked)' : 'CONTINUE', W / 2, V.btnY + V.btnH / 2 + s(4), { size: s(isMobile ? 10 : 13), align: 'center', color: '#ffd700' });
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

  // ---- Achievements screen (milestone unlocks + click-to-disable reward pool) ----

  /** Shared row layout so drawAchievements visuals and updateAchievements hitboxes never drift. */
  private achievementLayout() {
    const { s, W, H, isMobile } = this.screenScale();
    const rowW = Math.min(W - s(24), s(isMobile ? 360 : 520));
    const rowH = s(isMobile ? 46 : 52);
    const gap = s(8);
    const x0 = (W - rowW) / 2;
    const topY = s(isMobile ? 78 : 96);
    const backH = s(isMobile ? 34 : 38);
    const backW = Math.min(rowW, s(200));
    const backY = topY + ACHIEVEMENTS.length * (rowH + gap) + s(8);
    const back = { x: (W - backW) / 2, y: backY, width: backW, height: backH };
    return { s, W, H, isMobile, rowW, rowH, gap, x0, topY, back };
  }

  private updateAchievements(): void {
    if (!this.input.mouseDown) return;
    const { rowW, rowH, gap, x0, topY, back } = this.achievementLayout();
    const mx = this.input.mouseX, my = this.input.mouseY;

    // Back to menu.
    if (pointInRect(mx, my, back)) {
      this.input.mouseDown = false;
      this.state = 'menu';
      return;
    }

    // Tapping an EARNED row toggles its reward item in/out of the shop pool.
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const y = topY + i * (rowH + gap);
      if (pointInRect(mx, my, { x: x0, y, width: rowW, height: rowH })) {
        this.input.mouseDown = false;
        const ach = ACHIEVEMENTS[i];
        if (AchievementSystem.isEarned(ach.id)) {
          AchievementSystem.toggleItemDisabled(ach.unlocksItemId);
        }
        return;
      }
    }
  }

  private drawAchievements(): void {
    const ctx = this.renderer.getContext();
    const { s, W, isMobile, rowW, rowH, gap, x0, topY, back } = this.achievementLayout();
    this.paintBackdrop();

    this.renderer.drawText('ACHIEVEMENTS', W / 2, s(isMobile ? 24 : 30), { size: s(isMobile ? 15 : 20), align: 'center', color: '#ffd700' });
    this.renderer.drawText(
      `${AchievementSystem.earnedCount()} / ${ACHIEVEMENTS.length} earned  ·  tap an unlocked reward to enable/disable it`,
      W / 2, s(isMobile ? 24 : 30) + s(isMobile ? 16 : 20),
      { size: s(isMobile ? 7 : 9), align: 'center', color: '#c8b998', maxWidth: rowW }
    );

    const iconBox = s(isMobile ? 22 : 26);
    const nameX = x0 + s(10) + iconBox + s(8);
    // Split each row into a left column (name + desc) and a right column (status + reward name)
    // so the two never overlap; drawText auto-shrinks anything wider than its column.
    const rightX = x0 + rowW - s(10);
    const leftColW = rowW * 0.52;
    const rightColW = rowW * 0.42;

    ACHIEVEMENTS.forEach((ach, i) => {
      const y = topY + i * (rowH + gap);
      const earned = AchievementSystem.isEarned(ach.id);
      const disabled = earned && AchievementSystem.isItemDisabled(ach.unlocksItemId);
      const reward = ItemDatabase.getItemById(ach.unlocksItemId);

      drawPanel(ctx, x0, y, rowW, rowH, DARK_WOOD_THEME, 4, 71 + i);

      // Left icon: full-colour when earned, dimmed lock when still locked.
      this.renderer.drawText(earned ? ach.icon : '🔒', x0 + s(10) + iconBox / 2, y + rowH / 2 + s(3), { size: iconBox, align: 'center', color: '#ffffff' });

      const nameColor = earned ? '#ffd700' : '#8a7f68';
      this.renderer.drawText(ach.name, nameX, y + s(isMobile ? 13 : 15), { size: s(isMobile ? 10 : 12), align: 'left', color: nameColor, maxWidth: leftColW });
      // On earned rows the reward name occupies the right column, so clamp the desc to end
      // before it (with a gap); on locked rows the desc gets the full left column width.
      const descMaxW = earned ? Math.max(s(60), rightX - rightColW - nameX - s(8)) : leftColW;
      this.renderer.drawText(ach.desc, nameX, y + s(isMobile ? 30 : 34), { size: s(isMobile ? 7 : 8), align: 'left', color: earned ? '#d8c9a8' : '#7d735e', maxWidth: descMaxW });

      // Right column: status + (when earned) the reward it grants.
      if (earned) {
        const status = disabled ? 'DISABLED' : 'ENABLED';
        const statusColor = disabled ? '#ff6b6b' : '#8ce99a';
        this.renderer.drawText(status, rightX, y + s(isMobile ? 15 : 17), { size: s(isMobile ? 8 : 9), align: 'right', color: statusColor });
        const rewardName = reward ? `${reward.icon} ${reward.name}` : ach.unlocksItemId;
        this.renderer.drawText(rewardName, rightX, y + s(isMobile ? 31 : 35), { size: s(isMobile ? 7 : 8), align: 'right', color: disabled ? '#8a7f68' : '#c8b998', maxWidth: rightColW });
      } else {
        this.renderer.drawText('LOCKED', rightX, y + rowH / 2 + s(3), { size: s(isMobile ? 8 : 9), align: 'right', color: '#6b6250' });
      }
    });

    // Back button.
    drawPanel(ctx, back.x, back.y, back.width, back.height, DARK_WOOD_THEME, 4, 99);
    this.renderer.drawText('BACK', back.x + back.width / 2, back.y + back.height / 2 + s(4), { size: s(isMobile ? 11 : 13), align: 'center', color: '#ffd700' });
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

    // Track boss kills (use typeData.isBoss — the dedicated boss flag, not type === 'demon')
    if (enemy.typeData.isBoss) {
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
    let finalXP = enemy.typeData.xpValue * xpMultiplier * this.playerStats.artifactXpMult * this.playerStats.skillXpMult;
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

    // v2 rework: 3 shop slots (was 6) — fewer, deeper choices. Must match the visual
    // grid SLOTS in getShopLayout() so every generated item has a card.
    const shopSlotCount = 3;

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

    // ELITE CASCADE: after clearing an elite/boss wave, inject one free tier-appropriate
    // item as a 4th shop slot so the battle reward feels materially bigger than gold alone.
    if (this.pendingEliteCascade) {
      this.pendingEliteCascade = false;
      const cascadeTier = currentWave < 6 ? ItemTier.Uncommon : currentWave < 11 ? ItemTier.Rare : ItemTier.Legendary;
      const existing = new Set(this.shopItems.filter(Boolean).map(it => it!.id));
      const pool = ItemDatabase.getItemsByTier(cascadeTier).filter(it => !existing.has(it.id));
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const cascadeItem = JSON.parse(JSON.stringify(pick)) as Item;
        (cascadeItem as any)._cascade = true;
        this.shopItems.push(cascadeItem);
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

    // Spend banked skill points HERE, at the natural break, rather than interrupting the
    // fight. The shop is staged underneath; Continue on the tree lands on the shop. Points
    // are optional to spend — a player can bank them and use the shop's Skills button later.
    if (this.skillTree.availablePoints > 0) {
      this.openSkillTree(true);
    }

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

    // Chill/Slow: reduce movement for 2.5s. Unlike Freeze (a proc), Slow always applies while
    // the build has any slow — it's a steady control layer. Strongest (lowest factor) wins.
    const slowStr = this.playerStats.getSlowStrength();
    if (slowStr > 0) {
      enemy.slowTimer = Math.max(enemy.slowTimer, 2.5);
      const factor = Math.max(0.35, 1 - slowStr); // cap at 65% slow
      enemy.slowFactor = Math.min(enemy.slowFactor, factor);
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

    // ── New-architecture status effects via StatusEffectEngine ──────────────
    // Roll all new-engine procs in one pass, then apply + resolve synergy chains.
    const newProcs = rollOnHitProcs({
      roll: (c) => this.playerStats.rollProc(c),
      burnChance: 0,    // legacy path handles burn/bleed/poison/doom above
      bleedChance: 0,
      freezeChance: 0,
      doomChance: 0,
      woundChance: 0,
      fragileChance: this.playerStats.getFragileChance(),
      exposedChance: this.playerStats.getExposedChance(),
      condemnedChance: this.playerStats.getCondemnedChance(),
      brittleChance: this.playerStats.getBrittleChance(),
      dazedChance: this.playerStats.getDazedChance(),
      disorientedChance: this.playerStats.getDisorientedChance(),
      hasPoison: false,
      poisonSpreads: false,
      elementalMult: elem,
      damage,
      fromDagger,
    });
    for (const { id, opts } of newProcs.effects) {
      const synergies = enemy.statusFX.apply(id, opts);
      enemy.statusFX.applySynergyChain(synergies, elem, fromDagger);
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

    // v2 rework: 3 items normally; an elite cascade adds a 4th (free bonus slot).
    const SLOTS = Math.max(3, this.shopItems.length);
    // Column count is driven by width, NOT the mobile flag: a wide LANDSCAPE phone
    // uses the 3-wide grid, only a narrow PORTRAIT screen stacks in one column.
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

    // Top of the card grid, below the title/gold/stats header. On mobile the equipment
    // strip is now 8 slots in TWO rows (taller than the old 4-box single row), so the grid
    // must start further down — otherwise the strip overlaps the first card. Desktop has
    // the strip in the left rail, so its grid top is unaffected.
    const gridTopCss = isMobile ? 176 : 120;

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

  // "SKILLS" button — top-CENTER of the shop header, so banked skill points can be spent
  // from the shop at any time (not only the auto-open at the wave break). Sits between the
  // top-left COMBOS button and the top-right COMBOS/gear cluster.
  private getSkillsButtonRect() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const isMobile = this.canvas.width / zoom < 800;
    const width = s(isMobile ? 96 : 108);
    const height = s(isMobile ? 30 : 30);
    return { x: Math.round((this.canvas.width - width) / 2), y: s(6), width, height };
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

    // EQUIPPED-ITEM INSPECT POPUP — modal: while open it owns all shop input (buttons
    // act, a tap elsewhere closes). Checked first so nothing beneath it is interactable.
    if (this.inspectedEquipKey !== null) {
      if (this.input.mouseDown) {
        this.handleInspectPopupTap(mouseX, mouseY);
        this.input.mouseDown = false;
      }
      return;
    }

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

    // SKILLS button — open the skill tree from the shop to spend banked points.
    if (pointInRect(mouseX, mouseY, this.getSkillsButtonRect()) && this.input.mouseDown) {
      this.input.mouseDown = false;
      this.openSkillTree(true); // Continue returns to the shop
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

    // EQUIPMENT STRIP (Phase 2 tap-to-manage). Checked before the shop cards because the
    // strip sits above them; a handled tap consumes the input and returns.
    if (this.input.mouseDown && this.handleEquipmentStripTap(mouseX, mouseY)) {
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

      // Check lock button (FREE - no cost)
      if (pointInRect(mouseX, mouseY, { x: lockButtonX, y: lockButtonY, width: lockButtonSize, height: lockButtonSize })) {
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
    // Elite-cascade items are free — the reward for clearing a hard wave.
    const isCascade = (item as any)._cascade === true;
    const finalPrice = isCascade ? 0 : this.playerStats.getItemPrice(item, this.waveManager.currentWave);
    if (!isCascade && this.player.gold < finalPrice) return false;

    this.player.gold -= finalPrice;
    // UPGRADE SYSTEM (v2): items carry instance state (upgradeLevel) once owned, so a
    // purchased item MUST be a fresh clone — never the shared catalog object — or an
    // upgrade would mutate every future shop offering of the same id.
    const bought: Item = JSON.parse(JSON.stringify(item));
    const { newDuos, newTransformations, overflow, upgraded, upgradeLevel } = this.playerStats.addItem(bought);
    this.updateMobileSkillButtons(); // skill scrolls change which active ability is on Q/E
    this.itemsPurchasedThisWave++;

    // Duplicate buy → upgraded an owned instance. Tell the player (e.g. "Amulet +2").
    if (upgraded) {
      this.showShopToast(`${item.name} +${upgradeLevel - 1}`);
    }

    // SLOT REWORK: if equipping displaced an item but the stash was full, the old
    // piece can't be kept — refund its sell value so the buy is never a silent loss.
    if (overflow) {
      this.player.gold += this.playerStats.getSellValue(overflow);
    }

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

    // Rebuild shop to full 3 slots, keeping locked items in their positions.
    const shopSlotCount = 3;
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

    // Clear any projectiles still in flight from the previous wave so stray bullets
    // don't carry over into the new one. Return them to the pool for reuse. Pickups
    // (xpOrbs / coins) are deliberately left alone so they stay collectable across waves.
    if (this.projectiles.length > 0) {
      this.projectilePool.releaseMany(this.projectiles);
      this.projectiles.length = 0;
    }

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
    this.scenes.map?.enter?.(this.state);
    this.state = 'map';
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
        this.pendingEliteCascade = true;
        this.startNextWave({ elite: true });
        break;
      case 'boss':
        this.pendingWaveArtifact = true;
        this.pendingEliteCascade = true;
        this.startNextWave({ boss: true });
        break;
      case 'event':
        // EventScene.enter() initialises the random event + disarms input.
        this.scenes.event?.enter?.(this.state);
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

  // ---- EVENT screen — moved to EventScene (step 4 of Game.ts de-god-classing) ----

  /** Apply a chosen event option's effects; return outcome text + optional reward card data.
   *  Returned to EventScene so the scene owns the screen state (resultText / reward).
   *  Devil-deal integrity: a pact's boon is PRICED by a permanent curse. If the player
   *  already bears that curse (a recurring devil event drawn again), the price is already
   *  paid — handing out the boon a second time for free would let a run farm boons and gut
   *  the "permanent price" risk axis. So an already-held-curse pact grants nothing. */
  private applyEventOption(opt: EventOption): { resultText: string; reward: EventReward | null } {
    const curseEff = opt.effects.find(e => e.kind === 'curse');
    if (curseEff && curseEff.kind === 'curse' && this.artifacts.has(curseEff.id)) {
      return { resultText: 'You already bear this mark. The devil has nothing left to sell you.', reward: null };
    }
    let reward: EventReward | null = null;
    for (const eff of opt.effects) {
      const r = this.applyEventEffect(eff);
      if (r) reward = r;
    }
    return { resultText: opt.result, reward };
  }

  /** Apply a single event effect; return reward card data if an item/artifact was granted. */
  private applyEventEffect(effect: EventEffect): EventReward | null {
    if (!this.player) return null;
    switch (effect.kind) {
      case 'gold':
        this.player.gold = Math.max(0, this.player.gold + effect.amount);
        return null;
      case 'heal':
        this.player.health = Math.min(this.player.maxHealth, this.player.health + Math.round(effect.frac * this.player.maxHealth));
        return null;
      case 'hurt': {
        const dmg = Math.round(effect.frac * this.player.maxHealth);
        this.player.health = Math.max(1, this.player.health - dmg); // event damage never kills
        return null;
      }
      case 'maxHp':
        this.playerStats.baseMaxHealth += effect.amount;
        this.refreshMaxHealth();
        return null;
      case 'artifact': {
        const pool = ROLLABLE_ARTIFACTS.filter(a => !this.artifacts.has(a.id));
        if (pool.length) {
          const picked = pool[Math.floor(Math.random() * pool.length)];
          this.grantArtifact(picked);
          return { name: picked.name, rarity: picked.rarity, desc: picked.desc, icon: picked.icon, artifactId: picked.id };
        }
        return null;
      }
      case 'curse': {
        // Devil-deal price: grant a SPECIFIC named curse artifact. Idempotent — if the
        // player already carries it, grantArtifact's dedupe simply no-ops.
        const curse = getArtifactById(effect.id);
        if (curse) this.grantArtifact(curse);
        return null;
      }
      case 'item': {
        const items = ItemDatabase.getWeightedShopItems(1, this.waveManager.currentWave, this.playerStats.items, this.playerStats.getLuck(), this.playerStats);
        if (items[0]) {
          this.playerStats.addItem(items[0]);
          this.refreshMaxHealth();
          return { name: items[0].name, rarity: items[0].rarity, desc: items[0].description, icon: items[0].icon };
        }
        return null;
      }
      case 'nothing':
        return null;
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

  /** Transition to the walkable village base. */
  private enterVillage(): void {
    this.scenes.village?.enter?.(this.state);
    this.state = 'village';
  }

  private updateGameOver(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;
    const isMobile = this.canvas.width < 800;
    const hasNewAch = this.newAchievementsThisRun.length > 0;

    // Match drawGameOver() layout exactly so click zones align with the drawn buttons.
    const buttonWidth = isMobile ? Math.min(300, this.canvas.width - 60) : 260;
    const buttonHeight = isMobile ? 70 : 60;
    const spacing = 18;
    // On desktop, shift all buttons up one slot to make room for the 4th "View Achievements" button.
    const extraSlot = (!isMobile && hasNewAch) ? buttonHeight + spacing : 0;
    const startY = this.canvas.height - (isMobile ? 240 : 220) - extraSlot;
    const bx = this.canvas.width / 2 - buttonWidth / 2;

    const retryBtn    = { x: bx, y: startY,                                width: buttonWidth, height: buttonHeight };
    const upgradesBtn = { x: bx, y: startY + (buttonHeight + spacing),     width: buttonWidth, height: buttonHeight };
    const menuBtn     = { x: bx, y: startY + (buttonHeight + spacing) * 2, width: buttonWidth, height: buttonHeight };
    const achBtn      = { x: bx, y: startY + (buttonHeight + spacing) * 3, width: buttonWidth, height: buttonHeight };

    if (pointInRect(mouseX, mouseY, retryBtn) && this.input.mouseDown) {
      this.openClassSelect();
      this.input.mouseDown = false;
    } else if (pointInRect(mouseX, mouseY, upgradesBtn) && this.input.mouseDown) {
      this.enterVillage();
      this.input.mouseDown = false;
    } else if (pointInRect(mouseX, mouseY, menuBtn) && this.input.mouseDown) {
      this.state = 'menu';
      this.input.mouseDown = false;
    } else if (!isMobile && hasNewAch && pointInRect(mouseX, mouseY, achBtn) && this.input.mouseDown) {
      this.state = 'achievements';
      this.input.mouseDown = false;
    }
  }

  private gameOver(): void {
    this.state = 'gameover';
    this.audio.playGameOver();

    // Capture personal best BEFORE updating it so the screen can compare
    const previousBest = SaveManager.getStats().highestWave;

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
      bossesDefeated: this.bossKills,
      goldEarned: this.player?.gold ?? 0,
      itemsCollected: this.playerStats.items.length,
      soulsEarned: this.soulsEarnedThisRun,
      personalBest: previousBest
    };

    // Evaluate achievements for this run — any newly earned unlock their reward item immediately
    // and are shown on the game-over screen. checkRunFull handles both wave-based and rich checks
    // (boss kills, cumulative kills, run duration, items owned, all-classes).
    const runStats: RunStats = {
      classId: this.getSelectedClassId(),
      wavesReached: this.waveManager.currentWave,
      enemiesKilled: this.kills,
      bossesDefeated: this.bossKills,
      runDurationMs: this.runStartTime > 0 ? Date.now() - this.runStartTime : 0,
      itemsCollected: this.playerStats.items.length,
      goldEarned: this.gameOverStats.goldEarned,
    };
    this.newAchievementsThisRun = AchievementSystem.checkRunFull(runStats);

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
      actMap: serializeMap(this.mapSystem.map),
      skillTree: this.skillTree.serialize()
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
      case 'reward':
        this.drawReward();
        break;
      case 'skilltree':
        this.drawSkillTree();
        break;
      case 'rest':
        this.drawRest();
        break;
      case 'classselect':
        this.drawClassSelect();
        break;
      case 'achievements':
        this.drawAchievements();
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

    // Spawn telegraphs: blinking red X where enemies are about to drop in (Brotato-style).
    for (const tg of this.spawnTelegraphs) tg.draw(ctx);

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

    // --- Active Skill indicators (bottom-left, below the status panel) ---
    // Dual-slot: Q = primary (slot 1), E = secondary (slot 2).
    // Draw a bar for each equipped slot; stacked vertically.
    const activeSkillIdQ = this.playerStats.getEquippedSkillIdQ();
    const activeSkillIdE = this.playerStats.getEquippedSkillId();
    const skX = s(6);
    const skSize = s(28);
    const skBarW = skSize + s(64);
    let skillBarH = 0;

    const isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    const drawSkillBar = (skillId: string, cdFrac: number, cdSecs: number, keyLabel: string, yPos: number) => {
      const sk = getActiveSkillById(skillId);
      if (!sk) return;
      // Background pill
      ctx.fillStyle = '#241407';
      ctx.fillRect(skX - s(2), yPos - s(2), skBarW + s(4), skSize + s(4));
      // Cooldown fill (purple = ready, dark = on cooldown)
      ctx.fillStyle = cdFrac > 0 ? '#3a1a5c' : '#5a2d82';
      ctx.fillRect(skX, yPos, skBarW, skSize);
      // Progress bar (drains as cooldown ticks down)
      if (cdFrac > 0) {
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(skX, yPos, Math.round(skBarW * (1 - cdFrac)), skSize);
      }
      // Icon
      ctx.font = `${s(14)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sk.icon, skX + s(14), yPos + skSize / 2);
      // Name + status label (show TAP on touch devices, [KEY] on keyboard)
      const readyLabel = isTouchDevice ? 'TAP READY' : `[${keyLabel}] READY`;
      const label = cdFrac > 0 ? `${cdSecs}s` : readyLabel;
      ctx.font = `bold ${s(7)}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sk.name, skX + s(30), yPos + s(9));
      ctx.font = `${s(7)}px monospace`;
      ctx.fillStyle = cdFrac > 0 ? '#cc99ff' : '#a0ffa0';
      ctx.fillText(label, skX + s(30), yPos + s(20));
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    };

    if (activeSkillIdQ) {
      const skYQ = topY + panelH + s(8);
      const cdQ = this.activeSkillCooldown;
      const skQ = getActiveSkillById(activeSkillIdQ);
      const cdFracQ = skQ && cdQ > 0 ? cdQ / skQ.cooldown : 0;
      drawSkillBar(activeSkillIdQ, cdFracQ, Math.ceil(cdQ), 'Q', skYQ);
      skillBarH += s(36);
    }
    if (activeSkillIdE) {
      const skYE = topY + panelH + s(8) + (activeSkillIdQ ? s(36) : 0);
      const cdE = this.activeSkillCooldownE;
      const skE = getActiveSkillById(activeSkillIdE);
      const cdFracE = skE && cdE > 0 ? cdE / skE.cooldown : 0;
      drawSkillBar(activeSkillIdE, cdFracE, Math.ceil(cdE), 'E', skYE);
      skillBarH += s(36);
    }

    // --- Status callouts under the left panel ---
    let statusY = topY + panelH + s(8) + skillBarH;
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

  /**
   * Update the mobile skill buttons (blastBtn / skillEBtn) to reflect the currently
   * equipped Q/E skills — shows skill icon + short name, disabled when no skill is
   * equipped in that slot. Called after any item acquisition that might change scrolls.
   */
  private updateMobileSkillButtons(): void {
    const blastBtn = document.getElementById('blastBtn') as HTMLButtonElement | null;
    const skillEBtn = document.getElementById('skillEBtn') as HTMLButtonElement | null;
    const qSkillId = this.playerStats.getEquippedSkillIdQ();
    const eSkillId = this.playerStats.getEquippedSkillId();
    if (blastBtn) {
      const sk = qSkillId ? getActiveSkillById(qSkillId) : null;
      if (sk) {
        const name = sk.name.length > 7 ? sk.name.slice(0, 6) + '…' : sk.name;
        blastBtn.innerHTML = `${sk.icon}<span style="font-size:9px">${name}</span>`;
        blastBtn.disabled = false;
      } else {
        blastBtn.innerHTML = `🔮<span>Q</span>`;
        blastBtn.disabled = true;
      }
    }
    if (skillEBtn) {
      const sk = eSkillId ? getActiveSkillById(eSkillId) : null;
      if (sk) {
        const name = sk.name.length > 7 ? sk.name.slice(0, 6) + '…' : sk.name;
        skillEBtn.innerHTML = `${sk.icon}<span style="font-size:9px">${name}</span>`;
        skillEBtn.disabled = false;
      } else {
        skillEBtn.innerHTML = `✨<span>E</span>`;
        skillEBtn.disabled = true;
      }
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

  // Evolution hint for a shop card: if this item is the catalyst for a weapon evolution
  // and the player already owns the base weapon (or vice versa), surface the evolution
  // name so players can understand the chain without reading the COMBOS guide.
  // Returns null when this item is not part of any reachable evolution pair.
  private getCardEvolutionInfo(item: Item): { name: string } | null {
    const ownedIds = new Set(this.playerStats.items.map(i => i.id));
    for (const evo of this.evolutionSystem.getAllEvolutions()) {
      // This card is the catalyst — player owns the base weapon → pair is complete, evolves at wave 8
      if (item.id === evo.catalystItemId && ownedIds.has(evo.baseWeaponId) && !ownedIds.has(evo.evolvedWeaponId)) {
        return { name: evo.name };
      }
      // This card is the base weapon — player owns the catalyst → pair is complete, evolves at wave 8
      if (item.id === evo.baseWeaponId && ownedIds.has(evo.catalystItemId) && !ownedIds.has(evo.evolvedWeaponId)) {
        return { name: evo.name };
      }
    }
    return null;
  }

  /**
   * Draw the equipment strip — the four gear slots (Weapon A, Weapon B, Offhand,
   * Amulet) as a row of labelled boxes showing each equipped item's icon (or an empty
   * marker). A two-hand weapon spans both weapon boxes.
   *
   * Phase 2 tap-to-manage: tap an occupied slot to bench it (unequip → stash); tap a
   * stashed item to equip it (swapping the current occupant back); tap a stash item's
   * ✕ badge to sell it for gold. Bounds are stored on equipSlotRects / stashItemRects /
   * stashSellRects so updateShop can hit-test them.
   */
  private equipSlotRects: Array<{ key: EquipHolderKey; x: number; y: number; width: number; height: number }> = [];
  private stashItemRects: Array<{ index: number; x: number; y: number; width: number; height: number }> = [];
  private stashSellRects: Array<{ index: number; x: number; y: number; width: number; height: number }> = [];
  private drawEquipmentStrip(
    ctx: CanvasRenderingContext2D,
    s: (n: number) => number,
    isMobile: boolean,
    x: number,
    y: number,
    width: number
  ): void {
    const eq = this.playerStats.getEquipment();
    const offhandDisabled = this.playerStats.isOffhandDisabled();
    this.equipSlotRects = [];
    this.stashItemRects = [];
    this.stashSellRects = [];

    // 8 slots laid out as two rows of four (mobile-friendly). Upgraded items show +N.
    const boxH = isMobile ? s(22) : s(28);
    const gap = s(4);
    const cols = 4;
    const boxW = (width - gap * (cols - 1)) / cols;
    const rowGap = s(3);
    const labels: Record<EquipHolderKey, string> = {
      weapon: 'WEAPON', offhand: 'OFF', head: 'HEAD', amulet: 'AMULET',
      torso: 'TORSO', legs: 'LEGS', feet: 'FEET', ring: 'RING',
    };
    const keys: EquipHolderKey[] = ['weapon', 'offhand', 'head', 'amulet', 'torso', 'legs', 'feet', 'ring'];

    keys.forEach((key, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const bx = x + col * (boxW + gap);
      const by = y + row * (boxH + rowGap);
      this.equipSlotRects.push({ key, x: bx, y: by, width: boxW, height: boxH });

      const disabled = key === 'offhand' && offhandDisabled;
      const occupant = eq[key];
      const level = occupant?.upgradeLevel ?? 1;

      ctx.save();
      ctx.fillStyle = disabled ? '#1a1408' : (occupant ? '#3a2c12' : '#241a0c');
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeStyle = disabled ? '#3a3018' : (occupant ? '#c8a15a' : '#5c4a28');
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, boxW, boxH);
      ctx.restore();

      // Slot label (tiny, top-left).
      this.renderer.drawText(labels[key], bx + s(3), by + s(2), {
        size: s(4.5), color: disabled ? '#4a3f22' : '#a5915f', align: 'left'
      });

      if (disabled) {
        this.renderer.drawText('2H', bx + boxW / 2, by + boxH / 2 - s(2), {
          size: s(6), color: '#5a4a28', align: 'center'
        });
      } else if (occupant) {
        this.renderer.drawItemIcon(occupant.icon, bx + boxW / 2, by + s(isMobile ? 9 : 11), s(isMobile ? 12 : 15));
        // Upgrade badge: show +N for an upgraded piece (bottom-right).
        if (level > 1) {
          this.renderer.drawText(`+${level - 1}`, bx + boxW - s(2), by + boxH - s(7), {
            size: s(isMobile ? 6 : 7), color: '#ffe08a', align: 'right'
          });
        }
      } else {
        this.renderer.drawText('—', bx + boxW / 2, by + boxH / 2 - s(3), {
          size: s(8), color: '#5c4a28', align: 'center'
        });
      }
    });

    const stripRows = Math.ceil(keys.length / cols);
    const stripBottom = y + stripRows * boxH + (stripRows - 1) * rowGap;

    // Discoverability hint — tiny line telling the player the strip is interactive.
    const anyEquipped = keys.some(k => eq[k]);
    if (anyEquipped) {
      this.renderer.drawText('tap gear ▸ inspect', x + width - s(2), stripBottom + s(2), {
        size: s(5), color: '#7a6a44', align: 'right'
      });
    }

    // STASH ROW — displaced/speculative equipment. Only shown when non-empty so the
    // auto-swap never looks like an item vanished: your old gear visibly lands here.
    // Each stash icon is tap-to-equip; its ✕ badge sells it for gold.
    const stash = this.playerStats.getStash();
    if (stash.length > 0) {
      const rowY = stripBottom + s(4);
      const iconBox = isMobile ? s(18) : s(22);
      this.renderer.drawText(`STASH ${stash.length}/${PlayerStats.STASH_CAP} · tap ▸ equip`, x + s(2), rowY, {
        size: s(5.5), color: '#9c8a5c', align: 'left'
      });
      const iconsY = rowY + s(8);
      const sellBadge = s(isMobile ? 8 : 9);
      for (let i = 0; i < stash.length; i++) {
        const ix = x + i * (iconBox + s(5));
        // Icon box (tap → equip).
        ctx.save();
        ctx.fillStyle = '#241a0c';
        ctx.fillRect(ix, iconsY, iconBox, iconBox);
        ctx.strokeStyle = '#5c4a28';
        ctx.lineWidth = 1;
        ctx.strokeRect(ix, iconsY, iconBox, iconBox);
        ctx.restore();
        this.renderer.drawItemIcon(stash[i].icon, ix + iconBox / 2, iconsY + iconBox / 2 - s(4), s(isMobile ? 11 : 13));
        this.stashItemRects.push({ index: i, x: ix, y: iconsY, width: iconBox, height: iconBox });

        // Sell ✕ badge (top-right of the icon box; tap → sell for gold).
        const sbx = ix + iconBox - sellBadge + s(1);
        const sby = iconsY - s(1);
        ctx.save();
        ctx.fillStyle = '#5a1e14';
        ctx.fillRect(sbx, sby, sellBadge, sellBadge);
        ctx.strokeStyle = '#c85a3c';
        ctx.lineWidth = 1;
        ctx.strokeRect(sbx, sby, sellBadge, sellBadge);
        ctx.restore();
        this.renderer.drawText('✕', sbx + sellBadge / 2, sby + sellBadge / 2 - s(3), {
          size: s(isMobile ? 6 : 7), color: '#ffd0c0', align: 'center'
        });
        // Slightly enlarge the sell hit-target beyond the drawn badge for fat fingers.
        const pad = s(2);
        this.stashSellRects.push({ index: i, x: sbx - pad, y: sby - pad, width: sellBadge + pad * 2, height: sellBadge + pad * 2 });
      }
    }
  }

  /**
   * Phase 2 tap-to-manage handler for the equipment strip. Returns true if the tap hit
   * an interactive region (so the caller consumes the input). Priority order matches the
   * draw z-order: stash sell ✕ badges (smallest, on top) → stash icons → equipped slots.
   *   • sell badge  → sell the stashed item for its sell value (gold in, item gone)
   *   • stash icon  → equip it (swaps any current occupant back to the stash)
   *   • equipped slot → bench it to the stash; if the stash is full, sell it instead so
   *     the tap is never a dead no-op (with a toast telling the player which happened)
   */
  private handleEquipmentStripTap(mx: number, my: number): boolean {
    if (!this.player) return false;
    const stash = this.playerStats.getStash();

    // 1. Stash sell ✕ badges (drawn on top → tested first).
    for (const r of this.stashSellRects) {
      if (pointInRect(mx, my, r)) {
        const item = stash[r.index];
        if (item) {
          const refund = this.playerStats.getSellValue(item);
          this.playerStats.removeItem(item.id);
          this.player.gold += refund;
          this.syncMaxHealthAfterItemChange();
          this.updateMobileSkillButtons();
          this.audio.playPurchase();
          this.showShopToast(`Sold ${item.name} · +${refund}g`);
        }
        return true;
      }
    }

    // 2. Stash icons → equip.
    for (const r of this.stashItemRects) {
      if (pointInRect(mx, my, r)) {
        const item = stash[r.index];
        if (item && this.playerStats.equipFromStash(r.index)) {
          this.syncMaxHealthAfterItemChange();
          this.audio.playPurchase();
          this.showShopToast(`Equipped ${item.name}`);
        }
        return true;
      }
    }

    // 3. Equipped slots → OPEN the inspect popup (stats + Unequip/Sell buttons). The
    // actual bench/sell now happens from that popup's buttons, not on the slot tap, so
    // the player can read what a piece does before deciding.
    for (const r of this.equipSlotRects) {
      if (pointInRect(mx, my, r)) {
        const occupant = this.playerStats.getEquipment()[r.key];
        if (!occupant) return false; // empty slot — let the tap fall through (nothing to do)
        this.inspectedEquipKey = r.key;
        this.audio.playPurchase();
        return true;
      }
    }

    return false;
  }

  /** Modal input handler for the equipped-item inspect popup. Runs before every other
   *  shop interaction while a popup is open, so it owns all input: Unequip benches the
   *  piece to the stash (or sells if the stash is full), Sell converts it to gold, and a
   *  tap anywhere else closes the popup. Returns true if the tap was consumed. */
  private handleInspectPopupTap(mx: number, my: number): boolean {
    if (this.inspectedEquipKey === null || !this.player) return false;
    const key = this.inspectedEquipKey;
    const occupant = this.playerStats.getEquipment()[key];
    if (!occupant) { this.inspectedEquipKey = null; return true; }

    // Unequip → bench to stash (or sell if the stash is full, so it's never a dead tap).
    if (this.inspectUnequipRect && pointInRect(mx, my, this.inspectUnequipRect)) {
      if (this.playerStats.unequipToStash(key)) {
        this.showShopToast(`Benched ${occupant.name}`);
      } else {
        const refund = this.playerStats.getSellValue(occupant);
        this.playerStats.removeItem(occupant.id);
        this.player.gold += refund;
        this.showShopToast(`Stash full — sold ${occupant.name} · +${refund}g`);
      }
      this.syncMaxHealthAfterItemChange();
      this.updateMobileSkillButtons();
      this.audio.playPurchase();
      this.inspectedEquipKey = null;
      return true;
    }

    // Sell → straight to gold at the sell value.
    if (this.inspectSellRect && pointInRect(mx, my, this.inspectSellRect)) {
      const refund = this.playerStats.getSellValue(occupant);
      this.playerStats.removeItem(occupant.id);
      this.player.gold += refund;
      this.syncMaxHealthAfterItemChange();
      this.updateMobileSkillButtons();
      this.audio.playPurchase();
      this.showShopToast(`Sold ${occupant.name} · +${refund}g`);
      this.inspectedEquipKey = null;
      return true;
    }

    // Tap anywhere else (including the panel body) closes the popup.
    this.inspectedEquipKey = null;
    return true;
  }

  /** Flash a one-line toast in the shop (equip/bench/sell feedback). */
  private showShopToast(text: string): void {
    this.shopToastText = text;
    this.shopToastAt = Date.now();
  }

  /** Recompute maxHealth after an item leaves/enters the active set, clamping current HP.
   *  Mirrors the sell path so a +maxHP item removed can't leave HP above the cap. */
  private syncMaxHealthAfterItemChange(): void {
    if (!this.player) return;
    this.player.maxHealth = this.playerStats.getMaxHealth();
    if (this.player.health > this.player.maxHealth) {
      this.player.health = this.player.maxHealth;
    }
  }

  private drawShop(): void {
    const { s, isMobile, cols, itemWidth, itemHeight, gap, startX, startY, lockButtonSize,
      buttonWidth, buttonHeight, continueY, rerollY,
      splitButtonWidth, rerollX, autoBuyX,
      nameSize, descSize, costSize,
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

    // SKILLS button (top-center) — spend banked skill points. Lights up when points wait.
    {
      const btn = this.getSkillsButtonRect();
      const pts = this.skillTree.availablePoints;
      ctx.save();
      ctx.fillStyle = pts > 0 ? '#153d20' : '#2e1c0e';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeStyle = pts > 0 ? '#69db7c' : '#c8a15a';
      ctx.lineWidth = 2;
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
      ctx.restore();
      const label = pts > 0 ? `SKILLS +${pts}` : 'SKILLS';
      this.renderer.drawText(label, btn.x + btn.width / 2, btn.y + Math.round(btn.height * 0.28), {
        size: s(8),
        align: 'center',
        color: pts > 0 ? '#a8e063' : '#e5d9c3'
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

    // EQUIPMENT STRIP — the 4 slots (Wpn A / Wpn B / Off / Amulet) as labelled boxes,
    // so gear reads as a limited loadout, not a stat-pile. Sits just under the stats
    // panel on both layouts. Tap-to-manage (equip/bench/sell) wired in Phase 2.
    this.drawEquipmentStrip(ctx, s, isMobile, statPanelX, statPanelY + statPanelHeight + s(6), statPanelWidth);

    // SHOP TOAST — transient equip/bench/sell feedback, centred under the gold total.
    if (this.shopToastText) {
      const age = Date.now() - this.shopToastAt;
      if (age < Game.SHOP_TOAST_MS) {
        const fade = Math.min(1, (Game.SHOP_TOAST_MS - age) / 400); // fade over last 0.4s
        ctx.save();
        ctx.globalAlpha = fade;
        const ty = s(isMobile ? 44 : 66);
        this.renderer.drawText(this.shopToastText, this.canvas.width / 2, ty, {
          size: s(isMobile ? 7 : 9), color: '#ffe08a', align: 'center'
        });
        ctx.restore();
      } else {
        this.shopToastText = '';
      }
    }

    // INVENTORY PANEL - show current items as tiny icons on the right side (desktop) or below stats (mobile)
    const invPanelPadding = s(6);
    const invPanelWidth = s(220);
    const invPanelMaxHeight = s(200);
    const invPanelX = this.canvas.width - s(230);
    const invPanelY = s(56);

    // Inventory panel is desktop-only; portrait screens have no room for it. It now
    // lists TRINKETS (the unlimited-stacking pile) — equipped gear shows in the strip.
    if (!isMobile && this.playerStats.trinkets.length > 0) {
      // Group trinkets by ID and count duplicates
      const itemCounts = new Map<string, { item: Item; count: number }>();
      for (const item of this.playerStats.trinkets) {
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
      this.renderer.drawText('TRINKETS', invPanelX + invPanelWidth / 2, invPanelY + s(8), {
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
      // Weapon evolution hint: if this item completes an evolution pair (base+catalyst),
      // surface the evo name so the player doesn't need to read the COMBOS guide.
      const evoInfo = this.getCardEvolutionInfo(item);

      // Card: wood panel with a crisp rarity/synergy-colored inner border
      // (pixel-art treatment — no glows, no gradients)
      drawPanel(ctx, x, y, itemWidth, itemHeight, DARK_WOOD_THEME, 4, i);
      let borderColor = rarityColor;
      if (completesDuo) borderColor = '#ffd43b';
      else if (evoInfo) borderColor = '#ff9f43';
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

      // ─── Card content: IMAGE LEFT, structured text block RIGHT ───────────────
      // Reworked from the old centred/vertical stack (Felix: "place image to the
      // left, description, category and tags organized nicely; make it clear if an
      // item is a trinket or for a specific slot"). One horizontal row: a framed
      // icon panel on the left, then a left-aligned text column — name, a prominent
      // SLOT/TRINKET badge, the description, and a category+tags footer — with the
      // price pinned bottom-right. All geometry derives from the card box so it
      // reads identically across portrait / mobile-landscape / desktop.
      const cardInset = s(8);            // clears the inner rarity border (drawn at +6)
      const pad = s(isMobile ? 6 : 8);
      const contentTop = y + cardInset;
      const contentBottom = y + itemHeight - cardInset;
      const contentH = contentBottom - contentTop;

      // Left icon panel — a framed square filling most of the card height.
      const iconBox = Math.min(Math.round(contentH * 0.94), Math.round(itemWidth * 0.34));
      const iconLeft = x + cardInset;
      const iconCX = iconLeft + iconBox / 2;
      const iconCY = y + itemHeight / 2;
      const iconTop = iconCY - iconBox / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(iconLeft, iconTop, iconBox, iconBox);
      ctx.strokeStyle = rarityColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.strokeRect(iconLeft, iconTop, iconBox, iconBox);
      ctx.restore();
      const spriteSize = Math.round(iconBox * 0.74);
      this.renderer.drawItemIcon(item.icon, iconCX, iconCY - spriteSize / 2, spriteSize, 'center');

      // Text column bounds (right of the icon, clear of the top-right lock button).
      const textX = iconLeft + iconBox + pad;
      const textRight = x + itemWidth - cardInset;
      const textW = Math.max(s(30), textRight - textX);
      const lockLeft = x + itemWidth - lockButtonSize - s(4);
      const nameMaxW = Math.max(s(30), lockLeft - textX - s(4));

      // Small pixel "pill": filled chip with a border + centred label. Returns its
      // width so a row of chips can be laid out left-to-right.
      const drawPill = (px: number, py: number, label: string, fs: number,
        textColor: string, bgColor: string, borderColor: string): number => {
        const w = Math.round(label.length * fs) + s(9);
        const h = fs + s(6);
        ctx.save();
        ctx.fillStyle = bgColor;
        ctx.fillRect(px, py, w, h);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, w, h);
        ctx.restore();
        this.renderer.drawText(label, px + w / 2, py + s(3), {
          size: fs, align: 'center', color: textColor, stroke: false,
        });
        return w;
      };

      let ty = contentTop;

      // Row 1 — item name (left-aligned, rarity-coloured).
      const nameS = nameSize;
      this.renderer.drawText(item.name, textX, ty, {
        size: nameS, align: 'left', color: rarityColor, maxWidth: nameMaxW,
      });
      ty += nameS + s(5);

      // Row 2 — SLOT / TRINKET badge (the "what is this" answer Felix asked for),
      // colour-coded: equipment slots teal, trinkets violet. A completed/looming
      // combo tag rides the right end of the same row.
      const SLOT_LABELS: Record<string, string> = {
        'weapon-1h': 'WEAPON', 'weapon-2h': '2H WEAPON', 'offhand': 'OFF-HAND',
        'head': 'HEAD', 'amulet': 'AMULET', 'torso': 'TORSO', 'legs': 'LEGS',
        'feet': 'FEET', 'ring': 'RING', 'trinket': 'TRINKET',
      };
      const slot = classifyItemSlot(item);
      const isTrinket = slot === 'trinket';
      const badgeS = synergySize;
      const badgeLabel = SLOT_LABELS[slot] ?? slot.toUpperCase();
      const badgeW = drawPill(
        textX, ty, badgeLabel, badgeS,
        isTrinket ? '#f3e8ff' : '#e6fff7',
        isTrinket ? '#4a2d6b' : '#12463a',
        isTrinket ? '#c084fc' : '#4ec9b0',
      );

      // Synergy / combo indicator — NAME the combo so it's legible, right-aligned on
      // the badge row. Priority: completes a duo > evolution pair > teaches a pairing > tag fit.
      if (completesDuo || evoInfo || duoInfo || hasTagMatch || hasSynergy) {
        let indicatorText = '';
        let indicatorColor = '#7bd94a';
        if (completesDuo && duoInfo) { indicatorText = duoInfo.name.toUpperCase(); indicatorColor = '#ffd43b'; }
        else if (evoInfo) { indicatorText = `EVO: ${evoInfo.name.toUpperCase()}`; indicatorColor = '#ff9f43'; }
        else if (duoInfo) { indicatorText = `+ ${duoInfo.partner}`; indicatorColor = '#74c0fc'; }
        else if (hasTagMatch) { indicatorText = `${matchingTags.map(t => t.toUpperCase()).join('/')} FIT`; indicatorColor = '#7bd94a'; }
        else if (hasSynergy) { indicatorText = 'GOOD FIT'; indicatorColor = '#7bd94a'; }
        if (indicatorText) {
          this.renderer.drawText(indicatorText, textRight, ty + s(1), {
            size: badgeS, align: 'right', color: indicatorColor,
            maxWidth: Math.max(s(20), textW - badgeW - s(6)),
          });
        }
      }
      ty += badgeS + s(6) + s(5);

      // Row 3 — concrete stat lines ("+15% Damage · +2 Armor"), the at-a-glance
      // numbers Felix asked the card contents to surface. Green, compact, joined with
      // middots and clipped to one line (the full breakdown lives in the description +
      // the equipped-item inspect popup). Skipped when the item has no numeric stats
      // (pure-mechanic pieces) so the row never renders empty.
      const statS = Math.max(s(6), Math.round(descSize * 0.9));
      const segs = itemStatSegments(item);
      const stats = segs.map(sg => sg.text);
      if (segs.length > 0) {
        // Draw each segment individually so drawbacks (a stat below identity) read
        // RED while bonuses stay green — the at-a-glance "this power has a cost" cue.
        // Press-Start-2P advances ~1em/glyph (Renderer's own convention), so we
        // uniform-shrink the font to fit textW and lay segments out by char count.
        const sep = '  ·  ';
        const totalChars = segs.reduce((n, sg) => n + sg.text.length, 0) + sep.length * Math.max(0, segs.length - 1);
        // Press Start 2P advances ~1em (font-px) per glyph, so total line width ≈ totalChars * effS.
        // Shrink to fit textW — no hard lower floor, or dense 4-stat drawback items would overflow
        // the card edge. Normal 2-3 stat items still land at statS (floor(textW/chars) > statS).
        const effS = Math.min(statS, Math.max(1, Math.floor(textW / Math.max(1, totalChars))));
        let sx = textX;
        for (let i = 0; i < segs.length; i++) {
          if (i > 0) {
            this.renderer.drawText(sep, sx, ty, { size: effS, align: 'left', color: '#6b6250' });
            sx += sep.length * effS;
          }
          this.renderer.drawText(segs[i].text, sx, ty, {
            size: effS, align: 'left', color: segs[i].neg ? '#ff6b6b' : '#8ce99a',
          });
          sx += segs[i].text.length * effS;
        }
        ty += statS + s(5);
      }

      // Footer line — category (weapon/passive/active) + synergy tags, left; price,
      // right. Reserve its band first so the description fills only the space above.
      const kindColors: Record<string, string> = { weapon: '#f0637a', passive: '#6aa9ff', active: '#ffc14d' };
      const kinds = getItemKinds(item);
      const footerS = Math.max(s(6), Math.round(descSize * 0.82));
      const footerY = contentBottom - footerS;

      // Row 4 — description, wrapped, left-aligned. Swaps to the combo payoff when
      // buying would complete a duo, so the card tells you WHAT fires at decision time.
      // Skipped entirely when the description just restates the green stat row above
      // (30 catalog items) — the duo payoff always shows, since it adds real info.
      const descTop = ty;
      const descBottomLimit = footerY - s(4);
      const descLineH = descSize + Math.max(2, Math.round(descSize * 0.35));
      const descMaxLines = Math.max(1, Math.floor((descBottomLimit - descTop) / descLineH));
      const cardShowDesc = (completesDuo && duoInfo) || !descRestatesStats(item.description, stats);
      if (cardShowDesc) {
        this.renderer.drawWrappedText(
          completesDuo && duoInfo ? duoInfo.effect : item.description,
          textX, descTop,
          {
            size: descSize, align: 'left',
            color: completesDuo && duoInfo ? '#ffe066' : '#e5d9c3',
            maxWidth: textW, maxLines: descMaxLines,
          }
        );
      }

      // Price — bottom-right, prominent. Elite-cascade items are free (shown in green).
      const isCascade = (item as any)._cascade === true;
      const finalPrice = isCascade ? 0 : this.playerStats.getItemPrice(item, this.waveManager.currentWave);
      const canAfford = isCascade || this.player.gold >= finalPrice;
      const priceLabel = isCascade ? 'FREE!' : `${finalPrice} G`;
      const priceW = Math.round(priceLabel.length * costSize) + s(4);
      this.renderer.drawText(priceLabel, textRight, footerY - s(1), {
        size: costSize, align: 'right',
        color: isCascade ? '#69db7c' : (canAfford ? '#ffd700' : '#ef4444'),
      });

      // Category + tags footer, left — muted so the badge stays the loud label.
      const catLabel = kinds.map(k => k.toUpperCase()).join('/');
      const footerText = item.tags.length ? `${catLabel}  ·  ${item.tags.join(' ')}` : catLabel;
      this.renderer.drawText(footerText, textX, footerY, {
        size: footerS, align: 'left',
        color: kinds.length === 1 ? kindColors[kinds[0]] : '#b7a888',
        maxWidth: Math.max(s(20), textRight - priceW - s(6) - textX),
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
    // Equipped-item inspect popup draws last so its card + buttons sit above the strip.
    if (this.inspectedEquipKey !== null) this.drawInspectPopup();
  }

  // Compact inspect card for the currently-tapped equipped item: framed panel with the
  // piece's icon, name (rarity-coloured), slot label + upgrade level, its stat lines
  // (via itemStatLines), the hand-written description, and Unequip / Sell buttons. Modal
  // dimming behind it; a tap anywhere off the buttons closes it (handled in updateShop).
  private drawInspectPopup(): void {
    const key = this.inspectedEquipKey;
    if (key === null) { this.inspectUnequipRect = this.inspectSellRect = null; return; }
    const item = this.playerStats.getEquipment()[key];
    if (!item) { this.inspectedEquipKey = null; return; }

    const ctx = this.renderer.getContext();
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;

    const rarityColor: Record<string, string> = {
      common: '#c8c8c8', rare: '#74c0fc', epic: '#b06bd9', legendary: '#f2b04e',
    };
    const nameCol = rarityColor[item.rarity] ?? '#ffffff';
    const level = item.upgradeLevel ?? 1;
    // Show the FULL stacked value for an upgraded piece (+N) — the chips scale by level
    // exactly as PlayerStats folds them, so "+5" reads its real 6× contribution.
    const segs = itemStatSegments(item, level);
    const stats = segs.map(sg => sg.text);

    // Panel geometry: centred card, width bounded for phone. Height grows with the
    // number of stat lines + wrapped description lines.
    const pad = s(10);
    const panelW = Math.min(W - s(24), s(isMobile ? 300 : 360));
    const bodySize = s(isMobile ? 8 : 9);
    // Match Renderer.drawWrappedText's internal line height so measured rows and drawn
    // rows agree (size + ~35% leading, min 2px).
    const lineH = bodySize + Math.max(2, Math.round(bodySize * 0.35));
    const headSize = s(isMobile ? 11 : 13);
    const iconBox = s(isMobile ? 34 : 40);

    // Estimate the description wrap to size the panel. Press-Start-2P advances ~1em per
    // glyph, so chars-per-line ≈ boxWidth / fontSize; cap the block at 4 lines (the
    // draw call also hard-caps via maxLines, shrinking the font if it still overflows).
    const textW = panelW - pad * 2;
    const charsPerLine = Math.max(8, Math.floor(textW / bodySize));
    const estLines = Math.ceil(item.description.length / charsPerLine);
    // Drop the description block entirely when it just restates the stat rows above
    // (same redundancy the shop card skips) so the panel doesn't reserve empty space.
    // Test against BASE stats (level 1): a description restating the per-copy numbers
    // stays suppressed even when the chips above show the scaled +N total — the green
    // scaled chips are the single source of truth, no base-vs-stacked number clash.
    const descRedundant = descRestatesStats(item.description, itemStatSegments(item).map(sg => sg.text));
    const descLineCount = descRedundant ? 0 : Math.min(4, Math.max(1, estLines));

    const headerH = Math.max(iconBox, headSize + lineH); // icon row height
    const statsH = stats.length > 0 ? (stats.length * lineH + s(4)) : 0;
    const descH = descLineCount > 0 ? descLineCount * lineH + s(4) : 0;
    const btnH = s(isMobile ? 26 : 30);
    const panelH = pad + headerH + s(6) + statsH + descH + s(8) + btnH + pad;

    const px = (W - panelW) / 2;
    const py = Math.max(s(12), (H - panelH) / 2);

    // Modal dim behind, then the framed card.
    ctx.save();
    ctx.fillStyle = 'rgba(8,5,2,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawPanel(ctx, px, py, panelW, panelH, DARK_WOOD_THEME, 41, 88);

    // Header: icon left, name + slot/level right.
    const contentX = px + pad;
    let cy = py + pad;
    ctx.save();
    ctx.fillStyle = '#241a0c';
    ctx.fillRect(contentX, cy, iconBox, iconBox);
    ctx.strokeStyle = nameCol;
    ctx.lineWidth = 2;
    ctx.strokeRect(contentX, cy, iconBox, iconBox);
    ctx.restore();
    this.renderer.drawItemIcon(item.icon, contentX + iconBox / 2, cy + iconBox / 2 - s(6), s(isMobile ? 18 : 22));

    const headTextX = contentX + iconBox + pad;
    this.renderer.drawText(item.name, headTextX, cy + s(2), {
      size: headSize, align: 'left', color: nameCol, maxWidth: panelW - (headTextX - px) - pad,
    });
    const slotStr = level > 1 ? `${slotLabel(item)}  ·  +${level - 1}` : slotLabel(item);
    this.renderer.drawText(slotStr, headTextX, cy + headSize + s(6), {
      size: bodySize, align: 'left', color: '#c9b98f',
    });
    cy += headerH + s(6);

    // Stat lines (two-up on wide panels to stay compact; single column on mobile).
    // Drawbacks (a stat below its identity value) render RED so a build-locking
    // downside reads instantly as a cost, not another green bonus.
    if (segs.length > 0) {
      const statCols = isMobile ? 1 : 2;
      const colW = textW / statCols;
      for (let i = 0; i < segs.length; i++) {
        const col = i % statCols;
        const rowY = cy + Math.floor(i / statCols) * lineH;
        this.renderer.drawText(segs[i].text, contentX + col * colW, rowY, {
          size: bodySize, align: 'left', color: segs[i].neg ? '#ff6b6b' : '#8ce99a',
        });
      }
      cy += Math.ceil(segs.length / statCols) * lineH + s(4);
    }

    // Description (wrapped, capped) — omitted when it merely restates the stat rows.
    if (descLineCount > 0) {
      this.renderer.drawWrappedText(item.description, contentX, cy, {
        maxWidth: textW, size: bodySize, align: 'left', color: '#c8b998', maxLines: descLineCount,
      });
      cy += descLineCount * lineH + s(8);
    } else {
      cy += s(8);
    }

    // Buttons: Unequip (bench) left, Sell right. Sell shows the refund value.
    const refund = this.playerStats.getSellValue(item);
    const btnGap = s(8);
    const btnW = (textW - btnGap) / 2;
    const unX = contentX;
    const sellX = contentX + btnW + btnGap;
    const btnY = py + panelH - pad - btnH;

    const drawBtn = (bx: number, label: string, face: string, border: string, textCol: string) => {
      ctx.save();
      ctx.fillStyle = face;
      ctx.fillRect(bx, btnY, btnW, btnH);
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, btnY, btnW, btnH);
      ctx.restore();
      this.renderer.drawText(label, bx + btnW / 2, btnY + btnH / 2 - bodySize / 2, {
        size: bodySize, align: 'center', color: textCol,
      });
    };
    drawBtn(unX, 'UNEQUIP', '#2c3a4a', '#5a86b0', '#d6ecff');
    drawBtn(sellX, `SELL +${refund}g`, '#4a2a18', '#c8894c', '#ffe0c8');

    this.inspectUnequipRect = { x: unX, y: btnY, width: btnW, height: btnH };
    this.inspectSellRect = { x: sellX, y: btnY, width: btnW, height: btnH };
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

    // Stats panel — taller to fit Bosses stat + personal best
    const panelWidth = isMobile ? Math.min(380, this.canvas.width - 40) : 500;
    const panelHeight = isMobile ? 460 : 390;
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

    // Stats
    const statsY = panelY + 50;
    const lineSpacing = isMobile ? 42 : 36;
    const statSize = isMobile ? 24 : 22;

    // Wave — with personal best comparison
    const { wavesReached, personalBest } = this.gameOverStats;
    const isNewBest = wavesReached > personalBest;
    const waveText = isNewBest
      ? `Wave: ${wavesReached}  ★ NEW BEST!`
      : `Wave: ${wavesReached}${personalBest > 0 ? `  (Best: ${personalBest})` : ''}`;
    this.renderer.drawText(waveText, this.canvas.width / 2, statsY, {
      size: statSize,
      bold: true,
      align: 'center',
      color: isNewBest ? '#fbbf24' : '#4a9eff'
    });

    this.renderer.drawText(`Kills: ${this.gameOverStats.enemiesKilled}`, this.canvas.width / 2, statsY + lineSpacing, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ef4444'
    });

    // Bosses defeated — was tracked but never shown; bossKills bug also fixed this session
    this.renderer.drawText(`Bosses: ${this.gameOverStats.bossesDefeated}`, this.canvas.width / 2, statsY + lineSpacing * 2, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#f97316'
    });

    this.renderer.drawText(`Gold: ${this.gameOverStats.goldEarned}`, this.canvas.width / 2, statsY + lineSpacing * 3, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    this.renderer.drawText(`Items: ${this.gameOverStats.itemsCollected}`, this.canvas.width / 2, statsY + lineSpacing * 4, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#a855f7'
    });

    // Souls earned (highlighted prominently)
    const soulsY = statsY + lineSpacing * 5 + 20;
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

    // Newly-earned achievements this run — a gold "unlocked" line so a milestone reward is
    // visible the moment it's earned (the gear is already live for the next run).
    if (this.newAchievementsThisRun.length > 0) {
      const unlockY = soulsY + (isMobile ? 44 : 40);
      const first = this.newAchievementsThisRun[0];
      const extra = this.newAchievementsThisRun.length - 1;
      const label = extra > 0
        ? `★ UNLOCKED: ${first.name} +${extra} more`
        : `★ UNLOCKED: ${first.name}`;
      this.renderer.drawText(label, this.canvas.width / 2, unlockY, {
        size: isMobile ? 18 : 20,
        bold: true,
        align: 'center',
        color: '#fbbf24'
      });
    }

    // Buttons
    const buttonWidth = isMobile ? Math.min(300, this.canvas.width - 60) : 260;
    const buttonHeight = isMobile ? 70 : 60;
    const spacing = 18;
    const hasNewAch = this.newAchievementsThisRun.length > 0;
    // On desktop, shift all buttons up one slot to make room for "View Achievements".
    const extraSlot = (!isMobile && hasNewAch) ? buttonHeight + spacing : 0;
    const startY = this.canvas.height - (isMobile ? 240 : 220) - extraSlot;
    const bx = this.canvas.width / 2 - buttonWidth / 2;

    this.renderer.drawButton(bx, startY, buttonWidth, buttonHeight, 'Try Again', false, true, isMobile);
    this.renderer.drawButton(bx, startY + (buttonHeight + spacing), buttonWidth, buttonHeight, 'View Upgrades', false, true, isMobile);
    this.renderer.drawButton(bx, startY + (buttonHeight + spacing) * 2, buttonWidth, buttonHeight, 'Main Menu', false, true, isMobile);

    // Desktop only: "View Achievements" button when a new achievement was earned this run.
    if (!isMobile && hasNewAch) {
      this.renderer.drawButton(bx, startY + (buttonHeight + spacing) * 3, buttonWidth, buttonHeight, '🏆 View Achievements', false, true, isMobile);
    }
  }
}
