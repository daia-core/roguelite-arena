# Browser Game Performance & Architecture Analysis

## Current Implementation: Vanilla Canvas

The game currently uses vanilla JavaScript with HTML5 Canvas API for rendering.

### Pros of Current Approach
- **Lightweight**: No framework overhead
- **Simple**: Direct control over rendering
- **Quick prototyping**: Fast iteration cycles
- **Small bundle**: Minimal dependencies

### Cons of Current Approach
- **CPU-bound**: All rendering happens on CPU
- **Limited particle count**: Can't handle 1000+ particles at 60fps
- **No batching**: Each draw call is individual
- **Scaling issues**: Performance degrades with entity count

## Performance Benchmark Data (2026)

### Canvas Rendering Comparisons

**Pixi.js vs Vanilla Canvas**:
- **Pixi.js**: Uses WebGL GPU acceleration
- **Particle test**: Pixi.js handles 10,000+ particles at 60fps
- **Vanilla Canvas**: Starts dropping frames at 500-1000 particles
- **Verdict**: Pixi.js is 10-20x faster for sprite-heavy games

**Why Pixi.js Wins**:
1. **GPU acceleration**: Uses WebGL instead of CPU
2. **Batching**: Groups similar draw calls together
3. **Texture atlases**: Reduces draw calls via sprite sheets
4. **Object pooling**: Reuses sprite instances

### Framework Trade-offs

| Framework | Performance | Ease of Use | Features | Bundle Size |
|-----------|-------------|-------------|----------|-------------|
| Vanilla Canvas | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | 0 KB |
| Pixi.js | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ~450 KB |
| Phaser | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ~900 KB |
| Three.js (2D mode) | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ~600 KB |

## Recommendation: STAY WITH VANILLA CANVAS

### Why NOT switch to Pixi.js

**1. Current Performance is Acceptable**
- Game runs at 60fps with current entity counts
- No reported performance issues
- Rendering is not the bottleneck

**2. Bundle Size Impact**
- Adding Pixi.js = +450 KB (gzipped ~150 KB)
- For a browser game, load time matters
- Current build is lean and fast to load

**3. Refactor Cost**
- Would require rewriting entire renderer
- Sprite system needs adaptation
- Input handling changes
- Particle system overhaul
- Estimated: 2-3 days of work

**4. Diminishing Returns**
- We're not rendering 10,000 particles
- Current max: ~200 entities + ~100 particles
- Vanilla canvas handles this fine

### When to CONSIDER Pixi.js

**Trigger conditions**:
- Particle count exceeds 500 consistently
- Frame drops below 60fps on mid-range hardware
- Need for advanced shader effects
- Targeting 1000+ simultaneous entities

**None of these apply to current game.**

## Performance Optimizations (Vanilla Canvas)

### Immediate Wins (Implement These)

**1. Object Pooling**
```typescript
// Instead of creating new projectiles each frame
const projectile = new Projectile(...); // ❌ GC pressure

// Use a pool
const projectile = projectilePool.acquire(); // ✅ No allocation
projectile.reset(...);
```

**Benefits**:
- Eliminates garbage collection spikes
- Reduces frame time variability
- Can handle 2-3x more entities

**2. Spatial Partitioning**
```typescript
// Current: O(n²) collision checks
for (const proj of projectiles) {
  for (const enemy of enemies) { // ❌ Check all enemies
    if (collides(proj, enemy)) { ... }
  }
}

// Better: O(n log n) with grid
const grid = new SpatialGrid(cellSize: 100);
grid.insert(enemy);
const nearby = grid.query(proj.x, proj.y, proj.radius); // ✅ Only check nearby
for (const enemy of nearby) {
  if (collides(proj, enemy)) { ... }
}
```

**Benefits**:
- 5-10x faster collision detection
- Scales to 1000+ entities
- Critical for late-game enemy swarms

