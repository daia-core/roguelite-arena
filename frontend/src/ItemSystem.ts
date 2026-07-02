// Advanced item and upgrade system with tiers, tags, and Brotato-inspired mechanics

import { TransformationTracker } from './TransformationSystem';
import { DuoTracker, DUO_COMBOS, type DuoCombo } from './DuoSystem';

export const ItemTier = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Legendary: 4
} as const;

export type ItemTier = typeof ItemTier[keyof typeof ItemTier];

export type ItemTag = 'melee' | 'ranged' | 'defensive' | 'economic' | 'elemental' | 'utility';

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

  // Brotato-inspired mechanics
  rerollDiscount?: number; // Reduce shop reroll cost
  shopDiscount?: number; // Reduce all shop prices
  recycleBonus?: number; // Increase recycle value
  interestBonus?: number; // Additional interest rate on banked gold (additive, e.g. 0.05 = +5%)
  luck?: number; // Raises shop rarity + health-orb drop chance (additive, e.g. 0.15 = +15%)
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

export class ItemDatabase {
  private static items: Item[] = [
    // ==================== TIER 1 (COMMON) ====================
    // Basic stat boosts - cheap and accessible
    {
      id: 'damage_t1',
      name: 'Iron Ring',
      description: '+3 damage',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 8,
      icon: '💍',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.15
    },
    {
      id: 'attack_speed_t1',
      name: 'Swift Gloves',
      description: '+10% fire rate',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 8,
      icon: '🧤',
      unlocked: true,
      tags: ['melee'],
      fireRateMultiplier: 1.1
    },
    {
      id: 'movement_speed_t1',
      name: 'Worn Boots',
      description: '+10% move speed',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 7,
      icon: '👟',
      unlocked: true,
      tags: ['utility'],
      speedMultiplier: 1.1
    },
    {
      id: 'max_hp_t1',
      name: 'Health Pendant',
      description: '+15 max health',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 10,
      icon: '❤️',
      unlocked: true,
      tags: ['defensive'],
      maxHealthBonus: 15
    },
    {
      id: 'hp_regen_t1',
      name: 'Healing Charm',
      description: '+0.5 HP/sec',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 9,
      icon: '💚',
      unlocked: true,
      tags: ['defensive'],
      healthRegen: 0.5
    },
    {
      id: 'xp_magnet_t1',
      name: 'Small Magnet',
      description: '+30% pickup range',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 6,
      icon: '🧲',
      unlocked: true,
      tags: ['utility'],
      xpMagnet: 1.3
    },
    {
      id: 'gold_bonus_t1',
      name: 'Coin Purse',
      description: '+10% gold',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 8,
      icon: '💰',
      unlocked: true,
      tags: ['economic'],
      goldBonus: 1.1
    },
    {
      id: 'armor_t1',
      name: 'Leather Vest',
      description: '+2 armor',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 12,
      icon: '🦺',
      unlocked: true,
      tags: ['defensive'],
      armor: 2
    },

    // ==================== TIER 2 (UNCOMMON) ====================
    // Moderate stat boosts and simple special effects
    {
      id: 'damage_t2',
      name: 'Steel Band',
      description: '+15% damage',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 25,
      icon: '💎',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.25
    },
    {
      id: 'attack_speed_t2',
      name: 'Rapid Gauntlets',
      description: '+20% fire rate',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 25,
      icon: '⚡',
      unlocked: true,
      tags: ['melee', 'ranged'],
      fireRateMultiplier: 1.2
    },
    {
      id: 'movement_speed_t2',
      name: 'Running Shoes',
      description: '+20% move speed',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 22,
      icon: '👢',
      unlocked: true,
      tags: ['utility'],
      speedMultiplier: 1.2
    },
    {
      id: 'max_hp_t2',
      name: 'Vitality Ring',
      description: '+30 max health',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '❤️‍🔥',
      unlocked: true,
      tags: ['defensive'],
      maxHealthBonus: 30
    },
    {
      id: 'crit_chance_t2',
      name: 'Lucky Coin',
      description: '+10% crit chance',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🎯',
      unlocked: true,
      tags: ['melee', 'ranged'],
      critChance: 0.1
    },
    {
      id: 'crit_damage_t2',
      name: 'Precision Scope',
      description: '+35% crit damage',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '🔍',
      unlocked: true,
      tags: ['ranged'],
      critDamageMultiplier: 1.35
    },
    {
      id: 'lifesteal_t2',
      name: 'Vampire Fang',
      description: '5% lifesteal',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🩸',
      unlocked: true,
      tags: ['melee'],
      lifesteal: 0.05
    },
    {
      id: 'dodge_t2',
      name: 'Evasion Cloak',
      description: '8% dodge chance',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '💨',
      unlocked: true,
      tags: ['defensive', 'utility'],
      dodge: 0.08
    },
    {
      id: 'thorns_t2',
      name: 'Spiked Armor',
      description: 'Reflect 15% damage',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 26,
      icon: '🌵',
      unlocked: true,
      tags: ['defensive'],
      thorns: 0.15
    },
    {
      id: 'armor_t2',
      name: 'Chain Mail',
      description: '+5 armor',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 35,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      armor: 5
    },
    {
      id: 'gold_bonus_t2',
      name: 'Treasure Hunter',
      description: '+25% gold',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 24,
      icon: '💸',
      unlocked: true,
      tags: ['economic'],
      goldBonus: 1.25
    },
    {
      id: 'reroll_discount_t2',
      name: 'Spyglass',
      description: '-50% reroll cost',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '🔭',
      unlocked: true,
      tags: ['economic', 'utility'],
      rerollDiscount: 0.5
    },
    {
      id: 'shop_discount_t2',
      name: 'Coupon Book',
      description: '-10% shop prices',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 22,
      icon: '🎫',
      unlocked: true,
      tags: ['economic'],
      shopDiscount: 0.1
    },
    {
      id: 'recycle_bonus_t2',
      name: 'Haggler Badge',
      description: '+50% recycle value',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 20,
      icon: '♻️',
      unlocked: true,
      tags: ['economic'],
      recycleBonus: 0.5
    },

    // ==================== TIER 3 (RARE) ====================
    // Strong effects and build-defining mechanics
    {
      id: 'damage_t3',
      name: 'Champion\'s Crown',
      description: '+35% damage',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '👑',
      unlocked: true,
      tags: ['melee', 'ranged'],
      damageMultiplier: 1.35
    },
    {
      id: 'attack_speed_t3',
      name: 'Lightning Bracers',
      description: '+35% fire rate',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '⚡',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.35
    },
    {
      id: 'piercing_t3',
      name: 'Penetrating Shot',
      description: 'Pierce +2 enemies',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged'],
      piercing: 2
    },
    {
      id: 'multishot_t3',
      name: 'Trident',
      description: '+2 projectiles',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 65,
      icon: '🔱',
      unlocked: true,
      tags: ['ranged'],
      multishot: 2
    },
    {
      id: 'homing_t3',
      name: 'Seeking Rune',
      description: 'Homing projectiles',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 70,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged', 'elemental'],
      homing: true
    },
    {
      id: 'explosive_t3',
      name: 'Demolition Kit',
      description: 'Explosions on hit',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 75,
      icon: '💣',
      unlocked: true,
      tags: ['ranged', 'elemental'],
      explosionOnHit: true
    },
    {
      id: 'chain_lightning_t3',
      name: 'Storm Essence',
      description: '25% chain to nearby',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '⚡',
      unlocked: true,
      tags: ['elemental', 'ranged'],
      chainLightning: 0.25
    },
    {
      id: 'poison_t3',
      name: 'Toxic Vial',
      description: 'Poison (7 dmg/s, 3s)',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 62,
      icon: '☠️',
      unlocked: true,
      tags: ['elemental'],
      poison: true
    },
    {
      id: 'freeze_t3',
      name: 'Frost Orb',
      description: '15% freeze chance',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '❄️',
      unlocked: true,
      tags: ['elemental'],
      freeze: 0.15
    },
    {
      id: 'shield_t3',
      name: 'Energy Barrier',
      description: '75 HP shield (regen)',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 72,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      shield: true
    },
    {
      id: 'lifesteal_t3',
      name: 'Blood Chalice',
      description: '12% lifesteal',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 70,
      icon: '🍷',
      unlocked: true,
      tags: ['melee'],
      lifesteal: 0.12
    },
    {
      id: 'dodge_t3',
      name: 'Shadow Step',
      description: '20% dodge chance',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 65,
      icon: '👻',
      unlocked: true,
      tags: ['defensive', 'utility'],
      dodge: 0.2
    },
    {
      id: 'crit_chance_t3',
      name: 'Assassin\'s Mark',
      description: '+20% crit chance',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '🗡️',
      unlocked: true,
      tags: ['melee', 'ranged'],
      critChance: 0.2
    },
    {
      id: 'knockback_t3',
      name: 'Impact Gauntlet',
      description: 'Heavy knockback',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '👊',
      unlocked: true,
      tags: ['melee'],
      knockback: 250
    },

    // ==================== TIER 4 (LEGENDARY) ====================
    // Game-changing unique effects
    {
      id: 'berserker_rage_t4',
      name: 'Berserker Rage',
      description: '+60% damage',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 140,
      icon: '⚔️',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.6
    },
    {
      id: 'rapid_fire_t4',
      name: 'Gatling Core',
      description: '+60% fire rate',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 135,
      icon: '🔫',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.6
    },
    {
      id: 'glass_cannon_t4',
      name: 'Glass Cannon',
      description: '+100% dmg, -40% HP',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 150,
      icon: '💀',
      unlocked: true,
      tags: ['melee', 'ranged'],
      damageMultiplier: 2.0,
      maxHealthBonus: -40
    },
    {
      id: 'time_slow_t4',
      name: 'Chrono Crystal',
      description: 'Slow time on crit',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 145,
      icon: '⏱️',
      unlocked: true,
      tags: ['elemental', 'utility'],
      critChance: 0.15,
      freeze: 0.3 // 30% chance to slow
    },
    {
      id: 'clone_projectiles_t4',
      name: 'Mirror Shard',
      description: 'Clone projectiles',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 155,
      icon: '🪞',
      unlocked: true,
      tags: ['ranged'],
      multishot: 3
    },
    {
      id: 'chain_lightning_t4',
      name: 'Arc Reactor',
      description: 'Chain to all nearby',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 148,
      icon: '⚡',
      unlocked: true,
      tags: ['elemental', 'ranged'],
      chainLightning: 0.5,
      explosionOnHit: true
    },
    {
      id: 'immortal_t4',
      name: 'Phoenix Feather',
      description: '+100 HP, +10 HP/s',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 142,
      icon: '🔥',
      unlocked: true,
      tags: ['defensive'],
      maxHealthBonus: 100,
      healthRegen: 10
    },
    {
      id: 'mega_knockback_t4',
      name: 'Titan Fist',
      description: 'Massive knockback',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 138,
      icon: '🦾',
      unlocked: true,
      tags: ['melee'],
      knockback: 500,
      damageMultiplier: 1.3
    },
    {
      id: 'infinite_piercing_t4',
      name: 'Void Lance',
      description: 'Pierce all enemies',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 160,
      icon: '🌌',
      unlocked: true,
      tags: ['ranged'],
      piercing: 999
    },
    {
      id: 'gold_rush_t4',
      name: 'Midas Touch',
      description: '+100% gold, -15% shop',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 125,
      icon: '✨',
      unlocked: true,
      tags: ['economic'],
      goldBonus: 2.0,
      shopDiscount: 0.15
    },

    // ==================== WEAPON ITEMS (BROTATO-INSPIRED) ====================
    // These items change your attack pattern entirely
    {
      id: 'shotgun_weapon_t2',
      name: 'Scatter Gun',
      description: 'Fires wide spread (5 pellets)',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 35,
      icon: '🔫',
      unlocked: true,
      tags: ['ranged'],
      weaponType: 'shotgun',
      multishot: 4, // 1 main + 4 extra = 5 total
      damageMultiplier: 0.8, // Lower damage per pellet
      fireRateMultiplier: 0.7 // Slower fire rate
    },
    {
      id: 'melee_sword_t2',
      name: 'Crescent Blade',
      description: 'Melee arc around player',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🗡️',
      unlocked: true,
      tags: ['melee'],
      weaponType: 'melee',
      weaponRange: 80,
      weaponArc: Math.PI * 0.6, // 108 degrees
      damageMultiplier: 1.5,
      fireRateMultiplier: 1.3
    },
    {
      id: 'orbital_weapon_t3',
      name: 'Satellite Orbs',
      description: 'Orbs orbit around you',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 65,
      icon: '⭕',
      unlocked: true,
      tags: ['utility', 'ranged'],
      weaponType: 'orbital',
      multishot: 2, // 3 orbs total
      damageMultiplier: 0.9
    },
    {
      id: 'laser_weapon_t3',
      name: 'Beam Rifle',
      description: 'Continuous laser beam',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 70,
      icon: '⚡',
      unlocked: true,
      tags: ['ranged', 'elemental'],
      weaponType: 'laser',
      piercing: 999, // Laser pierces everything
      damageMultiplier: 0.6, // Lower base damage
      fireRateMultiplier: 3.0, // Much faster ticks
      projectileSpeed: 1200 // Very fast
    },
    {
      id: 'hammer_weapon_t3',
      name: 'Thunder Hammer',
      description: 'Heavy melee strikes',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 62,
      icon: '🔨',
      unlocked: true,
      tags: ['melee'],
      weaponType: 'melee',
      weaponRange: 100,
      weaponArc: Math.PI * 0.8, // 144 degrees
      damageMultiplier: 2.2,
      fireRateMultiplier: 0.5, // Very slow but hard-hitting
      knockback: 300
    },

    // ==================== NEW ITEMS (BINDING OF ISAAC INSPIRED) ====================
    // Focus on synergies and build diversity
    {
      id: 'glass_cannon_t2',
      name: 'Glass Cannon',
      description: '+80% dmg, -30 max HP',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '💥',
      unlocked: true,
      tags: ['ranged', 'utility'],
      damageMultiplier: 1.8,
      maxHealthBonus: -30
    },
    {
      id: 'berserker_rage_t2',
      name: 'Berserker Rage',
      description: '+30% dmg, +20% speed',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '😡',
      unlocked: true,
      tags: ['melee', 'utility'],
      damageMultiplier: 1.3,
      speedMultiplier: 1.2
    },
    {
      id: 'lucky_coin_t1',
      name: 'Lucky Coin',
      description: '+10% crit chance',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 10,
      icon: '🪙',
      unlocked: true,
      tags: ['utility'],
      critChance: 0.1
    },
    {
      id: 'explosive_rounds_t2',
      name: 'Explosive Rounds',
      description: 'Bullets explode on hit',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 35,
      icon: '💣',
      unlocked: true,
      tags: ['ranged', 'elemental'],
      explosionOnHit: true,
      damageMultiplier: 0.9 // Slightly lower base damage
    },
    {
      id: 'toxic_touch_t2',
      name: 'Toxic Touch',
      description: 'Poison enemies on hit',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '☣️',
      unlocked: true,
      tags: ['elemental'],
      poison: true
    },
    {
      id: 'frozen_heart_t3',
      name: 'Frozen Heart',
      description: '40% freeze chance',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '❄️',
      unlocked: true,
      tags: ['elemental', 'defensive'],
      freeze: 0.4,
      armor: 3
    },
    {
      id: 'vampiric_embrace_t3',
      name: 'Vampiric Embrace',
      description: '25% lifesteal',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '🩸',
      unlocked: true,
      tags: ['utility'],
      lifesteal: 0.25
    },
    {
      id: 'chain_reaction_t3',
      name: 'Chain Reaction',
      description: '50% chain lightning',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 62,
      icon: '⚡',
      unlocked: true,
      tags: ['elemental', 'ranged'],
      chainLightning: 0.5
    },
    {
      id: 'triple_shot_t2',
      name: 'Triple Shot',
      description: '+2 projectiles',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 38,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged'],
      multishot: 2
    },
    {
      id: 'rapid_fire_t2',
      name: 'Rapid Fire',
      description: '+40% fire rate',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 33,
      icon: '🔥',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.4
    },
    {
      id: 'armor_plating_t2',
      name: 'Armor Plating',
      description: '+8 armor',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      armor: 8
    },
    {
      id: 'regeneration_t2',
      name: 'Regeneration',
      description: '+3 HP/s',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '💚',
      unlocked: true,
      tags: ['defensive'],
      healthRegen: 3
    },
    {
      id: 'dodge_master_t3',
      name: 'Dodge Master',
      description: '20% dodge chance',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 50,
      icon: '👻',
      unlocked: true,
      tags: ['defensive', 'utility'],
      dodge: 0.2
    },
    {
      id: 'homing_bullets_t3',
      name: 'Homing Bullets',
      description: 'Bullets track enemies',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged', 'utility'],
      homing: true
    },
    {
      id: 'speed_demon_t2',
      name: 'Speed Demon',
      description: '+35% move speed',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 25,
      icon: '💨',
      unlocked: true,
      tags: ['utility'],
      speedMultiplier: 1.35
    },
    {
      id: 'thorny_armor_t3',
      name: 'Thorny Armor',
      description: '40% reflect damage',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 52,
      icon: '🌹',
      unlocked: true,
      tags: ['defensive'],
      thorns: 0.4,
      armor: 5
    },
    {
      id: 'crit_master_t3',
      name: 'Crit Master',
      description: '2.5x crit multiplier',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '💢',
      unlocked: true,
      tags: ['utility'],
      critDamageMultiplier: 2.5
    },
    {
      id: 'bargain_hunter_t1',
      name: 'Bargain Hunter',
      description: '-10% shop prices',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 12,
      icon: '💰',
      unlocked: true,
      tags: ['economic'],
      shopDiscount: 0.1
    },
    {
      id: 'recycler_t2',
      name: 'Recycler',
      description: '+50% recycle value',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 20,
      icon: '♻️',
      unlocked: true,
      tags: ['economic'],
      recycleBonus: 0.5
    },
    {
      id: 'soul_collector_t3',
      name: 'Soul Collector',
      description: '+50% pickup range',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 45,
      icon: '👻',
      unlocked: true,
      tags: ['utility'],
      xpMagnet: 1.5
    },

    // ==================== NEW ITEMS (20+ additions for build variety) ====================

    // Damage scaling items
    {
      id: 'crit_synergy_t3',
      name: 'Critical Synergy',
      description: '+15% crit, +50% crit dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 70,
      icon: '💥',
      unlocked: true,
      tags: ['melee', 'ranged'],
      critChance: 0.15,
      critDamageMultiplier: 1.5
    },
    {
      id: 'glass_blade_t2',
      name: 'Glass Blade',
      description: '+50% dmg, -20 HP',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🔪',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.5,
      maxHealthBonus: -20
    },
    {
      id: 'heavy_strike_t2',
      name: 'Heavy Strike',
      description: '+30% dmg, -15% speed',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '⚒️',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.3,
      speedMultiplier: 0.85
    },
    {
      id: 'swift_blade_t2',
      name: 'Swift Blade',
      description: '+30% speed, +15% fire rate',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '⚡',
      unlocked: true,
      tags: ['melee', 'utility'],
      speedMultiplier: 1.3,
      fireRateMultiplier: 1.15
    },

    // Elemental combos
    {
      id: 'frostfire_t3',
      name: 'Frostfire',
      description: 'Poison + Freeze combo',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 65,
      icon: '🔥❄️',
      unlocked: true,
      tags: ['elemental'],
      poison: true,
      freeze: 0.2
    },
    {
      id: 'storm_essence_t3',
      name: 'Storm Essence',
      description: '35% chain + explosions',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 72,
      icon: '⛈️',
      unlocked: true,
      tags: ['elemental', 'ranged'],
      chainLightning: 0.35,
      explosionOnHit: true
    },
    {
      id: 'toxic_explosion_t3',
      name: 'Toxic Explosion',
      description: 'Explosions poison nearby',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '💀',
      unlocked: true,
      tags: ['elemental', 'ranged'],
      explosionOnHit: true,
      poison: true
    },

    // Defensive combos
    {
      id: 'guardian_aura_t3',
      name: 'Guardian Aura',
      description: '+12 armor, +50 HP',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 75,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      armor: 12,
      maxHealthBonus: 50
    },
    {
      id: 'vampire_armor_t3',
      name: 'Vampire Armor',
      description: '15% lifesteal, +8 armor',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 70,
      icon: '🦇',
      unlocked: true,
      tags: ['defensive', 'utility'],
      lifesteal: 0.15,
      armor: 8
    },
    {
      id: 'regenerative_shield_t3',
      name: 'Regenerative Shield',
      description: 'Shield + 5 HP/s regen',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 78,
      icon: '💚',
      unlocked: true,
      tags: ['defensive'],
      shield: true,
      healthRegen: 5
    },
    {
      id: 'evasive_armor_t3',
      name: 'Evasive Armor',
      description: '15% dodge, +25% speed',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 62,
      icon: '👤',
      unlocked: true,
      tags: ['defensive', 'utility'],
      dodge: 0.15,
      speedMultiplier: 1.25
    },

    // Projectile modifiers
    {
      id: 'scattershot_t2',
      name: 'Scattershot',
      description: '+3 projectiles, -10% dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 38,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged'],
      multishot: 3,
      damageMultiplier: 0.9
    },
    {
      id: 'piercing_rounds_t2',
      name: 'Piercing Rounds',
      description: 'Pierce +3 enemies',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 35,
      icon: '🏹',
      unlocked: true,
      tags: ['ranged'],
      piercing: 3
    },
    {
      id: 'seeking_shots_t2',
      name: 'Seeking Shots',
      description: 'Homing + faster bullets',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 42,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged', 'utility'],
      homing: true,
      projectileSpeed: 1.3
    },
    {
      id: 'explosive_pierce_t3',
      name: 'Explosive Pierce',
      description: 'Pierce +2, explosions',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '💥',
      unlocked: true,
      tags: ['ranged', 'elemental'],
      piercing: 2,
      explosionOnHit: true
    },

