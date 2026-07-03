# Roguelite Arena — Changelog

Newest first. One block per production deploy: player-visible changes first, the commit sha,
and the live-build verification (Felix plays on his phone — every entry is verified at a mobile
portrait viewport).

Live: https://roguelite-game-blush.vercel.app

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
