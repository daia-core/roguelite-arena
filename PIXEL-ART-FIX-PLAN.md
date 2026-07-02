# Pixel Art Fix - Applying Derek Yu Principles

**Date:** 2026-07-02 08:41
**Goal:** Fix all 5 cardinal pixel art mistakes + Stardew-specific issues

---

## The 5 Mistakes Being Fixed

### 1. Too Many Similar Colors
**Problem:** Muddy palette with low contrast
**Fix:** Restrict to 8-12 distinct colors per sprite; ensure each color has clear identity

### 2. Naive Coloring
**Problem:** "Sky is blue, grass is green" - no color complexity
**Fix:** **HUE SHIFTING** - shadows shift COOLER (blue/purple), highlights shift WARMER (yellow/orange)

Example transformations:
- Red base → Purple shadow (shift toward blue), Orange highlight (shift toward yellow)
- Blue shirt → Darker navy-purple shadow (shift toward purple), Lighter cyan highlight (shift toward cyan)
- Skin → Cooler peachy-pink shadow (shift toward pink/purple), Warmer orange highlight

### 3. Pillow Shading
**Problem:** Shading from outline inward (creates pillowy blur)
**Fix:** Establish consistent light source (top-left) and shade based on 3D form, not outline

### 4. Cardboard Designs
**Problem:** Stiff, symmetric, grid-aligned sprites with no personality
**Fix:**
- Break perfect symmetry
- Add personality through asymmetric features (one eye higher, clothes wrinkle differently)
- Implied motion even in idle stance

### 5. Thin Protrusions
**Problem:** Single-pixel-thick elements that can't be shaded
**Fix:** Minimum 2-pixel width for any shadeable form

---

## Implementation Plan

### Step 1: Create Hue-Shifted Palette
Define a master Stardew Valley palette with proper hue-shifting built in.

### Step 2: Redesign Player Sprite
- Add asymmetry (head tilt, one shoulder higher)
- Fix shading to follow light source (not outline)
- Apply hue-shifted colors

### Step 3: Fix Key Enemy Sprites
Start with:
- Slime (simple, good test case)
- Goblin (medium complexity)
- Skeleton (complex, shows hue-shifting in white/bone)

### Step 4: Systematic Application
Apply to all 29 enemy types using the established principles.

---

## Color Palette - With Hue Shifting

### Skin Tones
```
Base:      #f5a883 (peachy)
Shadow:    #d97c59 (shift toward red/pink, NOT just darker)
Highlight: #ffe4c4 (shift toward yellow, warm)
```

### Blue (Shirt/Clothes)
```
Base:      #7eb4db (sky blue)
Shadow:    #4a7ba7 (shift toward purple-blue)
Highlight: #b3d9ff (shift toward cyan)
```

### Green (Slime/Nature)
```
Base:      #6ebe30 (grass green)
Shadow:    #4a7c2b (shift toward blue-green)
Highlight: #9ee85e (shift toward yellow-green)
```

### Brown (Wood/Earth)
```
Base:      #8b5a3c (brown)
Shadow:    #5a3825 (shift toward red-brown)
Highlight: #c17a54 (shift toward orange)
```

### Purple/Violet (Magic)
```
Base:      #9966cc (purple)
Shadow:    #6633aa (shift toward blue-purple)
Highlight: #cc99ff (shift toward pink)
```

---

## Next Steps

1. ✓ Research complete (Derek Yu + Stardew techniques)
2. → Create improved sprite designs with hue-shifting
3. → Implement in sprites.ts
4. → Build and test
5. → Verify in cockpit-qa
6. → Deploy

**This document tracks the systematic fix to make the pixel art professional, not amateur.**
