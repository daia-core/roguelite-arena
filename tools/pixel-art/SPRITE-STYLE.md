# Roguelite Arena — Sprite Style Guide & Workflow

You are designing enemy sprites for a browser roguelite whose art target is
**Stardew Valley warmth + Brotato chunkiness**. The owner's exact feedback on the
current art: "the pixel art looks like shit", "monsters don't look well crafted".
Your job is to make each sprite look genuinely hand-crafted.

## Where sprites live in-game
- Drawn on warm green grass (#6ab63e family) at native size, viewer sees them ~60-90px tall.
- Every sprite sits in a `number[][]` grid; each int indexes a palette array
  (index 0 = transparent). Cell = 8×8 canvas px ("art pixel").
- Current (bad) versions: read `/workspace/work/roguelite-game/frontend/src/sprites.ts`.
- Enemy identity (color, radius, behavior) lives in `ENEMY_TYPES` in
  `/workspace/work/roguelite-game/frontend/src/Enemy.ts` (lines 25-460).

## Hard rules
1. **Black `#000000` outline** around the full exterior silhouette. Interior
   black lines only to separate major forms (head vs body). No outline gaps.
2. **Light from top-left.** Highlights top/left of forms, shadows bottom/right.
3. **Hue-shifted ramps**: 3-4 tones per material. Shadows shift COOLER (toward
   blue/purple) not just darker; highlights shift WARMER (toward yellow) not just
   lighter. Never produce a ramp by only changing lightness.
4. **No pillow shading** (concentric rings of tone around the center).
5. **Asymmetry = personality.** Tilt the head, raise one shoulder, offset an eye,
   tatter one wing. Mirror-symmetric sprites look dead.
6. **Readable silhouette**: if filled with solid black, the creature must still be
   identifiable. Big shape statements (horns, hunches, weapons, hats) beat detail.
7. **Faces sell the sprite.** Eyes must be clearly visible with whites or glow
   (2px+), not lost in shadow. Expression: menacing, dopey, angry — pick one.
8. **Fill the grid.** Body should span ~80-90% of grid width. Chunky > slender.
9. Saturated but not neon; it must sit comfortably on warm green grass. Avoid
   mid-green bodies (grass camouflage) unless the design demands it (slime is taken).
10. 1-2 accent pixels of a complementary color (an earring, a gem, a buckle) make
    a sprite feel finished. Don't overdo it.

## Grid sizes
- Standard enemy: 16×16 (scale 8 → 128px)
- Brute (troll/golem/cyclops class): 18×18 or 20×20, scale stays 8
- Boss: 24×24 (scale 8 → 192px). Bosses must read as BOSSES: crowns, capes,
  weapons, glow accents. Distinct silhouette from every regular enemy.

## Workflow (mandatory visual iteration)
1. Write your working file `<batch>.mjs` in your own subfolder of the scratchpad:
   `export const sprites = [{ name, scale: 8, palette: [...], frames: [grid] }]`
   (2-frame `frames: [g1, g2]` idle animation encouraged for organic creatures —
   subtle squash/breathe, NOT a redraw).
2. Render: `node /workspace/work/roguelite-game/tools/pixel-art/pixelpng.mjs <your.mjs> <outdir>`
3. **Read the PNG with the Read tool and LOOK at it.** Critique against the rules
   above, then fix. You MUST do at least 2 render→look→fix cycles per sprite, and
   iterate until you'd defend the sprite next to Stardew Valley art.
4. Final deliverable per sprite: one JSON file in the shared out dir
   (`/workspace/work/roguelite-game/tools/pixel-art/sprites/<name>.json`):
   `{ "name": "...", "scale": 8, "frameRate": 6, "palette": ["transparent", "#000000", ...], "frames": [[[...]]] }`
   JSON must be valid (no comments, no trailing commas). Index 0 of palette must
   be "transparent"; index 1 should be "#000000" outline.
5. Converting an AI-generated or found image instead of hand-authoring? Use the
   `pixel-art` skill's conform scripts (`/home/node/.claude/skills/pixel-art/scripts/`).

## Common failures to avoid (seen in this codebase)
- Eyes buried in shadow tones → invisible at game size
- Ramps that are only lightness changes → muddy
- Perfectly symmetric bodies → lifeless
- Tiny floating limbs 1px wide → noise
- Detail smaller than 2 art px → shimmer at game size