    // Economic/utility
    {
      id: 'lucky_charm_t2',
      name: 'Lucky Charm',
      description: '+30% gold, +10% crit',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🍀',
      unlocked: true,
      tags: ['economic', 'utility'],
      goldBonus: 1.3,
      critChance: 0.1
    },
    {
      id: 'merchants_ring_t3',
      name: 'Merchant\'s Ring',
      description: '+50% gold, -20% prices',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '💍',
      unlocked: true,
      tags: ['economic'],
      goldBonus: 1.5,
      shopDiscount: 0.2
    },
    {
      id: 'experience_gem_t2',
      name: 'Experience Gem',
      description: '+60% pickup range',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '💎',
      unlocked: true,
      tags: ['utility'],
      xpMagnet: 1.6
    },

    // Legendary unique effects
    {
      id: 'necromantic_power_t4',
      name: 'Necromantic Power',
      description: 'Kills spawn skeleton ally',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 160,
      icon: '💀',
      unlocked: true,
      tags: ['utility', 'elemental'],
      damageMultiplier: 1.2,
      lifesteal: 0.1
    },
    {
      id: 'berserker_soul_t4',
      name: 'Berserker Soul',
      description: 'Lower HP = more damage',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 145,
      icon: '😈',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.4,
      speedMultiplier: 1.3
    },
    {
      id: 'elemental_mastery_t4',
      name: 'Elemental Mastery',
      description: 'All elemental effects',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 175,
      icon: '🌟',
      unlocked: true,
      tags: ['elemental'],
      poison: true,
      freeze: 0.25,
      chainLightning: 0.3,
      explosionOnHit: true
    },
    {
      id: 'divine_protection_t4',
      name: 'Divine Protection',
      description: 'Shield + 30% dodge',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 152,
      icon: '✨',
      unlocked: true,
      tags: ['defensive'],
      shield: true,
      dodge: 0.3,
      armor: 10
    },
    {
      id: 'infinity_core_t4',
      name: 'Infinity Core',
      description: 'Pierce all + multishot 5',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 180,
      icon: '♾️',
      unlocked: true,
      tags: ['ranged'],
      piercing: 999,
      multishot: 5,
      homing: true
    },

