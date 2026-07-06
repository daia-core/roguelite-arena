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

## Mechanic / regression gates

Assertion harnesses (not just screenshots) that exit non-zero on failure. They enter a
run via the stable `window.__game.startNewGame()` hook (NOT `#startBtn`, which now opens
the class-select screen and leaves `player` null).

- `verify-mechanics.mjs` — 6 checks over the stat/item system, incl. **Test 6: buying a
  duplicate item upgrades it** (upgradeLevel, multiplicative + additive scaling — Felix's
  explicit "amulet +7" requirement). All 6 PASS.
- `shot-synergy.mjs` — shop rolls never surface removed/homing cards. PASS.
- `verify-live.mjs` — screenshots the LIVE deploy's menu + portrait shop and checks the
  first card's hitbox center maps onto the visible card. Runs clean. NOTE: the end-to-end
  touch-PURCHASE is informational only — synthetic headless touch doesn't drive the
  deployed build's rAF input loop, so `bought.goldDropped:false` is NOT a live bug.

### Known issues

- `verify-pennib.mjs` — 6/8 pass, but the **Pen Nib loaded-shot** checks FAIL: the fat
  golden high-pierce projectile is never observed firing (loaded dmg ratio null). Either
  the loaded-shot mechanic regressed or the projectile-observation window is stale — needs
  investigation before treating Pen Nib as verified.
- `shoot-shop.mjs` — defaults `executablePath` to a macOS Chrome path; set `CHROME_BIN`
  when running in-container (it honours the env override).
