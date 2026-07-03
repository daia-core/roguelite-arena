# Roguelite Arena — Architecture Review

*2026-07-03. Reviewing `/workspace/work/roguelite-game/frontend/src` (~19.7k lines, ~40 modules) for
optimization, modern principles, and — the point Felix cares about most — how easily it can keep
being improved and grown with new content.*

## Verdict

The engine is in good shape and, importantly, **adding content is already easy** — items, enemies,
and waves are data-driven tables, not hardcoded logic. Performance is handled with the right tools
(quadtree, culling, object pools, offscreen caches). The codebase is **not over-engineered** — there
are very few speculative abstractions.

There is exactly **one** architectural debt worth acting on: `Game.ts` is a **4,519-line god object**
(~70 methods) that owns the state machine, all ten screens' render+input, combat resolution, the
shop, and the economy at once. It's not badly *written* — it's under-*modularized* in a single place.
Everything else is fine. My recommendation is a focused, incremental extraction of screens and combat
out of `Game.ts`, and to deliberately **not** touch the parts that already work.

Grade: **B+**. It would be an A- with `Game.ts` broken into scenes and a combat module.

---

## What's already right (keep doing this)

- **Content is data-driven.** The full item roster lives in `items/catalog.ts` as pure data;
  `ItemDatabase` just operates on it. Enemies are a single `ENEMY_TYPES: Record<EnemyType,
  EnemyTypeData>` table (45 types). Waves are described by `WavePhase` data in `WaveManager`. *Adding a
  new item or enemy is a data edit, not a code change* — this is exactly the "easy to expand content"
  property Felix asked for, and it's already true.
- **Systems are cleanly separated by domain.** `Player`, `Enemy`, `WaveManager`, `MetaProgression`,
  `ArtifactSystem`, `DuoSystem`, `EvolutionSystem`, `TransformationSystem`, `MapSystem`,
  `PathfindingSystem`, `ItemSystem`, `SaveManager`, `AudioManager` are each self-contained and
  single-responsibility. This is the healthy 90% of the codebase.
- **Performance is engineered, not hoped for.** `Quadtree`, `EntityCuller`, `ObjectPool`,
  `OffscreenCanvasCache`, `ParticleBatchRenderer`, `QualityManager`, and `PerformanceMonitor` are all
  present and doing real work. This is more mature than most hobby games.
- **Draw/update geometry parity.** Every screen recomputes its hitboxes and its visuals from one
  shared layout helper (`getShopLayout`, `screenScale`, `columnRects`), so buttons can't drift from
  what's drawn. Good discipline — the problem is only that these helpers all live *inside* `Game.ts`.
- **Rendering is centralized.** `Renderer.ts` wraps canvas text/box/button primitives, so screens
  don't each hand-roll `ctx` calls. The right seam already exists.

---

## The one real problem: `Game.ts` is a god object

`Game.ts` currently mixes at least five distinct responsibilities:

1. **The game-loop state machine** — `update(dt)` and `draw()` dispatch on `this.state` across ~10
   states (menu, playing, shop, map, event, reward, rest, paused, village, gameover).
2. **Every screen's rendering + input** — each state has a `drawX()` and `updateX()` pair
   (`drawShop`/`updateShop`, `drawMap`/`updateMap`, `drawEvent`/`updateEvent`, …). That's ~20 methods
   and the bulk of the 4,500 lines.
3. **Combat resolution** — `handleEnemyKill`, `applyOnHitEffects`, `applyThorns`, `updateAuxWeapons`,
   `dealAuxDamage`, `updateAoeZones`, `detonateBomb`, `fireEnemyPattern`, `splitWorm`, `hatchEgg`.
4. **The shop** — `enterShop`, `purchaseShopItem`, `rerollShop`, `autoBuyAll`, `getShopLayout`,
   plus the draw/update pair.
5. **Economy & pickups** — `grantXP`, gold-coin spawning, artifact runtime sync.

### Why this specific thing matters (and the rest doesn't)

- **It's where every future change lands.** Adding a screen, a shop feature, or a combat mechanic
  means opening the one 4,500-line file and threading through shared mutable state (`this.player`,
  `this.shopItems`, `this.state`, `this.input`). That's the friction Felix will feel every time.