    // ==================== TRADE-OFF ITEMS (BROTATO-STYLE) ====================
    // Every one gives a strong bonus with a REAL drawback, forcing you to
    // commit to a lane / manage risk. This is where build identity comes from:
    // a glass-cannon player keeps these, a tank recycles them.
    {
      id: 'reckless_charm_t2',
      name: 'Reckless Charm',
      description: '+40% dmg, -3 armor',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 26,
      icon: '🔥',
      unlocked: true,
      tags: ['melee', 'ranged'],
      damageMultiplier: 1.4,
      armor: -3
    },
    {
      id: 'hair_trigger_t2',
      name: 'Hair Trigger',
      description: '+30% fire rate, -12% dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '⏱️',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.3,
      damageMultiplier: 0.88
    },
    {
      id: 'heavy_slugs_t2',
      name: 'Heavy Slugs',
      description: '+30% dmg, -15% fire rate',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '🎱',
      unlocked: true,
      tags: ['melee', 'ranged'],
      damageMultiplier: 1.3,
      fireRateMultiplier: 0.85
    },
    {
      id: 'adrenaline_t2',
      name: 'Adrenaline',
      description: '+35% speed, -15 max HP',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 24,
      icon: '💉',
      unlocked: true,
      tags: ['utility'],
      speedMultiplier: 1.35,
      maxHealthBonus: -15
    },
    {
      id: 'sharpshooter_t3',
      name: 'Sharpshooter Lens',
      description: '+18% crit, -2 armor',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 52,
      icon: '🔭',
      unlocked: true,
      tags: ['ranged'],
      critChance: 0.18,
      armor: -2
    },
    {
      id: 'gamblers_dice_t3',
      name: "Gambler's Dice",
      description: '+18% dodge, -20 max HP',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 48,
      icon: '🎲',
      unlocked: true,
      tags: ['defensive', 'utility'],
      dodge: 0.18,
      maxHealthBonus: -20
    },
    {
      id: 'siphon_rounds_t3',
      name: 'Siphon Rounds',
      description: '+15% lifesteal, +20% ranged dmg, -15% fire rate',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '🧛',
      unlocked: true,
      tags: ['ranged'],
      lifesteal: 0.15,
      rangedDamageMult: 1.2,
      fireRateMultiplier: 0.85
    },
    {
      id: 'iron_turtle_t3',
      name: 'Iron Turtle',
      description: '+10 armor, -20% speed',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 50,
      icon: '🐢',
      unlocked: true,
      tags: ['defensive'],
      armor: 10,
      speedMultiplier: 0.8
    },
    {
      id: 'blood_pact_t3',
      name: 'Blood Pact',
      description: '+50% dmg, -25% max HP',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '🩸',
      unlocked: true,
      tags: ['melee', 'ranged'],
      damageMultiplier: 1.5,
      maxHealthBonus: -35
    },
    {
      id: 'featherweight_t2',
      name: 'Featherweight',
      description: '+25% speed & fire rate, -15% dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🪶',
      unlocked: true,
      tags: ['utility', 'ranged'],
      speedMultiplier: 1.25,
      fireRateMultiplier: 1.25,
      damageMultiplier: 0.85
    },

