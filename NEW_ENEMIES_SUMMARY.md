# New Enemy Types Summary

## Overview
Successfully added 10 NEW enemy types to the roguelite game with unique behaviors and pixel art sprites. Each enemy has distinct mechanics that make them feel different to fight, following Felix's requirement: "More enemy variation and enemy types themselves should not get stronger. Just keep introducing more enemy types."

## New Enemies Added

### 1. **Ghost**
- **Health:** 60
- **Speed:** 70
- **Damage:** 8
- **Unique Behavior:**
  - Phases through walls with wavy serpentine movement pattern
  - Cannot be knocked back
  - Translucent rendering (60% opacity)
  - Moves in sine wave pattern for unpredictable motion
- **Sprite:** Ethereal cyan translucent spirit with flowing form

### 2. **Mushroom**
- **Health:** 100
- **Speed:** 0 (stationary)
- **Damage:** 10
- **Unique Behavior:**
  - Stationary enemy - doesn't move
  - Periodically spawns damaging spore clouds (every 2.5s)
  - Explodes on death with large spore burst (120 radius damage)
  - Priority target for players
- **Sprite:** Purple poisonous mushroom with white spots

### 3. **Gargoyle**
- **Health:** 180
- **Speed:** 45
- **Damage:** 12
- **Unique Behavior:**
  - Alternates between moving (3s) and stone form (2s)
  - INVINCIBLE while in stone form (stationary)
  - Visual filter darkens when in stone form
  - Heavy tank that requires timing to damage
- **Sprite:** Stone gargoyle with wings, darker gray coloring

### 4. **Blob**
- **Health:** 80
- **Speed:** 50 (gets faster when smaller)
- **Damage:** 7
- **Unique Behavior:**
  - Splits into 2 smaller blobs on death (up to 2 generations)
  - Each generation is 30% weaker but 30% faster
  - Creates emergent difficulty as one blob becomes many
- **Sprite:** Red amorphous blob with dark core

### 5. **Necro Egg**
- **Health:** 50
- **Speed:** 20
- **Damage:** 5
- **Unique Behavior:**
  - Spawns weak skeleton minions over time (max 3)
  - Priority target - kill before it spawns too many
  - Slow moving spawner enemy
  - Green necromantic particle effects on spawn
- **Sprite:** Dark red egg with glowing green necromantic runes

### 6. **Cyclops**
- **Health:** 150
- **Speed:** 40 (3x when charging)
- **Damage:** 15
- **Unique Behavior:**
  - Charges in straight lines toward player
  - Stuns self for 1.5s when hitting walls
  - Vulnerable while stunned (grayscale visual)
  - 5 second cooldown between charges
- **Sprite:** Large one-eyed cyclops with tan skin

### 7. **Phantom**
- **Health:** 45
- **Speed:** 140 (very fast)
- **Damage:** 10
- **Unique Behavior:**
  - Invisible until player gets within 120 units
  - 20% opacity when invisible with blur effect
  - Fragile but hard to see coming
  - Ambush enemy
- **Sprite:** Purple wispy phantom (similar to ghost but darker)

### 8. **Druid**
- **Health:** 70
- **Speed:** 65
- **Damage:** 6
- **Unique Behavior:**
  - Heals nearby enemies (150 radius) for 15 HP every 3s
  - Flees from player when within 180 units
  - Priority support target
  - Green healing particle effects
- **Sprite:** Green robed druid with nature leaf motif

### 9. **Construct**
- **Health:** 130
- **Speed:** 55
- **Damage:** 11
- **Unique Behavior:**
  - Immune to knockback
  - 30% chance to reflect projectiles (planned feature)
  - Mechanical enemy with consistent movement
  - Tanky and reliable
- **Sprite:** Gray metal construct with glowing blue eyes and orange core

### 10. **Swarm**
- **Health:** 90 (shared pool)
- **Speed:** 150 (very fast)
- **Damage:** 6
- **Unique Behavior:**
  - 3-5 tiny creatures sharing one health pool
  - Scatter formation when hit
  - Fast and erratic
  - Small hitbox (radius 8)
- **Sprite:** Small gold/yellow wasp-like creature with red stripes

## Wave Progression

Enemies are introduced gradually across waves to maintain learning curve:

- **Waves 1-2:** Slimes, Goblins (original)
- **Waves 3-4:** + Bats, Ghosts, Swarms
- **Waves 5-6:** + Spiders, Mimics, Mushrooms, Blobs
- **Waves 7-10:** + Skeletons, Wizards, Imps, Phantoms, Druids
- **Waves 11-15:** + All late-game enemies, Gargoyles, Necro Eggs, Constructs
- **Waves 16-20:** + Cyclops
- **Waves 21+:** Full enemy variety pool

## Technical Implementation

### Files Modified:
1. **Enemy.ts**
   - Added 10 new enemy types to EnemyType union
   - Added ENEMY_TYPES data with balanced stats
   - Added unique state variables for each enemy
   - Implemented unique behaviors in update() method
   - Updated takeDamage() for gargoyle invulnerability and blob splits
   - Updated applyKnockback() for ghost/construct immunity
   - Added checkWallCollision() for cyclops

2. **sprites.ts**
   - Created 10 new pixel art sprites following existing art style
   - Used hue-shifted color ramps and dithering
   - Each sprite is visually distinct and matches behavior
   - 30x30 to 60x60 pixel art scaled 3x

3. **WaveManager.ts**
   - Updated chooseEnemyType() to include new enemies in spawn pools
   - Gradual introduction across wave progression
   - Chaos waves include all enemy types

4. **Game.ts**
   - Added handling for spore cloud damage (mushroom)
   - Added druid healing behavior
   - Added necro egg minion spawning
   - Added cyclops wall collision checking
   - Added mushroom death explosion
   - Updated damage handling to support enemy splits (blobs)

## Balance Philosophy

All new enemies follow the design constraint:
- **No power creep:** Stats kept within existing ranges
- **Health:** 45-180 (similar to existing 50-200)
- **Speed:** 0-150 (variety, not all fast)
- **Damage:** 6-15 (consistent with existing)
- **XP/Gold:** 18-35 XP, 14-28 gold (fair rewards)

Focus is on **unique mechanics** rather than **higher stats**, creating variety through:
- Movement patterns (ghost wavy, druid flee, mushroom stationary)
- Special abilities (gargoyle invincibility, druid healing, necro egg spawning)
- Conditional behaviors (phantom invisibility, cyclops charge/stun)
- Split mechanics (blob multi-generation splits)

## Player Experience

The new enemies create diverse tactical challenges:
- **Prioritization:** Mushrooms, Necro Eggs, and Druids should be killed first
- **Timing:** Gargoyles require hitting during movement phase
- **Positioning:** Cyclops can be baited into walls, Mushrooms explode on death
- **Awareness:** Phantoms are invisible, Ghosts phase through obstacles
- **Multi-threat:** Blobs multiply, Swarms are fast clusters

Total enemy count: **25 types** (15 original + 10 new)
