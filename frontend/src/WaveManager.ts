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
    this.isBossWave = waveNumber % 5 === 0; // Boss every 5 waves
    this.isHordeWave = !this.isBossWave && waveNumber % 3 === 0; // Horde every 3 waves (when not boss)

    // Boss waves have fewer regular enemies
    if (this.isBossWave) {
      this.totalEnemiesInWave = 10 + waveNumber;
    } else if (this.isHordeWave) {
      // Horde waves: 2x normal enemies
      this.totalEnemiesInWave = (15 + waveNumber * 2) * 2;
    } else {
      this.totalEnemiesInWave = 15 + waveNumber * 2;
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
    const waveMultiplier = 1 + (this.currentWave - 1) * 0.15;

    return new Enemy(x, y, type, waveMultiplier);
  }

  private chooseEnemyType(): EnemyType {
    const wave = this.currentWave;

    // Wave 1-5: Only slimes and goblins
    if (wave <= 5) {
      return randomChoice(['slime', 'slime', 'goblin', 'goblin'] as EnemyType[]);
    }
    // Wave 6-10: Add skeletons, imps, orcs
    else if (wave <= 10) {
      return randomChoice(['slime', 'goblin', 'goblin', 'skeleton', 'skeleton', 'imp', 'orc'] as EnemyType[]);
    }
    // Wave 11-15: All enemy types, mixed waves
    else if (wave <= 15) {
      return randomChoice([
        'slime', 'goblin', 'skeleton', 'skeleton', 'imp', 'orc', 'orc',
        'wraith', 'necromancer', 'troll', 'banshee'
      ] as EnemyType[]);
    }
    // Wave 16-20: Harder compositions, more enemies
    else if (wave <= 20) {
      return randomChoice([
        'goblin', 'skeleton', 'skeleton', 'imp', 'imp', 'orc', 'orc',
        'wraith', 'wraith', 'necromancer', 'troll', 'troll', 'banshee', 'banshee'
      ] as EnemyType[]);
    }
    // Wave 21+: Insane difficulty
    else {
      return randomChoice([
        'skeleton', 'imp', 'orc', 'orc', 'wraith', 'wraith',
        'necromancer', 'necromancer', 'troll', 'troll', 'banshee', 'banshee'
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
