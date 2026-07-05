# Equipment rework — slots, stash, trinket box

Felix's ask (2026-07-05): rework the weapon/equipment system so gear is a **build decision**, not a
passive stat-pile.

> Only equip 2 weapons (or 1 two-handed) + shield, and 1 amulet etc. Convert some items into
> slot-only gear; buying one means selling/swapping your old one (but also keep a stash inventory for
> speculative pieces). Turn most current items into **trinkets** → a trinket box with unlimited
> stacking. Trinkets can be bought many times and don't need equipping.

## Decisions taken (Felix on vacation — defaults from his own description, noted for review)

| Fork | Chosen default | Why |
|---|---|---|
| Slot split | **Lean slots, big trinket box** | He said "most of the current items can be turned into trinkets." |
| Full-slot buy | **Auto-swap; displaced piece → stash** | He floated a stash "so you can keep some items for speculative builds." |
| Stash | **Small, run-only (8 slots)** | Tight decisions, mobile-friendly. |
| Rollout | **Phased, each playable** | game-dev loop = ship continuously, don't wait for playtest. |

All four are cheap to change later; flagged in the ship recap.

## Slot taxonomy

Equipment slots (each holds ONE item unless noted):

- **Weapon A**, **Weapon B** — two one-hand weapons, OR one two-hand weapon fills BOTH (and locks B).
- **Offhand** — a shield (or, later, an off-hand focus). A two-hand weapon does NOT block the offhand;
  a *shield* is offhand. (Rule: two-hand fills Weapon A+B; shield fills Offhand. You can run
  two-hand + shield, or 2× one-hand, or 1× one-hand + shield.)
- **Amulet** — one amulet/necklace.

Everything else is a **trinket**.

### What is a weapon / offhand / amulet vs a trinket

Driven by a new `slot` field on the item (explicit), with a fallback classifier for safety:

- `slot: 'weapon-1h'` — one-hand weapon. The current one-hand `weaponType` items
  (shotgun, orbital, the light blades). Fills Weapon A or B.
- `slot: 'weapon-2h'` — two-hand weapon. The heavy melee (Piercing Lance, Crashing Maul) + laser.
  Fills both weapon slots.
- `slot: 'offhand'` — the 4 `shield:true` items become offhand shields.
- `slot: 'amulet'` — a small curated set of build-defining legendary "keystone" items whose
  effect is a boolean flag (Fourleaf Charm, Soul Tithe) become amulets — powerful, one-at-a-time,
  so picking your keystone is a real choice. **Exclusion:** an item whose effect *accumulates* per
  copy (e.g. Ceremonial Daggers — `daggerCount += 3` each) must stay a trinket; making it a single
  slot would silently break its whole "buy more, get more" identity.
- `slot: 'trinket'` (default) — every remaining stat/effect item. Unlimited stacking, no equip.

The classifier (no `slot` set) infers: `weaponType` melee/laser → 2h; other `weaponType` → 1h;
`shield` → offhand; else trinket. So the catalog works even before every item is hand-tagged, and I
only hand-promote the amulet keystones.

## Model

`PlayerStats` gains an **equipment** layer alongside the existing `items[]`:

- `equipment: { weaponA, weaponB, offhand, amulet }` — each `Item | null`.
- `stash: Item[]` — run-only, cap 8. Holds displaced/speculative equipment.
- `trinkets: Item[]` — unlimited; the old `items[]` role for stacking stat items.

**Stat aggregation** must fold ALL of: equipped items + trinkets. The cleanest, lowest-risk approach:
keep `items[]` as the single aggregation source of truth (everything that is "active on the player"),
and have equip/unequip/stash move items in and out of `items[]`. So:

- Equipped 4 slots + all trinkets ARE in `items[]` (aggregation unchanged → all existing getters,
  QA, and balance keep working byte-identically for a given active set).
- `stash[]` items are NOT in `items[]` (inactive), so they don't contribute stats.
- The slot/trinket/stash structures are *views/indices* over ownership that decide what's allowed to
  be active at once.

This is the key insight that keeps the rework from rewriting the aggregation engine: **slots are an
admission-control layer in front of the existing `items[]`**, not a new stat path.

### Buy flow

1. Classify the bought item's slot.
2. **Trinket** → push to `trinkets[]` + `items[]` (stacks freely). Done.
3. **Equipment**, slot free → equip: set slot, push to `items[]`.
4. **Equipment**, slot full → **auto-swap**: displaced item leaves `items[]` → `stash[]` (if stash
   full, the displaced item is sold for its recycle value instead, with a note). New item equips.
5. Two-hand into Weapon A: if B occupied, B's item is displaced to stash too.

### Sell / unequip (player actions in shop)

- **Sell** an equipped/stashed/trinket item → remove from its home (+ from `items[]` if active),
  refund recycle value. (Replaces today's recycle button, generalised.)
- **Unequip** → move an equipped item to stash (frees the slot without selling).
- **Equip from stash** → move a stashed item into its slot (swapping the current occupant to stash).

## Phasing

- **Phase 1 (core, playable):** model + slot classification + buy routing (auto-swap→stash) +
  aggregation wiring + a read-only equipment/trinket/stash strip in the shop so you can SEE slots.
  QA: slot limits, two-hand, auto-swap-to-stash, trinket stacking, aggregation parity.
- **Phase 2 (interaction):** tap-to-sell / unequip / equip-from-stash UI on the shop screen; mobile
  layout pass; screenshots.
- **Phase 3 (polish/balance):** amulet keystone curation, shop-offer awareness of slots (don't spam
  weapons once both slots are committed), duo/trinket display cleanup.

Each phase deploys + live-verifies + updates CHANGELOG.
