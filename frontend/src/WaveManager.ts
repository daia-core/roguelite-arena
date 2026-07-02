// Wave spawning and progression system with bosses

import { Enemy, type EnemyType } from './Enemy';
import { randomChoice, randomInt } from './utils';

export type WaveModifier = 'none' | 'horde' | 'elite' | 'speed' | 'tank' | 'chaos' | 'reward' | 'challenge' | 'miniboss';

export class WaveManager {
  currentWave: number = 0;
  waveEnemiesRemaining: number = 0;
  totalEnemiesInWave: number = 20;
  waveTimer: number = 0;
  waveDuration: number = 30; // BALANCE: Reduced from 35s (wave 1 felt too long)
  spawnTimer: number = 0;
  spawnInterval: number = 1.2; // BALANCE: Reduced from 1.5s (faster enemy spawns)
  waveActive: boolean = false;
  waveComplete: boolean = false;
  isBossWave: boolean = false;
  isHordeWave: boolean = false;
  bossSpawned: boolean = false;
  waveModifier: WaveModifier = 'none';
  waveModifierText: string = '';

  constructor() {}

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.isBossWave = waveNumber % 10 === 0; // Boss every 10 waves
    this.isHordeWave = false;
    this.waveModifier = 'none';
    this.waveModifierText = '';

    // Determine wave modifier (not on boss waves)
    if (!this.isBossWave && waveNumber > 1) {
      const roll = Math.random();

      // Every 5th wave (not boss) is a reward wave
      if (waveNumber % 5 === 0) {
        this.waveModifier = 'reward';
        this.waveModifierText = 'REWARD WAVE - Extra gold & XP!';
      }
      // Every 7th wave (not boss/reward) has a miniboss
      else if (waveNumber % 7 === 0) {
        this.waveModifier = 'miniboss';
        this.waveModifierText = 'MINIBOSS WAVE - Elite enemy incoming!';
      }
      // Challenge wave (hard but rewarding). BALANCE: modifiers used to hit
      // 95% of waves — normal waves are the baseline, modifiers the spice
      // (~44%) — and stat-spike modifiers wait until wave 4
      else if (roll < 0.05) {
        this.waveModifier = 'challenge';
        this.waveModifierText = 'CHALLENGE WAVE - Survive for bonus!';
      }
      // Standard modifiers
      else if (roll < 0.15) {
        this.waveModifier = 'horde';
        this.waveModifierText = 'HORDE WAVE - Swarm incoming!';
        this.isHordeWave = true;
      } else if (roll < 0.25 && waveNumber >= 6) {
        this.waveModifier = 'elite';
        this.waveModifierText = 'ELITE WAVE - Tougher enemies!';
      } else if (roll < 0.33) {
        this.waveModifier = 'speed';
        this.waveModifierText = 'SPEED WAVE - Fast enemies!';
      } else if (roll < 0.4 && waveNumber >= 6) {
        this.waveModifier = 'tank';
        this.waveModifierText = 'TANK WAVE - Heavily armored!';
      } else if (roll < 0.44) {
        this.waveModifier = 'chaos';
        this.waveModifierText = 'CHAOS WAVE - Mixed threats!';
      }
    }

    // Calculate enemy count based on modifier - BALANCE: More enemies for swarm feel
    // Wave 1: 12 enemies (gentler intro, ramps up fast)
    let baseCount = waveNumber === 1 ? 18 : 15 + waveNumber * 2;

    if (this.isBossWave) {
      this.totalEnemiesInWave = 10 + waveNumber;
      this.waveModifierText = 'BOSS WAVE - BOSS APPROACHING';
    } else if (this.waveModifier === 'reward') {
      this.totalEnemiesInWave = Math.floor(baseCount * 0.7); // Fewer enemies, more rewards
    } else if (this.waveModifier === 'challenge') {
      this.totalEnemiesInWave = Math.floor(baseCount * 1.5); // More enemies + elite
    } else if (this.waveModifier === 'miniboss') {
      this.totalEnemiesInWave = Math.floor(baseCount * 0.6) + 1; // Miniboss + support
    } else if (this.waveModifier === 'horde') {
      this.totalEnemiesInWave = baseCount * 2;
    } else if (this.waveModifier === 'tank') {
      this.totalEnemiesInWave = Math.floor(baseCount * 0.5);
    } else {
      this.totalEnemiesInWave = baseCount;
    }

