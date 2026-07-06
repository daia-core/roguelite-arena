# Slot fill to 20 — the concrete 51-item batch (head/torso/legs/feet/ring)

Executes the **v2.1** line of `DESIGN-SHOP-8SLOT-REWORK.md`: Felix's explicit ask (2026-07-05) —
*"Make at least 20 of each type for different builds… offer a variety of equippable items and
trinkets."* Amulet is already at 20 (`am_*`, shipped Jul 6 `c91deb9`). This doc designs the
remaining five slots up to 20 each, paste-ready.

## Why this doc exists (and the discipline it respects)

The roguelite **content-budget gate** (`tools/roguelite-content-budget.py`) caps the game to **one
content commit per calendar day** — the guard against the feature-flood Felix questioned on Jul 4.
Jul 6's budget was spent by the amulet fill, so **no catalog content could ship the night this was
written**. But *designing* the items is not shipping them — this is a spec in `work/`, not a
`catalog.ts` write, so it spends no budget and pre-writes nothing into the live game. The pay-off:
when the budget is fresh, the fill is a **single clean batch commit** (copy the blocks in → tsc →
QA → deploy → verify), not 51 items improvised live. It also honours the reframe in the deep-work
queue: *"land the remaining items as ONE sanctioned batch, NOT one slot per night"* (dripping an
explicit request over five nights would be its own failure).

> **✅ MECHANICALLY VALIDATED — paste-ready (2026-07-06 ~06:2x).** All 51 items passed
> `node qa-catalog-integrity.mjs --spec DESIGN-SLOT-FILL-TO-20.md` (exit 0): every field is a real
> `Item` interface member (no tsc-breaker), **zero id collisions** and **zero name collisions** vs
> the live 278-item catalog and within the spec (the exact failure the amulet fill hit with 2 dup
> names), all tags/tiers/rarities valid, all required fields present, and **every slot totals exactly
> 20** (head 7+13, torso 14+6, legs 7+13, feet 10+10, ring 11+9, amulet 20+0). Tomorrow's batch is a
> clean paste, not a debug session. Re-run the gate on the budget-fresh day before pasting (in case
> the live catalog moved).

## Current counts (verified against `catalog.ts`, 2026-07-06)

| Slot | Have | Need to add | Target |
|---|---|---|---|
| head | 7 | **13** | 20 |
| torso | 14 | **6** | 20 |
| legs | 7 | **13** | 20 |
| feet | 10 | **10** | 20 |
| ring | 11 | **9** | 20 |
| amulet | 20 | 0 (done) | 20 |
| **total new** | | **51** | |

## Design rules applied

- **Only real `Item` fields** (verified against `items/types.ts`). Multiplier fields encode as
  `1.x` (`speedMultiplier`, `damageMultiplier`, `goldBonus`, `xpMagnet`, `fireRateMultiplier`,
  `meleeDamageMult`, `rangedDamageMult`, `elementalDamageMult`); rate fields as additive fractions
  (`critChance`, `dodge`, `burn`, `bleed`, `freeze`, `doom`, `wound`, `lifesteal`, `thorns`,
  conditional `*Power`/`*Damage`); flat fields as ints/floats (`armor`, `maxHealthBonus`,
  `healthRegen`).
- **Rarity → tier → cost band** (matches existing entries): `common`→`ItemTier.Common` (9–13) ·
  `rare`→`ItemTier.Uncommon` (18–28) or `ItemTier.Rare` (30–46) · `epic`→`ItemTier.Rare` (40–55)
  · `legendary`→`ItemTier.Legendary` (66–80).
- **Build-archetype spread per slot**, so 20 items ≠ 20 stat-sticks. Coverage targets:
  crit/ranged · melee/berserker · DoT/status (burn/bleed/doom/wound/freeze) · tank/defensive ·
  speed/evasion · economic (gold/luck/interest) · conditional (last-stand/grindstone/killing-spree/
  miser) · one glass-cannon or keystone per slot at legendary.
- **Slot identity kept** (so a slot still *means* something) but not purity-locked: torso leans
  defensive, legs/feet lean mobility, ring leans offensive, head leans crit/utility/caster — each
  gets 2–3 off-theme picks for cross-build flexibility, exactly like the amulet set.
- Every `id` is new (no collision with existing prefixes/trinket ids). Icons are single emoji,
  distinct within-slot.

