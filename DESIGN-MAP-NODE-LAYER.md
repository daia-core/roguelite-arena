# Design — Map / Node Meta-Layer (the "Slay the Spire between waves" loop)

**Status:** design blueprint, ready to implement · **Author:** Daia (2026-07-03, off-hours) · **Ask:** Felix, 6:51 Jul 3

> **Why this doc exists / handoff note.** Felix asked at 6:51 to add a secondary game-loop layer —
> `wave/event → shop → map → wave/event` — with a branching node map (event / battle / elite battle,
> event-granted **artifacts** that drastically alter stats), and to *"research this roguelike map/node
> system online and compare to how it works in other games like Slay the Spire."* When that ask landed,
> both worker slots were busy (the 6:39 enemy/wave/boss overhaul owns `Enemy.ts`/`Game.ts`/`AoeZone.ts`
> live), so this heartbeat did the **research + design** — the part that touches no source files and
> can't race the live worker. Implementation should start **after** the 6:39 worker commits, because the
> map layer wraps the wave loop and both edit `Game.ts`. Exact integration points (with current line
> numbers) are in §7.

---

## 1. The ask, restated

Today the loop is **linear**: wave *N* (`playing`) → wave clears → `shop` → *Continue* → wave *N+1*.
It's a Brotato-style treadmill: the only between-wave choice is what to buy.

Felix wants a **map layer** inserted so the player *chooses their path* between waves, the way Slay the
Spire (StS) does between combats:

```
   wave/event  →  shop  →  MAP (pick next node)  →  wave/event  →  shop  →  MAP  →  …  →  BOSS
```

Node types he named: **event** (may grant **artifacts** — powerful run-long modifiers that change stats
or *how stats behave*), **battle** (a normal wave), **elite battle** (a harder wave). He explicitly
flagged that *"one thing that might be diff[erent]"* from StS — see §3, that difference is the crux of
the design.

---

## 2. Research synthesis — how the genre does it

**Slay the Spire** (the reference Felix named) — sources at the bottom:
- The run is a **grid-generated tree of branching paths**, climbed bottom-to-top. Internally a 7×15
  irregular grid; ~6 paths are drawn through it and unpaired rooms culled, which produces the branching
  fan. Rules keep it fair: ≥2 distinct start nodes, paths never cross, and two edges out of the same
  node must go to *different* node types.
- **Node types:** Monster, Elite, Rest Site, Shop, Treasure, Unknown `?` (event), Boss.
- **Fixed-position rules** give the act a rhythm: no Elites in the first 5 floors, a Treasure row
  mid-act, Rest sites near the top (but never the floor right before the boss), one Boss node fused to
  the top that every top-row path funnels into.
- **Why it's the whole game:** choices *compound* over an act. Skilled players read the *entire* map
  before their first click, counting elites/shops/rests on each route, and re-plan mid-act as fights go
  well or badly. The map is a **risk/reward routing puzzle**, not decoration.

**Hades** — the same "pick your next room" idea but **one door at a time**: you don't see a whole map,
you see the *reward symbol* over each of 2–3 exit doors (a boon, gold, a heart, a hammer…) and pick.
Lower cognitive load, more momentum, less long-horizon planning. Its **Boons** are the model for Felix's
**artifacts**: run-long modifiers that don't just add numbers but *change rules* ("your dash deals
damage", "your cast now attaches and detonates").

**FTL** — a sprawling node map with a **moving threat** (the rebel fleet) that pushes you forward, so you
can't greedily clear everything; you trade thoroughness for safety. Good source of the "you can't take
every node, and skipping hurts" tension.

**Brotato / Vampire Survivors** (our genre base) — historically *no* map: linear waves + shop (Brotato)
or one long timer (VS). So a map layer is a genuine **cross-pollination**: StS's routing meta bolted onto
a real-time survival core. That's novel and good — but it's exactly why StS can't be copied 1:1 (§3).

**The reusable pattern (all four):** a between-combat **meta-layer** whose value is *meaningful choice
under scarcity* — you cannot have everything, and picking well compounds. Everything below serves that.

---

## 3. The key adaptation — why our map is NOT Slay the Spire's (Felix's "difference")

StS combat is **discrete and turn-based**: a fight is a self-contained puzzle, so a 15-floor act of
distinct one-off rooms works. **Our combat is real-time wave-survival** — a "battle" node *is* a live
wave of the same enemy pool, and difficulty is a smooth numeric ramp, not hand-authored encounters. Three
consequences shape the design:

