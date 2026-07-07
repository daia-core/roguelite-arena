# Skill Tree Expansion Plan — PoE-Style (Felix, Jul 6 → t-dff7b0)

**Status:** Design-ready. Content budget was exhausted Jul 7 (4 feat commits); implement on next budget-fresh session.
**Goal:** "More extensive with more paths and way way larger. Review nodes so they can be run-defining and truly build-defining (mixed with stat upgrades like PoE)." — Felix, Jul 7.

---

## Current tree at a glance

- **6 arms** (Might / Precision / Alacrity / Fortune / Vitality / Aegis) radiating from a hub.
- **14 slots per arm** (ARM_TEMPLATE in SkillTree.ts): 1 gateway, 8 minors, 2 notables, 1 keystone.
- **4 class start nodes** (gunner hub; ranger→Alacrity; brawler→Aegis; arcanist→Might).
- **~88 nodes total.** Ring of 6 gateway edges links adjacent arms.
- Connectivity: purely radial — no cross-arm paths, no shortcuts, no second routes to keystones.

## What PoE does that ours doesn't

| PoE feature | Ours now | Expansion target |
|-------------|----------|-----------------|
| Massive scale (~1,500 nodes) | ~88 | ~250 nodes |
| Cross-arm shortcuts/bridges | None (ring only at r=150) | 3 bridge zones at mid/deep radius |
| Multiple keystones per build | 1 per arm (6 total) | 2-3 per arm + 4 center keystones = 16-22 |
| 4+ notables per arm | 2 per arm | 4 per arm |
| Two paths to each keystone | One linear path | Fork at notable depth |
| Hybrid stat zones (two arms mixed) | None | 6 bridge clusters (one per arm-pair) |
| Diverging routes through an arm | None | Split at Tier-3, two paths rejoining at Tier-5 |

---

## Expansion design

### 1. Extend each arm with a second path (fork/merge)

Currently each arm is linear: `gate → t1a/t1b → nA → t2a/t2b → t3a/t3b → t4 → nB → t5 → t6a/t6b → key`.

Replace with a **fork at nA** — two branches that diverge and meet at nB, then continue to a **second keystone** at the outer edge. This doubles the path length and forces interesting trade-offs about which branch to take:

```
               gate
              /    \
           t1a      t1b
            |        |
            nA ←→ cross
           / \
      brA-t2   brB-t2   ← two branches: branch A (depth stat) vs branch B (speed stat)
      brA-t3   brB-t3
          \   /
           nB
          /   \
       t4       t5
       |         |
      keyA      keyB     ← TWO keystones per arm (different trade-offs)
```

**Per-arm: ~22 nodes** (was 14) → 6 × 22 = 132 arm nodes.

### 2. Bridge clusters (6 hybrid zones between adjacent arms)

