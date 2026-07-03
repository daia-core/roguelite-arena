// Wave spawning and progression system with bosses, formations and sub-phases.
//
// Each wave is more than "spawn N randoms": it has a THEME (a curated enemy
// pool + flavour text), releases enemies in FORMATIONS (lines, pincers, rings,
// worm chains, egg clutches) rather than one-at-a-time from random edges, and
// can run WAVES-WITHIN-WAVES — mid-wave phase shifts that announce a new threat
// ("The ground splits — worms!") and swap the active formation/pool. Bosses and
// minibosses are scaled, styled and carry the telegraphed-AoE patterns.

import { Enemy, type EnemyType } from './Enemy';
import { randomChoice, randomInt } from './utils';

export type WaveModifier = 'none' | 'horde' | 'elite' | 'speed' | 'tank' | 'chaos' | 'reward' | 'challenge' | 'miniboss';

export type Formation = 'scatter' | 'line' | 'vee' | 'ring' | 'pincer' | 'cluster' | 'worm' | 'eggclutch';

/** A mid-wave phase: its own enemy budget, formation bias and announcement. */
interface WavePhase {
  text: string;
  /** Fraction 0..1 of the wave's total enemies released in this phase. */
  budgetFrac: number;
  formations: Formation[];
  /** Optional pool override; falls back to the wave's default pool. */
  pool?: EnemyType[];
}

export class WaveManager {
  currentWave: number = 0;
  waveEnemiesRemaining: number = 0;
  totalEnemiesInWave: number = 20;
  waveTimer: number = 0;
  waveDuration: number = 30;
  spawnTimer: number = 0;
  spawnInterval: number = 1.2;
  waveActive: boolean = false;
  waveComplete: boolean = false;
  isBossWave: boolean = false;
  isHordeWave: boolean = false;
  bossSpawned: boolean = false;
  waveModifier: WaveModifier = 'none';
  waveModifierText: string = '';

  // Waves-within-waves: an ordered list of phases for the current wave. Each
  // phase releases its slice of the budget then the next phase's banner fires.
  private phases: WavePhase[] = [];
  private phaseIndex: number = 0;
  private phaseBudgetRemaining: number = 0;
  /** Set true for one poll so Game can flash the new phase's banner. */
  phaseJustChanged: boolean = false;
  /** The current sub-phase banner text (Game reads this to announce it). */
  phaseText: string = '';

  static readonly BOSS_GRACE_SEC = 45;

  /**
   * Flat HP-only survivability multiplier applied to every regular spawned enemy
   * (on top of the wave-scale HP). This makes fodder actually TANK a few hits so
   * the flood reads as a swarm you carve through, not a field of one-frame pops —
   * even against a broken build. It scales enemy HEALTH only, never damage, so a
   * denser tankier arena doesn't also start one-shotting the player.
   */
  static readonly FLOOD_HP_MULT = 2.2;

  constructor() {}

