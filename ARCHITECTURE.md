# Roguelite Arena — Architecture Overview

> **Last updated: 2026-07-08** — GameOverScene extracted (step 7, ~178 lines removed, Game.ts now ~5,111 lines); ShopScene (step 6); RestScene (step 5); EventScene (step 4); MapScene (step 3). 34 active skills, 1335+ items, AoeZone constraint documented.

---

## ⚠️ Critical Constraints — Read Before Adding Skills or AoE Effects

### AoeZone is a PLAYER-HAZARD system — NEVER use it for enemy damage

`AoeZone` was designed as a player-hazard (environmental danger). Its damage field
**hits the player, not enemies**. Passing `damage > 0` to `spawnAoeZone()` creates
accidental player self-damage. This caused 11 active skills to silently deal zero enemy
damage (and some hurt the player instead) — caught and fixed 2026-07-08.

**For enemy damage, always use one of:**

```typescript
// One-shot damage after a delay (telegraphed blast):
this.pendingDmg.push({ x, y, r, dmg, delay, color });

// Persistent tick damage (DoT zone):
this.activeDmgZones.push({ x, y, r, dmgPerSec, remaining, color });
```

Use `AoeZone` only for the **visual telegraph** with `damage: 0`:

```typescript
// ✅ CORRECT — visual telegraph + enemy pendingDmg:
this.spawnAoeZone(new AoeZone(x, y, r, 0, delay, { color }));   // damage=0
this.pendingDmg.push({ x, y, r, dmg: baseDmg, delay, color });  // enemy damage

// ❌ WRONG — hits the player instead of enemies:
this.spawnAoeZone(new AoeZone(x, y, r, baseDmg, delay, { color }));
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│              (Vite + TypeScript, ~26k source lines)          │
└─────────────────────────────────────────────────────────────┘

Core Loop               Extended Systems          Meta / UI
──────────────          ────────────────          ─────────────
Game.ts (~5.3k lines)   StatusEffectEngine         AchievementSystem
Player.ts               ActiveSkillSystem           MetaProgression
Enemy.ts (2k)           ArtifactSystem              SkillTree (~185 nodes)
WaveManager.ts          EventSystem                 SaveManager
ItemSystem.ts (1.5k)    DuoSystem                   MapSystem
Projectile.ts           EvolutionSystem             VillageScene (876 lines)
AoeZone.ts              TransformationSystem

Rendering / UX          Utilities
───────────────         ─────────────────
Renderer.ts             Quadtree.ts
Particle.ts             EntityCuller.ts
ScreenEffects.ts        ObjectPool.ts
UISprites.ts            PathfindingSystem.ts
StardewBackground.ts    QualityManager.ts
ParticleBatchRenderer   PerformanceMonitor.ts
SpawnTelegraph.ts       OffscreenCanvasCache.ts
```

## Game State Machine

```
┌────────────┐
│    MENU    │  (initial — MenuScene.ts)
└─────┬──────┘
      │ Start game / Continue
      ▼
┌────────────┐     enters after wave clear
│  VILLAGE   │◄────────────────────────────┐
│ (home base)│                             │
└─────┬──────┘                             │
      │ enterRun()                         │
      ▼                                    │
┌────────────┐  waveComplete()  ┌─────────┐│
│  PLAYING   │─────────────────►│  SHOP   ││
│(core loop) │◄─────────────────│         ││
└─────┬──────┘  startNextWave() └────┬────┘│
      │ player.dead                  │     │
      ▼                              └─────┘
┌──────────┐
│ GAMEOVER │
└────┬─────┘
     │ retry() → PLAYING  |  menu() → MENU
```

---

## Core Systems (current state)

### ItemSystem + Catalog
- **1,335+ items** across tiers 1–4 (`items/catalog.ts` ~4,400 lines)
- 50+ stat fields: damage, fireRate, critChance, lifesteal, poisonChance,
  brittleChance, dazedChance, disorientedChance, overchargeEvery, …
- `balanceDrawbacks.ts` applies Brotato-style drawbacks (strong items pay a cost)
- Artifacts: special high-power items with unique combat hooks (`ArtifactSystem.ts`)
- Duo synergies: item pairs that unlock bonus effects (`DuoSystem.ts`)
- Evolutions: items that transform when conditions are met (`EvolutionSystem.ts`)

