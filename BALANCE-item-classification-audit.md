# Item classification & balance audit — trinket vs equip

**Date:** 2026-07-06 (night) · **Trigger:** Felix — *"review all existing items to see if they should stay as trinkets or be equip items, and review the balance of the game in multiple ways."*
**Status:** ANALYSIS ONLY — no code shipped. The working tree is mid-edit by the concurrent PoE skill-tree build (Game.ts/SkillTree.ts/main.ts hot), so reclassification + tuning are **deferred to a clean tree** and captured as a task. This doc is the plan.

**One-line verdict:** The trinket/equip split is not just cosmetic — it *is* the missing structural balance lever. Today **~80% of items are unlimited-stacking trinkets**, and the build-defining *offense multipliers* live almost entirely on them, so the multiplicative-offense runaway (Felix's 2.3M/projectile) is fed by design. Promoting the multiplier items into the 8 equip slots bounds the stack by slot count instead of by wallet — the honest complement to the post-hoc damage soft-knee.

---

## Part A — The census (what is a trinket today)

`classifyItemSlot` (items/types.ts) makes an item **equip gear** only if it declares an explicit `slot`, a `weaponType`, or `shield`. Everything else falls through to **`trinket`** = unlimited stacking, no slot, no opportunity cost.

| Bucket | Count | Governed by the 8-slot system? |
|---|---|---|
| Explicit gear (head/torso/legs/feet/ring/amulet) | ~37 | ✅ yes (1 per slot, rings ×2) |
| Weapons (`weaponType`) + shields | ~14 | ✅ yes (weapon/offhand) |
| **Trinkets (no slot)** | **~211** | ❌ **no — buy infinite copies** |

So the equipment rework governs **under 20%** of the roster. The other ~80% has zero cap.

### The offense multipliers are overwhelmingly trinkets

Count of **trinket** items carrying each build-defining field (each buyable in unlimited copies, each stacking multiplicatively):

- damageMultiplier **×25** · fireRateMultiplier **×25** · speedMultiplier ×24
- meleeDamageMult ×21 · elementalDamageMult ×17 · rangedDamageMult ×15
- critChance ×16 · critDamageMultiplier ×7 · **multishot ×11** · piercing ×9
- maxHealthBonus ×26 · armor ×18 · lifesteal ×15 · dodge ×9 (defense side, same story)

This is the multiplicative-offense engine in one table: ~50+ distinct offense-multiplier trinkets, none slot-limited.

### Thematic mismatch — 25 trinkets are *named* like worn gear

These read as equipment but stack infinitely, which is exactly the confusion Felix flagged earlier ("make it clear if an item is a trinket or for a specific slot"):

> Iron Ring · Steel Band · Vitality Ring · Ring of Widening · Health Pendant · Swift Gloves · Rapid Gauntlets · Impact/Titan Gauntlets · Shockwave Gloves · Worn/Windwalker/Blink Boots · Leather Vest · Spiked/Thorny/Vampire/Evasive Armor · Armor Plating · Stalwart Plate · Evasion/Phantom Cloak · Bomb Bandolier · Armor-Piercing Rounds · Cryo Capacitor

A "Ring" that isn't a ring and a "Pendant" that isn't an amulet is both a UX smell and a balance hole.

---

## Part B — Classification *is* the balance lever (the synthesis)

The existing enemy-scaling review (`BALANCE-enemy-scaling-review.md`) proved twice that **you cannot scale fodder HP to catch a fully multiplicative build** without destroying the early game, and concluded the only real fix is *bounding offense*. A damage soft-knee shipped for that (`PlayerStats.DMG_DR_KNEE = 60`, compresses the item damage product above 60×).

**But the knee only tames ONE of seven multiplicative layers.** `getDamage()` is:

```
baseDamage
  × softKnee(itemDamageMult)      ← only this layer is kneed
  × specializationBonus
  × transformationBonus
  × duoBonus
  × artifactMult × runtimeMult
  × skillDamageMult               (then per-type / crit / fireRate / multishot layer on top)
```

Every layer after the knee multiplies freely. So the knee slows the item layer but the *product* still explodes — the disease is structural, and the item layer's raw fuel is **unlimited multiplier trinkets**.

**The lever:** make the build-defining multipliers *equip items* instead of trinkets. If "+15% damage" costs a ring slot, you hold 2 rings + 1 amulet + a few armour pieces — the offense product is bounded by **slot count**, not by gold. That caps the runaway at the source, is thematically obvious (a ring goes in a ring slot), and makes the shop a *choice* (which multiplier do I slot?) instead of "buy all of them." It complements the knee rather than leaning on it.

**Design tension to respect:** the game deliberately courts "broken builds" (`RESEARCH-broken-build-roguelikes.md`), and Felix's framing ("scale up *enemies*") suggests he may *enjoy* the big-number fantasy. So this is presented as a **fork**, not a unilateral nerf (see recommendations).

---

## Part C — Balance reviewed multiple ways (quick multi-angle pass)

1. **Offense (root cause):** 7 uncapped multiplicative layers; only 1 kneed; fuelled by unlimited multiplier trinkets. → Part B lever + optionally knee the *aggregate* product, not just the item layer.
2. **Defense:** dodge capped 75%, armor ~90% mitigation, regen+shield+lifesteal → an established build is ~immortal to fodder (sim showed HP *rising* through waves 4-6). maxHealthBonus/armor/lifesteal/dodge are also unlimited trinkets — same unbounded-stack problem on the survival axis.
3. **Economy:** already tightened (gold cap ×10→×4, compounding prices from wave 3, discount caps). Flat per-kill gold vs compounding prices is healthy — leave it.
4. **Enemy curve:** already at v3 (linear × 1.18^(w-7) × 1.15^(w-10)); makes a *normal* build fight from wave 11+. Correct and shipped; do not push fodder HP further (proven dead end).
5. **Build diversity:** universality bleed (type multipliers cross-apply) is good — keeps items non-dead across weapons. Reclassifying multipliers to slots *increases* diversity (forces choices).

---

## Recommendations (prioritized) — all deferred until the tree lands

**Ship-safe (no taste call, do when tree is clean):**
- **R1 — Reclassify the 25 gear-named trinkets into their obvious slots** (Iron/Steel/Vitality Ring → `ring`; Health Pendant → `amulet`; Boots → `feet`; Vests/Armor/Plate → `torso`; Gloves/Gauntlets → they'll need a slot — see R2). Fixes theme + UX + bounds those stacks. Low risk: the slot machinery already exists.
- **R3 — Keep as trinkets, correctly:** flat utility / on-hit / economy items (xpMagnet, goldBonus, luck, small on-hit procs, consumable-style effects) genuinely *are* trinkets — unlimited stacking there is fine and fun. No change.

**Needs Felix's call (build-feel fork):**
- **R2 — Promote the *offense* multipliers (damage/fireRate/crit/multishot) to equip slots** to structurally bound the runaway. This is the real balance fix but it changes his power ceiling — same fork as the enemy-scaling doc's "bound offense" Option B. Options: (A) do it (bounded, choice-driven), (B) leave them trinkets and keep leaning on the knee + big enemies (big-number fantasy preserved).
- **R4 — If keeping unlimited offense trinkets:** move the soft-knee to wrap the *aggregate* `getDamage()` product (not just the item layer) so all 7 layers are compressed together. Reversible, tunable.

**Implementation note:** R1 is a `catalog.ts` edit (add `slot:` to 25 items) + a QA pass + deploy — all in cold files, but it needs a clean working tree to build/ship without sweeping up the concurrent skill-tree work. Hold until that commits.

---

## Addendum (2026-07-06, later) — duplicate item NAMES fixed (separate defect)

While cross-checking this audit against the live catalog, found a distinct, ship-safe bug the
census above didn't call out: **three pairs of shop items shared the exact same display name** with
different ids and effects, so the shop could show two visibly-identical cards that do **not** upgrade
each other (different id ⇒ a second stacking trinket, not a +1). Renamed the lower-tier variant of
each pair (higher/legendary keeps the canonical name):

- `chain_lightning_t3` "Storm Essence" (25% chain) → **Static Charge** (the `storm_essence_t3`
  "Storm Essence", 35% chain + explosions, keeps the name).
- `glass_cannon_t2` "Glass Cannon" (Uncommon, +80%/−30 HP) → **Brittle Edge** (`glass_cannon_t4`
  legendary keeps "Glass Cannon").
- `berserker_rage_t2` "Berserker Rage" (Uncommon, conditional) → **Battle Fury** (`berserker_rage_t4`
  legendary keeps "Berserker Rage").

After the rename, `catalog.ts` has **zero duplicate item names**. (Note: "Berserker Rage"/"Glass
Cannon" also exist as a Transformation and an Artifact respectively — different systems, thematic
reuse, not a shop-card collision — left as-is.) This is independent of the R1–R4 slot decisions and
was shipped as a standalone cleanup.
