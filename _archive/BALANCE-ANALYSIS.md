# Roguelite Balance Analysis - 2026-07-02

> **STATUS (updated 2026-07-02 eve): the HIGH-priority item is SHIPPED.** Problem #1 (wave 1 too
> long) is fixed in `WaveManager.ts` — `waveDuration = 30` default plus the per-wave formula
> `Math.min(60, 22 + waveNumber*1.5)` makes wave 1 ~23.5s (was 35s), and `spawnInterval = 1.2`
> (was 1.5). The MEDIUM/LOW items below (economy tightening #2, price scaling #3) are deliberately
> **NOT done** — they're gated on Felix playtesting the current build first (see "Conservative
> Approach: only do #1 and playtest before touching economy"). So the only open work here is
> **Felix's playtest feedback**, not an unimplemented fix. Don't re-investigate #1 as open.

## Current Wave 1 Economy

### Gold Income (Wave 1)
- 20 enemies × 2-3g average = **40-60g per wave**
- Wave duration: 35 seconds
- Spawn rate: 1 enemy every 1.5s

### Shop Prices (Tier 1 Common Items)
- Iron Ring (+15% damage): **8g**
- Swift Gloves (+10% fire rate): **8g**
- Worn Boots (+10% speed): **7g**
- Health Pendant (+15 HP): **10g**
- Healing Charm (+0.5 HP/s): **9g**

### Wave 1 Purchase Power
- Expected gold: ~50g
- Can afford: **5-7 tier 1 items** (very affordable)
- Reroll cost wave 1: 1g (trivial)

## Problems Identified

### 1. Wave 1 Feels Long (35 seconds)
**Issue:** Felix reported wave 1 takes too long
**Cause:** 35 second timer for 20 enemies at 1.5s spawn rate
**Fix:** Reduce wave 1 duration or increase spawn rate for early waves

### 2. Economy May Be Too Generous
**Analysis:**
- 50g income vs 7-10g items = 5-7 items per wave
- This is VERY generous compared to Brotato (typically 2-3 items per wave)
- However, weighted shop system (just implemented) will make this feel better since items are synergistic

### 3. Item Prices Don't Scale
**Issue:** All tier 1 items cost 7-10g regardless of power
**Example:** Swift Gloves (+10% fire rate) = 8g, same as Iron Ring (+15% damage)
**Fix:** Could implement dynamic pricing based on wave or owned items

## Proposed Balance Changes

### Quick Wins (High Impact, Low Risk)

#### 1. Faster Wave 1 (Address "too long" feedback)
```typescript
// WaveManager.ts
waveDuration: number = 30; // Was 35 - save 5 seconds wave 1
spawnInterval: number = 1.2; // Was 1.5 - spawn 25% faster
```
**Impact:** Wave 1 completes in ~24s instead of 35s (-31% time)

#### 2. Tighter Early Economy (Make purchases meaningful)
```typescript
// Enemy.ts - Reduce tier 1 enemy gold by ~20%
slime: { goldValue: 1 } // Was 2
goblin: { goldValue: 2 } // Was 2
skeleton: { goldValue: 2 } // Was 3
```
**Impact:** Wave 1 yields ~30-35g instead of 50g
**Result:** Can afford 3-4 items instead of 5-7 (forces meaningful choices)

#### 3. Slightly Increase Tier 1 Item Costs
```typescript
// ItemSystem.ts - Tier 1 items 9-12g instead of 7-10g
cost: 9 // Was 8 for most tier 1 items
cost: 12 // Was 10 for Health Pendant
```
**Impact:** Combined with gold reduction, creates 2-3 item per wave economy

### Conservative Approach (Recommended)
**Only do #1 (faster wave 1)** and playtest before touching economy.
The weighted shop system we just implemented makes purchases feel better even with generous gold.

## Brotato Comparison (Reference)

### Brotato Economy
- Wave 1: ~15-25g income
- Common items: 10-20g
- Can afford: 1-2 items per wave
- Reroll: 2g wave 1, scales to 5g+ later

### Our Economy (Current)
- Wave 1: ~50g income
- Common items: 7-10g
- Can afford: 5-7 items per wave
- Reroll: 1g wave 1, scales slower

**Verdict:** We're 2-3x more generous than Brotato, which is fine for a different difficulty curve.

## Implementation Priority

1. **HIGH:** Reduce wave 1 duration (35s → 30s, spawn 1.5s → 1.2s)
2. **MEDIUM:** Playtest and gather data
3. **LOW:** Consider economy tightening only if playtest shows it's too easy

---

**Next Steps:**
1. Implement wave 1 speed fix
2. Commit and deploy
3. Felix playtests
4. Iterate based on feel
