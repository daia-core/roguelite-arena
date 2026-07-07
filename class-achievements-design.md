# Starting Class Improvements + Achievement System
*Design doc — written Jul 7, implementation queues for Jul 8+*
*Covers Felix's Jul-7 requests: t-f01496 (class diversity) + t-48b37a (achievements)*

---

## Part 1 — Starting Class Improvements

### Current state assessment

The 7 classes (Gunner, Berserker, Arcanist, Ranger, Prospector, Reaver, Brawler) are
**already well-differentiated** — each has a distinct weapon feel AND a distinct skill tree
start position. The main weakness: the first 3–5 seconds of a run feel identical across
classes. You start, your weapon fires, and the class difference only becomes tangible once
you spend your first skill point.

**Root cause:** each class starts with only its `start_<classId>` node allocated. That node
grants zero stats. The thematic arm is visible on the tree but you haven't taken a single
step toward it.

### Fix 1 — Pre-allocate the gateway node (highest impact, zero content budget)

Pre-allocate **the first node in the class's arm** (the gateway, `${armKey}_gate`) at run
start, alongside the class start node. The gateway is a minor node 1 step into the arm —
e.g., for Berserker it's `might_gate` (+2% dmg), for Arcanist it's `precision_gate`
(+1% crit chance). Tiny stats, but the effect is immediate identity signal and a cheaper
path toward the arm's real notables.

**Implementation** (single-line change in SkillTree.ts):
```typescript
// CLASS_PRE_ALLOC maps each non-gunner class to its arm's gateway node.
const CLASS_PRE_ALLOC: Record<string, string> = {
  berserker:  'might_gate',
  arcanist:   'precision_gate',
  ranger:     'alacrity_gate',
  prospector: 'fortune_gate',
  reaver:     'vitality_gate',
  brawler:    'aegis_gate',
};

setClass(classId: string): void {
  this.startId = startNodeForClass(classId);
  const preAlloc = CLASS_PRE_ALLOC[classId] ? [CLASS_PRE_ALLOC[classId]] : [];
  this.allocated = new Set([this.startId, ...preAlloc]);
}
```

**Risk:** minimal — gateway nodes are always connected to the class start node (already
an edge in `SKILL_EDGES`: `[start_berserker, might_gate]`), so allocation rules are satisfied.
Gunner is unchanged (starts at hub, already adjacent to all gateways).

### Fix 2 — Class-specific starting bonuses (mid-impact, cosmetic pass)

Some classes have very thin starting stat packages compared to others. Tighten this up:

| Class | Current start package | Proposed tweak |
|---|---|---|
| Gunner | +35 gold, +3% crit | ➕ 1 free reroll at first shop ("The Flexible" identity) |
| Berserker | hammer, +14% dmg, +30 HP, -5% speed | ✅ already strong — keep |
| Arcanist | laser, +12% dmg, -20 HP, +6% crit | ➕ start with 1 allocated notable `precision_nA` (Deadeye +6% crit) instead of gateway only — glass cannons should feel crunchy from turn 1 |
| Ranger | shotgun, +12% speed, +6% fire rate | ✅ keep, gateway gives +2% fire rate bonus |
| Prospector | orbital, +80 gold, +5% speed | ➕ start with "1 free pickup magnet" (extra pickup radius minor node `fortune_pod1`) |
| Reaver | spear, +35 HP, +5% dmg | ✅ keep |
| Brawler | cleaver, +40 HP, +12 armor, +6% speed | ✅ keep |

*Note: Arcanist getting `precision_nA` pre-allocated (not just `precision_gate`) is a bigger
gift — consider only if testing shows Arcanist feels too weak early. Start with just gateway
for all, see how it feels.*

### Fix 3 — Class blurb polish (docs pass only, zero risk)

The blurbs are good but verbose. Tighter versions for the pick screen:

