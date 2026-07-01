// Item and upgrade system

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  cost: number;
  icon: string; // Emoji for now
  unlocked: boolean; // Meta-progression unlock

  // Stat modifiers (multiplicative stacking)
  damageMultiplier?: number;
  fireRateMultiplier?: number;
  critChance?: number; // Additive
  critMultiplier?: number;
  speedMultiplier?: number;
  maxHealthBonus?: number; // Additive

  // Special effects
  piercing?: boolean;
  explosionOnKill?: boolean;
  lifesteal?: number; // Percentage
  shield?: boolean; // One-hit shield
  multishot?: number; // Extra projectiles
  projectileSpeed?: number;
  knockback?: number;
}

export class ItemDatabase {
  private static items: Item[] = [
    // Common items
    {
      id: 'damage_boost',
      name: 'Damage Boost',
      description: '+20% damage',
      rarity: 'common',
      cost: 50,
      icon: '⚔️',
      unlocked: true,
      damageMultiplier: 1.2
    },
    {
      id: 'fire_rate',
      name: 'Rapid Fire',
      description: '+30% fire rate',
      rarity: 'common',
      cost: 50,
      icon: '🔫',
      unlocked: true,
      fireRateMultiplier: 1.3
    },
    {
      id: 'speed_boost',
      name: 'Swift Steps',
      description: '+25% movement speed',
      rarity: 'common',
      cost: 40,
      icon: '👟',
      unlocked: true,
      speedMultiplier: 1.25
    },
    {
      id: 'health_boost',
      name: 'Vitality',
      description: '+20 max health',
      rarity: 'common',
      cost: 60,
      icon: '❤️',
      unlocked: true,
      maxHealthBonus: 20
    },

    // Rare items
    {
      id: 'crit_chance',
      name: 'Lucky Strike',
      description: '+15% crit chance',
      rarity: 'rare',
      cost: 80,
      icon: '🎯',
      unlocked: true,
      critChance: 0.15
    },
    {
      id: 'crit_damage',
      name: 'Precision',
      description: '+50% crit damage',
      rarity: 'rare',
      cost: 80,
      icon: '💥',
      unlocked: true,
      critMultiplier: 1.5
    },
    {
      id: 'lifesteal',
      name: 'Vampiric',
      description: '10% lifesteal',
      rarity: 'rare',
      cost: 90,
      icon: '🩸',
      unlocked: true,
      lifesteal: 0.1
    },
    {
      id: 'piercing',
      name: 'Piercing Rounds',
      description: 'Bullets pierce enemies',
      rarity: 'rare',
      cost: 100,
      icon: '🎯',
      unlocked: true,
      piercing: true
    },
    {
      id: 'multishot',
      name: 'Split Shot',
      description: '+2 projectiles',
      rarity: 'rare',
      cost: 100,
      icon: '🔱',
      unlocked: true,
      multishot: 2
    },

    // Epic items
    {
      id: 'explosion',
      name: 'Explosive Finale',
      description: 'Enemies explode on death',
      rarity: 'epic',
      cost: 150,
      icon: '💣',
      unlocked: true,
      explosionOnKill: true
    },
    {
      id: 'shield',
      name: 'Energy Shield',
      description: 'Absorb next hit',
      rarity: 'epic',
      cost: 120,
      icon: '🛡️',
      unlocked: true,
      shield: true
    },
    {
      id: 'projectile_speed',
      name: 'Railgun',
      description: '+100% projectile speed',
      rarity: 'epic',
      cost: 130,
      icon: '⚡',
      unlocked: true,
      projectileSpeed: 2.0
    },

    // Legendary items
    {
      id: 'mega_damage',
      name: 'Berserker',
      description: '+50% damage',
      rarity: 'legendary',
      cost: 200,
      icon: '⚔️',
      unlocked: true,
      damageMultiplier: 1.5
    },
    {
      id: 'knockback',
      name: 'Knockback',
      description: 'Push enemies away on hit',
      rarity: 'legendary',
      cost: 180,
      icon: '👊',
      unlocked: true,
      knockback: 200
    },
    {
      id: 'glass_cannon',
      name: 'Glass Cannon',
      description: '+100% damage, -50% health',
      rarity: 'legendary',
      cost: 250,
      icon: '💀',
      unlocked: true,
      damageMultiplier: 2.0,
      maxHealthBonus: -50
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
    return Math.max(1, health); // At least 1 HP
  }

  getCritChance(): number {
    let chance = this.baseCritChance;
    this.items.forEach(item => {
      if (item.critChance) chance += item.critChance;
    });
    return Math.min(1, chance); // Cap at 100%
  }

  getCritMultiplier(): number {
    let mult = this.baseCritMultiplier;
    this.items.forEach(item => {
      if (item.critMultiplier) mult += item.critMultiplier;
    });
    return mult;
  }

  getLifesteal(): number {
    let lifesteal = 0;
    this.items.forEach(item => {
      if (item.lifesteal) lifesteal += item.lifesteal;
    });
    return lifesteal;
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

  hasPiercing(): boolean {
    return this.items.some(item => item.piercing);
  }

  hasExplosionOnKill(): boolean {
    return this.items.some(item => item.explosionOnKill);
  }

  hasShield(): boolean {
    return this.items.some(item => item.shield);
  }

  getMultishot(): number {
    let count = 0;
    this.items.forEach(item => {
      if (item.multishot) count += item.multishot;
    });
    return count;
  }
}
