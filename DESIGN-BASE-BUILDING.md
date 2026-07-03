# Design — Between-Runs Base / Village (the "Cult of the Lamb" meta-progression home)

**Status:** design blueprint, ready to implement · **Author:** Daia (2026-07-03, off-hours) · **Ask:** Felix, 7:02 Jul 3

> **Why this doc exists / handoff note.** Felix asked at 7:02 to replace the flat souls-upgrade *menu*
> with a **walkable between-runs base** à la Cult of the Lamb — "a larger base (screen scrolls as the
> player moves around) with things that can be upgraded that in turn grant the player benefits during
> runs. Houses and stuff, be sure to really make the pixel art beautiful so players feel proud of the
> base/village they are upgrading," and to *"research similar roguelike systems and keep improving on
> the design and pixel art."* This heartbeat did the **research + design** — the part that touches no
> source files and can't race the live enemy/wave/boss worker (which owns `Enemy.ts`/`Game.ts`/`AoeZone.ts`).
> The single most important design decision is in §3: **this is a presentation + interaction overhaul
> of the souls economy we already have, NOT a new simulation.** Implementation should start after the
> 6:39 worker commits (both edit `Game.ts`). Exact integration points with current line numbers are in §7.

---

## 1. The ask, restated

Today, permanent progression is a **flat grid menu**. From the main menu you open `'upgrades'`
(`GameState`, `Game.ts:31`); `drawUpgrades()` (`Game.ts:3345`) lays the 20 `MetaProgression` upgrades
out as `DARK_WOOD_THEME` panels in a `cols`-wide grid, you tap a panel to buy the next level with
souls, and a Back button returns you. Functional, but it's a spreadsheet — there's no *place*, no
sense of a home you build up and feel proud of.

Felix wants that same souls economy re-expressed as a **village you walk around**:
- A base **larger than one screen** — the camera scrolls as the player character moves through it.
- **Buildings/houses** you upgrade; each upgrade grants a run benefit (exactly what the souls upgrades
  already do today).
- Buildings that **visibly grow/beautify** as you invest, so the screen becomes a monument to your progress.
- **Beautiful pixel art** — this is called out twice; it's a first-class requirement, not decoration.

The crucial scoping insight (see §3): we do **not** need to build Cult of the Lamb's follower/faith
*simulation*. We need its **feel** — a hand-crafted, walkable, visibly-upgrading home that fronts a
meta-currency we already have (souls) and upgrades we already have (the 20 in `MetaProgression.ts`).

---

## 2. Research synthesis — how the genre does the "between-runs home"

**Cult of the Lamb** (the reference Felix named) — sources at the bottom:
- The base is *not* a between-run menu; it's a **walkable, hand-arranged settlement** whose buildings
  each serve a purpose, and the meta-currency (Devotion → **Divine Inspiration**) is spent to unlock/
  upgrade them on an **escalating cost tiered tree** — early upgrades cheap, later ones gated behind
  spend thresholds.
- **Buildings route bonuses into the run indirectly** (rituals, survivability, economy) rather than all
  being flat +stat — but the load-bearing design lesson for *us* is simpler: **each structure maps to a
  concrete, legible upgrade, and structures visibly tier up** (Sleeping Bag → Shelter → Grand Shelter).
- **No dead-end buildings**: once a structure's unlock purpose is served, it *changes output* (devotion
  → gold) so nothing on screen becomes useless. Design principle to steal: **a maxed building still
  looks/does something** (see §6 "maxed state").
- **Low-friction, high-pride presentation**: buildings can be freely re-placed; the player *arranges*
  their home. We'll take a lighter version (fixed, hand-designed plots) to keep scope sane — the pride
  comes from the art tiering up, not from a placement sim.

**Hades — the House of Hades / Mirror of Night** (the cleanest analog to our exact situation):
- Meta-upgrades live in a **single beautiful walkable room** (not a spreadsheet). The **Mirror of Night**
  is a flat list of permanent stat upgrades bought with Darkness — *mechanically identical to our souls
  menu* — but it's framed inside an explorable, lavishly-arted hub you walk through. The **House
  Contractor** then spends a second currency to **visibly redecorate/upgrade the hub** as you progress.
