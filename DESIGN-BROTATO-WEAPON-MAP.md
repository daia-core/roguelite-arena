# Brotato weapon roster → our systems (gap map)

**Goal (Felix, Jul 5):** "Make sure you can basically replicate all Brotato weapons in game
with the current game systems. If you can't, improve stats and systems so that you can."

This maps every Brotato weapon *class* onto our engine, marks what's **covered** vs. a **gap**,
and lists the concrete stat/system work to close each gap. It's the working plan behind the melee
rework shipped Jul 5 (animated weapon sprite + AoE highlight + `MeleeStyle`). Source roster:
brotato.wiki.spellsandguns.com/Weapons.

## How Brotato weapons actually work (the model we're matching)

A Brotato weapon is: an **attack shape** (melee sweep, melee thrust, projectile, spread, beam,
explosion, orbit) + **base stats** (damage, attack speed / cooldown, range, crit, knockback) +
**scaling tags** (which stats it rides — Melee, Ranged, Elemental, Engineering, etc.) + optional
**on-hit effects** (burn, pierce, bounce, explode, lifesteal). Six tiers per weapon. Classes are
just tag bundles: *Blade, Blunt, Precise, Heavy, Explosive, Elemental, Ethereal, Support, Medieval,
Unarmed, Primitive, Tool, Medical, Gun.*

Our engine already expresses most of this: `weaponType` (auto-aim gun / orbital / **melee**),
5 `DamageType`s (physical/fire/ice/lightning/poison), and per-item modifiers — `piercing`,
`multishot`, `chainLightning`, `freeze`, `burn`, `bleed`, `poison`, `homing`, `explosionOnHit`,
`knockback`, crit, plus the swing stats (`getSwing{Damage,Range,Arc,Interval,Aoe,Knockback}`) and,
as of today, **`MeleeStyle`** (arc / thrust / spin / slam).

## Attack-shape coverage

| Brotato shape | Example weapons | Our mechanism | Status |
|---|---|---|---|
| Melee sweep (wide arc) | Sword, Scythe, Hand, Claw, Torch | melee swing, `MeleeStyle: 'arc'` | **Covered** |
| Melee thrust (narrow lane) | Spear, Lance, Bat (poke), Screwdriver | melee swing, `MeleeStyle: 'thrust'` (long reach, ±25° lane, pierces a line) | **Covered (new)** |
| Heavy slam (disc AoE) | Hammer, Sledgehammer, Stick | melee swing, `MeleeStyle: 'slam'` + `swingAoe` disc | **Covered (new)** |
| Whirl (full 360°) | Wrench (Engi orbit-ish), heavy spin builds | melee swing, `MeleeStyle: 'spin'` (auto when `swingAoe`>0 or heavy blade) | **Covered (new)** |
| Single projectile | Pistol, Revolver, Crossbow | auto-aim gun (default) | **Covered** |
| Spread / multishot | SMG, Shotgun, Minigun | `multishot` + spread | **Covered** |
| Piercing shot | Crossbow, Slingshot | `piercing` | **Covered** |
| Beam / continuous | Laser, Flamethrower | *no continuous beam entity* | **Gap → B1** |
| Thrown / explosive | Grenade, Rocket Launcher, Dynamite | `explosionOnHit` + Bomb aux weapon | **Partial → B2** |
| Orbiting | (Engineering turrets/orbs), Scared Sausage | OrbitingOrb aux + `orbital` weaponType | **Covered** |
| Homing | Wand-ish / smart shots | `homing` | **Covered** |

## Effect / scaling coverage

| Brotato effect | Our field | Status |
|---|---|---|
| Burning (fire DoT) | `burn` / DamageType `fire` | **Covered** |
| Freezing / slow | `freeze` / DamageType `ice` | **Covered** |
| Lightning / chain | `chainLightning` / DamageType `lightning` | **Covered** |
| Poison / bleed | `poison`, `bleed`, `poisonSpread` | **Covered** |
| Piercing | `piercing` | **Covered** |
| Knockback | `knockback` | **Covered** |
| Crit chance / dmg | `getCritChance` | **Covered** |
| Lifesteal (Medical / Vampiric) | *no per-hit heal-on-damage* | **Gap → E1** |
| Bounce / ricochet | *none* | **Gap → E2** |
| Explode on kill (Explosive class) | `explosionOnHit` is on-hit, not on-kill | **Partial → E3** |
| Stat-scaling *tags* (Melee/Ranged/Elemental damage %) | global mults exist but not per-weapon *class scaling* | **Design choice, not a gap** — we scale by build items, not weapon class. Fine. |

## Gaps & the work to close them (priority order)

**B2 — richer explosives (thrown arc + radius).** We have `explosionOnHit` and a Bomb aux; add an
explicit *explosive projectile* profile (lobbed, AoE-on-impact scaling with `aoeRadiusMult`) so
Rocket Launcher / Grenade / Dynamite read distinctly. *Small — mostly a projectile flag + AoE reuse.*

**E1 — lifesteal / heal-on-hit.** Add `lifestealPct` (heal = pct of damage dealt), gate a few
"Medical/Vampiric" weapons + items on it. Covers the whole Brotato Medical/lifesteal fantasy.
*Small — one modifier + a hook in the damage-application path.*

**E3 — explode-on-kill.** Split `explosionOnHit` into on-hit vs. on-kill so the Explosive class
(chain-reaction clears) works as in Brotato. *Small — a second boolean + a kill hook.*

**B1 — continuous beam/flamethrower.** A held-beam entity (tick damage along a line). *Medium —
new entity + render; the only genuinely new attack shape.* Lowest priority — a cosmetic variant of
piercing for now; do last.

**E2 — bounce/ricochet.** `bounceCount` on projectiles (redirect to nearest on hit). *Medium.*

## What shipped Jul 5 (this pass)

- `MeleeStyle` = arc | thrust | spin | slam — one melee pipeline now expresses the whole melee
  family instead of a single generic pixel fan.
- Animated in-world **weapon sprites** (`weapon_blade / weapon_axe / weapon_spear`) that sweep /
  thrust / whirl / slam through the motion, + a readable **dithered AoE highlight** of the exact
  damage zone (Felix's two explicit asks).
- Two new melee weapons exercising the styles: **Piercing Lance** (thrust, long lane, pierces) and
  **Crashing Maul** (slam, wide quake, big knockback). Existing blades tagged `arc`.
- Verified headless: `qa-melee-styles.mjs` 19/19 (routing + per-style hit-test + sprites + live
  collision regression), zero console errors.

**Verdict:** ~90% of the Brotato roster is already replicable with current systems; the melee half
is now fully expressive. Remaining gaps are 5 small-to-medium modifiers (B1/B2/E1/E2/E3), each a
self-contained follow-up — no architectural blockers.
