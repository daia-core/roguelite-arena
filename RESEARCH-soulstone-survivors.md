# Soulstone Survivors — Design Research for a Browser Roguelite Arena Survivor

Research extracted from the Soulstone Survivors Fandom wiki (Powers, Weapons, and the
supporting Status Effect page) on 2026-07-03. Fandom blocks direct WebFetch (403), so the
content was pulled via the MediaWiki `action=parse` API (`prop=wikitext`) and parsed locally.
Sources:
- https://soulstone-survivors.fandom.com/wiki/Powers
- https://soulstone-survivors.fandom.com/wiki/Weapons
- https://soulstone-survivors.fandom.com/wiki/Status_Effect (for effect mechanics)

This is a design-idea reference for a Vampire-Survivors / Brotato-style arena survivor. It is
concrete and mechanical. No game code was touched.

---

## 1. Powers / Stats — full catalogue

### 1.1 Core generic stats (level-up passives, stack additively)
Each of these is a plain scaling stat, the bread-and-butter of a survivor build.

| Power (name) | Stat | Mechanic (one line) |
|---|---|---|
| Powerful Strikes | Damage Modifier | +% all damage dealt. |
| Leviathan | Damage / Move Speed | +% damage but -% movement speed (trade-off card). |
| Relentless | Cast Frequency | +% attack/cast rate = shorter cooldowns. |
| Expansive | Area Modifier | +% area of effect AND bigger projectiles. |
| Multi Cast | Multi Cast Chance | +% chance a skill fires an extra time when it activates. |
| Lethality | Critical Chance | +% chance to crit. |
| Merciless | Critical Damage | +% crit damage multiplier. |
| Behemoth | Max Health | +flat max HP. |
| Resilient | Armor Power | +flat armor (mitigates incoming damage). |
| Indomitable | Block Power | +flat chance/value to fully block an incoming hit. |
| Agile | Movement Speed | +% move speed. |
| Magnetic | Experience + Pick-Up Area | +% XP gain AND +% pickup/collection radius (dual stat). |
| Unbreakable | Damage Reduction | Flat reduction subtracted from every hit taken. |
| Swift | Dash Charges | +1 dash charge (dash multiple times before recharge). |

### 1.2 Conditional / trigger-based stats (only offered once build qualifies)
These only appear when the build meets a condition — a self-shaping upgrade pool.

- **Vicious Strikes** — 100% crit chance against full-HP enemies (guaranteed-crit on first hit).
- **Damage Reduction (flat)** — subtract-a-number defense that scales well vs swarms of weak hits.
- **Reroll / Banish / Lock (meta-picks)** — Reroll reshuffles the offered upgrade cards; Banish
  permanently removes an unwanted upgrade from the run's pool; Lock preserves a card for the next
  level-up. Excellent draft-agency mechanics.

### 1.3 Damage-over-time (DoT) status application powers
The heart of build diversity. Pattern per element: *apply on hit* → *apply on crit* → *increase
damage* → *instant burst on apply* → *increase tick rate*. Six damaging statuses, each with a full
sub-tree.

**On-hit / on-crit appliers (chance-based, fixed %):**
- Blood Shed — attacks have 25% chance to apply **Bleed**.
- Brutal Strikes — crits have 50% chance to apply **Bleed**.
- Venomous — attacks 25% chance to apply **Poison**.
- Infected Wounds — crits 50% chance to apply **Poison**.
- Fateful Strikes — attacks 25% chance to apply **Doom**.
- Grim Precision — crits 50% chance to apply **Doom**.
- Spontaneous Combustion — attacks 25% chance to apply **Burn**.
- Ignition Point — crits 50% chance to apply **Burn**.
- Horrific Presence — attacks 10% chance to apply **Disarray**.
- Havoc — crits 50% chance to apply **Disarray**.
- Touch of Ice — attacks 40% chance to apply **Slow**.
- Immobilize — crits 50% chance to apply **Slow**.

