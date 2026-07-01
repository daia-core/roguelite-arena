# Brotato Deep Dive Research

## Overview
Brotato is a fast-paced arena survival roguelite where you combine weapons, items and stats to survive 20 waves (~25 minutes per run). The game features automatic shooting with up to 6 weapons simultaneously and a shop between each wave.

## Shop System Intelligence (CRITICAL FOR IMPLEMENTATION)

### Tag-Based Item Filtering
- **Characters have tags** that increase the likelihood of specific items appearing in shops
- Examples:
  - Lucky → higher chance of Luck-based items (Cyber Ball, Baby Elephant)
  - Builder, Cyborg, Dwarf, Engineer, Technomage → Engineering items
  - Explorer → tree-related items
  - Characters with Crit tag → crit-based weapons
  - Characters with Elemental tag → elemental items

### Weapon Tag Synergy System
**KEY MECHANIC**: If you hold weapons with the same tag, you're more likely to see more of those weapons in future shops.
- Example: Want Slingshots? Pick up a Spear (both have Primitive tag)
- This creates a positive feedback loop for focused builds
- The more weapons of the same type you hold, the more likely you'll see them

### Shop Strategy
1. Check character tags for better item synergy
2. Increase Luck stat to improve item rarity chances
3. Use weapon tags to influence future shop offerings
4. Stack items with shared tags for synergistic builds

## Economy & Pricing

### Reroll Mechanics (FORMULA FOR IMPLEMENTATION)
- **Base reroll cost formula**: `0.75 * wave` (rounded down)
- **Reroll increment per reroll**: `0.40 * wave`
- **Example at Wave 5**:
  - Base: 0.75 * 5 = 3.75 → 3 gold
  - Increment: 0.40 * 5 = 2 gold
  - First reroll: 3 + 2 = 5 gold
  - Each subsequent reroll: +2 gold more
- **Max reduction**: 90% (via Spyglass items stacking)

### Item Pricing
- Base cost depends on item tier (Tier 1-4)
- Prices increase with wave number
- Can be modified by:
  - Coupon items (shop discount)
  - Character modifiers (some start with price modifiers)
  - Items are 25% cheaper for Entrepreneur character

### Gold Curve Strategy
- **Early investment is critical**: Harvesting and economy items multiply buying power
- **Recycling system**: Convert unwanted items back to gold
- **Spend-down strategy**: Convert almost all gold to permanent stats before leaving shop
- **Difficulty scaling**: Higher difficulties (4-5) have "starved materials" - less gold overall

## Weapon System

### Multiple Weapon Slots
- Can hold up to 6 weapons simultaneously
- All weapons auto-fire independently
- Weapon combining is NOT a thing (weapons don't merge)
- Focus is on stat synergies across your 6-weapon loadout

### Build Archetypes
**Crit Builds**:
- Stack crit chance and crit damage
- Use Precise weapons (like Harpoon Gun)
- Example: Diver character with Harpoon Gun (300% damage taken debuff)

**Engineering Builds**:
- Focus on Engineering stat
- Turrets, structures, automation
- Entrepreneur: economy/harvesting scaling

**Elemental Builds**:
- Fire, Ice, Poison effects
- Area damage focus
- Synergy with elemental stat bonuses

## Item System

### Tier System (1-4)
- **Tier 1 (Common)**: Cheap, basic stat boosts
- **Tier 2 (Uncommon)**: Moderate effects, some special properties
- **Tier 3 (Rare)**: Strong effects, build-defining
- **Tier 4 (Legendary)**: Game-changing, very rare, expensive

### Luck Stat
- Increases chance of finding higher tier items
- Essential for late-game power spikes
- Some characters start with Luck bonuses

### Pet System (2026 Update)
- New companion category introduced
- Pets fight alongside you
- Scale with different stats
- 9 unique pets with Beast Master character

## Build Strategy Principles

### Stat Stacking
- **Multiplicative benefits** from stacking same stat type
- Example: Attack Speed + Fire Rate modifiers multiply together
- Damage + Crit Chance + Crit Damage creates exponential scaling

### Synergy Focus
- Choose items that enhance your existing build
- Avoid diluting your stat investment
- Tag system helps maintain focused builds

### Wave Progression
- 20 waves total (~25 minutes)
- Difficulty ramps significantly
- Shop after every wave
- Must balance offense, defense, and economy

## Meta (2026)

### Top Strategies
1. **Danger 5 Meta**: Focused stat investment, early economy, aggressive rerolls
2. **Endless Runs**: Builder character with sustainability focus
3. **Fast Clears**: High damage, mobility-focused builds

### Balance Philosophy
- Character diversity (63+ unique characters)
- Multiple viable build paths per character
- Tag system encourages experimentation within constraints
- Economy tension: spending vs. saving vs. rerolling

## Takeaways for Implementation

### Must-Have Features
1. **Tag-based shop filtering**: Items that match player's current build should appear more often
2. **Wave-scaled pricing**: Prices increase with wave progression
3. **Reroll cost scaling**: Base cost + increment per reroll, resets each wave
4. **Synergy detection**: Highlight items that work well with current inventory
5. **Multiple build paths**: Stats should stack multiplicatively
6. **Economy loop**: Gold income → shop investment → power increase → more gold

### Balance Insights
- Early game investment in economy pays off exponentially
- Recycling provides flexibility (don't get stuck with bad purchases)
- Free reroll bonuses reward aggressive shopping (buying all items = free reroll)
- Difficulty scaling affects gold availability, requiring adaptation

### UX Patterns
- Visual indication of synergies (our game already has this with green SYNERGY label)
- Lock system to preserve good rolls (free in Brotato)
- Clear stat display showing cumulative effects
- Tier-based rarity colors for quick identification

## Sources
- [Brotato Items Guide](https://brotato-builds.com/items)
- [Brotato Shop Guide](https://mygamingtutorials.com/2025/05/25/brotato-shop-guide-maximizing-weapons-and-items/)
- [Brotato Builds Meta](https://brotato-builds.com/)
- [Brotato Wiki - Shop](https://brotato.wiki.spellsandguns.com/Shop)
- [Brotato Stats Guide](https://brotato-builds.com/stats)