1. **The map is short and per-"act", not a 15-floor climb.** A real-time wave takes 30–60s and is
   physically tiring in a way a StS turn isn't. A 15-node gauntlet with no break would be a slog. Design
   for a **compact map of ~5–7 columns per act**, then a Boss, then (optionally) a harder next act that
   re-uses the generator with scaled content — mirroring StS's "same map, 3 acts" without the length.

2. **Node difficulty is *relative to the current wave number*, not absolute floors.** StS hard-codes
   "elites from floor 6". We instead tag each node with a difficulty **multiplier on the current ramp**:
   a `battle` node = the normal wave *W*; an `elite` node = wave *W* with an elite modifier (+HP/+damage,
   a guaranteed mini-boss, denser spawns) and a better reward. The wave counter keeps advancing globally,
   so the numeric ramp Felix already tuned stays intact — the map just chooses *flavour + reward + risk*
   at each step, not the raw power level.

3. **The shop stays a guaranteed step, the map is the *branch*.** Felix's stated order is
   `wave → shop → map → wave`. So unlike StS (where Shop is *one of* the node types you might route
   past), here **the shop is unconditional after every combat** and the *map* is where the real choice
   lives. This is the cleanest fit for the existing loop and keeps the economy predictable. (We can still
   add an *optional* Shop node on the map later for extra buys — see §5 — but the post-wave shop is
   always there.)

**Design verdict:** adopt StS's **branching-tree routing** and **node variety**, adopt Hades's **boon =
artifact** rule-changing rewards, but keep it **short-act, ramp-relative, shop-guaranteed**. That's the
"different from StS" the ask points at.

---

## 4. The core loop, after this change

```
 startNewGame → MAP(act 1, at start node)
      │
      ▼
   player picks a reachable node ──► resolve node:
      ├─ battle      → playing (normal wave W)         ──► shop ──► back to MAP
      ├─ elite       → playing (wave W + elite mod)    ──► shop ──► back to MAP
      ├─ event       → event screen (choice; may grant artifact) ──► (shop if it makes sense) ──► MAP
      ├─ treasure    → guaranteed artifact/gold, no fight ──► MAP
      ├─ rest/forge  → heal or upgrade an item          ──► MAP
      └─ boss (top)  → playing (boss wave) ──► shop ──► next ACT map (scaled)  OR  win
```

Every combat still funnels through the existing shop. The map is entered **once per step**, right where
`startNextWave()` is called today (§7).

---

## 5. Node types — proposed roster

Start with the first five for the MVP; the rest are the depth pass.

| Node | Icon idea | What happens | Reward | Notes |
|---|---|---|---|---|
| **Battle** | crossed swords | Normal wave *W* | Gold + XP as today | The default; ~50% of nodes |
| **Elite Battle** | red skull | Wave *W* with elite modifier: +HP/+dmg, a guaranteed **mini-boss** (reuse the 6:39 mini-boss work), denser/faster spawns | **Guaranteed artifact** + extra gold | High risk / high reward — the StS elite. Gates behind ~col 2+ |
| **Event `?`** | question mark | A text choice screen (2–3 options), Hades/StS style: gamble gold, take an artifact with a downside, heal-for-a-cost, fight-for-loot | Often an **artifact**, sometimes gold/heal/curse | The variety + story spice; see §6 |
| **Treasure** | chest | No fight — a free **artifact** choice (pick 1 of 3) or a gold cache | Guaranteed | StS's blue chest. ~1 per act, mid-map |
| **Rest / Forge** | campfire | Choose: **heal** (restore % max HP) **or** **upgrade** one owned item to its t3/t4 form (reuse EvolutionSystem) | — | The StS rest site; near the top of the act |
| **Shop (optional map node)** | coin bag | An *extra* between-wave shop with a reroll already paid | Buy | Optional — the guaranteed post-wave shop already exists, so this is a "bonus buy" node, low priority |
| **Boss** | large skull | The act's boss wave (reuse the 6:39 boss pass) | Big artifact + gold, advance act | One per act, fused to the top row like StS |

**Distribution rules (adapted from StS §2), ramp-relative:**
- Column 1 is always plain **Battle** (ease-in, ≥2 distinct starts).
- **Elites** only from column ~2 onward; never two elites back-to-back on one path.
- Exactly one **Treasure** in the middle third; one **Rest/Forge** in the top third but never the column
  right before the Boss.
