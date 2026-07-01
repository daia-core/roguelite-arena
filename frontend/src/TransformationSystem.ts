/**
 * Transformation System (Binding of Isaac inspired)
 *
 * Collect 3+ items from a thematic set → unlock permanent transformation
 * with visual change and stat bonus
 */

import type { ItemTag } from './ItemSystem';

export const TransformationId = {
  BERSERKER: 'berserker',           // 3 melee items
  MARKSMAN: 'marksman',             // 3 ranged items
  FORTRESS: 'fortress',             // 3 defensive items
  MERCHANT: 'merchant',             // 3 economic items
  ELEMENTALIST: 'elementalist',     // 3 elemental items
  TACTICIAN: 'tactician',           // 3 utility items
} as const;

export type TransformationId = typeof TransformationId[keyof typeof TransformationId];

export interface Transformation {
  id: TransformationId;
  name: string;
  description: string;
  requiredTag: ItemTag;
  requiredCount: number;
  icon: string;

  // Stat bonuses granted by transformation
  damageMultiplier?: number;
  fireRateMultiplier?: number;
  speedMultiplier?: number;
  maxHealthBonus?: number;
  critChance?: number;
  critDamageMultiplier?: number;
  goldBonus?: number;
  xpMagnet?: number;
  armor?: number;
  shopDiscount?: number;

  // Visual effects
  glowColor: string;       // Aura color around player
  particleColor: string;   // Particle effect color
}

// Define all transformations
export const TRANSFORMATIONS: Record<TransformationId, Transformation> = {
  [TransformationId.BERSERKER]: {
    id: TransformationId.BERSERKER,
    name: 'Berserker Rage',
    description: 'Pure offensive power overwhelms you',
    requiredTag: 'melee',
    requiredCount: 3,
    icon: '⚔️',
    damageMultiplier: 1.5,        // +50% damage
    speedMultiplier: 1.2,         // +20% speed
    glowColor: '#dc2626',         // Crimson red aura
    particleColor: '#ef4444'
  },

  [TransformationId.MARKSMAN]: {
    id: TransformationId.MARKSMAN,
    name: 'Master Marksman',
    description: 'Precision and accuracy define you',
    requiredTag: 'ranged',
    requiredCount: 3,
    icon: '🎯',
    critChance: 0.25,             // +25% crit chance
    critDamageMultiplier: 1.5,    // +50% crit damage
    fireRateMultiplier: 1.3,      // +30% fire rate
    glowColor: '#3b82f6',         // Royal blue aura
    particleColor: '#60a5fa'
  },

  [TransformationId.FORTRESS]: {
    id: TransformationId.FORTRESS,
    name: 'Living Fortress',
    description: 'An impenetrable wall of defense',
    requiredTag: 'defensive',
    requiredCount: 3,
    icon: '🛡️',
    maxHealthBonus: 100,          // +100 max HP
    armor: 15,                    // +15 armor
    speedMultiplier: 0.9,         // -10% speed (tradeoff)
    glowColor: '#78716c',         // Stone gray aura
    particleColor: '#a8a29e'
  },

  [TransformationId.MERCHANT]: {
    id: TransformationId.MERCHANT,
    name: 'Golden Touch',
    description: 'Wealth flows to you like water',
    requiredTag: 'economic',
    requiredCount: 3,
    icon: '💰',
    goldBonus: 2.0,               // 2x gold gain
    shopDiscount: 0.25,           // 25% shop discount
    xpMagnet: 1.5,                // +50% pickup range
    glowColor: '#eab308',         // Gold aura
    particleColor: '#fde047'
  },

  [TransformationId.ELEMENTALIST]: {
    id: TransformationId.ELEMENTALIST,
    name: 'Elemental Ascension',
    description: 'Master of fire, ice, and lightning',
    requiredTag: 'elemental',
    requiredCount: 3,
    icon: '🌟',
    damageMultiplier: 1.3,        // +30% damage
    fireRateMultiplier: 1.2,      // +20% fire rate
    glowColor: '#a855f7',         // Purple magical aura
    particleColor: '#c4b5fd'
  },

  [TransformationId.TACTICIAN]: {
    id: TransformationId.TACTICIAN,
    name: 'Master Tactician',
    description: 'Strategic superiority in all aspects',
    requiredTag: 'utility',
    requiredCount: 3,
    icon: '🧠',
    speedMultiplier: 1.3,         // +30% speed
    xpMagnet: 1.5,                // +50% pickup range
    fireRateMultiplier: 1.2,      // +20% fire rate
    glowColor: '#14532d',         // Forest green aura
    particleColor: '#22c55e'
  }
};

/**
 * Tracks transformation progress and active transformations
 */
