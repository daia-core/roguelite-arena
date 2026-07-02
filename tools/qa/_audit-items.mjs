import fs from 'node:fs';
const src = fs.readFileSync('/workspace/work/roguelite-game/frontend/src/ItemSystem.ts', 'utf8');
const start = src.indexOf('private static items: Item[] = [');
const end = src.indexOf('\n  ];', start);
const block = src.slice(start, end);
const objs = block.split(/\n    \{\n/).slice(1);
const fields = ['damageMultiplier','meleeDamageMult','rangedDamageMult','elementalDamageMult','fireRateMultiplier','critChance','critDamageMultiplier','speedMultiplier','lifesteal','dodge','armor','thorns','multishot','piercing','maxHealthBonus','healthRegen','goldBonus'];
const rows = [];
const seen = new Map();
for (const o of objs) {
  const idm = o.match(/id:\s*.([a-z0-9_]+)./);
  if (!idm) continue;
  const id = idm[1];
  seen.set(id, (seen.get(id) || 0) + 1);
  const tierM = o.match(/tier:\s*ItemTier\.(\w+)/);
  const costM = o.match(/cost:\s*(\d+)/);
  const rec = { id, tier: tierM ? tierM[1] : '?', cost: costM ? +costM[1] : 0 };
  for (const f of fields) {
    const fm = o.match(new RegExp('\\b' + f + ':\\s*(-?[0-9.]+)'));
    if (fm) rec[f] = parseFloat(fm[1]);
  }
  rows.push(rec);
}
console.log('=== DUPLICATE IDS ===');
for (const [id, n] of seen) if (n > 1) console.log('  DUP', id, 'x' + n);
console.log('\n=== ITEMS WITH STAT FIELDS ===');
for (const r of rows) {
  const keys = Object.keys(r).filter(k => !['id','tier','cost'].includes(k));
  if (keys.length) console.log(`${r.id.padEnd(24)} [${r.tier[0]}] ${keys.map(k => k + '=' + r[k]).join('  ')}`);
}
// Degenerate scan: dodge stacking to >=1, dmgMult combos, speed combos
console.log('\n=== POTENTIAL DEGENERATE STACKS (per-stat totals if you bought ALL copies of every item touching it) ===');
const addStats = ['critChance','lifesteal','dodge','armor','thorns','multishot','piercing','healthRegen','maxHealthBonus'];
for (const s of addStats) {
  const contributors = rows.filter(r => s in r);
  const total = contributors.reduce((a, r) => a + r[s], 0);
  if (contributors.length) console.log(`${s.padEnd(16)} sum-if-all=${total.toFixed(2)}  from ${contributors.map(r=>r.id+'('+r[s]+')').join(', ')}`);
}
const multStats = ['damageMultiplier','meleeDamageMult','rangedDamageMult','elementalDamageMult','fireRateMultiplier','critDamageMultiplier','speedMultiplier'];
for (const s of multStats) {
  const contributors = rows.filter(r => s in r);
  const prod = contributors.reduce((a, r) => a * r[s], 1);
  if (contributors.length) console.log(`${s.padEnd(20)} product-if-all=${prod.toFixed(2)}x  from ${contributors.map(r=>r.id+'('+r[s]+')').join(', ')}`);
}
