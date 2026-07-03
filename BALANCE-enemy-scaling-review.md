# Enemy scaling review — why wave 7 feels trivial

**Date:** 2026-07-03 (evening) · **Trigger:** Felix's wave-7 stat dump ("they don't seem to scale fast enough").
**Status:** SHIPPED & VERIFIED LIVE — commit `62feae7`, live bundle `index-BeJvcJwf.js` on roguelite-game-blush.vercel.app.

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

## What shipped (2026-07-03 evening) — commit 62feae7, live

Both of Felix's requests are implemented, deployed, and verified live. The tuning went more aggressive than a minimal patch, and did the economy pass too:

**Enemy curve** (`WaveManager.waveScale`): linear slope `0.15 → 0.22`, compound base `1.10 → 1.18` starting `wave 8 → wave 4`.
**Shop price** (`ItemSystem.getScaledPrice`): linear `0.15 → 0.25`, compound `1.12 → 1.18` starting `wave 6 → wave 3`.
**Aggregate caps** (`ItemSystem`): gold `×10 → ×4`, shop-discount `50% → 30%`, reroll-discount `90% → 60%`, luck `+200% → +100%`.
**Flagship discount items** (`catalog.ts`): Spyglass `-50% → -25%` reroll & cost `28 → 40`; Merchant's Ring `-20% → -10%` price.

### Numerical verification

| Wave | enemy old→new | shop price (net, maxed disc) old→new |
|---|---|---|
| 5 | 1.60 → **2.22** (1.4× steeper) | 0.88 → **2.19** (2.5× pricier) |
| 7 | 1.90 → **3.81** (2.0× steeper) | 1.15 → **3.73** (3.3× pricier) |
| 10 | 2.84 → **8.04** (2.8× steeper) | 1.97 → **7.80** (4.0× pricier) |
| 15 | 6.04 → **25** (4.2× steeper) | 4.51 → **24** (5.4× pricier) |
| 20 | 12 → **73** (6.1× steeper) | 9.77 → **70** (7.2× pricier) |

Live-bundle confirmation: `GOLD_MULT_CAP=4` and the new compound base `1.18` (appears exactly twice = enemy + shop) are both present in `index-BeJvcJwf.js`.

**Why the economy fix actually works (key structural finding):** enemy `goldValue` is a **flat per-enemy constant** (2–7 gold, deliberately "reduced for tight economy" — `Enemy.ts:69+`), and `finalGold = goldValue × goldMultiplier × getGoldBonus()` (`Game.ts:1638`) — income per kill **never touches `waveScale`**. So per-wave income is roughly flat (flat drops × density × the now-capped ×4 multiplier + wave-bounded interest), while shop prices now **compound from wave 3**. Flat income vs. compounding prices = late items become a real choice again → "everything maxed by wave 7" is directly addressed. (The gold-cap cut 10→4 removes the one income multiplier that was inflating the top end.) Note: the caps are the aggregate governor for "make discount items weaker" — no need to re-tune all ~20 economy items individually (they can't combine past the caps), so only the two flagship discount items were touched to keep the change minimal.

---

## The one honest caveat — an open design fork for Felix

The shipped changes make enemies **tankier and hit harder**, but do **not** touch the player's **defensive stack** (`DODGE_CAP` still 0.75, regen/shield untouched). Fodder HP can never catch multiplicative player DPS (fodder is *designed* to melt), so the real pressure valve is enemy **damage + density** — still partly neutralized by 75%-dodge + armor + fast regen + shield. Steeper enemy *damage* (now ~2× at w7, 6× at w20) bites harder than before, but a fully-stacked defensive build may still feel safe.

**Fix #2 (bounding defense) was deliberately NOT shipped** — lowering the dodge cap / soft-capping regen **nerfs the player's build**, a different lever than "scale enemies faster," which Felix didn't ask for. Genuine fork, no safe default → flagged for his call:
- **Option A (shipped):** steeper enemies + tighter economy only. Enemies threaten more via damage; a defensive god-build still survives.
- **Option B (needs greenlight):** also lower `DODGE_CAP` to ~0.55–0.60 and/or soft-cap regen, so enemy damage genuinely threatens even a stacked build. Bigger feel change.

Recommendation: playtest A first; only reach for B if enemies still feel harmless once they hit 2–6× harder.

---

## Deeper, optional (separate design decision)

The only durable structural fix for the offense side is to reduce how many *independent* multiplicative axes the player stacks (make some bonuses additive within a category, or soft-cap the product per category). That's a real rebalance, not a tuning pass — worth its own decision, not folded into this note.
