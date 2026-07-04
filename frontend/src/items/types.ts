// Item type definitions — the shape of every item, its tags/kinds, and weapon patterns.
// Split out of the old ItemSystem monolith so the data catalog, the type contract, and
// the runtime logic (ItemDatabase / PlayerStats) each live in their own file. Nothing
// here has behaviour; it is pure types + the two small pure helpers that classify an item.

export const ItemTier = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Legendary: 4
} as const;

export type ItemTier = typeof ItemTier[keyof typeof ItemTier];

export type ItemTag = 'melee' | 'ranged' | 'defensive' | 'economic' | 'elemental' | 'utility';

// At-a-glance category shown on item cards (orthogonal to the synergy tags above):
//   weapon  = adds/changes an attack (swing-altering, aux weapon, projectile modifier)
//   passive = an always-on stat or on-hit effect
//   active  = a periodic/triggered effect that fires on its own (bomb drop, nova pulse)
// Items can be several at once (a spear that also grants move speed = weapon + passive).
export type ItemKind = 'weapon' | 'passive' | 'active';

// Derive an item's kinds from its fields, so the roster stays correct without hand-tagging
// all ~200 entries. Weapon/active are detected by the mechanical fields they use; anything
// with a plain stat/effect is passive. Every item resolves to at least one kind.
export function getItemKinds(item: Item): ItemKind[] {
  const kinds: ItemKind[] = [];
  const isWeapon = item.weaponType !== undefined
    || item.swingDamageMult !== undefined || item.swingRangeBonus !== undefined
    || item.swingArcBonus !== undefined || item.swingCooldownMult !== undefined
    || item.swingAoe !== undefined || item.meleeDamageMult !== undefined
    || item.orbitOrbs !== undefined || item.auxMelee === true
    || item.multishot !== undefined || item.piercing !== undefined
    || item.homing === true || item.projectileSpeed !== undefined
    || item.multicast !== undefined;
  const isActive = item.bombDrop === true || item.novaPulse === true;
  const isPassive = !isWeapon && !isActive
    || item.damageMultiplier !== undefined || item.fireRateMultiplier !== undefined
    || item.critChance !== undefined || item.critDamageMultiplier !== undefined
    || item.speedMultiplier !== undefined || item.maxHealthBonus !== undefined
    || item.healthRegen !== undefined || item.armor !== undefined
    || item.lifesteal !== undefined || item.thorns !== undefined
    || item.dodge !== undefined || item.xpMagnet !== undefined
    || item.goldBonus !== undefined || item.luck !== undefined
    || item.interestBonus !== undefined || item.aoeRadiusMult !== undefined;
  if (isWeapon) kinds.push('weapon');
  if (isActive) kinds.push('active');
  if (isPassive || kinds.length === 0) kinds.push('passive');
  return kinds;
}

