# Shop + equipment rework v2 — 8 slots, 3-item shop, duplicate-buy upgrades

Felix's ask (2026-07-05, superseding the 4-slot Phase 2):

> Only offer 3 items at a time in the shop and rework the shop interface from scratch. Offer a
> variety of equippable items and trinkets. Equip slots should be **Weapon / Off-hand (disabled if
> using a 2h weapon) / Head / Amulet / Torso / Legs / Feet / Ring**. Make at least 20 of each type
> for different builds. Buying the same of an existing item you already have should **upgrade** it
> (e.g. buy two of the same amulet → higher tier; at later waves an "amulet +7" is offered = same as
> buying it 7 times). Handle it.

Felix is on vacation and not resolving design forks, so the calls below are **sensible documented
defaults** — all cheap to change later, flagged in the ship recap.

## Decisions taken

| Fork | Chosen default | Why |
|---|---|---|
| Upgrade scaling | **Linear — level N = N× the item's per-copy contribution** | Felix: "amulet +7 = same as buying it 7 times." Exact, predictable, no new balance surface. |
| Duplicate of an equipped/trinket item | **Upgrades the existing instance (+1 level), never a second copy or a swap** | This is what "buying the same item upgrades it" means. |
| Weapon slot count | **One Weapon slot + one Off-hand** (was Weapon A/B). A 2h weapon fills Weapon and **disables Off-hand**. | Felix's list has a single "Weapon" + "Off-hand (disabled if using 2h)". |
| Trinket box | **Kept** alongside the 8 slots | He said "variety of equippable items AND trinkets." Trinkets still stack/upgrade freely. |
| First-ship scope | **Vertical slice**: full 8-slot model + upgrade system + 3-item shop + rebuilt UI, with **6–8 items per new slot** end-to-end playable; fill each type to 20+ in follow-up passes | game-dev loop: ship playable, don't wait for playtest. |
| Higher rarity at later waves | Upgrade level itself IS the "higher tier". Later waves naturally offer more upgrade opportunities as you re-roll into items you own. No separate rarity-swap needed for v1. | Matches "amulet +7" being the late-game power, not a distinct legendary drop. |

## Slot taxonomy (v2 — 8 slots)

`EquipSlot` becomes the item's slot *category*; `EquipSlots` (the live loadout) has one holder each:

| Slot | Holds | Notes |
|---|---|---|
| `weapon` | a 1h or 2h weapon | a **2h** weapon disables `offhand` |
| `offhand` | shield / off-hand focus | disabled while a 2h weapon is equipped |
| `head` | helmets/hats | new gear class |
| `amulet` | necklaces/keystones | existing keystones move here |
| `torso` | body armor | new |
| `legs` | leg armor | new |
| `feet` | boots | new |
| `ring` | rings | new |

Everything not in a slot is a **trinket** (unlimited pile, stacks/upgrades).

`EquipSlot` values: `'weapon-1h' | 'weapon-2h' | 'offhand' | 'head' | 'amulet' | 'torso' | 'legs' |
'feet' | 'ring' | 'trinket'`. `classifyItemSlot()` maps `weapon-1h`/`weapon-2h` → the single
`weapon` holder; every other equip slot maps to its like-named holder.

## Upgrade model (the new mechanic)

- Runtime `Item` instances carry `upgradeLevel: number` (default 1). This is instance state on the
  **copy the player owns**, never on the shared catalog object (so we deep-clone on acquire).
- **Buy an item you already have** (same base id, whether equipped, in a slot, or a trinket) →
  `upgradeLevel += 1` on that instance instead of adding a new copy or swapping. UI shows `Name +N`
  (N = level).
- **Aggregation** multiplies each item's per-copy contribution by its `upgradeLevel`:
  - additive fields: `contribution × level` (e.g. `+15 maxHP` at +3 → `+45`).
  - multiplicative fields: applied `level` times (e.g. `×1.15 dmg` at +3 → `×1.15³`), which is the
    exact "bought it 3 times" result the old stacking gave.
  - booleans/`Math.max` fields: unchanged by level (a flag is a flag).
- Recycle/sell value of an upgraded item scales with its level (you invested N buys).
- Pricing: an upgrade buy costs the item's normal wave price (buying the Nth copy = Nth price).

## Files touched

- `items/types.ts` — expand `EquipSlot`; add `upgradeLevel?`; rewrite `classifyItemSlot`.
- `ItemSystem.ts` — `EquipSlots` → 8 holders; `addItem` upgrade-on-duplicate + 8-slot routing;
  `rebuildActiveItems`; aggregation `× upgradeLevel`; recycle scales with level; helpers
  (`getEquipment`, `hasTwoHandEquipped`, offhand-disabled check).
- `items/catalog.ts` — author 6–8 items each for head/torso/legs/feet/ring (+ tag existing gear).
- `Game.ts` — `SLOTS = 3`; rebuild the shop equipment strip for 8 slots + upgrade badges; buy flow
  passes through the upgrade path; keep tap-to-manage where it still applies.
- `qa-shop-8slot.mjs` — new headless QA: 8-slot routing, 2h disables offhand, upgrade-on-duplicate
  math, aggregation parity, recycle scaling, 3-item shop.

## Phasing

- **v2.0 (this ship):** model + upgrade + 3-item shop + rebuilt strip + 6–8 items/new-slot, QA, live.
- **v2.1+:** fill each slot type to 20+; slot-aware shop weighting; upgrade-level cosmetics/caps if
  balance needs it.

Each ship deploys + live-verifies + updates CHANGELOG.
