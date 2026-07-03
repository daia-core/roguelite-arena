/**
 * Screen effects: colored full-screen flash.
 *
 * Screen shake and camera zoom were removed deliberately — the game is tuned
 * for maximum fluidity, so no effect is allowed to move or scale the camera or
 * alter the simulation timestep. Impact is conveyed through flashes, particles,
 * knockback and hit-flashes instead. The flash here is a brief color wash used
 * for level-up / wave-complete / damage feedback; it never moves the view.
 */

export class ScreenEffects {
  // Screen flash (color wash on level-up, wave-complete, damage, etc.)
  private flashAlpha: number = 0;
  private flashColor: string = '#ffffff';

  /**
   * Flash the screen with a color.
   * @param color - Flash color (default: white)
   * @param alpha - Flash intensity (0-1)
   */
  flash(color: string = '#ffffff', alpha: number = 0.3): void {
    this.flashColor = color;
    this.flashAlpha = Math.min(1, alpha);
  }

  update(dt: number): void {
    if (this.flashAlpha > 0) {
      this.flashAlpha -= dt * 4; // Fade out over ~0.25s
      if (this.flashAlpha < 0) this.flashAlpha = 0;
    }
  }

  /**
   * Render flash effect. Call this AFTER rendering the game.
   */
  renderFlash(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (this.flashAlpha > 0) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // PURE PIXEL ART: dithered pattern instead of smooth alpha
      const ditherSize = 4;
      const ditherPattern = Math.ceil(this.flashAlpha * 4); // 0-4 levels of density

      ctx.fillStyle = this.flashColor;
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
   * Reset all effects.
   */
  reset(): void {
    this.flashAlpha = 0;
  }
}
