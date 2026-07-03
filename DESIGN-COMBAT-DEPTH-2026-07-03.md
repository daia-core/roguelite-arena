# Roguelite Arena — Combat-Depth & Presentation Overhaul (2026-07-03)

The design-and-build plan for Felix's July-3 directives. Captures the "why", the mechanics,
and the phased build order so the work is legible and resumable. Grounded in the actual code
(`frontend/src/`) and in `RESEARCH-soulstone-survivors.md` (mined from the Soulstone Survivors
Powers/Weapons/Status wikis).

## The directives (verbatim intent)

1. **Melee should STACK like every weapon** — a melee build still fires weak projectiles; melee is
   an additive layer, never a replacement. (This was the crescent-blade bug: it used
   `weaponType:'melee'`, which *replaced* the gun and killed all projectiles.)
2. **Default player swing** — every player auto-swings nearby enemies from scratch; melee items
   *upgrade that swing* (damage, range, arc, speed), and many items *alter* it into distinct melee
   builds (big-AOE cleave, orbiting blades, heavy slam, fast twin-strike, thrust).
3. **AOE-radius stat** that ties into ALL the player's AOE moves (swing AOE, nova, bomb, blast).
4. **Review every item** for uniqueness/impact — kill boring "+X stat" sticks where they add
   nothing, make them distinctive, and add a lot of new items (esp. melee-swing builds).
5. **Item category tags at a glance** — weapon / passive / active, with multi-tag items (e.g.
   "+move speed AND a thrusting spear" = passive + weapon).
6. **Mine other games** (Soulstone Survivors) for statuses, stats, and items worth adding.
7. **Unique pixel-art sprites** for effects (fire, poison, …) and projectile types.
8. **Pixel-art sprite for EVERY item** (like the monsters) instead of emojis; **remove all emojis
   everywhere** (clean up).

## What already shipped (Phase 1 — done + headless-verified)

The foundational mechanic is live in the code and passes `qa-melee-stack.mjs` (0 console errors):

- The ranged weapon **always fires**. The old `if (weaponType==='melee')` branch that replaced the
  gun is gone (`Game.ts` primary-fire).
- A **universal default swing**: every player auto-swings the nearest in-reach enemy on a timer,
  pushing a `MeleeAttack` into the shared collision/knockback/kill pipeline (`Game.ts` ~1400).
- New **swing stat getters** on `PlayerStats` (`ItemSystem.ts`): `getSwingDamage/Range/Arc/Interval/
  Aoe/Knockback`, plus `getAoeRadiusMult()`.
- New **swing/AOE item fields** on the `Item` interface: `swingDamageMult, swingRangeBonus,
  swingArcBonus, swingCooldownMult, swingAoe, aoeRadiusMult`.
- **Crescent Blade** (`melee_sword_t2`) and **Thunder Hammer** (`hammer_weapon_t3`) converted from
  gun-replacing `weaponType:'melee'` into swing-buff items. Thunder Hammer gives a full-circle
  (arc = 2π) AOE swing.
- **`getAoeRadiusMult()` wired** into bomb radius (110×mult) and nova radius (240×mult).

Verified: default swing + gun coexist with no items; Crescent Blade keeps `getWeaponType()==='auto-aim'`
and projectiles keep firing (the reported bug is fixed); Thunder Hammer swings full-circle.

## Phase 2 — Item category "kind" (weapon / passive / active)

The `tags: ItemTag[]` that already exists (`melee|ranged|defensive|economic|elemental|utility`) is a
*synergy* axis, not an at-a-glance category. Add an orthogonal **`kind`** display axis:

- `kind?: ItemKind[]` where `ItemKind = 'weapon' | 'passive' | 'active'`.
  - **weapon** = changes/adds an attack (swing-altering, aux weapon, projectile modifier).
  - **passive** = always-on stat/effect (stats, regen, luck, interest, on-hit statuses).
  - **active** = a triggered/periodic effect that "does something" on a timer or condition
    (bomb-drop, nova-pulse, charge-and-release abilities).
  - Multi-kind items are normal (a spear that also grants +move = `['weapon','passive']`).
- Render `kind` as small colored tag chips on the reward/shop cards (weapon = red, passive = blue,
  active = amber), above/below the description. Cheap, high-legibility.

## Phase 3 — New stats, statuses & items (from research)

Highest-impact, lowest-code picks from `RESEARCH-soulstone-survivors.md`:

**New stats (passives):**
- **Multicast chance** — % chance the ranged weapon fires an extra time.
- **Crit chance / crit damage** already exist as fields; add more items that lean into them.
- **DoT tuning** — separate "increase DoT damage", "tick faster", "burst % on apply" for the
  existing poison (and new burn/bleed).
- **AOE radius** items (Phase 1 stat) — several that push `aoeRadiusMult`.

