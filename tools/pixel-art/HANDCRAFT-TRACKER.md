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

## Still auto-enhanced — future batches, worst-first

Assessed on grass contact sheets 2026-07-03. Rough priority (ugliest / least-readable first);
re-audit before each batch since "worst" is subjective and the roster shifts.

**Next up (candidates worth a redraw):**
- bat, spider — passable but flat/small silhouettes; would benefit from a bespoke pass
- swarm, exploder, evader, orbiter, spiraler — abstract shapes, check readability
- mushroom, necroegg — simple, low priority

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
