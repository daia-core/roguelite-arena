// Pathfinding system using rot.js Dijkstra for smart enemy AI
// Source: Open-source roguelike code review recommendations

// TEMPORARILY DISABLED - Rolldown has issues with rot-js exports
// import * as ROT from 'rot-js';

export interface PathNode {
  x: number;
  y: number;
}

export class PathfindingSystem {
  private gridWidth: number;
  private gridHeight: number;
  private cellSize: number;

  // Cache for path calculations (reused across frames)
  private pathCache: Map<string, PathNode[]> = new Map();
  private cacheTimeout: Map<string, number> = new Map();
  private readonly CACHE_LIFETIME = 500; // ms - recalculate path every 500ms

  constructor(width: number, height: number, cellSize: number = 32) {
    this.gridWidth = Math.ceil(width / cellSize);
    this.gridHeight = Math.ceil(height / cellSize);
    this.cellSize = cellSize;
  }

  /**
   * Find path from start to target using Dijkstra pathfinding
   * Returns null if no path found
   * Caches results for performance (recalculates every 500ms)
   */
  findPath(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    obstacleCheck?: (x: number, y: number) => boolean,
    timestamp: number = Date.now()
  ): PathNode[] | null {
    // Convert world coords to grid coords
    const startGridX = Math.floor(startX / this.cellSize);
    const startGridY = Math.floor(startY / this.cellSize);
    const targetGridX = Math.floor(targetX / this.cellSize);
    const targetGridY = Math.floor(targetY / this.cellSize);

    // Create cache key
    const cacheKey = `${startGridX},${startGridY}->${targetGridX},${targetGridY}`;

    // Check cache
    const cachedPath = this.pathCache.get(cacheKey);
    const cachedTime = this.cacheTimeout.get(cacheKey);
    if (cachedPath && cachedTime && (timestamp - cachedTime) < this.CACHE_LIFETIME) {
      return cachedPath;
    }

    // Bounds check
    if (
      startGridX < 0 || startGridX >= this.gridWidth ||
      startGridY < 0 || startGridY >= this.gridHeight ||
      targetGridX < 0 || targetGridX >= this.gridWidth ||
      targetGridY < 0 || targetGridY >= this.gridHeight
    ) {
      return null;
    }

    // Passability callback - by default, all cells are passable
    // unless obstacleCheck is provided
    const passableCallback = (x: number, y: number): boolean => {
      // Bounds check
      if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) {
        return false;
      }

      // If no obstacle check provided, all cells are passable
      if (!obstacleCheck) {
        return true;
      }

      // Convert grid coords back to world coords for obstacle check
      const worldX = x * this.cellSize + this.cellSize / 2;
      const worldY = y * this.cellSize + this.cellSize / 2;
      return !obstacleCheck(worldX, worldY);
    };

    // Create Dijkstra pathfinder
    const dijkstra = new ROT.Path.Dijkstra(
      targetGridX,
      targetGridY,
      passableCallback,
      { topology: 8 } // Allow diagonal movement
    );

    // Compute path
    const path: PathNode[] = [];
    dijkstra.compute(
      startGridX,
      startGridY,
      (x, y) => {
        // Convert grid coords back to world coords (center of cell)
        path.push({
          x: x * this.cellSize + this.cellSize / 2,
          y: y * this.cellSize + this.cellSize / 2
        });
      }
    );

    // If path is empty or just the start point, no path found
    if (path.length <= 1) {
      return null;
    }

    // Cache the path
    this.pathCache.set(cacheKey, path);
    this.cacheTimeout.set(cacheKey, timestamp);

    // Clean old cache entries (prevent memory leak)
    this.cleanCache(timestamp);

    return path;
  }

  /**
   * Get next waypoint in path (removes reached waypoints)
   * Returns null if path is empty or target reached
   */
  getNextWaypoint(
    currentX: number,
    currentY: number,
    path: PathNode[],
    reachedThreshold: number = 10
  ): PathNode | null {
    if (path.length === 0) return null;

    // Check if we've reached the current waypoint
    const dx = path[0].x - currentX;
    const dy = path[0].y - currentY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < reachedThreshold) {
      // Remove reached waypoint
      path.shift();

      // Return next waypoint if available
      return path.length > 0 ? path[0] : null;
    }

    return path[0];
  }

  /**
   * Clean cache entries older than CACHE_LIFETIME
   */
  private cleanCache(currentTime: number): void {
    // Only clean cache occasionally (every 100 calls)
    if (Math.random() > 0.01) return;

    const keysToDelete: string[] = [];
    this.cacheTimeout.forEach((time, key) => {
      if (currentTime - time > this.CACHE_LIFETIME * 2) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.pathCache.delete(key);
      this.cacheTimeout.delete(key);
    });
  }

  /**
   * Clear all cached paths
   */
  clearCache(): void {
    this.pathCache.clear();
    this.cacheTimeout.clear();
  }
}
