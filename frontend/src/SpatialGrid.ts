// Spatial grid for optimizing collision detection
// Reduces collision checks from O(n²) to O(n) by dividing space into cells

export interface GridEntity {
  x: number;
  y: number;
  radius: number;
  id?: number;
}

export class SpatialGrid<T extends GridEntity> {
  private cellSize: number;
  private grid: Map<string, T[]>;
  private width: number;
  private height: number;

  constructor(width: number, height: number, cellSize: number = 100) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  /**
   * Clear all entities from the grid
   */
  clear(): void {
    this.grid.clear();
  }

  /**
   * Get all cell keys that an entity overlaps (for entities larger than one cell)
   */
  private getCellKeys(entity: T): string[] {
    const minX = Math.max(0, entity.x - entity.radius);
    const maxX = Math.min(this.width, entity.x + entity.radius);
    const minY = Math.max(0, entity.y - entity.radius);
    const maxY = Math.min(this.height, entity.y + entity.radius);

    const minCol = Math.floor(minX / this.cellSize);
    const maxCol = Math.floor(maxX / this.cellSize);
    const minRow = Math.floor(minY / this.cellSize);
    const maxRow = Math.floor(maxY / this.cellSize);

    const keys: string[] = [];
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        keys.push(`${col},${row}`);
      }
    }
    return keys;
  }

  /**
   * Insert entity into the grid
   */
  insert(entity: T): void {
    const keys = this.getCellKeys(entity);
    for (const key of keys) {
      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key)!.push(entity);
    }
  }

  /**
   * Get entities in nearby cells (includes current cell + neighbors)
   */
  getNearby(x: number, y: number, radius: number = 0): T[] {
    const nearby = new Set<T>();

    // Get all cells the query overlaps
    const minX = Math.max(0, x - radius);
    const maxX = Math.min(this.width, x + radius);
    const minY = Math.max(0, y - radius);
    const maxY = Math.min(this.height, y + radius);

    const minCol = Math.floor(minX / this.cellSize);
    const maxCol = Math.floor(maxX / this.cellSize);
    const minRow = Math.floor(minY / this.cellSize);
    const maxRow = Math.floor(maxY / this.cellSize);

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const key = `${col},${row}`;
        const entities = this.grid.get(key);
        if (entities) {
          for (const entity of entities) {
            nearby.add(entity);
          }
        }
      }
    }

    return Array.from(nearby);
  }

  /**
   * Get all entities in the grid
   */
  getAll(): T[] {
    const all = new Set<T>();
    for (const entities of this.grid.values()) {
      for (const entity of entities) {
        all.add(entity);
      }
    }
    return Array.from(all);
  }

  /**
   * Update grid dimensions (when canvas resizes)
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}
