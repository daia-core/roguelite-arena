# Broken-build roguelike research — Brotato · Vampire Survivors · HoT · DMD · 20MTD · DRG:S · Soulstone

Design-inspiration dump for the roguelite-arena item redesign (2026-07-03). Felix's steer:
lean **Brotato / broken-build**, mine **all relevant wikis**, want **a lot of content**, rework
items **on judgment** (some flat stat items are fine as the "floor").

Numbers below are ballpark from each game's wiki — design targets, not values to copy verbatim.

---

## PART A — BROTATO (primary direction)

### A1. Trade-off items (real bonus + real cost) — the core feel-good pattern
- **Glass Cannon** — +25% Damage, −3 Armor.
- **Injection** — +7% Damage, −2 Max HP (small, stackable).
- **Head Injury** — +6% Damage, −8 Range (free for melee, painful for ranged).
- **Cape** — +5% Lifesteal, +20% Dodge, −2 to ALL damage types.
- **Big Arms** — +12 Melee, +6 Ranged, −3% Atk Speed, −3% Speed.
- **Ball and Chain** — +15% Damage, +3 Armor, +5 Knockback, −3% Speed, hard 0.75s min cooldown (caps atkspd).
- **Esty's Couch** — +2 HP Regen per −1% Speed you have, −20% Speed (self-synergizing slow build).
- **Metal Detector** — +material-doubling, +6 Luck, +2 Eng, −5% Damage.
- **Jet Pack** — +15% Speed, +10% Dodge, −5 Max HP, −1 Armor.
- **Explosive Shells** — +60% Explosion Damage, +15% size, −15% Damage (all-in AoE tax).
- **Triangle of Power** — +20% Damage, +1 Armor, −2% Damage per hit taken until wave end (front-load, decays).

### A2. Broken-build / cross-stat converters — the "engine" pieces a run is built around
- **Bloody Hand** — +10% Lifesteal, **+2% Damage per 1% Lifesteal**, take 1 dmg/s. Sustain → damage multiplier.
- **Giant Belt** — crits deal **+10% of enemy CURRENT HP** as bonus (1% vs boss). Percent-HP crits melt tanks.
- **Greek Fire** — burning deals **+10% of enemy current HP** as damage. Percent-HP DoT scales infinitely.
- **Power Generator** — **+1% Damage per 1% Speed**, −5% base Damage (speed → damage).
- **Retromation's Hoodie** — **+2% Atk Speed per 1% Dodge**, −80 Range (dodge-tank → atkspd monster).
- **Stone Skin** — **+1 Max HP per Armor**, −6% Atk Speed (armor → tankiness).
- **Coil** — +5 Knockback, **+1% Damage per Knockback** (knockback → damage).
- **Lucky Coin** — **+2 Luck per 1% Crit Chance**, −2 Armor (crit → economy).
- **Nail** — weapon damage scales with **20% of Engineering**, −2 Ranged.
- **Rip and Tear** — 20% chance enemies explode on death for melee-scaled AoE, −5% Crit (melee → chain clear).
- **Scared Sausage** — 25% burn-apply chance each, **caps at 4 = 100%** (the burn enabler).

### A3. Conditional / triggered items
- **On-crit:** Eyepatch (+1 pierce on crit), Hunting Trophy (material on killing crit), Tentacle (heal on crit-kill).
- **On-kill:** Cyberball (25% chance to zap a random enemy when one dies — chain clear).
- **On-material:** Baby Elephant (25% zap a random enemy when you pick up material).
- **On-hurt:** Saltwater (+melee/+atkspd/+speed 3s after taking damage), Triangle of Power (decay, above).
- **While standing still:** Statue (+40% Atk Speed), Barricade (+8 Armor/+3 KB), Chameleon (+20% Dodge).
- **Low-HP:** Regeneration Potion (regen ×2 below 50%), Sunken Bell (explode below 40% HP, once/wave).
- **Per-enemy-nearby:** Community Support (+1% Atk Speed per living enemy on screen, −2 Armor).
- **Wave-end snowball:** Robot Arm (+3 Melee/+3 Eng, −1 Max HP each wave), Vigilante Ring (+3% Damage/wave).
- **Ramping-while-clean:** Crystal (+1% Atk Speed/sec, RESET on taking damage).

