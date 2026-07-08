// Active Skill System — Soulstone Survivors-inspired active abilities.
//
// Players find "Spell Scrolls" in the shop. Buying one equips an active skill
// to their skill slot. The most recently purchased scroll wins. Skills fire on
// [Q]/[E] (keyboard) or the mobile SKILL button, with individual cooldowns.
//
// Architecture note: skills live here as pure data. All combat effects are
// implemented in Game.ts's `useActiveSkill()` using the existing
// AoeZone/Projectile/Enemy infrastructure — this file has no runtime dependencies.

export type ActiveSkillEffect =
  // --- Original 10 ---
  | 'meteor'           // Telegraphed AoE fire impact
  | 'frost_nova'       // Freeze ring — instant, damages + slows
  | 'chain_lightning'  // Bounces between N nearest enemies
  | 'blood_nova'       // Dark AoE burst + lifesteal
  | 'orbital_strike'   // 6 staggered impacts spread around the player
  | 'poison_cloud'     // Persistent AoE DoT zone
  | 'phoenix_beam'     // 3 piercing fire projectiles toward nearest enemy
  | 'earthquake'       // Damage + slow ALL enemies on screen
  | 'shadow_step'      // Teleport to nearest enemy + burst nova
  | 'circle_power'     // Spawns a spinning ring zone for N seconds
  // --- Tier 1 additions ---
  | 'arcane_barrage'   // 5 homing bolts fired at 5 nearest enemies
  | 'inferno_aura'     // Brief fire ring burns all nearby enemies
  | 'crystal_burst'    // Crystallize 4 nearest (hard freeze + damage)
  | 'thunder_clap'     // Explosive repel — blasts all nearby enemies outward + stuns
  // --- Tier 2 additions ---
  | 'blade_storm'      // 8 blades spiral outward from player
  | 'lightning_storm'  // 5 rapid lightning strikes in area
  | 'void_pulse'       // 3 expanding damage rings
  | 'blizzard'         // 6 frost impacts scattered in large radius
  | 'gravity_pull'     // Pull all enemies toward player then slow
  | 'bone_spear'       // Massive single piercing bone lance through all enemies in line
  | 'spectral_shield'  // 5s invincibility bubble + burst nova on cast
  | 'rune_field'       // Drop 6 delayed rune detonations at nearest enemy positions
  // --- Tier 3 additions ---
  | 'time_warp'        // Freeze all, then reduce to 20% speed for 5s
  | 'vampire_burst'    // Drain 10 nearest, heal per hit
  | 'spectral_dash'    // 5× quick dashes through enemies
  | 'plague_bomb'      // Large persistent poison zone with spread
  | 'soul_shatter'     // Stack Condemned + Fragility on 8 nearest then detonate
  | 'mirror_strike'    // 3× simultaneous strike hits ALL enemies on screen
  // --- Tier 4 additions ---
  | 'black_hole'       // Pull then detonate — massive damage
  | 'curse_wave'       // Apply fragility + exposed to all enemies on screen
  | 'divine_wrath'     // Holy multi-strike all enemies + i-frames
  | 'armageddon'       // 12 sequential meteor impacts over 3 seconds
  | 'doom_comet'       // Single massive comet — 1.5s warning, huge radius, all debuffs
  | 'hellfire_rain';   // 20 rapid fire strikes targeting all living enemies over 4s

export interface ActiveSkill {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Seconds between uses. */
  cooldown: number;
  effect: ActiveSkillEffect;
  /** Determines shop tier / rarity. */
  tier: number;
  /** Damage output = playerDamage × this multiplier. */
  baseDamageMultiplier: number;
  /** Radius for AoE effects (px, world space). */
  radius?: number;
}