**DoT amplifiers (one set per damaging status — Bleed/Poison/Doom/Burn):**
- Laceration / Corrosive / Calamity / Fiery Amplification — +% damage of every Bleed/Poison/Doom/Burn applied.
- Dismemberment / Rotting / Ruin / Incinerate — on applying the DoT, deal a % of its total damage **instantly** as a burst (front-loads DoT).
- Deep Wounds / Death and Decay / (Doom n/a) / Intense Fire — DoT ticks **more frequently** (more total damage over same duration).

### 1.4 What each status actually does (the mechanical payload)
This is the gold — copy these behaviors, not just "it's a DoT".

**Damaging statuses:**
- **Burn** — damage over 4s, ticks every 1s for 12.5% of total each. Fast, front-loaded fire DoT.
- **Bleed** — damage over 10s, ticks 1s for 10% each; **+40% chance to deal extra damage per meter the target moves** (punishes mobile/fleeing enemies — movement-scaled DoT).
- **Poison** — damage over 15s, ticks 1s for 6.67% each; **on target death, remaining Poison spreads to a nearby enemy** (chain-plague across a pack).
- **Doom** — delayed detonation: does nothing for 5s then hits; new applications increase stored damage and refresh timer; **if stored Doom > target's current HP, it instantly executes**; on damage, 25% is dealt as a small AoE around the target. A build-up execute bomb.

**Non-damaging debuffs (multiplicative enablers — stack a number, each stack = a small %):**
- **Fragility** — +1% ALL damage taken per stack (universal amp).
- **Weakness** — +1.2% damage taken from status effects per stack (DoT amp).
- **Disarray** — random ±(-0.5% to +2.5%) damage taken, 8s (chaotic gambling debuff).
- **Brittle** — +1 flat damage taken per stack.
- **Shattered** — -1 armor per stack (armor shred).
- **Slow** — -1% move speed per stack, 8s (kiting/control).
- **Stun** — target can't act for a few seconds; auto-applies to dying units; doesn't stack; bosses immune unless stated.
- **Dazed** — +1% chance to be crit per stack.
- **Disoriented** — +1% crit damage taken per stack.
- **Exposed** — +4% direct (non-DoT) damage taken per stack, scales with base hit.
- **Condemned** — consumes 10 stacks to make a crit deal +500% damage (burst-detonation debuff).
- **Distracted** — target's hit chance -0.5% per stack (defensive/evasion).
- **Crippled** — target's attack area -0.5% per stack.
- **Debilitated** — target's damage dealt -1% per stack.
- **Wound** — 50% chance to DOUBLE the stacks of any effect already on the enemy when a new effect lands (DoT multiplier debuff — pairs with everything).

**Self-buffs (temporary, stack, ~6s each):** Aptitude (+2% crit dmg/stack), Bulwark (+1 block/stack),
Colossal (+1% area/stack), Finesse (+1% multicast/stack), Form (+1% crit chance/stack), Haste
(+1% move/stack), Prowess (+1% damage/stack), Resilience (+1 armor/stack), Swiftness (+1% cast
freq/stack), Vigor (+0.5 max HP/stack).

### 1.5 Status/buff SYNERGY CHAINS (the standout system)
Rather than isolated cards, statuses form loops where applying A grants a chance to also apply B.
Two chains:

- **Debuff chain (each ~50% chance):** applying **Disarray → Bleed → Poison → Doom → Burn → Slow →
  Disarray** (cycle). Agony, Poisonous Blood, Debilitating Plague, Impending Doom, Thermal Shock,
  Hypothermia. One trigger can cascade an entire elemental cocktail onto a target.
- **Buff chain (each ~25% chance):** gaining **Finesse → Bulwark → Aptitude → Prowess → Resilience →
  Form → Haste → Finesse** (cycle). War Experience, Shredding Armor, Devastating Strike, Fortifying
  Damage, Armored Assault, Lethal Celerity, Adrenaline. A single buff source snowballs into a
  stacking, self-sustaining buff engine.

