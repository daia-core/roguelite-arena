// Wave spawning and progression system with bosses

import { Enemy, type EnemyType } from './Enemy';
import { randomChoice, randomInt } from './utils';

export type WaveModifier = 'none' | 'horde' | 'elite' | 'speed' | 'tank' | 'chaos';

export class WaveManager {
  currentWave: number = 0;
  waveEnemiesRemaining: number = 0;
  totalEnemiesInWave: number = 20;
  waveTimer: number = 0;
  waveDuration: number = 35; // 35 seconds per wave
  spawnTimer: number = 0;
  spawnInterval: number = 1.5; // Spawn every 1.5 seconds
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
      if (roll < 0.25) {
        this.waveModifier = 'horde';
        this.waveModifierText = 'HORDE WAVE - Swarm incoming!';
        this.isHordeWave = true;
      } else if (roll < 0.40) {
        this.waveModifier = 'elite';
        this.waveModifierText = 'ELITE WAVE - Tougher enemies!';
      } else if (roll < 0.60) {
        this.waveModifier = 'speed';
        this.waveModifierText = 'SPEED WAVE - Fast enemies!';
      } else if (roll < 0.80) {
        this.waveModifier = 'tank';
        this.waveModifierText = 'TANK WAVE - Heavily armored!';
      } else if (roll < 0.90) {
        this.waveModifier = 'chaos';
        this.waveModifierText = 'CHAOS WAVE - Mixed threats!';
      }
    }

    // Calculate enemy count based on modifier
    let baseCount = 15 + waveNumber * 2;

    if (this.isBossWave) {
      this.totalEnemiesInWave = 10 + waveNumber;
      this.waveModifierText = 'BOSS WAVE - BOSS APPROACHING';
    } else if (this.waveModifier === 'horde') {
      this.totalEnemiesInWave = baseCount * 2;
    } else if (this.waveModifier === 'tank') {
      this.totalEnemiesInWave = Math.floor(baseCount * 0.5);
    } else {
      this.totalEnemiesInWave = baseCount;
    }

    this.waveEnemiesRemaining = this.totalEnemiesInWave;
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

    // Spawn enemies
    if (this.spawnTimer <= 0 && this.waveEnemiesRemaining > 0) {
      const newEnemy = this.spawnEnemy(canvasWidth, canvasHeight);
      enemies.push(newEnemy);
      this.waveEnemiesRemaining--;

      // Faster spawning as waves progress, even faster on horde waves
      let baseInterval = Math.max(0.5, 1.5 - this.currentWave * 0.05);
      if (this.isHordeWave) {
        baseInterval *= 0.6; // 40% faster spawning on horde waves
      }
      this.spawnTimer = baseInterval;
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

    const waveMultiplier = 1 + (this.currentWave - 1) * 0.2;
    const boss = new Enemy(x, y, 'demon', waveMultiplier * 2); // Bosses are 2x stronger

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
      waveMultiplier *= 3; // Triple health
    }

    const enemy = new Enemy(x, y, type, waveMultiplier);

    // Apply speed modifier
    if (this.waveModifier === 'speed') {
      enemy.typeData.speed *= 1.5;
    }

    return enemy;
  }

  private chooseEnemyType(): EnemyType {
    const wave = this.currentWave;

    // Chaos wave: complete random mix
    if (this.waveModifier === 'chaos') {
      return randomChoice([
        'slime', 'goblin', 'skeleton', 'bat', 'imp', 'spider', 'orc', 'mimic',
        'wraith', 'wizard', 'necromancer', 'troll', 'banshee', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'phantom', 'druid', 'construct', 'swarm'
      ] as EnemyType[]);
    }

    // Wave 1-2: Only slimes and goblins
    if (wave <= 2) {
      return randomChoice(['slime', 'slime', 'goblin', 'goblin'] as EnemyType[]);
    }
    // Wave 3-4: Add bats, ghosts, swarms
    else if (wave <= 4) {
      return randomChoice(['slime', 'slime', 'goblin', 'goblin', 'bat', 'bat', 'ghost', 'swarm'] as EnemyType[]);
    }
    // Wave 5-6: Add spiders, mimics, mushrooms, blobs
    else if (wave <= 6) {
      return randomChoice(['slime', 'goblin', 'bat', 'bat', 'spider', 'spider', 'mimic', 'ghost', 'mushroom', 'blob', 'swarm'] as EnemyType[]);
    }
    // Wave 7-10: Add skeletons, wizards, imps, phantoms, druids
    else if (wave <= 10) {
      return randomChoice([
        'slime', 'goblin', 'bat', 'skeleton', 'skeleton', 'spider', 'spider',
        'wizard', 'wizard', 'imp', 'mimic', 'orc', 'ghost', 'mushroom', 'blob', 'phantom', 'druid', 'swarm'
      ] as EnemyType[]);
    }
    // Wave 11-15: Add late-game enemies, gargoyles, necroeggs, constructs
    else if (wave <= 15) {
      return randomChoice([
        'bat', 'goblin', 'skeleton', 'skeleton', 'spider', 'wizard', 'wizard',
        'imp', 'orc', 'orc', 'mimic', 'wraith', 'necromancer', 'troll', 'banshee',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'phantom', 'druid', 'construct', 'swarm'
      ] as EnemyType[]);
    }
    // Wave 16-20: Harder compositions with cyclops
    else if (wave <= 20) {
      return randomChoice([
        'bat', 'skeleton', 'spider', 'wizard', 'imp', 'imp', 'orc', 'orc',
        'wraith', 'wraith', 'necromancer', 'troll', 'troll', 'banshee', 'banshee', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'phantom', 'druid', 'construct', 'swarm'
      ] as EnemyType[]);
    }
    // Wave 21+: Insane difficulty
    else {
      return randomChoice([
        'skeleton', 'spider', 'wizard', 'imp', 'orc', 'wraith', 'wraith',
        'necromancer', 'necromancer', 'troll', 'troll', 'banshee', 'banshee', 'golem', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'cyclops', 'phantom', 'druid', 'construct', 'construct', 'swarm'
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
