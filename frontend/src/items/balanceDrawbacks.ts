// ===========================================================================
// Brotato-style drawback rebalance (2026-07-07)
// ---------------------------------------------------------------------------
// Felix's note: too many items were pure upside. Brotato's texture is that
// powerful pickups bite back, so this patch pairs a modest, THEMATICALLY-INVERSE
// drawback onto strong pure-upside items (tier 2-4; tier-1 commons stay clean),
// lifting drawback coverage from ~22% to ~63% (Brotato sits ~60-70%).
//
// Pairing logic (kept light so items stay net-positive and desirable):
//   raw damage / melee weapons  -> -Max HP        (glass cannon)
//   elemental / status power    -> -Max HP        (squishy mage)
//   crit                        -> -Armor         (reckless)
//   fire rate                   -> -% Damage      (spray, less punch)
//   multishot / pierce          -> -% Fire Rate   (heavy volley, slower cadence)
//   defense (HP/armor/thorns)   -> -% Move Speed  (turtle)
//   mobility (speed/dodge)      -> -Max HP         (fragile & fast)
//   economy (gold/luck/xp)      -> -% Damage      (greed over combat)
//   lifesteal                   -> -% Ranged Dmg  (melee sustain, weak at range)
//
// The negative fields render automatically as red chips on the card, so no
// description copy is needed. Achievement reward items (ach_*) are left clean.
// Tune magnitudes here; this is the single source for the rebalance.
// ===========================================================================
import type { Item } from './types';

type Drawback = Partial<Pick<Item,
  'maxHealthBonus' | 'armor' | 'speedMultiplier' | 'fireRateMultiplier' |
  'damageMultiplier' | 'rangedDamageMult'>>;

