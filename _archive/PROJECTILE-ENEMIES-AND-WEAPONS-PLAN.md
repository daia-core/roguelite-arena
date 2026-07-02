# Projectile Enemies & Player Weapons Implementation Plan

## Goal
Address Felix's request: "enemies that fire spinning shots, firing homing shots, fire spirals, aoe attacks" + "variety of different weapons for the player that affects the base weapon attack (like brotato)"

## Current State
- 10 new enemy types added (commit caefcb7) - mostly melee/special-ability based
- Player has single projectile weapon type
- No enemy projectile patterns (spinning, homing, spiral, AOE)
- No weapon variety system

## Part 1: Enemy Projectile Patterns (4 new enemy types)

### 1. **Spinner** - Fires spinning ring of projectiles
- Stationary or slow-moving turret enemy
- Fires 8 projectiles in a circular pattern that rotates
- Medium HP, moderate damage
- Pattern: 360° spread, rotates 45° each shot

### 2. **Seeker** - Fires homing projectiles
- Mobile enemy that keeps distance
- Projectiles track player position
- Low HP, high evasion
- Pattern: Single homing missile with course correction

### 3. **Vortex** - Fires spiral patterns
- Medium speed enemy
- Creates expanding spiral of projectiles
- Medium HP, area denial
- Pattern: Fibonacci spiral or logarithmic spiral

### 4. **Bomber** - AOE explosion attacks
- Charges toward player
- Explodes on contact or when killed (AOE damage ring)
- High HP, slow speed
- Pattern: Radial burst of damage on death

## Part 2: Player Weapon Variety (Brotato-style)

### Base Weapon Types (5 core archetypes)

1. **Pistol** (default - current behavior)
   - Medium damage, medium fire rate
   - Single projectile forward
   - Balanced all-rounder

2. **Shotgun**
   - High damage, slow fire rate
   - 5 projectiles in spread pattern
   - Close-range powerhouse

3. **SMG / Rapid Fire**
   - Low damage, very high fire rate
   - Single projectile, laser-like
   - Spray-and-pray

4. **Launcher / Cannon**
   - Very high damage, very slow fire rate
   - Large explosive projectile
   - AOE on hit

5. **Melee / Sword**
   - Melee swing arc (no projectile)
   - Very high damage, close range only
   - Cleave multiple enemies

### Weapon System Architecture

```typescript
// New file: WeaponSystem.ts

export type WeaponType = 'pistol' | 'shotgun' | 'smg' | 'launcher' | 'melee';

export interface WeaponData {
  type: WeaponType;
  name: string;
  baseDamage: number;
  baseFireRate: number;
  projectileCount: number;
  spreadAngle: number;  // degrees
  projectileSpeed: number;
  range: number;
  aoeRadius: number;  // 0 for no AOE
  isMelee: boolean;
}

export const WEAPON_TYPES: Record<WeaponType, WeaponData> = {
  pistol: {
    type: 'pistol',
    name: 'Pistol',
    baseDamage: 15,
    baseFireRate: 2.5,
    projectileCount: 1,
    spreadAngle: 0,
    projectileSpeed: 400,
    range: 600,
    aoeRadius: 0,
    isMelee: false
  },
  shotgun: {
    type: 'shotgun',
    name: 'Shotgun',
    baseDamage: 25,
    baseFireRate: 1.0,
    projectileCount: 5,
    spreadAngle: 30,
    projectileSpeed: 350,
    range: 400,
    aoeRadius: 0,
    isMelee: false
  },
  smg: {
    type: 'smg',
    name: 'SMG',
    baseDamage: 8,
    baseFireRate: 5.0,
    projectileCount: 1,
    spreadAngle: 0,
    projectileSpeed: 500,
    range: 500,
    aoeRadius: 0,
    isMelee: false
  },
  launcher: {
    type: 'launcher',
    name: 'Rocket Launcher',
    baseDamage: 60,
    baseFireRate: 0.75,
    projectileCount: 1,
    spreadAngle: 0,
    projectileSpeed: 300,
    range: 700,
    aoeRadius: 80,
    isMelee: false
  },
  melee: {
    type: 'melee',
    name: 'Sword',
    baseDamage: 40,
    baseFireRate: 2.0,
    projectileCount: 0,
    spreadAngle: 90,  // arc sweep
    projectileSpeed: 0,
    range: 60,
    aoeRadius: 0,
    isMelee: true
  }
};
```

### Shop Integration

- Weapons appear as purchasable items in the shop
- Changing weapon replaces base attack
- Existing stat modifiers still apply (damage%, fire rate%, etc.)
- Starting weapon: Pistol
- Weapon items are **Legendary tier** (high cost, game-changing)

## Implementation Steps

1. Create `WeaponSystem.ts` with weapon types and data
2. Add 4 new projectile-pattern enemy types to `Enemy.ts`
3. Update `Player` class to hold current weapon
4. Modify player attack logic to use weapon data
5. Add weapon items to shop (ItemSystem.ts)
6. Test each weapon + enemy pattern combination
7. Balance pass
8. Deploy

## Success Criteria

- [x] 4 new enemy types with distinct projectile patterns
- [x] 5 player weapon types that feel different
- [x] Weapons purchasable in shop
- [x] Balanced gameplay (no dominant strategy)
- [x] All combinations tested
- [x] Committed to git

## Time Estimate

- Part 1 (Projectile Enemies): ~1-1.5 hours
- Part 2 (Weapon System): ~1.5-2 hours
- Testing + Balance: ~0.5 hour
- **Total: ~3-4 hours**

Good candidate for a focused night session.