### A4. Stat mechanics worth stealing (caps steer builds)
- **Lifesteal** hard cap ~10 HP/s → favors many-small-hits weapons (SMG), not big snipers. Indirect dmg (burn/explosion/turret) does NOT lifesteal.
- **Armor** = flat EHP (linear, no true diminishing). **Dodge** = capped % mitigation (60% cap), swingy. Pair both.
- **Atk Speed** diminishing returns + ~12/s cap → stops single-stat runaway.
- **Engineering** ignores ALL combat stats (structures use only Eng) → forces commit-or-don't build split.
- **Harvesting** compounds +5% per trigger → snowball economy. **Piggy Bank** +20% of held materials/wave, expires wave 20 (hoard vs spend tension).
- **Per-damage-type** (Melee/Ranged/Elemental) flat bonuses make builds mechanically distinct, not just tagged.

### A5. Weapon-class personalities (set bonuses telegraph the build)
Blade = melee lifesteal bruiser · Unarmed = dodge brawler · Blunt = slow tank (+armor/−speed) ·
Precise = crit · Heavy = raw damage · Gun = range/kite · Elemental = burn/DoT · Explosive = AoE ·
Medical = regen · Tool = engineering/turrets · Primitive = early HP · Legendary = strong but −Max HP tax.

---

## PART B — VAMPIRE SURVIVORS (firing personalities + evolutions)

### B1. Firing personalities (the variety axis — ~7 archetypes carry everything)
Directional-cleave (Whip, Song of Mana) · homing/nearest (Magic Wand, Cross-boomerang) ·
random-strike (Fire Wand, Lightning Ring) · fixed-spread stream (Knife, Phiera 4-way) ·
thrown-arc/gravity (Axe, Bone-bounce, Cherry Bomb) · orbital (King Bible, Peachone/Ebony Wings) ·
aura/proximity (Garlic + knockback/freeze-resist debuff) · ground-zone (Santa Water puddles) ·
ricochet-pinball (Runetracer) · screen-clear (Pentagram) · summon (Gatti Amari) ·
control (Clock Lancet freeze, Laurel shield).

### B2. Passives (global multipliers, but each weapon IGNORES some stats → real decisions)
Spinach +dmg · Armor +flat armor/retaliate · Hollow Heart +max HP · Pummarola +regen ·
Empty Tome −cooldown · Candelabrador +area · Bracer +proj speed · Spellbinder +duration ·
Duplicator +projectile amount · Attractorb +magnet · Clover +luck · Crown +xp · Stone Mask +gold ·
Wings +move · Skull O'Maniac +curse · Tiragisú revive.

### B3. Evolutions — "combine two things into something new" (the pattern I most want)
- Whip + Hollow Heart → **Bloody Tear** (cleave + lifesteal on crit).
- Magic Wand + Empty Tome → **Holy Wand** (fires continuously).
- Knife + Bracer → **Thousand Edges** (endless stream).
- Axe + Candelabrador → **Death Spiral** (9 orbiting scythes).
- King Bible + Spellbinder → **Unholy Vespers** (permanent orbit ring).
- Fire Wand + Spinach → **Hellfire** (piercing flaming meteors).
- Garlic + Pummarola → **Soul Eater** (aura that heals per enemy hit).
- Santa Water + Attractorb → **La Borra** (puddles roam toward you).
- Runetracer + Armor → **NO FUTURE** (ricochet laser + retaliate).
- Lightning Ring + Duplicator → **Thunder Loop** (each strike hits twice).
- Peachone + Ebony Wings → **Vandalier** (two orbitals fused — a *union*, weapon+weapon).
- Pentagram + Crown → **Gorgeous Moon** (screen-clear + vacuum all XP).

**System:** max the weapon + hold the required passive → transform. Unions need two weapons.
Recipe knowledge itself becomes a collectible meta-layer.

### B4. Interaction rules
- **Stat-relevance gating** — a +proj-speed item is dead on orbital/aura weapons → makes shop picks matter.
- **Pool limit caps Amount** — extra projectiles do nothing past a weapon cap (stops infinite single-lever stacking).
- **Cross-weapon synergy** — Garlic lowers freeze resistance so a freeze weapon *works* (aura enables control).

