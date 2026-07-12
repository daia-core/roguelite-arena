# Roguelite Arena — Architecture Overview

> **Last updated: 2026-07-12** — Architecture doc sync: Steps 13–16 all DONE. Game.ts 3,670 lines (was 7,031). Step 13: HUDRenderer.ts (drawHUD + updateMobileSkillButtons). Step 14: executeSkill() → ActiveSkillSystem.ts (34 active skills). Step 15: updatePlaying() decomposed into 7 private sub-methods (orchestrator now ~25 lines). Step 16: drawPlaying() → PlayingRenderer.ts. Catalog: 1,899 items. QA: 22/22 PASS. Next content: R1 remainder (gloves/gauntlets `hands` slot — needs Felix) or item-uniqueness pass (step 2 — needs Felix steering).

---

## ⚠️ Critical Constraints — Read Before Adding Skills or AoE Effects

### AoeZone is a PLAYER-HAZARD system — NEVER use it for enemy damage

`AoeZone` was designed as a player-hazard (environmental danger). Its damage field
**hits the player, not enemies**. Passing `damage > 0` to `spawnAoeZone()` creates
accidental player self-damage. This caused 11 active skills to silently deal zero enemy
damage (and some hurt the player instead) — caught and fixed 2026-07-08.

**For enemy damage, always use one of:**

```typescript
// Inside executeSkill() in ActiveSkillSystem.ts (step 14 extraction):
ctx.pushPendingDmg(x, y, r, dmg, delay, color);           // one-shot delayed blast
ctx.pushActiveDmgZone(x, y, r, dmgPerSec, remaining, color); // persistent tick zone

// Inside Game.ts methods (non-extracted code):
this.pendingDmg.push({ x, y, r, dmg, delay, color });
this.activeDmgZones.push({ x, y, r, dmgPerSec, remaining, color });
```

Use `AoeZone` only for the **visual telegraph** with `damage: 0`:

```typescript
// ✅ CORRECT — visual telegraph + enemy pendingDmg:
ctx.spawnAoeZone(new AoeZone(x, y, r, 0, delay, { color }));   // damage=0, visual only
ctx.pushPendingDmg(x, y, r, baseDmg, delay, color);            // enemy damage

// ❌ WRONG — hits the player instead of enemies:
ctx.spawnAoeZone(new AoeZone(x, y, r, baseDmg, delay, { color }));
```

---

## ⚠️ QA Script Maintenance — Known Drift Points

Run `node qa-*.mjs` from the repo root after any significant refactor. Drift points
caught over time that can cause false failures or false positives:

### 1. Scene extraction breaks `window.__game.*` access in QA scripts

When a method moves from Game.ts to a Scene (e.g., ShopScene), QA scripts that access it via
`window.__game.methodName()` will throw `"not a function"`. Fix:
- Make the method `public` on the Scene class (remove `private`).
- Expose the Scene instance on `window`: add `(window as any).__shopScene = this.shopScene;`
  in Game.ts after the Scene is created.
- Update the QA script to route through `window.__shopScene.methodName()` for that case.

**Affected scripts (fixed 2026-07-08 night):** `qa-synergy.mjs` (cases D+E — ShopScene DuoSystem
methods); `qa-shop-inputguard.mjs`, `qa-shop-layout.mjs`, `qa-xp-coin-shop.mjs`, `qa-textbox.mjs`,
and `tools/qa/verify-live.mjs` (all used `g.getShopLayout()` which moved to ShopScene in step 6).
Pattern: `const ss = window.__shopScene; const L = ss ? ss.getShopLayout() : g.getShopLayout?.();`

### 3. New system hooks in the combat loop need stubs in enemy mocks

