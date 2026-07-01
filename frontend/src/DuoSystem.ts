/**
 * Duo System (Hades-inspired synergies)
 *
 * When you own BOTH items in a pair, a unique combo effect activates.
 * Duos are VERY powerful build-defining effects.
 */

import type { Item } from './ItemSystem';

export interface DuoCombo {
  id: string;
  name: string;
  description: string;
  icon: string;
  item1Id: string;
  item2Id: string;

  // Stat bonuses (additive or multiplicative)
  damageMultiplier?: number;
  fireRateMultiplier?: number;
  speedMultiplier?: number;
  maxHealthBonus?: number;
  critChance?: number;
  critDamageMultiplier?: number;
  lifesteal?: number;
  piercing?: number;
  explosionOnHit?: boolean;
  chainLightning?: number;
  freeze?: number;
  goldBonus?: number;
  armor?: number;
  healthRegen?: number;
  dodge?: number;
  shopDiscount?: number;

  // Special effects
  specialEffect?: string; // Description of unique mechanic
  glowColor?: string;     // Visual feedback
}

// Define all duo combinations
export const DUO_COMBOS: DuoCombo[] = [
  // ==================== OFFENSIVE DUOS ====================
  {
    id: 'storm_surge',
    name: 'Storm Surge',
    description: 'Lightning chains to ALL nearby enemies',
    icon: '⚡🌊',
    item1Id: 'chain_lightning_t3',  // Storm Essence
    item2Id: 'homing_t3',            // Seeking Rune
    chainLightning: 0.4,             // +40% more chain chance
    damageMultiplier: 1.3,
    glowColor: '#3b82f6',
    specialEffect: 'Lightning seeks targets and chains indefinitely'
  },

  {
    id: 'explosive_barrage',
    name: 'Explosive Barrage',
    description: 'Every shot fires multiple exploding projectiles',
    icon: '💣🎯',
    item1Id: 'explosive_t3',         // Demolition Kit
    item2Id: 'multishot_t3',         // Trident
    damageMultiplier: 1.4,
    explosionOnHit: true,
    glowColor: '#dc2626',
    specialEffect: 'Triple explosions per attack'
  },

  {
    id: 'frozen_apocalypse',
    name: 'Frozen Apocalypse',
    description: 'Frozen enemies explode and freeze nearby foes',
    icon: '❄️💥',
    item1Id: 'freeze_t3',            // Frost Orb
    item2Id: 'explosive_t3',         // Demolition Kit
    freeze: 0.25,                    // +25% freeze chance
    damageMultiplier: 1.35,
    explosionOnHit: true,
    glowColor: '#60a5fa',
    specialEffect: 'Frozen enemies create ice explosions'
  },

  {
    id: 'toxic_storm',
    name: 'Toxic Storm',
    description: 'Poison spreads to nearby enemies + lightning',
    icon: '☠️⚡',
    item1Id: 'poison_t3',            // Toxic Vial
    item2Id: 'chain_lightning_t3',   // Storm Essence
    chainLightning: 0.3,
    damageMultiplier: 1.25,
    glowColor: '#84cc16',
    specialEffect: 'Poisoned enemies arc lightning to others'
  },

  {
    id: 'piercing_multishot',
    name: 'Arrow Rain',
    description: 'Infinite pierce + triple projectiles = screen clear',
    icon: '🎯🔱',
    item1Id: 'piercing_t3',          // Penetrating Shot
    item2Id: 'multishot_t3',         // Trident
    piercing: 5,                     // +5 more pierce
    damageMultiplier: 1.3,
    glowColor: '#a855f7',
    specialEffect: 'Triple arrows that never stop'
  },

  // ==================== CRIT BUILD DUOS ====================
  {
    id: 'assassins_creed',
    name: "Assassin's Creed",
    description: 'Guaranteed crits from behind + massive crit damage',
    icon: '🗡️💢',
    item1Id: 'crit_chance_t3',       // Assassin's Mark
    item2Id: 'crit_damage_t2',       // Precision Scope
    critChance: 0.15,                // +15% crit chance
    critDamageMultiplier: 1.5,       // +50% crit damage
    damageMultiplier: 1.2,
    glowColor: '#78350f',
    specialEffect: 'Attacks from behind always crit'
  },

  {
    id: 'rapid_precision',
    name: 'Rapid Precision',
    description: 'Fast attacks + high crit = constant crits',
    icon: '⚡💢',
    item1Id: 'attack_speed_t3',      // Lightning Bracers
    item2Id: 'crit_chance_t3',       // Assassin's Mark
    fireRateMultiplier: 1.25,
    critChance: 0.1,
    damageMultiplier: 1.2,
    glowColor: '#fbbf24',
    specialEffect: 'Every 5th shot is guaranteed crit'
  },

  // ==================== TANK BUILD DUOS ====================
  {
    id: 'fortress_of_thorns',
    name: 'Fortress of Thorns',
    description: 'Massive armor + reflect damage to all attackers',
    icon: '🛡️🌹',
    item1Id: 'armor_t2',             // Chain Mail
    item2Id: 'thorns_t2',            // Spiked Armor
    armor: 10,                       // +10 armor
    maxHealthBonus: 50,
    glowColor: '#78716c',
    specialEffect: 'Reflected damage hits all nearby enemies'
  },

  {
    id: 'regenerating_fortress',
    name: 'Regenerating Fortress',
    description: 'Infinite HP sustain + massive health pool',
    icon: '❤️💚',
    item1Id: 'max_hp_t2',            // Vitality Ring
    item2Id: 'hp_regen_t1',          // Healing Charm
    maxHealthBonus: 75,
    healthRegen: 3,
    glowColor: '#22c55e',
    specialEffect: 'Heal 1% max HP per second'
  },

  {
    id: 'vampiric_fury',
    name: 'Vampiric Fury',
    description: 'Lifesteal heals MORE than damage taken',
    icon: '🩸⚔️',
    item1Id: 'lifesteal_t3',         // Blood Chalice
    item2Id: 'damage_t3',            // Champion's Crown
    lifesteal: 0.15,                 // +15% lifesteal
    damageMultiplier: 1.4,
    glowColor: '#dc2626',
    specialEffect: 'Heal for 2x lifesteal amount on crits'
  },

  // ==================== SPEED BUILD DUOS ====================
  {
    id: 'sonic_blur',
    name: 'Sonic Blur',
    description: 'Maximum speed + invincibility while moving',
    icon: '💨👻',
    item1Id: 'movement_speed_t2',    // Running Shoes
    item2Id: 'dodge_t3',             // Shadow Step
    speedMultiplier: 1.4,
    dodge: 0.15,                     // +15% dodge
    glowColor: '#6366f1',
    specialEffect: 'Cannot be hit while dashing'
  },

  {
    id: 'haste_barrage',
    name: 'Haste Barrage',
    description: 'Fire so fast enemies cannot react',
    icon: '⚡🔫',
    item1Id: 'attack_speed_t3',      // Lightning Bracers
    item2Id: 'movement_speed_t2',    // Running Shoes
    fireRateMultiplier: 1.35,
    speedMultiplier: 1.25,
    glowColor: '#fbbf24',
    specialEffect: 'Attack speed scales with movement speed'
  },

  // ==================== ECONOMIC BUILD DUOS ====================
  {
    id: 'golden_empire',
    name: 'Golden Empire',
    description: 'Infinite wealth generation',
    icon: '💰✨',
    item1Id: 'gold_bonus_t2',        // Treasure Hunter
    item2Id: 'shop_discount_t2',     // Coupon Book
    goldBonus: 1.5,                  // +50% gold
    shopDiscount: 0.15,              // +15% shop discount
    glowColor: '#eab308',
    specialEffect: 'Every shop purchase grants +1 gold/sec permanently'
  },

  {
    id: 'recycling_master',
    name: 'Recycling Master',
    description: 'Sell items for MORE than you paid',
    icon: '♻️💸',
    item1Id: 'recycle_bonus_t2',     // Haggler Badge
    item2Id: 'reroll_discount_t2',   // Spyglass
    goldBonus: 1.3,
    glowColor: '#22c55e',
    specialEffect: 'Recycled items give 75% value + reroll cost = 0'
  },

  // ==================== ELEMENTAL DUOS ====================
  {
    id: 'elemental_trinity',
    name: 'Elemental Trinity',
    description: 'Fire, Ice, Lightning - all at once',
    icon: '🔥❄️⚡',
    item1Id: 'poison_t3',            // Toxic Vial (fire proxy)
    item2Id: 'freeze_t3',            // Frost Orb
    // Requires chain_lightning_t3 in inventory too (checked separately)
    damageMultiplier: 1.6,
    chainLightning: 0.3,
    freeze: 0.2,
    glowColor: '#a855f7',
    specialEffect: 'Every hit applies burn, freeze, AND lightning'
  }
];

