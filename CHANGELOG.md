# Roguelite Arena — Changelog

Newest first. One block per production deploy: player-visible changes first, the commit sha,
and the live-build verification (Felix plays on his phone — every entry is verified at a mobile
portrait viewport).

Live: https://roguelite-game-blush.vercel.app

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

**Commit** `TBD`
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