    // ============ DAMAGE-TYPE SPECIALISATION ITEMS (melee / ranged / elemental) ============
    // These carry PER-TYPE multipliers so a build can commit to one damage lane. The
    // downside usually hits the OTHER lanes or mobility, so the same item is great for a
    // specialist and a trap for a generalist — that's what makes archetypes mechanically
    // real instead of cosmetic tags.
    // --- Ranged lane ---
    {
      id: 'marksman_scope_t1',
      name: 'Marksman Scope',
      description: '+20% ranged dmg, -8% fire rate',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 15,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged'],
      rangedDamageMult: 1.20,
      fireRateMultiplier: 0.92
    },
    {
      id: 'snipers_focus_t2',
      name: "Sniper's Focus",
      description: '+40% ranged dmg, -25% move speed',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🔭',
      unlocked: true,
      tags: ['ranged'],
      rangedDamageMult: 1.40,
      speedMultiplier: 0.75
    },
    // --- Melee lane ---
    {
      id: 'warhammer_grip_t1',
      name: 'Warhammer Grip',
      description: '+22% melee dmg, -10% move speed',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 15,
      icon: '🔨',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.22,
      speedMultiplier: 0.90
    },
    {
      id: 'brawlers_rage_t2',
      name: "Brawler's Rage",
      description: '+45% melee dmg, -12% ranged dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '👊',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.45,
      rangedDamageMult: 0.88
    },
    // --- Elemental lane (scales chain lightning + explosion on-hit) ---
    {
      id: 'storm_conduit_t2',
      name: 'Storm Conduit',
      description: '+35% elemental dmg, -12% dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 28,
      icon: '⚡',
      unlocked: true,
      tags: ['elemental'],
      elementalDamageMult: 1.35,
      damageMultiplier: 0.88
    },
    {
      id: 'overcharged_core_t3',
      name: 'Overcharged Core',
      description: '+55% elemental dmg, +12% fire rate, -3 armor',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 54,
      icon: '🔮',
      unlocked: true,
      tags: ['elemental'],
      elementalDamageMult: 1.55,
      fireRateMultiplier: 1.12,
      armor: -3
    },
    {
      id: 'prism_lens_t4',
      name: 'Prism Lens',
      description: '+90% elemental dmg — chain & blast melt crowds',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 92,
      icon: '💠',
      unlocked: true,
      tags: ['elemental'],
      elementalDamageMult: 1.90
    },

    // ==================== BANKING ITEMS (interest economy) ====================
    // Reward the save-vs-spend playstyle: bank gold, earn interest, buy big later.
    {
      id: 'piggy_bank_t2',
      name: 'Piggy Bank',
      description: '+8% interest on gold',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 22,
      icon: '🐷',
      unlocked: true,
      tags: ['economic'],
      interestBonus: 0.08
    },
    {
      id: 'golden_vault_t3',
      name: 'Golden Vault',
      description: '+18% interest, +25% gold',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '🏦',
      unlocked: true,
      tags: ['economic'],
      interestBonus: 0.18,
      goldBonus: 1.25
    },

    // ==================== LUCK ITEMS (rarity / high-roll economy) ====================
    // Luck raises the odds the shop offers higher-tier items and that enemies drop
    // health orbs. Enables a "high-roller" build: trade raw power for a legendary-stuffed
    // shop. The T3/T4 luck items carry a real damage cost so pure luck stacking is a gamble.
    {
      id: 'rabbits_foot_t1',
      name: "Rabbit's Foot",
      description: '+15% luck (better shop rarity & orb drops)',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 14,
      icon: '🐇',
      unlocked: true,
      tags: ['economic', 'utility'],
      luck: 0.15
    },
    {
      id: 'four_leaf_clover_t3',
      name: 'Four-Leaf Clover',
      description: '+40% luck, -10% dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 48,
      icon: '🍀',
      unlocked: true,
      tags: ['economic', 'utility'],
      luck: 0.40,
      damageMultiplier: 0.90
    },
    {
      id: 'cosmic_dice_t4',
      name: 'Cosmic Dice',
      description: '+80% luck — the shop turns legendary',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 95,
      icon: '🎲',
      unlocked: true,
      tags: ['economic', 'utility'],
      luck: 0.80
    },

