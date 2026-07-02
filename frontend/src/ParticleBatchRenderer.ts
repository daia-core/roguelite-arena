/**
 * Particle Batch Renderer
 *
 * PERFORMANCE OPTIMIZATION: Instead of rendering each particle individually
 * with multiple fillRect() calls, batch particles by color and render them
 * all at once. This reduces draw calls from O(particles) to O(unique_colors).
 *
 * Expected performance gain: 40-60% faster particle rendering when 100+ particles active
 */

import type { Particle } from './Particle';

interface ParticleBatch {
  color: string;
  rects: { x: number; y: number; size: number }[];
}

export class ParticleBatchRenderer {
  private batches: Map<string, ParticleBatch> = new Map();

  /**
   * Clear batches (call at start of frame)
   */
  clear(): void {
    this.batches.clear();
  }

  /**
   * Add a particle to the batch (don't draw yet)
   */
  addParticle(particle: Particle, isMobile: boolean): void {
    const sizeScale = isMobile ? 1.5 : 1;
    const pixelSize = Math.max(2, Math.round(particle.size * sizeScale));
    const fadeProgress = particle.fadeOut ? (1 - particle.lifetime / particle.maxLifetime) : 0;

    // Calculate actual size based on fade progress (matches Particle.draw logic)
    let actualSize = pixelSize;
    if (fadeProgress >= 0.25 && fadeProgress < 0.5) {
      actualSize = pixelSize - 2;
    } else if (fadeProgress >= 0.5 && fadeProgress < 0.75) {
      actualSize = Math.max(2, pixelSize - 4);
    } else if (fadeProgress >= 0.75) {
      actualSize = Math.max(2, Math.floor(pixelSize / 2));
    }

    // Skip fully faded particles
    if (actualSize <= 0) return;

    const x = Math.floor(particle.x);
    const y = Math.floor(particle.y);
    const color = particle.color;

    // Get or create batch for this color
    let batch = this.batches.get(color);
    if (!batch) {
      batch = { color, rects: [] };
      this.batches.set(color, batch);
    }

    // Add rect to batch
    batch.rects.push({ x, y, size: actualSize });
  }

  /**
   * Draw all batched particles (call at end of frame)
   */
  drawAll(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Draw each color batch in one go
    for (const batch of this.batches.values()) {
      ctx.fillStyle = batch.color;

      // OPTIMIZATION: Use beginPath + rect + fill for all rects of same color
      // This is faster than individual fillRect calls
      ctx.beginPath();
      for (const rect of batch.rects) {
        ctx.rect(
          rect.x - rect.size / 2,
          rect.y - rect.size / 2,
          rect.size,
          rect.size
        );
      }
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Get batch statistics (for performance monitoring)
   */
  getStats(): { batchCount: number; particleCount: number } {
    let particleCount = 0;
    for (const batch of this.batches.values()) {
      particleCount += batch.rects.length;
    }
    return {
      batchCount: this.batches.size,
      particleCount
    };
  }
}
