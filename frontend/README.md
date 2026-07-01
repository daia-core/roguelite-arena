# Browser-Based Roguelite Game

A complete TypeScript-based roguelite game engine with 60fps canvas rendering, wave-based enemy spawning, items, abilities, and juicy visual effects.

## Features

### Core Systems
- **60fps Canvas Rendering** - Smooth game loop with delta time updates
- **Entity System** - Clean OOP architecture for all game entities
- **Collision Detection** - Circle-based collision for players, enemies, and projectiles
- **Auto-Save** - LocalStorage persistence for run state and meta-progression

### Gameplay
- **Player Controls**
  - WASD or Arrow Keys for movement
  - Touch joystick for mobile (left side of screen)
  - Auto-attacks nearest enemy
  - 2 Active Abilities:
    - **Dash** (Space/Shift) - Quick dash with 3s cooldown
    - **Blast** (E/Q) - AoE damage around player with 5s cooldown

- **Enemy Types**
  - **Basic** - Slow, low HP, standard enemy
  - **Fast** - Quick, low HP, rushes player
  - **Tank** - Slow, high HP, tough
  - **Shooter** - Ranged attacks, keeps distance

- **Wave System**
  - 20 enemies per wave
  - 35 seconds per wave
  - Shop screen between waves
  - Difficulty scales with wave number

### Progression Systems

#### Items (15 total)
Items stack multiplicatively for powerful synergies:

**Common:**
- Damage Boost (+20% damage)
- Rapid Fire (+30% fire rate)
- Swift Steps (+25% movement speed)
- Vitality (+20 max health)

**Rare:**
- Lucky Strike (+15% crit chance)
- Precision (+50% crit damage)
- Vampiric (10% lifesteal)
- Piercing Rounds (bullets go through enemies)
- Split Shot (+2 projectiles)

**Epic:**
- Explosive Finale (enemies explode on death)
- Energy Shield (absorb next hit)
- Railgun (+100% projectile speed)

**Legendary:**
- Berserker (+50% damage)
- Knockback (push enemies on hit)
- Glass Cannon (+100% damage, -50% health)

#### Leveling
- Gain XP from killing enemies
- Each level increases base damage and max health
- Heal on level up

#### Shop
- 3 random items after each wave
- Purchase with gold earned from kills
- Items persist between waves

### Juice & Polish
- **Particle Effects**
  - Hit particles on damage
  - Explosion particles on kill
  - XP particles when enemies drop loot
  - Dash trail effects

- **Screen Shake** - On hits, kills, and abilities
- **Floating Damage Numbers** - Show damage dealt with crit highlighting
- **Sound Effects** - Web Audio API beeps for all actions
- **Visual Feedback**
  - Enemy health bars
  - Shield glow effect
  - Ability cooldown indicators
  - Wave progress display

### Mobile Support
- Virtual joystick (touch left side of screen)
- Touch buttons for abilities (bottom right)
- Responsive canvas scaling
- Touch-optimized UI

## Architecture

### File Structure
```
src/
├── main.ts              # Entry point, game loop, canvas setup
├── Game.ts              # Game state machine (menu, playing, shop, gameover)
├── Player.ts            # Player entity, stats, abilities
├── Enemy.ts             # Enemy entity, AI, types
├── Projectile.ts        # Player/enemy bullets
├── Particle.ts          # Visual effects, damage numbers
├── WaveManager.ts       # Wave spawning and progression
├── ItemSystem.ts        # Item definitions, stats calculation
├── SaveManager.ts       # LocalStorage persistence
├── Input.ts             # Keyboard, mouse, touch handling
├── Renderer.ts          # Canvas drawing, screen shake
├── AudioManager.ts      # Web Audio API sound effects
├── utils.ts             # Math helpers, collision detection
└── style.css            # Game UI styles
```

### Clean OOP Design
- Each entity is a self-contained class with update/draw methods
- Clear separation of concerns (rendering, input, game logic)
- Stats system uses multiplicative stacking for interesting combinations
- State machine for game flow (menu → playing → shop → repeat)

## Running the Game

```bash
npm install
npm run dev
```

Open http://localhost:5173/ in your browser.

## Controls

### Keyboard
- **WASD / Arrow Keys** - Move
- **Space / Shift** - Dash
- **E / Q** - Blast

### Mobile
- **Touch left side** - Virtual joystick
- **DASH button** - Dash ability
- **BLAST button** - Blast ability

## Technical Details

### Performance
- Runs at 60fps with proper delta time calculations
- Efficient particle pooling
- Canvas optimization with requestAnimationFrame
- Collision detection uses simple circle-circle checks

### Save System
- **Current Run** - Wave, level, gold, health, items
- **Meta Progression** - Highest wave, total runs, total kills
- Continue option appears when saved run exists
- Auto-saves after each wave

### Audio
- Web Audio API for low-latency sound
- Procedural beep sounds (no asset loading)
- Master volume control
- Toggle sound on/off

## Future Enhancements
- More enemy types and bosses
- Additional items and synergies
- Permanent meta-progression unlocks
- Difficulty modifiers
- Leaderboards
- More abilities

## Credits
Built with TypeScript, Vite, and Canvas API. Clean, performant, and extensible architecture.