export const BALANCE_DRAWBACKS: Record<string, Drawback> = {
  "am_lucky_coin": { damageMultiplier: 0.95 },
  "bloodhound_t2": { damageMultiplier: 0.95 },
  "brawler_blade_t1": { maxHealthBonus: -8 },
  "cleaver_t2": { maxHealthBonus: -8 },
  "crit_damage_t2": { armor: -2 },
  "experience_gem_t2": { damageMultiplier: 0.95 },
  "feet_magnet_boots": { damageMultiplier: 0.95 },
  "feet_prospector_boots": { damageMultiplier: 0.95 },
  "gold_bonus_t2": { damageMultiplier: 0.95 },
  "head_scholar_hat": { damageMultiplier: 0.95 },
  "lucky_charm_t2": { damageMultiplier: 0.95 },
  "max_hp_t2": { speedMultiplier: 0.94 },
  "melee_hammer_t2": { maxHealthBonus: -8 },
  "melee_spear_t2": { maxHealthBonus: -8 },
  "melee_sword_t2": { maxHealthBonus: -8 },
  "merchant_scale_t2": { damageMultiplier: 0.95 },
  "movement_speed_t2": { maxHealthBonus: -7 },
  "rapid_fire_t2": { damageMultiplier: 0.94 },
  "rending_mark_t2": { maxHealthBonus: -7 },
  "serrated_edge_t2": { maxHealthBonus: -7 },
  "speed_demon_t2": { maxHealthBonus: -7 },
  "swift_blade_t2": { maxHealthBonus: -7 },
  "torso_bramble_hauberk": { speedMultiplier: 0.94 },
  "torso_spiked_cuirass": { speedMultiplier: 0.94 },
  "toxic_touch_t2": { maxHealthBonus: -7 },
  "venom_coating_t2": { maxHealthBonus: -7 },
  "volatile_rounds_t2": { maxHealthBonus: -7 },
  "windwalker_t2": { maxHealthBonus: -7 },
  "am_gilded_scarab": { damageMultiplier: 0.93 },
  "am_tacticians_sigil": { armor: -2 },
  "armor_piercing_t3": { fireRateMultiplier: 0.92 },
  "attack_speed_t3": { damageMultiplier: 0.92 },
  "chain_lightning_t3": { maxHealthBonus: -10 },
  "chain_reaction_t3": { maxHealthBonus: -10 },
  "compound_interest_t3": { damageMultiplier: 0.93 },
  "crit_chance_t3": { maxHealthBonus: -10 },
  "crit_synergy_t3": { armor: -2 },
  "cryo_capacitor_t3": { maxHealthBonus: -10 },
  "cryo_repulsor_t3": { maxHealthBonus: -10 },
  "dervish_t3": { maxHealthBonus: -10 },
  "dodge_master_t3": { speedMultiplier: 0.92 },
  "doom_sigil_t3": { maxHealthBonus: -10 },
  "echo_prism_t3": { maxHealthBonus: -11 },
  "evasive_armor_t3": { maxHealthBonus: -10 },
  "executioners_maul_t3": { maxHealthBonus: -11 },
  "feet_emberwalk_boots": { maxHealthBonus: -10 },
  "feet_hermes_treads": { damageMultiplier: 0.93 },
  "feet_shadowstep_boots": { maxHealthBonus: -10 },
  "frostfire_t3": { maxHealthBonus: -10 },
  "frozen_heart_t3": { speedMultiplier: 0.92 },
  "glacier_t3": { maxHealthBonus: -10 },
  "golden_vault_t3": { damageMultiplier: 0.93 },
  "guardian_aura_t3": { speedMultiplier: 0.92 },
  "hammer_weapon_t3": { maxHealthBonus: -11 },
  "head_plague_veil": { maxHealthBonus: -10 },
  "head_predators_crown": { maxHealthBonus: -11 },
  "head_stormcrown": { maxHealthBonus: -10 },
  "head_visor_of_wrath": { armor: -2 },
  "head_warhelm": { speedMultiplier: 0.92 },
  "head_windcaller_hood": { maxHealthBonus: -10 },
  "hemorrhage_fang_t3": { maxHealthBonus: -10 },
  "homing_bullets_t3": { maxHealthBonus: -11 },
  "knockback_t3": { maxHealthBonus: -10 },
  "legs_berserker_kilt": { maxHealthBonus: -11 },
  "legs_gale_greaves": { maxHealthBonus: -10 },
  "legs_juggernaut_greaves": { speedMultiplier: 0.92 },
  "legs_phantom_leggings": { maxHealthBonus: -10 },
  "legs_phase_trousers": { maxHealthBonus: -10 },
  "legs_serpents_wrap": { maxHealthBonus: -10 },
  "legs_titan_legplates": { speedMultiplier: 0.92 },
  "legs_windrunner": { maxHealthBonus: -10 },
  "merchants_ring_t3": { damageMultiplier: 0.93 },
  "phantom_cloak_t3": { maxHealthBonus: -10 },
  "plague_bearer_t3": { maxHealthBonus: -10 },
  "retaliation_t3": { speedMultiplier: 0.92 },
  "ring_bloodstone": { maxHealthBonus: -11 },
  "ring_doombind_ring": { maxHealthBonus: -10 },
  "seeker_rounds_t3": { maxHealthBonus: -11 },
  "soul_collector_t3": { damageMultiplier: 0.93 },
  "spiked_shell_t3": { speedMultiplier: 0.92 },
  "storm_essence_t3": { maxHealthBonus: -10 },
  "tesla_coil_t3": { maxHealthBonus: -10 },
  "thorny_armor_t3": { speedMultiplier: 0.92 },
  "torso_juggernaut_shell": { speedMultiplier: 0.92 },
  "torso_second_wind_cuirass": { speedMultiplier: 0.92 },
  "torso_soulweave_robe": { speedMultiplier: 0.92 },
  "torso_warlords_plate": { speedMultiplier: 0.92 },
  "treasure_map_t3": { damageMultiplier: 0.93 },
  "vampire_armor_t3": { speedMultiplier: 0.92 },
  "vampiric_embrace_t3": { rangedDamageMult: 0.92 },
  "warglaive_storm_t3": { maxHealthBonus: -11 },
  "wildfire_torch_t3": { maxHealthBonus: -10 },
  "absolute_zero_t4": { maxHealthBonus: -13 },
  "am_doomcaller_idol": { maxHealthBonus: -13 },
  "am_phoenix_tear": { speedMultiplier: 0.89 },
  "blade_storm_t4": { maxHealthBonus: -15 },
  "cataclysm_core_t4": { maxHealthBonus: -15 },
  "chain_lightning_t4": { maxHealthBonus: -13 },
  "chain_reactor_t4": { maxHealthBonus: -13 },
  "clone_projectiles_t4": { fireRateMultiplier: 0.89 },
  "cluster_charges_t4": { maxHealthBonus: -15 },
  "cosmic_dice_t4": { damageMultiplier: 0.91 },
  "divine_protection_t4": { speedMultiplier: 0.89 },
  "elemental_mastery_t4": { maxHealthBonus: -13 },
  "feet_blinkstep": { maxHealthBonus: -13 },
  "feet_seven_league_boots": { maxHealthBonus: -13 },
  "gold_rush_t4": { damageMultiplier: 0.91 },
  "hammer_evolved": { maxHealthBonus: -15 },
  "harbingers_seal_t4": { maxHealthBonus: -13 },
  "head_crown_of_avarice": { damageMultiplier: 0.91 },
  "head_mind_diadem": { maxHealthBonus: -13 },
  "immortal_t4": { speedMultiplier: 0.89 },
  "infinite_piercing_t4": { fireRateMultiplier: 0.89 },
  "infinity_core_t4": { fireRateMultiplier: 0.89 },
  "jackpot_t4": { armor: -3 },
  "laser_evolved": { maxHealthBonus: -15 },
  "legs_stormstride": { maxHealthBonus: -13 },
  "legs_warmarch_plates": { speedMultiplier: 0.89 },
  "legs_windshear_leggings": { maxHealthBonus: -13 },
  "mega_knockback_t4": { maxHealthBonus: -15 },
  "necromantic_power_t4": { maxHealthBonus: -15 },
  "orbital_evolved": { fireRateMultiplier: 0.89 },
  "philosophers_stone_t4": { damageMultiplier: 0.91 },
  "phoenix_heart_t4": { speedMultiplier: 0.89 },
  "prism_lens_t4": { maxHealthBonus: -13 },
  "pulsar_t4": { maxHealthBonus: -15 },
  "ring_conquerors_seal": { maxHealthBonus: -15 },
  "ring_sovereign_ring": { maxHealthBonus: -15 },
  "time_slow_t4": { maxHealthBonus: -13 },
  "torso_aegis_mantle": { speedMultiplier: 0.89 },
  "torso_titan_carapace": { speedMultiplier: 0.89 },
  "twin_echo_core_t4": { damageMultiplier: 0.89 },
  "war_machine_t4": { maxHealthBonus: -15 },
  "wildfire_t4": { maxHealthBonus: -13 },
};