/**
 * Tracks active duo combos based on owned items
 */
export class DuoTracker {
  private activeDuos: Set<string> = new Set();

  /**
   * Check which duos are active based on current items
   * Returns newly activated duos
   */
  updateDuos(items: Item[]): DuoCombo[] {
    const ownedItemIds = new Set(items.map(item => item.id));
    const newlyActivated: DuoCombo[] = [];

    for (const duo of DUO_COMBOS) {
      const hasItem1 = ownedItemIds.has(duo.item1Id);
      const hasItem2 = ownedItemIds.has(duo.item2Id);
      const isActive = hasItem1 && hasItem2;

      if (isActive && !this.activeDuos.has(duo.id)) {
        // Newly activated!
        this.activeDuos.add(duo.id);
        newlyActivated.push(duo);
      } else if (!isActive && this.activeDuos.has(duo.id)) {
        // Deactivated (player sold an item)
        this.activeDuos.delete(duo.id);
      }
    }

    return newlyActivated;
  }

  /**
   * Get all currently active duos
   */
  getActiveDuos(): DuoCombo[] {
    return DUO_COMBOS.filter(duo => this.activeDuos.has(duo.id));
  }

  /**
   * Check if a specific duo is active
   */
  hasDuo(duoId: string): boolean {
    return this.activeDuos.has(duoId);
  }

