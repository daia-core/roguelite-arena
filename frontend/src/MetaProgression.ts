// Meta-progression system for permanent upgrades between runs

export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  costs: number[]; // Cost for each level
  currentLevel: number;
}

export interface MetaSave {
  souls: number;
  upgrades: Record<string, number>; // upgrade id -> level
}

export class MetaProgression {
  private static STORAGE_KEY = 'roguelite_meta';

  souls: number = 0;
  upgrades: Map<string, MetaUpgrade> = new Map();

  constructor() {
    this.initializeUpgrades();
    this.load();
  }

  private initializeUpgrades(): void {
    const upgradeDefinitions: Omit<MetaUpgrade, 'currentLevel'>[] = [
      // Tier 1: Basic stat upgrades
      {
        id: 'starting_damage',
        name: 'Starting Damage',
        description: '+10%/+20%/+30%/+40%/+50% base damage',
        icon: '⚔️',
        maxLevel: 5,
        costs: [10, 20, 35, 55, 80]
      },
      {
        id: 'starting_health',
        name: 'Starting Health',
        description: '+20/+40/+70/+100/+140 max HP',
        icon: '❤️',
        maxLevel: 5,
        costs: [10, 20, 35, 55, 80]
      },
      {
        id: 'starting_gold',
        name: 'Starting Gold',
        description: '+20/+40/+70/+100/+140 starting gold',
        icon: '💰',
        maxLevel: 5,
        costs: [15, 30, 50, 75, 105]
      },
      {
        id: 'starting_speed',
        name: 'Starting Speed',
        description: '+10%/+20%/+30%/+40%/+50% move speed',
        icon: '👟',
        maxLevel: 5,
        costs: [12, 24, 40, 62, 90]
      },
      {
        id: 'starting_fire_rate',
        name: 'Starting Fire Rate',
        description: '+15%/+30%/+50%/+70%/+100% fire rate',
        icon: '🔥',
        maxLevel: 5,
        costs: [15, 30, 50, 75, 110]
      },

      // Tier 2: Economy and progression
      {
        id: 'gold_gain',
        name: 'Gold Gain',
        description: '+10%/+20%/+35%/+50%/+70% gold from kills',
        icon: '💎',
        maxLevel: 5,
        costs: [20, 40, 65, 95, 130]
      },
      {
        id: 'xp_gain',
        name: 'XP Gain',
        description: '+10%/+20%/+35%/+50%/+70% XP from kills',
        icon: '⭐',
        maxLevel: 5,
        costs: [20, 40, 65, 95, 130]
      },
      {
        id: 'reroll_discount',
        name: 'Reroll Discount',
        description: 'Start 1g / Cap 8g / Start 0g / Free first reroll',
        icon: '🔄',
        maxLevel: 4,
        costs: [30, 60, 100, 150]
      },
      {
        id: 'shop_discount',
        name: 'Shop Discount',
        description: '-10%/-20%/-30%/-40% shop prices',
        icon: '🏪',
        maxLevel: 4,
        costs: [40, 80, 130, 200]
      },

      // Tier 3: Special starting bonuses
      {
        id: 'starting_item',
        name: 'Starting Item',
        description: 'Common / Uncommon / Rare item',
        icon: '🎁',
        maxLevel: 3,
        costs: [50, 120, 250]
      },
      {
        id: 'starting_crit',
        name: 'Starting Crit',
        description: '+5%/+10%/+15%/+20% crit chance',
        icon: '💥',
        maxLevel: 4,
        costs: [35, 70, 115, 170]
      },
      {
        id: 'starting_armor',
        name: 'Starting Armor',
        description: '+3/+6/+10/+15 armor',
        icon: '🛡️',
        maxLevel: 4,
        costs: [30, 60, 100, 150]
      },
      {
        id: 'starting_regen',
        name: 'Starting Regen',
        description: '+1/+2/+4/+7 HP per second',
        icon: '💚',
        maxLevel: 4,
        costs: [25, 50, 85, 130]
      },

      // Tier 4: Advanced mechanics
      {
        id: 'extra_shop_slots',
        name: 'Extra Shop Slots',
        description: '+1/+2/+3 items in shop',
        icon: '🛒',
        maxLevel: 3,
        costs: [80, 160, 300]
      },
      {
        id: 'boss_damage',
        name: 'Boss Damage',
        description: '+20%/+40%/+70%/+100% damage to bosses',
        icon: '👑',
        maxLevel: 4,
        costs: [60, 120, 200, 320]
      },
      {
        id: 'elite_rewards',
        name: 'Elite Rewards',
        description: '+50%/+100%/+150% rewards from elites',
        icon: '💰',
        maxLevel: 3,
        costs: [45, 90, 160]
      },
      {
        id: 'wave_skip',
        name: 'Wave Skip',
        description: 'Start at wave 5 / wave 10',
        icon: '⏭️',
        maxLevel: 2,
        costs: [200, 500]
      },

      // Tier 5: Ultimate unlocks
      {
        id: 'starting_legendary',
        name: 'Lucky Start',
        description: 'Random legendary item at start',
        icon: '🌟',
        maxLevel: 1,
        costs: [500]
      },
      {
        id: 'permanent_shield',
        name: 'Permanent Shield',
        description: 'Start with energy shield',
        icon: '🔰',
        maxLevel: 1,
        costs: [350]
      },
      {
        id: 'double_level_ups',
        name: 'Double Level Ups',
        description: 'Level up twice as fast',
        icon: '⬆️',
        maxLevel: 1,
        costs: [400]
      }
    ];

    for (const def of upgradeDefinitions) {
      this.upgrades.set(def.id, { ...def, currentLevel: 0 });
    }
  }

