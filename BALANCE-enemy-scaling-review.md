# Enemy scaling review — why wave 7 feels trivial

**Date:** 2026-07-03 (evening), **corrected + empirically validated 2026-07-04 (night).** · **Trigger:** Felix's wave-7 stat dump ("they don't seem to scale fast enough").
**Status:** SHIPPED & VERIFIED LIVE — **the live curve is now v3** (commit `77e7603`, bundle `index-C1FxQwHK.js` on roguelite-game-blush.vercel.app), which adds a wave-10+ late-surge on top of v2. **Jump to the [v3 update](#v3-update-2026-07-05-night--felix-23m-dmgprojectile-on-wave-13-enemies-insta-killed-scale-up-enemies) at the bottom for the current state, the hard ceiling math, and the open offense-soft-cap fork.** The historical v1/v2 sections below are kept for lineage — read the "Correction" box before trusting any mid-doc table.

> ### ⚠️ Correction (2026-07-04) — this doc originally documented v1; the live game is v2
> The evening of 2026-07-03 shipped **two** enemy-curve revisions, ~4h apart:
> - **v1** (`62feae7`, ~evening): steepened enemy scaling (linear 0.22, compound `1.18^(wave-4)`) → wave 20 ≈ **73×**. *This is what the "What shipped" section below originally described.*
> - **v2** (`650f07d`, 21:25, sim-driven): a headless kite-bot **died at wave 3-6 in 8/8 runs** on v1 (swarmed before a run picks up any defensive items), so the linear slope was **softened back to 0.15** and the **compound onset delayed to wave 7**. This is the **live** curve.
>
> **The consequence Felix should know:** because v2's compound term is `1.18^max(0, wave-7)` (exponent = 0 at wave 7), **v2 reverts enemy fodder-HP at waves ≤7 to the exact pre-complaint original values** (wave 5 = 1.60×, wave 7 = 1.90× — identical to before he complained). v2 only steepens the **mid-late** game (wave 10: 2.84→3.86×, wave 20: 12→33×). So the **enemy-scaling half** of "wave 7 feels trivial" is, for waves ≤7, effectively back where it started; what genuinely changed for the early game is the **economy** (below), which was *not* reverted.

**One-line verdict:** The complaint is real, but "enemy HP scales too slow" is only half of it — and the smaller half. The core issue is **a linear/additive enemy curve trying to chase a fully multiplicative player curve**, made worse by two specific, fixable things: the enemy compound-growth term was switched off until wave 9, and the player's defensive stats hard-outscale enemy damage so the *intended* pressure valve (enemy damage + density, not fodder time-to-kill) never bites.

---

## The two curves, quantified

**Enemy scaling** (`WaveManager.waveScale`), *original*:

```
waveScale(wave) = (1 + (wave-1)*0.15)  ×  1.1^max(0, wave-8)
```

- The compound term `1.1^max(0, wave-8)` was **0-effect until wave 9** — `max(0, 7-8)=0 → 1.1^0 = 1`.
- So **waves 1–8 rode the pure linear track**: only `+0.15×` per wave. Wave 7 = 1.90×.

**Player scaling** (`ItemSystem.getDamage` + the type/crit/fire-rate layers): effective DPS is the **product of ~10 independent, uncapped multiplicative axes** (damageMult × specialization × transformation × duo × artifact × runtime × ranged × elemental × crit × fireRate × multishot × pierce). None balance-capped — `SANITY_MULT_CAP = 1e15` is an overflow guard, not a ceiling.

**Felix's wave-7 sheet:** Damage 25M (base 25 → ~1,000,000× damageMult), Fire Rate 2.4K/s, Multishot +28 (=29 projectiles), Crit 100% @ 927×, Elemental 139×, Ranged 31.7×, Piercing 13. Per-projectile hit ≈ 1e14, × 29 projectiles × 2400/s. Against ~500-HP enemies, **time-to-kill is one frame** and has been since ~wave 3.

**The mismatch is structural:** a linear (×1.9) enemy curve *cannot* track a multiplicative (~1e6×) player curve. Classic Vampire-Survivors/Brotato scaling tension.

---

## Why the *intended* difficulty valve also fails

The `waveScale` doc-comment states the intent honestly: *"A truly broken build will still shred trash (genre norm) — the depth curve bites via enemy DAMAGE + density + tanky elites/bosses, not TTK on fodder."* That's legitimate design. **But that valve is currently neutralized:**

- **Dodge is capped at 75%** (`DODGE_CAP = 0.75`) and Felix is *at* the cap → 3 of every 4 enemy hits miss.
- **Armor 24%** → landed hits take ≈ 0.45× (min 1 dmg).
- **Regen 37.5/s** on a 210-HP pool → full heal in 5.6s, plus **Shield: YES** and **10% lifesteal**.
- Net: effectively immortal. Enemy *damage* scaling of 1.9× is meaningless against that defensive stack.
- **First boss/hard-check is wave 10** — wave 7 has no skill gate at all.

So "enemies don't scale fast enough" decomposes into: (a) fodder HP is *designed* to melt, (b) the valve that's *supposed* to threaten you — damage/density — is defeated by capped-but-still-huge defensive stacking, and (c) the wave-≤8 compound-off window made mid waves the flattest possible.

---

## What actually shipped (live = v2) — commit 650f07d, bundle index-CtBoAShq.js

Both of Felix's requests are implemented, deployed, and verified live. **The enemy curve is v2** (the economy + item changes below shipped in v1 and were *not* reverted, so they are live as-is):

**Enemy curve** (`WaveManager.waveScale`, live/v2): `linear = 1 + (wave-1)*0.15`, `compound = 1.18^max(0, wave-7)`. (v1 had briefly been linear 0.22 / compound-from-wave-4; v2 softened it — see the Correction box.)
**Shop price** (`ItemSystem.getScaledPrice`): linear `0.15 → 0.25`, compound `1.12 → 1.18` starting `wave 6 → wave 3`. **(survives in v2)**
**Aggregate caps** (`ItemSystem`, verified in code 2026-07-04): gold `×10 → ×4` (`GOLD_MULT_CAP=4`), shop-discount `50% → 30%` (`getShopDiscount` min 0.3), reroll-discount `90% → 60%` (min 0.6), luck `+200% → +100%` (min 1.0). **(all survive in v2)**
**Flagship discount items** (`catalog.ts`): Spyglass `-50% → -25%` reroll & cost `28 → 40`; Merchant's Ring `-20% → -10%` price. **(survives in v2)**

### Numerical verification — the three enemy curves (recomputed 2026-07-04)

| Wave | original (pre-complaint) | v1 (this doc's old table) | **v2 (LIVE)** | v2 vs original |
|---|---|---|---|---|
| 5 | 1.60 | 2.22 | **1.60** | **unchanged** |
| 7 | 1.90 | 3.81 | **1.90** | **unchanged** |
| 10 | 2.84 | 8.04 | **3.86** | 1.36× steeper |
| 15 | 6.04 | 25.2 | **11.65** | 1.93× steeper |
| 20 | 12.08 | 73.2 | **33.11** | 2.74× steeper |

**Read this table honestly:** v2 does **nothing** to enemy fodder-HP at waves ≤7 (identical to pre-complaint); it makes the **mid-late** game meaningfully tankier (wave 20 goes from an immortality-causing 12× to 33×) without the v1 early-swarm death. Enemy **damage** scales by the same multiplier (both `health` and `damage` are `*= waveMultiplier` in `Enemy.ts:778-779`), so late enemies also hit ~33× base at wave 20 — but the **i-frame throttle** (0.5s invuln after any contact hit → ≤2 contact hits/sec) caps how fast that damage can land regardless of density.

Live-bundle confirmation: the v2 curve (`Math.pow(1.18, Math.max(0, wave - 7))`) and `GOLD_MULT_CAP=4` are both committed (`650f07d`) and present in the live `index-CtBoAShq.js`.

## Empirical validation — headless sim on the LIVE v2 build (2026-07-04)

Ran the existing `tools/qa/simulate-balance.mjs` kite-bot against the committed v2 `frontend/dist` (6 runs, target wave 20, Chromium headless). Raw data: `/tmp/roguelite-shots/balance-sim-v2.json`.

**Death waves:** 4, 10, 4, 12, 4, 3 (all died) — median ~4, with two deep runs reaching 10 and 12. The distribution is **bimodal, not a smooth ramp**: a run either gets swarmed early (wave 3-4, before it establishes any defensive items) or snowballs and survives into the mid-game.

**Per-wave HP trajectory (aggregate over surviving runs):**
- Waves 1-3: HP essentially flat (100→~97) — trivial.
- Waves 4-6: HP **rises** (133→160, 144→192) — an established build *out-heals* incoming damage; the game is not threatening it.
- Waves 7-11: real swings appear (e.g. deep run 1: 160→69 at w7, 177→77 at w9) — enemy damage finally bites a mid-tier bot.
- Deaths in the deep runs came at the **wave-10 boss** and a **wave-12 elite/miniboss spike** (275 HP → 0 in one wave), not from fodder attrition.

**Honest caveat on the proxy:** the kite-bot is a *weak* player — it only dodges/kites and relies on auto-fire, so its early wave-3-4 deaths reflect the **bot failing to establish**, NOT a real player struggling (Felix cleared wave 7 with a fully-maxed 25M-damage build). The signal that *does* transfer: even this mediocre bot sees its **HP rise through waves 4-6** once established, which corroborates Felix's core complaint — a snowballed build simply isn't threatened by fodder, and the only real pressure is boss/elite/damage spikes. No run reached past wave 12, so the 33× late-game (waves 13-20) is **not** bot-validated; it rests on the analysis above.

**Why the economy fix actually works (key structural finding):** enemy `goldValue` is a **flat per-enemy constant** (2–7 gold, deliberately "reduced for tight economy" — `Enemy.ts:69+`), and `finalGold = goldValue × goldMultiplier × getGoldBonus()` (`Game.ts:1638`) — income per kill **never touches `waveScale`**. So per-wave income is roughly flat (flat drops × density × the now-capped ×4 multiplier + wave-bounded interest), while shop prices now **compound from wave 3**. Flat income vs. compounding prices = late items become a real choice again → "everything maxed by wave 7" is directly addressed. (The gold-cap cut 10→4 removes the one income multiplier that was inflating the top end.) Note: the caps are the aggregate governor for "make discount items weaker" — no need to re-tune all ~20 economy items individually (they can't combine past the caps), so only the two flagship discount items were touched to keep the change minimal.

---

## The one honest caveat — an open design fork for Felix

The v2 changes make **mid-late** enemies tankier and hit harder, but (a) do **nothing** at waves ≤7, and (b) do **not** touch the player's **defensive stack** (`DODGE_CAP` still 0.75, armor capped at 90% mitigation, regen/shield/lifesteal untouched). Fodder HP can never catch multiplicative player DPS (fodder is *designed* to melt), so the real pressure valve is enemy **damage + density** — still throttled by the 0.5s i-frame window (≤2 contact hits/sec) on top of 75%-dodge + armor + fast regen + shield. Net enemy *damage* in v2 is **~1× at w7 (unchanged) and ~2.7× at w20**, so a fully-stacked defensive build almost certainly still feels safe — and the sim above confirms even a *mediocre* build sees its HP rise through the mid-game.

**Fix #2 (bounding defense) was deliberately NOT shipped** — lowering the dodge cap / soft-capping regen **nerfs the player's build**, a different lever than "scale enemies faster," which Felix didn't ask for. Genuine fork, no safe default → flagged for his call:
- **Option A (shipped):** steeper mid-late enemies + tighter economy only. A defensive god-build still survives; waves ≤7 unchanged.
- **Option B (needs greenlight):** also lower `DODGE_CAP` to ~0.55–0.60 and/or soft-cap regen, so enemy damage genuinely threatens even a stacked build. Bigger feel change.

**Data-grounded recommendation (updated 2026-07-04):** the economy half of Felix's complaint ("everything maxed by wave 7") is genuinely fixed and live. The **enemy-difficulty half is only half-addressed** — v2's sim-driven softening, correct for stopping early-swarm deaths, also **reverted the wave-≤7 steepening Felix specifically reacted to**, so a strong player will still find the early game trivial on fodder TTK. The empirical bite is only at boss/elite/damage spikes. So: **have Felix playtest A**, but set expectations that **waves ≤7 will feel the same as before** by design; if he still wants the early game to bite, the lever is NOT more fodder HP (melts regardless) — it's **Option B (bound defense)** and/or **more frequent elite/miniboss checks in the early waves**, since those are the only things the sim shows actually threatening an established build.

---

## Deeper, optional (separate design decision)

The only durable structural fix for the offense side is to reduce how many *independent* multiplicative axes the player stacks (make some bonuses additive within a category, or soft-cap the product per category). That's a real rebalance, not a tuning pass — worth its own decision, not folded into this note.

---

## v3 update (2026-07-05, night) — Felix: "2.3M dmg/projectile on wave 13, enemies insta-killed, scale up enemies"

This is the **same complaint, escalated with a hard number** — and it settles the open fork above. Two things shipped/quantified tonight.

### 1. Shipped: a steeper mid-late enemy curve (commit `77e7603`, live `index-C1FxQwHK.js`)

`waveScale` gained a **second exponential from wave 10**: `lateSurge = 1.15^max(0, wave-10)`, multiplied onto the existing `linear × compound`. Waves ≤10 are **untouched** (the v2 sim-tuned early-swarm fix stands); the late game gets meaningfully tankier.

Effective fodder-HP multiplier `M(w) = waveScale(w) × survivabilityMult(w)`, before vs after (100-HP grunt shown):

| Wave | old M | **new M** | 100-HP grunt | ×tankier |
|---|---|---|---|---|
| ≤10 | — | — | identical | 1.00× |
| 13 | 58.6 | **89.1** | 5,857 → 8,907 | 1.52× |
| 15 | 103.6 | **208.4** | 10,361 → 20,840 | 2.01× |
| 20 | 389.1 | **1,574** | 38,908 → 157,404 | 4.05× |
| 25 | 1,322 | **10,760** | 132,234 → 1,075,997 | 8.14× |

Verified: `tsc` clean, `vite build` clean, `tools/qa/simulate-balance.mjs` runs end-to-end (after I un-broke it against today's new class-select + level-up states) — deepest kite-bot run now dies at **wave 14** (was 10–12), early-death distribution unchanged (no regression). Live bundle contains `1.15**Math.max(0,e-10)`.

### 2. The hard ceiling — why this does NOT fix Felix's 2.3M one-shot (the number that ends the debate)

Felix does **2.3M per projectile**. For even a *single* 100-HP-base grunt to survive **one** such hit at wave 13, its multiplier would have to be **≥ 23,000×** (`2.3M / 100`). The current wave-13 multiplier is 89×; the early game (wave 5) is ~10×. A smooth curve that reaches 23,000× by wave 13 would put wave-5 enemies at thousands of HP while a fresh run does a few hundred DPS → **instant unwinnable wall**. And he doesn't fire *one* projectile — he "spams projectiles all over the screen," so the real requirement is orders of magnitude worse.

**Conclusion, now numerically proven twice:** you cannot scale fodder HP to catch a fully-stacked multiplicative build without destroying the early game. Enemy HP is the symptom; **runaway multiplicative player offense is the disease.** The shipped v3 curve makes a *normal* build fight for waves 11+, which is real and wanted — but it will **not** change the feel of a maxed 2.3M build, by mathematical necessity.

### 3. The one real fix — bounded offense (designed, ready to flip on `getDamage()`, awaiting Felix's yes/no)

`PlayerStats.getDamage()` is a raw product of independent multiplicative axes (`damageMult × specialization × transformation × duo × artifact × runtime`, then per-type/elemental/crit/fireRate/multishot layer on top) with **no balance cap** — only `SANITY_MULT_CAP = 1e15` (an overflow guard). That's where 2.3M/projectile comes from.

**Proposed opt-in (not shipped — it changes his build feel):** a **diminishing-returns soft cap** on the aggregate damage product past a threshold, e.g.

```
// soft cap: below KNEE, damage is untouched; above it, excess is compressed to an exponent < 1
const KNEE = 5000;      // ~200× base damage of 25 — a strong-but-not-absurd build is unaffected
const SOFTNESS = 0.5;   // excess grows as excess^0.5 → sqrt-compression above the knee
if (damage > KNEE) damage = KNEE + Math.pow(damage - KNEE, SOFTNESS) * Math.sqrt(KNEE);
```

Effect: a build that would compute 2.3M/projectile lands around **~110k** instead — still a huge, satisfying number and still one-shots trash, but the *gap* stops compounding, so the existing enemy curve (now v3) actually holds into the late game. Tunable via `KNEE` (where compression starts) and `SOFTNESS` (how hard). Fully reversible.

**Why it's Felix's call, not an autonomous ship:** it nerfs the ceiling of his build — and his framing ("scale up *enemies*") reads like he may *enjoy* the big-number fantasy and just wants enemies that can eat it. Bounding offense is the honest fix; whether he *wants* it is a taste call with no safe default. So: shipped the enemy half he asked for, and this soft-cap is written and ready to flip on the moment he says go (or to tune the `KNEE`/`SOFTNESS` to his preference).

**Recommendation:** play-test v3 first. If wave 13+ *still* feels trivial on a stacked build (it will, for a 2.3M build), the lever is (a) the offense soft-cap above, and/or (b) more frequent elite/miniboss damage-checks — **not** more fodder HP, which is now proven to be a dead end against multiplicative offense.
