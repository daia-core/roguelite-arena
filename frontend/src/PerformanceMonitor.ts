/**
 * Performance monitoring dashboard
 * Press F2 to toggle
 *
 * Displays:
 * - FPS (frames per second)
 * - Entity counts (enemies, projectiles, particles)
 * - Memory usage (heap size)
 * - Quadtree statistics
 */

export interface PerformanceStats {
  enemies: number;
  projectiles: number;
  particles: number;
  damageNumbers: number;
  meleeAttacks: number;
  healthOrbs: number;
  quadtreeNodes?: number;
  quadtreeDepth?: number;
  quadtreeObjects?: number;
  qualityLevel?: string;
  culledEntities?: number;
  visibleEntities?: number;
}

export class PerformanceMonitor {
  private visible: boolean = false;
  private fps: number = 60;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private frameHistory: number[] = [];
  private maxHistoryLength: number = 60; // 1 second at 60fps

  constructor() {
    // F2 to toggle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        this.toggle();
      }
    });
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getFPS(): number {
    return this.fps;
  }

  update(_dt: number): void {
    if (!this.visible) return;

    this.frameCount++;
    const now = performance.now();

    // Update FPS every 500ms
    if (now - this.lastFpsUpdate >= 500) {
      const elapsed = (now - this.lastFpsUpdate) / 1000;
      this.fps = Math.round(this.frameCount / elapsed);
      this.frameHistory.push(this.fps);

      // Keep history trimmed
      if (this.frameHistory.length > this.maxHistoryLength) {
        this.frameHistory.shift();
      }

      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  draw(ctx: CanvasRenderingContext2D, stats: PerformanceStats): void {
    if (!this.visible) return;

    ctx.save();

    // Panel background (increased height for more stats)
    const panelX = 10;
    const panelY = 10;
    const panelWidth = 280;
    const panelHeight = 240;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Title
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PERFORMANCE MONITOR', panelX + 10, panelY + 25);

    // FPS
    let y = panelY + 50;
    const fpsColor = this.fps >= 60 ? '#00ff00' : this.fps >= 30 ? '#ffff00' : '#ff0000';
    ctx.fillStyle = fpsColor;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`FPS: ${this.fps}`, panelX + 10, y);

    // FPS graph (mini)
    const graphWidth = 100;
    const graphHeight = 30;
    const graphX = panelX + panelWidth - graphWidth - 10;
    const graphY = y - 15;

    ctx.strokeStyle = '#333';
    ctx.strokeRect(graphX, graphY, graphWidth, graphHeight);

    // Draw FPS history
    ctx.strokeStyle = fpsColor;
    ctx.beginPath();
    for (let i = 0; i < this.frameHistory.length; i++) {
      const x = graphX + (i / this.maxHistoryLength) * graphWidth;
      const height = Math.min((this.frameHistory[i] / 120) * graphHeight, graphHeight);
      const py = graphY + graphHeight - height;

      if (i === 0) {
        ctx.moveTo(x, py);
      } else {
        ctx.lineTo(x, py);
      }
    }
    ctx.stroke();

    // Memory usage
    y += 25;
    ctx.fillStyle = '#00ffff';
    ctx.font = '12px monospace';
    const memoryMB = this.getMemoryUsage();
    ctx.fillText(`Memory: ${memoryMB}MB`, panelX + 10, y);

    // Entity counts
    y += 20;
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`Entities:`, panelX + 10, y);

    y += 18;
    ctx.fillStyle = '#fff';
    ctx.fillText(`  Enemies: ${stats.enemies}`, panelX + 10, y);

    y += 18;
    ctx.fillText(`  Projectiles: ${stats.projectiles}`, panelX + 10, y);

    y += 18;
    ctx.fillText(`  Particles: ${stats.particles}`, panelX + 10, y);

    y += 18;
    ctx.fillText(`  Melee: ${stats.meleeAttacks}`, panelX + 10, y);

    // Quadtree stats (if available)
    if (stats.quadtreeNodes !== undefined) {
      y += 20;
      ctx.fillStyle = '#ff00ff';
      ctx.fillText(`Quadtree:`, panelX + 10, y);

      y += 18;
      ctx.fillStyle = '#fff';
      ctx.fillText(`  Nodes: ${stats.quadtreeNodes}`, panelX + 10, y);

      y += 18;
      ctx.fillText(`  Depth: ${stats.quadtreeDepth}`, panelX + 10, y);
    }

    // Quality level (if available)
    if (stats.qualityLevel) {
      y += 20;
      const qualityColor = stats.qualityLevel === 'high' ? '#00ff00' :
                           stats.qualityLevel === 'medium' ? '#ffff00' : '#ff0000';
      ctx.fillStyle = qualityColor;
      ctx.fillText(`Quality: ${stats.qualityLevel.toUpperCase()}`, panelX + 10, y);
    }

    // Entity culling stats (if available)
    if (stats.visibleEntities !== undefined && stats.culledEntities !== undefined) {
      y += 20;
      ctx.fillStyle = '#00ffff';
      ctx.fillText(`Culling:`, panelX + 10, y);

      y += 18;
      ctx.fillStyle = '#fff';
      const total = stats.visibleEntities + stats.culledEntities;
      const cullRate = total > 0 ? Math.round((stats.culledEntities / total) * 100) : 0;
      ctx.fillText(`  Visible: ${stats.visibleEntities}/${total}`, panelX + 10, y);

      y += 18;
      ctx.fillStyle = cullRate > 0 ? '#00ff00' : '#888';
      ctx.fillText(`  Culled: ${stats.culledEntities} (${cullRate}%)`, panelX + 10, y);
    }

    // Footer
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText('Press F2 to toggle', panelX + 10, panelY + panelHeight - 10);

    ctx.restore();
  }

  private getMemoryUsage(): number {
    // @ts-ignore - performance.memory is Chrome-specific
    if (performance.memory) {
      // @ts-ignore
      return Math.round(performance.memory.usedJSHeapSize / 1048576);
    }
    return 0;
  }
}
