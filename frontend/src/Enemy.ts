// Enemy entity with AI and different types

import { circleCollision } from './utils';
import { SpriteSheet } from './sprites';
import { tintSilhouette, drawDithered } from './pixel/sprite';
import { PathfindingSystem, type PathNode } from './PathfindingSystem';

export type EnemyType = 'slime' | 'goblin' | 'skeleton' | 'imp' | 'orc' | 'wraith' | 'necromancer' | 'troll' | 'banshee' | 'demon' | 'bat' | 'wizard' | 'mimic' | 'spider' | 'golem' | 'ghost' | 'mushroom' | 'gargoyle' | 'blob' | 'necroegg' | 'cyclops' | 'phantom' | 'druid' | 'construct' | 'swarm' | 'dasher' | 'evader' | 'orbiter' | 'spiraler' | 'spinner' | 'shielder' | 'exploder' | 'healer' | 'summoner' | 'phaser' | 'wormhead' | 'wormbody' | 'eggsac' | 'bombardier' | 'boss_necrolord' | 'boss_flamefiend' | 'boss_voidbeast' | 'boss_stormking' | 'boss_ancientgolem';

export interface EnemyTypeData {
  health: number;
  speed: number;
  damage: number;
  radius: number;
  color: string;
  xpValue: number;
  goldValue: number;
  shootRate?: number; // Shots per second (for ranged types)
  /** How this enemy's shots are emitted (default 'single' straight shot). */
  firePattern?: 'single' | 'ring' | 'homing' | 'spiral' | 'burst';
  spriteName: string;
  isBoss?: boolean; // Mark as boss enemy
}

// A telegraphed AoE the enemy wants Game to spawn this frame (red ground marker
// that detonates after `telegraph`s). Game turns this into an AoeZone at the
// given world position; enemies never touch the zone list directly.
export interface AoeAttackRequest {
  x: number;
  y: number;
  radius: number;
  damage: number;
  telegraph: number;
  shape?: 'circle' | 'ring';
  color?: string;
}

// The per-frame result of Enemy.update(): a bundle of "the game should do X" flags
// so all world-mutating side effects stay in Game, not the enemy.
export interface EnemyUpdateResult {
  shouldShoot: boolean;
  shouldTeleport?: boolean;
  shouldSummon?: boolean;
  shouldScream?: boolean;
  shouldStomp?: boolean;
  splitInto?: Enemy[];
  poisonTrail?: { x: number; y: number };
  sporeCloud?: { x: number; y: number };
  shouldHeal?: boolean;
  shouldSpawnMinion?: boolean;
  /** Telegraphed AoE(s) to spawn this frame. */
  aoeAttacks?: AoeAttackRequest[];
}

// Global multiplier on every enemy's base move speed. Early waves felt sluggish
// with the player buffed to 240; scaling all enemies uniformly keeps the relative
// kiting feel while making the whole game read faster. Per-type values below stay
// as the readable base; this is the single knob to tune overall pace.
export const ENEMY_SPEED_SCALE = 1.2;

