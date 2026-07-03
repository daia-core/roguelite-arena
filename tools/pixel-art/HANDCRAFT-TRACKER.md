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
**Batch-4** (`handcraft/batch4.mjs`) — the SPECTRAL FAMILY (Felix: "hand craft each"). The
auto-enhancer left these four as near-identical pale/purple blobs; worst was the phantom, which
read as a purple CAT (ear-bumps). Redrawn as four DISTINCT silhouettes so they never blur on grass:
- **ghost** — dopey rounded pale-cyan sheet, big dark eyes + "o" mouth, 3-lobe wavy hem, blink+bob
  idle. Kept deliberately soft to contrast the three menacing spirits.
- **phantom** — sleek forward-LEANING violet shade (the fast, speed-140 invisible one) with a
  tapering speed-smear tail + hollow glowing slit eyes. No more cat ears.
- **wraith** — pointed hood over a hollow void with TWO burning cyan eyes (void bridge between them
  so they never merge into a visor) + skeletal claw nubs; eyes flare on frame 2.
- **banshee** — long flowing hair framing a wide-open screaming mouth (the AoE-scream tell) with
  two cold sound-ripple arcs flanking the head that push outward + brighten on the scream frame.
Verified on a grass contact sheet before shipping (four clearly-different creatures).
**Batch-5** (`handcraft/batch5-bosses.mjs`) — ALL 5 BOSSES (24×24, own tier). Were still on the
auto-enhancer and missed the boss bar (regalia / a silhouette distinct from every regular enemy).
Redrawn from scratch, grass-verified as five clearly-different boss silhouettes:
- **boss_necrolord** — bone LICH KING: gold spiked crown + red gem, skull face with glowing green
  soul-eyes, broad navy robe with a green ribcage-clasp, gold soul-staff (green orb) at his side.
- **boss_flamefiend** — hulking FIRE DEMON: two bold up-curving horns (asymmetric, right bigger),
  flame mane, snarling fanged face, molten cracks glowing amber across a red hulk, blazing fists.
- **boss_voidbeast** — floating ELDRITCH EYE-HORROR: one huge magenta central eye + lesser eyes,
  a jagged void-maw, writhing purple tentacles, cosmic sparkle accents (blink/pulse idle).
- **boss_stormking** — armored STORM SOVEREIGN: gold spiked crown, glowing eyes, plated blue armor
  with a lightning emblem, a cape at one shoulder, a bright thunder-bolt scepter raised at his side.
- **boss_ancientgolem** — colossal rune STONE TITAN: blocky shoulders + heavy fists, cracked body
  with a glowing amber core + rune eyes, moss-green accents for "ancient" (core-breathe idle).
Idle frames are a living-glow pulse (recolor of glow indices, + small bob on voidbeast), not a redraw.

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
- demon, wizard, necromancer, healer, shielder, summoner, mimic, troll, orc
  (ghost/phantom/banshee/wraith now hand-crafted → batch-4 above)

**Bosses (24×24) — ✅ ALL DONE (batch-5 above).** Nothing left in this tier.

**Roster status:** every enemy that read poorly is now hand-crafted. What remains auto-enhanced
(bat, spider, evader, exploder, mushroom, orbiter, spiraler, necroegg, imp, demon, wizard,
necromancer, healer, shielder, summoner, mimic) all reads decently — redraw only on a clear win,
never for its own sake.

## Method reminder

Read `SPRITE-STYLE.md` first. Draw in a `handcraft/batchN.mjs`, render with `pixelpng.mjs`, Read
the PNG and critique as a designer (silhouette, face/eyes, light direction, grass camo), iterate,
then `contact-sheet.mjs` on grass for the final look BEFORE converting to JSON and rebuilding.
Ship only where clearly better than the auto-enhanced version.
