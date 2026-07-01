// Enemy entity with AI and different types

import { circleCollision } from './utils';
import { SpriteSheet } from './sprites';

export type EnemyType = 'slime' | 'goblin' | 'skeleton' | 'imp' | 'orc' | 'wraith' | 'necromancer' | 'troll' | 'banshee' | 'demon' | 'bat' | 'wizard' | 'mimic' | 'spider' | 'golem' | 'ghost' | 'mushroom' | 'gargoyle' | 'blob' | 'necroegg' | 'cyclops' | 'phantom' | 'druid' | 'construct' | 'swarm' | 'dasher' | 'evader' | 'orbiter' | 'spiraler';

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
    health: 100, // Reduced from 150 for faster Wave 1
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
  },
  bat: {
    health: 50,
    speed: 180,
    damage: 6,
    radius: 10,
    color: '#4a235a',
    xpValue: 20,
    goldValue: 12,
    spriteName: 'bat'
  },
  wizard: {
    health: 90,
    speed: 50,
    damage: 12,
    radius: 12,
    color: '#1f618d',
    xpValue: 30,
    goldValue: 24,
    shootRate: 0.6,
    spriteName: 'wizard'
  },
  mimic: {
    health: 120,
    speed: 0, // Disguised, speed changes when activated
    damage: 14,
    radius: 14,
    color: '#b8860b',
    xpValue: 35,
    goldValue: 40, // 2x normal gold
    spriteName: 'mimic'
  },
  spider: {
    health: 70,
    speed: 95,
    damage: 8,
    radius: 13,
    color: '#1c1c1c',
    xpValue: 25,
    goldValue: 18,
    spriteName: 'spider'
  },
  golem: {
    health: 250,
    speed: 35,
    damage: 16,
    radius: 22,
    color: '#78909c',
    xpValue: 60,
    goldValue: 50,
    spriteName: 'golem'
  },
  ghost: {
    health: 60,
    speed: 70,
    damage: 8,
    radius: 12,
    color: '#e0f7fa',
    xpValue: 20,
    goldValue: 15,
    spriteName: 'ghost'
  },
  mushroom: {
    health: 100,
    speed: 0, // Stationary
    damage: 10,
    radius: 14,
    color: '#8e44ad',
    xpValue: 25,
    goldValue: 18,
    spriteName: 'mushroom'
  },
  gargoyle: {
    health: 180,
    speed: 45,
    damage: 12,
    radius: 16,
    color: '#5d6d7e',
    xpValue: 35,
    goldValue: 28,
    spriteName: 'gargoyle'
  },
  blob: {
    health: 80,
    speed: 50,
    damage: 7,
    radius: 13,
    color: '#e74c3c',
    xpValue: 18,
    goldValue: 14,
    spriteName: 'blob'
  },
  necroegg: {
    health: 50,
    speed: 20,
    damage: 5,
    radius: 12,
    color: '#8b0000',
    xpValue: 30,
    goldValue: 25,
    spriteName: 'necroegg'
  },
  cyclops: {
    health: 150,
    speed: 40,
    damage: 15,
    radius: 18,
    color: '#d68910',
    xpValue: 28,
    goldValue: 22,
    spriteName: 'cyclops'
  },
  phantom: {
    health: 45,
    speed: 140,
    damage: 10,
    radius: 11,
    color: '#a569bd',
    xpValue: 22,
    goldValue: 16,
    spriteName: 'phantom'
  },
  druid: {
    health: 70,
    speed: 65,
    damage: 6,
    radius: 12,
    color: '#27ae60',
    xpValue: 24,
    goldValue: 20,
    spriteName: 'druid'
  },
  construct: {
    health: 130,
    speed: 55,
    damage: 11,
    radius: 15,
    color: '#95a5a6',
    xpValue: 26,
    goldValue: 20,
    spriteName: 'construct'
  },
  swarm: {
    health: 90, // Shared health pool
    speed: 150,
    damage: 6,
    radius: 8,
    color: '#f39c12',
    xpValue: 20,
    goldValue: 15,
    spriteName: 'swarm'
  },
  dasher: {
    health: 85,
    speed: 110,
    damage: 14,
    radius: 13,
    color: '#e74c3c',
    xpValue: 28,
    goldValue: 22,
    spriteName: 'dasher'
  },
  evader: {
    health: 70,
    speed: 130,
    damage: 9,
    radius: 11,
    color: '#3498db',
    xpValue: 25,
    goldValue: 18,
    spriteName: 'evader'
  },
  orbiter: {
    health: 95,
    speed: 95,
    damage: 11,
    radius: 12,
    color: '#9b59b6',
    xpValue: 30,
    goldValue: 24,
    spriteName: 'orbiter'
  },
  spiraler: {
    health: 88,
    speed: 105,
    damage: 10,
    radius: 12,
    color: '#1abc9c',
    xpValue: 27,
    goldValue: 20,
    spriteName: 'spiraler'
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

  // GAME FEEL: Knockback physics
  knockbackVelocityX: number = 0;
  knockbackVelocityY: number = 0;

  // GAME FEEL: Hitstun
  hitstunTimer: number = 0;

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
    shouldStomp?: boolean;
    splitInto?: Enemy[];
    poisonTrail?: { x: number; y: number };
    sporeCloud?: { x: number; y: number };
    shouldHeal?: boolean;
    shouldSpawnMinion?: boolean;
  } {
    // GAME FEEL: Update timers
    this.hitstunTimer = Math.max(0, this.hitstunTimer - dt);
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

    // GAME FEEL: Skip update if in hitstun
    if (this.hitstunTimer > 0) {
      return {
        shouldShoot: false,
        shouldTeleport: false,
        shouldSummon: false,
        shouldScream: false,
        shouldStomp: false
      };
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

        if (dist < this.druidFleeDistance) {
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
        } else if (dist < 300 && this.dodgeCooldown <= 0 && Math.random() < 0.5) {
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

    return { shouldShoot, shouldTeleport, shouldSummon, shouldScream, shouldStomp, splitInto, poisonTrail, sporeCloud, shouldHeal, shouldSpawnMinion };
  }

  takeDamage(amount: number): Enemy[] | null {
    // Wraith invulnerability
    if (this.invulnerable) {
      return null;
    }

    // Gargoyle stone form invulnerability
    if (this.type === 'gargoyle' && this.gargoyleStoneForm) {
      return null;
    }

    // GAME FEEL: Trigger hitstun and hit flash
    this.hitstunTimer = 0.1; // 100ms pause
    this.hitFlashTimer = 0.032; // 2 frames at 60fps

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

      // Ghost translucent effect
      if (this.type === 'ghost') {
        ctx.globalAlpha = 0.6;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#e0f7fa';
      }

      // Gargoyle stone form (darker, no glow)
      if (this.type === 'gargoyle' && this.gargoyleStoneForm) {
        ctx.shadowBlur = 0;
        ctx.filter = 'brightness(0.6)';
      }

      // Phantom invisibility
      if (this.type === 'phantom' && this.phantomInvisible) {
        ctx.globalAlpha = 0.2;
        ctx.filter = 'blur(2px)';
      }

      // Cyclops stunned (grayed out)
      if (this.type === 'cyclops' && this.cyclopsStunned) {
        ctx.filter = 'grayscale(0.7)';
      }

      // GAME FEEL: White flash on hit
      if (this.hitFlashTimer > 0) {
        // Create white flash by drawing a white rectangle with multiply blend
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.hitFlashTimer / 0.032; // Fade based on timer
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
          this.x - sprite.width / 2 - 4,
          this.y - sprite.height / 2 - 4,
          sprite.width + 8,
          sprite.height + 8
        );
        ctx.restore();
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

    // Health bar (always show, improved styling)
    const isMobile = ctx.canvas.width < ctx.canvas.height;
    const barWidth = this.typeData.radius * 2.6;
    const barHeight = isMobile ? 6 : 5;
    const barY = this.y - this.typeData.radius - 14;

    // Background with border
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(this.x - barWidth / 2 - 1, barY - 1, barWidth + 2, barHeight + 2);

    // Inner background
    ctx.fillStyle = 'rgba(60, 0, 0, 0.8)';
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    // Health with gradient and color coding
    const healthPercent = this.health / this.maxHealth;
    let healthColor: string;
    if (healthPercent > 0.6) {
      healthColor = '#4ade80'; // Green
    } else if (healthPercent > 0.3) {
      healthColor = '#fbbf24'; // Yellow/orange
    } else {
      healthColor = '#ef4444'; // Red
    }

    // Health gradient
    const healthGradient = ctx.createLinearGradient(
      this.x - barWidth / 2,
      barY,
      this.x - barWidth / 2,
      barY + barHeight
    );
    healthGradient.addColorStop(0, healthColor);
    healthGradient.addColorStop(1, this.adjustColorBrightness(healthColor, 0.7));

    ctx.fillStyle = healthGradient;
    ctx.shadowBlur = 4;
    ctx.shadowColor = healthColor;
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);

    // Inner highlight for depth
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth * healthPercent, barHeight * 0.4);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    ctx.restore();
  }

  private adjustColorBrightness(color: string, factor: number): string {
    // Simple brightness adjustment for gradient
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) * factor));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) * factor));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) * factor));
    return `rgb(${r}, ${g}, ${b})`;
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
