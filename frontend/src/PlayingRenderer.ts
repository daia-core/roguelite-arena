// PlayingRenderer — extracted from Game.ts (step 16 of de-god-classing)
// Owns: drawPlaying()
// Pure read + render — no mutation of core game state.

import { Player } from './Player';
import { Enemy } from './Enemy';
import { Particle, DamageNumber } from './Particle';
import { Projectile } from './Projectile';
import { MeleeAttack } from './MeleeAttack';
import { Shockwave, Bomb, OrbitingOrb } from './Weapons';
import { AoeZone } from './AoeZone';
import { SpawnTelegraph } from './SpawnTelegraph';
import { HealthOrb, XPOrb, CoinPickup } from './Pickup';
import { WaveManager } from './WaveManager';
import { Renderer } from './Renderer';
import { EntityCuller } from './EntityCuller';
import { ParticleBatchRenderer } from './ParticleBatchRenderer';
import { PerformanceMonitor } from './PerformanceMonitor';
import { QualityManager } from './QualityManager';
import { ScreenEffects } from './ScreenEffects';
import { Input } from './Input';
import { HUDRenderer } from './HUDRenderer';
import { Quadtree } from './Quadtree';

export interface PlayingRendererDeps {
  // Stable references — passed by constructor, never change during a run
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  entityCuller: EntityCuller;
  particleBatchRenderer: ParticleBatchRenderer;
  performanceMonitor: PerformanceMonitor;
  qualityManager: QualityManager;
  screenEffects: ScreenEffects;
  input: Input;
  hudRenderer: HUDRenderer;
  waveManager: WaveManager;
  enemyQuadtree: Quadtree<any>;
  WORLD_SCALE: number;

  // Array getters — arrays can be replaced by-ref on wave reset, so getters
  // ensure we always read the live array, not a constructor-time snapshot.
  getParticles(): Particle[];
  getProjectiles(): Projectile[];
  getMeleeAttacks(): MeleeAttack[];
  getShockwaves(): Shockwave[];
  getBombs(): Bomb[];
  getAoeZones(): AoeZone[];
  getSpawnTelegraphs(): SpawnTelegraph[];
  getEnemies(): Enemy[];
  getHealthOrbs(): HealthOrb[];
  getXpOrbs(): XPOrb[];
  getCoins(): CoinPickup[];
  getOrbitingOrbs(): OrbitingOrb[];
  getDamageNumbers(): DamageNumber[];
  getPlayer(): Player | null;

  // Scalar getters — change at runtime (timers, text)
  getWaveModifierTimer(): number;
  getPhaseBannerTimer(): number;
  getPhaseBannerText(): string;
}

export class PlayingRenderer {
  private deps: PlayingRendererDeps;

  constructor(deps: PlayingRendererDeps) {
    this.deps = deps;
  }

