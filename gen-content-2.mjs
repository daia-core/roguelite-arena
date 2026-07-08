// gen-content-2.mjs — second content wave: NEW-MECHANIC archetypes.
//
// The first wave (gen-content.mjs) covered the 34 raw-stat archetypes (burn, crit,
// armor, gold, …). This wave deliberately builds around the wired-but-underused
// mechanics so the added items play DIFFERENTLY, not just bigger numbers:
//   summon/orbit · aux-blade · spectral daggers · bombs · nova pulses ·
//   the six Soulstone on-hit debuffs (Fragility/Exposed/Condemned/Brittle/Dazed/
//   Disoriented) · conditional scaling (Grindstone/Last-Stand/Juggernaut/Killing-
//   Spree/Miser) · multicast · war-chest · soul-tithe.
//
// Every field used here is CONSUMED by gameplay (verified against Game.ts /
// ItemSystem.ts), and every item still renders at least one visible stat chip via
// itemStatSegments. Weighted toward ss2/ss3/ss4 (uncommon→legendary) per request.
// Each item pairs a real upside with a thematic bite; all end net-positive.

import { readFileSync, writeFileSync } from 'node:fs';

const { ids: existIds, names: existNames } = JSON.parse(readFileSync('/tmp/existing.json', 'utf8'));
const usedIds = new Set(existIds);
const usedNames = new Set(existNames);

const TIERS = {
  1: { enum: 'ItemTier.Common',    rarity: 'common',    cost: [9, 16],   up: 1.0, prefix: 'sx1' },
  2: { enum: 'ItemTier.Uncommon',  rarity: 'rare',      cost: [18, 34],  up: 1.6, prefix: 'sx2' },
  3: { enum: 'ItemTier.Rare',      rarity: 'epic',      cost: [38, 68],  up: 2.3, prefix: 'sx3' },
  4: { enum: 'ItemTier.Legendary', rarity: 'legendary', cost: [95, 190], up: 3.2, prefix: 'sx4' },
};

function r2(v) {
  if (typeof v !== 'number') return v;
  return Math.round(v * 100) / 100;
}
const clampGE = (v, lo) => (v < lo ? lo : v);

let costCounter = 0;
function costFor(tier) {
  const [lo, hi] = TIERS[tier].cost;
  const span = hi - lo;
  const v = lo + ((costCounter * 41) % (span + 1));
  costCounter++;
  return v;
}

