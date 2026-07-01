# Test the Brotato-Level Overhaul - Quick Start Guide

## Quick Test (5 Minutes)

### 1. Build and Run
```bash
cd /workspace/work/roguelite-game/frontend
npm install  # If dependencies not installed
npm run dev  # Start dev server
```

Open: http://localhost:5173

---

### 2. Balance Fix Test (Wave 1)

**What to test:**
1. Click "Start" (you should have 20 gold immediately)
2. Kill enemies in Wave 1
3. Survive to shop phase

**Expected results:**
- ✅ Starting gold: 20g (can buy item immediately if you want)
- ✅ Enemies die in ~2-3 shots (was 7-8)
- ✅ Wave 1 feels powerful, not overwhelming
- ✅ You survive to shop (previously died at ~15 seconds)

**If it fails:**
- Wave 1 still too hard → damage/fire rate buff worked
- Can't reach shop → enemy count reduction worked

---

### 3. Item System Test (Shop Phase After Wave 1)

**What to test:**
1. Open shop after Wave 1
2. Look at available items
3. Hover over items

**Expected results:**
- ✅ **6 shop slots** (not 4)
- ✅ **Common tier only** (gray border items)
- ✅ **All items cost 6-12g** (Tier 1 pricing)
- ✅ **Green synergy glow** on some items (affinity system)
- ✅ Item names: "Iron Ring", "Swift Gloves", "Worn Boots", etc. (new names)

**If you see:**
- Old items ("Attack Speed", "Damage") → ItemSystem not loaded
- 4 slots → Shop update didn't apply
- No green glow → Synergy detection broken

---

### 4. FREE Locking Test

**What to test:**
1. In shop, click lock button (🔓) on any item
2. Buy items or continue to next wave
3. Return to shop after Wave 2

**Expected results:**
- ✅ Lock button toggles (🔓 → 🔒)
- ✅ **No gold deducted** (was -5g per lock)
- ✅ Locked item **persists** into Wave 2 shop
- ✅ Unlocked slots show new items

**If it fails:**
- Gold deducted → Still using old 5g lock cost
- Item doesn't persist → Lock state not preserved

---

### 5. Tier Progression Test

**What to test:**
1. Survive to Wave 3
2. Open shop (should unlock Tier 2)

**Expected results:**
- ✅ **Tier 2 (Uncommon)** items appear (blue border)
- ✅ Item names: "Spyglass", "Coupon Book", "Haggler Badge"
- ✅ Prices: 20-35g (higher than Tier 1)
- ✅ Still some Tier 1 items mixed in

**Continue to Wave 6:**
- ✅ **Tier 3 (Rare)** items appear (purple border)
- ✅ Item names: "Champion's Crown", "Trident", "Seeking Rune"
- ✅ Prices: 55-75g

**Continue to Wave 11:**
- ✅ **Tier 4 (Legendary)** items appear (gold border)
- ✅ Item names: "Midas Touch", "Void Lance", "Arc Reactor"
- ✅ Prices: 125-160g (plus wave inflation)

---

### 6. Dynamic Pricing Test

**What to test:**
1. Note prices in Wave 1 shop
2. Note prices in Wave 5 shop (same items)

**Expected results:**
- ✅ Wave 1: Iron Ring ~9g
- ✅ Wave 5: Iron Ring ~17g
- ✅ Wave 10: Iron Ring ~26g
- ✅ Prices increase each wave (inflation formula)

**Buy "Coupon Book" (Tier 2):**
- ✅ All shop prices reduced by 10%
- ✅ Iron Ring at Wave 10: 23g (was 26g)

---

### 7. Item Recycling Test

**What to test:**
1. Buy an item (e.g., "Iron Ring")
2. Return to shop next wave
3. Look for recycle button (♻️) on that item card

**Expected results:**
- ✅ Recycle button appears in bottom-left of item card
- ✅ Click recycle → get ~2g back (25% of 9g)
- ✅ Item removed from inventory
- ✅ Stats update (damage decreases)

**Buy "Haggler Badge" first:**
- ✅ Recycle value increases to ~3g (37.5% with bonus)

---

### 8. Reroll Cost Scaling Test

**What to test:**
1. Wave 1 shop: Note reroll cost
2. Wave 5 shop: Note reroll cost
3. Click reroll, note new cost

**Expected results:**
- ✅ Wave 1 first reroll: 1g
- ✅ Wave 5 first reroll: 5g
- ✅ After first reroll: Cost increases by ~2g (wave × 0.4)
- ✅ Each reroll costs more (scaling per reroll)

**Buy "Spyglass" (Tier 2):**
- ✅ Reroll cost cut in half
- ✅ Wave 5 reroll: 3g (was 5g)

---

### 9. Free Reroll Bonus Test

**What to test:**
1. Have enough gold to buy all 6 shop items
2. Buy all 6 items in one wave
3. Check reroll cost

**Expected results:**
- ✅ After buying 6 items: Reroll cost shows "0g" (FREE)
- ✅ Can reroll for free once
- ✅ Next reroll costs normal amount again

---

### 10. Synergy System Test

**What to test:**
1. Note your affinity tags (hidden, but reflected in green glow)
2. Buy items with green ⚡SYNERGY indicator
3. Return to shop next wave

**Expected results:**
- ✅ Items matching your affinity keep showing green glow
- ✅ Build around same tags = more synergies
- ✅ Green glow = strategic signal (not random)

