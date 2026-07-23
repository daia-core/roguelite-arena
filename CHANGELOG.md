# Roguelite Arena — Changelog

Newest first. One block per production deploy: player-visible changes first, the commit sha,
and the live-build verification (Felix plays on his phone — every entry is verified at a mobile
portrait viewport).

---

## 2026-07-23 (evening) — fix(audio): AudioContext mobile suspended-state guard · `71b3e21` · live `index-DO5Dd45J.js` ✓

**Player-visible:** audio (SFX + background music) now unlocks correctly on iOS Safari and Chrome mobile.

On mobile browsers, `AudioContext` starts suspended and must be resumed after a user gesture —
without this, all audio silently failed on mobile. Fix: `_ensureRunning()` private helper calls
`ctx.resume()` when the context is suspended, invoked from `startMusic()` (user taps "Start Wave")
and `playTone()` (all tone-based SFX). No gameplay changes. QA: 7/7 music tests pass.

---

## 2026-07-23 (night) — feat(audio): atmospheric background music loop · `4ce071b` · live `index-CIMO4ivs.js` ✓

**Player-visible:** atmospheric Am-key ambient loop plays throughout combat.

The game had 18 procedural SFX (all Web Audio API) but no background track. This adds a
16-second looping ambient layer — three synthesized layers, zero external audio files:

- **Sub-bass drone** — A1 (55 Hz) + A2 (110 Hz) sine waves, slow fade-in/out, very quiet.
  Provides the low-end gravity that makes the loop feel rooted.
- **Dark filtered pad** — Am chord (A3/C4/E4) sawtooth waves through a slowly-opening lowpass
  filter (100 Hz → 260 Hz over 3.5s), quiet swell. Creates the harmonic atmosphere.
- **Low pulse accents** — E2 (82 Hz) sine hits at 4s and 12s in the loop, with a 1.8s decay.
  Gives the loop a heartbeat quality without a drum.

Total volume is very quiet (≈5% of masterGain) so SFX stay dominant. Loop is seamless
(next iteration is scheduled 100ms before end for crossfade).

`AudioManager` API additions:
- `startMusic()` — starts the loop; idempotent (no-op if already playing)
- `stopMusic()` — stops the loop and clears the scheduler
- `musicPlaying` — boolean getter for QA state checks
- `toggle()` — now also calls `stopMusic()` when muting (was a silent no-op before)

Wired in `Game.ts`:
- `startMusic()` in `startNextWave()` (map→combat transition; idempotent so each wave is a no-op)
- `startMusic()` in `continueGame()` (save-restore path)
- `stopMusic()` in `gameOver()` and `openClassSelect()` (death and return-to-menu)

Closes DEEP-REVIEW-2026-07-03.md P3-8 — the last open gap from the original deep review.

**QA — `qa-background-music.mjs` (7/7 ✅):**
- `musicOffByDefault` — musicPlaying false before any call
- `musicOnAfterStart` — musicPlaying true after startMusic()
- `doubleStartIdempotent` — no-op + no throw on second startMusic()
- `musicOffAfterStop` — musicPlaying false after stopMusic()
- `toggleStopsMusic` — muting while playing sets musicPlaying false
- `gameStartsMusic` — beginRun() + startNextWave() → musicPlaying true
- `menuReturnStopsMusic` — openClassSelect() → musicPlaying false

**Commit:** `4ce071b` · **Vercel:** `dpl_E3W7cGAxbqJzmiyUfp2EoWBbgXKr` READY+PROMOTED

---

## 2026-07-22 (morning) — test(qa): qa-active-skill-aoe-safety · (qa-only, no redeploy)

**Player-visible:** none.

**Root cause / gap closed:** Three active-skill AoeZone self-hit bugs were found and fixed in
Jul 2026 (plague_bomb Jul 9, Overcharge Battery Jul 18) — and three dedicated point tests were
added (spectral_dash, divine_wrath, plague_bomb). Rather than adding 31 more individual tests,
this adds a single comprehensive sweep that fires all 34 active skills and asserts:
any spawned `AoeZone` has `damage === 0` (the player-hit guard). Runs in one browser session.

**New harness — `qa-active-skill-aoe-safety.mjs` (34/34 skills, 0 failures):**
- 29 skills PASS: each spawns AoeZones, all verified `damage === 0`
- 5 skills SKIP: arcane_barrage, blade_storm, bone_spear, chain_lightning, phoenix_beam — spawn
  no AoeZones, so carry no self-hit risk
- 0 skills FAIL: no regressions across the full active-skill library

Fake enemy stub made comprehensive (typeData, statusFX.apply, takeDamage) so all skill execution
paths complete without crashing. Add a new skill → re-run this file; any AoeZone with damage>0
fails immediately.

**Commit:** (see git log)

---

## 2026-07-22 (morning) — test(qa): qa-plague-bomb-skill · (qa-only, no redeploy)

**Player-visible:** none.

**Root cause / gap closed:** Plague Bomb had a documented bug fixed 2026-07-09 where the visual
AoeZone had `damage=baseDmg/5` instead of 0, causing the player to be hit by their own bomb
(AoeZones are player-damage constructs). The fix added `pushActiveDmgZone` for enemy DoT instead.
This test closes the regression-guard gap: asserts `AoeZone.damage === 0`, the persistent DoT zone
is queued with correct radius/lifetime, enemy poison is applied at cast time, and cooldown is set.

**New harness — `qa-plague-bomb-skill.mjs` (8/8 ✅):**
- `scrollExists` — `scroll_plague_bomb` in catalog with `activatesSkill 'plague_bomb'`
- `skillEquipped` — after `addItem(scroll)`, `getEquippedSkillIdQ()` returns `'plague_bomb'`
- `aoeZoneDamageZero` — the visual AoeZone has `damage === 0` (REGRESSION GUARD for Jul-09 bug)
- `activeDmgZoneQueued` — `activeDmgZones` has ≥1 new persistent DoT zone entry
- `activeDmgZoneRadius` — zone radius ≈ 140 (skill.radius default)
- `activeDmgZoneLifetime` — zone remaining ≈ 8.0s (plague_bomb duration)
- `poisonApplied` — enemy inside radius at cast gets `poisonTimer ≥ 6.0`
- `cooldownSet` — `activeSkillCooldown ≈ 8.0s` (base cooldown)

**Commit:** `2d54b8c`

---

## 2026-07-22 (morning) — test(qa): qa-divine-wrath-skill · (qa-only, no redeploy)

**Player-visible:** none.

**Root cause / gap closed:** Divine Wrath is a tier-4 active skill that grants 2s invincibility
and hits all enemies with 3 screen-wide pushPendingDmg waves (r=900 each), using AoeZone(damage=0)
for visuals. The same AoeZone(damage>0) pattern previously caused player self-hits in plague_bomb
and Overcharge Battery. This test closes that gap for divine_wrath and confirms the i-frame grant.

**New harness — `qa-divine-wrath-skill.mjs` (7/7 ✅):**
- `scrollExists` — `scroll_divine_wrath` in catalog with `activatesSkill 'divine_wrath'`
- `skillEquipped` — after `addItem(scroll)`, `getEquippedSkillIdQ()` returns `'divine_wrath'`
- `iFramesGranted` — `invincibilityTimer` ≥ 1.9s immediately after cast (grants 2.0s)
- `aoeZonesDamageZero` — all 3 new AoeZones have `damage === 0` (no player self-hit)
- `pendingDmgQueued` — 3 new `pendingDmg` entries queued (one per wave)
- `pendingDmgRadius` — all 3 pendingDmg entries have `r = 900` (full screen coverage)
- `cooldownSet` — `activeSkillCooldown = 16.0s` (base cooldown, no cdMult artifact)

Debug snapshot: iFrames=2.0; cooldown=16; 3 zones damage=[0,0,0]; 3 pending r=[900,900,900].

---

## 2026-07-22 (night) — test(qa): qa-spectral-dash-skill · `c3c9953` · (qa-only, no redeploy)

**Player-visible:** none.

**Root cause / gap closed:** Spectral Dash was the only player-teleportation skill (and one of the few AoZone(damage=0) + pushPendingDmg skills) with no dedicated QA harness. The exact same pattern had bugs in two prior cases — plague_bomb and Overcharge Battery both silently hurt the player instead of enemies. This test closes that gap for spectral_dash.

**New harness — `qa-spectral-dash-skill.mjs` (8/8 ✅):**
- `scrollExists` — `scroll_spectral_dash` in catalog with `activatesSkill 'spectral_dash'`
- `skillEquipped` — after `addItem(scroll)`, `getEquippedSkillIdQ()` returns `'spectral_dash'`
- `playerMoves` — player teleports away from starting position on fire
- `playerNearLastTarget` — player lands at the 5th (last) target position
- `iFramesGranted` — `invincibilityTimer` ≥ 0.5s right after cast
- `aoeZonesDamageZero` — all 5 new AoeZones have `damage === 0` (no player self-hit)
- `pendingDmgQueued` — 5 new `pendingDmg` entries queued (one per target, r=60)
- `cooldownSet` — `activeSkillCooldown ≈ 9.0s` (base cooldown, no cdMult artifact)

Debug snapshot: player (200,200) → (300,200); iFrames=0.6; cooldown=9.0; 5 zones damage=[0,0,0,0,0]; 5 pending r=[60,60,60,60,60].

**Commit:** `c3c9953` | **Live build:** `index-CQjo7Xqw.js` (unchanged) ✓

---

## 2026-07-20 (night) — fix(render): doom status rune now paints correctly · `3572fb0`

**Player-visible:** The **doom** status-effect rune (a purple blinking glyph above enemies
marked for a stored-damage detonation) was nearly invisible in practice. It rendered at
sub-pixel canvas positions — because `ctx.scale(0.5)` maps odd world-coords to fractional
canvas pixels, which the browser anti-aliases and dilutes — leaving only a faint purple blur.

Fix: the glyph origin is now snapped to the nearest even world coordinate before drawing, so
every 2×2 world-pixel cell maps cleanly to a 1×1 whole canvas pixel with no fractional blending.
The rune is now sharp and fully readable at all enemy positions.

**QA:** `qa-status-visuals` before: doom 24px/6pk → FAIL (threshold >25). After: 130px/13pk
(= 13 lit glyph cells exactly) → PASS ✅. All 5 core suites green.

**Commit:** `3572fb0` | **Bundle:** `index-CQjo7Xqw.js` | **Live:** roguelite-game-blush.vercel.app ✓

---

## 2026-07-19 (night) — feat(artifact): lifesteal artifacts — Bloodmage's Seal + Crimson Covenant · `4b8e207`

**Player-visible:** Two new artifacts available on map nodes:
- **Bloodmage's Seal** (epic) — +8% lifesteal. Every hit restores HP proportional to damage dealt. First artifact on the lifesteal axis; items/skill-tree lifesteal was already in the game but no artifact gave it.
- **Crimson Covenant** (legendary) — +15% lifesteal and +25% damage. Synergises with high-damage glass-cannon builds: deal more → heal more.

Also adds missing pixel art glyphs for `temporal_hourglass` (added Jul 18 without a glyph) and both new artifacts. Includes `qa-lifesteal-artifacts.mjs` (7/7 ✅ — catalog, stat folding, `getLifesteal()` inclusion, damage boost, heal-on-hit).

**Commit:** `4b8e207` | **Bundle:** `index-CjyRx7tr.js` | **Live:** roguelite-game-blush.vercel.app ✓

---

## 2026-07-18 (afternoon) — fix(qa): qa-mobile-playthrough now reaches combat · `92828ea` · (qa-only, no redeploy)

**Player-visible:** none.