export const ENEMY_TYPES: Record<EnemyType, EnemyTypeData> = {
  slime: {
    health: 60, // BALANCE: Reduced for faster Wave 1 kills (1-second TTK)
    speed: 60,
    damage: 8,
    radius: 14,
    color: '#4ade80',
    xpValue: 10, // BALANCE: Reduced to slow early leveling
    goldValue: 2, // BALANCE: Reduced by 6x for tight economy
    spriteName: 'slime'
  },
  goblin: {
    health: 60,
    speed: 100, // BALANCE: Reduced from 120 to be less punishing in Wave 1
    damage: 6,
    radius: 12,
    color: '#7cb342',
    xpValue: 10, // BALANCE: Reduced to slow early leveling
    goldValue: 2, // BALANCE: Reduced by 5x for tight economy
    shootRate: 0.4,
    spriteName: 'goblin'
  },
  skeleton: {
    health: 80,
    speed: 70,
    damage: 10,
    radius: 12,
    color: '#e0e0e0',
    xpValue: 12, // BALANCE: Reduced for progression
    goldValue: 3, // BALANCE: Reduced for economy
    shootRate: 0.8,
    spriteName: 'skeleton'
  },
  imp: {
    health: 70,
    speed: 90,
    damage: 12,
    radius: 11,
    color: '#8b0000',
    xpValue: 14, // +50% XP
    goldValue: 4, // +100% gold
    spriteName: 'imp'
  },
  orc: {
    health: 120,
    speed: 85,
    damage: 15,
    radius: 16,
    color: '#567d46',
    xpValue: 15, // +50% XP
    goldValue: 4, // +100% gold
    spriteName: 'orc'
  },
  wraith: {
    health: 90,
    speed: 80,
    damage: 10,
    radius: 13,
    color: '#9370db',
    xpValue: 19, // +50% XP (rounded)
    goldValue: 5, // +100% gold
    spriteName: 'wraith'
  },
  necromancer: {
    health: 100,
    speed: 60,
    damage: 8,
    radius: 12,
    color: '#2c2c54',
    xpValue: 23, // +50% XP
    goldValue: 6, // +100% gold
    shootRate: 0.5,
    spriteName: 'necromancer'
  },
  troll: {
    health: 200,
    speed: 55,
    damage: 18,
    radius: 18,
    color: '#4a7c59',
    xpValue: 27, // +50% XP (rounded)
    goldValue: 7, // +100% gold
    spriteName: 'troll'
  },
  banshee: {
    health: 75,
    speed: 85,
    damage: 12,
    radius: 13,
    color: '#e0e0e0',
    xpValue: 21, // +50% XP
    goldValue: 6, // +100% gold
    spriteName: 'banshee'
  },
  demon: {
    health: 500,
    speed: 90,
    damage: 20,
    radius: 20,
    color: '#8b0000',
    xpValue: 75, // +50% XP
    goldValue: 20, // +100% gold
    shootRate: 1.5,
    firePattern: 'burst',
    spriteName: 'demon'
  },
  bat: {
    health: 50,
    speed: 180,
    damage: 6,
    radius: 10,
    color: '#4a235a',
    xpValue: 10,
    goldValue: 2,
    spriteName: 'bat'
  },
  wizard: {
    health: 90,
    speed: 50,
    damage: 12,
    radius: 12,
    color: '#1f618d',
    xpValue: 15,
    goldValue: 4,
    shootRate: 0.6,
    firePattern: 'homing',
    spriteName: 'wizard'
  },
  mimic: {
    health: 120,
    speed: 0, // Disguised, speed changes when activated
    damage: 14,
    radius: 14,
    color: '#b8860b',
    xpValue: 18, // BALANCE: Reduced
    goldValue: 8, // BALANCE: 2x normal (4g base)
    spriteName: 'mimic'
  },
  spider: {
    health: 70,
    speed: 95,
    damage: 8,
    radius: 13,
    color: '#1c1c1c',
    xpValue: 13,
    goldValue: 3,
    spriteName: 'spider'
  },
  golem: {
    health: 250,
    speed: 35,
    damage: 16,
    radius: 22,
    color: '#78909c',
    xpValue: 30,
    goldValue: 10,
    spriteName: 'golem'
  },
  ghost: {
    health: 60,
    speed: 70,
    damage: 8,
    radius: 12,
    color: '#e0f7fa',
    xpValue: 10,
    goldValue: 3,
    spriteName: 'ghost'
  },
  mushroom: {
    health: 100,
    speed: 0, // Stationary
    damage: 10,
    radius: 14,
    color: '#8e44ad',
    xpValue: 13,
    goldValue: 3,
    spriteName: 'mushroom'
  },
  gargoyle: {
    health: 180,
    speed: 45,
    damage: 12,
    radius: 16,
    color: '#5d6d7e',
    xpValue: 18,
    goldValue: 5,
    spriteName: 'gargoyle'
  },
  blob: {
    health: 80,
    speed: 50,
    damage: 7,
    radius: 13,
    color: '#e74c3c',
    xpValue: 18,
    goldValue: 3,
    spriteName: 'blob'
  },
  necroegg: {
    health: 50,
    speed: 20,
    damage: 5,
    radius: 12,
    color: '#8b0000',
    xpValue: 15,
    goldValue: 5,
    spriteName: 'necroegg'
  },
  cyclops: {
    health: 150,
    speed: 40,
    damage: 15,
    radius: 18,
    color: '#d68910',
    xpValue: 14,
    goldValue: 4,
    spriteName: 'cyclops'
  },
  phantom: {
    health: 45,
    speed: 140,
    damage: 10,
    radius: 11,
    color: '#a569bd',
    xpValue: 11,
    goldValue: 3,
    spriteName: 'phantom'
  },
  druid: {
    health: 70,
    speed: 65,
    damage: 6,
    radius: 12,
    color: '#27ae60',
    xpValue: 12,
    goldValue: 4,
    spriteName: 'druid'
  },
  construct: {
    health: 130,
    speed: 55,
    damage: 11,
    radius: 15,
    color: '#95a5a6',
    xpValue: 13,
    goldValue: 4,
    shootRate: 0.35,
    firePattern: 'ring',
    spriteName: 'construct'
  },
  swarm: {
    health: 90, // Shared health pool
    speed: 150,
    damage: 6,
    radius: 8,
    color: '#f39c12',
    xpValue: 10,
    goldValue: 3,
    spriteName: 'swarm'
  },
  dasher: {
    health: 85,
    speed: 110,
    damage: 14,
    radius: 13,
    color: '#e74c3c',
    xpValue: 14,
    goldValue: 4,
    spriteName: 'dasher'
  },
  evader: {
    health: 70,
    speed: 130,
    damage: 9,
    radius: 11,
    color: '#3498db',
    xpValue: 13,
    goldValue: 3,
    spriteName: 'evader'
  },
  orbiter: {
    health: 95,
    speed: 95,
    damage: 11,
    radius: 12,
    color: '#9b59b6',
    xpValue: 15,
    goldValue: 4,
    spriteName: 'orbiter'
  },
  spiraler: {
    health: 88,
    speed: 105,
    damage: 10,
    radius: 12,
    color: '#1abc9c',
    xpValue: 14,
    goldValue: 4,
    shootRate: 1.4,
    firePattern: 'spiral',
    spriteName: 'spiraler'
  },
  // Stationary turret firing rotating rings of shots (Felix: "spinning shots")
  spinner: {
    health: 110,
    speed: 18,
    damage: 9,
    radius: 14,
    color: '#ffa94d',
    xpValue: 16,
    goldValue: 5,
    shootRate: 0.45,
    firePattern: 'ring',
    spriteName: 'spinner'
  },
  // NEW: Shielder - blocks damage from one direction
  shielder: {
    health: 140,
    speed: 50,
    damage: 12,
    radius: 15,
    color: '#95a5a6',
    xpValue: 18,
    goldValue: 5,
    spriteName: 'shielder'
  },
  // NEW: Exploder - explodes on death, damaging player
  exploder: {
    health: 80,
    speed: 80,
    damage: 25, // Big explosion damage
    radius: 13,
    color: '#e74c3c',
    xpValue: 16,
    goldValue: 4,
    spriteName: 'exploder'
  },
  // NEW: Healer - heals nearby allies
  healer: {
    health: 60,
    speed: 70,
    damage: 5,
    radius: 11,
    color: '#27ae60',
    xpValue: 20,
    goldValue: 6,
    spriteName: 'healer'
  },
  // NEW: Summoner - spawns minions periodically
  summoner: {
    health: 90,
    speed: 40,
    damage: 6,
    radius: 13,
    color: '#8e44ad',
    xpValue: 25,
    goldValue: 8,
    spriteName: 'summoner'
  },
  // NEW: Phaser - briefly invincible when hit
  phaser: {
    health: 100,
    speed: 110,
    damage: 14,
    radius: 12,
    color: '#3498db',
    xpValue: 22,
    goldValue: 6,
    spriteName: 'phaser'
  },

  // NEW: Worm head — leads a trailing chain of body segments. Killing a body
  // segment SPLITS the worm: the tail behind the break becomes a new worm.
  wormhead: {
    health: 130,
    speed: 95,
    damage: 12,
    radius: 15,
    color: '#e67e22',
    xpValue: 14,
    goldValue: 4,
    spriteName: '' // custom segmented draw (no sprite)
  },
  // Worm body segment — follows the segment ahead of it; damageable.
  wormbody: {
    health: 70,
    speed: 95,
    damage: 10,
    radius: 13,
    color: '#d35400',
    xpValue: 6,
    goldValue: 1,
    spriteName: ''
  },
  // NEW: Egg sac — stationary, low HP. If NOT killed within its hatch timer it
  // hatches into a much nastier enemy. Kill it fast or pay the price.
  eggsac: {
    health: 55,
    speed: 0,
    damage: 6,
    radius: 16,
    color: '#f1c40f',
    xpValue: 10,
    goldValue: 3,
    spriteName: ''
  },
  // NEW: Bombardier — keeps its distance and lobs telegraphed AoE mortars
  // (red ground markers) instead of straight shots. Forces the player to move.
  bombardier: {
    health: 95,
    speed: 55,
    damage: 14,
    radius: 14,
    color: '#c0392b',
    xpValue: 20,
    goldValue: 6,
    spriteName: ''
  },

  // ==================== BOSS ENEMIES ====================
  // Bosses appear every 10 waves and have 3-phase mechanics

  // Wave 10 Boss: Necro Lord - Summons undead minions, shoots dark bolts
  boss_necrolord: {
    health: 1100,
    speed: 50,
    damage: 15,
    radius: 30,
    color: '#2c2c54',
    xpValue: 200,
    goldValue: 100,
    shootRate: 2.0, // Fast shooter
    spriteName: 'boss_necrolord',
    isBoss: true
  },

  // Wave 20 Boss: Flame Fiend - Fire attacks, leaves burning ground
  boss_flamefiend: {
    health: 2600,
    speed: 65,
    damage: 20,
    radius: 32,
    color: '#e74c3c',
    xpValue: 400,
    goldValue: 200,
    shootRate: 1.5,
    spriteName: 'boss_flamefiend',
    isBoss: true
  },

  // Wave 30 Boss: Void Beast - Teleports, summons void rifts
  boss_voidbeast: {
    health: 6500,
    speed: 80,
    damage: 25,
    radius: 34,
    color: '#8e44ad',
    xpValue: 600,
    goldValue: 300,
    shootRate: 1.8,
    spriteName: 'boss_voidbeast',
    isBoss: true
  },

  // Wave 40 Boss: Storm King - Lightning attacks, dash attacks
  boss_stormking: {
    health: 9000,
    speed: 90,
    damage: 30,
    radius: 36,
    color: '#3498db',
    xpValue: 800,
    goldValue: 400,
    shootRate: 2.5,
    spriteName: 'boss_stormking',
    isBoss: true
  },

  // Wave 50+ Boss: Ancient Golem - Massive tank, stomp attacks
  boss_ancientgolem: {
    health: 12000,
    speed: 35,
    damage: 35,
    radius: 38,
    color: '#95a5a6',
    xpValue: 1000,
    goldValue: 500,
    shootRate: 1.0,
    spriteName: 'boss_ancientgolem',
    isBoss: true
  }
};