// Fields that render as a negative ("drawback") chip on the card. If an item
// already carries ANY of these, it's already balanced (e.g. a hand-authored
// drawback in the catalog) and this auto-pass leaves it untouched — no double tax.
const DRAWBACK_FIELDS: (keyof Item)[] = [
  'maxHealthBonus', 'armor', 'healthRegen',
  'damageMultiplier', 'meleeDamageMult', 'rangedDamageMult',
  'elementalDamageMult', 'fireRateMultiplier', 'speedMultiplier',
];

function alreadyHasDrawback(it: Item): boolean {
  for (const f of DRAWBACK_FIELDS) {
    const v = it[f] as number | undefined;
    if (v === undefined) continue;
    // flat fields are drawbacks when negative; multiplier fields when < 1.
    if (f === 'maxHealthBonus' || f === 'armor' || f === 'healthRegen') { if (v < 0) return true; }
    else if (v < 1) return true;
  }
  return false;
}

// Merge each drawback into its catalog item IN PLACE. Skip any item that already
// bites back (existing negative modifier) so a hand-tuned drawback is never
// double-stacked; otherwise apply the generated drawback field.
export function applyBalanceDrawbacks(catalog: Item[]): void {
  const byId = new Map(catalog.map(i => [i.id, i]));
  for (const [id, db] of Object.entries(BALANCE_DRAWBACKS)) {
    const it = byId.get(id);
    if (!it) continue;
    if (alreadyHasDrawback(it)) continue; // item is already balanced — don't pile on
    for (const [field, val] of Object.entries(db) as [keyof Drawback, number][]) {
      if (it[field] !== undefined) continue; // never overwrite an existing modifier
      (it as unknown as Record<string, number>)[field] = val;
    }
  }
}