// Weapon attack patterns (Brotato-inspired)
export type WeaponType =
  | 'auto-aim' // Default: auto-aim bullets
  | 'shotgun' // Spread of projectiles
  | 'laser' // Continuous beam
  | 'orbital' // Rotating projectiles around player
  | 'melee'; // Swing/slash around player

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  tier: ItemTier;
  cost: number;
  icon: string;
  unlocked: boolean;
  tags: ItemTag[]; // For synergy detection and affinity system

  // Weapon system (Brotato-inspired)
  weaponType?: WeaponType; // Changes attack behavior
  weaponRange?: number; // For melee weapons
  weaponArc?: number; // For melee sweep angle (radians)

  // AUXILIARY STACKING WEAPONS — these run ALONGSIDE the primary weapon (they do
  // NOT replace weaponType), so a gun build can also spin blades, orbit orbs,
  // drop bombs and pulse novas. Additive/count fields stack across copies;
  // boolean fields don't (a duplicate is wasted, so the shop stops offering it).
  orbitOrbs?: number; // extra energy orbs circling the player (additive)
  orbitDamageMult?: number; // scales orbit-orb contact damage
  auxMelee?: boolean; // a whirling melee arc that swings on its own timer
  auxMeleeDamageMult?: number; // scales the aux melee damage
  bombDrop?: boolean; // periodically drop a bomb at the player's feet
  bombDamageMult?: number; // scales bomb blast damage
  bombCooldownMult?: number; // <1 = bombs drop faster (multiplies the base cooldown)
  novaPulse?: boolean; // periodic expanding shockwave from the player
  novaDamageMult?: number; // scales nova damage
  novaCooldownMult?: number; // <1 = novas fire faster

  // MELEE SWING — every player has a default swing that auto-hits nearby enemies.
  // These fields let items shape it into distinct melee builds. The swing STACKS on
  // top of the (always-firing) ranged weapon, so a melee build still shoots weakly.
  swingDamageMult?: number; // scales the default swing damage (multiplicative)
  swingRangeBonus?: number; // flat range added to the swing reach (px)
  swingArcBonus?: number; // radians added to the swing arc width
  swingCooldownMult?: number; // <1 = swing faster, >1 = slower/heavier
  swingAoe?: number; // radius of a full-circle AOE burst on each swing (px); makes the swing hit all around
  aoeRadiusMult?: number; // GLOBAL area multiplier — scales swing AOE, nova, and bomb radii

  // Stat modifiers
  damageMultiplier?: number;
  // Per-damage-type multipliers (Brotato-style). These layer ON TOP of the global
  // damageMultiplier and only apply to the matching source, so an item can read
  // "+45% melee dmg, -10% ranged dmg" — a real specialisation cost that makes a
  // melee build and a ranged build mechanically different, not just a tag.
  meleeDamageMult?: number; // multiplies melee-weapon hits only
  rangedDamageMult?: number; // multiplies projectile hits only
  elementalDamageMult?: number; // multiplies on-hit elemental effects (chain, explosion)
  fireRateMultiplier?: number;
  critChance?: number; // Additive
  critDamageMultiplier?: number; // Multiplicative
  speedMultiplier?: number;
  maxHealthBonus?: number; // Additive
  healthRegen?: number; // HP per second
  armor?: number; // Flat damage reduction

  // Special effects
  piercing?: number; // Number of enemies to pierce
  explosionOnHit?: boolean;
  chainLightning?: number; // Percentage chance
  lifesteal?: number; // Percentage
  thorns?: number; // Percentage reflect
  shield?: boolean;
  multishot?: number; // Extra projectiles
  projectileSpeed?: number;
  knockback?: number;
  xpMagnet?: number; // Multiplier for pickup range
  goldBonus?: number; // Multiplier
  dodge?: number; // Percentage chance to evade
  poison?: boolean; // DoT effect
  freeze?: number; // Percentage chance to slow
  homing?: boolean; // Bullets curve toward enemies

  // STATUS ENGINES (Phase 3b — inspired by Soulstone Survivors). Each is an on-hit
  // status that ticks in the enemy loop, so they stack across a whole DoT/status build
  // and are mechanically distinct from raw damage. All apply from BOTH ranged and melee.
  burn?: number; // chance to Ignite: fast, short fire DoT (bigger ticks than poison)
  bleed?: number; // chance to Bleed: DoT that hits harder while the enemy is moving (punishes rushers)
  poisonSpread?: boolean; // a poisoned enemy that dies infects the nearest enemy (chain plague)
  doom?: number; // chance to mark with Doom: stores a share of damage, then detonates — executes if stored >= current HP
  wound?: number; // chance on-hit to Wound: amplifies ALL damage-over-time already on that enemy (DoT multiplier)
  multicast?: number; // chance the ranged weapon fires a bonus volley the same frame

  // Brotato-inspired mechanics
  rerollDiscount?: number; // Reduce shop reroll cost
  shopDiscount?: number; // Reduce all shop prices
  recycleBonus?: number; // Increase recycle value
  interestBonus?: number; // Additional interest rate on banked gold (additive, e.g. 0.05 = +5%)
  luck?: number; // Raises shop rarity + health-orb drop chance (additive, e.g. 0.15 = +15%)

  // ---- CONDITIONAL / TRIGGERED DAMAGE (the game's first non-static item layer) ----
  // Unlike every field above (a flat always-on stat), these only pay out when a run
  // CONDITION is met — so they reward a play pattern, not just ownership. Each is an
  // additive rate summed across copies (stacking duplicates deepens the effect) and
  // is folded into the per-frame runtime damage/fire-rate multiplier by Game
  // (updateRuntimeModifiers), exactly like the momentum/berserk artifacts. Values are
  // "+fraction" (0.5 = +50%). Thresholds/caps live as constants in Game.ts.
  waveRampDamage?: number;   // Grindstone: permanent +dmg for each wave survived this run
  lowHpPower?: number;       // Last Stand: while HP is low, +dmg AND +fire rate
  killStackDamage?: number;  // Killing Spree: each kill adds a decaying +dmg stack
  highHpPower?: number;      // Juggernaut: while HP is high (unhurt), +dmg
  goldScaleDamage?: number;  // Miser's Hoard: +dmg scaling with unspent gold on hand

  // ---- ON-KILL MILESTONE (Soul Tithe) ----
  // A run-long on-kill counter: every 10th kill while held drops a health orb, and
  // every 50th kill banks a PERMANENT +1% damage stack (no cap) — so clear speed
  // itself becomes a scaling stat and a turn-1 pickup snowballs across the whole run.
  soulTithe?: boolean;

  // ---- ON-KILL PROC (Ceremonial Daggers) ----
  // On every kill, spawn this many homing spectral daggers that seek nearby enemies,
  // turning kills into a self-sustaining chain that clears trash and snowballs dense
  // waves. Additive across copies (more daggers per kill). Bounded against runaway
  // recursion in Game: a dagger's OWN kill never spawns more daggers (one generation
  // per primary kill), so a dense pack can't cascade into an exponential dagger storm.
  ceremonialDaggers?: number;

  // ---- EXECUTE (on-hit conditional, resolved in Game's projectile-hit path) ----
  // Instantly kill a NON-boss enemy the moment a hit leaves it at or below this
  // fraction of max HP. Stacked copies take the HIGHEST threshold (Math.max), not
  // a sum — cheap copies can't compound into "execute at full HP". The kill routes
  // through the normal kill path, so it still grants XP/gold and feeds Killing Spree.
  executeThreshold?: number; // e.g. 0.15 = execute enemies at/under 15% HP

  // ---- PROC LUCK (roll-twice-keep-better) ----
  // When held, every random on-hit STATUS proc (burn/bleed/freeze/chain/doom/wound/
  // multicast) rolls twice and takes the better result — a keystone that lifts the
  // whole status/proc ecosystem without touching any individual chance. Boolean
  // (OR'd across copies): a second copy can't roll three times. Does NOT touch crit
  // or dodge (core stats), only the status ecosystem this item is built around.
  fourleafCharm?: boolean;
}

export interface Weapon {
  id: string;
  name: string;
  baseName: string; // For combining (e.g., "Sword")
  tier: ItemTier;
  damage: number;
  icon: string;
  cost: number;
  unlocked: boolean;
}
