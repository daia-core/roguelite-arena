# Balance Overhaul - Felix's Roguelite Game

## Current Problems (from Feedback)

1. **Wave 1 takes too long to kill enemies**
2. **Gold/pricing doesn't make sense**

## Current State Analysis

### Wave 1 Stats
**Enemies (12 slimes)**:
- HP: 100 each
- Speed: 60
- Damage: 8
- Gold drop: 12g each
- XP drop: 18 each

**Player**:
- Base damage: 25
- Fire rate: 3.0 shots/sec
- Speed: 200
- Starting gold: 20g

**Time-to-Kill Calculation**:
- Shots to kill slime: 100 / 25 = 4 shots
- TTK: 4 / 3 = 1.33 seconds per enemy
- Total wave time: 1.33s × 12 enemies = ~16 seconds (just combat)
- With spawn delay (2s intervals): ~24 seconds actual

**Economy**:
- Gold earned: 12 enemies × 12g = 144g
- Total after wave: 20g (start) + 144g = 164g
- Tier 1 item cost (wave 1): 8 + 1 + (8×0.1×1) = 9.8g → 10g
- Can buy: 164 / 10 = 16 items (!!! WAY TOO MUCH)

## Comparison to Best-in-Class Games

### Brotato Economy (Target Model)
**Wave 1**:
- Starting gold: ~0-50g (character-dependent)
- Gold per wave: 80-120g
- Item costs: 15-30g (Tier 1), 40-80g (Tier 2)
- Can afford: 2-4 items per wave early
- Reroll cost: 2-5g

**Wave 5**:
- Gold per wave: 200-300g
- Item costs: 20-50g (Tier 1), 80-150g (Tier 2), 200+g (Tier 3)
- Reroll cost: 5-10g