`qa-melee-stack.mjs` (and similar scripts that construct stub enemy objects inline) must track
every field that `updateEnemies()` reads or calls a method on. When a system is wired into the
combat loop after the test was written, the stub won't have it and the QA throws at runtime.

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'tick')` inside `updateEnemies`.
**Fix (2026-07-09 night):** Add a no-op `statusFX` mock to stub enemies:
```javascript
statusFX: {
  tick: () => ({ dotDamage:0, doomDetonation:null, poisonSpreads:false, daggerDot:false }),
  getBonusCritChanceReceived: () => 0, getBonusCritDamageReceived: () => 0,
  getIncomingDamageMult: () => 1, getDirectHitMult: () => 1,
  getFlatHitBonus: () => 0, checkCondemned: () => 0,
  apply: () => [], has: () => false,
}
```
**Rule:** whenever `updateEnemies()` adds a new `enemy.X.method()` call, check stub enemies
in any QA that builds them from scratch and add matching stubs.

### 4. `g.update()` calls `disarmUntilRelease()` on state change — clears QA synthetic taps

If a QA directly sets `g.input.mouseDown = true` and then calls `g.update(dt)`, and the game
state changed since the last update tick (e.g., `startNewGame()` just ran), `update()` will call
`input.disarmUntilRelease()` which sets `mouseDown = false` and `pressDisarmed = true` — swallowing
the synthetic tap before the active Scene can process it.

**Symptom:** tap-based QA (e.g., picking a map node) silently fails to change state.
**Fix (2026-07-09 night):** Call `g.update(0)` first to sync `lastUpdateState`, then clear
`pressDisarmed` before setting `mouseDown`:
```javascript
g.update(0);
g.input.pressDisarmed = false;
g.input.mouseX = p.x; g.input.mouseY = p.y; g.input.mouseDown = true;
g.update(1/60);
```

### 5. Private Scene state is not on `window.__game` — access via `g.scenes.*`

When state that used to live on Game moves to a private field on a Scene (e.g., `currentEvent`
moved to EventScene), QA scripts that read it from `window.__game` get `undefined`. TypeScript's
`private` is compile-time only, so the field is still reachable at runtime.

**Symptom:** `g.currentEvent === null` even when state='event'; or `g.eventResultText === undefined`.
**Fix (2026-07-09 night):** Access via `g.scenes['event'].currentEvent` or use the return value
from methods directly (`applyEventOption()` returns `{ resultText }` — don't look for it on Game).
**Pattern:** `const ev = g.scenes.event?.currentEvent ?? null;`

### 6. `g.finishSkillTree()` resolves to 'shop' after a post-wave break, not 'playing'

`enterShop()` sets `state='shop'` then immediately calls `openSkillTree(fromShop=true)` if
banked skill points exist, which overrides to `state='skilltree'`. The QA helper
`finishSkillTree()` used to always set state='playing', so any QA bot that called it after
wave completion would silently cancel the wave-clear and resume combat — the shop was never
reached, and the wave-clear check in the smoke test permanently failed.

**Fix (2026-07-09 early morning):** `SkillTreeScene.isReturnToShop` public getter; `finishSkillTree()`
now resolves to `'shop'` when `isReturnToShop=true` (post-wave break), `'playing'` otherwise.
**Rule:** Any QA that advances through skill-tree transitions should call `g.finishSkillTree()`
rather than `g.state = 'playing'` directly — the method now tracks the correct return destination.
**Pattern:**
```javascript
if (g.state === 'skilltree') {
  // ... spend points ...
  g.finishSkillTree(); // → 'shop' if post-wave, 'playing' if mid-combat
}
if (g.state === 'shop') { /* wave cleared */ }
```

### 7. Legacy QA scripts that used `localhost:4173` (Vite dev server) — now self-contained

Six QA scripts were written when the game ran via `vite preview` and used `http://localhost:4173/`.
They fail with `ERR_CONNECTION_REFUSED` when run standalone, and can produce **false positives**
if a dev server happens to be running from unrelated work.

**Migrated (2026-07-12):** `qa-event-gate`, `qa-slow-status`, `qa-dash`, `qa-wave-projectile-clear`,
`qa-stack-inspect`, `qa-expansion-shots` — all use the standard self-contained pattern now:
```javascript
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { execSync } from 'node:child_process';
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });
const server = http.createServer(...); // serves frontend/dist
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;
// ... tests ...
server.close();
```
**Rule:** all new QA scripts must use the self-contained server pattern, never `localhost:4173`.

---

### 2. Cap/constant changes in ItemSystem.ts must be mirrored in `qa-stats-parity.mjs`

`qa-stats-parity.mjs` recomputes every stat getter independently and compares against the live
memoized value. Any cap defined in `ItemSystem.ts` (e.g., `Math.min(0.6, ...)` in `getRerollDiscount`)
must match the corresponding `Math.min(X, ...)` in the `expected()` function in `qa-stats-parity.mjs`.

**Symptom:** mismatches appear only after enough items push the cumulative sum past the cap.
**Rule:** when changing a `Math.min(cap, ...)` in any getter in `ItemSystem.ts`, search for the
same numeric constant in `qa-stats-parity.mjs` `expected()` and update it.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│              (Vite + TypeScript, ~26k source lines)          │
└─────────────────────────────────────────────────────────────┘

Core Loop               Extended Systems          Meta / UI
──────────────          ────────────────          ─────────────
Game.ts (3.7k lines)    StatusEffectEngine         AchievementSystem
Player.ts               ActiveSkillSystem (1.1k)   MetaProgression
Enemy.ts (2.2k)         ArtifactSystem             SkillTree (~185 nodes)
WaveManager.ts          EventSystem                SaveManager
ItemSystem.ts (1.6k)    DuoSystem                  MapSystem
Projectile.ts           EvolutionSystem            VillageScene (877 lines)
AoeZone.ts              TransformationSystem

Extracted from Game.ts  Rendering / UX          Utilities
──────────────────────  ───────────────         ─────────────────
HUDRenderer.ts (step13) Renderer.ts             Quadtree.ts
PlayingRenderer (step16)Particle.ts             EntityCuller.ts
MapScene (step 3)       ScreenEffects.ts        ObjectPool.ts
EventScene (step 4)     UISprites.ts            PathfindingSystem.ts
RestScene (step 5)      StardewBackground.ts    QualityManager.ts
ShopScene (step 6)      ParticleBatchRenderer   PerformanceMonitor.ts
AchievementsScene (s8)  SpawnTelegraph.ts       OffscreenCanvasCache.ts
ClassSelectScene (s9)
SkillTreeScene (s12)
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

### Step 13 — `drawHUD` + `updateMobileSkillButtons` → `HUDRenderer.ts` ✅ DONE

> **DONE (2026-07-08).** `HUDRenderer.ts` (269 lines). Game.ts −~238 lines. QA PASS.

**Methods to move:**

| Method | Lines in Game.ts | Notes |
|--------|-----------------|-------|
| `drawHUD()` | 4282–4483 (~201) | Reads player/wave/enemy state, renders left panel, right panel, gear button, boss bar, skill bars |
| `updateMobileSkillButtons()` | 4483–4520 (~37) | DOM writes only — updates `#blastBtn` / `#skillEBtn` HTML |