- Two edges out of the same node must resolve to **different** node types (StS's anti-degenerate rule) —
  keeps every fork a real choice.

---

## 6. The Artifact system (Felix's headline: "drastically alters stats or how stats behave")

Artifacts are **run-long modifiers granted by map nodes** (events, treasure, elites, boss). They are the
Hades-boon / StS-relic layer and are the reason the map matters. Crucially they are **distinct from the
three systems that already exist** — don't fold them in:

- `ItemSystem` **items** = bought in the shop, additive stat stacks (the 188-item roster).
- `TransformationSystem` = passive **set bonuses** (3 melee items → Berserker). Isaac-style.
- `EvolutionSystem` = **weapon evolutions** (base + catalyst + level → evolved weapon). VS-style.
- **Artifacts (NEW)** = **map-granted, rule-changing run modifiers.** Not bought, not set-triggered — you
  *route* to them. This is the new axis of build diversity the map unlocks.

**Two artifact tiers of effect** (make sure the roster has both, or they feel like "just more items"):

1. **Numeric-but-huge** — big swings you'd never get from one shop item. E.g. *"+50% damage, −25% max
   HP"*, *"double XP gain"*, *"+2 projectiles"*. Implement as multipliers on the existing `PlayerStats`
   pipeline (`ItemSystem.ts` L2818). Cheap to build — reuses the stat system.

2. **Rule-changing** (the *"how stats behave"* Felix asked for) — these are the memorable ones and need
   small hooks in the combat code:
   - *Glass Cannon* — take double damage, deal triple.
   - *Momentum* — damage scales with how long you've been moving (rewards kiting).
   - *Second Wind* — first lethal hit each wave leaves you at 1 HP instead of dying.
   - *Vampiric Field* — kills heal, but max HP slowly decays each wave.
   - *Overcharge* — every 5th shot is a free nova (reuse the nova aux weapon).
   - *Berserk Core* — the lower your HP, the higher your fire rate.
   - *Glass Orbiter* — your orbit orbs deal 3× but you can't regen.
   Each is a flag on the player + a few lines at the relevant combat site. Ship 4–6 to start; they're the
   "wow" content.

**Implementation shape:** a new `ArtifactSystem.ts` mirroring `TransformationSystem.ts` — a registry of
`Artifact { id, name, desc, icon, rarity, apply(stats/player), hooks }`, a `heldArtifacts[]` on the run
state, an `applyArtifacts()` that runs on grant and on wave start, and a handful of named hook points the
combat loop checks (`onKill`, `onHit`, `onWaveStart`, `onShoot`). Persist in `SaveManager` run state.

---

## 7. Architecture & exact integration points

**A new game state.** `Game.ts:31` today:
```ts
export type GameState = 'menu' | 'playing' | 'shop' | 'paused' | 'gameover' | 'upgrades';
```
Add `'map'` (and `'event'` for the event screen). Add `case 'map':` / `case 'event':` to the update
switch (`Game.ts:444`) and the render switch (`Game.ts:2363`).

**A new module — `MapSystem.ts`** (self-contained, mirrors the existing system modules):
```ts
type NodeType = 'battle' | 'elite' | 'event' | 'treasure' | 'rest' | 'shop' | 'boss';
interface MapNode { id; col; row; type: NodeType; edges: id[]; visited: boolean; }
interface ActMap { nodes: MapNode[]; currentNodeId; act: number; }
class MapSystem {
  generateAct(act, waveBase): ActMap        // the StS-style grid generator (§5 rules)
  reachableFrom(nodeId): id[]                // nodes connected by an edge from current
  pick(nodeId): NodeType                     // advance current, mark visited, return type
  // + draw(ctx) and hit-testing for node clicks (touch-first; nodes are big tap targets)
}
```

**The one behavioural hook — where the map is inserted.** Today the shop's *Continue* button calls
`startNextWave()` (`Game.ts:2204`), which immediately does `startWave(currentWave+1)` + `state='playing'`.
Change *Continue* to open the map instead:
```ts
// was: startNextWave()  → startWave + state='playing'
// now:
private toMapFromShop(): void {
  if (!this.actMap) this.actMap = this.mapSystem.generateAct(1, this.waveManager.currentWave);
  this.state = 'map';
  this.input.mouseDown = false;
}
```
Then node selection resolves the choice:
```ts
private onMapNodePicked(nodeId): void {
  const type = this.mapSystem.pick(nodeId);
  switch (type) {
    case 'battle':  this.startWave(this.waveManager.currentWave + 1); this.state='playing'; break;
    case 'elite':   this.startWave(this.waveManager.currentWave + 1, { elite:true }); this.state='playing'; break;
    case 'boss':    this.startWave(this.waveManager.currentWave + 1, { boss:true });  this.state='playing'; break;
    case 'event':   this.state = 'event'; this.rollEvent(); break;
    case 'treasure':this.grantTreasure(); this.state='map'; break;   // stay on map after
    case 'rest':    this.state = 'rest'; break;
  }
}
```
The `{ elite/boss }` flag on `startWave` is where this **depends on the 6:39 worker**, which is
overhauling `WaveManager`/`Enemy` with mini-bosses, bosses and elite variants right now. Build the map on
top of *their* committed elite/boss support rather than inventing a parallel one — hence: **implement
after they merge.** (`completeWave()` at `Game.ts:1770` still routes every combat → `shop` unchanged; only
the shop's exit changes from "next wave" to "open map".)

**Rendering & input:** `MapSystem.draw()` renders the node graph (columns L→R or bottom→top), greys out
unreachable nodes, highlights the reachable ones. Reuse the existing pixel/panel UI (`pixel/panel.ts`) and
the touch input path (`Input.ts`) — nodes must be **big tap targets** (mobile-first, per the game's
constraints). A back-to-menu/pause affordance stays available.

**Persistence:** add `actMap` + `heldArtifacts` to the `SaveManager` run snapshot so a refreshed run
restores mid-map. The game already saves per-wave (`Game.ts:1789`).

---

## 8. Suggested build phasing (each phase shippable + QA-able)

1. **Phase 1 — the loop skeleton (MVP).** Add `'map'` state; generate a trivial linear-with-one-fork map
   of `battle` nodes; wire shop-*Continue* → map → pick → wave. Prove the `wave→shop→map→wave` loop runs
   and persists. *No new content yet* — just the structure. Verify with a headless run (extend
   `qa-mobile-playthrough.mjs`): clear a wave, land on the map, pick a node, land in the next wave.
2. **Phase 2 — node variety.** Add `elite` (on the 6:39 elite/mini-boss support), `treasure`, `rest/forge`
   (reuse EvolutionSystem for the upgrade option), and the StS distribution rules (§5). Full branching
   generator with the anti-degenerate rules.
3. **Phase 3 — the artifact system.** `ArtifactSystem.ts` + 8–10 artifacts (mix of numeric-huge and
   rule-changing per §6), granted by treasure/elite/boss. This is the build-diversity payoff.
4. **Phase 4 — events.** The `?` event screen with 2–3 choice text events (gamble/heal/artifact-with-
   downside). Author ~8–12 events.
5. **Phase 5 — acts & boss integration.** Boss node fused to the top (reuse the 6:39 boss); clearing it
   generates act 2 with scaled content; the "same generator, harder act" StS structure.

Ship and verify each phase against the **shipped `frontend/dist` bundle** (cp-b3), and confirm each new
node type is genuinely **reachable in a real run** (cp-b7), not just force-spawned in a harness — the two
verification lessons this project already learned.

---

## 9. Open questions for Felix (don't block the MVP — reasonable defaults chosen)

1. **Act length / structure** — I've assumed **short acts (~5–7 columns) → boss → scaled next act**, not
   one long climb, because real-time waves tire faster than turns (§3.1). Good? Or one long map?
2. **Is the post-wave shop still guaranteed?** I kept it unconditional (map = the branch, shop = every
   step), matching your stated `wave→shop→map→wave` order. Confirm vs. making Shop a *map node* like StS.
3. **Do you want visible whole-map planning (StS)** — see all nodes, plan the route — **or Hades-style
   "pick 1 of the next 2–3 doors"** (less planning, more momentum)? I lean StS (matches "choose which path
   to take") but Hades is arguably a better fit for mobile + real-time pacing. This is the biggest UX fork.
4. **Artifact power ceiling** — how run-warping should they get? Glass Cannon / Second Wind-tier
   rule-breakers, or keep them tamer? Sets the tone of the whole layer.

---

### Sources
- [Map Generation in Slay the Spire (Steam community guide)](https://steamcommunity.com/sharedfiles/filedetails/?id=2830078257)
- [Slay the Spire 2 map pathing / routing strategy](https://bossdown.com/guides/slay-the-spire-2-map-pathing-guide/)
- [Map generation — Spire Codex](https://beta.spire-codex.com/mechanics/map-generation)
- [Slay the Spire map in Unity (open-source implementation)](https://github.com/silverua/slay-the-spire-map-in-unity)
