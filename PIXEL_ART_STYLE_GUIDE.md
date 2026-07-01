# Medieval Pixel Art Style Guide
## For Felix's Roguelite Game

Based on comprehensive 2026 pixel art best practices research.

---

## Color Palette Philosophy

### Medieval Core Colors
**Earth Tones (Base):**
- Stone Gray: `#6b6b6b` → `#a8a8a8` → `#d4d4d4`
- Dirt Brown: `#5a4a3a` → `#8b6f47` → `#c19a6b`
- Wood Brown: `#654321` → `#8b6914` → `#cd853f`

**Vibrant Accents (Royal/Noble):**
- Royal Blue: `#1e3a8a` → `#3b82f6` → `#93c5fd`
- Crimson Red: `#7f1d1d` → `#dc2626` → `#f87171`
- Gold: `#854d0e` → `#eab308` → `#fde047`

**Natural Derivatives:**
- Forest Green: `#14532d` → `#22c55e` → `#86efac`
- Steel Silver: `#374151` → `#9ca3af` → `#f3f4f6`

### Hue Shifting Rules (CRITICAL)
**Shadows (Darken + Cool Shift):**
- Warm colors (red/orange/yellow) → shift toward red-purple
- Cool colors (blue/green) → shift toward blue-purple
- NEVER use pure black or pure gray

**Highlights (Lighten + Warm Shift):**
- All colors → shift toward yellow (mimics sunlight)
- Steel/armor → shift toward gold/warm white
- Skin → shift toward peachy-yellow

**Example Ramps:**
```
Red Armor:
Shadow:  #5a0a0a (purple-red)
Mid:     #b22222 (pure red)
Light:   #ff6347 (orange-red)
Rim:     #ffa07a (peachy highlight)

Blue Cloth:
Shadow:  #2b5a8a (purple-blue)
Mid:     #6db3f2 (sky blue)
Light:   #a3d8ff (cyan-shift)
Rim:     #ffffff (white rim light)
```

---

## Shading Techniques

### Three-Tone Shading (Minimum)
Every surface needs:
1. **Shadow** (deepest, hue-shifted cool)
2. **Midtone** (base color)
3. **Highlight** (brightest, hue-shifted warm)

### Optional Fourth Tone
- **Rim Light:** Extreme highlight on edges (sunlight hitting metal/armor)
- **Deep Shadow:** For crevices, under objects

### Dithering (Organic Textures)
- Use **clustered dithering** (2x2 or 3x3 patterns), not checkerboard
- Good for: slime goo, fabric texture, stone grain
- Bad for: metal, glass, smooth surfaces

