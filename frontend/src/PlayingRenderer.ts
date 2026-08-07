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
  /** Wave-clear celebration timer (0.8 → 0): show "WAVE X CLEARED!" banner while > 0. */
  getWaveClearTimer(): number;
}

export class PlayingRenderer {
  private deps: PlayingRendererDeps;

  constructor(deps: PlayingRendererDeps) {
    this.deps = deps;
  }

  /**
   * Draws a pulsing red vignette at the screen edges when the player is critically low on HP.
   * Activates below 30% HP; pulse rate and intensity scale with severity.
   */
  private drawLowHealthVignette(ctx: CanvasRenderingContext2D, player: Player): void {
    const hpFrac = player.health / player.maxHealth;
    if (hpFrac >= 0.30) return;

    const W = this.deps.canvas.width;
    const H = this.deps.canvas.height;

    // Severity: 0 at 30% HP → 1 at 0% HP
    const severity = 1 - hpFrac / 0.30;

    // Pulse rate: 800ms at 30% HP (barely noticeable) → 350ms at 0% HP (urgent)
    const pulseRate = 800 - severity * 450;
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / pulseRate));

    // Alpha envelope: subtle at 30%, punishing at 0%
    const baseAlpha = 0.12 + severity * 0.45;
    const alpha = baseAlpha * pulse;

    // Radial gradient: transparent center → red edges
    const cx = W / 2;
    const cy = H / 2;
    const innerR = Math.hypot(cx, cy) * 0.35;
    const outerR = Math.hypot(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(160, 0, 0, 0)');
    grad.addColorStop(1, `rgba(210, 20, 20, ${alpha.toFixed(3)})`);

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
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

    // GAME FEEL: Low-health vignette (pulsing red screen edges when HP ≤ 30%)
    this.drawLowHealthVignette(ctx, player);

    // GAME FEEL: Restore context after screen effects
    ctx.restore();

    // GAME FEEL: Render flash effect (must be after ctx.restore to cover whole screen)
    this.deps.screenEffects.renderFlash(ctx, this.deps.canvas.width, this.deps.canvas.height);

    // Wave-clear celebration banner: "WAVE X CLEARED!" fades in then out over 0.8s.
    const wct = this.deps.getWaveClearTimer();
    if (wct > 0) {
      const TOTAL = 0.8;
      const FADE = 0.15; // fade-in and fade-out window
      const alpha =
        wct > TOTAL - FADE ? (TOTAL - wct) / FADE :   // fade in
        wct < FADE         ? wct / FADE                // fade out
                           : 1.0;                      // hold

      const W = this.deps.canvas.width;
      const H = this.deps.canvas.height;
      const zoom = W / (this.deps.canvas.clientWidth || W);
      const s = (v: number) => Math.round(v * zoom);

      const waveNum = this.deps.waveManager.currentWave;
      const totalEnemies = this.deps.waveManager.totalEnemiesInWave;
      ctx.save();
      ctx.globalAlpha = alpha;
      this.deps.renderer.drawText(
        `WAVE ${waveNum} CLEARED!`,
        W / 2,
        H / 2 - s(28),
        { size: s(20), align: 'center', color: '#4ade80', bold: true }
      );
      // Sub-line: enemies defeated — gives the player a satisfying count of what they cleared.
      if (totalEnemies > 0) {
        this.deps.renderer.drawText(
          `${totalEnemies} ENEMIES DEFEATED`,
          W / 2,
          H / 2 + s(4),
          { size: s(9), align: 'center', color: '#86efac' }
        );
      }
      ctx.restore();
    }
  }
}