// Archetype = one new-mechanic playstyle. up(u) scales the good stats by tier factor;
// bite is a fixed thematic downside. Each MUST leave at least one rendered chip.
const ARCHES = [
  // ---------- SUMMON / ORBIT ----------
  { key: 'orbit', name: ['Orbiting Sparks', 'Satellite Charm', 'Aster Ring', 'Celestial Halo'], tags: ['elemental'], slot: 'amulet', icon: '🪐',
    theme: 'Energy orbs circle and shred whatever brushes them — but the drag steals a step of speed.',
    up: (u) => ({ orbitOrbs: clampGE(Math.round(0.8 * u), 1), orbitDamageMult: 1.15 + 0.15 * u }), bite: { speedMultiplier: 0.95 } },
  { key: 'auxblade', name: ['Whirling Edge', 'Autonomous Saber', 'Ghost Blade Ring', 'Spinning Guard'], tags: ['melee'], slot: 'ring', icon: '🗡️',
    theme: 'A blade orbits and swings on its own timer; leaning on it thins your own strikes.',
    up: (u) => ({ auxMelee: true, auxMeleeDamageMult: 1.2 + 0.16 * u, meleeDamageMult: 1 + 0.05 * u }), bite: { fireRateMultiplier: 0.94 } },
  { key: 'daggers', name: ['Ceremonial Fan', 'Ritual Daggers', 'Fated Blades', 'Umbral Knives'], tags: ['melee'], slot: 'amulet', icon: '🔪',
    theme: 'Spectral daggers circle and lash outward; carrying the ritual weight slows your feet.',
    up: (u) => ({ ceremonialDaggers: clampGE(Math.round(1 + 0.7 * u), 2), meleeDamageMult: 1 + 0.06 * u }), bite: { speedMultiplier: 0.95 } },

  // ---------- BOMBS / NOVA (active AoE) ----------
  { key: 'bomb', name: ['Cluster Bandolier', 'Demolition Charm', 'Powder Keg Ring', 'Blast Satchel'], tags: ['elemental'], slot: 'torso', icon: '💣',
    theme: 'You periodically drop a live bomb at your feet — the volatile load slows your fire.',
    up: (u) => ({ bombDrop: true, bombDamageMult: 1.2 + 0.2 * u, bombCooldownMult: clampGE(0.96 - 0.05 * u, 0.6) }), bite: { fireRateMultiplier: 0.93 } },
  { key: 'nova', name: ['Pulse Core', 'Shockwave Sigil', 'Nova Heart', 'Detonation Crown'], tags: ['elemental'], slot: 'amulet', icon: '🌀',
    theme: 'A shockwave pulses out from you on a timer; the recoil softens your direct hits.',
    up: (u) => ({ novaPulse: true, novaDamageMult: 1.2 + 0.18 * u, novaCooldownMult: clampGE(0.95 - 0.06 * u, 0.5) }), bite: { damageMultiplier: 0.95 } },

  // ---------- SOULSTONE ON-HIT DEBUFFS ----------
  { key: 'fragile', name: ['Fracture Charm', 'Weakpoint Sigil', 'Sunder Band', 'Faultline Token'], tags: ['elemental'], slot: 'ring', icon: '🪨',
    theme: 'Your hits leave foes Fragile, stacking up the damage they take — but softness spreads to your guard.',
    up: (u) => ({ fragileChance: Math.min(0.4, 0.08 * u), elementalDamageMult: 1 + 0.06 * u }), bite: { armor: -1 } },
  { key: 'exposed', name: ['Exposé Charm', 'Vulnerary Sigil', 'Openwound Band', 'Bared Token'], tags: ['ranged'], slot: 'ring', icon: '🎯',
    theme: 'Marked foes take extra from every direct hit; keeping them in your sights costs vigor.',
    up: (u) => ({ exposedChance: Math.min(0.4, 0.09 * u), damageMultiplier: 1 + 0.04 * u }), bite: { maxHealthBonus: -8 } },
  { key: 'condemned', name: ['Condemnation Rune', 'Verdict Sigil', 'Doomsayer Mark', 'Sentence Charm'], tags: ['elemental', 'melee'], slot: 'amulet', icon: '⚖️',
    theme: 'Stacks of Condemned build to a devastating crit — the dark bookkeeping frays your health.',
    up: (u) => ({ condemnedChance: Math.min(0.25, 0.05 * u), critDamageMultiplier: 1 + 0.1 * u }), bite: { maxHealthBonus: -10 } },
  { key: 'brittle', name: ['Brittlebone Charm', 'Chip Sigil', 'Shatter Band', 'Glasscut Token'], tags: ['melee'], slot: 'ring', icon: '🦴',
    theme: 'Each strike makes them Brittle, adding flat bite per hit — the reckless pace slows you.',
    up: (u) => ({ brittleChance: Math.min(0.4, 0.09 * u), meleeDamageMult: 1 + 0.06 * u }), bite: { speedMultiplier: 0.95 } },
  { key: 'dazed', name: ['Concussion Charm', 'Ringing Sigil', 'Stagger Band', 'Vertigo Token'], tags: ['ranged'], slot: 'amulet', icon: '💫',
    theme: 'Dazed foes take more crits from everyone; the flashy hits leave your body weaker.',
    up: (u) => ({ dazedChance: Math.min(0.4, 0.09 * u), critChance: Math.min(0.18, 0.045 * u) }), bite: { damageMultiplier: 0.96 } },
  { key: 'disoriented', name: ['Disarray Charm', 'Bewilder Sigil', 'Swirl Band', 'Muddle Token'], tags: ['elemental'], slot: 'ring', icon: '🌫️',
    theme: 'Disoriented enemies suffer heavier crit damage; the swirling haze pits your armor.',
    up: (u) => ({ disorientedChance: Math.min(0.4, 0.09 * u), critDamageMultiplier: 1 + 0.09 * u }), bite: { armor: -2 } },

  // ---------- CONDITIONAL SCALING ----------
  { key: 'grindstone', name: ['Grindstone Pendant', 'Whetstone Sigil', 'Endurance Band', 'Longhaul Token'], tags: ['utility', 'melee'], slot: 'head', icon: '🪓',
    theme: 'Every wave you survive grinds a permanent damage edge — but the training cuts your reserves.',
    up: (u) => ({ waveRampDamage: Math.min(0.15, 0.03 * u), damageMultiplier: 1 + 0.04 * u }), bite: { maxHealthBonus: -8 } },
  { key: 'laststand', name: ['Last Stand Charm', 'Desperado Sigil', 'Cornered Band', 'Deathwish Token'], tags: ['defensive', 'melee'], slot: 'torso', icon: '🩹',
    theme: 'At low health you fight harder and faster — the bravado leaves you a touch slower otherwise.',
    up: (u) => ({ lowHpPower: Math.min(0.9, 0.2 * u), maxHealthBonus: Math.round(6 + 6 * u) }), bite: { speedMultiplier: 0.96 } },
  { key: 'juggernaut', name: ['Juggernaut Plate', 'Unbroken Sigil', 'Bastion Band', 'Colossus Token'], tags: ['defensive'], slot: 'legs', icon: '🛡️',
    theme: 'Kept whole and unhurt, you hit like a wall — the heavy plate slows your fire.',
    up: (u) => ({ highHpPower: Math.min(0.5, 0.12 * u), armor: Math.round(1 + 1.2 * u) }), bite: { fireRateMultiplier: 0.94 } },
  { key: 'killstreak', name: ['Killing Spree Band', 'Momentum Sigil', 'Bloodrush Charm', 'Rampage Token'], tags: ['melee', 'ranged'], slot: 'ring', icon: '🔥',
    theme: 'Each kill stacks a decaying damage surge; chasing the streak thins your health.',
    up: (u) => ({ killStackDamage: Math.min(0.15, 0.035 * u), fireRateMultiplier: 1 + 0.05 * u }), bite: { maxHealthBonus: -8 } },
  { key: 'miser', name: ["Miser's Hoard", 'Dragon Sigil', 'Hoarder Band', 'Scrooge Token'], tags: ['economic'], slot: 'ring', icon: '🪙',
    theme: 'Unspent gold sharpens your blows — but chasing coin makes each hit land lighter.',
    up: (u) => ({ goldScaleDamage: Math.min(0.15, 0.04 * u), goldBonus: 1 + 0.06 * u }), bite: { damageMultiplier: 0.96 } },

  // ---------- MULTICAST / WAR-CHEST / SOUL ----------
  { key: 'multicast', name: ['Echo Sigil', 'Twinshot Charm', 'Reverb Band', 'Fugue Token'], tags: ['ranged', 'elemental'], slot: 'amulet', icon: '🔉',
    theme: 'Your volleys sometimes fire twice in a frame; the strain saps your health.',
    up: (u) => ({ multicast: Math.min(0.5, 0.1 * u), rangedDamageMult: 1 + 0.06 * u }), bite: { maxHealthBonus: -8 } },
  { key: 'warchest', name: ['War Chest', 'Spoils Coffer', 'Plunder Trove', 'Bounty Vault'], tags: ['economic'], slot: 'legs', icon: '🧰',
    theme: 'Battle fills your coffers with escalating spoils; the greed dulls your edge a little.',
    up: (u) => ({ warChest: r2(0.5 + 0.6 * u), goldBonus: 1 + 0.05 * u, luck: Math.min(0.3, 0.07 * u) }), bite: { damageMultiplier: 0.96 } },
  { key: 'soul', name: ['Soul Tithe', 'Reaper Ledger', 'Wraith Contract', 'Spirit Levy'], tags: ['elemental', 'defensive'], slot: 'amulet', icon: '👻',
    theme: 'The slain pay a tithe of power back to you; the pact stalls your natural healing.',
    up: (u) => ({ soulTithe: true, doom: Math.min(0.4, 0.1 * u), lifesteal: Math.min(0.18, 0.045 * u) }), bite: { healthRegen: -1 } },
];

