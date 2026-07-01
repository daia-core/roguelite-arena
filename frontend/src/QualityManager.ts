/**
 * Adaptive Quality Scaling System
 *
 * Automatically adjusts game quality based on FPS to ensure smooth gameplay
 * on all devices (from low-end mobile to high-end desktop).
 *
 * Quality Levels:
 * - HIGH: All particles, shadows, post-processing effects
 * - MEDIUM: Reduced particles (50%), simplified effects, no shadows
 * - LOW: Minimal particles (25%), basic shapes only, no effects
 *
 * Auto-adjusts every 2 seconds based on average FPS
 */

export type QualityLevel = 'high' | 'medium' | 'low';

export interface QualitySettings {
  particleMultiplier: number; // 1.0 = full, 0.5 = half, 0.25 = quarter
  shadowsEnabled: boolean;
  postProcessing: boolean;
  maxParticlesPerEffect: number;
  targetFPS: number;
}

const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  high: {
    particleMultiplier: 1.0,
    shadowsEnabled: true,
    postProcessing: true,
    maxParticlesPerEffect: 20,
    targetFPS: 60
  },
  medium: {
    particleMultiplier: 0.5,
    shadowsEnabled: false,
    postProcessing: false,
    maxParticlesPerEffect: 10,
    targetFPS: 45
  },
  low: {
    particleMultiplier: 0.25,
    shadowsEnabled: false,
    postProcessing: false,
    maxParticlesPerEffect: 5,
    targetFPS: 30
  }
};

export class QualityManager {
  private currentLevel: QualityLevel = 'high';
  private fpsHistory: number[] = [];
  private readonly historySize = 120; // 2 seconds at 60fps
  private lastAdjustment = 0;
  private readonly adjustmentInterval = 2000; // Adjust every 2 seconds

  // Thresholds for quality transitions
  private readonly DOWNGRADE_FPS = {
    high: 45,  // Drop to medium if FPS < 45
    medium: 30 // Drop to low if FPS < 30
  };

  private readonly UPGRADE_FPS = {
    medium: 55, // Upgrade to high if FPS > 55
    low: 40     // Upgrade to medium if FPS > 40
  };

  constructor(initialLevel: QualityLevel = 'high') {
    this.currentLevel = initialLevel;
  }

  getLevel(): QualityLevel {
    return this.currentLevel;
  }

  getSettings(): QualitySettings {
    return { ...QUALITY_PRESETS[this.currentLevel] };
  }

  /**
   * Update FPS tracking and potentially adjust quality
   * Call this every frame
   */
  recordFrame(fps: number): void {
    this.fpsHistory.push(fps);

    // Keep history size limited
    if (this.fpsHistory.length > this.historySize) {
      this.fpsHistory.shift();
    }

    // Check if we should adjust quality
    const now = performance.now();
    if (now - this.lastAdjustment >= this.adjustmentInterval) {
      this.adjustQuality();
      this.lastAdjustment = now;
    }
  }

  /**
   * Calculate average FPS over the last 2 seconds
   */
  private getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return sum / this.fpsHistory.length;
  }

  /**
   * Automatically adjust quality level based on FPS
   */
  private adjustQuality(): void {
    const avgFPS = this.getAverageFPS();

    // Downgrade logic
    if (this.currentLevel === 'high' && avgFPS < this.DOWNGRADE_FPS.high) {
      this.setLevel('medium');
      console.log(`[Quality] Downgraded to MEDIUM (FPS: ${avgFPS.toFixed(1)})`);
    } else if (this.currentLevel === 'medium' && avgFPS < this.DOWNGRADE_FPS.medium) {
      this.setLevel('low');
      console.log(`[Quality] Downgraded to LOW (FPS: ${avgFPS.toFixed(1)})`);
    }
    // Upgrade logic
    else if (this.currentLevel === 'medium' && avgFPS > this.UPGRADE_FPS.medium) {
      this.setLevel('high');
      console.log(`[Quality] Upgraded to HIGH (FPS: ${avgFPS.toFixed(1)})`);
    } else if (this.currentLevel === 'low' && avgFPS > this.UPGRADE_FPS.low) {
      this.setLevel('medium');
      console.log(`[Quality] Upgraded to MEDIUM (FPS: ${avgFPS.toFixed(1)})`);
    }
  }

  /**
   * Manually set quality level (for settings menu)
   */
  setLevel(level: QualityLevel): void {
    if (this.currentLevel === level) return;

    this.currentLevel = level;

    // Clear FPS history when manually changing quality
    // to avoid immediate downgrade
    this.fpsHistory = [];
    this.lastAdjustment = performance.now();
  }

  /**
   * Calculate how many particles to spawn based on current quality
   */
  getParticleCount(baseCount: number): number {
    const settings = this.getSettings();
    return Math.max(1, Math.floor(baseCount * settings.particleMultiplier));
  }

  /**
   * Check if a feature should be enabled at current quality
   */
  shouldRenderShadows(): boolean {
    return this.getSettings().shadowsEnabled;
  }

  shouldRenderPostProcessing(): boolean {
    return this.getSettings().postProcessing;
  }

  /**
   * Get debug info for performance monitor
   */
  getDebugInfo(): string {
    const avgFPS = this.getAverageFPS();
    const settings = this.getSettings();
    return `Quality: ${this.currentLevel.toUpperCase()} (${avgFPS.toFixed(1)} FPS avg, ${settings.maxParticlesPerEffect} particles max)`;
  }
}