- **This is the lowest-risk template for us**: keep the existing upgrade list as the data model, present
  it as a walkable, art-rich space, and let purchases visibly change the space. Hades proves you get
  ~90% of the "proud of my home" feeling without a management sim.

**Rogue Legacy (the Castle/Manor)** — the manor literally **constructs itself brick-by-brick** as you
buy stat upgrades; the building growing *is* the upgrade UI. Direct inspiration for our
"building sprite advances with `currentLevel`" mechanic (§6).

**Moonlighter / Dead Cells (the Hub Town)** — a town of NPC shops you walk between, each shop
unlocked/upgraded with run currency, each visibly improving. Confirms the **"cluster related upgrades
into a themed building"** pattern we use in §4 (e.g. all offense upgrades → the Forge).

**Synthesis → our design pillars:**
1. **Reuse the economy, replace the surface.** Souls + the 20 `MetaProgression` upgrades stay exactly
   as the data model. The village is a new *view* + *interaction* over them. (Minimal, non-over-engineered.)
2. **Walkable, camera-scrolling, hand-designed** — not a placement/management sim.
3. **Buildings tier visibly** with `currentLevel` (Rogue-Legacy/CotL pride loop).
4. **Legible mapping**: every building states exactly which run benefit it grants (Hades Mirror clarity).
5. **No dead ends**: maxed buildings reach a golden "fully built" hero state.

---

## 3. The design fork Felix implied — and the scoping decision (the crux)

Felix said *"instead of permanent progression just being a menu … add a between-runs base similar to
Cult of the Lamb."* There are two ways to read "similar to Cult of the Lamb," and picking the right one
is the whole ballgame:

- **(A) Full simulation** — followers, faith, resource nodes, rituals, base-editing, a second economy
  loop that runs *while you're away*. This is a second game bolted on. **Rejected as default** — it's
  weeks of scope, a whole new set of balance problems, and it isn't what makes the souls menu feel bad.
- **(B) Walkable art-rich hub over the existing economy** (the **Hades model**) — the souls upgrades
  become buildings in a scrolling village you walk through; buying an upgrade visibly builds/tiers its
  building. **This is the recommended read** and what this doc designs. It delivers every literal thing
  Felix asked for — larger-than-screen base, scroll-as-you-move, upgradeable houses granting run
  benefits, beautiful pixel art to be proud of — **without** inventing a simulation he didn't ask for.

**Recommendation: build (B).** It's the honest minimum that satisfies the ask, it reuses `MetaProgression`
untouched, and it leaves a clean seam to *later* add light CotL-style life (wandering villager sprites,
a passive souls-trickle building) if Felix wants more after seeing it. Open question OQ-1 (§9) surfaces
this to him explicitly so he can veto toward (A) if he actually wants the sim.

---

## 4. Mapping the 20 existing upgrades → buildings (the content spine)

The 20 `MetaProgression` upgrades (`MetaProgression.ts:29-192`) cluster naturally into **themed
buildings**, so the village reads as a real settlement, not 20 identical huts. Each building hosts one
or more upgrades; interacting with a building opens a compact panel to buy the next level of its
upgrade(s) (reusing the existing `drawPanel`/buy logic, §7). Building **visual tier** = sum (or max) of
its hosted upgrades' `currentLevel` (§6).

