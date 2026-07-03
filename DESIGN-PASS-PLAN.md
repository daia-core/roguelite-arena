# Roguelite Arena — item & sprite design pass (plan)

Felix's brief, 2026-07-03: fix the melee/projectile bug, make **melee stack** like every weapon,
review **every item** for uniqueness/impact, give **effects and projectile types real pixel-art
sprites**, add a **default melee swing** with AOE melee items, add **item tags** (weapon / passive /
active, multi-tag), **mine the survivor wikis** for new items/stats, and finally draw a **unique
pixel-art sprite for every item** and **strip all emojis** everywhere.

This is a multi-session build. Below is what already shipped, and the ordered plan for the rest so
you can steer before I execute the big creative pass.

---

## Already shipped & live (afternoon, `index-DoahjPQB.js`, commit `ef9b773`)

The melee bug is fixed and melee now stacks. Your gun fires on **every** build — a melee weapon no
longer silently kills your projectiles. Every character has a **default auto-swing** at the nearest
enemy in reach (it only swings when something's actually close). Melee items now *shape* that swing
instead of replacing your gun: **Crescent Blade** = wider/faster/harder swing; **Thunder Hammer** =
slow, heavy, **full-circle AOE quake**. A new global area multiplier scales swing-AOE, nova and bomb
radii together. Verified with a dedicated QA harness on the shipped build (swing + gun coexist from
scratch, Crescent projectiles still fire, Hammer 360° AOE, zero console errors).

The **Soulstone-Survivors wiki** is already mined into `RESEARCH-soulstone-survivors.md` (a full
catalogue of stats, weapons and status-effect mechanics as a design reference).

---

## Remaining work — ordered

**1. Item tags — the weapon / passive / active axis (small, do first).**
The game *already* tags items by role (`melee`, `ranged`, `elemental`, `defensive`, `economic`,
`utility`, with multi-tags). What's missing is your *function* axis — does the item **grant an
attack** (weapon), **passively modify stats** (passive), or **fire a triggered effect** (active) —
and, critically, those tags aren't shown in the shop yet. Plan: add a `kind` set to every item
(an item can be several — "+move speed *and* a spear" = passive + weapon), then render colored tag
chips on each shop/owned card so a build reads at a glance. Keep the existing role tags.

**2. Full item review for uniqueness/impact (the big creative pass).**
Walk every shop item and push the bland ones toward a distinct mechanical identity, using the wiki
research for inspiration — trade-off cards (more damage, less move speed), conditional/on-crit/on-kill
triggers, build-defining passives, and weapons with real firing personalities rather than flat
`+X% damage`. This is the pass with the most *feel* in it, so it's where your steering matters most
(see questions below). I'll do it in rarity-tier batches and ship each batch verified.

**3. Effect & projectile sprites (fire / poison / etc.).**
Give status effects and each projectile type a proper unique pixel-art sprite instead of recolored
blobs — burning, poison clouds/ticks, frost, lightning, and the distinct projectile shapes. Mirrors
the existing procedural sprite pipeline (`pixel/sprite.ts`, `sprites.ts`, `UISprites`) the monsters
use.

**4. More melee / AOE items.**
Now that the swing is a real system, add items that build into it: wider arcs, cleave, spinning
sustained AOE, on-swing shockwaves, lifesteal-on-swing — so "melee build" has depth beyond the two
existing weapons.

**5. Pixel-art sprite for EVERY item + strip all emojis (the finale).**
Every item currently renders its `icon` as an **emoji** through `drawText`. Build a procedural
pixel-art icon for every item (same generator family as the monster/UI sprites), swap the shop/owned/
village render calls from `drawText(emoji)` to `drawImage(sprite)`, and remove emojis everywhere else
in the UI. This is last because the item set should be *final* (step 2/4) before we draw all of them.

---

## Steering questions (for the big item pass, step 2)

- **Direction:** lean the redesign toward **Vampire-Survivors** (build-defining passives, evolutions,
  weapon personalities) or **Brotato** (stat trade-offs, tag synergies, tight economy)? The engine is
  Brotato-style (wave+shop) but I can pull either flavor.
- **Second wiki:** you mentioned two wikis — I've mined Soulstone Survivors. Want me to also mine
  **Brotato** (items/weapons) and/or **Vampire Survivors** (weapon evolutions), or a specific one?
- **Scope of the redesign:** rework **every** item, or keep the good ones and only overhaul the bland
  filler? (I'd default to: keep what's already distinct, overhaul the flat `+%stat` ones.)

I'll proceed on reasonable defaults (Brotato-leaning, mine Brotato + VS, overhaul the bland ones) if
you don't steer — but this is the one part where your taste should drive it, so I'm holding the big
creative pass for your nod rather than guessing on 90 items.
