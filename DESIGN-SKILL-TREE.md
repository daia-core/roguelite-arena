# Design — Skill Tree (replaces the level-up item pick)

**Requested by Felix, 2026-07-05.** Two steps in one thread: first "level-ups interrupt
gameplay mid-wave" (fixed by banking picks and draining them at the between-waves shop),
then "rework the level-up system so it uses a skill tree instead." This doc is the second:
the between-waves item-pick becomes a **persistent skill tree** the player invests points in.

## Goal & feel

- Each level-up grants **1 skill point** (SP) instead of a 1-of-3 item offer. The baseline
  per-level stat bump (+2 dmg / +10 HP in `Player.levelUp`) is unchanged — the tree is the
  *chooseable* reward layer that the item-pick used to be.
- Points **bank** during a wave (no mid-wave interruption — same rule Felix set) and are spent
  on a **between-waves tree screen**. The tree is also reopenable from the shop, so a player can
  save points and spend later.
- Progression is **persistent within the run** (nodes stay bought), giving the deliberate
  build-a-character feel Felix asked for, versus the old random per-level pick.

## Where it plugs in (mirror the artifact pattern)

`PlayerStats` already folds Artifact bonuses via identity-default fields (`artifactDamageMult`
= 1, `artifactMaxHealthBonus` = 0, …) read inside the getters. The skill tree does **exactly
the same**: a `SkillTree` instance owns the node ranks and exposes an aggregated bonus bundle;
`PlayerStats` gains a matching `skill*` field set (identity defaults) that the getters multiply
/ add in right beside the artifact line. Items, duos, transformations, artifacts are untouched.

Bonus fields added to PlayerStats (identity defaults, so a run that spends no points behaves
exactly as before):

| field | default | applied in |
|---|---|---|
| `skillDamageMult` | 1 | getDamage |
| `skillFireRateMult` | 1 | getFireRate |
| `skillCritChanceBonus` | 0 | getCritChance |
| `skillCritMultMult` | 1 | getCritMultiplier |
| `skillMaxHealthBonus` | 0 | getMaxHealth |
| `skillArmorBonus` | 0 | getArmor |
| `skillSpeedMult` | 1 | getSpeed |
| `skillRegenBonus` | 0 | getHealthRegen |
| `skillXpMult` | 1 | XP grant (Game.grantXP) |
| `skillPickupMult` | 1 | pickup radius |
| `skillGoldMult` | 1 | gold grant |

`SkillTree.recomputeInto(stats)` writes all of these from the current node ranks; called on
every point spend and on run start (reset).

## The tree

Three branches so the player picks an identity but can splash. Mobile-first: each branch is a
short vertical chain (a node unlocks when its **parent has ≥1 rank**), rendered as a column.

**OFFENSE** (red)
1. Sharpened — +8% damage / rank (max 5)
2. Rapid Fire — +6% fire rate / rank (max 5)  [needs Sharpened ≥1]
3. Deadeye — +4% crit chance / rank (max 5)   [needs Rapid Fire ≥1]
4. Executioner — +25% crit damage / rank (max 4) [needs Deadeye ≥1]

**DEFENSE** (blue)
1. Vitality — +20 max HP / rank (max 5)
2. Ironhide — +2 armor / rank (max 5)         [needs Vitality ≥1]
3. Regeneration — +0.5 HP/s / rank (max 5)    [needs Ironhide ≥1]
4. Bulwark — +6% max HP AND +1 armor / rank (max 4) [needs Regeneration ≥1]

**UTILITY** (green)
1. Swift — +5% move speed / rank (max 5)
2. Greed — +10% gold / rank (max 5)           [needs Swift ≥1]
3. Scholar — +8% XP / rank (max 5)            [needs Greed ≥1]
4. Magnet — +15% pickup radius / rank (max 5) [needs Scholar ≥1]

Every node is a numeric rank (no boolean keystones in v1 — keeps the aggregation and the UI
trivial and safe; keystones can come later). Costs are 1 SP/rank flat in v1.

## Flow / state changes in Game.ts

- Rename the owed-pick counter concept: `pendingLevelups` → still counts owed *points*, but
  instead of opening an item screen it just increments `playerStats.skillTree.availablePoints`.
  Simplest: on level-up, `skillTree.availablePoints++` (no separate queue needed — points are
  fungible, unlike the old per-level item roll).
- New state `'skilltree'` replacing `'levelup'` in the union, the update switch, and the draw
  switch. `drawLevelup`/`updateLevelup` are removed; `drawSkillTree`/`updateSkillTree` added.
- At the between-waves break (`enterShop`), if `availablePoints > 0`, open the tree first
  (like the old `levelupReturnsToShop` drain) — spending is optional, a "Continue" button lands
  on the shop. A "Skills" button in the shop reopens the tree so banked points can be spent
  later.
- Reset on run start: `skillTree.reset()` + `recomputeInto(stats)`.

## Files

- **NEW `SkillTree.ts`** — node definitions, per-run rank state, `spend(nodeId)`,
  `canSpend(nodeId)`, `recomputeInto(stats)`, `reset()`, serialization for save (optional v1:
  ranks persist in the run save so a resumed run keeps the tree).
- **`ItemSystem.ts`** — add the `skill*` bonus fields + fold them into the getters; hold a
  `skillTree` reference (or keep the tree in Game and only push bonuses in — chosen: tree lives
  in Game, writes bonuses into PlayerStats, so ItemSystem has zero import cycle).
- **`Game.ts`** — state swap, SP grant on level-up, tree screen draw/update, shop "Skills"
  button, reset wiring, save/load of ranks.

## Out of scope for v1 (note for later)

- Keystone/toggle nodes (e.g. "crits chain to a second target").
- Respec / refund.
- Meta-persistent tree across runs (this is per-run, like items).
