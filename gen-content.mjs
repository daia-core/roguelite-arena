// gen-content.mjs — generate the Soulstone-Survivors-inspired content expansion.
// Emits ~690 new items across T1–T4 so the catalog roughly TRIPLES (343 → ~1030).
// Every item pairs a real UPSIDE with a thematic BITE (Brotato/Soulstone philosophy),
// draws on our wired fields (incl. the new `slow` status), and is checked for id/name
// collisions against the live catalog before it's written. Pure data out.

import { readFileSync, writeFileSync } from 'node:fs';

const { ids: existIds, names: existNames } = JSON.parse(readFileSync('/tmp/existing.json', 'utf8'));
const usedIds = new Set(existIds);
const usedNames = new Set(existNames);

// ---- tier config: how strong, how much it costs, how big the bite ----
const TIERS = {
  1: { enum: 'ItemTier.Common',    rarity: 'common',    cost: [7, 14],   up: 1.0, prefix: 'ss1' },
  2: { enum: 'ItemTier.Uncommon',  rarity: 'rare',      cost: [16, 30],  up: 1.6, prefix: 'ss2' },
  3: { enum: 'ItemTier.Rare',      rarity: 'epic',      cost: [34, 62],  up: 2.3, prefix: 'ss3' },
  4: { enum: 'ItemTier.Legendary', rarity: 'legendary', cost: [90, 180], up: 3.2, prefix: 'ss4' },
};

// round to 2 decimals, killing float noise (0.448000006 → 0.45)
function r2(v) {
  if (typeof v !== 'number') return v;
  return Math.round(v * 100) / 100;
}

// cost spreads across the tier band by a running counter so items in a tier vary
let costCounter = 0;
function costFor(tier) {
  const [lo, hi] = TIERS[tier].cost;
  const span = hi - lo;
  const v = lo + ((costCounter * 37) % (span + 1)); // pseudo-random spread across band
  costCounter++;
  return v;
}

