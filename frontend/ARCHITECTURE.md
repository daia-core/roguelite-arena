# Roguelite Game Architecture

## Module Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         main.ts                             │
│  - Game loop (requestAnimationFrame)                        │
│  - Canvas setup and resize handling                         │
│  - UI state management                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                         Game.ts                             │
│  State Machine: menu → playing → shop → gameover           │
│  - Manages all entities and systems                         │
│  - Handles game flow and transitions                        │
│  - Collision detection and damage application              │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┘
   │      │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
│Input││Rende││Audio││Wave ││Item ││Save ││Player││Enemy│
│  .ts││r.ts ││Mgr  ││Mgr  ││Sys  ││Mgr  ││  .ts ││ .ts │
└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘└─────┘
                                              │      │
                                              ▼      ▼
                                          ┌─────┐┌─────┐
                                          │Proj ││Part │
                                          │ .ts ││ .ts │
                                          └─────┘└─────┘
                                              ▲      ▲
                                              │      │
                                          ┌─────────────┐
                                          │  utils.ts   │
                                          │ - Collision │
                                          │ - Math      │
                                          └─────────────┘
```

## Data Flow

### Game Loop (60fps)
```
main.ts gameLoop()
  ├─ Calculate deltaTime (dt)
  ├─ Game.update(dt)
  │   ├─ Input.getMovementVector() / consumeAbilities()
  │   ├─ Player.update(dt) → movement, cooldowns
  │   ├─ WaveManager.update(dt) → spawn enemies
  │   ├─ Enemy.update(dt) → pathfinding, shoot check
  │   ├─ Projectile.update(dt) → movement, lifetime
  │   ├─ Particle.update(dt) → animation
  │   ├─ Collision detection (projectiles vs entities)
  │   ├─ Damage application → particles + sounds
  │   └─ State transitions (wave complete, game over)
  └─ Game.draw()
      ├─ Renderer.clear()
      ├─ Renderer.beginFrame() → apply screen shake
      ├─ Draw all entities (particles, projectiles, enemies, player)
      ├─ Draw UI (health, XP, abilities, wave info)
      └─ Renderer.endFrame() → restore transform
```

### Combat Flow
```
Player auto-attack:
  tryShoot() → find nearest enemy
    ├─ Create Projectile(s) (+ multishot)
    ├─ Apply stats (damage, speed, piercing)
    └─ AudioManager.playShoot()

Projectile hits enemy:
  collision detected
    ├─ Roll crit (Player.rollCrit())
    ├─ Calculate damage (base * crit multiplier)
    ├─ Enemy.takeDamage(amount)
    ├─ Apply knockback (if item equipped)
    ├─ Apply lifesteal (heal player)
    ├─ Spawn hit particles
    ├─ Create DamageNumber (floating text)
    ├─ Screen shake
    └─ AudioManager.playHit()

Enemy dies:
  ├─ handleEnemyKill()
  ├─ Drop XP and gold
  ├─ Check for explosion item
  ├─ Spawn kill particles
  ├─ AudioManager.playKill()
  └─ Check level up → AudioManager.playLevelUp()
```

### Item System
```
PlayerStats
  ├─ Stores all equipped items
  ├─ Calculates effective stats on demand:
  │   ├─ getDamage() → baseDamage * ∏(item.damageMultiplier)
  │   ├─ getFireRate() → baseFireRate * ∏(item.fireRateMultiplier)
  │   ├─ getCritChance() → baseCrit + Σ(item.critChance)
  │   └─ ... (speed, health, projectile speed, etc.)
  └─ Boolean flags (piercing, explosionOnKill, shield)

Shop flow:
  1. Wave complete → Game.enterShop()
  2. ItemDatabase.getRandomItems(3)
  3. Render shop UI with item cards
  4. Click item → check gold → deduct cost
  5. PlayerStats.addItem(item)
  6. Update player stats (max health, shield, etc.)
  7. Continue → start next wave