### Vampire Survivors Pacing
**Time-to-Kill**:
- Early (0-5 min): 1-2 seconds per basic enemy ✅ (we're at 1.33s, good!)
- Mid (5-15 min): 0.5-1 second per enemy
- Late (15-30 min): Instant kills

**Enemy Density**:
- Early: 10-30 on screen (we have 12 total per wave, too low for swarm feel)
- Mid: 50-150 on screen
- Late: 200-500+ on screen

## Proposed Fixes

### Fix 1: Reduce Gold Drops (CRITICAL)
**Current**: 12g per slime × 12 enemies = 144g
**Target**: 3g per slime × 12 enemies = 36g

**New Wave 1 total**: 20 (start) + 36 (earned) = 56g
**Can afford**: 56g / 10g = 5-6 Tier 1 items → much better!

**Implementation**: Divide all gold values by 4

### Fix 2: Faster Enemy Kills for Better Game Feel
**Current**: 1.33s TTK (4 shots)
**Target**: 0.8-1.0s TTK (2-3 shots)

**Option A**: Reduce slime HP to 60 (2.4 shots = 0.8s)
**Option B**: Increase player damage to 35 (2.86 shots = 0.95s)
**Recommendation**: Option A (preserve damage scaling for later waves)

### Fix 3: Increase Enemy Density (Vampire Survivors Feel)
**Current**: 12 enemies total per wave
**Target**: 20-25 enemies per wave

**Faster spawns**: 2.0s → 1.2s intervals
**More enemies**: 12 → 20 total

This creates swarm pressure while maintaining same total gold (if gold per enemy drops)

### Fix 4: Adjust Item Pricing Formula
**Current**: `base + wave + (base * 0.1 * wave)`
- Wave 1: 8 + 1 + 0.8 = 9.8g → 10g
- Wave 5: 8 + 5 + 4 = 17g
- Wave 10: 8 + 10 + 8 = 26g

**Problem**: Prices scale too slowly, player becomes rich

**Brotato Formula (from research)**:
- Prices increase with wave
- Higher tier items scale faster
- Target: ~2-3 items affordable per wave

**New Formula**: `base * (1 + wave * 0.15)`
- Wave 1 (Tier 1): 8 * 1.15 = 9.2g → 9g
- Wave 5 (Tier 1): 8 * 1.75 = 14g
- Wave 10 (Tier 1): 8 * 2.5 = 20g

- Wave 1 (Tier 2): 25 * 1.15 = 28.75g → 29g
- Wave 5 (Tier 2): 25 * 1.75 = 43.75g → 44g
- Wave 10 (Tier 2): 25 * 2.5 = 62.5g → 63g

### Fix 5: Reroll Cost (Brotato Formula)
**Current**: Wave-scaled base + per-reroll increment
**Target**: Match Brotato formula exactly

**Brotato Formula**:
- Base: `Math.floor(0.75 * wave)`
- Increment per reroll: `Math.floor(0.40 * wave)`

**Wave 1**: Base 0 (floor of 0.75), +0 per reroll → FREE FIRST REROLL
**Wave 2**: Base 1, +0 per reroll
**Wave 5**: Base 3, +2 per reroll (3, 5, 7, 9...)
**Wave 10**: Base 7, +4 per reroll (7, 11, 15, 19...)

**Current code already implements this correctly!** (lines 801-807 in Game.ts)

## Detailed Balance Table

### Enemy Stats (Proposed)

| Enemy | HP | Gold | XP | Notes |
|-------|-----|------|-----|-------|
| **Slime** | 60 (-40) | 3 (-9) | 10 (-8) | Wave 1 basic |
| **Goblin** | 60 (same) | 3 (-7) | 10 (-5) | Wave 1 ranged |
| **Bat** | 50 (same) | 3 (-9) | 10 (-10) | Wave 3+ fast |
| **Skeleton** | 80 (same) | 4 (-12) | 12 (-11) | Wave 3+ ranged |
| **Spider** | 70 (same) | 4 (-14) | 12 (-13) | Wave 5+ |
| **Wizard** | 90 (same) | 5 (-19) | 15 (-15) | Wave 7+ |
| **Orc** | 120 (same) | 6 (-18) | 15 (-15) | Wave 7+ tank |
| **Troll** | 200 (same) | 8 (-32) | 20 (-33) | Wave 10+ |
| **Demon** (boss) | 500 (same) | 20 (-80) | 50 (-100) | Wave 10, 20, 30... |

**Formula**: Divide old gold by 3-4, divide old XP by 1.5-2

### Item Pricing (Proposed)

**Tier 1 (Common)**: Base cost 8-12g
- Wave 1: 9-14g
- Wave 5: 14-21g
- Wave 10: 20-30g

**Tier 2 (Rare)**: Base cost 22-35g
- Wave 1: 25-40g
- Wave 5: 39-61g
- Wave 10: 55-88g

**Tier 3 (Epic)**: Base cost 55-75g
- Wave 5: 96-131g (first available)
- Wave 10: 138-188g

**Tier 4 (Legendary)**: Base cost 125-160g
- Wave 10: 313-400g (first available)
- Wave 20: 625-800g

### Wave Progression (Gold/XP)

| Wave | Enemies | Gold Earned | Total Gold | Tier 1 Cost | Items Affordable |
|------|---------|-------------|------------|-------------|------------------|
| 1 | 20 slimes | 60g | 80g | 10g | 8 items |
| 2 | 25 mixed | 75g | 155g | 10g | 15 items |
| 3 | 30 mixed | 100g | 255g | 11g | 23 items |
| 5 | 40 mixed | 150g | ~500g | 14g | 35 items |
| 10 | 60 mixed | 250g | ~1500g | 20g | 75 items |

**Still too much gold accumulation!** Players are getting rich.

### Revised: Tighter Economy

**New Gold Targets**:
- Wave 1: 30g earned (20 start + 30 = 50g total, buy 3-4 items @ 12g)
- Wave 5: 60g earned (running total ~200g, buy 3-4 items @ 50g)
- Wave 10: 100g earned (running total ~600g, buy 3-4 items @ 150g)

**New Slime Gold**: 30g / 20 enemies = 1.5g → 2g per enemy
**New Goblin Gold**: 2g
**New Bat Gold**: 2g

**Scaling Factor**: Original gold / 6 (!!!)

## Implementation Plan

### Phase 1: Economy Rebalance (DO FIRST)
1. Reduce all enemy gold drops by 6x (divide by 6)
2. Reduce all enemy XP drops by 2x (divide by 2)
3. Adjust item pricing formula: `base * (1 + wave * 0.15)`

### Phase 2: Enemy Tuning
1. Reduce slime HP: 100 → 60 (-40%)
2. Increase Wave 1 enemy count: 12 → 20 (+67%)
3. Faster spawn interval: 2.0s → 1.2s

### Phase 3: Validation
1. Test Wave 1: Should take 30-40 seconds total
2. Check gold: Should end with 45-55g (affordable 3-4 items)
3. Check feel: Should feel like Vampire Survivors swarm

### Phase 4: Long-term Scaling
1. Validate Wave 5, 10, 15 economy
2. Ensure player doesn't become infinitely rich
3. Match Brotato's "spend almost everything each wave" loop

## Felix's Notes on Game Feel

**What makes Vampire Survivors addictive**:
- Fast early kills (1 second or less)
- Visible swarms (20+ enemies on screen)
- Constant dopamine (gold drops, XP gems, visual effects)
- Frequent upgrades (level up every 30-60s early)

**What makes Brotato strategic**:
- Tight economy (always spending down to 0g)
- Meaningful reroll decisions (costs scale)
- Build targeting (tag system guides choices)
- Recycling flexibility (fix mistakes)

**Our game should have**:
✅ Fast kills (0.8-1.2s early)
✅ Swarm density (20+ enemies per wave early)
❌ Tight economy (currently too rich) → FIX THIS
✅ Synergy highlighting (already have SYNERGY label)
❌ Deeper synergies (need transformations, duo items) → IMPLEMENT NEXT

## Sources
- Brotato research (RESEARCH_BROTATO.md)
- Vampire Survivors research (RESEARCH_VAMPIRE_SURVIVORS.md)
- Balance discussions from Brotato community (inflation concerns)
- Felix's feedback (Wave 1 too long, gold broken)