    // ============ UNIQUE IMPACTFUL ITEMS (build-defining, 2026-07-02) ============
    // Felix asked for "more unique items that feel impactful". These grant already-wired
    // combat MECHANICS (explosion, poison, homing, freeze+chain, lifesteal, shield, thorns,
    // multishot, pierce) rather than flat stat sticks, so each visibly changes how a run
    // plays and anchors a distinct build. Every flag effect is paired with a positive
    // stackable stat so a second copy is never dead gold (see itemStacks()).
    {
      id: 'volatile_rounds_t2',
      name: 'Volatile Rounds',
      description: 'Attacks explode on hit, +20% elemental dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 40,
      icon: '💥',
      unlocked: true,
      tags: ['elemental', 'ranged'],
      explosionOnHit: true,
      elementalDamageMult: 1.2
    },
    {
      id: 'venom_coating_t2',
      name: 'Venom Coating',
      description: 'Attacks poison enemies, +15% elemental dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 38,
      icon: '🧪',
      unlocked: true,
      tags: ['elemental'],
      poison: true,
      elementalDamageMult: 1.15
    },
    {
      id: 'seeker_rounds_t3',
      name: 'Seeker Rounds',
      description: 'Bullets curve into enemies, +25% ranged dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 80,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged', 'utility'],
      homing: true,
      rangedDamageMult: 1.25
    },
    {
      id: 'cryo_capacitor_t3',
      name: 'Cryo Capacitor',
      description: '40% freeze + arcs to nearby, +20% elemental dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 88,
      icon: '❄️',
      unlocked: true,
      tags: ['elemental'],
      freeze: 0.4,
      chainLightning: 0.25,
      elementalDamageMult: 1.2
    },
    {
      id: 'leech_blade_t3',
      name: 'Leech Blade',
      description: 'Heal 18% of melee dmg, +30% melee, -15 HP',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 84,
      icon: '🩸',
      unlocked: true,
      tags: ['melee'],
      lifesteal: 0.18,
      meleeDamageMult: 1.3,
      maxHealthBonus: -15
    },
    {
      id: 'bullet_hurricane_t4',
      name: 'Bullet Hurricane',
      description: '+2 homing, piercing shots, -15% ranged dmg',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 160,
      icon: '🌀',
      unlocked: true,
      tags: ['ranged'],
      multishot: 2,
      homing: true,
      piercing: 3,
      rangedDamageMult: 0.85
    },
    {
      id: 'supernova_core_t4',
      name: 'Supernova Core',
      description: 'Shots explode + arc to all nearby, +40% elemental, -25 HP',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 168,
      icon: '🌟',
      unlocked: true,
      tags: ['elemental', 'ranged'],
      explosionOnHit: true,
      chainLightning: 0.4,
      elementalDamageMult: 1.4,
      maxHealthBonus: -25
    },
    {
      id: 'bloodmoon_pact_t4',
      name: 'Bloodmoon Pact',
      description: 'Heal 30% of melee dmg, +50% melee, reflect 40%, -30 HP',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 162,
      icon: '🌑',
      unlocked: true,
      tags: ['melee', 'defensive'],
      lifesteal: 0.3,
      meleeDamageMult: 1.5,
      thorns: 0.4,
      maxHealthBonus: -30
    },
    {
      id: 'aegis_protocol_t4',
      name: 'Aegis Protocol',
      description: 'Recharging shield, reflect 50%, +6 armor & regen, -20% dmg',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 150,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      shield: true,
      thorns: 0.5,
      armor: 6,
      healthRegen: 6,
      damageMultiplier: 0.8
    },

    // ==================== AUXILIARY STACKING WEAPONS (2026-07-02) ====================
    // A SECOND source of damage that runs alongside whatever primary weapon you carry
    // — the whole point is they STACK (a gun build can also spin blades, orbit orbs,
    // drop bombs, pulse novas). Each anchors a distinct new build axis.
    {
      id: 'orbit_orb_t2',
      name: 'Guardian Orb',
      description: 'An energy orb circles you, shredding anything it touches',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '🔵',
      unlocked: true,
      tags: ['utility', 'elemental'],
      orbitOrbs: 1
    },
    {
      id: 'orbit_orb_swarm_t3',
      name: 'Orbital Swarm',
      description: '+2 orbiting orbs and they hit harder',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 78,
      icon: '🌐',
      unlocked: true,
      tags: ['utility', 'elemental'],
      orbitOrbs: 2,
      orbitDamageMult: 1.4
    },
    {
      id: 'whirl_blades_t2',
      name: 'Whirling Blades',
      description: 'A blade arc sweeps you constantly — your gun keeps firing too',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 36,
      icon: '🌪️',
      unlocked: true,
      tags: ['melee'],
      auxMelee: true
    },
    {
      id: 'blade_storm_t4',
      name: 'Blade Storm',
      description: 'A faster, deadlier whirl of blades around you',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 150,
      icon: '⚔️',
      unlocked: true,
      tags: ['melee'],
      auxMelee: true,
      auxMeleeDamageMult: 1.8
    },
    {
      id: 'bomb_bandolier_t2',
      name: 'Bomb Bandolier',
      description: 'Drop a bomb at your feet every few seconds — big AoE blast',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 40,
      icon: '💣',
      unlocked: true,
      tags: ['elemental', 'utility'],
      bombDrop: true
    },
    {
      id: 'cluster_charges_t4',
      name: 'Cluster Charges',
      description: 'Bombs drop twice as fast and hit far harder',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 158,
      icon: '🧨',
      unlocked: true,
      tags: ['elemental'],
      bombDrop: true,
      bombCooldownMult: 0.5,
      bombDamageMult: 1.6
    },
    {
      id: 'nova_core_t3',
      name: 'Nova Core',
      description: 'A shockwave ripples out from you on a timer',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 72,
      icon: '💠',
      unlocked: true,
      tags: ['elemental', 'utility'],
      novaPulse: true
    },
    {
      id: 'pulsar_t4',
      name: 'Pulsar',
      description: 'Novas fire relentlessly and hit like a truck',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 160,
      icon: '✴️',
      unlocked: true,
      tags: ['elemental'],
      novaPulse: true,
      novaCooldownMult: 0.5,
      novaDamageMult: 1.7
    }
  ];

  // Weapon tiers for combining system (FUTURE FEATURE - not implemented yet)
  // private static weapons: Weapon[] = [
  //   { id: 'sword_bronze', name: 'Bronze Sword', baseName: 'Sword', tier: ItemTier.Common, damage: 10, icon: '🗡️', cost: 15, unlocked: true },
  //   { id: 'sword_silver', name: 'Silver Sword', baseName: 'Sword', tier: ItemTier.Uncommon, damage: 20, icon: '⚔️', cost: 40, unlocked: false },
  //   { id: 'sword_gold', name: 'Gold Sword', baseName: 'Sword', tier: ItemTier.Rare, damage: 35, icon: '🗡️', cost: 80, unlocked: false },
  //   { id: 'sword_diamond', name: 'Diamond Sword', baseName: 'Sword', tier: ItemTier.Legendary, damage: 60, icon: '💎', cost: 150, unlocked: false },
  // ];

  static getAllItems(): Item[] {
    return [...this.items];
  }

  static getUnlockedItems(): Item[] {
    return this.items.filter(item => item.unlocked);
  }

  static getItemById(id: string): Item | undefined {
    return this.items.find(item => item.id === id);
  }

  // Whether a SECOND copy of this item does anything. Items whose only effects are
  // boolean/weapon flags don't stack — hasShield/hasHoming/hasPoison/hasExplosionOnHit
  // aggregate with .some() and getWeaponType() picks the first weapon with .find(), so a
  // duplicate is pure wasted gold. Anything with an additive or multiplicative stat DOES
  // stack (that stat accumulates), so it stays rebuyable. Used to hide owned non-stacking
  // items from the shop.
  private static readonly MULT_KEYS: (keyof Item)[] = [
    'damageMultiplier', 'meleeDamageMult', 'rangedDamageMult', 'elementalDamageMult',
    'fireRateMultiplier', 'critDamageMultiplier', 'speedMultiplier', 'goldBonus'
  ];
  private static readonly ADD_KEYS: (keyof Item)[] = [
    'critChance', 'maxHealthBonus', 'healthRegen', 'armor', 'lifesteal', 'thorns',
    'multishot', 'piercing', 'projectileSpeed', 'knockback', 'dodge', 'chainLightning',
    'freeze', 'rerollDiscount', 'shopDiscount', 'recycleBonus', 'interestBonus', 'luck', 'xpMagnet',
    'orbitOrbs'
  ];

  static itemStacks(item: Item): boolean {
    for (const k of this.MULT_KEYS) {
      const v = item[k] as number | undefined;
      if (typeof v === 'number' && v !== 1) return true; // multiplier ≠ neutral 1
    }
    for (const k of this.ADD_KEYS) {
      const v = item[k] as number | undefined;
      if (typeof v === 'number' && v !== 0) return true; // additive ≠ neutral 0
    }
    return false; // only boolean/weapon flags left → a duplicate is wasted
  }

  // BROTATO-INSPIRED WEIGHTED SHOP SYSTEM
  // Promotes synergistic builds by weighting shop offerings based on owned items
  static getWeightedShopItems(count: number, wave: number, playerItems: Item[], luck: number = 0): Item[] {
    const result: Item[] = [];

    // Owned items that gain NOTHING from a duplicate — never offer these again.
    const nonStackOwned = new Set(
      playerItems.filter(i => !this.itemStacks(i)).map(i => i.id)
    );

    // Get tier-appropriate items for this wave (owned non-stacking items filtered out)
    const getWaveAppropriteItems = (): Item[] => {
      return this.getUnlockedItems().filter(item => {
        if (nonStackOwned.has(item.id)) return false; // already own it and a dupe is useless
        if (wave <= 2) return item.tier === ItemTier.Common;
        if (wave <= 5) return item.tier <= ItemTier.Uncommon;
        if (wave <= 10) return item.tier <= ItemTier.Rare;
        return true; // All tiers available
      });
    };

    // Extract owned item IDs and tags
    const ownedItemIds = playerItems.map(i => i.id);
    const ownedTags = [...new Set(playerItems.flatMap(i => i.tags))];

    // Duo surfacing: owning one half of a duo gives a 25% chance that the
    // first slot offers the missing partner — threshold moments need to be
    // discoverable, not stumbled into
    const duoTargets: Item[] = [];
    for (const duo of DUO_COMBOS) {
      const hasFirst = ownedItemIds.includes(duo.item1Id);
      const hasSecond = ownedItemIds.includes(duo.item2Id);
      if (hasFirst !== hasSecond) {
        const missing = this.getItemById(hasFirst ? duo.item2Id : duo.item1Id);
        if (missing) duoTargets.push(missing);
      }
    }

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let selectedItem: Item | null = null;

      if (i === 0 && duoTargets.length > 0 && Math.random() < 0.25) {
        const candidate = duoTargets[Math.floor(Math.random() * duoTargets.length)];
        if (!result.some(r => r.id === candidate.id)) {
          selectedItem = candidate;
        }
      }

      if (!selectedItem && roll < 0.20 && ownedItemIds.length > 0) {
        // 20% - EXACT same item you own (stacking/duplicates)
        const randomOwnedItem = playerItems[Math.floor(Math.random() * playerItems.length)];
        const candidates = getWaveAppropriteItems().filter(item => item.id === randomOwnedItem.id);
        if (candidates.length > 0) {
          selectedItem = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }

      if (!selectedItem && roll < 0.35 && ownedTags.length > 0) {
        // 15% - SAME TAG as items you own (synergy promotion)
        const randomTag = ownedTags[Math.floor(Math.random() * ownedTags.length)];
        const candidates = getWaveAppropriteItems().filter(item =>
          item.tags.includes(randomTag) && !result.some(r => r.id === item.id)
        );
        if (candidates.length > 0) {
          selectedItem = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }

      // 65% - General pool, rarity-weighted so legendaries stay special
      // (uniform pick made T4 items as frequent as commons at wave 11+)
      if (!selectedItem) {
        const candidates = getWaveAppropriteItems().filter(item =>
          !result.some(r => r.id === item.id)
        );
        if (candidates.length > 0) {
          // Luck tilts the roll toward the top tiers: Rare/Legendary weights scale with
          // (1 + luck), so a high-roll build sees far more epics/legendaries per shop.
          const luckMult = 1 + Math.max(0, luck);
          const weightOf = (item: Item): number =>
            item.tier === ItemTier.Common ? 100 :
            item.tier === ItemTier.Uncommon ? 60 :
            item.tier === ItemTier.Rare ? 30 * luckMult : 10 * luckMult;
          let total = 0;
          for (const c of candidates) total += weightOf(c);
          let pick = Math.random() * total;
          for (const c of candidates) {
            pick -= weightOf(c);
            if (pick <= 0) { selectedItem = c; break; }
          }
          selectedItem = selectedItem ?? candidates[candidates.length - 1];
        }
      }

      if (selectedItem) {
        result.push(selectedItem);
      }
    }

    return result;
  }

  // Legacy method - redirects to weighted shop
  static getRandomItems(count: number, wave: number = 1): Item[] {
    // No player items = pure random (used for initial state)
    return this.getWeightedShopItems(count, wave, []);
  }

  static getItemsByRarity(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Item[] {
    return this.items.filter(item => item.rarity === rarity && item.unlocked);
  }

  static getItemsByTier(tier: ItemTier): Item[] {
    return this.items.filter(item => item.tier === tier && item.unlocked);
  }

  static unlockItem(id: string): void {
    const item = this.items.find(item => item.id === id);
    if (item) {
      item.unlocked = true;
    }
  }

  // Get all items with a specific tag
  static getItemsByTag(tag: ItemTag): Item[] {
    return this.items.filter(item => item.tags.includes(tag) && item.unlocked);
  }
}

// Player stats calculated from items with affinity system
export class PlayerStats {
  items: Item[] = [];
  affinityTags: ItemTag[] = []; // Character affinity (2 random tags at start)
  transformations: TransformationTracker = new TransformationTracker(); // TRANSFORMATION SYSTEM
  duos: DuoTracker = new DuoTracker(); // DUO COMBO SYSTEM

  // Base stats - BUFFED for better early game (Wave 1 too hard fix)
  baseDamage: number = 25; // Wave 1 balance: kill slimes quickly
  baseFireRate: number = 3.0; // Faster shooting for better feel (shots per second)
  baseSpeed: number = 240; // snappier start (was 200 — early game felt sluggish)
  // Hard ceiling on effective move speed. Stacked speed items/duos/transformations
  // used to compound unbounded and let a broken build zoom uncontrollably across a
  // phone screen. 2x base stays fast for a real speed build but keeps it playable.
  maxSpeed: number = 480;
  baseMaxHealth: number = 100;
  baseCritChance: number = 0.05;
  baseCritMultiplier: number = 2.0;
  baseProjectileSpeed: number = 400;

  constructor() {
    // Randomly assign 2 affinity tags
    const allTags: ItemTag[] = ['melee', 'ranged', 'defensive', 'economic', 'elemental', 'utility'];
    const shuffled = allTags.sort(() => Math.random() - 0.5);
    this.affinityTags = shuffled.slice(0, 2);
  }

  addItem(item: Item): { newDuos: any[]; newTransformations: any[] } {
    this.items.push(item);
    // Track for transformations
    const transformationId = this.transformations.trackItemPickup(item.tags);
    const newTransformations = transformationId ? [transformationId] : [];
    // Track for duo combos
    const newDuos = this.duos.updateDuos(this.items);
    // Return newly unlocked combos for Game.ts to show effects/UI
    return { newDuos, newTransformations };
  }

  removeItem(itemId: string): Item | null {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const [removed] = this.items.splice(index, 1);
      return removed;
    }
    return null;
  }

  getDamage(): number {
    let damage = this.baseDamage;
    this.items.forEach(item => {
      if (item.damageMultiplier) damage *= item.damageMultiplier;
    });
    damage *= this.getSpecializationBonus();
    // TRANSFORMATION BONUS
    damage *= this.transformations.getTotalBonuses().damageMultiplier;
    // DUO COMBO BONUS
    damage *= this.duos.getTotalBonuses().damageMultiplier;
    return damage;
  }

  // ---- Per-damage-type multipliers (layer on top of getDamage) ----
  // Each is the product of the matching item field, defaulting to 1 when no item
  // carries it — so builds without type items behave exactly as before.
  getMeleeDamageMult(): number {
    let m = 1;
    this.items.forEach(item => { if (item.meleeDamageMult) m *= item.meleeDamageMult; });
    return m;
  }

  getRangedDamageMult(): number {
    let m = 1;
    this.items.forEach(item => { if (item.rangedDamageMult) m *= item.rangedDamageMult; });
    return m;
  }

  getElementalDamageMult(): number {
    let m = 1;
    this.items.forEach(item => { if (item.elementalDamageMult) m *= item.elementalDamageMult; });
    return m;
  }

  /** Damage for a melee-weapon swing: global damage × melee multiplier. */
  getMeleeDamage(): number {
    return this.getDamage() * this.getMeleeDamageMult();
  }

  /** Damage for a fired projectile: global damage × ranged multiplier. */
  getRangedDamage(): number {
    return this.getDamage() * this.getRangedDamageMult();
  }

  getFireRate(): number {
    let rate = this.baseFireRate;
    this.items.forEach(item => {
      if (item.fireRateMultiplier) rate *= item.fireRateMultiplier;
    });
    // TRANSFORMATION BONUS
    rate *= this.transformations.getTotalBonuses().fireRateMultiplier;
    // DUO COMBO BONUS
    rate *= this.duos.getTotalBonuses().fireRateMultiplier;
    return rate;
  }

  getSpeed(): number {
    let speed = this.baseSpeed;
    this.items.forEach(item => {
      if (item.speedMultiplier) speed *= item.speedMultiplier;
    });
    // TRANSFORMATION BONUS
    speed *= this.transformations.getTotalBonuses().speedMultiplier;
    // DUO COMBO BONUS
    speed *= this.duos.getTotalBonuses().speedMultiplier;
    return Math.min(speed, this.maxSpeed); // clamp so broken builds can't zoom off-screen
  }

  getMaxHealth(): number {
    let health = this.baseMaxHealth;
    this.items.forEach(item => {
      if (item.maxHealthBonus) health += item.maxHealthBonus;
    });
    // TRANSFORMATION BONUS
    health += this.transformations.getTotalBonuses().maxHealthBonus;
    return Math.max(1, health);
  }

  getCritChance(): number {
    let chance = this.baseCritChance;
    this.items.forEach(item => {
      if (item.critChance) chance += item.critChance;
    });
    // TRANSFORMATION BONUS
    chance += this.transformations.getTotalBonuses().critChance;
    // DUO COMBO BONUS
    chance += this.duos.getTotalBonuses().critChance;
    return Math.min(1, chance);
  }

  getCritMultiplier(): number {
    let mult = this.baseCritMultiplier;
    this.items.forEach(item => {
      if (item.critDamageMultiplier) mult *= item.critDamageMultiplier;
    });
    // TRANSFORMATION BONUS
    mult *= this.transformations.getTotalBonuses().critDamageMultiplier;
    return mult;
  }

  getHealthRegen(): number {
    let regen = 0;
    this.items.forEach(item => {
      if (item.healthRegen) regen += item.healthRegen;
    });
    return regen;
  }

  /** Flat armor from meta progression (set by Game at run start). */
  metaArmor: number = 0;
  /** Additional shop discount from meta progression. */
  metaShopDiscount: number = 0;

  getArmor(): number {
    let armor = this.metaArmor;
    this.items.forEach(item => {
      if (item.armor) armor += item.armor;
    });
    // TRANSFORMATION BONUS
    armor += this.transformations.getTotalBonuses().armor;
    return armor;
  }

  getLifesteal(): number {
    let lifesteal = 0;
    this.items.forEach(item => {
      if (item.lifesteal) lifesteal += item.lifesteal;
    });
    // DUO COMBO BONUS
    lifesteal += this.duos.getTotalBonuses().lifesteal;
    return lifesteal;
  }

  getThorns(): number {
    let thorns = 0;
    this.items.forEach(item => {
      if (item.thorns) thorns += item.thorns;
    });
    return thorns;
  }

  getProjectileSpeed(): number {
    let speed = this.baseProjectileSpeed;
    this.items.forEach(item => {
      if (item.projectileSpeed) speed *= item.projectileSpeed;
    });
    return speed;
  }

  getKnockback(): number {
    let kb = 0;
    this.items.forEach(item => {
      if (item.knockback) kb += item.knockback;
    });
    return kb;
  }

  getPiercing(): number {
    let pierce = 0;
    this.items.forEach(item => {
      if (item.piercing) pierce += item.piercing;
    });
    // DUO COMBO BONUS
    pierce += this.duos.getTotalBonuses().piercing;
    return pierce;
  }

  getXPMagnet(): number {
    let magnet = 1;
    this.items.forEach(item => {
      if (item.xpMagnet) magnet *= item.xpMagnet;
    });
    // TRANSFORMATION BONUS
    magnet *= this.transformations.getTotalBonuses().xpMagnet;
    return magnet;
  }

  getGoldBonus(): number {
    let bonus = 1;
    this.items.forEach(item => {
      if (item.goldBonus) bonus *= item.goldBonus;
    });
    // TRANSFORMATION BONUS
    bonus *= this.transformations.getTotalBonuses().goldBonus;
    return bonus;
  }

  getDodgeChance(): number {
    let dodge = 0;
    this.items.forEach(item => {
      if (item.dodge) dodge += item.dodge;
    });
    return Math.min(0.75, dodge);
  }

  getChainLightningChance(): number {
    let chance = 0;
    this.items.forEach(item => {
      if (item.chainLightning) chance += item.chainLightning;
    });
    // DUO COMBO BONUS
    chance += this.duos.getTotalBonuses().chainLightning;
    return Math.min(1, chance);
  }

  getFreezeChance(): number {
    let chance = 0;
    this.items.forEach(item => {
      if (item.freeze) chance += item.freeze;
    });
    // DUO COMBO BONUS
    chance += this.duos.getTotalBonuses().freeze;
    return Math.min(1, chance);
  }

  // Brotato-inspired: Economic modifiers
  getRerollDiscount(): number {
    let discount = 0;
    this.items.forEach(item => {
      if (item.rerollDiscount) discount += item.rerollDiscount;
    });
    return Math.min(0.9, discount); // Max 90% discount
  }

  getShopDiscount(): number {
    let discount = 0;
    this.items.forEach(item => {
      if (item.shopDiscount) discount += item.shopDiscount;
    });
    // TRANSFORMATION BONUS
    discount += this.transformations.getTotalBonuses().shopDiscount;
    return Math.min(0.5, discount); // Max 50% discount
  }

  getRecycleBonus(): number {
    let bonus = 0;
    this.items.forEach(item => {
      if (item.recycleBonus) bonus += item.recycleBonus;
    });
    return bonus;
  }

  // Banking: extra interest rate on gold you hold entering the shop
  getInterestBonus(): number {
    let bonus = 0;
    this.items.forEach(item => {
      if (item.interestBonus) bonus += item.interestBonus;
    });
    return Math.min(0.4, bonus); // cap +40% so interest stays bounded
  }

  // Luck: raises shop rarity weighting + health-orb drop chance (additive across items)
  getLuck(): number {
    let luck = 0;
    this.items.forEach(item => {
      if (item.luck) luck += item.luck;
    });
    return Math.min(2.0, luck); // cap +200% so a stacked luck build stays bounded
  }

  hasPiercing(): boolean {
    return this.getPiercing() > 0;
  }

  hasExplosionOnKill(): boolean {
    return this.items.some(item => item.explosionOnHit);
  }

  hasExplosionOnHit(): boolean {
    return this.items.some(item => item.explosionOnHit);
  }

  hasShield(): boolean {
    return this.items.some(item => item.shield);
  }

  hasHoming(): boolean {
    return this.items.some(item => item.homing);
  }

  hasPoison(): boolean {
    return this.items.some(item => item.poison);
  }

  getMultishot(): number {
    let count = 0;
    this.items.forEach(item => {
      if (item.multishot) count += item.multishot;
    });
    return count;
  }

  // Advanced synergy detection with tag system
  hasSynergyWith(item: Item): boolean {
    // Affinity bonus: items matching player's affinity tags
    const hasAffinity = item.tags.some(tag => this.affinityTags.includes(tag));
    if (hasAffinity) return true;

    // Crit synergies
    if (item.critChance && this.items.some(i => i.critDamageMultiplier)) return true;
    if (item.critDamageMultiplier && this.items.some(i => i.critChance)) return true;

    // Lifesteal synergies
    if (item.lifesteal && this.items.some(i => i.damageMultiplier || i.fireRateMultiplier)) return true;
    if ((item.damageMultiplier || item.fireRateMultiplier) && this.items.some(i => i.lifesteal)) return true;

    // Multishot + piercing synergies
    if (item.multishot && this.items.some(i => i.piercing)) return true;
    if (item.piercing && this.items.some(i => i.multishot)) return true;

    // Fire rate + on-hit effects
    if (item.fireRateMultiplier && this.items.some(i => i.chainLightning || i.freeze || i.poison)) return true;
    if ((item.chainLightning || item.freeze || item.poison) && this.items.some(i => i.fireRateMultiplier)) return true;

    // Knockback + damage
    if (item.knockback && this.items.some(i => i.damageMultiplier)) return true;
    if (item.damageMultiplier && this.items.some(i => i.knockback)) return true;

    // Economic synergies
    if (item.goldBonus && this.items.some(i => i.shopDiscount || i.rerollDiscount)) return true;
    if ((item.shopDiscount || item.rerollDiscount) && this.items.some(i => i.goldBonus)) return true;

    return false;
  }

  // ── Synergy-clarity helpers (feed the shop's COMBOS panel) ──

  // Duos the player has BOTH items for (currently active / firing now).
  getActiveDuos(): DuoCombo[] {
    return DUO_COMBOS.filter(duo =>
      this.items.some(o => o.id === duo.item1Id) &&
      this.items.some(o => o.id === duo.item2Id)
    );
  }

  // Duos the player is exactly one item away from, plus the still-needed
  // partner — so the shop can say "have X → get Y → <effect>".
  getPotentialDuos(): Array<{ duo: DuoCombo; owned: Item | undefined; needed: Item | undefined }> {
    const out: Array<{ duo: DuoCombo; owned: Item | undefined; needed: Item | undefined }> = [];
    for (const duo of DUO_COMBOS) {
      const ownsFirst = this.items.some(o => o.id === duo.item1Id);
      const ownsSecond = this.items.some(o => o.id === duo.item2Id);
      if (ownsFirst !== ownsSecond) {
        const ownedId = ownsFirst ? duo.item1Id : duo.item2Id;
        const neededId = ownsFirst ? duo.item2Id : duo.item1Id;
        out.push({
          duo,
          owned: ItemDatabase.getItemById(ownedId),
          needed: ItemDatabase.getItemById(neededId),
        });
      }
    }
    return out;
  }

  // Weapon specialization bonus
  getWeaponSpecialization(): 'melee' | 'ranged' | 'mixed' | 'none' {
    let meleeCount = 0;
    let rangedCount = 0;

    this.items.forEach(item => {
      if (item.tags.includes('melee')) meleeCount++;
      if (item.tags.includes('ranged')) rangedCount++;
    });

    if (meleeCount > 0 && rangedCount === 0) return 'melee';
    if (rangedCount > 0 && meleeCount === 0) return 'ranged';
    if (meleeCount > 0 && rangedCount > 0) return 'mixed';
    return 'none';
  }

  getSpecializationBonus(): number {
    const spec = this.getWeaponSpecialization();
    return (spec === 'melee' || spec === 'ranged') ? 1.2 : 1.0;
  }

  // Calculate final item price with shop discount
  getItemPrice(item: Item, wave: number): number {
    // BALANCE: Brotato-inspired pricing formula for tighter economy
    // Prices scale more aggressively to prevent player from getting rich
    const basePrice = item.cost;
    let finalPrice = basePrice * (1 + wave * 0.15);

    // Apply shop discount (items + meta, shared 50% cap)
    const discount = Math.min(0.5, this.getShopDiscount() + this.metaShopDiscount);
    finalPrice *= (1 - discount);

    return Math.max(1, Math.floor(finalPrice));
  }

  // Calculate recycle value (25% base + recycle bonus)
  getRecycleValue(item: Item): number {
    const baseValue = item.cost * 0.25;
    const bonus = this.getRecycleBonus();
    return Math.floor(baseValue * (1 + bonus));
  }

  // Weapon system
  getWeaponType(): WeaponType {
    // Find the first weapon-type item (only one weapon can be active at a time)
    const weaponItem = this.items.find(item => item.weaponType);
    return weaponItem?.weaponType ?? 'auto-aim';
  }

  getWeaponRange(): number {
    const weaponItem = this.items.find(item => item.weaponType);
    return weaponItem?.weaponRange ?? 0;
  }

  getWeaponArc(): number {
    const weaponItem = this.items.find(item => item.weaponType);
    return weaponItem?.weaponArc ?? 0;
  }

  hasWeapon(): boolean {
    return this.items.some(item => item.weaponType);
  }

  // ==================== AUXILIARY STACKING WEAPONS ====================
  // These layer ON TOP of the primary weaponType (they never replace it).

  /** Number of orbs circling the player (sum across items). */
  getOrbitOrbCount(): number {
    return this.items.reduce((n, i) => n + (i.orbitOrbs ?? 0), 0);
  }

  /** Contact damage per orbit orb — scaled off the player's base damage. */
  getOrbitDamage(): number {
    let mult = 1;
    for (const i of this.items) if (i.orbitDamageMult) mult *= i.orbitDamageMult;
    return this.getDamage() * 0.9 * mult;
  }

  hasAuxMelee(): boolean {
    return this.items.some(i => i.auxMelee);
  }

  /** Whirling-arc damage — leans on melee scaling so melee builds amplify it. */
  getAuxMeleeDamage(): number {
    let mult = 1;
    for (const i of this.items) if (i.auxMeleeDamageMult) mult *= i.auxMeleeDamageMult;
    return this.getMeleeDamage() * 1.1 * mult;
  }

  hasBombDrop(): boolean {
    return this.items.some(i => i.bombDrop);
  }

  getBombDamage(): number {
    let mult = 1;
    for (const i of this.items) if (i.bombDamageMult) mult *= i.bombDamageMult;
    return this.getDamage() * 3.0 * mult;
  }

  /** Seconds between bomb drops (base 3.5s, faster with cooldown items). */
  getBombCooldown(): number {
    let mult = 1;
    for (const i of this.items) if (i.bombCooldownMult) mult *= i.bombCooldownMult;
    return Math.max(0.6, 3.5 * mult);
  }

  hasNova(): boolean {
    return this.items.some(i => i.novaPulse);
  }

  getNovaDamage(): number {
    let mult = 1;
    for (const i of this.items) if (i.novaDamageMult) mult *= i.novaDamageMult;
    return this.getDamage() * 1.6 * mult;
  }

  /** Seconds between nova pulses (base 4s, faster with cooldown items). */
  getNovaCooldown(): number {
    let mult = 1;
    for (const i of this.items) if (i.novaCooldownMult) mult *= i.novaCooldownMult;
    return Math.max(0.8, 4.0 * mult);
  }
}
