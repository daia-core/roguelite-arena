# Enemy sprite hand-craft tracker

Which enemies are **hand-drawn from scratch** (per `SPRITE-STYLE.md`, render→look→fix ≥2 cycles,
eyeballed on grass) vs. still on the **auto-enhancer** pass (`enhance-sprite.mjs` — a batch filter
over the original flat art, decent but not bespoke).

Goal: every enemy hand-crafted eventually, **worst-reading first**. Most of the remaining roster
already reads decently after the auto-enhance pass, so this is polish, not triage — pick the ugliest
holdout each night, don't pad with low-value redraws of already-good sprites.

Pipeline: source in `handcraft/batchN.mjs` → JSON in `sprites/<name>.json` → `build-sprite-data.mjs`
→ `spriteData.ts` (overrides legacy `sprites.ts` via `loadDataSprites()`).

## Hand-crafted (done)

**Individual (early):** player, skeleton, orc
**Batch-1** (`handcraft/batch1.mjs`, commit 62feae7) — 8 worst-reading greys/abstracts:
gargoyle, golem, construct, dasher, phaser, spinner, druid, cyclops
**Batch-2** (`handcraft/batch2.mjs`, commit 5a3eb5e) — most-seen + worst red:
slime, goblin, blob
**Batch-3** (`handcraft/batch3.mjs`) — the two genuinely-broken cases (not just "flat"):
- **bombardier** — was the single worst enemy in the game: `spriteName: ''` with NO custom
  draw, so it rendered as the raw fallback flat red DISC. Spawns wave 7+ (often in pairs late) —
  exactly Felix's play-test wave. Now a stout iron-helmed artillery brute cradling a lit black
  bomb (fuse spark = the readable "throws explosives" identity), red plate + steel rivet accent,
  amber eyes under the helm rim. Also wired `Enemy.ts` bombardier `spriteName: ''` → `'bombardier'`.
- **swarm** — the auto-enhancer left it reading as disconnected fragments (floating bee parts +
  a stray beak), not one creature. Redrawn as a tight buzzing CLUSTER: bumpy orange/black ball,
  multiple red eyes (the "many creatures" tell), pale wing-haze motion flecks, 2-frame buzz jitter.

## Still auto-enhanced — future batches, worst-first

Re-audited on grass contact sheets 2026-07-03 (evening, after batch-3). The genuinely-broken
cases are now fixed; what remains all reads decently — this is now polish, so pick only clear wins.

**Reassessed as already-decent (do NOT redraw for its own sake):**
- bat (purple, red eyes — good), spider (black + red abdomen, green eyes — good), evader
  (blue cat — fine), exploder (round bomb-creature — fine, distinct from bombardier), mushroom,
  orbiter (eye-diamond), spiraler (snail) — all read clearly on grass.
- necroegg — simple, low priority

**Already decent (leave unless a clear win):**
- imp — genuinely good after auto-enhance; do NOT redraw for its own sake
- demon, ghost, phantom, banshee, wraith, wizard, necromancer, healer, shielder, summoner,
  mimic, troll, orc

**Bosses (24×24, own tier — handle as a dedicated batch, not mixed with trash):**
boss_ancientgolem, boss_flamefiend, boss_necrolord, boss_stormking, boss_voidbeast

## Method reminder

Read `SPRITE-STYLE.md` first. Draw in a `handcraft/batchN.mjs`, render with `pixelpng.mjs`, Read
the PNG and critique as a designer (silhouette, face/eyes, light direction, grass camo), iterate,
then `contact-sheet.mjs` on grass for the final look BEFORE converting to JSON and rebuilding.
Ship only where clearly better than the auto-enhanced version.