export const ACTIVE_SKILLS: ActiveSkill[] = [
  // ===================== ORIGINAL 10 =====================
  {
    id: 'meteor',
    name: 'Meteor Strike',
    icon: '☄️',
    desc: 'Call a flaming meteor (0.8s warning, 8× dmg in a wide area).',
    cooldown: 8,
    effect: 'meteor',
    tier: 2,
    baseDamageMultiplier: 8,
    radius: 120,
  },
  {
    id: 'frost_nova',
    name: 'Frost Nova',
    icon: '❄️',
    desc: 'Burst of ice that damages and slows all nearby enemies for 3s.',
    cooldown: 5,
    effect: 'frost_nova',
    tier: 1,
    baseDamageMultiplier: 2,
    radius: 150,
  },
  {
    id: 'chain_lightning',
    name: 'Chain Lightning',
    icon: '⚡',
    desc: 'Lightning that chains to the 6 nearest enemies (5× dmg each).',
    cooldown: 4,
    effect: 'chain_lightning',
    tier: 2,
    baseDamageMultiplier: 5,
  },
  {
    id: 'blood_nova',
    name: 'Blood Nova',
    icon: '🩸',
    desc: 'Dark AoE burst (6× dmg). Heals you for 20% of damage dealt.',
    cooldown: 6,
    effect: 'blood_nova',
    tier: 3,
    baseDamageMultiplier: 6,
    radius: 130,
  },
  {
    id: 'orbital_strike',
    name: 'Orbital Strike',
    icon: '🛸',
    desc: '6 staggered impacts around you, each dealing 4× dmg.',
    cooldown: 7,
    effect: 'orbital_strike',
    tier: 3,
    baseDamageMultiplier: 4,
    radius: 160,
  },
  {
    id: 'poison_cloud',
    name: 'Poison Cloud',
    icon: '☠️',
    desc: 'Spawns a DoT zone that ticks damage for 5 seconds.',
    cooldown: 5,
    effect: 'poison_cloud',
    tier: 1,
    baseDamageMultiplier: 1.2,
    radius: 110,
  },
  {
    id: 'phoenix_beam',
    name: 'Phoenix Beam',
    icon: '🔥',
    desc: '3 piercing flame bolts in a tight spread (6× dmg each).',
    cooldown: 6,
    effect: 'phoenix_beam',
    tier: 2,
    baseDamageMultiplier: 6,
  },
  {
    id: 'earthquake',
    name: 'Earthquake',
    icon: '🌋',
    desc: 'Massive shockwave damages and slows ALL enemies on screen.',
    cooldown: 12,
    effect: 'earthquake',
    tier: 4,
    baseDamageMultiplier: 10,
  },
  {
    id: 'shadow_step',
    name: 'Shadow Step',
    icon: '👁️',
    desc: 'Teleport through nearest enemy + burst nova (5× dmg, i-frames).',
    cooldown: 8,
    effect: 'shadow_step',
    tier: 3,
    baseDamageMultiplier: 5,
    radius: 90,
  },
  {
    id: 'circle_power',
    name: 'Circle of Power',
    icon: '✨',
    desc: 'Summon a damage ring around you that persists for 5 seconds.',
    cooldown: 10,
    effect: 'circle_power',
    tier: 2,
    baseDamageMultiplier: 2,
    radius: 90,
  },

  // ===================== TIER 1 — NEW =====================
  {
    id: 'thunder_clap',
    name: 'Thunder Clap',
    icon: '💢',
    desc: 'Explosive repel — blast all nearby enemies outward and stun them for 1s.',
    cooldown: 6,
    effect: 'thunder_clap',
    tier: 1,
    baseDamageMultiplier: 3,
    radius: 200,
  },
  {
    id: 'arcane_barrage',
    name: 'Arcane Barrage',
    icon: '🔮',
    desc: 'Fire 5 homing arcane bolts, one at each nearest enemy (3× dmg each).',
    cooldown: 4,
    effect: 'arcane_barrage',
    tier: 1,
    baseDamageMultiplier: 3,
  },
  {
    id: 'inferno_aura',
    name: 'Inferno Aura',
    icon: '🌟',
    desc: 'Ignite the air around you — burn ring for 0.6s, applying Burn to all hit.',
    cooldown: 7,
    effect: 'inferno_aura',
    tier: 1,
    baseDamageMultiplier: 2.5,
    radius: 140,
  },
  {
    id: 'crystal_burst',
    name: 'Crystal Burst',
    icon: '💎',
    desc: 'Encase the 4 nearest enemies in ice (hard freeze 2s + 4× dmg).',
    cooldown: 6,
    effect: 'crystal_burst',
    tier: 1,
    baseDamageMultiplier: 4,
  },

  // ===================== TIER 2 — NEW =====================
  {
    id: 'blade_storm',
    name: 'Blade Storm',
    icon: '🌀',
    desc: '8 spinning blades spiral outward from you, each piercing through all.',
    cooldown: 5,
    effect: 'blade_storm',
    tier: 2,
    baseDamageMultiplier: 4,
    radius: 220,
  },
  {
    id: 'lightning_storm',
    name: 'Lightning Storm',
    icon: '🌩️',
    desc: '5 lightning strikes hit random enemies over 1.5 seconds (6× each).',
    cooldown: 8,
    effect: 'lightning_storm',
    tier: 2,
    baseDamageMultiplier: 6,
  },
  {
    id: 'void_pulse',
    name: 'Void Pulse',
    icon: '🌑',
    desc: '3 expanding shockwaves ripple outward from you (3× dmg per ring).',
    cooldown: 6,
    effect: 'void_pulse',
    tier: 2,
    baseDamageMultiplier: 3,
    radius: 180,
  },
  {
    id: 'blizzard',
    name: 'Blizzard',
    icon: '🌨️',
    desc: '6 frost shards scatter in a wide arc — each slows and damages.',
    cooldown: 7,
    effect: 'blizzard',
    tier: 2,
    baseDamageMultiplier: 3.5,
    radius: 200,
  },
  {
    id: 'gravity_pull',
    name: 'Gravity Pull',
    icon: '🕳️',
    desc: 'Yank all on-screen enemies toward you, then slow them for 3s.',
    cooldown: 10,
    effect: 'gravity_pull',
    tier: 2,
    baseDamageMultiplier: 1.5,
    radius: 900,
  },

  {
    id: 'bone_spear',
    name: 'Bone Spear',
    icon: '🦴',
    desc: 'Hurl a massive bone lance that pierces every enemy in its path (10× dmg).',
    cooldown: 5,
    effect: 'bone_spear',
    tier: 2,
    baseDamageMultiplier: 10,
  },
  {
    id: 'spectral_shield',
    name: 'Spectral Shield',
    icon: '🛡️',
    desc: 'Conjure a ghost barrier — 5s of invincibility + burst nova on cast (4× dmg).',
    cooldown: 12,
    effect: 'spectral_shield',
    tier: 2,
    baseDamageMultiplier: 4,
    radius: 160,
  },
  {
    id: 'rune_field',
    name: 'Rune Field',
    icon: '🔴',
    desc: 'Drop 6 delayed rune detonations at enemy positions — each a 5× blast (0.5s fuse).',
    cooldown: 7,
    effect: 'rune_field',
    tier: 2,
    baseDamageMultiplier: 5,
    radius: 70,
  },

  // ===================== TIER 3 — NEW =====================
  {
    id: 'time_warp',
    name: 'Time Warp',
    icon: '⏱️',
    desc: 'Freeze ALL enemies for 1s, then slow them to 25% speed for 5s.',
    cooldown: 15,
    effect: 'time_warp',
    tier: 3,
    baseDamageMultiplier: 0,
  },
  {
    id: 'vampire_burst',
    name: 'Vampire Burst',
    icon: '🧛',
    desc: 'Drain 10 nearest enemies (5× dmg each). Heal 30% of damage dealt.',
    cooldown: 8,
    effect: 'vampire_burst',
    tier: 3,
    baseDamageMultiplier: 5,
  },
  {
    id: 'spectral_dash',
    name: 'Spectral Dash',
    icon: '💨',
    desc: 'Phase through 5 enemies in rapid succession — each takes 6× dmg.',
    cooldown: 9,
    effect: 'spectral_dash',
    tier: 3,
    baseDamageMultiplier: 6,
    radius: 60,
  },
  {
    id: 'plague_bomb',
    name: 'Plague Bomb',
    icon: '🧪',
    desc: 'Hurl a plague canister — massive DoT zone lasting 8 seconds.',
    cooldown: 8,
    effect: 'plague_bomb',
    tier: 3,
    baseDamageMultiplier: 1.5,
    radius: 140,
  },

  {
    id: 'soul_shatter',
    name: 'Soul Shatter',
    icon: '💔',
    desc: 'Shatter the souls of 8 nearby enemies — stacks Condemned×12 + Fragility×10, then detonates (8× dmg).',
    cooldown: 10,
    effect: 'soul_shatter',
    tier: 3,
    baseDamageMultiplier: 8,
  },
  {
    id: 'mirror_strike',
    name: 'Mirror Strike',
    icon: '🪞',
    desc: 'Your attack echoes across reality — 3 simultaneous strikes hit EVERY enemy on screen.',
    cooldown: 12,
    effect: 'mirror_strike',
    tier: 3,
    baseDamageMultiplier: 4,
  },

  // ===================== TIER 4 — NEW =====================
  {
    id: 'black_hole',
    name: 'Black Hole',
    icon: '🌌',
    desc: 'Summon a 2s gravity sink — pulls all enemies in, then detonates for 15× dmg.',
    cooldown: 18,
    effect: 'black_hole',
    tier: 4,
    baseDamageMultiplier: 15,
    radius: 250,
  },
  {
    id: 'curse_wave',
    name: 'Curse Wave',
    icon: '💀',
    desc: 'Cursed wave applies Fragility + Exposed to every enemy on screen.',
    cooldown: 14,
    effect: 'curse_wave',
    tier: 4,
    baseDamageMultiplier: 2,
    radius: 900,
  },
  {
    id: 'divine_wrath',
    name: 'Divine Wrath',
    icon: '⚜️',
    desc: '3× holy strike hits ALL enemies simultaneously. You are invincible during.',
    cooldown: 16,
    effect: 'divine_wrath',
    tier: 4,
    baseDamageMultiplier: 8,
  },
  {
    id: 'armageddon',
    name: 'Armageddon',
    icon: '💥',
    desc: '12 meteors rain down over 3 seconds — each a 6× fire blast.',
    cooldown: 20,
    effect: 'armageddon',
    tier: 4,
    baseDamageMultiplier: 6,
    radius: 100,
  },
  {
    id: 'doom_comet',
    name: 'Doom Comet',
    icon: '🌠',
    desc: 'Call a doom comet (1.5s warning) — massive 18× blast, applies all debuffs to every enemy hit.',
    cooldown: 22,
    effect: 'doom_comet',
    tier: 4,
    baseDamageMultiplier: 18,
    radius: 200,
  },
  {
    id: 'hellfire_rain',
    name: 'Hellfire Rain',
    icon: '🔥',
    desc: '20 hellfire bolts rain down targeting every living enemy over 4 seconds.',
    cooldown: 24,
    effect: 'hellfire_rain',
    tier: 4,
    baseDamageMultiplier: 7,
    radius: 65,
  },
];

export function getActiveSkillById(id: string): ActiveSkill | undefined {
  return ACTIVE_SKILLS.find(s => s.id === id);
}