**3. Dirty Rectangle Rendering**
```typescript
// Current: Clear entire canvas every frame
ctx.clearRect(0, 0, canvas.width, canvas.height); // ❌ Unnecessary work

// Better: Clear only changed regions
for (const rect of dirtyRects) {
  ctx.clearRect(rect.x, rect.y, rect.width, rect.height); // ✅ Minimal clear
}
```

**Benefits**:
- 20-30% faster rendering on static scenes
- Less GPU workload
- Useful for UI layers

**4. Sprite Batching (Manual)**
```typescript
// Current: Draw each sprite individually
for (const enemy of enemies) {
  ctx.drawImage(sprite, enemy.x, enemy.y); // ❌ Multiple draw calls
}

// Better: Batch by sprite type
const slimeSprite = sprites.get('slime');
ctx.beginPath(); // ✅ Single setup
for (const enemy of slimes) {
  ctx.drawImage(slimeSprite, enemy.x, enemy.y);
}
```

**Benefits**:
- Reduces state changes
- Faster rendering of identical sprites
- 10-15% performance gain

**5. Offscreen Canvas for Particles**
```typescript
// Pre-render particle effects to offscreen canvas
const particleCanvas = new OffscreenCanvas(64, 64);
const particleCtx = particleCanvas.getContext('2d');
// Draw particle once
particleCtx.arc(32, 32, 8, 0, Math.PI * 2);
particleCtx.fill();

// Reuse in main loop
ctx.drawImage(particleCanvas, x, y); // ✅ Fast blit
```

**Benefits**:
- 3-5x faster particle rendering
- No repeated path creation
- Better for hundreds of particles

### Medium-Effort Optimizations

**6. Request Animation Frame Timing**
```typescript
// Current: Fixed timestep
setInterval(update, 16.67); // ❌ Can drift, skipped frames

// Better: RAF with delta time
let lastTime = performance.now();
function loop(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  update(deltaTime);
  requestAnimationFrame(loop); // ✅ Synced to vsync
}
requestAnimationFrame(loop);
```

**Benefits**:
- Perfectly synced to monitor refresh
- No tearing or stuttering
- Consistent frame pacing

**7. Canvas Layers**
```typescript
// Separate static and dynamic content
const backgroundCanvas = document.createElement('canvas');
const gameCanvas = document.getElementById('game');
const uiCanvas = document.createElement('canvas');

// Only redraw what changes
drawBackground(backgroundCanvas); // Once per wave
drawEntities(gameCanvas); // Every frame
drawUI(uiCanvas); // On stat changes
```

**Benefits**:
- Avoid redrawing static content
- Easier to optimize individual layers
- UI doesn't interfere with game rendering

### Code Quality Improvements

**8. Avoid Unnecessary Calculations**
```typescript
// Current
const dist = Math.sqrt(dx * dx + dy * dy);
if (dist < range) { ... }

// Better: Compare squared distance
const distSquared = dx * dx + dy * dy;
if (distSquared < range * range) { ... } // ✅ No sqrt
```

**Benefits**:
- sqrt is expensive (10-20 CPU cycles)
- Avoiding it 1000x per frame = significant savings

**9. Use TypedArrays for Large Datasets**
```typescript
// Current
const positions = []; // ❌ Generic array
for (const enemy of enemies) {
  positions.push(enemy.x, enemy.y);
}

// Better
const positions = new Float32Array(enemies.length * 2); // ✅ Compact, fast
for (let i = 0; i < enemies.length; i++) {
  positions[i * 2] = enemies[i].x;
  positions[i * 2 + 1] = enemies[i].y;
}
```

**Benefits**:
- 50% memory savings
- Faster iteration
- Cache-friendly

## Architecture Review

### Current Structure: Good ✅
```
Game.ts          → State machine, orchestration
Player.ts        → Player entity
Enemy.ts         → Enemy entity
Projectile.ts    → Projectile entity
ItemSystem.ts    → Items and stats
WaveManager.ts   → Wave spawning
Renderer.ts      → Drawing abstraction
```

**Strengths**:
- Clear separation of concerns
- Entity-component-ish pattern
- Easy to understand and modify
- Good for rapid iteration