**Dependencies `drawHUD` reads (all read-only):**
- `this.player` — health, maxHealth, xp, xpToNextLevel, level, gold, shield, pendingDodges
- `this.playerStats` — `getEquippedSkillIdQ()`, `getEquippedSkillId()`, `getWeaponSpecialization()`
- `this.waveManager` — currentWave, isBossWave, isHordeWave, waveTimer, waveEnemiesRemaining
- `this.enemies` — length (enemy count), `.find(isBoss)` (boss HP bar)
- `this.canvas` — width, height, clientWidth
- `this.renderer` — `getContext()`, `drawText()`
- `this.activeSkillCooldown`, `this.activeSkillCooldownE` — cooldown fractions for skill bars
- `this.gearButtonRect()` — must be exposed or inlined; tiny method
- `this.safeAreaTop(zoom)` — must be exposed or inlined
- `UISprites.getIcon(...)`, `drawPanel(...)`, `getActiveSkillById(...)` — module imports, no change needed

**Dependencies `updateMobileSkillButtons` reads:**
- `this.playerStats` — `getEquippedSkillIdQ()`, `getEquippedSkillId()`
- `getActiveSkillById(...)` — import from ActiveSkillSystem

**Proposed interface:**

```typescript
interface HUDRendererDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  getPlayer(): Player | null;
  getPlayerStats(): PlayerStats;
  getWaveManager(): WaveManager;
  getEnemies(): Enemy[];
  getActiveSkillCooldownQ(): number;
  getActiveSkillCooldownE(): number;
  getGearButtonRect(): { x: number; y: number; width: number; height: number };
  getSafeAreaTop(zoom: number): number;
}
```

**Extraction order (3 steps):**
1. Create `HUDRenderer.ts` with `HUDRendererDeps` interface + move both methods verbatim, replacing `this.X` reads with `this.deps.getX()` calls. Compile-check standalone.
2. In `Game.ts` constructor: `this.hudRenderer = new HUDRenderer(deps)`. Replace the `this.drawHUD()` call in `drawPlaying()` with `this.hudRenderer.drawHUD()`. Replace `this.updateMobileSkillButtons()` calls (search for them) with `this.hudRenderer.updateMobileSkillButtons()`.
3. Delete both methods from Game.ts. TypeScript compile + quick mobile-button smoke test.

**Estimated line reduction:** ~238 lines from Game.ts.

---

### Step 14 — `useActiveSkill` → `executeSkill()` in `ActiveSkillSystem.ts` ✅ DONE

> **DONE (2026-07-08).** `executeSkill()` lives in `ActiveSkillSystem.ts`. Game.ts `useActiveSkill()` is now a thin wrapper (~30 lines) that builds the context and delegates. ActiveSkillSystem.ts grew to 1,124 lines (owns both defs and dispatch). Game.ts −~645 lines.

`useActiveSkill` is a large `switch(skill.effect)` block dispatching 34 active skill effects.
`ActiveSkillSystem.ts` already owns the skill *definitions* (ACTIVE_SKILLS array, `getActiveSkillById`).
Moving the *dispatch* there collapses the logical split between "what a skill is" and "what it does."

**What `useActiveSkill` writes/calls (must be passed as a context object):**

| Game.ts symbol | Type | Notes |
|---|---|---|
| `this.enemies` | `Enemy[]` | Iterated + frozen/DoT timers written |
| `this.player` | `Player` | Read position, heal() called for lifesteal skills |
| `this.playerStats` | `PlayerStats` | getDamage(), getEquippedSkillId*() |
| `this.pendingDmg.push(...)` | callback | Deferred AoE damage |
| `this.activeDmgZones.push(...)` | callback | Persistent tick zones |
| `this.spawnAoeZone(zone)` | callback | Visual telegraph |
| `this.dealAuxDamage(e, dmg, color)` | callback | Per-enemy hit + lifesteal + particles |
| `this.projectiles.push(...)` | callback | Bone Spear, phoenix beam, etc. |
| `this.particles.push(...)` / `createParticle(...)` | callback | Visual effects |
| `this.screenEffects.shake(...)` | callback | Thunder Clap, etc. |
| `this.activeSkillCooldown` / `this.activeSkillCooldownE` | field write | Cooldown reset |

**Proposed interface:**

```typescript
interface ActiveSkillContext {
  enemies: Enemy[];
  player: Player;
  playerStats: PlayerStats;
  pushPendingDmg(x: number, y: number, r: number, dmg: number, delay: number, color: string): void;
  pushActiveDmgZone(x: number, y: number, r: number, dmgPerSec: number, remaining: number, color: string): void;
  spawnAoeZone(zone: AoeZone): void;
  dealAuxDamage(enemy: Enemy, dmg: number, color: string): void;
  pushProjectile(p: Projectile): void;
  createParticle(config: ParticleConfig): Particle;
  shakeScreen(intensity: number, duration: number): void;
  setCooldown(slot: 'q' | 'e', value: number): void;
}
```

**New method in `ActiveSkillSystem.ts`:**