export class TransformationTracker {
  private itemsPickedUp: Map<ItemTag, number> = new Map();
  private activeTransformations: Set<TransformationId> = new Set();
  private newlyUnlockedTransformation: TransformationId | null = null;

  /**
   * Track an item pickup and check for transformations
   * Returns the transformation ID if one was just unlocked
   */
  trackItemPickup(tags: ItemTag[]): TransformationId | null {
    // Count items by tag
    for (const tag of tags) {
      const currentCount = this.itemsPickedUp.get(tag) || 0;
      this.itemsPickedUp.set(tag, currentCount + 1);
    }

    // Check for newly unlocked transformations
    this.newlyUnlockedTransformation = null;
    for (const transformation of Object.values(TRANSFORMATIONS)) {
      // Skip if already unlocked
      if (this.activeTransformations.has(transformation.id)) continue;

      const tagCount = this.itemsPickedUp.get(transformation.requiredTag) || 0;
      if (tagCount >= transformation.requiredCount) {
        this.unlockTransformation(transformation.id);
        return transformation.id;
      }
    }

    return null;
  }

  private unlockTransformation(id: TransformationId): void {
    this.activeTransformations.add(id);
    this.newlyUnlockedTransformation = id;
  }

  /**
   * Get all active transformations
   */
  getActiveTransformations(): Transformation[] {
    return Array.from(this.activeTransformations).map(id => TRANSFORMATIONS[id]);
  }

  /**
   * Check if a specific transformation is active
   */
  hasTransformation(id: TransformationId): boolean {
    return this.activeTransformations.has(id);
  }

  /**
   * Get the most recently unlocked transformation (for UI display)
   */
  getNewlyUnlocked(): Transformation | null {
    if (this.newlyUnlockedTransformation) {
      return TRANSFORMATIONS[this.newlyUnlockedTransformation];
    }
    return null;
  }

  /**
   * Clear the newly unlocked flag (after showing UI)
   */
  clearNewlyUnlocked(): void {
    this.newlyUnlockedTransformation = null;
  }

  /**
   * Get progress towards a transformation (for UI display)
   */
  getProgress(tag: ItemTag): { current: number; required: number; transformation: Transformation | null } {
    const transformation = Object.values(TRANSFORMATIONS).find(t => t.requiredTag === tag);
    if (!transformation) {
      return { current: 0, required: 0, transformation: null };
    }

    const current = this.itemsPickedUp.get(tag) || 0;
    return {
      current,
      required: transformation.requiredCount,
      transformation
    };
  }

  /**
   * Calculate total stat multipliers from all active transformations
   */
  getTotalBonuses(): {
    damageMultiplier: number;
    fireRateMultiplier: number;
    speedMultiplier: number;
    maxHealthBonus: number;
    critChance: number;
    critDamageMultiplier: number;
    goldBonus: number;
    xpMagnet: number;
    armor: number;
    shopDiscount: number;
  } {
    const activeTransformations = this.getActiveTransformations();

    return {
      damageMultiplier: activeTransformations.reduce((acc, t) => acc * (t.damageMultiplier || 1), 1),
      fireRateMultiplier: activeTransformations.reduce((acc, t) => acc * (t.fireRateMultiplier || 1), 1),
      speedMultiplier: activeTransformations.reduce((acc, t) => acc * (t.speedMultiplier || 1), 1),
      maxHealthBonus: activeTransformations.reduce((acc, t) => acc + (t.maxHealthBonus || 0), 0),
      critChance: activeTransformations.reduce((acc, t) => acc + (t.critChance || 0), 0),
      critDamageMultiplier: activeTransformations.reduce((acc, t) => acc * (t.critDamageMultiplier || 1), 1),
      goldBonus: activeTransformations.reduce((acc, t) => acc * (t.goldBonus || 1), 1),
      xpMagnet: activeTransformations.reduce((acc, t) => acc * (t.xpMagnet || 1), 1),
      armor: activeTransformations.reduce((acc, t) => acc + (t.armor || 0), 0),
      shopDiscount: activeTransformations.reduce((acc, t) => acc + (t.shopDiscount || 0), 0)
    };
  }

  /**
   * Serialize for save/load
   */
  serialize(): { picked: [ItemTag, number][]; active: TransformationId[] } {
    return {
      picked: Array.from(this.itemsPickedUp.entries()),
      active: Array.from(this.activeTransformations)
    };
  }

  /**
   * Deserialize from save data
   */
  deserialize(data: { picked: [ItemTag, number][]; active: TransformationId[] }): void {
    this.itemsPickedUp = new Map(data.picked);
    this.activeTransformations = new Set(data.active);
  }
}