---

## PART C — OTHER SURVIVORS (mechanics VS/Brotato don't have)

### C1. Status-ailment WEB (Soulstone — the standout idea)
- **Ailments trigger other ailments:** applying Fragility → 50% Bleed; Chill → 50% Fragility;
  Bleed → 50% Poison; Doom → 50% Confusion. Engineer a chain so one hit blooms into a full stack.
- **DoTs can CRIT on application** — crit multiplies the DoT's *total* then spreads it over duration. Unifies crit + DoT trees.
- **Fragility** (+1% all damage taken/stack) vs **Weakness** (+1.2% ailment damage/stack) — separate amp stacks, multiplicative.
- **Poison scales off other ailments at tick** (amped by Fragility+Weakness on target) → exponential-feeling.
- **Doom** = delayed 5s burst, reapply refreshes + grows, enough stacks **executes**. Time-bomb ailment.
- **Curses** = à-la-carte toggleable difficulty/reward (granular self-handicap).

### C2. Stack / overflow mechanics (Halls of Torment)
- **DoT stacks to 20; the 21st application detonates** for a burst → rewards multi-hit overflow.
- **Overcrit / over-effect:** chance above 100% grants EXTRA procs (crit strikes / status applications). "Wasted" overcap becomes scaling.
- **Fragile** (amp direct dmg) vs **Affliction** (amp DoT) — split debuff types.
- **Branching trait forks** — pick one branch, the other disappears (committal identity).
- **Ability masteries** — each weapon forks into 2-3 distinct upgrade paths (orbital vs piercing-debuff).
- **Artifacts** = opt-in difficulty toggles, many pure trade-offs (−max HP per level-up, −50% healing).

### C3. God-boon / tempo enablers (Death Must Die)
- **Frost chain:** Chilled → Frozen → **Shatter executes below 20% HP**; Icebound = frozen take more dmg. Control → execute package.
- **Lightning = tempo:** chain arcs + cut all cooldowns → makes every on-hit item fire more (the proc engine).
- **Ruptured** — damage when enemy moves/knocked back; **attack speed scales with # Ruptured enemies** (crowd = DPS).
- **Malady** — spreads active status effects to nearby enemies when a cursed enemy dies (contagion chain).
- **Legendary boons rewrite rules:** God of War (2× damage, only +22% dmg taken), Vampirism (armor → lifesteal).

### C4. Ammo/reload/element triggers (20 Minutes Till Dawn)
- **Ammo & reload as triggers:** Energized (lightning 20% → refill ammo). Ammo economy as an axis vs flat fire rate.
- **Burn = additive stacks** (each fire bullet +1 stack; multi-projectile = more stacks).
- **Lightning = on-hit chance to strike, scales with fire rate** → fastest weapon + lightning = screen clear.
- **Named element synergies** appear only when you own two elements (Fire + Lightning → Overload) — rewards cross-tree.

### C5. Legible trade-off tiers (Deep Rock: Survivor)
- **Overclocks color-coded:** Clean (buff, no cost) / Balanced (big buff + equal penalty) / Unstable (huge buff + heavy penalty). Make trade-off severity **visually legible** by rarity.
- **Capstone item transforms a weapon's role** (flamethrower OC adds beams). The rare-tier pick redefines the build.

---

## SYNTHESIS — the toolbox to apply to our items
1. **Cross-stat converters** ("+X of A per point of B") are the memorable broken pieces → add several.
2. **Every strong bonus gets a cost a *different* build won't mind** (−range free for melee, −armor free for dodge).
3. **Percent-current-HP effects** (crit/burn/execute) answer "how to kill tanky bosses" — gate behind a build.
4. **Ailments trigger ailments; DoTs crit on apply; overflow detonates** — richest emergent-combo source.
5. **Conditional triggers reward a playstyle** (standing still, on-hurt, low-HP, per-enemy-nearby, wave-end snowball).
6. **Caps steer builds** (lifesteal→many hits, dodge cap, atkspd cap).
7. **Firing personalities > raw numbers** — reskin damage across orbit/aura/zone/boomerang/bounce/control.
8. **Rarity = trade-off severity** (Clean/Balanced/Unstable) — legendaries should transform a build, not "+60% damage".