const items = [];

function pushItem(tier, arch, variantIdx) {
  const T = TIERS[tier];
  const upside = arch.up(T.up);
  for (const k of Object.keys(upside)) {
    if (upside[k] === undefined) delete upside[k];
    else if (typeof upside[k] === 'number') upside[k] = r2(upside[k]);
  }
  const fields = { ...upside };
  for (const [k, v] of Object.entries(arch.bite)) {
    if (fields[k] !== undefined) continue;
    if (typeof v === 'number' && Number.isInteger(v) && (k === 'maxHealthBonus' || k === 'armor' || k === 'healthRegen')) {
      fields[k] = Math.round(v * (0.7 + 0.35 * T.up));
    } else {
      fields[k] = r2(v);
    }
  }
  let base = arch.name[variantIdx % arch.name.length];
  let name = base;
  let n = 1;
  while (usedNames.has(name)) { n++; name = `${base} ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n - 2] || ('+' + n)}`; }
  usedNames.add(name);
  let id = `${T.prefix}_${arch.key}_${variantIdx}`;
  while (usedIds.has(id)) { id = `${T.prefix}_${arch.key}_${variantIdx}_${Math.random().toString(36).slice(2, 5)}`; }
  usedIds.add(id);

  items.push({
    id, name, description: arch.theme,
    rarity: T.rarity, tier: T.enum, cost: costFor(tier),
    icon: arch.icon, unlocked: true, tags: arch.tags, slot: arch.slot, fields,
  });
}

