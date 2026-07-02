/**
 * Screen effects: shake, zoom, flash
 * Adds juice and impact to gameplay
 */

export interface ScreenShake {
  intensity: number;
  duration: number;
  elapsed: number;
}

export class ScreenEffects {
  // Screen shake
  private shake: ScreenShake | null = null;
  private shakeOffsetX: number = 0;
  private shakeOffsetY: number = 0;

  // Camera zoom (for dramatic moments)
  private targetZoom: number = 1;
  private currentZoom: number = 1;
  private zoomSpeed: number = 3; // How fast zoom transitions

  // Screen flash (white flash on hit, etc.)
  private flashAlpha: number = 0;
  private flashColor: string = '#ffffff';

  constructor() {}

  /**
   * Trigger screen shake
   * @param intensity - Shake strength in pixels
   * @param duration - How long to shake (seconds)
   */
  addShake(intensity: number, duration: number): void {
    // Only override if new shake is stronger
    if (!this.shake || intensity > this.shake.intensity) {
      this.shake = {
        intensity,
        duration,
        elapsed: 0
      };
    }
  }

  /**
   * Trigger camera zoom
   * @param zoom - Target zoom level (1 = normal, 1.1 = 110%)
   * @param duration - How long to zoom (optional, 0 = instant)
   */
  setZoom(zoom: number, duration: number = 0): void {
    this.targetZoom = zoom;
    if (duration === 0) {
      this.currentZoom = zoom;
    }
  }

  /**
   * Reset zoom to normal
   */
  resetZoom(): void {
    this.setZoom(1);
  }

  /**
   * Flash screen
   * @param color - Flash color (default: white)
   * @param alpha - Flash intensity (0-1)
   */
  flash(color: string = '#ffffff', alpha: number = 0.3): void {
    this.flashColor = color;
    this.flashAlpha = Math.min(1, alpha);
  }

  /**
   * Update effects
   */
  update(dt: number): void {
    // Update shake
    if (this.shake) {
      this.shake.elapsed += dt;

      if (this.shake.elapsed >= this.shake.duration) {
        // Shake complete
        this.shake = null;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      } else {
        // Calculate shake offset with decay
        const progress = this.shake.elapsed / this.shake.duration;
        const decay = 1 - progress;
        const intensity = this.shake.intensity * decay;

        this.shakeOffsetX = (Math.random() - 0.5) * intensity * 2;
        this.shakeOffsetY = (Math.random() - 0.5) * intensity * 2;
      }
    }

    // Update zoom (smooth transition)
    if (this.currentZoom !== this.targetZoom) {
      const diff = this.targetZoom - this.currentZoom;
      this.currentZoom += diff * this.zoomSpeed * dt;

      // Snap to target if very close
      if (Math.abs(diff) < 0.001) {
        this.currentZoom = this.targetZoom;
      }
    }

    // Update flash (fade out)
    if (this.flashAlpha > 0) {
      this.flashAlpha -= dt * 4; // Fade out over 0.25s
      if (this.flashAlpha < 0) this.flashAlpha = 0;
    }
  }

  /**
   * Get current shake offset
   */
  getShakeOffset(): { x: number; y: number } {
    return {
      x: this.shakeOffsetX,
      y: this.shakeOffsetY
    };
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.currentZoom;
  }

  /**
   * Apply effects to canvas context
   * Call this BEFORE rendering the game
   */
  applyToContext(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    // Apply zoom (scale from center)
    if (this.currentZoom !== 1) {
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      ctx.translate(centerX, centerY);
      ctx.scale(this.currentZoom, this.currentZoom);
      ctx.translate(-centerX, -centerY);
    }

    // Apply shake offset
    if (this.shake) {
      ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
    }
  }

  /**
   * Render flash effect
   * Call this AFTER rendering the game
   */
  renderFlash(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // PURE PIXEL ART: Use dithered patterns instead of smooth alpha for screen flash
      const ditherSize = 4; // Size of dither pixels
      const ditherPattern = Math.ceil(this.flashAlpha * 4); // 0-4 levels of density

      ctx.fillStyle = this.flashColor;

      // Draw dithered pattern across the screen
      for (let x = 0; x < canvasWidth; x += ditherSize) {
        for (let y = 0; y < canvasHeight; y += ditherSize) {
          const patternValue = ((x / ditherSize) + (y / ditherSize)) % 4;
          if (patternValue < ditherPattern) {
            ctx.fillRect(x, y, ditherSize, ditherSize);
          }
        }
      }

      ctx.restore();
    }
  }

  /**
   * Reset all effects
   */
  reset(): void {
    this.shake = null;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.targetZoom = 1;
    this.currentZoom = 1;
    this.flashAlpha = 0;
  }
}

/**
 * Preset shake intensities
 */
export const ShakePresets = {
  // Small shake for minor hits
  SMALL: { intensity: 2, duration: 0.1 },

  // Medium shake for normal hits
  MEDIUM: { intensity: 5, duration: 0.15 },

  // Large shake for big hits/explosions
  LARGE: { intensity: 10, duration: 0.25 },

  // Massive shake for boss attacks
  MASSIVE: { intensity: 20, duration: 0.4 },

  // Critical hit
  CRIT: { intensity: 8, duration: 0.12 },

  // Level up
  LEVEL_UP: { intensity: 6, duration: 0.2 },

  // Wave complete
  WAVE_COMPLETE: { intensity: 4, duration: 0.3 }
};