// ---- archetype library: each is a Soulstone active-skill / trait adapted to our fields.
// upside(u) scales the good stats by tier factor u; bite is a fixed thematic downside.
// kind drives which slot/tag/icon set. Every entry MUST end net-positive.
// Fields used only where they already exist & are wired.
const ARCHES = [
  // ---------- FIRE / BURN (Meteor, Flame Wave, Ignite) ----------
  { key: 'ember',   name: ['Ember Charm','Cinder Talisman','Pyre Sigil','Magma Core'], tags:['elemental'], slot:'ring', icon:'🔥',
    theme:'Fire seeps into every strike, but the heat frays your defenses.',
    up:(u)=>({ burn: Math.min(0.5,0.12*u), elementalDamageMult: 1+0.08*u }), bite:{ armor:-1 } },
  { key: 'meteor',  name: ['Meteor Fragment','Falling Star','Skyfire Shard','Comet Ember'], tags:['elemental','ranged'], slot:'amulet', icon:'☄️',
    theme:'Call down fire from above; the recoil slows your own hands.',
    up:(u)=>({ burn: Math.min(0.55,0.14*u), explosionOnHit: u>=2.2 ? true: undefined, elementalDamageMult:1+0.10*u }), bite:{ fireRateMultiplier:0.92 } },
  { key: 'flamewave',name:['Flamebrand','Wildfire Band','Searing Coil','Inferno Wrap'], tags:['elemental','melee'], slot:'torso', icon:'🌋',
    theme:'Your swings trail fire, at the cost of raw damage.',
    up:(u)=>({ burn: Math.min(0.5,0.13*u), swingAoe: u>=2 ? 1: undefined, elementalDamageMult:1+0.09*u }), bite:{ damageMultiplier:0.95 } },

  // ---------- ICE / SLOW / FREEZE (Blizzard, Chill) ----------
  { key: 'chill',   name:['Chill Fang','Frostbite Ring','Rime Charm','Glacial Token'], tags:['elemental'], slot:'ring', icon:'❄️',
    theme:'A cold aura drags enemies down, but the frost stiffens your step.',
    up:(u)=>({ slow: Math.min(0.5,0.14*u), elementalDamageMult:1+0.06*u }), bite:{ speedMultiplier:0.95 } },
  { key: 'blizzard',name:['Blizzard Heart','Winter Crown','Hailstorm Sigil','Permafrost Idol'], tags:['elemental'], slot:'amulet', icon:'🌨️',
    theme:'A storm of ice chills all it touches; you fire a touch slower in the cold.',
    up:(u)=>({ slow: Math.min(0.55,0.16*u), freeze: Math.min(0.3,0.08*u), elementalDamageMult:1+0.08*u }), bite:{ fireRateMultiplier:0.93 } },
  { key: 'frostbite',name:['Frost Lattice','Icebound Plate','Glacier Mail','Frozen Aegis'], tags:['elemental','defensive'], slot:'legs', icon:'🧊',
    theme:'Cold armor slows attackers who close in, but weighs you down.',
    up:(u)=>({ slow: Math.min(0.5,0.13*u), armor: Math.round(1+0.6*u) }), bite:{ speedMultiplier:0.94 } },

  // ---------- LIGHTNING (Chain Lightning, Shock/Dazed) ----------
  { key: 'spark',   name:['Spark Coil','Static Charm','Voltaic Ring','Tesla Token'], tags:['elemental'], slot:'ring', icon:'⚡',
    theme:'Bolts leap between foes, but the current jitters your aim.',
    up:(u)=>({ chainLightning: Math.min(0.5,0.13*u), elementalDamageMult:1+0.07*u }), bite:{ critChance:-0.02 } },
  { key: 'stormcall',name:['Stormcaller Rod','Thunderhead Sigil','Levin Crown','Arc Reactor'], tags:['elemental','ranged'], slot:'amulet', icon:'🌩️',
    theme:'Lightning arcs through the horde; the discharge saps your health.',
    up:(u)=>({ chainLightning: Math.min(0.6,0.16*u), elementalDamageMult:1+0.10*u }), bite:{ maxHealthBonus:-8 } },

  // ---------- POISON / NATURE (Poison Cloud, Bomb, Acid Rain) ----------
  { key: 'venom',   name:['Venom Vial','Toxin Band','Blight Charm','Serpent Sigil'], tags:['elemental'], slot:'ring', icon:'🧪',
    theme:'A creeping toxin eats at foes, but your blows land softer.',
    up:(u)=>({ poison: u>=1.6 ? true: undefined, bleed: Math.min(0.4,0.11*u), elementalDamageMult:1+0.06*u }), bite:{ damageMultiplier:0.95 } },
  { key: 'plague',  name:['Plaguebearer','Miasma Idol','Contagion Crown','Rotwood Totem'], tags:['elemental'], slot:'amulet', icon:'☣️',
    theme:'Poison spreads from the dying to the living, thinning your armor.',
    up:(u)=>({ poison:true, poisonSpread: u>=2.2 ? true: undefined, elementalDamageMult:1+0.09*u }), bite:{ armor:-2 } },
  { key: 'acid',    name:['Acid Flask','Corrosive Wrap','Etching Sigil','Solvent Charm'], tags:['elemental'], slot:'legs', icon:'🫗',
    theme:'Acid wears enemies down over time; the fumes slow your feet.',
    up:(u)=>({ bleed: Math.min(0.45,0.12*u), wound: Math.min(0.35,0.10*u) }), bite:{ speedMultiplier:0.95 } },

  // ---------- BLEED / WOUND (visceral melee) ----------
  { key: 'rend',    name:['Rending Claw','Lacerator','Gore Band','Ripper Sigil'], tags:['melee'], slot:'ring', icon:'🩸',
    theme:'Deep cuts bleed foes out, but leave you exposed.',
    up:(u)=>({ bleed: Math.min(0.5,0.14*u), meleeDamageMult:1+0.08*u }), bite:{ armor:-1 } },
  { key: 'wound',   name:['Wounding Edge','Cruel Barb','Sundering Mark','Vivisector'], tags:['melee'], slot:'amulet', icon:'🔪',
    theme:'Every hit deepens their wounds; recklessness costs you health.',
    up:(u)=>({ wound: Math.min(0.5,0.13*u), meleeDamageMult:1+0.09*u }), bite:{ maxHealthBonus:-10 } },

  // ---------- DOOM / EXECUTE (Abyssal, dark magic) ----------
  { key: 'doom',    name:['Doom Rune','Abyssal Mark','Hex Sigil','Oblivion Charm'], tags:['elemental'], slot:'ring', icon:'💀',
    theme:'A curse stores their pain, then detonates; the darkness drains you.',
    up:(u)=>({ doom: Math.min(0.4,0.10*u), elementalDamageMult:1+0.07*u }), bite:{ healthRegen:-1 } },
  { key: 'execute', name:['Reaper Sigil','Guillotine Charm','Cull Mark','Deathbrand'], tags:['melee','ranged'], slot:'amulet', icon:'⚰️',
    theme:'Finish the weak outright, but you hit the healthy softer.',
    up:(u)=>({ executeThreshold: Math.min(0.18,0.05*u), damageMultiplier:1+0.05*u }), bite:{ damageMultiplier:0.96 } },

  // ---------- RAW MELEE POWER ----------
  { key: 'brute',   name:['Brute Band','Crushing Gauntlet','Ogre Grip','Titan Knuckle'], tags:['melee'], slot:'ring', icon:'👊',
    theme:'Colossal melee force, but momentum leaves you slow.',
    up:(u)=>({ meleeDamageMult:1+0.14*u, knockback: u>=2 ? 1: undefined }), bite:{ speedMultiplier:0.93 } },
  { key: 'cleave',  name:['Cleaving Edge','Wide Arc Band','Sweep Sigil','Whirlwind Charm'], tags:['melee'], slot:'torso', icon:'🪓',
    theme:'Your swings sweep wider, but each hit lands a touch lighter.',
    up:(u)=>({ swingArcBonus: Math.round(8+6*u), swingRangeBonus: Math.round(4+3*u), meleeDamageMult:1+0.06*u }), bite:{ swingCooldownMult:1.08 } },

  // ---------- RAW RANGED POWER ----------
  { key: 'volley',  name:['Volley Band','Scattershot Charm','Barrage Sigil','Fusillade Token'], tags:['ranged'], slot:'ring', icon:'🎯',
    theme:'More projectiles fill the air, each a little weaker.',
    up:(u)=>({ multishot: u>=2.5 ? 2 : 1, rangedDamageMult:1+0.05*u }), bite:{ damageMultiplier:0.94 } },
  { key: 'pierce',  name:['Piercing Bolt','Lance Charm','Skewer Sigil','Impaler Token'], tags:['ranged'], slot:'amulet', icon:'➶',
    theme:'Shots punch through the line; the heavy tips slow your rate.',
    up:(u)=>({ piercing: Math.round(1+0.8*u), rangedDamageMult:1+0.06*u }), bite:{ fireRateMultiplier:0.93 } },
  { key: 'seeker',  name:['Seeker Rune','Homing Charm','Tracker Sigil','Guided Token'], tags:['ranged'], slot:'ring', icon:'🔭',
    theme:'Your shots curve to their marks, but fly slower to steer.',
    up:(u)=>({ homing: true, rangedDamageMult:1+0.07*u }), bite:{ projectileSpeed:0.9 } },

  // ---------- CRIT ----------
  { key: 'crit',    name:['Keen Edge','Deadeye Band','Precision Charm','Killer Instinct'], tags:['ranged','melee'], slot:'ring', icon:'🎯',
    theme:'Sharper crits, but the focus thins your health.',
    up:(u)=>({ critChance: Math.min(0.2,0.05*u), critDamageMultiplier:1+0.12*u }), bite:{ maxHealthBonus:-8 } },

  // ---------- SPEED / FIRE RATE ----------
  { key: 'haste',   name:['Haste Band','Quickstep Charm','Fleet Sigil','Swift Token'], tags:['utility'], slot:'feet', icon:'👟',
    theme:'Blistering fire rate, but each shot hits lighter.',
    up:(u)=>({ fireRateMultiplier:1+0.12*u }), bite:{ damageMultiplier:0.95 } },
  { key: 'fleet',   name:['Fleetfoot Band','Windrunner Charm','Dasher Sigil','Sprint Token'], tags:['utility'], slot:'feet', icon:'🪽',
    theme:'You move like the wind, but strike with less weight.',
    up:(u)=>({ speedMultiplier:1+0.09*u }), bite:{ meleeDamageMult:0.95 } },

  // ---------- DEFENSE ----------
  { key: 'ward',    name:['Warding Band','Bulwark Charm','Aegis Sigil','Guardian Token'], tags:['defensive'], slot:'torso', icon:'🛡️',
    theme:'Solid armor, but the weight slows your attacks.',
    up:(u)=>({ armor: Math.round(1+1.2*u), maxHealthBonus: Math.round(8+8*u) }), bite:{ fireRateMultiplier:0.94 } },
  { key: 'thorn',   name:['Thornmail Band','Spiked Charm','Bramble Sigil','Retort Token'], tags:['defensive'], slot:'legs', icon:'🌵',
    theme:'Attackers bleed on your spines, but you strike slower.',
    up:(u)=>({ thorns: Math.min(0.5,0.14*u), armor: Math.round(0.6*u) }), bite:{ swingCooldownMult:1.06 } },
  { key: 'regen',   name:['Mending Band','Renewal Charm','Vital Sigil','Lifebloom Token'], tags:['defensive'], slot:'amulet', icon:'💚',
    theme:'Steady healing, but you move more cautiously.',
    up:(u)=>({ healthRegen: Math.round(1+1.3*u), maxHealthBonus: Math.round(6+6*u) }), bite:{ speedMultiplier:0.96 } },
  { key: 'dodge',   name:['Evasion Band','Phantom Charm','Blur Sigil','Ghost Token'], tags:['defensive','utility'], slot:'feet', icon:'💨',
    theme:'Slip past blows, but a lighter frame means less health.',
    up:(u)=>({ dodge: Math.min(0.25,0.06*u), speedMultiplier:1+0.04*u }), bite:{ maxHealthBonus:-6 } },

  // ---------- LIFESTEAL / VAMPIRE ----------
  { key: 'leech',   name:['Leech Band','Sanguine Charm','Blooddrinker Sigil','Vampire Token'], tags:['melee','defensive'], slot:'ring', icon:'🧛',
    theme:'Heal from the slaughter, but your armor rots.',
    up:(u)=>({ lifesteal: Math.min(0.2,0.05*u), meleeDamageMult:1+0.05*u }), bite:{ armor:-1 } },

  // ---------- ECONOMY (Ammo Box, Fortune) ----------
  { key: 'greed',   name:['Greed Band','Fortune Charm','Midas Sigil','Coin Token'], tags:['economic'], slot:'ring', icon:'💰',
    theme:'More gold flows in, but the weight of coin slows you.',
    up:(u)=>({ goldBonus:1+0.10*u, luck: Math.min(0.3,0.08*u) }), bite:{ speedMultiplier:0.96 } },
  { key: 'lucky',   name:['Lucky Band','Clover Charm','Chance Sigil','Gambler Token'], tags:['economic'], slot:'amulet', icon:'🍀',
    theme:'Luck bends your way, but you carry less vigor.',
    up:(u)=>({ luck: Math.min(0.4,0.1*u), goldBonus:1+0.06*u }), bite:{ maxHealthBonus:-6 } },
  { key: 'banker',  name:['Banker Band','Interest Charm','Vault Sigil','Ledger Token'], tags:['economic'], slot:'legs', icon:'🏦',
    theme:'Your savings earn interest, but you fight a touch weaker.',
    up:(u)=>({ interestBonus: Math.min(0.3,0.08*u), goldBonus:1+0.05*u }), bite:{ damageMultiplier:0.96 } },

  // ---------- UTILITY (XP, magnet, reroll) ----------
  { key: 'sage',    name:['Sage Band','Scholar Charm','Insight Sigil','Lore Token'], tags:['utility'], slot:'head', icon:'📖',
    theme:'You learn faster, but split focus dulls your edge.',
    up:(u)=>({ xpMagnet:1+0.12*u }), bite:{ damageMultiplier:0.97 } },
  { key: 'haggle',  name:['Haggler Band','Merchant Charm','Bargain Sigil','Trader Token'], tags:['economic','utility'], slot:'head', icon:'🪙',
    theme:'Rerolls come cheap, but comfort makes you slower.',
    up:(u)=>({ rerollDiscount: Math.min(0.6,0.15*u), shopDiscount: Math.min(0.2,0.05*u) }), bite:{ speedMultiplier:0.97 } },

  // ---------- HYBRID ELEMENTAL POWER ----------
  { key: 'arcane',  name:['Arcane Band','Mystic Charm','Runeweave Sigil','Spellblade Token'], tags:['elemental'], slot:'amulet', icon:'🔮',
    theme:'Raw elemental might, but physical blows falter.',
    up:(u)=>({ elementalDamageMult:1+0.14*u, multicast: u>=2.5 ? Math.min(0.3,0.08*u): undefined }), bite:{ meleeDamageMult:0.9 } },
];

