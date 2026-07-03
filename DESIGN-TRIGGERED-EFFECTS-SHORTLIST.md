# Triggered / Conditional / Ramping Effect Layer — Design Shortlist

Research-driven shortlist of ~18 SPECIFIC item/artifact effect designs the game is missing.
Every current effect is a static stat/flag; this proposes the **conditional + ramping layer**
that turns items from stat sticks into build-defining engines.

Mined from: Risk of Rain 2 (proc chains, on-kill, on-elite, ramping), Slay the Spire relics
(start-of-combat, every-Nth, HP-threshold, first-time-each-combat, on-damage), Binding of Isaac
(damage/kill triggers), Brotato (permanent per-wave/per-kill stacks, stat-scales-off-stat,
risk trade-offs), Vampire/Soulstone Survivors (curse-as-scaling, on-hit status).

## What already exists (do NOT re-propose)
- All static stats + per-type dmg mults, multishot/pierce/homing/multicast, aux weapons, AoE mult.
- On-hit status engines: burn/bleed/poison(+spread)/freeze/chain/explosion/doom/wound.
- Duos, Transformations, Evolutions, Artifacts, meta-progression, node map.
- **Partial** conditional hooks EXIST but ONLY on the Artifact layer, not as buyable items:
  glassCannon, secondWind, vampiric (kill-heal), momentum (move-ramp), berserk (low-HP fire rate),
  thorns, overcharge (every-Nth-shot nova). The gap is a **general trigger bus** that items,
  not just run-modifier artifacts, plug into.

## The missing mechanic classes (the real gap)
1. **on-kill** — fires when an enemy dies (any source)
2. **wave-start / wave-end** — fires at the boundary between waves
3. **hp-threshold** — active only while HP above/below X%
4. **ramping-stack** — gains PERMANENT (or per-wave) stacks from play; the item grows
5. **risk-tradeoff** — pay HP / curse / a downside for scaling power
6. **proc-chain** — on-hit effects that can trigger other on-hit effects (+ luck reroll)
7. **on-damage-taken / on-dodge** — fires when you get hit or evade
8. **every-Nth-hit / first-hit** — periodic or first-of-wave attack rider
9. **stat-scales-off-stat** — one stat reads another as its input (build cross-pollination)
10. **on-elite / on-boss** — conditional bonus vs special enemies

Implementation spine (shared): add a lightweight **event bus / hook registry** to the game loop
with named hooks — `onKill(enemy)`, `onWaveStart(n)`, `onWaveEnd(n)`, `onPlayerHit(dmg)`,
`onDodge()`, `onShotFired()`, `onHit(enemy, dmg, ctx)`. Items/artifacts register handlers.
A per-run mutable `runState` bag holds ramping counters (permanent stacks, kill counts). Most
effects below are one handler + one counter. This ONE piece of infra unlocks the entire class.

---

## GROUP A — On-Kill (needs: `onKill` hook + runState counters)

**A1. Ceremonial Daggers** — *On kill, spawn 3 homing spectral daggers that seek nearby enemies.*
- Class: on-kill (proc-chain adjacent). Source: RoR2 Ceremonial Dagger.
- Why: turns kills into a self-sustaining chain — clears trash, snowballs in dense waves, and
  visually reads as "the build is working". Scales per stack (more/harder daggers).
- Hook: `onKill` → emit N short-lived homing projectiles at death position, reusing the existing
  projectile + homing code. Damage = % of player base damage.

**A2. Harvest Momentum (Bloodthirst)** — *Each kill grants +X% fire rate for 3s, stacking; refreshes on kill.*
- Class: on-kill ramping (decaying). Source: Isaac Berserk / RoR2 kill-uptime feel.
- Why: rewards staying in the fray and chaining kills; creates a "flow state" that falls off if
  you stop killing — a skill-expressive tempo layer, not a flat stat.
- Hook: `onKill` → push a timed stack onto a decaying buff; cap the stack count.

**A3. Soul Tithe** — *Every 10th kill drops a gold/health orb; every 50th kill grants a permanent +1% damage.*
- Class: on-kill milestone + permanent ramp. Source: Brotato Will-o'-Wisp / RoR2 farming feel.
- Why: gives long waves a payoff curve and makes "clear speed" itself a stat. Permanent portion
  makes early pickup snowball across the whole run (a reason to buy it turn 1).
