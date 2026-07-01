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
      {
        id: 'starting_damage',
        name: 'Starting Damage',
        description: '+10%/+20%/+30% base damage',
        icon: '⚔️',
        maxLevel: 3,
        costs: [10, 20, 30]
      },
      {
        id: 'starting_health',
        name: 'Starting Health',
        description: '+20/+40/+60 max HP',
        icon: '❤️',
        maxLevel: 3,
        costs: [10, 20, 30]
      },
      {
        id: 'starting_gold',
        name: 'Starting Gold',
        description: '+20/+40/+60 starting gold',
        icon: '💰',
        maxLevel: 3,
        costs: [15, 30, 50]
      },
      {
        id: 'gold_gain',
        name: 'Gold Gain',
        description: '+10%/+20%/+30% gold from kills',
        icon: '💎',
        maxLevel: 3,
        costs: [20, 40, 60]
      },
      {
        id: 'xp_gain',
        name: 'XP Gain',
        description: '+10%/+20%/+30% XP from kills',
        icon: '⭐',
        maxLevel: 3,
        costs: [20, 40, 60]
      },
      {
        id: 'reroll_discount',
        name: 'Reroll Discount',
        description: 'Reroll starts at 1g / Never goes above 8g',
        icon: '🔄',
        maxLevel: 2,
        costs: [30, 60]
      },
      {
        id: 'starting_item',
        name: 'Starting Item',
        description: 'Start with a random Common item',
        icon: '🎁',
        maxLevel: 1,
        costs: [50]
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
    return upgrade.currentLevel * 0.1; // 10% per level
  }

  getStartingHealthBonus(): number {
    const upgrade = this.upgrades.get('starting_health');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    return upgrade.currentLevel * 20; // +20 per level
  }

  getStartingGoldBonus(): number {
    const upgrade = this.upgrades.get('starting_gold');
    if (!upgrade || upgrade.currentLevel === 0) return 0;
    return upgrade.currentLevel * 20; // +20 per level
  }

  getGoldGainMultiplier(): number {
    const upgrade = this.upgrades.get('gold_gain');
    if (!upgrade || upgrade.currentLevel === 0) return 1;
    return 1 + upgrade.currentLevel * 0.1; // +10% per level
  }

  getXPGainMultiplier(): number {
    const upgrade = this.upgrades.get('xp_gain');
    if (!upgrade || upgrade.currentLevel === 0) return 1;
    return 1 + upgrade.currentLevel * 0.1; // +10% per level
  }

  getRerollDiscount(): { startCost: number; maxCost: number } {
    const upgrade = this.upgrades.get('reroll_discount');
    if (!upgrade || upgrade.currentLevel === 0) {
      return { startCost: 2, maxCost: 9999 }; // Default
    }
    if (upgrade.currentLevel === 1) {
      return { startCost: 1, maxCost: 9999 };
    }
    // Level 2
    return { startCost: 1, maxCost: 8 };
  }

  hasStartingItem(): boolean {
    const upgrade = this.upgrades.get('starting_item');
    return upgrade ? upgrade.currentLevel > 0 : false;
  }

  // Calculate souls earned from a run
  static calculateSoulsEarned(wavesCompleted: number, bossKills: number): number {
    return wavesCompleted + bossKills * 10;
  }
}
