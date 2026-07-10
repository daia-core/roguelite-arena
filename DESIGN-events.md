# Event System Design Reference

*Last updated: 2026-07-10. Reflects EventSystem.ts at 39 events.*

The `?` node is the main narrative/choice break between waves. Events are data-driven in
`EventSystem.ts`; `Game.ts` resolves effects at the sites it already owns (economy, health,
artifact pool). The system supports four flavors of event that together keep the `?` node
varied and build-relevant.

---

## Event Flavors

### 1. Regular Events (21)
Pure upside, risk/reward trades, or pure choice — no build gate. Always relevant regardless of
player build. The breadth of the `?` pool. Best for: situational trade-offs the player evaluates
cold (gold vs item vs heal), early-run resource scrambles, and guaranteed-not-terrible options.

### 2. Devil Deals (7)
Hard, permanent curses in exchange for a big immediate reward. The "sell your soul" axis.
Every devil deal has a free "walk away" option so the gate is a real choice, not a wall.
The curse is always granted by id (from ArtifactSystem's curse registry), not randomly picked —
so each deal has a known, legible downside the player can plan around.

Curse roster covered:
| Curse | Effect | Events using it |
| --- | --- | --- |
| curse_frailty | +50% incoming damage | devil_bargain |
| curse_sloth | -30% move speed | devil_bargain, devil_rot_crown |
| curse_dullness | -25% fire rate | devil_altar |
| curse_glass_bones | -45 max HP | devil_brittle_crown |
| curse_famine | -40% XP | devil_starving_god, cursed_reliquary |
| curse_myopia | -12% crit | devil_hollow_eye |

### 3. Stat-Gated Events (11)
Slay-the-Spire-style: an option is greyed and un-clickable until the player's stat meets the
threshold. When unlocked, the gated option is strictly better than the fallback path, so
committing to a build pays off tangibly. Every gated event still keeps a free/neutral "leave"
path so it's never a dead stop.

Gated options are read from `PlayerStats` at the moment the event opens via
`Game.meetsRequirement()`. The 7 gating stats: `meleeDmgPct`, `rangedDmgPct`, `critPct`,
`moveSpeedPct`, `armor`, `maxHp`, `gold`.

#### Starter tier (thresholds at modest investment):
| Event | Stat gate | Gated reward |
| --- | --- | --- |
| boulder (Fallen Boulder) | Melee +30% | artifact + 25g |
| sniper_perch (Distant Lantern) | Ranged +30% | artifact |
| tightrope (Frayed Tightrope) | Move speed +25% | artifact + item |
| assassins_mark (Sleeping Warden) | Crit +25% | artifact + 60g |
| iron_gate (Bent Portcullis) | Armor 5+ | 2× item |
| blood_toll (Blood Toll) | Max HP 140+ | 2× artifact |
| high_roller (High Roller) | Gold 100+ | 2× artifact |

#### Advanced tier (serious build commitment required):
| Event | Stat gate | Gated reward |
| --- | --- | --- |
| iron_vault (Iron Vault) | Armor 15+ | 2× artifact + 50g |
| war_idol (War Idol) | Melee +50% | artifact + 50 max HP |
| blade_corridor (Blade Corridor) | Crit 40%+ | artifact + item + 40g |

### 4. Pure Choice Events (1)
No gate, no hidden outcome — the option labels are explicit about what you get. The player
declares intent. Best for: letting the player fix what they're missing (artifact/HP/gold)
without any stat prerequisite.

| Event | Choices |
| --- | --- |
| oracle_choice (Oracle's Chamber) | artifact OR +45 max HP OR 70g |

---

## Full Catalog (39 events)

### Regular Events
| id | Title | Mechanic |
| --- | --- | --- |
| shrine | The Forgotten Shrine | Pay 30g → artifact OR pray free → 40% heal OR leave |
| wager | The Gambler | Gold gate (40g) → +40g, OR bet blood → hurt + artifact, OR walk |
| cache | Abandoned Cache | Item OR 50g (pure choice, both good) |
| transfusion | The Blood Pact | +40 max HP + artifact OR heal 50% OR refuse |
| merchant | Wandering Merchant | Pay 60g → artifact OR pay 20g → item OR browse free |
| fountain | The Healing Fountain | 70% heal OR +25 max HP (both good, pure choice) |
| gauntlet | Trial of the Reckless | Accept → hurt + artifact + 30g OR decline |
| beggar | The Grateful Beggar | Give 25g → artifact OR give nothing |
| armory | Ruined Armory | Item OR 35g OR 35% heal (three-way choice) |
| pillar | The Memory Pillar | Item OR 50% heal OR leave |
| poison_well | The Poison Well | Drink deep → hurt + artifact OR cautious sip → hurt + heal OR leave |
| orc_champion | The Orc Champion | Duel → hurt + artifact + 40g OR tribute 50g → item OR back away |
| burial_mound | Ancient Burial Mound | Dig → item + hurt OR offering 20g → 40% heal OR walk past |
| echoing_library | The Echoing Library | Study → +30 max HP + item OR grab → item + 20g OR burn → 80g |
| bone_witch | The Bone Witch | Trade -30 max HP → artifact OR trade 40g → 60% heal OR nothing |
| trapped_chest | Suspicious Chest | Open boldly → item OR spike it → hurt + artifact OR leave |
| traveling_smith | The Traveling Smith | 2 pieces (50g) OR reinforce 30g → +25 max HP OR watch |
| haunted_mirror | The Haunted Mirror | Reach through → hurt + artifact OR smash → 45g OR walk |
| flooded_vault | The Flooded Vault | Wade → 2× item OR dive → artifact + hurt OR drain → 55g |
| twin_gamble | The Twin's Challenge | Accept → hurt + 2× artifact OR bribe 60g → 35% heal OR refuse |
| siege_engine | The Dormant Siege Engine | Fire → 2× item + 30g OR strip → 85g OR leave |

### Devil Deals
| id | Title | Deal | Curse |
| --- | --- | --- | --- |
| devil_bargain | The Devil's Bargain | artifact OR 120g | frailty (+50% dmg taken) / sloth (-30% speed) |
| devil_altar | The Bleeding Altar | +60 max HP + artifact OR pay 25% HP → artifact | dullness (-25% fire rate) |
| devil_brittle_crown | The Brittle Crown | artifact OR sell for 60g | glass_bones (-45 max HP) |
| devil_starving_god | The Starving God | artifact + 50 max HP OR pray 40g → 60% heal | famine (-40% XP) |
| devil_hollow_eye | The Hollow Eye | artifact + 80g | myopia (-12% crit) |
| devil_rot_crown | The Rot Crown | +80 max HP + artifact OR tear for 55g + 25% heal | sloth (-30% speed) |
| cursed_reliquary | The Cursed Reliquary | 2× artifact OR 1 artifact OR burn → 45g + 20% heal | famine (-40% XP) |

### Stat-Gated Events
*(see tables above)*

### Pure Choice Events
| id | Title | Options |
| --- | --- | --- |
| oracle_choice | The Oracle's Chamber | artifact / +45 max HP / 70g |

---

## Stat Coverage Analysis

| Stat | Starter gate | Advanced gate | Total gates |
| --- | --- | --- | --- |
| meleeDmgPct | boulder (+30%) | war_idol (+50%) | 2 |
| rangedDmgPct | sniper_perch (+30%) | **none** | 1 ⚠️ |
| critPct | assassins_mark (+25%) | blade_corridor (+40%) | 2 |
| moveSpeedPct | tightrope (+25%) | **none** | 1 ⚠️ |
| armor | iron_gate (5+) | iron_vault (15+) | 2 |
| maxHp | blood_toll (140+) | **none** | 1 ⚠️ |
| gold | high_roller (100+) | — | 1 (+ wager at 40g) |

**Gaps to fill (next content pass):**
1. **Advanced ranged gate** — Ranged +50%+, triple reward (2× artifact + gold). The ranged build
   currently tops out at the starter gate; a committed ranged run should have a big late-game pay-off.
   Narrative idea: "The Sniper's Nest" — a tower position that only a true marksman can exploit.
2. **Advanced speed gate** — Move speed +45%+, high mobility pay-off. Speed builds exist but have
   no advanced reward. Narrative idea: "The Collapsing Bridge" — cross before it falls, only the
   very fast make it in time.
3. **Starter maxHp gate** (≈ 100 HP) — A lower-threshold HP gate to make tanky builds feel
   powerful sooner. The blood_toll at 140+ is the only HP gate and it's high. Narrative idea:
   "The Weight-Bearing Pillar" — hold up a collapsing ceiling while looting beneath it; needs
   a sturdy frame.

---

## Design Principles

### Balance rules
- Gated options should be strictly better than the fallback (not just different). The gate IS the
  cost; the option shouldn't also cost HP/gold on top.
- Devil deals are always opt-in (free "walk away") and name the curse explicitly in the result
  text so the player isn't surprised post-choice.
- Regular events should have at least one "nothing" / zero-cost exit so the player never feels
  trapped by a bad option set.
- Gated rewards scale with threshold: starter gates (25–30%) reward one good thing (usually
  artifact or 2× item); advanced gates (40–50%) reward two things (2× artifact, or artifact + item
  + gold combo).

### Mechanics coverage
Each new event should cover at least one of: artifact pull, item grant, gold shift (±), HP shift
(heal or hurt or max), curse attachment. Mixing two or three creates interesting risk/reward. Avoid
events that only do `nothing` across all paths — every event should have at least one real outcome
for the player who engages.

### Narrative texture
Consistent tone: dark fantasy, slightly sardonic. The world is hostile but offers real choices.
Avoid: generic loot-room flavour without a distinct encounter. Each event should feel like a
specific moment — a character, a room, a hazard.

### Adding a new stat gate
1. Pick a stat + threshold (starter: 25–30%; advanced: 40–50%+ for the "serious build" tier).
2. Write a gated option that is strictly better than the fallback by exactly one "unit" of value
   (e.g. gated = 2 artifacts, fallback = hurt + 1 artifact, leave = nothing).
3. Add `requirement: { stat, min, label }` on the better option only.
4. Keep the label short: "Melee +30%", "Armor 5+", "100+ gold" — the label renders on the button.
5. Verify with `qa-events.mjs` after adding (checks every event has at least one non-gated option).

---

## Effect Reference

| Effect kind | Fields | Notes |
| --- | --- | --- |
| `artifact` | — | Grants one random un-held artifact from the pool |
| `gold` | `amount: number` | Positive = grant, negative = cost (event cannot grant negative-cost option without the player having enough) |
| `heal` | `frac: number` | Heals frac × maxHP; event damage never kills |
| `hurt` | `frac: number` | Deals frac × maxHP; clamped to leave 1 HP |
| `maxHp` | `amount: number` | Permanent +/- to max HP |
| `item` | — | Grants one random shop-tier item |
| `curse` | `id: string` | Grants a specific named curse artifact (devil-deal exclusive) |
| `nothing` | — | No effect (explicit "leave" option) |