export class Enemy {
  static nextId = 0;

  id: number;
  x: number;
  y: number;
  type: EnemyType;
  typeData: EnemyTypeData;
  /** Rotation state for ring/spiral fire patterns. */
  patternPhase: number = Math.random() * Math.PI * 2;
  /** Set by WaveManager on the last stragglers: charge, never flee. */
  enraged: boolean = false;
  /** Contact-attack cooldown — enemies persist and keep attacking. */
  contactCooldown: number = 0;
  /** Frozen: no movement while > 0 (Frost Orb etc., ticked by Game). */
  frozenTimer: number = 0;
  /** Poison DoT remaining seconds (Toxic Vial etc., ticked by Game). */
  poisonTimer: number = 0;
  health: number;
  maxHealth: number;
  dead: boolean = false;

  // GridEntity interface compliance
  get radius(): number {
    return this.typeData.radius;
  }

  // GAME FEEL: Knockback physics
  knockbackVelocityX: number = 0;
  knockbackVelocityY: number = 0;

  // GAME FEEL: White flash on hit
  hitFlashTimer: number = 0;

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

  // Bat specific (erratic movement)
  batAngle: number = 0;
  batTimer: number = 0;

  // Wizard specific (teleport)
  wizardTeleportCooldown: number = 0;

  // Mimic specific (disguise)
  mimicActivated: boolean = false;
  mimicActivationDistance: number = 150;

  // Spider specific (poison trail)
  spiderTrailTimer: number = 0;

  // Golem specific (stomp)
  golemStompCooldown: number = 0;
  golemCanKnockback: boolean = false; // Immune to knockback

  // Ghost specific (phasing)
  ghostPhaseThrough: boolean = true; // Phases through walls
  ghostWaveOffset: number = 0;

  // Mushroom specific (spore clouds)
  mushroomSporeTimer: number = 0;
  mushroomExplodeOnDeath: boolean = true;

  // Gargoyle specific (stone form)
  gargoyleStoneForm: boolean = false;
  gargoyleStoneTimer: number = 0;
  gargoyleMovementTimer: number = 0;

  // Blob specific (split)
  blobSplitLevel: number = 0; // 0=large, 1=medium, 2=small
  blobCanSplit: boolean = true;

  // NecroEgg specific (spawner)
  necroEggSpawnTimer: number = 0;
  necroEggSpawnsCreated: number = 0;

  // Cyclops specific (charge)
  cyclopsCharging: boolean = false;
  cyclopsChargeDirection: { x: number; y: number } = { x: 0, y: 0 };
  cyclopsStunned: boolean = false;
  cyclopsStunTimer: number = 0;
  cyclopsChargeCooldown: number = 0;

  // Phantom specific (invisibility)
  phantomInvisible: boolean = true;
  phantomRevealDistance: number = 120;

  // Druid specific (healer)
  druidHealCooldown: number = 0;
  druidFleeDistance: number = 180;

  // Construct specific (reflection)
  constructReflectChance: number = 0.3;

  // NEW AI: Dash/lunge behavior
  dashCooldown: number = 0;
  dashing: boolean = false;
  dashVelocity: { x: number; y: number } = { x: 0, y: 0 };
  dashTimer: number = 0;

  // NEW AI: Dodge behavior (avoid projectiles)
  dodgeCooldown: number = 0;
  dodging: boolean = false;
  dodgeDirection: { x: number; y: number } = { x: 0, y: 0 };
  dodgeTimer: number = 0;

  // NEW AI: Circle movement
  circleAngle: number = 0;
  circleDistance: number = 200;

  // NEW AI: Spiral movement
  spiralAngle: number = 0;
  spiralDistance: number = 250;

  // PATHFINDING: Smart navigation
  path: PathNode[] = [];
  pathUpdateTimer: number = 0;
  pathUpdateInterval: number = 0.5; // Recalculate path every 500ms
  usePathfinding: boolean = false;

  // NEW: Shielder specific (directional shield)
  shielderAngle: number = 0; // Angle of shield (blocks attacks from this direction)
  shielderRotationSpeed: number = 2; // Radians per second

  // NEW: Exploder specific (explosion on death)
  exploderFlashTimer: number = 0; // Visual warning before explosion
  exploderExplodeRadius: number = 100;

  // NEW: Healer specific (heal nearby allies)
  healerHealCooldown: number = 0;
  healerHealRadius: number = 150;
  healerHealAmount: number = 20;

  // NEW: Summoner specific (spawn minions)
  summonerSpawnCooldown: number = 0;
  summonerMaxMinions: number = 3;
  summonerMinionsSpawned: number = 0;

  // NEW: Phaser specific (invincibility frames)
  phaserInvincible: boolean = false;
  phaserInvincibleTimer: number = 0;
  phaserPhaseOnHitChance: number = 0.5; // 50% chance to phase on hit

  // NEW: Worm — segment chain. `wormLeader` is the segment ahead in the chain
  // (null for the head). Segments trail their leader at `wormFollowGap` px.
  // `wormIsHead` heads chase the player; bodies just follow. Managed by Game so
  // the split logic (kill a body -> tail becomes a new worm) stays centralised.
  wormLeader: Enemy | null = null;
  wormIsHead: boolean = false;
  wormFollowGap: number = 26;
  /** Small render offset so the segmented body wriggles as it moves. */
  wormWriggle: number = Math.random() * Math.PI * 2;

  // NEW: Egg sac — hatches into a tougher enemy if not killed in time.
  eggHatchTimer: number = 6;
  /** What this egg hatches into if it survives. */
  eggHatchType: EnemyType = 'orc';
  /** Set true by update() the frame it hatches; Game reads it to swap the enemy. */
  eggShouldHatch: boolean = false;

  // NEW: Bombardier — lobs telegraphed AoE mortars on a cooldown.
  bombardierCooldown: number = 2.5;

  // BOSS: Multi-phase system (behavior changes at 66% and 33% HP)
  bossPhase: number = 1; // 1, 2, or 3
  bossSpecialAttackCooldown: number = 0;
  /** Cooldown for a boss's telegraphed AoE ground attack. */
  bossAoeCooldown: number = 3;
  /** Rotating index for multi-part telegraphed patterns (e.g. cross slams). */
  bossAoePhase: number = 0;

  // MINIBOSS: a scaled, styled elite version of a regular enemy (set by
  // WaveManager). It gets a menacing tint, a larger body, and its own
  // telegraphed AoE slam so it fights like a mini-boss, not just a big grunt.
  isMiniboss: boolean = false;
  minibossAoeCooldown: number = 3.5;

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
    this.typeData.speed *= ENEMY_SPEED_SCALE; // global pace buff (early game felt slow)
    this.typeData.speed *= Math.min(1.25, 1 + (waveMultiplier - 1) * 0.3); // Speed barely scales (genre norm: composition ramps, not velocity)
    // Rewards scale too (slower than stats) so income and level-ups keep
    // pace with rising shop prices instead of stalling mid-game
    this.typeData.xpValue = Math.round(this.typeData.xpValue * (1 + (waveMultiplier - 1) * 0.5));
    // goldValue stays flat per enemy — income grows via enemy count only
    // (Brotato actively DECAYS per-kill income to damp snowballing)

