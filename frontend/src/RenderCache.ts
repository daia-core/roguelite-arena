// Render cache for expensive canvas operations
// Caches gradients, patterns, and other reusable render resources

export class RenderCache {
  private gradients: Map<string, CanvasGradient> = new Map();
  private offscreenCanvases: Map<string, HTMLCanvasElement> = new Map();

  /**
   * Get or create a cached radial gradient
   */
  getRadialGradient(
    ctx: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    innerRadius: number,
    outerRadius: number,
    stops: Array<{ offset: number; color: string }>
  ): CanvasGradient {
    if (!this.gradients.has(key)) {
      const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, outerRadius);
      for (const stop of stops) {
        gradient.addColorStop(stop.offset, stop.color);
      }
      this.gradients.set(key, gradient);
    }
    return this.gradients.get(key)!;
  }

  /**
   * Get or create a cached linear gradient
   */
  getLinearGradient(
    ctx: CanvasRenderingContext2D,
    key: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stops: Array<{ offset: number; color: string }>
  ): CanvasGradient {
    if (!this.gradients.has(key)) {
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      for (const stop of stops) {
        gradient.addColorStop(stop.offset, stop.color);
      }
      this.gradients.set(key, gradient);
    }
    return this.gradients.get(key)!;
  }

  /**
   * Get or create an offscreen canvas for pre-rendering
   */
  getOffscreenCanvas(key: string, width: number, height: number): HTMLCanvasElement {
    if (!this.offscreenCanvases.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      this.offscreenCanvases.set(key, canvas);
    }
    return this.offscreenCanvases.get(key)!;
  }

  /**
   * Clear all cached gradients (call when canvas resizes)
   */
  clearGradients(): void {
    this.gradients.clear();
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.gradients.clear();
    this.offscreenCanvases.clear();
  }
}
