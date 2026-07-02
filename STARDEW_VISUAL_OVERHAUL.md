# Complete Stardew Valley Visual Overhaul

Replace the current medieval pixel art with authentic Stardew Valley aesthetic: warm saturated colors, clean readable sprites, proper scaling, and cohesive tiled background.

## Context

The game currently has:
- **Scaling issues**: Player sprite is 96x96px (16x16 @ 6x scale) but enemies vary wildly (64-96px @ 4x scale), making everything look inconsistent and too small
- **Inconsistent scaling**: `frontend/src/sprites.ts:51` sets default `scale = 6` for player, but lines 317-1418 use `scale = 4` for all 35+ enemy types
- **Background mismatch**: `frontend/src/StardewBackground.ts` already has proper Stardew-style tiled grass (32x32 tiles, `#6ebe30` base green), but sprites don't match this aesthetic
- **Style mismatch**: Current sprites use "medieval" dark/muted colors (`#78716c`, `#292524`) instead of Stardew's warm, saturated palette
- **Player drawing**: `frontend/src/Player.ts:336-340` draws sprites centered at player position

## Research: Stardew Valley Specifications

From official Stardew modding docs:
- **Character sprites**: 16x16 pixels per frame (base resolution)
- **Overworld NPCs**: 16x32 sprites (16 wide, 32 tall for body)
- **Color palette**: Warm, highly saturated colors - bright greens (`#6ebe30`), peachy skin (`#f5a883`), rich blues
- **Shading**: Simple 2-3 tone shading, no complex gradients
- **Readability**: Bold outlines, high contrast between adjacent colors
- **Tiles**: 16x16 ground tiles (scaled up for display)

## Approach

### 1. Standardize Scaling (Priority 1)
**File**: `frontend/src/sprites.ts`

Current problem:
```typescript
// Line 51 - default for drawPixels
scale: number = 6  // Player uses this

// Lines 317-1418 - every enemy overrides this
const scale = 4;  // 35+ times!
```

**Fix**:
- Change default scale to **8** (makes 16x16 base → 128x128 final, perfect for Stardew visibility)
- Remove all 35+ `const scale = 4` local overrides - let everything use the default
- Update player size calculation: `const size = 128; // 16x16 base * 8 scale`
- Update all enemy size calculations similarly

### 2. Replace Player Sprite with Stardew Farmer
**File**: `frontend/src/sprites.ts:64-139`

Replace the current medieval knight (`idlePixels1`, `idlePixels2` @ lines 73-110) with Stardew farmer:

**Stardew Valley color palette** (replace lines 113-123):
```typescript
const playerColors = [
  'transparent',
  '#000000',      // 1 - outline (pure black, Stardew style)
  '#f5a883',      // 2 - skin (peachy, warm)
  '#6b4423',      // 3 - hair (brown)
  '#4a2f1a',      // 4 - hair shadow
  '#7eb4db',      // 5 - shirt (bright blue)
  '#5a92c4',      // 6 - shirt shadow
  '#3b6e9e',      // 7 - pants (denim blue)
  '#2d5478',      // 8 - pants shadow
  '#8b5a3c',      // 9 - boots (brown)
];
```

