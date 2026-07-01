/**
 * Offscreen Canvas Cache for Static/Repeating UI Elements
 *
 * Pre-renders complex UI elements to hidden canvases, then quickly
 * copies them to the main canvas. Much faster than redrawing hundreds
 * of shapes every frame.
 *
 * Use cases:
 * - Shop UI backgrounds
 * - HUD panel backgrounds
 * - Repeating UI elements
 * - Complex static graphics
 *
 * Performance: 5-10x faster than redrawing for complex elements
 */

interface CachedCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dirty: boolean; // Whether the cache needs to be regenerated
}

export class OffscreenCanvasCache {
  private cache: Map<string, CachedCanvas> = new Map();

  /**
   * Get or create a cached offscreen canvas
   */
  getOrCreate(key: string, width: number, height: number): CachedCanvas {
    let cached = this.cache.get(key);

    if (!cached) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2d context');

      // Disable image smoothing for pixel art
      ctx.imageSmoothingEnabled = false;

      cached = {
        canvas,
        ctx,
        dirty: true
      };

      this.cache.set(key, cached);
    }

    // Resize if dimensions changed
    if (cached.canvas.width !== width || cached.canvas.height !== height) {
      cached.canvas.width = width;
      cached.canvas.height = height;
      cached.dirty = true; // Need to redraw after resize
    }

    return cached;
  }

  /**
   * Mark a cached canvas as dirty (needs redraw)
   */
  invalidate(key: string): void {
    const cached = this.cache.get(key);
    if (cached) {
      cached.dirty = true;
    }
  }

  /**
   * Mark all cached canvases as dirty
   */
  invalidateAll(): void {
    this.cache.forEach(cached => {
      cached.dirty = true;
    });
  }

  /**
   * Get a cached canvas (returns null if not yet created)
   */
  get(key: string): CachedCanvas | null {
    return this.cache.get(key) || null;
  }

  /**
   * Delete a cached canvas
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached canvases
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Render to a cached canvas (only if dirty)
   * Returns the canvas for immediate drawing
   */
  renderCached(
    key: string,
    width: number,
    height: number,
    renderer: (ctx: CanvasRenderingContext2D) => void
  ): HTMLCanvasElement {
    const cached = this.getOrCreate(key, width, height);

    if (cached.dirty) {
      // Clear and redraw
      cached.ctx.clearRect(0, 0, width, height);
      renderer(cached.ctx);
      cached.dirty = false;
    }

    return cached.canvas;
  }

  /**
   * Helper: Render a rounded rectangle background to cache
   * Common pattern for shop panels, HUD panels, etc.
   */
  renderRoundedPanel(
    key: string,
    _x: number,
    _y: number,
    width: number,
    height: number,
    radius: number,
    backgroundColor: string | CanvasGradient,
    borderColor?: string,
    borderWidth?: number
  ): HTMLCanvasElement {
    return this.renderCached(key, width, height, (ctx) => {
      ctx.save();

      // Background
      // Note: Gradients need to be recreated for the offscreen canvas context
      // For now, we just use the gradient as-is (works for simple cases)
      ctx.fillStyle = backgroundColor;

      // Rounded rectangle path
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(width - radius, 0);
      ctx.quadraticCurveTo(width, 0, width, radius);
      ctx.lineTo(width, height - radius);
      ctx.quadraticCurveTo(width, height, width - radius, height);
      ctx.lineTo(radius, height);
      ctx.quadraticCurveTo(0, height, 0, height - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.closePath();
      ctx.fill();

      // Border
      if (borderColor && borderWidth) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  /**
   * Get debug info for performance monitoring
   */
  getDebugInfo(): { count: number; totalBytes: number } {
    let totalBytes = 0;
    this.cache.forEach(cached => {
      // Rough estimate: width * height * 4 bytes per pixel (RGBA)
      totalBytes += cached.canvas.width * cached.canvas.height * 4;
    });

    return {
      count: this.cache.size,
      totalBytes
    };
  }
}
