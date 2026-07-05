// Item & upgrade system — runtime logic (database access + PlayerStats aggregation).
// Type definitions live in ./items/types; the static roster lives in ./items/catalog.
// This file re-exports the types for existing importers, so no other file needs changing.

import { TransformationTracker } from './TransformationSystem';
import { DuoTracker, DUO_COMBOS, type DuoCombo } from './DuoSystem';
import type { DamageType } from './Projectile';
import { ItemTier, getItemKinds, classifyItemSlot, slotHolder, type Item, type ItemTag, type ItemKind, type WeaponType, type MeleeStyle, type Weapon, type EquipSlot } from './items/types';
import { ITEM_CATALOG } from './items/catalog';

// Re-export the item types from their new home so every existing importer
// (Game.ts, Player.ts, ArtifactSystem.ts, …) keeps working unchanged.
export { ItemTier, getItemKinds, classifyItemSlot };
export type { Item, ItemTag, ItemKind, WeaponType, Weapon, EquipSlot };

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

    // SLOT REWORK (2026-07-05): weapons are now equipment that lives in weapon slots.
    // Buying a weapon when the slots are full AUTO-SWAPS the old one into the stash
    // (never destroys it), so — unlike the old model — it's safe and intended to keep
    // offering DIFFERENT weapons: that's the buy-to-swap build decision Felix asked for.
    // `nonStackOwned` already stops us re-offering a weapon you already hold (weapons
    // don't stack), so we only ever surface a genuinely different weapon to swap toward.
    // (Phase 3 will add slot-frequency awareness so we don't over-offer weapons once
    // both slots are committed; for now the tier/weighting mix keeps them in proportion.)

    // Get tier-appropriate items for this wave (owned non-stacking items filtered out)
    const getWaveAppropriteItems = (): Item[] => {
      return this.getUnlockedItems().filter(item => {
        if (nonStackOwned.has(item.id)) return false; // already own it and a dupe is useless
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
  // conditional/triggered (additive rates; paid out at runtime by Game when the condition holds)
  waveRampDamage: number; lowHpPower: number; killStackDamage: number;
  highHpPower: number; goldScaleDamage: number;
  // execute: highest threshold wins (max, not sum)
  executeThreshold: number;
  // on-kill proc: daggers spawned per kill (additive across copies)
  daggerCount: number;
  // wave-end economy: gold-per-wave multiplier (additive across copies)
  warChest: number;
  // boolean
  explosionOnHit: boolean; shield: boolean; homing: boolean; poison: boolean; poisonSpread: boolean;
  auxMelee: boolean; bombDrop: boolean; novaPulse: boolean; fourleafCharm: boolean;
  soulTithe: boolean; loadedShot: boolean;
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
    waveRampDamage: 0, lowHpPower: 0, killStackDamage: 0,
    highHpPower: 0, goldScaleDamage: 0,
    executeThreshold: 0,
    daggerCount: 0,
    warChest: 0,
    explosionOnHit: false, shield: false, homing: false, poison: false, poisonSpread: false,
    auxMelee: false, bombDrop: false, novaPulse: false, fourleafCharm: false,
    soulTithe: false, loadedShot: false,
  };
}

// The eight equipment slots (2026-07-05 v2). `weapon` holds a 1h OR 2h weapon; a 2h
// weapon disables the offhand. The other six are gear/keystone slots, one item each.
// `null` = empty slot.
export type EquipSlots = {
  weapon: Item | null;
  offhand: Item | null;
  head: Item | null;
  amulet: Item | null;
  torso: Item | null;
  legs: Item | null;
  feet: Item | null;
  ring: Item | null;
};

// The holder keys in a stable display order (used by UI + rebuild + iteration).
export const EQUIP_HOLDER_KEYS = ['weapon', 'offhand', 'head', 'amulet', 'torso', 'legs', 'feet', 'ring'] as const;
export type EquipHolderKey = typeof EQUIP_HOLDER_KEYS[number];

// Player stats calculated from items with affinity system
export class PlayerStats {
  // items[] is the AGGREGATION source of truth: every item ACTIVE on the player
  // (all equipped slots + every trinket). The equipment/stash/trinket structures
  // below are an admission-control layer over ownership that decides what may be
  // active at once — they always stay in sync with items[] via the equip helpers,
  // so all the existing getters/aggregation keep working unchanged.
  items: Item[] = [];

  // ---- EQUIPMENT LAYER (2026-07-05 v2 8-slot rework) ----
  equipment: EquipSlots = {
    weapon: null, offhand: null, head: null, amulet: null,
    torso: null, legs: null, feet: null, ring: null,
  };
  // Run-only inventory for displaced / speculative equipment. Capped so decisions
  // stay tight and the mobile inventory strip doesn't bloat. Trinkets never go here.
  stash: Item[] = [];
  static readonly STASH_CAP = 8;
  // Trinkets: unlimited stacking stat/effect items. Mirrored into items[] (active).
  trinkets: Item[] = [];

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
      // UPGRADE LEVEL (v2): an item at level N contributes exactly as if bought N times.
      //   additive:       value × N   multiplicative: value ^ N   boolean/max: unchanged.
      const lv = item.upgradeLevel && item.upgradeLevel > 1 ? item.upgradeLevel : 1;
      const mul = (v: number) => (lv === 1 ? v : Math.pow(v, lv));
      // Multiplicative (product of item multipliers, each applied `lv` times)
      if (item.damageMultiplier) a.damageMult *= mul(item.damageMultiplier);
      if (item.meleeDamageMult) a.meleeDamageMult *= mul(item.meleeDamageMult);
      if (item.rangedDamageMult) a.rangedDamageMult *= mul(item.rangedDamageMult);
      if (item.elementalDamageMult) a.elementalDamageMult *= mul(item.elementalDamageMult);
      if (item.fireRateMultiplier) a.fireRateMult *= mul(item.fireRateMultiplier);
      if (item.speedMultiplier) a.speedMult *= mul(item.speedMultiplier);
      if (item.critDamageMultiplier) a.critDamageMult *= mul(item.critDamageMultiplier);
      if (item.projectileSpeed) a.projectileSpeedMult *= mul(item.projectileSpeed);
      if (item.xpMagnet) a.xpMagnetMult *= mul(item.xpMagnet);
      if (item.goldBonus) a.goldMult *= mul(item.goldBonus);
      if (item.orbitDamageMult) a.orbitDamageMult *= mul(item.orbitDamageMult);
      if (item.auxMeleeDamageMult) a.auxMeleeDamageMult *= mul(item.auxMeleeDamageMult);
      if (item.bombDamageMult) a.bombDamageMult *= mul(item.bombDamageMult);
      if (item.bombCooldownMult) a.bombCooldownMult *= mul(item.bombCooldownMult);
      if (item.novaDamageMult) a.novaDamageMult *= mul(item.novaDamageMult);
      if (item.novaCooldownMult) a.novaCooldownMult *= mul(item.novaCooldownMult);
      if (item.swingDamageMult) a.swingDamageMult *= mul(item.swingDamageMult);
      if (item.swingCooldownMult) a.swingCooldownMult *= mul(item.swingCooldownMult);
      if (item.aoeRadiusMult) a.aoeRadiusMult *= mul(item.aoeRadiusMult);
      // Additive (sum of item bonuses, each scaled by `lv`)
      if (item.critChance) a.critChance += item.critChance * lv;
      if (item.maxHealthBonus) a.maxHealthBonus += item.maxHealthBonus * lv;
      if (item.healthRegen) a.healthRegen += item.healthRegen * lv;
      if (item.armor) a.armor += item.armor * lv;
      if (item.lifesteal) a.lifesteal += item.lifesteal * lv;
      if (item.thorns) a.thorns += item.thorns * lv;
      if (item.knockback) a.knockback += item.knockback * lv;
      if (item.piercing) a.piercing += item.piercing * lv;
      if (item.multishot) a.multishot += item.multishot * lv;
      if (item.dodge) a.dodge += item.dodge * lv;
      if (item.chainLightning) a.chainLightning += item.chainLightning * lv;
      if (item.freeze) a.freeze += item.freeze * lv;
      if (item.burn) a.burn += item.burn * lv;
      if (item.bleed) a.bleed += item.bleed * lv;
      if (item.doom) a.doom += item.doom * lv;
      if (item.wound) a.wound += item.wound * lv;
      if (item.multicast) a.multicast += item.multicast * lv;
      if (item.rerollDiscount) a.rerollDiscount += item.rerollDiscount * lv;
      if (item.shopDiscount) a.shopDiscount += item.shopDiscount * lv;
      if (item.recycleBonus) a.recycleBonus += item.recycleBonus * lv;
      if (item.interestBonus) a.interestBonus += item.interestBonus * lv;
      if (item.luck) a.luck += item.luck * lv;
      if (item.orbitOrbs) a.orbitOrbs += item.orbitOrbs * lv;
      if (item.swingRangeBonus) a.swingRangeBonus += item.swingRangeBonus * lv;
      if (item.swingArcBonus) a.swingArcBonus += item.swingArcBonus * lv;
      if (item.swingAoe) a.swingAoe += item.swingAoe * lv;
      // Conditional/triggered (additive rates; Game pays them out per-frame)
      if (item.waveRampDamage) a.waveRampDamage += item.waveRampDamage * lv;
      if (item.lowHpPower) a.lowHpPower += item.lowHpPower * lv;
      if (item.killStackDamage) a.killStackDamage += item.killStackDamage * lv;
      if (item.highHpPower) a.highHpPower += item.highHpPower * lv;
      if (item.goldScaleDamage) a.goldScaleDamage += item.goldScaleDamage * lv;
      // Execute: take the strongest threshold, never sum (no compounding to full-HP kills)
      if (item.executeThreshold) a.executeThreshold = Math.max(a.executeThreshold, item.executeThreshold);
      // On-kill daggers: additive count across copies (× level)
      if (item.ceremonialDaggers) a.daggerCount += item.ceremonialDaggers * lv;
      if (item.warChest) a.warChest += item.warChest * lv;
      // Boolean (any item carries it)
      if (item.explosionOnHit) a.explosionOnHit = true;
      if (item.shield) a.shield = true;
      if (item.homing) a.homing = true;
      if (item.poison) a.poison = true;
      if (item.poisonSpread) a.poisonSpread = true;
      if (item.auxMelee) a.auxMelee = true;
      if (item.bombDrop) a.bombDrop = true;
      if (item.novaPulse) a.novaPulse = true;
      if (item.fourleafCharm) a.fourleafCharm = true;
      if (item.soulTithe) a.soulTithe = true;
      if (item.loadedShot) a.loadedShot = true;
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

  // ==================== EQUIPMENT LAYER ====================
  // items[] must always equal (equipped slots) + trinkets. Rebuild it from those
  // sources after any structural change, then refresh the memoized aggregation and
  // the duo/transformation trackers (which read items[]). One choke-point keeps the
  // invariant impossible to break.
  private rebuildActiveItems(): DuoCombo[] {
    const eq = this.equipment;
    this.items = EQUIP_HOLDER_KEYS.map(k => eq[k])
      .filter((i): i is Item => i !== null)
      .concat(this.trinkets);
    this.invalidateAgg();
    // updateDuos is state-marking (returns only NEWLY activated combos and mutates
    // its active set), so it must run EXACTLY ONCE per structural change. Callers that
    // need the fanfare list (addItem) use this return; removal paths ignore it but the
    // call still correctly deactivates duos whose items left.
    return this.duos.updateDuos(this.items);
  }

  /**
   * Buy/acquire an item — the single routing entry point.
   *
   * UPGRADE-ON-DUPLICATE (2026-07-05 v2): if the player already OWNS this item (same
   * base id, whether equipped in a slot or in the trinket pile), a buy UPGRADES that
   * instance (+1 upgradeLevel) instead of adding a second copy or swapping — "buy the
   * same amulet again → Amulet +2". Aggregation scales each contribution by the level,
   * so level N is exactly "bought N times". A stash copy is treated as owned too (its
   * level bumps), so re-buying while a copy sits benched deepens the benched piece.
   *
   * Otherwise it classifies the item's slot and either adds it as a new trinket or
   * equips it into its 8-slot holder (auto-swapping a full slot's occupant into the
   * stash; if the stash is full, the displaced item is returned as `overflow` for the
   * caller to sell/refund). A two-hand weapon disables the offhand.
   */
  addItem(item: Item): {
    newDuos: any[];
    newTransformations: any[];
    slot: EquipSlot;
    displaced: Item[];   // items pushed to the stash to make room
    overflow: Item | null; // an item that couldn't fit the stash (caller should sell it)
    upgraded: boolean;   // true if this buy upgraded an owned instance instead of adding one
    upgradeLevel: number; // the resulting level of the owned/added instance
  } {
    const slot = classifyItemSlot(item);
    const displaced: Item[] = [];
    let overflow: Item | null = null;

    // ---- UPGRADE PATH: already own this id anywhere → bump its level, done. ----
    const owned = this.findOwnedInstance(item.id);
    if (owned) {
      owned.upgradeLevel = (owned.upgradeLevel ?? 1) + 1;
      const newDuos = this.rebuildActiveItems(); // level change alters aggregation
      return {
        newDuos, newTransformations: [], slot,
        displaced, overflow, upgraded: true, upgradeLevel: owned.upgradeLevel,
      };
    }

    // Ensure a fresh instance starts at level 1 (defensive — callers usually clone).
    if (item.upgradeLevel === undefined) item.upgradeLevel = 1;

    if (slot === 'trinket') {
      this.trinkets.push(item);
    } else {
      // Free an occupied holder into the stash (or overflow if the stash is full).
      const toStash = (occupant: Item | null) => {
        if (!occupant) return;
        if (this.stash.length < PlayerStats.STASH_CAP) {
          this.stash.push(occupant);
          displaced.push(occupant);
        } else {
          overflow = occupant; // no room — caller refunds it
        }
      };
      const eq = this.equipment;
      if (slot === 'weapon-1h' || slot === 'weapon-2h') {
        toStash(eq.weapon);
        eq.weapon = item;
        // A two-hand weapon disables the offhand: bench any current offhand.
        if (slot === 'weapon-2h') toStash(eq.offhand), (eq.offhand = null);
      } else if (slot === 'offhand') {
        // Can't equip an offhand while a two-hand weapon is up — bench the 2h first.
        if (eq.weapon && classifyItemSlot(eq.weapon) === 'weapon-2h') {
          toStash(eq.weapon);
          eq.weapon = null;
        }
        toStash(eq.offhand);
        eq.offhand = item;
      } else {
        // head / amulet / torso / legs / feet / ring — one item each, like-named holder.
        const holder = slotHolder(slot) as EquipHolderKey | null;
        if (holder && holder !== 'weapon') {
          toStash(eq[holder]);
          eq[holder] = item;
        }
      }
    }

    const newDuos = this.rebuildActiveItems();
    // Track for transformations (only for the newly acquired item)
    const transformationId = this.transformations.trackItemPickup(item.tags);
    const newTransformations = transformationId ? [transformationId] : [];
    return {
      newDuos, newTransformations, slot, displaced, overflow,
      upgraded: false, upgradeLevel: item.upgradeLevel ?? 1,
    };
  }

  /** Find an owned instance of an item id in any active holder, the trinket pile, or
   *  the stash (in that priority). Returns the mutable instance or null. Used by the
   *  upgrade-on-duplicate buy path. */
  private findOwnedInstance(itemId: string): Item | null {
    const eq = this.equipment;
    for (const key of EQUIP_HOLDER_KEYS) {
      const occ = eq[key];
      if (occ && occ.id === itemId) return occ;
    }
    const tri = this.trinkets.find(i => i.id === itemId);
    if (tri) return tri;
    const st = this.stash.find(i => i.id === itemId);
    if (st) return st;
    return null;
  }

  /**
   * Remove an item wherever it lives (an equipped slot, the trinket pile, or the
   * stash) by object identity first, falling back to id. Returns the removed item.
   * Used by sell/recycle. When removing an ACTIVE item the active set is rebuilt.
   */
  removeItem(itemId: string): Item | null {
    // Equipped slots (identity by id — one per slot).
    const eq = this.equipment;
    for (const key of EQUIP_HOLDER_KEYS) {
      const occ = eq[key];
      if (occ && occ.id === itemId) {
        eq[key] = null;
        this.rebuildActiveItems();
        return occ;
      }
    }
    // Trinkets (remove one copy).
    const ti = this.trinkets.findIndex(i => i.id === itemId);
    if (ti !== -1) {
      const [removed] = this.trinkets.splice(ti, 1);
      this.rebuildActiveItems();
      return removed;
    }
    // Stash (inactive — no rebuild needed).
    const si = this.stash.findIndex(i => i.id === itemId);
    if (si !== -1) {
      const [removed] = this.stash.splice(si, 1);
      return removed;
    }
    return null;
  }

  /** Move an equipped item to the stash, freeing its slot (no gold change). No-op if
   *  the stash is full. Returns true if it moved. */
  unequipToStash(slotKey: keyof EquipSlots): boolean {
    const occ = this.equipment[slotKey];
    if (!occ) return false;
    if (this.stash.length >= PlayerStats.STASH_CAP) return false;
    this.equipment[slotKey] = null;
    this.stash.push(occ);
    this.rebuildActiveItems();
    return true;
  }

  /** Equip a stashed item into its slot, swapping any current occupant back to the
   *  stash. Returns true on success. */
  equipFromStash(stashIndex: number): boolean {
    const item = this.stash[stashIndex];
    if (!item) return false;
    this.stash.splice(stashIndex, 1);
    // Route it through addItem so slot logic + swap-to-stash is identical to a buy.
    // (addItem may push the current occupant to stash; that's the intended swap.)
    this.addItem(item);
    return true;
  }

  /** All owned equipment currently sitting in the stash (for the UI). */
  getStash(): Item[] { return this.stash; }

  /** Snapshot of the eight equipment slots (for the UI). */
  getEquipment(): EquipSlots { return this.equipment; }

  /** Whether a two-hand weapon is occupying the weapon slot (disables the offhand). */
  hasTwoHandEquipped(): boolean {
    return this.equipment.weapon !== null
      && classifyItemSlot(this.equipment.weapon) === 'weapon-2h';
  }

  /** The offhand slot is disabled while a two-hand weapon is equipped. */
  isOffhandDisabled(): boolean {
    return this.hasTwoHandEquipped();
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
  // UNIVERSALITY (Felix, 2026-07-05: "no items should be useless for some weapons").
  // A "+50% melee dmg" item shouldn't be a dead pick on a gun build, and vice-versa.
  // So each type multiplier keeps its FULL value for its own weapon and BLEEDS a
  // fraction of the OTHER type's bonus into itself. The specialisation still matters
  // (own-type is stronger), but every damage item helps every build.
  static readonly CROSS_TYPE_BLEED = 0.5; // an off-type dmg item pays out at half

  getMeleeDamageMult(): number {
    const a = this.ensureAgg();
    // full melee bonus + half of the ranged bonus above baseline
    const mult = a.meleeDamageMult * (1 + (a.rangedDamageMult - 1) * PlayerStats.CROSS_TYPE_BLEED);
    return Math.min(PlayerStats.SANITY_MULT_CAP, mult);
  }

  getRangedDamageMult(): number {
    const a = this.ensureAgg();
    // full ranged bonus + half of the melee bonus above baseline
    const mult = a.rangedDamageMult * (1 + (a.meleeDamageMult - 1) * PlayerStats.CROSS_TYPE_BLEED);
    return Math.min(PlayerStats.SANITY_MULT_CAP, mult);
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
    const a = this.ensureAgg();
    let rate = this.baseFireRate;
    rate *= a.fireRateMult;
    // UNIVERSALITY: swing-speed items (swingCooldownMult < 1 = faster swings) also
    // quicken the gun by half their effect — a melee "attack speed" item isn't a dead
    // pick on a gun build. (>1, a heavy/slow weapon, gently slows the gun the same way.)
    if (a.swingCooldownMult !== 1) {
      rate /= 1 + (a.swingCooldownMult - 1) * PlayerStats.CROSS_TYPE_BLEED;
    }
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

  // ---- PROC LUCK (Fourleaf Charm) ----
  hasFourleafCharm(): boolean {
    return this.ensureAgg().fourleafCharm;
  }

  // ---- ON-KILL MILESTONE (Soul Tithe) ----
  hasSoulTithe(): boolean {
    return this.ensureAgg().soulTithe;
  }

  // ---- ON-KILL PROC (Ceremonial Daggers) ----
  getDaggerCount(): number {
    return this.ensureAgg().daggerCount;
  }

  // ---- EVERY-Nth-SHOT (Pen Nib / Loaded Shot) ----
  hasLoadedShot(): boolean {
    return this.ensureAgg().loadedShot;
  }

  // ---- ON-WAVE-END ECONOMY (War Chest) ----
  getWarChest(): number {
    return this.ensureAgg().warChest;
  }

  /**
   * Roll a random on-hit STATUS proc. Single source of truth for burn/bleed/freeze/
   * chain/doom/wound/multicast rolls, so the Fourleaf Charm keystone can lift them all
   * at once: when held, we roll twice and keep the better result (P(hit) rises from p
   * to 1-(1-p)^2). Without the charm this is exactly `Math.random() < chance`, so
   * behaviour is identical for every build that doesn't own it. Independent of crit/dodge.
   */
  rollProc(chance: number): boolean {
    if (chance <= 0) return false;
    if (Math.random() < chance) return true;
    // "roll twice, keep higher" = a second independent roll only when the first missed
    return this.hasFourleafCharm() && Math.random() < chance;
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

  // ---- CONDITIONAL / TRIGGERED effect rates (summed across copies) ----
  // These return the raw summed rate; the CONDITION (wave count, current HP, kill
  // streak, gold held) and the payout are applied per-frame in Game.updateRuntimeModifiers,
  // which folds the result into runtimeDamageMult / runtimeFireRateMult. Uncapped here
  // (combat scales with enemies); Game applies the per-mechanic ceilings.
  getWaveRampDamage(): number { return this.ensureAgg().waveRampDamage; }
  getLowHpPower(): number { return this.ensureAgg().lowHpPower; }
  getKillStackDamage(): number { return this.ensureAgg().killStackDamage; }
  getHighHpPower(): number { return this.ensureAgg().highHpPower; }
  getGoldScaleDamage(): number { return this.ensureAgg().goldScaleDamage; }
  getExecuteThreshold(): number { return this.ensureAgg().executeThreshold; }

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

  // Calculate recycle value (25% base + recycle bonus). Scales with upgrade level —
  // an item at +N cost N buys' worth, so selling it refunds proportionally more.
  getRecycleValue(item: Item): number {
    const lv = item.upgradeLevel && item.upgradeLevel > 1 ? item.upgradeLevel : 1;
    const baseValue = item.cost * 0.25 * lv;
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
    // baseline 0.6 (the free swing is a light default) × swing items × legacy aux-melee items.
    // getMeleeDamage() already bleeds in ranged-damage items (CROSS_TYPE_BLEED), so a pure
    // gun build still feels its damage items on the always-on swing — no dead picks.
    const mult = 0.6 * a.swingDamageMult * a.auxMeleeDamageMult;
    return this.getMeleeDamage() * mult;
  }

  /** Swing reach in px (base 70 + swing items + a slice of ranged reach items). */
  getSwingRange(): number {
    const a = this.ensureAgg();
    // UNIVERSALITY: piercing (a ranged stat) also lengthens the swing — a ranged-reach
    // build gets a longer melee arc too, so piercing items aren't dead on a swing build.
    return 70 + a.swingRangeBonus + this.getPiercing() * 12;
  }

  /** Swing arc width in radians (base ~126°, widened by items, capped at full circle). */
  getSwingArc(): number {
    const a = this.ensureAgg();
    // UNIVERSALITY: multishot (a ranged stat) also widens the swing — a multishot/spread
    // build sweeps a bigger arc, so those items help a melee build too.
    const multishotArc = a.multishot * (Math.PI * 0.06);
    return Math.min(Math.PI * 0.7 + a.swingArcBonus + multishotArc, Math.PI * 2);
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

  /**
   * The swing's visual + hit shape. Priority:
   *   1. An equipped melee item that declares a meleeStyle (spear→thrust, hammer→slam…).
   *   2. Otherwise a full-circle AOE swing whirls ('spin').
   *   3. Otherwise the default directional arc.
   * Purely presentational routing over the existing swing numbers.
   */
  getMeleeStyle(): MeleeStyle {
    const styled = this.items.find(i => i.meleeStyle);
    if (styled?.meleeStyle) return styled.meleeStyle;
    if (this.getSwingAoe() > 0) return 'spin';
    return 'arc';
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