### StatusEffectEngine (668 lines)
17 effect types, data-driven, per-enemy stacking:

| Category | Effects |
|----------|---------|
| DoTs | burn, bleed, poison, doom |
| CC | freeze, slow, stun |
| Amp debuffs | Fragility, Exposed, Condemned, Brittle, Dazed, Disoriented |

Amp debuffs are damage multipliers on the target:
- **Fragility** — +% incoming damage per stack
- **Exposed** — +% direct hit damage
- **Condemned** — 10-stack threshold triggers next crit +500%
- **Brittle** — +flat bonus damage per hit per stack (best vs high-HP tanky)
- **Dazed** — enemy receives more crits
- **Disoriented** — crit damage amplified per stack

```typescript
// Damage resolution path (per projectile hit):
const mult = se.getIncomingDamageMult(enemy);   // Fragility, Exposed, Condemned
const flat = se.getFlatHitBonus(enemy);          // Brittle
// Dazed/Disoriented affect getCritMultiplier() rolls
```

### ActiveSkillSystem (446 lines)
- **34 active skills** across 4 tiers
- **Dual slots:** Q = primary, E = secondary (independent cooldowns)
- Acquired via skill scrolls in the shop
- Mobile: Q/E touch buttons show live skill icon + name
- Categories: damage burst, AoE, DoT, CC, mobility, utility

**Adding a new active skill:**
1. Add to `ACTIVE_SKILLS` in `ActiveSkillSystem.ts` (id, name, tier, description, cooldown)
2. Add handler in `Game.ts` `useActiveSkill()` switch block
3. For AoE enemy damage: use `pendingDmg` or `activeDmgZones` (⚠️ see constraint above)
4. Add a scroll item in `items/catalog.ts` with `type: 'scroll'`, `scrollSkillId: 'your_id'`

### SkillTree (653 lines)
- ~185 nodes across 6 arms + bridge clusters
- Grants permanent stat bonuses and unlocks abilities
- Zoomable/pannable canvas overlay
- Persisted via SaveManager

### VillageScene (876 lines)
Home base between runs — upgrades, meta-progression, character select.

### MapScene (167 lines)
Slay-the-Spire-style node-routing screen shown between encounters. Extracted from Game.ts in step 3
of the incremental de-god-classing (2026-07-08). Owns draw + input for the `'map'` state; Game.ts
retains the transition logic (act generation, node resolution into game states).

### EventScene (~235 lines)
The `?` event node's text-choice screen. Extracted from Game.ts in step 4 (2026-07-08). Owns
`currentEvent`, `eventResultText`, `eventReward` state. Calls `onOptionPicked(opt)` for Game to
apply the effect (artifact grant, curse, gold) and returns the outcome text + optional reward card.

### RestScene (~155 lines)
The campfire node's heal-or-upgrade screen. Extracted from Game.ts in step 5 (2026-07-08). Owns
`restResolved` and `restResultText`. Calls `onChoose('rest'|'train')` for Game to apply player
effects (heal 40% HP / +15 max HP) and returns the outcome text.

### ShopScene — ✅ EXTRACTED (step 6, 2026-07-08, commit e742a11)

> **Read this before attempting the extraction** — the shop is far more
> interconnected than the scenes already extracted. MapScene/EventScene/RestScene
> each had 155–235 lines and 1–2 callbacks. ShopScene is ~800 lines with 20+
> dependencies. Plan, verify TypeScript, and deploy before touching Game.ts.

**Methods to move into `ShopScene.ts` (~960 lines total):**

| Method | Lines | Notes |
|--------|-------|-------|
| `drawShop()` | 5722–6269 (~548) | Pure rendering |
| `updateShop()` | 4066–4227 (~162) | Input dispatch — calls callbacks |
| `getShopLayout()` | 3933–4044 (~112) | Shared draw+hit geometry |
| `getCombosButtonRect()` | 4045–4056 | Geometry helper |
| `getSkillsButtonRect()` | 4057–4065 | Geometry helper |
| `handleInspectPopupTap()` | 5665–5706 | Inspect popup input |
| `handleEquipmentStripTap()` | 5611–5664 | Equipment strip input |
| `showShopToast()` | 5707–5721 | Toast helper |
| `autoBuyAll()` | 4356–4383 | Calls onPurchase/onReroll loop via callbacks |
| `drawEquipmentStrip()` | 5477–5610 (~134) | Equipment/stash rendering — was missing from original plan; writes equipSlotRects/stashItemRects/stashSellRects (own state) |
| `drawInspectPopup()` | 6270–6534 | Inspect popup rendering |
| `drawCombosOverlay()` | 6535–6841 | Combos guide rendering |