// icon variety per tier so they don't all look identical
const items = [];
let arcIdx = 0;

function pushItem(tier, arch, variantIdx, totalVariants) {
  const T = TIERS[tier];
  const u = T.up;
  const upside = arch.up(u);
  // clean undefined + round float noise
  for (const k of Object.keys(upside)) {
    if (upside[k] === undefined) delete upside[k];
    else upside[k] = r2(upside[k]);
  }
  const fields = { ...upside };
  // apply bite (never overwrite an upside field; scale flat bites slightly by tier)
  for (const [k, v] of Object.entries(arch.bite)) {
    if (fields[k] !== undefined) continue;
    if (typeof v === 'number' && Number.isInteger(v) && (k === 'maxHealthBonus' || k === 'armor' || k === 'healthRegen')) {
      fields[k] = Math.round(v * (0.7 + 0.35 * u)); // bigger bite at higher tier
    } else {
      fields[k] = r2(v);
    }
  }
  // name + id uniqueness
  let base = arch.name[variantIdx % arch.name.length];
  let name = base;
  let n = 1;
  while (usedNames.has(name)) { n++; name = `${base} ${['I','II','III','IV','V','VI'][n-2] || ('+'+n)}`; }
  usedNames.add(name);
  let id = `${T.prefix}_${arch.key}_${variantIdx}`;
  while (usedIds.has(id)) { id = `${T.prefix}_${arch.key}_${variantIdx}_${Math.random().toString(36).slice(2,5)}`; }
  usedIds.add(id);

  items.push({
    id, name,
    description: arch.theme,
    rarity: T.rarity, tier: T.enum,
    cost: costFor(tier),
    icon: arch.icon,
    unlocked: true,
    tags: arch.tags,
    slot: arch.slot,
    fields,
  });
}