```
Gunner    → "All-rounder. Starts at the hub — go any direction. Gold to build what you choose."
Berserker → "Crashing Maul. Heavy overhead slams. Raw damage, huge knockback. Build into MIGHT."
Arcanist  → "Beam Rifle. Piercing laser. Glass cannon — high crit, low HP. Build into PRECISION."
Ranger    → "Scatter Gun. Wide spread. Mobile skirmisher — fast fire, fast feet. Build into ALACRITY."
Prospector→ "Orbital Grind. Satellites do the work. Economy class — gold snowballs. Build into FORTUNE."
Reaver    → "Piercing Lance. Run-them-through thrusts. Lifesteal sustain. Build into VITALITY."
Brawler   → "Brawler's Cleaver. Fast sweeping cleaves. Walk into it, let armor punish. Build into AEGIS."
```

---

## Part 2 — Achievement System

### Core concept

**Meta-progression that unlocks catalog items.** Items in the catalog gain an optional
`achievementId` field. When locked, they don't appear in the shop. Completing the linked
achievement permanently unlocks them across all future runs. Progress lives in localStorage
(`roguelite_achievements`).

### Data model

**`types.ts` — Item interface addition:**
```typescript
achievementId?: string;   // if set, this item is locked until the achievement is earned
```

**New file `AchievementSystem.ts`:**
```typescript
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;                   // what to do
  icon: string;
  rewardItemIds: string[];        // items this unlocks
  rewardHint: string;             // spoiler-free hint shown before unlock ("???" items)
  check: (stats: RunStats) => boolean;  // evaluated at game-over
}

export interface RunStats {
  classId: string;
  wavesReached: number;
  totalKills: number;
  bossesKilled: number;
  totalGoldEarned: number;
  maxGoldAtOnce: number;
  totalLifestealHpHealed: number;
  totalThornsDamageDealt: number;
  itemsBought: number;
  runDurationMs: number;
  hp_at_wave_end: Record<number, number>;  // HP at end of each wave (for glass cannon checks)
}

const STORAGE_KEY = 'roguelite_achievements';

export class AchievementSystem {
  private unlocked: Set<string>;

  constructor() {
    const raw = localStorage.getItem(STORAGE_KEY);
    this.unlocked = raw ? new Set(JSON.parse(raw)) : new Set();
  }

  isUnlocked(achievementId: string): boolean {
    return this.unlocked.has(achievementId);
  }

  checkAll(stats: RunStats): AchievementDef[] {
    // Returns achievements newly earned this run.
    const newlyEarned: AchievementDef[] = [];
    for (const def of ACHIEVEMENTS) {
      if (!this.unlocked.has(def.id) && def.check(stats)) {
        this.unlocked.add(def.id);
        newlyEarned.push(def);
      }
    }
    if (newlyEarned.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.unlocked]));
    }
    return newlyEarned;
  }

  // Returns item IDs unlocked so far (for shop filter).
  unlockedItemIds(): Set<string> {
    const ids = new Set<string>();
    for (const def of ACHIEVEMENTS) {
      if (this.unlocked.has(def.id)) {
        for (const id of def.rewardItemIds) ids.add(id);
      }
    }
    return ids;
  }
}
```

### Achievement definitions

**Class masteries** (one per class, progressively harder):

| ID | Name | Trigger | Reward item | Slot | Why synergistic |
|---|---|---|---|---|---|
| `gunner_mastery` | The Flexible | Reach wave 8 as Gunner | `tactical_scope` | ring | +8% crit, +20 auto-aim range — rewards the flexible build |
| `berserker_mastery` | Trial by Blood | Kill a boss as Berserker | `warlord_pauldrons` | torso | +15% dmg, execute at 10% — stacks with MIGHT tree |
| `arcanist_mastery` | Glass Calculation | Reach wave 10 as Arcanist with ≤60 HP | `void_prism` | amulet | +60% crit dmg, -15 max HP — doubles down on the glass cannon |
| `ranger_mastery` | Never Stop Moving | Reach wave 8 as Ranger | `windwalker_boots_rare` | feet | +18% speed, +8% fire rate — the Ranger identity item |
| `prospector_mastery` | Midas Touch | Have 400+ gold at once as Prospector | `lucky_hares_foot` | ring | +30% gold, +5% XP — snowball amplifier |
| `reaver_mastery` | Blood Covenant | Lifesteal 150+ HP in one run as Reaver | `sanguine_gorget` | amulet | +10% lifesteal, +30 HP — the signature Reaver item |
| `brawler_mastery` | Untouchable | Reflect 200+ thorns damage in one run as Brawler | `ironback_carapace` | torso | +40% thorns, +8 armor — the tanking fantasy item |

