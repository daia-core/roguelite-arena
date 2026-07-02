# Pixel Art Research: Why the Roguelite Looks Amateur

**Research date:** 2026-07-02
**Focus:** Stardew Valley techniques, common mistakes, professional polish

## Verdict

The current roguelite pixel art suffers from **all five cardinal mistakes** Derek Yu identifies in professional pixel art:

1. ✗ **Too many similar colors** - muddy palette with low contrast
2. ✗ **Naive coloring** - "sky is blue, grass is green" thinking without color complexity
3. ✗ **Pillow shading** - shading from outline inward (particles, some effects)
4. ✗ **Cardboard designs** - stiff, grid-aligned sprites without personality
5. ✗ **Thin protrusions** - single-pixel-thick elements that can't be shaded properly

Plus **critical Stardew-specific issues**:
- Missing **hue shifting** in shadows/highlights (just darker/lighter same hue)
- No **dithering** for transitions (using alpha blending instead, which isn't pixel art)
- Inconsistent **outline weight** and style
- GUI lacks warmth, texture, and **legibility at a glance**

---

## Key Findings

### 1. Color Palette Must Do Heavy Lifting

**The problem:** Using too many similar colors that blend together.

**Derek Yu's rule:** "We want each color to have its own identity so that it can do as much work as possible. The efficiency of each dot is what makes pixel art unique."

**Stardew Valley approach:**
- **Hue shifting**: Shadows shift to cooler hues, highlights to warmer hues. For example, highlights on red shift toward orange-yellow, mimicking real light.
- **Restrict palette**: 8-16 colors total to force consistency and intentionality.
- **Vibrant, saturated colors**: Stardew uses bright, engaging colors that evoke positive emotions, not muted or washed-out tones.

**Source:** [Derek Yu - Common Mistakes](https://www.derekyu.com/makegames/pixelart2.html), [Stardew Modding Wiki](https://stardewmodding.wiki.gg/wiki/How_to_make_pixel_art)

---

### 2. Volume Through Proper Shading

**The problem:** "Pillow shading" - shading from the outline inward, creating a pillowy blur effect that never occurs in real life.

**Derek Yu's fix:** "Think in terms of forms that have volume (3D space). Reduce objects to simpler shapes when shading: a treetop is a few green spheres, not thousands of leaves."

**Stardew Valley shading:**
- **40% opacity black** for furniture shadows, about 1 pixel left and 2 pixels down
- Shadows vary by object type in opacity and color
- Light source is consistent and implies direction

**Current issue:** Particles use gradients (smooth alpha blending) instead of dithered shading. Damage numbers fade with alpha instead of dithering. This breaks the pixel art aesthetic.

**Source:** [Derek Yu](https://www.derekyu.com/makegames/pixelart2.html), [Stardew Modding Wiki](https://stardewmodding.wiki.gg/wiki/How_to_make_pixel_art)

---

### 3. Chunky Pixels Rule (No Thin Protrusions)

**Derek Yu's "Chunky Pixels Rule":** "Avoid rendering anything with only a single pixel of thickness. New pixel artists make arms, legs, and tree branches very thin. This makes them hard to shade and consequently hard to sculpt into 3D forms, resulting in flat, flimsy work."

**Current issue:** Trail pixels (6px square) are chunky enough, but some particle effects and slash pixels might be too small/thin to shade properly.

**Fix:** Minimum 2-pixel width for any element that needs shading or form.

**Source:** [Derek Yu](https://www.derekyu.com/makegames/pixelart2.html)

---

### 4. Dynamic vs Cardboard Designs

**The problem:** Designing along straight grid lines, creating stiff, flat sprites.

**Derek Yu's advice:** "Think less in terms of lines/shapes and more in terms of forms with volume. Bring out the personality of each object - imagine them moving around and exaggerate features that represent them."

**Stardew Valley character design:**
- Chibi/super-deformed style with large heads and eyes for expressiveness in small space
- Characters have personality and life even at 16x16 resolution
- Sprites are not perfectly symmetric - subtle asymmetry adds life

**Current issue:** Player and enemy sprites are too symmetric and grid-aligned. They lack the organic, lived-in feel of Stardew sprites.

**Source:** [Derek Yu](https://www.derekyu.com/makegames/pixelart2.html), [Stuart's Pixel Games](https://stuartspixelgames.com/2022/05/25/how-to-work-out-size-of-sprites-game-world/)

---

### 5. Sprite Scale & Readability

**Best practice for roguelikes:** 16x16 is the sweet spot for first games - detailed enough to be readable, small enough to produce quickly. 32x32 is ideal for indie games with readable faces and manageable production cost.

**Current state:** We're using 16x16 base at 6x scale = 96px final. This is correct sizing.

**However:** The actual pixel art detail is lacking. Just making things bigger doesn't fix amateur execution.

**Source:** [2D Pixel Art Style Guide](https://www.sprite-ai.art/blog/2d-pixel-art-style-guide), [Stuart's Pixel Games](https://stuartspixelgames.com/2022/05/25/how-to-work-out-size-of-sprites-game-world/)

---

### 6. Animation Principles for Pixel Art

**Key insight:** "A 4-frame walk cycle with good timing beats 8 frames with flat timing."

**Squash and stretch:** Even at 16x16, one pixel compression before a jump and one pixel stretch at peak removes robotic stiffness.

**Current state:** We have 2-frame idle animations (breathing), which is good. But no anticipation/follow-through in movements.

**Source:** [Medium - Tips for Pixel Art](https://medium.com/@thomaspalef/tips-to-make-pixel-art-for-your-games-7b770ffcfde3)

---

### 7. GUI Design (Stardew Valley Style)

**Characteristics:**
- **Large, clear elements** easy to interact with
- **Bright, engaging colors** that evoke positive emotions
- **Simple, recognizable icons** and **legible fonts**
- **All necessary information at a glance** (inventory, health, quest trackers)
- **Functional AND visually delightful** - not just utilitarian

**Texture approach:**
- Buttons use stone/wood textures but they should feel **warm and inviting**, not cold or generic
- Subtle pixel-art patterns add richness without noise
- **Rounded corners** (2-3 pixel radius) soften the interface

**Current issue:** Our buttons have texture but lack warmth and personality. The GUI doesn't feel as welcoming as Stardew's.

**Source:** [SynthronAI - Stardew UI](https://synthronai.com/how-to-make-stardew-valley-type-ui/), [Interface In Game](https://interfaceingame.com/games/stardew-valley/)

---

### 8. Dithering Instead of Alpha Blending

**Critical rule:** Pixel art uses **dithering** (checkerboard patterns of pixels) to create the illusion of transparency, gradients, and smooth transitions - NOT canvas alpha blending or gradients.

**Why:** Alpha blending creates smooth, anti-aliased edges that break the pixel art aesthetic. Dithering maintains the crisp, intentional pixel grid.

**Dithering patterns:**
- **100% opaque:** Full solid square
- **75% visible:** Skip 1 in 4 pixels (sparse checkerboard)
- **50% visible:** Checkerboard pattern (alternating pixels)
- **25% visible:** Sparse dither (1 in 4 pixels visible)

**Current mistakes:**
- ~~Projectile trails use `ctx.globalAlpha`~~ Fixed
- ~~Particles fade with alpha~~ Fixed (now using dithering)
- ~~Damage numbers use alpha~~ Fixed (now pixel font with dithering)

**Source:** [Derek Yu](https://www.derekyu.com/makegames/pixelart2.html), [Pixel Art Common Mistakes](https://www.phonoforest.com/2020/05/3-major-mistakes-pixel-art-beginners.html)

---

## What Makes Professional Pixel Art

Based on [Derek Yu](https://www.derekyu.com/makegames/pixelart2.html) and industry sources:

1. **Craftsmanship** - Technical mastery on display, not just "charming naivety"
2. **Intentional palette** - Every color has a job; hue-shifted shading
3. **Volume and form** - 3D thinking, proper light/shadow direction
4. **Personality** - Sprites feel alive and in motion, not stiff
5. **Efficient pixels** - Each pixel does maximum work; no waste
6. **Consistent rules** - Outline weight, shading direction, palette across all assets
7. **Dithering for effects** - No smooth blending; use pixel patterns

---

## Recommended Fixes for the Roguelite

### Immediate (Critical)

1. **Audit the color palette** - Ensure each color is distinct and has identity
2. **Add hue shifting** - Shadows shift cool, highlights shift warm (e.g., red → purple shadow, orange highlight)
3. **Fix pillow shading** - Establish light source direction and shade accordingly
4. **Add personality** - Sprites should feel alive: asymmetry, exaggerated features, implied motion
5. **Thicken thin elements** - 2-pixel minimum width for shadeable forms

### Polish (Professional)

6. **Create a written style guide** - Document resolution, palette, outline rules, shading direction, animation timing
7. **Add squash/stretch to animations** - 1-pixel compression/stretch for anticipation and follow-through
8. **Warm up the GUI** - Add texture warmth, inviting colors, better legibility
9. **Consistent outline weight** - Don't mix thick/thin outlines randomly
10. **Use pre-made palettes** - Start with proven Stardew-like palette (Lospec has many)

---

## Sources

Core references:
- [Derek Yu - Pixel Art Common Mistakes](https://www.derekyu.com/makegames/pixelart2.html) - Definitive guide by Spelunky creator
- [Derek Yu - Pixel Art Basics](https://www.derekyu.com/makegames/pixelart.html)
- [Stardew Modding Wiki - How to Make Pixel Art](https://stardewmodding.wiki.gg/wiki/How_to_make_pixel_art)
- [2D Pixel Art Style Guide](https://www.sprite-ai.art/blog/2d-pixel-art-style-guide)
- [SynthronAI - Stardew Valley UI](https://synthronai.com/how-to-make-stardew-valley-type-ui/)
- [Medium - Tips to Make Pixel Art](https://medium.com/@thomaspalef/tips-to-make-pixel-art-for-your-games-7b770ffcfde3)
- [Stuart's Pixel Games - Sprite Sizing](https://stuartspixelgames.com/2022/05/25/how-to-work-out-size-of-sprites-game-world/)

Additional context:
- [Phonoforest - 3 Major Pixel Art Mistakes](https://www.phonoforest.com/2020/05/3-major-mistakes-pixel-art-beginners.html)
- [Interface In Game - Stardew Valley](https://interfaceingame.com/games/stardew-valley/)