Between each pair of adjacent arms, a **bridge cluster** of 4-5 nodes providing mixed bonuses. Located at r≈350 between the two arm angles. Each bridge cluster has:
- 2 minor nodes (one from each adjacent arm's primary stat)
- 1 notable (a genuine cross-arm combo, e.g. `Berserker = +10% Damage + +8% Fire Rate`)
- Bridge edge to each arm's t2 slot

6 bridges × 4 nodes = **24 bridge nodes**.

### 3. Central keystones (4 global keystones near the hub)

At r≈100-120, between the class start positions, 4 **global keystones** — the rarest and most build-altering in the game. Reachable from ANY class start after allocating 2-3 nodes:

```
[GLASS CANNON] — +60% Damage, but max HP fixed at 1 (one-shot deaths).
[IRON WILL]    — Damage scales with current HP% (high HP → weak; low HP → lethal).
[ECHO STRIKE]  — Every 5th shot is free (no fire-rate cost); -10% Fire Rate baseline.
[WANDERLUST]   — +20% Move Speed per second spent not shooting (stacks to +80%); -15% Fire Rate.
```

These sit at the INNER ring (between starts and gateways), reachable early but each costing 2 SP to unlock from a start. **4 nodes.**

### 4. Deep-outer second keystones (per arm — different flavour from the current one)

Each arm gets a second keystone at r≈850 (one branch of the arm fork):

| Arm | Current keystone | New second keystone |
|-----|-----------------|-------------------|
| Might | Overwhelm (+45% Dmg, -20% FR) | **Warlord** — every 10th kill grants +5% Damage stacking (capped at +50%) |
| Precision | Assassinate (+100% Crit Dmg, -25% FR) | **Sniper** — +25% Crit Chance, but only crits if you're moving (standing still = no crits) |
| Alacrity | Frenzy (+50% FR, -20% Dmg) | **Storm** — fire rate doubles for 3s after killing an enemy, then resets |
| Fortune | Treasure Hunter (+40% G, +30% XP, -15% Dmg) | **Gambler** — each pickup has 20% to give triple, 20% to give nothing |
| Vitality | Juggernaut (+90 HP, -15% Spd) | **Phoenix** — on death, revive at 30% HP once per run; -15 max HP |
| Aegis | Bulwark (+12 Arm, +3 HP/s, -25% Spd) | **Thorns** — enemies take 50% of armor value as damage on hit; -5 armor |

**6 additional keystone nodes.**

### 5. Two additional notables per arm (→ 4 total)

Two notables are not enough for a tree this size. Add nC (r≈460, deep branch A) and nD (r≈460, deep branch B):

Already-defined notables (keep as nA and nB at their current positions).

New nC and nD per arm:

| Arm | nC | nD |
|-----|----|----|
| Might | **Rampage** — +6% Damage per stack of 3 enemies killed in 1s (up to +30%) | **Executioner** — +25% Damage to enemies below 25% HP |
| Precision | **Vulnerability** — crits inflict Exposed (+20% dmg taken) for 2s | **Sharpshooter** — +4% Crit per enemy between you and target (up to +20%) |
| Alacrity | **Momentum** — +3% Fire Rate per 0.5s of moving without stopping | **Twin Strike** — every 7th shot fires 2 projectiles |
| Fortune | **Magnate** — gold orbs have 30% chance to split into two | **Librarian** — +10% XP per piece of equipped gear |
| Vitality | **Bloodprice** — killing an enemy restores 3 HP | **Adamantine** — +1 effective armor per 20 max HP |
| Aegis | **Sentinel** — armor doubles vs boss attacks | **Reflect** — 5% of damage taken is reflected to nearby enemies |

12 additional notable nodes.

---

## Total node count

| Category | Count |
|----------|-------|
| 6 arms × 22 nodes (extended arm template) | 132 |
| 6 bridge clusters × 4 nodes | 24 |
| 4 central global keystones | 4 |
| 6 additional arm keystones (branch B) | 6 |
| 12 additional notables (nC + nD × 6 arms) | 12 |
| 4 class start nodes | 4 |
| **Total** | **~182 nodes** |

This is 2× the current size — large enough to feel like PoE (you can't see the whole tree at once), while remaining manageable for a solo-dev roguelite.

---

## Implementation path (one session = one day)

### Phase 1: Extend ARM_TEMPLATE + per-arm fork (single file change, big impact)
1. **Replace ARM_TEMPLATE** with a 22-slot template that has a fork:
   - Keep slots gate/t1a/t1b/nA at same r
   - Add brA-t2, brB-t2 (branches), brA-nC, brB-nD (the new notables)
   - brA-t3, brB-t3 → rejoin at nB
   - Add t4, t5 (deep stretch)
   - Two slots at r≈780: keyA (current keystone) and keyB (new second keystone)
2. **Update ARM_EDGES** to wire the fork correctly.
3. **Add new ARM_DEFS fields**: `keystone2`, `notableC`, `notableD` per arm.
4. **Add new keystone/notable definitions** per the table above.

### Phase 2: Bridge clusters
1. Add a `BRIDGE_DEFS` array: 6 entries (one per adjacent-arm pair).
2. Add bridge nodes in `buildTree()` between adjacent arm pairs, at r≈350.
3. Wire edges from each bridge's minor nodes to the nearest arm's `t2` slot.

### Phase 3: Central global keystones
1. Add 4 global keystone nodes at r≈110, placed between the 4 class start positions.
2. Wire an edge from each class start to the nearest global keystone.
3. These keystones have `type: 'keystone'` and `arm: 'core'`.

### Phase 4: SkillBonuses extensions (if needed)
- Some new keystones require behaviors beyond `SkillBonuses` (e.g., ECHO_STRIKE, WANDERLUST, STORM, SNIPER — conditional / event-driven bonuses). These can be flagged via a `flags: Set<string>` on SkillTree and handled in Game.ts where the combat loop runs. Start with the pure-stat ones; flag the complex ones for a second pass.

### Phase 5: UI — pinch-zoom scroll + visual polish
- The expanded tree is ~3× the current radius (r≈850 outer). The existing pan/zoom canvas should handle this — just verify the initial zoom level is pulled back enough to show the full web.
- Add arm labels at the keystone positions (they're now far from the gateway label).
- Consider showing a "you are here" indicator showing what % of each arm is allocated.

---

## Key PoE design principles to honour

1. **The web should feel OVERWHELMING on first open** — you shouldn't be able to see it all. Pan & zoom to explore.
2. **Every keystone should change *how you play*, not just *how much*.** "Sniper" (crits only while moving) changes player behavior; "Assassinate" (+Crit Dmg, -FR) is just a trade-off knob.
3. **Travel/minor nodes should feel affordable** — the path to power is spending 3-4 travel nodes before hitting something exciting. Don't make every step feel like opportunity cost.
4. **Keystones should feel DANGEROUS** — you should be a little afraid to take "Glass Cannon" or "Iron Will."
5. **Bridge clusters create identity** — a player who goes Might→Precision→bridge has a fundamentally different build from Might→pure Might.

---

## Files to modify

- `frontend/src/SkillTree.ts` — all the data + logic (the only file needed for Phases 1-4)
- `frontend/src/Game.ts` — Phase 4 flag handling (conditional keystones like STORM, ECHO_STRIKE)
- No UI file changes needed unless the pan/zoom clip rect needs widening (unlikely)

## QA checklist for the expanded tree

- [ ] `qa-node-map.mjs` — open tree, verify all node types present, all arms reachable from each start
- [ ] Allocate 10 nodes from each class start — confirm path to at least 1 keystone is possible
- [ ] Verify cross-arm bridge is reachable (allocate down arm A, cross to arm B via bridge)
- [ ] Verify global keystone is reachable from each class start within 3 nodes
- [ ] Verify `computeBonuses()` is correct for a mixed-arm build (no field overwritten)
- [ ] TypeScript: `tsc --noEmit` clean
- [ ] Deploy + live-verify on roguelite-game-blush.vercel.app

---

*Created: 2026-07-07 evening — content budget exhausted Jul 7 (4 feat commits); implement on next budget-fresh session. Task t-dff7b0.*