**General achievements:**

| ID | Name | Trigger | Reward item | Slot |
|---|---|---|---|---|
| `first_boss` | Boss Slayer | Kill your first boss | `trophy_helm` | head | (+5 armor, +10 max HP — first meta-milestone) |
| `survivor_i` | Survivor I | Reach wave 5 (any class) | `veteran_badge` | amulet | (+4% dmg, +10 max HP — a solid basic item) |
| `survivor_ii` | Survivor II | Reach wave 10 (any class) | `elite_badge` | amulet | (+8% dmg, +20 max HP — replaces veteran's badge) |
| `blood_bath` | Blood Bath | Kill 1000 total enemies (cumulative across runs) | `reapers_sigil` | ring | (+execute at 8% HP, +5% crit — a late-game ring) |
| `speed_runner` | Sprint | Reach wave 5 in under 3:30 | `mercury_boots` | feet | (+22% speed — the fastest boots in the game) |
| `collector` | Hoarder | Buy 10+ items in one run | `treasure_map` | head | (+25% gold, +10% XP — rewards shopping builds) |
| `glass_cannon` | Glass Cannon | Reach wave 10 with ≤40 max HP at game start | `fragile_power` | amulet | (+70% crit dmg, -20 max HP — the ultimate glass cannon reward) |
| `all_classes` | Renaissance | Reach wave 5 with all 7 classes | `crown_of_crowns` | head | (+6% to all stats — the prestige item) |

### New catalog items to add (locked until achievements)

Each item below goes into `catalog.ts` with `unlocked: false` + `achievementId`.
These are high-impact items that would be overpowered in the base pool — gating them
behind achievement progression keeps the base game balanced.

```typescript
// ---- ACHIEVEMENT-GATED ITEMS ---- //

// gunner_mastery → tactical_scope
{
  id: 'tactical_scope',
  name: "Tactical Scope",
  description: "Fine-tuned optics: more range, more precision.",
  achievementId: 'gunner_mastery',
  unlocked: false,
  slot: 'ring',
  rarity: 'rare',
  tier: ItemTier.Uncommon,
  cost: 42,
  icon: '🔭',
  tags: ['gun', 'crit'],
  critChanceBonus: 0.08,
  // Also extend auto-aim range — requires a new `aimRangeBonus` stat field,
  // OR implement as: pickupMult as a proxy for coverage (simpler, shipping first).
  damageMult: 1.05,
},

// berserker_mastery → warlord_pauldrons
{
  id: 'warlord_pauldrons',
  name: "Warlord's Pauldrons",
  description: "The veteran's shoulders. Crush those who dare to last.",
  achievementId: 'berserker_mastery',
  unlocked: false,
  slot: 'torso',
  rarity: 'rare',
  tier: ItemTier.Uncommon,
  cost: 50,
  icon: '⚔️',
  tags: ['damage', 'execute'],
  damageMult: 1.15,
  executeThreshold: 0.10,   // *needs executeThreshold item field* (or absorb via triggerOnCondition)
},

// arcanist_mastery → void_prism
{
  id: 'void_prism',
  name: "Void Prism",
  description: "Refracts attacks into lethal geometry. Brittle beyond words.",
  achievementId: 'arcanist_mastery',
  unlocked: false,
  slot: 'amulet',
  rarity: 'legendary',
  tier: ItemTier.Rare,
  cost: 60,
  icon: '🔷',
  tags: ['crit'],
  critMultMult: 1.60,
  maxHealthBonus: -15,
},

// ranger_mastery → windwalker_boots_rare
{
  id: 'windwalker_boots_rare',
  name: "Windwalker's Boots",
  description: "You are the wind. Never caught, always firing.",
  achievementId: 'ranger_mastery',
  unlocked: false,
  slot: 'feet',
  rarity: 'rare',
  tier: ItemTier.Uncommon,
  cost: 44,
  icon: '🌬️',
  tags: ['speed', 'gun'],
  speedMult: 1.18,
  fireRateMult: 1.08,
},

// prospector_mastery → lucky_hares_foot
{
  id: 'lucky_hares_foot',
  name: "Lucky Hare's Foot",
  description: "Every coin finds you. Every lesson speeds you.",
  achievementId: 'prospector_mastery',
  unlocked: false,
  slot: 'ring',
  rarity: 'rare',
  tier: ItemTier.Uncommon,
  cost: 46,
  icon: '🐇',
  tags: ['gold', 'xp'],
  goldMult: 1.30,
  xpMult: 1.05,
},

// reaver_mastery → sanguine_gorget
{
  id: 'sanguine_gorget',
  name: "Sanguine Gorget",
  description: "Drink deep. You were never meant to die.",
  achievementId: 'reaver_mastery',
  unlocked: false,
  slot: 'amulet',
  rarity: 'rare',
  tier: ItemTier.Uncommon,
  cost: 48,
  icon: '🧣',
  tags: ['lifesteal', 'hp'],
  lifestealFraction: 0.10,
  maxHealthBonus: 30,
},

// brawler_mastery → ironback_carapace
{
  id: 'ironback_carapace',
  name: "Ironback Carapace",
  description: "Touch it and suffer. Every hit is a mistake for the attacker.",
  achievementId: 'brawler_mastery',
  unlocked: false,
  slot: 'torso',
  rarity: 'rare',
  tier: ItemTier.Uncommon,
  cost: 52,
  icon: '🦔',
  tags: ['thorns', 'armor'],
  thornsFraction: 0.40,
  armorBonus: 8,
},

// first_boss → trophy_helm
{ id: 'trophy_helm', name: "Trophy Helm", description: "Proof you've slain something greater.", achievementId: 'first_boss', unlocked: false, slot: 'head', rarity: 'uncommon', tier: ItemTier.Common, cost: 28, icon: '🏆', tags: ['hp', 'armor'], maxHealthBonus: 10, armorBonus: 5 },

// survivor_i → veteran_badge
{ id: 'veteran_badge', name: "Veteran's Badge", description: "You've seen wave 5. Most don't.", achievementId: 'survivor_i', unlocked: false, slot: 'amulet', rarity: 'uncommon', tier: ItemTier.Common, cost: 22, icon: '🎖️', tags: ['damage', 'hp'], damageMult: 1.04, maxHealthBonus: 10 },

// survivor_ii → elite_badge
{ id: 'elite_badge', name: "Elite Badge", description: "Wave 10. The game respects you now.", achievementId: 'survivor_ii', unlocked: false, slot: 'amulet', rarity: 'rare', tier: ItemTier.Uncommon, cost: 40, icon: '🏅', tags: ['damage', 'hp'], damageMult: 1.08, maxHealthBonus: 20 },

// blood_bath → reapers_sigil
{ id: 'reapers_sigil', name: "Reaper's Sigil", description: "1000 lives ended. It remembers.", achievementId: 'blood_bath', unlocked: false, slot: 'ring', rarity: 'rare', tier: ItemTier.Uncommon, cost: 44, icon: '💀', tags: ['execute', 'crit'], executeThreshold: 0.08, critChanceBonus: 0.05 },

// speed_runner → mercury_boots
{ id: 'mercury_boots', name: "Mercury's Boots", description: "Outlawed in three provinces for fire safety reasons.", achievementId: 'speed_runner', unlocked: false, slot: 'feet', rarity: 'legendary', tier: ItemTier.Rare, cost: 60, icon: '⚡', tags: ['speed'], speedMult: 1.22 },

// collector → treasure_map
{ id: 'treasure_map', name: "Treasure Map", description: "Shop visits pay double dividends.", achievementId: 'collector', unlocked: false, slot: 'head', rarity: 'rare', tier: ItemTier.Uncommon, cost: 36, icon: '🗺️', tags: ['gold', 'xp'], goldMult: 1.25, xpMult: 1.10 },

// glass_cannon → fragile_power
{ id: 'fragile_power', name: "Fragile Power", description: "One HP left. Still the most dangerous thing in the room.", achievementId: 'glass_cannon', unlocked: false, slot: 'amulet', rarity: 'legendary', tier: ItemTier.Rare, cost: 65, icon: '🪩', tags: ['crit'], critMultMult: 1.70, maxHealthBonus: -20 },

// all_classes → crown_of_crowns
{ id: 'crown_of_crowns', name: "Crown of Crowns", description: "Mastered all paths. This belongs to you.", achievementId: 'all_classes', unlocked: false, slot: 'head', rarity: 'legendary', tier: ItemTier.Rare, cost: 75, icon: '👑', tags: ['damage', 'speed', 'crit'], damageMult: 1.06, speedMult: 1.06, critChanceBonus: 0.06 },
```

### RunStats tracking — what needs to be captured

These fields need to accumulate during a run and be passed to `achievementSystem.checkAll(stats)` at game-over:

| Field | Where to increment | Notes |
|---|---|---|
| `classId` | `Game.applyClass()` | Already set |
| `wavesReached` | wave completion handler | Already tracked |
| `totalKills` | `Player` on enemy death | May exist; confirm |
| `bossesKilled` | enemy death, check `typeData.isBoss` | Already fixed (Jul 7 boss-kill bug) |
| `totalGoldEarned` | `Player.addGold()` | Needs cumulative counter |
| `maxGoldAtOnce` | `Player.addGold()` | `Math.max(maxGoldAtOnce, this.gold)` |
| `totalLifestealHpHealed` | lifesteal calc in `Player` | Accumulate healed amount |
| `totalThornsDamageDealt` | thorns reflect calc | Accumulate reflected damage |
| `itemsBought` | shop purchase handler | Count purchases |
| `runDurationMs` | `Date.now()` diff from run start | Simple |
| `hp_at_wave_end` | end-of-wave handler | Record `player.hp` per wave |

Most of these are straightforward accumulators. `lifesteal_healed` and `thorns_dealt` are new — they need to be added where those calcs happen in `Player.ts`.

### UI considerations

**Game-over screen:** After the wave-summary, if any achievements were newly earned, show an "Achievement Unlocked!" panel with the achievement name, icon, and the item it unlocks. Slide in below the run stats.

**Shop:** Items with `unlocked: false` (or `unlocked: false && achievementId`) don't appear. Could optionally show a "???" slot with the achievement hint — but start without this (simpler, less cluttered).

**Menu:** Add a "Trophies" button on the main menu screen that opens an achievements grid (earned = bright, unearned = grayed out with hint). Simple 2-column grid, no separate screen needed — overlay or tab on the existing menu.

---

## Implementation sequence (Jul 8+)

**Session 1 — RunStats + AchievementSystem skeleton:**
1. Create `AchievementSystem.ts` with definitions + localStorage save/load
2. Add RunStats accumulation to `Player.ts` + `Game.ts`
3. Wire `achievementSystem.checkAll(stats)` at game-over

**Session 2 — Locked items + class pre-alloc:**
4. Add `achievementId` field to `Item` type in `types.ts`
5. Add all achievement-gated items to `catalog.ts` (with `unlocked: false`)
6. Filter shop to only show items where `!item.achievementId || achievementSystem.isUnlocked(item.achievementId)`
7. Implement gateway pre-allocation in `SkillTree.ts`

**Session 3 — UI:**
8. Achievement popup on game-over screen
9. Trophies panel on main menu (simple grid)

**Session 4 — Polish:**
10. Blurb text pass on starting classes (shorter, punchier)
11. Balance pass on achievement-gated item stats

---

*Files this implementation touches: `AchievementSystem.ts` (new), `types.ts`, `catalog.ts`,
`SkillTree.ts`, `Player.ts`, `Game.ts`, `GameOverScreen.ts` (or wherever the game-over UI
lives), `Menu.ts` (or equivalent).*