```typescript
executeSkill(skillId: string, slot: 'q' | 'e', ctx: ActiveSkillContext): void {
  const skill = getActiveSkillById(skillId);
  if (!skill) return;
  ctx.setCooldown(slot, skill.cooldown);
  const baseDmg = ctx.playerStats.getDamage() * skill.baseDamageMultiplier;
  const px = ctx.player.x, py = ctx.player.y;
  switch (skill.effect) {
    // ... move all 34 cases verbatim, replace this.X with ctx.X ...
  }
}
```

**Extraction order (4 steps):**
1. Define `ActiveSkillContext` interface in `ActiveSkillSystem.ts`. Add `executeSkill()` method with all 34 switch cases verbatim (replacing `this.` with `ctx.` throughout). Compile-check standalone.
2. In `Game.ts` `useActiveSkill()`: replace entire switch body with `this.activeSkillSystem.executeSkill(skillId, slot, ctx)` where `ctx` captures `this` references via arrow closures. Keep cooldown-check guard at the top.
3. TypeScript compile + smoke each skill type in-browser (one per category: meteor/AoE, frost_nova/CC, chain_lightning/bounce, blood_nova/lifesteal, orbital_strike/multi-impact, bone_spear/projectile).
4. Delete the moved switch body from Game.ts. Final TypeScript compile + Vercel deploy.

**Estimated line reduction:** ~645 lines from Game.ts → Game.ts under 3,900 lines.

**⚠️ Key risk:** `dealAuxDamage` is referenced in 3 places by `useActiveSkill`. It must remain in
Game.ts (it touches `this.players`, `this.damageNumbers`, etc.) and be passed as a callback — do NOT
move it into ActiveSkillSystem. Keep the callback pattern; don't reach back into Game.

---

### ArtifactSystem
Artifacts trigger active powers during combat (e.g. Overcharge fires a 3× nova every N shots).
Called from `Game.ts` update loop.

### EventSystem
`?` map nodes: ~39 data-driven events — regular events, devil deals (6 curses:
curse_frailty, curse_sloth, curse_dullness, curse_glass_bones, curse_famine, curse_myopia),
stat-gated events (Slay-the-Spire style: meleeDmgPct, rangedDmgPct, critPct, moveSpeedPct,
armor, maxHp, gold gates at starter AND advanced thresholds), and pure-choice events.
`randomEvent(visited)` deduplicates within a run; falls back to full pool when exhausted.

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
Game.ts                      3,670   Main game loop + game state (7,031 original; shrunk via steps 3–16)
items/catalog.ts             5,001   Item definitions (1,899+ items)
Enemy.ts                     2,203   Enemy types, AI, status-effect visuals
sprites.ts                   1,771   Sprite/asset data
ItemSystem.ts                1,584   Item aggregation + shop logic
ActiveSkillSystem.ts         1,124   34 active skill defs + executeSkill() dispatch (step 14)
WaveManager.ts                 964   Wave spawning + difficulty
VillageScene.ts                877   Village / home base UI
SkillTree.ts                   668   Skill tree render + unlock logic
StatusEffectEngine.ts          668   Status effect stacks + damage math
Renderer.ts                    691   Canvas draw primitives
Player.ts                      518   Movement + shooting
UISprites.ts                   509   HUD/UI sprite rendering
HUDRenderer.ts                 269   drawHUD + updateMobileSkillButtons (step 13)
PlayingRenderer.ts             240   drawPlaying() render pipeline (step 16)
EventScene.ts                  279   Event/choice screen (step 4)
RestScene.ts                   155   Campfire heal/train screen (step 5)
MapScene.ts                    155   Map / node-routing screen (step 3)
──────────────────────────────────────
Total source (all .ts files) ~28,600  (catalog growth is the main driver)
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

## Step 15 — updatePlaying() Sub-method Decomposition ✅ DONE

> **DONE (2026-07-08).** All 7 private sub-methods extracted. `updatePlaying()` is now a ~25-line orchestrator (lines 949–973). Game.ts total unchanged (~3,670 lines — same code, better organized). QA PASS.

### Original planning guide (retained for context)

> Written 2026-07-08 (post step-14 QA pass).
> Game.ts was 3,695 lines; `updatePlaying()` occupied lines **908–1845** (937 lines).

### Why NOT a CombatSystem class

The tempting move is to push `updatePlaying()` into a `CombatSystem.ts`. Don't do it.
A CombatSystem class would need **20+ injected Game references** to compile:
`player`, `enemies`, `particles`, `damageNumbers`, `projectiles`, `meleeAttacks`,
`healthOrbs`, `xpOrbs`, `coins`, `audio`, `renderer`, `screenEffects`, `playerStats`,
`artifacts`, `metaProgression`, `waveManager`, `spawnTelegraphs`, `enemyQuadtree`,
`projectileQuadtree`, `projectilePool`, `particlePool`, `damageNumberPool`, and
every private helper method (`handleEnemyKill`, `applyOnHitEffects`, `killByDot`, …).
The result is a class that IS essentially Game with a different name — not an improvement.

### Recommended approach: Sub-method extraction within Game.ts (step 15)

Break `updatePlaying()` into **7 named `private` methods** in the same file.
`updatePlaying()` becomes an ~80-line orchestrator that calls them in order.

- Zero new files, zero import changes
- TypeScript stays clean the whole time (all methods still use `this.*`)
- No QA script changes (methods are still on the same class, same `window.__game`)
- Pure readability win — each phase is testable by reading one 100–200 line method

### The 7 phases and their approximate line ranges