  load(): void {
    try {
      const saved = localStorage.getItem(MetaProgression.STORAGE_KEY);
      if (saved) {
        const data: MetaSave = JSON.parse(saved);
        this.souls = data.souls ?? 0;

        // Restore upgrade levels
        for (const [id, level] of Object.entries(data.upgrades ?? {})) {
          const upgrade = this.upgrades.get(id);
          if (upgrade) {
            upgrade.currentLevel = level;
          }
        }
      }
    } catch (e) {
      console.error('Failed to load meta progression:', e);
    }
  }

  save(): void {
    const data: MetaSave = {
      souls: this.souls,
      upgrades: {}
    };

    for (const [id, upgrade] of this.upgrades) {
      data.upgrades[id] = upgrade.currentLevel;
    }

    localStorage.setItem(MetaProgression.STORAGE_KEY, JSON.stringify(data));
  }

  addSouls(amount: number): void {
    this.souls += amount;
    this.save();
  }

  canPurchaseUpgrade(upgradeId: string): boolean {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade) return false;
    if (upgrade.currentLevel >= upgrade.maxLevel) return false;

    const cost = upgrade.costs[upgrade.currentLevel];
    return this.souls >= cost;
  }

  purchaseUpgrade(upgradeId: string): boolean {
    const upgrade = this.upgrades.get(upgradeId);
    if (!upgrade || !this.canPurchaseUpgrade(upgradeId)) return false;

    const cost = upgrade.costs[upgrade.currentLevel];
    this.souls -= cost;
    upgrade.currentLevel++;
    this.save();
    return true;
  }

  getUpgrade(upgradeId: string): MetaUpgrade | undefined {
    return this.upgrades.get(upgradeId);
  }

  getAllUpgrades(): MetaUpgrade[] {
    return Array.from(this.upgrades.values());
  }

  // Helper methods for applying upgrades
  getStartingDamageBonus(): number {
    const upgrade = this.upgrades.get('starting_damage');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    return upgrade.currentLevel * 0.1; // 10% per level (max 50%)
  }

  getStartingHealthBonus(): number {
    const upgrade = this.upgrades.get('starting_health');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    const bonuses = [0, 20, 40, 70, 100, 140];
    return bonuses[upgrade.currentLevel] || 0;
  }

  getStartingGoldBonus(): number {
    const upgrade = this.upgrades.get('starting_gold');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    const bonuses = [0, 20, 40, 70, 100, 140];
    return bonuses[upgrade.currentLevel] || 0;
  }

  getStartingSpeedBonus(): number {
    const upgrade = this.upgrades.get('starting_speed');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    return upgrade.currentLevel * 0.1; // 10% per level (max 50%)
  }

  getStartingFireRateBonus(): number {
    const upgrade = this.upgrades.get('starting_fire_rate');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    const bonuses = [0, 0.15, 0.3, 0.5, 0.7, 1.0];
    return bonuses[upgrade.currentLevel] || 0;
  }

  getGoldGainMultiplier(): number {
    const upgrade = this.upgrades.get('gold_gain');
    if (!upgrade || upgrade.currentLevel === 0) return 1;
    const bonuses = [0, 0.1, 0.2, 0.35, 0.5, 0.7];
    return 1 + (bonuses[upgrade.currentLevel] || 0);
  }

  getXPGainMultiplier(): number {
    const upgrade = this.upgrades.get('xp_gain');
    if (!upgrade || upgrade.currentLevel === 0) return 1;
    const bonuses = [0, 0.1, 0.2, 0.35, 0.5, 0.7];
    return 1 + (bonuses[upgrade.currentLevel] || 0);
  }

  getShopDiscountBonus(): number {
    const upgrade = this.upgrades.get('shop_discount');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    return upgrade.currentLevel * 0.1; // 10% per level (max 40%)
  }

  getRerollDiscount(): { startCost: number; maxCost: number; firstFree: boolean } {
    const upgrade = this.upgrades.get('reroll_discount');
    if (!upgrade || upgrade.currentLevel === 0) {
      return { startCost: 2, maxCost: 9999, firstFree: false }; // Default
    }
    if (upgrade.currentLevel === 1) {
      return { startCost: 1, maxCost: 9999, firstFree: false };
    }
    if (upgrade.currentLevel === 2) {
      return { startCost: 1, maxCost: 8, firstFree: false };
    }
    if (upgrade.currentLevel === 3) {
      return { startCost: 0, maxCost: 8, firstFree: false };
    }
    // Level 4
    return { startCost: 0, maxCost: 8, firstFree: true };
  }

  hasStartingItem(): boolean {
    const upgrade = this.upgrades.get('starting_item');
    return upgrade ? upgrade.currentLevel > 0 : false;
  }

  getStartingItemTier(): 'common' | 'rare' | 'epic' {
    const upgrade = this.upgrades.get('starting_item');
    if (!upgrade || upgrade.currentLevel === 0) return 'common';
    if (upgrade.currentLevel === 1) return 'common';
    if (upgrade.currentLevel === 2) return 'rare';
    return 'epic'; // Level 3
  }

  getStartingCritBonus(): number {
    const upgrade = this.upgrades.get('starting_crit');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    return upgrade.currentLevel * 0.05; // 5% per level (max 20%)
  }

  getStartingArmorBonus(): number {
    const upgrade = this.upgrades.get('starting_armor');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    const bonuses = [0, 3, 6, 10, 15];
    return bonuses[upgrade.currentLevel] || 0;
  }

  getStartingRegenBonus(): number {
    const upgrade = this.upgrades.get('starting_regen');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    const bonuses = [0, 1, 2, 4, 7];
    return bonuses[upgrade.currentLevel] || 0;
  }

  getExtraShopSlots(): number {
    const upgrade = this.upgrades.get('extra_shop_slots');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    return upgrade.currentLevel; // 1, 2, or 3 extra slots
  }

  getBossDamageMultiplier(): number {
    const upgrade = this.upgrades.get('boss_damage');
    if (!upgrade || upgrade.currentLevel === 0) return 1;
    const bonuses = [0, 0.2, 0.4, 0.7, 1.0];
    return 1 + (bonuses[upgrade.currentLevel] || 0);
  }

  getEliteRewardMultiplier(): number {
    const upgrade = this.upgrades.get('elite_rewards');
    if (!upgrade || upgrade.currentLevel === 0) return 1;
    const bonuses = [0, 0.5, 1.0, 1.5];
    return 1 + (bonuses[upgrade.currentLevel] || 0);
  }

  getWaveSkip(): number {
    const upgrade = this.upgrades.get('wave_skip');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    if (upgrade.currentLevel === 1) return 5;
    return 10; // Level 2
  }

  hasStartingLegendary(): boolean {
    const upgrade = this.upgrades.get('starting_legendary');
    return upgrade ? upgrade.currentLevel > 0 : false;
  }

  hasPermanentShield(): boolean {
    const upgrade = this.upgrades.get('permanent_shield');
    return upgrade ? upgrade.currentLevel > 0 : false;
  }

  hasDoubleLevelUps(): boolean {
    const upgrade = this.upgrades.get('double_level_ups');
    return upgrade ? upgrade.currentLevel > 0 : false;
  }

  // Calculate souls earned from a run
  static calculateSoulsEarned(wavesCompleted: number, bossKills: number): number {
    return wavesCompleted + bossKills * 10;
  }
}