- Hook: `onKill` → increment counter; on modulo, drop pickup or bump a permanent `runState.dmgStacks`.

**A4. Executioner's Edge** — *Enemies below 15% HP are instantly killed.*
- Class: on-hit threshold execute (kill accelerator). Source: RoR2 Guillotice/Death Mark.
- Why: distinct from doom (which stores damage) — this is a flat execute window that scales the
  *value of every other damage source* by removing the enemy's chunky tail-end HP. Great vs elites.
- Hook: in the existing hit-resolution site, after damage, if `enemy.hp < 0.15*maxHp` → kill +
  fire `onKill`. Threshold scales per stack; cap ~40%.

---

## GROUP B — Wave-Start / Wave-End (needs: `onWaveStart` / `onWaveEnd` hooks)

**B1. Opening Salvo** — *At wave start, unleash a free full-screen nova and freeze all enemies for 1.5s.*
- Class: wave-start burst. Source: StS Bag of Marbles / Stone Calendar.
- Why: converts the dangerous opening rush into a power fantasy; gives crowd-control builds a
  reliable panic button on a fixed schedule (predictable, plannable — very StS-relic).
- Hook: `onWaveStart` → trigger one nova pulse at max radius + apply freeze status to all live enemies.

**B2. War Chest** — *At the end of each wave, gain gold equal to 3× the current wave number.*
- Class: wave-end economy ramp. Source: Brotato per-wave income / StS Gremlin Horn econ.
- Why: an economy engine that compounds — scales the shop instead of combat, enabling greed builds.
  Late waves pay out huge, rewarding survival.
- Hook: `onWaveEnd(n)` → `gold += 3*n`. Trivial; pairs with existing interest/luck.

**B3. Grindstone** — *At the end of each wave, permanently gain +2 max HP and +1% damage.*
- Class: wave-end permanent ramp (the core "I grow every wave" item). Source: Brotato Robot Arm /
  Grind's Magical Leaf.
- Why: the definitive scaling passive — buying it early is a long-run investment (surviving longer
  = compounding), a decision axis the current flat-stat shop lacks entirely.
- Hook: `onWaveEnd` → bump permanent `runState` stat stacks; fold into stat recompute.

**B4. Adrenaline Reserve** — *Start each wave with a shield that blocks the first hit; unused shield converts to 20% fire rate for that wave.*
- Class: wave-start conditional resource. Source: StS Anchor/Orichalcum.
- Why: rewards clean play (dodge everything → keep the fire-rate bonus) with a real risk decision;
  more interesting than a flat block because the *reward branches on your performance*.
- Hook: `onWaveStart` → set `runState.waveShield=1`; on first `onPlayerHit` consume it; if it
  survives to `onWaveEnd`, grant a temp buff (already have the buff machinery from A2).

---

## GROUP C — HP-Threshold (needs: HP-band checks read at stat/combat sites)

**C1. Last Stand** — *While below 30% HP, +50% damage and +25% dodge.*
- Class: low-HP threshold buff. Source: StS Red Skull; Brotato low-HP items.
- Why: a comeback/clutch engine that makes low HP a *build resource* rather than pure danger;
  pairs viciously with lifesteal/thorns and the existing berserk artifact for a glass-brawler.
- Hook: recompute derived stats when HP crosses the band, or gate the multipliers at read time.

**C2. Overflow Battery** — *While ABOVE 90% HP, +40% fire rate and +20% projectile speed.*
- Class: high-HP threshold buff (the inverse — rewards NOT getting hit). Source: novel/StS-style.
- Why: creates a distinct "stay pristine" playstyle opposite to Last Stand; the two are mutually
  exclusive on the same build, forcing an identity choice.
- Hook: same band-check; flag on when `hp/maxHp >= 0.9`.

**C3. Sanguine Pact** — *Regenerate 3% max HP/sec, but your max HP is capped (cannot be raised further).*
- Class: hp-threshold sustain + trade-off. Source: Brotato Handcuffs / regen items.
- Why: turns a defensive build into a self-healing tank while closing off the max-HP scaling lane —
  a genuine opportunity cost, not just a number.
- Hook: `onWaveEnd`/stat-apply → set `runState.maxHpCapped=true`; gate maxHealthBonus application.

---

## GROUP D — Ramping-Stack (needs: permanent counters in runState)

