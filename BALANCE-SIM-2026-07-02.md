# Roguelite balance — headless-sim findings (2026-07-02 eve)

Data-driven pass using the kite-bot simulator (`tools/qa/simulate-balance.mjs`) instead of vibes.
Method: a perfect-dodging bot auto-plays the *real* production build (`frontend/dist`) at sim speed,
buys greedily each shop, and logs per-wave combat + economy metrics. 5 baseline runs + 8 post-fix
runs to wave 15. Raw data: `/tmp/roguelite-shots/balance-sim*.json`.

## Baseline data (5 runs → wave 15)

```
wave | dur(s) | hpStart→hpEnd | goldEarned | level
   1 |   26.0 | 100.0→114.0 |   43.2 | 2.4
   2 |   28.1 | 123.0→139.0 |   57.2 | 4.0
   3 |   28.6 | 231.0→241.0 |   81.2 | 5.0
   4 |   30.4 | 270.0→280.0 |  138.8 | 6.0
   5 |   26.7 | 285.0→295.0 |  283.0 | 7.0
  10 |   33.0 | 358.5→368.8 |  528.3 | 11.3
  15 |   37.3 | 413.8→421.3 | 1238.0 | 14.0
```
(4/5 runs reached wave 15; **1 run soft-locked on the wave-10 boss** — see finding #3.)

## Three findings

### 1. The difficulty curve is INVERTED — there is no death pressure
The single loudest signal: **`hpEnd ≥ hpStart` on every single wave.** The player *net-heals* through
entire combat waves — HP pool climbs 100 → 421 (4.2×) across 15 waves and never drops inside a wave.
A survivor game with no moment where your health bar scares you has no tension.

Root causes (all in code):
- **Level-up grants a flat +20 HP heal** (`Player.ts:307`, `heal on level up`). The bot levels ~12×
  over a run (level 2.4 → 14), often multiple times per wave → a steady +20 trickle that outruns chip
  damage on its own.
- **Regen + max-HP items stack unbounded** (`ItemSystem.getHealthRegen` / `getMaxHealth`). Greedy
  shopping compounds both.
- **Enemy stat scaling is only +15%/wave** (`WaveManager.ts:237`, `1 + (wave-1)*0.15`) — linear, and
  it loses the race against the player's multiplicative power growth (more items + more levels + more
  fire-rate) after ~wave 3.

⚠️ **Caveat — the bot dodges perfectly.** "Never loses HP" is partly bot skill: a human takes far more
hits, so this over-states how safe a *human* is. But *net-healing through a full wave* means even a
flawless dodger out-regens incoming damage — so for any human this build is still very forgiving. This
is a **balance-feel** item: the sim diagnoses it but can't prove a specific fix is "more fun," so it's
staged below, **not** shipped blind.

**Recommended (needs a human sanity-check before shipping):**
- Make the level-up heal a *percentage* (e.g. +5% max HP) or drop it to +10 flat, so it doesn't
  trivialise chip damage late.
- Bump enemy damage scaling faster than HP — e.g. damage `1 + (wave-1)*0.22`, HP left at `*0.15` — so
  late waves threaten the bar without becoming bullet-sponges.

### 2. Gold income runs away (~28×) — the shop stops mattering
Gold earned climbs **43 → 1238 per wave** (baseline). By mid-game the player can buy *everything* in
the shop every visit, so purchases stop being meaningful choices — the core roguelite decision loop
collapses. Unlike #1 this is **dodge-independent** (gold is per-kill income, not tied to taking hits),
so it hits a human identically.

Root cause: gold is deliberately flat per enemy (`Enemy.ts:659`, income "grows via enemy count only"),
but enemy count grows `15 + wave*2` **and** late waves spawn higher-tier enemies (base gold 2 → 7+)
**and** reward/challenge/miniboss modifiers multiply gold ×1.5–2. Three compounding sources, no decay.

**Recommended (balance-feel — stage, don't blind-ship):** the genre norm (Brotato) actively *decays*
per-kill income as waves rise. Simplest lever: a gentle diminishing gold factor on later waves
(e.g. `goldValue × max(0.5, 1 − wave*0.03)`), tuned so late-wave income lands ~2–3× wave 1, not ~28×.
The `simulate-balance.mjs` `goldEarned` column re-measures the effect directly.

### 3. Boss waves could SOFT-LOCK the run — FIXED & shipped this session
Objective bug (not a feel question): normal waves time-box and despawn stragglers, but **boss waves
had no timeout** (`WaveManager.ts` — "Boss waves stay open until the boss dies"). A build that can't
out-DPS the boss and a player who keeps kiting → the wave *never ends*. One baseline run proved it:
the bot reached wave 10, couldn't kill the necrolord boss, and was still alive-but-stuck at the 3-min
sim bail-out.

**Fix (shipped):** added a boss-wave grace cap (`BOSS_GRACE_SEC = 45`). A boss wave still requires the
kill under normal play, but if the boss is *still* alive 45 s past the wave timer, the wave
force-resolves and despawns the boss with **no reward** (identical to the existing straggler despawn) —
you didn't win the fight, but the run can't stall forever. Minimal, consistent with existing despawn
behaviour, can't affect normal play (a fair build kills the boss well inside the window).

**Verified:** re-sim of **8/8 runs reached wave 15 with zero STUCK** (was 1/5 soft-locked). Wave 10
now resolves in a bounded ~44 s.

## Status
- **#3 shipped + sim-verified** this session (see CHANGELOG).
- **#1 and #2 are staged recommendations**, deliberately not blind-shipped: the sim proves *numbers*,
  not *fun*, and both are subjective feel calls better made with one human playtest (or a deliberate,
  reversible tuning pass I can sim-check). They're the two highest-leverage feel levers on the game
  right now — a single "make late-game dangerous + keep the shop meaningful" pass would land both.
