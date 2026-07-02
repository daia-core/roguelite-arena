# Roguelite Arena

A mobile-first browser roguelite (TypeScript + HTML5 Canvas) in the Brotato / Vampire-Survivors
lineage: wave-based survivor combat, a between-waves shop, deep item synergies, and build diversity.

**Live:** https://roguelite-game-blush.vercel.app
**Owner:** Daia's game project — iterated via the `game-dev` skill.

## Current state (2026-07-02)

- **85+ items** across common→legendary tiers with multiplicative stacking, plus **own-once**
  logic (boolean/weapon-flag items leave the shop once owned).
- **Damage-type lanes** — melee / ranged / elemental multipliers, so builds are mechanically
  distinct (an item can boost one lane and cost another).
- **Synergies made legible** — per-card duo naming (`⚡ STORM SURGE` / `🔗 + partner` / `GOOD FIT`)
  and a full-screen **COMBOS GUIDE** overlay (active combos + "one item away").
- **Economy** — gold with banked **interest** at the shop (save-vs-spend tension), plus a **Luck**
  stat driving shop rarity and orb drops.
- **Systems** — duo combos (`DuoSystem`), item **evolution** (`EvolutionSystem`) and
  **transformations** (`TransformationSystem`), enemy **pathfinding** (`PathfindingSystem`),
  quadtree collision (`Quadtree`), a health-orb **pickup magnet** (`Pickup`), 5 multi-phase bosses,
  screen effects, and meta-progression.
- **Performance** — object pooling, entity culling, batched particle rendering, offscreen-canvas
  caching, adaptive quality (`QualityManager` / `PerformanceMonitor`); targets 60 FPS on mobile.

The always-current record of what shipped (per production deploy, with commit sha + mobile-viewport
verification) is **[CHANGELOG.md](./CHANGELOG.md)** — read that, not this section, for the latest.

## Repository layout

```
roguelite-game/
├── frontend/        The game — TypeScript + Vite + Canvas. Ships from frontend/dist/.
│   └── src/         Game.ts (loop), Player, Enemy, ItemSystem, WaveManager, DuoSystem, …
├── api/ + backend/  Auth + cloud-save server (Node/Express/SQLite) — see ARCHITECTURE.md.
├── tools/           pixel-art + qa tooling.
├── qa-*.mjs         Headless behavioral harnesses (roguelite, synergy, damagetype, magnet,
│                    builddiv, pixel-art) — each drives the SHIPPED dist, not a stale copy.
├── shots/           QA screenshots.
└── _archive/        Historical per-session summaries, deploy notes, and research (see below).
```

## Canonical docs (start here)

| Doc | What it is |
|-----|-----------|
| **[CHANGELOG.md](./CHANGELOG.md)** | Running, verified record of every production deploy. Source of truth for "what's live." |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System design, data flow, module responsibilities. |
| **[DESIGN-BUILD-DIVERSITY-2026-07-02.md](./DESIGN-BUILD-DIVERSITY-2026-07-02.md)** | The build-diversity design study (interest, damage lanes, item tables, rollout). |

Everything else — one-shot session summaries, deploy-status snapshots, per-round balance/pixel-art
logs, and design research — lives under **`_archive/`** (`_archive/research/` for the design
research). Kept for history, out of the working root. Nothing there is load-bearing for the build.

## Develop

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # → frontend/dist/
```

## Deploy (Vercel, CLI)

```bash
cd frontend
npm run build
npx vercel --prod
```

**Deploy discipline:** after every deploy, run the relevant `qa-*.mjs` harness against the freshly
built `frontend/dist/` (not `/workspace/canvas/…` or any other copy) and confirm the live
`index-*.js` hash + a mobile-portrait (390×844) screenshot before calling it done. A green harness
against the wrong artifact is a hollow "verified" — verify what actually ships.

## Controls

- **Keyboard:** WASD / arrows to move · Space / Shift to dash · E / Q to blast.
- **Mobile:** left-side virtual joystick · DASH / BLAST buttons.