    this.maxHealth = this.typeData.health;
    this.health = this.maxHealth;

    // PATHFINDING: Enable for smart enemy types
    // These enemies use smarter navigation instead of direct chase
    const smartEnemies: EnemyType[] = ['mimic', 'wizard', 'necromancer', 'druid', 'phantom', 'ghost'];
    this.usePathfinding = smartEnemies.includes(type);
  }

  update(dt: number, playerX: number, playerY: number): EnemyUpdateResult {
    // GAME FEEL: Update timers
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);

    // GAME FEEL: Apply knockback velocity with smooth decay
    if (this.knockbackVelocityX !== 0 || this.knockbackVelocityY !== 0) {
      this.x += this.knockbackVelocityX * dt;
      this.y += this.knockbackVelocityY * dt;

      // Exponential decay (lerp toward zero)
      const decayFactor = 10.0;
      this.knockbackVelocityX -= this.knockbackVelocityX * decayFactor * dt;
      this.knockbackVelocityY -= this.knockbackVelocityY * decayFactor * dt;

      // Stop if very small
      if (Math.abs(this.knockbackVelocityX) < 1) this.knockbackVelocityX = 0;
      if (Math.abs(this.knockbackVelocityY) < 1) this.knockbackVelocityY = 0;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let shouldShoot = false;
    let shouldTeleport = false;
    let shouldSummon = false;
    let shouldScream = false;
    let shouldStomp = false;
    let splitInto: Enemy[] | undefined;
    let poisonTrail: { x: number; y: number } | undefined;
    let sporeCloud: { x: number; y: number } | undefined;
    let shouldHeal = false;
    let shouldSpawnMinion = false;
    let aoeAttacks: AoeAttackRequest[] | undefined;

    // Movement behavior based on type
    if (dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;

      let moveSpeed = this.typeData.speed;
      let shouldMove = true;

      // Enraged stragglers charge the player at boosted speed
      if (this.enraged) {
        moveSpeed *= 1.6;
      }

      // Frozen enemies can't move
      if (this.frozenTimer > 0) {
        moveSpeed = 0;
      }

      // Type-specific movement
      if (this.type === 'skeleton' || this.type === 'goblin' || this.type === 'necromancer') {
        // Ranged units keep distance
        if (!this.enraged && dist < 250) {
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

      // Bat erratic movement (zigzag)
      if (this.type === 'bat') {
        this.batTimer += dt * 6;
        this.batAngle = Math.sin(this.batTimer) * 0.5;
        const perpX = -ny;
        const perpY = nx;
        this.x += (nx * moveSpeed + perpX * moveSpeed * this.batAngle) * dt;
        this.y += (ny * moveSpeed + perpY * moveSpeed * this.batAngle) * dt;
        shouldMove = false;
      }

      // Mimic activation
      if (this.type === 'mimic') {
        if (!this.mimicActivated && dist < this.mimicActivationDistance) {
          this.mimicActivated = true;
          this.typeData.speed = 140; // Fast lunge
        }
        // Only move when activated
        if (!this.mimicActivated) {
          shouldMove = false;
        }
      }

      // Spider wall-crawling (moves toward edges)
      if (this.type === 'spider') {
        // Spider leaves poison trails
        this.spiderTrailTimer += dt;
        if (this.spiderTrailTimer >= 0.15) {
          poisonTrail = { x: this.x, y: this.y };
          this.spiderTrailTimer = 0;
        }
      }

      // Wizard teleport away when player is too close
      if (this.type === 'wizard') {
        this.wizardTeleportCooldown -= dt;
        if (dist < 180 && this.wizardTeleportCooldown <= 0) {
          // Teleport away
          const angle = Math.atan2(this.y - playerY, this.x - playerX);
          const teleportDist = 150;
          this.x += Math.cos(angle) * teleportDist;
          this.y += Math.sin(angle) * teleportDist;
          this.wizardTeleportCooldown = 3;
        }
      }

      // Ghost wavy movement (phases through everything, can't be knocked back)
      if (this.type === 'ghost') {
        this.ghostWaveOffset += dt * 4;
        const waveX = Math.sin(this.ghostWaveOffset) * 60;
        const waveY = Math.cos(this.ghostWaveOffset * 0.7) * 60;
        this.x += (nx * moveSpeed + waveX * 0.3) * dt;
        this.y += (ny * moveSpeed + waveY * 0.3) * dt;
        shouldMove = false;
      }

      // Gargoyle stone form (invincible when stationary)
      if (this.type === 'gargoyle') {
        this.gargoyleMovementTimer += dt;

        if (this.gargoyleStoneForm) {
          this.gargoyleStoneTimer -= dt;
          if (this.gargoyleStoneTimer <= 0) {
            this.gargoyleStoneForm = false;
            this.gargoyleMovementTimer = 0;
          }
          shouldMove = false;
        } else {
          // Move for 3 seconds, then stone form for 2 seconds
          if (this.gargoyleMovementTimer >= 3) {
            this.gargoyleStoneForm = true;
            this.gargoyleStoneTimer = 2;
          }
        }
      }

      // Cyclops charge behavior
      if (this.type === 'cyclops') {
        this.cyclopsChargeCooldown -= dt;

        if (this.cyclopsStunned) {
          this.cyclopsStunTimer -= dt;
          if (this.cyclopsStunTimer <= 0) {
            this.cyclopsStunned = false;
          }
          shouldMove = false;
        } else if (this.cyclopsCharging) {
          // Continue charge in same direction
          this.x += this.cyclopsChargeDirection.x * moveSpeed * 3 * dt;
          this.y += this.cyclopsChargeDirection.y * moveSpeed * 3 * dt;
          shouldMove = false;
        } else if (dist < 250 && this.cyclopsChargeCooldown <= 0) {
          // Start charge
          this.cyclopsCharging = true;
          this.cyclopsChargeDirection = { x: nx, y: ny };
          this.cyclopsChargeCooldown = 5;
        }
      }

      // Phantom invisibility (reveals when close)
      if (this.type === 'phantom') {
        if (dist < this.phantomRevealDistance) {
          this.phantomInvisible = false;
        } else {
          this.phantomInvisible = true;
        }
      }

      // Druid healer (heals nearby enemies, flees from player)
      if (this.type === 'druid') {
        this.druidHealCooldown -= dt;

        if (!this.enraged && dist < this.druidFleeDistance) {
          // Flee from player
          this.x -= nx * moveSpeed * dt * 1.5;
          this.y -= ny * moveSpeed * dt * 1.5;
          shouldMove = false;
        }

        if (this.druidHealCooldown <= 0) {
          shouldHeal = true;
          this.druidHealCooldown = 3;
        }
      }

      // NEW AI: Dasher - quick burst dashes toward player
      if (this.type === 'dasher') {
        this.dashCooldown -= dt;

        if (this.dashing) {
          this.dashTimer -= dt;
          this.x += this.dashVelocity.x * dt;
          this.y += this.dashVelocity.y * dt;

          if (this.dashTimer <= 0) {
            this.dashing = false;
          }
          shouldMove = false;
        } else if (dist > 100 && dist < 350 && this.dashCooldown <= 0) {
          // Initiate dash
          this.dashing = true;
          this.dashTimer = 0.3; // 300ms dash
          this.dashVelocity = { x: nx * moveSpeed * 4, y: ny * moveSpeed * 4 };
          this.dashCooldown = 2.5;
        }
      }

      // NEW AI: Evader - dodges projectiles (needs projectile positions passed in future)
      // For now, implements evasive zigzag movement
      if (this.type === 'evader') {
        this.dodgeCooldown -= dt;

        if (this.dodging) {
          this.dodgeTimer -= dt;
          this.x += this.dodgeDirection.x * dt;
          this.y += this.dodgeDirection.y * dt;

          if (this.dodgeTimer <= 0) {
            this.dodging = false;
          }
          shouldMove = false;
        } else if (!this.enraged && dist < 300 && this.dodgeCooldown <= 0 && Math.random() < 0.5) {
          // Random dodge perpendicular to player direction
          const perpX = -ny;
          const perpY = nx;
          const dodgeDir = Math.random() < 0.5 ? 1 : -1;

          this.dodging = true;
          this.dodgeTimer = 0.25; // 250ms dodge
          this.dodgeDirection = { x: perpX * moveSpeed * 3 * dodgeDir, y: perpY * moveSpeed * 3 * dodgeDir };
          this.dodgeCooldown = 1.5;
        }
      }

      // NEW AI: Orbiter - circles around player at fixed distance
      if (this.type === 'orbiter') {
        this.circleAngle += dt * 2; // Rotate around player

        const targetX = playerX + Math.cos(this.circleAngle) * this.circleDistance;
        const targetY = playerY + Math.sin(this.circleAngle) * this.circleDistance;

        const toDx = targetX - this.x;
        const toDy = targetY - this.y;
        const toDist = Math.sqrt(toDx * toDx + toDy * toDy);

        if (toDist > 10) {
          this.x += (toDx / toDist) * moveSpeed * dt;
          this.y += (toDy / toDist) * moveSpeed * dt;
        }
        shouldMove = false;
      }

      // NEW AI: Spiraler - spirals inward toward player
      if (this.type === 'spiraler') {
        this.spiralAngle += dt * 2.5; // Rotate
        this.spiralDistance = Math.max(50, this.spiralDistance - dt * 30); // Spiral inward

        const targetX = playerX + Math.cos(this.spiralAngle) * this.spiralDistance;
        const targetY = playerY + Math.sin(this.spiralAngle) * this.spiralDistance;

        const toDx = targetX - this.x;
        const toDy = targetY - this.y;
        const toDist = Math.sqrt(toDx * toDx + toDy * toDy);

        if (toDist > 10) {
          this.x += (toDx / toDist) * moveSpeed * dt;
          this.y += (toDy / toDist) * moveSpeed * dt;
        }
        shouldMove = false;
      }

      // NEW AI: Shielder - has rotating shield that blocks attacks from one direction
      if (this.type === 'shielder') {
        this.shielderAngle += this.shielderRotationSpeed * dt;
        // Shield behavior is handled in takeDamage method
      }

      // NEW AI: Exploder - flashes before exploding when close to player
      if (this.type === 'exploder') {
        if (dist < 100) {
          this.exploderFlashTimer += dt;
          // Visual flash handled in draw method
          // Explosion triggered when dying in Game.ts
        } else {
          this.exploderFlashTimer = 0;
        }
      }

      // NEW AI: Healer - stays back and heals nearby allies
      if (this.type === 'healer') {
        this.healerHealCooldown -= dt;

        // Keep distance from player
        if (dist < 250) {
          this.x -= nx * moveSpeed * dt * 0.8;
          this.y -= ny * moveSpeed * dt * 0.8;
          shouldMove = false;
        } else if (dist > 350) {
          // Approach if too far
          shouldMove = true;
        } else {
          shouldMove = false;
        }

        // Heal nearby enemies
        if (this.healerHealCooldown <= 0) {
          shouldHeal = true;
          this.healerHealCooldown = 4; // Heal every 4 seconds
        }
      }

      // NEW AI: Summoner - spawns minions periodically
      if (this.type === 'summoner') {
        this.summonerSpawnCooldown -= dt;

        // Keep distance from player (like healer)
        if (dist < 250) {
          this.x -= nx * moveSpeed * dt * 0.6;
          this.y -= ny * moveSpeed * dt * 0.6;
          shouldMove = false;
        } else if (dist > 400) {
          shouldMove = true;
        } else {
          shouldMove = false;
        }

        // Spawn minions
        if (this.summonerSpawnCooldown <= 0 && this.summonerMinionsSpawned < this.summonerMaxMinions) {
          shouldSpawnMinion = true;
          this.summonerSpawnCooldown = 6; // Spawn every 6 seconds
          this.summonerMinionsSpawned++;
        }
      }

      // NEW AI: Phaser - has chance to phase (become invincible) when hit
      if (this.type === 'phaser') {
        if (this.phaserInvincible) {
          this.phaserInvincibleTimer -= dt;
          if (this.phaserInvincibleTimer <= 0) {
            this.phaserInvincible = false;
          }
        }
        // Phasing behavior handled in takeDamage method
      }

      // NEW AI: Worm body — follow the segment ahead in the chain instead of the
      // player. Trails at a fixed gap so the chain stays connected and wriggly.
      if (this.type === 'wormbody') {
        this.wormWriggle += dt * 8;
        const leader = this.wormLeader;
        if (leader && !leader.dead) {
          const ldx = leader.x - this.x;
          const ldy = leader.y - this.y;
          const ld = Math.sqrt(ldx * ldx + ldy * ldy);
          if (ld > this.wormFollowGap) {
            // Speed up if lagging so the chain doesn't stretch apart.
            const catchUp = Math.min(2.2, ld / this.wormFollowGap);
            this.x += (ldx / ld) * moveSpeed * catchUp * dt;
            this.y += (ldy / ld) * moveSpeed * catchUp * dt;
          }
        } else {
          // No leader (it died and split logic hasn't promoted us yet): crawl
          // toward the player so a lone segment still poses a threat.
          this.x += nx * moveSpeed * 0.8 * dt;
          this.y += ny * moveSpeed * 0.8 * dt;
        }
        shouldMove = false;
      }
      if (this.type === 'wormhead') {
        // Store the facing angle so the drawn eyes point toward the player.
        this.wormWriggle = Math.atan2(dy, dx);
        // Head uses default chase (shouldMove stays true).
      }

      // NEW AI: Egg sac — stationary, ticks toward hatching. Game reads
      // eggShouldHatch to replace it with a tougher enemy.
      if (this.type === 'eggsac') {
        shouldMove = false;
        this.eggHatchTimer -= dt;
        if (this.eggHatchTimer <= 0 && !this.eggShouldHatch) {
          this.eggShouldHatch = true;
        }
      }

      // NEW AI: Bombardier — hold at range and lob telegraphed AoE mortars.
      if (this.type === 'bombardier') {
        if (dist < 220 && !this.enraged) {
          // Too close: back away.
          this.x -= nx * moveSpeed * dt;
          this.y -= ny * moveSpeed * dt;
          shouldMove = false;
        } else if (dist > 420) {
          shouldMove = true; // close the gap
        } else {
          shouldMove = false; // hold position and bombard
        }
        this.bombardierCooldown -= dt;
        if (this.bombardierCooldown <= 0 && dist < 520) {
          // Lob a mortar onto the player's position with a little scatter, so
          // standing still is punished but a moving player can slip the marker.
          const scatter = 45;
          aoeAttacks = aoeAttacks ?? [];
          aoeAttacks.push({
            x: playerX + (Math.random() - 0.5) * scatter,
            y: playerY + (Math.random() - 0.5) * scatter,
            radius: 70,
            damage: this.typeData.damage * 1.6,
            telegraph: 1.1,
            color: '#ff5a3c'
          });
          this.bombardierCooldown = 2.6 + Math.random() * 0.8;
        }
      }

      // ==================== BOSS AI ====================
      // Bosses have 3-phase mechanics (behavior changes at 66% and 33% HP)
      if (this.typeData.isBoss) {
        const healthPercent = this.health / this.maxHealth;

        // Update phase based on health
        if (healthPercent > 0.66) {
          this.bossPhase = 1;
        } else if (healthPercent > 0.33) {
          this.bossPhase = 2;
        } else {
          this.bossPhase = 3;
        }

        this.bossSpecialAttackCooldown -= dt;

        // Necro Lord - Summons more minions as HP drops
        if (this.type === 'boss_necrolord') {
          // Phase 1: Normal summons
          // Phase 2: Faster summons + circle movement
          // Phase 3: Even faster summons + teleport dashes
          if (this.bossPhase >= 2) {
            // Circle around player
            this.circleAngle += dt * 1.5;
            const targetX = playerX + Math.cos(this.circleAngle) * 200;
            const targetY = playerY + Math.sin(this.circleAngle) * 200;
            const toDx = targetX - this.x;
            const toDy = targetY - this.y;
            const toDist = Math.sqrt(toDx * toDx + toDy * toDy);
            if (toDist > 10) {
              this.x += (toDx / toDist) * moveSpeed * dt;
              this.y += (toDy / toDist) * moveSpeed * dt;
            }
            shouldMove = false;
          }

          if (this.bossPhase === 3 && this.bossSpecialAttackCooldown <= 0 && Math.random() < 0.3) {
            // Teleport dash
            const angle = Math.atan2(playerY - this.y, playerX - this.x);
            this.x += Math.cos(angle) * 150;
            this.y += Math.sin(angle) * 150;
            this.bossSpecialAttackCooldown = 2.0;
          }
        }

        // Flame Fiend - Faster and more aggressive each phase
        if (this.type === 'boss_flamefiend') {
          // Speed increases per phase
          if (this.bossPhase === 2) {
            this.typeData.speed = 80;
            this.typeData.shootRate = 2.0;
          } else if (this.bossPhase === 3) {
            this.typeData.speed = 95;
            this.typeData.shootRate = 2.8;
          }
        }

        // Void Beast - Teleports and creates void zones
        if (this.type === 'boss_voidbeast') {
          if (this.bossPhase >= 2 && this.bossSpecialAttackCooldown <= 0) {
            // Random teleport
            const angle = Math.random() * Math.PI * 2;
            const teleportDist = 200 + Math.random() * 100;
            this.x = playerX + Math.cos(angle) * teleportDist;
            this.y = playerY + Math.sin(angle) * teleportDist;
            this.bossSpecialAttackCooldown = 3.0;
          }
        }

        // Storm King - Dash attacks and lightning bolts
        if (this.type === 'boss_stormking') {
          if (this.bossPhase >= 2 && !this.dashing && this.dashCooldown <= 0 && dist < 400) {
            // Lightning dash toward player
            this.dashing = true;
            this.dashTimer = 0.4;
            this.dashVelocity = { x: nx * moveSpeed * 5, y: ny * moveSpeed * 5 };
            this.dashCooldown = 2.0;
          }

          if (this.dashing) {
            this.dashTimer -= dt;
            this.x += this.dashVelocity.x * dt;
            this.y += this.dashVelocity.y * dt;
            if (this.dashTimer <= 0) {
              this.dashing = false;
            }
            shouldMove = false;
          }
        }

        // Ancient Golem - Stomps and ground slams
        if (this.type === 'boss_ancientgolem') {
          // Phase 2+: Frequent stomps
          if (this.bossPhase >= 2) {
            if (this.bossSpecialAttackCooldown <= 0 && dist < 180) {
              shouldStomp = true;
              this.bossSpecialAttackCooldown = 3.0;
            }
          }
        }

        // ---- Telegraphed AoE ground attacks (fair, dodgeable, boss-signature) ----
        // Every boss lobs a red-marked zone on its own cadence; the pattern is the
        // boss's identity and it grows more dangerous each phase. The player always
        // gets a warning window to step out.
        this.bossAoeCooldown -= dt;
        if (this.bossAoeCooldown <= 0) {
          const dmg = this.typeData.damage * 2.2;
          const tele = this.bossPhase >= 3 ? 0.85 : this.bossPhase === 2 ? 1.05 : 1.3;
          aoeAttacks = this.buildBossAoe(playerX, playerY, dmg, tele);
          // Cadence tightens as HP drops.
          this.bossAoeCooldown = (this.bossPhase >= 3 ? 2.6 : this.bossPhase === 2 ? 3.4 : 4.2)
            + Math.random() * 0.8;
        }
      }

      // Miniboss telegraphed slam: a fair, dodgeable AoE on the player's spot so
      // an elite grunt has a signature threat beyond raw stats.
      if (this.isMiniboss && !this.typeData.isBoss) {
        this.minibossAoeCooldown -= dt;
        if (this.minibossAoeCooldown <= 0 && dist < 560) {
          aoeAttacks = aoeAttacks ?? [];
          aoeAttacks.push({
            x: playerX,
            y: playerY,
            radius: 95,
            damage: this.typeData.damage * 1.8,
            telegraph: 1.15,
            color: '#ff8c1a'
          });
          this.minibossAoeCooldown = 3.5 + Math.random() * 1.2;
        }
      }

      if (shouldMove) {
        // PATHFINDING: Use waypoint-based movement for smart enemies
        if (this.usePathfinding && this.path.length > 0) {
          // Get next waypoint
          const waypoint = this.path[0];
          const wpDx = waypoint.x - this.x;
          const wpDy = waypoint.y - this.y;
          const wpDist = Math.sqrt(wpDx * wpDx + wpDy * wpDy);

          // Check if we've reached the waypoint
          if (wpDist < 15) {
            // Remove reached waypoint
            this.path.shift();

            // If more waypoints exist, move to next one
            if (this.path.length > 0) {
              const nextWaypoint = this.path[0];
              const nextDx = nextWaypoint.x - this.x;
              const nextDy = nextWaypoint.y - this.y;
              const nextDist = Math.sqrt(nextDx * nextDx + nextDy * nextDy);
              if (nextDist > 0) {
                this.x += (nextDx / nextDist) * moveSpeed * dt;
                this.y += (nextDy / nextDist) * moveSpeed * dt;
              }
            }
          } else if (wpDist > 0) {
            // Move toward current waypoint
            this.x += (wpDx / wpDist) * moveSpeed * dt;
            this.y += (wpDy / wpDist) * moveSpeed * dt;
          }
        } else {
          // Standard direct movement (no pathfinding)
          this.x += nx * moveSpeed * dt;
          this.y += ny * moveSpeed * dt;
        }
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

    // Golem stomp attack
    if (this.type === 'golem') {
      this.golemStompCooldown -= dt;
      if (this.golemStompCooldown <= 0 && dist < 120) {
        shouldStomp = true;
        this.golemStompCooldown = 4;
      }
    }

    // Wizard homing projectiles (handled in Game.ts)
    if (this.type === 'wizard' && this.typeData.shootRate) {
      this.shootCooldown -= dt;
      if (this.shootCooldown <= 0 && dist > 50 && dist < 500) {
        shouldShoot = true;
        this.shootCooldown = 1 / this.typeData.shootRate;
      }
    }

    // Mushroom stationary spore clouds
    if (this.type === 'mushroom') {
      this.mushroomSporeTimer += dt;
      if (this.mushroomSporeTimer >= 2.5) {
        sporeCloud = { x: this.x, y: this.y };
        this.mushroomSporeTimer = 0;
      }
    }

    // NecroEgg spawner
    if (this.type === 'necroegg') {
      this.necroEggSpawnTimer += dt;
      if (this.necroEggSpawnTimer >= 4 && this.necroEggSpawnsCreated < 3) {
        shouldSpawnMinion = true;
        this.necroEggSpawnTimer = 0;
        this.necroEggSpawnsCreated++;
      }
    }

    return { shouldShoot, shouldTeleport, shouldSummon, shouldScream, shouldStomp, splitInto, poisonTrail, sporeCloud, shouldHeal, shouldSpawnMinion, aoeAttacks };
  }

  takeDamage(amount: number, attackAngle?: number): Enemy[] | null {
    // Wraith invulnerability
    if (this.invulnerable) {
      return null;
    }

    // Gargoyle stone form invulnerability
    if (this.type === 'gargoyle' && this.gargoyleStoneForm) {
      return null;
    }

    // Phaser invulnerability
    if (this.type === 'phaser' && this.phaserInvincible) {
      return null;
    }

    // Shielder shield blocking (blocks damage from shield's facing direction)
    if (this.type === 'shielder' && attackAngle !== undefined) {
      // Calculate angle difference between attack and shield
      const angleDiff = Math.abs(attackAngle - this.shielderAngle);
      const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

      // Shield blocks attacks within 60 degrees (π/3 radians) arc
      if (normalizedDiff < Math.PI / 3) {
        // Blocked! No damage
        return null;
      }
    }

    // GAME FEEL: Trigger white hit flash (no hitstun — enemies never freeze,
    // impact is conveyed by knockback + flash + particles to keep motion fluid)
    this.hitFlashTimer = 0.032; // 2 frames at 60fps

    // Phaser has chance to phase on hit
    if (this.type === 'phaser' && !this.phaserInvincible && Math.random() < this.phaserPhaseOnHitChance) {
      this.phaserInvincible = true;
      this.phaserInvincibleTimer = 0.8; // Invincible for 0.8 seconds
      // Still take this hit, but next hits will be blocked
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

      // Blob split mechanic (splits into smaller blobs)
      if (this.type === 'blob' && this.blobCanSplit && this.blobSplitLevel < 2) {
        const splits: Enemy[] = [];
        const numSplits = 2;
        for (let i = 0; i < numSplits; i++) {
          const angle = (Math.PI * 2 * i) / numSplits;
          const smallBlob = new Enemy(
            this.x + Math.cos(angle) * 25,
            this.y + Math.sin(angle) * 25,
            'blob',
            1,
            false
          );
          smallBlob.blobSplitLevel = this.blobSplitLevel + 1;
          smallBlob.blobCanSplit = this.blobSplitLevel < 1; // Only split once more
          // Smaller and faster
          const scaleFactor = 1 - (this.blobSplitLevel + 1) * 0.3;
          smallBlob.typeData.health = this.maxHealth * scaleFactor;
          smallBlob.typeData.radius = this.typeData.radius * 0.7;
          smallBlob.typeData.damage = this.typeData.damage * 0.7;
          smallBlob.typeData.speed = this.typeData.speed * 1.3; // Faster when smaller
          smallBlob.maxHealth = smallBlob.typeData.health;
          smallBlob.health = smallBlob.maxHealth;
          splits.push(smallBlob);
        }
        return splits;
      }

      // Mushroom explodes on death (handled in Game.ts via spore cloud)
    }

    return null;
  }

  // GAME FEEL: Apply knockback velocity
  applyKnockback(vx: number, vy: number): void {
    // Golem and Construct are immune to knockback
    if (this.type === 'golem' || this.type === 'construct') return;

    // Ghost can't be knocked back
    if (this.type === 'ghost') return;

    this.knockbackVelocityX = vx;
    this.knockbackVelocityY = vy;
  }

  // Cyclops wall collision (stuns self)
  checkWallCollision(canvasWidth: number, canvasHeight: number): void {
    if (this.type === 'cyclops' && this.cyclopsCharging) {
      const margin = this.typeData.radius;
      if (this.x < margin || this.x > canvasWidth - margin ||
          this.y < margin || this.y > canvasHeight - margin) {
        this.cyclopsCharging = false;
        this.cyclopsStunned = true;
        this.cyclopsStunTimer = 1.5;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Custom-drawn types (no sprite): worms as segmented bodies, egg sacs as a
    // pulsing shell with a countdown crack. Drawn here so they read distinctly.
    if (this.type === 'wormhead' || this.type === 'wormbody') {
      this.drawWormSegment(ctx);
      this.drawHealthBar(ctx);
      ctx.restore();
      return;
    }
    if (this.type === 'eggsac') {
      this.drawEggSac(ctx);
      this.drawHealthBar(ctx);
      ctx.restore();
      return;
    }

    // Miniboss aura: a pulsing dark-red glow ring behind the (enlarged) sprite so
    // an elite reads as a distinct threat at a glance.
    if (this.isMiniboss) {
      const pulse = 0.5 + 0.3 * Math.sin(performance.now() / 180);
      ctx.globalAlpha = 0.35 * pulse;
      ctx.fillStyle = '#b30000';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.typeData.radius * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const sprite = SpriteSheet.get(this.typeData.spriteName);

    if (sprite) {
      // Minibosses draw their sprite enlarged to match their bigger radius.
      const scale = this.isMiniboss ? 1.55 : 1;
      const sw = sprite.width * scale;
      const sh = sprite.height * scale;
      const dx = this.x - sw / 2;
      const dy = this.y - sh / 2;

      if (this.invulnerable) {
        // Wraith phasing: mostly-there dithered transparency
        drawDithered(ctx, sprite, dx, dy, 0.66);
      } else if (this.type === 'ghost') {
        drawDithered(ctx, sprite, dx, dy, 0.6);
      } else if (this.type === 'phantom' && this.phantomInvisible) {
        drawDithered(ctx, sprite, dx, dy, 0.2);
      } else if (this.hitFlashTimer > 0.016) {
        // Pixel-perfect white silhouette flash (not a white box)
        ctx.drawImage(tintSilhouette(sprite, '#ffffff'), dx, dy, sw, sh);
      } else {
        ctx.drawImage(sprite, dx, dy, sw, sh);
      }
    } else {
      // Fallback for types without a sprite yet: flat disc, no gradient
      ctx.fillStyle = this.typeData.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.typeData.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    this.drawHealthBar(ctx);

    ctx.restore();
  }

  /** Health bar (only once damaged — full-health bars are visual clutter). */
  private drawHealthBar(ctx: CanvasRenderingContext2D): void {
    if (this.health >= this.maxHealth) return;
    const isMobile = ctx.canvas.width < ctx.canvas.height;
    const barWidth = this.typeData.radius * 2.6;
    const barHeight = isMobile ? 6 : 5;
    const barY = this.y - this.typeData.radius - 14;

    const healthPercent = this.health / this.maxHealth;
    const healthColor =
      healthPercent > 0.6 ? '#4ade80' : healthPercent > 0.3 ? '#fbbf24' : '#ef4444';

    // Crisp pixel bar: black frame, dark background, solid fill
    ctx.fillStyle = '#000000';
    ctx.fillRect(this.x - barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = '#3c0000';
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);
    ctx.fillStyle = healthColor;
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);
  }

  /** A single worm segment: a rounded body disc with a darker rim; the head also
   *  gets eyes + mandibles so the leading segment reads as the "front". */
  private drawWormSegment(ctx: CanvasRenderingContext2D): void {
    const r = this.typeData.radius;
    const isHead = this.type === 'wormhead';
    // Body: two-tone disc for a segmented, glossy look.
    ctx.fillStyle = isHead ? '#e67e22' : '#d35400';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Inner highlight ring.
    ctx.fillStyle = isHead ? '#f39c12' : '#e67e22';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // Dark rim.
    ctx.strokeStyle = '#7a3803';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (this.hitFlashTimer > 0.016) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (isHead) {
      // Face the direction of travel (toward the player-facing angle stored on move).
      const a = this.wormWriggle; // reused as a facing hint; falls back to any value
      const ex = Math.cos(a) * r * 0.4;
      const ey = Math.sin(a) * r * 0.4;
      ctx.fillStyle = '#2c1200';
      ctx.beginPath();
      ctx.arc(this.x + ex - 3, this.y + ey - 3, 2.5, 0, Math.PI * 2);
      ctx.arc(this.x + ex + 3, this.y + ey + 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** An egg sac: a pulsing pale-yellow ovoid with veins; nearer to hatching it
   *  reddens and cracks widen, telegraphing the imminent spawn. */
  private drawEggSac(ctx: CanvasRenderingContext2D): void {
    const r = this.typeData.radius;
    // Urgency 0..1 as the timer runs down (starts ~6s).
    const urgency = Math.max(0, Math.min(1, 1 - this.eggHatchTimer / 6));
    const pulse = 1 + 0.08 * Math.sin(performance.now() / (140 - urgency * 90));
    // Shell — pales yellow → angry orange as it nears hatching.
    const shell = urgency < 0.5 ? '#f1c40f' : urgency < 0.8 ? '#e67e22' : '#e74c3c';
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, r * 0.85 * pulse, r * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    // Veins / cracks — more and brighter as it's about to hatch.
    ctx.strokeStyle = urgency > 0.6 ? '#c0392b' : '#b7950b';
    ctx.lineWidth = 1.5 + urgency * 2;
    const cracks = 3 + Math.round(urgency * 3);
    for (let i = 0; i < cracks; i++) {
      const a = (Math.PI * 2 * i) / cracks + i;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(a) * r * 0.9, this.y + Math.sin(a) * r * 0.95);
      ctx.stroke();
    }
    // Rim.
    ctx.strokeStyle = '#7a5c00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, r * 0.85 * pulse, r * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
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

  // Build this boss's signature telegraphed AoE pattern. Each boss has a distinct
  // shape so the fight reads differently; phase scales size/count via `bossPhase`.
  private buildBossAoe(px: number, py: number, dmg: number, tele: number): AoeAttackRequest[] {
    const p = this.bossPhase;
    switch (this.type) {
      case 'boss_necrolord': {
        // Grave eruptions in a ring AROUND the player — safe spot is the centre.
        const zones: AoeAttackRequest[] = [];
        const count = 5 + p; // 6..8
        const ringR = 150;
        this.bossAoePhase += 0.5;
        for (let i = 0; i < count; i++) {
          const a = this.bossAoePhase + (Math.PI * 2 * i) / count;
          zones.push({
            x: px + Math.cos(a) * ringR,
            y: py + Math.sin(a) * ringR,
            radius: 60,
            damage: dmg,
            telegraph: tele,
            color: '#9b59ff'
          });
        }
        return zones;
      }
      case 'boss_flamefiend': {
        // A large fire pool right on the player + (phase 3) two flanking pools.
        const zones: AoeAttackRequest[] = [
          { x: px, y: py, radius: 110 + p * 15, damage: dmg, telegraph: tele, color: '#ff6b2b' }
        ];
        if (p >= 3) {
          const off = 170;
          zones.push({ x: px - off, y: py, radius: 90, damage: dmg, telegraph: tele * 1.1, color: '#ff6b2b' });
          zones.push({ x: px + off, y: py, radius: 90, damage: dmg, telegraph: tele * 1.1, color: '#ff6b2b' });
        }
        return zones;
      }
      case 'boss_voidbeast': {
        // A void RING (donut) centred on the player — must move to mid-band, not
        // just away — plus a rift at the beast's own position.
        return [
          { x: px, y: py, radius: 200 + p * 10, damage: dmg, telegraph: tele, shape: 'ring', color: '#b98bff' },
          { x: this.x, y: this.y, radius: 90, damage: dmg * 0.8, telegraph: tele, color: '#7c4dff' }
        ];
      }
      case 'boss_stormking': {
        // Scattered lightning strikes: several small fast-telegraph bolts, more per phase.
        const zones: AoeAttackRequest[] = [];
        const strikes = 3 + p; // 4..6
        for (let i = 0; i < strikes; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * 220;
          zones.push({
            x: px + Math.cos(a) * d,
            y: py + Math.sin(a) * d,
            radius: 55,
            damage: dmg,
            telegraph: tele * 0.7, // lightning is fast — tighter window
            color: '#4dd2ff'
          });
        }
        return zones;
      }
      case 'boss_ancientgolem': {
        // One massive slam zone centred on the golem — huge but slow to land.
        return [
          { x: this.x, y: this.y, radius: 220 + p * 20, damage: dmg * 1.3, telegraph: tele * 1.2, color: '#c8a24d' }
        ];
      }
      default:
        return [{ x: px, y: py, radius: 100, damage: dmg, telegraph: tele }];
    }
  }

  /**
   * PATHFINDING: Update path to target using pathfinding system
   * Called periodically by Game class for smart enemies
   */
  updatePath(
    targetX: number,
    targetY: number,
    pathfindingSystem: PathfindingSystem,
    dt: number,
    obstacleCheck?: (x: number, y: number) => boolean
  ): void {
    if (!this.usePathfinding) return;

    // Update timer
    this.pathUpdateTimer -= dt;

    // Only recalculate path every pathUpdateInterval seconds
    if (this.pathUpdateTimer <= 0) {
      this.pathUpdateTimer = this.pathUpdateInterval;

      // Calculate new path
      const newPath = pathfindingSystem.findPath(
        this.x,
        this.y,
        targetX,
        targetY,
        obstacleCheck,
        Date.now()
      );

      // If path found, use it
      if (newPath && newPath.length > 1) {
        this.path = newPath;
        // Remove first waypoint if it's too close (we're already there)
        if (this.path.length > 0) {
          const firstWp = this.path[0];
          const dx = firstWp.x - this.x;
          const dy = firstWp.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 20) {
            this.path.shift();
          }
        }
      } else {
        // No path found - clear path and fall back to direct movement
        this.path = [];
      }
    }
  }
}