// Generate: for each tier, roll through archetypes multiple times to reach the target.
// Target ~690 total → distribute by tier roughly matching existing shape (more T2/T3).
const perTier = { 1: 90, 2: 200, 3: 220, 4: 180 };
for (const tier of [1, 2, 3, 4]) {
  const target = perTier[tier];
  let made = 0;
  let round = 0;
  while (made < target) {
    for (const arch of ARCHES) {
      if (made >= target) break;
      pushItem(tier, arch, round, ARCHES.length);
      made++;
    }
    round++;
  }
}

// ---- emit TS single-line literals ----
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
    if (typeof v === 'boolean') parts.push(`${k}: ${v}`);
    else parts.push(`${k}: ${v}`);
  }
  return `    { ${parts.join(', ')} },`;
}

const header = `\n    // ==================== SOULSTONE EXPANSION (auto-generated content triple) ====================\n` +
  `    // ~${items.length} items adapting Soulstone Survivors active-skill mechanics into gear. Every\n` +
  `    // item pairs a real upside with a thematic bite (Brotato/Soulstone philosophy). Spans all four\n` +
  `    // tiers; uses the new reusable Slow/Chill status alongside burn/bleed/poison/doom/chain/wound.\n`;

const body = items.map(emit).join('\n');
writeFileSync('/tmp/expansion.ts', header + body + '\n');
console.log(`generated ${items.length} items`);
// tier breakdown
const byTier = {};
for (const it of items) byTier[it.tier] = (byTier[it.tier] || 0) + 1;
console.log(byTier);
