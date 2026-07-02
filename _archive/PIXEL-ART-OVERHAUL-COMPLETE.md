# Pixel Art Overhaul - Complete (No More Shortcuts!)

**Date:** 2026-07-02
**Scope:** Removed ALL smooth rendering techniques from the game - no more lazy shortcuts

## What Was Wrong (The Shortcuts I Was Taking)

You were absolutely right. I was claiming "pixel art" while using smooth canvas effects everywhere:

- ❌ `ctx.globalAlpha` - smooth transparency blending
- ❌ `ctx.shadowBlur` - smooth glows
- ❌ `ctx.createLinearGradient` / `ctx.createRadialGradient` - smooth color transitions
- ❌ `ctx.globalCompositeOperation = 'lighter'` - smooth additive blending
- ❌ `ctx.filter` (blur, brightness) - smooth post-processing

These create anti-aliased, smooth effects that have **nothing to do with pixel art**. True pixel art uses hard-edged pixels and dithering patterns - no blending.

## What I Fixed (Pure Pixel Art Now)

Replaced every smooth effect with authentic pixel art techniques:

### 1. **Dithering for Transparency**
Instead of `ctx.globalAlpha = 0.5` (smooth 50% transparent), I now use checkerboard dither patterns:
- 100% opacity: all pixels drawn
- 75% opacity: skip 1 in 4 pixels
- 50% opacity: checkerboard pattern (skip every other)
- 25% opacity: sparse pattern (only 1 in 4 pixels)

### 2. **Dithering for Fading**
Particles, trails, and flashes fade out using progressively sparser dither patterns - **not** smooth alpha blending.

### 3. **Solid Colors Only**
No gradients anywhere in game rendering - health bars, circles, effects all use flat colors with dithered shading where needed.

### 4. **No Post-Processing**
No shadowBlur, no filter effects, no composite operations - just direct pixel drawing.

## Files Fixed

### Core Game Rendering
- **Projectile.ts** - Trail now uses dithered fade instead of `globalAlpha`
- **Particle.ts** - Complete rewrite: dithered fade, removed additive glow, dithered transparency
- **MeleeAttack.ts** - Slash effect uses dithered visibility instead of `globalAlpha`
- **ScreenEffects.ts** - Screen flash uses dithered pattern instead of smooth overlay

### Entity Rendering
- **Enemy.ts**
  - Removed all shadowBlur effects
  - Ghost/phantom/wraith transparency: dithered clipping masks instead of `globalAlpha`
  - Hit flash: color replacement instead of additive blend
  - Health bar: solid colors instead of gradients
  - Fallback circle: solid fill instead of radial gradient

- **Player.ts**
  - Removed all shadowBlur effects
  - Dash effect: 70% dithered pattern instead of `globalAlpha = 0.7`
  - Invincibility blink: alternates between full and 33% dithered instead of smooth alpha
  - Fallback circle: solid fill instead of radial gradient

### Screen Effects
- **Renderer.ts**
  - Impact flashes: dithered fade instead of `globalAlpha`
  - Hit flash overlay: dithered screen pattern instead of smooth alpha overlay

- **Input.ts**
  - Joystick: dithered circles instead of smooth alpha + shadow

## Technical Details

**Before (Lazy):**
```typescript
ctx.globalAlpha = 0.5; // Smooth 50% transparency
ctx.fillRect(x, y, width, height);
```

**After (Proper Pixel Art):**
```typescript
// 50% checkerboard dither - no smooth blending
for (let dx = 0; dx < width; dx += 2) {
  for (let dy = 0; dy < height; dy += 2) {
    if ((dx + dy) % 4 === 0) {
      ctx.fillRect(x + dx, y + dy, 2, 2);
    }
  }
}
```

## Result

Every visual effect in the game now uses authentic pixel art techniques:
- ✅ Hard-edged pixels only
- ✅ Dithering for all transparency/fading effects
- ✅ Solid colors, no gradients
- ✅ No anti-aliasing, shadows, or post-processing
- ✅ `ctx.imageSmoothingEnabled = false` everywhere

The game now has **genuine Stardew Valley pixel art aesthetic** - not just pixel sprites with smooth effects slapped on top.

## Build Status

✅ TypeScript compiled
✅ Vite build successful
✅ Deployed to canvas

**Canvas URL:** `${CANVAS_BASE_URL}/roguelite/`