**Sprite design** (16x16 base, simple readable farmer):
- Rows 0-5: Round head with simple hair
- Rows 6-10: Blue shirt/tunic (Stardew's signature bright blue)
- Rows 11-14: Denim pants
- Rows 15: Brown boots

Keep it **simple** - Stardew characters are iconic precisely because they're minimal. Two-frame idle animation (slight bob).

### 3. Redesign All Enemy Sprites
**File**: `frontend/src/sprites.ts:142-1440`

Current enemies use medieval dark palette. Replace with Stardew creature colors:

**Slime** (lines 172-264):
- Base color: `#6ebe30` (bright spring green - match the grass!)
- Shadow: `#5ba02a`
- Highlight: `#8fd649`
- Eyes: Simple white ovals with black pupils
- Keep the bouncy blob shape - it's perfect for Stardew

**Goblin** (lines 176-244):
- Skin: `#7cb342` (lime green, fantasy)
- Vest: `#8b4513` (brown)
- Keep simple, cartoony proportions

**Skeleton** (lines 280-321):
- Bone: `#e8dcc0` (warm cream, not cold gray)
- Shadow: `#a89968` (warm tan)
- Eyes: Hollow blacks

**Color palette rules**:
1. **Warm everything** - shift grays toward browns, blues toward teals
2. **Saturate** - boost saturation 40-60% from current values
3. **High contrast** - adjacent colors should differ noticeably
4. **Outline everything** in pure black `#000000`

### 4. Redesign Projectiles
**File**: `frontend/src/sprites.ts:1465-1535`

- **Player projectile**: Bright blue magic bolt (`#3b82f6` → `#60a5fa` → white center), 16x16 @ 8x scale = 128px canvas
- **Enemy projectile**: Purple magic (`#a855f7` → `#c084fc` center), 12x12 @ 8x scale = 96px canvas

### 5. Redesign Items & Pickups
**Files**: `frontend/src/sprites.ts:1537-1579` (pickups), `UISprites.ts` (item icons)

- **XP gem**: Bright blue crystal `#3b82f6` with white sparkle
- **Gold coin**: Rich yellow `#fbbf24` → `#fde68a` highlight
- **Item icons**: Use Stardew's vibrant palette (red potions `#dc2626`, blue shields `#60a5fa`, green nature items `#10b981`)

Keep items **16x16 base @ 8x scale = 128px** for consistency.

### 6. Background Already Perfect
**File**: `frontend/src/StardewBackground.ts`

✅ Already uses authentic Stardew colors (`#6ebe30` grass base, `#a67c52` dirt)
✅ Already has proper 32x32 tiled system with variants
✅ No changes needed - this is the reference for sprite colors!

## Implementation Order

1. **First**: Change default scale to 8 in `drawPixels()` signature (line 51)
2. **Second**: Delete all `const scale = 4;` lines throughout sprites.ts (35+ occurrences)
3. **Third**: Update all `const size =` calculations to use new scale (16x16 base becomes 128, 24x24 becomes 192, etc.)
4. **Fourth**: Redesign player sprite with Stardew farmer palette
5. **Fifth**: Batch redesign enemies - start with slime/goblin/skeleton (most common), then others
6. **Sixth**: Update projectiles and pickups
7. **Seventh**: Update UI item icons in `UISprites.ts` to match

## Constraints

- **DO NOT** change game logic/mechanics - only visual appearance
- **DO NOT** modify background files - `StardewBackground.ts` is already perfect
- **DO NOT** change sprite positioning code in `Player.ts`, `Enemy.ts`, etc. - only the sprite data
- **KEEP** the existing 16x16 base pixel art structure - only change colors and scaling
- **MATCH** the background's color palette (`#6ebe30` grass green as reference)
- **TEST** in-game after each major section to verify scaling looks good

## Done When

1. All sprites scale consistently at 8x (128x128 for 16x16 base)
2. Player sprite looks like Stardew Valley farmer (bright blue shirt, peachy skin, simple design)
3. Enemy sprites use Stardew's warm, saturated palette (greens, browns, vibrant colors)
4. Sprites match the background aesthetic (warm spring farm vibes)
5. Everything is readable and properly sized (not tiny!)
6. Game runs without errors: `cd frontend && npm run dev`
7. Vercel deployment succeeds (no build errors)

## Visual Reference

Stardew Valley farmer sprite characteristics:
- Round friendly head with simple hair
- Bright saturated clothing (blue/green are signature colors)
- Peachy warm skin tone (#f5a883 range)
- Pure black outlines
- Minimal shading (2-3 tones max per element)
- Readable at small sizes
- Warm, inviting, never gloomy or dark

Current background colors (match these):
- Grass: `#6ebe30` (bright spring green)
- Dirt: `#a67c52` (warm brown)
- These should guide the entire palette!
