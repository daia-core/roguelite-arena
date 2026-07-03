// Item & upgrade system — runtime logic (database access + PlayerStats aggregation).
// Type definitions live in ./items/types; the static roster lives in ./items/catalog.
// This file re-exports the types for existing importers, so no other file needs changing.

import { TransformationTracker } from './TransformationSystem';
import { DuoTracker, DUO_COMBOS, type DuoCombo } from './DuoSystem';
import type { DamageType } from './Projectile';
import { ItemTier, getItemKinds, type Item, type ItemTag, type ItemKind, type WeaponType, type Weapon } from './items/types';
import { ITEM_CATALOG } from './items/catalog';

// Re-export the item types from their new home so every existing importer
// (Game.ts, Player.ts, ArtifactSystem.ts, …) keeps working unchanged.
export { ItemTier, getItemKinds };
export type { Item, ItemTag, ItemKind, WeaponType, Weapon };

export class ItemDatabase {
  // The full roster now lives in ./items/catalog.ts (pure data). ItemDatabase operates on it.
  private static items: Item[] = ITEM_CATALOG;

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

  // Whether a SECOND copy of this item does anything. Items whose only effects are
  // boolean/weapon flags don't stack — hasShield/hasHoming/hasPoison/hasExplosionOnHit
  // aggregate with .some() and getWeaponType() picks the first weapon with .find(), so a
  // duplicate is pure wasted gold. Anything with an additive or multiplicative stat DOES
  // stack (that stat accumulates), so it stays rebuyable. Used to hide owned non-stacking
  // items from the shop.
  private static readonly MULT_KEYS: (keyof Item)[] = [
    'damageMultiplier', 'meleeDamageMult', 'rangedDamageMult', 'elementalDamageMult',
    'fireRateMultiplier', 'critDamageMultiplier', 'speedMultiplier', 'goldBonus'
  ];
  private static readonly ADD_KEYS: (keyof Item)[] = [
    'critChance', 'maxHealthBonus', 'healthRegen', 'armor', 'lifesteal', 'thorns',
    'multishot', 'piercing', 'projectileSpeed', 'knockback', 'dodge', 'chainLightning',
    'freeze', 'rerollDiscount', 'shopDiscount', 'recycleBonus', 'interestBonus', 'luck', 'xpMagnet',
    'orbitOrbs'
  ];

  static itemStacks(item: Item): boolean {
    for (const k of this.MULT_KEYS) {
      const v = item[k] as number | undefined;
      if (typeof v === 'number' && v !== 1) return true; // multiplier ≠ neutral 1
    }
    for (const k of this.ADD_KEYS) {
      const v = item[k] as number | undefined;
      if (typeof v === 'number' && v !== 0) return true; // additive ≠ neutral 0
    }
    return false; // only boolean/weapon flags left → a duplicate is wasted
  }