| # | Method name | Lines (approx) | What it does |
|---|------------|-----------------|--------------|
| 1 | `updatePlayerTick(dt)` | 911–1033 (~123 ln) | Gear-button guard, wave timers, movement input, runtimeModifiers, player.update(), regen, dodge popups, shooting + multicast + overcharge, active skills, dash |
| 2 | `updateWaveAndEnemySpawn(dt)` | 1035–1056 (~22 ln) | waveManager.update(), spawnTelegraphs tick, phase banner |
| 3 | `updateEnemyStatuses(dt)` | 1057–1181 (~125 ln) | Per-enemy loop: pathfinding, DoT ticking (burn/bleed/poison/doom), new-engine statusFX.tick(), DoT-kill routing |
| 4 | `updateEnemyBehaviors(dt)` | 1183–1410 (~228 ln) | Per-enemy enemy.update(), shooting, golem stomp, poison trail, spore cloud, druid healing, necro minion spawn, AoE attacks, boss phase banners, egg hatch, wall collision, contact collision with player |
| 5 | `rebuildQuadtrees()` | 1412–1427 (~16 ln) | Clear + batch-insert enemies and projectiles into quadtrees |
| 6 | `updateProjectileCollisions(dt)` | 1429–1593 (~165 ln) | Homing steering, projectile.update(), player-projectile→enemy collision (crit, amps, execute, on-hit), enemy-projectile→player collision |
| 7 | `updateMeleeCollisions(dt)` | 1596–1671 (~76 ln) | melee.update(), arc-overlap enemy collision (crit, amps, on-hit) |
| 8 | `updatePickupsAndCleanup(dt)` | 1673–1845 (~173 ln) | Particle update, damage numbers, health orbs (magnet+pickup), XP orbs, coins, aux weapons, swap-and-pop cleanup for all arrays, mergeOrbs, AoE zone tick, pending/active dmg zones, wave-completion check, game-over check, autoSave |

> Phases 3 + 4 can both be split off the same enemy-loop pass or kept separate — they share
> no mutable intermediate state other than `enemy.dead`, which is checked at the boundary.

### Extraction order (least-coupled first)

Safest to riskiest — build stays green after each step:

1. **`rebuildQuadtrees()`** — 16 lines, pure array work, no conditional logic, trivial to verify
2. **`updatePickupsAndCleanup(dt)`** — self-contained; touches only array cleanup and pickup logic; no deps on the other 6 phases
3. **`updatePlayerTick(dt)`** — player/input only; no enemy deps; keep the gear-button guard at the top (it does an early return that must stay in `updatePlaying()` OR be the first call)
4. **`updateWaveAndEnemySpawn(dt)`** — delegates to `waveManager.update()` + telegraphs, short
5. **`updateMeleeCollisions(dt)`** — uses `this.meleeAttacks` and the quadtree, self-contained
6. **`updateProjectileCollisions(dt)`** — larger but self-contained; uses quadtree (extracted already in step 5)
7. **`updateEnemyStatuses(dt)` + `updateEnemyBehaviors(dt)`** — these two share the outer `for (const enemy of this.enemies)` loop; easiest to keep as ONE extracted method `updateEnemies(dt)` unless you want two separate passes (second pass requires iterating enemies again)

> **Alternative to step 7:** keep the full enemy loop as a single `updateEnemies(dt)` method
> (lines 1057–1410) rather than splitting DoT vs. behavior. Either works — splitting is cleaner
> architecturally but requires a second iteration over `this.enemies`.

### Safety rules for step 15

1. **One sub-method per commit.** Build after every extraction: `cd frontend && npm run build`.
2. **No logic changes** — pure cut-and-paste only. If a line needs to change to extract cleanly, stop and document why.
3. **No visibility changes needed** — all sub-methods are `private` on the same class, so `this.*` access is unchanged.
4. **QA suite after all 7** — run `node qa-*.mjs` from repo root (6 scripts). No interface changes are made, so they should all pass without modification. (If a method you extracted was accessed via `window.__game.methodName`, it still is — same class.)
5. **Line ranges above are approximate** — use your editor's `extractMethod` or manual cut-paste; verify TypeScript stays clean before committing.

### What step 15 does NOT do

- Does not reduce Game.ts's line count (same code, just reorganized into named private methods)
- Does not move any logic to a new file
- Does not change the QA surface or require QA script updates
- Does not unblock a future CombatSystem (that remains a > day-long refactor not worth the risk)

**Estimated Game.ts after step 15:** still ~3,695 lines, but `updatePlaying()` shrinks from 937 to ~80 lines — readable as a high-level orchestrator.

---

---

## Step 16 Extraction Plan — `drawPlaying()` → `PlayingRenderer`

> **Status: DONE (2026-07-08)** — Executed. `PlayingRenderer.ts` live, commit `cfa58aa`, bundle `index-VAtDyVod.js`. Game.ts −136 lines (3,749→3,613). 8 QA scripts PASS.

### Why `drawPlaying` is the right next extraction

After step 15, `updatePlaying()` is broken into 7 named sub-methods inside Game.ts. The de-god-classing refactor has a clear pattern: extract **cohesive, bounded domains** into separate classes. `drawPlaying()` (lines 3547–3725, ~178 lines) is the ideal next candidate:

