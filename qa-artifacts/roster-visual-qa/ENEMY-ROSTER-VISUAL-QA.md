# Enemy roster — full visual QA (capstone check)

**Date:** 2026-07-04 · **Build:** HEAD `f058486` (live `index-CtBoAShq.js`) · **Source:** `tools/pixel-art/sprites/` (42 JSON sprites — 44 enemy types + player)

## Why this pass
The enemy hand-craft was declared "100% coverage" after batches 1–8 (each family verified
*within itself* on its own grass contact sheet). This is the missing **cross-family** check: all
sprites rendered together on one grass backdrop and looked at as a player would — the way collisions
between families (two greys, three purples, etc.) actually show up in play but never on a per-batch
sheet.

**Grounding:** the sheets were rendered from `sprites/`, which round-trips **byte-for-byte** to the
shipped `frontend/src/spriteData.ts` (md5 `7b91c105…` unchanged after `build-sprite-data.mjs sprites`).
So these images are the live enemy art, not a proxy. Sheets: `roster-sheet-{0,1,2}.png` (this folder).

## Verdict: PASS — no fix needed
Every one of the 44 enemy types + player has a distinct silhouette and a role-readable design. No two
enemies are confusingly identical. Bosses all read visibly larger / more elaborate than fodder. The
closest pairs are each separated by color, size, or silhouette:

- **Grey stone/mech** — `construct` (grey boxy mech, blue eye-slit) vs `boss_ancientgolem` (grey,
  boss-scale, orange core) vs `golem` (**brown** stone, blue eyes, not grey). Three-way distinct.
- **Green humanoids** — `goblin` (small, big ear + tusks), `orc` (upright, armored, mace),
  `troll` (bulky hunched brute, regen-belly), `druid` (robed caster + staff). Separated by
  posture/armor/weapon.
- **Purple spectral** — `wraith` (hooded, cyan eyes, arms), `phantom` (smooth purple teardrop, white
  eyes), `summoner` (magenta cultist + rune-portal). Silhouette-separated.
- **Pale spectral** — `ghost` (simple pale-blue) vs `banshee` (white/grey, tear-streaks + screaming
  face).
- **Purple eyes** — `orbiter` (small purple eye, orange iris) vs `boss_voidbeast` (tentacled,
  boss-scale, pink eye).
- **Round bodies** — `slime` (green teardrop) vs `blob` (red round) vs `swarm` (orange spiky ball) vs
  `mushroom` (red-cap toadstool with face). Color + shape distinct.

## Marginal notes (watch-only, not defects)
- `wraith` vs `phantom` are the tightest purple pair; still distinguishable (hooded-with-arms vs
  smooth teardrop). If a future style pass wants more separation, tint `wraith` cooler or give
  `phantom` a wispier tail — but neither reads as the other today.

## What would trigger a re-run
Any new enemy type added, or a palette/silhouette change to an existing sprite. Re-render with
`node tools/pixel-art/contact-sheet.mjs sprites <outdir>` and re-inspect all sheets together.
