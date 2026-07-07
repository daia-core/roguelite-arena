// Item catalog — the full static roster of every item in the game (data only).
// Extracted verbatim from the old ItemSystem monolith; ItemDatabase reads this array.
// Keep this file PURE DATA — no logic. New content is added here; classification and
// aggregation logic lives in ItemSystem.ts / items/types.ts.

import { ItemTier, type Item } from "./types";

export const ITEM_CATALOG: Item[] = [
    // ==================== TIER 1 (COMMON) ====================
    // Basic stat boosts - cheap and accessible
    {
      id: 'damage_t1',
      slot: 'ring',
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
      slot: 'feet',
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
      slot: 'amulet',
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
      slot: 'torso',
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
      slot: 'ring',
      name: 'Steel Band',
      description: '+45% melee/swing damage, -8% fire rate',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 26,
      icon: '💎',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.45,
      fireRateMultiplier: 0.92
    },
    {
      id: 'attack_speed_t2',
      name: 'Rapid Gauntlets',
      description: '+20% fire rate, +1 projectile',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '⚡',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.2,
      multishot: 1
    },
    {
      id: 'movement_speed_t2',
      name: 'Running Shoes',
      description: '+20% move speed, +10% dodge',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 26,
      icon: '👢',
      unlocked: true,
      tags: ['utility', 'defensive'],
      speedMultiplier: 1.2,
      dodge: 0.1
    },
    {
      id: 'max_hp_t2',
      slot: 'ring',
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
      name: 'Precision Charm',
      description: '+12% crit chance, +1 pierce',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged'],
      critChance: 0.12,
      piercing: 1
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
      slot: 'torso',
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
      description: '+5 armor, +1.5 HP/s',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      armor: 5,
      healthRegen: 1.5
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
      description: '-25% reroll cost',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 40,
      icon: '🔭',
      unlocked: true,
      tags: ['economic', 'utility'],
      rerollDiscount: 0.25
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

    // ==================== TIER 3 (RARE) ====================
    // Strong effects and build-defining mechanics
    {
      id: 'damage_t3',
      name: 'Champion\'s Crown',
      description: '+55% damage, but -12% fire rate (a heavy crown)',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '👑',
      unlocked: true,
      tags: ['melee', 'ranged'],
      damageMultiplier: 1.55,
      fireRateMultiplier: 0.88
    },
    {
      id: 'attack_speed_t3',
      name: 'Lightning Bracers',
      description: '+30% fire rate; +15% chance to chain lightning on hit',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '⚡',
      unlocked: true,
      tags: ['ranged', 'elemental'],
      fireRateMultiplier: 1.30,
      chainLightning: 0.15
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
      name: 'Static Charge',
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
      description: '18% dodge, +15% move speed, but -10 max HP (fragile & fast)',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 65,
      icon: '👻',
      unlocked: true,
      tags: ['defensive', 'utility'],
      dodge: 0.18,
      speedMultiplier: 1.15,
      maxHealthBonus: -10
    },
    {
      id: 'crit_chance_t3',
      name: 'Assassin\'s Mark',
      description: '+18% crit chance; +25% chance to Bleed on hit',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '🗡️',
      unlocked: true,
      tags: ['melee', 'ranged'],
      critChance: 0.18,
      bleed: 0.25
    },
    {
      id: 'knockback_t3',
      name: 'Impact Gauntlet',
      description: 'Heavy knockback, +20% damage, and hits explode (small AoE)',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '👊',
      unlocked: true,
      tags: ['melee'],
      knockback: 250,
      damageMultiplier: 1.20,
      explosionOnHit: true
    },

    // ==================== TIER 4 (LEGENDARY) ====================
    // Game-changing unique effects
    {
      id: 'berserker_rage_t4',
      name: 'Berserker Rage',
      description: 'Fury over safety.',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 140,
      icon: '⚔️',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.75,
      fireRateMultiplier: 1.15,
      maxHealthBonus: -25
    },
    {
      id: 'rapid_fire_t4',
      name: 'Bullet Hose',
      description: 'Volume over precision.',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 135,
      icon: '🔫',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.70,
      multishot: 2,
      damageMultiplier: 0.85
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
      description: 'Reborn in flame: near death you rage harder (+dmg & fire rate) and your hits ignite. +60 HP, +6 HP/s',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 142,
      icon: '🔥',
      unlocked: true,
      tags: ['defensive', 'elemental'],
      maxHealthBonus: 60,
      healthRegen: 6,
      lowHpPower: 0.5,
      burn: 0.3
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
      description: 'Your hoard is a weapon: damage climbs with unspent gold on hand. +80% gold, +10% luck',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 130,
      icon: '✨',
      unlocked: true,
      tags: ['economic'],
      goldBonus: 1.8,
      goldScaleDamage: 0.15,
      luck: 0.1
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
      // BRAWLER class starter. Unlike the swing-buff swords below, this sets
      // weaponType: 'melee', which SILENCES the auto-aim gun (Player.tryShoot) — a
      // true melee loadout. It hard-buffs the swing to carry the run on its own.
      // unlocked:false → class-granted only, never sold (buying it would mute a gun
      // build's gun, a trap pick).
      id: 'brawler_blade_t1',
      name: 'Brawler\'s Cleaver',
      description: 'Melee only: no gun, but a big, fast, wide swing carries the fight',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 0,
      icon: '🗡️',
      unlocked: false,
      tags: ['melee'],
      weaponType: 'melee',    // suppresses the gun; the swing IS the attack
      meleeStyle: 'arc',      // a wide sweeping cleave
      meleeDamageMult: 2.4,   // strong swing to stand alone without the gun
      swingRangeBonus: 30,
      swingArcBonus: Math.PI * 0.2,
      swingCooldownMult: 0.7, // fast swings
      knockback: 120
    },
    {
      // SPEAR: a true melee loadout that THRUSTS — long forward reach, tight arc,
      // heavy per-hit but slower. weaponType:'melee' silences the gun; the meleeStyle
      // routes it through the thrust animation + narrow-lane hit test. Class-granted /
      // shop-offered like other weapons.
      id: 'melee_spear_t2',
      name: 'Piercing Lance',
      description: 'Melee only: a long forward thrust — huge reach, narrow lane, heavy hits',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '🔱',
      unlocked: true,
      tags: ['melee'],
      weaponType: 'melee',
      meleeStyle: 'thrust',
      meleeDamageMult: 2.8,      // fewer, harder pokes
      swingRangeBonus: 70,        // long reach is the point
      swingCooldownMult: 1.05,    // a touch slower — it's a committed lunge
      piercing: 2,                // the lance runs through a line of enemies
      knockback: 80
    },
    {
      // HAMMER: a slow, heavy overhead SLAM onto a disc out front. Big AoE, big
      // knockback, low swing speed. weaponType:'melee' silences the gun; slam style +
      // swingAoe give it the crashing disc.
      id: 'melee_hammer_t2',
      name: 'Crashing Maul',
      description: 'Melee only: a slow overhead slam that quakes a wide area and flings enemies',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 36,
      icon: '🔨',
      unlocked: true,
      tags: ['melee'],
      weaponType: 'melee',
      meleeStyle: 'slam',
      meleeDamageMult: 3.2,       // hits like a truck
      swingRangeBonus: 20,
      swingAoe: 55,               // the slam disc
      swingCooldownMult: 1.45,    // heavy and slow
      knockback: 200
    },
    {
      id: 'melee_sword_t2',
      name: 'Crescent Blade',
      description: 'Wider, faster, harder-hitting swing',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🗡️',
      unlocked: true,
      tags: ['melee'],
      meleeStyle: 'arc',
      meleeDamageMult: 1.5, // buffs the swing, not the gun
      swingRangeBonus: 25,
      swingArcBonus: Math.PI * 0.15,
      swingCooldownMult: 0.75 // 33% faster swings
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
      projectileSpeed: 1.8 // Fast (MULTIPLIER on the 400 base — see ItemSystem.getProjectileSpeed)
    },
    {
      id: 'hammer_weapon_t3',
      name: 'Thunder Hammer',
      description: 'Slow, heavy swing that quakes all around you',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 62,
      icon: '🔨',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 2.2, // buffs the swing, not the gun
      swingAoe: 90, // full-circle shockwave on each swing
      swingRangeBonus: 20,
      swingCooldownMult: 1.6, // very slow but hard-hitting
      knockback: 300
    },

    // ==================== EVOLVED WEAPONS (VS-STYLE EVOLUTIONS) ====================
    // Obtainable ONLY via EvolutionSystem (base weapon + catalyst passive at wave 8+),
    // never in the shop — so all are `unlocked: false`. See EvolutionSystem.ts EVOLUTIONS.
    // Each keeps its base weaponType so the firing style is preserved, and layers a
    // signature enhancement on top. The catalyst is kept on evolve, so its effect stacks.
    {
      id: 'shotgun_evolved', // Scatter Gun + Demolition Kit
      name: 'Hellfire Barrage',
      description: 'EVOLVED: 7 exploding pellets, faster and far deadlier',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 0,
      icon: '🌋',
      unlocked: false,
      tags: ['ranged', 'elemental'],
      weaponType: 'shotgun',
      multishot: 6, // 1 main + 6 = 7 pellets
      damageMultiplier: 1.4,
      fireRateMultiplier: 0.9,
      explosionOnHit: true
    },
    {
      id: 'laser_evolved', // Beam Rifle + Storm Essence
      name: 'Arc Lance',
      description: 'EVOLVED: a piercing beam that chains lightning to nearby foes',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 0,
      icon: '🌩️',
      unlocked: false,
      tags: ['ranged', 'elemental'],
      weaponType: 'laser',
      piercing: 999,
      damageMultiplier: 1.1,
      fireRateMultiplier: 3.5,
      projectileSpeed: 2.0, // Fast (MULTIPLIER on the 400 base — see ItemSystem.getProjectileSpeed)
      chainLightning: 0.6
    },
    {
      id: 'orbital_evolved', // Satellite Orbs + Trident
      name: 'Orbital Halo',
      description: 'EVOLVED: a dense ring of 7 heavy orbs',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 0,
      icon: '🌀',
      unlocked: false,
      tags: ['utility', 'ranged'],
      weaponType: 'orbital',
      multishot: 6, // 7 orbs total
      damageMultiplier: 1.5,
      orbitDamageMult: 1.6
    },
    {
      id: 'hammer_evolved', // Thunder Hammer + Wildfire Torch
      name: 'Molten Warhammer',
      description: 'EVOLVED: a faster, wider, burning full-circle quake',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 0,
      icon: '⚒️',
      unlocked: false,
      tags: ['melee', 'elemental'],
      meleeDamageMult: 4.5,
      elementalDamageMult: 1.4,
      swingAoe: 140,
      swingRangeBonus: 40,
      swingCooldownMult: 1.1, // faster than the base hammer's 1.6
      knockback: 450
    },

    // ==================== MELEE SWING BUILDS ====================
    // Each shapes the always-on default swing into a distinct melee playstyle. They
    // STACK on top of the (always-firing) gun, so a melee build still shoots weakly.
    {
      id: 'whirlwind_cleaver_t2',
      name: 'Whirlwind Cleaver',
      description: 'Very wide sweeping swing that hits a whole crowd',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '🌀',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.2,
      swingArcBonus: Math.PI * 0.55, // nearly doubles the arc
      swingRangeBonus: 15
    },
    {
      id: 'twin_fangs_t2',
      name: 'Twin Fangs',
      description: 'Fast, light twin-dagger swings',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🗡️',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 0.85,
      swingCooldownMult: 0.5, // twice as fast
      swingRangeBonus: 5
    },
    {
      id: 'executioners_maul_t3',
      name: "Executioner's Maul",
      description: 'Slow, devastating slam with heavy knockback',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '🪓',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 3.2,
      swingCooldownMult: 2.0, // very slow
      swingAoe: 60,
      knockback: 260
    },
    {
      id: 'vampiric_edge_t2',
      name: 'Vampiric Edge',
      description: 'Swing heals you (+12% lifesteal), +30% swing dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 36,
      icon: '🩸',
      unlocked: true,
      tags: ['melee', 'utility'],
      swingDamageMult: 1.3,
      lifesteal: 0.12
    },
    {
      id: 'warglaive_storm_t3',
      name: 'Warglaive Storm',
      description: 'Full-circle AOE swing, faster than a hammer',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '🌪️',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.4,
      swingAoe: 55,
      swingCooldownMult: 0.9
    },
    {
      id: 'titan_gauntlets_t3',
      name: 'Titan Gauntlets',
      description: '+60% swing dmg, +40 reach, +12% melee dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 54,
      icon: '🥊',
      unlocked: true,
      tags: ['melee'],
      swingDamageMult: 1.6,
      swingRangeBonus: 40,
      meleeDamageMult: 1.12
    },

    // ==================== AOE-RADIUS ITEMS ====================
    // The global AOE-radius stat scales swing AOE, bomb blasts and nova pulses at once,
    // so it rewards a player who's leaning into area effects.
    {
      id: 'ring_of_widening_t1',
      slot: 'ring',
      name: 'Ring of Widening',
      description: '+20% area of all AOE (swing burst, bombs, novas)',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 14,
      icon: '⭕',
      unlocked: true,
      tags: ['utility'],
      aoeRadiusMult: 1.2
    },
    {
      id: 'cataclysm_core_t4',
      name: 'Cataclysm Core',
      description: '+45% AOE radius and a full-circle swing shockwave',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 95,
      icon: '💠',
      unlocked: true,
      tags: ['utility', 'elemental'],
      aoeRadiusMult: 1.45,
      swingAoe: 70,
      meleeDamageMult: 1.3
    },

    // ==================== STATUS ENGINES (Phase 3b — Soulstone Survivors inspired) ====================
    // On-hit statuses that tick over time and stack into a whole DoT/affliction build.
    // They apply from BOTH ranged and melee hits, so a melee-DoT hybrid is viable.
    {
      id: 'ember_brand_t1',
      name: 'Ember Brand',
      description: '25% chance to Ignite: fast fire damage over time',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 16,
      icon: '🔥',
      unlocked: true,
      tags: ['elemental'],
      burn: 0.25
    },
    {
      id: 'wildfire_torch_t3',
      name: 'Wildfire Torch',
      description: '60% chance to Ignite, +40% elemental damage',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 52,
      icon: '🔥',
      unlocked: true,
      tags: ['elemental'],
      burn: 0.6,
      elementalDamageMult: 1.4
    },
    {
      id: 'serrated_edge_t2',
      name: 'Serrated Edge',
      description: '35% chance to Bleed — hits harder while the enemy is moving',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🩸',
      unlocked: true,
      tags: ['melee'],
      bleed: 0.35
    },
    {
      id: 'hemorrhage_fang_t3',
      name: 'Hemorrhage Fang',
      description: '65% chance to Bleed and +25% crit chance',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 56,
      icon: '🦷',
      unlocked: true,
      tags: ['melee'],
      bleed: 0.65,
      critChance: 0.25
    },
    {
      id: 'plague_bearer_t2',
      name: 'Plague Bearer',
      description: 'Adds Poison, and poisoned enemies infect a neighbor on death',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '☣️',
      unlocked: true,
      tags: ['elemental'],
      poison: true,
      poisonSpread: true
    },
    {
      id: 'doom_sigil_t3',
      name: 'Doom Sigil',
      description: '30% chance to mark with Doom — a delayed blast that executes low-HP foes',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '💀',
      unlocked: true,
      tags: ['elemental'],
      doom: 0.3
    },
    {
      id: 'harbingers_seal_t4',
      name: "Harbinger's Seal",
      description: '55% Doom chance, +35% elemental damage — detonations hit like a truck',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 92,
      icon: '💀',
      unlocked: true,
      tags: ['elemental'],
      doom: 0.55,
      elementalDamageMult: 1.35
    },
    {
      id: 'rending_mark_t2',
      name: 'Rending Mark',
      description: '40% chance to Wound — amplifies ALL damage-over-time on the target',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '〽️',
      unlocked: true,
      tags: ['utility'],
      wound: 0.4
    },
    {
      id: 'echo_prism_t3',
      name: 'Echo Prism',
      description: '30% chance to Multicast — your gun fires a bonus volley',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '🔮',
      unlocked: true,
      tags: ['ranged'],
      multicast: 0.3
    },
    {
      id: 'twin_echo_core_t4',
      name: 'Twin Echo Core',
      description: '55% Multicast chance and +20% fire rate',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 90,
      icon: '🔮',
      unlocked: true,
      tags: ['ranged'],
      multicast: 0.55,
      fireRateMultiplier: 1.2
    },

    // ==================== NEW ITEMS (BINDING OF ISAAC INSPIRED) ====================
    // Focus on synergies and build diversity
    {
      id: 'glass_cannon_t2',
      name: 'Brittle Edge',
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
      name: 'Battle Fury',
      description: '+20% dmg; +35% dmg & fire rate while below 30% HP',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '😡',
      unlocked: true,
      tags: ['melee', 'utility'],
      damageMultiplier: 1.2,
      lowHpPower: 0.35
    },
    {
      id: 'lucky_coin_t1',
      name: 'Lucky Coin',
      description: '+7% crit chance, +8% luck',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 10,
      icon: '🪙',
      unlocked: true,
      tags: ['utility'],
      critChance: 0.07,
      luck: 0.08
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
      name: 'Envenomed Blade',
      description: 'Poison on hit, +25% melee damage',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '☣️',
      unlocked: true,
      tags: ['elemental', 'melee'],
      poison: true,
      meleeDamageMult: 1.25
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
      name: 'Scattergun',
      description: '+2 projectiles, strong knockback',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 40,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged'],
      multishot: 2,
      knockback: 200
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
      slot: 'torso',
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
      name: 'Evasion Plating',
      description: '15% dodge chance, +5 armor',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 52,
      icon: '👻',
      unlocked: true,
      tags: ['defensive', 'utility'],
      dodge: 0.15,
      armor: 5
    },
    {
      id: 'homing_bullets_t3',
      name: 'Guided Rounds',
      description: 'Bullets track enemies, +20% ranged dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 64,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged', 'utility'],
      homing: true,
      rangedDamageMult: 1.2
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
      slot: 'torso',
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
      description: '2.8x crit damage, but -15% fire rate (precision over spray)',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '💢',
      unlocked: true,
      tags: ['utility'],
      critDamageMultiplier: 2.8,
      fireRateMultiplier: 0.85
    },
    {
      id: 'bargain_hunter_t1',
      name: 'Bargain Hunter',
      description: '-7% shop prices, -20% reroll cost',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 12,
      icon: '💰',
      unlocked: true,
      tags: ['economic'],
      shopDiscount: 0.07,
      rerollDiscount: 0.2
    },
    {
      id: 'soul_collector_t3',
      name: 'Soul Collector',
      description: '+50% pickup range and +5% lifesteal (drain the souls you reap)',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 45,
      icon: '👻',
      unlocked: true,
      tags: ['utility', 'defensive'],
      xpMagnet: 1.5,
      lifesteal: 0.05
    },

    // ==================== NEW ITEMS (20+ additions for build variety) ====================

    // Damage scaling items
    {
      id: 'crit_synergy_t3',
      name: 'Critical Synergy',
      description: 'Crits that cut deep: high crit chance opens bleeding wounds. +15% crit, +35% crit dmg, 40% bleed',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 70,
      icon: '💥',
      unlocked: true,
      tags: ['melee', 'ranged'],
      critChance: 0.15,
      critDamageMultiplier: 1.35,
      bleed: 0.4
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
      description: '+20% speed, +10% fire rate, homing shots',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '⚡',
      unlocked: true,
      tags: ['ranged', 'utility'],
      speedMultiplier: 1.2,
      fireRateMultiplier: 1.1,
      homing: true
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
      description: 'A protective aura pulses outward, punishing attackers. +50 HP, +8 armor, 30% thorns, periodic shockwave',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 78,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      maxHealthBonus: 50,
      armor: 8,
      thorns: 0.3,
      novaPulse: true,
      novaDamageMult: 0.55
    },
    {
      id: 'vampire_armor_t3',
      slot: 'torso',
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
      slot: 'torso',
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
      description: 'The master shopper: buy low, earn more. +40% gold, -12% prices',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '💍',
      unlocked: true,
      tags: ['economic'],
      goldBonus: 1.4,
      shopDiscount: 0.12
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
      description: 'Feed on slaughter: each kill stacks damage and blood heals you — but you are frail. +40% dmg, 6% lifesteal, -20 HP',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 145,
      icon: '😈',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.4,
      killStackDamage: 0.045,
      lifesteal: 0.06,
      maxHealthBonus: -20
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
    // a glass-cannon player keeps these, a tank sells them off.
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
      description: 'Power paid in blood.',
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
      description: 'The bank vault: heavy interest and luck compound your fortune. +18% interest, +25% luck, +20% gold',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '🏦',
      unlocked: true,
      tags: ['economic', 'utility'],
      interestBonus: 0.18,
      luck: 0.25,
      goldBonus: 1.2
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
      description: 'Reality rolls twice: a chance to fire a bonus volley the same frame. +80% luck, +40% gold, +10% crit',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 110,
      icon: '🎲',
      unlocked: true,
      tags: ['economic', 'utility'],
      luck: 0.80,
      goldBonus: 1.40,
      critChance: 0.10,
      multicast: 0.25
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
      id: 'sanguine_edge_t3',
      name: 'Sanguine Edge',
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
    },

    // ==================== EXPANSION: 50+ UNIQUE BUILD-DEFINING ITEMS ====================
    // Each item is a distinct trade-off, not a plain "+X% damage" — they deepen the
    // ranged / melee / crit / elemental / tank / sustain / speed / economy / aux axes
    // so the shop always offers a meaningful specialisation choice. Balanced by
    // cost-per-power against the existing tiers (C ~6-14, U ~22-40, R ~48-84, L ~130-165).

    // ---- RANGED / GUN specialists ----
    {
      id: 'hollow_point_t2',
      name: 'Hollow Points',
      description: '+35% ranged dmg, -10% fire rate',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🔩',
      unlocked: true,
      tags: ['ranged'],
      rangedDamageMult: 1.35,
      fireRateMultiplier: 0.9
    },
    {
      id: 'full_auto_t2',
      name: 'Full Auto',
      description: '+40% fire rate, -15% ranged dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🔫',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.4,
      rangedDamageMult: 0.85
    },
    {
      id: 'armor_piercing_t3',
      name: 'Armor-Piercing Rounds',
      description: '+3 pierce, +20% ranged dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 62,
      icon: '🗜️',
      unlocked: true,
      tags: ['ranged'],
      piercing: 3,
      rangedDamageMult: 1.2
    },
    {
      id: 'deadeye_t4',
      name: 'Deadeye Module',
      description: '+25% crit, +40% ranged dmg, -15% speed',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 148,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged'],
      critChance: 0.25,
      rangedDamageMult: 1.4,
      speedMultiplier: 0.85
    },
    {
      id: 'gatling_core_t4',
      name: 'Gatling Core',
      description: '+70% fire rate, -20% ranged dmg',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 150,
      icon: '🌀',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.7,
      rangedDamageMult: 0.8
    },
    {
      id: 'overclock_t3',
      name: 'Overclock Chip',
      description: '+50% fire rate, -20 max HP',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 64,
      icon: '⏱️',
      unlocked: true,
      tags: ['ranged'],
      fireRateMultiplier: 1.5,
      maxHealthBonus: -20
    },
    {
      id: 'heavy_ordnance_t3',
      name: 'Heavy Ordnance',
      description: '+60% dmg, -25% fire rate',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 66,
      icon: '🚀',
      unlocked: true,
      tags: ['ranged'],
      damageMultiplier: 1.6,
      fireRateMultiplier: 0.75
    },

    // ---- MULTISHOT / bullet-count ----
    {
      id: 'split_shot_t2',
      name: 'Split Shot',
      description: '+1 projectile, -10% ranged dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 36,
      icon: '🔀',
      unlocked: true,
      tags: ['ranged'],
      multishot: 1,
      rangedDamageMult: 0.9
    },
    {
      id: 'volley_t3',
      name: 'Volley Rig',
      description: '+2 projectiles, -15% ranged dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 72,
      icon: '🎇',
      unlocked: true,
      tags: ['ranged'],
      multishot: 2,
      rangedDamageMult: 0.85
    },
    {
      id: 'hydra_rounds_t4',
      name: 'Hydra Rounds',
      description: '+4 projectiles, -25% ranged dmg',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 158,
      icon: '🐉',
      unlocked: true,
      tags: ['ranged'],
      multishot: 4,
      rangedDamageMult: 0.75
    },

    // ---- MELEE specialists ----
    {
      id: 'whetstone_t1',
      name: 'Whetstone',
      description: '+20% melee dmg',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 11,
      icon: '🪨',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.2
    },
    {
      id: 'cleaver_t2',
      name: 'Bone Cleaver',
      description: '+35% melee dmg, knockback',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🔪',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.35,
      knockback: 250
    },
    {
      id: 'berserkers_axe_t2',
      name: "Berserker's Axe",
      description: '+50% melee dmg, -20 max HP',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '🪓',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.5,
      maxHealthBonus: -20
    },
    {
      id: 'executioner_t3',
      name: "Executioner's Blade",
      description: '+60% melee dmg, +40% crit dmg, -10% speed',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 70,
      icon: '⚰️',
      unlocked: true,
      tags: ['melee'],
      meleeDamageMult: 1.6,
      critDamageMultiplier: 1.4,
      speedMultiplier: 0.9
    },
    {
      id: 'titans_gauntlet_t4',
      name: "Titan's Gauntlet",
      description: '+80% melee dmg, +40 HP, -15% speed',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 152,
      icon: '🥊',
      unlocked: true,
      tags: ['melee', 'defensive'],
      meleeDamageMult: 1.8,
      maxHealthBonus: 40,
      speedMultiplier: 0.85
    },

    // ---- CRIT specialists ----
    {
      id: 'keen_edge_t1',
      name: 'Keen Edge',
      description: '+8% crit chance',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 12,
      icon: '🔺',
      unlocked: true,
      tags: ['melee', 'ranged'],
      critChance: 0.08
    },
    {
      id: 'bloodhound_t2',
      name: 'Bloodhound Sight',
      description: '+10% crit, +50% pickup range, +10% luck',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '👁️',
      unlocked: true,
      tags: ['ranged', 'economic'],
      critChance: 0.1,
      xpMagnet: 1.5,
      luck: 0.1
    },
    {
      id: 'deadly_precision_t3',
      name: 'Deadly Precision',
      description: 'Surgical shots: piercing crits at the cost of fire rate. +15% crit, +60% crit dmg, pierce 3, -15% fire rate',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '💠',
      unlocked: true,
      tags: ['ranged'],
      critChance: 0.15,
      critDamageMultiplier: 1.6,
      piercing: 3,
      fireRateMultiplier: 0.85
    },
    {
      id: 'executioners_mark_t4',
      name: "Executioner's Mark",
      description: '+20% crit, +100% crit dmg, -30 HP',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 152,
      icon: '💢',
      unlocked: true,
      tags: ['ranged'],
      critChance: 0.2,
      critDamageMultiplier: 2.0,
      maxHealthBonus: -30
    },

    // ---- ELEMENTAL / on-hit specialists ----
    {
      id: 'ember_rounds_t2',
      name: 'Ember Rounds',
      description: 'Shots explode on hit, +10% elemental dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 38,
      icon: '🔥',
      unlocked: true,
      tags: ['elemental'],
      explosionOnHit: true,
      elementalDamageMult: 1.1
    },
    {
      id: 'plague_bearer_t3',
      name: 'Plague Vial',
      description: 'Hits poison enemies, +30% elemental dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 62,
      icon: '🧪',
      unlocked: true,
      tags: ['elemental'],
      poison: true,
      elementalDamageMult: 1.3
    },
    {
      id: 'glacier_t3',
      name: 'Glacier Shard',
      description: '+25% freeze chance, +20% elemental dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 64,
      icon: '🧊',
      unlocked: true,
      tags: ['elemental'],
      freeze: 0.25,
      elementalDamageMult: 1.2
    },
    {
      id: 'tesla_coil_t3',
      name: 'Tesla Coil',
      description: '+35% chain lightning, +15% elemental dmg',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 66,
      icon: '🔌',
      unlocked: true,
      tags: ['elemental'],
      chainLightning: 0.35,
      elementalDamageMult: 1.15
    },
    {
      id: 'wildfire_t4',
      name: 'Wildfire',
      description: 'Explode on hit, +60% elemental dmg, +10% fire rate',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 155,
      icon: '🌋',
      unlocked: true,
      tags: ['elemental'],
      explosionOnHit: true,
      elementalDamageMult: 1.6,
      fireRateMultiplier: 1.1
    },
    {
      id: 'absolute_zero_t4',
      name: 'Absolute Zero',
      description: '+40% freeze, +40% elemental dmg',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 150,
      icon: '❄️',
      unlocked: true,
      tags: ['elemental'],
      freeze: 0.4,
      elementalDamageMult: 1.4
    },
    {
      id: 'chain_reactor_t4',
      name: 'Chain Reactor',
      description: '+50% chain lightning, +50% elemental dmg',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 155,
      icon: '⚡',
      unlocked: true,
      tags: ['elemental'],
      chainLightning: 0.5,
      elementalDamageMult: 1.5
    },

    // ---- TANK / DEFENSIVE ----
    {
      id: 'kite_shield_t1',
      name: 'Kite Shield',
      description: '+3 armor',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 12,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      armor: 3
    },
    {
      id: 'stalwart_t2',
      slot: 'torso',
      name: 'Stalwart Plate',
      description: '+45 max HP, -5% speed',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🧱',
      unlocked: true,
      tags: ['defensive'],
      maxHealthBonus: 45,
      speedMultiplier: 0.95
    },
    {
      id: 'bulwark_t2',
      name: 'Bulwark',
      description: '+7 armor, -5% speed',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🚧',
      unlocked: true,
      tags: ['defensive'],
      armor: 7,
      speedMultiplier: 0.95
    },
    {
      id: 'spiked_shell_t3',
      name: 'Spiked Shell',
      description: '+8 armor, +30% thorns',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '🦔',
      unlocked: true,
      tags: ['defensive'],
      armor: 8,
      thorns: 0.3
    },
    {
      id: 'retaliation_t3',
      name: 'Retaliation Core',
      description: '+50% thorns, +4 armor',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '💥',
      unlocked: true,
      tags: ['defensive'],
      thorns: 0.5,
      armor: 4
    },
    {
      id: 'juggernaut_t4',
      name: 'Juggernaut',
      description: '+15 armor, +60 HP, -20% speed',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 155,
      icon: '🏰',
      unlocked: true,
      tags: ['defensive'],
      armor: 15,
      maxHealthBonus: 60,
      speedMultiplier: 0.8
    },

    // ---- LIFESTEAL / SUSTAIN ----
    {
      id: 'bloodletter_t2',
      name: 'Bloodletter',
      description: '+8% lifesteal, +10% dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 34,
      icon: '🩸',
      unlocked: true,
      tags: ['melee'],
      lifesteal: 0.08,
      damageMultiplier: 1.1
    },
    {
      id: 'sanguine_pact_t3',
      name: 'Sanguine Pact',
      description: '+20% lifesteal, -25 max HP',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '🧛',
      unlocked: true,
      tags: ['melee'],
      lifesteal: 0.2,
      maxHealthBonus: -25
    },
    {
      id: 'phoenix_heart_t4',
      name: 'Phoenix Heart',
      description: '+8 HP/s regen, +50 HP, +10% lifesteal',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 152,
      icon: '🔆',
      unlocked: true,
      tags: ['defensive'],
      healthRegen: 8,
      maxHealthBonus: 50,
      lifesteal: 0.1
    },

    // ---- SPEED / DODGE / EVASION ----
    {
      id: 'windwalker_t2',
      slot: 'feet',
      name: 'Windwalker Boots',
      description: '+30% speed, +8% dodge',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 32,
      icon: '🍃',
      unlocked: true,
      tags: ['utility', 'defensive'],
      speedMultiplier: 1.3,
      dodge: 0.08
    },
    {
      id: 'momentum_t2',
      name: 'Momentum Engine',
      description: '+25% speed, +10% fire rate, -10 HP',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '💨',
      unlocked: true,
      tags: ['utility'],
      speedMultiplier: 1.25,
      fireRateMultiplier: 1.1,
      maxHealthBonus: -10
    },
    {
      id: 'phantom_cloak_t3',
      name: 'Phantom Cloak',
      description: '+20% dodge, +10% speed',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 62,
      icon: '🌫️',
      unlocked: true,
      tags: ['defensive'],
      dodge: 0.2,
      speedMultiplier: 1.1
    },
    {
      id: 'blink_boots_t4',
      slot: 'feet',
      name: 'Blink Boots',
      description: '+25% dodge, +30% speed, -20 HP',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 145,
      icon: '👟',
      unlocked: true,
      tags: ['defensive', 'utility'],
      dodge: 0.25,
      speedMultiplier: 1.3,
      maxHealthBonus: -20
    },

    // ---- CROWD CONTROL ----
    {
      id: 'shockwave_gloves_t2',
      name: 'Shockwave Gloves',
      description: 'Massive knockback, +10% melee dmg',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 26,
      icon: '🧤',
      unlocked: true,
      tags: ['melee'],
      knockback: 450,
      meleeDamageMult: 1.1
    },
    {
      id: 'cryo_repulsor_t3',
      name: 'Cryo Repulsor',
      description: 'Strong knockback, +15% freeze',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 56,
      icon: '🌬️',
      unlocked: true,
      tags: ['defensive', 'elemental'],
      knockback: 350,
      freeze: 0.15
    },

    // ---- HYBRID / high-risk ----
    {
      id: 'berserkers_pact_t3',
      name: "Berserker's Pact",
      description: '+50% dmg, +20% speed, -5 armor',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '😤',
      unlocked: true,
      tags: ['melee'],
      damageMultiplier: 1.5,
      speedMultiplier: 1.2,
      armor: -5
    },
    {
      id: 'lucky_strike_t2',
      name: 'Lucky Strike',
      description: '+10% crit, +10% luck',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 30,
      icon: '🍀',
      unlocked: true,
      tags: ['utility'],
      critChance: 0.1,
      luck: 0.1
    },

    // ---- ECONOMY / META ----
    {
      id: 'bargain_bin_t1',
      name: 'Bargain Bin',
      description: '-8% shop prices, +10% gold',
      rarity: 'common',
      tier: ItemTier.Common,
      cost: 14,
      icon: '🏷️',
      unlocked: true,
      tags: ['economic'],
      shopDiscount: 0.08,
      goldBonus: 1.1
    },
    {
      id: 'merchant_scale_t2',
      name: "Merchant's Scale",
      description: '+30% gold, +8% shop discount',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 26,
      icon: '⚖️',
      unlocked: true,
      tags: ['economic'],
      goldBonus: 1.3,
      shopDiscount: 0.08
    },
    {
      id: 'compound_interest_t3',
      name: 'Compound Interest',
      description: 'Wealth becomes firepower: damage scales with unspent gold on hand. +30% gold',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '📈',
      unlocked: true,
      tags: ['economic'],
      goldBonus: 1.3,
      goldScaleDamage: 0.10
    },
    {
      id: 'treasure_map_t3',
      name: 'Treasure Map',
      description: 'Chart the riches: big luck, gold and a wider pickup range. +30% gold, +35% luck, +50% pickup range',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 58,
      icon: '🗺️',
      unlocked: true,
      tags: ['economic', 'utility'],
      goldBonus: 1.3,
      luck: 0.35,
      xpMagnet: 1.5
    },
    {
      id: 'philosophers_stone_t4',
      name: "Philosopher's Stone",
      description: 'Transmute wealth into life: heavy interest & luck, plus regeneration and lifesteal. +30% gold, +15% interest, +35% luck, +5 HP/s, 5% lifesteal',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 150,
      icon: '🔮',
      unlocked: true,
      tags: ['economic', 'defensive'],
      goldBonus: 1.3,
      interestBonus: 0.15,
      luck: 0.35,
      healthRegen: 5,
      lifesteal: 0.05
    },
    {
      id: 'jackpot_t4',
      name: 'Jackpot',
      description: 'Hit the jackpot: massive crits that burst on impact. +20% crit, 2.0x crit dmg, +30% luck',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 142,
      icon: '🎰',
      unlocked: true,
      tags: ['ranged', 'utility'],
      critChance: 0.20,
      critDamageMultiplier: 2.0,
      explosionOnHit: true,
      luck: 0.3
    },

    // ---- AUX-WEAPON deepeners (stack alongside the primary gun) ----
    {
      id: 'satellite_t2',
      name: 'Satellite',
      description: '+1 orbiting orb, orbs hit +20% harder',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 38,
      icon: '🛰️',
      unlocked: true,
      tags: ['utility', 'elemental'],
      orbitOrbs: 1,
      orbitDamageMult: 1.2
    },
    {
      id: 'dervish_t3',
      name: 'Dervish Charm',
      description: 'Whirling blades +40% dmg, +10% speed',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 70,
      icon: '🌀',
      unlocked: true,
      tags: ['melee'],
      auxMelee: true,
      auxMeleeDamageMult: 1.4,
      speedMultiplier: 1.1
    },
    {
      id: 'detonator_t3',
      name: 'Detonator',
      description: 'Drop bombs, blasts hit +50% harder',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 68,
      icon: '💥',
      unlocked: true,
      tags: ['elemental'],
      bombDrop: true,
      bombDamageMult: 1.5
    },
    {
      id: 'shockwave_amp_t3',
      name: 'Shockwave Amplifier',
      description: 'Pulse novas that hit +40% harder',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 66,
      icon: '📡',
      unlocked: true,
      tags: ['elemental'],
      novaPulse: true,
      novaDamageMult: 1.4
    },
    {
      id: 'war_machine_t4',
      name: 'War Machine',
      description: 'Whirling blades + an orbiting orb + pulsing novas, all at once',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 165,
      icon: '🤖',
      unlocked: true,
      tags: ['melee', 'elemental'],
      auxMelee: true,
      orbitOrbs: 1,
      novaPulse: true
    },

    // ==================== CONDITIONAL / TRIGGERED ITEMS ====================
    // The game's first non-static effects: each only pays out while a run CONDITION
    // holds (wave count, current HP, kill streak, gold held), so they reward a play
    // pattern rather than mere ownership. Payout is folded into the per-frame runtime
    // damage/fire-rate multiplier by Game.updateRuntimeModifiers. Stacking duplicates
    // deepens the effect (additive rates). Combat is uncapped by design (enemies scale
    // to meet output), so these are intentionally punchy — they exist to shape builds.
    {
      id: 'grindstone_t3',
      name: 'Grindstone',
      description: 'Permanent +6% damage for every wave you survive this run',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 42,
      icon: '🪨',
      unlocked: true,
      tags: ['melee', 'utility'],
      waveRampDamage: 0.06
    },
    {
      id: 'last_stand_t3',
      name: 'Last Stand',
      description: 'Below 35% HP: +60% damage AND +60% fire rate',
      rarity: 'rare',
      tier: ItemTier.Rare,
      cost: 46,
      icon: '🩸',
      unlocked: true,
      tags: ['defensive', 'melee'],
      lowHpPower: 0.6
    },
    {
      id: 'killing_spree_t3',
      name: 'Killing Spree',
      description: 'Each kill: +4% damage, stacking up to 20× — decays if you stop killing',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 48,
      icon: '💀',
      unlocked: true,
      tags: ['melee'],
      killStackDamage: 0.04
    },
    {
      id: 'juggernaut_t3',
      name: 'Juggernaut Plating',
      description: 'While above 90% HP (unhurt): +40% damage',
      rarity: 'rare',
      tier: ItemTier.Uncommon,
      cost: 40,
      icon: '🛡️',
      unlocked: true,
      tags: ['defensive'],
      highHpPower: 0.4
    },
    {
      id: 'misers_hoard_t3',
      name: "Miser's Hoard",
      description: '+8% damage per 100 gold on hand (caps at +200%) — spend it and you lose it',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 52,
      icon: '💰',
      unlocked: true,
      tags: ['economic'],
      goldScaleDamage: 0.08
    },
    {
      id: 'executioners_axe_t3',
      name: "Executioner's Axe",
      description: 'Instantly kill any non-boss enemy left at or below 15% HP by your hit',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 50,
      icon: '🪓',
      unlocked: true,
      tags: ['melee'],
      executeThreshold: 0.15
    },
    {
      id: 'guillotine_t3',
      name: 'Guillotine',
      description: 'Execute non-boss enemies at or below 25% HP — the swarm never gets to limp away',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 68,
      icon: '⚔️',
      unlocked: true,
      tags: ['melee'],
      executeThreshold: 0.25
    },
    {
      id: 'reapers_scythe_t3',
      name: "Reaper's Scythe",
      description: 'Execute non-boss enemies at or below 33% HP, and each execute still feeds Killing Spree',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 84,
      icon: '☠️',
      unlocked: true,
      tags: ['melee'],
      executeThreshold: 0.33
    },
    {
      id: 'fourleaf_charm_t3',
      name: 'Fourleaf Charm',
      description: 'Lucky: every on-hit status effect (burn, bleed, freeze, chain, doom, wound, multicast) rolls twice and keeps the better result',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 80,
      icon: '🍀',
      unlocked: true,
      tags: ['elemental'],
      slot: 'amulet', // build-defining proc-luck keystone — one at a time
      fourleafCharm: true
    },
    {
      id: 'soul_tithe_t3',
      name: 'Soul Tithe',
      description: 'Every 10th kill drops a health orb, and every 50th kill grants a PERMANENT +1% damage for the rest of the run',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 72,
      icon: '👻',
      unlocked: true,
      tags: ['economic'],
      slot: 'amulet', // run-long on-kill snowball keystone — one at a time
      soulTithe: true
    },
    {
      id: 'ceremonial_daggers_t3',
      name: 'Ceremonial Daggers',
      description: 'On every kill, throw 3 homing spectral daggers that seek nearby enemies — turns kills into a self-sustaining chain',
      rarity: 'legendary',
      tier: ItemTier.Legendary,
      cost: 82,
      icon: '🗡️',
      unlocked: true,
      tags: ['ranged'],
      // trinket (stacks): daggerCount accumulates per copy — buying more = more daggers, so it must remain unlimited-stack
      ceremonialDaggers: 3
    },
    {
      id: 'pen_nib_t3',
      name: 'Pen Nib',
      description: 'Every 10th shot is a loaded shot: triple damage and pierces every enemy in its path',
      rarity: 'epic',
      tier: ItemTier.Rare,
      cost: 55,
      icon: '🎯',
      unlocked: true,
      tags: ['ranged'],
      loadedShot: true
    },
    {
      id: 'war_chest_t3',
      name: 'War Chest',
      description: 'At the end of each wave, bank gold equal to 3× the wave number — an income engine that compounds the longer you survive',
      rarity: 'rare',
      tier: ItemTier.Rare,
      cost: 60,
      icon: '💰',
      unlocked: true,
      tags: ['economic'],
      warChest: 3
    },

    // ==================== GEAR SLOTS (2026-07-05 v2 rework) ====================
    // Dedicated equippable pieces for the 8-slot loadout. Each is hand-tagged with an
    // explicit `slot` so it routes to its holder (one at a time; buying a duplicate
    // UPGRADES it — "Helm +N"). Vertical slice: ~7 per slot, filled to 20+ in follow-ups.

    // ---- HEAD (helmets/hats): crit, luck, vision, utility ----
    { id: 'head_leather_cap', name: 'Leather Cap', description: '+15 max health', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '🧢', unlocked: true, tags: ['defensive'], slot: 'head', maxHealthBonus: 15 },
    { id: 'head_focus_hood', name: 'Focus Hood', description: '+5% crit chance', rarity: 'common', tier: ItemTier.Common, cost: 12, icon: '🎓', unlocked: true, tags: ['ranged'], slot: 'head', critChance: 0.05 },
    { id: 'head_scholar_hat', name: "Scholar's Hat", description: '+30% pickup range', rarity: 'rare', tier: ItemTier.Uncommon, cost: 18, icon: '🎩', unlocked: true, tags: ['utility'], slot: 'head', xpMagnet: 1.3 },
    { id: 'head_iron_helm', name: 'Iron Helm', description: '+4 armor', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '⛑️', unlocked: true, tags: ['defensive'], slot: 'head', armor: 4 },
    { id: 'head_lucky_crown', name: 'Lucky Crown', description: '+15% luck (better shop rarity & drops)', rarity: 'epic', tier: ItemTier.Rare, cost: 40, icon: '👑', unlocked: true, tags: ['economic'], slot: 'head', luck: 0.15 },
    { id: 'head_visor_of_wrath', name: 'Visor of Wrath', description: '+8% crit chance and +25% crit damage', rarity: 'epic', tier: ItemTier.Rare, cost: 48, icon: '🥽', unlocked: true, tags: ['ranged'], slot: 'head', critChance: 0.08, critDamageMultiplier: 1.25 },
    { id: 'head_mind_diadem', name: 'Mind Diadem', description: '+12% doom chance — marks enemies to detonate', rarity: 'legendary', tier: ItemTier.Legendary, cost: 70, icon: '💠', unlocked: true, tags: ['elemental'], slot: 'head', doom: 0.12 },
    { id: 'head_hunters_hood', name: "Hunter's Hood", description: '+10% ranged damage', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '🪖', unlocked: true, tags: ['ranged'], slot: 'head', rangedDamageMult: 1.1 },
    { id: 'head_bone_mask', name: 'Bone Mask', description: '+7% bleed chance', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '💀', unlocked: true, tags: ['melee'], slot: 'head', bleed: 0.07 },
    { id: 'head_padded_coif', name: 'Padded Coif', description: '+12 max health and +1 armor', rarity: 'common', tier: ItemTier.Common, cost: 12, icon: '🧣', unlocked: true, tags: ['defensive'], slot: 'head', maxHealthBonus: 12, armor: 1 },
    { id: 'head_keen_goggles', name: 'Keen Goggles', description: '+7% crit chance', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🥽', unlocked: true, tags: ['ranged'], slot: 'head', critChance: 0.07 },
    { id: 'head_emberglass_visor', name: 'Emberglass Visor', description: '+13% chance to ignite', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🔥', unlocked: true, tags: ['elemental'], slot: 'head', burn: 0.13 },
    { id: 'head_gilded_circlet', name: 'Gilded Circlet', description: '+18% gold earned', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🪙', unlocked: true, tags: ['economic'], slot: 'head', goldBonus: 1.18 },
    { id: 'head_windcaller_hood', name: 'Windcaller Hood', description: '+10% move speed and +8% dodge', rarity: 'rare', tier: ItemTier.Rare, cost: 32, icon: '🌬️', unlocked: true, tags: ['utility'], slot: 'head', speedMultiplier: 1.1, dodge: 0.08 },
    { id: 'head_warhelm', name: 'Warhelm', description: '+6 armor and +15 max health', rarity: 'rare', tier: ItemTier.Rare, cost: 34, icon: '🪓', unlocked: true, tags: ['defensive'], slot: 'head', armor: 6, maxHealthBonus: 15 },
    { id: 'head_predators_crown', name: "Predator's Crown", description: '+12% crit chance and +15% ranged damage', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '🦅', unlocked: true, tags: ['ranged'], slot: 'head', critChance: 0.12, rangedDamageMult: 1.15 },
    { id: 'head_plague_veil', name: 'Plague Veil', description: '+15% ignite and +10% wound (amplifies all DoT)', rarity: 'epic', tier: ItemTier.Rare, cost: 52, icon: '🎭', unlocked: true, tags: ['elemental'], slot: 'head', burn: 0.15, wound: 0.1 },
    { id: 'head_stormcrown', name: 'Stormcrown', description: '+15% chain-lightning chance and +8% fire rate', rarity: 'epic', tier: ItemTier.Rare, cost: 52, icon: '🌩️', unlocked: true, tags: ['elemental'], slot: 'head', chainLightning: 0.15, fireRateMultiplier: 1.08 },
    { id: 'head_crown_of_avarice', name: 'Crown of Avarice', description: '+30% gold, +10% luck and +6% banking interest', rarity: 'legendary', tier: ItemTier.Legendary, cost: 74, icon: '👑', unlocked: true, tags: ['economic'], slot: 'head', goldBonus: 1.3, luck: 0.1, interestBonus: 0.06 },
    { id: 'head_martyrs_halo', name: "Martyr's Halo", description: '+28% damage but -15 max health — a glass-cannon crown', rarity: 'legendary', tier: ItemTier.Legendary, cost: 78, icon: '😇', unlocked: true, tags: ['ranged'], slot: 'head', damageMultiplier: 1.28, maxHealthBonus: -15 },

    // ---- TORSO (body armor): armor, health, thorns, lifesteal ----
    { id: 'torso_padded_vest', name: 'Padded Vest', description: '+20 max health', rarity: 'common', tier: ItemTier.Common, cost: 12, icon: '🦺', unlocked: true, tags: ['defensive'], slot: 'torso', maxHealthBonus: 20 },
    { id: 'torso_chainmail', name: 'Chainmail', description: '+6 armor', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🥋', unlocked: true, tags: ['defensive'], slot: 'torso', armor: 6 },
    { id: 'torso_spiked_cuirass', name: 'Spiked Cuirass', description: '+25% thorns reflect', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '🛡️', unlocked: true, tags: ['defensive'], slot: 'torso', thorns: 0.25 },
    { id: 'torso_vampiric_plate', name: 'Vampiric Plate', description: '+8% lifesteal', rarity: 'epic', tier: ItemTier.Rare, cost: 44, icon: '🩸', unlocked: true, tags: ['defensive'], slot: 'torso', lifesteal: 0.08 },
    { id: 'torso_juggernaut_shell', name: 'Juggernaut Shell', description: '+40 max health and +5 armor', rarity: 'epic', tier: ItemTier.Rare, cost: 55, icon: '🐢', unlocked: true, tags: ['defensive'], slot: 'torso', maxHealthBonus: 40, armor: 5 },
    { id: 'torso_regen_weave', name: 'Regen Weave', description: '+1.5 HP/sec', rarity: 'rare', tier: ItemTier.Uncommon, cost: 28, icon: '🧵', unlocked: true, tags: ['defensive'], slot: 'torso', healthRegen: 1.5 },
    { id: 'torso_aegis_mantle', name: 'Aegis Mantle', description: '+8 armor and +20% thorns', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '🪬', unlocked: true, tags: ['defensive'], slot: 'torso', armor: 8, thorns: 0.2 },
    { id: 'torso_leather_jerkin', name: 'Leather Jerkin', description: '+8 max health and +4% dodge', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '🧥', unlocked: true, tags: ['defensive'], slot: 'torso', maxHealthBonus: 8, dodge: 0.04 },
    { id: 'torso_bramble_hauberk', name: 'Bramble Hauberk', description: '+18% thorns reflect and +10 max health', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '🌵', unlocked: true, tags: ['defensive'], slot: 'torso', thorns: 0.18, maxHealthBonus: 10 },
    { id: 'torso_soulweave_robe', name: 'Soulweave Robe', description: '+10% elemental damage and +15 max health', rarity: 'epic', tier: ItemTier.Rare, cost: 46, icon: '🥻', unlocked: true, tags: ['elemental'], slot: 'torso', elementalDamageMult: 1.1, maxHealthBonus: 15 },
    { id: 'torso_warlords_plate', name: "Warlord's Plate", description: '+25 max health and +12% melee damage', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '🏋️', unlocked: true, tags: ['melee'], slot: 'torso', maxHealthBonus: 25, meleeDamageMult: 1.12 },
    { id: 'torso_second_wind_cuirass', name: 'Second-Wind Cuirass', description: 'While HP is low: +damage and +fire rate; +20 max health', rarity: 'rare', tier: ItemTier.Rare, cost: 44, icon: '🫀', unlocked: true, tags: ['defensive'], slot: 'torso', lowHpPower: 0.4, maxHealthBonus: 20 },
    { id: 'torso_titan_carapace', name: 'Titan Carapace', description: '+50 max health, +10 armor and +1 HP/sec', rarity: 'legendary', tier: ItemTier.Legendary, cost: 78, icon: '🦂', unlocked: true, tags: ['defensive'], slot: 'torso', maxHealthBonus: 50, armor: 10, healthRegen: 1 },

    // ---- LEGS (leg armor): move speed, dodge, health ----
    { id: 'legs_travel_pants', name: 'Travel Pants', description: '+10% move speed', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '👖', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.1 },
    { id: 'legs_greaves', name: 'Steel Greaves', description: '+3 armor and +15 max health', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🦿', unlocked: true, tags: ['defensive'], slot: 'legs', armor: 3, maxHealthBonus: 15 },
    { id: 'legs_dancer_leggings', name: "Dancer's Leggings", description: '+12% dodge chance', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '🩰', unlocked: true, tags: ['utility'], slot: 'legs', dodge: 0.12 },
    { id: 'legs_windrunner', name: 'Windrunner Leggings', description: '+18% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 40, icon: '💨', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.18 },
    { id: 'legs_phase_trousers', name: 'Phase Trousers', description: '+18% dodge and +8% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '👻', unlocked: true, tags: ['utility'], slot: 'legs', dodge: 0.18, speedMultiplier: 1.08 },
    { id: 'legs_titan_legplates', name: 'Titan Legplates', description: '+35 max health and +4 armor', rarity: 'rare', tier: ItemTier.Rare, cost: 46, icon: '🦵', unlocked: true, tags: ['defensive'], slot: 'legs', maxHealthBonus: 35, armor: 4 },
    { id: 'legs_stormstride', name: 'Stormstride', description: '+22% move speed and +10% dodge', rarity: 'legendary', tier: ItemTier.Legendary, cost: 68, icon: '⚡', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.22, dodge: 0.1 },
    { id: 'legs_padded_breeches', name: 'Padded Breeches', description: '+12 max health', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '🩳', unlocked: true, tags: ['defensive'], slot: 'legs', maxHealthBonus: 12 },
    { id: 'legs_scout_trousers', name: 'Scout Trousers', description: '+9% move speed', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '🥾', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.09 },
    { id: 'legs_quick_kilt', name: 'Quick Kilt', description: '+6% dodge chance', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '🎽', unlocked: true, tags: ['utility'], slot: 'legs', dodge: 0.06 },
    { id: 'legs_hunters_chaps', name: "Hunter's Chaps", description: '+8% ranged damage and +6% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '👖', unlocked: true, tags: ['ranged'], slot: 'legs', rangedDamageMult: 1.08, speedMultiplier: 1.06 },
    { id: 'legs_ironbound_leggings', name: 'Ironbound Leggings', description: '+4 armor and +8% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '⛓️', unlocked: true, tags: ['defensive'], slot: 'legs', armor: 4, speedMultiplier: 1.08 },
    { id: 'legs_bloodrunner_leggings', name: 'Bloodrunner Leggings', description: '+6% lifesteal and +8% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 27, icon: '🩸', unlocked: true, tags: ['melee'], slot: 'legs', lifesteal: 0.06, speedMultiplier: 1.08 },
    { id: 'legs_gale_greaves', name: 'Gale Greaves', description: '+16% move speed and +10% fire rate', rarity: 'rare', tier: ItemTier.Rare, cost: 40, icon: '🌪️', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.16, fireRateMultiplier: 1.1 },
    { id: 'legs_serpents_wrap', name: "Serpent's Wrap", description: '+10% bleed chance and +8% move speed', rarity: 'rare', tier: ItemTier.Rare, cost: 38, icon: '🐍', unlocked: true, tags: ['elemental'], slot: 'legs', bleed: 0.1, speedMultiplier: 1.08 },
    { id: 'legs_berserker_kilt', name: 'Berserker Kilt', description: '+14% melee damage and +8% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 48, icon: '🪘', unlocked: true, tags: ['melee'], slot: 'legs', meleeDamageMult: 1.14, speedMultiplier: 1.08 },
    { id: 'legs_phantom_leggings', name: 'Phantom Leggings', description: '+20% dodge and +6% damage', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '🌫️', unlocked: true, tags: ['utility'], slot: 'legs', dodge: 0.2, damageMultiplier: 1.06 },
    { id: 'legs_juggernaut_greaves', name: 'Juggernaut Greaves', description: '+30 max health and +6 armor', rarity: 'epic', tier: ItemTier.Rare, cost: 52, icon: '🛡️', unlocked: true, tags: ['defensive'], slot: 'legs', maxHealthBonus: 30, armor: 6 },
    { id: 'legs_windshear_leggings', name: 'Windshear Leggings', description: '+24% move speed and +14% dodge', rarity: 'legendary', tier: ItemTier.Legendary, cost: 70, icon: '💨', unlocked: true, tags: ['utility'], slot: 'legs', speedMultiplier: 1.24, dodge: 0.14 },
    { id: 'legs_warmarch_plates', name: 'War-March Plates', description: 'Permanent +damage for each wave survived; +20 max health', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '🥁', unlocked: true, tags: ['defensive'], slot: 'legs', waveRampDamage: 0.06, maxHealthBonus: 20 },

    // ---- FEET (boots): move speed, dodge, pickup range ----
    { id: 'feet_sturdy_boots', name: 'Sturdy Boots', description: '+8% move speed', rarity: 'common', tier: ItemTier.Common, cost: 9, icon: '🥾', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.08 },
    { id: 'feet_swift_sandals', name: 'Swift Sandals', description: '+14% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 20, icon: '🩴', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.14 },
    { id: 'feet_magnet_boots', name: 'Magnet Boots', description: '+40% pickup range', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🧲', unlocked: true, tags: ['utility'], slot: 'feet', xpMagnet: 1.4 },
    { id: 'feet_dodge_kicks', name: 'Dodge Kicks', description: '+10% dodge chance', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '👟', unlocked: true, tags: ['utility'], slot: 'feet', dodge: 0.1 },
    { id: 'feet_hermes_treads', name: 'Hermes Treads', description: '+20% move speed and +25% pickup range', rarity: 'epic', tier: ItemTier.Rare, cost: 46, icon: '🪽', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.2, xpMagnet: 1.25 },
    { id: 'feet_ironshod', name: 'Ironshod Boots', description: '+3 armor and +6% move speed', rarity: 'rare', tier: ItemTier.Rare, cost: 30, icon: '🥿', unlocked: true, tags: ['defensive'], slot: 'feet', armor: 3, speedMultiplier: 1.06 },
    { id: 'feet_blinkstep', name: 'Blinkstep Boots', description: '+16% dodge and +12% move speed', rarity: 'legendary', tier: ItemTier.Legendary, cost: 66, icon: '✨', unlocked: true, tags: ['utility'], slot: 'feet', dodge: 0.16, speedMultiplier: 1.12 },
    { id: 'feet_worn_moccasins', name: 'Worn Moccasins', description: '+6% move speed and +8% pickup range', rarity: 'common', tier: ItemTier.Common, cost: 9, icon: '🥿', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.06, xpMagnet: 1.08 },
    { id: 'feet_gripped_cleats', name: 'Gripped Cleats', description: '+5% dodge chance', rarity: 'common', tier: ItemTier.Common, cost: 9, icon: '🦶', unlocked: true, tags: ['utility'], slot: 'feet', dodge: 0.05 },
    { id: 'feet_traveler_boots', name: 'Traveler Boots', description: '+10% move speed', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '👢', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.1 },
    { id: 'feet_thornsole_boots', name: 'Thornsole Boots', description: '+12% thorns reflect and +8% move speed', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🌿', unlocked: true, tags: ['defensive'], slot: 'feet', thorns: 0.12, speedMultiplier: 1.08 },
    { id: 'feet_swiftkick_boots', name: 'Swiftkick Boots', description: '+8% move speed and +6% fire rate', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🥋', unlocked: true, tags: ['ranged'], slot: 'feet', speedMultiplier: 1.08, fireRateMultiplier: 1.06 },
    { id: 'feet_prospector_boots', name: 'Prospector Boots', description: '+15% gold and +20% pickup range', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '⛏️', unlocked: true, tags: ['economic'], slot: 'feet', goldBonus: 1.15, xpMagnet: 1.2 },
    { id: 'feet_emberwalk_boots', name: 'Emberwalk Boots', description: '+12% ignite chance and +8% move speed', rarity: 'rare', tier: ItemTier.Rare, cost: 36, icon: '🔥', unlocked: true, tags: ['elemental'], slot: 'feet', burn: 0.12, speedMultiplier: 1.08 },
    { id: 'feet_shadowstep_boots', name: 'Shadowstep Boots', description: '+18% dodge and +10% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 48, icon: '🌑', unlocked: true, tags: ['utility'], slot: 'feet', dodge: 0.18, speedMultiplier: 1.1 },
    { id: 'feet_bloodhound_boots', name: 'Bloodhound Boots', description: 'Each kill adds a decaying +damage stack; +12% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '🐾', unlocked: true, tags: ['melee'], slot: 'feet', killStackDamage: 0.05, speedMultiplier: 1.12 },
    { id: 'feet_seven_league_boots', name: 'Seven-League Boots', description: '+26% move speed and +25% pickup range', rarity: 'legendary', tier: ItemTier.Legendary, cost: 70, icon: '🪽', unlocked: true, tags: ['utility'], slot: 'feet', speedMultiplier: 1.26, xpMagnet: 1.25 },

    // ---- RING (rings): offense — damage, fire rate, crit ----
    { id: 'ring_copper_band', name: 'Copper Band', description: '+12% damage', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '💍', unlocked: true, tags: ['melee'], slot: 'ring', damageMultiplier: 1.12 },
    { id: 'ring_swift_signet', name: 'Swift Signet', description: '+12% fire rate', rarity: 'rare', tier: ItemTier.Uncommon, cost: 20, icon: '💫', unlocked: true, tags: ['ranged'], slot: 'ring', fireRateMultiplier: 1.12 },
    { id: 'ring_keen_loop', name: 'Keen Loop', description: '+6% crit chance', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🔆', unlocked: true, tags: ['ranged'], slot: 'ring', critChance: 0.06 },
    { id: 'ring_bloodstone', name: 'Bloodstone Ring', description: '+18% damage', rarity: 'epic', tier: ItemTier.Rare, cost: 40, icon: '❤️‍🔥', unlocked: true, tags: ['melee'], slot: 'ring', damageMultiplier: 1.18 },
    { id: 'ring_gilded_band', name: 'Gilded Band', description: '+20% gold earned', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '💛', unlocked: true, tags: ['economic'], slot: 'ring', goldBonus: 1.2 },
    { id: 'ring_serpent_coil', name: 'Serpent Coil', description: '+10% bleed chance', rarity: 'epic', tier: ItemTier.Rare, cost: 44, icon: '🐍', unlocked: true, tags: ['elemental'], slot: 'ring', bleed: 0.1 },
    { id: 'ring_conquerors_seal', name: "Conqueror's Seal", description: '+20% damage and +10% fire rate', rarity: 'legendary', tier: ItemTier.Legendary, cost: 74, icon: '🏵️', unlocked: true, tags: ['melee'], slot: 'ring', damageMultiplier: 1.2, fireRateMultiplier: 1.1 },
    { id: 'ring_iron_signet', name: 'Iron Signet', description: '+10% damage', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '⚙️', unlocked: true, tags: ['melee'], slot: 'ring', damageMultiplier: 1.1 },
    { id: 'ring_spark_ring', name: 'Spark Ring', description: '+8% fire rate', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '⚡', unlocked: true, tags: ['ranged'], slot: 'ring', fireRateMultiplier: 1.08 },
    { id: 'ring_ember_ring', name: 'Ember Ring', description: '+11% chance to ignite', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🔥', unlocked: true, tags: ['elemental'], slot: 'ring', burn: 0.11 },
    { id: 'ring_frost_ring', name: 'Frost Ring', description: '+13% chance to freeze', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '❄️', unlocked: true, tags: ['elemental'], slot: 'ring', freeze: 0.13 },
    { id: 'ring_hawkeye_ring', name: 'Hawkeye Ring', description: '+7% crit chance and +8% ranged damage', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '🎯', unlocked: true, tags: ['ranged'], slot: 'ring', critChance: 0.07, rangedDamageMult: 1.08 },
    { id: 'ring_leech_ring', name: 'Leech Ring', description: '+7% lifesteal', rarity: 'rare', tier: ItemTier.Rare, cost: 38, icon: '🦟', unlocked: true, tags: ['melee'], slot: 'ring', lifesteal: 0.07 },
    { id: 'ring_doombind_ring', name: 'Doombind Ring', description: '+12% doom chance and +10% wound', rarity: 'epic', tier: ItemTier.Rare, cost: 48, icon: '☠️', unlocked: true, tags: ['elemental'], slot: 'ring', doom: 0.12, wound: 0.1 },
    { id: 'ring_misers_ring', name: "Miser's Ring", description: '+damage scaling with unspent gold; +15% gold', rarity: 'epic', tier: ItemTier.Rare, cost: 46, icon: '🤑', unlocked: true, tags: ['economic'], slot: 'ring', goldScaleDamage: 0.05, goldBonus: 1.15 },
    { id: 'ring_sovereign_ring', name: 'Sovereign Ring', description: '+22% damage, +12% fire rate and +8% crit chance', rarity: 'legendary', tier: ItemTier.Legendary, cost: 76, icon: '🏆', unlocked: true, tags: ['melee'], slot: 'ring', damageMultiplier: 1.22, fireRateMultiplier: 1.12, critChance: 0.08 },

    // ---- AMULET (a single build-defining necklace/charm): keystone-flavoured mix of
    // offense, survival, status and economy so the one worn slot is a real build pick.
    // Joins the 3 hand-placed amulets above (Health Pendant + Soul Tithe + Four-Leaf
    // Charm keystones) to bring the slot to 20 per Felix's "20+ of each type" ask.
    { id: 'am_copper_locket', name: 'Copper Locket', description: '+8% gold and +5 max health', rarity: 'common', tier: ItemTier.Common, cost: 9, icon: '📿', unlocked: true, tags: ['economic'], slot: 'amulet', goldBonus: 1.08, maxHealthBonus: 5 },
    { id: 'am_hunters_fang', name: "Hunter's Fang", description: '+8% damage', rarity: 'common', tier: ItemTier.Common, cost: 11, icon: '🦷', unlocked: true, tags: ['ranged'], slot: 'amulet', damageMultiplier: 1.08 },
    { id: 'am_warding_bead', name: 'Warding Bead', description: '+2 armor and +0.4 HP/sec', rarity: 'common', tier: ItemTier.Common, cost: 10, icon: '🧿', unlocked: true, tags: ['defensive'], slot: 'amulet', armor: 2, healthRegen: 0.4 },
    { id: 'am_ember_pendant', name: 'Ember Pendant', description: '+12% chance to ignite; +5% elemental damage', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '🔥', unlocked: true, tags: ['elemental'], slot: 'amulet', burn: 0.12, elementalDamageMult: 1.05 },
    { id: 'am_frost_charm', name: 'Frostbite Charm', description: '+14% chance to freeze enemies on hit', rarity: 'rare', tier: ItemTier.Uncommon, cost: 22, icon: '❄️', unlocked: true, tags: ['elemental'], slot: 'amulet', freeze: 0.14 },
    { id: 'am_serpent_talisman', name: 'Serpent Talisman', description: '+12% bleed chance and +6% damage', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🐍', unlocked: true, tags: ['melee'], slot: 'amulet', bleed: 0.12, damageMultiplier: 1.06 },
    { id: 'am_zephyr', name: 'Zephyr Amulet', description: '+12% move speed and +6% fire rate', rarity: 'rare', tier: ItemTier.Uncommon, cost: 24, icon: '🌀', unlocked: true, tags: ['utility'], slot: 'amulet', speedMultiplier: 1.12, fireRateMultiplier: 1.06 },
    { id: 'am_ironwood_medallion', name: 'Ironwood Medallion', description: '+5 armor and +12 max health', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '🪵', unlocked: true, tags: ['defensive'], slot: 'amulet', armor: 5, maxHealthBonus: 12 },
    { id: 'am_lucky_coin', name: 'Lucky Coin Necklace', description: '+12% luck and +10% gold', rarity: 'rare', tier: ItemTier.Uncommon, cost: 26, icon: '🪙', unlocked: true, tags: ['economic'], slot: 'amulet', luck: 0.12, goldBonus: 1.1 },
    { id: 'am_vampiric_choker', name: 'Vampiric Choker', description: 'Heal for 8% of damage dealt; +8% damage', rarity: 'epic', tier: ItemTier.Rare, cost: 44, icon: '🩸', unlocked: true, tags: ['melee'], slot: 'amulet', lifesteal: 0.08, damageMultiplier: 1.08 },
    { id: 'am_berserkers_torc', name: "Berserker's Torc", description: '+18% damage but -8% move speed', rarity: 'epic', tier: ItemTier.Rare, cost: 46, icon: '⚔️', unlocked: true, tags: ['melee'], slot: 'amulet', damageMultiplier: 1.18, speedMultiplier: 0.92 },
    { id: 'am_sentinel_pendant', name: 'Sentinel Pendant', description: '+7 armor and +10% dodge', rarity: 'epic', tier: ItemTier.Rare, cost: 48, icon: '🔰', unlocked: true, tags: ['defensive'], slot: 'amulet', armor: 7, dodge: 0.1 },
    { id: 'am_gilded_scarab', name: 'Gilded Scarab', description: '+25% gold and +8% banking interest', rarity: 'epic', tier: ItemTier.Rare, cost: 44, icon: '🪲', unlocked: true, tags: ['economic'], slot: 'amulet', goldBonus: 1.25, interestBonus: 0.08 },
    { id: 'am_tacticians_sigil', name: "Tactician's Sigil", description: '+12% crit chance and +20% crit damage', rarity: 'epic', tier: ItemTier.Rare, cost: 50, icon: '✴️', unlocked: true, tags: ['ranged'], slot: 'amulet', critChance: 0.12, critDamageMultiplier: 1.2 },
    { id: 'am_doomcaller_idol', name: 'Doomcaller Idol', description: '+18% doom chance and +15% wound (amplifies all damage-over-time)', rarity: 'legendary', tier: ItemTier.Legendary, cost: 76, icon: '💀', unlocked: true, tags: ['elemental'], slot: 'amulet', doom: 0.18, wound: 0.15 },
    { id: 'am_phoenix_tear', name: 'Phoenix Tear', description: '+30 max health, +2 HP/sec and +10% dodge', rarity: 'legendary', tier: ItemTier.Legendary, cost: 78, icon: '💧', unlocked: true, tags: ['defensive'], slot: 'amulet', maxHealthBonus: 30, healthRegen: 2, dodge: 0.1 },
    { id: 'am_glass_heart', name: 'Glass Heart Locket', description: '+35% damage but -20 max health — a glass-cannon keystone', rarity: 'legendary', tier: ItemTier.Legendary, cost: 80, icon: '💎', unlocked: true, tags: ['ranged'], slot: 'amulet', damageMultiplier: 1.35, maxHealthBonus: -20 },

    // ==================== BUILD-LOCK LEGENDARIES (drawback-gated power) ====================
    // Felix's ask: "A really strong item should have negative side effects effectively
    // locking in a build." Each is far stronger on its upside than a normal legendary, paid
    // for with a REAL downside (rendered red on the card) that commits you to one archetype:
    // a melee lord can't also snipe, a glass cannon can't also tank. They stack (deepening
    // the lock) and carry a premium cost. Not a stat nudge — a build oath.
    { id: 'bl_bloodforge_gauntlet', name: 'Bloodforge Gauntlet', description: 'Melee incarnate: colossal swing power and heavy lifesteal, but your shots barely scratch. All-in on melee.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 190, icon: '🥊', unlocked: true, tags: ['melee'], slot: 'ring', meleeDamageMult: 2.2, lifesteal: 0.30, rangedDamageMult: 0.2 },
    { id: 'bl_prism_of_ruin', name: 'Prism of Ruin', description: 'Devastating raw power and crit, but your body is glass. One mistake ends the run.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 185, icon: '🔺', unlocked: true, tags: ['ranged', 'melee'], slot: 'amulet', damageMultiplier: 2.4, critChance: 0.25, maxHealthBonus: -65 },
    { id: 'bl_tempest_crown', name: 'Tempest Crown', description: 'Storms answer your call: huge elemental power and chaining lightning. Physical damage withers, so the build must be pure elemental.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 195, icon: '🌩️', unlocked: true, tags: ['elemental'], slot: 'head', elementalDamageMult: 2.0, chainLightning: 0.35, meleeDamageMult: 0.45, rangedDamageMult: 0.65 },
    { id: 'bl_titans_bulwark', name: "Titan's Bulwark", description: 'An immovable fortress: massive armor, health and reflect. You hit slow and move like stone, an anvil not a dancer.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 190, icon: '🛡️', unlocked: true, tags: ['defensive'], slot: 'torso', armor: 14, maxHealthBonus: 150, thorns: 0.5, speedMultiplier: 0.6, fireRateMultiplier: 0.7 },
    { id: 'bl_assassins_sigil', name: "Assassin's Sigil", description: 'Every crit is a death sentence, but a non-crit is a tickle. Live and die by crit chance.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 185, icon: '🎯', unlocked: true, tags: ['ranged', 'melee'], slot: 'ring', critChance: 0.5, critDamageMultiplier: 2.4, damageMultiplier: 0.5 },
    { id: 'bl_overclocked_trigger', name: 'Overclocked Trigger', description: 'A wall of bullets: blistering fire rate and extra projectiles, each hit feather-light. Drown them in volume.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 185, icon: '⚙️', unlocked: true, tags: ['ranged'], slot: 'ring', fireRateMultiplier: 2.2, multishot: 2, damageMultiplier: 0.55 },
    { id: 'bl_leechbound_pact', name: 'Leechbound Pact', description: 'Your blade drinks deeply and hits like a truck, but your flesh is thin and unarmored. Sustain through slaughter or die.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 190, icon: '🧛', unlocked: true, tags: ['melee'], slot: 'amulet', lifesteal: 0.45, meleeDamageMult: 1.9, maxHealthBonus: -50, armor: -4 },
    { id: 'bl_martyrs_ember', name: "Martyr's Ember", description: 'Power floods in as death nears: enormous damage and fire rate while wounded, and a smaller health pool to keep you on the edge.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 185, icon: '🔥', unlocked: true, tags: ['melee'], slot: 'head', lowHpPower: 0.9, maxHealthBonus: -40, armor: -3 },

    // ==================== ACHIEVEMENT REWARDS (unlock-gated signature gear) ====================
    // Felix's ask: "achievements which unlock new items & equipment ... beat wave X with class X
    // unlocks an amulet that is good for that class." These start LOCKED (unlocked: false) and are
    // flipped on by AchievementSystem when the milestone is met. Each class item leans HARD into
    // that class's arm so the reward feels tailor-made; the two milestone relics are class-neutral.
    // They enter the shop pool like any other item once unlocked (and can be click-disabled).
    { id: 'ach_gunners_bandolier', name: "Gunner's Bandolier", description: '+20% damage, +15% fire rate and +6% crit. The all-rounder\'s signature kit.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 70, icon: '🎖️', unlocked: false, tags: ['ranged'], slot: 'ring', damageMultiplier: 1.2, fireRateMultiplier: 1.15, critChance: 0.06 },
    { id: 'ach_berserkers_totem', name: "Berserker's Totem", description: '+35% melee damage, execute enemies under 12% HP and +25 max health.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '🔱', unlocked: false, tags: ['melee'], slot: 'amulet', meleeDamageMult: 1.35, executeThreshold: 0.12, maxHealthBonus: 25 },
    { id: 'ach_arcanists_focus', name: "Arcanist's Focus", description: '+14% crit chance, +40% crit damage and +2 pierce. Skewer the line.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '🔮', unlocked: false, tags: ['ranged', 'elemental'], slot: 'amulet', critChance: 0.14, critDamageMultiplier: 1.4, piercing: 2 },
    { id: 'ach_rangers_quiver', name: "Ranger's Quiver", description: '+30% fire rate, +1 projectile and +8% move speed. Never stop moving.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '🏹', unlocked: false, tags: ['ranged'], slot: 'amulet', fireRateMultiplier: 1.3, multishot: 1, speedMultiplier: 1.08 },
    { id: 'ach_prospectors_lockbox', name: "Prospector's Lockbox", description: '+40% gold, +25% luck and +10% banking interest. Get rich, stay rich.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '📦', unlocked: false, tags: ['economic'], slot: 'amulet', goldBonus: 1.4, luck: 0.25, interestBonus: 0.1 },
    { id: 'ach_reavers_chalice', name: "Reaver's Chalice", description: '+12% lifesteal, +3 HP/sec and +40 max health. Heal off every kill.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '🍷', unlocked: false, tags: ['defensive', 'melee'], slot: 'amulet', lifesteal: 0.12, healthRegen: 3, maxHealthBonus: 40 },
    { id: 'ach_brawlers_warplate', name: "Brawler's Warplate", description: '+8 armor, +35% thorns, +1 knockback and +30 max health. A walking fortress.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 72, icon: '🛡️', unlocked: false, tags: ['defensive'], slot: 'torso', armor: 8, thorns: 0.35, knockback: 1, maxHealthBonus: 30 },
    { id: 'ach_survivors_charm', name: "Survivor's Charm", description: '+30 max health, +3 armor and +1 HP/sec. Earned by reaching wave 15.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 68, icon: '🍀', unlocked: false, tags: ['defensive'], slot: 'ring', maxHealthBonus: 30, armor: 3, healthRegen: 1 },
    { id: 'ach_veterans_medal', name: "Veteran's Medal", description: '+25% damage, +25 max health and +5% crit. Earned by reaching wave 20.', rarity: 'legendary', tier: ItemTier.Legendary, cost: 74, icon: '🏅', unlocked: false, tags: ['ranged', 'melee'], slot: 'amulet', damageMultiplier: 1.25, maxHealthBonus: 25, critChance: 0.05 }
];