  /**
   * Get total stat bonuses from all active duos
   */
  getTotalBonuses(): {
    damageMultiplier: number;
    fireRateMultiplier: number;
    speedMultiplier: number;
    maxHealthBonus: number;
    critChance: number;
    lifesteal: number;
    piercing: number;
    chainLightning: number;
    freeze: number;
    goldBonus: number;
    armor: number;
  } {
    const activeDuos = this.getActiveDuos();

    return {
      damageMultiplier: activeDuos.reduce((acc, duo) => acc * (duo.damageMultiplier || 1), 1),
      fireRateMultiplier: activeDuos.reduce((acc, duo) => acc * (duo.fireRateMultiplier || 1), 1),
      speedMultiplier: activeDuos.reduce((acc, duo) => acc * (duo.speedMultiplier || 1), 1),
      maxHealthBonus: activeDuos.reduce((acc, duo) => acc + (duo.maxHealthBonus || 0), 0),
      critChance: activeDuos.reduce((acc, duo) => acc + (duo.critChance || 0), 0),
      lifesteal: activeDuos.reduce((acc, duo) => acc + (duo.lifesteal || 0), 0),
      piercing: activeDuos.reduce((acc, duo) => acc + (duo.piercing || 0), 0),
      chainLightning: activeDuos.reduce((acc, duo) => acc + (duo.chainLightning || 0), 0),
      freeze: activeDuos.reduce((acc, duo) => acc + (duo.freeze || 0), 0),
      goldBonus: activeDuos.reduce((acc, duo) => acc * (duo.goldBonus || 1), 1),
      armor: activeDuos.reduce((acc, duo) => acc + (duo.armor || 0), 0)
    };
  }

  /**
   * Get potential duos (has 1 of 2 items)
   */
  getPotentialDuos(items: Item[]): DuoCombo[] {
    const ownedItemIds = new Set(items.map(item => item.id));
    const potential: DuoCombo[] = [];

    for (const duo of DUO_COMBOS) {
      // Skip if already active
      if (this.activeDuos.has(duo.id)) continue;

      const hasItem1 = ownedItemIds.has(duo.item1Id);
      const hasItem2 = ownedItemIds.has(duo.item2Id);

      // Potential = has exactly one of the two items
      if ((hasItem1 && !hasItem2) || (!hasItem1 && hasItem2)) {
        potential.push(duo);
      }
    }

    return potential;
  }

  /**
   * Serialize for save/load
   */
  serialize(): string[] {
    return Array.from(this.activeDuos);
  }

  /**
   * Deserialize from save data
   */
  deserialize(data: string[]): void {
    this.activeDuos = new Set(data);
  }
}