  /**
   * Start a wave. `opts` lets the map layer force a node's flavour:
   *   • elite → guaranteed elite modifier (tougher enemies, better loot)
   *   • boss  → treat as a boss wave regardless of the wave number
   * When neither is set the usual number-based boss check + random modifier roll runs.
   */
  startWave(waveNumber: number, opts?: { elite?: boolean; boss?: boolean }): void {
    this.currentWave = waveNumber;
    this.isBossWave = waveNumber % 10 === 0 || !!opts?.boss;
    this.isHordeWave = false;
    this.waveModifier = 'none';
    this.waveModifierText = '';
    this.phases = [];
    this.phaseIndex = 0;
    this.phaseJustChanged = false;
    this.phaseText = '';

    if (opts?.elite && !this.isBossWave) {
      // Map "elite battle" node: force the elite modifier, skip the random roll.
      this.waveModifier = 'elite';
      this.waveModifierText = 'ELITE BATTLE - Tougher enemies, better loot!';
    } else if (!this.isBossWave && waveNumber > 1) {
      const roll = Math.random();
      if (waveNumber % 5 === 0) {
        this.waveModifier = 'reward';
        this.waveModifierText = 'REWARD WAVE - Extra gold & XP!';
      } else if (waveNumber % 7 === 0) {
        this.waveModifier = 'miniboss';
        this.waveModifierText = 'MINIBOSS WAVE - Elite enemy incoming!';
      } else if (roll < 0.05) {
        this.waveModifier = 'challenge';
        this.waveModifierText = 'CHALLENGE WAVE - Survive for bonus!';
      } else if (roll < 0.15) {
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

    // Density ramps with depth: linear early, then a compounding late-game term so
    // deep waves are a genuine swarm (released over the wave duration, so on-screen
    // concurrency stays bounded by how fast you clear).
    // Vampire-Survivors flood: much larger budgets so the arena stays packed. The
    // late-game term compounds harder and the per-wave slope is steeper, so even
    // mid waves feel like a horde rather than a trickle.
    const lateDensity = Math.floor(Math.pow(Math.max(0, waveNumber - 10), 2.0) * 1.1);
    let baseCount = waveNumber === 1 ? 45 : 40 + waveNumber * 7 + lateDensity;

    if (this.isBossWave) {
      this.totalEnemiesInWave = 18 + waveNumber * 2;
      this.waveModifierText = 'BOSS WAVE - BOSS APPROACHING';
    } else if (this.waveModifier === 'reward') {
      this.totalEnemiesInWave = Math.floor(baseCount * 0.7);
    } else if (this.waveModifier === 'challenge') {
      this.totalEnemiesInWave = Math.floor(baseCount * 1.5);
    } else if (this.waveModifier === 'miniboss') {
      this.totalEnemiesInWave = Math.floor(baseCount * 0.6) + 1;
    } else if (this.waveModifier === 'horde') {
      this.totalEnemiesInWave = baseCount * 2;
    } else if (this.waveModifier === 'tank') {
      this.totalEnemiesInWave = Math.floor(baseCount * 0.5);
    } else {
      this.totalEnemiesInWave = baseCount;
    }

    this.waveEnemiesRemaining = this.totalEnemiesInWave;
    this.waveDuration = Math.min(60, 22 + waveNumber * 1.5);
    this.waveTimer = this.waveDuration;
    this.spawnTimer = 0;
    this.waveActive = true;
    this.waveComplete = false;
    this.bossSpawned = false;

    // Build the wave's phase plan (waves-within-waves) unless it's a boss wave.
    if (!this.isBossWave) {
      this.buildPhases(waveNumber);
      this.phaseIndex = 0;
      this.phaseBudgetRemaining = Math.max(1, Math.round(this.totalEnemiesInWave * this.phases[0].budgetFrac));
      this.phaseText = this.phases[0].text;
    }
  }

  /**
   * Compose the ordered sub-phases for a wave. Early waves stay simple (one
   * phase). From wave ~4 they gain a second "and now THIS" beat; later waves
   * chain 2-3 phases with escalating formations and the special enemy types.
   */
  private buildPhases(wave: number): void {
    const themePool = this.themePool(wave);

    // Wave 1-3: single straightforward phase — teach the basics.
    if (wave <= 3) {
      this.phases = [{
        text: this.waveIntroText(wave),
        budgetFrac: 1,
        formations: wave === 1 ? ['scatter'] : ['scatter', 'line']
      }];
      return;
    }

    // Chaos wave: one frantic mixed phase, all formations.
    if (this.waveModifier === 'chaos') {
      this.phases = [{
        text: 'CHAOS - everything at once!',
        budgetFrac: 1,
        formations: ['scatter', 'pincer', 'ring', 'cluster']
      }];
      return;
    }

    const phases: WavePhase[] = [];

    // Opening skirmish — a formed advance rather than a trickle.
    phases.push({
      text: this.waveIntroText(wave),
      budgetFrac: 0.45,
      formations: ['line', 'vee', 'scatter']
    });

    // Mid beat: a special-enemy set piece unlocks as waves climb.
    if (wave >= 8 && wave % 2 === 0) {
      phases.push({
        text: 'The ground splits — WORMS!',
        budgetFrac: 0.3,
        formations: ['worm', 'worm'],
        pool: ['wormhead']
      });
    } else if (wave >= 6) {
      phases.push({
        text: 'A clutch of eggs erupts — destroy them fast!',
        budgetFrac: 0.28,
        formations: ['eggclutch'],
        pool: ['eggsac']
      });
    } else {
      phases.push({
        text: 'Reinforcements flank you!',
        budgetFrac: 0.3,
        formations: ['pincer', 'ring']
      });
    }

    // Closing surge: a heavy formed push, bombardiers arc AoE from the back.
    const closingPool = wave >= 7 ? [...themePool, 'bombardier' as EnemyType] : themePool;
    phases.push({
      text: 'Final surge — hold the line!',
      budgetFrac: 0.25,
      formations: ['cluster', 'ring', 'pincer'],
      pool: closingPool
    });

    this.phases = phases;
  }

  /** Curated flavour intro per wave band, so each wave feels named, not numbered. */
  private waveIntroText(wave: number): string {
    const lines: Record<number, string> = {
      1: 'Wave 1 - First blood. Slimes approach.',
      2: 'Wave 2 - The goblins have noticed you.',
      3: 'Wave 3 - Wings in the dark.',
      4: 'Wave 4 - Skittering legs close in.',
      5: 'Wave 5 - Something bigger stirs.'
    };
    if (lines[wave]) return lines[wave];
    const bands = [
      'The swarm thickens.',
      'Darker things crawl out.',
      'The horde grows bold.',
      'They come in numbers now.',
      'The arena howls for you.',
      'No mercy from here on.'
    ];
    return `Wave ${wave} - ${bands[wave % bands.length]}`;
  }

  update(dt: number, enemies: Enemy[], canvasWidth: number, canvasHeight: number): Enemy[] {
    if (!this.waveActive) return enemies;

    this.phaseJustChanged = false;
    this.waveTimer -= dt;
    this.spawnTimer -= dt;

    if (this.isBossWave && !this.bossSpawned) {
      enemies.push(this.spawnBoss(canvasWidth, canvasHeight));
      this.bossSpawned = true;
    }

    if (this.waveModifier === 'miniboss' && !this.bossSpawned) {
      enemies.push(this.spawnMiniboss(canvasWidth, canvasHeight));
      this.bossSpawned = true;
    }

    // Formation-based spawning: each tick releases one FORMATION (a cluster of
    // related enemies placed together) drawn from the current phase.
    if (this.spawnTimer <= 0 && this.waveEnemiesRemaining > 0) {
      // Advance sub-phase if this phase's budget is spent (waves-within-waves).
      if (!this.isBossWave && this.phaseBudgetRemaining <= 0 && this.phaseIndex < this.phases.length - 1) {
        this.phaseIndex++;
        this.phaseBudgetRemaining = Math.max(1, Math.round(this.totalEnemiesInWave * this.phases[this.phaseIndex].budgetFrac));
        this.phaseText = this.phases[this.phaseIndex].text;
        this.phaseJustChanged = true;
      }

      const phase = this.phases[this.phaseIndex];
      const formation: Formation = this.isBossWave
        ? 'scatter'
        : randomChoice(phase ? phase.formations : ['scatter']);

      const spawned = this.spawnFormation(formation, canvasWidth, canvasHeight, phase?.pool);
      for (const e of spawned) enemies.push(e);
      this.waveEnemiesRemaining -= spawned.length;
      this.phaseBudgetRemaining -= spawned.length;

      // Flood pacing: spawn fast so the arena stays packed (Vampire-Survivors
      // density). Formations arrive in quick succession rather than being spread
      // thin across the whole wave — the wave clears by killing, not by waiting.
      let baseInterval = Math.min(
        0.55,
        Math.max(0.16, (this.waveDuration * 0.35 * spawned.length) / this.totalEnemiesInWave)
      );
      if (this.isHordeWave) baseInterval *= 0.6;
      this.spawnTimer = baseInterval;
    }

    if (this.waveTimer <= 0) {
      for (const enemy of enemies) {
        if (!enemy.typeData.isBoss) enemy.dead = true;
        else enemy.enraged = true;
      }
      this.waveEnemiesRemaining = 0;
      if (!this.isBossWave) {
        this.waveActive = false;
        this.waveComplete = true;
        return enemies;
      }
      if (this.waveTimer <= -WaveManager.BOSS_GRACE_SEC) {
        for (const enemy of enemies) enemy.dead = true;
        this.waveActive = false;
        this.waveComplete = true;
        return enemies;
      }
    }

    if (this.waveEnemiesRemaining <= 0 && enemies.length <= 3) {
      for (const enemy of enemies) {
        if (!enemy.typeData.isBoss) enemy.enraged = true;
      }
    }

    if (this.waveEnemiesRemaining <= 0 && enemies.length === 0) {
      this.waveActive = false;
      this.waveComplete = true;
    }

    return enemies;
  }

  // ---- Formations ----------------------------------------------------------

  /**
   * Build one formation of enemies placed together. Returns the list to push.
   * Placement uses a spawn anchor just off a random edge and lays enemies out
   * relative to it, so groups arrive as a shape (a line abreast, a V, a ring,
   * a two-sided pincer, a tight cluster, a linked worm, or an egg clutch).
   */
  private spawnFormation(
    formation: Formation,
    cw: number,
    ch: number,
    poolOverride?: EnemyType[]
  ): Enemy[] {
    const remaining = this.waveEnemiesRemaining;

    switch (formation) {
      case 'worm':
        return this.spawnWorm(cw, ch, Math.min(remaining, 1));
      case 'eggclutch': {
        const n = Math.min(remaining, randomInt(2, 3));
        const { x, y } = this.edgeAnchor(cw, ch);
        const out: Enemy[] = [];
        for (let i = 0; i < n; i++) {
          const ex = x + (Math.random() - 0.5) * 90;
          const ey = y + (Math.random() - 0.5) * 90;
          out.push(this.makeEnemy('eggsac', ex, ey, poolOverride));
        }
        return out;
      }
      case 'line': {
        const n = Math.min(remaining, this.isHordeWave ? 10 : 7);
        const { x, y, inx, iny } = this.edgeAnchor(cw, ch);
        // Perpendicular spread so they arrive abreast.
        const px = -iny, py = inx;
        const out: Enemy[] = [];
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 46;
          out.push(this.makeEnemy(this.pick(poolOverride), x + px * off, y + py * off, poolOverride));
        }
        return out;
      }
      case 'vee': {
        const n = Math.min(remaining, 8);
        const { x, y, inx, iny } = this.edgeAnchor(cw, ch);
        const px = -iny, py = inx;
        const out: Enemy[] = [];
        for (let i = 0; i < n; i++) {
          const rank = i - Math.floor(n / 2);
          const along = -Math.abs(rank) * 40; // point leads, wings trail
          const across = rank * 40;
          out.push(this.makeEnemy(
            this.pick(poolOverride),
            x + inx * along + px * across,
            y + iny * along + py * across,
            poolOverride
          ));
        }
        return out;
      }
      case 'ring': {
        const n = Math.min(remaining, 9);
        const { x, y } = this.edgeAnchor(cw, ch);
        const out: Enemy[] = [];
        const r = 60;
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n;
          out.push(this.makeEnemy(this.pick(poolOverride), x + Math.cos(a) * r, y + Math.sin(a) * r, poolOverride));
        }
        return out;
      }
      case 'pincer': {
        // Two groups from OPPOSITE edges to squeeze the player.
        const n = Math.min(remaining, 10);
        const half = Math.ceil(n / 2);
        const out: Enemy[] = [];
        const edge = randomInt(0, 1); // 0 = left/right, 1 = top/bottom
        const spots = edge === 0
          ? [{ x: -20, y: ch / 2 }, { x: cw + 20, y: ch / 2 }]
          : [{ x: cw / 2, y: -20 }, { x: cw / 2, y: ch + 20 }];
        for (let s = 0; s < 2; s++) {
          const count = s === 0 ? half : n - half;
          for (let i = 0; i < count; i++) {
            const jx = (Math.random() - 0.5) * 70;
            const jy = (Math.random() - 0.5) * 70;
            out.push(this.makeEnemy(this.pick(poolOverride), spots[s].x + jx, spots[s].y + jy, poolOverride));
          }
        }
        return out;
      }
      case 'cluster': {
        const n = Math.min(remaining, this.isHordeWave ? 10 : 7);
        const { x, y } = this.edgeAnchor(cw, ch);
        const out: Enemy[] = [];
        for (let i = 0; i < n; i++) {
          const jx = (Math.random() - 0.5) * 60;
          const jy = (Math.random() - 0.5) * 60;
          out.push(this.makeEnemy(this.pick(poolOverride), x + jx, y + jy, poolOverride));
        }
        return out;
      }
      case 'scatter':
      default: {
        const n = Math.min(remaining, this.isHordeWave ? 10 : 7);
        const out: Enemy[] = [];
        for (let i = 0; i < n; i++) {
          const { x, y } = this.edgeAnchor(cw, ch);
          out.push(this.makeEnemy(this.pick(poolOverride), x, y, poolOverride));
        }
        return out;
      }
    }
  }