> **Note on the "higher rarity at later waves (amulet +7)" mechanic:** that is the **upgrade-level**
> system already shipped (v2.0) — buying a duplicate raises `upgradeLevel`, rendered `Name +N`. It
> is *not* a separate set of higher-rarity item entries, so this fill does not need "+N" variants;
> the 20 base items each upgrade in place.

---

## HEAD (+13 → 20)

Existing: leather_cap, focus_hood, scholar_hat, iron_helm, lucky_crown, visor_of_wrath, mind_diadem
(hp / crit / pickup / armor / luck / crit-crit / doom). Additions broaden into ranged, DoT, fire,
economic, conditional, glass-cannon.

```ts
    { id: 'head_hunters_hood', name: "Hunter's Hood", description: '+10% ranged damage', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '🪖', unlocked: true, tags: ['ranged'], slot: 'head', rangedDamageMult: 1.1 },
    { id: 'head_bone_mask', name: 'Bone Mask', description: '+7% bleed chance', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '💀', unlocked: true, tags: ['melee'], slot: 'head', bleed: 0.07 },
    { id: 'head_padded_coif', name: 'Padded Coif', description: '+12 max health and +1 armor', rarity: 'common', tier: ItemTier.Common, cost: 12, icon: '🧣', unlocked: true, tags: ['defensive'], slot: 'head', maxHealthBonus: 12, armor: 1 },
    { id: 'head_keen_goggles', name: 'Keen Goggles', description: '+7% crit chance', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🥽', unlocked: true, tags: ['ranged'], slot: 'head', critChance: 0.07 },
    { id: 'head_emberglass_visor', name: 'Emberglass Visor', description: '+13% chance to ignite', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🔥', unlocked: true, tags: ['elemental'], slot: 'head', burn: 0.13 },
    { id: 'head_gilded_circlet', name: 'Gilded Circlet', description: '+18% gold earned', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🪙', unlocked: true, tags: ['economic'], slot: 'head', goldBonus: 1.18 },
    { id: 'head_windcaller_hood', name: 'Windcaller Hood', description: '+10% move speed and +8% dodge', rarity: 'rare', tier: ItemTier.Rare, cost: 32, icon: '🌬️', unlocked: true, tags: ['utility'], slot: 'head', speedMultiplier: 1.1, dodge: 0.08 },
    { id: 'head_warhelm', name: 'Warhelm', description: '+6 armor and +15 max health', rarity: 'rare', tier: ItemTier.Rare, cost: 34, icon: '🪓', unlocked: true, tags: ['defensive'], slot: 'head', armor: 6, maxHealthBonus: 15 },
    { id: 'head_predators_crown', name: "Predator's Crown", description: '+12% crit chance and +15% ranged damage', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '🦅', unlocked: true, tags: ['ranged'], slot: 'head', critChance: 0.12, rangedDamageMult: 1.15 },
    { id: 'head_plague_veil', name: 'Plague Veil', description: '+15% ignite and +10% wound (amplifies all DoT)', rarity: 'epic', tier: ItemTier.Rare, cost: 52, icon: '🎭', unlocked: true, tags: ['elemental'], slot: 'head', burn: 0.15, wound: 0.1 },
    { id: 'head_stormcrown', name: 'Stormcrown', description: '+15% chain-lightning chance and +8% fire rate', rarity: 'epic', tier: ItemTier.Rare, cost: 52, icon: '🌩️', unlocked: true, tags: ['elemental'], slot: 'head', chainLightning: 0.15, fireRateMultiplier: 1.08 },
    { id: 'head_crown_of_avarice', name: 'Crown of Avarice', description: '+30% gold, +10% luck and +6% banking interest', rarity: 'legendary', tier: ItemTier.Legendary, cost: 74, icon: '👑', unlocked: true, tags: ['economic'], slot: 'head', goldBonus: 1.3, luck: 0.1, interestBonus: 0.06 },
    { id: 'head_martyrs_halo', name: "Martyr's Halo", description: '+28% damage but -15 max health — a glass-cannon crown', rarity: 'legendary', tier: ItemTier.Legendary, cost: 78, icon: '😇', unlocked: true, tags: ['ranged'], slot: 'head', damageMultiplier: 1.28, maxHealthBonus: -15 },
```

## TORSO (+6 → 20)

Existing 14 lean fully defensive. Additions keep two defensive fills but add a bruiser, a caster
torso, and a last-stand conditional, so torso is no longer a mono-archetype.