**State to move to ShopScene (own these fields, don't read from Game):**

```typescript
// Shop inventory
shopItems: (Item | null)[] = [];
selectedShopItem: number = -1;
shopRerollCost: number = 2;
shopRerolls: number = 0;
lockedShopItems: Set<number> = new Set();
lastInterestGained: number = 0;

// UI overlays
showCombosOverlay: boolean = false;
showStatsPopup: boolean = false;
private statsPanelRect = { x: 0, y: 0, width: 0, height: 0 };

// Inspect popup
private inspectedEquipKey: EquipHolderKey | null = null;
private inspectUnequipRect: Rect | null = null;
private inspectSellRect: Rect | null = null;

// Equipment strip hit-rects (written by drawEquipmentStrip, read by handleEquipmentStripTap)
private equipSlotRects: Array<{ key: EquipHolderKey; x: number; y: number; width: number; height: number }> = [];
private stashItemRects: Array<{ index: number; x: number; y: number; width: number; height: number }> = [];
private stashSellRects: Array<{ index: number; x: number; y: number; width: number; height: number }> = [];

// Toast
private shopToastText = '';
private shopToastAt = 0;
```

**Methods that STAY in `Game.ts` (they mutate game/player state):**

| Method | Why it stays |
|--------|-------------|
| `enterShop()` | Banking interest calc + item generation (touches player.gold, waveManager, playerStats, ItemDatabase) |
| `purchaseShopItem(i)` | Mutates player.gold, player.addItem(), duoSystem, evolutionSystem |
| `rerollShop()` | Mutates shopItems (through callback), player.gold, shopRerollCost |
| `toMapFromShop()` | Changes `this.state`, `this.mapScene`, `this.lockedShopItems` clear |
| `openSkillTree(fromShop)` | Changes `this.state`, `this.skillTreeReturnsToShop` |

**Callbacks needed in `ShopSceneDeps`:**

```typescript
interface ShopSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;
  audio: AudioManager;        // not AudioSystem — actual type in Game.ts

  // Read-only views (pass by reference — shop reads but never writes)
  getPlayer(): Player | null;
  getPlayerStats(): PlayerStats;
  getSkillTree(): SkillTree;
  getWave(): number;

  // Mutations (all owned by Game.ts — each callback does the FULL chain:
  //   the primary action + player.gold update + syncMaxHealth + updateMobileSkillButtons)
  onPurchase(slotIndex: number): boolean;  // purchaseShopItem(i) — returns true on success
  onReroll(): boolean;                      // rerollShop() — returns true on success
  onContinue(): void;                       // toMapFromShop()
  onOpenSkillTree(): void;                  // openSkillTree(true)
  onSellFromStash(stashIndex: number): void;   // sell a stash item (removeItem + gold += sellValue + syncMax + mobileSkills)
  onEquipFromStash(stashIndex: number): void;  // equipFromStash + syncMax + mobileSkills
  // Equip-slot inspect popup actions — full mutation chain each:
  onUnequipToStash(key: EquipHolderKey): void; // unequipToStash OR sell-if-full + gold + syncMax + mobileSkills
  onSellEquip(key: EquipHolderKey): void;      // removeItem + gold += sellValue + syncMax + mobileSkills
}
```

**Key integration point — `enter()` resets UI state but NOT shop inventory:**

```typescript
// ShopScene.enter() — called by Game.ts after enterShop() generates items:
enter(items: (Item | null)[], lockedIndices: Set<number>, lastInterest: number): void {
  this.shopItems = items;
  this.lockedShopItems = new Set(lockedIndices);
  this.lastInterestGained = lastInterest;
  this.selectedShopItem = -1;
  this.showCombosOverlay = false;
  this.showStatsPopup = false;
  this.inspectedEquipKey = null;
  this.input.mouseDown = false;
}
```

**Extraction order (do in sequence):**
1. Create `ShopScene.ts` with all state + methods — compile-check before touching Game.ts
2. In `Game.ts`: construct `this.shopScene` in constructor, pass deps
3. Move `drawShop/updateShop` dispatch to `this.shopScene.draw()/update()`
4. Remove the moved methods from Game.ts one batch at a time (each batch: compile + QA smoke)
5. Final: run headless QA (shop purchase, reroll, lock, inspect, equip strip all work)

**Estimated line reduction for Game.ts:** ~820 lines → below 6,000 lines total.

---

### ArtifactSystem
Artifacts trigger active powers during combat (e.g. Overcharge fires a 3× nova every N shots).
Called from `Game.ts` update loop.

### EventSystem
Devil deals between waves: trade a permanent curse for a powerful artifact.
All 5 curses reachable in-game (curse_glass_bones, curse_famine, etc.).

---

## Data Flow

### Game Loop (PLAYING state)
```
requestAnimationFrame() ─► game.update(dt)
  ├── input.poll()
  ├── player.update(dt, movement)
  ├── player.tryShoot(enemies) → projectiles
  ├── useActiveSkill('q'|'e') if pressed
  ├── waveManager.update(dt) → spawn enemies
  ├── enemy.update(dt) for each
  ├── projectile.update(dt) + collision → applyOnHitEffects()
  ├── resolvePendingDmg(dt)        ← deferred AoE enemy damage
  ├── resolveActiveDmgZones(dt)    ← persistent DoT zones
  ├── se.tick(dt) for each enemy   ← DoT ticks (burn/bleed/poison)
  ├── artifactSystem.tick(dt)
  ├── updateAoeZones(dt)           ← player-hazard zones (visual only for active skills)
  ├── particle.update(dt) for each
  └── cleanup dead entities

              ▼

game.draw()
  ├── stardewBackground.draw()
  ├── draw active dmg zones (persistent AoE rings)
  ├── draw aoe zones (telegraph flashes)
  ├── draw enemies (with status effect visuals — brittle cracks, slow tint, etc.)
  ├── draw player
  ├── draw projectiles
  ├── draw particles + damage numbers
  └── drawHUD() — health, XP, skills Q+E with cooldown bars
```

### Combat Hit Path
```
Projectile hits Enemy
  ├── ItemSystem.computeHit() → baseDmg, critMult, statusProcs
  ├── StatusEffectEngine.getIncomingDamageMult() → amp multiplier
  ├── StatusEffectEngine.getFlatHitBonus() → Brittle flat bonus
  ├── StatusEffectEngine.rollOnHitProcs() → apply new effects
  ├── enemy.takeDamage(totalDmg)
  ├── spawn damage number particle
  ├── lifesteal → player.heal()
  └── enemy.dead? → XP, gold, kill particles, AchievementSystem
```

### Active Skill Damage Path
```
Q or E key pressed (or touch button)
  ├── game.useActiveSkill('q' | 'e')
  ├── skill = itemSystem.getEquippedSkillId[Q|]()
  ├── switch(skill.id):
  │     case 'meteor':
  │       spawnAoeZone(... damage=0 ...)   ← visual telegraph only
  │       pendingDmg.push({..., delay:0.8}) ← actual enemy damage
  │     case 'poison_cloud':
  │       spawnAoeZone(... damage=0 ...)   ← visual
  │       activeDmgZones.push({...})       ← persistent DoT tick
  │     …
  └── cooldown[slot] reset
```

### Wave Flow
```
Wave starts → Enemies spawn over time → All killed
  → enterShop() [shows 3 + optional cascade item]
  → Player buys → Click Continue
  → startNextWave() → PLAYING
```

### Save Flow
```
Game Event → auto-save to LocalStorage (every action)
           → manual save to API (if authenticated) → SQLite DB
```

---

## Component Dependencies (July 2026)

```
Game.ts (7031 lines — main)
 ├── Player, Enemy, Projectile, AoeZone, Pickup, MeleeAttack
 ├── WaveManager, ItemSystem, StatusEffectEngine
 ├── ActiveSkillSystem, ArtifactSystem, EventSystem
 ├── AchievementSystem, MetaProgression
 ├── SkillTree, MapSystem, VillageScene
 ├── SaveManager, Input, Renderer, AudioManager
 ├── Particle, ParticleBatchRenderer, ScreenEffects
 └── pendingDmg[] + activeDmgZones[] (inline Game state)

ItemSystem.ts (1582 lines)
 ├── items/types.ts         — stat interfaces, Item type
 ├── items/catalog.ts       — 1335+ item definitions
 ├── items/balanceDrawbacks.ts — tier cost application
 └── items/itemIcons.ts     — emoji/icon mapping

StatusEffectEngine.ts (668 lines)
 └── standalone — per-enemy effect state maps

ActiveSkillSystem.ts (446 lines)
 └── standalone — ACTIVE_SKILLS array + lookup

Enemy.ts (2192 lines)
 └── requires StatusEffectEngine for status-effect visuals

SkillTree.ts (653 lines)
 └── requires canvas context + ItemSystem for stat grants

VillageScene.ts (876 lines)
 └── requires MetaProgression, SaveManager

MapScene.ts (167 lines)
 └── requires MapSystem, Input, Renderer (deps-injected via MapSceneDeps)

ArtifactSystem.ts
 └── requires Game context for combat hooks
```

---

## File Size Reference (July 2026)

```
File                        Lines    Role
────────────────────────────────────────────────────────
Game.ts                      ~6840   Main game loop + all game state (shrinking via Scene splits)
items/catalog.ts             4388    Item definitions (1335+ items)
Enemy.ts                     2192    Enemy types, AI, status-effect visuals
ItemSystem.ts                1582    Item aggregation + shop logic
sprites.ts                   1685    Sprite/asset data
WaveManager.ts                964    Wave spawning + difficulty
VillageScene.ts               876    Village / home base UI
EventScene.ts                ~235    Event/choice screen (extracted step 4)
MapScene.ts                   167    Map / node-routing screen (extracted step 3)
RestScene.ts                 ~155    Campfire heal/train screen (extracted step 5)
Renderer.ts                   690    Canvas draw primitives
StatusEffectEngine.ts         668    Status effect stacks + damage math
SkillTree.ts                  653    Skill tree render + unlock logic
UISprites.ts                  509    HUD/UI sprite rendering
Player.ts                     487    Movement + shooting
Particle.ts                   469    Particles + floating numbers
ActiveSkillSystem.ts          446    34 active skill definitions
──────────────────────────────────────
Total source (all files)    ~26,350
```

---

## Performance Notes

Target: 60 FPS at mobile viewport (375×667 portrait).

| System | Role |
|--------|------|
| `EntityCuller.ts` | Skip off-screen entity updates |
| `Quadtree.ts` | Broad-phase collision (O(n log n)) |
| `ObjectPool.ts` | Reuse projectile/particle objects to avoid GC |
| `ParticleBatchRenderer.ts` | Batch canvas draw calls for particles |
| `OffscreenCanvasCache.ts` | Cache complex sprite draws |
| `QualityManager.ts` | Auto-downgrade visual quality if FPS drops |

---

## Extension Points

**New item** — add to `items/catalog.ts`. For new stat fields: add to `Item` interface
in `types.ts`, to `ItemAgg` + `freshAgg()` + aggregation loop in `ItemSystem.ts`, and
add a `getXxx()` getter on `ItemSystem`.

**New status effect** — add type to `StatusEffectType` in `StatusEffectEngine.ts`, add
stack/tick/visual logic, roll proc in `rollOnHitProcs()`, and draw visual in `Enemy.ts`.

**New active skill** — see ActiveSkillSystem section above.
⚠️ Use `pendingDmg` / `activeDmgZones` for enemy damage, never `AoeZone.damage`.

**New enemy type** — add to `ENEMY_TYPES` in `Enemy.ts`, add to spawn table in `WaveManager.ts`.

**New event / devil deal** — add to `EventSystem.ts` event pool.

**New artifact** — add to `ArtifactSystem.ts` ARTIFACTS array, implement active effect
as a method called from `Game.ts` update loop or hit resolution.

---

## Deployment

```
Source:  work/roguelite-game/frontend/
Build:   npm run build → dist/
Deploy:  Vercel (daiacore team, project roguelite-game-blush)
Live:    roguelite-game-blush.vercel.app
Note:    [[Roguelite-Arena]] memory note tracks current bundle hash + commit
```