- **Pure read + render** — reads Game state, writes to canvas. Zero state mutation.
- **Clear domain boundary** — everything in `drawPlaying` is visual: iterate entity arrays, call `.draw(ctx)`, overlay the HUD/announcements, run the perf monitor.
- **Mirrors HUDRenderer (step 13)** — same pattern: a `PlayingRendererDeps` interface + constructor injection. HUDRenderer is already a proven template.
- **~178 lines removed from Game.ts** — Game.ts goes from 3,749 → ~3,571 lines.

### Why NOT to extract `handleEnemyKill` instead

`handleEnemyKill` (lines 2350–2627, ~277 lines) seems bigger but is wrong for next extraction:
- Writes to 15+ `this.*` fields (`kills`, `killStackCount`, `killStackTimer`, `soulTitheKills/Stacks`, `bossKills`, `particles`, `xpOrbs`, `coins`, `healthOrbs`, enemies array).
- Calls 5+ private helpers (`spawnCeremonialDaggers`, `triggerHitPause`, `createParticle`, `grantXP`, `splitWorm`).
- Would need a `KillHandlerDeps` with 20+ mutation-capable refs — essentially recreating Game with a different name. See the "Why not CombatSystem" note above.
- **Leave it in Game.ts.** It's logically self-contained where it is.

### `PlayingRendererDeps` interface (full spec)

```typescript
// frontend/src/PlayingRenderer.ts
import { Player } from './Player';
import { Enemy } from './Enemy';
import { Particle } from './Particle';
import { Projectile } from './Projectile';
import { MeleeAttack } from './MeleeAttack';  // or whatever the melee type is
import { AoeZone } from './AoeZone';
import { HealthOrb, XPOrb, CoinPickup } from './Pickups';  // adjust imports
import { OrbitingOrb } from './OrbitingOrb';               // adjust imports
import { DamageNumber } from './DamageNumber';
import { WaveManager } from './WaveManager';
import { Renderer } from './Renderer';
import { EntityCuller } from './EntityCuller';
import { ParticleBatchRenderer } from './ParticleBatchRenderer';
import { PerformanceMonitor } from './PerformanceMonitor';
import { QualityManager } from './QualityManager';
import { ScreenEffects } from './ScreenEffects';
import { Input } from './Input';
import { HUDRenderer } from './HUDRenderer';
import { Quadtree } from './Quadtree';
// import Shockwave, Bomb, SpawnTelegraph from their files

export interface PlayingRendererDeps {
  // Stable references — passed by constructor, never change during a run
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  entityCuller: EntityCuller;
  particleBatchRenderer: ParticleBatchRenderer;
  performanceMonitor: PerformanceMonitor;
  qualityManager: QualityManager;
  screenEffects: ScreenEffects;
  input: Input;
  hudRenderer: HUDRenderer;
  waveManager: WaveManager;
  enemyQuadtree: Quadtree<any>;
  WORLD_SCALE: number;  // constant 2 — pass as dep so PlayingRenderer stays unit-testable

  // Array getters — arrays can be replaced by-ref on wave reset, so we use getters
  // to always get the live array (not a snapshot taken at construction time).
  getParticles(): Particle[];
  getProjectiles(): Projectile[];
  getMeleeAttacks(): any[];       // MeleeAttack[] — use the real type
  getShockwaves(): any[];         // Shockwave[]
  getBombs(): any[];              // Bomb[]
  getAoeZones(): AoeZone[];
  getSpawnTelegraphs(): any[];    // SpawnTelegraph[]
  getEnemies(): Enemy[];
  getHealthOrbs(): HealthOrb[];
  getXpOrbs(): XPOrb[];
  getCoins(): CoinPickup[];
  getOrbitingOrbs(): OrbitingOrb[];  // or OrbPickup
  getDamageNumbers(): DamageNumber[];
  getPlayer(): Player | null;

  // Scalar getters — change at runtime (timers, text)
  getWaveModifierTimer(): number;
  getPhaseBannerTimer(): number;
  getPhaseBannerText(): string;
}
```

> **Fix imports above** — some type names may differ (e.g., `CoinPickup` vs `Coin`, `OrbitingOrb` vs `OrbPickup`). Run `grep -n "class.*Orb\|class.*Coin\|class.*Shockwave\|class.*Bomb\|class.*Melee\|class.*Telegraph" frontend/src/*.ts` to confirm the actual class names before writing the interface.

### `PlayingRenderer` class skeleton

```typescript
export class PlayingRenderer {
  private deps: PlayingRendererDeps;

  constructor(deps: PlayingRendererDeps) {
    this.deps = deps;
  }

  draw(): void {
    // Cut-and-paste drawPlaying() body here, replacing:
    //   this.X       →  this.deps.X
    //   this.getX()  →  this.deps.getX()
    //   this.entityCuller.updateViewport(0, 0, this.worldWidth, this.worldHeight, 100)
    //              →  this.deps.entityCuller.updateViewport(
    //                   0, 0,
    //                   this.deps.canvas.width * this.deps.WORLD_SCALE,
    //                   this.deps.canvas.height * this.deps.WORLD_SCALE,
    //                   100)
  }
}
```

### Changes to `Game.ts`

