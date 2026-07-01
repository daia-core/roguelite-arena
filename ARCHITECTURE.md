# Roguelite Arena - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
│                    (Vite + TypeScript)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├── Game Loop (60 FPS)
                              ├── Canvas Rendering
                              ├── Input Handling
                              └── State Management

┌─────────────────────────────────────────────────────────────┐
│                      GAME STATES                             │
└─────────────────────────────────────────────────────────────┘

    MENU ──────> PLAYING ──────> SHOP ──────> PLAYING
      │             │                             │
      │             └──────> GAMEOVER ────────────┘
      │                        │
      └────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     CORE SYSTEMS                             │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    Player    │◄───┤  ItemSystem  │────┤ PlayerStats  │
│              │    │              │    │              │
│ - Movement   │    │ - 15+ Items  │    │ - Damage     │
│ - Abilities  │    │ - Synergies  │    │ - Fire Rate  │
│ - Health     │    │ - Rarity     │    │ - Health     │
│ - XP/Level   │    │              │    │ - Modifiers  │
└──────┬───────┘    └──────────────┘    └──────────────┘
       │
       │ Shoots
       ▼
┌──────────────┐
│ Projectile   │
│              │
│ - Position   │
│ - Velocity   │
│ - Damage     │
│ - Piercing   │
└──────┬───────┘
       │
       │ Hits
       ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    Enemy     │◄───┤ WaveManager  │────┤  EnemyTypes  │
│              │    │              │    │              │
│ - Movement   │    │ - Spawning   │    │ - Slime      │
│ - Health     │    │ - Difficulty │    │ - Shooter    │
│ - AI         │    │ - Wave Count │    │ - Tank       │
│ - Type       │    │              │    │ - Fast       │
└──────────────┘    └──────────────┘    └──────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Particle   │◄───┤   Renderer   │────┤    Audio     │
│              │    │              │    │              │
│ - Hit Effect │    │ - Canvas     │    │ - Shoot      │
│ - Kill Effect│    │ - Shake      │    │ - Hit        │
│ - XP Sparkle │    │ - UI         │    │ - Kill       │
│ - Numbers    │    │ - Drawing    │    │ - Purchase   │
└──────────────┘    └──────────────┘    └──────────────┘

┌──────────────┐    ┌──────────────┐
│    Input     │    │ SaveManager  │
│              │    │              │
│ - Keyboard   │    │ - LocalStor  │
│ - Mouse      │    │ - Auto-save  │
│ - Touch      │    │ - Continue   │
│ - Joystick   │    │ - Meta Stats │
└──────────────┘    └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                              │
│                   (Node.js + Express)                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│     Auth     │    │  SaveStates  │    │  MetaStats   │
│              │    │              │    │              │
│ - Register   │    │ - Save Run   │    │ - High Wave  │
│ - Login      │    │ - Load Run   │    │ - Total Runs │
│ - JWT Token  │    │ - Delete     │    │ - Total Kills│
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
                    ┌──────▼───────┐
                    │   SQLite DB  │
                    │              │
                    │ - users      │
                    │ - saves      │
                    │ - stats      │
                    └──────────────┘
```

## Data Flow

### Game Loop
```
┌────────────────────────────────────────────────────┐
│ requestAnimationFrame() - 60 FPS                   │
└────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│ game.update(dt)                                    │
│  ├── input.getMovementVector()                     │
│  ├── player.update(dt, movement)                   │
│  ├── player.tryShoot(enemies) → projectiles        │
│  ├── waveManager.update(dt) → spawn enemies        │
│  ├── enemy.update(dt) for each                     │
│  ├── projectile.update(dt) for each                │
│  ├── collision detection                           │
│  ├── particle.update(dt) for each                  │
│  └── cleanup dead entities                         │
└────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│ game.draw()                                        │
│  ├── renderer.clear()                              │
│  ├── renderer.beginFrame() (apply shake)           │
│  ├── draw particles                                │
│  ├── draw projectiles                              │
│  ├── draw enemies                                  │
│  ├── draw player                                   │
│  ├── draw damage numbers                           │
│  ├── draw HUD (health, XP, abilities)              │
│  └── renderer.endFrame()                           │
└────────────────────────────────────────────────────┘
```

### Combat Flow
```
Player shoots → Projectile created → Hits Enemy
                                          │
                                          ├── Damage applied
                                          ├── Particles spawned
                                          ├── Damage number created
                                          ├── Screen shake added
                                          ├── Sound played
                                          │
                                    Enemy dead?
                                          │
                                     Yes  │  No
                                          ▼
                                    Kill particles
                                    XP particles
                                    Player gains XP
                                    Player gains gold
                                    Explosion on kill?
                                    Update kill count
```

### Wave Flow
```
Wave starts → Enemies spawn over time → All killed → Shop
                                                        │
                                                        ├── Show 3 items
                                                        ├── Player buys
                                                        ├── Stats updated
                                                        │
                                                  Click Continue
                                                        │
                                                   Next Wave
