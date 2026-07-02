# Balance & Game-Loop Round — 2026-07-02 (evening, via Claude Code on the host)

Follow-up to SESSION-2026-07-02-ART-OVERHAUL.md. Felix asked for continued
improvement driven by research on balancing, game loops, and art — plus he
reported two live bugs. Everything below was verified with the new headless
balance simulator (`tools/qa/simulate-balance.mjs`): an auto-playing kite-bot
runs full games at simulation speed and logs per-wave combat/economy metrics.

## Felix's reported bugs — fixed & verified
- **Desktop click misalignment**: touch events scaled CSS→canvas coordinates,
  mouse events didn't (`Input.ts`) — every desktop click landed at ~62% of the
  true position. Fixed; verified headlessly (cursor now within 1px of target,
  clicking Next Wave actually starts the wave).
- **Clipped bullet sprites**: both bullets were 7×7 grids drawn at scale 8
  (56px) onto 36/42px canvases — edges cut off. Same bug family as the
  xp/gold pickups fixed earlier. Fixed with explicit scale 6.

## What the simulator found (before → after)
- **2/3 runs soft-locked**: wave completion required killing every enemy while
  evader/druid actively flee and `waveTimer` expiry did nothing.
  → Waves are now time-boxed Brotato-style (`22 + 1.5×wave`s, cap 60): timer
  expiry despawns leftovers without rewards; boss waves stay open until the
  boss dies; last ≤3 stragglers enrage and charge. HUD shows the countdown.
- **Boss fights ran 100-180s+**: adds soaked the nearest-enemy auto-aim.
  → Necro Lord HP 2000→1100, battlefield cap of 20 during summons, minions
  grant token rewards (5 XP/1 g), and bosses count as 0.55× distance for
  auto-aim targeting. Boss wave now clears in ~30s.
- **Leveling stalled** (L12 by wave 15; XP needs ×1.5/level vs flat XP drops).
  → Late curve 1.5→1.25 per level, XP/gold drops now scale with the wave
  multiplier (×0.5 / ×0.15 per point). Sim: L15 by wave 14, level-ups keep
  flowing.
- **Economy snowballed then exploded** (2753 g/wave once enemies persisted).
  → Gold scaling halved, minion-farm faucet closed, horde waves pay half
  per-kill gold (2× count previously meant 2× income), reroll increment can
  no longer be 0 (waves 1-2 allowed unlimited flat-price rerolls).

## Placebo mechanics wired for real (repo-research agent audit)
**~11 item effects existed as stats but had zero call sites** — players paid
for no-ops: armor, dodge, health regen, thorns, gold bonuses, chain lightning,
freeze, poison, explosion-on-hit, player homing. All implemented now
(`applyOnHitEffects`/`applyThorns` in Game.ts, dodge/armor in
Player.takeDamage, homing seeks nearest enemy, regen ticks, gold bonus applies
on kills, DODGE popup shows).
**13 of 19 meta upgrades were purchasable but unwired.** All wired now
(speed/fire rate/crit/armor/regen/shield/item tier/legendary start/wave skip/
boss damage/elite rewards/double level-ups/reroll & shop discounts);
`extra_shop_slots` removed instead (fixed 6-slot layout — a fake soul sink is
worse than no upgrade).

## Game-loop changes
- Enemies no longer suicide on contact — they persist and attack on a 0.8s
  cooldown (exploder/swarm still trade themselves). Sustained melee pressure
  finally exists.
- Wave modifiers hit 95% of waves; now ~44%, and stat-spike modifiers
  (elite/tank) wait until wave 4. Tank ×3 (which also tripled damage) → ×2.
- Shop general pool is rarity-weighted (100/60/30/10) — legendaries were as
  common as commons at wave 11+.
- Wave 1: 18 enemies (was 12) with cadence derived from wave duration.

## Art round 2
- New player sprite (readable face, satchel-strap asymmetry, hue-shifted
  shading) via the JSON pipeline — data now covers 39 sprites.
- Upgrades screen rebuilt: it drew 19 cards in one 2000px column — **half the
  upgrades were off-screen and unbuyable**. Now a zoom-aware 3-column grid of
  wood panels, shared layout between draw and click code.

## Verification
`simulate-balance.mjs 4 14`: 4/4 runs complete, waves 26-35s, boss ~31s,
L15 @ w14, no soft-locks. Screenshots in shots/ dirs; build + tsc clean.

## Suggested next steps
- Human playtest the difficulty (the bot is a perfect kiter — HP loss is still
  rare for it; humans will find it harder, but the ceiling may need raising).
- Duo-completion surfacing in the shop (research item #8, not yet done).
- Web-research report on genre balance numbers was still in flight at session
  end; fold its findings in when it lands.