  /**
   * Spawn a single segmented worm: a head + a run of body segments, each linking
   * to the one ahead via `wormLeader`. Killing a body segment splits the chain
   * (handled in Game.splitWorm).
   */
  private spawnWorm(cw: number, ch: number, _budget: number): Enemy[] {
    const { x, y, inx, iny } = this.edgeAnchor(cw, ch);
    const segments = randomInt(4, 6);
    const gap = 26;
    const out: Enemy[] = [];
    let leader: Enemy | null = null;
    for (let i = 0; i < segments; i++) {
      // Lay segments back along the entry direction so the tail is off-screen.
      const sx = x - inx * gap * i;
      const sy = y - iny * gap * i;
      const type: EnemyType = i === 0 ? 'wormhead' : 'wormbody';
      const seg = this.makeEnemy(type, sx, sy);
      seg.wormLeader = leader;
      seg.wormIsHead = i === 0;
      seg.wormFollowGap = gap;
      leader = seg;
      out.push(seg);
    }
    return out;
  }

  /** A random spawn anchor just off one edge, plus the inward unit direction. */
  private edgeAnchor(cw: number, ch: number): { x: number; y: number; inx: number; iny: number } {
    const edge = randomInt(0, 3);
    switch (edge) {
      case 0: return { x: randomInt(0, cw), y: -20, inx: 0, iny: 1 };
      case 1: return { x: cw + 20, y: randomInt(0, ch), inx: -1, iny: 0 };
      case 2: return { x: randomInt(0, cw), y: ch + 20, inx: 0, iny: -1 };
      default: return { x: -20, y: randomInt(0, ch), inx: 1, iny: 0 };
    }
  }

