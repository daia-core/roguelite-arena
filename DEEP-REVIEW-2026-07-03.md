# Roguelite — Deep Systems, Loop & Feel Review (2026-07-03)

Full-codebase review after the enemy-scaling + economy rebalance shipped today. Four subsystems were mapped in depth: combat & status, progression & economy, game loop & structure, and feel/rendering/audio. This is the prioritized findings list — what's strong, what's genuinely broken, and where the highest-value improvements are.

**Verdict: B+.** The engine and content breadth are genuinely good — 206 items, 15 duos, 6 transformations, 20 artifacts, 18 meta-upgrades, 44 enemy types, a Slay-the-Spire node-map, a solid 3-layer render pipeline with culling/pooling/batching. The gaps are not "missing systems" — they're a handful of balance holes, some dead/unwired code, and depth/UX polish. Nothing here is a rewrite; it's a punch-list.

---

## What's strong (keep)

- **Render pipeline** — 3-layer canvas (cached background / dynamic game / dirty-flagged UI), quadtree collision, entity culling, object pools, particle batch-by-color. No per-frame allocation smells. Nearest-neighbour pixel-art enforced everywhere.
- **Item/synergy depth** — clean multiplicative-vs-additive stat aggregation with memoization; weighted shop generation (duo-surfacing, duplicate-stacking, tag-synergy, rarity pool); weapon-lock rule that prevents silent build replacement.
- **Combat feel basics** — pixel-font floating damage numbers (K/M/B suffixes, crit colouring), hit/impact flashes, a genuinely juicy level-up, status-effect overlays now render on enemies (Phase-4 work: freeze/burn/bleed/poison/wound/doom).
- **Mobile** — responsive HUD, safe-area inset handling, touch joystick, portrait-aware layout.

---

## P1 — Balance-critical (the real holes)

**1. Survivability stack is effectively uncapped → late-game immortality.** ✅ **FIXED (this run, commit `e8e91a3`, live).**
Combat damage is uncapped *by design* (enemies scale to meet it). Two *defensive* stats that enemies do NOT scale against were also uncapped — both now capped:
- **Health regen** (`Game.ts:597`) — was an uncapped per-frame tick. **Capped at 5% of max HP/sec** (scales with max HP so it stays relevant late). Still impactful; never enough to passively tank a scaled wave.
- **Armor** (`Player.ts:241-244`) — `20/(20+armor)` was unbounded (armor 200 = 91%, 380 = 95%). **Multiplier floored at 0.10 → 90% mitigation cap.** Each point still matters up to the cap.

Combat offense stays uncapped (enemies meet it); defense now has a ceiling, closing the last two counter-pressure-less runaways (same class as the gold/luck economy caps). Verified live in the production bundle. Dodge (75%) and lifesteal (100%) were already capped. *Remaining taste-dependent tweaks I did NOT take without a signal: lowering DODGE_CAP to ~0.55–0.60 and making boss telegraphed AoE undodgeable — those change feel more than they close a bug, so left for a play-feel call.*

**2. Bosses are homogeneous.** 5 named bosses (Necrolord/Flamefiend/Voidbeast/Stormking/Ancientgolem) share one behaviour tree — the only per-boss difference is AoE cooldown timing at phase thresholds. No boss-unique mechanic (summon pattern, arena hazard, weak-point). First real check isn't until wave 10. This is where "depth" should live now that fodder is meant to melt.

---

## P2 — Dead / unwired code (finish or delete)

**3. `EvolutionSystem.ts` is fully defined but never hooked.** 5 weapon evolutions (Wand→Holy Wand, Sword→Excalibur, etc.) exist as code and never fire in gameplay. Either wire it into the shop/level flow (high-value depth — evolutions are a marquee roguelite hook) or delete it as debt. Recommend **wire it**.

**4. `damageType` is missing from `Projectile.ts`.** Projectiles carry only a `damage` number — no element tag. This blocks: (a) tinting projectiles by their element (logged follow-up 4b), and (b) any elemental-interaction depth (fire-vs-frozen combos, resistances). Small plumbing job that unlocks a whole design axis.

**5. Transformations & duos are invisible until they fire.** 6 transformations and 15 duos are powerful threshold moments, but the shop never hints "you own X — buy Y to complete a combo." Players discover synergies by accident. A small shop tooltip/badge would turn luck into strategy. (I just wired the *audio* for these unlocks; the *visual/telegraph* discovery gap remains.)

---

## P3 — Feel & content polish

