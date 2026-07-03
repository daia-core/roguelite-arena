/**
 * Weapon Evolution System (Vampire Survivors inspired)
 *
 * A weapon evolves into a more powerful signature version when the player has all of:
 * 1. The base weapon item (a real weaponType/heavy-melee item from the catalog)
 * 2. A specific "catalyst" passive item that thematically fits the weapon
 * 3. Reached a wave threshold (default: wave 8)
 *
 * The evolved weapon is a real catalog item flagged `unlocked: false`, so it never rolls
 * in the shop — it is obtainable ONLY through evolution. On evolve, the base weapon item is
 * replaced in-place by the evolved item; the catalyst is kept (its effect stacks on).
 *
 * Example: "Scatter Gun" + "Demolition Kit" (wave 8+) → "Hellfire Barrage"
 *
 * The evolution check runs at wave-clear (Game.checkWeaponEvolution → enterShop), so it is
 * reachable through genuine play: every base weapon and every catalyst is a shop-obtainable
 * `unlocked: true` item, so the precondition can actually be assembled in a normal run.
 */

import type { Item } from './ItemSystem';

export interface Evolution {
  id: string;
  baseWeaponId: string;      // The weapon to evolve (a real catalog weapon item)
  catalystItemId: string;     // Required passive item (a real, shop-obtainable item)
  evolvedWeaponId: string;    // Result weapon (a real catalog item, unlocked:false)
  requiredWave?: number;      // Minimum wave reached (default: 8)
  name: string;
  description: string;
}

// How far into a run evolutions unlock. Wave 8 is deliberately just past the wave-7
// power spike, so a committed weapon+catalyst build gets a signature payoff mid-run.
export const DEFAULT_EVOLUTION_WAVE = 8;

// Define all weapon evolutions. Every id below is a real item in items/catalog.ts.
export const EVOLUTIONS: Evolution[] = [
  // SCATTER GUN → HELLFIRE BARRAGE (with Demolition Kit)
  {
    id: 'shotgun_evolution',
    baseWeaponId: 'shotgun_weapon_t2',
    catalystItemId: 'explosive_t3',
    evolvedWeaponId: 'shotgun_evolved',
    requiredWave: DEFAULT_EVOLUTION_WAVE,
    name: 'Hellfire Barrage',
    description: 'Scatter Gun + Demolition Kit — a wall of exploding pellets'
  },

  // BEAM RIFLE → ARC LANCE (with Storm Essence)
  {
    id: 'laser_evolution',
    baseWeaponId: 'laser_weapon_t3',
    catalystItemId: 'chain_lightning_t3',
    evolvedWeaponId: 'laser_evolved',
    requiredWave: DEFAULT_EVOLUTION_WAVE,
    name: 'Arc Lance',
    description: 'Beam Rifle + Storm Essence — a chaining piercing beam'
  },

  // SATELLITE ORBS → ORBITAL HALO (with Trident)
  {
    id: 'orbital_evolution',
    baseWeaponId: 'orbital_weapon_t3',
    catalystItemId: 'multishot_t3',
    evolvedWeaponId: 'orbital_evolved',
    requiredWave: DEFAULT_EVOLUTION_WAVE,
    name: 'Orbital Halo',
    description: 'Satellite Orbs + Trident — a dense ring of heavy orbs'
  },

  // THUNDER HAMMER → MOLTEN WARHAMMER (with Wildfire Torch)
  {
    id: 'hammer_evolution',
    baseWeaponId: 'hammer_weapon_t3',
    catalystItemId: 'wildfire_torch_t3',
    evolvedWeaponId: 'hammer_evolved',
    requiredWave: DEFAULT_EVOLUTION_WAVE,
    name: 'Molten Warhammer',
    description: 'Thunder Hammer + Wildfire Torch — a faster, wider, burning quake'
  }
];

export class EvolutionSystem {
  /**
   * Check if any weapons can evolve given current items and the wave reached.
   * Returns every currently-available evolution.
   */
  checkEvolutions(items: Item[], wave: number): Evolution[] {
    const ownedItemIds = new Set(items.map(item => item.id));
    const possibleEvolutions: Evolution[] = [];

    for (const evolution of EVOLUTIONS) {
      // Check if we have both base weapon and catalyst
      const hasBaseWeapon = ownedItemIds.has(evolution.baseWeaponId);
      const hasCatalyst = ownedItemIds.has(evolution.catalystItemId);
      const hasEvolvedWeapon = ownedItemIds.has(evolution.evolvedWeaponId);
      const meetsWaveRequirement = wave >= (evolution.requiredWave ?? DEFAULT_EVOLUTION_WAVE);

      // Only offer an evolution if:
      // 1. We own base + catalyst
      // 2. We've reached the required wave
      // 3. We don't already have the evolved weapon
      if (hasBaseWeapon && hasCatalyst && meetsWaveRequirement && !hasEvolvedWeapon) {
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
  canWeaponEvolve(weaponId: string, items: Item[], wave: number): Evolution | null {
    const ownedItemIds = new Set(items.map(item => item.id));

    for (const evolution of EVOLUTIONS) {
      if (evolution.baseWeaponId !== weaponId) continue;

      const hasCatalyst = ownedItemIds.has(evolution.catalystItemId);
      const hasEvolvedWeapon = ownedItemIds.has(evolution.evolvedWeaponId);
      const meetsWaveRequirement = wave >= (evolution.requiredWave ?? DEFAULT_EVOLUTION_WAVE);

      if (hasCatalyst && meetsWaveRequirement && !hasEvolvedWeapon) {
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