- **State transitions are implicit.** `this.state = 'shop'` is a bare string assignment scattered
  across methods; there's no single place that says "these are the legal transitions and what happens
  on enter/exit." The `input.disarmUntilRelease()` anti-clickthrough is a manual patch over this.
- **Testing needs the whole game.** The QA harnesses drive `window.__game` end-to-end because there's
  no smaller unit to test. That's workable (and the harnesses are good), but a `ShopScreen` you could
  instantiate alone would be faster and more targeted.

None of this is urgent — the game runs and ships. But it's the thing that will slowly tax every
future feature, so it's the highest-leverage cleanup.

---

## Recommended direction (incremental, low-risk)

Do these in order; each is independently shippable and testable. **Do not** attempt a big-bang rewrite.

### 1. Introduce a `Scene` interface (the keystone)

```ts
interface Scene {
  enter?(prev: SceneName): void;   // one place for setup + input disarm
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  exit?(next: SceneName): void;
}
```

`Game` shrinks to: owning the shared context (player, systems, input, renderer), holding the current
`Scene`, and running `update`/`draw`/transitions. Each `updateX`/`drawX` pair moves to its own file
(`scenes/ShopScene.ts`, `scenes/MapScene.ts`, …). The `enter()` hook is the natural, single home for
the input-disarm-on-transition rule — removing the scattered manual guards.

This is mostly *mechanical* (move method pairs, pass a shared context object), so it's low-risk and the
existing QA harnesses validate each move.

### 2. Extract a `CombatSystem`

Move `handleEnemyKill`, `applyOnHitEffects`, `applyThorns`, aux-weapon and AoE/bomb logic, and enemy
firing into a `CombatSystem` that takes the world state it needs. This is the second-densest cluster in
`Game.ts` and is genuinely its own domain.

### 3. Formalize shop pieces already half-extracted

`purchaseShopItem`/`rerollShop`/`autoBuyAll` are already clean side-effecting helpers (extracted during
the Auto-Buy work). Move them + `getShopLayout` into the `ShopScene` — they're already shaped for it.

### 4. Make screen transitions explicit

A tiny `transitionTo(next)` on `Game` that calls `current.exit()` → sets state → `next.enter()` gives
one auditable list of transitions and kills the bare `this.state = '…'` assignments.

### What to deliberately leave alone

- The data-driven content tables (`items/catalog.ts`, `ENEMY_TYPES`, wave phases) — already ideal.
- The performance layer (quadtree/culler/pools/caches) — working; don't add abstraction.
- `Renderer`, `AudioManager`, `SaveManager`, `MetaProgression` — clean single-responsibility modules.
- Enemy/Player/Projectile entity classes — fine as they are.

Resist adding an ECS, an event bus, or a DI container. This game doesn't need them, and they'd add the
"overly complex" cost Felix explicitly wants to avoid. The Scene split gives ~80% of the benefit at
~20% of the cost.

---

## Smaller notes (nice-to-have, not blocking)

- **`Game.ts` shared mutable state** (`this.shopItems`, `this.currentEvent`, `this.eventReward`, …) is
  read/written across many methods. Once scenes own their own state, most of these fields move into
  the relevant scene and stop being global-within-the-file.
- **`sprites.ts` + `spriteData.ts` (~3.2k lines combined)** are large but are essentially data +
  generators — acceptable. If they keep growing, consider one file per sprite family.
- **`Enemy.ts` at 1,923 lines** is second-largest; the `ENEMY_TYPES` table is fine, but the per-type
  *behavior* (movement/attack patterns) is in a big switch. If enemy AI keeps growing, a
  `behaviors/` strategy map keyed by type would mirror what `items/catalog.ts` did for items.
- **No automated test runner in CI** — the QA `.mjs` harnesses are excellent but run manually. A
  `npm run qa` that runs the suite would make regressions cheaper to catch. (Low priority.)

---

## Bottom line for Felix

You can keep shipping content **today** without touching any of this — that part's already easy. The
one investment that pays off repeatedly is splitting `Game.ts` into per-screen scenes behind a small
`Scene` interface, then pulling combat into its own system. It's mechanical, low-risk, ships in
pieces, and each piece is covered by the QA harnesses you already have. Everything else in the
codebase is in good shape and should be left as-is to avoid adding needless complexity.