  /** Pick an enemy type from the override pool or the current wave theme. */
  private pick(poolOverride?: EnemyType[]): EnemyType {
    if (poolOverride && poolOverride.length) return randomChoice(poolOverride);
    return this.chooseEnemyType();
  }

  /**
   * Enemy stat multiplier (HP + damage) for a given wave.
   *
   * The old curve was flat linear (+15%/wave), so wave 13 was only ~2.8x base —
   * trivial once a build snowballs. This keeps the first several waves basically
   * unchanged (the early-game teaching curve) but COMPOUNDS from wave 8 on, so
   * depth actually bites: enemies get genuinely tanky and hit genuinely hard the
   * deeper you push, matching the exponential power a stacked build reaches.
   *   wave 5  -> ~1.6x  wave 7  -> ~1.9x  wave 10 -> ~3.9x
   *   wave 15 -> ~12x   wave 20 -> ~33x   wave 30 -> ~241x
   * A truly broken build will still shred trash (genre norm) — the depth curve
   * bites via enemy DAMAGE + density + tanky elites/bosses, not TTK on fodder.
   * BALANCE 2026-07-03 (v1): player power lapped the curve by ~wave 7 (owner hit
   * 25M dmg / 927x crit / every stat maxed), so the linear slope was steepened and
   * the compound term moved to start at wave 4 (wave 20 -> ~73x).
   * BALANCE 2026-07-03 (v2, sim-driven): the v1 curve over-corrected the EARLY game —
   * the headless kite-bot died at wave 3-6 (8/8 runs, avg ~4), swarmed before a run
   * has any defensive items. Softened the linear slope back to 0.15 and delayed the
   * compound onset to wave 7 (where a run has picked up items), keeping the late-game
   * bite high (wave 20 ~33x, well above the old immortality-causing 12x) while giving
   * fresh runs room to establish. Empirically tuned via tools/qa/simulate-balance.mjs,
   * honoring the "enemies scale to meet your combat output" uncapped-combat contract.
   */
  static waveScale(wave: number): number {
    const linear = 1 + (wave - 1) * 0.15;
    const compound = Math.pow(1.18, Math.max(0, wave - 7));
    return linear * compound;
  }