**6. In-world raw shapes, not pixel-art.** Worms, egg-sacs (`Enemy.ts` drawWormSegment/drawEggSac), projectiles (raw `ctx.arc`), and VFX particles (plain colored `fillRect`) are drawn as canvas primitives, not sprites — the last holdouts from the "pixel-art everywhere" pass (open task t-360dfa). Highest visual ROI: sprite the projectiles + worms.
**7. Hit-pause on crit.** A 40–60ms freeze-frame on big crits is the single cheapest "punch" upgrade (classic Brotato/Vampire-Survivors feel). Screenshake is intentionally omitted, so hit-pause is the right lever.
**8. No background music.** 18 synth SFX exist and the core loop is now well-covered (I wired dodge/duo/transformation this run), but there's no ambient track. A single looping bed would lift the whole thing.
**9. Leveling grants no choice.** Level-up is auto +2 dmg/+20 HP/heal. Items are the only decision gate. A periodic "pick 1 of 3" at level-up (even just stat cards) would add mid-run agency — optional, taste-dependent.

---

## P4 — Architecture & tooling

**10. `Game.ts` is a 4,500-line god class.** Every state's input+update+draw lives in it (only `VillageScene` is extracted). The prior architecture review's recommendation stands: split into per-screen `Scene` classes (Menu/Map/Playing/Shop/Event/Reward/Rest). No urgency, but it's the one change that unblocks everything else (e.g. pause-from-any-screen, which is currently impossible — you can only pause from `playing`).

**11. The balance simulator has bit-rotted.** ✅ **FIXED (this run).** `tools/qa/simulate-balance.mjs` stalled at "wave 0" because the node-map layer was added between start and combat. Now driven properly: the bot picks a combat map node, routes shop→map via `toMapFromShop()` (not `startNextWave()`), auto-resolves reward/event/rest, and records deaths correctly (state is `'gameover'`, not `'gameOver'` — that casing bug was masking deaths as "STUCK"). Empirical balance testing is restored — and it immediately paid off (see "Shipped this run": the v2 curve was tuned entirely on its data). The sibling QA gates `verify-mechanics` + `verify-luck` had the same node-map rot plus a stale-memoization pitfall; both repaired to ALL PASS.

---

## Shipped this run

- **Enemy-scaling + economy rebalance** (commit `62feae7`, live `index-BeJvcJwf.js`): enemy waveScale steepened (wave 20: ×12→×73), item prices ramp harder (×20→×100), income/discount caps tightened (gold ×10→×4, shop 50→30%, reroll 90→60%, luck +200→+100%). Fixes the wave-7 everything-maxed report. QA: stat-caps 21/21, regression green.
- **Audio coverage for unlock moments** — wired the previously-silent dodge, duo-unlock, and transformation SFX (methods existed, never called). Pure additive feel; regression green.
- **Balance simulator + QA-gate repair** (commit `650f07d`) — fixed the bit-rotted sim (P4-11) and the two sibling QA gates. This is the multiplier on all future balance work: it turned the very next change from a math guess into a measured fix.
- **Wave-scaling curve v2 — sim-driven softening** (commit `650f07d`, live). The morning's v1 bump (compound onset wave 4) over-corrected the EARLY game: the repaired sim showed the kite-bot dying at wave 3-6 (8/8 runs, avg ~4), swarmed before a run has defensive items. Softened to linear 0.15 + compound onset wave 7 → fresh runs establish, coherent builds reach wave 10+, incoherent ones still die early (correct shape). Late bite stays high (wave 20 ~33×, well above the old immortality-causing 12×). Deployed + verified live (`(1+(e-1)*.15)*1.18**Math.max(0,e-7)` confirmed in the production bundle).

## Recommended next (in order)

1. ~~**Fix the balance simulator** (P4-11)~~ ✅ done — data-driven tuning is back online.
2. **Cap regen + armor** (P1-1) — now measurable on the working sim. Taking this autonomously per Felix's "make your own calls" directive: ship sensible caps (regen ceiling, armor soft-cap) tuned on sim data, then QA. No longer gated on a number call.
3. **Wire EvolutionSystem** (P2-3) — marquee depth. Taking autonomously (recommendation was "wire it").
4. **Sprite projectiles + worms** (P3-6) — closes the pixel-art task, autonomous.
5. Boss-unique mechanics, synergy telegraphing, ~~hit-pause~~ — depth/polish, batch as I go.
   - ✅ **Hit-pause shipped** (2026-07-03 night, commit `1b55b67`, live). Gated to boss (120ms +
     white flash) / miniboss (60ms) kills only — fodder untouched (a per-kill freeze would stutter a
     thousand-trash/sec arena). Sim freezes at dt=0 while the frame renders; timer drains real-time,
     capped 130ms, resets on run start. `qa-hitstop.mjs` 11/11 PASS (real handleEnemyKill gating +
     genuine update() freeze/resume). **Remaining P3-6 (sprite projectiles + worms)** and **P1-2
     (boss-unique mechanics)** are the next-highest depth pulls.