### 1.6 "Activated Ability" resource buffs (charge → auto-cast unique attack)
Skills grant stacks of a named buff; when you next cast anything, if you have enough stacks they're
consumed to auto-fire a bonus attack. A brilliant "secondary economy" layer.

- **Ammunition** (20 stacks) → adds 5 multicast charges to the skill being cast.
- **Ancestry** (20) → summon a totem dealing damage based on your max HP.
- **Cursed** (20) → summon a ghost tentacle ally (up to 7, 120s).
- **Electrified** (12) → release jolts flying in random directions, heavy damage + Dazed.
- **Icy Veins** (12) → launch icicles at random enemies, heavy damage + Slow.
- **Purity** (15) → wave of light damaging nearby; if it hits >4 enemies, also heals you.
- **Radiance** (12) → fire a heavy beam in your aim direction + Fragility.
- **Retaliation** (20, on being hit) → reduce that hit by 20 and instantly cast one of your skills back at the attacker.

### 1.7 Skill-specific / skill-type powers
- Per-skill upgrades: Damage Increase, Critical Chance, Attack Speed (cast freq), Area Modifier,
  Increased Quantity (more summoned units / projectiles), Increased Duration, Increased Potency
  (stronger buff from that skill) — all targeted at ONE named skill (deep single-skill specialization).
- Per-damage-type upgrades: Damage Increase / Area of Effect / Multi Cast for ALL skills of a chosen
  element (e.g. all Fire skills). Rewards mono-element builds.

### 1.8 Meta systems worth noting
- **Rarity-weighted draft**: Common 50 / Uncommon 25 / Rare 12 / Epic 4 / Legendary 1 weight; you're
  shown 3 cards; higher rarity = stronger/more complex effect.
- **Special rarity** powers: granted by boss/objective completion, can't be rerolled/locked/banished,
  give unique effects outside the normal pool.
- **Skill Chain / Type Chain**: having 2 skills of type A unlocks a bonus that converts to type B —
  encourages diversifying or doubling down on skill categories.

---

## 2. Weapons — attack patterns & behavior

Each character has 4 weapons; a weapon sets the **Skill Type** (which drives the attack shape),
grants **stat bonuses (often with a downside)**, and defines a **starting skill + special skill**.
Below, weapons are grouped by the attack archetype their skill-type implies, with the concrete named
skills and any unique twist. The skill-type is the key reusable design primitive.

### 2.1 Skill-type archetypes (the reusable attack shapes)
- **Swing** — wide melee arc/sweep around the player (Whirlwind, Slash, Twin Daggers, Wild Strike, Heroic Strike).
- **Slam** — heavy overhead ground impact / shockwave in front (Ground Slam, Brutal Slam, Fissure Strike, Staggering Blow).
- **Thrust** — forward stab/lunge, line-piercing (Thrust, Sinister Strike, Corrosive Spear).
- **Earth** — ground-based fissure/shockwave AoE (Shockwave, Demolish).
- **Projectile** — aimed traveling shot(s) (Shoot, Bolt Barrage, Rain of Arrows).
- **Bomb** — lobbed arcing explosive with delayed AoE (Mortar Shot, Bombardment, Explosive Arrows, Cluster Bomb, Fan of Bombs).
- **Blast / Buckshot** — short-range cone/shotgun spread (Buckshot, Power Blast).
- **Beam / Ray** — channeled continuous line (Lightning Beam, Frost Beam, Ray of Fire, Radiant Light).
- **Nova / Field** — persistent AoE zone or pulse around player (Lightning Field, Firestorm, Arcane Explosion, Heat Explosion).
- **Orb / Missile** — homing/orbiting projectiles (Arcane Missiles, Fiery Missiles, Orbs of Destruction, Sacred Orb).
- **Summon** — spawns autonomous allies (Summon Infantry, Cave Bear, Swamp Boar, Spider Queen, Plague Viper).

### 2.2 Weapon table (character → weapon → type → notable skills → twist)