```

### Wave System
```
WaveManager
  ├─ startWave(number)
  │   ├─ Set wave properties
  │   ├─ Calculate difficulty multiplier: 1 + (wave - 1) * 0.15
  │   └─ Reset timers
  ├─ update(dt)
  │   ├─ Countdown spawn timer
  │   ├─ When timer hits 0:
  │   │   ├─ chooseEnemyType() → based on wave number
  │   │   ├─ Spawn at random edge
  │   │   └─ Apply difficulty multiplier to stats
  │   └─ Check completion (all spawned + all killed)
  └─ Wave complete → trigger shop
```

### Save System
```
SaveManager (LocalStorage)
  ├─ Run state (roguelite_current_run)
  │   ├─ wave, level, xp, gold, health
  │   └─ items[] (item IDs)
  └─ Meta progression (roguelite_save)
      ├─ highestWave
      ├─ totalRuns
      └─ totalKills

Auto-save: After each shop phase
Load: Menu shows "Continue" if saved run exists
Clear: On game over
```

## Entity Lifecycle

### Player
```typescript
new Player(x, y, stats)
  ↓
update(dt, inputX, inputY)
  ├─ Apply movement
  ├─ Update cooldowns
  ├─ Bounds checking
  └─ Stay alive
  ↓
tryShoot(enemies[]) → Projectile[]
tryDash() → bool (success)
tryBlast() → { success, damage, radius }
  ↓
takeDamage(amount)
  ├─ Check shield
  ├─ Reduce health
  └─ Set dead flag
  ↓
draw(ctx) → render to canvas
```

### Enemy
```typescript
new Enemy(x, y, type, waveMultiplier)
  ↓
update(dt, playerX, playerY)
  ├─ Pathfind to player (simple normalize + move)
  ├─ Shooter: maintain distance + shoot
  └─ Return shouldShoot flag
  ↓
takeDamage(amount)
  ├─ Reduce health
  └─ Set dead flag
  ↓
draw(ctx)
  ├─ Enemy body
  ├─ Health bar (if damaged)
  └─ Type icon
```

### Projectile
```typescript
new Projectile(x, y, angle, damage, speed, fromPlayer, piercing)
  ↓
update(dt, canvasWidth, canvasHeight)
  ├─ Move along velocity
  ├─ Decrement lifetime
  ├─ Out of bounds → dead
  └─ Lifetime expired → dead
  ↓
Collision detected
  ├─ markHit(enemyId?)
  │   ├─ If piercing: track hit enemies
  │   └─ Else: set dead
  └─ hasHit(enemyId) → check if already hit
  ↓
draw(ctx) → glow effect
```

## Performance Considerations

### Efficient Patterns
- **Delta Time**: All movement uses `velocity * dt` for frame-rate independence
- **Object Pooling**: Particles reuse objects via dead flag cleanup
- **Batch Updates**: All entities updated in single pass per frame
- **Circle Collision**: Simple distance checks (no complex polygon math)
- **Canvas Optimization**: Single clear, batch draws, minimal state changes
- **Lazy Calculation**: Stats only computed when needed (getDamage() etc.)

### Memory Management
```typescript
// Cleanup dead entities each frame
this.enemies = this.enemies.filter(e => !e.dead);
this.projectiles = this.projectiles.filter(p => !p.dead);
this.particles = this.particles.filter(p => !p.dead);
```

### Draw Order (back to front)
1. Particles (background effects)
2. Projectiles
3. Enemies
4. Player
5. Damage numbers (foreground)
6. UI overlay

## Extension Points

Want to add new features? Here's where:

- **New Enemy Type**: Add to `Enemy.ts` ENEMY_TYPES, update `chooseEnemyType()`
- **New Item**: Add to `ItemSystem.ts` ItemDatabase.items array
- **New Ability**: Add to `Player.ts` (cooldown + try method + input check)
- **New Particle Effect**: Add spawn function to `Particle.ts`
- **New Sound**: Add method to `AudioManager.ts`
- **Boss Wave**: Modify `WaveManager.ts` to spawn boss at specific waves
- **Permanent Unlocks**: Extend `SaveManager.ts` meta progression

## Code Style

- **OOP**: Each entity is a class with update/draw methods
- **Composition**: Player contains PlayerStats, Game contains all systems
- **Separation**: Input, Rendering, Audio are isolated concerns
- **Types**: Strong typing, interfaces for configs
- **Immutability**: Use const for arrays that get reassigned via filter
- **Clean Code**: Descriptive names, comments on complex logic