**New status effects (with unique sprites, Phase 4):**
- **Burn** — short fast fire DoT (from fire projectiles / Fire-Walk trail item).
- **Bleed** — DoT with bonus damage when the enemy moves (punishes rushers).
- **Poison spread** — on the poisoned enemy's death, poison hops to a nearby enemy (chain plague).
- **Doom** — delayed detonation that stores damage and executes if stored ≥ current HP.
- **Wound (debuff item)** — on-hit chance to double existing status stacks (universal DoT multiplier).
- **Fragility / Exposed** — stackable "+% damage taken" marks (support/enabler items).

**New melee-swing items (distinct builds):**
- **Whirlwind Cleaver** — wide arc, always full-circle-ish, moderate damage (sweep build).
- **Orbiting Blades** — persistent blades circling the player (already have `orbitOrbs`; add a
  bladed variant + swing synergy).
- **Twin Daggers** — fast, small, cheap swing (attack-speed build).
- **Executioner's Slam** — slow, huge single hit + knockback + Brittle (impact build).
- **Vampiric Edge** — swing lifesteal.
- **Fire-Walk Boots** — leave a burning trail as you move (movement = offense).

Each new item gets `kind`, `tags`, a description, and a sprite. Aim: ~20-30 new items and enough
distinct swing-altering items that "melee build" has real internal variety.

## Phase 4 — Effect & projectile sprites

Replace generic circles/emoji with unique pixel-art (using `renderGrid` / `drawPixels`):
- **Status effect icons/particles**: fire (flame), poison (bubble/skull-green), bleed (red drip),
  freeze (ice shard), doom (countdown skull), shock (bolt).
- **Projectile types**: default bolt (exists), fire bolt, poison bolt, ice shard, arcane orb,
  piercing lance — keyed by the projectile's damage type so a fire build *looks* like fire.

## Phase 5 — Item sprites + total emoji removal

- Build a **procedural item-sprite generator** in `sprites.ts` (or a new `itemSprites.ts`): a library
  of pixel-grid shape templates (sword, dagger, spear, hammer, bow, staff, orb, ring, amulet, potion,
  boot, glove, shield, cloak, book, gem, skull, wing, heart, coin, …) each parameterized by a palette,
  mapped per item id/name. Keyed `item_<id>` so lookup is deterministic.
- **Wire item rendering** (reward cards `Game.ts` ~3471/3633, village `VillageScene.ts` ~686/820/844,
  duo cards ~3881/3906) to draw the sprite canvas instead of `drawText(item.icon,…)`.
- **Strip every emoji**: remove/replace the `icon` emoji strings across `ItemSystem.ts` (194),
  `DuoSystem`, `VillageScene`, any HUD/menu emoji, and `Game.ts`. Grep-sweep for emoji codepoints to
  confirm zero remain.

## Build order & verification

Each phase ends with `npm run build` (tsc strict) and, where behavior changes, a headless QA pass
(extend `qa-melee-stack.mjs`). Deploy to Vercel (daiacore) **once** at the end, live-verify, and
report **once** to `#gamedev` with the changelog + this plan link. No piecemeal pings.

## Status tracker

- [x] Phase 1 — melee stacks, default swing, AOE stat (verified)
- [x] Phase 2 — item `kind` tags (derived via `getItemKinds`) + card chips (weapon=red / passive=blue / active=amber), visual-QA'd on desktop + portrait
- [x] Phase 3a — 8 new swing/AOE build items (Whirlwind Cleaver, Twin Fangs, Executioner's Maul, Vampiric Edge, Warglaive Storm, Titan Gauntlets, Ring of Widening, Cataclysm Core) — plug into the shipped swing/AOE mechanics; qa-melee-stack still PASS
- [x] Phase 3b — status ENGINES built + verified (`qa-status-engines.mjs` PASS, 0 errors): **Burn** (fast fire DoT), **Bleed** (DoT that hits harder while the enemy moves), **Poison-spread** (poisoned deaths infect a neighbor via `killByDot`), **Doom** (stores damage then detonates, executes low-HP), **Wound** (amplifies all DoTs on a target), **Multicast** (bonus ranged volley). All apply from BOTH ranged and melee. **Bug fixed:** melee swings now call `applyOnHitEffects` (previously statuses only procced from projectiles). 10 new items: Ember Brand, Wildfire Torch, Serrated Edge, Hemorrhage Fang, Plague Bearer, Doom Sigil, Harbinger's Seal, Rending Mark, Echo Prism, Twin Echo Core.
- [ ] Phase 3c — review all 194 items for uniqueness/impact; uniquify generic stat-sticks
- [ ] Phase 4 — effect/projectile sprites
- [ ] Phase 5 — item sprites + emoji removal

**Deployed live (2026-07-03):** Phase 1 + 2 + 3a shipped to Vercel production
(`dpl_6U6jvzww5VVHkNr337UYcRh6gsdm`, alias `roguelite-game-blush.vercel.app`, bundle
`index-Nz03E4wJ.js`, READY, no SSO wall). Next phases (3b/3c/4/5) still to build + deploy.