| Building (pixel structure) | Hosts upgrade id(s) | Run benefit it grants | Theme/vibe |
|---|---|---|---|
| **The Forge** 🔥 (smithy, anvil, chimney smoke) | `starting_damage`, `starting_fire_rate`, `starting_crit` | Offense — dmg / fire-rate / crit at run start | glowing forge, sparks |
| **The Infirmary** ❤️ (cottage w/ herb garden) | `starting_health`, `starting_regen`, `permanent_shield` | Survivability — HP / regen / start shield | green, warm windows |
| **The Armory** 🛡️ (stone keep) | `starting_armor`, `boss_damage` | Defense + boss dmg | fortified stone |
| **The Market** 💰 (stalls, awnings, coin sign) | `starting_gold`, `gold_gain`, `shop_discount`, `reroll_discount` | Economy — gold + cheaper shop/reroll | bustling, banners |
| **The Academy** ⭐ (library/tower) | `xp_gain`, `double_level_ups` | Progression speed — XP + level-ups | arcane, candlelit |
| **The Stables** 👟 (barn + track) | `starting_speed` | Move speed | wooden barn |
| **The Vault** 🎁 (treasury) | `starting_item`, `starting_legendary` | Start-item / legendary drops | ornate, gilded |
| **The War Table** 👑 (tent + banners) | `elite_rewards`, `wave_skip` | Elite rewards + wave-skip | command tent |