  /** Construct an enemy at a position with all wave-modifier scaling applied. */
  private makeEnemy(type: EnemyType, x: number, y: number, _poolOverride?: EnemyType[]): Enemy {
    let waveMultiplier = WaveManager.waveScale(this.currentWave);
    if (this.waveModifier === 'horde') waveMultiplier *= 0.5;
    else if (this.waveModifier === 'elite') waveMultiplier *= 2;
    else if (this.waveModifier === 'tank') waveMultiplier *= 2;
    else if (this.waveModifier === 'challenge') waveMultiplier *= 1.8;
    else if (this.waveModifier === 'reward') waveMultiplier *= 0.7;

    const enemy = new Enemy(x, y, type, waveMultiplier);

    // Flood survivability: bump HP only (not damage) so enemies survive a few
    // hits even against a snowballed build. maxHealth/health are re-synced.
    enemy.typeData.health *= WaveManager.FLOOD_HP_MULT;
    enemy.maxHealth = enemy.typeData.health;
    enemy.health = enemy.maxHealth;

    if (this.waveModifier === 'speed') enemy.typeData.speed *= 1.5;
    if (this.waveModifier === 'horde') {
      enemy.typeData.goldValue = Math.max(1, Math.round(enemy.typeData.goldValue * 0.5));
    }
    if (this.waveModifier === 'reward') {
      enemy.typeData.goldValue *= 2;
      enemy.typeData.xpValue *= 2;
    }
    if (this.waveModifier === 'challenge') {
      enemy.typeData.goldValue *= 1.5;
      enemy.typeData.xpValue *= 1.5;
    }
    return enemy;
  }

