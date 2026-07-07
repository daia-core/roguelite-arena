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
  | 'meteor'           // Telegraphed AoE fire impact
  | 'frost_nova'       // Freeze ring — instant, damages + slows
  | 'chain_lightning'  // Bounces between N nearest enemies
  | 'blood_nova'       // Dark AoE burst + lifesteal
  | 'orbital_strike'   // 6 staggered impacts spread around the player
  | 'poison_cloud'     // Persistent AoE DoT zone
  | 'phoenix_beam'     // 3 piercing fire projectiles toward nearest enemy
  | 'earthquake'       // Damage + slow ALL enemies on screen
  | 'shadow_step'      // Teleport to nearest enemy + burst nova
  | 'circle_power';    // Spawns a spinning ring zone for N seconds

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
];

export function getActiveSkillById(id: string): ActiveSkill | undefined {
  return ACTIVE_SKILLS.find(s => s.id === id);
}
