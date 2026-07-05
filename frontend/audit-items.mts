// One-off audit: classify every catalog item and flag trinket-vs-equip candidates.
// Run: npx tsx audit-items.mts   (from frontend/)
import { ITEM_CATALOG } from './src/items/catalog';
import { classifyItemSlot, isTrinket, getItemKinds, itemStatLines, type Item } from './src/items/types';

const bySlot: Record<string, Item[]> = {};
for (const it of ITEM_CATALOG) {
  const s = classifyItemSlot(it);
  (bySlot[s] ??= []).push(it);
}

console.log(`TOTAL ITEMS: ${ITEM_CATALOG.length}\n`);
console.log('SLOT DISTRIBUTION:');
for (const [s, arr] of Object.entries(bySlot).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${s.padEnd(11)} ${arr.length}`);
}

// Heuristic: which TRINKETS look gear-like (pure passive stat piece that maps cleanly
// to head/torso/legs/feet/ring/amulet) and thus are CANDIDATES to be promoted to a slot.
// A trinket is "gear-like" if it is passive-only (no weapon/aux/active/proc/economy-engine
// mechanic) and its stat profile matches a slot archetype.
function fieldsUsed(it: Item): string[] {
  return Object.keys(it).filter(k => !['id','name','description','rarity','tier','cost','icon','unlocked','tags','slot','upgradeLevel'].includes(k) && (it as any)[k] !== undefined);
}

// mechanics that make an item genuinely trinket-appropriate (a build engine / weapon mod /
// economy / on-kill / triggered effect — not a plain wearable stat)
const TRINKET_MECHANICS = new Set([
  'weaponType','weaponRange','weaponArc','orbitOrbs','orbitDamageMult','auxMelee','auxMeleeDamageMult',
  'bombDrop','bombDamageMult','bombCooldownMult','novaPulse','novaDamageMult','novaCooldownMult',
  'swingDamageMult','swingRangeBonus','swingArcBonus','swingCooldownMult','swingAoe','aoeRadiusMult','meleeStyle',
  'piercing','explosionOnHit','chainLightning','multishot','projectileSpeed','knockback','homing','poison',
  'freeze','burn','bleed','poisonSpread','doom','wound','multicast',
  'rerollDiscount','shopDiscount','recycleBonus','interestBonus','goldBonus','luck',
  'waveRampDamage','lowHpPower','killStackDamage','highHpPower','goldScaleDamage','soulTithe','ceremonialDaggers',
  'loadedShot','warChest','executeThreshold','fourleafCharm','shield',
  'meleeDamageMult','rangedDamageMult','elementalDamageMult','lifesteal','thorns',
]);

// plain wearable stats (would sit fine in an armor/accessory slot)
const WEARABLE_STATS = new Set([
  'damageMultiplier','fireRateMultiplier','critChance','critDamageMultiplier','speedMultiplier',
  'maxHealthBonus','healthRegen','armor','dodge','xpMagnet',
]);

console.log('\n=== TRINKETS THAT LOOK GEAR-LIKE (promotion candidates) ===');
console.log('(passive stat pieces with NO trinket-defining mechanic)\n');
const candidates: {it: Item; fields: string[]; suggest: string}[] = [];
for (const it of bySlot['trinket'] ?? []) {
  const f = fieldsUsed(it);
  const hasTrinketMech = f.some(k => TRINKET_MECHANICS.has(k));
  const allWearable = f.length > 0 && f.every(k => WEARABLE_STATS.has(k));
  if (!hasTrinketMech && allWearable) {
    // suggest a slot from the dominant stat
    let suggest = 'ring/amulet';
    if (f.includes('maxHealthBonus') || f.includes('armor') || f.includes('healthRegen')) suggest = 'torso/head';
    else if (f.includes('speedMultiplier') || f.includes('dodge')) suggest = 'feet/legs';
    else if (f.includes('xpMagnet')) suggest = 'feet/head';
    else if (f.includes('critChance') || f.includes('critDamageMultiplier')) suggest = 'head/ring';
    candidates.push({ it, fields: f, suggest });
  }
}
for (const c of candidates) {
  console.log(`  [${c.it.rarity.padEnd(9)}] ${c.it.name.padEnd(22)} {${c.fields.join(', ')}}  -> ${c.suggest}`);
}
console.log(`\n  ${candidates.length} promotion candidates out of ${(bySlot['trinket']??[]).length} trinkets.`);

console.log('\n=== ALL TRINKETS (for the full manual pass) ===\n');
for (const it of bySlot['trinket'] ?? []) {
  const f = fieldsUsed(it);
  const kinds = getItemKinds(it).join('+');
  console.log(`  ${it.id.padEnd(26)} ${it.name.padEnd(24)} [${kinds}] {${f.join(', ')}}`);
}