  private spawnBoss(canvasWidth: number, _canvasHeight: number): Enemy {
    const x = canvasWidth / 2;
    const y = -40;
    const waveMultiplier = WaveManager.waveScale(this.currentWave);

    let bossType: EnemyType;
    if (this.currentWave === 10) bossType = 'boss_necrolord';
    else if (this.currentWave === 20) bossType = 'boss_flamefiend';
    else if (this.currentWave === 30) bossType = 'boss_voidbeast';
    else if (this.currentWave === 40) bossType = 'boss_stormking';
    else if (this.currentWave >= 50) bossType = 'boss_ancientgolem';
    else {
      const bossPool: EnemyType[] = ['boss_necrolord', 'boss_flamefiend', 'boss_voidbeast', 'boss_stormking', 'boss_ancientgolem'];
      const bossIndex = Math.floor((this.currentWave / 10) % bossPool.length);
      bossType = bossPool[bossIndex];
    }

    // Beef bosses so they're a real check, not a speed-bump: HP scales harder
    // with depth than trash does. (Balance sim, 2026-07-02, showed late bosses
    // melting in seconds against a stacked build.)
    const boss = new Enemy(x, y, bossType, waveMultiplier);
    const depth = Math.max(0, this.currentWave / 10 - 1);
    boss.typeData.health *= 1 + depth * 0.35;
    boss.maxHealth = boss.typeData.health;
    boss.health = boss.maxHealth;
    return boss;
  }

  private spawnMiniboss(canvasWidth: number, _canvasHeight: number): Enemy {
    const x = canvasWidth / 2;
    const y = -40;
    const waveMultiplier = WaveManager.waveScale(this.currentWave) * 1.3;

    // A styled, oversized version of a strong regular enemy — bigger, tougher,
    // faster-hitting, and marked as a miniboss so it draws with a menacing tint
    // and a boss-style health bar.
    const minibossTypes: EnemyType[] = ['troll', 'cyclops', 'golem', 'necromancer', 'banshee', 'summoner'];
    const type = randomChoice(minibossTypes);

    const miniboss = new Enemy(x, y, type, waveMultiplier * 1.6);
    miniboss.isMiniboss = true;
    // Physically larger + tougher so it reads as a distinct threat.
    miniboss.typeData.radius = Math.round(miniboss.typeData.radius * 1.6);
    miniboss.typeData.health *= 1.4;
    miniboss.maxHealth = miniboss.typeData.health;
    miniboss.health = miniboss.maxHealth;
    miniboss.typeData.damage = Math.round(miniboss.typeData.damage * 1.25);
    miniboss.typeData.goldValue *= 3;
    miniboss.typeData.xpValue *= 3;
    return miniboss;
  }