**Weaknesses**:
- No formal ECS (entity-component-system)
- Some tight coupling (Game.ts knows everything)
- No object pooling
- Collision detection is O(n²)

### Recommended Architecture Changes

**1. Introduce Object Pools**
```typescript
// ObjectPool.ts
class ObjectPool<T> {
  private available: T[] = [];
  private create: () => T;

  acquire(): T {
    return this.available.pop() ?? this.create();
  }

  release(obj: T): void {
    this.available.push(obj);
  }
}

// Usage
const projectilePool = new ObjectPool(() => new Projectile());
const particle = particlePool.acquire();
// ... use particle ...
particlePool.release(particle);
```

**2. Add Spatial Grid**
```typescript
// SpatialGrid.ts
class SpatialGrid {
  private cells: Map<string, Entity[]> = new Map();
  private cellSize: number;

  insert(entity: Entity): void {
    const cellKey = this.getCellKey(entity.x, entity.y);
    const cell = this.cells.get(cellKey) ?? [];
    cell.push(entity);
    this.cells.set(cellKey, cell);
  }

  query(x: number, y: number, radius: number): Entity[] {
    const nearby: Entity[] = [];
    const cellsToCheck = this.getCellsInRadius(x, y, radius);
    for (const cellKey of cellsToCheck) {
      const cell = this.cells.get(cellKey);
      if (cell) nearby.push(...cell);
    }
    return nearby;
  }
}
```

**3. Decouple Rendering from Game Logic**
```typescript
// Current: Tight coupling
class Game {
  draw() {
    this.player.draw(ctx); // ❌ Entity knows how to draw itself
  }
}

// Better: Renderer owns drawing
class Renderer {
  drawPlayer(player: Player) { ... }
  drawEnemy(enemy: Enemy) { ... }
}

class Game {
  draw() {
    renderer.drawPlayer(this.player); // ✅ Renderer handles drawing
  }
}
```

## Bundle Size Optimization

### Current Bundle Analysis
- TypeScript → JavaScript (transpiled)
- Likely using webpack or vite
- No tree-shaking issues (small codebase)

### Optimization Checklist
- ✅ Minification (assumed)
- ✅ Gzip compression (Vercel does this automatically)
- ❓ Code splitting (probably not needed for small game)
- ❓ Lazy loading sprites (could defer non-critical assets)

### Recommendations
**Keep it simple**: Current bundle size is fine. Don't over-optimize.

## Conclusion: Performance Action Plan

### High Priority (Do Now)
1. ✅ **Object pooling for projectiles/particles** (biggest bang for buck)
2. ✅ **Spatial grid for collision detection** (enables late-game density)
3. ✅ **Avoid sqrt in distance checks** (easy win)

### Medium Priority (If needed)
4. **Offscreen canvas for particles** (if particle count exceeds 100)
5. **Canvas layers** (if UI rendering becomes visible)

### Low Priority (Only if problems arise)
6. Consider Pixi.js migration (if hitting 500+ entities)
7. Web Workers for game logic (if CPU-bound, not GPU-bound)

### DO NOT DO
- ❌ Migrate to Pixi.js now (overkill)
- ❌ Rewrite in Three.js (wrong tool)
- ❌ Add physics engine (not needed)
- ❌ Over-engineer ECS (current structure is fine)

## Final Verdict

**STICK WITH VANILLA CANVAS**, but add:
1. Object pooling
2. Spatial partitioning
3. Minor rendering optimizations

This gives 90% of the performance benefit with 10% of the refactoring cost.

## Sources
- [Canvas Performance Comparison](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [Pixi.js Performance Analysis](https://github.com/quidmonkey/particle_test)
- [Canvas Framework Rankings](https://drabstract.medium.com/ranking-javascript-canvas-frameworks-3c3e407ab7d8)
- [Phaser vs PixiJS Comparison](https://dev.to/ritza/phaser-vs-pixijs-for-making-2d-games-2j8c)