  draw(): void {
    if (!this.deps.getPlayer()) return;
    const player = this.deps.getPlayer()!;

    const ctx = this.deps.renderer.getContext();

    ctx.save();

    // PERFORMANCE: Update entity culler viewport
    this.deps.entityCuller.updateViewport(0, 0, this.deps.canvas.width * this.deps.WORLD_SCALE, this.deps.canvas.height * this.deps.WORLD_SCALE, 100);

    // ZOOM-OUT: render the world at 1/scale so the 2x-larger arena fits the screen
    // (player/monsters read smaller, more battlefield visible). GUI is drawn after
    // this transform is restored, so it stays full-size in screen space.
    ctx.save();
    ctx.scale(1 / this.deps.WORLD_SCALE, 1 / this.deps.WORLD_SCALE);

    // PERFORMANCE: Batch render particles (40-60% faster than individual draws)
    const isMobile = this.deps.canvas.width < this.deps.canvas.height;
    this.deps.particleBatchRenderer.clear();
    for (const particle of this.deps.getParticles()) {
      if (this.deps.entityCuller.isVisible(particle)) {
        this.deps.particleBatchRenderer.addParticle(particle, isMobile);
      }
    }
    this.deps.particleBatchRenderer.drawAll(ctx);

    for (const projectile of this.deps.getProjectiles()) {
      if (this.deps.entityCuller.isVisible(projectile)) {
        projectile.draw(ctx);
      }
    }

    // Draw melee attacks
    for (const melee of this.deps.getMeleeAttacks()) {
      if (this.deps.entityCuller.isVisible(melee)) {
        melee.draw(ctx);
      }
    }

    // Ground-level aux weapons (under enemies): nova rings + armed bombs.
    for (const wave of this.deps.getShockwaves()) wave.draw(ctx);
    for (const bomb of this.deps.getBombs()) bomb.draw(ctx);

    // Telegraphed enemy AoE markers: on the ground, under enemies, so the red
    // danger zones read as floor markings the player can step out of.
    for (const zone of this.deps.getAoeZones()) zone.draw(ctx);

    // Spawn telegraphs: blinking red X where enemies are about to drop in (Brotato-style).
    for (const tg of this.deps.getSpawnTelegraphs()) tg.draw(ctx);

    for (const enemy of this.deps.getEnemies()) {
      if (this.deps.entityCuller.isVisible(enemy)) {
        enemy.draw(ctx);
      }
    }

    for (const orb of this.deps.getHealthOrbs()) {
      if (this.deps.entityCuller.isVisible(orb)) {
        orb.draw(ctx);
      }
    }

    for (const orb of this.deps.getXpOrbs()) {
      if (this.deps.entityCuller.isVisible(orb)) {
        orb.draw(ctx);
      }
    }

    for (const coin of this.deps.getCoins()) {
      if (this.deps.entityCuller.isVisible(coin)) {
        coin.draw(ctx);
      }
    }

    player.draw(ctx);

    // Orbiting orbs draw over the player so the ring reads clearly.
    for (const orb of this.deps.getOrbitingOrbs()) orb.draw(ctx);

    for (const num of this.deps.getDamageNumbers()) {
      num.draw(ctx);
    }

    // ZOOM-OUT: end the world transform — everything below is screen-space GUI.
    ctx.restore();

    // Draw joystick
    this.deps.input.drawJoystick(ctx);

    // Draw UI
    this.deps.hudRenderer.drawHUD();

    // Draw wave modifier announcement
    if (this.deps.getWaveModifierTimer() > 0 && this.deps.waveManager.waveModifierText) {
      const alpha = Math.min(1, this.deps.getWaveModifierTimer());
      const ctx = this.deps.renderer.getContext();
      ctx.save();
      ctx.globalAlpha = alpha;

      const modifierColor = this.deps.waveManager.waveModifier === 'horde' ? '#ff6600' :
                           this.deps.waveManager.waveModifier === 'elite' ? '#ff00ff' :
                           this.deps.waveManager.waveModifier === 'speed' ? '#00ffff' :
                           this.deps.waveManager.waveModifier === 'tank' ? '#888888' :
                           this.deps.waveManager.waveModifier === 'chaos' ? '#ff0000' :
                           this.deps.waveManager.isBossWave ? '#ff0000' : '#ffff00';

      this.deps.renderer.drawText(this.deps.waveManager.waveModifierText, this.deps.canvas.width / 2, this.deps.canvas.height / 2 - 50, {
        size: 32,
        bold: true,
        align: 'center',
        color: modifierColor
      });

      ctx.restore();
    }

    // Mid-wave sub-phase banner (waves-within-waves) — smaller, lower, and it
    // does not fight the main wave banner for the same screen real estate.
    if (this.deps.getPhaseBannerTimer() > 0 && this.deps.getPhaseBannerText()) {
      const alpha = Math.min(1, this.deps.getPhaseBannerTimer() / 0.8);
      const ctx = this.deps.renderer.getContext();
      ctx.save();
      ctx.globalAlpha = alpha;
      this.deps.renderer.drawText(this.deps.getPhaseBannerText(), this.deps.canvas.width / 2, this.deps.canvas.height / 2 + 10, {
        size: 24,
        bold: true,
        align: 'center',
        color: '#ffd24d'
      });
      ctx.restore();
    }

    // PERFORMANCE: Draw performance monitor (F2 to toggle)
    const quadtreeStats = this.deps.enemyQuadtree.getStats();
    // Calculate culling stats (all entities except player)
    const allEntities = [
      ...this.deps.getEnemies(),
      ...this.deps.getProjectiles(),
      ...this.deps.getParticles(),
      ...this.deps.getMeleeAttacks(),
      ...this.deps.getHealthOrbs(),
      ...this.deps.getXpOrbs(),
      ...this.deps.getCoins()
    ];
    const visibleCount = allEntities.filter(e => this.deps.entityCuller.isVisible(e)).length;
    const culledCount = allEntities.length - visibleCount;

    this.deps.performanceMonitor.draw(ctx, {
      enemies: this.deps.getEnemies().length,
      projectiles: this.deps.getProjectiles().length,
      particles: this.deps.getParticles().length,
      damageNumbers: this.deps.getDamageNumbers().length,
      meleeAttacks: this.deps.getMeleeAttacks().length,
      healthOrbs: this.deps.getHealthOrbs().length,
      xpOrbs: this.deps.getXpOrbs().length + this.deps.getCoins().length,
      quadtreeNodes: quadtreeStats.nodeCount,
      quadtreeDepth: quadtreeStats.maxDepth,
      quadtreeObjects: quadtreeStats.totalObjects,
      qualityLevel: this.deps.qualityManager.getLevel(),
      visibleEntities: visibleCount,
      culledEntities: culledCount
    });

    // GAME FEEL: Restore context after screen effects
    ctx.restore();

    // GAME FEEL: Render flash effect (must be after ctx.restore to cover whole screen)
    this.deps.screenEffects.renderFlash(ctx, this.deps.canvas.width, this.deps.canvas.height);
  }
}
