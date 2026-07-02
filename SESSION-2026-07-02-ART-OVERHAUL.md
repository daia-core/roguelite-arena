# Art & UX Overhaul — 2026-07-02 (afternoon, via Claude Code on the host)

Felix asked for the game to be state of the art with beautiful pixel art while
Daia was offline. This session was driven by screenshot-verified iteration:
every change was built, captured headlessly, and actually looked at.

## What changed

**Camera / rendering**
- `zoomFactor` 3.2 → 1.6 (2.0 on small screens). Sprites now display at
  Brotato scale (~80px player) instead of ~40px. This single change was the
  biggest visual fix in the project.
- Fixed latent bug: Quadtrees + pathfinding grid were built from the default
  300×150 canvas (before the first resize) and never rebuilt — A* ran on a
  10×5 grid. Now rebuilt on every resize via a `game-resize` event.
- Removed the smooth radial vignette and the anti-aliased black arc stroked
  around every enemy; hit flash is now a pixel-perfect white silhouette
  (was: a white rectangle); enemy health bars only show once damaged.
- XP/gold pickups were 95% clipped (7×7 grid drawn at scale 8 onto a 12px
  canvas) — now visible.

**Reusable pixel-art core (`frontend/src/pixel/`)** — game-agnostic, liftable
into any future pixel game:
- `hash.ts` — deterministic hash/noise/Bayer dithering
- `sprite.ts` — data-driven sprites (palette + index grids → canvases,
  animations, tint silhouettes, dithered transparency)
- `terrain.ts` — procedural ground painter (tone patches, organic material
  blobs, decoration stamps, dithered edge fade)
- `panel.ts` — 9-slice-style pixel panels/buttons (wood/stone/parchment),
  usable on canvas or as generated CSS backgrounds

**Art**
- Background rewritten on the 8px sprite art grid (was 2px detail on 32px
  tiles = moiré): warm grass tones, tufts, flowers, stones, irregular dirt
  patches, dithered edge fade.
- All 38 enemy sprites redesigned (was: 3 good, 26 amateur, 5 missing,
  5 bosses = demon clones). Every sprite went through ≥2 render→look→fix
  cycles against `tools/pixel-art/SPRITE-STYLE.md`. Bosses are unique 24×24s.
  Sprite data is generated into `src/spriteData.ts` by
  `tools/pixel-art/build-sprite-data.mjs`.

**UI**
- Pixel font (Press Start 2P) everywhere; menu buttons are generated wood
  panels (the glossy green CSS gradients are gone); HUD rebuilt as wood
  panels with the existing pixel icons, zoom-aware sizing; boss health bar
  with name at bottom center; menu/game-over screens restyled.
- Shop: cards are wood panels with crisp rarity borders, all sizes derive
  from one zoom-aware `getShopLayout()` shared by draw + click code.
  **This fixed a real bug: click hitboxes were up to 135px off from the
  visible cards on portrait** (updateShop and drawShop had drifted apart).
- Fixed layer-order bug: `drawText` wrote to the main canvas, which
  composites UNDER the game layer — HUD panels were covering their own text.

**Gameplay (Felix's outstanding request)**
- Enemy fire patterns: `ring` (rotating 8-shot rings), `spiral` (twin sweeping
  arms), `homing` (steered toward player, capped turn rate), `burst` (aimed
  fan). Wired: wizard=homing (was a comment claiming this existed), construct=
  ring, spiraler=spiral, demon=burst, plus a NEW `spinner` turret enemy with
  its own sprite, added to mid-wave spawn pools.
- Player weapon archetypes (auto-aim/shotgun/orbital/laser/melee) already
  existed in `Player.tryShoot` — contrary to PROJECTILE-ENEMIES-AND-WEAPONS-
  PLAN.md which claimed they were missing.

**Tooling (`tools/`)**
- `tools/pixel-art/` — style guide, dependency-free PNG sprite renderer
  (agents/humans can render a grid and look at it), spriteData codegen.
- `tools/qa/` — headless-Chrome screenshot harness (gameplay, sprite gallery,
  shop on two viewports, forced boss combat). Uses the new `window.__game`
  dev hook. `frontend/gallery.html` is a dev-only sprite gallery page.
- Deleted dead modules: sprites.ts.backup, counter.ts, RenderCache.ts,
  SpatialGrid.ts, BackgroundDecorations.ts.

## Known follow-ups
- Pause + upgrades screens still use old unscaled sizing (game-over is fine).
- Shop item icons are still emoji; real pixel item icons would finish the look.
- Player + slime sprites are the old "fixed" ones — good enough, but the
  player could get the same treatment as the new roster.
- NOT deployed: no Vercel access from the host session. Commit is local
  (+ push if the embedded-token remote accepts it). SECURITY: the git remote
  URL embeds a GitHub token — rotate it and switch to a credential helper.
