// Advanced item and upgrade system with tiers, tags, and Brotato-inspired mechanics

export const ItemTier = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Legendary: 4
} as const;

export type ItemTier = typeof ItemTier[keyof typeof ItemTier];

export type ItemTag = 'melee' | 'ranged' | 'defensive' | 'economic' | 'elemental' | 'utility';

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

  // Stat modifiers
  damageMultiplier?: number;
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
      description: '+30% XP range',
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

  static getRandomItems(count: number, wave: number = 1): Item[] {
    // Filter items based on wave progression (tier unlock system)
    const availableItems = this.getUnlockedItems().filter(item => {
      if (wave <= 2) return item.tier === ItemTier.Common;
      if (wave <= 5) return item.tier <= ItemTier.Uncommon;
      if (wave <= 10) return item.tier <= ItemTier.Rare;
      return true; // All tiers available
    });

    const shuffled = [...availableItems].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
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

  // Base stats - BUFFED for better early game (Wave 1 too hard fix)
  baseDamage: number = 15; // Was 10 - 50% increase
  baseFireRate: number = 2.5; // Was 2 - 25% increase (Shots per second)
  baseSpeed: number = 200;
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

  addItem(item: Item): void {
    this.items.push(item);
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
    return damage;
  }

  getFireRate(): number {
    let rate = this.baseFireRate;
    this.items.forEach(item => {
      if (item.fireRateMultiplier) rate *= item.fireRateMultiplier;
    });
    return rate;
  }

  getSpeed(): number {
    let speed = this.baseSpeed;
    this.items.forEach(item => {
      if (item.speedMultiplier) speed *= item.speedMultiplier;
    });
    return speed;
  }

  getMaxHealth(): number {
    let health = this.baseMaxHealth;
    this.items.forEach(item => {
      if (item.maxHealthBonus) health += item.maxHealthBonus;
    });
    return Math.max(1, health);
  }

  getCritChance(): number {
    let chance = this.baseCritChance;
    this.items.forEach(item => {
      if (item.critChance) chance += item.critChance;
    });
    return Math.min(1, chance);
  }

  getCritMultiplier(): number {
    let mult = this.baseCritMultiplier;
    this.items.forEach(item => {
      if (item.critDamageMultiplier) mult *= item.critDamageMultiplier;
    });
    return mult;
  }

  getHealthRegen(): number {
    let regen = 0;
    this.items.forEach(item => {
      if (item.healthRegen) regen += item.healthRegen;
    });
    return regen;
  }

  getArmor(): number {
    let armor = 0;
    this.items.forEach(item => {
      if (item.armor) armor += item.armor;
    });
    return armor;
  }

  getLifesteal(): number {
    let lifesteal = 0;
    this.items.forEach(item => {
      if (item.lifesteal) lifesteal += item.lifesteal;
    });
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
    return pierce;
  }

  getXPMagnet(): number {
    let magnet = 1;
    this.items.forEach(item => {
      if (item.xpMagnet) magnet *= item.xpMagnet;
    });
    return magnet;
  }

  getGoldBonus(): number {
    let bonus = 1;
    this.items.forEach(item => {
      if (item.goldBonus) bonus *= item.goldBonus;
    });
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
    return Math.min(1, chance);
  }

  getFreezeChance(): number {
    let chance = 0;
    this.items.forEach(item => {
      if (item.freeze) chance += item.freeze;
    });
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
    return Math.min(0.5, discount); // Max 50% discount
  }

  getRecycleBonus(): number {
    let bonus = 0;
    this.items.forEach(item => {
      if (item.recycleBonus) bonus += item.recycleBonus;
    });
    return bonus;
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
    // Dynamic pricing formula (increases with wave)
    const basePrice = item.cost;
    const waveInflation = basePrice * 0.1 * wave;
    let finalPrice = basePrice + wave + waveInflation;

    // Apply shop discount
    const discount = this.getShopDiscount();
    finalPrice *= (1 - discount);

    return Math.max(1, Math.floor(finalPrice));
  }

  // Calculate recycle value (25% base + recycle bonus)
  getRecycleValue(item: Item): number {
    const baseValue = item.cost * 0.25;
    const bonus = this.getRecycleBonus();
    return Math.floor(baseValue * (1 + bonus));
  }
}