// Weighted toward ss2/ss3/ss4 (Felix's ask). Round-robin archetypes per tier.
const perTier = { 1: 70, 2: 160, 3: 170, 4: 130 };
for (const tier of [1, 2, 3, 4]) {
  const target = perTier[tier];
  let made = 0, round = 0;
  while (made < target) {
    for (const arch of ARCHES) {
      if (made >= target) break;
      pushItem(tier, arch, round);
      made++;
    }
    round++;
  }
}

function emit(it) {
  const parts = [
    `id: '${it.id}'`,
    `name: ${JSON.stringify(it.name)}`,
    `description: ${JSON.stringify(it.description)}`,
    `rarity: '${it.rarity}'`,
    `tier: ${it.tier}`,
    `cost: ${it.cost}`,
    `icon: '${it.icon}'`,
    `unlocked: true`,
    `tags: [${it.tags.map((t) => `'${t}'`).join(', ')}]`,
    `slot: '${it.slot}'`,
  ];
  for (const [k, v] of Object.entries(it.fields)) {
    if (v === undefined) continue;
    parts.push(`${k}: ${v}`);
  }
  return `    { ${parts.join(', ')} },`;
}

const header = `\n    // ==================== SOULSTONE EXPANSION II — NEW-MECHANIC WAVE ====================\n` +
  `    // ~${items.length} items built around wired-but-underused mechanics (orbit/summon, aux-blade,\n` +
  `    // spectral daggers, bombs, nova pulses, the six on-hit debuffs, conditional scaling —\n` +
  `    // Grindstone/Last-Stand/Juggernaut/Killing-Spree/Miser — multicast, war-chest, soul-tithe).\n` +
  `    // Weighted toward uncommon→legendary (sx2/sx3/sx4). Each pairs an upside with a thematic bite.\n`;

const body = items.map(emit).join('\n');
writeFileSync('/tmp/expansion2.ts', header + body + '\n');
console.log(`generated ${items.length} items`);
const byTier = {};
for (const it of items) byTier[it.tier] = (byTier[it.tier] || 0) + 1;
console.log(byTier);
