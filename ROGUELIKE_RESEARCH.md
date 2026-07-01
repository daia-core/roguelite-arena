# Open-Source Roguelike Research & Optimization Opportunities

**Research Date:** 2026-07-02
**Objective:** Analyze open-source roguelikes to identify improvements for our vampire-survivors-style game

---

## Summary of Findings

Reviewed 10+ open-source roguelike/roguelite projects and performance optimization resources. Identified **6 major improvement opportunities** we should implement, plus **3 areas where we're already following best practices**.

---

## Key Projects Reviewed

### High-Performance Implementations

1. **[vampire-survivors-enhanced](https://github.com/BareTread/vampire-survivors-enhanced)** - Vanilla JS, 144+ FPS
   - Layered canvas rendering (15-30% FPS improvement)
   - 90% particle reduction (15 vs 150 particles)
   - Adaptive quality scaling
   - Object pooling for particles, projectiles, enemies
   - Real-time performance monitoring (F2 key)

2. **[Survivors-Like](https://github.com/tiny-ai-ops/Survivors-Like)** - Browser-based survival game
   - Optimized collision detection
   - Comprehensive debugging system
   - Modular architecture (game-core.js, collisions.js, effects.js)

3. **[Froguelite](https://github.com/LilypadGames/Froguelite)** - Phaser 3 + TypeScript
   - Cross-platform (Tauri + web)
   - Scene management patterns
   - Asset loading optimization

### Supporting Libraries & Resources

4. **[quadtree-js](https://github.com/timohausmann/quadtree-js)** - Spatial partitioning library
5. **[JSRL](https://github.com/slashman/jsrl)** - Roguelike template with advanced starting point
6. **rot.js** - Roguelike development toolkit

---

## What We're Already Doing Well ✓

### 1. Object Pooling (Already Implemented)
**Our implementation:** `/frontend/src/ObjectPool.ts`
```typescript
// We have generic object pools for:
- Projectiles (max 200)
- Particles (max 500)
- Damage numbers (max 100)
```

**Status:** ✅ Industry best practice - prevents garbage collection stutters

### 2. Delta Time Game Loop
**Research finding:** requestAnimationFrame + delta time is the 2026 standard
**Our status:** ✅ Already using `dt` (delta time) throughout Game.ts

### 3. Modular Architecture
**Our structure:**
- WaveManager.ts - enemy spawning
- ItemSystem.ts - item effects
- TransformationSystem.ts - item combos
- SaveManager.ts - persistence
- AudioManager.ts - sound

**Status:** ✅ Clean separation of concerns

---

## Major Improvement Opportunities 🎯

### 1. **Spatial Partitioning for Collision Detection** (HIGH IMPACT)

**Current approach:** Brute force O(n²) collision checks
**Problem:** Checking every enemy vs every projectile is expensive

**Solution:** Quadtree spatial partitioning
- **Performance gain:** 10-100x faster collision detection
- **Implementation:** Use [quadtree-js](https://github.com/timohausmann/quadtree-js)

**How it works:**
```javascript
// Instead of checking ALL objects against ALL objects:
for (enemy of enemies) {
  for (projectile of projectiles) { // O(n²) - SLOW
    checkCollision(enemy, projectile);
  }
}

// Quadtree checks only NEARBY objects:
quadtree.clear();
quadtree.insertAll(enemies);
for (projectile of projectiles) {
  nearby = quadtree.retrieve(projectile); // Only nearby enemies!
  for (enemy of nearby) { // Much smaller set
    checkCollision(enemy, projectile);
  }
}
```

**Resources:**
- [Broad Phase Collision Detection](http://buildnewgames.com/broad-phase-collision-detection/)
- [Optimizing Collision Detection](https://jsforgames.com/optimizing-collision-detection/)
- [Quadtree Collision Detection Blog](https://pvigier.github.io/2019/08/04/quadtree-collision-detection.html)

**Estimated impact:** 30-50% FPS improvement when 100+ entities on screen

---

### 2. **Layered Canvas Rendering** (MEDIUM-HIGH IMPACT)

**Current approach:** Redraw everything every frame
**Problem:** Redrawing static/slow-moving elements wastes GPU cycles

**Solution:** Multiple canvas layers
```javascript
// 3 canvas layers:
1. Background layer (rarely changes) - draw once, reuse
2. Game entities layer (enemies, player, projectiles) - update every frame
3. UI/HUD layer (health bars, gold) - update only when values change
```

**Benefits:**
- 15-30% FPS improvement (proven by vampire-survivors-enhanced)
- Background can be drawn once and cached
- HUD only redraws when stats change
- Particle effects on separate layer

**Implementation:**
```html
<canvas id="bg-layer"></canvas>     <!-- Z-index: 1 -->
<canvas id="game-layer"></canvas>   <!-- Z-index: 2 -->
<canvas id="ui-layer"></canvas>     <!-- Z-index: 3 -->
```

**Resources:**
- [vampire-survivors-enhanced](https://github.com/BareTread/vampire-survivors-enhanced) uses this technique

---

### 3. **Aggressive Particle Reduction** (MEDIUM IMPACT)

**Current approach:** Unlimited particles
**Problem:** Hundreds of particles tank FPS

**Solution:** Strict particle limits with quality over quantity
- **Best practice:** Max 15-20 particles per effect (vs 150+)
- **Technique:** Make particles bigger, brighter, more impactful
- **Result:** Better visuals + better performance

**Implementation:**
```typescript
// In createParticle():
const MAX_PARTICLES = 20; // Hard limit
if (this.particles.length >= MAX_PARTICLES) {
  this.particles.shift(); // Remove oldest
}
```

**Proven by:** vampire-survivors-enhanced (90% reduction, better visuals)

---

### 4. **Adaptive Quality Scaling** (MEDIUM IMPACT)

**Current approach:** Same quality for all devices
**Problem:** Low-end devices struggle; high-end devices underutilized

**Solution:** Automatically scale quality based on FPS
```typescript
class QualityManager {
  private targetFPS = 60;
  private currentQuality = 'high';

  adjustQuality(actualFPS: number) {
    if (actualFPS < 45 && this.currentQuality === 'high') {
      this.currentQuality = 'medium';
      this.reduceParticles();
      this.simplifyEffects();
    } else if (actualFPS > 55 && this.currentQuality === 'medium') {
      this.currentQuality = 'high';
    }
  }
}
```

**Quality levels:**
- **High:** All particles, shadows, post-processing
- **Medium:** Reduced particles, simplified shadows
- **Low:** Minimal particles, no shadows, simple shapes

**Resources:**
- [Ensuring Consistent Animation Speeds](https://www.kirupa.com/animations/ensuring_consistent_animation_speeds.htm)

---

### 5. **Performance Monitoring Dashboard** (LOW IMPACT, HIGH VALUE)

**Current approach:** No runtime performance metrics
**Problem:** Can't diagnose performance issues without data

**Solution:** F2 key toggles debug overlay
```typescript
// Real-time display:
- FPS (current, min, max, avg)
- Entity counts (enemies, projectiles, particles)
- Pool usage (projectiles: 45/200)
- Render time per frame
- Memory usage
- Recommendations ("Too many particles! Reduce spawn rate")
```

**Benefits:**
- Instantly see performance bottlenecks
- Helps players with low FPS troubleshoot
- Invaluable for development/balancing

**Implementation:** Simple canvas overlay, toggled with keyboard

---

### 6. **Offscreen Canvas Caching** (MEDIUM IMPACT)

**Current approach:** Draw sprites/backgrounds every frame
**Problem:** Re-rendering complex static graphics is wasteful

**Solution:** Pre-render to hidden canvas, then copy
```typescript
// One-time render to hidden canvas:
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');
drawComplexBackground(offscreenCtx); // Draw once

// In game loop, just copy:
mainCtx.drawImage(offscreenCanvas, 0, 0); // Super fast!
```

**Use cases:**
- Complex backgrounds
- Repeating UI elements
- Static particle effects
- Shop interface backgrounds

**Performance:** Much faster than redrawing hundreds of shapes

**Resources:**
- [Object Pools & Performance](https://code.tutsplus.com/object-pools-help-you-reduce-lag-in-resource-intensive-games--gamedev-651t)

---

## Additional Optimization Patterns Found

### Delta Time Best Practices
**From research:** Always use `speed * deltaTime` for frame-rate independence
- **Our status:** ✅ Already doing this (scaledDt everywhere)
- **Why it matters:** Ensures 60Hz and 120Hz displays run at same game speed

**Resources:**
- [Performant Game Loops in JavaScript](https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/)
- [requestAnimationFrame + Delta Time](https://dev.to/kehinde_owolabi_e2e54567a/boosting-tcjsgame-performance-with-requestanimationframe-and-delta-time-5h3i)

### Object Pooling Patterns (We Have This!)
**When pooling helps most:**
1. High instantiation rate (projectiles, particles)
2. High initialization cost
3. Low number of active instances at once

**Our implementation is solid** - no changes needed

**Resources:**
- [Object Pooling Complete Guide](https://medium.com/@dilupa.sheh02/object-pooling-in-game-development-the-complete-guide-1786694fcb80)
- [Efficient Particle Systems](https://webglfundamentals.org/webgl/lessons/webgl-qna-efficient-particle-system-in-javascript---webgl-.html)

---

## Prioritized Implementation Roadmap

### Phase 1: Quick Wins (1-2 hours)
1. **Particle limits** - Add MAX_PARTICLES constant, enforce limit
2. **Performance monitor** - F2 key debug overlay with FPS/entity counts
3. **Offscreen canvas** - Cache shop background, reduce redraws

**Expected gain:** 10-20% FPS improvement

### Phase 2: Core Optimizations (4-6 hours)
1. **Quadtree collision detection** - Integrate quadtree-js library
2. **Layered canvas** - Split into 3 layers (bg, game, ui)

**Expected gain:** 30-50% FPS improvement

### Phase 3: Polish (2-3 hours)
1. **Adaptive quality** - Auto-scale based on FPS
2. **Refine particle effects** - Fewer, better particles

**Expected gain:** Better experience across all devices

---

## Code Examples to Adopt

### Quadtree Integration (from quadtree-js)
```typescript
import Quadtree from 'quadtree-js';

// In Game.ts constructor:
this.quadtree = new Quadtree({
  x: 0,
  y: 0,
  width: this.canvas.width,
  height: this.canvas.height
});

// In update loop:
this.quadtree.clear();
this.enemies.forEach(e => this.quadtree.insert(e));

// Collision detection:
this.projectiles.forEach(proj => {
  const nearby = this.quadtree.retrieve(proj);
  nearby.forEach(enemy => {
    if (this.checkCollision(proj, enemy)) {
      this.handleHit(proj, enemy);
    }
  });
});
```

### Layered Canvas Setup
```typescript
class LayeredRenderer {
  bgCanvas: HTMLCanvasElement;
  gameCanvas: HTMLCanvasElement;
  uiCanvas: HTMLCanvasElement;

  constructor() {
    this.bgCanvas = this.createLayer('bg-layer', 1);
    this.gameCanvas = this.createLayer('game-layer', 2);
    this.uiCanvas = this.createLayer('ui-layer', 3);
  }

  createLayer(id: string, zIndex: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.style.position = 'absolute';
    canvas.style.zIndex = zIndex.toString();
    document.body.appendChild(canvas);
    return canvas;
  }
}
```

---

## Techniques We Should NOT Adopt

### ❌ ECS (Entity Component System)
**Why:** Too complex for our scale, marginal benefit
**Our approach:** Current OOP architecture is fine for 100-200 entities

### ❌ WebGL/Three.js
**Why:** 2D canvas is sufficient, WebGL adds complexity
**Our approach:** Stick with Canvas 2D, optimize what we have

### ❌ Web Workers for game logic
**Why:** Message passing overhead > benefit for our use case
**When it helps:** Physics simulations, pathfinding (not our bottleneck)

---

## Key Learnings from Other Projects

### From vampire-survivors-enhanced:
- **Quality over quantity** for particles (15 vs 150)
- **Layered rendering** gives 15-30% FPS boost
- **Performance monitoring** should be built-in (F2 key)
- **Object pooling** is non-negotiable for bullet-hell games

### From collision detection research:
- **Quadtree** is the standard for 2D spatial partitioning
- **10-100x speedup** is realistic for dense entity scenarios
- **Two-phase detection:** Broad phase (quadtree) → Narrow phase (precise check)

### From game loop research:
- **requestAnimationFrame** is the only correct choice (vs setInterval/setTimeout)
- **Delta time** must account for variable frame rates
- **GPU-accelerated properties:** transform, opacity (avoid layout triggers)

---

## References & Resources

### GitHub Projects
- [vampire-survivors-enhanced](https://github.com/BareTread/vampire-survivors-enhanced) - High-performance implementation
- [Survivors-Like](https://github.com/tiny-ai-ops/Survivors-Like) - Browser-based clone
- [Froguelite](https://github.com/LilypadGames/Froguelite) - Phaser 3 + TypeScript roguelite
- [quadtree-js](https://github.com/timohausmann/quadtree-js) - Spatial partitioning library
- [JSRL](https://github.com/slashman/jsrl) - Roguelike template

### Technical Articles
- [Broad Phase Collision Detection](http://buildnewgames.com/broad-phase-collision-detection/)
- [Optimizing Collision Detection](https://jsforgames.com/optimizing-collision-detection/)
- [Performant Game Loops in JavaScript](https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/)
- [Object Pooling Guide](https://code.tutsplus.com/object-pools-help-you-reduce-lag-in-resource-intensive-games--gamedev-651t)
- [Quadtree Collision Detection](https://pvigier.github.io/2019/08/04/quadtree-collision-detection.html)

### Performance Optimization
- [requestAnimationFrame Best Practices](https://www.debugbear.com/blog/requestanimationframe)
- [Delta Time for Consistent Motion](https://dev.to/kehinde_owolabi_e2e54567a/boosting-tcjsgame-performance-with-requestanimationframe-and-delta-time-5h3i)
- [Efficient Particle Systems](https://webglfundamentals.org/webgl/lessons/webgl-qna-efficient-particle-system-in-javascript---webgl-.html)

---

## Next Steps

1. **Immediate:** Add particle limits (5 min fix, instant improvement)
2. **Short-term:** Implement quadtree collision detection (biggest impact)
3. **Medium-term:** Layered canvas rendering (15-30% FPS gain)
4. **Long-term:** Adaptive quality scaling (better device support)

**Total expected improvement:** 40-60% FPS gain on typical hardware

---

**Prepared for:** Felix Kollin, CTO LetsBridge
**Game:** Vampire Survivors-style roguelite
**Codebase:** `/workspace/work/roguelite-game/`