  private chooseEnemyType(): EnemyType {
    const wave = this.currentWave;

    if (this.waveModifier === 'chaos') {
      return randomChoice([
        'slime', 'goblin', 'skeleton', 'bat', 'imp', 'spider', 'orc', 'mimic',
        'wraith', 'wizard', 'necromancer', 'troll', 'banshee', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'phantom', 'druid', 'construct', 'swarm',
        'dasher', 'evader', 'orbiter', 'spiraler',
        'shielder', 'exploder', 'healer', 'summoner', 'phaser', 'bombardier'
      ] as EnemyType[]);
    }

    if (wave === 1) {
      return randomChoice(['slime', 'slime', 'slime', 'goblin'] as EnemyType[]);
    } else if (wave === 2) {
      return randomChoice(['slime', 'slime', 'goblin', 'goblin'] as EnemyType[]);
    } else if (wave <= 4) {
      return randomChoice(['slime', 'slime', 'goblin', 'goblin', 'bat', 'bat', 'ghost', 'swarm', 'dasher'] as EnemyType[]);
    } else if (wave <= 6) {
      return randomChoice(['slime', 'goblin', 'bat', 'bat', 'spider', 'spider', 'mimic', 'ghost', 'mushroom', 'blob', 'swarm', 'dasher', 'evader', 'spinner'] as EnemyType[]);
    } else if (wave <= 10) {
      return randomChoice([
        'slime', 'goblin', 'bat', 'skeleton', 'skeleton', 'spider', 'spider',
        'wizard', 'wizard', 'imp', 'mimic', 'orc', 'ghost', 'mushroom', 'blob', 'phantom', 'druid', 'swarm',
        'dasher', 'evader', 'orbiter', 'bombardier'
      ] as EnemyType[]);
    } else if (wave <= 15) {
      return randomChoice([
        'bat', 'goblin', 'skeleton', 'skeleton', 'spider', 'wizard', 'wizard',
        'imp', 'orc', 'orc', 'mimic', 'wraith', 'necromancer', 'troll', 'banshee',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'phantom', 'druid', 'construct', 'swarm',
        'dasher', 'evader', 'orbiter', 'spiraler',
        'shielder', 'healer', 'summoner', 'bombardier'
      ] as EnemyType[]);
    } else if (wave <= 20) {
      return randomChoice([
        'bat', 'skeleton', 'spider', 'wizard', 'imp', 'imp', 'orc', 'orc',
        'wraith', 'wraith', 'necromancer', 'troll', 'troll', 'banshee', 'banshee', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'phantom', 'druid', 'construct', 'swarm',
        'dasher', 'dasher', 'evader', 'evader', 'orbiter', 'orbiter', 'spiraler', 'spiraler',
        'shielder', 'shielder', 'exploder', 'healer', 'summoner', 'phaser', 'bombardier', 'bombardier'
      ] as EnemyType[]);
    } else {
      return randomChoice([
        'skeleton', 'spider', 'wizard', 'imp', 'orc', 'wraith', 'wraith',
        'necromancer', 'necromancer', 'troll', 'troll', 'banshee', 'banshee', 'golem', 'golem',
        'ghost', 'mushroom', 'gargoyle', 'gargoyle', 'blob', 'necroegg', 'cyclops', 'cyclops', 'phantom', 'druid', 'construct', 'construct', 'swarm',
        'dasher', 'dasher', 'evader', 'evader', 'orbiter', 'orbiter', 'spiraler', 'spiraler',
        'shielder', 'shielder', 'exploder', 'exploder', 'healer', 'healer', 'summoner', 'summoner', 'phaser', 'phaser', 'bombardier', 'bombardier'
      ] as EnemyType[]);
    }
  }

  /** The plain (non-override) enemy pool for the current wave — used by phases. */
  private themePool(wave: number): EnemyType[] {
    // Sample the wave's own distribution a handful of times for a representative
    // theme set (kept small; formations pick from it).
    const set = new Set<EnemyType>();
    for (let i = 0; i < 8; i++) set.add(this.chooseEnemyType());
    void wave;
    return [...set];
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
    this.phases = [];
    this.phaseIndex = 0;
    this.phaseText = '';
    this.phaseJustChanged = false;
  }

  getWaveProgress(): number {
    const spawned = this.totalEnemiesInWave - this.waveEnemiesRemaining;
    return spawned / this.totalEnemiesInWave;
  }
}