```

### Save Flow
```
┌────────────┐
│ Game Event │
└─────┬──────┘
      │
      ▼
┌────────────────┐    ┌──────────────┐
│ Auto-save      │───►│ LocalStorage │
│ (every action) │    │ (immediate)  │
└────────────────┘    └──────────────┘
      │
      ▼
┌────────────────┐    ┌──────────────┐
│ Manual save    │───►│ API call     │
│ (user clicks)  │    │ (if authed)  │
└────────────────┘    └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Database     │
                      │ (persistent) │
                      └──────────────┘
```

## Component Dependencies

```
Game.ts (main)
 ├── requires: Player, Enemy, Projectile, Particle
 ├── requires: WaveManager, PlayerStats, ItemDatabase
 ├── requires: SaveManager, Input, Renderer, AudioManager
 └── manages: Game state machine

Player.ts
 ├── requires: PlayerStats, Projectile
 └── exports: Player class

Enemy.ts
 ├── requires: EnemyType interface
 └── exports: Enemy class, ENEMY_TYPES

ItemSystem.ts
 ├── exports: Item, PlayerStats, ItemDatabase
 └── standalone: No dependencies

WaveManager.ts
 ├── requires: Enemy, ENEMY_TYPES
 └── exports: WaveManager class

Particle.ts
 ├── exports: Particle, DamageNumber, spawn functions
 └── standalone: Utility functions

SaveManager.ts
 ├── uses: LocalStorage API
 └── exports: SaveManager static class

Input.ts
 ├── requires: Canvas element
 └── exports: Input class

Renderer.ts
 ├── requires: Canvas context
 └── exports: Renderer class

AudioManager.ts
 ├── uses: Web Audio API
 └── exports: AudioManager class

api.ts
 ├── uses: Fetch API
 └── exports: API static class
```

## File Size Breakdown

```
Total Bundle: ~40 KB (12 KB gzipped)

Game.ts           ~21 KB  (game logic)
Player.ts          ~6 KB  (player systems)
Enemy.ts           ~4 KB  (enemy AI)
ItemSystem.ts      ~7 KB  (items + stats)
Other files        ~2 KB  (utilities)
```

## Performance Targets

```
Metric              Target      Actual
──────────────────────────────────────
FPS                 60          ✓ 60
Load Time           < 2s        ✓ ~1s
Bundle Size         < 50 KB     ✓ 12 KB gzipped
Memory Usage        < 100 MB    ✓ ~50 MB
Input Latency       < 16ms      ✓ ~10ms
Draw Calls/Frame    < 1000      ✓ ~200
```

## API Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ HTTP + JSON
       ▼
┌─────────────┐     ┌──────────────┐
│   Express   │────►│ Middleware   │
│   Router    │     │              │
│             │     │ - CORS       │
│             │     │ - JSON parse │
│             │     │ - Auth check │
└──────┬──────┘     └──────────────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐
│  Handlers   │────►│   Database   │
│             │     │              │
│ - Auth      │     │ - users      │
│ - Saves     │     │ - saves      │
│ - Stats     │     │ - meta_stats │
└─────────────┘     └──────────────┘
```

## Deployment Architecture

```
┌──────────────┐
│   Vercel     │  Frontend
│              │  - Serves static files
│   /dist/*    │  - CDN distribution
│              │  - HTTPS automatic
└──────┬───────┘
       │
       │ API calls
       ▼
┌──────────────┐
│ Forge/Railway│  Backend
│              │  - Node.js runtime
│ server.js    │  - SQLite database
│              │  - PM2 process mgr
│ :3000/api/*  │  - HTTPS via nginx
└──────────────┘
```

## State Management

```
Game State Machine:
┌────────┐
│  MENU  │ (initial state)
└───┬────┘
    │ startNewGame()
    ▼
┌────────┐
│PLAYING │ (core gameplay loop)
└───┬────┘
    │ waveComplete()
    ▼
┌────────┐
│  SHOP  │ (between waves)
└───┬────┘
    │ startNextWave()
    ▼
┌────────┐
│PLAYING │ (next wave)
└───┬────┘
    │ player.dead
    ▼
┌─────────┐
│GAMEOVER │ (end state)
└───┬─────┘
    │ retry()
    ▼
  MENU
```

## Extension Points

Where to add new features:

**New Items:**
- Add to `ItemSystem.ts` → `ITEM_DATABASE`
- Define stats and effects
- ItemDatabase picks them automatically

**New Enemies:**
- Add to `Enemy.ts` → `ENEMY_TYPES`
- Define stats and behavior
- WaveManager uses them

**New Abilities:**
- Add to `Player.ts`
- Create cooldown property
- Add to input handling
- Add UI in `Game.ts` draw methods

**New Game Modes:**
- Add state to `GameState` type
- Add case in `Game.update()`
- Add case in `Game.draw()`

This architecture is designed for easy extension and modification while keeping core systems decoupled.