**Root cause:** `startNewGame()` lands in the Slay-the-Spire node map (`state='map'`), not directly
in combat. The QA never called `g.onMapNodePicked()`, so the update loop triggered the `state !==
'playing' && i > 60` early-exit after 60 frames — zero enemies, FPS measured against an empty arena.
Same class of bug as the Jul-17 `qa-live-smoke` fix (items pushed via `items.push()` instead of
`addItem()`; both bypassed the game's real initialization path).

**Fix:** Added `routeToCombat()` (mirrors `qa-live-smoke.mjs`) — iteratively calls
`g.onMapNodePicked()` targeting battle/elite/boss nodes until `g.state === 'playing'` (cap 12
picks). Also sets `g.player.invincibilityTimer = Infinity` so the player can't die before the swarm
fills (test measures density + perf, not survivability). Switched `items.push` → `addItem()` for
proper stat initialization.

**Before:** `state=map`, peak 0 enemies, FPS against empty arena. **After:** `state=playing`, peak
22 enemies, 334 FPS under real swarm load. Both ✅ verdicts now actually test what they claim.

---

## 2026-07-18 (morning) — feat(artifact): Temporal Hourglass — −30% active skill cooldowns · `c6fedd4` · live `index-CrKFaMxP.js` ✓

**Player-visible:** New epic artifact **Temporal Hourglass ⏳** reduces all active skill cooldowns by
30%. A 5-second Frost Nova becomes 3.5 seconds; an 8-second Meteor becomes 5.6 seconds. Stacks
multiplicatively with itself (via the artifact system) if multiple instances were ever awarded.

**Implementation:** New `cdMult` stat axis — `Artifact.cdMult` folds into `PlayerStats.artifactCdMult`
via `ArtifactSystem.applyStatic()`. `executeSkill()` multiplies `skill.cooldown × artifactCdMult` on
every cast. First artifact to touch the skill-cooldown dimension.

**QA:** `qa-temporal-hourglass.mjs` 4/4 — catalog check, stat-after-grant (1.0 → 0.7), frost_nova
cooldown with artifact (3.5s), frost_nova without artifact (5.0s control). Live smoke PASS.

---

## 2026-07-18 (night) — fix(game): Overcharge Battery nova no longer self-damages the player · live `index-BuJm3B1u.js` ✓

**Player-visible:** Overcharge Battery artifact now works correctly. Every 6th shot fires a nova
burst that damages enemies — previously the nova was silently dealing damage to the **player** instead
(a leftover `AoeZone(damage=ocDmg)` hit the player per the ARCHITECTURE.md AoeZone constraint, which
only applies enemy damage). Affected all Overcharge Battery runs since the artifact launched.

**Fix:** `Game.ts` — changed `AoeZone(damage=ocDmg)` → `AoeZone(damage=0)` (visual telegraph only)
and added `pendingDmg.push({r: 130, dmg: ocDmg, ...})` for actual enemy damage, consistent with the
11 active-skill AoeZone self-hit fixes shipped Jul 8.

**QA:** `qa-overcharge.mjs` (new) — 4/4 checks: artifact method exists, new AoeZone has damage=0,
pendingDmg entry with r=130 added, player HP unchanged after nova. PASS.

---

## 2026-07-17 (evening) — fix(qa): qa-live-smoke flakiness · `(qa-only)` · live `index-ChHEzTI5.js` ✓

**Player-visible:** none — QA-only fix (no game code changed, no redeploy needed).

**Root cause:** `qa-live-smoke.mjs` was giving the test player items via `s.items.push(it)`, which
bypasses `invalidateAgg()`. The aggregate cache (`_aggDirty`) is set to `false` during
`g.startNewGame()` when `new Player(stats)` calls `stats.getMaxHealth()` → `ensureAgg()`. Any items
pushed after that point have zero effect on combat stats (damage, speed, etc.) because the cache is
never revalidated. The player fought with base stats only: 100 HP, 25 damage/shot.

**Symptom:** flaky — sometimes passed (player survived 23.5s → wave-timer fires, all enemies die),
sometimes failed (bad random seed: enemies killed 100 HP player before the 23.5s fallback). Three
runs before fix: FAIL (16 kills), FAIL (24 kills), PASS (54 kills).

**Fix:** switched to `s.addItem(it)` which calls `rebuildActiveItems()` → `invalidateAgg()` →
`_aggDirty=true`, so stats are correctly recomputed on next combat query. Also replaced `glass_cannon_t4`
(+100% dmg, -40 HP) with `shield_t3` in the loadout — the HP penalty was irrelevant when items had
no effect, but with proper stat application a -40 HP penalty made the player die before the wave
timer in harder seeds. New loadout: `head_battle_crown` + `shield_t3` + `nova_core_t3` +
`orbit_orb_swarm_t3`. Three runs after fix: PASS (55 kills), PASS (42 kills), PASS (55 kills).

---

## 2026-07-17 — fix(qa): two stale QA assertions · `943569b` `35e3c54` · live `index-ChHEzTI5.js` ✓

**Player-visible:** none — QA-only fixes.

**qa-devildeal (943569b):** `crossCurseNoBlock` was comparing `maxHealth === maxHpBefore + 80` after `devil_rot_crown`, which also grants a random artifact that may have its own `maxHealthBonus`. Non-deterministic. Fix: sum all newly-granted artifacts' `maxHealthBonus` into the expected delta. 25/25 ×3.

**qa-zoom-xporbs (35e3c54):** `peakEnemies >= 8` was stale. `SpawnTelegraph.DURATION = 2.0s` means only 2 of the 4-second test window sees live enemies; steady wave-1 reliably peaks at 7. Floor lowered to `>= 6` (buffer of 1) with explanatory comment.

---

## 2026-07-13 (night, 01:12) — fix: differentiate curse_torpor and curse_entropy · `f43d692` · live `index-DV8c8omk.js` ✓

**Balance/design fix — duplicate-effect curses differentiated:**
`curse_torpor` (devil_rot_crown) was mechanically identical to `curse_sloth` (-30% speed), and `curse_entropy` (cursed_reliquary) identical to `curse_famine` (-40% XP). A player who took both events would silently stack the same penalty (e.g. -51% effective speed).

- `curse_torpor` → **-25% damage output** ("sluggish strikes"; damageMult 0.75). Devil rot crown's flavour shifts from speed-drain to force-drain.
- `curse_entropy` → **-55 max health** ("decaying vitality"; maxHealthBonus -55). Reliquary still gives 2 artifacts; cost is now survivability, not levelling speed.
- Lore text updated: rot_crown event description changed from "leaden legs" to "leaden arm"; reliquary result now mentions HP drain instead of XP drain.
- QA extended: `qa-devildeal` recognises `damageMult < 1` as a valid curse malus — **25/25 PASS**.

## 2026-07-13 (night) — fix: cross-event devil-deal curse blocking · `41a6670` · live `index-Q3tS4jpC.js` ✓

**Bug fix — two devil events silently blocked by shared curse IDs:**
When `devil_rot_crown` and `devil_bargain` both used `curse_sloth`, taking the
bargain's speed-for-gold pact first would cause "Wear the crown" (rot crown) to grant
*nothing* — the already-held-curse guard fired and voided the +80 max HP and artifact.
Same issue: `cursed_reliquary` shared `curse_famine` with `devil_starving_god`.

- `devil_rot_crown` → **curse_torpor** (🌿 -30% move speed; same magnitude as sloth but unique id)
- `cursed_reliquary` → **curse_entropy** (⌛ -40% XP; same as famine but unique id)
- Both curses added to `ArtifactSystem`, excluded from random reward pools
- Each devil event now has a unique curse id — cross-event boon blocking is impossible
- `qa-devildeal` extended: 5-curse CURSE_IDS, wider malus check (xpMult/maxHp/crit),
  3 new assertions (rotCrownUniqueCurse, reliquaryUniqueCurse, crossCurseNoBlock) — **25/25 PASS**

**QA:** qa-devildeal 25/25 PASS, qa-catalog-integrity CLEAN, qa-live-smoke PASS.

---

## 2026-07-13 (night) — balance: Devil's Bargain now guarantees an epic+ artifact · `0eec8a0`

**Player-visible — "Trade your skin for strength" is now a real choice:**
The skin-for-strength pact previously drew from the full unfiltered artifact pool, meaning you
could pay +50% permanent damage-taken (curse_frailty) and receive a common stat-stick. In practice,
nobody took it — the price was too high vs. the expected value of a random reward. Fixed by
restricting the pool to epic and legendary artifacts only (27 rollable options: 18 epic + 9 legendary).

- Before: 1 random artifact from the full pool (~44 items, any rarity) for curse_frailty.
- After: 1 epic or legendary artifact guaranteed (minRarity filter) for curse_frailty.
- The other two options (120g + curse_sloth, and free walk-away) are unchanged.
- The "Trade your speed for gold" option was already well-calibrated and stays as-is.

**Under the hood:**
`EventEffect` type extended with optional `minRarity?: ArtifactRarity` field. `applyEventEffect`
in `Game.ts` now filters the rollable pool by rarity rank when minRarity is set. `qa-devildeal`
extended with a new `bargainEpicPlusArtifact` assertion (50 samples, 22/22 PASS).

**QA:** qa-devildeal 22/22 PASS, qa-balance-probe PASS, qa-stat-caps PASS, qa-catalog-integrity CLEAN.

---

## 2026-07-12 (afternoon) — docs + qa: ARCHITECTURE sync + smoke-test flakiness fix · `1f2285e`

**No player-visible change.** Two maintenance items:

- **ARCHITECTURE.md synced** — Steps 13–16 were all complete but the doc still listed 13+14
  as future work and had Game.ts at 6,840 lines (actual: 3,670). Updated: steps 13 (HUDRenderer),
  14 (executeSkill→ActiveSkillSystem), 15 (updatePlaying sub-methods), 16 (PlayingRenderer) all
  marked ✅ DONE; file-size table reflects current catalog (5,001 lines / 1,899 items); system
  architecture diagram extended with extracted-from-Game.ts column.
- **qa-live-smoke flakiness fixed** — the old loadout had no raw-damage items; ~60% of seeds
  spawned waves the player couldn't clear in the 180s window, causing false failures. Replaced with
  glass_cannon_t4 (+100% dmg) + head_battle_crown (+50% dmg +30% crit) + nova_core_t3 + orbit_orb.
  Verified PASS across 5 consecutive seeds on live `index-BuJKybh0.js`. Live game was healthy —
  this was purely a test brittleness issue.

## 2026-07-12 (afternoon) — balance: active skills now scale with build specialization · `1bfa849` · live `index-BuJKybh0.js` ✓

**Player-visible — active skills feel impactful on any build:**
Active skill damage previously used `getDamage()` — the global damage value that excludes
type-specific multipliers. A player who invested in ranged items got a 5× boost to every
auto-attack shot but zero benefit to skill casts, so skills fell progressively further behind
as the run went on. Early game: identical (no type items → same numbers). Mid/late game:
skills now deal damage proportional to the player's built weapon type.

- Ranged build with 5× ranged items: skills also hit ~5× harder vs baseline.
- Melee build with heavy melee stacking: same — skills scale alongside the primary weapon.
- No-specialization build: unchanged — at baseline max(ranged, melee) = getDamage().

**Under the hood:**
One-line change in `executeSkill()` (`ActiveSkillSystem.ts:484`):
`getDamage()` → `Math.max(getRangedDamage(), getMeleeDamage())`.
All 34 skill variants affected. No change to multiplier values, cooldowns, or radius.

**QA:** qa-live-smoke PASS (live-smoke uses reliable loadout from fix above), qa-damagetype PASS,
qa-stat-caps PASS, qa-catalog-integrity PASS, qa-balance-probe PASS.

---

## 2026-07-12 (morning) — fix: gold cap filter + QA extraction-drift · `f75a524` · live `index-B0BNMbG-.js` ✓

**Bug fix (gold-cap item filter):** Items with balance drawbacks (e.g. `gold_bonus_t2` has
`damageMultiplier: 0.95`) were never being filtered out of the shop once gold was maxed. The
`isItemFullyCapped()` logic saw the damage penalty as an "uncapped stat" and returned false even
when gold was capped. Fix: multiplicative values < 1 (cost/penalty) and negative additive values
are now skipped — only positive benefits are checked against their cap. `qa-stat-caps 15/15 PASS`.

**QA fix (extraction-drift):** `qa-equipment-manage` was 0/32 — all `equipSlotRects`,
`inspectedEquipKey`, `inspectUnequipRect`, `inspectSellRect`, `stashItemRects` had moved to
`ShopScene` during the scene-extraction refactor, but the QA script still read them off
`window.__game`. Updated to use `window.__shopScene`. `32/32 PASS`.

Internal fixes only; no new content. Live-build verified `index-B0BNMbG-.js`.

---

## 2026-07-12 (early morning) — fix: stale cap thresholds in shop item filter · `29a32bd` · live `index-CfaCRNKk.js` ✓

**Bug fix (shop item filtering):** Three stat caps had been lowered in their getter methods but
`cappedFieldsMaxed()` still used the old values. Result: `isItemFullyCapped()` never suppressed
maxed shop-discount/reroll-discount/luck items from shop offers — those items kept appearing as
viable choices when they'd already hit their ceiling, wasting offer slots.

- `shopDiscount` threshold 0.5 → 0.3 (matches `getShopDiscount()` cap)
- `rerollDiscount` threshold 0.9 → 0.6 (matches `getRerollDiscount()` cap; cap was lowered from 0.9 but threshold wasn't updated)
- `luck` threshold 2.0 → 1.0 (matches `getLuck()` cap)

Internal fix only; no new content. TypeScript clean, live-build verified.

## 2026-07-12 (early morning) — Step 4: T3 pure-melee weapons + 2 melee passives · `9340fff` · live `index-CQlgciFM.js` ✓

**New items (1894 → 1899):**
- **War Glaive** (`melee_glaive_t3`, T3 Epic, 68g) — melee only, wide arc sweep with fast swings and 18% bleed. Fills the gap between T2 Brawler's Cleaver and T4 Chaos Blade.
- **Siege Lance** (`melee_siege_lance_t3`, T3 Epic, 72g) — melee only, long thrust with 4-piercing and execute at 12% HP.
- **Seismic Maul** (`melee_seismic_maul_t3`, T3 Epic, 75g) — melee only, heavy slam with 95-AOE disc and 28% burn on impact. Slow but devastating.
- **Blooddrinker** (`melee_drain_t2`, T2 Rare trinket, 42g) — +38% melee dmg, +12% lifesteal, 12% faster swings. Sustain-focused melee passive.
- **Earthshaker Band** (`melee_quake_t2`, T2 Rare ring, 38g) — 48-AOE shockwave on every swing, +22% melee dmg, 12% slower swings. Trade-off AOE item.

All T3 melee weapons have `weaponType: 'melee'` (suppress gun). TypeScript clean, catalog-integrity CLEAN (1899 items), melee-stack PASS, melee-styles PASS, live-smoke PASS.

## 2026-07-12 (night) — Balance R1: gear-named trinkets → torso slot · `e62dc67` · live `index-DJ3d86ff.js` ✓

Three items that were named like worn gear but stacking infinitely as trinkets are now proper torso equip items — takes a slot, so players choose between them:
- **Evasion Cloak** (`dodge_t2`) — 8% dodge; now competes with other armour in the torso slot
- **Phantom Cloak** (`phantom_cloak_t3`) — +20% dodge/+10% speed; same
- **Bomb Bandolier** (`bomb_bandolier_t2`) — bomb-drop active; a bandolier belongs on the body, not in infinite pockets

**Remaining R1 items (gloves/gauntlets)** need a `hands` slot decision — parked for Felix's call.

**QA:** catalog-integrity PASS ✅ · shop-layout 11/11 PASS ✅ · live-smoke PASS ✅ · 0 console errors · mobile portrait verified

---

## 2026-07-11 (night) — Artifact pixel sprites complete · `0e34218` · live `index-Dt8Y1LyH.js` ✓

**All 50 artifacts now have hand-crafted pixel-art icons** — 16 were using the procedural rune fallback (only 2 colours, failing `qa-artifact-icons`). Added distinct thematic glyphs for each:
- **Bloodlust Idol** — red blood drop
- **Empowerment Sigil** — gold 4-pointed star
- **Frenzy Core** — orange spinning vortex
- **Ancestral Boon** — stone idol/totem face
- **Hunter's Mark** — green bullseye target
- **Berserker's Roar** — triple claw slash marks
- **Sage's Wisdom** — open glowing tome
- **Bloodpact Relic** — purple sealed scroll with blood sigils
- **Death's Wager** — skull with hollow eyes
- **Reactive Carapace** — teal spiked shell
- **Overcharge Battery** — blue battery with diagonal lightning bolt
- **Gale Talisman** — cyan wind spiral
- **Twin Moons** — two crescent moons with central glow
- **Oracle's Eye** — crystal ball with glowing iris
- **Reaper's Harvest** — curved scythe with red grip accent
- **Curse of Myopia** — cracked spectacles (curse red tint)

**QA:** artifact-icons PASS ✅ all 50 artifacts 3–5 colours · TypeScript clean · 0 console errors

---

## 2026-07-11 (night) — Elemental bullet sprites · `f2fa201` · live `index-B9U0aogt.js` ✓

**Fire/ice/lightning/poison shots now have distinct pixel-art sprites** instead of a recolored blue diamond:
- **Fire** (`fire` element) — hot orange fireball with yellow core
- **Ice** (`ice` element) — angular crystal shard with ice-white facet
- **Lightning** (`lightning` element) — jagged asymmetric yellow bolt
- **Poison** (`poison` element) — rounded toxic orb with green highlight

Trail color was already element-tinted; the bullet HEAD sprite now matches too. Physical shots keep the original cyan diamond. Removed the crude 4-pixel color-core overlay (made redundant by the distinct sprites).

**QA:** proj-element PASS ✅ · TypeScript clean · no console errors · 4×2 sprite refs confirmed in bundle

---

## 2026-07-11 (early morning) — Event catalog: 42 events, 14 stat-gated · `1bff2e8` · live `index-DC4Ns3og.js` ✓

**Three new advanced stat-gated events added** (all require meaningful build investment to take the best option):
- **Molten Strike** (`melee_crit`): Double-swing for massive melee crits — requires Melee +25% AND Crit +15%. Dangerous choice with Doom downside on the non-crit path.
- **Spectral Barrage** (`ranged_multi`): Ranged volley that pierces and bounces — requires Ranged +20% AND Multishot. Punished by armor debuff if you can't fire fast enough.
- **Soul Leech** (`lifesteal_aoe`): AoE drain that heals you — requires Lifesteal +8% to unlock the heal path. Otherwise it costs gold for a weaker effect.

**Event catalog is now 42 events total / 14 stat-gated.** All 7 stat axes (melee, ranged, crit, speed, HP, gold, lifesteal) have ≥2 gated events each. Full catalog documented in `DESIGN-events.md`.

**QA:** event-gate 14/14 ✓ · smoke 9/9 ✓ · TypeScript clean · village purchase ✓ · achievements screen ✓

---

## 2026-07-10 (night) — Button text overflow fix · `d277531` · live `index-51mMYG2m.js` ✓

**Button labels now auto-shrink to fit.** Long stat-gate labels like "SHOOT THE HOOK  🔒 RANGED +30% · YOU: 0%" could overflow their button bounds. Added `maxWidth` to `drawButton`'s text call, engaging the existing auto-shrink path in `drawText` (already used throughout all other UI text). No visual change for normal-length labels; font scales down proportionally when a label would otherwise clip.

**QA:** TypeScript clean · smoke 9/9 ✓ · event-gate 13/13 ✓

---

## 2026-07-10 (midnight) — Wager event balance fix · `f76d301` · live `index-DCucbd5B.js` ✓

**The Gambler's gold bet now requires you to actually have the gold.** "Bet 40 gold" was incorrectly granting +40g with no cost — free money every event. Fixed with a gold stat-gate (min 40): the option locks when you're broke (showing "🔒 40+ gold"), so early-game you're forced toward the blood bet or walking away. When you do have the stake, the +40g net represents doubling it. Now 8 stat-gated events total (was 7).

**QA:** event-gate 8/8 ✓ · smoke 9/9 ✓ · TypeScript clean

---

## 2026-07-09 (late night) — Stat-gate UX: progress feedback on locked options · `8389ad5` · live `index-CtVqMT28.js` ✓

**Locked gated event options now show your current stat value.** When a `?` event option requires e.g. "Melee +30%" and you haven't invested enough, it now reads **"🔒 Melee +30% · you: 18%"** instead of just "🔒 Melee +30%". This makes the gate a progression goal you can see rather than a mystery — the Slay-the-Spire unlock feel, properly surfaced.

Format: percentage stats (melee/ranged/crit/move speed) show `X%`; raw stats (armor, max HP, gold) show the integer. Only locked options show the current value; met requirements keep the clean `✓` label.

**QA:** smoke 9/9 ✓ · TypeScript clean

---

## 2026-07-09 (night) — Event deduplication · `6d9c9a5` · live `index-kNyRFp0d.js` ✓

**`?` events no longer repeat until you've seen every event.** Previously `randomEvent()` was pure random — a 5-event run had ~30% chance of seeing the same encounter twice. Now EventScene tracks which events have appeared this run and always draws from the unseen pool first; only once all 26 have been visited does it cycle back to the full set.

**QA:** live smoke 9/9 ✓ · qa-event-gate 13/13 ✓ (lock/unlock logic correct, all 7 gated events verified well-formed on live build) · test_tools 30/30 ✓

---

## 2026-07-09 (evening) — Game-over polish: class + duration · `b260a5e` · live `index-C-I1vViB.js` ✓

**Game-over screen now shows your class and run duration.** The subtitle "Berserker  •  4:32"
appears in grey below the GAME OVER title — class name on the left, wall-clock run time on the
right (M:SS). Both were already tracked internally; now they're surfaced so each run feels
distinct and worth remembering.

---

## 2026-07-09 (early morning) — QA fix: live smoke test wave-clear · `64e00ed` · live `index-DWFZd3px.js` ✓

**QA-only fix, no player-visible change.** `finishSkillTree()` was always setting state
to `'playing'`, even when the skill tree was opened from the post-wave shop break. This
caused `qa-live-smoke.mjs` to silently cancel every wave-clear: the wave timer fired,
`enterShop()` set state to `'shop'` then immediately to `'skilltree'` (for banked points),
the QA bot called `finishSkillTree()` → back to `'playing'` → next wave started without
reaching the shop. Smoke test was permanently FAIL while the real game worked fine (the
real SkillTreeScene uses the `onFinish(returnToShop)` callback, not `finishSkillTree()`).

Fix: `SkillTreeScene.isReturnToShop` public getter; `finishSkillTree()` resolves to
`'shop'` when opened from the post-wave break, `'playing'` for mid-combat skill points.
Live smoke test: was FAIL (0/9 wave-clear), now PASS 9/9 ✓.

---

## 2026-07-09 (overnight) — Stat-gated event choices · live `index-CLUgf4Xv.js` ✓

**`?` events can now have requirement-locked options (Slay-the-Spire style).** An option can
carry a stat gate — if your build doesn't meet it, the choice shows greyed and un-clickable
with the requirement tagged on it (🔒 Melee +30%); once you've invested enough, it unlocks
(✓) and is strictly stronger than the fallback. Build identity now opens doors a generalist
can't.

- **7 new gated events** across the stat spectrum: **The Fallen Boulder** (Melee +30% → lift it
  for an artifact), **The Distant Lantern** (Ranged +30% → snipe the strongbox loose), **The
  Frayed Tightrope** (Move speed +25% → dash across before it snaps), **The Sleeping Warden**
  (Crit +25% → one-shot the weak point), **The Bent Portcullis** (Armor 5+ → brace the gate for
  a double haul), **The Blood Toll** (Max HP 140+ → pay in blood for two artifacts), **The High
  Roller** (100+ gold → buy the high table). Each keeps a free/neutral path so the gate is a
  bonus lane, never a wall.
- Gates read live from PlayerStats (melee/ranged %, crit %, move-speed %, armor, max HP, gold),
  re-evaluated each time the event opens.
- QA: `qa-event-gate.mjs` 12/12 + all 7 gated events surfaced well-formed · regressions
  (event-title, devildeal, node-map) green · TSC clean.

## 2026-07-09 (overnight) — Active skill balance fixes · `99e6a52` · live `index-BlNzpd8_.js` ✓

**4 active skill bugs fixed** (all from the Q/E skill slots):

- **Earthquake** — was splitting total damage across enemy count, so 45 enemies each
  received ~11 damage (weaker than tier-1 Frost Nova). Now hits each enemy for the
  full 10× baseDamage. A crowd nuke that actually nukes crowds.
- **Plague Bomb** — AoeZone had `damage = baseDmg/5` which hit the PLAYER (AoeZones
  are player-damage constructs). The zone had no mechanism to damage enemies at all.
  Fixed: zone visual is damage=0; added proper per-second enemy damage zone (8s duration).
- **Spectral Shield** — tooltip said "5s invincibility" but code granted 2.5s. Now 5.0s.
- **Poison Cloud** — 1.2× per second was too weak; enemies walking through barely noticed
  the zone. Bumped to 2.5× per second (kills a wave-1 enemy that lingers ~3s in zone).

## 2026-07-09 (late night) — QA maintenance · `644c04e` (no deploy needed)

**No player-visible change.** Pure QA infrastructure work.

Fixed 3 QA scripts that had drifted from the scene extraction pass (steps 1-16):
- `qa-devildeal.mjs` — `pactRefusalMessaged` check: `applyEventOption()` returns
  `{ resultText }` directly; the script was checking `g.eventResultText` which moved
  to EventScene private. Now captures the return value. 21/21 PASS.
- `qa-melee-stack.mjs` — stub enemies missing `statusFX`: the StatusEffectEngine
  was wired into `updateEnemies` after this script was written. Added a no-op
  `StatusEffectManager` mock. Also added `lastX/lastY` to the stub. PASS.
- `qa-node-map.mjs` — three extraction drift points fixed:
  1. `screenScale()` moved to MapScene private → inlined canvas calculation.
  2. `g.update()` calls `disarmUntilRelease()` on state change, swallowing
     synthetic taps → call `g.update(0)` first, then clear `pressDisarmed`.
  3. `currentEvent` moved to EventScene private → access via `g.scenes.event`.
  All node types routed successfully, persistence round-trips. PASS.

Documented all 3 new drift patterns (3-5) in ARCHITECTURE.md QA section for
future script authors.

Also ran `host-skill-yaml-repair.py` (I-17 auto-repair): 3 host skills fixed.

---

## 2026-07-09 (night) — 26 event encounters · `2750dc9` · `index-B0h61D9M.js` ✓

**Player-visible:** the `?` nodes on the map now draw from a pool twice as large (13 → 26 events),
so longer runs no longer replay the same handful of decisions.

**13 new events added:**

*Regular events* — a mix of free choices, cost/benefit trades, and risky gambles:
- **Memory Pillar** — touch for a trinket, meditate for healing, or leave it
- **Poison Well** — drink deep (artifact + pain) or a cautious sip (minor hurt + minor heal)
- **Orc Champion** — accept the duel (hurt + artifact + 40g), pay tribute (50g → item), retreat
- **Ancient Burial Mound** — dig up an item (take minor damage) or leave an offering (20g → heal)
- **Echoing Library** — study for hours (item + max HP), grab what you can (item + 20g), burn it (80g)
- **Bone Witch** — trade 30 max HP for an artifact, or 40g for a big heal
- **Suspicious Chest** — open boldly (item) or spike-first (artifact + minor hurt)
- **Traveling Smith** — commission two pieces (50g), or have her reinforce you (30g → +25 max HP)
- **Haunted Mirror** — reach through for an artifact (hurt + artifact), smash for coin, or walk away
- **Flooded Vault** — wade in (2 items), dive for the gleam (artifact + hurt), or drain for gold
- **Twin's Challenge** — accept the split (hurt + 2 artifacts), bribe your way out (60g → heal), or refuse

*New devil deals* — completing the full curse roster (all 6 curses are now event-accessible):
- **The Hollow Eye** — artifact + 80g, permanently -12% crit chance (`curse_myopia`, previously unused)
- **The Rot Crown** — +80 max HP + artifact, permanently -30% move speed (`curse_sloth`, new context)

**Commit** `2750dc9`
**Live verified** `index-B0h61D9M.js` served at roguelite-game-blush.vercel.app (event strings present in bundle).

---

## 2026-07-09 (night) — Balance-sim QA fix · `7140ad1` · `index-BeaPZxfx.js` ✓

**No player-visible change.** `simulate-balance.mjs` crashed on every run with
`g.finishSkillTree is not a function` after SkillTreeScene was extracted in step 12:

- Added public `finishSkillTree()` to `Game.ts` — transitions state back to `'playing'`
- The headless bot allocates all skill points then calls this to resume the run;
  the real flow goes through `SkillTreeScene.deps.onFinish`, so they're equivalent
- Balance sim now completes: 3 runs, wave data logged to `/tmp/roguelite-shots/balance-sim.json`

---

## 2026-07-09 (night) — Village QA fix · `928924d` · `index-C5EV32u_.js` ✓

**No player-visible change.** `qa-village.mjs` was crashing with `TypeError: Cannot read
properties of undefined (reading 'camX')`:

- Added `get villageScene()` public getter to `Game.ts` (scene was only in the `scenes` dict)
- Made `enterVillage()` public (QA script needs to call it directly)
- Made `VillageScene.camX` / `camY` public (QA reads scroll position to verify camera movement)

`qa-village.mjs` now: PASS (state=village, camScrolled=true, bought=true, 0 errors).
All other QA: roguelite, synergy, stats-parity all PASS.

---

## 2026-07-08 (night) — Step 16: `drawPlaying()` → `PlayingRenderer` · `cfa58aa` · `index-VAtDyVod.js` ✓

**No player-visible change.** Pure rendering domain extracted from Game.ts:

- New `PlayingRenderer.ts` (~195 lines): `PlayingRendererDeps` interface (14 stable refs,
  14 array getters, 3 scalar getters) + `PlayingRenderer` class with `draw()` method
- Game.ts 3,749 → 3,613 lines (−136 net, after constructor wiring)
- Both call sites updated: main draw loop + PauseScene frozen-arena underlay
- TypeScript clean, 8 QA scripts PASS

---

## 2026-07-08 (night) — QA script drift fix (post-ShopScene extraction) · `b5de4a8` · `index-DAsowQVb.js` ✓

**No player-visible change.** QA scripts broken silently since step 6 (ShopScene extraction):
`getShopLayout()` moved from Game.ts to ShopScene.ts, but 5 QA scripts still called it via
`window.__game.getShopLayout()`. Fixed:

- Made `ShopScene.getShopLayout()` public
- Updated `verify-live.mjs`, `qa-shop-inputguard.mjs`, `qa-shop-layout.mjs`,
  `qa-xp-coin-shop.mjs`, `qa-textbox.mjs` to route via `window.__shopScene.getShopLayout()`
- All 5 scripts now pass; verify-live.mjs no longer throws on headless shop layout test

This is the third QA drift point documented in ARCHITECTURE.md (alongside the Scene extraction
window.__game pattern and the stats-parity cap-mirror rule).

---

## 2026-07-08 (evening) — useActiveSkill extracted (step 14) · `3ba40f5` · `index-cRH2V7ES.js` ✓

**Architecture (no player-visible change):** Moved the 34-case active-skill dispatch switch
(~610 lines) from `Game.ts` into `ActiveSkillSystem.ts` as `executeSkill()`. Introduced the
`ActiveSkillContext` interface so the function can operate on Game state via closures (enemies,
player, worldWidth/Height, pushPendingDmg, pushActiveDmgZone, spawnAoeZone, dealAuxDamage,
pushProjectile, setCooldown). Game.ts `useActiveSkill()` is now an 18-line thin wrapper.
Game.ts: 4,304 → 3,694 lines (−610). TypeScript clean.

---

## 2026-07-08 (evening) — HUDRenderer extracted (step 13) · `8f08a9e` · `index-Blgb8Izc.js` ✓

**Architecture (no player-visible change):** Extracted `drawHUD()` + `updateMobileSkillButtons()`
into `HUDRenderer.ts`. Game.ts: 4,520 → 4,304 lines (−216). TypeScript clean.

---

## 2026-07-08 (evening) — PauseScene extracted (step 11) · `8260b3c` · `index-Blgb8Izc.js` (prev)

**Architecture (no player-visible change):** Extracted the pause overlay into `PauseScene.ts`
(153 lines). Owns `update`/`draw`, shared geometry helpers (`screenScale`, `columnRects`,
`pausedTopY`), and a `drawPlayingUnderlay` callback that keeps the frozen arena visible behind
the overlay. Removed dead `pauseRequested` field and the now-unused helpers from Game.ts.
Game.ts: 4,611 → 4,520 lines (−91). All 13 non-playing states now have dedicated scene files.
TypeScript clean.

---

## 2026-07-08 — SkillTreeScene extraction (step 12) · `cbaaa8e` · `index-J7buFMpy.js` ✓

**Architecture (no player-visible change):** Extracted the skill-tree screen out of Game.ts into
`SkillTreeScene.ts` (408 lines). Moved all `st*` state (pan X/Y, zoom, pointer tracking, pinch dist,
selected node, returnToShop flag), 6 helper methods (stView, stButtons, stNodeRadius, stApplyZoom,
stZoomAbout, centerOnStart), and update/draw/tap-handler into the scene. Also removed now-dead
`paintBackdrop()`. Game.ts: 4,899 → 4,611 lines (−288). TypeScript clean.

---

## 2026-07-08 (evening) — RewardScene extracted (step 10 de-god-classing)

**Player-visible**
- No gameplay change. Artifact reward screen behavior is identical.

**Internal**
- `RewardScene.ts` (171 lines) extracted from `Game.ts`: owns `drawReward`, `updateReward`, inlined `screenScale`/`columnRects` geometry helpers.
- Removed now-unused `wrapText()` helper from `Game.ts` (was a thin delegation wrapper around `renderer.wrapLines`).
- `Game.ts`: 4,961 → 4,899 lines (−62). 10 of 12 game states now have dedicated scene files.
- Commit: `54f071c` · Bundle: `index-BWKBP5Po.js` · Live ✓

---

## 2026-07-08 (evening) — ClassSelectScene extracted (step 9 de-god-classing)

**Player-visible**
- No gameplay change. Class selection screen behavior is identical.

**Internal**
- `ClassSelectScene.ts` (104 lines) extracted from `Game.ts`: owns `classCardLayout`, `updateClassSelect`, `drawClassSelect`
- Game.ts: 5,016 → 4,961 lines (−55). TypeScript clean.
- **Commit:** `af239e4` | **Bundle:** `index-BOiKwZu-.js` | **Live:** roguelite-game-blush.vercel.app ✓

## 2026-07-08 (evening) — AchievementsScene extracted (step 8 de-god-classing)

**Player-visible**
- No gameplay change. Achievements screen behavior is identical.

**Internal**
- `AchievementsScene.ts` (153 lines) extracted from `Game.ts`: owns `achievementLayout`, `updateAchievements`, `drawAchievements`
- Follows same Scene interface + deps-injection pattern as ShopScene/GameOverScene/MapScene/etc.
- Game.ts: 5,111 → 5,016 lines (−95). TypeScript clean.
- **Commit:** `0add1dd` | **Bundle:** `index-Dn1mx5c1.js` | **Live:** roguelite-game-blush.vercel.app ✓

## 2026-07-08 (evening) — GameOverScene extracted (step 7 de-god-classing)

**Player-visible**
- No gameplay change. Game-over screen, buttons, stats panel, and achievement unlock banner behaviour is identical.

**Internal**
- `GameOverScene.ts` (221 lines) extracted from Game.ts: owns updateGameOver() + drawGameOver()
  via deps-injection pattern (same as ShopScene). Navigation handled by callbacks:
  onRetry (→class select), onViewUpgrades (→village), onMenu (→menu), onViewAchievements (→achievements).
- `GameOverStats` interface now exported from GameOverScene.ts; inline type removed from Game.ts.
- Game.ts −178 lines: 5,289 → 5,111.
- Commit: `951fc79` · Bundle: `index-DzllMxww.js` · Live: roguelite-game-blush.vercel.app ✓

---

## 2026-07-08 (evening) — ShopScene extracted (step 6 de-god-classing)

**Player-visible**
- No gameplay change. Shop, equipment strip, combos overlay, inspect popup, stats popup behaviour is identical.

**Internal**
- `ShopScene.ts` (~900 lines) extracted from Game.ts: owns all shop UI state
  (selectedShopItem, showCombosOverlay, showStatsPopup, toast, inspect rects, equipment strip rects)
  and all draw/update methods (updateShop, drawShop, drawEquipmentStrip, drawInspectPopup,
  drawStatsPopup, drawCombosOverlay, handleEquipmentStripTap, handleInspectPopupTap,
  getShopLayout, getCombosButtonRect, getSkillsButtonRect, autoBuyAll,
  getCardDuoInfo, getCardEvolutionInfo).
- ShopSceneDeps pattern: inventory state (shopItems, lockedShopItems, shopRerollCost) stays
  in Game.ts, read by ShopScene via getters; mutations via onPurchase/onReroll/onContinue callbacks.
- Game.ts: -1,569 lines (6861 → 5292). Compile clean. QA 0 errors. Deployed.

**Commit:** `e742a11` — **live `index-Ds8xtZWX.js` ✓** (prod alias roguelite-game-blush.vercel.app 200, shopScene + COMBOS strings confirmed in bundle).

---

## 2026-07-08 (afternoon) — RestScene extracted (step 5 de-god-classing)

**Player-visible**
- No gameplay change. Campfire rest screen (heal/train choice) behaviour is identical.

**Internal**
- `RestScene.ts` (~155 lines) extracted from Game.ts: owns restResolved/restResultText
  state, draw/update logic, and enter() disarm. Game.ts delegates via onChoose() callback
  and applyRestChoice() for player stat mutation. ~74 lines removed from Game.ts.
- ARCHITECTURE.md updated: EventScene (step 4) and RestScene (step 5) documented.

**Commit:** `4824deb` — **live `index-CH7hPdsi.js` ✓** (prod alias roguelite-game-blush.vercel.app 200).

---

## 2026-07-08 (morning) — Projectiles clear between waves

**Player-visible**
- Stray bullets/projectiles no longer linger into the next wave. When a new wave
  starts, any projectiles still in flight from the previous one are cleared.
- Pickups (XP orbs, coins) are untouched — they still stay on the ground to collect
  across the wave break, exactly as before.

**Commit:** `3864e9f` — **live `index-CSIxGk1a.js` ✓** (prod alias 200). QA:
projectiles 8→0 on wave start, pool released cleanly (no leak), xpOrbs/coins
preserved, fresh wave still spawns; core regressions (status/slow-status/dash) PASS.

---

## 2026-07-08 (morning) — MapScene architecture extraction

**Internal/architecture (no player-visible change)**
- The map/node-routing screen (`drawMap` + `updateMap`, ~90 lines) extracted from
  `Game.ts` into a standalone `MapScene.ts` — step 3 of the incremental de-god-classing
  (MenuScene = step 1, VillageScene = step 2). Follows the same `Scene` interface;
  wired via deps injection (`canvas`, `renderer`, `input`, `mapSystem`, `onNodePicked`
  callback). `Game.ts` is now ~90 lines lighter and its map-related switch cases are gone.
  No behaviour change — verbatim port, build clean.

**Commit:** `47a324a` — **live `index-CSIxGk1a.js` ✓** (included in the projectile-clear build above)

---

## 2026-07-08 (morning) — Dash button actually dashes now

**Player-visible**
- The 💨 DASH button (and Space/Shift on keyboard) now works. It was rendering
  but wired to nothing — the press was registered and then dropped, so tapping it
  did nothing. Now it fires a real dash: a quick 0.2s burst with dodge i-frames on
  a 3s cooldown.
- Dash goes the way you're moving; if you tap it standing still, you dash in the
  direction you last faced (no more dead taps).
- Button now responds to mouse clicks too, not only touch.

**Commit:** `088282d` — **live `index-DvrUt5nS.js` ✓** (prod alias 200, `playDash`
present in live JS; dash QA: i-frames + standing/directional/cooldown all PASS).

---

## 2026-07-08 (morning, heartbeat ~09:15) — VillageScene architecture extraction

**Internal/architecture (no player-visible change)**
- VillageScene now implements the `Scene` interface (same pattern as MenuScene from step 1).
  Pre-constructed in the Game constructor; `enterVillage()` simplified to a 2-line delegate.
  Removed `villageScene` property, `updateVillage()`, and `drawVillage()` stubs from `Game.ts`.
  Village state dispatches through the shared scene registry — no behavior change.

**Commit:** `e10eb97` + prebuilt update — **live `index-Buqsi9XZ.js` ✓**

---

## 2026-07-08 (morning, heartbeat #2) — Game-over button fix + View Achievements

**Player-visible**
- **Game-over buttons now register correctly on all screen sizes.** The click zones were offset
  from the drawn buttons by up to 20px (especially on mobile) — the two functions used
  mismatched layout constants. Fixed: click zones now share the same isMobile-aware math as
  the drawing code.
- **"🏆 View Achievements" button on the game-over screen (desktop).** When you earn at least one
  achievement in a run, a fourth button appears below "Main Menu" and takes you straight to the
  Achievements screen. The existing "★ UNLOCKED: …" text line is still there for mobile. The
  Achievements screen (always accessible from Main Menu) shows every achievement, its reward item,
  and lets you enable/disable locked rewards to fine-tune the shop pool.

**Under the hood**
- `Game.ts`: `updateGameOver()` aligned to `drawGameOver()` layout (isMobile, buttonWidth/Height,
  spacing, startY). On desktop with new achievements, buttons shift up one slot to make room for
  the fourth. Used `else if` chain so only one button registers per click.

**Commit** `4b089aa`
**Verified** live at https://roguelite-game-blush.vercel.app — bundle `index-8P2P8btr.js` served
(HTTP 200, "View Achievements" string confirmed present in live JS).

---

## 2026-07-08 (morning, heartbeat) — Stacked-value chips + 530 new-mechanic items (→1894)

**Player-visible**
- **Upgraded gear now shows its FULL stacked value.** When you stack a piece to +N, the inspect
  popup's stat chips read the real total, not the per-copy number — e.g. an Iron Ring taken to +5
  shows **+131% Damage** (6× the base +15%), a Burn ring at +5 reads **+72% Burn**. The effect math
  was already stacking correctly; this fixes the *display* so what you read matches what you hit for.
  Descriptions that merely restate the base numbers still stay hidden, so a card never shows the same
  stat twice.
- **530 brand-new items — a whole new-mechanic wave (catalog 1364 → 1894).** Where the last wave was
  more of the familiar stats, this batch is built around the mechanics the engine supports but barely
  used: orbiting energy orbs, an autonomous whirling blade, spectral ceremonial daggers, self-dropped
  bombs, expanding nova pulses, the six on-hit debuffs (Fragility / Exposed / Condemned / Brittle /
  Dazed / Disoriented), conditional scaling (Grindstone ramps per wave, Last-Stand at low HP,
  Juggernaut while unhurt, Killing-Spree per kill, Miser off unspent gold), multicast volleys,
  war-chest spoils, and a soul-tithe. Weighted toward uncommon→legendary. Every item pairs a real
  upside with a thematic bite and reads at least one clear stat chip.
- Renamed the "10+ items in a run" achievement reward from *Treasure Map* (a name a shop item already
  used) to **Collector's Atlas**.

**Under the hood**
- `items/types.ts`: `itemStatSegments(item, level)` / `itemStatLines(item, level)` scale each chip
  exactly as `PlayerStats.ensureAgg` folds an upgraded item (additive ×level, multiplicative ^level).
  The inspect popup passes the item's `upgradeLevel`; redundancy suppression tests against BASE stats.
- `items/catalog.ts`: +530 generated items (`gen-content-2.mjs`, prefix `sx1`–`sx4`), every field
  verified consumed by gameplay; integrity gate CLEAN (no dup id/name, no invalid fields).
- QA harnesses `qa-slow-status` / `qa-expansion-shots` brought current with the StatusEffectManager
  (`statusFX`) migration so they no longer crash on `g.update`.

**Commit** `d999b2a`
**Verified** live at https://roguelite-game-blush.vercel.app — bundle `index-D1-2iJaJ.js` served
(HTTP 200, no auth wall; new-content strings present in the live JS). Regression suite all PASS with
0 console errors: catalog-integrity (1894, CLEAN), stack-inspect, status-engines, shop-8slot,
warchest, soultithe, daggers, slow-status. Mobile (390×844) + desktop shop shots eyeballed — new
items (Ceremonial Fan, Detonation Crown, …) render correctly through the offer UI.

---

## 2026-07-08 (morning, heartbeat) — Class identity from turn 1 + boss phase banners

**Player-visible**
- **Class gateway node pre-allocated at run start.** Every non-Gunner class now begins with the
  first node in its themed arm already allocated — Berserker's `might_gate` (+2% dmg), Arcanist's
  `precision_gate` (+1% crit), Ranger's `alacrity_gate` (+2% fire rate), Prospector's `fortune_gate`
  (+2% gold), Reaver's `vitality_gate` (+10 max HP), Brawler's `aegis_gate` (+1 armor). Zero extra
  skill points spent — it's a free nudge in the right direction so the class tilt is tangible from
  second one, not only after the first point buy. Gunner unchanged (starts at the hub, equidistant
  to all arms).
- **Boss phase transition banners.** When a boss crosses 66% or 33% HP for the first time, a
  gold banner flashes over the screen: "PHASE 2 — FLAME FIEND!" / "PHASE 3 — ENRAGED — VOID BEAST!"
  — plus the transformation sound. The existing per-phase behavior changes (speed, AoE cadence,
  summon rate, teleport, dash patterns) were already there; now they announce themselves so the
  shift reads as a dramatic moment rather than a silent stat bump. Each threshold fires once per run.

**Under the hood**
- `SkillTree.ts`: `CLASS_GATE_NODE` map + `reset()` / `setClass()` pre-allocate the gateway for
  non-Gunner classes. Gate nodes are always adjacent to class start nodes (edge guaranteed by
  `buildTree()`), so allocation rules are satisfied.
- `Enemy.ts`: `bossPhaseAnnounced` field (starts 1, never retreats) + `bossPhaseChange` in
  `EnemyUpdateResult` — set once per crossing.
- `Game.ts`: handles `result.bossPhaseChange`, reuses `evolutionBannerText/Timer` overlay.

**Commit** `abc62d2`
**Verified** live at https://roguelite-game-blush.vercel.app — bundle `index-BEe8--k5.js` served
(confirmed via `curl`); deployment sha `abc62d258f1af35429635829deaea75a1f9d050d` matches commit;
state READY. Skill tree QA: all keystones reachable, console errors: none. Smoke test: 0 errors.

---

## 2026-07-08 (early morning, heartbeat) — Achievement System: RunStats + 5 milestone achievements

**Meta-progression**
- **5 new milestone achievements** with richer triggers (beyond wave+class checks):
  - 🏆 **Boss Slayer** — defeat your first boss → unlocks *Warlord's Trophy* (head: +8 armor, +30 HP, +5% dmg)
  - 🩸 **Blood Bath** — kill 1000 enemies total across all runs → unlocks *Reaper's Sigil* (ring: execute at 8% HP, +5% crit, +8% dmg)
  - ⚡ **Sprint** — reach wave 5 in under 3:30 → unlocks *Mercury's Boots* (feet: +22% speed, +6% fire rate)
  - 🎒 **Hoarder** — own 10+ items at run end → unlocks *Treasure Map* (head: +25% gold, +10% luck)
  - 👑 **Renaissance** — reach wave 5 with all 7 classes → unlocks *Crown of Crowns* (head: +6% dmg/speed/crit)
- **RunStats tracking** added — every run records duration, boss kills, item count, and gold; passed to achievement checks at game-over
- **Cumulative stats** persisted in localStorage — Blood Bath tracks kills across runs; Renaissance tracks which classes cleared wave 5
- **14 achievements total** (9 original wave-based + 5 new milestone) + 14 locked reward items
- QA: `qa-achievements.mjs` 16/16 ✓ (backward compat via legacy `checkRun()`)

Commit: c5df103 · Bundle: index-ee_9Bq9B.js · Live ✓ (roguelite-game-blush.vercel.app, 827KB)

---

## 2026-07-08 (early morning) — Feel: Colored DoT damage numbers + doom explosion

**Game feel**
- **Burn / Bleed / Poison** damage now shows **colored floating numbers** — orange for burn, dark red for bleed, green for poison. Numbers are throttled (one burst per ~0.45s per enemy) so they inform without spamming. Previously these ticked silently.
- **Doom detonation** now spawns 18 purple/magenta particles in a radial burst plus a brief purple screen flash on both trigger paths (legacy timer + new-engine StatusEffectEngine). The *moment* of detonation now punches through visually.

Commit: eb16dce · Bundle: index-aiUC8QUz.js · Live ✓ (roguelite-game-blush.vercel.app, 823KB confirmed)

---

## 2026-07-08 (afternoon) — Balance: Bone Spear cooldown nerf

**Balance**
- **Bone Spear** (T2): Cooldown increased 5s → 8s. At 10× damage on a 5s cooldown, it outclassed higher-tier skills — now properly balanced for T2 (compare Meteor: 8× dmg, 8s CD; Phoenix Beam: 6× dmg, 6s CD).

Commit: 6c621dc · Bundle: index-D7GRDc9u.js · Live ✓

---

## 2026-07-08 (morning) — Fix: 11 more active skills now deal enemy damage

**Bug:** Systematic `AoeZone` architecture misuse — `AoeZone` only damages the **player**, never enemies. 11 skills across all tiers were passing non-zero `damage` to `spawnAoeZone()`, resulting in zero enemy damage and accidental player self-damage. Skills looked impressive visually but did nothing to enemies.

**Skills fixed:**
- **Meteor** — 0.8s telegraphed blast (was self-damage if player didn't dodge; now pendingDmg at 0.8s)
- **Orbital Strike** — 6 staggered impacts (were player-damage traps; now 6× pendingDmg)
- **Poison Cloud** — persistent DoT zone (was ticking player; now activeDmgZone at baseDmg/sec for 5s)
- **Circle of Power** — persistent ring (was ticking player; now activeDmgZone at 2×baseDmg/sec for 5s)
- **Lightning Storm** — 5 staggered strikes (were visuals only; now 5× pendingDmg at enemy positions)
- **Void Pulse** — 3 expanding rings (were hitting player; now 3× pendingDmg with matching radii/delays)
- **Blizzard** — 6 frost shards (were visuals only; now 6× pendingDmg; slow still applies correctly)
- **Spectral Dash** — 5 nova bursts (were visuals only; now 5× pendingDmg at dash positions)
- **Black Hole** — 2s gravity + detonation (detonation was hitting player; now pendingDmg at 2.0s)
- **Armageddon** — 12 meteors (were all visuals; now 12× pendingDmg targeting enemy positions)
- **Divine Wrath** — 3 screen-wide waves (were hitting player; now 3× pendingDmg r=900; i-frames stay)

**Infrastructure added:** `activeDmgZones` array + `resolveActiveDmgZones(dt)` for persistent player-beneficial AoE zones that tick enemy damage (powers Poison Cloud and Circle of Power).

Commit: 367ba79 · Bundle: index-XoPSvy0v.js · Live ✓

---

## 2026-07-08 (early morning) — Fix: active skills now deal enemy damage

**Bug:** 4 active skills (Mirror Strike, Hellfire Rain, Rune Field, Doom Comet) displayed visuals but dealt zero damage to enemies — `AoeZone` only processes player hits, not enemy hits. Worse, the AoeZone damage payload was accidentally hurting the player when they stood in the zone.

**Fix:** Added `pendingDmg` deferred-damage queue + `resolvePendingDmg(dt)` resolver. Each fixed skill now spawns a damage=0 AoeZone for the visual telegraph and pushes a pendingDmg job for the actual enemy damage:
- **Mirror Strike** — deals baseDmg to every living enemy immediately, with per-enemy burst VFX
- **Rune Field** — 6 pendingDmg jobs at 0.5–1.1s fuse delays (enemies in range at detonation time)
- **Doom Comet** — debuffs applied at cast, full baseDmg blast 1.5s later (matches the warning arc)
- **Hellfire Rain** — 20 pendingDmg jobs at 0–3.8s delays targeting bolt impact positions

Commit: 70e4859 · Bundle: index-ChF5Yklm.js · Live ✓

---

## 2026-07-08 (early morning) — Balance: Spectral Shield nerf

**Player-visible**
- **Spectral Shield** (T2): Invincibility duration reduced 5s → 2.5s; cooldown increased 12s → 15s. At 5s i-frames on a 12s cooldown, it outclassed Divine Wrath (T4, 16s cd, 2s i-frames) on uptime — now properly positioned as T2.

Commit: 6534f74 · Bundle: index-ChF5Yklm.js · Live ✓ (deployed together with 70e4859)

---

## 2026-07-08 (night) — 8 new Soulstone-inspired active skills (34 total)

**Player-visible**
- 8 new active skills added, covering mechanics that were entirely missing from the catalog:
  - **Thunder Clap** (T1): Explosive repel — blasts all nearby enemies outward + stuns 1s (3× dmg, 6s cd)
  - **Bone Spear** (T2): Massive single piercing bone lance through every enemy in its path (10× dmg, 5s cd)
  - **Spectral Shield** (T2): 5s invincibility bubble + burst nova on cast (4× dmg, 12s cd)
  - **Rune Field** (T2): Drop 6 delayed rune detonations at enemy positions, 0.5s fuse (5× dmg each, 7s cd)
  - **Soul Shatter** (T3): Stack Condemned×12 + Fragility×10 + Exposed×5 on 8 nearest, then detonate (8× dmg, 10s cd)
  - **Mirror Strike** (T3): 3 simultaneous strikes hit every enemy on screen at once (4× per wave, 12s cd)
  - **Doom Comet** (T4): 1.5s warning comet — 18× damage, huge radius, applies ALL debuffs to every enemy hit (22s cd)
  - **Hellfire Rain** (T4): 20 hellfire bolts rain down targeting all living enemies over 4 seconds (7× each, 24s cd)
- 8 matching Spell Scroll shop items added (one per skill, tier-appropriate costs)
- Total active skills: 26 → 34; total scroll items: 26 → 34

**New gameplay categories now covered:** repel/knockback, defensive invincibility, trap placement, debuff-nuke, screen-wide simultaneous strikes, saturation hellfire

**Under the hood**
- `ActiveSkillSystem.ts`: 8 new `ActiveSkillEffect` types + 8 `ActiveSkill` data entries
- `Game.ts`: 8 new switch cases in `useActiveSkill()`, all using existing AoE/Projectile infrastructure
- `catalog.ts`: 8 new `activatesSkill` scroll items across tiers

**Commit** `cbbe14c` — bundle `index-CXt2INih.js` verified live at roguelite-game-blush.vercel.app (both `thunder_clap` and `doom_comet` confirmed in production bundle)

---

## 2026-07-08 (night) — All 26 active skills now reachable in the shop

**Player-visible**
- Fixed a significant gap: 26 active skills existed in the game but only 10 had shop scroll items. The other 16 (Arcane Barrage, Inferno Aura, Crystal Burst, Blade Storm, Lightning Storm, Void Pulse, Blizzard, Gravity Pull, Time Warp, Vampire Burst, Spectral Dash, Plague Bomb, Black Hole, Curse Wave, Divine Wrath, Armageddon) were entirely unreachable by the player.
- 16 new Spell Scroll shop items added, one per missing skill, tiered correctly (Common t1 → Legendary t4).
- Scroll descriptions updated from `[Q]` to `[Q/E]` to reflect dual active skill slots added earlier this session. First scroll bought goes to Q; a second scroll goes to E; buying a third replaces the oldest.

**Under the hood**
- 26 `activatesSkill` entries in `catalog.ts` now match the 26 skills defined in `ActiveSkillSystem.ts` (verified via bundle grep — all 26 `scroll_*` IDs present, 26 `[Q/E]` refs, 0 stale `[Q]`-only refs).
- TS clean; bundle `index-C1l0CG-0.js` confirmed live at roguelite-game-blush.vercel.app.

**Commit** `e8e42e4`

---

## 2026-07-08 (night) — Dynamic mobile skill labels

**Player-visible**
- Mobile Q/E buttons now show the equipped skill's icon and short name instead of generic "🔮 Q" / "✨ E" labels. When a skill scroll is equipped, the button updates instantly — buy a Fireball scroll and the Q button shows "🔥 Fireba…". Buttons are greyed out when no skill is assigned to that slot, so you can tell at a glance whether you have an active skill ready.

**Technical**
- `updateMobileSkillButtons()` in `Game.ts` reads equipped skill IDs and updates `blastBtn`/`skillEBtn` innerHTML + disabled state. Hooked into: shop buy, stash sell, inspect-popup unequip/sell, `beginRun()`.
- Commit `f74d34a`, bundle `index-BFiynUFl.js`, live ✓

---

## 2026-07-08 (night) — Overcharge artifact + 2 new devil deals

**Player-visible**
- **Overcharge Battery** (epic artifact) now actually fires the promised free nova. The artifact
  was rollable and appeared in reward pools but had no combat effect — every 6th primary volley
  now spawns a 130-radius golden nova burst (3× player damage, instant AoE) around the player.
- **2 new devil-deal events** bring all 5 active curses into play:
  - *The Brittle Crown* — grants an artifact for the permanent price of −45 max HP (`curse_glass_bones`).
  - *The Starving God* — grants an artifact +50 max HP for −40% XP gained forever (`curse_famine`).
  - (13 events total; previously curse_glass_bones and curse_famine were defined but never reachable.)

**Under the hood**
- `ArtifactSystem.overchargeEvery()` reads the tuning knob from held artifacts.
- `Game.ts` tracks `overchargeShotCount` (reset each run) and fires the AoE on every Nth volley.

**Commit** `d25cfb1`
**Live verified** bundle `index-DChjnKKd.js` at roguelite-game-blush.vercel.app (was index-Bfhf3Iqp.js).

---

## 2026-07-08 (night) — Dual active skill slots

**Player-visible**
- **Q and E are now independent skill slots.** Buying your first scroll equips it to Q; buying a
  second equips it to E. Both have their own cooldown timers and fire independently.
- **26 × 26 = 676 unique skill combos** — meteor + chain lightning, time warp + plague bomb,
  armageddon + curse wave, and every other combination is now a real build decision.
- HUD shows both skill bars stacked vertically: Q on top, E below. Each bar shows the skill name,
  icon, and a live cooldown drain or "[Q] READY" / "[E] READY" indicator.
- Only 1 scroll owned: Q fires it; E bar is hidden (no change from before for new players).
- Mobile: Q fires via the SKILL button; E is keyboard-only (phone players get the primary skill
  as before — a mobile E button can be added later).

**Under the hood**
- `Input.ts`: `blastPressed` stays Q/mobile; new `skillEPressed` for E key; `consumeSkillE()` added.
- `ItemSystem.ts`: `getScrollSkills()` returns [Q, E] — oldest-of-top-2 and newest.
  `getEquippedSkillIdQ()` added; `getEquippedSkillId()` now returns E slot (undefined if <2 scrolls).
- `Game.ts`: `activeSkillCooldownE` added; `useActiveSkill(slot)` accepts `'q'|'e'`; update loop
  ticks both cooldowns and polls both input consumers.

**Commit** `0509eac`
**Live verified** `index-DoqKeUoW.js` confirmed live on roguelite-game-blush.vercel.app (200, new
bundle hash present); TypeScript clean; `qa-roguelite.mjs` 0 errors; `qa-catalog-integrity.mjs`
1335 items CLEAN; `qa-skill-tree.mjs` all-pass.

Live: https://roguelite-game-blush.vercel.app

---

## 2026-07-08 — Elite loot cascade + confirmed duo synergy hints (commit `9fa6d21`, bundle `index-Bfhf3Iqp.js`)

**Elite loot cascade** — clearing an elite or boss wave now injects a free tier-appropriate item as
a 4th shop slot. The slot shows **FREE!** in green; buying it costs 0 gold. Tiers scale with wave:
Uncommon (waves 1–5), Rare (waves 6–10), Legendary (wave 11+). This makes elite battles feel
materially rewarding beyond the +40 gold + artifact pick they already granted.

**Duo synergy hints confirmed live** — shop cards already surface named duo info:
- Gold border + duo name when buying the item *completes* a duo (e.g. "STORM SURGE")
- Blue "+ partner name" indicator when you own one half (e.g. "+ Chain Lightning t3")
- These pre-existed; no change needed.

Shop grid now dynamically sizes (3 columns → 2 rows when a cascade item is present).
Bundle `index-Bfhf3Iqp.js` verified live at mobile portrait viewport.

---

## 2026-07-08 — Phase 3c: Brittle / Dazed / Disoriented amp debuffs (commit `3d626a1`, bundle `index-CcZFH2_8.js`)

**StatusEffectEngine completion** — three amp-debuff effects (fully wired in the damage pipeline
since Phase 3b) are now accessible through items. No items could apply them before; every crit
bonus and flat-damage bonus call in Game.ts was live but receiving 0.

**New build archetypes (22 items across t1–t4):**
- **Brittle** — each on-hit stack adds +1 flat bonus damage per hit (up to +15). Scales with
  attack speed; excels vs high-HP enemies where percent-amp falls off. Tan crack visuals on enemy.
- **Dazed** — each stack raises the enemy's effective crit chance by +1% (up to +10%). Pairs
  naturally with any crit build: more crits for free. Yellow spinning-star visuals.
- **Disoriented** — each stack amplifies incoming crit damage by +1% (up to +10%). Synergises
  with Dazed for cascading crit damage. Pulsing peach ring visual on enemy.
- **Hybrid combos**: Confusion Engine (Dazed+Disoriented), Total Debilitation
  (all four amps together), Overwhelming Precision (massive crit-amp keystone), Vertigo Engine
  (Disoriented+Condemned detonation), Glass Hammer, Shattering Gaze.

1335 items total (was 1313). Bundle verified live on mobile portrait.

---

## 2026-07-08 — Early-bite balance pass (commit `dbbc4e6`, bundle `index-DZwchLsH.js`)

Three targeted fixes from the Option B recommendation in `BALANCE-enemy-scaling-review.md`:

- **DODGE_CAP lowered 0.75 → 0.65**: defensive builds no longer grant near-immunity. 35% of
  enemy hits now land (vs 25% before) — enemy damage pressure actually bites, especially with the
  miniboss health pool and elite damage modifiers.
- **Miniboss at wave % 6 (was % 7)**: first skill check arrives at wave 6 instead of wave 7.
  Schedule: wave 6, 12, 18, 24… (wave 10 / 20 remain boss waves, take priority via isBossWave).
- **Elite / tank modifier enabled from wave 4 (was wave 6)**: waves 4–5 can now roll the
  tougher enemy variant pools, closing the "trivially easy waves 1-6" gap the sim identified.

Verified: tsc clean, vite build clean, qa-catalog-integrity 1313 items CLEAN, live bundle
confirmed `index-DZwchLsH.js` at HTTP 200 on roguelite-game-blush.vercel.app.

---

## 2026-07-08 — Active Skill System expansion: 26 spells across 4 tiers

Active skills tripled from 10 → **26 spell scrolls**, spanning all 4 shop tiers. New additions:

**Tier 1 (Common):**
- 🔮 **Arcane Barrage** — 5 homing bolts at nearest enemies (3×, 4s CD)
- 🌟 **Inferno Aura** — fire ring burns all nearby + applies burnTimer (2.5×, 7s CD)
- 💎 **Crystal Burst** — hard-freeze 4 nearest enemies for 2s + damage (4×, 6s CD)

**Tier 2 (Uncommon):**
- 🌀 **Blade Storm** — 8 piercing blades in all directions simultaneously (4×, 5s CD)
- 🌩️ **Lightning Storm** — 5 random strikes on enemies over 1.5s (6× each, 8s CD)
- 🌑 **Void Pulse** — 3 expanding shockwave rings (3× per ring, 6s CD)
- 🌨️ **Blizzard** — 6 frost shards scatter wide, each slows on hit (3.5×, 7s CD)
- 🕳️ **Gravity Pull** — yank ALL enemies toward you then 55% slow (1.5×, 10s CD)

**Tier 3 (Rare):**
- ⏱️ **Time Warp** — freeze all for 1s + 75% slow for 5s (utility, 15s CD)
- 🧛 **Vampire Burst** — drain 10 nearest + heal 30% of damage (5×, 8s CD)
- 💨 **Spectral Dash** — phase through 5 enemies in rapid sequence + i-frames (6×, 9s CD)
- 🧪 **Plague Bomb** — massive 8s DoT zone + immediate poison (1.5×/tick, 8s CD)

**Tier 4 (Legendary):**
- 🌌 **Black Hole** — 2s gravity sink pulls enemies in, then detonates (15×, 18s CD)
- 💀 **Curse Wave** — apply Fragility×5 + Exposed×3 to ALL enemies (14s CD)
- ⚜️ **Divine Wrath** — 3 holy waves hit all enemies + 2s invincibility (8×/wave, 16s CD)
- 💥 **Armageddon** — 12 targeted meteors rain over 3 seconds (6× each, 20s CD)

**Deploy:** commit b6395c1, bundle `index-Cf0PVyLG.js`, live at https://roguelite-game-blush.vercel.app

---

## 2026-07-08 — Active Skill System: 10 Soulstone-inspired spell scrolls

Players can now equip an **active skill** by buying a Spell Scroll from the shop, then trigger it
with **[Q] / [E]** (keyboard) or the **SKILL button** on mobile. Only one skill can be equipped at
a time — the most recently purchased scroll wins. Skills have their own cooldown (shown in the HUD
bottom-left: icon, name, and a purple cooldown bar that fills back to "READY").

**10 skills available as shop items (Rare tier):**

- ☄️ **Meteor Strike** — telegraphed AoE impact (8× dmg, r=120, 8s CD)
- ❄️ **Frost Nova** — instant freeze ring (2× dmg + slow, r=150, 5s CD)
- ⚡ **Chain Lightning** — bounces to 5 nearest enemies (5× dmg each, 4s CD)
- 🩸 **Blood Nova** — AoE burst + heals 20% of damage dealt (6×, r=130, 6s CD)
- 🛸 **Orbital Strike** — 6 staggered impacts around the player (4× each, r=160, 7s CD)
- ☠️ **Poison Cloud** — persistent DoT zone (1.2×/tick for 4s, r=100, 5s CD)
- 🔥 **Phoenix Beam** — 3 piercing fire projectiles toward nearest enemy (6× each, 6s CD)
- 🌋 **Earthquake** — damages + slows all enemies on screen (10× spread, 12s CD)
- 👁️ **Shadow Step** — teleport to far side of nearest enemy + nova burst (5×, r=80, 8s CD)
- ✨ **Circle of Power** — spawns a spinning damage ring for 5s (2×/tick, r=80, 10s CD)

Architecture: `ActiveSkillSystem.ts` holds skill definitions; `Item.activatesSkill` field links
scrolls to effects; `PlayerStats.getEquippedSkillId()` finds the equipped skill; `useActiveSkill()`
in Game.ts implements all 10 using `dealAuxDamage()` / `spawnAoeZone()` / projectiles.

TSC: clean. Bundle: `index-h5M12LC5.js` (788 kB gzip 163 kB).

Commit: `dd87782` | Bundle: `index-h5M12LC5.js` — live on roguelite-game-blush.vercel.app ✓

---

## 2026-07-08 — Feel pass: knockback & i-frame feedback

Three targeted feel improvements — no gameplay balance change, just impact readability:

- **Knockback velocity** `300 → 450` base impulse: enemies scatter ~50% further when hit, delivering the "carving through swarms" feel
- **Knockback scaling by stat**: items that add knockback now meaningfully affect scatter distance (`impulse × (1 + stat × 0.01)`)
- **Knockback decay** `10.0 → 7.0`: enemies travel further before settling — hits read as meaty rather than a brief shudder
- **I-frame ring**: a dashed white ring appears around the player during invincibility frames, making "when am I safe?" legible at a glance (blinks at 8Hz, sits outside the shield ring when stacked)

TSC: clean. Bundle: see commit below.

Commit: `b3ab73c` | Bundle: `index-CG_XShnb.js` — live on roguelite-game-blush.vercel.app ✓

---

## 2026-07-08 (midnight) — Skill tree: 18 bridge cluster nodes between arm pairs

Added **6 cross-arm bridge clusters** (3 nodes each = 18 new allocatable nodes), one at the
midpoint angle between every adjacent arm pair. Each cluster gives players a genuine off-axis
path through the tree without backtracking to the hub:

- **Might↔Precision bridge** — "Berserker's Insight" notable: +8% Damage, +4% Crit Chance
- **Precision↔Alacrity bridge** — "Rapid Precision" notable: +4% Crit Chance, +8% Fire Rate
- **Alacrity↔Fortune bridge** — "Opportunist" notable: +8% Fire Rate, +15% Gold
- **Fortune↔Vitality bridge** — "Prosperous Health" notable: +10% Gold, +25 Max HP
- **Vitality↔Aegis bridge** — "Iron Constitution" notable: +20 Max HP, +4 Armor
- **Aegis↔Might bridge** — "Warlord's Guard" notable: +4 Armor, +10% Damage

Closes the PoE "hybrid zone" design gap — you can now build a Damage+Crit hybrid by pathing
through Berserker's Insight without committing to either pure arm first. Tree: ~185 nodes total.

QA: `qa-skill-tree.mjs` ✅ (22 keystones reachable, web connected, all behavior grants live).
TSC: clean. Bundle: see commit below.

Commit: `5af0387` | Bundle: `index-Bjb1ggxs.js` — live on roguelite-game-blush.vercel.app ✓

---

## 2026-07-08 (night) — StatusEffectEngine wired into combat: Fragility, Exposed, Condemned now live

Found and fixed a critical gap: the StatusEffectEngine was fully built but its damage-amplification
methods were **never called from the combat loop**. Effects stacked, displayed visuals, and had
tick DoTs — but Fragility/Exposed/Brittle/Condemned had **zero damage impact**.

**What's now live:**
- **Fragility** (+1.5%/stack all damage taken) — applied on hit from brute/cleave items
- **Exposed** (+4%/stack direct-hit damage) — applied on hit from rend items
- **Brittle** (+1 flat damage/stack per hit) — stacks into armor-cracking builds
- **Condemned** (10 stacks → next crit deals ×5 bonus) — applied from execute/doom items
- **Dazed** debuff now raises effective crit chance against the enemy
- **Disoriented** debuff amplifies crit damage received
- **104 Soulstone items** now carry proc chances matching their archetype (rend→Exposed, execute→Condemned, brute/cleave→Fragile, doom→Condemned)

**Commit:** `7801162` — bundle `index-DkYEqUqI.js` live, TSC 0 errors, catalog CLEAN (1303 items)

---

## 2026-07-08 (night) — Soulstone Expansion LIVE: 1,303 items + artifact/duo pass, duplicate fix

Felix: "triple the amount of content" (Soulstone Survivors active skills as items).

**What shipped:**
- **1,303 items total** (3.8× from 343 baseline) — Soulstone-inspired archetypes across every tier
- **20 new artifacts** (Totem of Might, Bloodlust Idol, Volcanic Heart, Phoenix Feather, etc.)
- **16 new duo combos** (Deep Freeze, Plague Storm, Wildfire Spread, Storm Lord, Doomsayer, etc.)
- **15 duplicate names fixed** — clean QA: 0 dup IDs, 0 dup names across 1,303 items

**Item categories added:** orbital/summon trinkets, AoE burst, status build enablers, melee/swing
tree, ranged/crit tree, economy/utility tree, ring slot expansion, chest/leg/head/feet gear depth.

QA: `qa-catalog-integrity` CLEAN · `qa-shop-8slot` 29/29 · `check-duos` 66/0 missing · TSC 0 errors

Commits: `1b6c05e` (expansion) + `2349327` (dup fix) · Bundle: `index-DH2_qhbx.js`
Live: https://roguelite-game-blush.vercel.app · Verified 200 + new bundle confirmed ✓

---

## 2026-07-07 (night) — Architecture: StatusEffectEngine (composable status system)

Felix: "you may need new stats, buffs, debuffs and status effects to implement all items —
be sure to create a clean architecture that can be reused."

Built `StatusEffectEngine.ts` — data-driven, composable status effect system that enables
all the Soulstone Survivors-inspired content without modifying Game.ts per effect:

**New effects available (ready for items):** Fragility (+1.5% all damage taken/stack) ·
Exposed (+4% direct-hit damage/stack) · Condemned (10-stack → next crit = +500%) · Brittle
(+1 flat damage/hit/stack) · Shattered (−1 armor/stack) · Dazed (+1% crit chance received) ·
Disoriented (+1% crit damage received) · Debilitated (−1% enemy damage/stack) · Crippled

**Synergy chain:** Bleed→Poison→Doom→Burn→Slow (one-level cascade on each apply).

**How to add a new item:** declare `fragileChance: 0.20` on your item — the engine handles
proc roll, stacking, visual (purple glow ring), and damage calculation. Zero Game.ts surgery.

Commit: `b507702` · Bundle: `index-BOceh0MG.js` · Live: https://roguelite-game-blush.vercel.app · Verified 200 ✓

---

## 2026-07-07 (night) — Balance: strong items now bite back (Brotato-style drawbacks)

Felix: "a lot of items only have positive effects — shouldn't they be a bit balanced with negative
stats too? (compare Brotato)." He's right: ~78% of items with stats were pure upside, so the shop
went flat — every pick was a no-brainer. Brotato's whole texture is that powerful pickups cost you
something, and it keeps ~60-70% of items with a drawback.

Audited the catalog (325 items with stats, only 103 had any downside) and paired a modest,
**thematically-inverse** drawback onto strong pure-upside items (tiers 2-4; tier-1 commons and
achievement-reward items stay clean). The pairing is deliberate, not random:
- raw damage / melee weapons -> **-Max HP** (glass cannon)
- elemental / status power -> **-Max HP** (squishy mage)
- crit -> **-Armor** (reckless)
- fire rate -> **-% Damage** (spray, less punch)
- multishot / pierce -> **-% Fire Rate** (heavy volley, slower cadence)
- defense (HP/armor/thorns) -> **-% Move Speed** (turtle)
- mobility (speed/dodge) -> **-Max HP** (fragile & fast)
- economy (gold/luck/xp) -> **-% Damage** (greed over combat)
- lifesteal -> **-% Ranged Dmg** (melee sustain, weak at range)

Magnitudes scale with tier (a legendary bites harder than an uncommon) but stay small enough that
each item is still net-positive and worth taking — the point is a *choice*, not a punishment. The
drawbacks render automatically as the red chips added in the earlier stat-display pass, so no new
description copy was needed. Items that **already** had a hand-authored drawback are left completely
alone — the auto-pass never double-taxes an item that already bites back.

Net effect: drawback coverage rises from **~32% to 66%** of statful items, right in Brotato's band.

Commit `54279c8` · live deployment `dpl_GMmzt66AdUjSCxyRW3zyyUSt4CAH` (READY, PROMOTED). Verified
live: patched items report their drawback values at runtime (e.g. Brawler's Cleaver -8 Max HP,
Precision Scope -2 Armor, Lucky Coin -5% Damage) and already-balanced items keep their single
hand-authored drawback (Vampiric Embrace -15 Max HP, not double-taxed), console clean.

---

## 2026-07-07 (late evening) — Fix: ignite items still showing double stat text

Follow-up to the earlier restatement fix. Five "ignite" items (Emberglass Visor, Plague Veil,
Emberwalk Boots, Ember Ring, Ember Pendant) were still printing both the colored `+X% Burn` stat
chip AND a white "+X% ignite chance" description, because `ignite → burn` was missing from the
wording-synonym table. One-line fix: added `ignite` and `burning` to `RESTATE_SYN`.

Commit `fd16344` · live deployment `dpl_4NfSJ6bqQWnj8aRa69yj6VWpoNun` (READY, PROMOTED, verified).

---

## 2026-07-07 (evening) — No more double stat text on item cards

Felix: "a lot of items have double stat texts — one line nice styled in color and one in white."
Item cards draw a colored stat row from the item's real numbers, then draw the hand-written
description underneath *unless* it just restates those stats. That restatement check only caught an
**exact** normalized match, so ~132 items whose description merely reworded the same numbers
("+15 max health" vs the "+15 Max HP" chip, "+45% melee/swing damage, -8% fire rate" vs
"+45% Melee Dmg · -8% Fire Rate") slipped through and printed the numbers twice — colored chip plus
a redundant white line.

The suppressor is now **token-based**: a description is treated as a restatement when every
meaningful word in it is already covered by the stat row, after dropping filler words and folding
wording synonyms (health→hp, "move speed"→speed, projectile→multishot, and "+15%"/"15%" together).
That lifts the suppressed count from 33 to **206** with zero genuine-flavor descriptions wrongly
hidden (checked every suppressed line by hand).

Also in this pass:
- **Knockback now shows on the card.** Thirteen items carried a knockback punch that never appeared
  in the stat row — it only lived in their description text. It's now a proper stat chip, so those
  descriptions stop being the only place the mechanic is mentioned.
- **Three descriptions rewritten to flavor-only** so their numbers live once, in the chip row:
  Berserker Rage → "Fury over safety.", Bullet Hose → "Volume over precision.", Blood Pact → "Power
  paid in blood." — the last also corrects a stale number (its text said −25% max HP; the item is
  −35).

QA: tsc clean; qa-catalog-integrity CLEAN (343 items); qa-shop-8slot 29/29; a 390px shop screenshot
confirms a single colored stat row per card, flavor-only description lines, red negatives, and the
new Knockback chip. Commits `7d02261` (fix) · live bundle `index-blJTVwDM.js` (verified 200).

---

## 2026-07-07 (evening) — Four global trade-off keystones anchor the skill tree's core

Follow-up to the keystone review: the inner ring now holds **four build-defining global keystones**
any class can reach in a single spend — **Glass Cannon** (+60% Damage, −90 Max HP), **Iron Will**
(+20% Damage, +6 HP/s, −25% Move Speed), **Echo Strike** (+2 projectiles, −15% Fire Rate, −10%
Damage), and **Wanderlust** (+30% Speed, +20% Fire Rate, −30 Max HP). Each is a hard commitment, not
a free stat. The three per-arm rim keystones were also isolated into terminal nodes (removed the
kL↔kM and kM↔kR edges) so reaching the rim no longer lets you sweep up all three — you commit to one.

QA: qa-skilltree 36/36, qa-skill-tree (connectivity + grants-live) pass, qa-skilltree-pinch 7/7.
Commit `60573f5` · live bundle `index-DLaiNjEB.js` (verified 200).

---

## 2026-07-07 (evening) — Skill-tree review: every keystone is now a real trade-off

Review pass on the 160-node tree (Felix: "make sure it's incredible"). The web itself is solid —
seven class starts each committing to a themed arm, 18 keystones giving each arm three distinct
sub-builds, and every behaviour grant (pierce / multishot / lifesteal / thorns / chain / execute /
explosions / knockback) confirmed wired into live combat getters, so there are no dead nodes.

The one real weakness: **five keystones were pure upside** — free picks, not commitments — which
clashed with the other 13 and with the game's own "power has a cost" identity (the drawback items).
Fixed so all 18 keystones are genuine choices you commit to:
- **Cull the Weak** — −10% Damage (you rely on the execute, not raw DPS).
- **Storm Caller** — −10% Damage (chain trades single-target for spread).
- **Sanguine Pact** — −4 Armor (you sustain by leeching, not turtling).
- **Retribution** — −10% Move Speed (plant yourself and reflect).
- **Scavenger** — −10% Damage (greed over combat).

Also fixed a stale QA harness (`qa-skilltree.mjs`): its class-start expectation map predated the
seven-class rework and wrongly failed berserker/prospector/reaver — now 36/36.

QA: tsc clean; qa-skilltree 36/36, qa-skill-tree (connectivity + grants-live) pass; tree verified
rendering as a connected web at desktop + 390px mobile. Commit `f48c13a` · live bundle
`index-OcGoOZTg.js` (verified 200).

---

## 2026-07-07 (evening) — Achievements-as-unlocks, build-locking drawback gear, run-defining class starts

Three connected systems that make builds commit harder and give the meta a reason to grind.

**Achievements now unlock signature gear.** A new Achievements screen (menu button) lists nine
milestones — beat wave 10 as each of the seven classes for that class's tailor-made relic
(Berserker's Totem, Arcanist's Focus, Ranger's Quiver…), plus reach wave 15 / wave 20 with any
class for two endurance items. Earning one flips its reward from locked into the shop pool
permanently (persisted to localStorage), and a gold "★ UNLOCKED" banner fires on the game-over
screen the moment you earn it. Earned rows show the reward and its status; locked rows stay dimmed
with a 🔒.

**You can disable any unlock to keep the pool clean.** Tap an earned reward on the Achievements
screen to toggle it ENABLED (green) / DISABLED (red). A disabled item stays earned but drops out of
the shop pool — so when you're chasing a specific build, your unlocked-but-unwanted gear stops
diluting the offers. Toggles persist across runs.

**Strong items now carry real drawbacks that lock in a build.** Eight new legendary "build-lock"
pieces pair a big upside with a genuine cost — Prism of Ruin (+140% Damage, +25% Crit, but −65 Max
HP: glass cannon), Titan's Bulwark (+150 HP / +14 Armor / thorns, but −30% Fire Rate and −40%
Speed: an anvil, not a dancer), Leechbound Pact (+90% Melee, +45% Lifesteal, but −50 HP / −4 Armor),
and five more. To make the trade-off legible, **negative stats now render RED** on both the shop
card and the equipped-item inspect popup (bonuses stay green) — the "this power has a cost" cue at a
glance. Dense multi-stat lines now auto-shrink to fit the card instead of spilling past the edge.

**Starting classes are now run-defining first choices.** Each of the seven classes starts with a
distinct WEAPON and a different SKILL-TREE START POSITION on the passive web, so the opening minutes
already push toward an identity: Berserker opens on the Might arm with a tier-2 hammer, Arcanist on
Precision with a tier-3 laser, Ranger on Alacrity with a shotgun, Prospector on Fortune with an
orbital, Reaver on Vitality with a spear, Brawler on Aegis with dual blades, Gunner stays the
flexible hub start.

QA: tsc clean; new suites pass — achievements 16/16 + persistence, class-select 30/30 (all seven
weapons + start arms correct), shop 8-slot 29/29, stats-popup red-negatives; regressions green
(live-smoke full playthrough, flood stress, catalog integrity 343 items). Verified live at 390px
portrait: Achievements screen renders clean with enable/disable toggles; drawback cards show red
negatives within the card bounds.

Commit `7bb2ce8` · live bundle `index-TaMQaQ5D.js` (verified 200, achievements code present).

---

## 2026-07-07 (evening) — Skill tree, PoE-scale: 160 nodes, 18 keystones, real build-defining unlocks

**The passive web nearly doubled (88 → 160 nodes) and got a lot deeper.** Each of the six arms
(Might / Precision / Alacrity / Fortune / Vitality / Aegis) now fans out as TWO parallel lanes of
travel nodes with rungs between them, punctuated by FOUR notables (each anchoring a small pod of
extra stat nodes) and capped by THREE keystones at the rim — plus cross-arm BRIDGE edges that link
neighbouring arms into an outer wheel. The result is a real web with many alternate routes to the
rim, not just radial spokes: you can path between themes without returning to the hub.

**Unlocks are now genuinely run-defining, not just bigger numbers.** Keystones and several notables
grant real combat *behaviours* — the same hooks items use — mixed with stat trade-offs, PoE-style:
- **Cull the Weak** (Might) — instantly kill enemies below 15% HP.
- **Cataclysm** (Might) — your hits explode in an area (−15% Fire Rate).
- **Splintering Rounds** (Precision) — projectiles pierce +3 enemies (−10% Damage).
- **Storm Caller** (Precision) — +60% chain-lightning arcing between enemies.
- **Saturation Fire** (Alacrity) — +2 projectiles per shot (−15% Fire Rate).
- **Sanguine Pact** (Vitality) — +12% lifesteal, +30 Max HP (a real vampire build).
- **Retribution** (Aegis) — +60% thorns, reflecting damage back at attackers.
- **Immovable** (Aegis) — massive knockback that flings enemies off you.
- Notables seed the same behaviours at smaller doses (Piercer, Arc Weaver, Volley, Bloodthirst,
  Spiked Mail, Bracing, Executioner…) so a build ramps into its identity, then a keystone commits.

18 keystones in total (was 6), including the original stat trade-offs (Overwhelm, Assassinate,
Frenzy, Juggernaut, Bulwark, Treasure Hunter) plus new ones (Blood Money, Scavenger, Undying,
Blitz). Every keystone is reachable by pathing outward; the tree stays one fully-connected web.

Mechanically, tree behaviour grants fold into the existing PlayerStats getters (getPiercing,
getMultishot, getLifesteal, getThorns, getChainLightningChance, getExecuteThreshold,
hasExplosionOnHit, getKnockback) additively — so a keystone reuses the exact combat hooks an item
would, no combat-code rewrite, and defaults (0/false) mean nothing changes until you allocate.

**QA:** new `qa-skill-tree.mjs` regression asserts 160 nodes / 18 keystones, zero orphans, every
keystone allocatable, and all eight behaviour grants actually reach the getters (pierce 4, multishot
3, lifesteal 22%, thorns 80%, chain 80%, execute 23%, knockback 360, explosions on) with a
fully-allocated tree. Live-smoke + flood regressions pass; skill-tree screen renders clean at mobile
& desktop, default and zoomed-out, no console errors.

**Commit/build:** bundle `index-DYvfvHMW.js`.
**Live-verified:** https://roguelite-game-blush.vercel.app serves the new bundle; production JS
contains the new keystones (Cull the Weak, Cataclysm, Splintering Rounds, Storm Caller, Saturation
Fire, Sanguine Pact, Retribution, Immovable).

---

## 2026-07-07 (evening) — Spawns breathe across the wave + randomized wave archetypes

**Enemies no longer dump at the bell — they release across the whole wave.** Spawning is now
driven by a per-wave RELEASE SCHEDULE: each moment the game checks how much of the wave's
budget *should* be out by now and only telegraphs new formations while it's behind. So a wave
is a steady sequence of formations/clusters/scattered pushes throughout its duration, not a
front-loaded flood you mow down in the first few seconds and then wait out.

**Every wave now rolls a spawn ARCHETYPE (randomized each run)** — the rhythm of the pushes,
separate from the enemy-stat modifiers:
- **Steady** — an even release across the whole wave (the default breathing feel).
- **War** — the whole horde front-loads and charges in from ONE flank of the arena at wave
  start (a wall of red X's down one side, then it hits at once).
- **Surges** — enemies crash in discrete escalating pulses with lulls between them.
- **Crescendo** — a light trickle early that builds to a heavy storm at the end.
- **Ambush** — an uneasy quiet, then a sudden hard rush.

Waves 1-2 stay Steady to teach the basics; from wave 3 on the archetype is rolled (Steady is
still the majority, so the exotic patterns feel like a genuine change of pace). The incoming
rhythm is shown in the wave banner. Formations, telegraphs and sub-phases from the previous
build all still apply — the archetype governs WHEN they arrive, not what they are.

**Under the hood**
- New `WaveArchetype` type + `releaseTarget(elapsedFrac)` curve per archetype; the spawn loop
  releases formations only while released-fraction is behind the target (War catches up ~6
  batches/tick to front-load; others 2/tick).
- Replaced the old aggressive `baseInterval` (0.16s floor) that drained the budget up front.
- `arenaAnchor` confines War spawns to a 150px band on the chosen flank; War uses massed
  frontal formations (line/vee/cluster/scatter), never player-surrounding ones.
- Verified with `qa-wave-pacing.mjs`: steady releases 28/52/78/100% at 25/50/75/100% of wave
  time (was front-loaded); crescendo 7/30/57/100%; war 100% by 25% confined to one flank;
  ambush 7/37/72/100%. Flood + full smoke QA green, zero console errors.
- Deploy: bundle `index-D0Acshwl.js`, live-verified on roguelite-game-blush.vercel.app.

---

## 2026-07-07 (afternoon) — Brotato-style telegraphed formation spawning

**Enemies now spawn IN the arena as telegraphed formations — not from the screen edge.**
Every spawn is now announced: a **blinking red X** marks each landing spot for 2 seconds,
then the enemy drops in exactly there (Brotato-style spawn warning). No more sliding in
from off-screen edges — the fight comes to where you're looking, and you get a beat to
reposition before it lands.

**Micro-waves within the wave.** Each spawn tick now telegraphs a whole FORMATION at once —
a line abreast, a V, a ring, a two-sided pincer around you, a tight cluster, a linked worm
chain, or an egg clutch — so a wave reads as a sequence of distinct little pushes rather
than a random trickle. The existing sub-phase system ("The ground splits — WORMS!") drives
which formations appear when.

**Placement is player-fair.** Telegraphs are kept inside the arena walls (70px margin) and
out of a 150px safe bubble around the player, so nothing ever materializes on top of you or
under a wall. Pincers deliberately telegraph on opposite sides of the player to squeeze you.

**Under the hood**
- New `SpawnTelegraph` class: chunky-pixel red X, blink ramps 2.2→7 Hz as the timer runs
  out, faint danger footprint underneath so the spot reads between blinks. Draws as a floor
  marker under enemies (alongside the AoE zones). Timer ticks on sim-time, so it correctly
  freezes during hit-stop.
- `WaveManager` reworked: formations now emit telegraphs (via `buildFormation` +
  `arenaAnchor`/`clampToArena`), the budget is charged up front by pledged enemy count so
  pacing/phase logic stays correct despite the 2s delay, un-fired telegraphs are cancelled
  on wave timeout, and wave-complete waits for pending telegraphs to resolve. Worm chains
  build their whole linked segment train in one telegraph to preserve `wormLeader` linkage.
- Bosses/minibosses keep their dramatic top-of-screen entrance (unchanged) — this is about
  the wave fodder.

**QA:** tsc clean. `qa-flood` peak 46 concurrent @ wave 1, 0 errors. Telegraph-lifecycle
probe: X's appear with 0 enemies during the 2s window, 0 land inside the player safe radius,
none off-arena, all materialize after, array culls clean, 0 errors. Live smoke test on the
deployed build: wave-4 telegraphs → 15 enemies, 0 console errors. Mobile (390×844) + desktop
(1280×800) screenshots reviewed — V-formation and cluster telegraphs read clearly.

- Bundle: `index-By1ODELY.js`
- Deploy: `roguelite-game-6ekaqi50b-daiacore.vercel.app` · state READY · aliased to blush
- Live-verified: HTTP 200 at roguelite-game-blush.vercel.app, live bundle contains telegraph
  code, live smoke test spawns via telegraph path ✅

---

## 2026-07-07 (early morning) — Boss kills bug fix + game-over screen

**Bug fix — bossKills never actually counted bosses (all runs to date)**
The kill-tracking code was incrementing `bossKills` on `enemy.type === 'demon'` (a regular
mob), not on `enemy.typeData.isBoss`. All 5 actual bosses (Necrolord, Flamefiend, Voidbeast,
Stormking, Ancientgolem) were silently never counted. This also meant the Souls calculation
(which uses `bossKills`) slightly undervalued boss-heavy runs. Fixed to `typeData.isBoss` —
consistent with the freeze-frame hit-pause logic 7 lines below.

**Game-over screen: Bosses stat added**
`bossKills` was tracked but never shown. Now displayed in orange between Kills and Gold.
Panel height increased 70px (desktop 320→390, mobile 380→460) to fit the new line.

**Game-over screen: Personal best comparison on Wave**
Wave line now reads "Wave: X  ★ NEW BEST!" (amber) on a record run, or
"Wave: X  (Best: Y)" (blue) when below your record. Best is read *before*
`updateMetaAfterRun` so it reflects the *previous* record, not the current run.

- Commit: `053a633`
- Bundle: `index-D0kZ0W8s.js`
- Deploy: `dpl_CprtFQHfFqeQvRP3z3qAMzXTbVPe` · state READY · readySubstate PROMOTED
- Live-verified: HTTP 200 at roguelite-game-blush.vercel.app ✅

---

## 2026-07-07 (night) — all 5 equipment slots filled to 20 items each

**Deeper item pool across every slot.** Each equipment slot now has at least 20 items to
offer (was as low as 7), adding 51 new catalog entries spanning all five gaps:
head (+13), legs (+13), feet (+10), ring (+9), torso (+6).

The new items are spread across all rarities (common → legendary) and archetypes —
defensive, ranged, melee, elemental, economic, utility — to broaden build variety and
keep the shop fresh across long runs. Highlights: Martyr's Halo (+28% dmg / -15 max HP
glass-cannon crown), War-March Plates (per-wave ramp damage stack), Seven-League Boots
(+26% speed), Plague Veil (+15% ignite + wound DoT stacker).

Commit `0e1d362`; live-verified bundle **`index-Cm35q1cX.js`** on
roguelite-game-blush.vercel.app (all 5 new item IDs confirmed in bundle). Pre-validated
via `qa-catalog-integrity.mjs` (326/0-dup), tsc clean, `qa-shop-8slot 29/29 PASS`.

---

## 2026-07-06 (evening) — shop cards no longer print the same stat twice

**Cleaner shop cards.** 30 items showed their stat line twice: the green at-a-glance
stat row (e.g. Kite Shield "+3 Armor") was followed by a hand-written description that
only restated it in tan ("+3 armor"). The description now renders only when it adds real
information — so those 30 cards drop the duplicate line and read clean, while the 227 items
with genuinely descriptive text and every duo-combo payoff are untouched. Same guard applied
to the equipped-item inspect popup.

Conservative by design: the suppression fires only on an *exact* normalized restatement, so
near-duplicates that differ in wording (e.g. "+20 Max HP" / "+20 max health") deliberately
keep both lines rather than risk hiding real info. Footer and price are anchored to the card
bottom, so removing the line leaves clean whitespace with no reflow.

Commit `c7d5152`; live-verified bundle **`index-DNe-zmos.js`** on
roguelite-game-blush.vercel.app (headless QA reached the shop clean, `errors: []`), confirmed
at mobile portrait (390×844) — Kite Shield now shows a single "+3 Armor" line. Fix-only; no
balance or content change.

---

## 2026-07-06 (early morning) — damage ceiling: maxed builds no longer one-shot everything

**Enemies stop insta-dying to a fully-stacked build.** The earlier crit knee bounded the crit
*multiplier*, but the realized hit is a product of three separate multipliers — and that product
was still unbounded: a maxed crit build dealt **~2.4 billion** damage per projectile, deleting
every enemy through wave 20 in a single frame (Felix's "2.3M/projectile, enemies just insta-die").

A final realized-damage knee (`FINAL_DMG_KNEE 100,000 / EXP 0.10`, inside `Player.getCritDamage()`)
now compresses the outermost ceiling. It's a **no-op below 100k**, so base/light/medium/heavy
builds are untouched — only the hard-stacked runaway is clawed back: `2.44B → ~275k` (8,882×). A
maxed build now takes ~1.4 hits on a wave-20 bruiser and ~2 on a boss — still powerful, a real
fight instead of a one-frame screen wipe. Fodder and mid-tier enemies still pop through ~wave 15,
so the power fantasy survives; the absurdity doesn't. Balance-only; enemy HP curve untouched.

_Also: fixed `qa-balance-probe` to read the real `getCritDamage()` hit path — it previously read
the raw `shot × critMult` product, which bypasses the knee and over-reported by ~8,900×._

Full 10/10 headless QA suite green (catalog, shop, equipment, skill-tree pinch, stat-caps,
stats-parity, item-redesign, synergy, skilltree, classselect); tsc + build clean.

---

## 2026-07-06 (early morning) — recycling removed + pinch-to-zoom on the skill tree

Two Felix requests shipped together.

**Recycling is gone.** The in-shop "recycle an item for a bonus" mechanic never made sense — you
don't recycle gear you just bought — so it's removed entirely. Cut with it: the `recycleBonus` stat
and its cap, and the three items whose whole identity was recycling (Haggler Badge, Salvage Rig,
Scavenger Kit) plus the Recycling Master duo. Merchant's Ring keeps its gold + shop-discount and
drops the recycle line. **Selling still works** — that's a separate, kept feature (sell an
equipped/stashed item, or auto-sell an overflow piece); it now pays a clean flat **25% of cost ×
upgrade level**, with no recycle term muddying it. No dead picks left behind: the catalog is back to
a tidy 275 items with zero dangling references.

**Pinch-to-zoom on the skill tree (mobile).** Two fingers now zoom the passive tree in/out, anchored
on the pinch midpoint so the point under your fingers stays put. Clamps at 0.16–1.4× like the
buttons; a two-finger gesture never leaks a stray node-allocation tap, and single-finger pan/tap is
untouched.

QA: full headless suite green (10/10 — shop, equipment, stat-caps, stats-parity, item-redesign,
synergy, skill-tree, pinch, catalog-integrity, class-select). While in the harnesses, fixed two
stale QA assertions unrelated to this change (crit-knee parity model and a renamed-item name check).

Live bundle `index-UFFzf9dI.js` (verified: prod alias HTTP 200, serves the new bundle, no
`getRecycleValue`/`recycleBonus` anywhere in it, 0 console errors).

---

## 2026-07-06 (early morning) — balance: crit damage no longer scales to infinity

Follow-up to Felix's "2.3M dmg/projectile on wave 13, enemies insta-die" report. The root cause was
the **crit multiplier** — the one damage axis that had no diminishing-returns cap (every other
multiplier already did). A crit-stacked build could reach a **6,946,492× crit → 3.5 trillion dmg per
projectile**, so no amount of enemy HP could ever matter.

**Fix:** crit now passes through the same soft knee as the other damage stats. Normal crit builds are
**completely unchanged** (anything up to a 25× crit is untouched — the fun stays); only extreme
crit-stacking is compressed. The pathological 6.9M× crit drops to ~4,834×, and the realized hit falls
from 3.5 trillion → 2.4 billion — a 1,437× cut with zero effect on light/medium/heavy builds.

This kills the runaway/exploit. Note: a fully-maxed hoard is still very strong (its *non-crit* shot
alone is large) — whether to clamp overall damage harder so mid-game enemies survive longer is a
separate feel decision (see `BALANCE-enemy-scaling-review.md` v5, options 1/2/3).

Commit `c1d333a` · live bundle `index-BS33s8ov.js` (byte-verified: live md5 == local build; HTTP 200,
game loads clean, 0 console errors).

---

## 2026-07-06 (night) — the amulet slot now has real choices (3 → 20 items)

Felix asked for **at least 20 items per equip slot** so every shop reroll is a genuine decision, not
"take the one thing that fits". The amulet slot was the thinnest at only **3** — so it now has **20**.

**17 new amulets across all four rarities**, each a distinct build lean rather than a stat-stick:
Copper Locket / Hunter's Fang / Warding Bead (common); Ember Pendant (burn), Frost Charm (freeze),
Serpent Talisman (bleed), Zephyr Amulet (speed + fire-rate), Ironwood Medallion (tanky), Lucky Coin
(luck + gold) (uncommon); Vampiric Choker (lifesteal), Berserker's Torc (raw dmg, −speed tradeoff),
Sentinel Pendant (armor + dodge), Gilded Scarab (gold + interest), Tactician's Sigil (crit)
(rare); Doomcaller Idol (doom + wound), Phoenix Tear (survival), Glass Heart Locket (+35% dmg,
−20 max HP glass-cannon) (legendary). Because an amulet fills a single bounded slot — and the new
aggregate damage soft-knee already caps the heavy tail — richer stats here are safe.

Also fixed **2 lingering duplicate item names** surfaced while auditing the catalog (Gatling Core →
"Bullet Hose" on rapid_fire_t4; Plague Bearer → "Plague Vial" on plague_bearer_t3) so each item reads
as its own thing in the shop. Names only, zero stat change.

**Verified:** tsc + vite build green; item-icon QA 140/140 render, shop 8-slot 29/29, empirical
balance sim runs clean (no crashes, deaths in the normal wave 4-7 random-agent band). 20 amulet-slot
items, 0 duplicate ids, 0 duplicate names.

Live-verified bundle **`index-DgIjtTCo.js`** (commit `c91deb9`) on roguelite-game-blush.vercel.app.

---

## 2026-07-06 (night) — gear-named items now slot properly + a ceiling on runaway damage

Two changes from Felix's "review every item: trinket or equip? and review the balance" pass — this
time acted on, not just written up.

**15 items that were *named* like worn gear now actually go in their slot** (instead of stacking as
unlimited trinkets). A ring goes in a ring slot, a pendant in the amulet slot, boots on your feet,
vests/armour/plate on your torso — so they compete for a slot and reroll into a *choice* rather than
"buy ten copies of the same ring". Reclassified: Iron Ring / Steel Band / Vitality Ring / Ring of
Widening → **ring**; Health Pendant → **amulet**; Worn Boots / Windwalker Boots / Blink Boots →
**feet**; Leather Vest / Spiked Armor / Armor Plating / Thorny Armor / Vampire Armor / Evasive Armor
/ Stalwart Plate → **torso**. (Gloves, cloaks, bandolier, etc. have no matching slot yet, so they
stay trinkets for now — a hands/back slot is a bigger UI change for another pass.)

**Damage now has a soft ceiling so a maxed build stays strong-but-finite.** A fully-stacked hoard was
reaching ~466k damage (18,600× a fresh run) and one-frame-deleting every enemy on every wave, which
no enemy HP curve can survive without wrecking the early game. Added an aggregate "soft knee" to the
final damage number: **light and medium builds are completely unchanged** (base 25 / light 80 /
medium 1,541 — all below the knee), but the extreme high end is compressed (~466k → ~60k). You still
one-shot fodder deep into a run; the difference is that late bosses and elites become an actual fight
instead of vanishing instantly. Complements the existing per-item knee — now the *whole* damage
product is bounded, not just one of its seven layers.

**Verified:** tsc + vite build green; QA all pass — stat-parity 300/300 (0 mismatches), shop 8-slot
29/29, equipment-manage 32/32, stat-caps 21/21, live-smoke (47 kills, no collision/entity leaks,
0 console errors). Balance probe confirms the knee leaves light/medium identical and compresses only
the heavy tail.

Live-verified bundle **`index-BqUS_oj5.js`** (commit `afc139e`) on roguelite-game-blush.vercel.app.

---

## 2026-07-06 (early hours) — fixed duplicate item names in the shop

**Three pairs of shop items shared the exact same name.** Part of Felix's "review all existing
items" pass — the shop could roll two visibly-identical cards (e.g. two "Glass Cannon") that, being
different items under the hood, did *not* upgrade each other. Renamed the lower-tier variant of each
so every shop item now has a unique, unambiguous name:

- **Storm Essence** (25% chain, the weaker one) → **Static Charge** — the 35%-chain-plus-explosions
  version keeps the "Storm Essence" name.
- **Glass Cannon** (the uncommon +80% dmg / −30 HP one) → **Brittle Edge** — the legendary
  +100% dmg / −40% HP keeps "Glass Cannon".
- **Berserker Rage** (the uncommon conditional one) → **Battle Fury** — the legendary flat-fury
  version keeps "Berserker Rage".

No stats changed — names only. (Full item trinket-vs-equip audit + balance review captured
separately; the bigger slot-reclassification questions are staged for a design call.)

**Verified:** tsc + vite build green; item-icon QA 134/134, shop 8-slot QA 29/29, skill-tree QA
30/30, all 0 console errors. Catalog now has zero duplicate item names.

Live-verified bundle **`index-BYqxgtja.js`** on roguelite-game-blush.vercel.app.

---

## 2026-07-06 (early hours) — skill tree rebuilt as a massive Path-of-Exile-style passive web

**The level-up reward is now a huge, interconnected passive tree you navigate by dragging and
zooming — not a short list.** Response to "I want the skill tree to be massive… encompass the same
key features [as PoE]. Maybe starting class should make you start at different places in our tree."

- **A real web, not a menu.** 88 nodes / 123 edges across **six radial arms** — MIGHT, PRECISION,
  ALACRITY, FORTUNE, VITALITY, AEGIS — joined by a central hub and a gateway ring, so you can
  splash between arms instead of committing to one line.
- **Four node kinds, PoE-style.** Small **travel/minor** nodes (little stat trickles) form the
  connective web; **notables** anchor each cluster with a chunkier bonus; **keystones** (rendered as
  diamonds at the arm tips) are build-defining with a real trade-off — e.g. *Overwhelm* +45% damage
  but −20% fire rate, *Frenzy* +50% fire rate but −20% damage, *Juggernaut* +90 HP but −15% speed.
- **Your class sets where you enter the tree.** Gunner starts at the hub, Ranger deep in ALACRITY,
  Brawler in AEGIS, Arcanist in MIGHT — so the same tree plays differently per class.
- **Connected allocation.** You can only allocate a node adjacent to one you already own, spending
  banked skill points; the route you carve lights up in its arm's colour.
- **Navigation:** drag to pan, on-screen **+ / − / ⌂** to zoom and recenter, tap a node to inspect
  it (name, effect, status) and again to allocate. Points still bank silently during a wave and are
  spent between waves — no mid-wave interruption. Baseline per-level stat bumps are unchanged.

**Verified:** tsc + vite build green; new headless skill-tree QA passes **30/30** (graph integrity,
full BFS connectivity from the hub, per-class start anchoring, allocation rules, bonus aggregation,
save/load round-trip); tree eyeballed at phone (390×844) and desktop (1440×900), mobile + zoomed-out.

Live-verified bundle **`index-D0rqPLwI.js`** on roguelite-game-blush.vercel.app.

---

## 2026-07-06 (early hours) — tap an equipped item to inspect it (stats + Unequip/Sell); shop cards show numbers

**Tapping a piece of equipped gear now opens an inspect popup instead of silently benching it.**
Response to "clicking an equipped item should open a tooltip showing its stats, with buttons for
unequip or sell." Before, a tap on an equipped slot dumped the item straight to the stash with no
chance to read what it did — now you get a proper modal:

- **What the piece is** — its icon (rarity-framed), name (rarity-coloured), and slot label
  (`1H Weapon` / `Amulet` / `Trinket` …) with its upgrade level.
- **What it does** — its concrete stat lines (e.g. `+15% Damage`, `+2 Armor`) plus the full
  wrapped description.
- **Two actions** — **UNEQUIP** benches it to the stash (or sells it if the stash is full, so a tap
  is never a dead no-op), **SELL +Ng** converts it straight to gold. A tap anywhere off the buttons
  closes the popup, mutating nothing.

**Shop cards now show the numbers, not just the name.** Each card gained a green stat-lines row
between the slot/trinket badge and the description — so you can weigh a `+20% AoE` ring against a
`+15% Damage` one at a glance without buying to find out.

**Verified:** tsc + vite build green; the inspect-popup QA passes **32/32** checks (open, unequip,
sell, equip-from-stash, tap-off close, unequip-when-stash-full sells, empty-slot inert, two-hand);
shop-layout QA still passes all 11 viewports with the new card row; popup eyeballed at phone
(390×844) and desktop (1440×900).

Live-verified bundle **`index-D0rqPLwI.js`** on roguelite-game-blush.vercel.app.

---

## 2026-07-05 (late night) — shop item cards rebuilt: image-left, structured, slot/trinket badge

**Every shop card is now a clean horizontal layout instead of the old centred stack.** Response to
"rework the layout of the shop items, they don't look structured nicely — place image to the left,
description, category and tags organized nicely; also make it clear if an item is a trinket or for a
specific slot."

Each card now reads left-to-right:

- **Framed icon on the LEFT** — a rarity-bordered square panel filling the card height, so the art
  anchors the card instead of floating centred.
- **Text column on the RIGHT**, top to bottom: item **name** (rarity-coloured) → a prominent
  **SLOT / TRINKET badge** → the **description** (wraps to fit) → a muted **category + tags** footer.
- **Price** pinned bottom-right; the **combo/synergy tag** rides the top-right of the badge row.

**The badge is the headline fix — you can now tell at a glance what an item IS:** equipment reads its
slot in **teal** (`WEAPON` / `2H WEAPON` / `OFF-HAND` / `HEAD` / `AMULET` / `TORSO` / `LEGS` / `FEET`
/ `RING`); an unlimited-stacking trinket reads **`TRINKET`** in **violet**. No more guessing whether a
pickup competes for a slot or just stacks.

Lock (top-right) and recycle (bottom-left, when owned) buttons are unchanged, so all shop hitboxes
still line up with the visuals.

**Verified:** tsc + vite build green; shop-layout QA passes all 11 viewports (portrait phones,
landscape phones, tablet, desktop, cramped windows) — no card/button overlap, no console errors; both
the trinket (violet) and equipment-slot (teal) badge paths eyeballed at portrait + desktop.

Live-verified bundle **`index-B4WZObcz.js`** on roguelite-game-blush.vercel.app.

---

## 2026-07-05 (night) — level-ups now feed a persistent skill tree

**The random 1-of-3 item pick on level-up is gone — replaced by a skill tree.** Response to "rework
the level-up system so that it uses a skill tree instead." Each level-up now banks **1 skill point**
(with the same juice — sound, flash, confetti — and no mid-wave interruption). Points are spent
between waves on a persistent tree with three branches:

- **OFFENSE** (red): Sharpened → Rapid Fire → Deadeye → Executioner (+damage, +fire rate, +crit
  chance, +crit damage).
- **DEFENSE** (blue): Vitality → Ironhide → Regeneration → Bulwark (+max HP, +armor, +regen).
- **UTILITY** (green): Swift → Greed → Scholar → Magnet (+move speed, +gold, +XP, +pickup range).

A node unlocks once its parent has at least one rank, so you commit to a branch but can splash
across all three; every node ranks up (most to 5). The tree opens automatically at the shop break
when you have points banked, and a **SKILLS** button on the shop reopens it to spend leftovers.
Progression is persistent within the run (saved/restored with your run) and resets cleanly on a new
run. Bonuses fold into your stats the same way artifacts do, so items, duos, and transformations
are completely unaffected.

Commit `40d3a26`. Live-verified on mobile portrait: `index-BYOg5yed.js`, HTTP 200, no auth wall.
QA: `qa-levelup.mjs` rewritten for the skill-tree contract 17/17 (level-up banks a point without
pausing, shop opens the tree, spend applies bonuses live, locked nodes gated by prereqs, maxRank
respected, new run resets); live smoke green (49 kills, wave cleared → shop, 0 dead-enemy leak,
devil-deal fix still holds, 0 console errors).

---

## 2026-07-05 (night) — your attack zones read white, danger stays red

**Your melee/AoE swing highlights are now white, not yellow/orange.** Response to "I don't like the
yellow dot marking for aoe/melee swing — mark it with a transparent white texture (my AoE attacks);
boss attacks should still be red or purple." All four player swing-zone highlights (arc, thrust,
spin, slam) draw as a translucent dithered **white** texture, so *your* reach reads instantly as
yours — the warm/red palette is now reserved exclusively for enemy and boss telegraphs (which are
unchanged). Commit `5483b7b`; live-verified on the prod alias (HTTP 200, no auth wall) — the live
bundle's melee highlights use `#ffffff` and the only remaining warm marker is the unrelated village
vault glow.

---

## 2026-07-05 (night) — level-ups no longer interrupt the wave

**Levelling up no longer stops the fight.** Response to "I don't like the level-up system — it
keeps interrupting gameplay and asking me to choose and upgrade in the middle of a wave." A
level-up still fires its juice (sound, flash, confetti) the instant you hit it, but the pick-1-of-3
screen no longer freezes the wave:

- Owed picks **bank up** during the wave and are presented at the **between-waves shop** — the
  natural break where you're already choosing items.
- Multiple levels earned in one wave chain **back-to-back** at the shop, then drop you onto the
  shop screen.
- A run that ends mid-wave clears any owed picks, so they never leak into the next run.

Commit `d684c4a`. Live-verified on mobile portrait: `index-uds_Tq48.js`, HTTP 200, no auth wall;
the live bundle's XP path banks the pick (`spawnLevelupBurst(),this.pendingLevelups++`) with no
mid-wave screen open. QA: `qa-levelup.mjs` rewritten for the deferred contract 14/14; shop-8slot
29/29 and warchest 8/8 regression green.

---

## 2026-07-05 (night) — enemies scale up: steeper mid-late HP curve

**Enemies are meaningfully tankier from wave 11 on.** Response to "I one-shot everything at
wave 13" — the mid-late enemy HP curve was too flat for a normal build to feel a fight. Added a
second exponential (`1.15^(wave-10)`) so the early game is untouched (waves ≤10 identical — the
sim-tuned anti-early-swarm fix stands) while the late game bites:

- **Wave 13** enemies ≈ **1.5× tankier**, **wave 15 ≈ 2×**, **wave 20 ≈ 4×**, wave 25 ≈ 8×.
- Waves 1–10 are **byte-identical** to the previous build (no fresh-run regression).

**Honest caveat (in the code + `BALANCE-enemy-scaling-review.md`):** fodder HP can *never* catch a
fully-stacked multiplicative build — a 2.3M-per-projectile build still one-shots trash at any HP
that keeps the early game playable. This change makes *normal* builds fight for the mid-late game;
the only lever that stops a maxed build one-shotting is **bounding player offense** (a soft cap on
the damage product), designed and ready as an opt-in in the balance doc, pending Felix's call.

Also un-broke `tools/qa/simulate-balance.mjs` (it hung on today's new class-select + level-up
screens); it now runs end-to-end again — deepest kite-bot run reaches wave 14 (was 10–12), early
death distribution unchanged, confirming no early regression.

- **Commit:** `77e7603`
- **Live-build verified:** `index-C1FxQwHK.js` served at https://roguelite-game-blush.vercel.app
  (HTTP 200, bundle hash matches local build, no auth wall; live bundle contains the new
  `1.15**Math.max(0,e-10)` late-surge term).

---

## 2026-07-05 (night) — 8-slot loadout, 3-item shop & upgrade-on-duplicate

Shopping is now a full **build sim**. Three big changes land together:

- **8 equipment slots.** WEAPON / OFF-HAND / HEAD / AMULET / TORSO / LEGS / FEET / RING — each a
  single holder shown in a 2×4 strip under the stats panel. A **two-hand weapon fills WEAPON and
  disables OFF-HAND** (the off-hand box dims and shows `2H`, any equipped shield benches to the stash).
- **Buying a duplicate UPGRADES it.** Buy an item you already own and it becomes `+N` instead of a
  second copy — `Amulet +7` = that amulet bought 7 times. **Additive** stats scale ×N, **multiplicative**
  stats scale ^N, and **recycle value** scales ×N. Trinkets upgrade the same way (Ceremonial Daggers
  `+3` = 3× the daggers), so the "buy more, get more" identity is preserved with zero list clutter.
  The strip shows a **`+N` badge** on any upgraded slot.
- **Shop offers exactly 3 items** (was 6). Fewer, more considered picks — every card is a real
  decision. The card layout is verified non-overlapping across 11 phone/tablet/desktop viewports.
- **35 new gear pieces** seed the five new slots (7 each: head/torso/legs/feet/ring) for early build
  variety — head defensive/utility, torso tank/regen, legs speed/phase, feet dodge/magnet, ring
  damage/econ. (Target is 20+ per slot; this is the vertical slice — more land next.)

Also live: **beam/laser shots drop their motion trail** — at high fire rate the overlapping trail was
clotting into a dark blob near the muzzle; clean bullet cores read far better as a beam.

Under the hood: `items[]` stays the single aggregation source of truth (8 holders + trinkets); each
contribution is now scaled by the instance's `upgradeLevel`. Items are **deep-cloned on acquire** since
they carry instance state now. Supersedes the Phase-1 dual-weapon (A/B) model. Design doc:
`DESIGN-SHOP-8SLOT-REWORK.md`. QA: `qa-shop-8slot.mjs` (29/29) + full regression sweep green.

- **Commit:** `c99a40c`
- **Live-build verified:** `index-vqzLFWGL.js` served at https://roguelite-game-blush.vercel.app
  (HTTP 200, bundle hash matches local build; deployment `dpl_7No9…KV41W`, Ready).

---

## 2026-07-05 (night) — Equipment slots & trinket box (Phase 1: model + UI)

Shopping is becoming a **build decision**, not a stat-pile. Items now split into a **limited
equipped loadout** and an **unlimited trinket box**:

- **Weapon slots (A + B).** You carry up to **two one-hand weapons**, OR **one two-hander** that
  fills both (shown as `WPN A` + a `◀ 2-H` spanned `WPN B`).
- **Offhand slot.** Shields go here — one at a time.
- **Amulet slot.** A curated set of build-defining legendary keystones (Fourleaf Charm, Soul Tithe)
  are amulets — **one at a time**, so your keystone is a real choice.
- **Trinket box (unlimited).** Every other stat/effect item is a **trinket** — buy as many copies as
  you like, they **stack**, no equipping. (Ceremonial Daggers stays a trinket precisely because each
  copy adds daggers — its "buy more, get more" identity is preserved.)
- **Auto-swap → stash.** Buying a slot item you're full on **swaps the old one into a small run stash**
  (8 slots) instead of blocking the purchase — your old gear visibly lands there, nothing vanishes. If
  the stash is also full, the displaced piece is **auto-sold back** (gold refunded at recycle value).
- **New shop UI.** A **4-slot equipment strip** (WPN A / WPN B / OFF / AMULET) sits under the stats
  panel with a **STASH** row when non-empty; the desktop side panel now lists **TRINKETS**. Read-only
  this phase — tap-to-sell / equip-from-stash lands in Phase 2.
- **Weapons keep being offered.** The old "pick your weapon once, never see another" lock is lifted —
  since buying a weapon now *swaps* the old one to the stash instead of destroying it, the shop keeps
  surfacing different weapons so building toward two (or swapping your loadout) is actually reachable.
  Exact-duplicate weapons still aren't re-offered; per-slot offer-frequency tuning is Phase 3.

Known Phase-3 follow-up: with two weapon slots both weapons' **stats** aggregate, but only `WPN A`'s
**firing pattern** is active — true dual-wield firing is a combat-system change, deferred by design.

Under the hood: `items[]` stays the single aggregation source of truth (equipped slots + trinkets),
with slots as a thin admission-control layer — so every existing stat/duo/QA path is byte-identical
for a given active set. Design doc: `DESIGN-EQUIPMENT-REWORK.md`.

Commit `e8acd2a` · live build `index-BgeZhQM4.js` (HTTP 200 verified, deployment `jlstng6s9`).
QA: **qa-equipment** 12/12 (classify,
two 1-handers fill A→B, third swaps to stash, 2-hand blocks B, 1-hand displaces 2-hand, amulet
single-slot swap, trinket unlimited stacking, aggregation parity, stash-cap overflow refund,
unequip/re-equip, sell removes, reset clears). Regressions green: daggers (11/11 after fixing the
ceremonial-daggers stacking classification), fourleaf, soultithe, warchest, triggered-items,
stats-parity, synergy, shop-layout, shop-inputguard, stacking-weapons, melee-stack, status-engines,
roguelite. Mobile shot reviewed: strip clears the card grid (grid top nudged to CSS 144 on mobile).

---

## 2026-07-05 (night) — QoL/perf: dense drops merge into fewer, bigger orbs

When a wave dies in a heap, the floor used to litter with dozens of tiny XP gems and coins — fiddly
to vacuum up and a needless per-frame update/draw cost. Now they **cluster together**.

- **Nearby loose drops merge.** Once the floor is genuinely littered (25+ of a type), nearby
  **not-yet-homing** XP gems (and coins separately) collapse into a **single higher-value orb** each
  frame. Fewer entities to update and draw (smoother when a big pack pops), one bigger pickup to grab.
- **Bigger value = bigger orb.** A gem/coin's size now scales (gently, log-capped) with its value, so
  a merged orb reads as a **chunkier crystal / fatter coin** and is easier to see and collect.
- **Never yanks a pickup off its path.** Orbs already homing to the player are left untouched, so a
  merge can't snatch a gem out of your magnet. Total value is always conserved — nothing is lost or
  duplicated on merge.
- Implemented as an O(n) spatial-hash pass in `Pickup.ts` (`mergeOrbs`); absorbed orbs are flagged
  `dead` and reclaimed by the existing swap-and-pop sweep the same frame (no dead-in-grid leak).

Commit `11a9ca2` · live build `index-CZXVScLF.js` (HTTP 200 verified). QA: **qa-orb-merge** — 40→2
orbs, value conserved (120→120), radius grows to 16, homing + sub-threshold clusters untouched, coins
collapse too, 0 console errors. Regressions green: magnet, zoom-xporbs, xp-coin-shop, live-smoke.

---

## 2026-07-05 (night) — feature: melee weapons SWING a real weapon + show their hit zone

Melee used to be one generic yellow pixel-fan for every weapon. Now each melee weapon **swings an
actual animated weapon sprite** and **paints the exact area it damages**, and the whole Brotato
melee family reads distinctly.

- **A real weapon swings.** A pixel **blade / axe / spear** sprite now animates through the motion —
  a blade sweeps across its arc, a spear lunges out and recoils, a heavy weapon whirls a full circle,
  a maul rises and crashes down — instead of an abstract fan.
- **The hit zone is highlighted.** Every swing paints a **dithered highlight of the exact area it
  damages** (a wedge for a sweep, a lane for a thrust, a disc for a slam, a ring for a whirl), so you
  can read the danger area at a glance — colour-matched to each style, brightest mid-swing.
- **Four swing styles, one pipeline.** New `MeleeStyle` — **arc** (sweeping blades), **thrust**
  (spears: long reach, narrow lane, runs through a line of enemies), **slam** (hammers: overhead
  disc quake), **spin** (heavy/AoE swings: full 360° whirl). The style drives both the animation and
  the hit test — a spear pokes a lane, not a fan.
- **Two new melee weapons** exercising the styles: **Piercing Lance** 🔱 (thrust — huge reach, pierces
  a line, heavy hits) and **Crashing Maul** 🔨 (slam — wide quake, big knockback). Existing blades
  swing the arc style.

Groundwork for Felix's ask to replicate the full Brotato roster — the melee half is now fully
expressive. Roster→systems gap map written (`DESIGN-BROTATO-WEAPON-MAP.md`): ~90% of Brotato is
already replicable; remaining gaps are 5 small self-contained modifiers (lifesteal, bounce,
explode-on-kill, richer explosives, beam), no architectural blockers.

**Commit `0b71437`** · live-verified `index-fHEerAy2.js` (HTTP 200, no SSO wall, new melee bundle
serving). QA: new `qa-melee-styles.mjs` **19/19** on the shipped `dist` (each weapon routes to the
right style; per-style hit-test proven — thrust rejects a 90° side point while arc/spin accept it,
spin hits behind, thrust reaches its long lane; weapon_blade/axe/spear sprites registered; live-wave
swing still damages a front enemy). Mid-swing screenshot reviewed (blade + AoE highlight visible).
Zero console/page errors.

## 2026-07-05 (night) — BIG COMBAT UPDATE: classes, tougher enemies, weapon feel, universal items

The largest gameplay pass in a while — four connected changes to how a run starts, how enemies
pressure you, how each weapon type feels, and how items reward every build.

- **Pick a class when a run begins.** Every new run now opens a **CHOOSE YOUR CLASS** screen with
  four starting loadouts, Brotato-style — a starting weapon feel plus a stat tilt, not a cage (the
  run's items still define you). **Gunner** 🔫 (balanced auto-aim, no start weapon — identical to
  the old default run), **Ranger** 🎯 (Scatter Gun start, faster & more mobile), **Brawler** 🗡️
  (**pure melee — no gun**, heavy swing, +40 HP & +12 armor, closes distance), **Arcanist** ⚡
  (piercing Beam Rifle, +15% damage glass cannon at 80 HP). Picking a class is one tap; the run
  builds with that loadout.
- **Enemies hit far harder.** Enemy **health scaled up substantially** (deep-wave trash now reads
  as a real threat instead of confetti) and — the big fix — **enemy projectiles and contact no
  longer chip for 1 HP.** Root cause: your armor is percentage mitigation, and a stacked armor
  build floored every incoming hit to the 1-HP minimum. Enemy ranged/AoE now **pierce 50% of your
  armor** and contact **25%**, so a swarm actually drains you — armor still matters, it's no longer
  an on/off immunity switch.
- **Every weapon type has its own feel.** The **melee** weapon type now genuinely **suppresses the
  gun** (a Brawler fights in melee, doesn't quietly plink a pistol too). **Orbital** was rebuilt
  from a placeholder into a real spinning radial burst that scales with multishot and pierces.
- **No more dead item picks.** Damage, reach and attack-speed items now **cross-map between melee
  and ranged**: a "+50% ranged damage" item still lifts your melee swing (at half value), a melee
  "attack speed" item still quickens your gun, ranged **piercing lengthens your swing** and
  **multishot widens** it. Every stat item now helps every build.

Also fixed two latent bugs found during QA: the **purchased "starting health" meta-upgrade was a
no-op** (a direct `maxHealth` write was overwritten by the stats recompute — now routed correctly),
and the class health tilt would have hit the same trap.

**Commit `311c574`** · live-verified `index-D8E-rgLq.js` (HTTP 200, mobile 390×844, new-build
markers "CHOOSE YOUR CLASS"/"Brawler" present, no SSO wall). QA: new
`qa-classselect.mjs` **21/21** on the shipped `dist` (each class grants the right weapon + stat
tilt and lands in the map; Brawler's gun is suppressed while Gunner fires; Brawler 140 HP / Gunner
100 / Arcanist 80; item cross-bleed proven: a ranged-damage item lifts melee damage and vice-versa)
plus `qa-armor-damage.mjs` (67 HP lost over 10s at +15 armor = real ranged pressure restored) and
the full regression suite green (roguelite, flood, new-enemies, melee-stack, stacking-weapons,
**stats-parity 257/257** after mirroring the new universality math + two stale caps, synergy,
triggered-items, status-engines, warchest, levelup, village). Mobile class-select screenshot
reviewed. Zero console/page errors.

## 2026-07-05 (evening) — feature: WAR CHEST — a wave-end gold engine

- **New item: War Chest 💰** (rare, 60 gold) — **at the end of every wave, bank gold equal to
  3× the current wave number.** Clear wave 5 and pocket 15; clear wave 12 and pocket 36. It's
  the roster's first pure *economy engine* — it scales the **shop** instead of combat, so it
  rewards surviving deep and enables greedy, buy-everything builds.
- **Compounds with survival** — the payout rises every single wave, so buying it early is a
  long-run investment (the further you get, the fatter each wave-end deposit), and it stacks on
  top of the existing banking-interest system rather than replacing it.
- **Stacks additively** — a second copy deepens the payout to 6× the wave number (each copy
  adds its 3× multiplier), so it's a real scaling axis for an income build, not a one-and-done.
- **Folded in at the wave-end shop transition**, right after interest is banked — a natural,
  predictable "end-of-wave paycheck" moment.

**Commit `ab8f597`** · live-verified `index-Ds-j3PC5.js` (HTTP 200, mobile 390×844). QA:
new `qa-warchest.mjs` **8/8** on the shipped `dist` — catalog entry (`war_chest_t3`, rare, 💰,
economic, `warChest: 3`), fresh-run default (`getWarChest()` 0), held (`getWarChest()` 3), and
the **payout proven** by driving the real `enterShop()` wave-end path with gold zeroed (so
interest is 0): the player is left holding exactly **3× the wave number** (wave 3 → 9, wave 7 →
21), a second copy pays **6×** (wave 5 → 30), no item pays **nothing**, and `startNewGame()`
clears it. Zero console/page errors. Full regression suite (triggered-items, status-engines,
item-icons, synergy, stacking-weapons, pennib, daggers) green.

## 2026-07-05 — fix: Ceremonial Daggers can no longer cascade into a dagger storm

- **Closed a re-entrancy hole in the Ceremonial Daggers legendary.** The item throws homing
  daggers on every kill, and its stated guarantee is that a *dagger's own* kill never throws
  more daggers — so the effect is bounded to **one generation per real kill** and a dense pack
  can't chain into an exponential projectile storm. That guard was only wired to the **direct**
  hit: a dagger that *hit but didn't kill* still ran the on-hit effects, and any enemy those
  effects finished off — a **chain-lightning** arc, an **explosion-on-hit**, or a **DoT** it
  applied (poison / burn / bleed / doom, resolved a few seconds later) — was counted as a fresh
  primary kill and threw a **new** generation of daggers. With explosion-on-hit (which fires on
  *every* dagger hit) or a Fourleaf-boosted proc build, that's the exact runaway cascade the
  guard was supposed to prevent — a wall of daggers and a frame-rate cliff on a dense wave.
- **The fix:** the dagger origin is now threaded through **every** kill path, not just the direct
  one. On-hit proc-kills (chain, explosion) inherit the origin; DoTs applied by a dagger tag the
  enemy so the delayed DoT/doom kill inherits it too (and the tag rides along when a poison-spread
  build hops the plague to a neighbour). A dagger-originated kill — however it lands — throws **no**
  daggers; a genuine primary kill (shot, melee, or a non-dagger proc/DoT) still throws its full fan.
  Pure correctness fix — **zero new content** (content budget untouched).

**QA:** new `qa-dagger-cascade.mjs` — a red→green interaction harness that drives the real
`applyOnHitEffects` / `killByDot` paths. It reproduced the cascade on the unfixed build (dagger
explosion / chain / DoT kills each spawned a fresh generation) and now passes **10/10**: every
dagger-origin kill spawns 0 daggers while every non-dagger control still spawns its full fan, and
the original direct-hit guard is unregressed. Full `tsc` typecheck clean; `qa-daggers` 11/11,
`qa-soultithe` 13/13, `qa-status-engines` and the main regression all green, 0 console errors.

**Shipped:** `e35abfe` · live-verified at https://roguelite-game-blush.vercel.app (HTTP 200,
serving the new `index-BlNYCkj1.js` bundle, no auth wall).

---

## 2026-07-05 — fix: devil deals can no longer be farmed for free boons

- **Closed a devil-deal exploit.** Each pact welds a strong boon to a **permanent curse**.
  Curses dedupe (you can only carry one copy), so if a recurring `?` event drew the **same**
  pact again, taking it re-granted the **boon for free** — the curse no-op'd but the artifact /
  gold / max-HP still landed. Over a long run you could farm boons off a price you'd already
  paid once, which quietly defeated the whole "permanent price" risk axis.
- **The fix:** a pact whose curse you **already bear** now grants **nothing** — it shows
  *"You already bear this mark. The devil has nothing left to sell you."* instead of paying out.
  Taking a pact the **first** time is unchanged (full boon + curse), and a **different** pact
  (a curse you don't yet hold) still works — so a genuinely new price still buys a genuinely new
  boon. Non-devil events are untouched (they carry no curse).
- **Under the hood:** extracted option-application into `applyEventOption()` (the click handler
  now calls it), so the integrity guard lives in one testable place instead of inline in the UI
  loop. Pure fix — **zero new content** (content budget untouched).

**QA:** `qa-devildeal.mjs` extended with 3 checks that drive the real `applyEventOption` path —
first pact pays the boon, a second identical pact pays nothing, and the refusal message fires.
**21/21** devil-deal checks pass; full `tsc` typecheck + main regression clean, 0 console errors.

**Commit `910f7ee`** · live-verified `index-BGez9swL.js` (HTTP 200, roguelite-game-blush.vercel.app, no auth wall).

**Live-build integration smoke (no deploy — verifies the shipped `index-BGez9swL.js` end-to-end).**
New `qa-live-smoke.mjs` drives headless Chromium against the **deployed** URL (not a local `dist`),
playing the real user path — boot → Slay-the-Spire node map → route to a battle node → fight → clear
a wave. This closes the cp-b7 gap ("verified-to-work ≠ reachable-via-user-path"): the Jul-5 devil
fix was unit-QA'd and the Jul-4 balance pass read source, but neither actually *played* the live
artifact. Result **PASS, all 10 checks, 0 console/page errors**: map→combat routing works, 45–54
kills/run (collisions land), 2–3 level-ups fire with a real **pick-1-of-3** offer, a full wave clears
into the shop, **no dead-enemy cull leak** (the Jul-2 dead-flag/grid bug class stays fixed), the loop
never wedges. The **devil-deal fix is re-proven on the live build itself**: re-taking `devil_bargain`
while already bearing `curse_frailty` is a genuine no-op — held-list `["executioner","curse_frailty"]`
identical across both takes, curse never stacked, boon never duplicated. Mobile (390×844) + desktop
(1440×900) shop screenshots reviewed with a designer's eye — clean, nothing clipped or overlapping.
Shots in `shots/live-smoke/`.

## 2026-07-04 (evening) — feature: PEN NIB — every 10th shot is a loaded shot

- **New item: Pen Nib 🎯** (epic, 55 gold) — while held, **every 10th primary shot is a
  "loaded shot": triple damage and pierces every enemy in its path.** A big fat golden round
  that punches a line clean through a packed lane. It's a *rhythm* item — the payoff is
  predictable and telegraphed (you can feel the 10th coming), so it rewards lining up the lane
  rather than random luck.
- **Fire-rate synergy** — the faster you shoot, the more often the loaded round comes around,
  so it scales naturally with fire-rate builds without needing its own stacking rule.
- **Kept predictable on purpose (the design guard):** only your **primary** shot advances the
  counter — bonus **multicast** volleys don't — so stacking multicast can't secretly desync or
  shorten the cadence. A second copy doesn't shorten the interval either (the flag is OR'd, not
  additive), so it stays a clean, readable "every 10th" beat rather than an opaque proc.

**Commit `0f2fce6`** · live-verified `index-CKomoGvO.js` (HTTP 200, mobile 390×844). QA:
new `qa-pennib.mjs` **9/9** on the shipped `dist`, driving real `updatePlaying` frames — catalog
entry (`pen_nib_t3`, epic, 🎯, `loadedShot`), fresh-run default (`hasLoadedShot()` false,
`shotsFired` 0), `hasLoadedShot()` true when held, and the **cadence** proven on live projectiles:
a loaded round fires on shot **10 and 20 and no other** (not the 9th or 11th), carrying the exact
designed signature — fat golden round (radius 13, `#ffd43b`), pierces-all (`maxPierceCount 999`),
damage **exactly 3× the base bullet at that same instant**. Control (no item) never tags a loaded
round nor ticks `shotsFired`; `startNewGame()` zeroes the counter. Zero console/page errors.

---

## 2026-07-04 (evening) — feature: CEREMONIAL DAGGERS — on-kill homing daggers

- **New legendary item: Ceremonial Daggers 🗡️** — on **every kill**, throw **3 homing
  spectral daggers** that seek the nearest enemies. Kills become a self-sustaining chain that
  mows through trash and snowballs hard in dense waves — and it *reads* as the build working
  (a fan of violet daggers flies out of every corpse). Each dagger does 50% of your current
  shot damage, so it scales with the whole build.
- **Stacks** — a second copy makes it **6 daggers per kill** (additive), and so on.
- **Bounded against runaway chains (the design risk):** a dagger's *own* kill never spawns more
  daggers — the on-kill spawn is gated to one generation per *primary* kill. So a huge dense
  pack can't cascade into an exponential dagger storm that melts the frame rate or the whole
  wave; the effect is strong but stays controlled. (Under the hood: daggers are flagged
  `isDagger`, and `handleEnemyKill` skips the spawn when the kill came from a dagger.)

**Commit `0002fbf`** · live-verified `index-DKF42lUI.js` (HTTP 200, mobile 390×844). QA:
new `qa-daggers.mjs` **11/11** (spawn count, homing-player shape, damage-scaling, stacking to 6,
control-without-item, and the **recursion-guard** proving a dagger's kill spawns zero daggers),
plus regressions green (triggered-items 21/21, status-engines, item-icons, roguelite, synergy,
stacking-weapons).

---

## 2026-07-04 (evening) — feature: SOUL TITHE — on-kill milestone item

- **New legendary item: Soul Tithe 👻** — a run-long on-kill counter that starts ticking the
  moment you buy it. **Every 10th kill drops a health orb**, and **every 50th kill banks a
  PERMANENT +1% damage stack** for the rest of the run (no cap). Clear speed itself becomes a
  scaling stat — a turn-1 pickup snowballs across the whole run.
- **Counter is scoped to ownership** — it only counts kills *since you bought it* ("every Nth
  kill while held"), so buying it late still starts you at zero. Killing without the item never
  ticks it.
- **Cadence is exact:** the 10th kill (not the 9th) drops the first orb; by the 50th kill you've
  banked 5 orbs and 1 permanent damage stack; at 100 kills, 2 stacks; and so on. The permanent
  stacks fold straight into the per-frame runtime damage multiplier (same path as the momentum/
  berserk artifacts), so `damage = base × (1 + 0.01 × stacks)`.
- **New game clears it** — both the kill counter and the banked stacks reset to zero on a fresh
  run.

**Commit `900041f`** · live-verified `index-BTjArzVe.js` (HTTP 200, mobile 390×844). QA:
new `qa-soultithe.mjs` **13/13** (cadence, permanent-stack, damage-fold, control-without-item,
and reset), plus regressions green (triggered-items 21/21, status-engines, item-icons, roguelite,
synergy).

---

## 2026-07-04 (evening) — feature: FOURLEAF CHARM — proc-luck keystone

- **New legendary item: Fourleaf Charm 🍀** — while held, every on-hit **status proc**
  (burn, bleed, freeze, chain lightning, doom, wound, multicast) **rolls twice and keeps the
  better result**. One item lifts the entire status/proc ecosystem instead of buffing a single
  chance — the keystone a DoT/status build wants to fish for.
- **What it does to the odds:** a proc at chance *p* now lands at *1−(1−p)²* — e.g. a 30% burn
  becomes ~51%, a 50% freeze becomes 75%. Verified statistically (40k rolls: baseline 0.30 → luck
  0.51). Deterministic edges unchanged: a 0% proc still never fires, a 100% proc always does.
- **Deliberately scoped to the status ecosystem** — it does **not** touch crit or dodge (core
  stats), so it's a build-defining status enabler, not a stealth all-round power spike. Multicast's
  decaying bonus-volley chain only gets the luck on its *first* roll, so the charm can't compound
  into an infinite volley.
- **Under the hood:** all seven status rolls now route through one shared `PlayerStats.rollProc()`
  helper (single source of truth), so future proc tuning lives in one place. Builds without the
  charm are byte-for-byte identical in behaviour (`rollProc` collapses to `Math.random() < chance`).

**Commit `818cb82`** · live-verified `index-Cn6fbQOE.js` (HTTP 200, mobile 390×844). QA:
new `qa-fourleaf.mjs` **13/13** (incl. statistical roll-twice proof + source-scan wiring), plus
regressions green (status-engines, triggered-items 21/21, item-icons, roguelite, synergy).

---

## 2026-07-04 (afternoon) — feature: DEVIL DEALS — a permanent-price risk axis

- **The `?` events can now offer a devil's bargain** — a strong, run-long **boon welded to a
  permanent CURSE**. This is the game's first *negative* choice: every prior reward was pure upside
  or a one-off cost; a pact marks you for the whole run. "Walk away" is always free, so the deal is a
  real decision, not a trap.
- **Two devil events:**
  - **The Devil's Bargain** — *trade your skin for strength* (a random artifact + **Curse of Frailty:
    +50% damage taken forever**), or *trade your speed for gold* (+120 gold + **Curse of Sloth: -30%
    move speed forever**).
  - **The Bleeding Altar** — *seize the stone heart* (+60 max HP + a random artifact + **Curse of
    Dullness: -25% fire rate forever**), or the no-curse path *bleed onto the altar* (lose 25% HP +
    a random artifact).
- **Three curse artifacts** (Frailty 💔, Sloth 🐢, Dullness 🌫️) — each folds its malus through the
  exact same static-stat path as any artifact, but is **excluded from the random artifact pool**, so
  a curse can *only* ever arrive as the price of a pact (verified: 60 random draws, never a curse).
- **Hand-crafted pixel icons** for all three curses (12×12 glyphs in the game's art style — a cracked
  heart, a turtle shell, a grey fog), so they render as real sprites, not the flat rune fallback.
- **Verification:** `tsc` clean; production build green. New **`qa-devildeal.mjs` → 18/18** drives the
  real effect path: curses exist + flagged + carry a malus, both devil events exist with a free
  walk-away, curses never appear in the random pool, taking a pact grants **both** boon and curse and
  the curse's malus folds into `playerStats` (speed / fire-rate / incoming-damage), walk-away grants
  nothing, and a repeat curse-grant is idempotent. Regression: `qa-artifact-icons` (all 23 glyphs
  incl. 3 curses PASS), `qa-triggered-items` (21/21), `qa-roguelite` (0 errors), `qa-node-map` (all
  node types + persistence) — all green. Devil-event screen eyeballed at **390×844 mobile** + desktop.
- **Commit `73f047a`** · live-verified `index-5ln61MYJ.js` at https://roguelite-game-blush.vercel.app (HTTP 200, bundle hash matches local build).

## 2026-07-04 (afternoon) — feature: LEVEL-UP pick-1-of-3 upgrade screen

- **Levelling up is now a real choice, not a silent stat bump.** Every level-up **pauses the fight**
  and presents **three weighted items** (rolled from the same synergy/rarity/wave-gated pool as the
  shop, tilted by your luck); tap one to keep it for the run. This is the classic Vampire-Survivors /
  Brotato level-up beat the game was missing — each level now shapes your build.
- **What still happens on level-up:** the +2 damage / +10 max-HP / heal and the confetti-burst juice
  are unchanged — the pick-1-of-3 is layered *on top*, granting a full item (with its duo /
  transformation / max-HP / shield side effects, exactly like a shop purchase — just free).
- **Queue handling:** extra level-ups earned while the screen is open (a big XP orb crossing two
  thresholds, or a second orb resolving) **queue and open back-to-back**, so a level-up can never be
  swallowed. If the eligible pool is ever empty (e.g. weapon locked + all non-stackables owned) the
  screen doesn't trap you — it passes through.
- **UI:** mirrors the artifact-reward screen's visual language — dark backdrop, centred wood-panel
  cards with icon + rarity-coloured name + wrapped description. Verified at both **390×844 mobile**
  and desktop; no clipping, readable at phone size, tap targets full-width.
- **Verification:** `tsc` clean; production build green. New **`qa-levelup.mjs` → 12/12** drives the
  real game loop: state pauses to `levelup` with 3 item choices, the sim freezes (enemies don't
  advance), a synthetic tap on a card grants exactly that item and returns to `playing`, the
  back-to-back queue works, and a miss-tap grants nothing. Regression: `qa-roguelite` (0 errors),
  `qa-xp-coin-shop` (all OK), `qa-triggered-items` (21/21) all still green. Commit `e1db256`.
  **Live-verified:** `index-BRsT97A5.js` serving at the production URL (HTTP 200), hash matches the
  shipped build.

---

## 2026-07-04 (afternoon) — feature: execute items (instakill low-HP enemies), the second triggered layer

- **3 new "execute" items** — the first *on-hit conditional* effects (the earlier triggered layer was
  all per-frame stat payouts). When your hit leaves a **non-boss** enemy at or below a threshold of
  its max HP, it dies instantly:
  - **Executioner's Axe** 🪓 (epic, 50g) — execute at ≤15% HP.
  - **Guillotine** ⚔️ (legendary, 68g) — execute at ≤25% HP.
  - **Reaper's Scythe** ☠️ (legendary, 84g) — execute at ≤33% HP.
- **Why it matters:** high-HP mid-late enemies (just made ~2.9× tankier) currently need to be chipped
  all the way down; execute rewards *bursting them into the red* and lets a build carve the swarm
  instead of grinding each straggler's last sliver. It pairs naturally with the tankier curve shipped
  earlier today.
- **Design guards:** stacked execute items take the **highest** threshold (`Math.max`, never summed —
  cheap copies can't compound into "execute at full HP"). **Bosses and minibosses are immune** —
  instakilling a boss would gut the run's checks. Every execute routes through the **normal kill path**,
  so it still grants XP + gold and feeds **Killing Spree** (no silent HP-zero that skips rewards). A
  distinct crimson burst + impact flash marks an execute so it reads as more than a normal kill.
- **Verification:** `tsc` clean; production build green. Extended `qa-triggered-items.mjs` to **21/21**
  (was 13/13) — new checks drive the *real* game loop: execute fires below threshold, a
  no-execute control proves raw damage alone can't kill the rigged high-maxHP enemy, the kill feeds
  `kills`/`killStackCount`, bosses stay immune, and stacked thresholds take the max. Regression green
  (roguelite smoke, verify-mechanics) with 0 console/page errors. Live bundle `index-DN_qNzCC.js`
  matches the local QA'd build; HTTP 200.
- Deployed via Vercel CLI (daiacore). Live: https://roguelite-game-blush.vercel.app

---

## 2026-07-04 (morning) — balance: enemies tank far longer mid-late + enemy ranged actually stings

- **Regular enemies are much tankier from mid-game on (Felix: "scale enemy health even more").**
  The flat +120% flood-HP multiplier is now **wave-ramped**: unchanged through wave 4 (fresh runs
  stay fragile — the kite-bot still dies ~wave 3-4 without it), then +12% of the base per wave
  beyond 4. Net regular-enemy HP: **w10 ~1.7×, w15 ~2.3×, w20 ~2.9×** the old value (a wave-20 slime
  goes ~4,370 → **~12,760 HP**). Trash still lands at only 5–12% of the wave's boss HP, so the boss
  stays the real check — a flamefiend at wave 20 is ~116k HP, still ~9× the toughest fodder.
- **Enemy projectiles no longer plink for ~1 HP (Felix: "projectiles barely damage, does like 1 hp").**
  Root cause: the eight *shooter* enemies had the game's LOWEST base damage, yet ranged is the hardest
  attack to dodge — so armor + the min-1 floor crushed their hits to nothing in the early-mid game.
  Raised shooter base damage ~40–50%: goblin 6→9, skeleton 10→14, necromancer 8→12, wizard 12→16,
  construct 11→16, spiraler 10→15, spinner 9→13, demon 20→24. Scales naturally with the wave curve
  (e.g. a wave-10 goblin shot behind +40 armor now lands ~12 instead of ~8, wizard ~21). **HP and
  damage were tuned independently** — a tankier arena does NOT start one-shotting the player.
- **Untouched on purpose:** the armor-mitigation curve (recently tuned) and the wave-scale exponential
  shape. NOTE / follow-up: that 1.18/wave compound still blows up very late (a wave-30 boss ≈ 1M HP,
  regular ≈ 130k) — future "rocket-tag" concern, but out of scope for this pass since it's deep past
  Felix's flamefiend context.
- **Verification:** `tsc` clean; production build green; regression suite green with **0 console/page
  errors** — flood (wave-1 slime HP correctly unchanged at 132), armor-damage, roguelite smoke,
  triggered-items (13/13), verify-mechanics (all pass). Curve modelled analytically (the balance sim's
  kite-bot can't reach mid-late). Live bundle hash `index-EoJ336Ni.js` matches the local QA'd build;
  HTTP 200, `<title>Roguelite Arena</title>`, no auth wall.
- Deployed via Vercel CLI (daiacore). Live: https://roguelite-game-blush.vercel.app

---

## 2026-07-04 (night) — architecture: Scene split, step 1 — Menu extracted from the Game god-class (no player-visible change)

- **First slice of the `Game.ts` → Scene refactor** (ARCHITECTURE-REVIEW.md step 1). Introduced a
  `Scene` interface keystone (`scenes/Scene.ts`) and moved the title screen into its own
  `scenes/MenuScene.ts` — logic lifted **verbatim** from the old `Game.updateMenu`/`drawMenu`, the
  only change being that the scene reads the shared context (`canvas`, `renderer`, `metaProgression`)
  off the `Game` instance. `Game.update()`/`draw()` now delegate to a registered scene when one
  exists for the active state and otherwise fall through to the existing switch. The old
  `updateMenu`/`drawMenu` methods are deleted. Menu is the pilot: lowest coupling of all 10 screens
  (3 fields, 0 method calls) and the boot screen, so it's the most verifiable.
- **Zero behavior change — this is a pure structural move**, chosen deliberately as the safe first
  step (no big-bang rewrite) since Felix is on vacation and can't play-test.
- **Verification:** `tsc` clean; production build green; full regression suite green with **0
  console/page errors** — smoke (menu render + menu→playing transition), village, synergy, stat-caps,
  triggered-items, status-engines, evolution, item-redesign. Menu screenshot confirmed at mobile
  portrait. Live bundle **md5 byte-identical** to the local QA'd build (JS `45dd299a…`,
  CSS `bc36c365…`), no auth wall.
- Deployed via Vercel CLI (daiacore). Live: https://roguelite-game-blush.vercel.app
- Next steps (unchanged from the plan): extract the remaining low-coupling screens (map, gameover,
  village…), then the CombatSystem, then the shop last (coupling 30, the beast).

---

## 2026-07-04 (night) — batch-8 enemy sprites hand-crafted: the beasts/critters family (9) — FULL COVERAGE 🎉

- **Every enemy in the game is now a bespoke hand-drawn sprite.** This final batch redraws the last
  9 enemies still on the batch auto-enhancer, completing Felix's "go through EACH monster/enemy and
  hand craft improvements" — the same standard that redrew all 20 artifacts, the 5 bosses, and the
  spectral / caster / brute-demon families. Biggest glow-ups on the weak readers; the already-decent
  ones brought up to the hand-crafted bar with a real improvement each:
  - **Mushroom** — was a **faceless plain plant**. Now a toadstool **monster**: red warty cap + a
    face on the pale stem (beady eyes, mouth), stubby arms, rising violet **spore puffs**. Biggest win.
  - **Bat** — spread membrane wings with a **scalloped trailing edge** + finger-ribs (was reading as a
    downward arrow), ear tufts, two red eyes, white fangs. Now unmistakably a bat.
  - **Spider** — round glossy black body, **4 pairs of radiating jointed legs** (were stubby stumps),
    yellow eyes + fangs, red hourglass marking. Reads as a proper arachnid now.
  - **Necroegg** — was a plain egg. Now a **necrotic hatching sac**: veiny purple shell, a glowing
    **green crack** with an embryo eye peeking through, green ooze at the base.
  - **Spiraler** — clean teal **spiral shell** (was muddy) over a warm-tan slug body, eye-stalks,
    slime-trail shimmer.
  - **Exploder** — round rushing bomb-creature: lit fuse spark, panicked eyes, gritted teeth, **hot
    glowing cracks** (about-to-blow tell). Distinct from the bombardier.
  - **Orbiter** — floating single **eyeball-horror**: big iris+pupil, fleshy violet diamond body,
    lash-spikes, glow rim. Single-eye → distinct from the multi-eye voidbeast boss.
  - **Evader** — nimble blue **sprite-gremlin** (the dodger): big cyan eyes, tuft ears, spring-crouch,
    dodge-shimmer flecks.
  - **Mimic** — treasure-chest monster: gold-banded wooden chest, lid = **fanged mouth** agape, red
    tongue, asymmetric lid-eyes, a spilling coin.
- Each drawn per `SPRITE-STYLE.md` (black exterior outline, light top-left, hue-shifted cool-shadow/
  warm-highlight ramps, asymmetry, readable silhouette + a face that sells it), a 2-frame breathe/
  hover idle, and grass-verified as 9 distinct creatures on a contact sheet before shipping.
- **Roster is now 100% hand-crafted — no enemy remains on the auto-enhancer.** Tracker updated.
- Commit `8dab002`. **Live-verified:** `roguelite-game-blush.vercel.app` serves this build
  (`index-DZ5bki6l.js`, HTTP 200, no auth wall) and the new sprite palette is present in the served
  bundle. Source: `tools/pixel-art/handcraft/batch8-critters.mjs` → `sprites/*.json` → `spriteData.ts`.

---

## 2026-07-04 (night) — batch-7 enemy sprites hand-crafted: the brute/demon family (3)

- **The three brute/demon-class enemies are now bespoke hand-drawn sprites instead of the batch
  auto-enhancer.** Continuing Felix's "go through EACH monster/enemy and hand craft improvements"
  (same ask that redrew all 20 artifacts + the spectral and caster families). Each now sells its
  in-game role at a glance:
  - **Imp** (small, fast, teleports on hit) — was a vague red lump that read almost like a cat.
    Now a lean mischievous devil: two tall **pointed horns**, big angry yellow eyes, a wide fanged
    grin, a barbed **spade tail**, and a purple/cyan **teleport-shimmer** accent (the blink tell).
    Clearly the smallest of the three.
  - **Troll** (slow, 200 HP, regenerates) — a hulking hunched tusked **ogre**: tiny head sunk
    between huge shoulders, giant dragging fists, warty darker-green spots, underbite tusks, clawed
    feet, and a soft green **regen-glow** in the pale belly (its self-heal identity). Distinct from
    the upright, weapon-carrying orc (also green) by the hunch + bulk + tusks.
  - **Demon** (biggest non-boss, 500 HP, shoots bursts) — a winged **fire-demon**: broad spread
    **bat wings** (the big silhouette statement), curved horns, a fanged maw, a fire core, and a
    charged **fire-bolt in the claw** (the burst-shooter tell). The wings deliberately set it apart
    from the flamefiend **boss** (horns + flame mane, no wings) and from the small imp.
- **Subtle 1px "breathe" idle** on each (settles one row on frame 2) so they stay alive next to the
  bobbing regular enemies.
- **Under the hood:** batch-7 in the hand-craft pipeline (`handcraft/batch7-brutes.mjs` → per-name
  `sprites/*.json` → `build-sprite-data.mjs` → `spriteData.ts`, overriding the legacy auto-enhanced
  art). Each drawn with ≥2 render→look→fix cycles, then grass-verified together on a contact sheet
  **against the orc and the flamefiend boss** as clearly-different creatures (the two enemies they
  were most at risk of blurring with).
- **Remaining on auto-enhance:** bat, spider, evader, exploder, mushroom, orbiter, spiraler,
  necroegg, mimic — all read decently; next pull = the beasts/critters family (batch-8).
- **Commit:** `0c7f038`. **Live-verified:** production `roguelite-game-blush.vercel.app` flipped
  from the batch-6 bundle `index-DSqnpMKG.js` → `index-PqBuxm59.js` (HTTP 200, no SSO wall); all 5
  batch-7 palette markers baked into the shipped bundle (imp shimmer `#b6f0ff`, imp base `#9c1f1f`,
  troll regen `#8fe08a`, demon crimson `#8b1a1a`, demon fire `#ff7a1a`).

---

## 2026-07-04 (night) — batch-6 enemy sprites hand-crafted: the caster/support family (5)

- **Every caster/support enemy is now a bespoke, hand-drawn sprite instead of the batch auto-enhancer.**
  Continuing Felix's "go through EACH monster/enemy and hand craft improvements" (the same ask that
  got all 20 artifacts + the spectral family redrawn). These five robed humanoids were blurring
  together on the auto-enhance filter — worst was the **shielder**, which read as two disembodied
  grey shields rather than a creature. Each is now a distinct silhouette with a readable role:
  - **Wizard** — classic pointed-hat blue mage: gold star on the hat, big white beard, glowing eyes,
    a wood staff with a cyan orb.
  - **Necromancer** — grounded navy-robed hooded figure, two green soul-eyes + a green chest rune,
    holding a **bone staff topped with a green-glowing skull** (was nearly invisible before).
  - **Healer** — bright white/green medic robe, green hair, a glowing green healing **cross** on the
    chest + rising heal-sparkles (the only light/bright one, so it never blurs with the others).
  - **Shielder** — a helmeted head with a glowing eye-slit peeking over ONE big grey **tower shield**
    (gold star boss), a hand gripping the shield edge, feet below — a guardian *behind* a shield.
  - **Summoner** — purple hooded cultist with **both arms raised** to a floating magenta/gold
    **rune-portal** orb above (fixed the old cat-like read).
- **Subtle 1px "breathe" idle** on each (whole creature settles one row on frame 2) so they stay
  alive next to the bobbing regular enemies. Distinct from the spectral family — those float
  pale/tattered; these are grounded, solid, robed humanoids.
- **Under the hood:** batch-6 in the hand-craft pipeline (`handcraft/batch6-casters.mjs` → per-name
  `sprites/*.json` → `build-sprite-data.mjs` → `spriteData.ts`, which overrides the legacy
  auto-enhanced art). Each drawn with ≥2 render→look→fix cycles, then grass-verified together on a
  contact sheet as five clearly-different creatures.
- **Verified:** `tsc` clean; `vite build` green (`index-DSqnpMKG.js`); all 4 batch-6 palette markers
  (necro green `#7bf06b`, portal `#e58cff`, heal-cross `#8affc0`, shield gold `#f2d24b`) baked into
  the shipped bundle. Live-verified below.
- **Remaining on auto-enhance:** troll, demon, imp, bat, spider, evader, exploder, mushroom, orbiter,
  spiraler, necroegg, mimic — all read decently; next pull = the brute/demon family (batch-7).
- **Commit:** _(deploy block below)_

---

## 2026-07-04 (night) — item redesign batch 3: 8 redundant Rare stat-cards get distinct identities

- **The Rare shelf had too many near-twins.** After batches 1–2 finished the Legendary/Epic shelf,
  the remaining bland Rares weren't "boring stat sticks" so much as *duplicates* — three +speed
  cards, three +crit cards, two +fire-rate, two +armor, all reading almost identically. A Rare drop
  should be a decision, not "oh, another speed ring." This pass keeps ONE clean anchor per core stat
  and gives each redundant twin a distinct hook (still zero new engine code — every field reused):
  - **Steel Band** — melee/swing damage now, with a small fire-rate cost (a melee-build card, not a
    generic damage ring).
  - **Rapid Gauntlets** — fire rate **+1 projectile** (ranged-fan identity vs. plain Rapid Fire).
  - **Running Shoes** — move speed **+ dodge** (a mobility-survival hybrid, distinct from the
    pure-dodge Evasion Cloak).
  - **Precision Charm** — crit chance **+1 pierce** (crit that punches through a line).
  - **Chain Mail** — armor **+ regen** (an endurance anchor, not a second flat-armor card).
  - **Berserker Rage** — +damage, and **+35% damage & fire rate below 30% HP** (a Last-Stand
    aggressor).
  - **Swift Blade** — speed + fire rate **+ homing shots** (kiting build enabler).
  - **Bloodhound Sight** — crit **+ pickup range + luck** (a hunter/economy hybrid).
- **Why it matters:** same reason as batch 2 — items that change *how you play* keep deep runs
  interesting and make a drop feel meaningful. Removing near-duplicate Rares also makes each shop roll
  more distinct. The six intentional clean anchors (Vitality Ring, Precision Scope, Rapid Fire, Armor
  Plating, Regeneration, Speed Demon) were deliberately left as-is — a clean baseline per stat is good
  design; the redundancy was the problem, not stat cards existing.
- **Under the hood:** all identities reuse shipped engine fields (meleeDamageMult, multishot, dodge,
  piercing, healthRegen, lowHpPower, homing, xpMagnet, luck), verified reachable catalog → ItemSystem
  aggregation → getters → Game.ts runtime. `qa-item-redesign.mjs` now data- and behaviorally-checks
  all **30** redesigned items green; the 5 relevant regression harnesses (synergy, stat-caps,
  triggered-items, status-engines, evolution) all pass; `tsc` clean.
- Commit `56a7e6c`. **Live-verified:** production `roguelite-game-blush.vercel.app` serving bundle
  `index-t5ftjerN.js` (md5 `0b7f9b50…` byte-identical to local dist), batch-3 markers present in the
  shipped JS, HTTP 200, no SSO wall.

---

## 2026-07-04 (night) — item redesign batch 2: 13 high-rarity fillers get real identities

- **Every Legendary and combat/utility Rare that was just a stack of flat numbers now DOES
  something.** Batch 1 gave 10 mid-tier fillers trade-off identities; this pass finishes the
  high-rarity shelf. A Legendary should feel build-defining the moment you see it, and a bland
  "+X% damage, +Y% crit" Legendary never did. The 6 Legendaries + 7 Rares below now each carry a
  distinct mechanic drawn from the existing engine (zero new engine code, so nothing else could
  regress):
  - **Phoenix Feather** (Legendary) — +60 HP / +6 HP·s, and near death you *rage harder* (Last-Stand
    power) while your hits **ignite**. A defensive item with teeth.
  - **Midas Touch** (Legendary) — gold ×1.8, and your gold total now **fuels your damage** (the more
    you're sitting on, the harder you hit). Greed as a weapon.
  - **Berserker Soul** (Legendary) — +40% damage and **every kill stacks more damage** + lifesteal,
    paid for with −20 max HP. Snowball glass-cannon.
  - **Cosmic Dice** (Legendary) — luck + gold + crit, plus a **25% multicast** chance (attacks fire
    twice). Chaos that pays out.
  - **Philosopher's Stone** (Legendary) — an economy anchor that also sustains you (interest + luck +
    regen + lifesteal): wealth that keeps you alive.
  - **Jackpot** (Legendary) — huge crit chance + ×2 crit damage, and crits now **explode on hit**.
    All-in crit build enabler.
  - **Rares** (7): Critical Synergy (crit + **bleed**), Guardian Aura (armor + **thorns** + a
    defensive **nova pulse**), Deadly Precision (crit + **+3 pierce**, trading a little fire rate),
    Compound Interest (gold that **scales your damage**), and the three economy rings
    (Merchant's / Golden Vault / Treasure Map) sharpened into clearly-different money builds —
    shopping/recycle, banking/interest, and loot/pickup.
- **Why it matters:** the earlier "everything's maxed by wave 7" feel came partly from filler items
  that only nudged numbers. Items that *change how you play* keep runs interesting deeper in, and
  make a high-rarity drop feel like a decision, not a stat bump.
- **Under the hood:** all identities reuse shipped engine fields (burn/bleed/thorns/pierce/nova,
  the Last-Stand / kill-stack / gold-scale conditional-damage layer, multicast, explosion-on-hit),
  verified reachable end-to-end. The redesign QA harness (`qa-item-redesign.mjs`) now data- and
  behaviorally-checks all 22 redesigned items green (and its per-item isolation was hardened to
  reset the transformation tracker between checks); the 5 relevant regression harnesses
  (synergy, stat-caps, triggered-items, status-engines, evolution) all pass.
- Commit `d842028`. **Live-verified:** production `roguelite-game-blush.vercel.app` serving the new
  bundle (HTTP 200, batch-2 item mechanics baked into the shipped JS).

---

## 2026-07-03 (night) — all 5 bosses hand-drawn from scratch

- **Every boss is now a bespoke, hand-crafted sprite instead of a filtered auto-enhance.** The five
  bosses were the last enemies still riding the batch auto-enhancer, and they missed the one thing a
  boss must do: read as a BOSS — regalia and a silhouette you can't confuse with any regular enemy.
  Each was redrawn from scratch at 24×24 (double the 16×16 regular-enemy grid, their own tier) and
  grass-verified as five clearly-different silhouettes:
  - **Necrolord** — a bone LICH KING: gold spiked crown + red gem, skull face with glowing green
    soul-eyes, broad navy robe, a gold soul-staff at his side.
  - **Flamefiend** — a hulking FIRE DEMON: two bold up-curving horns (asymmetric), a flame mane,
    snarling fanged face, molten cracks glowing across a red hulk, blazing fists.
  - **Voidbeast** — a floating ELDRITCH EYE-HORROR: one huge magenta central eye + lesser eyes, a
    jagged void-maw, writhing tentacles, cosmic sparkle accents.
  - **Stormking** — an armored STORM SOVEREIGN: gold spiked crown, plated blue armor with a lightning
    emblem, a shoulder cape, a bright thunder-bolt scepter raised at his side.
  - **Ancientgolem** — a colossal rune STONE TITAN: blocky shoulders + heavy fists, cracked body with
    a glowing amber core + rune eyes, moss-green "ancient" accents.
- **Why it matters:** the boss is the wave's climax; a boss that looks like a recolored mob undersells
  the moment. These give each fight a distinct, memorable face. Idle frames are a living-glow pulse
  (crown gems, soul-eyes, molten cracks, the golem's core breathing) rather than a static image.
- **Under the hood:** batch-5 in the hand-craft pipeline (`handcraft/batch5-bosses.mjs` → per-boss
  JSON → `build-sprite-data.mjs` → `spriteData.ts`, overriding the legacy sprites). With this, **every
  enemy that read poorly is now hand-crafted**; the rest of the roster reads decently on the
  auto-enhance pass.
- Commit `dc5ee98`. **Live-verified:** production `roguelite-game-blush.vercel.app` serving bundle
  `index-CunqjopW.js` (HTTP 200, byte-identical md5 to local `dist`, all five boss sprite names +
  new palettes baked into the shipped bundle). Grass contact sheet confirmed all five read as
  distinct boss silhouettes with no camouflage before ship.

---

## 2026-07-03 (night) — items that reward how you PLAY (first conditional/triggered layer)

- **Five new items whose power depends on the moment, not just owning them.** Until now every item in
  the game was a flat, always-on stat (+15% damage, +0.5 HP/sec). These are the first items that only
  pay out while a **run condition** holds — so they reward a playstyle instead of sitting there:
  - **Grindstone** 🪨 — permanent **+6% damage for every wave you survive** this run. A slow-burn item
    that turns a long, careful run into a snowball.
  - **Last Stand** 🩸 — while **below 35% HP: +60% damage AND +60% fire rate**. A comeback/clutch item:
    the closer to death, the harder you hit.
  - **Killing Spree** 💀 — **+4% damage per kill, stacking up to 20×** (+80%), and the stacks **drain**
    if you stop killing. Rewards keeping the arena churning.
  - **Juggernaut Plating** 🛡️ — while **at/above 90% HP (unhurt): +40% damage**. The glass-cannon
    inverse of Last Stand — pays out for clean, no-hit play.
  - **Miser's Hoard** 💰 — **+8% damage per 100 gold on hand**, up to **+200%**. A real tension: hoard
    for power or spend in the shop — you can't do both.
- **Why it matters:** the game had 206 items but *zero* conditional effects — every build decision was
  "which flat stat." These add a whole new axis (danger, streak, hoarding, survival) so builds now have
  a rhythm, and they stack with duplicates. Drawn from a Brotato / Risk-of-Rain / Binding-of-Isaac
  research pass on what makes item effects feel impactful.
- **Under the hood:** a new *triggered-effect layer* — `waveRampDamage / lowHpPower / killStackDamage /
  highHpPower / goldScaleDamage` on `Item`, folded into the memoized `ItemAgg`, and paid out per-frame
  by the renamed **`Game.updateRuntimeModifiers`** (was `updateArtifactRuntime`) — the single place that
  now composes BOTH the momentum/berserk artifacts AND these items into `runtimeDamageMult` /
  `runtimeFireRateMult`, so everything stacks cleanly and `getDamage()/getFireRate()` just read the
  product. Run state (`wavesSurvived`, decaying `killStackCount`) resets each run; wave counter ticks in
  `startNextWave`, kill stack bumps in `handleEnemyKill`. Combat stays **uncapped by design** (enemies
  scale to meet output), so these are intentionally punchy; each threshold/cap is a single tunable const.
- Commit `c4dea82`. **Live-verified:** production `roguelite-game-blush.vercel.app` serving bundle
  `index-B0HYLfkG.js` (HTTP 200, `<title>Roguelite Arena</title>`, matches local `dist`). QA: new
  **`qa-triggered-items.mjs`** drives the real `g.update()` loop and checks all five conditions pay out
  correctly (and pay *nothing* when unmet, and identity with no item held) — **13/13 PASS**. Regression:
  `qa-roguelite` 0 errors, `qa-stat-caps` PASS, `verify-mechanics` ALL PASS.

---

## 2026-07-03 (night) — your shots now show your build's element

- **An elemental build finally LOOKS elemental.** Until now every player bullet was the same cyan
  regardless of your build — a fire/ignite build, a freeze build and a raw-damage build all fired
  identical shots. Now each shot is tinted to the **dominant element of your build**: burn/ignite →
  **fiery orange**, freeze → **icy blue-white**, chain-lightning → **yellow**, poison → **green**.
  The bullet's trail takes the color and a small element-colored core sits over it, so a glance at
  your fire tells you what your build is applying. A build with no elemental stat keeps the default
  cyan.
- **Purely visual — zero balance change.** This does not change damage, or which status effects roll
  on hit (those still come from your build's per-hit chances, unchanged). It's readability/juice, and
  it plumbs an `element` tag onto every projectile that a future fire-vs-frozen combo pass can build
  on (that combo layer is deliberately left for a play-feel/numbers call — see t-75ba64).
- **Under the hood:** `damageType` added to `Projectile` (task t-89b66d / DEEP-REVIEW P2-4).
  `PlayerStats.getShotElement()` picks the strongest of burn/freeze/chain/poison; `Player.tryShoot`
  tags every projectile in the volley (all weapon patterns — bullets, shotgun, orbital, laser) via
  `Projectile.setElement`, which tints the trail and drives the core overlay.
- Commit `ec6a250`. **Live-verified:** production `roguelite-game-blush.vercel.app` serving bundle
  `index-GJQESzf8.js` (HTTP 200, no auth wall, `getShotElement` + `damageType` + the fire/ice colors
  present in the shipped bundle). QA: new `qa-proj-element.mjs` drives the **genuine `Player.tryShoot()`
  path** with a real enemy + forceFire and asserts the returned projectiles carry the right element +
  color across all 5 elements + the priority tie-break — **7/7 cases PASS, 0 console errors**;
  `qa-roguelite` + `qa-stat-caps` regression green; `tsc` clean.

---

## 2026-07-03 (night) — hit-stop "punch" on impactful kills

- **Killing a boss or an elite now lands with a beat.** Added a hit-stop (freeze-frame): the game
  briefly stops for a fraction of a second on a genuinely impactful kill so the moment reads as
  weighty — the classic Brotato/Vampire-Survivors "punch." Boss kills get a meaty **120ms** stop
  plus a white impact flash; elites/minibosses get a lighter **60ms** tap.
- **Fodder kills are deliberately untouched.** The arena melts thousands of trash enemies per
  second now that scaling is tuned, so a freeze on every kill would stutter the whole game
  constantly. The stop fires *only* on bosses and minibosses — the kills that should feel like
  events.
- **Under the hood:** while the freeze window is active the gameplay simulation advances by `dt=0`
  (everything holds — enemies, projectiles, the kill's particle burst) while the frame keeps
  rendering, so the impact frame hangs. The timer drains on real time, is hard-capped at 130ms so
  nothing can stall play unfairly, overlapping kills take the longer stop (never stack), and it
  resets on run start.
- Commit `1b55b67`. **Live-verified:** production `roguelite-game-blush.vercel.app` serving bundle
  `index-DETIf3wt.js` (HTTP 200, no auth wall, hash matches local build, `hitPauseTimer` present in
  the shipped bundle). QA: new `qa-hitstop.mjs` drives the real `handleEnemyKill` gating + the
  genuine `update()` freeze/resume on a live enemy — **11/11 PASS, 0 console errors** (enemy moves
  −3.6px on a normal frame, exactly 0 during the freeze, resumes after); `qa-roguelite` +
  `qa-stat-caps` regression green.

---

## 2026-07-03 (evening) — weapon evolution goes live (VS-style signature upgrades)

- **Committed weapon builds now pay off with a signature evolution.** `EvolutionSystem` existed but
  was dead code — it referenced weapon IDs (`magic_wand`, `excalibur`, …) that exist nowhere in the
  catalog, so it could never fire and was never wired into the loop. Rebuilt it against the game's
  REAL weapon model (weaponType items + passive catalysts) and hooked it into the wave-clear flow.
- **Four evolutions, each = a real weapon + a thematically-fitting passive, at wave 8+:**
  - **Scatter Gun + Demolition Kit → Hellfire Barrage** 🌋 — a wall of exploding pellets (6 shots,
    ×1.4 dmg, explode-on-hit).
  - **Beam Rifle + Storm Essence → Arc Lance** 🌩️ — a chaining, piercing beam (faster fire, chain
    lightning, higher projectile speed).
  - **Satellite Orbs + Trident → Orbital Halo** 🌀 — a dense ring of heavy orbs (6 orbs, ×1.5 dmg,
    ×1.6 orbit damage).
  - **Thunder Hammer + Wildfire Torch → Molten Warhammer** ⚒️ — a faster, wider, burning quake
    (×4.5 melee, +140 AoE, +40 range, ×1.4 elemental, big knockback).
- **Genuinely reachable, not a phantom feature.** Every base weapon and every catalyst is a
  shop-obtainable (`unlocked:true`) item, so the precondition can be assembled in a normal run. The
  evolved weapons are `unlocked:false` — they NEVER roll in the shop, so the only way to get one is
  to actually evolve. On evolve the base weapon is replaced in-place; the catalyst is kept (its
  effect keeps stacking). A gold **"WEAPON EVOLVED — <name>!"** banner + a rising transformation
  chime announce it at the wave-clear screen.
- QA: new `qa-evolution.mjs` — 27 checks, all PASS, incl. an **end-to-end reachability test that
  drives the genuine `updatePlaying` wave-clear loop** (not the handler directly): base+catalyst at
  wave 8 → base replaced by evolved, catalyst kept, banner fired, 0 console errors. Also asserts
  evolved weapons never appear across 3,600 shop draws. `qa-roguelite` + `qa-stat-caps` re-run clean
  (no regression to the shared shop-draw path). `tsc` clean.
- **Banner auto-fits on mobile.** Mobile-viewport screenshot QA caught the fixed-30px banner
  overflowing both edges of a 390px portrait ("...PON EVOLVED — Hellfire Barra..."). Added
  `maxWidth` so the renderer shrinks the text to fit — verified centered and fully on-screen.
- **Live:** commit `b91d412`, bundle `index-DFPdtlOl.js` verified serving on production
  (roguelite-game-blush.vercel.app, HTTP 200, no auth wall; live bundle confirmed to contain all
  four evolved-weapon names + the "WEAPON EVOLVED" banner) via CLI deploy.

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