**Add field + construction (in `constructor` or `setupUI`, after all deps exist):**
```typescript
private playingRenderer!: PlayingRenderer;

// In setupUI() or constructor, after renderer/entityCuller/etc. are ready:
this.playingRenderer = new PlayingRenderer({
  canvas: this.canvas,
  renderer: this.renderer,
  entityCuller: this.entityCuller,
  particleBatchRenderer: this.particleBatchRenderer,
  performanceMonitor: this.performanceMonitor,
  qualityManager: this.qualityManager,
  screenEffects: this.screenEffects,
  input: this.input,
  hudRenderer: this.hudRenderer,   // must be constructed first
  waveManager: this.waveManager,
  enemyQuadtree: this.enemyQuadtree,
  WORLD_SCALE: this.WORLD_SCALE,

  getParticles: () => this.particles,
  getProjectiles: () => this.projectiles,
  getMeleeAttacks: () => this.meleeAttacks,
  getShockwaves: () => this.shockwaves,
  getBombs: () => this.bombs,
  getAoeZones: () => this.aoeZones,
  getSpawnTelegraphs: () => this.spawnTelegraphs,
  getEnemies: () => this.enemies,
  getHealthOrbs: () => this.healthOrbs,
  getXpOrbs: () => this.xpOrbs,
  getCoins: () => this.coins,
  getOrbitingOrbs: () => this.orbitingOrbs,
  getDamageNumbers: () => this.damageNumbers,
  getPlayer: () => this.player,

  getWaveModifierTimer: () => this.waveModifierTimer,
  getPhaseBannerTimer: () => this.phaseBannerTimer,
  getPhaseBannerText: () => this.phaseBannerText,
});
```

**Replace the drawPlaying() call in the game loop:**
```typescript
// Find the call site (likely in draw() or the main update/render switch):
// Before: this.drawPlaying();
// After:  this.playingRenderer.draw();
```

**Delete `private drawPlaying(): void { … }` from Game.ts.**

### Extraction steps (one commit each)

1. Add `PlayingRenderer.ts` with the interface + empty class. Build → green. (No Game.ts changes yet.)
2. Wire the constructor in Game.ts (`this.playingRenderer = new PlayingRenderer({…})`). Build → green.
3. Replace `this.drawPlaying()` call site with `this.playingRenderer.draw()` — but keep the old `private drawPlaying()` in place and make the new `draw()` delegate: `draw() { (this.deps as any).__game.drawPlaying(); }`. Build + smoke test live URL.
4. Cut-and-paste `drawPlaying()` body into `PlayingRenderer.draw()`, swapping `this.X` → `this.deps.X`. Delete the delegation shim. Build → green.
5. Delete `private drawPlaying()` from Game.ts. Build → green. Run `node qa-*.mjs` — all 6 scripts should pass (no interface change; `drawPlaying` was never on `window.__game`).

> **Step 3's delegation shim** is optional but recommended for complex methods — it lets you verify the wiring is correct before committing to the full body move, so the risky commit is just the body cut-paste.

### Safety rules

1. One commit per step. Build clean after every commit.
2. No logic changes — pure cut-and-paste + `this.` → `this.deps.` rename only.
3. `drawPlaying` was never on `window.__game` in QA scripts, so no QA script updates needed.
4. If TypeScript complains about a type mismatch in the deps (e.g., an array type), fix the interface — don't cast.
5. Confirm `this.hudRenderer` is constructed before `this.playingRenderer` in `setupUI()` (HUDRenderer is a dep).

### Expected result

- `PlayingRenderer.ts` — new file, ~200 lines (178 body + interface + imports)
- `Game.ts` — 3,749 → ~3,571 lines (−178)
- No behavior change, no QA regression

---

## Step 17 Analysis — The Combat-Engine Wall

> **Status: ANALYSIS COMPLETE (2026-07-09)** — Scene extraction phase is done. Remaining Game.ts is the combat-engine core. See options below.

### What was extracted (steps 1–16)

| Step | Extracted class | Lines removed |
|------|----------------|---------------|
| 1 | VillageScene | ~200 |
| 2–5 | MapScene, EventScene, RestScene, GameOverScene | ~450 |
| 6 | ShopScene | ~900 |
| 7–11 | AchievementsScene, ClassSelectScene, RewardScene, SkillTreeScene, PauseScene | ~800 |
| 13 | HUDRenderer | ~220 |
| 16 | PlayingRenderer | ~136 |

Game.ts went from ~5,100 → 3,623 lines. The extracted pattern was: **cohesive, bounded domains** where reads clearly dominated writes, and private method calls were limited to 0–2 callbacks.

### Why further per-method extraction hits a wall

The remaining large methods are all combat-engine methods that share the same web of mutable state:

| Method | Lines | Private methods called | Arrays mutated |
|--------|-------|----------------------|----------------|
| `updateEnemies()` | 361 | `handleEnemyKill`, `applyOnHitEffects`, `dealAuxDamage`, `triggerHitPause`, `spawnExecuteBurst`, `createParticle` | enemies, particles, damageNumbers |
| `handleEnemyKill()` | 277 | `spawnCeremonialDaggers`, `triggerHitPause`, `createParticle`, `grantXP`, `splitWorm` | 15+ fields |
| `updatePickupsAndCleanup()` | 215 | `updateAuxWeapons`, `updateAoeZones`, `removeDeadEntities`, `resolvePendingDmg`, `resolveActiveDmgZones`, `checkWeaponEvolution`, `enterShop`, `gameOver`, `autoSave` | All entity arrays |
| `updateProjectileCollisions()` | 172 | `handleEnemyKill`, `applyOnHitEffects`, `applyThorns`, `createParticle`, `createDamageNumber`, `spawnExecuteBurst` | enemies, particles, damageNumbers |
| `updateAuxWeapons()` | 111 | `dealAuxDamage`, `detonateBomb` | orbitingOrbs, bombs, shockwaves, meleeAttacks |
| `updateRuntimeModifiers()` | 70 | *(none)* | 3 primitive Game fields |