That's **8 hand-designed buildings** covering all 20 upgrades — a satisfying village to walk, each plot
distinct. (Grouping is a presentation choice; the underlying `purchaseUpgrade(id)` calls are unchanged,
so this can't break balance.) The building→upgrade grouping should live in a small **data table in the
village module**, not hard-coded in render, so Felix can re-theme freely.

**Central landmark:** a **Shrine/Bonfire** in the village center showing total `souls` and the
"Embark" gate that starts a run (replaces the current menu's Start button as the natural home exit).

---

## 5. Village layout & the walkable camera

- **World size:** ~2.5–3 screens wide × ~1.5 tall (Felix's "larger base, screen scrolls"). Buildings sit
  on hand-placed plots around a central plaza + the Shrine; a path/road threads them so the eye (and
  the player) has a route.
- **Player avatar:** reuse the existing player sprite. Movement reuses the existing `Input` vector
  (WASD/arrows on desktop, the existing floating touch-joystick on mobile — already built, `qa-joystick`
  passing). No new input code.
- **Camera:** a simple follow-camera clamped to world bounds — the game already has world/camera scaling
  for gameplay zoom (the `zoom`/render-scale machinery in `Renderer`/`Game.ts`), so this is a translate
  offset applied to the village draw pass, clamped so you never see past the edge.
- **Interaction:** walk near a building → it highlights + shows a floating prompt ("⚙ Upgrade The Forge")
  → tap/interact opens that building's upgrade panel (a focused version of today's `drawPanel` card, one
  building's upgrades only). Close returns to walking. This replaces the monolithic 20-cell grid.
- **Mobile:** proximity-highlight + a single big "Upgrade" button when near a building (no precise tapping
  of tiny grid cells — strictly better than today's grid on a phone).
- **Ambient life (cheap pride wins):** drifting smoke from the Forge, lantern flicker at night, a couple
  of wandering villager sprites, birds — all `Particle`/sprite-frame loops the engine already supports.

---

## 6. Pixel-art direction (grounded in the actual engine)

The engine already has the exact primitives to make this beautiful — this is **not** a from-scratch art
pipeline, it's composing tools that exist:

- **Buildings as data-driven sprites** — `renderSprite`/`renderGrid` (`pixel/sprite.ts`) turn a
  `{palette, frames:number[][][]}` grid into a canvas. Each building is one such sprite (or a small
  layered stack: base + roof + props). Chunky readable pixels at `scale ≈ 6–8`, consistent with the
  enemy sprites already shipping.
- **Ground & foliage** — `paintTerrain` (`pixel/terrain.ts`) already paints layered grass/dirt/patches +
  scatter decorations; use it for the village ground so plots sit in real terrain, not a flat fill.
  `StardewBackground` (`StardewBackground.ts`) is the existing warm, layered outdoor backdrop — reuse it
  as the village's base scene so it instantly looks like a *place*.
- **Panels/signage** — the upgrade cards + building signs reuse `drawPanel` with the existing
  `WOOD_THEME`/`STONE_THEME`/`PARCHMENT_THEME` (`pixel/panel.ts`) so the UI already matches the game's look.
- **The pride loop — buildings tier with `currentLevel`:** each building has **3–4 visual tiers** keyed
  to its hosted upgrade level(s):
  - **Tier 0 (unbuilt):** a plot with foundations/scaffold — *an inviting gap that asks to be filled.*
  - **Tier 1–2:** a modest then improved structure (e.g. Forge: cold anvil → lit forge with smoke).
  - **Max tier:** a **golden "hero" state** — banners, glow, extra props, a subtle particle flourish —
    so a fully-invested village visibly *shines* (the CotL "no dead ends" + Rogue-Legacy self-building
    manor lesson). This is where the "feel proud" payoff lives.
  Implementation: a building's draw picks its sprite frame from `currentLevel` — a few extra grids per
  building, cached once via the existing sprite renderer. Cheap at runtime.
- **Cohesion rules (so it reads as one beautiful world, not clip-art):** one shared ~24–32 colour palette
  across all buildings; consistent light direction (top-left) and a single ground-shadow convention;
  warm dawn/dusk ambient tint over the whole village. A tight palette + consistent light is 80% of why
  hand-pixelled scenes look "beautiful" vs "asset-flip."
- **Day/night (optional polish, OQ-3):** a slow ambient-colour cycle with lit windows/lanterns at night —
  huge perceived-quality gain for a small overlay cost.

**Art production note:** the building sprites are the one genuinely *new* asset workload. They're
data grids (`number[][][]`) authorable directly in TS like the existing sprites — no external art tool
needed. Suggest building them one theme at a time (Forge first as the vertical-slice proof), reviewing
each in isolation via a headless screenshot (the `qa-pixel-art.mjs` harness already exists for exactly
this) before wiring the next — so quality is verified per-building, not judged only at the end.

---

## 7. Exact integration points (current line numbers — verify at build time)

The whole feature is scoped to the **meta/home surface**; it does **not** touch run-time combat code, so
it's low-collision with the enemy/wave worker *except* both edit `Game.ts` (sequence after they commit).

1. **State (`Game.ts:31`):** `GameState` — rename/replace `'upgrades'` with `'village'` (or add
   `'village'` and retire `'upgrades'`). One string + its switch cases.
2. **Data model — leave `MetaProgression.ts` UNTOUCHED.** Souls, the 20 upgrades, `canPurchaseUpgrade`/
   `purchaseUpgrade`/`getAllUpgrades`/`addSouls`/`calculateSoulsEarned` all stay. The village is a new
   view over this class — this is what keeps the change safe and small.
3. **New module `VillageScene.ts`** (self-contained, mirrors how `StardewBackground`/systems are split
   out): owns the building→upgrade mapping table (§4), plot layout (§5), the follow-camera + world
   bounds, player-avatar walk + proximity detection, per-building tier→sprite selection (§6), and the
   focused upgrade panel. Exposes `update(dt, input)` + `draw(ctx)` + an `onEmbark()` callback.
4. **Replace the flat menu render (`Game.ts:3345 drawUpgrades`)** with `village.draw(ctx)`. The old grid
   layout (`getUpgradesLayout`) and the grid draw can be deleted once the village ships.
5. **Replace the grid click handling (`Game.ts:2286-2292`)** — that block currently loops all upgrades
   and buys on click of a grid cell. New: `village.update()` handles proximity + the building panel; buys
   still call the **same** `metaProgression.purchaseUpgrade(id)` (unchanged economy).
6. **Entry/exit:** the main-menu button that currently opens `'upgrades'` opens `'village'`; the Shrine's
   **Embark** starts a run (calls the existing run-start path — souls/upgrades already apply at
   `Game.ts:323-383`, no change). The souls display (`Game.ts:2428`, `3355`) moves onto the Shrine.
7. **Camera:** village-local translate offset clamped to world bounds, applied around the village draw
   pass only (gameplay camera is separate). Reuse `Renderer` scale conventions.
8. **Save:** none needed beyond what exists — `MetaProgression` already persists souls + levels to
   `localStorage` (`STORAGE_KEY 'roguelite_meta'`). The village derives its visuals from those levels, so
   a returning player's base is already "built" from their save. (No new save schema = no migration risk.)

**Sequencing:** start after the 6:39 enemy/wave/boss worker commits `Game.ts`, to avoid a merge fight.
The map-node layer (`DESIGN-MAP-NODE-LAYER.md`, `t-82ac5f`) also edits `Game.ts`; these two are largely
disjoint (map = in-run between-wave loop; village = out-of-run home), but land them one at a time.

---

## 8. Build plan (phased — each phase is a shippable, verifiable slice)

- **Phase 1 — Walkable shell.** New `'village'` state + `VillageScene.ts`: `StardewBackground` +
  `paintTerrain` ground, player avatar walking with the existing input, follow-camera clamped to a
  >1-screen world, an Embark shrine that starts a run. *No buildings yet.* Verify: you can walk a
  scrolling base and start a run. (Proves the whole surface works before art.)
- **Phase 2 — One building, end-to-end (vertical slice).** The **Forge** with its 3–4 pixel tiers,
  proximity highlight, focused upgrade panel buying `starting_damage`/`fire_rate`/`crit` via the
  unchanged `MetaProgression`. Screenshot-review the Forge art (`qa-pixel-art.mjs`) at each tier. This
  is the quality bar; get it beautiful before replicating.
- **Phase 3 — Remaining 7 buildings** to the same bar, one theme at a time, each art-reviewed in
  isolation. Full 20-upgrade coverage now lives in the village.
- **Phase 4 — Pride & polish.** Max-tier golden states, ambient particles (forge smoke, lanterns),
  wandering villagers, optional day/night tint. Retire the old grid menu + dead layout code.
- **Phase 5 — QA & ship.** Full walkthrough on the **shipped `frontend/dist`** (per cp-b3 — build fresh,
  verify the deployed bundle, not a stale copy), mobile 390×844 pass (proximity-upgrade reachable by real
  touch, per cp-b7 — the upgrades must be *buyable through the real walk-up path*, not just in code),
  perf check (village draw shouldn't regress FPS), then deploy + verify live hash.

---

## 9. Open questions for Felix (with sensible defaults so build isn't blocked)

- **OQ-1 (the big one) — sim depth.** Default = **(B) walkable art hub over the existing souls economy**
  (Hades model, §3): every literal thing you asked for, no follower/faith simulation. Ping me if you
  actually want the full Cult-of-the-Lamb *management* layer (followers, resources, passive economy) —
  that's a much bigger, separate build I'd scope on its own.
- **OQ-2 — building grouping.** Default = the **8 themed buildings** in §4 (Forge/Infirmary/Armory/
  Market/Academy/Stables/Vault/War Table). Alternative = one hut per upgrade (20 tiny buildings — more
  to walk, less characterful). I recommend the 8.
- **OQ-3 — day/night cycle.** Default = **ship without it in Phase 1–4, add in Phase 4 polish** if it
  looks good. Cheap, high perceived-quality, but not load-bearing.
- **OQ-4 — placement freedom.** Default = **fixed hand-designed plots** (pride comes from art tiering up).
  Free CotL-style placement is a bigger UX + save-schema cost; add later only if you want the base-editor toy.

---

## Sources

- [Cult of the Lamb — Buildings (Fandom wiki)](https://cult-of-the-lamb.fandom.com/wiki/Buildings)
- [Base building and design tips guide — Destructoid](https://www.destructoid.com/base-building-and-design-tips-guide-cult-of-the-lamb/)
- [The best Cult of the Lamb Divine Inspiration upgrades — PCGamesN](https://www.pcgamesn.com/cult-of-the-lamb/divine-inspiration-upgrades)
- [Cult of the Lamb: Best Upgrades to Get First — ScreenRant](https://screenrant.com/best-starting-upgrades-get-first-cult-lamb/)
- Hades (House of Hades / Mirror of Night), Rogue Legacy (manor), Moonlighter/Dead Cells (hub town) — genre synthesis from prior design knowledge.
