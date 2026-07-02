# QA screenshot harness

Headless-Chrome scripts for visually verifying the game (they need `puppeteer-core`
resolvable from the working directory, and Chrome — override the binary with
`CHROME_BIN`). Each takes an optional output dir argument.

- `shoot-roguelite.mjs` — serves `frontend/dist`, plays ~15s of wave 1 with
  keyboard movement, captures menu + gameplay frames + a center crop.
- `shoot-gallery.mjs` — starts `vite dev` and captures `/gallery.html`, the
  dev-only sprite gallery (every registered sprite, labeled; boss reuse flagged).
  Run after any sprite change.
- `shoot-shop.mjs` — uses the `window.__game` dev hook to force the shop open
  with gold, on desktop and portrait-phone viewports.
- `shoot-combat.mjs` — force-spawns pattern-firing enemies + a boss via
  `window.__game` and captures combat.

Workflow for art changes: build → shoot → actually LOOK at the PNGs.
The sprite pipeline itself lives in ../pixel-art/ (style guide, PNG renderer,
spriteData codegen).