The **per-method extraction pattern** that worked for scenes fails here because:
1. Every method calls 2–9 other private Game methods (which would become callbacks in any deps interface).
2. Every method mutates the same shared arrays (`enemies`, `projectiles`, `particles`, `damageNumbers`). Arrays passed by-reference are fine; arrays that get *replaced* (e.g., `this.enemies = splits` on worm-split) are not.
3. A `CombatDeps` with 20+ mutation-capable refs would **recreate Game with a different name** — the exact failure mode documented in step 16 for `handleEnemyKill`.

**Exception:** `updateRuntimeModifiers()` (70 lines) has no private method calls and reads bounded state (player, artifacts, playerStats, 3 scalar fields). It *could* be extracted as `RuntimeModifierCalculator`, but the 3 primitive-field mutations (`momentumTime`, `killStackTimer`, `killStackCount`) require getter/setter pairs in the deps interface — extraction overhead > benefit for 70 lines.

**`drawEvolutionBanner()` (20 lines):** too small to extract as its own class. It runs on every `draw()` call, short-circuits immediately when no banner is active, and only reads `this.evolutionBannerTimer` + `this.evolutionBannerText`. Leave in `Game.ts`.

### Options going forward

#### Option A — Accept the current structure *(recommended)*

Game.ts at 3,623 lines is the **combat-engine core**. The code is:
- Legitimately complex domain logic (physics, collision, enemy AI, item interactions)
- Well-organized into named private methods (`updateEnemies`, `updateProjectileCollisions`, etc.)
- Not a usability problem — TypeScript editors navigate it fine; QA scripts cover it

3,600 lines is reasonable for a complete game engine. The refactor has already halved the file size. Continuing to extract for its own sake creates more files and more interfaces without a functional improvement.

**If choosing Option A:** shift effort to gameplay improvements (feel, balance, content) rather than continued architecture work. The scene extraction was valuable; the combat-engine extraction is diminishing returns.

#### Option B — CombatEngine class refactor *(large scope, optional)*

Extract the entire combat layer into `CombatEngine.ts` that **owns the entity arrays**:

```typescript
class CombatEngine {
  // Owns the shared state
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  damageNumbers: DamageNumber[] = [];
  meleeAttacks: MeleeAttack[] = [];
  bombs: Bomb[] = [];
  shockwaves: Shockwave[] = [];
  aoeZones: AoeZone[] = [];

  // Receives read-only deps
  private player: Player;
  private playerStats: PlayerStats;
  private artifacts: ArtifactSystem;
  private enemyQuadtree: Quadtree<Enemy>;
  private audio: AudioSystem;
  private renderer: Renderer;
  // ...

  updateAll(dt: number, moving: boolean): CombatResult {
    this.updateEnemies(dt);
    this.updateProjectileCollisions(dt);
    this.updateMeleeCollisions(dt);
    this.updateAuxWeapons(dt);
    this.updateAoeZones(dt);
    this.updateRuntimeModifiers(dt, moving);
    this.updatePickupsAndCleanup(dt);
    return this.drainResults(); // kills, level-ups, wave-complete, game-over
  }
}
```

`Game.ts` becomes a thin coordinator: manages state (playing/paused/shop/map), owns the scenes, and delegates `update()` → `combatEngine.updateAll()`.

**Scope:** 2–3 days of careful refactoring. 1,200–1,500 lines move from Game.ts. Risk: many interdependencies to wire correctly.

**When to choose Option B:** if Felix explicitly wants Game.ts under 2,000 lines, or if the game grows to the point where the combat engine genuinely needs to be unit-tested in isolation.

### Recommendation

**Option A for now.** The game plays well, QA is clean, and the architecture is already much improved after 16 extraction steps. The remaining complexity in Game.ts is the inherent complexity of a real-time combat system, not structural debt. Focus effort on gameplay improvements.

---

## Deployment

```
Source:  work/roguelite-game/frontend/
Build:   cd frontend && npx vercel build --prod --yes --token="$VERCEL_API_TOKEN"
         (NOT npm run build — that writes dist/ only, not .vercel/output; --prebuilt reads .vercel/output)
Deploy:  cd /workspace/work/roguelite-game && npx vercel deploy --prebuilt --prod --yes --token="$VERCEL_API_TOKEN"
Live:    roguelite-game-blush.vercel.app
Note:    [[Roguelite-Arena]] memory note tracks current bundle hash + commit
```

**⚠️ Post-deploy cleanup (REQUIRED — I-22 prevention):**
After every successful deploy, delete the build artifacts from the workspace. These are
gitignored but still cause `git add -A` to time out on the host snapshot (343 MB / 100k+ files).

```bash
rm -rf /workspace/work/roguelite-game/frontend/node_modules
rm -rf /workspace/work/roguelite-game/backend/node_modules
rm -rf /workspace/work/roguelite-game/api/node_modules
rm -rf /workspace/work/roguelite-game/.vercel/output
```

All are regenerable: `npm install` in each sub-directory before the next build; `npx vercel build`
recreates `.vercel/output`. Failing to clean these causes `Workspace snapshot failed` (SIGTERM on
`git add -A`) — see `memory/system/known-issues.md` § I-22.