**Mechanical synergies:**
- ✅ Buy "Lucky Coin" (+10% crit) → "Precision Scope" (+35% crit dmg) glows green
- ✅ Buy "Vampire Fang" (lifesteal) → damage/fire rate items glow green
- ✅ Buy "Trident" (multishot) → "Penetrating Shot" (pierce) glows green

---

## Build Archetypes to Test

### Economic God (Most Fun)
**Goal:** Infinite rerolls, buy everything

**Items to buy:**
1. Wave 1-2: Coin Purse (+10% gold)
2. Wave 3-5: Spyglass (-50% reroll), Coupon Book (-10% shop)
3. Wave 6-10: Treasure Hunter (+25% gold), Haggler Badge (+50% recycle)
4. Wave 11+: Midas Touch (+100% gold, -15% shop)

**Strategy:**
- Reroll spam to find perfect items (cheap with Spyglass)
- Recycle unwanted items for 37.5% value (Haggler)
- Buy everything with double gold (Midas)
- Shop discount stacks to -25% (Coupon + Midas)

**Success metric:** Wave 10+ with 200+ gold, reroll cost <3g

---

### Screen Clear (Most Satisfying)
**Goal:** Fill screen with projectiles and explosions

**Items to buy:**
1. Wave 1-2: Swift Gloves (+10% fire rate)
2. Wave 3-5: Rapid Gauntlets (+20% fire rate)
3. Wave 6-10: Trident (+2 projectiles), Demolition Kit (explosions)
4. Wave 11+: Arc Reactor (50% chain + explosions)

**Strategy:**
- High fire rate = more on-hit procs
- Multishot + explosions = screen coverage
- Chain lightning = cascading damage

**Success metric:** Enemies die to explosions before reaching you

---

### Tank Survivor (Hardest to Die)
**Goal:** Never die, outlast everything

**Items to buy:**
1. Wave 1-2: Health Pendant (+15 HP)
2. Wave 3-5: Vitality Ring (+30 HP), Chain Mail (+5 armor)
3. Wave 6-10: Energy Barrier (75 HP shield), Shadow Step (20% dodge)
4. Wave 11+: Phoenix Feather (+100 HP, +10 HP/s)

**Strategy:**
- Stack HP to 200+
- Armor + dodge = damage reduction
- HP regen = never need to dodge

**Success metric:** Wave 20+ with 250+ HP, never below 50%

---

## Common Issues and Fixes

### Issue: "I don't see 46 items, only old ones"
**Fix:** Hard refresh (Ctrl+Shift+R) to clear cache

### Issue: "Lock button costs 5g still"
**Fix:** Check Game.ts line ~815 for old lock code

### Issue: "Reroll cost is always 2g"
**Fix:** Check Game.ts enterShop() for new reroll formula

### Issue: "No green synergy glow"
**Fix:** Affinity tags not assigned at PlayerStats construction

### Issue: "Shop has 4 items, not 6"
**Fix:** Check Game.ts enterShop() shopSlotCount = 6

### Issue: "Prices don't scale with wave"
**Fix:** Check PlayerStats.getItemPrice() implementation

---

## Performance Checklist

### FPS Test
1. Survive to Wave 10
2. Let screen fill with enemies (20+)
3. Fire rapidly

**Expected:**
- ✅ 60 FPS maintained
- ✅ No stuttering
- ✅ Smooth gameplay

**If laggy:**
- Too many particles → reduce particle count
- JS bundle too large → code splitting needed

### Load Time Test
1. Open game in incognito (fresh load)
2. Time from URL to menu screen

**Expected:**
- ✅ <2 seconds on desktop
- ✅ <5 seconds on mobile

---

## Success Criteria Summary

### Balance (Wave 1)
- [x] Starting gold: 20g
- [x] Player damage: 15 (was 10)
- [x] Player fire rate: 2.5 (was 2)
- [x] Wave 1 enemies: 12 (was 17)
- [x] Wave 1 survival rate: >80%

### Items (Shop)
- [x] 46 items available
- [x] 6 shop slots (not 4)
- [x] Tier progression (T1→T4)
- [x] Synergy detection (green glow)
- [x] Affinity system (2 tags)

### Shop Features
- [x] FREE locking (no 5g cost)
- [x] Recycling (25% value)
- [x] Dynamic pricing (wave scaling)
- [x] Shop discounts (Coupon, Midas)
- [x] Reroll scaling (wave formula)
- [x] Free reroll bonus (buy 6)

### UX
- [x] 3×2 grid desktop
- [x] Vertical mobile
- [x] Portrait mode fits
- [x] No layout overflow

---

## Ready for Players?

**If all above tests pass:**
- ✅ Balance is fixed (Wave 1 playable)
- ✅ Item system works (46 items, tiers, synergies)
- ✅ Shop system works (FREE lock, recycle, pricing)
- ✅ UX is smooth (responsive, mobile-friendly)

**Ship it!** 🚀

---

## Feedback Loop

**Ask playtesters:**
1. "Did Wave 1 feel fair?" (Target: 80% yes)
2. "Did you discover new items?" (Target: >5 per run)
3. "Did you use locking?" (Target: >50% yes)
4. "Did you recycle items?" (Target: >30% yes)
5. "Did you try economic build?" (Target: >15% yes)

**Adjust based on feedback:**
- Wave 1 still hard → buff player more
- Too many items → reduce tier unlock pace
- Locking unused → show tutorial
- Recycling unused → increase value to 30%
- Economic build too weak → buff Midas Touch