**D1. Growing Malice** — *Gains +3% damage every 15 seconds of the run, forever (no cap).*
- Class: time-ramping permanent. Source: RoR2 linear stacking feel / survival scaling.
- Why: makes the *clock* a stat — a pure scaling payoff for defensive/survival builds that just
  need to not die. Late-game damage solution for tanky rosters.
- Hook: a tick timer in the loop increments `runState.timeStacks`; fold into damage.

**D2. Trophy Rack** — *+1% crit chance for each unique enemy TYPE you've killed this run (cap ~25%).*
- Class: variety-ramping permanent. Source: Brotato Spider ("per different weapon") pattern.
- Why: rewards exploration/variety, ramps naturally as the bestiary opens up, and is fun to watch
  climb; a "collector" scaling stat with a clean ceiling.
- Hook: `onKill` → add `enemy.type` to a Set; crit = base + set.size%.

**D3. Hoarder's Instinct** — *+0.5% damage for every 100 gold you currently hold (uncapped).*
- Class: resource-scales-stat (dynamic, read live). Source: Brotato stat-off-stat / RoR2 gold builds.
- Why: makes banking gold a damage decision — greedy interest builds become offensive, and it
  swings live as you spend (buying items lowers your damage momentarily: a real tension).
- Hook: read at damage-calc site: `dmg *= 1 + 0.005*floor(gold/100)`.

---

## GROUP E — Risk / Trade-off (needs: HP-cost hooks, curse counter)

**E1. Blood Pact** — *+8% damage for every 1% lifesteal you have, but lose 1 HP/sec.*
- Class: risk trade-off + stat-off-stat. Source: Brotato Bloody Hand.
- Why: a self-damaging engine that only works if your lifesteal out-heals the drain — a knife-edge
  build that scales explosively when assembled. Deeply build-defining.
- Hook: DoT on the player each second (reuse enemy DoT loop on the player); damage-calc reads
  lifesteal stat.

