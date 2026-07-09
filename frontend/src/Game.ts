// Main game state machine

import { Player } from './Player';
import { Enemy } from './Enemy';
import { rollOnHitProcs } from './StatusEffectEngine';
import { Projectile } from './Projectile';
import { MeleeAttack } from './MeleeAttack';
import { Particle, DamageNumber } from './Particle';
import { WaveManager } from './WaveManager';
import { PlayerStats, ItemDatabase, ItemTier, classifyItemSlot, type Item } from './ItemSystem';
import { STARTING_CLASSES, getClassById, type StartingClass } from './Classes';
import { SaveManager } from './SaveManager';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { pointInRect, segmentCircleHit } from './utils';
import { HealthOrb, XPOrb, CoinPickup, mergeOrbs } from './Pickup';
import { OrbitingOrb, Bomb, Shockwave } from './Weapons';
import { AoeZone } from './AoeZone';
import { SpawnTelegraph } from './SpawnTelegraph';
import { MetaProgression } from './MetaProgression';
import { AchievementSystem, type Achievement, type RunStats } from './AchievementSystem';
import { ObjectPool } from './ObjectPool';
import { Quadtree } from './Quadtree';
import { PerformanceMonitor } from './PerformanceMonitor';
import { QualityManager } from './QualityManager';
import { EntityCuller } from './EntityCuller';
import { PathfindingSystem } from './PathfindingSystem';
import { ScreenEffects } from './ScreenEffects';
import { ParticleBatchRenderer } from './ParticleBatchRenderer';
import { MapSystem, serializeMap, deserializeMap } from './MapSystem';
import { ArtifactSystem, ARTIFACTS, ROLLABLE_ARTIFACTS, getArtifactById, type Artifact } from './ArtifactSystem';
import { EVENTS, type EventEffect, type EventOption, type EventRequirement } from './EventSystem';
import { EventScene, type EventReward } from './EventScene';
import { RestScene } from './RestScene';
import { EvolutionSystem, type Evolution } from './EvolutionSystem';
import { VillageScene } from './VillageScene';
import { MapScene } from './MapScene';
import { SkillTree, SKILL_NODES, SKILL_EDGES, neighborsOf } from './SkillTree';
import { executeSkill } from './ActiveSkillSystem';
import type { Scene } from './scenes/Scene';
import { MenuScene } from './scenes/MenuScene';
import { ShopScene } from './ShopScene';
import { GameOverScene, type GameOverStats } from './GameOverScene';
import { AchievementsScene } from './AchievementsScene';
import { ClassSelectScene } from './ClassSelectScene';
import { RewardScene } from './RewardScene';
import { SkillTreeScene } from './SkillTreeScene';
import { PauseScene } from './PauseScene';
import { HUDRenderer } from './HUDRenderer';
import { PlayingRenderer } from './PlayingRenderer';

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
  /** Typed reference so purchaseShopItem() can call shopScene.showToast(). */
  private shopScene: ShopScene | null = null;
  /** Typed reference so openSkillTree() can call skillTreeScene.open(). */
  private skillTreeScene: SkillTreeScene | null = null;
  /** HUD render/DOM layer — extracted from Game.ts (step 13). */
  private hudRenderer!: HUDRenderer;
  private playingRenderer!: PlayingRenderer;
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
  shopRerollCost: number = 2;
  shopRerolls: number = 0;
  lockedShopItems: Set<number> = new Set(); // FREE locking (no 5g cost)
  itemsPurchasedThisWave: number = 0; // Track for free reroll bonus
  lastInterestGained: number = 0; // Gold earned from banking interest this shop (for display)

  // ---- MAP / NODE META-LAYER state ----
  rewardChoices: Artifact[] = [];            // the 1-of-3 artifact offer
  rewardTitle: string = '';                  // header for the reward screen
  rewardSkippable: boolean = false;          // show a Skip button (elite/treasure/boss)
  private rewardThen: (() => void) | null = null; // what to do once an artifact is picked
  // ---- SKILL TREE state (replaces the old level-up item pick, Felix 2026-07-05) ----
  // Each level-up grants 1 skill point banked on the tree; points are spent on the
  // between-waves skill-tree screen (never mid-wave). SkillTreeScene owns all
  // pan/zoom/pointer state; Game retains only the SkillTree instance (shared state).
  skillTree: SkillTree = new SkillTree();
  private pendingWaveArtifact: boolean = false;   // elite/boss wave grants spoils on clear
  private pendingEliteCascade: boolean = false;   // elite/boss wave grants a free bonus item in the shop
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

  // Game over details (type shared with GameOverScene via exported GameOverStats)
  gameOverStats: GameOverStats = {
    wavesReached: 0,
    enemiesKilled: 0,
    bossesDefeated: 0,
    goldEarned: 0,
    itemsCollected: 0,
    soulsEarned: 0,
    personalBest: 0,
    className: '',
    runDurationMs: 0
  };

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
      meetsRequirement: (req) => this.meetsEventRequirement(req),
    });
    this.scenes.rest = new RestScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      onChoose: (choice) => this.applyRestChoice(choice),
      onDone: () => { this.state = 'map'; },
    });

    // Step 7: GameOverScene.
    this.scenes.gameover = new GameOverScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      getStats: () => this.gameOverStats,
      getNewAchievements: () => this.newAchievementsThisRun,
      onRetry: () => this.openClassSelect(),
      onViewUpgrades: () => this.enterVillage(),
      onMenu: () => { this.state = 'menu'; },
      onViewAchievements: () => { this.state = 'achievements'; },
    });
    this.scenes.achievements = new AchievementsScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      onBack: () => { this.state = 'menu'; },
    });
    this.scenes.classselect = new ClassSelectScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      onSelectClass: (cls) => this.beginRun(cls),
    });

    // Step 6: ShopScene.
    this.shopScene = new ShopScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      audio: this.audio,
      getPlayer: () => this.player,
      getPlayerStats: () => this.playerStats,
      getSkillTree: () => this.skillTree,
      getWave: () => this.waveManager.currentWave,
      getEvolutions: () => this.evolutionSystem.getAllEvolutions(),
      getShopItems: () => this.shopItems,
      getLockedItems: () => this.lockedShopItems,
      getLastInterestGained: () => this.lastInterestGained,
      getShopRerollCost: () => this.shopRerollCost,
      onPurchase: (i) => this.purchaseShopItem(i),
      onReroll: () => this.rerollShop(),
      onContinue: () => this.toMapFromShop(),
      onOpenSkillTree: () => this.openSkillTree(true),
      onSyncMaxHealth: () => this.syncMaxHealthAfterItemChange(),
      onUpdateMobileSkills: () => this.hudRenderer.updateMobileSkillButtons(),
    });
    this.scenes.shop = this.shopScene;
    (window as unknown as { __shopScene: ShopScene }).__shopScene = this.shopScene;

    // Step 10: RewardScene.
    this.scenes.reward = new RewardScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      getRewardChoices: () => this.rewardChoices,
      getRewardTitle: () => this.rewardTitle,
      isRewardSkippable: () => this.rewardSkippable,
      onSelectArtifact: (artifact: Artifact) => {
        this.grantArtifact(artifact);
        const then = this.rewardThen;
        this.rewardChoices = [];
        this.rewardThen = null;
        this.rewardSkippable = false;
        if (then) then();
      },
      onSkip: () => {
        const then = this.rewardThen;
        this.rewardChoices = [];
        this.rewardThen = null;
        this.rewardSkippable = false;
        if (then) then();
      },
    });

    this.skillTreeScene = new SkillTreeScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      getSkillTree: () => this.skillTree,
      getPlayerStats: () => this.playerStats,
      onNodeAllocated: (armColor: string) => {
        this.refreshMaxHealth();
        this.audio.playLevelUp();
        this.screenEffects.flash(armColor, 0.16);
      },
      onFinish: (returnToShop: boolean) => {
        this.state = returnToShop ? 'shop' : 'playing';
      },
    });
    this.scenes.skilltree = this.skillTreeScene;

    this.scenes.paused = new PauseScene({
      canvas: this.canvas,
      renderer: this.renderer,
      input: this.input,
      audio: this.audio,
      drawPlayingUnderlay: () => this.playingRenderer.draw(),
      getCurrentWave: () => this.waveManager.currentWave,
      getBossKills: () => this.bossKills,
      onResume: () => { this.state = 'playing'; },
      onEndRun: () => { this.gameOver(); },
      onRestartRun: () => { this.openClassSelect(); },
      onMainMenu: () => { this.state = 'menu'; SaveManager.clearRun(); },
    });

    this.hudRenderer = new HUDRenderer({
      canvas: this.canvas,
      renderer: this.renderer,
      getPlayer: () => this.player,
      getPlayerStats: () => this.playerStats,
      getWaveManager: () => this.waveManager,
      getEnemies: () => this.enemies,
      getActiveSkillCooldownQ: () => this.activeSkillCooldown,
      getActiveSkillCooldownE: () => this.activeSkillCooldownE,
      getGearButtonRect: () => this.gearButtonRect(),
      getSafeAreaTop: (zoom) => this.safeAreaTop(zoom),
    });

    this.playingRenderer = new PlayingRenderer({
      canvas: this.canvas,
      renderer: this.renderer,
      entityCuller: this.entityCuller,
      particleBatchRenderer: this.particleBatchRenderer,
      performanceMonitor: this.performanceMonitor,
      qualityManager: this.qualityManager,
      screenEffects: this.screenEffects,
      input: this.input,
      hudRenderer: this.hudRenderer,
      waveManager: this.waveManager,
      enemyQuadtree: this.enemyQuadtree,
      WORLD_SCALE: this.WORLD_SCALE,
      getParticles: () => this.particles,
      getProjectiles: () => this.projectiles,
      getMeleeAttacks: () => this.meleeAttacks,
      getShockwaves: () => this.shockwaves,
      getBombs: () => this.bombs,
      getAoeZones: () => this.aoeZones,
      getSpawnTelegraphs: () => this.spawnTelegraphs,
      getEnemies: () => this.enemies,
      getHealthOrbs: () => this.healthOrbs,
      getXpOrbs: () => this.xpOrbs,
      getCoins: () => this.coins,
      getOrbitingOrbs: () => this.orbitingOrbs,
      getDamageNumbers: () => this.damageNumbers,
      getPlayer: () => this.player,
      getWaveModifierTimer: () => this.waveModifierTimer,
      getPhaseBannerTimer: () => this.phaseBannerTimer,
      getPhaseBannerText: () => this.phaseBannerText,
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

    this.refreshMaxHealth();
    this.pendingWaveArtifact = false;
    this.pendingEliteCascade = false;

    this.hudRenderer.updateMobileSkillButtons(); // reset to disabled at run start (no scrolls yet)
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

    this.updatePlayerTick(dt);

    this.updateWaveAndEnemySpawn(dt);

    this.updateEnemies(dt);

    this.rebuildQuadtrees();

    this.updateProjectileCollisions(dt);

    this.updateMeleeCollisions(dt);

    this.updatePickupsAndCleanup(dt);
  }

  /** Step 15g — per-enemy pathfinding, DoT ticking (legacy + StatusEffectEngine), DoT-kill routing,
   *  enemy.update() (movement/AI), shooting, AoE attacks, boss phases, wall/player contact.
   *  Phases 3 + 4 from the planning guide combined into one pass to avoid a second iteration
   *  over this.enemies. Player null guard mirrors updatePlaying() caller guard. */
  private updateEnemies(dt: number): void {
    if (!this.player) return;
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
  }

  /** Step 15f — homing steering, projectile.update(), player-projectile→enemy collision
   *  (crit, amps, execute, on-hit), and enemy-projectile→player collision.
   *  Player null guard mirrors updatePlaying() caller guard. */
  private updateProjectileCollisions(dt: number): void {
    if (!this.player) return;
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
  }

  /** Step 15e — melee attack updates + arc-overlap enemy collision (crit, amps, on-hit).
   *  Player null guard mirrors updatePlaying() caller guard; this always runs with a live player. */
  private updateMeleeCollisions(dt: number): void {
    if (!this.player) return;
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
  }

  /** Step 15d — player input, movement, regen, shooting (incl. multicast + overcharge),
   *  active skills, and dash. The gear-button guard stays in updatePlaying() because
   *  it does an early return from the caller; this method runs only after that guard. */
  private updatePlayerTick(dt: number): void {
    if (!this.player) return;
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
  }

  /** Step 15c — wave manager update + spawn telegraphs + phase banner tick. Factored
   *  out of updatePlaying() for readability. Player non-null guaranteed by caller guard. */
  private updateWaveAndEnemySpawn(dt: number): void {
    if (!this.player) return;
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
  }

  /** Step 15a — quadtree rebuild factored out of updatePlaying() for readability. */
  private rebuildQuadtrees(): void {
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
  }

  /** Step 15b — aux weapons, pickups (health orbs / XP / coins), entity cleanup,
   *  AoE zone resolution, wave/game-over checks, and autosave. Factored out of
   *  updatePlaying() for readability. Player-null guard mirrors updatePlaying()'s
   *  top-of-method guard; both code paths require a live player to make sense. */
  private updatePickupsAndCleanup(dt: number): void {
    if (!this.player) return;

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

  /** QA + shop-card helper: returns the evolution the given item participates in (as
   *  base weapon or catalyst) given the player's current loadout, or null if no hint
   *  applies. Exposed publicly so QA scripts can assert via window.__game; ShopScene
   *  delegates here so both surfaces stay in sync. */
  getCardEvolutionInfo(item: Item): { name: string } | null {
    const ownedIds = new Set(this.playerStats.items.map(i => i.id));
    for (const evo of this.evolutionSystem.getAllEvolutions()) {
      if (item.id === evo.catalystItemId && ownedIds.has(evo.baseWeaponId) && !ownedIds.has(evo.evolvedWeaponId)) {
        return { name: evo.name };
      }
      if (item.id === evo.baseWeaponId && ownedIds.has(evo.catalystItemId) && !ownedIds.has(evo.evolvedWeaponId)) {
        return { name: evo.name };
      }
    }
    return null;
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
   * Dispatch is delegated to executeSkill() in ActiveSkillSystem.ts (step 14 extraction).
   */
  private useActiveSkill(slot: 'q' | 'e' = 'q'): void {
    const cooldown = slot === 'q' ? this.activeSkillCooldown : this.activeSkillCooldownE;
    if (!this.player || cooldown > 0) return;
    const skillId = slot === 'q'
      ? this.playerStats.getEquippedSkillIdQ()
      : this.playerStats.getEquippedSkillId();
    if (!skillId) return;
    const player = this.player;
    executeSkill(skillId, slot, {
      enemies: this.enemies,
      player,
      playerStats: this.playerStats,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      pushPendingDmg: (x, y, r, dmg, delay, color) =>
        this.pendingDmg.push({ x, y, r, dmg, delay, color }),
      pushActiveDmgZone: (x, y, r, dmgPerSec, remaining, color) =>
        this.activeDmgZones.push({ x, y, r, dmgPerSec, remaining, color }),
      spawnAoeZone: (zone) => this.spawnAoeZone(zone),
      dealAuxDamage: (e, dmg, color) => this.dealAuxDamage(e, dmg, color),
      pushProjectile: (p) => this.projectiles.push(p),
      setCooldown: (s, v) => {
        if (s === 'q') this.activeSkillCooldown = v;
        else this.activeSkillCooldownE = v;
      },
    });
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
  /** Open the skill-tree screen.  fromShop=true → Continue returns to the shop. */
  private openSkillTree(fromShop: boolean): void {
    this.skillTreeScene!.open(fromShop);
    this.state = 'skilltree';
  }

  /** Exit the skill-tree, respecting whether it was opened from the post-wave shop break.
   *  When opened via enterShop() (fromShop=true), returning must land on 'shop' not
   *  'playing' — otherwise the wave-clear is lost and combat resumes mid-transition.
   *  Used by simulate-balance.mjs and qa-live-smoke.mjs to automate the skill-tree step. */
  finishSkillTree(): void {
    this.state = this.skillTreeScene?.isReturnToShop ? 'shop' : 'playing';
  }

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

    // Let ShopScene reset its UI state (selectedShopItem, combos/stats overlays, etc.).
    this.shopScene?.enter?.('shop');
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
    this.hudRenderer.updateMobileSkillButtons(); // skill scrolls change which active ability is on Q/E
    this.itemsPurchasedThisWave++;

    // Duplicate buy → upgraded an owned instance. Tell the player (e.g. "Amulet +2").
    if (upgraded) {
      this.shopScene?.showToast(`${item.name} +${upgradeLevel - 1}`);
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
        // RestScene.enter() resets resolved/result state + disarms input.
        this.scenes.rest?.enter?.(this.state);
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


  // ---- EVENT screen — moved to EventScene (step 4 of Game.ts de-god-classing) ----

  /** Apply a chosen event option's effects; return outcome text + optional reward card data.
   *  Returned to EventScene so the scene owns the screen state (resultText / reward).
   *  Devil-deal integrity: a pact's boon is PRICED by a permanent curse. If the player
   *  already bears that curse (a recurring devil event drawn again), the price is already
   *  paid — handing out the boon a second time for free would let a run farm boons and gut
   *  the "permanent price" risk axis. So an already-held-curse pact grants nothing. */
  /** Read the current value of a gate-able stat from PlayerStats (percentages as whole %). */
  private eventStatValue(stat: EventRequirement['stat']): number {
    const ps = this.playerStats;
    switch (stat) {
      case 'meleeDmgPct':  return (ps.getMeleeDamageMult() - 1) * 100;
      case 'rangedDmgPct': return (ps.getRangedDamageMult() - 1) * 100;
      case 'critPct':      return ps.getCritChance() * 100;
      case 'moveSpeedPct': return (ps.getSpeed() / ps.baseSpeed - 1) * 100;
      case 'armor':        return ps.getArmor();
      case 'maxHp':        return ps.getMaxHealth();
      case 'gold':         return this.player ? this.player.gold : 0;
    }
  }

  /** True when the player currently satisfies a gated event option's stat requirement. */
  private meetsEventRequirement(req: EventRequirement): boolean {
    return this.eventStatValue(req.stat) >= req.min;
  }

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

  // ---- REWARD screen — moved to RewardScene (step 10 of Game.ts de-god-classing) ----

  // ---- REST screen — moved to RestScene (step 5 of Game.ts de-god-classing) ----

  /**
   * Apply the chosen rest-node option and return the outcome text.
   * Called by RestScene.onChoose; Game owns player/stat mutation,
   * RestScene owns the screen state (resolved flag, result text).
   */
  private applyRestChoice(choice: 'rest' | 'train'): string {
    if (choice === 'rest') {
      if (this.player) {
        this.player.health = Math.min(this.player.maxHealth, this.player.health + Math.round(0.4 * this.player.maxHealth));
      }
      return 'You rest by the fire and recover your strength.';
    } else {
      this.playerStats.baseMaxHealth += 15;
      this.refreshMaxHealth();
      return 'You train through the night. You feel permanently hardier.';
    }
  }

  /** Public getter for the village scene (used by qa-village.mjs). */
  get villageScene(): VillageScene { return this.scenes.village as VillageScene; }

  /** Transition to the walkable village base. */
  enterVillage(): void {
    this.scenes.village?.enter?.(this.state);
    this.state = 'village';
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
      personalBest: previousBest,
      className: getClassById(this.selectedClassId)?.name ?? '',
      runDurationMs: this.runStartTime > 0 ? Date.now() - this.runStartTime : 0
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
        this.playingRenderer.draw();
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

  private syncMaxHealthAfterItemChange(): void {
    if (!this.player) return;
    this.player.maxHealth = this.playerStats.getMaxHealth();
    if (this.player.health > this.player.maxHealth) {
      this.player.health = this.player.maxHealth;
    }
  }

}
