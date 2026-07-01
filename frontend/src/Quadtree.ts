/**
 * Quadtree spatial partitioning for efficient collision detection
 *
 * Replaces the basic spatial grid with a hierarchical structure that
 * dynamically subdivides based on entity density. Expected performance:
 * 10-100x faster collision checks for sparse/clustered entity distributions.
 */

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QuadtreeEntity {
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
}

export class Quadtree<T extends QuadtreeEntity> {
  private bounds: Bounds;
  private maxObjects: number;
  private maxLevels: number;
  private level: number;
  private objects: T[];
  private nodes: Quadtree<T>[];

  constructor(bounds: Bounds, maxObjects: number = 10, maxLevels: number = 5, level: number = 0) {
    this.bounds = bounds;
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    this.objects = [];
    this.nodes = [];
  }

  /**
   * Clear the quadtree
   */
  clear(): void {
    this.objects = [];
    for (const node of this.nodes) {
      node.clear();
    }
    this.nodes = [];
  }

  /**
   * Split the node into 4 subnodes
   */
  private split(): void {
    const subWidth = this.bounds.width / 2;
    const subHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    const level = this.level + 1;

    // Top-right
    this.nodes[0] = new Quadtree(
      { x: x + subWidth, y: y, width: subWidth, height: subHeight },
      this.maxObjects,
      this.maxLevels,
      level
    );

    // Top-left
    this.nodes[1] = new Quadtree(
      { x: x, y: y, width: subWidth, height: subHeight },
      this.maxObjects,
      this.maxLevels,
      level
    );

    // Bottom-left
    this.nodes[2] = new Quadtree(
      { x: x, y: y + subHeight, width: subWidth, height: subHeight },
      this.maxObjects,
      this.maxLevels,
      level
    );

    // Bottom-right
    this.nodes[3] = new Quadtree(
      { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
      this.maxObjects,
      this.maxLevels,
      level
    );
  }

  /**
   * Determine which node the object belongs to
   * -1 means object cannot completely fit within a child node and is part of the parent node
   */
  private getIndex(entity: T): number {
    let index = -1;
    const verticalMidpoint = this.bounds.x + this.bounds.width / 2;
    const horizontalMidpoint = this.bounds.y + this.bounds.height / 2;

    // Get entity bounds
    const radius = entity.radius || 0;
    const width = entity.width || radius * 2;
    const height = entity.height || radius * 2;
    const entityLeft = entity.x - width / 2;
    const entityRight = entity.x + width / 2;
    const entityTop = entity.y - height / 2;
    const entityBottom = entity.y + height / 2;

    // Object can completely fit within the top quadrants
    const topQuadrant = entityBottom < horizontalMidpoint;
    // Object can completely fit within the bottom quadrants
    const bottomQuadrant = entityTop > horizontalMidpoint;

    // Object can completely fit within the left quadrants
    if (entityRight < verticalMidpoint) {
      if (topQuadrant) {
        index = 1; // Top-left
      } else if (bottomQuadrant) {
        index = 2; // Bottom-left
      }
    }
    // Object can completely fit within the right quadrants
    else if (entityLeft > verticalMidpoint) {
      if (topQuadrant) {
        index = 0; // Top-right
      } else if (bottomQuadrant) {
        index = 3; // Bottom-right
      }
    }

    return index;
  }

  /**
   * Insert an entity into the quadtree
   */
  insert(entity: T): void {
    // If we have subnodes, insert into the appropriate child
    if (this.nodes.length > 0) {
      const index = this.getIndex(entity);
      if (index !== -1) {
        this.nodes[index].insert(entity);
        return;
      }
    }

    // Otherwise, store it here
    this.objects.push(entity);

    // If we exceeded capacity and can split, do so
    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      // Split if we haven't already
      if (this.nodes.length === 0) {
        this.split();
      }

      // Move objects to child nodes
      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i]);
        if (index !== -1) {
          this.nodes[index].insert(this.objects.splice(i, 1)[0]);
        } else {
          i++;
        }
      }
    }
  }

  /**
   * Return all objects that could collide with the given entity
   */
  retrieve(entity: T, returnObjects: T[] = []): T[] {
    const index = this.getIndex(entity);

    // If we have child nodes and the entity fits in one, check that child
    if (this.nodes.length > 0) {
      if (index !== -1) {
        this.nodes[index].retrieve(entity, returnObjects);
      } else {
        // Entity spans multiple quadrants, check all children
        for (const node of this.nodes) {
          node.retrieve(entity, returnObjects);
        }
      }
    }

    // Add all objects at this level
    returnObjects.push(...this.objects);

    return returnObjects;
  }

  /**
   * Get all entities in the quadtree
   */
  getAllObjects(returnObjects: T[] = []): T[] {
    returnObjects.push(...this.objects);
    for (const node of this.nodes) {
      node.getAllObjects(returnObjects);
    }
    return returnObjects;
  }

  /**
   * Get stats about the quadtree (for debugging/monitoring)
   */
  getStats(): { nodeCount: number; maxDepth: number; totalObjects: number } {
    let nodeCount = 1;
    let maxDepth = this.level;
    let totalObjects = this.objects.length;

    for (const node of this.nodes) {
      const childStats = node.getStats();
      nodeCount += childStats.nodeCount;
      maxDepth = Math.max(maxDepth, childStats.maxDepth);
      totalObjects += childStats.totalObjects;
    }

    return { nodeCount, maxDepth, totalObjects };
  }
}
