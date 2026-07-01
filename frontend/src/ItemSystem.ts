// Item and upgrade system with synergies

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  cost: number;
  icon: string;
  unlocked: boolean;

  // Stat modifiers
  damageMultiplier?: number;
  fireRateMultiplier?: number;
  critChance?: number; // Additive
  critDamageMultiplier?: number; // Multiplicative
  speedMultiplier?: number;
  maxHealthBonus?: number; // Additive
  healthRegen?: number; // HP per second

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
}

export class ItemDatabase {
  private static items: Item[] = [
    // === COMMON ITEMS ===
    {
      id: 'attack_speed',
      name: 'Attack Speed',
      description: '+20% fire rate',
      rarity: 'common',
      cost: 50,
      icon: '⚡',
      unlocked: true,
      fireRateMultiplier: 1.2
    },
    {
      id: 'damage',
      name: 'Damage',
      description: '+20% damage',
      rarity: 'common',
      cost: 50,
      icon: '⚔️',
      unlocked: true,
      damageMultiplier: 1.2
    },
    {
      id: 'movement_speed',
      name: 'Movement Speed',
      description: '+15% move speed',
      rarity: 'common',
      cost: 40,
      icon: '👟',
      unlocked: true,
      speedMultiplier: 1.15
    },
    {
      id: 'max_hp',
      name: 'Max HP',
      description: '+25 max health',
      rarity: 'common',
      cost: 60,
      icon: '❤️',
      unlocked: true,
      maxHealthBonus: 25
    },
    {
      id: 'hp_regen',
      name: 'HP Regen',
      description: '+1 HP per second',
      rarity: 'common',
      cost: 55,
      icon: '💚',
      unlocked: true,
      healthRegen: 1
    },
    {
      id: 'xp_magnet',
      name: 'XP Magnet',
      description: '+50% XP pickup range',
      rarity: 'common',
      cost: 45,
      icon: '🧲',
      unlocked: true,
      xpMagnet: 1.5
    },

    // === RARE ITEMS ===
    {
      id: 'crit_chance',
      name: 'Crit Chance',
      description: '+15% crit chance',
      rarity: 'rare',
      cost: 80,
      icon: '🎯',
      unlocked: true,
      critChance: 0.15
    },
    {
      id: 'crit_damage',
      name: 'Crit Damage',
      description: 'Crits do +50% damage',
      rarity: 'rare',
      cost: 80,
      icon: '💥',
      unlocked: true,
      critDamageMultiplier: 1.5
    },
    {
      id: 'projectile_count',
      name: 'Projectile Count',
      description: 'Fire +1 projectile',
      rarity: 'rare',
      cost: 90,
      icon: '🔱',
      unlocked: true,
      multishot: 1
    },
    {
      id: 'piercing',
      name: 'Piercing',
      description: 'Bullets pierce +1 enemy',
      rarity: 'rare',
      cost: 85,
      icon: '🎯',
      unlocked: true,
      piercing: 1
    },
    {
      id: 'lifesteal',
      name: 'Lifesteal',
      description: 'Heal 5% of damage dealt',
      rarity: 'rare',
      cost: 90,
      icon: '🩸',
      unlocked: true,
      lifesteal: 0.05
    },
    {
      id: 'thorns',
      name: 'Thorns',
      description: 'Reflect 20% damage taken',
      rarity: 'rare',
      cost: 75,
      icon: '🌵',
      unlocked: true,
      thorns: 0.2
    },
    {
      id: 'gold_bonus',
      name: 'Gold Bonus',
      description: '+20% gold from kills',
      rarity: 'rare',
      cost: 70,
      icon: '💰',
      unlocked: true,
      goldBonus: 1.2
    },
    {
      id: 'dodge',
      name: 'Dodge',
      description: '10% chance to evade damage',
      rarity: 'rare',
      cost: 85,
      icon: '💨',
      unlocked: true,
      dodge: 0.1
    },

    // === EPIC ITEMS ===
    {
      id: 'homing',
      name: 'Homing',
      description: 'Bullets curve toward enemies',
      rarity: 'epic',
      cost: 120,
      icon: '🎯',
      unlocked: true,
      homing: true
    },
    {
      id: 'explosive',
      name: 'Explosive',
      description: 'Bullets explode on hit',
      rarity: 'epic',
      cost: 130,
      icon: '💣',
      unlocked: true,
      explosionOnHit: true
    },
    {
      id: 'chain_lightning',
      name: 'Chain Lightning',
      description: '20% chance to chain to nearby enemy',
      rarity: 'epic',
      cost: 140,
      icon: '⚡',
      unlocked: true,
      chainLightning: 0.2
    },
    {
      id: 'shield',
      name: 'Shield',
      description: '50 HP shield (regenerates out of combat)',
      rarity: 'epic',
      cost: 110,
      icon: '🛡️',
      unlocked: true,
      shield: true
    },
    {
      id: 'poison',
      name: 'Poison',
      description: 'Attacks apply DoT (5 dmg/sec, 3s)',
      rarity: 'epic',
      cost: 125,
      icon: '☠️',
      unlocked: true,
      poison: true
    },
    {
      id: 'freeze',
      name: 'Freeze',
      description: '10% chance to slow enemy 50% for 2s',
      rarity: 'epic',
      cost: 115,
      icon: '❄️',
      unlocked: true,
      freeze: 0.1
    },

    // === LEGENDARY ITEMS ===
    {
      id: 'mega_damage',
      name: 'Berserker Rage',
      description: '+50% damage',
      rarity: 'legendary',
      cost: 200,
      icon: '⚔️',
      unlocked: true,
      damageMultiplier: 1.5
    },
    {
      id: 'rapid_fire',
      name: 'Rapid Fire',
      description: '+50% fire rate',
      rarity: 'legendary',
      cost: 180,
      icon: '🔫',
      unlocked: true,
      fireRateMultiplier: 1.5
    },
    {
      id: 'glass_cannon',
      name: 'Glass Cannon',
      description: '+100% damage, -50% health',
      rarity: 'legendary',
      cost: 220,
      icon: '💀',
      unlocked: true,
      damageMultiplier: 2.0,
      maxHealthBonus: -50
    },
    {
      id: 'knockback',
      name: 'Knockback',
      description: 'Massive knockback on hit',
      rarity: 'legendary',
      cost: 160,
      icon: '👊',
      unlocked: true,
      knockback: 300
    }
  ];

  static getAllItems(): Item[] {
    return [...this.items];
  }

  static getUnlockedItems(): Item[] {
    return this.items.filter(item => item.unlocked);
  }

  static getItemById(id: string): Item | undefined {
    return this.items.find(item => item.id === id);
  }

  static getRandomItems(count: number): Item[] {
    const unlocked = this.getUnlockedItems();
    const shuffled = [...unlocked].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  static unlockItem(id: string): void {
    const item = this.items.find(item => item.id === id);
    if (item) {
      item.unlocked = true;
    }
  }
}

// Player stats calculated from items
export class PlayerStats {
  items: Item[] = [];

  // Base stats
  baseDamage: number = 10;
  baseFireRate: number = 2; // Shots per second
  baseSpeed: number = 200;
  baseMaxHealth: number = 100;
  baseCritChance: number = 0.05;
  baseCritMultiplier: number = 2.0;
  baseProjectileSpeed: number = 400;

  addItem(item: Item): void {
    this.items.push(item);
  }

  getDamage(): number {
    let damage = this.baseDamage;
    this.items.forEach(item => {
      if (item.damageMultiplier) damage *= item.damageMultiplier;
    });
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
    return Math.min(0.75, dodge); // Cap at 75%
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
}