```ts
    { id: 'torso_leather_jerkin', name: 'Leather Jerkin', description: '+8 max health and +4% dodge', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '🧥', unlocked: true, tags: ['defensive'], slot: 'torso', maxHealthBonus: 8, dodge: 0.04 },
    { id: 'torso_bramble_hauberk', name: 'Bramble Hauberk', description: '+18% thorns reflect and +10 max health', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '🌵', unlocked: true, tags: ['defensive'], slot: 'torso', thorns: 0.18, maxHealthBonus: 10 },
    { id: 'torso_soulweave_robe', name: 'Soulweave Robe', description: '+10% elemental damage and +15 max health', rarity: 'epic', tier: ItemTier.Rare, cost: 46, icon: '🥻', unlocked: true, tags: ['elemental'], slot: 'torso', elementalDamageMult: 1.1, maxHealthBonus: 15 },
    { id: 'torso_warlords_plate', name: "Warlord's Plate", description: '+25 max health and +12% melee damage', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '🏋️', unlocked: true, tags: ['melee'], slot: 'torso', maxHealthBonus: 25, meleeDamageMult: 1.12 },
    { id: 'torso_second_wind_cuirass', name: 'Second-Wind Cuirass', description: 'While HP is low: +damage and +fire rate; +20 max health', rarity: 'rare', tier: ItemTier.Rare, cost: 44, icon: '🫀', unlocked: true, tags: ['defensive'], slot: 'torso', lowHpPower: 0.4, maxHealthBonus: 20 },
    { id: 'torso_titan_carapace', name: 'Titan Carapace', description: '+50 max health, +10 armor and +1 HP/sec', rarity: 'legendary', tier: ItemTier.Legendary, cost: 78, icon: '🦂', unlocked: true, tags: ['defensive'], slot: 'torso', maxHealthBonus: 50, armor: 10, healthRegen: 1 },
```

## LEGS (+13 → 20)

Existing: travel_pants, greaves, dancer_leggings, windrunner, phase_trousers, titan_legplates,
stormstride (speed / armor+hp / dodge / speed / dodge+speed / hp+armor / speed+dodge). Additions add
ranged-kite, vamp-mobility, DoT-mobility, berserker, evasion, tank, and a grindstone conditional.

```ts
    { id: 'legs_padded_breeches', name: 'Padded Breeches', description: '+12 max health', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '🩳', unlocked: true, tags: ['defensive'], slot: 'legs', maxHealthBonus: 12 },
    { id: 'legs_scout_trousers', name: 'Scout Trousers', description: '+9% move speed', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '🥾', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.09 },
    { id: 'legs_quick_kilt', name: 'Quick Kilt', description: '+6% dodge chance', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '🎽', unlocked: true, tags: ['utility'], slot: 'legs', dodge: 0.06 },
    { id: 'legs_hunters_chaps', name: "Hunter's Chaps", description: '+8% ranged damage and +6% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '👖', unlocked: true, tags: ['ranged'], slot: 'legs', rangedDamageMult: 1.08, speedMultiplier: 1.06 },
    { id: 'legs_ironbound_leggings', name: 'Ironbound Leggings', description: '+4 armor and +8% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '⛓️', unlocked: true, tags: ['defensive'], slot: 'legs', armor: 4, speedMultiplier: 1.08 },
    { id: 'legs_bloodrunner_leggings', name: 'Bloodrunner Leggings', description: '+6% lifesteal and +8% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 27, icon: '🩸', unlocked: true, tags: ['melee'], slot: 'legs', lifesteal: 0.06, speedMultiplier: 1.08 },
    { id: 'legs_gale_greaves', name: 'Gale Greaves', description: '+16% move speed and +10% fire rate', rarity: 'rare', tier: ItemTier.Rare, cost: 40, icon: '🌪️', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.16, fireRateMultiplier: 1.1 },
    { id: 'legs_serpents_wrap', name: "Serpent's Wrap", description: '+10% bleed chance and +8% move speed', rarity: 'rare', tier: ItemTier.Rare, cost: 38, icon: '🐍', unlocked: true, tags: ['elemental'], slot: 'legs', bleed: 0.1, speedMultiplier: 1.08 },
    { id: 'legs_berserker_kilt', name: 'Berserker Kilt', description: '+14% melee damage and +8% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 48, icon: '🪘', unlocked: true, tags: ['melee'], slot: 'legs', meleeDamageMult: 1.14, speedMultiplier: 1.08 },
    { id: 'legs_phantom_leggings', name: 'Phantom Leggings', description: '+20% dodge and +6% damage', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '🌫️', unlocked: true, tags: ['utility'], slot: 'legs', dodge: 0.2, damageMultiplier: 1.06 },
    { id: 'legs_juggernaut_greaves', name: 'Juggernaut Greaves', description: '+30 max health and +6 armor', rarity: 'epic', tier: ItemTier.Rare, cost: 52, icon: '🛡️', unlocked: true, tags: ['defensive'], slot: 'legs', maxHealthBonus: 30, armor: 6 },
    { id: 'legs_windshear_leggings', name: 'Windshear Leggings', description: '+24% move speed and +14% dodge', rarity: 'legendary', tier: ItemTier.Legendary, cost: 70, icon: '💨', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.24, dodge: 0.14 },
    { id: 'legs_warmarch_plates', name: 'War-March Plates', description: 'Permanent +damage for each wave survived; +20 max health', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '🥁', unlocked: true, tags: ['defensive'], slot: 'legs', waveRampDamage: 0.06, maxHealthBonus: 20 },
```