    this.waveEnemiesRemaining = this.totalEnemiesInWave;
    // Time-boxed waves (Brotato-style): the wave ends when the timer runs out,
    // scaling gently so late waves stay intense but bounded
    this.waveDuration = Math.min(60, 22 + waveNumber * 1.5);
    this.waveTimer = this.waveDuration;
    this.spawnTimer = 0;
    this.waveActive = true;
    this.waveComplete = false;
    this.bossSpawned = false;
  }

  update(dt: number, enemies: Enemy[], canvasWidth: number, canvasHeight: number): Enemy[] {
    if (!this.waveActive) return enemies;

    this.waveTimer -= dt;
    this.spawnTimer -= dt;

    // Spawn boss at start of boss wave
    if (this.isBossWave && !this.bossSpawned) {
      const boss = this.spawnBoss(canvasWidth, canvasHeight);
      enemies.push(boss);
      this.bossSpawned = true;
    }

    // Spawn miniboss at start of miniboss wave
    if (this.waveModifier === 'miniboss' && !this.bossSpawned) {
      const miniboss = this.spawnMiniboss(canvasWidth, canvasHeight);
      enemies.push(miniboss);
      this.bossSpawned = true;
    }

    // Spawn enemies — cadence derived from wave duration so the full budget
    // lands within ~65% of the wave and density scales with the timer
    if (this.spawnTimer <= 0 && this.waveEnemiesRemaining > 0) {
      const newEnemy = this.spawnEnemy(canvasWidth, canvasHeight);
      enemies.push(newEnemy);
      this.waveEnemiesRemaining--;

      let baseInterval = Math.min(
        1.2,
        Math.max(0.25, (this.waveDuration * 0.65) / this.totalEnemiesInWave)
      );
      if (this.isHordeWave) {
        baseInterval *= 0.6; // 40% faster spawning on horde waves
      }
      this.spawnTimer = baseInterval;
    }

    // Timer expiry: non-boss leftovers despawn WITHOUT rewards and the wave
    // ends — no more soft-locks from fleeing stragglers. Boss waves stay
    // open until the boss dies (trash still despawns, spawning stops).
    if (this.waveTimer <= 0) {
      for (const enemy of enemies) {
        if (!enemy.typeData.isBoss) enemy.dead = true;
        // Once the timer runs out the boss hunts you down — no stalemates
        else enemy.enraged = true;
      }
      this.waveEnemiesRemaining = 0;
      if (!this.isBossWave) {
        this.waveActive = false;
        this.waveComplete = true;
        return enemies;
      }
    }

    // Last stragglers (all spawned, ≤3 alive): enrage — they charge the
    // player instead of fleeing, so kill-all endings stay snappy
    if (this.waveEnemiesRemaining <= 0 && enemies.length <= 3) {
      for (const enemy of enemies) {
        if (!enemy.typeData.isBoss) enemy.enraged = true;
      }
    }

    // Check wave completion
    if (this.waveEnemiesRemaining <= 0 && enemies.length === 0) {
      this.waveActive = false;
      this.waveComplete = true;
    }

    return enemies;
  }

  private spawnBoss(canvasWidth: number, _canvasHeight: number): Enemy {
    // Spawn boss in center top
    const x = canvasWidth / 2;
    const y = -40;

    const waveMultiplier = 1 + (this.currentWave - 1) * 0.15;

    // Choose boss type based on wave number
    let bossType: EnemyType;
    if (this.currentWave === 10) {
      bossType = 'boss_necrolord';
    } else if (this.currentWave === 20) {
      bossType = 'boss_flamefiend';
    } else if (this.currentWave === 30) {
      bossType = 'boss_voidbeast';
    } else if (this.currentWave === 40) {
      bossType = 'boss_stormking';
    } else if (this.currentWave >= 50) {
      bossType = 'boss_ancientgolem';
    } else {
      // Fallback for waves 10, 20, 30, etc.
      const bossPool: EnemyType[] = ['boss_necrolord', 'boss_flamefiend', 'boss_voidbeast', 'boss_stormking', 'boss_ancientgolem'];
      const bossIndex = Math.floor((this.currentWave / 10) % bossPool.length);
      bossType = bossPool[bossIndex];
    }

    const boss = new Enemy(x, y, bossType, waveMultiplier);

    return boss;
  }

  private spawnEnemy(canvasWidth: number, canvasHeight: number): Enemy {
    // Choose enemy type based on wave
    const type = this.chooseEnemyType();

    // Spawn at random edge
    const edge = randomInt(0, 3); // 0=top, 1=right, 2=bottom, 3=left
    let x = 0;
    let y = 0;

    switch (edge) {
      case 0: // Top
        x = randomInt(0, canvasWidth);
        y = -20;
        break;
      case 1: // Right
        x = canvasWidth + 20;
        y = randomInt(0, canvasHeight);
        break;
      case 2: // Bottom
        x = randomInt(0, canvasWidth);
        y = canvasHeight + 20;
        break;
      case 3: // Left
        x = -20;
        y = randomInt(0, canvasHeight);
        break;
    }

    // Wave multiplier for scaling difficulty
    let waveMultiplier = 1 + (this.currentWave - 1) * 0.15;

    // Apply modifier effects
    if (this.waveModifier === 'horde') {
      waveMultiplier *= 0.5; // Half health/damage
    } else if (this.waveModifier === 'elite') {
      waveMultiplier *= 2; // Double health/damage
    } else if (this.waveModifier === 'tank') {
      waveMultiplier *= 2; // Tanky (also scales damage, so keep it sane)
    } else if (this.waveModifier === 'challenge') {
      waveMultiplier *= 1.8; // Tougher enemies
    } else if (this.waveModifier === 'reward') {
      waveMultiplier *= 0.7; // Weaker enemies
    }

    const enemy = new Enemy(x, y, type, waveMultiplier);

    // Apply speed modifier
    if (this.waveModifier === 'speed') {
      enemy.typeData.speed *= 1.5;
    }

    // Horde: double count would double income at full gold — halve per-kill
    if (this.waveModifier === 'horde') {
      enemy.typeData.goldValue = Math.max(1, Math.round(enemy.typeData.goldValue * 0.5));
    }

    // Reward wave: enemies drop 2x gold and XP
    if (this.waveModifier === 'reward') {
      enemy.typeData.goldValue *= 2;
      enemy.typeData.xpValue *= 2;
    }

    // Challenge wave: enemies drop 1.5x gold and XP
    if (this.waveModifier === 'challenge') {
      enemy.typeData.goldValue *= 1.5;
      enemy.typeData.xpValue *= 1.5;
    }

    return enemy;
  }

  private spawnMiniboss(canvasWidth: number, _canvasHeight: number): Enemy {
    // Spawn miniboss at top center (similar to boss)
    const x = canvasWidth / 2;
    const y = -40;

    const waveMultiplier = 1 + (this.currentWave - 1) * 0.2;

    // Choose a strong enemy type for miniboss
    const minibossTypes: EnemyType[] = ['troll', 'cyclops', 'golem', 'necromancer', 'banshee'];
    const type = randomChoice(minibossTypes);

    const miniboss = new Enemy(x, y, type, waveMultiplier * 1.5); // 1.5x stronger than normal

    // Miniboss drops extra rewards
    miniboss.typeData.goldValue *= 2;
    miniboss.typeData.xpValue *= 2;

    return miniboss;
  }

  private chooseEnemyType(): EnemyType {
    const wave = this.currentWave;

    // Chaos wave: complete random mix
    if (this.waveModifier === 'chaos') {
      return randomChoice([
        'slime', 'goblin', 'skeleton', 'bat', 'imp', 'spider', 'orc', 'mimic',
        'wraith', 'wizard', 'necromancer', 'troll', 'banshee', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'phantom', 'druid', 'construct', 'swarm',
        'dasher', 'evader', 'orbiter', 'spiraler',
        'shielder', 'exploder', 'healer', 'summoner', 'phaser'
      ] as EnemyType[]);
    }

    // Wave 1: Mostly slimes with few goblins (easier intro)
    if (wave === 1) {
      return randomChoice(['slime', 'slime', 'slime', 'goblin'] as EnemyType[]);
    }
    // Wave 2: Even mix of slimes and goblins
    else if (wave === 2) {
      return randomChoice(['slime', 'slime', 'goblin', 'goblin'] as EnemyType[]);
    }
    // Wave 3-4: Add bats, ghosts, swarms, dashers
    else if (wave <= 4) {
      return randomChoice(['slime', 'slime', 'goblin', 'goblin', 'bat', 'bat', 'ghost', 'swarm', 'dasher'] as EnemyType[]);
    }
    // Wave 5-6: Add spiders, mimics, mushrooms, blobs, evaders
    else if (wave <= 6) {
      return randomChoice(['slime', 'goblin', 'bat', 'bat', 'spider', 'spider', 'mimic', 'ghost', 'mushroom', 'blob', 'swarm', 'dasher', 'evader', 'spinner'] as EnemyType[]);
    }
    // Wave 7-10: Add skeletons, wizards, imps, phantoms, druids, orbiters
    else if (wave <= 10) {
      return randomChoice([
        'slime', 'goblin', 'bat', 'skeleton', 'skeleton', 'spider', 'spider',
        'wizard', 'wizard', 'imp', 'mimic', 'orc', 'ghost', 'mushroom', 'blob', 'phantom', 'druid', 'swarm',
        'dasher', 'evader', 'orbiter'
      ] as EnemyType[]);
    }
    // Wave 11-15: Add late-game enemies, gargoyles, necroeggs, constructs, spiralers, new advanced types
    else if (wave <= 15) {
      return randomChoice([
        'bat', 'goblin', 'skeleton', 'skeleton', 'spider', 'wizard', 'wizard',
        'imp', 'orc', 'orc', 'mimic', 'wraith', 'necromancer', 'troll', 'banshee',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'phantom', 'druid', 'construct', 'swarm',
        'dasher', 'evader', 'orbiter', 'spiraler',
        'shielder', 'healer', 'summoner'
      ] as EnemyType[]);
    }
    // Wave 16-20: Harder compositions with cyclops and advanced AI, all new types
    else if (wave <= 20) {
      return randomChoice([
        'bat', 'skeleton', 'spider', 'wizard', 'imp', 'imp', 'orc', 'orc',
        'wraith', 'wraith', 'necromancer', 'troll', 'troll', 'banshee', 'banshee', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'phantom', 'druid', 'construct', 'swarm',
        'dasher', 'dasher', 'evader', 'evader', 'orbiter', 'orbiter', 'spiraler', 'spiraler',
        'shielder', 'shielder', 'exploder', 'healer', 'summoner', 'phaser'
      ] as EnemyType[]);
    }
    // Wave 21+: Insane difficulty with heavy advanced AI presence, maximum new types
    else {
      return randomChoice([
        'skeleton', 'spider', 'wizard', 'imp', 'orc', 'wraith', 'wraith',
        'necromancer', 'necromancer', 'troll', 'troll', 'banshee', 'banshee', 'golem', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'cyclops', 'phantom', 'druid', 'construct', 'construct', 'swarm',
        'dasher', 'dasher', 'evader', 'evader', 'orbiter', 'orbiter', 'spiraler', 'spiraler',
        'shielder', 'shielder', 'exploder', 'exploder', 'healer', 'healer', 'summoner', 'summoner', 'phaser', 'phaser'
      ] as EnemyType[]);
    }
  }

  isWaveComplete(): boolean {
    return this.waveComplete;
  }

  reset(): void {
    this.currentWave = 0;
    this.waveEnemiesRemaining = 0;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.waveActive = false;
    this.waveComplete = false;
    this.isBossWave = false;
    this.isHordeWave = false;
    this.bossSpawned = false;
  }

  getWaveProgress(): number {
    const spawned = this.totalEnemiesInWave - this.waveEnemiesRemaining;
    return spawned / this.totalEnemiesInWave;
  }
}
