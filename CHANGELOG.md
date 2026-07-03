# Roguelite Arena — Changelog

Newest first. One block per production deploy: player-visible changes first, the commit sha,
and the live-build verification (Felix plays on his phone — every entry is verified at a mobile
portrait viewport).

Live: https://roguelite-game-blush.vercel.app

---

## 2026-07-03 (evening) — batch-3 enemy sprites: bombardier (was a bare disc) + swarm hand-crafted

- **Bombardier now looks like an enemy, not a red dot.** It was the single worst-reading thing in
  the game: its `spriteName` was empty AND it had no custom draw method, so it fell through to the
  raw fallback — a flat red circle with a black outline. It spawns from **wave 7 onward (in pairs
  at high waves)**, i.e. exactly the wave Felix was play-testing. Hand-drawn from scratch as a
  stout **iron-helmed artillery brute cradling a lit black bomb** — the orange fuse spark is the
  readable "this thing lobs explosives" tell. Red armor plate with a steel rivet accent, amber
  eyes glowing under the helm rim, distinct silhouette from the olive goblin and the round exploder.
  Wired `Enemy.ts` bombardier `spriteName: '' → 'bombardier'`.
- **Swarm no longer reads as broken fragments.** The auto-enhancer had left it as disconnected
  floating bee-parts plus a stray beak — it looked like a rendering bug, not a creature. Redrawn as
  a tight **buzzing cluster**: a bumpy orange/black ball, multiple angry red eyes (the "many small
  things" tell), pale wing-haze motion flecks around the rim, and a 2-frame buzz-jitter so the mass
  vibrates in place. Fits its in-game role (fast, small, shared HP pool).
- Both drawn per `SPRITE-STYLE.md` (black outline, top-left light, hue-shifted warm-hi/cool-shadow
  ramps, asymmetry, catch-lit eyes, readable chunky silhouette) over 2 render→look→fix cycles and
  eyeballed on the real grass background before shipping. This closes the last enemy on the fallback
  disc; the rest of the roster was re-audited on grass and reads decently (tracker updated — no
  padding redraws).
- QA: `qa-new-enemies` PASS (lifecycle invariant holds over 120 frames), `qa-sprite-conversion`
  PASS (0 console errors), `tsc` clean, `vite build` clean. spriteData rebuilt 41 → **42 sprites**
  (bombardier added; both new sprites confirmed present, overriding legacy).
- **Live:** commit `48ff16c`, bundle `index-D9i-9N3k.js` verified serving on production
  (roguelite-game-blush.vercel.app, HTTP 200, no auth wall) via CLI deploy.

---

## 2026-07-03 (evening) — cap health regen + armor (close the late-game immortality)

- **Armor no longer trends to immortal.** Armor mitigation (`20/(20+armor)`) was unbounded and no
  enemy has armor-pen, so a heavy stack (armor 200 = 91%, 380 = 95%) let you shrug off scaled hits
  indefinitely. Floored the damage multiplier at **0.10 → armor caps at 90% mitigation**. Every
  point still matters up to the cap; the degenerate tail is gone.
- **Health regen no longer out-heals the game.** Regen ticked every frame with no ceiling, so a
  stacked build passively out-healed most enemy DPS. Capped at **5% of max HP per second** — still
  impactful, never enough to tank a scaled wave by standing still. The cap scales with max HP so it
  stays relevant deep into a run.
- Together these close the last two counter-pressure-less defensive runaways (the same class of bug
  as the gold/luck economy caps). Combat *offense* stays uncapped by design — enemies scale to meet
  it — but defense now has a real ceiling.
- QA: `verify-mechanics` 5/5, `verify-luck` 3/3, balance sim non-regressive (early death curve
  unchanged — the caps only bite a late heavy defensive stack, which is the point), tsc clean.

---

## 2026-07-03 (evening) — batch-2 enemy sprites hand-crafted (the two most-seen enemies + toxic blob)

- **Slime and goblin — the two enemies you meet every single run (waves 1-2) — are hand-drawn from
  scratch.** These were the last two enemies still on the original flat legacy sprite path, never
  migrated to the data pipeline; every other enemy already had at least an auto-enhanced pass. Now:
  - **Slime** — gooey translucent green dome, glossy top-left shine, cool-sunk base, two catch-lit
    eyes (left slightly bigger for personality), a little grin, one edge drip. Saturated + dark-
    outlined + hot shine so it never camouflages into the grass.
  - **Goblin** — hunched olive humanoid (distinct yellow-green skin, NOT the slime's pure green),
    oversized pointed ears (one bigger), hooked nose, angry glowing amber eyes, jagged fang grin,
    crude brown loincloth + legs. Frame 2 snarls (grin closes to a fanged line).
- **Blob re-drawn** — the worst-reading remaining enemy (it read as a plain tomato). Now an angry
  TOXIC red cousin of the slime: lopsided amorphous body, glowing acid-green eyes with black brows +
  a scowl, sickly acid bubbles inside and at the edges, cool-crimson underside. Clearly a menacing
  variant, not a vegetable.
- Each drawn per SPRITE-STYLE.md (black outline, top-left light, hue-shifted warm-hi/cool-shadow
  ramp, asymmetry, readable chunky silhouette, catch-lit eyes) over 2+ render→look→fix cycles and
  eyeballed on the actual grass background before shipping. 2-frame idle (slime breathes, blob
  churns, goblin snarls). Remaining enemies (imp/bat/spider etc.) already read decently — left as-is
  rather than padding with low-value redraws.
- QA: `qa-new-enemies` PASS (lifecycle invariant holds — no dead-in-array over 120 frames),
  `qa-sprite-conversion` PASS (0 console errors), `qa-pixel-art` + `qa-roguelite` clean (0 errors).
  spriteData rebuilt to 41 sprites (slime/goblin/blob confirmed present, overriding legacy). `tsc` clean.
- **Live:** verified serving on production (HTTP 200, title correct) — sha below.

---

## 2026-07-03 (evening) — wave-scaling curve v2 (sim-driven softening) + QA harness repair

- **Early game is no longer a wall.** The morning's enemy-scaling bump over-corrected: a fresh run
  had no room to establish before the compound term (which started at wave 4) buried it. Softened
  `WaveManager.waveScale` — linear slope back to **0.15/wave** and the compound onset delayed to
  **wave 7** (where a run has picked up items). Late-game bite stays high: wave 20 enemies are now
  **~33x** (down from the overshot 73x, but well above the old immortality-causing 12x), wave 30
  ~241x. The curve now threads between "wave-7 immortality" and "wave-4 wall".
- **This was tuned with data, not vibes.** Repaired the headless balance simulator
  (`tools/qa/simulate-balance.mjs`), which had bit-rotted when the node-map layer was added between
  start and combat — it stalled at wave 0. It now drives the full map→combat→shop→map loop. Before
  the fix the kite-bot died at wave 3-6 (8/8 runs, avg ~4); after, coherent builds reach wave 10+
  while incoherent ones still die early (correct roguelite shape — bad builds should fail).
- **QA gates un-rotted.** `verify-mechanics` and `verify-luck` were failing on the same node-map
  change (couldn't reach the shop) plus a stale-memoization pitfall (direct `.items` assignment
  didn't invalidate the cached stat aggregate) and an outdated luck-cap assertion (2.0→1.0 from the
  economy rebalance). All fixed; both suites now **ALL PASS**.
- QA: `verify-mechanics` 5/5, `verify-luck` 3/3, balance sim green (no console/page errors), tsc clean.

---

## 2026-07-03 (evening) — audio coverage for unlock moments

- **Dodge, duo-unlock, and transformation now play SFX** — these AudioManager sounds existed but were
  never wired up, so evading a hit, completing a synergy duo, and triggering a tag-mastery
  transformation were all silent milestones. Dodge gets a short airy blip (kept quiet so frequent
  dodges never fatigue the ear); duo-unlock plays the chord stinger; transformation plays the
  fanfare. Pure additive feel — no balance/gameplay change.
- QA: `qa-roguelite` regression green (0 console errors), tsc clean.

---

## 2026-07-03 (evening) — enemy scaling + economy rebalance, batch-1 enemy sprites hand-crafted

- **Enemies scale far harder with depth** (Felix hit 25M damage / 927x crit / every stat maxed by
  wave 7 while enemies were still trivial). `WaveManager.waveScale` linear slope 0.15→0.22/wave and
  the compound term moved from `1.1^(wave-8)` to `1.18^(wave-4)`, so depth bites much sooner:
  wave 7 enemies are now **~3.8x** (was ~1.9x), wave 10 ~8x, wave 15 ~25x, wave 20 ~73x. HP *and*
  damage both scale, so deep waves stay threatening via enemy damage + density + tanky elites even
  against a broken build (trash still shreds — genre norm). Combat stats stay uncapped by design;
  the enemy curve is what honours that contract.
- **Prices ramp harder so late buys are a real choice** — `getItemPrice` base slope +15%→+25%/wave
  and compound from `1.12^(wave-6)` to `1.18^(wave-3)`: wave 7 shop items now ~5.3x cost (was ~2.7x),
  scaling into hundreds/thousands deep. A full buy-out is no longer free once gold snowballs.
- **Discount / income caps tightened so nothing maxes by wave 7:** shop-discount cap 50%→30%,
  reroll-discount cap 90%→60% (near-free rerolls let you fish out every maxing item), gold-multiplier
  cap ×10→×4, luck cap +200%→+100% (legendaries no longer flood the shop early).
- **Two cheapest discount offenders weakened:** Spyglass 50%→25% reroll discount (cost 28→40);
  Merchant's Ring 20%→10% shop discount.
- **Batch-1 enemy sprites hand-crafted from scratch** (the 8 worst-reading greys/abstracts):
  gargoyle (spread wings + pointed ears), golem (heavy shoulders/arms), construct, dasher, phaser,
  spinner (brass shell + radial spikes), druid, cyclops — each drawn per SPRITE-STYLE.md (black
  outline, top-left light, hue-shifted ramp, readable silhouette) over 2 render→look→fix cycles,
  compared vs the old auto-enhanced versions, shipped only where clearly better.
- QA: `qa-roguelite` (0 errors), `qa-stat-caps` (12/12 PASS — new gold=4 cap picked up),
  `qa-sprite-conversion`/`qa-pixel-art`/`qa-new-enemies` all PASS, lifecycle invariant holds (no
  dead-in-array over 120 frames). `tsc` clean.
- **Live:** `index-BeJvcJwf.js` verified serving on production (HTTP 200, title correct).

---

## 2026-07-03 (evening) — every artifact hand-crafted (dedicated glyphs, not reused item art)

- **All 20 artifacts now have their own dedicated, hand-crafted 12×12 sprite** instead of borrowing an
  existing item glyph. Following Felix's "go through and hand craft each", each artifact was drawn from
  scratch with its own palette (black outline, top-left light, hue-shifted ramp, catch-light) so the
  reward-pick card reads at a glance: Titan's Heart = armored heart, Momentum Engine = cyan gear,
  Berserk Core = glowing core, Assassin's Guile = hooded red-eyed mask, Warlord's Banner = pennant,
  Crown of Slaughter = gem crown, Stormcaller = cloud+bolt, Sniper's Focus = scope, etc.
  - New render path: artifacts now resolve via `getArtifactIcon(id)` → `art_<id>` glyph (not the emoji
    `getItemIcon` map), drawn through `Renderer.drawArtifactIcon`. Reward-pick + event-granted cards
    both use it. This decouples artifact art from item art so each can evolve independently.
- **Two weak item glyphs redrawn** while in the file: `fist` (was a featureless red blob reused across
  7 melee items) → a boxing-glove fist with knuckle highlights + cuff; `gun` (ambiguous L-pipe) → a
  clear side-view pistol with slide + grip.
- QA: `qa-artifact-icons.mjs` now drives the real `getArtifactIcon` path and asserts each paints >8px
  across ≥3 colours (a real authored glyph, not a flat fallback) — **20/20 pass, 0 console errors**;
  sheet eyeballed at `shots/pixel-art/artifact-icons.png`. Item icons 112/112 still pass. Menu
  eyeballed at 390×844.
- **Live:** `index-pd5ruj3D.js` verified serving on production (HTTP 200, title correct).

---

## 2026-07-03 (evening) — pixel-art icons for every artifact (last emoji holdouts)

- **All 20 run-long artifacts now have a distinct pixel-art icon** on the reward-pick card and the
  event-granted card. Until now artifacts carried an empty `icon` and rendered as text-only cards
  (name + rarity + description, no visual) — the last game objects with no sprite.
  - Each artifact maps to a thematic authored glyph in the same pipeline as items/monsters
    (`getItemIcon` → 12×12 pixel grid). 18 reuse existing shipped glyphs (skull for Executioner,
    crossed swords for Duelist, crown for Crown of Slaughter, target for Sniper, bolt for
    Stormcaller, rocket for Momentum, etc.); **2 new glyphs were hand-authored** — an open **book**
    (Scholar's Codex) and a pennant **banner** (Warlord's Banner).
  - Both artifact cards (`drawReward`, `drawEventRewardCard`) now draw the icon on the left with the
    text reflowed beside it; the event-granted card gained an `icon` field so item *and* artifact
    grants both show their sprite.
- **Item-sprite coverage reviewed and confirmed 100%:** every one of the 136 distinct icons across
  items, duos, upgrades and artifacts now resolves to one of 80 authored pixel glyphs — **0 fall
  back to a generic procedural rune** (checked programmatically). This completes Felix's "pixel art
  sprites for every item and every artifact, no emojis" pass.
- QA: new `qa-artifact-icons.mjs` renders all 20 and asserts each paints pixels with ≥2 colours —
  20/20 pass, 0 console errors; sheet eyeballed at `shots/pixel-art/artifact-icons.png`. Build clean.

---

## 2026-07-03 (evening) — all 37 enemy sprites modernized (form-lit hue-shifted shading)

- **Every remaining enemy sprite** got the modern pixel-art treatment in one pass, using a
  generalized silhouette-preserving enhancer (`tools/pixel-art/enhance-sprite.mjs`) rather than 37
  bespoke scripts. This completes the sprite-modernization arc started with player → skeleton → orc.
  - **Technique:** each enemy's interior fill tones are re-lit from the top-left — cells on a lit
    top/left edge get a warm (toward-yellow) hue-shifted highlight; cells on a bottom/right edge get
    a cooler hue-shifted shadow; corners are lifted/dropped harder. This gives every body real volume
    instead of flat fill, while the **black outline and transparent cells are copied verbatim** so
    every silhouette and hitbox is byte-identical to before.
  - **Glows and eyes preserved:** saturated-bright cells (catch-lights, glowing eyes, gems, magic
    orbs) are detected and left untouched, so nothing that was meant to glow got dulled.
  - Covers all standard enemies, the 6 special enemies (exploder/healer/phaser/shielder/spinner/
    summoner) and all 5 bosses (ancientgolem/flamefiend/necrolord/stormking/voidbeast).
  - Every enemy proven visibly better (or at minimum not worse) via before/after contact sheets
    (`shots/sprite-compare/`, tiled with `tools/pixel-art/montage.mjs`) — ~30 clear wins, the rest
    subtle-but-improved, **0 regressions**. Verified 37/37 enhanced with player/skeleton untouched
    (`tools/pixel-art/verify-enhanced.mjs`).
- QA: pixel-art (662 distinct colors, up from 611), sprite-conversion round-trip, and
  gameplay/collision regression all green, 0 errors.
- Commit `8b2e1d6` → live build **`index-CcGX2hD_.js`** (verified: HTTP 200, live bundle == shipped
  commit's build, correct title, no auth wall).

---

## 2026-07-03 (evening) — orc sprite modernized (form-lit body + glowing inward eyes)

- **New orc enemy sprite** — third sprite in the modern-technique pass, same silhouette-preserving
  method as the player/skeleton (interior tones remapped cell-by-cell, hitbox unchanged):
  - **Body** was a single flat mid-green with no form; it's now lit from the top-left — a warm
    (toward-yellow) highlight on the head/shoulders and a cooler hue-shifted green shadow down the
    right side and undersides, so the orc reads as a rounded, muscled body instead of a green blob.
  - **Eyes** were two dull red smears under black slabs; they're now a matched **glowing pair** —
    bright red with a hot amber core facing inward toward the face midline, so the two eyes read as
    a menacing, alive stare rather than glancing the same way.
  - **Axe** got a bright steel rim-highlight up its lit edge; the wooden handle/leather gained a warm
    highlight on its lit-left cells (deep-brown shadow kept), so the weapon has form instead of one
    flat brown block. Cream tusks kept their bright value.
  - Proven visibly better via `qa-sprite-compare.mjs` before/after (`shots/sprite-compare/orc.png`),
    iterated once to fix the eye-glow direction (centroid-based inward core).
- QA: pixel-art, sprite-conversion round-trip, and gameplay/collision regression all green, 0 errors.
- Commit `6b9cba0` → live build **`index-BBnDOY-2.js`** (verified: HTTP 200, live bundle == shipped
  commit's build, no auth wall).

---

## 2026-07-03 (evening) — stat numbers abbreviate cleanly (no scientific notation, no raw floats)

- **Fixed the ugly stat readouts Felix screenshotted** — deep-run values like `6.82e+278` and
  `2979.5297380553598` no longer leak into the UI. Every numeric stat now runs through the existing
  `formatShort` helper (K/M/B/T abbreviation), so a maxed build reads `DMG 1000T`, `HP 100/10K`,
  `+143Kx crit`, `264/s` — never scientific notation, never a raw multi-decimal float.
- Two surfaces fixed in `Game.ts`:
  - **Full-stats popup** (`drawStatsPopup`) — OFFENSE / DEFENSE / UTILITY / SPECIAL rows now use
    `num`/`pct`/`mult`/`rate` helpers. Max Health (the `2979.5297` bug), Damage, multipliers,
    regen/fire-rate all abbreviate.
  - **Shop stats summary panel** — the exact panel from the screenshot; `HP`, `DMG`, `FIRE`, `SPD`,
    `CRIT`, `MULTI` were rendering raw (`HP 100/10769.60000000001`, 16-digit `DMG`) and now abbreviate.
- QA: extended `qa-stats-popup.mjs` to stack 80 synthetic stress items, force-recompute the memoized
  aggregation, hook `drawText` to capture every rendered string, and **fail** on any scientific-notation
  or raw-float glyph. Green at mobile-390 + desktop-1280; `qa-numberformat` and `qa-stat-caps` also green.
- Live build **`index-DU_mKMQ4.js`** (verified: HTTP 200, live bundle == shipped build, no auth wall).

---

## 2026-07-03 (evening) — skeleton sprite modernized (form-lit bone + glowing eyes)

- **New skeleton enemy sprite** — second sprite in the modern-technique pass, same silhouette-preserving
  method as the player (interior tones remapped, hitbox unchanged):
  - **Skull** was a flat beige box; it's now lit from the top-left — warm highlight on the upper-left of
    the skull, cooler hue-shifted shadow down the right side and under the jaw, so it reads as rounded bone.
  - **Eyes** were two flat green slabs; they're now matched **glowing sockets** — a green rim with a hot
    near-white core glowing toward the skull's midline, so the skeleton reads as alive/undead rather than
    wearing green stickers.
  - **Sword** got a bright steel rim-highlight on its lit edge; the loincloth gained a subtle warm highlight.
  - Proven visibly better via `qa-sprite-compare.mjs` before/after (`shots/sprite-compare/skeleton.png`),
    iterated once to fix eye symmetry.
- QA: pixel-art, sprite-conversion round-trip, and gameplay/collision regression all green, 0 errors.
- Commit `49ecfb9` → live build **`index-BbVrxpq4.js`** (verified: HTTP 200, correct title, no auth wall,
  live hash == shipped commit's build).

---

## 2026-07-03 (evening) — player sprite modernized + sprite source pipeline restored

- **New player hero sprite.** The player was redrawn with modern pixel-art technique while keeping
  the exact same silhouette (so it drops in with no gameplay/hitbox change):
  - **Eyes** now have a bright catch-light — the hero reads as alive and looking forward instead of
    two dead dark blocks.
  - **Face** lost its crude "left-half-light / right-half-dark" vertical seam; it's now lit from the
    top-left with a warm brow/cheek highlight and a hue-shifted shadow down the right edge and under
    the chin, so the head reads as a rounded form.
  - **Hair** gained a top-left highlight and a right-side shadow (volume, not a flat brown slab).
  - **Torso** — two stray brown "dirt" pixels removed; the hard light/dark shirt seam became a
    smooth 4-step blue ramp with a rim-highlight on the lit shoulder.
  - **Legs** got a subtle highlight down the lit side.
  Every change was proven visibly better than the old sprite via a new 8×-zoom before/after
  comparison harness (`qa-sprite-compare.mjs`), iterated across three passes until it was a clear win.

- **Under the hood:** the per-sprite JSON sources that `build-sprite-data.mjs` consumes had been
  lost, leaving the generated `spriteData.ts` as the only source of truth (a dead-end for further
  art work). All 39 sprites were extracted back to `tools/pixel-art/sprites/*.json` and round-trip
  verified (rebuild reproduces `spriteData.ts` byte-for-byte), so future sprite passes go through
  the documented, safe workflow.

Commit `3a7fec7`. **This deploy also finally made the previous "status effects" batch actually
live** — that entry claimed `index-B7X9IJQL.js` but B7X9IJQL was the *stale* pre-status build that
was still serving in production; the status-effect commit had never deployed. Verified live at
390×844: bundle **`index-BBZIxvq_.js`** now serving (HTTP 200, `<title>Roguelite Arena</title>`, no
auth wall). QA before deploy: `qa-pixel-art`, `qa-item-icons`, `qa-status-visuals`, `qa-roguelite`
gameplay, and `qa-stats-parity` all pass with 0 console/page errors. Before/after: `shots/sprite-compare/player.png`.

---

## 2026-07-03 (evening) — status effects are now visible on enemies (pixel-art overlays)

- **Every DoT/status now shows on the enemy that has it.** The Phase 3b status engines
  (Ignite/Bleed/Poison/Doom/Wound/Freeze) dealt real damage but fired *invisibly* — you couldn't
  tell a burning enemy from a healthy one, so status builds had no feedback. Enemies now wear a
  chunky pixel-art overlay for each status they carry:
  - **Frozen** — an icy blue tint disc + white ice shards (the enemy is also visibly halted).
  - **Burn (Ignite)** — orange/red flame pixels flickering and rising off the body.
  - **Poison** — green bubbles drifting upward; they turn lime when the poison can *spread* on death.
  - **Bleed** — dark-red droplets dripping below the enemy.
  - **Wound** — a small red "X" mark (this enemy takes amplified damage-over-time).
  - **Doom** — a purple rune blinking above the head that blinks faster and reddens as its
    stored-damage execute nears detonation.
  Stacked statuses layer, so a fully-afflicted enemy reads at a glance. Purely a rendering pass —
  damage numbers, timers and detonation logic are unchanged.

Commit `f312fc4`. Verified live at 390×844: bundle `index-B7X9IJQL.js` serving (HTTP 200, no auth
wall). `qa-status-visuals.mjs` builds the shipped dist fresh, enters a live wave, lights all six
statuses on real enemies and asserts each overlay paints (frozen ~1.7k px, burn ~1.4k, poison ~5.5k,
bleed ~600, plus an exact-location isolation pass for doom's tiny blinking rune ~90–160 px summed),
with **0 console/page errors**. Screenshots: `shots/status-effects.png` (multi-status cluster),
`shots/status-doom.png` (isolated doom rune).

---

## 2026-07-03 (evening) — AoE danger zones are now pixel art (no smooth circles)

- **Telegraphed AoE zones render as chunky pixels.** The red "danger" markers that bosses,
  mini-bosses and ranged enemies paint on the ground before an attack were the last in-world VFX
  still drawn as smooth anti-aliased circles/rings with gradient fills and a dashed border. They now
  rasterize into `PX=6` pixel-aligned scanlines with image smoothing off — the same chunky look as
  the nova/shockwave rings and every sprite — so nothing in the arena is "drawn directly" anymore.
  The growing telegraph fill, the pulse, the ring shape and the white detonation flash are all
  preserved; damage timing is unchanged.

Commit `99f5914`. Verified live at 390×844: bundle `index-wRamu91r.js` serving; `qa-aoe-pixel.mjs`
spawns a circle + a ring zone in-arena, 0 console errors, 60k+ danger pixels painted, screenshots
confirm chunky stair-stepped edges (not smooth), and the player takes zone damage on detonation.
(Known remaining vector element: the between-battle node-map board circles are still smooth by
design — a deliberate Slay-the-Spire-style UI, left for Felix's call, not an in-arena entity.)

---

## 2026-07-03 (evening) — every item is a hand-drawn pixel sprite (zero emoji) + stat caps

Two changes shipped together:

- **Pixel-art item icons — no more emoji, anywhere.** Every item now shows a hand-authored 12x12
  pixel-art glyph (the same treatment the monsters got), not an OS emoji. A new sprite library
  (`items/itemIcons.ts`) holds 76 authored glyphs and maps all **112** catalog icons to one — with
  **zero** procedural-rune fallbacks, so no item ever falls back to rendering a raw emoji glyph.
  Every on-canvas emoji site was swept: inventory, shop cards, duo/synergy panels, village upgrade
  rows, the shop lock/recycle buttons and the meta-upgrade icons all draw crisp sprites now; the
  village building signs, the interact prompt and the game-over stat lines became clean pixel-font
  text. The one remaining non-ASCII glyph is the monochrome soul marker (a text dingbat, never a
  colour emoji).
- **Stat caps.** Combat output (damage, fire rate, crit dmg, multishot, piercing, armor) stays
  UNCAPPED — enemies scale to meet it. Only the stats enemies never counter-scale are capped: gold
  ×10, XP magnet ×10, recycle break-even (+300%), dodge 75%, plus a 1e15 numerical-safety ceiling
  that stops a deep run overflowing to "Infinityx" / NaN. The shop also hides any item whose every
  effect is an already-maxed capped stat, so no shop slot is wasted on a dead pick.

**Commits** `e97bc01` (stat caps), `1e658f8` (pixel-art sprites + emoji removal)
**Live verified** blush domain serves `index-B9kcLwnw.js` (== the fresh build), HTTP 200, new JS
asset 200, no auth wall; `qa-item-icons.mjs` proves **112/112** item icons paint real pixels
(painted-pixel + colour assertions) with **0 console errors**, and the enlarged icon sheet was
reviewed by eye — every glyph is a recognisable pixel sprite.

---

## 2026-07-03 (afternoon) — chunkier XP orbs, gold as collectable coins, shop Auto-Buy & cleaner shop cards

Four changes from Felix's play feedback, all in one deploy:

- **XP orbs are chunkier.** The XP gems were tiny specks; their pickup radius went 4 → 6 and the
  sprite is drawn ~23% bigger, so they read as proper chunky pixel crystals on the ground.
- **Gold now drops as coins you vacuum up.** Kills no longer bank gold instantly. Instead each kill
  scatters up to 4 gold coins that magnet toward you and bank their value on contact — same
  satisfying pop → home → collect loop as the XP gems, so money is now something you sweep up rather
  than a silent number tick.
- **Shop Auto-Buy button.** A one-tap **Auto-Buy** greedily buys every affordable item, rerolls, and
  repeats until you can't afford another item or a reroll — for clearing the shop fast when you don't
  want to click through every card.
- **Cleaner shop cards.** The item cards were cramped on mobile — the icon overlapped the name and the
  synergy tags crowded the top edge. Reworked the internal spacing (smaller mobile icon, name pushed
  clear below it) and moved **Reroll + Auto-Buy onto one side-by-side row** so the cards keep their
  full height. Reads cleanly on phone portrait and desktop.

**Commit** `e65c605`
**Live verified** blush domain serves `index-C-Pwoqkd.js` (== the fresh build), HTTP 200, new JS
asset 200; `qa-xp-coin-shop.mjs` 8/8 PASS on desktop + mobile against the freshly-built bundle
(coins spawn on kill / gold not banked at the kill / coins bank on pickup / XP radius 6 / Auto-Buy
buys + spends + stops when broke), 0 console errors; shop + gameplay screenshots reviewed at both
viewports.

---

## 2026-07-03 (afternoon) — event reward cards, skippable artifacts, more artifacts & a mid-run gear menu

Four player-facing gaps closed, all from Felix's play feedback:

- **Event results now show a real reward card.** After an event that grants something, you used to
  get only a thin green line. Now the result text is followed by a proper card — item/artifact
  **name**, rarity colour + tag, and exactly what it does — matching the reward-screen look, so you
  always see what you got.
- **Artifact rewards are skippable.** The 1-of-3 artifact offer (after elites, treasure, bosses) now
  has a **Skip** button, so you can decline and keep a tight, focused build instead of being forced
  to take one.
- **Roster doubled: 10 → 20 artifacts.** Ten new high-impact pure-stat artifacts (Ironbark Totem,
  Duelist's Edge, Stormcaller, Assassin's Guile, Warlord's Banner, Prodigy's Insight, Windrunner
  Boots, Colossus Plating, Sniper's Focus, and the legendary Crown of Slaughter) — more variety in
  every offer. Kept pure-stat so they all resolve through the existing `applyStatic()` path.
- **Mid-run gear menu (top-right).** A gear button under the wave panel opens a pause overlay with
  **Resume / Sound / End Run / Restart Run / Main Menu**. **End Run** cashes out your souls
  immediately (via the same `gameOver()` path) — so an endless run can be banked on demand instead
  of having to die first. The overlay was rewritten with the shared zoom-scaled geometry, fixing an
  old draw/hit-test mismatch in the pause screen, and it shows the souls you'd bank before you commit.

Also exposed a dev/QA hook (`window.__game`) so headless tooling can drive the real game instance.

QA: new `qa-gear-menu.mjs` drives the live instance on desktop + mobile — gear opens pause, Sound
toggles, End Run banks souls (state→gameover, souls increase), Restart resets to the map, an
artifact event captures + renders its card, Continue clears it, and Skip declines without granting;
zero console errors. Regression: qa-roguelite, qa-shop-inputguard, qa-event-title, qa-node-map,
qa-stacking-weapons, qa-magnet, qa-new-enemies all PASS.

Commit: 5950f65 · Live build: `index-MWocolug.js` (verified live at roguelite-game-blush.vercel.app)

---

## 2026-07-03 (afternoon) — pixel-art: worms, orbs, bombs & XP gems now use real sprites

User report: some things were still drawn as raw circles/arcs instead of pixel art. Converted the
remaining directly-drawn game entities to proper pixel-art sprites (the `SpriteSheet.get()` +
`drawImage()` path everything else already uses):

- **Worm segments** (`wormhead`/`wormbody`) — were arc-drawn discs; now `worm_head` (orange segment
  with eyes + rim) and `worm_body` (darker trailing segment) sprites, with the white hit-flash
  silhouette like every other enemy.
- **Orbiting orb** (stacking weapon) — was an arc ring + core; now an `orbiting_orb` sprite (cyan
  body, white hot cross-core).
- **Bomb** (stacking weapon) — was an arc body; now a `bomb` sprite (round black body, grey
  highlight, brown fuse) with the fuse spark still blinking faster toward detonation.
- **XP gem** — was procedural nested `fillRect`s; now uses the existing `xp` crystal sprite.

Left as intentional shapes (effects/telegraphs, not entities): AoE danger zones, the player
shield ring/dash shadow, miniboss aura glow, the sprite-less enemy fallback disc, and particles.
The egg-sac keeps its animated shell/crack telegraph (a live countdown, not a static entity).

Draw-only change — no collision/lifecycle code touched. QA: new `qa-sprite-conversion.mjs` verifies
all 5 sprites resolve with painted pixels and zero console errors; regressions green
(qa-stacking-weapons, qa-new-enemies, qa-zoom-xporbs, qa-magnet). Sprite sheet screenshot in
`shots/pixel-art/converted-sprites.png`.

Commit: `f165d01` · Live build `index-D3HUcno6.js` verified on blush alias (HTTP 200).

---

## 2026-07-03 (afternoon) — shop: responsive layout (no overlap, any size) + no held-touch insta-buy

Two reported bugs, both fixed and live.

**Overlapping shop buttons (user report) — fixed.** The shop now sizes itself from a single
vertical budget: it reserves a fixed band for the header and for the Continue/Reroll button row,
then fits the item cards into whatever height is left — so a card can never grow into the buttons,
on any screen. Column count is now decided by width, not a device flag: portrait stacks 1-wide,
landscape/desktop uses the 3-wide grid (a 6-tall column can't fit a short landscape screen). On
desktop the grid now sits in the gap *between* the left stats panel and the right inventory panel,
which also killed a pre-existing collision where the leftmost card overlapped the stats panel on
~1024-px-wide windows.

**Held-touch insta-buy — fixed.** Holding the screen to move when a wave ended and the shop opened
under your finger instantly bought whatever card appeared there. Every screen transition now
disarms a held press: a finger that was already down can't register as a click — a fresh touchdown
is required. Applies to all pop-up screens (shop, reward, event, rest, map, game-over), not just
the shop.

**Verified:** `qa-shop-layout.mjs` asserts zero overlaps (cards vs buttons, cards vs cards,
cards vs panels, in-bounds) across 11 screen sizes — phones (portrait/landscape), tablets, and
desktop/narrow/short windows — all PASS, screenshots captured. `qa-shop-inputguard.mjs` confirms a
held press buys nothing on shop entry while a fresh press still purchases. Full regression suite
(melee-stack, stats-parity, stacking-weapons, joystick) green. Commit `e9fa1c6`, live build
`index-DLNbfPQh.js` verified on the blush alias.

---

## 2026-07-03 (afternoon) — architecture: item data split out + per-frame stat aggregation memoized

Felix: *"improve the underlying architecture so it's optimized and will support your continued
development of it well."* No player-visible change — this is a foundation pass so the next content
push (item rework, new mechanics) is faster and safer to build on.

**What changed:**
- **Item data extracted from the code.** The 206-item roster and its type definitions lived inline
  in a single 3630-line `ItemSystem.ts`. Split into a pure-data module: `items/types.ts` (the
  `Item`/`Weapon`/tag types, 163 lines) and `items/catalog.ts` (the 206-item roster, 2780 lines).
  `ItemSystem.ts` is now **867 lines** of behavior (the `ItemDatabase` query layer + `PlayerStats`
  aggregation) that re-exports the types, so every existing import keeps working unchanged.
- **PlayerStats aggregation is now memoized.** Every stat getter (`getDamage`, `getArmor`,
  `getCritChance`, … ~35 of them) previously **re-looped the whole item list on every call, every
  frame**. They now read from a single `ItemAgg` bundle that folds all per-item contributions once
  and is rebuilt **only when items change** (invalidated on `addItem`/`removeItem`). With many items
  and dozens of getters queried per frame, that's a large amount of per-frame work removed from the
  hot path. Transformation/duo/artifact/runtime modifiers and all stat caps still apply at read-time
  (they change independently of the item set), so behavior is identical.

**Why it's safe:** new `qa-stats-parity.mjs` harness adds **every** catalog item incrementally and,
after each change, checks **all** getters against an independent from-scratch recomputation of the
old loop math — plus the removal path and a mixed meta-armor loadout: **237 checks, 0 mismatches, 0
errors.** Full regression suite green (stats-parity, stacking-weapons, melee-stack, status-engines,
damagetype, synergy, node-map, magnet, zoom-xporbs, builddiv — 10/10). Also hardened the QA harnesses
to drive stats through the real `addItem`/`removeItem` API instead of mutating the item array
directly (direct mutation bypassed the new cache — the exact stale-cache trap to avoid; production
code never does it).

**Verified:** commit `062bf45` · live build `index-COlzWkAn.js` (blush alias verified — deployment
`dpl_D5o69…` READY/PROMOTED, sha matches HEAD, HTTP 200, no auth wall).

---

## 2026-07-03 (afternoon) — armor reworked: player takes real damage again

Felix: *"I barely take any damage from enemies and enemy projectiles. Even really early on with
minimal stats."*

**Root cause:** armor was **flat subtraction** (`damage − armor`, floored at 1). The `Starting
Armor` meta upgrade grants up to **+15 armor**, and enemy contact damage is only 6–15 — so with
that meta upgrade nearly every early hit was reduced to the **minimum 1 damage**, regardless of
in-run stats. The persistent meta armor was making the player near-immune early.

**Fix:** armor is now **percentage mitigation** (Brotato-style diminishing returns) instead of
flat subtraction: `taken = raw × 20/(20+armor)`. Each armor point stays meaningful but small hits
are never free — armor 5 = ~20% less, 10 = ~33%, 15 = ~43%, 25 = ~56%.

**Player-visible:** enemies and their projectiles now deal real damage from wave 1 even with
armor invested. Heavy-armor builds are still tanky, just not invincible.

**Verified:** new `qa-armor-damage.mjs` harness — with +15 meta armor and zero run items,
standing in a wave-1 swarm for 10s now costs **59 HP over 13 hits** (~4 dmg/hit after mitigation)
vs. near-zero under the old flat formula. `qa-melee-stack` combat regression PASS, 0 console
errors. Commit `b9b5011` · live build `index-LqjJLBD_.js` (blush alias verified).

---

## 2026-07-03 (afternoon) — melee STACKS like every weapon (Crescent Blade projectile bug fixed)

Felix: *"the crescent blade item seems to break projectiles being fired"* and *"Melee should
stack, like all weapons. So you would still have weak projectiles even if melee build."* Both
fixed — melee is no longer an exclusive weapon *mode*, it's a stacking *layer*.

**Player-visible:**
- **Your gun always fires.** Picking up a melee weapon (Crescent Blade, Thunder Hammer) no longer
  silently kills your projectiles. The ranged weapon fires on every build; melee is extra on top.
- **Everyone gets a default swing.** Every character now auto-swings at the nearest enemy in reach
  (it only swings when something's actually close, so it never flails at empty air). Melee items
  make that swing bigger/faster/harder instead of replacing your gun.
- **Melee items feel distinct.** Crescent Blade → a wider, faster, harder swing. Thunder Hammer →
  a slow, heavy, *full-circle* AOE quake that hits everything around you. So a "melee build" is now
  a real build (invest items in the swing) while still plinking with a weak gun.
- **AOE builds scale.** A new global area multiplier scales the swing-AOE, nova, and bomb radii
  together — groundwork for the bigger item pass.

**Under the hood:** removed the `weaponType==='melee'` either/or branch in the game loop and
`Player.tryMeleeAttack`; the swing runs on its own timer through the shared `meleeAttacks` pipeline
(collision/knockback/kill). New `PlayerStats` getters: `getSwingDamage/Range/Arc/Interval/Aoe/
Knockback` + `getAoeRadiusMult`. New item stats: `swingDamageMult/RangeBonus/ArcBonus/CooldownMult/
Aoe` + `aoeRadiusMult`. Crescent Blade & Thunder Hammer rewritten as swing-shapers.

**Verified:** `tsc` clean; `qa-melee-stack.mjs` PASS on the shipped `frontend/dist` — with **no
items** the swing fires AND the gun fires; **Crescent Blade** keeps `getWeaponType()==='auto-aim'`
and projectiles keep firing (the reported bug); **Thunder Hammer** grants a 360° AOE swing
(`swingAoe 90`, arc == 2π); `aoeRadiusMult` defaults to 1; **0 console/page errors**. Commit
`ef9b773`; **live-verified** — `roguelite-game-blush.vercel.app` serves bundle `index-DoahjPQB.js`
(this build), HTTP 200.

---

## 2026-07-03 (late morning) — remove all screen-shake + time-warp (maximum fluidity)

Felix: *"Remove screen shake or things that alter time. I want the game to feel as fluid as
possible."* Done — the game now runs at a **constant, uninterrupted timestep**: the camera never
shakes and time never slows, stops, or freezes. Impact is conveyed purely by knockback, hit-flashes,
expanding impact rings and particles — feedback that never costs you a frame of motion.

**Player-visible:**
- **No screen-shake.** Both independent shake systems removed (`ScreenEffects` shake + the
  `Renderer` shake) — the view stays rock-steady.
- **No time-warp.** The global hitstop that dropped the sim to **0.05× for 50–80 ms on every hit**
  is gone. That was the single biggest fluidity killer — with a flooded arena you were triggering it
  constantly, so the game stuttered on nearly every frame of combat. Now motion is perfectly smooth.
- **Enemies never freeze.** The per-enemy **100 ms hitstun** that halted an enemy's AI + movement
  every time it was hit is removed — enemies keep flowing toward you, so the swarm reads as one
  continuous tide instead of a stop-motion flicker.
- **No more zoom creep.** Killed a buggy dynamic camera-zoom that never returned to 1.0, so the
  view no longer slowly drifts zoomed-in over a run.

**Kept all the non-time juice:** colored screen flashes, white hit-flash, expanding impact rings,
exponential-decay knockback, physics-arc damage numbers, and the 10+ pooled particle types. Feedback
stays punchy; it just never interrupts motion.

**Under the hood:** removed `timeScale`/`hitPauseTimer` from `Game.ts` (every `scaledDt` → `dt`),
the two shake systems, `Enemy.hitstunTimer` + its early-return, and the dynamic zoom. Net **−283/+40
lines** — a real simplification, not a toggle. Typecheck clean.

**Verified:** `qa-flood.mjs` on the shipped bundle — wave 1 **playing, 45-enemy swarm, 132 HP,
0 console/page errors**; combat regression (kills, damage numbers, particles all fire, lifecycle
invariant holds). Mobile screenshot (390×844, `shots/flood-mobile.png`) reviewed — dense swarm reads
clearly, motion smooth, HUD clean. `qa-mobile-playthrough.mjs` 427 FPS / 0 errors. Commit `55e3099`;
**live-verified** — `roguelite-game-blush.vercel.app` serves bundle `index-14FNgVCe.js` (this
commit's build), HTTP 200.

---

## 2026-07-03 (late morning) — flood the arena (vampire-survivors density) + tankier enemies

Felix: *"I want the stage to be flooded with enemies (like vampire survivor), also give them more
health so they don't die straight away even with broken builds."* Both delivered, HP-only so the
game gets denser and chunkier without getting more punishing.

**Player-visible:**
- **The stage now floods.** Wave 1 spends **45** enemies (was 28); every later wave grows faster
  (`40 + wave*7` + a steeper late-game density curve, was `20 + wave*3`). Formations spawn in far
  bigger clumps (line/cluster/scatter up to 7–10 vs 4–6, ring 9, pincer 10, vee 8) and arrive
  faster (spawn interval capped at 0.55s / floored at 0.16s, was 1.1s / 0.3s). On-screen swarm
  measured at **~45 concurrent** on wave 1 — a real VS-style wall of enemies closing from all sides.
- **Enemies tank hits.** A flat **2.2× HP** multiplier (`FLOOD_HP_MULT`) on top of the existing
  wave scaling, so even a snowballed/broken build no longer one-shots the swarm off the screen —
  wave-1 slime now 132 HP. **Damage is untouched** — enemies survive longer but don't hit harder,
  so density goes up without difficulty spiking unfairly.

**Under the hood:** all three density levers live in `WaveManager.ts` (`baseCount`, formation caps,
`spawnTimer` interval). `FLOOD_HP_MULT` is applied in `makeEnemy` *after* `waveMultiplier`, re-syncing
`maxHealth`/`health` — HP only, not damage/speed. No collision/entity/pool code touched.

**Verified:** `qa-flood.mjs` (new, headless, real `g.update` loop, player damage neutralized so the
swarm accumulates) — wave 1 **peak 45–46 concurrent alive**, min/max enemy HP 40–132 (2.2× applied),
**0 console/page errors**. `qa-roguelite.mjs` PASS. Mobile screenshot (390×844, `shots/flood-mobile.png`)
reviewed: dense swarm reads clearly, sprites distinct (no mush), HUD clean, nothing clipped.
Commit `6f18c45`; **live-verified** — production deploy `roguelite-game-fjog4ga0y` (READY), the
aliased `roguelite-game-blush.vercel.app` serves bundle `index-Dz1ctciu.js` (this commit's build),
HTTP 200, no SSO wall.

---

## 2026-07-03 (morning, hygiene) — commit the abbreviated floating damage numbers already live in index-DrFjavMF.js

No new deploy — this locks the git source to what's *already* serving live. Earlier this morning
the floating damage numbers were switched to `formatShort()` (K/M/B/T abbreviation) so a wave-13+
build reads `515M` / `2.4B` instead of a screen-filling `515000000` — matching the HUD, which
already abbreviates. That change (`Particle.ts`: `formatShort` on both DamageNumber paths + the
`K/M/B/T/.` pixel glyphs the abbreviations render with) rode into the live `index-DrFjavMF.js` bundle
because the 09:38 batch build picked it up from the working tree — but it was **never committed**.

**Why this matters:** a clean build from HEAD would have produced a *different* bundle
(`index-t-c53qeH.js`, verified by a revert-and-rebuild diff) that silently **regresses** damage
numbers back to raw digits. Committing the source removes that latent regression so the next
deploy-from-HEAD keeps the abbreviated numbers.

**Verified:** `qa-numberformat.mjs` PASS on the shipped bundle — 515000000→`515M`, 1500→`1.5K`,
12345→`12K`, 2400000000→`2.4B`, 999→`999`, 1000000→`1M`; every glyph renderable, console clean;
HUD `formatShort` applied in `drawHUD`. Live still serves `index-DrFjavMF.js`, HTTP 200 (rebuild
from the committed tree reproduces the identical bundle hash).

---

## 2026-07-03 (morning, follow-up) — projectile pass-through: widen collision candidate query (live index-DrFjavMF.js)

Closes the residual gap in the earlier tunneling fix. The swept-collision test
(`segmentCircleHit`) was already correct — but the **candidate set** it tested came from an
**endpoint-only** quadtree query (`enemyQuadtree.retrieve(proj)`). A fast projectile whose endpoint
resolves into a *different* quadtree leaf than an enemy it swept **through** never listed that enemy
as a candidate, so the swept test never ran on it and the shot visibly passed through — exactly
Felix's *"projectiles seem to pass through enemies quite a lot."*

**Fix (`Game.ts`):** query the whole swept segment (`px0,py0 → proj.x,proj.y`) padded by the largest
enemy radius (90px), not just the endpoint. Any enemy on the path is now a candidate; the per-enemy
`segmentCircleHit` + `hasHit` + `dead` gates still decide actual hits, so this only *widens*
candidates — never over-hits.

**Verified (`qa-swept-collision.mjs`, real Quadtree + real segmentCircleHit, 400 randomized layouts):**
across 154 trials with a genuine swept hit, the OLD endpoint query dropped **140 real hits across 105
trials (68%)**; the NEW swept-box query drops **0**. tsc clean, build clean, live bundle changed
`index-DDef9XaJ.js → index-DrFjavMF.js` (HTTP 200, verified serving the new build).

Commit 7aaac8a.

---

## 2026-07-03 (morning) — HUD viewport clip, late-game difficulty ramp, shop price scaling, village walk-away, projectile tunneling (live index-DDef9XaJ.js)

Five things Felix hit while playing on his phone (wave 13+, a broken 2.3M-damage build).

**1 — HUD clipped at the top of a browser tab.** *"HUD is still cut off at top of screen."* The
earlier `env(safe-area-inset-top)` patch only covered a notched PWA; in a normal browser tab the
URL bar is the culprit. Root cause: the canvas *buffer* was sized from `window.visualViewport`
(the real visible area) but the *display box* was set to `100%`/`100vh` — which is the **large**
viewport (URL-bar-hidden height). That mismatch stretched the frame vertically and pushed the top
row (HUD) up behind the URL/status bar. **Fix:** size *and* position the canvas display box to
`visualViewport` in explicit px (`width/height/offsetLeft/offsetTop`), with a `100%` fallback for
browsers without `visualViewport`; also listen to visualViewport `scroll` (URL-bar slide fires
scroll, not resize) so it re-fits as the bar shows/hides.

**2 — Late-game had no bite (515M damage shredding everything).** Felix clarified 515M is a
*legitimate* broken build — so **enemies** must scale to match, not the numbers get capped. Enemy
HP+damage scaled flat-linearly (`1 + (wave-1)*0.15`); by wave 20+ that's trivial against an
exponential build. **Fix:** `WaveManager.waveScale(wave)` = the same linear term **×** a compounding
`1.1^(wave-8)` — identical early game, steepening from wave 8 (≈2.05× @ w8, 4.5× @ w13, 12× @ w20,
44× @ w30). Applied to trash, boss, and miniboss (miniboss ×1.3 on top); added late-wave density
(`floor((wave-10)^1.8 * 0.5)` extra spawns). A truly broken build will still melt fodder (genre
norm) — depth now bites through enemy damage, density, and tanky elites, not fodder TTK.

**3 — Shop was trivial to buy out.** *"At wave 14 I have thousands of gold but items are still
15-100 gold each… I can just buy the entire shop."* Prices scaled flat-linear too. **Fix:**
`getItemPrice` now multiplies the linear term by `1.12^(wave-6)` — flat early, compounding past
wave 6 (a 25g base item is ~163g @ w13, ~488g @ w20, ~2087g @ w30), so gold stays a real choice.

**4 — Couldn't walk away from a village building.** *"If I walk up to a house and then close and
try to leave it opens again straight away."* On mobile, `touchstart` sets `mouseDown=true` **and**
activates the joystick in the same touch — so the very touch you use to walk away re-counts as an
"interact" tap while still in range, instantly reopening the panel. **Fix:** a `suppressId` latch —
on close, remember which building was open and refuse to reopen it until the avatar actually leaves
its reach (then re-arm). You can now close and walk off.

**5 — Projectiles passing through enemies.** *"Projectiles seem to pass through enemies quite a
lot, can you review hitboxes?"* Collision was a discrete point-circle test at the projectile's
**post-move** position — a fast projectile (or any frame near the loop's 100ms dt cap) jumps clean
past a small enemy in one step, testing only the spot *beyond* it. **Fix:** swept collision —
`segmentCircleHit()` tests the whole path travelled this frame (pre-move → post-move) against each
enemy's radius (+ projectile radius), for both player→enemy and enemy→player. No more tunneling; a
genuine side-pass still correctly misses.

**Commit:** `0319742` — built to `frontend/dist`, deployed to daiacore production, verified live.

**Verification:** `npx tsc --noEmit` clean; `qa-node-map.mjs` PASS (every node type routes, all
screens render, persistence round-trips). Balance probe on the shipped bundle: waveScale
{8:2.05, 13:4.51, 20:12.08, 30:43.55}, price(base 25) {13:163, 20:488, 30:2087}. Village probe:
panel opens on tap, closes, does **not** reopen while walking, suppress re-arms after leaving reach,
0 errors. Tunneling probe: fast projectile whose endpoint lands *past* a small enemy — old endpoint
test missed, swept test hits, side-pass correctly ignored, 0 console errors. **Live:**
`https://roguelite-game-blush.vercel.app` serves `index-DDef9XaJ.js`, HTTP 200, no auth wall.

---

## 2026-07-03 (early morning) — Standardized text boxes: descriptive copy never overflows or clips in portrait (live index-CAj25nIJ.js)

**Felix's ask (B3):** *"Artifacts description also doesn't wrap. You need to standardize text boxes
like this so they are always handled nicely."* The earlier fixes patched three specific surfaces
ad-hoc (event body, artifact desc, HUD clip); the underlying cause — **three competing text-drawing
patterns** plus one box with **zero** overflow protection — was still there, so the next long string
somewhere else would clip again.

**Fix — one canonical wrap, one standardized text-box primitive, everywhere.**
- `Renderer.wrapLines()` is now the **single source of truth** for wrapping. It uses the font-load-safe
  char-count heuristic (Press Start 2P is monospace, ~1 em/glyph → `floor(maxWidth / fontSize)`),
  *not* `ctx.measureText()` — which under-measures before the webfont loads (and in headless QA) and
  was the root of the portrait overflow.
- `Renderer.drawWrappedText()` is the standardized box: it wraps through `wrapLines`, and if a
  `maxLines` cap is set it shrinks the font as a **last resort** so a box is **never** overflowed or
  clipped, however long the string.
- The two previously-divergent wrap implementations (`Game.wrapText` char-count; a local
  `measureText`-based `wrap` in the combos guide) now **delegate** to `wrapLines`, so every panel
  wraps identically and the event/artifact draw + hit-test math stays in lockstep.
- Routed the unprotected boxes through the primitive: the **shop item description** (previously had
  *no* wrap/maxWidth at all — a long description ran straight off the card) and the **village upgrade
  descriptions**, each capped to their card's real line budget.

**Player-visible:** every descriptive box — shop, village, event, artifact — wraps cleanly at phone
width; no more copy running off a card or panel edge, and no more shrink-to-illegible.

**Commit:** `f318377` — built to `frontend/dist`, deployed to daiacore production, verified live.

**Verification (`qa-textbox.mjs` + `qa-event-title.mjs` regression, shipped `frontend/dist` @ 390×844
portrait):** `wrapLines` — long copy wraps lossless, every line ≤ maxChars. `drawWrappedText` — a wide
box honours `maxLines` exactly (cap 2→2, cap 3→3); a pathologically narrow box shrinks the block as a
last resort (10→5 lines, font floored at 4 px). Shop rendered with a 190-char stress description →
wraps inside the card, longest line 34 ≤ 36 maxChars, clean console; portrait screenshot inspected.
Event-title regression still passes (65-char title → 3 lines, fits). Live production deployment
`dpl_435YmR4o…` sha `f318377` == shipped commit; live bundle `index-CAj25nIJ.js` matches the built
`frontend/dist`; HTTP 200, not an auth wall.

---

## 2026-07-03 (early morning) — Polish: long event titles wrap inside the panel in portrait (live index-CuFk86hj.js)

**Issue:** A long event title (e.g. *"The Wandering Merchant of the Deep Caverns and the Forgotten
Halls"*) rendered as a single fixed-size line and ran off the edges of the event panel in portrait —
clipping the text on a phone.

**Fix — the title now wraps.** `drawEvent()` runs the title through the same `wrapText()` the body
already used (Press Start 2P, 1 em/glyph) at the panel content width, stacking as many lines as it
needs. `updateEvent()` was updated with the **identical** wrap formula so the option-button tap
targets stay pinned to the real bottom of the (now taller) title block — the rendering math and the
hit-test math cannot drift.

**Commit:** `79249cd` — built to `frontend/dist`, deployed to daiacore production, verified live.

**Verification (`qa-event-title.mjs`, shipped `frontend/dist` @ 390×844 portrait):** forced a 65-char
title → wraps to 3 lines, longest line 23 ≤ 24 maxChars (fits the panel), both option buttons remain
on-screen, clean console. Portrait screenshot inspected. Live bundle `index-CuFk86hj.js` matches the
committed build.

---

## 2026-07-03 (early morning) — Fix: you can never lose your weapon to a shop purchase (live index-4UCzVocG.js)

**Bug (Felix, B4):** *"my projectile / orb spiral removed after i bought some upgrade — it shouldn't
be possible to lose a weapon like that."* Root cause: a `weaponType` item **replaces** the active
firing style (`getWeaponType()` picks the first owned weapon). So once you'd committed to a build,
the shop could still offer you *another* weapon item — and buying what looked like an upgrade
silently swapped away (destroyed) the weapon you'd built around.

**Fix — you pick your weapon once, and no purchase can take it from you.** The shop now **locks out
all further weapon offers** the moment you're weapon-committed: either you own an explicit weapon
item (orbital, flamethrower, …) **or** you've invested in the default auto-aim gun (multishot /
piercing / homing). Weapon items simply stop appearing in the roll, so there's no way to
accidentally overwrite your build. (Existing safeguard held too: buying a 2nd weapon while already
weapon-committed is ignored/wasted rather than a swap — now it can't even be offered.)

Repro probe (`probe-weapon-loss.mjs`, rebuilds from source): grants an orb-spiral build, then buys
**every other item** one at a time — the orb build survives all of them, weapon stays `orbital`,
orbs never drop. Offer-layer check: **0** weapon items across 40×6 shop rolls for both a
committed-weapon build and an auto-aim build. 0 console/page errors. Commit `7372dfb`.

---

## 2026-07-03 (early morning) — Build your Village: a walkable between-runs base (live index-2QTFxGkM.js)

The flat "Permanent Upgrades" grid is gone. In its place is a **Village** — a walkable,
camera-scrolling pixel-art base in the spirit of Cult of the Lamb. Tap **Village** on the menu and
you spawn as your character in a settlement laid out around a central **Shrine**, with dirt paths
radiating out to **8 themed buildings**:

- **🔥 The Forge** — starting damage, fire rate, crit.
- **🛡️ The Armory** — armor, boss damage.
- **❤️ The Infirmary** — max HP, regen, permanent shield.
- **💰 The Market** — starting gold, gold gain, shop & reroll discounts.
- **⭐ The Academy** — XP gain, double level-ups.
- **👟 The Stables** — move speed.
- **👑 The War Table** — elite rewards, wave skip.
- **🎁 The Vault** — starting item, starting legendary.

All **19 permanent upgrades** live inside these buildings, spending the **same souls economy** — the
balance is untouched, it's purely a nicer front-end for the same purchases. **Walk up to a building
and tap** to open its upgrade panel (buy with souls, MAX when capped); **walk to the Shrine and tap
to embark** on a run. On mobile the floating joystick works here just like in-game.

The reward Felix asked for is the **visible progression**: every building tiers up as you invest,
0→4. A fresh plot is a scaffolded **foundation with a `?` sign**; as souls go in it grows into a
modest hall, then a bigger one with **lit windows** and a themed roof/prop (forge chimney with
smoke, market awning, arcane tower, gilded vault dome, crenellated keep…), and a **fully-maxed
building reaches a golden "hero" state** with gold trim, banners, and a flag — so a maxed-out village
looks earned. Warm dawn tint + vignette for mood; y-sorted so your avatar walks in front of and
behind structures correctly.

Headless QA (`qa-village.mjs`) enters the village, walks the avatar and verifies the **camera
scrolls**, and drives a **real purchase through the input path**, at mobile 390×844 and desktop —
zero console errors. Screenshots reviewed at both sizes (tier-0 and fully-maxed). Commit `20cb160`
→ live and verified (`index-2QTFxGkM.js`, HTTP 200, no SSO wall, village code present in bundle).

---

## 2026-07-03 (early morning) — A map between the waves: routes, artifacts, and real choices (live index-CCe5AaXN.js)

The run is no longer a straight line of wave → shop → wave. After each shop you now open a
**branching map** (Slay-the-Spire style) and **choose your path** to the act boss. Every node is a
different kind of encounter with its own risk and reward:

- **⚔ Battle** — the normal wave.
- **☠ Elite** — a tougher wave that pays out an **artifact** on clear.
- **? Event** — a text choice (shrine, gambler, blood pact, wandering merchant…) with 2–3 real
  decisions: gamble gold, heal for a cost, take a boon with a downside, or grab a free relic.
- **◆ Treasure** — a free artifact pick, no fight.
- **☼ Rest** — a campfire: **heal 40% HP** *or* **train for +15 max HP** permanently.
- **♠ Boss** — clears the act; the next act's map generates automatically.

**Artifacts** are the new headline layer — run-long modifiers granted by the map (not bought in the
shop), a mix of huge stat swings and rule-changers: **Glass Cannon** (+120% damage / +60% damage
taken), **Titan's Heart** (+80% max HP), **Scholar's Codex** (double XP), **Executioner's Mark**
(+crit), **Second Wind** (survive the first lethal hit each wave at 1 HP), **Vampiric Field** (kills
heal), **Momentum Engine** (damage ramps while moving), **Berserk Core** (fire faster as HP drops),
**Spiked Aura** (reflect contact damage), and more. Each is a **1-of-3 pick**, so builds diverge.

The map is **mobile-first**: bottom-to-top, big tap targets, lit nodes show where you can go, gold
edges show live routes, visited nodes dim. The global wave counter keeps climbing underneath, so the
difficulty ramp is untouched — the map only chooses *flavour + reward* at each step. Mid-run state
(held artifacts **and** your position on the map) now persists, so **Continue** resumes a routed run
faithfully.

Headless QA routes through **all six node types**, renders every screen (map/event/reward/rest/shop),
and round-trips a save→continue with artifacts + map intact — zero console errors. Commit `2c0c900`
→ live and verified (`index-CCe5AaXN.js`, HTTP 200).

---

## 2026-07-03 (early morning) — Shop: tap your stats for a full breakdown (live index-C02SkJZz.js)

The shop's stats panel only ever showed six headline numbers (HP, DMG, FIRE, SPD, CRIT, MULTI).
Now **tapping the panel opens a full breakdown popup** of *every* stat and bonus your build has —
grouped **Offense / Defense / Utility / Economy / Special** (damage types, piercing, knockback,
armor, dodge, regen, lifesteal, thorns, XP magnet, gold/luck/discount/interest, chain lightning,
freeze, poison, homing, orbit orbs, bomb, nova, aux-melee, and more).

Only rows that actually differ from base or are active are listed, so it reads as "what makes *my*
run special" rather than a wall of zeros. Two columns on desktop, one on mobile; a "TAP FOR ALL
STATS" hint sits on the panel, and a tap anywhere dismisses it (same mobile-safe overlay pattern as
the COMBOS guide). Verified with a screenshot QA at 390×844 and 1280×800 — zero console errors, all
existing regressions still green. Commit `45dfb8b` → live and verified (`index-C02SkJZz.js`, HTTP 200).

---

## 2026-07-03 (early morning) — Waves reborn: formations, splitting worms, egg-layers, telegraphed enemy AoE, mini-bosses (live index-CsyCryoz.js)

The biggest combat-feel pass yet. Every wave now plays differently and enemies fight back with
readable, dodgeable attacks.

**Waves that build.** Each non-boss wave now runs as **phases** — an opening skirmish, a mid beat,
and a closing surge — with its own on-screen banner ("The horde thickens…") so a wave feels like a
fight with structure instead of a flat trickle. Enemies spawn in **formations** — lines abreast,
V-wedges, encircling rings, two-sided pincers, tight clusters — instead of one-at-a-time randomness.

**New enemy types:**
- **Segmented worms** — a head towing 4–6 body segments that snake toward you. Kill a *middle*
  segment and the worm **splits**: the trailing half promotes its lead segment to a new head and
  keeps coming. Two threats from one.
- **Egg sacs** — stationary eggs that pulse and crack with growing urgency; leave one alive too long
  and it **hatches a tougher enemy**. Kill it in time and the threat never arrives.
- **Bombardiers** — hold their distance and **lob mortar AoE**: a red danger circle telegraphs on the
  ground for ~1s before it detonates, so you can walk out.

**Enemies now use telegraphed AoE.** Every boss got a signature ground-attack pattern (Necrolord ring,
Flamefiend pool, Voidbeast rift-donut, Stormking scatter-strike, Golem slam), painted in red before it
lands — fair but threatening. Mini-bosses lob a slam of their own.

**Mini-bosses.** Waves can now roll a **mini-boss** — a stronger, larger, dark-red-auraed version of a
regular enemy (1.4× HP, 1.25× damage, ~1.6× size, 3× rewards) with its own telegraphed slam.

Regression-verified with a new headless harness (`qa-new-enemies.mjs`): worm split promotes correctly,
eggs hatch on timer / don't hatch if killed early, bombardier + mini-boss both spawn detonating AoE
zones, and no entity is ever dead-but-still-in-array across 120 frames. All existing regressions
(stacking weapons, zoom/XP orbs) still pass; mobile playthrough holds **183 FPS under a 22-enemy swarm**,
console clean. Commit `6d8489a` → live and verified (`index-CsyCryoz.js`, HTTP 200).

---

## 2026-07-03 (early morning) — Uniqueness pass: no two items share a mechanic (live index-DQFaxL90.js)

A data-driven audit of all 188 items found **7 pairs that were mechanically identical** (same effect,
different name — one often strictly dominating the cheaper twin, e.g. two items both literally named
"Lucky Coin"). Every one is now a distinct pick:

- **Precision Charm** (was a 2nd "Lucky Coin") — crit chance **+** crit damage, so it's not just a worse duplicate.
- **Lucky Coin** — now crit **+** luck (leans into its name), separate lane from the pure-crit charm.
- **Envenomed Blade** (was "Toxic Touch") — melee poison (poison **+** melee damage), distinct from the ranged Toxic Vial.
- **Scattergun** (was "Triple Shot") — +2 projectiles **with** heavy knockback, distinct from the Trident.
- **Guided Rounds** (was "Homing Bullets") — homing **+** ranged damage, distinct from the Seeking Rune.
- **Evasion Plating** (was "Dodge Master") — dodge **+** armor, distinct from Shadow Step.
- **Bargain Hunter / Bargain Bin / Salvage Rig** — three economy commons given distinct identities
  (shop+reroll discount / shop discount+gold / recycle+shop discount) instead of the same flat -10%.

**Bug fix:** three of yesterday's new melee items had knockback set on the wrong scale (2–6 instead of
~250–450) — knockback is applied as a velocity, so those values were near-invisible. Now they actually shove.

All 22 items referenced by the duo-synergy system were left untouched. tsc clean, both regression QA
scripts pass, roster still 188 with zero exact-effect duplicates. Commit `8178069` → live and verified
`index-DQFaxL90.js`.

---

## 2026-07-03 (early morning) — 55 new build-defining items + balance pass (live index-rc2tFmEl.js)

Felix asked for *"a lot of item diversity — all unique and impactful — plus a pricing/shop balance
review so shop choices feel impactful. At least 50 new items."* Shipped **55 new items** (roster is
now **188**, all unique, every one wired to a real effect — no dead stats).

**What's new — each item is a trade-off, not a plain +damage clone.** They deepen every build axis so
the shop always offers a real specialisation choice:

- **Ranged/gun:** Hollow Points, Full Auto, Armor-Piercing Rounds, Deadeye Module, Gatling Core,
  Overclock Chip, Heavy Ordnance — hard-hitting-slow vs spray-fast tension.
- **Multishot:** Split Shot, Volley Rig, Hydra Rounds (+1/+2/+4 projectiles at a damage cost).
- **Melee:** Whetstone, Bone Cleaver, Berserker's Axe, Executioner's Blade, Titan's Gauntlet.
- **Crit:** Keen Edge, Bloodhound Sight, Deadly Precision, Executioner's Mark.
- **Elemental (poison/freeze/chain/explosion all wired):** Ember Rounds, Plague Bearer, Glacier
  Shard, Tesla Coil, Wildfire, Absolute Zero, Chain Reactor.
- **Tank:** Kite Shield, Stalwart Plate, Bulwark, Spiked Shell, Retaliation Core, Juggernaut.
- **Sustain:** Bloodletter, Sanguine Pact, Phoenix Heart.
- **Speed/dodge:** Windwalker Boots, Momentum Engine, Phantom Cloak, Blink Boots.
- **Crowd control:** Shockwave Gloves, Cryo Repulsor.
- **Economy/meta:** Bargain Bin, Scavenger Kit, Merchant's Scale, Compound Interest, Treasure Map,
  Philosopher's Stone, Jackpot.
- **Aux-weapon deepeners (stack alongside the gun):** Satellite, Dervish Charm, Detonator,
  Shockwave Amplifier, and the legendary **War Machine** (blades + orb + novas at once).

**Balance / broken-build review** (Felix's *"review all broken build possibilities"*):
- Audited every stack. The engine is already well-guarded — dodge is hard-capped at 75%, crit at
  100%, speed clamped to maxSpeed, and armor is `max(1, dmg − armor)` so a hit **always chips ≥1**
  (stacking armor never grants immunity). No infinite/invuln builds exist.
- **The one uncapped outlier: lifesteal.** Capped `getLifesteal()` at 100% — a dedicated vampire
  build can now fully convert damage to healing but no more (overheal was already wasted since
  `heal()` clamps to maxHP); an uncapped value made heavy-lifesteal trivially unkillable.
- Naming consolidation: the melee "Leech Blade" is now **Sanguine Edge** (`sanguine_edge_t3`),
  complementing the ranged **Siphon Rounds** added earlier — two distinct lifesteal lanes, no
  remaining duplicate id or name.

Pricing follows the existing cost-per-power curve (Common ~6–14, Uncommon ~22–40, Rare ~48–84,
Legendary ~130–165), so higher tiers gate correctly through the wave-based shop.

**Verified:** clean `tsc`; `qa-stacking-weapons.mjs` + `qa-zoom-xporbs.mjs` regressions PASS on the
freshly-built `dist`; a roster validation confirmed 188 unique items, zero dead-stat items, and the
lifesteal cap holding — 0 console errors. Live build **`index-rc2tFmEl.js`** (hash + 287 KB size
match local; new item names present in the shipped bundle). Commit `dad5f03`.

**Independent re-verification (heartbeat 06:3x, cp-b3/cp-b7):** live site actually **serves
`index-rc2tFmEl.js`** (curl-confirmed — deploy propagated, not just a local build); a fresh `npm run
build` reproduced the **byte-identical hash**, proving the deployed bundle IS the current 55-item
source; **shop-reachability** confirmed — all 189 active items are `unlocked:true` (the only 3
`unlocked:false` are commented-out dead code), so every new item genuinely enters the wave-gated shop
pool; no duplicate ids remain; and a full `qa-mobile-playthrough` on the shipped build ran a live
wave-1 swarm (22 enemies) at 262 FPS with **0 console/page errors**. End-to-end clean.

---

## 2026-07-02 (late night) — Build-diversity audit: dup-item bug fixed + new ranged-lifesteal item

Ran a full item-roster audit (`tools/qa/_audit-items.mjs`) against Felix's ask to *"review all
broken build possibilities to make sure there are many diverse builds."* Findings:

- **Bug fixed — two different items shared the id `leech_blade_t3`.** A legacy generic "Leech Blade"
  (+18% lifesteal, −15% dmg) and the newer melee-lane "Leech Blade" (+30% melee, +18% lifesteal,
  −15 HP) collided on one id, so one silently shadowed the other in lookups/own-once logic.
- **Fix + new item in one move:** the legacy version was strictly dominated by the melee one, so it
  was repurposed into **Siphon Rounds** (`siphon_rounds_t3`) — **the game's first ranged+lifesteal
  item** (+15% lifesteal, +20% ranged dmg, −15% fire rate). This enables a "vampiric sniper" build
  that didn't exist, and keeps the melee "Leech Blade" as the canonical one.
- **No other broken builds found:** dodge is hard-capped at 75% (`Math.min(0.75, …)`), so the raw
  111%-if-you-buy-everything is not exploitable; every other stat's stack is bounded or intended
  (piercing 999 = legendary by design). No further dup ids.

Uses only already-wired stats (rangedDamageMult / lifesteal / fireRate — all proven live), so no
dead-stat risk. **Verified:** clean `tsc`+vite build; `qa-damagetype.mjs` and `qa-builddiv.mjs`
both PASS on the freshly-built `dist`, 0 console errors.

---

## 2026-07-02 (night) — Weapons that STACK: orbs, bombs, novas & whirling blades

Felix's ask: *"add more diverse weapons and make sure weapons stack — melee arc should not
replace shot projectiles. Add AoE weapons and unique ones like orbs rotating around the player or
bombs dropped at your location with an X-second cooldown. Be really creative so the game is more
diverse than just shooting projectiles."*

**Player-visible — four new stacking weapon systems that run ALONGSIDE your gun**
- **Whirling melee arc** — a blade sweeps around you on its own timer *while your gun keeps firing*.
  This is the headline fix: melee no longer replaces your shots — the two stack. (Item: **Whirling
  Blades**, and legendary **Blade Storm** for a faster, deadlier sweep.)
- **Orbiting orbs** — energy orbs circle you and shred anything they touch, with a short per-enemy
  re-hit cooldown so they grind crowds. They **stack additively** — buy more to add more orbs.
  (Items: **Guardian Orb** +1, **Orbital Swarm** +2 & harder-hitting.)
- **Dropped bombs** — a bomb lands at your feet on a cooldown, blinks, then detonates for a big AoE
  blast. (Items: **Bomb Bandolier**, legendary **Cluster Charges** — 2× drop rate, +60% blast.)
- **Nova pulses** — a shockwave ring ripples out from you on a timer, hitting every enemy it sweeps
  once. (Items: **Nova Core**, legendary **Pulsar** — relentless, hard-hitting.)

Any of these layer on top of any primary weapon (auto-aim, shotgun, laser, melee…) and on top of
each other — a gun build can now also spin blades, orbit orbs, drop bombs and pulse novas at once,
opening whole new build axes.

**Under the hood**
- New `Weapons.ts` with `OrbitingOrb` / `Bomb` / `Shockwave` entities (kinematic + collision-query,
  in the `MeleeAttack` mould — Game owns damage application).
- Aux weapons run each frame in `Game.updateAuxWeapons()` on independent cooldown timers, fully
  decoupled from the exclusive `weaponType`. Shared `dealAuxDamage()` reuses the same crit / boss-
  mult / lifesteal / particle / kill flow the primary weapons use, so stacked hits feel identical.
- 8 new items + `PlayerStats` accessors (`getOrbitOrbCount`, `hasBombDrop`, `hasNova`,
  `hasAuxMelee`, damage/cooldown scalers). `orbitOrbs` added to the stackable ADD_KEYS so duplicates
  keep granting more orbs (and stay rebuyable in the shop).

**Verification**
- Commit `4e16125`. Live build `index-BnewURM8.js` (hash matches local exactly; all 6 item names
  present in the shipped bundle).
- `qa-stacking-weapons.mjs` (headless, real `g.update` loop): 3 orbs alive & grinding (976 dmg),
  bombs drop + detonate (1050 dmg), novas pulse (840 dmg), and **melee arcs + projectiles coexist**
  in the same run with an auto-aim primary. Prior `qa-zoom-xporbs.mjs` still green. 0 console errors.
- Mobile 390×844 screenshot (`shots/aux-weapons-390.png`): whirling arc + orbiting orbs visible
  around the player, HUD/joystick intact.

---

## 2026-07-02 (night) — XP gems, a zoomed-out arena, and a real swarm

Felix's asks: *"shouldn't XP drop as tiny orbs as well?"* and *"zoom out the game 2x (map,
player, monsters — not the GUI) so the play area is larger, then revamp spawning so more
monsters spawn, more like Vampire Survivors."*

**Player-visible**
- **XP now drops as tiny cyan gems** instead of being granted the instant an enemy dies. The gems
  pop out of the kill, then vacuum toward you once you're in magnet range and grant their XP on
  contact — the satisfying Vampire-Survivors collection loop. This also **revives the magnet stat**:
  Small Magnet, Soul Collector and Experience Gem now do something real (wider pickup range).
- **The whole battlefield is zoomed out 2×.** The arena is twice as large in each dimension, so
  the player and monsters read smaller and you see much more of the field. The HUD/joystick/shop
  are unchanged (drawn in screen space).
- **A real swarm.** Enemy counts are up and they now arrive in **bursts** (4-6 at a time) instead
  of one-at-a-time, so the bigger arena actually fills with a crowd. Live wave 1 already peaks at
  20+ enemies with a steady stream of XP gems trailing in.

**Under the hood**
- `Game` runs the simulation in a world `2×` the canvas (`worldWidth/worldHeight` getters); bounds,
  spawns, quadtree and pathfinding all use world dims, and the entity draw pass is wrapped in a
  `ctx.scale(1/2)` transform (GUI is drawn after it's restored). Mouse is only used for menus, so no
  gameplay aim remapping was needed.
- `XPOrb` entity in `Pickup.ts` (pop → home → collect); kill handler splits the award into up to 4
  gems; `grantXP()` extracted so the level-up juice fires at pickup, not on kill.
- `WaveManager` spawns a burst per tick; base counts raised (`wave1` 18→28, `20 + wave*3`).

**Commit** `750e96a` (+ `qa-zoom-xporbs.mjs` regression: world 2×, player centred, orbs
spawn/defer/collect, peak crowd — all PASS on the shipped bundle).
**Verified & LIVE** at `index-B27vLA69.js` (live hash matches the local build exactly). Headless
mobile check (390×844): world 2×, peak 23 enemies, 9 XP gems on screen mid-wave, 0 console errors;
screenshot confirms the zoomed-out field, the swarm, and the gem stream.

---

## 2026-07-02 (night) — Floating joystick anchored at your finger

Felix's ask: *"the joystick should start at mousedown — it teleports to the first touch but the
origin doesn't move as you drag (the knob moves, not the origin)."*

**Player-visible**
- The touch joystick now spawns its base **wherever your finger first lands** and stays pinned
  there for the whole drag — only the knob tracks your thumb. Previously the base was glued to a
  fixed bottom-left corner while your finger controlled it from elsewhere, so the visual origin and
  the actual control point disagreed.
- A full-tilt drag now reads as **full move speed** (the tilt divisor was 70 while the drag clamps
  at 100, so you used to top out at ~70% of a full push). Now they match.

**Under the hood**
- `Input` touchstart sets `joystick.fixedX/fixedY` to the touch point (was hard-coded 120 /
  `height−140`); `touchmove` never rewrites them, so the origin is naturally fixed for the gesture.
  `getMovementVector()` divisor 70 → 100 to match the `touchmove` clamp radius.

**Commit** `60c3487` (fix) + `d59a621` (`qa-joystick.mjs` regression harness).
**Verified & LIVE** at `index-D4JSOll_.js` (the fix was committed earlier but production still served
the pre-joystick speed build until this deploy — now shipped). `qa-joystick.mjs` transpiles the real
`Input.ts` and drives synthetic touch through a mock DOM: a `touchstart` at 60%/40% of the canvas
anchors the origin exactly at that point (fixedX/Y == computed touch coords 480/560), a following
`touchmove` leaves the origin unchanged while the knob clamps to radius 100 and a full-tilt drag
reads |vector| = 1.000 — **5/5 checks pass**. Live mobile 390×844: game loads/starts, 0 console
errors, HUD + sprites clean.

---

## 2026-07-02 (night) — Faster pace + a move-speed ceiling

Felix's ask: *"base player and monster move speed is too low, the game is so slow at the start —
but also cap max move speed, because when a broken build is live you zoom across the screen."*

**Player-visible**
- Everything moves faster from wave 1. **Player base speed 200 → 240** (+20%) and **every enemy is
  20% quicker** (uniform `ENEMY_SPEED_SCALE`, so kiting still feels the same — the whole game just
  reads faster instead of sluggish).
- **New hard speed ceiling: 480** (2× base). Speed items, duo bonuses and transformations still
  stack, but a broken speed build now tops out fast-but-controllable instead of teleporting off a
  phone screen. A dedicated speed build still hits the cap and feels genuinely fast; it just can't
  go past playable. The **dash is unaffected** (separate `dashSpeed`) so the burst still pops.

**Under the hood**
- `PlayerStats.baseSpeed` 240 + new `maxSpeed = 480`; `getSpeed()` clamps its final product with
  `Math.min(speed, maxSpeed)` after all multipliers.
- `ENEMY_SPEED_SCALE = 1.2` applied once in the `Enemy` constructor (on the per-enemy `typeData`
  copy, before the existing wave-scaling), so per-type base speeds stay readable and it's a single
  knob to retune overall pace. Deliberate fixed special-move speeds (bat lunge, boss phases) are
  left as-is.

**Verified** `verify-mechanics.mjs` — 5/5 PASS on the shipped `dist` (no-item speed = 240, a
stacked 9-item speed build clamps to exactly 480, cap = 480). Live at `index-DtOnx2Xz.js`: a
headless run on production reads player speed 240 / cap 480 / stacked-build 480 and samples live
slimes at 72 (= 60 base × 1.2), 0 console errors; mobile 390×844 gameplay screenshot clean.

---

## 2026-07-02 (night) — Own-once items leave the shop + synergy deploy

Felix's ask: *"isn't there limited items — once you've bought one it's not offered anymore? Some
items don't make sense to buy more than once. Handle it."*

**Player-visible**
- Items whose *only* effect is a boolean/weapon flag — **Seeking Rune** (homing), **Guardian
  Shield** (shield), and every weapon swap — vanish from the shop once owned. A second copy did
  literally nothing (the flag is read with `.some()`/`.find()`), so re-offering them was a gold
  trap. Items that genuinely stack (any +damage, +armor, crit%, multishot, interest, …) still
  appear as often as before.
- The missing half of a duo you're building is *still* offered even if it's a boolean item — the
  synergy pull overrides the own-once hide, so you can always complete a combo.

**Under the hood**
- `ItemDatabase.itemStacks(item)` classifies every item: true if any multiplicative field ≠ 1 or
  additive field ≠ 0, else false (only flags left → a dupe is wasted). `getWeightedShopItems`
  builds a `nonStackOwned` set and filters it at the single `getWaveAppropriteItems` chokepoint all
  pools flow through, so the general roll, the duplicate roll, and tier-fill all respect it.

**Commit** `734c5ae` (shipped alongside the per-card synergy legibility below).
**Verified** `verify-mechanics.mjs` — 4/4 PASS on the shipped `dist`: owned non-stacking item
offered 0× across 400 rolled end-game shops, a stacking item still offered hundreds of times, and
the duo-info card data is correct. Live at `index-BPlOYfQO.js` (this deploy also promoted the
COMBOS-guide overlay below to production); mobile 390×844 screenshot confirms Seeking Rune absent
from a fresh shop and the synergy badges rendering, 0 console errors.

---

## 2026-07-02 (night) — Synergies made understandable

Felix's ask: *"synergies need to be more easily understood — what a synergy does / what items combo."*

**Player-visible**
- New **COMBOS** button in the shop header (shows `COMBOS 1★` etc. with your active-duo count).
  Tap it for a full-screen **COMBOS GUIDE** that spells out, in plain language:
  - **ACTIVE NOW** — every duo you've completed and what it actually does.
  - **ONE ITEM AWAY** — each combo you're a single item from, written as
    *"have Storm Essence + get Toxic Vial → Poisoned enemies arc lightning to others"* so you
    know which two items pair AND the payoff before you buy.
  - **CARD BORDERS** legend — gold = completes a combo, green = fits your build, blue = you own it.
  - Opened and dismissed by a tap (mobile-safe — no hover, since a tap on a card buys it).
- Shop cards now say it in words instead of a cryptic badge: a card that completes a combo names
  it (`⚡ STORM SURGE`) and swaps its description for the combo's effect; a card that teaches an
  unowned pairing shows `🔗 + <partner>`; a card that fits your build reads `FITS BUILD` / `GOOD FIT`
  (was the vague `SYNERGY`).

**Under the hood**
- `PlayerStats.getActiveDuos()` / `getPotentialDuos()` (owned + still-needed partner item) feed the
  guide; `Game.getCardDuoInfo()` drives the per-card naming. No gameplay numbers changed — this is
  a pure clarity/UX layer over the existing duo + tag-affinity systems.
- New overlay state `showCombosOverlay`; `updateShop()` gives the overlay first claim on input so a
  tap can't leak through to a purchase; `enterShop()` always opens on the buy screen.

**Commits** `734c5ae` (per-card legibility) + this commit (COMBOS guide overlay)
**Verified** `qa-synergy.mjs` builds the shipped `frontend/dist` and drives it headless: active
duos only fire with both items; potential duos list the right owned+needed item names; completing
a card reports `completes:true` + the effect; the overlay opens/closes cleanly with no purchase
leak — 6/6 PASS, 0 console errors. Mobile (390×844) + desktop screenshots reviewed: guide renders
on a solid wood panel, no shop bleed-through, all text legible at phone size.

---

## 2026-07-02 (night) — Damage-type split (melee / ranged / elemental)

**Player-visible**
- Damage now splits into three lanes. Items can boost **melee**, **ranged**, or **elemental**
  damage *independently*, so a melee build and a ranged build are now mechanically different —
  not just cosmetic tags. Completes the "different builds" ask (Part 6 of the design doc).
- 7 new specialisation items, each with a real cross-lane cost:
  - Ranged — **Marksman Scope** (T1, +20% ranged / −8% fire rate), **Sniper's Focus** (T2, +40% ranged / −25% move speed).
  - Melee — **Warhammer Grip** (T1, +22% melee / −10% move speed), **Brawler's Rage** (T2, +45% melee / −12% ranged).
  - Elemental — **Storm Conduit** (T2, +35% elemental / −12% dmg), **Overcharged Core** (T3, +55% elemental / +12% fire rate / −3 armor), **Prism Lens** (T4, +90% elemental).
- Elemental multiplier scales the chain-lightning and explosion-on-hit damage, giving the
  "elemental mage" build a real power knob.

**Under the hood**
- `PlayerStats`: new `getMeleeDamageMult` / `getRangedDamageMult` / `getElementalDamageMult`
  (product of the matching item field, default 1 → fully backward compatible) plus
  `getMeleeDamage` / `getRangedDamage` (global damage × lane multiplier).
- Wired at the three real damage points: ranged projectile spawn (`Player.ts`), melee swing
  (`Player.ts`), and on-hit elemental effects (`Game.ts applyOnHitEffects` — chain + explosion).
- Range stat deliberately NOT added: auto-aim currently acquires the globally-nearest enemy
  (no radius cap), so a `range` stat would be a dead stat until a targeting refactor — held to
  avoid repeating the old `xpMagnet` placebo bug.

**Commit** `a38dd87`
**Live verified** `qa-damagetype.mjs` builds the shipped `frontend/dist`, drives it headless,
6/6 cases PASS, 0 console errors: mults default to 1 with no items (backward compat); a melee
item raises melee only (36.25 vs base 25) and leaves ranged untouched; a ranged item raises
ranged only; lane damage composes with global (`getMeleeDamage === getDamage × mult`); elemental
stacks across items (1.35×1.55=2.09); and the real DB items shipped with the right fields. Prod
serves `index-DQn9eRTB.js` (258,254 B) containing `snipers_focus_t2` / `Overcharged Core` /
`rangedDamageMult` / `Prism Lens`; bundle 200.

---

## 2026-07-02 (night) — Build-diversity behavioral verification (no code change)

**Under the hood**
- New `qa-builddiv.mjs` harness: builds the shipped `frontend/dist`, drives it headless, and
  asserts the real runtime behavior of the build-diversity features (interest accrual + the
  10+wave·2 cap, a banking item raising the rate, luck summing across items, and a trade-off
  item's downside actually lowering its stat). **PASS, 0 console errors.** Complements
  `qa-magnet.mjs` — both test the *shipped* bundle, not a stale copy.
- Confirmed prod serves the current reproducible bundle `index-xb5zgS87.js` (matches a fresh
  local build hash) containing all the new item/interest/luck code — closing the loop that the
  features are genuinely live, not just committed.

No player-visible change; this entry records verification only.

---

## 2026-07-02 — Luck stat: the high-roller build

**Player-visible**
- **New Luck stat** — raises the chance the shop offers higher-rarity items **and** the chance
  enemies drop health orbs. It powers a distinct "high-roller" playstyle: trade a little raw power
  for a shop stuffed with epics and legendaries (and more heals to survive the gamble).
- **Three new luck items:** **Rabbit's Foot** (T1, +15% luck), **Four-Leaf Clover** (T3, +40%
  luck, −10% dmg — the tradeoff that stops pure luck-stacking from being free), and **Cosmic Dice**
  (Legendary, +80% luck). Stack them and the shop visibly tilts toward the top tiers.
- This completes the economy build pair started by the interest mechanic: **banker** (hoard gold for
  interest) and **high-roller** (spend luck for rarity) are now two mechanically different economy
  routes, on top of the existing damage/tank/lifesteal lanes.

**Under the hood**
- `PlayerStats.getLuck()` sums each item's `luck` (new optional Item field), capped at **+200%** so a
  fully stacked luck build stays bounded. `getWeightedShopItems()` now takes a `luck` arg and scales
  the **Rare/Legendary** tier weights by `(1 + luck)` — reusing the existing rarity-weighted shop
  rather than adding a parallel system. Health-orb drop is `0.18 × (1 + luck)` on kill.
- Completed the dangling `window.__ItemDatabase` QA hook that `verify-mechanics.mjs` already
  referenced but was never wired — lets the shop weighting be tested deterministically.
- Damage-type split (melee/ranged/elemental) from the design doc is **intentionally still held** for
  Felix's steer — that one bakes in character-defining numbers I didn't want to set unilaterally.

**Commit** `06df715` · **live prod deploy** `dpl_3MU2iryFJUo14CyDht3ke6terQDC` (sha 06df715,
READY/PROMOTED, serving `index-xb5zgS87.js`).
_Deploy note: this project has **no working GitHub auto-deploy** — production only updates via
`vercel --prod` CLI. A push to `main` alone leaves prod on the previous build (that gap cost a
confused verification pass tonight). Always CLI-deploy, then confirm the live sha before claiming it._
**Verified on the shipped `frontend/dist`** via a new harness (`tools/qa/verify-luck.mjs`) that drives
the real game: `getLuck()` sums to 0.55 and caps at 2.0; sampling 400 shops at wave 15, the
Rare+Legendary offer rate climbs **30% → 54%** from luck 0 → max; all three items load with the
expected luck/tradeoff/tier; **0 console errors**. Existing `verify-mechanics.mjs` (interest +
tradeoff items) and the standard smoke both still **PASS** with 0 errors — no regression.

---

## 2026-07-02 — Pickup magnet now works (dead stat fixed) + orb vacuum

**Player-visible**
- Health orbs are now **vacuumed toward you** when you get near, instead of only being collected
  by walking directly onto them. There's a baseline pickup range, and the closer an orb is the
  faster it snaps in — so ranged/kiting builds that never touch enemies can finally grab heals.
- The three magnet items — **Small Magnet**, **Soul Collector**, **Experience Gem** — actually do
  something now. They were **placebo**: you paid gold for a stat the game never read. They now
  widen your pickup range as their tooltips imply. Descriptions corrected to "+X% pickup range"
  (Soul Collector was mislabeled "+50% XP gain").

**Under the hood**
- Root cause: `PlayerStats.getXPMagnet()` (whose own field comment reads *"Multiplier for pickup
  range"*) was defined and fed by three items + a transformation bonus, but **never called
  anywhere** — a genuine dead stat found while reviewing hitboxes/pickups. Fix wires it into the
  health-orb loop (`Game.ts`): orbs within `60 × magnet` px are pulled toward the player at
  170→470 px/s (ramps with closeness, always faster than the 200 px/s player so they're caught).
- Isolated: only the health-orb update loop + three item description strings. No effect on the
  instant XP/gold-on-kill economy. Complements the same-day build-diversity deploy below (that
  pass reviewed pickups but didn't catch the dead magnet stat).

**Commit** `84b3f54`
**Verified on the shipped `frontend/dist`** via a new deterministic harness (`qa-magnet.mjs`) that
steps the real game loop with fixed dt: baseline (no items) vacuums a 55px orb → collected + player
healed; a 200px orb stays put (range is bounded, not global); a magnet item (2×) pulls a 100px orb;
`getXPMagnet()` returns 1 then 2 as expected; 0 console errors. Standard smoke also clean.

---

## 2026-07-02 — Build diversity: banking interest + trade-off items

**Player-visible**
- **Interest on your gold.** When you reach the shop you now earn interest on your banked gold
  (base **10%**), shown as a green **"+Xg interest"** line under the shop's gold total. It's
  **capped** (10 + wave×2, so 12g at wave 1) so hoarding can't snowball, and it plays against the
  rising shop prices — a real save-now-vs-buy-now decision. Two new **banking items** raise the
  rate: **Piggy Bank** (+8% interest) and **Golden Vault** (+18% interest, +25% gold) — enabling a
  greedy economy build.
- **10 new trade-off items** with genuine downsides that force you into a lane instead of just
  buying pure upgrades — the point Felix raised (items should have negative side effects):
  Reckless Charm (+40% dmg / −3 armor), Hair Trigger (+30% fire rate / −12% dmg), Heavy Slugs
  (+30% dmg / −15% fire rate), Adrenaline (+35% speed / −15 HP), Sharpshooter (+18% crit /
  −2 armor), Gambler's Dice (+18% dodge / −20 HP), Leech Blade (+18% lifesteal / −15% dmg),
  Iron Turtle (+10 armor / −20% speed), Blood Pact (+50% dmg / −35 HP), Featherweight (+25%
  speed & fire rate / −15% dmg). These push distinct builds: glass-cannon melee, dodge-tank,
  lifesteal-bruiser, armored-turtle, hyper-fire-rate.

**Under the hood**
- Reviewed hitboxes + pickups per Felix's ask — no fix needed: player hitbox (`radius 15`, drawn
  at 20) is deliberately forgiving; enemy-contact + health-orb collision are body-contact and
  already guard `enemy.dead` (from the double-kill fix). Nothing broken; left as-is.
- `Game.enterShop()`: interest = `min(10 + wave*2, floor(gold * (0.10 + getInterestBonus())))`,
  granted once on shop entry, stored in `lastInterestGained` for the display. New
  `PlayerStats.getInterestBonus()` (sums `item.interestBonus`, capped +40% so interest stays
  bounded); new `interestBonus` field on the Item interface.
- Design synthesis (Brotato research → what fits our multiplicative-stat model) →
  `DESIGN-BUILD-DIVERSITY-2026-07-02.md`.

**Commit** `8e67281`
**Verified** headless regression (`tools/qa/verify-mechanics.mjs`): interest applies **once** and
respects the cap (200g @ wave 1 → **+12g**, gold 212, state=shop); trade-off items apply **both**
bonus and penalty (dmg↑, armor = base−3, HP = base−35, interestBonus = 0.08); **zero** console
errors — ALL PASS. **Live-verified**: prod serves new JS hash `index-DLCbsLoq.js`; portrait shop
screenshot shows the "+12g interest" line under the gold total and renders clean at 390×844; live
touch-purchase still works (item owned, gold dropped, 0 errors).

---

## 2026-07-02 — Fix boss-wave soft-lock (run could stall forever)

**Player-visible**
- A boss wave can no longer trap you forever. Boss waves still require the kill, but if the boss is
  somehow still alive **45 s past the wave timer** (e.g. an under-powered build that can't out-damage
  it), the wave now force-resolves instead of leaving you kiting an un-killable boss with no way to
  progress and no game-over. The boss despawns with **no reward** — you didn't win the fight, but the
  run continues.

**Under the hood**
- Root cause found via the headless balance simulator (`tools/qa/simulate-balance.mjs`): normal waves
  time-box + despawn stragglers, but boss waves had **no timeout** at all — `waveActive` stayed true
  until the boss died. A kite-bot proved the soft-lock: it reached wave 10, couldn't kill the boss,
  and was still alive-but-stuck at the 3-minute sim bail-out (1 of 5 baseline runs).
- Fix: `WaveManager.BOSS_GRACE_SEC = 45`. When `waveTimer <= -45` on a boss wave, despawn all enemies
  (`dead = true` → no reward, same path as straggler despawn) and complete the wave. Minimal,
  consistent with existing behaviour, no effect on normal play (a fair build kills the boss well
  inside the window).

**Commit** `3a5a2e9`
**Sim-verified** post-fix re-run: **8/8 runs reached wave 15, zero STUCK** (was 1/5 soft-locked);
wave-10 boss now resolves in a bounded ~44 s. Full analysis + two staged balance-feel findings
(inverted difficulty curve, runaway gold economy) → `BALANCE-SIM-2026-07-02.md`.
**Re-verified on the deployed build (2026-07-02 eve):** local `frontend/dist` hash
`index-BFYpbdyQ.js` confirmed byte-identical to what live prod serves, then **12/12 sim runs to
wave 16 cleared both boss waves (10 & 15), zero STUCK** — wave-10 boss ~56 s avg, always resolves.
This closes the loop honestly after the QA harness was found serving a stale copy earlier tonight:
the fix is now proven on exactly the code Felix plays.

---

## 2026-07-02 — Fix same-frame double-kill (double XP/gold bug)

**Player-visible**
- Killing an enemy now awards its XP, gold and kill-count exactly **once**. Previously, when two
  player shots (or a melee swing + a shot) reached the same enemy in a single frame, the enemy's
  reward was granted **twice** — so multi-shot / high-fire-rate builds (the whole point of the
  shop) were quietly handing out roughly double economy on overlapping hits.

**Under the hood**
- Root cause: the collision quadtree is rebuilt once per frame, so a just-killed enemy stays in
  its bucket for the rest of that frame. The two main hit loops (`Game.ts` projectile→enemy and
  melee→enemy) didn't guard against `enemy.dead` before calling `takeDamage`/`handleEnemyKill`,
  and `handleEnemyKill` isn't idempotent → it re-ran on the corpse (extra kill, XP, gold, particles).
- Fix: added `if (enemy.dead) continue;` at the top of both hit loops — the same guard already used
  in the homing, chain-lightning, explosion and thorns paths. Minimal, consistent, no behaviour
  change for live enemies.

**Commit** `329f764`
**Live verified** headless regression against the real build: the unfixed build reproduced
`killDelta=2` / gold ×2 on two same-frame projectiles; the fixed build gives exactly **1** kill,
`enemy.dead=true`, 0 console errors. 4s autoplay smoke: enemies spawn/die, kills accrue, portrait
render clean. Live prod serves new JS hash `index-CiAQ6lro.js` (was `index-CeQHY5_n.js`), asset 200.

---

## 2026-07-02 — Menu polish + favicon

**Player-visible**
- Menu subtitle ("BUILD A BROKEN BUILD IN THE SHOP. SURVIVE.") no longer clips off the right
  edge on narrow portrait phones — long menu lines now auto-shrink to fit the screen width.
- Browser tab now shows the game favicon instead of a broken-icon / `/favicon.ico` 404.

**Under the hood**
- `Renderer.drawText`: new `maxWidth` option measures the (wide) pixel font via
  `ctx.measureText` and scales the size down to fit — reusable for any future long copy.
- `Game.drawMenu`: passes `maxWidth = canvas.width − s(24)` to the four long menu lines.
- `index.html`: `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` (favicon.svg
  already shipped in `public/`).

**Commit** `179be6a`
**Live verified** JS hash `index-CeQHY5_n.js` served at prod; `/favicon.svg` → 200; portrait
menu screenshot shows the subtitle fully on-screen; portrait shop still purchasable via the
touch path (gold 500→491, bought Iron Ring, 0 console errors).

---

## 2026-07-02 — Art & UX overhaul + balance (host session)

**Player-visible**
- Full art/UX overhaul: camera scale, 38 redrawn sprites, pixel-art wood UI buttons (replacing
  the old green/purple gradient), enemy fire patterns.
- Sim-verified balance pass: wave pacing + economy, speed cap, flat gold, boss enrage, duo
  surfacing; placebo item & meta effects wired.
- Portrait shop cards are clickable (the hi-DPI touch-hitbox misalignment was fixed).

**Commits** `de31c19` (art/UX) · `0854114` + `72d8f5a` (balance) · `9462c36` (live QA harness)
**Live verified** deployed via Vercel CLI; live JS hash matched the local build; portrait shop
purchase confirmed end-to-end via headless touch QA.

---

## 2026-07-01 — Performance

**Player-visible**
- Smoother frame rate under load.

**Under the hood**
- Batch rendering, distance-culled updates, quadtree spatial partitioning.

**Commit** `5356ce0`
