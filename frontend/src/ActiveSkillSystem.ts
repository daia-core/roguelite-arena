// Active Skill System — Soulstone Survivors-inspired active abilities.
//
// Players find "Spell Scrolls" in the shop. Buying one equips an active skill
// to their skill slot. The most recently purchased scroll wins. Skills fire on
// [Q]/[E] (keyboard) or the mobile SKILL button, with individual cooldowns.
//
// Architecture note: skill *definitions* (data) live in ACTIVE_SKILLS / ActiveSkill.
// Skill *dispatch* (the 34-case switch) lives in `executeSkill()` below.
// Game.ts calls `executeSkill()` via a thin wrapper that passes an ActiveSkillContext
// with closures into the Game state — keeping AoeZone/Enemy/Projectile logic here.

import { Enemy } from './Enemy';
import { Player } from './Player';
import { PlayerStats } from './ItemSystem';
import { AoeZone } from './AoeZone';
import { Projectile } from './Projectile';

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
    cooldown: 8,
    effect: 'bone_spear',
    tier: 2,
    baseDamageMultiplier: 10,
  },
  {
    id: 'spectral_shield',
    name: 'Spectral Shield',
    icon: '🛡️',
    desc: 'Conjure a ghost barrier — 2.5s of invincibility + burst nova on cast (4× dmg).',
    cooldown: 15,
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

// ---------------------------------------------------------------------------
// Runtime dispatch — extracted from Game.ts (step 14 of de-god-classing).
// Game.ts builds an ActiveSkillContext from `this` closures and calls executeSkill.
// ---------------------------------------------------------------------------

/** All the Game-state hooks that skill effects need. Passed by Game.ts via closures. */
export interface ActiveSkillContext {
  enemies: Enemy[];
  player: Player;
  playerStats: PlayerStats;
  worldWidth: number;
  worldHeight: number;
  pushPendingDmg(x: number, y: number, r: number, dmg: number, delay: number, color: string): void;
  pushActiveDmgZone(x: number, y: number, r: number, dmgPerSec: number, remaining: number, color: string): void;
  spawnAoeZone(zone: AoeZone): void;
  dealAuxDamage(enemy: Enemy, dmg: number, color: string): void;
  pushProjectile(p: Projectile): void;
  setCooldown(slot: 'q' | 'e', value: number): void;
}

/**
 * Dispatch a single active-skill cast.
 * Sets the cooldown, then runs the 34-case effect switch.
 * Called from Game.ts `useActiveSkill()` with a context built from `this` closures.
 */
export function executeSkill(skillId: string, slot: 'q' | 'e', ctx: ActiveSkillContext): void {
  const skill = getActiveSkillById(skillId);
  if (!skill) return;

  ctx.setCooldown(slot, skill.cooldown);
  // BALANCE FIX 2026-07-12: skills previously used getDamage() which excludes
  // type-specific multipliers. A ranged build with 5× ranged items saw no benefit
  // from those items on skill casts — skills fell further behind auto-attack as the
  // player invested in their weapon type. Fix: use the player's best type-damage so
  // skills scale with the build's specialization. At baseline (no type items) both
  // methods equal getDamage(), so early-game numbers are unchanged.
  const typeScaledDmg = Math.max(
    ctx.playerStats.getRangedDamage(),
    ctx.playerStats.getMeleeDamage()
  );
  const baseDmg = typeScaledDmg * skill.baseDamageMultiplier;
  const px = ctx.player.x;
  const py = ctx.player.y;

  switch (skill.effect) {
    case 'meteor': {
      // Telegraphed AoE fire drop — 0.8s warning ring, then large impact burst.
      const r = skill.radius ?? 120;
      // Visual telegraph (damage=0 — AoeZone only hits the player).
      ctx.spawnAoeZone(new AoeZone(px, py, r, 0, 0.8, {
        color: '#ff6b00', activeTime: 0.5, singleHit: false,
      }));
      // Deferred enemy damage at impact time.
      ctx.pushPendingDmg(px, py, r, baseDmg, 0.8, '#ff6b00');
      break;
    }
    case 'frost_nova': {
      // Instant ring — damages + slows all enemies in radius for 3s.
      const r = skill.radius ?? 150;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - px, e.y - py);
        if (d <= r) {
          ctx.dealAuxDamage(e, baseDmg, '#74c0fc');
          e.frozenTimer = Math.max(e.frozenTimer, 3.0);
        }
      }
      // Visual flash
      ctx.spawnAoeZone(new AoeZone(px, py, r, 0, 0.0, {
        color: '#74c0fc', activeTime: 0.5, singleHit: true,
      }));
      break;
    }
    case 'chain_lightning': {
      // Bounce between the 6 nearest enemies.
      const targets = [...ctx.enemies]
        .filter(e => !e.dead)
        .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
        .slice(0, 6);
      for (const t of targets) ctx.dealAuxDamage(t, baseDmg, '#ffd43b');
      break;
    }
    case 'blood_nova': {
      // AoE burst + lifesteal heal.
      const r = skill.radius ?? 130;
      let totalDmg = 0;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - px, e.y - py) <= r) {
          ctx.dealAuxDamage(e, baseDmg, '#c92a2a');
          totalDmg += baseDmg;
        }
      }
      if (totalDmg > 0) ctx.player.heal(totalDmg * 0.20);
      ctx.spawnAoeZone(new AoeZone(px, py, r, 0, 0.0, {
        color: '#9b2335', activeTime: 0.5, singleHit: true,
      }));
      break;
    }
    case 'orbital_strike': {
      // 6 staggered telegraphed impacts spread around the player.
      const r = skill.radius ?? 160;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const ix = px + Math.cos(angle) * r * 0.6;
        const iy = py + Math.sin(angle) * r * 0.6;
        // Visual only (damage=0 — AoeZone only hits the player).
        ctx.spawnAoeZone(new AoeZone(ix, iy, 55, 0, 0.3 + i * 0.15, {
          color: '#b197fc', activeTime: 0.35, singleHit: true,
        }));
        // Deferred enemy damage at each impact.
        ctx.pushPendingDmg(ix, iy, 55, baseDmg, 0.3 + i * 0.15, '#b197fc');
      }
      break;
    }
    case 'poison_cloud': {
      // Persistent AoE DoT zone — ticks enemy damage for 5 seconds.
      // BALANCE FIX 2026-07-09: was baseDmg (1.2× player dmg) per sec — enemies passing
      // through barely noticed (30 DPS at wave 1, ~90 dmg hit on a 156 HP slime). A zone
      // with 5s CD and 5s duration needs to meaningfully punish enemies inside it.
      // Bumped to 3× baseDamageMultiplier equivalent: pushActiveDmgZone gets 3× baseDmg/1.2
      // so the total over 5s equals 12.5× player dmg — kills a wave-1 enemy in ~3s in zone.
      const r = skill.radius ?? 110;
      // Visual zone (damage=0 — AoeZone only hits the player).
      ctx.spawnAoeZone(new AoeZone(px, py, r, 0, 0.0, {
        color: '#40c057', activeTime: 5.0, singleHit: false,
      }));
      // Persistent enemy damage tick — 2.5× per second for 5s (was 1× per second, too weak).
      ctx.pushActiveDmgZone(px, py, r, baseDmg * 2.5, 5.0, '#40c057');
      break;
    }
    case 'phoenix_beam': {
      // 3 piercing fire bolts in a tight fan toward the nearest enemy.
      const alive = ctx.enemies.filter(e => !e.dead);
      if (alive.length === 0) break;
      const nearest = alive.reduce((n, e) =>
        Math.hypot(e.x - px, e.y - py) < Math.hypot(n.x - px, n.y - py) ? e : n
      );
      const angle = Math.atan2(nearest.y - py, nearest.x - px);
      for (let i = -1; i <= 1; i++) {
        const p = new Projectile(px, py, angle + i * 0.14, baseDmg, 520, true, true);
        p.maxPierceCount = 999;
        p.color = '#ff6b00';
        p.radius = 8;
        ctx.pushProjectile(p);
      }
      break;
    }
    case 'earthquake': {
      // Damage + slow ALL enemies on screen; big visual pulse.
      // BALANCE FIX 2026-07-09: was baseDmg/count*2 (split across enemies) → each enemy
      // took almost nothing in large hordes (45 enemies: 11 dmg each vs Frost Nova's 50).
      // Earthquake should hit each enemy for the FULL damage — it's a crowd-clear nuke.
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        ctx.dealAuxDamage(e, baseDmg, '#c5aa6a');
        e.frozenTimer = Math.max(e.frozenTimer, 2.0);
      }
      ctx.spawnAoeZone(new AoeZone(px, py, 900, 0, 0.0, {
        color: '#c5aa6a', activeTime: 0.35, singleHit: true,
      }));
      break;
    }
    case 'shadow_step': {
      // Teleport through the nearest enemy then burst-nova.
      const alive = ctx.enemies.filter(e => !e.dead);
      if (alive.length === 0) break;
      const near = alive.reduce((n, e) =>
        Math.hypot(e.x - px, e.y - py) < Math.hypot(n.x - px, n.y - py) ? e : n
      );
      const dx = near.x - px, dy = near.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        ctx.player.x = Math.max(20, Math.min(ctx.worldWidth - 20, near.x + (dx / dist) * 35));
        ctx.player.y = Math.max(20, Math.min(ctx.worldHeight - 20, near.y + (dy / dist) * 35));
        ctx.player.invincibilityTimer = Math.max(ctx.player.invincibilityTimer, 0.4);
      }
      const r = skill.radius ?? 90;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - ctx.player.x, e.y - ctx.player.y) <= r) {
          ctx.dealAuxDamage(e, baseDmg, '#845ef7');
        }
      }
      ctx.spawnAoeZone(new AoeZone(ctx.player.x, ctx.player.y, r, 0, 0.0, {
        color: '#845ef7', activeTime: 0.4, singleHit: true,
      }));
      break;
    }
    case 'circle_power': {
      // Persistent ring zone — damages enemies inside it for 5 seconds.
      const rCP = skill.radius ?? 90;
      // Visual ring (damage=0 — AoeZone only hits the player).
      ctx.spawnAoeZone(new AoeZone(px, py, rCP, 0, 0.0, {
        color: '#ffd43b', activeTime: 5.0, singleHit: false, shape: 'ring',
      }));
      // Persistent enemy damage tick (2× baseDmg per second for 5s).
      ctx.pushActiveDmgZone(px, py, rCP, baseDmg * 2, 5.0, '#ffd43b');
      break;
    }

    // ── TIER 1 ADDITIONS ─────────────────────────────────────────────────
    case 'arcane_barrage': {
      // 5 homing projectiles fired toward the 5 nearest enemies.
      const targetsAB = [...ctx.enemies]
        .filter(e => !e.dead)
        .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
        .slice(0, 5);
      for (const t of targetsAB) {
        const angle = Math.atan2(t.y - py, t.x - px);
        const p = new Projectile(px, py, angle, baseDmg, 480, false, true);
        p.color = '#cc5de8';
        p.radius = 7;
        ctx.pushProjectile(p);
      }
      break;
    }
    case 'inferno_aura': {
      // Brief fire ring — damages and applies burnTimer to all nearby.
      const rIA = skill.radius ?? 140;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - px, e.y - py) <= rIA) {
          ctx.dealAuxDamage(e, baseDmg, '#ff8c00');
          e.burnTimer = Math.max(e.burnTimer, 3.0);
        }
      }
      ctx.spawnAoeZone(new AoeZone(px, py, rIA, 0, 0.0, {
        color: '#ff6b00', activeTime: 0.6, singleHit: true,
      }));
      break;
    }
    case 'crystal_burst': {
      // Hard-freeze 4 nearest enemies (2s), plus damage.
      const targetsCB = [...ctx.enemies]
        .filter(e => !e.dead)
        .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
        .slice(0, 4);
      for (const t of targetsCB) {
        ctx.dealAuxDamage(t, baseDmg, '#a5d8ff');
        t.frozenTimer = Math.max(t.frozenTimer, 2.0);
        ctx.spawnAoeZone(new AoeZone(t.x, t.y, 40, 0, 0.0, {
          color: '#a5d8ff', activeTime: 0.4, singleHit: true,
        }));
      }
      break;
    }
    case 'thunder_clap': {
      // Explosive repel — blast all nearby enemies outward, stun 1s, AoE damage.
      const rTC = skill.radius ?? 200;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        const dx = e.x - px, dy = e.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist <= rTC) {
          // Push enemy outward (stronger when closer)
          const pushMag = (1 - dist / rTC) * 220 + 60;
          if (dist > 5) {
            e.x = Math.max(20, Math.min(ctx.worldWidth - 20, e.x + (dx / dist) * pushMag));
            e.y = Math.max(20, Math.min(ctx.worldHeight - 20, e.y + (dy / dist) * pushMag));
          }
          e.frozenTimer = Math.max(e.frozenTimer, 1.0); // stun via freeze
          ctx.dealAuxDamage(e, baseDmg, '#ffd43b');
        }
      }
      ctx.spawnAoeZone(new AoeZone(px, py, rTC, 0, 0.0, {
        color: '#ffd43b', activeTime: 0.35, singleHit: true,
      }));
      break;
    }

    // ── TIER 2 ADDITIONS ─────────────────────────────────────────────────
    case 'blade_storm': {
      // 8 piercing blades fired in all directions simultaneously.
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const p = new Projectile(px, py, angle, baseDmg, 400, true, false);
        p.maxPierceCount = 999;
        p.color = '#e9ecef';
        p.radius = 10;
        ctx.pushProjectile(p);
      }
      break;
    }
    case 'lightning_storm': {
      // 5 lightning strikes on random enemies, staggered over 1.5 seconds.
      const aliveLS = ctx.enemies.filter(e => !e.dead);
      if (aliveLS.length === 0) break;
      for (let i = 0; i < 5; i++) {
        const t = aliveLS[Math.floor(Math.random() * aliveLS.length)];
        // Visual telegraph (damage=0 — AoeZone only hits the player).
        ctx.spawnAoeZone(new AoeZone(t.x, t.y, 45, 0, i * 0.3, {
          color: '#ffd43b', activeTime: 0.25, singleHit: true,
        }));
        // Deferred enemy damage at impact point.
        ctx.pushPendingDmg(t.x, t.y, 45, baseDmg, i * 0.3, '#ffd43b');
      }
      break;
    }
    case 'void_pulse': {
      // 3 expanding rings of damage — each larger and delayed.
      const rVP = skill.radius ?? 180;
      for (let i = 0; i < 3; i++) {
        const ringR = rVP * (0.5 + i * 0.3);
        // Visual ring (damage=0 — AoeZone only hits the player).
        ctx.spawnAoeZone(new AoeZone(px, py, ringR, 0, i * 0.25, {
          color: '#7950f2', activeTime: 0.3, singleHit: true,
        }));
        // Deferred enemy damage at ring resolution.
        ctx.pushPendingDmg(px, py, ringR, baseDmg, i * 0.25, '#7950f2');
      }
      break;
    }
    case 'blizzard': {
      // 6 frost shards scattered in large area — each slows and damages.
      const rBZ = skill.radius ?? 200;
      for (let i = 0; i < 6; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * rBZ;
        const ix = px + Math.cos(ang) * dist;
        const iy = py + Math.sin(ang) * dist;
        // Visual shard (damage=0 — AoeZone only hits the player).
        ctx.spawnAoeZone(new AoeZone(ix, iy, 60, 0, i * 0.2, {
          color: '#74c0fc', activeTime: 0.3, singleHit: true,
        }));
        // Deferred enemy damage + slow at impact.
        ctx.pushPendingDmg(ix, iy, 60, baseDmg, i * 0.2, '#74c0fc');
        for (const e of ctx.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - ix, e.y - iy) <= 60) {
            e.slowTimer = Math.max(e.slowTimer, 2.5);
            e.slowFactor = Math.min(e.slowFactor, 0.55);
          }
        }
      }
      break;
    }
    case 'gravity_pull': {
      // Yank ALL enemies toward the player, deal damage, then slow.
      const pullSnap = 180;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        const dx = px - e.x, dy = py - e.y;
        const distGP = Math.hypot(dx, dy);
        if (distGP > 5) {
          const snap = Math.min(pullSnap, distGP * 0.6);
          e.x += (dx / distGP) * snap;
          e.y += (dy / distGP) * snap;
        }
        ctx.dealAuxDamage(e, baseDmg, '#845ef7');
        e.slowTimer = Math.max(e.slowTimer, 3.0);
        e.slowFactor = Math.min(e.slowFactor, 0.45);
      }
      ctx.spawnAoeZone(new AoeZone(px, py, 900, 0, 0.0, {
        color: '#7950f2', activeTime: 0.3, singleHit: true,
      }));
      break;
    }
    case 'bone_spear': {
      // Massive single piercing bone lance — fired toward the nearest enemy.
      const aliveBS = ctx.enemies.filter(e => !e.dead);
      if (aliveBS.length === 0) break;
      const nearBS = aliveBS.reduce((n, e) =>
        Math.hypot(e.x - px, e.y - py) < Math.hypot(n.x - px, n.y - py) ? e : n
      );
      const angleBS = Math.atan2(nearBS.y - py, nearBS.x - px);
      const p = new Projectile(px, py, angleBS, baseDmg, 320, true, false);
      p.maxPierceCount = 999;
      p.color = '#e8d5b7';
      p.radius = 18; // visually large
      ctx.pushProjectile(p);
      break;
    }
    case 'spectral_shield': {
      // 5s invincibility bubble + immediate burst nova around the player.
      // BALANCE FIX 2026-07-09: description said "5s" but code gave 2.5s. Fixed to match.
      ctx.player.invincibilityTimer = Math.max(ctx.player.invincibilityTimer, 5.0);
      const rSS = skill.radius ?? 160;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - px, e.y - py) <= rSS) {
          ctx.dealAuxDamage(e, baseDmg, '#74c0fc');
        }
      }
      ctx.spawnAoeZone(new AoeZone(px, py, rSS, 0, 0.0, {
        color: '#a5d8ff', activeTime: 5.0, singleHit: true, shape: 'ring',
      }));
      break;
    }
    case 'rune_field': {
      // Drop 6 rune detonations at nearest enemy positions, each with 0.5s fuse.
      const alivRF = [...ctx.enemies]
        .filter(e => !e.dead)
        .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
        .slice(0, 6);
      const rRF = skill.radius ?? 70;
      for (let i = 0; i < alivRF.length; i++) {
        const t = alivRF[i];
        const delay = 0.5 + i * 0.1;
        // Visual telegraphed marker (damage=0 — AoeZone only hits the player).
        ctx.spawnAoeZone(new AoeZone(t.x, t.y, rRF, 0, delay, {
          color: '#ff6b6b', activeTime: 0.4, singleHit: true,
        }));
        // Deferred enemy damage resolved at detonation time.
        ctx.pushPendingDmg(t.x, t.y, rRF, baseDmg, delay, '#ff6b6b');
      }
      // If fewer than 6 enemies, fill with random positions around player
      for (let i = alivRF.length; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const d = 100 + Math.random() * 80;
        const rx = px + Math.cos(ang) * d;
        const ry = py + Math.sin(ang) * d;
        const delay = 0.5 + i * 0.1;
        ctx.spawnAoeZone(new AoeZone(rx, ry, rRF, 0, delay, {
          color: '#ff6b6b', activeTime: 0.4, singleHit: true,
        }));
        ctx.pushPendingDmg(rx, ry, rRF, baseDmg, delay, '#ff6b6b');
      }
      break;
    }

    // ── TIER 3 ADDITIONS ─────────────────────────────────────────────────
    case 'time_warp': {
      // Freeze ALL for 1s, then extend a heavy slow for 5s afterward.
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        e.frozenTimer = Math.max(e.frozenTimer, 1.0);
        e.slowTimer = Math.max(e.slowTimer, 6.0);
        e.slowFactor = Math.min(e.slowFactor, 0.25);
      }
      ctx.spawnAoeZone(new AoeZone(px, py, 900, 0, 0.0, {
        color: '#74c0fc', activeTime: 0.5, singleHit: true,
      }));
      break;
    }
    case 'vampire_burst': {
      // Drain 10 nearest enemies — heal 30% of total damage dealt.
      const targetsVB = [...ctx.enemies]
        .filter(e => !e.dead)
        .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
        .slice(0, 10);
      let totalDmgVB = 0;
      for (const t of targetsVB) {
        ctx.dealAuxDamage(t, baseDmg, '#c92a2a');
        totalDmgVB += baseDmg;
      }
      if (totalDmgVB > 0) ctx.player.heal(totalDmgVB * 0.30);
      ctx.spawnAoeZone(new AoeZone(px, py, 280, 0, 0.0, {
        color: '#9b2335', activeTime: 0.4, singleHit: true,
      }));
      break;
    }
    case 'spectral_dash': {
      // 5× rapid dash — teleport to each of 5 nearest enemies and nova-burst.
      const targetsSP = [...ctx.enemies]
        .filter(e => !e.dead)
        .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
        .slice(0, 5);
      if (targetsSP.length === 0) break;
      const rSD = skill.radius ?? 60;
      let lastX = px, lastY = py;
      for (let i = 0; i < targetsSP.length; i++) {
        const t = targetsSP[i];
        // Visual burst (damage=0 — AoeZone only hits the player).
        ctx.spawnAoeZone(new AoeZone(t.x, t.y, rSD, 0, i * 0.08, {
          color: '#845ef7', activeTime: 0.25, singleHit: true,
        }));
        // Deferred enemy damage at each dash position.
        ctx.pushPendingDmg(t.x, t.y, rSD, baseDmg, i * 0.08, '#845ef7');
        lastX = t.x; lastY = t.y;
      }
      ctx.player.x = Math.max(20, Math.min(ctx.worldWidth - 20, lastX));
      ctx.player.y = Math.max(20, Math.min(ctx.worldHeight - 20, lastY));
      ctx.player.invincibilityTimer = Math.max(ctx.player.invincibilityTimer, 0.6);
      break;
    }
    case 'plague_bomb': {
      // Massive persistent poison zone (8s) + immediate poisonTimer on enemies inside.
      // BUG FIX 2026-07-09: AoeZone had damage=baseDmg/5 which was hitting the PLAYER
      // (AoeZones are player-damage constructs). Changed to damage=0 (visual only) and
      // added pushActiveDmgZone for proper enemy DoT. Also: poison was only applied to
      // enemies at cast time (no ongoing entry-triggers); zone now damages all who linger.
      const rPB = skill.radius ?? 140;
      // Visual zone only — damage=0 so the player is NOT hurt by their own bomb.
      ctx.spawnAoeZone(new AoeZone(px, py, rPB, 0, 0.0, {
        color: '#40c057', activeTime: 8.0, singleHit: false,
      }));
      // Persistent enemy damage: baseDmg per second for 8s (total 8× mult over zone lifetime).
      ctx.pushActiveDmgZone(px, py, rPB, baseDmg, 8.0, '#40c057');
      // Poison status to all enemies currently in zone at cast time.
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - px, e.y - py) <= rPB) {
          e.poisonTimer = Math.max(e.poisonTimer, 6.0);
        }
      }
      break;
    }
    case 'soul_shatter': {
      // Stack Condemned×12 + Fragility×10 on 8 nearest, then detonation burst.
      const targsSH = [...ctx.enemies]
        .filter(e => !e.dead)
        .sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))
        .slice(0, 8);
      for (const t of targsSH) {
        t.statusFX.apply('condemned', { stacks: 12 });
        t.statusFX.apply('fragility', { stacks: 10 });
        t.statusFX.apply('exposed', { stacks: 5 });
      }
      // Detonation burst — hits all 8 and visual flash
      for (const t of targsSH) {
        ctx.dealAuxDamage(t, baseDmg, '#c92a2a');
        ctx.spawnAoeZone(new AoeZone(t.x, t.y, 45, 0, 0.0, {
          color: '#9b2335', activeTime: 0.35, singleHit: true,
        }));
      }
      break;
    }
    case 'mirror_strike': {
      // 3 simultaneous strikes hit EVERY enemy on screen.
      const alivMS = ctx.enemies.filter(e => !e.dead);
      // Visual shockwave rings (damage=0 — AoeZone only hits the player).
      for (let wave = 0; wave < 3; wave++) {
        ctx.spawnAoeZone(new AoeZone(px, py, 900, 0, wave * 0.3, {
          color: '#e599f7', activeTime: 0.25, singleHit: true,
        }));
      }
      // Actual enemy damage: deal baseDmg to each living enemy.
      for (const e of alivMS) {
        if (!e.dead) {
          ctx.dealAuxDamage(e, baseDmg, '#cc5de8');
          // Per-enemy burst visual.
          ctx.spawnAoeZone(new AoeZone(e.x, e.y, 30, 0, 0.0, {
            color: '#cc5de8', activeTime: 0.25, singleHit: true,
          }));
        }
      }
      break;
    }

    // ── TIER 4 ADDITIONS ─────────────────────────────────────────────────
    case 'black_hole': {
      // 2s gravity sink pulls enemies in, then detonates for massive damage.
      const rBH = skill.radius ?? 250;
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        const distBH = Math.hypot(e.x - px, e.y - py);
        if (distBH <= rBH && distBH > 5) {
          const dx = px - e.x, dy = py - e.y;
          e.x += (dx / distBH) * 150;
          e.y += (dy / distBH) * 150;
        }
      }
      ctx.spawnAoeZone(new AoeZone(px, py, rBH * 0.35, 0, 0.0, {
        color: '#212529', activeTime: 2.0, singleHit: false,
      }));
      // Visual detonation flash (damage=0 — AoeZone only hits the player).
      ctx.spawnAoeZone(new AoeZone(px, py, rBH, 0, 2.0, {
        color: '#7950f2', activeTime: 0.6, singleHit: false,
      }));
      // Deferred enemy damage at detonation.
      ctx.pushPendingDmg(px, py, rBH, baseDmg, 2.0, '#7950f2');
      break;
    }
    case 'curse_wave': {
      // Apply fragility + exposed stacks to every enemy on screen + minor damage.
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        e.statusFX.apply('fragility', { stacks: 5 });
        e.statusFX.apply('exposed', { stacks: 3 });
        ctx.dealAuxDamage(e, baseDmg, '#f03e3e');
      }
      ctx.spawnAoeZone(new AoeZone(px, py, 900, 0, 0.0, {
        color: '#f03e3e', activeTime: 0.5, singleHit: true,
      }));
      break;
    }
    case 'divine_wrath': {
      // 3 holy waves hit ALL enemies — massive damage + extended i-frames.
      ctx.player.invincibilityTimer = Math.max(ctx.player.invincibilityTimer, 2.0);
      for (let wave = 0; wave < 3; wave++) {
        // Visual wave (damage=0 — AoeZone only hits the player; player has i-frames anyway).
        ctx.spawnAoeZone(new AoeZone(px, py, 900, 0, wave * 0.4, {
          color: '#ffd43b', activeTime: 0.3, singleHit: true,
        }));
        // Deferred enemy damage — hits every enemy on screen at wave time.
        ctx.pushPendingDmg(px, py, 900, baseDmg, wave * 0.4, '#ffd43b');
      }
      break;
    }
    case 'armageddon': {
      // 12 meteors rain over 3 seconds — aims at living enemies.
      const rAG = skill.radius ?? 100;
      const aliveAG = ctx.enemies.filter(e => !e.dead);
      for (let i = 0; i < 12; i++) {
        let ix: number, iy: number;
        if (aliveAG.length > 0) {
          const t = aliveAG[Math.floor(Math.random() * aliveAG.length)];
          ix = t.x + (Math.random() - 0.5) * 60;
          iy = t.y + (Math.random() - 0.5) * 60;
        } else {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * 300;
          ix = px + Math.cos(a) * d;
          iy = py + Math.sin(a) * d;
        }
        // Visual meteor telegraph (damage=0 — AoeZone only hits the player).
        ctx.spawnAoeZone(new AoeZone(ix, iy, rAG, 0, i * 0.25, {
          color: '#ff6b00', activeTime: 0.45, singleHit: true,
        }));
        // Deferred enemy damage at each impact.
        ctx.pushPendingDmg(ix, iy, rAG, baseDmg, i * 0.25, '#ff6b00');
      }
      break;
    }
    case 'doom_comet': {
      // 1.5s warning comet — massive blast + all debuffs on every enemy in radius.
      const rDC = skill.radius ?? 200;
      // Telegraph: 1.5s red warning fill (visual only).
      ctx.spawnAoeZone(new AoeZone(px, py, rDC, 0, 0.0, {
        color: '#f03e3e', activeTime: 1.5, singleHit: true,
      }));
      // Detonation flash: pure visual, damage=0 (AoeZone only hits the player).
      ctx.spawnAoeZone(new AoeZone(px, py, rDC, 0, 1.5, {
        color: '#ff8c00', activeTime: 0.6, singleHit: true,
      }));
      // Debuffs applied immediately at cast (pre-mark — amplify the incoming blast).
      for (const e of ctx.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - px, e.y - py) <= rDC) {
          e.statusFX.apply('fragility', { stacks: 8 });
          e.statusFX.apply('exposed', { stacks: 6 });
          e.statusFX.apply('condemned', { stacks: 8 });
          e.statusFX.apply('brittle', { stacks: 10 });
          e.burnTimer = Math.max(e.burnTimer, 4.0);
          e.poisonTimer = Math.max(e.poisonTimer, 4.0);
          e.frozenTimer = Math.max(e.frozenTimer, 0.8);
        }
      }
      // Deferred blast damage: resolved 1.5s later against enemies still in radius.
      ctx.pushPendingDmg(px, py, rDC, baseDmg, 1.5, '#ff8c00');
      break;
    }
    case 'hellfire_rain': {
      // 20 hellfire bolts rain down on all living enemies over 4 seconds.
      const rHR = skill.radius ?? 65;
      const aliveHR = ctx.enemies.filter(e => !e.dead);
      for (let i = 0; i < 20; i++) {
        let ix: number, iy: number;
        if (aliveHR.length > 0) {
          const t = aliveHR[i % aliveHR.length];
          ix = t.x + (Math.random() - 0.5) * 50;
          iy = t.y + (Math.random() - 0.5) * 50;
        } else {
          const a = Math.random() * Math.PI * 2;
          ix = px + Math.cos(a) * (Math.random() * 300);
          iy = py + Math.sin(a) * (Math.random() * 300);
        }
        const delay = i * 0.2;
        // Visual telegraph marker (damage=0 — AoeZone only hits the player).
        ctx.spawnAoeZone(new AoeZone(ix, iy, rHR, 0, delay, {
          color: '#ff4500', activeTime: 0.4, singleHit: true,
        }));
        // Deferred enemy damage at the bolt's impact position.
        ctx.pushPendingDmg(ix, iy, rHR, baseDmg, delay, '#ff4500');
      }
      break;
    }
  }
}
