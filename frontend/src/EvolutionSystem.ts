/**
 * Weapon Evolution System (Vampire Survivors inspired)
 *
 * Weapons can evolve into more powerful versions when you have:
 * 1. The base weapon
 * 2. A specific "catalyst" item
 * 3. Reach a certain level (usually level 5+)
 *
 * Example: "Magic Wand" + "Spell Book" → "Holy Wand" (shoots 3 projectiles)
 */

import type { Item } from './ItemSystem';

export interface Evolution {
  id: string;
  baseWeaponId: string;      // The weapon to evolve
  catalystItemId: string;     // Required passive item
  evolvedWeaponId: string;    // Result weapon
  requiredLevel?: number;     // Minimum level (default: 5)
  name: string;
  description: string;
}

// Define all weapon evolutions
export const EVOLUTIONS: Evolution[] = [
  // MAGIC WAND → HOLY WAND (with spell book)
  {
    id: 'wand_evolution',
    baseWeaponId: 'magic_wand',
    catalystItemId: 'spell_book',
    evolvedWeaponId: 'holy_wand',
    requiredLevel: 5,
    name: 'Holy Wand',
    description: 'Magic Wand evolves with Spell Book at level 5+'
  },

  // SWORD → EXCALIBUR (with warrior heart)
  {
    id: 'sword_evolution',
    baseWeaponId: 'sword',
    catalystItemId: 'warrior_heart',
    evolvedWeaponId: 'excalibur',
    requiredLevel: 5,
    name: 'Excalibur',
    description: 'Sword evolves with Warrior Heart at level 5+'
  },

  // BOW → ARTEMIS BOW (with eagle eye)
  {
    id: 'bow_evolution',
    baseWeaponId: 'bow',
    catalystItemId: 'eagle_eye',
    evolvedWeaponId: 'artemis_bow',
    requiredLevel: 5,
    name: 'Artemis Bow',
    description: 'Bow evolves with Eagle Eye at level 5+'
  },

  // FIREBALL → METEOR STORM (with fire tome)
  {
    id: 'fireball_evolution',
    baseWeaponId: 'fireball',
    catalystItemId: 'fire_tome',
    evolvedWeaponId: 'meteor_storm',
    requiredLevel: 5,
    name: 'Meteor Storm',
    description: 'Fireball evolves with Fire Tome at level 5+'
  },

  // DAGGER → SHADOW BLADES (with assassin cloak)
  {
    id: 'dagger_evolution',
    baseWeaponId: 'dagger',
    catalystItemId: 'assassin_cloak',
    evolvedWeaponId: 'shadow_blades',
    requiredLevel: 5,
    name: 'Shadow Blades',
    description: 'Dagger evolves with Assassin Cloak at level 5+'
  }
];

export class EvolutionSystem {
  /**
   * Check if any weapons can evolve based on current items and level
   * Returns array of possible evolutions
   */
  checkEvolutions(items: Item[], level: number): Evolution[] {
    const ownedItemIds = new Set(items.map(item => item.id));
    const possibleEvolutions: Evolution[] = [];

    for (const evolution of EVOLUTIONS) {
      // Check if we have both base weapon and catalyst
      const hasBaseWeapon = ownedItemIds.has(evolution.baseWeaponId);
      const hasCatalyst = ownedItemIds.has(evolution.catalystItemId);
      const hasEvolvedWeapon = ownedItemIds.has(evolution.evolvedWeaponId);
      const meetsLevelRequirement = level >= (evolution.requiredLevel || 5);

      // Only show evolution if:
      // 1. We have base + catalyst
      // 2. We meet level requirement
      // 3. We don't already have the evolved weapon
      if (hasBaseWeapon && hasCatalyst && meetsLevelRequirement && !hasEvolvedWeapon) {
        possibleEvolutions.push(evolution);
      }
    }

    return possibleEvolutions;
  }

  /**
   * Execute evolution: remove base weapon, add evolved weapon
   * Returns the evolved item or null if evolution failed
   */
  evolve(
    items: Item[],
    evolution: Evolution,
    itemDatabase: Map<string, Item>
  ): { newItems: Item[]; evolvedItem: Item } | null {
    // Find and remove base weapon
    const baseWeaponIndex = items.findIndex(item => item.id === evolution.baseWeaponId);
    if (baseWeaponIndex === -1) return null;

    // Get evolved weapon from database
    const evolvedWeapon = itemDatabase.get(evolution.evolvedWeaponId);
    if (!evolvedWeapon) return null;

    // Create new items array with base weapon replaced by evolved weapon
    const newItems = [...items];
    newItems[baseWeaponIndex] = evolvedWeapon;

    return {
      newItems,
      evolvedItem: evolvedWeapon
    };
  }

  /**
   * Get evolution description for UI display
   */
  getEvolutionDescription(evolution: Evolution): string {
    return `${evolution.name}: ${evolution.description}`;
  }

  /**
   * Check if a specific weapon can evolve
   */
  canWeaponEvolve(weaponId: string, items: Item[], level: number): Evolution | null {
    const ownedItemIds = new Set(items.map(item => item.id));

    for (const evolution of EVOLUTIONS) {
      if (evolution.baseWeaponId !== weaponId) continue;

      const hasCatalyst = ownedItemIds.has(evolution.catalystItemId);
      const hasEvolvedWeapon = ownedItemIds.has(evolution.evolvedWeaponId);
      const meetsLevelRequirement = level >= (evolution.requiredLevel || 5);

      if (hasCatalyst && meetsLevelRequirement && !hasEvolvedWeapon) {
        return evolution;
      }
    }

    return null;
  }

  /**
   * Get all evolutions (for documentation/help)
   */
  getAllEvolutions(): Evolution[] {
    return [...EVOLUTIONS];
  }
}
