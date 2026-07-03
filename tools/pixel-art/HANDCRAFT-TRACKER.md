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
**Batch-6** (`handcraft/batch6-casters.mjs`) — the CASTER / SUPPORT FAMILY (Felix: "go through
EACH monster/enemy"). The auto-enhancer left these five robed humanoids blurring together — worst
offender the **shielder**, which read as two disembodied grey shields, not a creature. Redrawn as
five distinct silhouettes + readable roles, grass-verified as a contact sheet:
- **wizard** — classic pointed-hat blue mage: gold star on the hat, big white beard, glowing eyes,
  a wood staff with a cyan orb (the ranged homing caster).
- **necromancer** — grounded navy-robed hooded figure with two green soul-eyes + a green chest
  rune, holding a **bone staff topped with a green-glowing skull** (was near-invisible before).
- **healer** — bright white/green medic robe with green hair, a glowing green healing **cross** on
  the chest + rising heal-sparkles (the only bright/light one → instantly distinct).
- **shielder** — a helmeted head with a glowing eye-slit peeking over ONE big grey **tower shield**
  (gold 4-point star boss), a hand gripping the shield's right edge, feet below. Now reads as a
  guardian BEHIND a shield, not two floating shields.
- **summoner** — purple hooded cultist with **both arms raised** to a floating magenta/gold
  **rune-portal** orb above, glowing eyes, gold rune trim (fixed the old cat-like read).
Subtle 1px "breathe" idle (whole creature settles 1 row on frame 2) keeps them alive next to the
bobbing regular enemies. Distinct from the spectral family (batch-4) — those float pale/tattered;
these are grounded, solid, robed humanoids.
**Batch-7** (`handcraft/batch7-brutes.mjs`) — the BRUTE / DEMON FAMILY (Felix: "go through EACH
monster/enemy"). The three brute/demon-class enemies were still on the auto-enhancer and each
failed to sell its in-game role. Redrawn from scratch, grass-verified against the orc + flamefiend
boss as clearly-different creatures:
- **imp** (16×16, the small fast teleporter) — was a vague red lump reading almost like a cat.
  Now a lean mischievous devil: two tall POINTED horns, big angry yellow eyes, a wide fanged grin,
  a barbed spade TAIL, purple/cyan teleport-shimmer accent (the blink-on-hit tell). Clearly the
  smallest of the three.
- **troll** (18×18, slow green regenerator, 200 HP) — hulking hunched tusked OGRE: tiny head sunk
  between huge shoulders, giant dragging fists, warty darker-green spots, underbite tusks, clawed
  feet, and a soft green regen-GLOW in the pale belly (its self-heal identity). Distinct from the
  upright, weapon-carrying orc (also green) by the hunch + bulk + tusks.
- **demon** (18×18, huge crimson burst-shooter, 500 HP — biggest non-boss) — winged FIRE-DEMON:
  broad spread BAT WINGS (the big silhouette statement), two curved horns, a fanged maw, a fire
  core, a charged fire-bolt in the claw (the "shoots bursts" tell). The WINGS deliberately
  differentiate it from the flamefiend BOSS (horns + flame mane, no wings) and from the small imp.
Subtle 1px breathe idle like the other families.

## Still auto-enhanced — future batches, worst-first

Re-audited on grass contact sheets 2026-07-03 (evening, after batch-3); caster family cleared in
batch-6 and brute/demon family in batch-7 (both Jul-4). The genuinely-broken cases are all fixed;
what remains reads decently — but per Felix's "go through EACH", the goal is still full coverage,
so keep pulling the next family.

**Remaining roster (next batch — the beasts/critters, batch-8):**
- **Critters**: bat (purple, red eyes — good), spider (black + red abdomen — good), evader
  (blue cat — fine), exploder (round bomb-creature — fine, distinct from bombardier), mushroom,
  orbiter (eye-diamond), spiraler (snail), necroegg (simple), mimic (chest) — all read decently on
  grass; redraw for a clear win as each comes up. Pick the ugliest holdout first (mushroom/orbiter/
  spiraler/necroegg/mimic are likelier wins than the already-good bat/spider/evader/exploder).

**Bosses (24×24) — ✅ ALL DONE (batch-5).** Casters — ✅ (batch-6). Brutes/demons — ✅ (batch-7). Spectral — ✅ (batch-4).

**Roster status (Jul-4):** hand-crafted now = player, skeleton, orc + batches 1–7 (gargoyle, golem,
construct, dasher, phaser, spinner, druid, cyclops, slime, goblin, blob, bombardier, swarm, ghost,
phantom, wraith, banshee, 5 bosses, wizard, necromancer, healer, shielder, summoner, **imp, troll,
demon**). Left on auto-enhance: bat, spider, evader, exploder, mushroom, orbiter, spiraler,
necroegg, mimic — all read decently; next pull = the beasts/critters family (batch-8).

## Method reminder

Read `SPRITE-STYLE.md` first. Draw in a `handcraft/batchN.mjs`, render with `pixelpng.mjs`, Read
the PNG and critique as a designer (silhouette, face/eyes, light direction, grass camo), iterate,
then `contact-sheet.mjs` on grass for the final look BEFORE converting to JSON and rebuilding.
Ship only where clearly better than the auto-enhanced version.
