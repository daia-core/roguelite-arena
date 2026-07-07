# Status Effects Architecture — Design Reference

**Shipped:** 2026-07-07 (commit b507702) — clean TypeScript build, live on Vercel.

This document explains the new `StatusEffectEngine.ts` system and how to author items/skills
that use it. Written for the Soulstone Survivors-inspired content expansion.

---

## Problem it solves

Before this refactor, every new status effect required:
1. A new field on `Enemy` (e.g. `burnTimer: number`)
2. A new tick block in `Game.ts`'s enemy loop
3. A new application case in `applyOnHitEffects`
4. A new visual block in `Enemy.drawStatusEffects`

Adding the 15+ Soulstone-inspired effects would have turned `Game.ts` into a 10k-line file with
hundreds of hardcoded numeric constants and no composability.

---

## Architecture

```
StatusEffectEngine.ts
├── STATUS_EFFECT_DEFS   — one record per effect type (immutable data)
│   ├── burn, bleed, poison, doom, freeze, slow, stun
│   └── fragility, exposed, brittle, shattered, wound, condemned,
│       dazed, disoriented, debilitated, crippled
│
├── StatusEffectManager  — per-enemy instance
│   ├── apply(id, opts)  — add/refresh/stack + returns synergy list
│   ├── applySynergyChain(...)  — one-level deep chain resolution
│   ├── tick(dt, moved)  — advance all effects, compute DoT damage
│   ├── getIncomingDamageMult()  — Fragility amp
│   ├── getDirectHitMult()       — Exposed amp
│   ├── getFlatHitBonus()        — Brittle flat bonus
│   ├── getArmorReduction()      — Shattered shred
│   ├── getSpeedMult()           — Freeze/Slow/Stun CC
│   ├── checkCondemned(isCrit)   — detonation check
│   └── legacy bridge getters (burnTimer, poisonTimer, etc.)
│
└── rollOnHitProcs(opts)  — collect all new-engine procs in one pass
```

**Enemy.ts:** `statusFX: StatusEffectManager = new StatusEffectManager()` added alongside
existing flat timer fields (backward compat bridge). `drawStatusEffects` renders new effects.

**Game.ts:** `applyOnHitEffects` calls `rollOnHitProcs` after existing legacy procs. Enemy loop
calls `statusFX.tick()` after the legacy DoT block.

**ItemSystem.ts / items/types.ts:** `Item` interface gains `fragileChance`, `exposedChance`,
`condemnedChance` fields. `PlayerStats` exposes getters. Offer-filter + stat display updated.

---

## Adding a new item that uses the engine

```typescript
// In your item file (items/weapons.ts, items/trinkets.ts, etc.)
{
  id: 'corrupted-shard',
  name: 'Corrupted Shard',
  description: 'Each hit exposes weak points.',
  tier: 2,
  // NEW — references StatusEffectEngine 'exposed' effect
  exposedChance: 0.20,   // 20% per hit to apply 2 stacks of Exposed (+8% direct hit damage)
  // Optionally pair with an existing stat for flavor
  critChance: 0.05,
}
```

The engine handles: proc roll → `statusFX.apply('exposed', {stacks:2})` → visual rendering
→ damage multiplication in combat. No Game.ts changes needed.

---

## Full effect catalog

### DoT family
| Effect | Behavior | DPS |
|--------|----------|-----|
| **Burn** | Fast fire DoT, 2s; synergy → Slow | 16/s |
| **Bleed** | Movement-scaling DoT, 4s (3 stacks); synergy → Poison | 6+move/s |
| **Poison** | Spreading DoT, 3s; spreads on host death; synergy → Doom | 7/s |
| **Doom** | Detonation bomb: stores hit damage × 1.5, explodes on fuse; synergy → Burn | — |

### Crowd control
| Effect | Behavior |
|--------|----------|
| **Freeze** | Full stop for 1s |
| **Slow** | 5 stacks, 12% slow/stack, capped 65%, 2.5s |
| **Stun** | Full stop for 0.8s |

### Amplifier debuffs (the Soulstone "amp" family)
| Effect | Stacks | Per stack | Visual |
|--------|--------|-----------|--------|
| **Fragility** | 20 | +1.5% ALL damage taken | Purple glow ring |
| **Exposed** | 10 | +4% direct-hit damage | Orange cracks |
| **Brittle** | 15 | +1 flat damage/hit | — |
| **Shattered** | 10 | −1 armor | — |
| **Wound** | 4 | next DoT double-stacks | Red X mark |
| **Condemned** | 10 | at 10 stacks, next crit = +500% | Purple charge bar |
| **Dazed** | 10 | +1% crit chance received | Yellow stars |
| **Disoriented** | 10 | +1% crit damage received | — |
| **Debilitated** | 10 | −1% enemy damage | — |
| **Crippled** | 5 | −% attack range | — |

### Synergy chain
```
Bleed  →25%→  Poison  →20%→  Doom  →15%→  Burn  →20%→  Slow  →  [cycle]
```
One hit can cascade a cocktail. One level deep (no infinite loops).

---

## Extending the engine

### Add a new effect type
1. Add its ID to the `StatusEffectId` union in `StatusEffectEngine.ts`
2. Add a `StatusEffectDef` record to `STATUS_EFFECT_DEFS`
3. (Optional) Add rendering in `Enemy.drawStatusEffects`
4. (Optional) Add a helper getter method to `StatusEffectManager`

That's it — no Game.ts surgery, no new fields on Enemy.

### Add a new item proc
Add `fragileChance`/`exposedChance`/`condemnedChance` to your item definition
(or add a new `xxxChance` field following the same pattern — update `rollOnHitProcs` in
`StatusEffectEngine.ts` and the corresponding `PlayerStats` getter).

---

## Tomorrow's plan (content budget reset Jul 8)

With the architecture in place, the Soulstone adaptation list can land as new items/trinkets:

**Highest-value items to build first (from RESEARCH-soulstone-survivors.md):**
1. **Shard of Fragility** — on-hit 20% → Fragility (2 stacks); pairs with any damage build
2. **Exposed Wound** — on-hit 15% → Exposed (2 stacks) + Bleed; direct-hit amp + DoT
3. **Condemned Brand** — on-hit 25% → Condemned (1 stack); crit builds detonate at 10
4. **Doom Sigil** — on-crit 50% → Doom (existing effect, now via statusFX); adds synergy chain
5. **Disarray Ring** — on-hit 20% → Dazed (3 stacks); makes crit builds even more threatening
6. **Brittle Curse** — on-hit 15% → Brittle (2 stacks); pairs with multishot/fire rate builds
7. **Chain of Weakness** — on-hit 10% → Debilitated (3 stacks); support/solo build control layer

Plus skill-node variations of the synergy chain (`status chain` skill tree node unlocking
the full Bleed→Poison→Doom→Burn→Slow cascade at higher proc rates).
