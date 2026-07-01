// Wave spawning and progression system

import { Enemy, type EnemyType } from './Enemy';
import { randomChoice, randomInt } from './utils';

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

  constructor() {}

  startWave(waveNumber: number): void {
    this.currentWave = waveNumber;
    this.waveEnemiesRemaining = this.totalEnemiesInWave;
    this.waveTimer = this.waveDuration;
    this.spawnTimer = 0;
    this.waveActive = true;
    this.waveComplete = false;
  }

  update(dt: number, enemies: Enemy[], canvasWidth: number, canvasHeight: number): Enemy[] {
    if (!this.waveActive) return enemies;

    this.waveTimer -= dt;
    this.spawnTimer -= dt;

    // Spawn enemies
    if (this.spawnTimer <= 0 && this.waveEnemiesRemaining > 0) {
      const newEnemy = this.spawnEnemy(canvasWidth, canvasHeight);
      enemies.push(newEnemy);
      this.waveEnemiesRemaining--;
      this.spawnTimer = this.spawnInterval;
    }

    // Check wave completion
    if (this.waveEnemiesRemaining <= 0 && enemies.length === 0) {
      this.waveActive = false;
      this.waveComplete = true;
    }

    return enemies;
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
    // Enemy type distribution changes with waves
    const wave = this.currentWave;

    if (wave <= 2) {
      // Early waves: mostly basic
      return randomChoice(['basic', 'basic', 'basic', 'fast'] as EnemyType[]);
    } else if (wave <= 5) {
      // Mid waves: mix
      return randomChoice(['basic', 'basic', 'fast', 'tank'] as EnemyType[]);
    } else if (wave <= 10) {
      // Late waves: introduce shooters
      return randomChoice(['basic', 'fast', 'tank', 'shooter'] as EnemyType[]);
    } else {
      // End game: more difficult enemies
      return randomChoice(['basic', 'fast', 'fast', 'tank', 'shooter', 'shooter'] as EnemyType[]);
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
  }

  getWaveProgress(): number {
    const spawned = this.totalEnemiesInWave - this.waveEnemiesRemaining;
    return spawned / this.totalEnemiesInWave;
  }
}