  // BROTATO-INSPIRED WEIGHTED SHOP SYSTEM
  // Promotes synergistic builds by weighting shop offerings based on owned items
  static getWeightedShopItems(count: number, wave: number, playerItems: Item[], luck: number = 0, stats?: PlayerStats): Item[] {
    const result: Item[] = [];

    // Owned items that gain NOTHING from a duplicate — never offer these again.
    const nonStackOwned = new Set(
      playerItems.filter(i => !this.itemStacks(i)).map(i => i.id)
    );

    // WEAPON LOCK: a weaponType item REPLACES the active firing style (getWeaponType
    // picks the first weapon), so offering one to a player who's already committed to a
    // build silently destroys their weapon when they buy what looks like an upgrade.
    // Once the player owns a weapon, OR has invested in the default auto-aim gun
    // (multishot / piercing / homing), never offer another weaponType item again — you
    // pick your weapon once, and no purchase can take it from you.
    const weaponCommitted =
      playerItems.some(i => i.weaponType) ||
      playerItems.some(i => i.multishot || i.piercing || i.homing);

    // Get tier-appropriate items for this wave (owned non-stacking items filtered out)
    const getWaveAppropriteItems = (): Item[] => {
      return this.getUnlockedItems().filter(item => {
        if (nonStackOwned.has(item.id)) return false; // already own it and a dupe is useless
        if (weaponCommitted && item.weaponType) return false; // never swap a committed weapon
        if (stats && stats.isItemFullyCapped(item)) return false; // every stat it grants is already maxed

        if (wave <= 2) return item.tier === ItemTier.Common;
        if (wave <= 5) return item.tier <= ItemTier.Uncommon;
        if (wave <= 10) return item.tier <= ItemTier.Rare;
        return true; // All tiers available
      });
    };

    // Extract owned item IDs and tags
    const ownedItemIds = playerItems.map(i => i.id);
    const ownedTags = [...new Set(playerItems.flatMap(i => i.tags))];

    // Duo surfacing: owning one half of a duo gives a 25% chance that the
    // first slot offers the missing partner — threshold moments need to be
    // discoverable, not stumbled into
    const duoTargets: Item[] = [];
    for (const duo of DUO_COMBOS) {
      const hasFirst = ownedItemIds.includes(duo.item1Id);
      const hasSecond = ownedItemIds.includes(duo.item2Id);
      if (hasFirst !== hasSecond) {
        const missing = this.getItemById(hasFirst ? duo.item2Id : duo.item1Id);
        if (missing) duoTargets.push(missing);
      }
    }

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let selectedItem: Item | null = null;

      if (i === 0 && duoTargets.length > 0 && Math.random() < 0.25) {
        const candidate = duoTargets[Math.floor(Math.random() * duoTargets.length)];
        if (!result.some(r => r.id === candidate.id)) {
          selectedItem = candidate;
        }
      }

      if (!selectedItem && roll < 0.20 && ownedItemIds.length > 0) {
        // 20% - EXACT same item you own (stacking/duplicates)
        const randomOwnedItem = playerItems[Math.floor(Math.random() * playerItems.length)];
        const candidates = getWaveAppropriteItems().filter(item => item.id === randomOwnedItem.id);
        if (candidates.length > 0) {
          selectedItem = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }

      if (!selectedItem && roll < 0.35 && ownedTags.length > 0) {
        // 15% - SAME TAG as items you own (synergy promotion)
        const randomTag = ownedTags[Math.floor(Math.random() * ownedTags.length)];
        const candidates = getWaveAppropriteItems().filter(item =>
          item.tags.includes(randomTag) && !result.some(r => r.id === item.id)
        );
        if (candidates.length > 0) {
          selectedItem = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }

      // 65% - General pool, rarity-weighted so legendaries stay special
      // (uniform pick made T4 items as frequent as commons at wave 11+)
      if (!selectedItem) {
        const candidates = getWaveAppropriteItems().filter(item =>
          !result.some(r => r.id === item.id)
        );
        if (candidates.length > 0) {
          // Luck tilts the roll toward the top tiers: Rare/Legendary weights scale with
          // (1 + luck), so a high-roll build sees far more epics/legendaries per shop.
          const luckMult = 1 + Math.max(0, luck);
          const weightOf = (item: Item): number =>
            item.tier === ItemTier.Common ? 100 :
            item.tier === ItemTier.Uncommon ? 60 :
            item.tier === ItemTier.Rare ? 30 * luckMult : 10 * luckMult;
          let total = 0;
          for (const c of candidates) total += weightOf(c);
          let pick = Math.random() * total;
          for (const c of candidates) {
            pick -= weightOf(c);
            if (pick <= 0) { selectedItem = c; break; }
          }
          selectedItem = selectedItem ?? candidates[candidates.length - 1];
        }
      }

      if (selectedItem) {
        result.push(selectedItem);
      }
    }

    return result;
  }

  // Legacy method - redirects to weighted shop
  static getRandomItems(count: number, wave: number = 1): Item[] {
    // No player items = pure random (used for initial state)
    return this.getWeightedShopItems(count, wave, []);
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

// Folded per-item contributions — products for multiplicative fields (identity 1),
// sums for additive fields (identity 0), OR-ed booleans. Recomputed only when the
// item set changes; getters read from this instead of re-looping every frame.
interface ItemAgg {
  // multiplicative
  damageMult: number; meleeDamageMult: number; rangedDamageMult: number; elementalDamageMult: number;
  fireRateMult: number; speedMult: number; critDamageMult: number; projectileSpeedMult: number;
  xpMagnetMult: number; goldMult: number; orbitDamageMult: number; auxMeleeDamageMult: number;
  bombDamageMult: number; bombCooldownMult: number; novaDamageMult: number; novaCooldownMult: number;
  swingDamageMult: number; swingCooldownMult: number; aoeRadiusMult: number;
  // additive
  critChance: number; maxHealthBonus: number; healthRegen: number; armor: number; lifesteal: number;
  thorns: number; knockback: number; piercing: number; multishot: number; dodge: number;
  chainLightning: number; freeze: number; burn: number; bleed: number; doom: number; wound: number;
  multicast: number; rerollDiscount: number; shopDiscount: number; recycleBonus: number;
  interestBonus: number; luck: number; orbitOrbs: number; swingRangeBonus: number;
  swingArcBonus: number; swingAoe: number;
  // boolean
  explosionOnHit: boolean; shield: boolean; homing: boolean; poison: boolean; poisonSpread: boolean;
  auxMelee: boolean; bombDrop: boolean; novaPulse: boolean;
}

function freshAgg(): ItemAgg {
  return {
    damageMult: 1, meleeDamageMult: 1, rangedDamageMult: 1, elementalDamageMult: 1,
    fireRateMult: 1, speedMult: 1, critDamageMult: 1, projectileSpeedMult: 1,
    xpMagnetMult: 1, goldMult: 1, orbitDamageMult: 1, auxMeleeDamageMult: 1,
    bombDamageMult: 1, bombCooldownMult: 1, novaDamageMult: 1, novaCooldownMult: 1,
    swingDamageMult: 1, swingCooldownMult: 1, aoeRadiusMult: 1,
    critChance: 0, maxHealthBonus: 0, healthRegen: 0, armor: 0, lifesteal: 0,
    thorns: 0, knockback: 0, piercing: 0, multishot: 0, dodge: 0,
    chainLightning: 0, freeze: 0, burn: 0, bleed: 0, doom: 0, wound: 0,
    multicast: 0, rerollDiscount: 0, shopDiscount: 0, recycleBonus: 0,
    interestBonus: 0, luck: 0, orbitOrbs: 0, swingRangeBonus: 0,
    swingArcBonus: 0, swingAoe: 0,
    explosionOnHit: false, shield: false, homing: false, poison: false, poisonSpread: false,
    auxMelee: false, bombDrop: false, novaPulse: false,
  };
}

// Player stats calculated from items with affinity system
export class PlayerStats {
  items: Item[] = [];
  affinityTags: ItemTag[] = []; // Character affinity (2 random tags at start)
  transformations: TransformationTracker = new TransformationTracker(); // TRANSFORMATION SYSTEM
  duos: DuoTracker = new DuoTracker(); // DUO COMBO SYSTEM

  // Base stats - BUFFED for better early game (Wave 1 too hard fix)
  baseDamage: number = 25; // Wave 1 balance: kill slimes quickly
  baseFireRate: number = 3.0; // Faster shooting for better feel (shots per second)
  baseSpeed: number = 240; // snappier start (was 200 — early game felt sluggish)
  // Hard ceiling on effective move speed. Stacked speed items/duos/transformations
  // used to compound unbounded and let a broken build zoom uncontrollably across a
  // phone screen. 2x base stays fast for a real speed build but keeps it playable.
  maxSpeed: number = 480;
  baseMaxHealth: number = 100;
  baseCritChance: number = 0.05;
  baseCritMultiplier: number = 2.0;
  baseProjectileSpeed: number = 400;

  // ---- STAT CAPS ----
  // Philosophy (Felix's steer): enemies scale their HP/damage to meet your COMBAT
  // output, so damage / fire rate / crit-damage / multishot / piercing / armor stay
  // UNCAPPED — a broken one-shot build is meant to be reachable. What we DO cap are
  // the quality-of-life & economy stats that enemies never scale against, because
  // past their useful maximum they only trivialise non-combat play (or, for recycle,
  // open an infinite-gold loop). Each is a single tunable constant.
  static readonly GOLD_MULT_CAP = 4;      // ×4 total gold earned (=300%); was ×10, which let income lap the whole shop every wave
  static readonly XP_MAGNET_CAP = 10;     // ×10 pickup radius (base 95 → ~950px, ~full screen)
  static readonly RECYCLE_CAP = 3;        // +300% → recycle refunds at most 100% of item cost (break-even)
  static readonly DODGE_CAP = 0.75;       // 75% (already enforced; named here for the offer filter)
  // Purely a numerical-safety ceiling, NOT a balance cap: unbounded multiplicative
  // stacking on a very deep run overflowed to literal Infinity (the player's "Melee
  // Dmg: Infinityx"), which breaks the UI and risks NaN. 1e15 is astronomically
  // strong (still one-shots everything forever) yet keeps every product finite.
  static readonly SANITY_MULT_CAP = 1e15;

  // ---- ARTIFACT contributions (ArtifactSystem folds its static roster into these) ----
  // Defaults are identity (×1 / +0) so a run with no artifacts behaves exactly as before.
  artifactDamageMult: number = 1;
  artifactFireRateMult: number = 1;
  artifactSpeedMult: number = 1;
  artifactMaxHealthBonus: number = 0;
  artifactCritChanceBonus: number = 0;
  artifactCritMultMult: number = 1;
  artifactXpMult: number = 1;
  // Per-frame runtime multipliers for context-sensitive artifacts (momentum, berserk).
  // Game.ts recomputes these each frame; identity when the artifact isn't held.
  runtimeDamageMult: number = 1;
  runtimeFireRateMult: number = 1;

  // ---- MEMOIZED ITEM AGGREGATION ----
  // Every getter used to re-loop the whole item list on EVERY call, every frame
  // (getDamage/getFireRate/… are read many times per frame). The item list only
  // changes on addItem/removeItem, so we fold all per-item contributions into one
  // bundle once, and getters read from it. Transformation/duo/artifact/runtime
  // modifiers and all caps stay applied at read-time (they change independently of
  // the item set), so results are identical — this only removes the per-frame loops.
  private _agg: ItemAgg = freshAgg();
  private _aggDirty: boolean = true;

  /** Recompute the item-aggregation bundle from the current item list (only when dirty). */
  private ensureAgg(): ItemAgg {
    if (!this._aggDirty) return this._agg;
    const a = freshAgg();
    for (const item of this.items) {
      // Multiplicative (product of item multipliers)
      if (item.damageMultiplier) a.damageMult *= item.damageMultiplier;
      if (item.meleeDamageMult) a.meleeDamageMult *= item.meleeDamageMult;
      if (item.rangedDamageMult) a.rangedDamageMult *= item.rangedDamageMult;
      if (item.elementalDamageMult) a.elementalDamageMult *= item.elementalDamageMult;
      if (item.fireRateMultiplier) a.fireRateMult *= item.fireRateMultiplier;
      if (item.speedMultiplier) a.speedMult *= item.speedMultiplier;
      if (item.critDamageMultiplier) a.critDamageMult *= item.critDamageMultiplier;
      if (item.projectileSpeed) a.projectileSpeedMult *= item.projectileSpeed;
      if (item.xpMagnet) a.xpMagnetMult *= item.xpMagnet;
      if (item.goldBonus) a.goldMult *= item.goldBonus;
      if (item.orbitDamageMult) a.orbitDamageMult *= item.orbitDamageMult;
      if (item.auxMeleeDamageMult) a.auxMeleeDamageMult *= item.auxMeleeDamageMult;
      if (item.bombDamageMult) a.bombDamageMult *= item.bombDamageMult;
      if (item.bombCooldownMult) a.bombCooldownMult *= item.bombCooldownMult;
      if (item.novaDamageMult) a.novaDamageMult *= item.novaDamageMult;
      if (item.novaCooldownMult) a.novaCooldownMult *= item.novaCooldownMult;
      if (item.swingDamageMult) a.swingDamageMult *= item.swingDamageMult;
      if (item.swingCooldownMult) a.swingCooldownMult *= item.swingCooldownMult;
      if (item.aoeRadiusMult) a.aoeRadiusMult *= item.aoeRadiusMult;
      // Additive (sum of item bonuses)
      if (item.critChance) a.critChance += item.critChance;
      if (item.maxHealthBonus) a.maxHealthBonus += item.maxHealthBonus;
      if (item.healthRegen) a.healthRegen += item.healthRegen;
      if (item.armor) a.armor += item.armor;
      if (item.lifesteal) a.lifesteal += item.lifesteal;
      if (item.thorns) a.thorns += item.thorns;
      if (item.knockback) a.knockback += item.knockback;
      if (item.piercing) a.piercing += item.piercing;
      if (item.multishot) a.multishot += item.multishot;
      if (item.dodge) a.dodge += item.dodge;
      if (item.chainLightning) a.chainLightning += item.chainLightning;
      if (item.freeze) a.freeze += item.freeze;
      if (item.burn) a.burn += item.burn;
      if (item.bleed) a.bleed += item.bleed;
      if (item.doom) a.doom += item.doom;
      if (item.wound) a.wound += item.wound;
      if (item.multicast) a.multicast += item.multicast;
      if (item.rerollDiscount) a.rerollDiscount += item.rerollDiscount;
      if (item.shopDiscount) a.shopDiscount += item.shopDiscount;
      if (item.recycleBonus) a.recycleBonus += item.recycleBonus;
      if (item.interestBonus) a.interestBonus += item.interestBonus;
      if (item.luck) a.luck += item.luck;
      if (item.orbitOrbs) a.orbitOrbs += item.orbitOrbs;
      if (item.swingRangeBonus) a.swingRangeBonus += item.swingRangeBonus;
      if (item.swingArcBonus) a.swingArcBonus += item.swingArcBonus;
      if (item.swingAoe) a.swingAoe += item.swingAoe;
      // Boolean (any item carries it)
      if (item.explosionOnHit) a.explosionOnHit = true;
      if (item.shield) a.shield = true;
      if (item.homing) a.homing = true;
      if (item.poison) a.poison = true;
      if (item.poisonSpread) a.poisonSpread = true;
      if (item.auxMelee) a.auxMelee = true;
      if (item.bombDrop) a.bombDrop = true;
      if (item.novaPulse) a.novaPulse = true;
    }
    this._agg = a;
    this._aggDirty = false;
    return a;
  }

  /** Invalidate the memoized bundle — call after any change to the item list. */
  private invalidateAgg(): void {
    this._aggDirty = true;
  }

  constructor() {
    // Randomly assign 2 affinity tags
    const allTags: ItemTag[] = ['melee', 'ranged', 'defensive', 'economic', 'elemental', 'utility'];
    const shuffled = allTags.sort(() => Math.random() - 0.5);
    this.affinityTags = shuffled.slice(0, 2);
  }

  addItem(item: Item): { newDuos: any[]; newTransformations: any[] } {
    this.items.push(item);
    this.invalidateAgg();
    // Track for transformations
    const transformationId = this.transformations.trackItemPickup(item.tags);
    const newTransformations = transformationId ? [transformationId] : [];
    // Track for duo combos
    const newDuos = this.duos.updateDuos(this.items);
    // Return newly unlocked combos for Game.ts to show effects/UI
    return { newDuos, newTransformations };
  }

  removeItem(itemId: string): Item | null {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const [removed] = this.items.splice(index, 1);
      this.invalidateAgg();
      return removed;
    }
    return null;
  }

  getDamage(): number {
    let damage = this.baseDamage;
    damage *= this.ensureAgg().damageMult;
    damage *= this.getSpecializationBonus();
    // TRANSFORMATION BONUS
    damage *= this.transformations.getTotalBonuses().damageMultiplier;
    // DUO COMBO BONUS
    damage *= this.duos.getTotalBonuses().damageMultiplier;
    // ARTIFACT (static) + runtime (momentum ramp) contributions
    damage *= this.artifactDamageMult * this.runtimeDamageMult;
    // Numerical-safety only (not a balance cap) — keep runaway builds finite.
    return Math.min(PlayerStats.SANITY_MULT_CAP, damage);
  }

  // ---- Per-damage-type multipliers (layer on top of getDamage) ----
  // Each is the product of the matching item field, defaulting to 1 when no item
  // carries it — so builds without type items behave exactly as before.
  getMeleeDamageMult(): number {
    return Math.min(PlayerStats.SANITY_MULT_CAP, this.ensureAgg().meleeDamageMult);
  }

  getRangedDamageMult(): number {
    return Math.min(PlayerStats.SANITY_MULT_CAP, this.ensureAgg().rangedDamageMult);
  }

  getElementalDamageMult(): number {
    return Math.min(PlayerStats.SANITY_MULT_CAP, this.ensureAgg().elementalDamageMult);
  }

  /** Damage for a melee-weapon swing: global damage × melee multiplier. */
  getMeleeDamage(): number {
    return this.getDamage() * this.getMeleeDamageMult();
  }

  /** Damage for a fired projectile: global damage × ranged multiplier. */
  getRangedDamage(): number {
    return this.getDamage() * this.getRangedDamageMult();
  }

  getFireRate(): number {
    let rate = this.baseFireRate;
    rate *= this.ensureAgg().fireRateMult;
    // TRANSFORMATION BONUS
    rate *= this.transformations.getTotalBonuses().fireRateMultiplier;
    // DUO COMBO BONUS
    rate *= this.duos.getTotalBonuses().fireRateMultiplier;
    // ARTIFACT (static) + runtime (berserk ramp) contributions
    rate *= this.artifactFireRateMult * this.runtimeFireRateMult;
    // Numerical-safety only (not a balance cap) — keep runaway builds finite.
    return Math.min(PlayerStats.SANITY_MULT_CAP, rate);
  }

  getSpeed(): number {
    let speed = this.baseSpeed;
    speed *= this.ensureAgg().speedMult;
    // TRANSFORMATION BONUS
    speed *= this.transformations.getTotalBonuses().speedMultiplier;
    // DUO COMBO BONUS
    speed *= this.duos.getTotalBonuses().speedMultiplier;
    // ARTIFACT contribution
    speed *= this.artifactSpeedMult;
    return Math.min(speed, this.maxSpeed); // clamp so broken builds can't zoom off-screen
  }

  getMaxHealth(): number {
    let health = this.baseMaxHealth;
    health += this.ensureAgg().maxHealthBonus;
    // TRANSFORMATION BONUS
    health += this.transformations.getTotalBonuses().maxHealthBonus;
    // ARTIFACT contribution
    health += this.artifactMaxHealthBonus;
    return Math.max(1, health);
  }

  getCritChance(): number {
    let chance = this.baseCritChance;
    chance += this.ensureAgg().critChance;
    // TRANSFORMATION BONUS
    chance += this.transformations.getTotalBonuses().critChance;
    // DUO COMBO BONUS
    chance += this.duos.getTotalBonuses().critChance;
    // ARTIFACT contribution
    chance += this.artifactCritChanceBonus;
    return Math.min(1, chance);
  }

  getCritMultiplier(): number {
    let mult = this.baseCritMultiplier;
    mult *= this.ensureAgg().critDamageMult;
    // TRANSFORMATION BONUS
    mult *= this.transformations.getTotalBonuses().critDamageMultiplier;
    // ARTIFACT contribution
    mult *= this.artifactCritMultMult;
    // Numerical-safety only (not a balance cap) — keep runaway builds finite.
    return Math.min(PlayerStats.SANITY_MULT_CAP, mult);
  }

  getHealthRegen(): number {
    return this.ensureAgg().healthRegen;
  }

  /** Flat armor from meta progression (set by Game at run start). */
  metaArmor: number = 0;
  /** Additional shop discount from meta progression. */
  metaShopDiscount: number = 0;

  getArmor(): number {
    let armor = this.metaArmor;
    armor += this.ensureAgg().armor;
    // TRANSFORMATION BONUS
    armor += this.transformations.getTotalBonuses().armor;
    return armor;
  }

  getLifesteal(): number {
    let lifesteal = this.ensureAgg().lifesteal;
    // DUO COMBO BONUS
    lifesteal += this.duos.getTotalBonuses().lifesteal;
    // Cap at 100% — a dedicated vampire build can fully convert damage to healing,
    // but overheal beyond that is wasted (heal() clamps to maxHP anyway) and an
    // uncapped value made a heavy-lifesteal build trivially unkillable.
    return Math.min(1, lifesteal);
  }

  getThorns(): number {
    return this.ensureAgg().thorns;
  }

  getProjectileSpeed(): number {
    return this.baseProjectileSpeed * this.ensureAgg().projectileSpeedMult;
  }

  getKnockback(): number {
    return this.ensureAgg().knockback;
  }

  getPiercing(): number {
    let pierce = this.ensureAgg().piercing;
    // DUO COMBO BONUS
    pierce += this.duos.getTotalBonuses().piercing;
    return pierce;
  }

  getXPMagnet(): number {
    let magnet = this.ensureAgg().xpMagnetMult;
    // TRANSFORMATION BONUS
    magnet *= this.transformations.getTotalBonuses().xpMagnet;
    // Pure pickup-convenience — enemies don't scale against it, so cap it.
    return Math.min(PlayerStats.XP_MAGNET_CAP, magnet);
  }

  getGoldBonus(): number {
    let bonus = this.ensureAgg().goldMult;
    // TRANSFORMATION BONUS
    bonus *= this.transformations.getTotalBonuses().goldBonus;
    // Economy stat with no monster counter-scaling — cap it (Felix's example).
    return Math.min(PlayerStats.GOLD_MULT_CAP, bonus);
  }

  getDodgeChance(): number {
    return Math.min(PlayerStats.DODGE_CAP, this.ensureAgg().dodge);
  }

  getChainLightningChance(): number {
    let chance = this.ensureAgg().chainLightning;
    // DUO COMBO BONUS
    chance += this.duos.getTotalBonuses().chainLightning;
    return Math.min(1, chance);
  }

  getFreezeChance(): number {
    let chance = this.ensureAgg().freeze;
    // DUO COMBO BONUS
    chance += this.duos.getTotalBonuses().freeze;
    return Math.min(1, chance);
  }

  // ---- Status engines (Phase 3b) ----
  getBurnChance(): number {
    return Math.min(1, this.ensureAgg().burn);
  }

  /**
   * The dominant elemental identity of the current build, used to tint outgoing
   * player projectiles (Player.shoot → Projectile.setElement) so an elemental
   * build LOOKS elemental. Picks the strongest of burn/freeze/chain/poison; a
   * build with no elemental stat stays 'physical' (default cyan). Purely visual
   * — does not change damage or which statuses roll on hit.
   */
  getShotElement(): DamageType {
    const scored: Array<[DamageType, number]> = [
      ['fire', this.getBurnChance()],
      ['ice', this.getFreezeChance()],
      ['lightning', this.getChainLightningChance()],
      ['poison', this.hasPoison() ? 0.5 : 0],
    ];
    let best: DamageType = 'physical';
    let bestV = 0.001; // threshold so a raw/no-element build stays physical
    for (const [el, v] of scored) {
      if (v > bestV) { bestV = v; best = el; }
    }
    return best;
  }

  getBleedChance(): number {
    return Math.min(1, this.ensureAgg().bleed);
  }

  hasPoisonSpread(): boolean {
    return this.ensureAgg().poisonSpread;
  }

  getDoomChance(): number {
    return Math.min(1, this.ensureAgg().doom);
  }

  getWoundChance(): number {
    return Math.min(1, this.ensureAgg().wound);
  }

  getMulticastChance(): number {
    return Math.min(0.9, this.ensureAgg().multicast); // cap so it never becomes an infinite volley
  }

  // Brotato-inspired: Economic modifiers
  getRerollDiscount(): number {
    return Math.min(0.6, this.ensureAgg().rerollDiscount); // Max 60% discount (was 90% — near-free rerolls let you fish out every maxing item)
  }

  getShopDiscount(): number {
    let discount = this.ensureAgg().shopDiscount;
    // TRANSFORMATION BONUS
    discount += this.transformations.getTotalBonuses().shopDiscount;
    return Math.min(0.3, discount); // Max 30% discount (was 50% — combined with runaway gold it made the shop free)
  }

  getRecycleBonus(): number {
    // Cap so a buy→recycle loop can at best break even (refund ≤ 100% of cost),
    // never mint infinite gold. Enemies don't scale against economy, so it's capped.
    return Math.min(PlayerStats.RECYCLE_CAP, this.ensureAgg().recycleBonus);
  }

  // Banking: extra interest rate on gold you hold entering the shop
  getInterestBonus(): number {
    return Math.min(0.4, this.ensureAgg().interestBonus); // cap +40% so interest stays bounded
  }

  // Luck: raises shop rarity weighting + health-orb drop chance (additive across items)
  getLuck(): number {
    return Math.min(1.0, this.ensureAgg().luck); // cap +100% (was +200%) so legendaries don't flood the shop by wave 7
  }

  hasPiercing(): boolean {
    return this.getPiercing() > 0;
  }

  hasExplosionOnKill(): boolean {
    return this.ensureAgg().explosionOnHit;
  }

  hasExplosionOnHit(): boolean {
    return this.ensureAgg().explosionOnHit;
  }

  hasShield(): boolean {
    return this.ensureAgg().shield;
  }

  hasHoming(): boolean {
    return this.ensureAgg().homing;
  }

  hasPoison(): boolean {
    return this.ensureAgg().poison;
  }

  getMultishot(): number {
    return this.ensureAgg().multishot;
  }

  // ---- OFFER-FILTER: hide items whose every effect is an already-maxed stat ----
  // Field groups used to inspect an arbitrary item. Multiplicative fields are neutral
  // at 1, additive at 0; boolean/weapon fields always carry potential value.
  private static readonly OFFER_MULT_FIELDS: (keyof Item)[] = [
    'damageMultiplier', 'meleeDamageMult', 'rangedDamageMult', 'elementalDamageMult',
    'fireRateMultiplier', 'speedMultiplier', 'critDamageMultiplier', 'projectileSpeed',
    'xpMagnet', 'goldBonus', 'orbitDamageMult', 'auxMeleeDamageMult', 'bombDamageMult',
    'bombCooldownMult', 'novaDamageMult', 'novaCooldownMult', 'swingDamageMult',
    'swingCooldownMult', 'aoeRadiusMult',
  ];
  private static readonly OFFER_ADD_FIELDS: (keyof Item)[] = [
    'critChance', 'maxHealthBonus', 'healthRegen', 'armor', 'lifesteal', 'thorns',
    'knockback', 'piercing', 'multishot', 'dodge', 'chainLightning', 'freeze', 'burn',
    'bleed', 'doom', 'wound', 'multicast', 'rerollDiscount', 'shopDiscount',
    'recycleBonus', 'interestBonus', 'luck', 'orbitOrbs', 'swingRangeBonus',
    'swingArcBonus', 'swingAoe',
  ];
  private static readonly OFFER_BOOL_FIELDS: (keyof Item)[] = [
    'explosionOnHit', 'shield', 'homing', 'poison', 'poisonSpread', 'auxMelee',
    'bombDrop', 'novaPulse',
  ];

  // Which capped stats are currently AT their cap. Only stats that HAVE a cap appear
  // here; uncapped combat stats (damage, multishot, piercing, armor, …) are absent on
  // purpose, so an item touching one of them is never treated as fully capped.
  private cappedFieldsMaxed(): Partial<Record<keyof Item, boolean>> {
    const agg = this.ensureAgg();
    return {
      dodge: this.getDodgeChance() >= PlayerStats.DODGE_CAP,
      critChance: this.getCritChance() >= 1,
      lifesteal: this.getLifesteal() >= 1,
      shopDiscount: this.getShopDiscount() >= 0.5,
      rerollDiscount: this.getRerollDiscount() >= 0.9,
      interestBonus: this.getInterestBonus() >= 0.4,
      luck: this.getLuck() >= 2.0,
      chainLightning: this.getChainLightningChance() >= 1,
      freeze: this.getFreezeChance() >= 1,
      burn: this.getBurnChance() >= 1,
      bleed: this.getBleedChance() >= 1,
      doom: this.getDoomChance() >= 1,
      wound: this.getWoundChance() >= 1,
      multicast: this.getMulticastChance() >= 0.9,
      goldBonus: agg.goldMult >= PlayerStats.GOLD_MULT_CAP,
      xpMagnet: agg.xpMagnetMult >= PlayerStats.XP_MAGNET_CAP,
      recycleBonus: agg.recycleBonus >= PlayerStats.RECYCLE_CAP,
    };
  }

  // True when EVERY effect this item provides is a capped stat already at its cap, so
  // buying it would do literally nothing — e.g. a pure Dodge item once Dodge is 75%.
  // Anything with an uncapped stat or a boolean/weapon effect returns false (still useful).
  isItemFullyCapped(item: Item): boolean {
    if (item.weaponType) return false;
    for (const b of PlayerStats.OFFER_BOOL_FIELDS) {
      if (item[b]) return false;
    }
    const maxed = this.cappedFieldsMaxed();
    let sawCappedStat = false;
    for (const f of PlayerStats.OFFER_MULT_FIELDS) {
      const v = item[f] as number | undefined;
      if (typeof v !== 'number' || v === 1) continue; // neutral multiplier
      if (!maxed[f]) return false;                    // uncapped, or capped-but-not-maxed → useful
      sawCappedStat = true;
    }
    for (const f of PlayerStats.OFFER_ADD_FIELDS) {
      const v = item[f] as number | undefined;
      if (typeof v !== 'number' || v === 0) continue; // neutral additive
      if (!maxed[f]) return false;
      sawCappedStat = true;
    }
    return sawCappedStat;
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

  // ── Synergy-clarity helpers (feed the shop's COMBOS panel) ──

  // Duos the player has BOTH items for (currently active / firing now).
  getActiveDuos(): DuoCombo[] {
    return DUO_COMBOS.filter(duo =>
      this.items.some(o => o.id === duo.item1Id) &&
      this.items.some(o => o.id === duo.item2Id)
    );
  }

  // Duos the player is exactly one item away from, plus the still-needed
  // partner — so the shop can say "have X → get Y → <effect>".
  getPotentialDuos(): Array<{ duo: DuoCombo; owned: Item | undefined; needed: Item | undefined }> {
    const out: Array<{ duo: DuoCombo; owned: Item | undefined; needed: Item | undefined }> = [];
    for (const duo of DUO_COMBOS) {
      const ownsFirst = this.items.some(o => o.id === duo.item1Id);
      const ownsSecond = this.items.some(o => o.id === duo.item2Id);
      if (ownsFirst !== ownsSecond) {
        const ownedId = ownsFirst ? duo.item1Id : duo.item2Id;
        const neededId = ownsFirst ? duo.item2Id : duo.item1Id;
        out.push({
          duo,
          owned: ItemDatabase.getItemById(ownedId),
          needed: ItemDatabase.getItemById(neededId),
        });
      }
    }
    return out;
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
    // BALANCE: Brotato-inspired pricing formula for tighter economy
    // Prices scale more aggressively to prevent player from getting rich
    // Prices scale with wave so late-game buying is a real CHOICE, not a
    // buy-the-whole-shop formality. Linear alone (+15%/wave) stayed trivial
    // once gold income snowballs, so this compounds past wave 6 to mirror the
    // enemy/power curve — deep-wave items cost hundreds-to-thousands.
    //   wave 3 -> ~2.5x  wave 7 -> ~5.3x  wave 14 -> ~24x  wave 20 -> ~80x
    // BALANCE 2026-07-03: income was out-earning the whole shop every wave by ~7,
    // so every stat maxed early. Steeper base slope + compound from wave 3 makes
    // late buys a real choice again (a full shop is no longer free).
    const basePrice = item.cost;
    const linear = 1 + wave * 0.25;
    const compound = Math.pow(1.18, Math.max(0, wave - 3));
    let finalPrice = basePrice * linear * compound;

    // Apply shop discount (items + meta, shared 30% cap — was 50%, which combined
    // with runaway gold made buy-out free).
    const discount = Math.min(0.3, this.getShopDiscount() + this.metaShopDiscount);
    finalPrice *= (1 - discount);

    return Math.max(1, Math.floor(finalPrice));
  }

  // Calculate recycle value (25% base + recycle bonus)
  getRecycleValue(item: Item): number {
    const baseValue = item.cost * 0.25;
    const bonus = this.getRecycleBonus();
    return Math.floor(baseValue * (1 + bonus));
  }

  // Weapon system
  getWeaponType(): WeaponType {
    // Find the first weapon-type item (only one weapon can be active at a time)
    const weaponItem = this.items.find(item => item.weaponType);
    return weaponItem?.weaponType ?? 'auto-aim';
  }

  getWeaponRange(): number {
    const weaponItem = this.items.find(item => item.weaponType);
    return weaponItem?.weaponRange ?? 0;
  }

  getWeaponArc(): number {
    const weaponItem = this.items.find(item => item.weaponType);
    return weaponItem?.weaponArc ?? 0;
  }

  hasWeapon(): boolean {
    return this.items.some(item => item.weaponType);
  }

  // ==================== AUXILIARY STACKING WEAPONS ====================
  // These layer ON TOP of the primary weaponType (they never replace it).

  /** Number of orbs circling the player (sum across items). */
  getOrbitOrbCount(): number {
    return this.ensureAgg().orbitOrbs;
  }

  /** Contact damage per orbit orb — scaled off the player's base damage. */
  getOrbitDamage(): number {
    return this.getDamage() * 0.9 * this.ensureAgg().orbitDamageMult;
  }

  hasAuxMelee(): boolean {
    return this.ensureAgg().auxMelee;
  }

  /** Whirling-arc damage — leans on melee scaling so melee builds amplify it. */
  getAuxMeleeDamage(): number {
    return this.getMeleeDamage() * 1.1 * this.ensureAgg().auxMeleeDamageMult;
  }

  // ==================== DEFAULT MELEE SWING ====================
  // Every player auto-swings at nearby enemies. It STACKS on top of the always-
  // firing ranged weapon (a melee build just invests items into the swing, and
  // still shoots a weak gun). Swing items shape damage/reach/arc/speed/AOE.

  /** Swing damage — 60% of melee damage baseline, ramped by swing/aux-melee items. */
  getSwingDamage(): number {
    const a = this.ensureAgg();
    // baseline 0.6 (the free swing is a light default) × swing items × legacy aux-melee items
    const mult = 0.6 * a.swingDamageMult * a.auxMeleeDamageMult;
    return this.getMeleeDamage() * mult;
  }

  /** Swing reach in px (base 70 + item bonuses). */
  getSwingRange(): number {
    return 70 + this.ensureAgg().swingRangeBonus;
  }

  /** Swing arc width in radians (base ~126°, widened by items, capped at full circle). */
  getSwingArc(): number {
    return Math.min(Math.PI * 0.7 + this.ensureAgg().swingArcBonus, Math.PI * 2);
  }

  /** Seconds between swings (base 0.85s, scaled by cooldown items). */
  getSwingInterval(): number {
    return 0.85 * this.ensureAgg().swingCooldownMult;
  }

  /** Full-circle AOE burst radius on each swing (0 = none), scaled by global area. */
  getSwingAoe(): number {
    return this.ensureAgg().swingAoe * this.getAoeRadiusMult();
  }

  /** Global area-of-effect multiplier — scales swing AOE, nova, and bomb radii. */
  getAoeRadiusMult(): number {
    return this.ensureAgg().aoeRadiusMult;
  }

  /** Knockback the swing imparts — a light base shove plus any item knockback. */
  getSwingKnockback(): number {
    return 40 + this.getKnockback();
  }

  hasBombDrop(): boolean {
    return this.ensureAgg().bombDrop;
  }

  getBombDamage(): number {
    return this.getDamage() * 3.0 * this.ensureAgg().bombDamageMult;
  }

  /** Seconds between bomb drops (base 3.5s, faster with cooldown items). */
  getBombCooldown(): number {
    return Math.max(0.6, 3.5 * this.ensureAgg().bombCooldownMult);
  }

  hasNova(): boolean {
    return this.ensureAgg().novaPulse;
  }

  getNovaDamage(): number {
    return this.getDamage() * 1.6 * this.ensureAgg().novaDamageMult;
  }

  /** Seconds between nova pulses (base 4s, faster with cooldown items). */
  getNovaCooldown(): number {
    return Math.max(0.8, 4.0 * this.ensureAgg().novaCooldownMult);
  }
}