## FEET (+10 → 20)

Existing lean speed / pickup / dodge / armor+speed. Additions add thorns-boots, ranged-kite,
economic, elemental, evasion, a killing-spree conditional, and a mobility keystone.

```ts
    { id: 'feet_worn_moccasins', name: 'Worn Moccasins', description: '+6% move speed and +8% pickup range', rarity: 'common', tier: ItemTier.Common, cost: 9, icon: '🥿', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.06, xpMagnet: 1.08 },
    { id: 'feet_gripped_cleats', name: 'Gripped Cleats', description: '+5% dodge chance', rarity: 'common', tier: ItemTier.Common, cost: 9, icon: '🦶', unlocked: true, tags: ['utility'], slot: 'feet', dodge: 0.05 },
    { id: 'feet_traveler_boots', name: 'Traveler Boots', description: '+10% move speed', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '👢', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.1 },
    { id: 'feet_thornsole_boots', name: 'Thornsole Boots', description: '+12% thorns reflect and +8% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🌿', unlocked: true, tags: ['defensive'], slot: 'feet', thorns: 0.12, speedMultiplier: 1.08 },
    { id: 'feet_swiftkick_boots', name: 'Swiftkick Boots', description: '+8% move speed and +6% fire rate', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🥋', unlocked: true, tags: ['ranged'], slot: 'feet', speedMultiplier: 1.08, fireRateMultiplier: 1.06 },
    { id: 'feet_prospector_boots', name: 'Prospector Boots', description: '+15% gold and +20% pickup range', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '⛏️', unlocked: true, tags: ['economic'], slot: 'feet', goldBonus: 1.15, xpMagnet: 1.2 },
    { id: 'feet_emberwalk_boots', name: 'Emberwalk Boots', description: '+12% ignite chance and +8% move speed', rarity: 'rare', tier: ItemTier.Rare, cost: 36, icon: '🔥', unlocked: true, tags: ['elemental'], slot: 'feet', burn: 0.12, speedMultiplier: 1.08 },
    { id: 'feet_shadowstep_boots', name: 'Shadowstep Boots', description: '+18% dodge and +10% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 48, icon: '🌑', unlocked: true, tags: ['utility'], slot: 'feet', dodge: 0.18, speedMultiplier: 1.1 },
    { id: 'feet_bloodhound_boots', name: 'Bloodhound Boots', description: 'Each kill adds a decaying +damage stack; +12% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '🐾', unlocked: true, tags: ['melee'], slot: 'feet', killStackDamage: 0.05, speedMultiplier: 1.12 },
    { id: 'feet_seven_league_boots', name: 'Seven-League Boots', description: '+26% move speed and +25% pickup range', rarity: 'legendary', tier: ItemTier.Legendary, cost: 70, icon: '🪽', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.26, xpMagnet: 1.25 },
```

## RING (+9 → 20)

Existing lean damage / fire-rate / crit / gold / bleed. Additions add fire/frost DoT, ranged-crit,
lifesteal, a doom/wound execute ring, a miser conditional, and an offensive keystone.