**The Barbarian**
- Barbaric Cleavers (Swing) — Whirlwind (spinning melee sweep) + Throw Axe (thrown returning projectile). +Area, -Armor.
- Skullbreaker (Earth) — Shockwave + Demolish (ground-quake AoE). +Crit dmg/armor/cast, -move.
- Tempest Battle Axes (Electric) — Thundering Slash + Thunder Clap (lightning melee/nova). +Crit, -knockback.
- Bloodgod's Legacy (Slam) — Heavy Strike + Ground Slam (heavy impact). +30 HP/armor/area, -move (tanky bruiser).

**The Pyromancer**
- Pyromancer's Firestarter (Fire) — Fire Slash + Fire Walk (leave a burning trail as you move).
- Stormcaller (Electric) — Lightning Field (persistent shock zone) + Overcharged Blast.
- Shard of Chaos (Chaos) — Chaotic Inferno + Chaos Eruption. +Damage, -Body Mass (smaller hitbox).
- Damnatus, Spire of Shadows (Shadow) — Dark Swarm + Gathering Shadows. +20% multicast (spammy caster).

**The Hound Master** (weapons change what the pet hounds inflict — pet-modifier weapons!)
- Rusted Blaster (Bomb) — Mortar Shot + Bombardment; **hounds apply Wound** (doubles other effects' stacks).
- Riflemen's Vengeance (Blast) — Buckshot + Power Blast; **hounds apply Fragility** (+dmg taken).
- Toxin Cannon (Nature) — Pesticide Burst + Threshing Blast; **hounds apply Debilitated** (enemies deal less).
- Dragonfire Scattergun (Projectile) — Bolt Barrage + Cyclone Shot; **hounds apply Distracted** (enemies miss).

**The Spellblade**
- Silver Spellblade (Arcane) — Arcane Slash + Arcane Overload. +multicast.
- Arcane Scimitar (Swing) — Slash + Uppercut (launcher). +Damage/cast, -HP/armor (glass cannon).
- Icelord's Blade (Ice) — Arctic Assault + Frozen Blade.
- Scorching Edge (Fire) — Firestorm + Fiery Blades (orbiting fire blades).

**The Arcane Weaver**
- Arcane Staff (Arcane) — Arcane Missiles (homing bolts) + Arcane Explosion (nova).
- Ignis, Greatstaff of Despair (Fire) — Fiery Missiles + Fire Pillar (ground column).
- Benedictio, Staff of Dawn (Holy) — Sacred Orb + Celestial Retribution (sky-strike).
- Glacies, Rod of Eternal Ice (Ice) — Frost Beam (channeled) + Ice Shield (defensive orbiter).

**The Sentinel** (bow archetype)
- Huntress Bow (Projectile) — Shoot + Rain of Arrows (targeted volley from above).
- Siege Recurve Bow (Bomb) — Explosive Arrows + Cluster Bomb (splitting bomblets).
- Misery's End (Shadow) — Obscure Arrow + Void Trap (deployed snare/AoE trap).
- Noxious Longbow (Nature) — Noxious Shot + Venomous Volley (poison arrows).

**The Paladin**
- Sacred Warhammer (Holy) — Blades of Light + Holy Fire.
- Harbinger of Justice (Swing) — Heroic Strike + Hammer of Justice (thrown hammer).
- Arcane Scepter of Light (Arcane) — Radiant Light (beam) + Arcane Mace. +15% XP.
- Dawnbreaker's Mace (Slam) — Fissure Strike + Staggering Blow. +25% damage (heavy hitter).

**The Chaoswalker**
- Skull of Draxiz (Chaos) — Chaotic Missile + Unchained Chaos.
- Artifact of Corruption (Nature) — Infected Shot + Corrosion (spreading decay).
- Flamewalker's Spire (Fire) — Orbs of Destruction (orbiting orbs) + Volcano Eruption (ground burst).
- Azramiel's Blessing (Holy) — Ripple of Light (expanding wave) + Sanctified Orb.

**The Beastmaster** (summon-heavy — weapons define which beast you summon)
- Wild Cleaver (Nature) — Venomous Strike + Plague Viper (summoned snake).
- Nature's Fury (Swing) — Wild Strike + Swamp Boar (summoned charger).
- Bonecrusher (Slam) — Brutal Slam + Cave Bear (summoned tank pet). +40 HP.
- Widow's Embrace (Bomb) — Spider Cocoon + Spider Queen (summoned spawner). +35% area.

**The Assassin**
- Worn Daggers (Thrust) — Sinister Strike + Eviscerate (finisher).
- Curved Daggers (Swing) — Twin Daggers + Backstab (positional bonus damage).
- Grenadier's Mark (Bomb) — Debilitating Bomb + Fan of Bombs (spread throw).
- Edge of Doom (Shadow) — Shadow Stab + Reap (wide scythe). +cast/move (fast tempo).

**The Elementalist** (one weapon per element — pure element-swapping kit)
- Scepter of Thunder (Electric) — Lightning Beam + Call Lightning (targeted strike).
- Scepter of Frost (Ice) — Severe Cold + Freezing Blow.
- Scepter of Flame (Fire) — Ray of Fire (beam) + Heat Explosion (nova).
- Scepter of Nature (Nature) — Contaminated Cut + Outbreak (spreading plague).

**The Legionnaire** (spear + summon soldiers)
- Light Spear (Thrust) — Thrust + Shield Bash (defensive stagger).
- Jupiter's Reach (Electric) — Jupiter's Spear + Summon Infantry (summoned soldiers).
- Fang of Vipernus (Nature) — Corrosive Spear + Purging Slam.
- Vulcan's Impaler (Fire) — Piercing Flames + Incinerating Spear. +HP/armor (tanky).

### 2.3 Cross-cutting weapon design lessons
- **Every weapon carries a stat trade-off** (e.g. +damage/-armor, +HP/-move, +multicast/-area).
  This makes weapon choice a build decision, not a pure upgrade.
- **Weapons re-skin the SAME character's attack** into a different element/skill-type, changing which
  status/synergy path is available. Element is a first-class build axis.
- **Pet/summon weapons alter the pet's inflicted debuff** (Hound Master) or the summoned creature
  (Beastmaster/Legionnaire) — the weapon reshapes an autonomous system rather than the player's swing.

---

## 3. Adaptation shortlist — top 25 ideas for a browser arena survivor

Each tagged and given a one-line mechanical implementation note.

1. **[EFFECT/SPRITE] Doom execute-bomb** — a delayed timer that stores accumulated damage, then
   detonates; if stored ≥ enemy HP it instantly executes and splashes 25% as AoE. Big-red-skull VFX
   counting down. Deeply satisfying against elites.
2. **[EFFECT/SPRITE] Poison plague-spread** — Poison DoT that jumps to a nearby enemy when its host
   dies. Green cloud that hops between corpses — turns a pack into a chain reaction.
3. **[EFFECT/SPRITE] Bleed movement-scaling** — DoT that has a chance to deal bonus damage each time
   the enemy moves. Red trail behind fleeing enemies; punishes kiting/rushers.
4. **[EFFECT] Status synergy chain** — applying status A rolls a chance to also apply B, chained in a
   ring (Bleed→Poison→Doom→Burn→Slow→Disarray→…). One hit cascades a cocktail. Highest build-diversity idea here.
5. **[EFFECT] Buff self-loop** — gaining buff A has a chance to also grant B in a ring
   (Finesse→Bulwark→Aptitude→…). A single buff proc snowballs a stacking buff engine.
6. **[STAT] Multicast chance** — % chance any weapon fires an extra time on activation; scales
   everything at once and feels explosive. Core diversity stat.
7. **[ITEM] Wound (effect-doubler)** — an on-hit debuff that has 50% chance to DOUBLE the stacks of
   any status already on the enemy. Universal multiplier item that supercharges any DoT build.
8. **[ITEM] Fragility / Exposed amp-debuffs** — stackable "+% damage taken" marks (universal vs
   direct-hit-only). Support/enabler items that reward a party of many small hits.
9. **[ITEM] Condemned burst-detonator** — enemy accrues stacks; at 10 the next crit deals +500%.
   A charge-and-pop payoff item that rewards crit builds.
10. **[EFFECT/SPRITE] Fire Walk trail** — leave a burning ground trail as you move that applies Burn.
    Movement becomes offense; great for a browser game's simple particle trail.
11. **[WEAPON/SWING] Whirlwind** — continuous spinning melee AoE around the player. The classic
    survivor bread-and-butter melee; cheap to render (rotating arc sprite).
12. **[WEAPON/SWING] Returning Throw Axe / Hammer** — projectile that flies out and boomerangs back,
    hitting on both legs. Doubles hits per cast with one sprite.
13. **[WEAPON/SWING] Orbiting blades/orbs** (Fiery Blades, Orbs of Destruction) — persistent bodies
    circling the player that damage on contact. Passive DPS + a defensive ring.
14. **[WEAPON/SWING] Ground Slam / Fissure** — targeted or on-cooldown shockwave that erupts from the
    ground in an area, with knockback + Brittle. Great "impact" feel.
15. **[WEAPON/SWING] Channeled Beam** (Frost Beam, Ray of Fire) — a continuous line you sweep by
    aiming; strong single-target with a satisfying sustained VFX.
16. **[WEAPON/SWING] Lobbed Bomb with delayed AoE** (Mortar/Cluster) — arcing projectile that lands
    and bursts, optionally splitting into bomblets. Range + area zoning.
17. **[WEAPON/SWING] Void Trap / deployable** — drop a stationary snare zone that detonates or roots
    when enemies enter. Adds positional/zoning play.
18. **[WEAPON/SWING] Summon pet** (Cave Bear, Spider Queen, Infantry) — spawn autonomous allies that
    fight; "Increased Quantity" scales the swarm. Idle-DPS build archetype.
19. **[EFFECT] Activated-ability charge economy** — attacking builds stacks of a resource buff; at a
    threshold your next cast auto-fires a bonus nuke (icicles, jolts, a beam, a healing wave). A
    second layer of progression within a single fight.
20. **[EFFECT] Retaliation counter** — on being hit, consume stacks to reduce the hit and instantly
    cast one of your skills back at the attacker. Defensive builds that punish being touched.
21. **[STAT] Reroll / Banish / Lock draft controls** — let players reshuffle offered upgrades,
    permanently remove bad ones from the pool, or hold a card for next level. Huge agency, low cost.
22. **[STAT] Conditional upgrade unlocks** — some upgrades only appear once the build qualifies (e.g.
    "2 fire skills unlocks fire-mastery"). Self-shaping pool that pushes coherent builds.
23. **[STAT] Trade-off cards** — pair a strong buff with a real downside (Leviathan: +damage/-move;
    glass-cannon weapons: +dmg/-armor). Makes choices spicy, not just "always take the biggest number".
24. **[STAT] DoT tuning stats** — separate "increase DoT damage", "tick faster", and "burst % of DoT
    instantly on apply" cards. Lets a poison/burn build deepen along three distinct axes.
25. **[EFFECT/SPRITE] Element-typed mastery** — tag every weapon/skill with an element and offer
    "+all Fire damage / area / multicast" cards. Rewards mono-element commitment and creates instantly
    readable build identities (fire = orange, ice = blue, poison = green).

---

### Quick priority pick (if implementing only a handful first)
The three systems that give the most "unique/impactful" flavor for the least code: **(a) the status
synergy chain (#4)**, **(b) the Wound effect-doubler + a couple of amp-debuffs (#7, #8)**, and
**(c) the activated-ability charge economy (#19)**. Layer those over a standard stat/weapon core and
builds immediately feel deep and combinatorial.