### Anti-Aliasing (Manual)
- Add intermediate colors on **diagonal edges** only
- Don't anti-alias straight horizontal/vertical lines
- Hue-shift the AA color slightly toward one end (don't average)

---

## Animation Principles

### Frame Rates
- **Idle:** 6 FPS (166ms per frame)
- **Walk:** 8 FPS (125ms per frame)
- **Attack:** 10-12 FPS (83-100ms per frame)

### Walk Cycle (4 Frames Minimum)
```
Frame 1: Contact (right foot forward, left back)
Frame 2: Passing (right leg lifts, body rises)
Frame 3: Contact (left foot forward, right back) [mirror of Frame 1]
Frame 4: Passing (left leg lifts, body rises) [mirror of Frame 2]
```

**Key Principles:**
- Body **dips slightly** when foot touches ground (weight)
- Arms swing **opposite** to legs
- **Secondary motion:** Cape/hair follows 1-2 frames behind

### Idle Animation (2-4 Frames)
```
Frame 1: Neutral pose (200ms hold)
Frame 2: Slight lean/breath (200ms hold)
Frame 3: Return to neutral (200ms hold)
Frame 4: Slight lean opposite direction (200ms hold)
```

**Breathing Effect:**
- Shoulders rise/fall 1-2 pixels
- Head bobs slightly
- Adds life without movement

### Attack Animation (3-5 Frames)
```
Frame 1: Wind-up (50ms - fast anticipation)
Frame 2: Swing/strike (50ms)
Frame 3: Impact (150ms - HOLD for power feel)
Frame 4: Follow-through (100ms)
Frame 5: Recovery (100ms)
```

**Impact Frame:**
- Longest hold time (150-200ms)
- Screen shake trigger
- Hit particles spawn
- Frozen moment = satisfying hit

---

## Sprite Specifications

### Character Sizes
- **Player:** 22x20 pixel base @ 3x scale = 66x60 canvas
- **Small Enemy (Slime, Bat):** 18x17 pixel base @ 3x scale = 54x51 canvas
- **Medium Enemy (Goblin, Skeleton):** 18x17 pixel base @ 3x scale = 54x51 canvas
- **Large Enemy (Orc, Troll):** 24x24 pixel base @ 3x scale = 72x72 canvas
- **Boss (Demon):** 24x20 pixel base @ 3x scale = 72x60 canvas

### Silhouette Rules
**Must Pass Silhouette Test:**
- Fill sprite with solid black → still recognizable?
- If not, add more contrast/separation

**Clear Readability:**
- Important features (head, weapon, eyes) should be obvious
- Avoid muddy mid-tones in busy areas

---

## Medieval Aesthetic Specifics

### Knight/Player Character
**Must Have:**
- Helmet (steel gray with gold accents)
- Cape/cloak (red or blue, flowing)
- Armor plates (chest, shoulders)
- Clear weapon (sword visible)

**Color Scheme:**
- Primary: Royal blue or crimson red (cape/cloth)
- Secondary: Steel silver (armor)
- Accent: Gold (trim, helmet details)
- Skin: Peachy-tan (if visible)

### Enemies
**Slime:** Translucent green with nucleus, slight glow
**Goblin:** Green skin, crude leather armor, menacing eyes
**Skeleton:** Bone white with cool shadows, eerie eye glow
**Demon:** Dark red skin, golden horns, glowing eyes/mouth
**Orc:** Gray-green skin, heavy armor, brutish features
**Wraith:** Ethereal purple/blue, wispy transparency

### Environment (Medieval Castle/Dungeon)
**Floor:**
- Cobblestone pattern (3x3 tile repeat)
- Cracks, moss in corners
- Stone gray with brown dirt

**Walls:**
- Stone brick (varied sizes)
- Torch sconces (every 3-4 tiles)
- Banners/flags (royal colors)

**UI Elements:**
- Ornate borders (golden filigree)
- Stone panel backgrounds
- Medieval fonts (blocky, serif)

---

## Implementation Notes

### Sprite Sheet Format
Each animated sprite needs:
```typescript
{
  frames: HTMLCanvasElement[], // Array of frame canvases
  frameRate: number,           // FPS (6, 8, or 12)
  loop: boolean,               // True for idle/walk, false for attacks
  currentFrame: number,
  frameTimer: number
}
```

### Animation State Machine
```
IDLE → (movement input) → WALK
IDLE/WALK → (attack input) → ATTACK → IDLE
```

### Colored Outlines (NOT Pure Black)
- Dark outlines should be **hue-shifted** versions of the surface color
- Example: Blue armor outline = `#1e3a8a` (dark blue), NOT `#000000`
- Makes sprites less harsh, more cohesive

---

## Quality Checklist

Before finalizing a sprite:
- [ ] Silhouette is clear and recognizable
- [ ] Uses hue-shifted shadows (no pure black/gray)
- [ ] Has warm-shifted highlights
- [ ] Outlines are colored, not pure black
- [ ] Anti-aliasing on diagonals only
- [ ] Readable at 1x scale (before 3x upscale)
- [ ] Matches medieval aesthetic (armor, cloth, metal)
- [ ] Animation feels weighted (dips on contact)
- [ ] Secondary motion trails primary motion

---

## Sources
- [How to animate pixel art — walk cycles, idles, attacks | Sprite-AI](https://www.sprite-ai.art/guides/how-to-animate-pixel-art)
- [Sprite Animation Fundamentals | Pixel-Editor.com](https://www.pixel-editor.com/articles/sprite-animation-fundamentals)
- [Pixel Art Shading & Lighting | Pixnote](https://pixnote.net/en/learn/shading/)
- [Mastering Hue Shifting in Pixel Art](https://www.toolify.ai/ai-news/mastering-hue-shifting-in-pixel-art-109736)
- [The Best 15 Medieval Color Palette Combinations - Piktochart](https://piktochart.com/blog/medieval-color-palette/)
- [Palette List](https://lospec.com/palette-list/tag/medieval)
- [The Pixel Art Color Palette Guide](https://dev.to/krila_software/the-pixel-art-color-palette-guide-how-to-choose-colors-that-work-1bg7)