**E2. Cursed Idol (Torrona's Box)** — *+25% to ALL offensive stats, but +50% enemy count/speed each wave (Curse).*
- Class: risk trade-off — global difficulty for global power. Source: VS Torrona's Box.
- Why: introduces a **Curse** axis the game lacks — voluntarily raising difficulty for reward,
  the classic "banish before the last level" tension if tied to stacking. Endgame-defining.
- Hook: add `runState.curse` read by the wave spawner (count/speed) and by stat recompute (power).

**E3. Glass Reactor** — *Convert all armor to damage: lose all armor, gain +12% damage per point lost.*
- Class: one-time conversion trade-off. Source: RoR2 glass / Brotato Knot.
- Why: a build-locking payoff item that punishes tank builds and rewards evasion builds — creates
  a fork where the same item is trash or god-tier depending on your other picks.
- Hook: on pickup, zero `runState.armor`, add flat damage; flag so armor can't be re-applied.

---

## GROUP F — On-Hit-Taken / On-Dodge (needs: `onPlayerHit` / `onDodge` hooks)

**F1. Riposte** — *When you dodge an attack, instantly deal 300% damage to the attacker.*
- Class: on-dodge counter. Source: Brotato Riposte.
- Why: turns dodge from pure defense into an offense stat — a dodge-stacking build becomes a
  counter-attacking porcupine. New reason to buy dodge.
- Hook: at the dodge-resolution site (dodge already exists), on success fire a bolt at the source.

**F2. Retaliation Core** — *When you take a hit, release a nova that knocks back and deals damage scaled to the hit taken.*
- Class: on-damage-taken burst. Source: Brotato Kraken's Eye / RoR2 on-hit.
- Why: makes getting hit survivable and punishing to the swarm — good for tank builds that expect
  to eat contact damage; the bigger the hit, the bigger the payback.
- Hook: `onPlayerHit(dmg)` → nova pulse with damage = f(dmg). Reuses nova code.

**F3. Second Wind Charm (item version)** — *Once per wave, a lethal hit leaves you at 1 HP and grants 2s invulnerability.*
- Class: on-damage-taken survival (first-time-each-wave). Source: StS/Isaac "guardian angel" +
  existing secondWind artifact, but as a buyable, stackable-per-wave item.
- Why: promotes the run-modifier-only mechanic into the shop economy so any build can buy safety;
  stacking = multiple saves per wave. High value, clear.
- Hook: reuse existing `secondWind` logic; add per-wave charge counter + brief i-frames.

---

## GROUP G — Every-Nth / First-Hit + Proc-Chain (needs: `onShotFired`, luck reroll on procs)

**G1. Pen Nib (Loaded Shot)** — *Every 10th shot deals triple damage and pierces all.*
- Class: every-Nth-attack. Source: StS Pen Nib.
- Why: a predictable rhythm-based burst that rewards fire-rate builds (more shots = more big hits)
  and gives a satisfying periodic "thunk"; visually telegraphs.
- Hook: `onShotFired` → counter; on modulo, tag the next projectile with a damage+pierce rider.

**G2. Opening Shot** — *Your first hit on each NEW enemy applies all your on-hit statuses at once.*
- Class: first-hit-per-target rider. Source: StS Akabeko + RoR2 on-hit density.
- Why: massively amplifies status/DoT builds against fresh swarms (instant burn+bleed+poison stack)
  without buffing sustained single-target — rewards spreading damage wide.
- Hook: mark enemies with a `firstHitDone` flag; on first `onHit`, force-apply status procs.

**G3. Fourleaf Charm (proc luck)** — *All random on-hit effects roll twice and take the better result.*
- Class: proc-chain enabler / luck reroll. Source: RoR2 57 Leaf Clover.
- Why: THE keystone for the whole status/proc ecosystem — pushes chance-based procs toward
  guaranteed, letting proc-chains (chain→explosion→doom) actually snowball. Build-defining glue
  that makes every other %-chance item better (a synergy multiplier, the fun of RoR2 clover).
- Hook: wrap the RNG used by burn/bleed/poison/doom/wound/multicast/chain rolls in a
  "roll twice, keep higher" when this is held. Also enables true **proc-chains**: let on-hit
  status procs themselves re-enter `onHit` (with a depth guard) so explosion-on-hit can trigger
  chain lightning, etc.

---

## Priority ranking (build first)

**Tier 1 — build the bus + highest impact (do these first):**
G3 Fourleaf Charm (unlocks proc-chains), B3 Grindstone (the scaling item the game lacks),
A3 Soul Tithe, C1 Last Stand, A1 Ceremonial Daggers, E2 Cursed Idol (adds Curse axis).

**Tier 2 — strong, cheap once the bus exists:**
A4 Executioner's Edge, B1 Opening Salvo, B2 War Chest, D3 Hoarder's Instinct, F1 Riposte,
G1 Pen Nib, E1 Blood Pact.

**Tier 3 — flavour + coverage:**
A2 Harvest Momentum, B4 Adrenaline Reserve, C2 Overflow Battery, C3 Sanguine Pact,
D1 Growing Malice, D2 Trophy Rack, E3 Glass Reactor, F2 Retaliation Core, F3 Second Wind Charm,
G2 Opening Shot.

## One-paragraph implementation summary
Add a `HookBus` with named events fired from existing combat/loop sites (`onKill`, `onWaveStart`,
`onWaveEnd`, `onPlayerHit`, `onDodge`, `onShotFired`, `onHit`) plus a `runState` bag for permanent/
per-wave counters (kill counts, time stacks, enemy-type Set, permanent stat stacks, curse, shields).
Extend the `Item` type with an optional `hooks` descriptor (or a small per-item handler id) and a
`ramp` field, and have the stat-recompute fold permanent stacks in alongside artifacts. Nearly every
effect above is then one small handler + one counter — the infra is the 80%, the 18 items are the 20%.

## Sources
- Risk of Rain 2: [Item Stacking](https://riskofrain2.wiki.gg/wiki/Item_Stacking),
  [Proc Coefficient](https://riskofrain2.wiki.gg/wiki/Proc_Coefficient),
  [Ceremonial Dagger](https://riskofrain2.fandom.com/wiki/Ceremonial_Dagger),
  [Death Mark](https://riskofrain2.wiki.gg/wiki/Death_Mark)
- Slay the Spire: [Relics List](https://slaythespire.wiki.gg/wiki/Relics_List)
- Brotato: [Items](https://brotato.wiki.spellsandguns.com/Items), [Stats](https://brotato.wiki.spellsandguns.com/Stats)
- Binding of Isaac: [Damage-triggered items](https://bindingofisaacrebirth.fandom.com/wiki/Category:Damage-triggered_items),
  [Items](https://bindingofisaacrebirth.wiki.gg/wiki/Items)
- Vampire Survivors: [Torrona's Box](https://vampire.survivors.wiki/w/Torrona%27s_Box)