```ts
    { id: 'ring_iron_signet', name: 'Iron Signet', description: '+10% damage', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '⚙️', unlocked: true, tags: ['melee'], slot: 'ring', damageMultiplier: 1.1 },
    { id: 'ring_spark_ring', name: 'Spark Ring', description: '+8% fire rate', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '⚡', unlocked: true, tags: ['ranged'], slot: 'ring', fireRateMultiplier: 1.08 },
    { id: 'ring_ember_ring', name: 'Ember Ring', description: '+11% chance to ignite', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🔥', unlocked: true, tags: ['elemental'], slot: 'ring', burn: 0.11 },
    { id: 'ring_frost_ring', name: 'Frost Ring', description: '+13% chance to freeze', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '❄️', unlocked: true, tags: ['elemental'], slot: 'ring', freeze: 0.13 },
    { id: 'ring_hawkeye_ring', name: 'Hawkeye Ring', description: '+7% crit chance and +8% ranged damage', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '🎯', unlocked: true, tags: ['ranged'], slot: 'ring', critChance: 0.07, rangedDamageMult: 1.08 },
    { id: 'ring_leech_ring', name: 'Leech Ring', description: '+7% lifesteal', rarity: 'rare', tier: ItemTier.Rare, cost: 38, icon: '🦟', unlocked: true, tags: ['melee'], slot: 'ring', lifesteal: 0.07 },
    { id: 'ring_doombind_ring', name: 'Doombind Ring', description: '+12% doom chance and +10% wound', rarity: 'epic', tier: ItemTier.Rare, cost: 48, icon: '☠️', unlocked: true, tags: ['elemental'], slot: 'ring', doom: 0.12, wound: 0.1 },
    { id: 'ring_misers_ring', name: "Miser's Ring", description: '+damage scaling with unspent gold; +15% gold', rarity: 'epic', tier: ItemTier.Rare, cost: 46, icon: '🤑', unlocked: true, tags: ['economic'], slot: 'ring', goldScaleDamage: 0.05, goldBonus: 1.15 },
    { id: 'ring_sovereign_ring', name: 'Sovereign Ring', description: '+22% damage, +12% fire rate and +8% crit chance', rarity: 'legendary', tier: ItemTier.Legendary, cost: 76, icon: '🏆', unlocked: true, tags: ['melee'], slot: 'ring', damageMultiplier: 1.22, fireRateMultiplier: 1.12, critChance: 0.08 },
```

---

## Execution checklist (for the budget-fresh batch day)

1. `python3 tools/roguelite-content-budget.py` → must read **CONTENT_AVAILABLE** before starting
   (if a content commit already shipped that day, wait — do not split the batch).
2. **`node qa-catalog-integrity.mjs --spec DESIGN-SLOT-FILL-TO-20.md` → must exit 0** (no id/name
   collision vs the current live catalog, all fields valid, every slot totals 20). This re-checks
   against the live catalog *as it stands that day* — if anything shipped since, it catches a fresh
   collision before you paste. Fix the spec, not the catalog, if it flags.
3. Paste each slot's block into the matching section of `frontend/src/items/catalog.ts` (next to the
   existing entries for that slot). Keep them inside the same array.
4. `npx tsc --noEmit` (or the project's typecheck) — all fields are real, so this should be clean;
   fix any typo before proceeding.
5. `node qa-catalog-integrity.mjs` (no `--spec`) on the pasted catalog → exit 0 confirms no dup id/name
   landed, then re-run the per-slot count assertion (grep `slot: 'head'` etc.) → each must read **20**.
6. `node qa-shop-8slot.mjs` + the balance sim — confirm no regression, shop still offers 3, slots
   route correctly, upgrade-on-duplicate still works.
7. Build → deploy (Vercel) → **live-verify the new bundle hash** and spot-check a few new items in a
   real shop (headless drive), per the game-dev "verified, not claimed" rule.
8. **ONE** commit: `content: fill head/torso/legs/feet/ring to 20 items each (51 new)`. Record the
   live bundle in `CHANGELOG.md`.
9. This exhausts that day's content budget — nothing else content-side ships the same day.

## Sensible defaults taken (Felix on vacation, cheap to change)

- **Stat magnitudes** mirror the existing per-slot power curve (commons ~single small stat, epics
  ~two mid stats, legendaries ~keystone) — no new balance surface, so the enemy-scaling review still
  holds. If any legendary reads too strong in play, it's a one-number edit.
- **Archetype coverage over raw stat count** — a few items intentionally carry conditional/DoT
  mechanics rather than flat stats, to make "20 per slot" mean *20 build options*, per Felix's "for
  different builds."
- **No "+N rarity" entries** — that late-wave power is the shipped upgrade-level system, not extra
  catalog rows (see the note up top).
