// Pathfinding system using A* algorithm for smart enemy AI
// Source: Open-source roguelike code review recommendations
// Implements A* from scratch to avoid rot-js build issues

export interface PathNode {
  x: number;
  y: number;
}

interface GridNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic cost to end
  f: number; // Total cost (g + h)
  parent: GridNode | null;
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
   * Find path from start to target using A* pathfinding
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

    // A* pathfinding implementation
    const path = this.astar(
      startGridX, startGridY,
      targetGridX, targetGridY,
      obstacleCheck
    );

    if (!path || path.length <= 1) {
      return null;
    }

    // Convert grid path to world coords
    const worldPath: PathNode[] = path.map(node => ({
      x: node.x * this.cellSize + this.cellSize / 2,
      y: node.y * this.cellSize + this.cellSize / 2
    }));

    // Cache the path
    this.pathCache.set(cacheKey, worldPath);
    this.cacheTimeout.set(cacheKey, timestamp);

    // Clean old cache entries
    this.cleanCache(timestamp);

    return worldPath;
  }

  /**
   * A* pathfinding algorithm
   */
  private astar(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    obstacleCheck?: (x: number, y: number) => boolean
  ): GridNode[] | null {
    const openSet: GridNode[] = [];
    const closedSet = new Set<string>();

    // Heuristic: Manhattan distance
    const heuristic = (x: number, y: number): number => {
      return Math.abs(x - targetX) + Math.abs(y - targetY);
    };

    // Check if a cell is passable
    const isPassable = (x: number, y: number): boolean => {
      if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) {
        return false;
      }
      if (!obstacleCheck) {
        return true;
      }
      const worldX = x * this.cellSize + this.cellSize / 2;
      const worldY = y * this.cellSize + this.cellSize / 2;
      return !obstacleCheck(worldX, worldY);
    };

    // Start node
    const startNode: GridNode = {
      x: startX,
      y: startY,
      g: 0,
      h: heuristic(startX, startY),
      f: heuristic(startX, startY),
      parent: null
    };

    openSet.push(startNode);

    // 8-directional movement
    const directions = [
      { dx: 1, dy: 0 },   // Right
      { dx: -1, dy: 0 },  // Left
      { dx: 0, dy: 1 },   // Down
      { dx: 0, dy: -1 },  // Up
      { dx: 1, dy: 1 },   // Down-Right
      { dx: 1, dy: -1 },  // Up-Right
      { dx: -1, dy: 1 },  // Down-Left
      { dx: -1, dy: -1 }  // Up-Left
    ];

    let iterations = 0;
    const maxIterations = 1000; // Prevent infinite loops

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest f score
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];

      // Check if we reached the target
      if (current.x === targetX && current.y === targetY) {
        // Reconstruct path
        const path: GridNode[] = [];
        let node: GridNode | null = current;
        while (node) {
          path.unshift(node);
          node = node.parent;
        }
        return path;
      }

      // Move current from open to closed
      openSet.splice(currentIndex, 1);
      closedSet.add(`${current.x},${current.y}`);

      // Check neighbors
      for (const dir of directions) {
        const neighborX = current.x + dir.dx;
        const neighborY = current.y + dir.dy;

        // Skip if already in closed set
        if (closedSet.has(`${neighborX},${neighborY}`)) {
          continue;
        }

        // Skip if not passable
        if (!isPassable(neighborX, neighborY)) {
          continue;
        }

        // Calculate costs
        // Diagonal movement costs sqrt(2) ≈ 1.414, straight costs 1
        const isDiagonal = dir.dx !== 0 && dir.dy !== 0;
        const moveCost = isDiagonal ? 1.414 : 1.0;
        const gScore = current.g + moveCost;

        // Check if neighbor is already in open set
        let neighbor = openSet.find(n => n.x === neighborX && n.y === neighborY);

        if (!neighbor) {
          // Add new node to open set
          neighbor = {
            x: neighborX,
            y: neighborY,
            g: gScore,
            h: heuristic(neighborX, neighborY),
            f: gScore + heuristic(neighborX, neighborY),
            parent: current
          };
          openSet.push(neighbor);
        } else if (gScore < neighbor.g) {
          // Update existing node with better path
          neighbor.g = gScore;
          neighbor.f = gScore + neighbor.h;
          neighbor.parent = current;
        }
      }
    }

    // No path found
    return null;
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
