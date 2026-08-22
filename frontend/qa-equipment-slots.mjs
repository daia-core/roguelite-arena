#!/usr/bin/env node
// Headless QA for the equipment slot system (8-slot v2, 2026-07-05).
// Updated 2026-08-22 to match the current single-weapon-slot API:
//   weapon (1h OR 2h), offhand, head, amulet, torso, legs, feet, ring — each ≤ 1
//   two-hand weapon blocks the offhand (not a second weapon slot)
//   trinkets: unlimited stacking; same-ID adds trigger the upgrade path (upgradeLevel++)
//
// Proves the admission-control layer over PlayerStats.items[]:
//   1. slot limits           — one weapon max, offhand/amulet/gear slots ≤ 1 each
//   2. two-hand              — fills weapon slot, nulls offhand, displaces prior weapon+offhand
//   3. offhand vs 2h         — adding a shield while 2h equipped displaces the 2h first
//   4. auto-swap → stash     — a displaced occupant lands in the stash (not destroyed)
//   5. stash overflow → sell — past STASH_CAP, addItem returns `overflow` to refund
//   6. trinket unique-ID     — unique-ID trinkets all stack as separate active items
//   7. trinket upgrade path  — same-ID add → upgradeLevel++ on the existing instance
//   8. aggregation parity    — items[] == all non-null equip slots + trinkets
//   9. duo fanfare           — completing a duo returns newDuos (the double-updateDuos bug)
import path from 'node:path';
import fs from 'node:fs';
import * as esbuild from 'esbuild';

const GAME = '/workspace/work/roguelite-game/frontend';
const TMP = path.join(GAME, '.qa-tmp-equip');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(GAME, 'src/ItemSystem.ts'), path.join(GAME, 'src/DuoSystem.ts')],
  bundle: true, format: 'esm', splitting: true,
  outdir: TMP, logLevel: 'warning',
});
const { PlayerStats, ItemDatabase, ItemTier, classifyItemSlot } = await import(path.join(TMP, 'ItemSystem.js'));
const { DUO_COMBOS } = await import(path.join(TMP, 'DuoSystem.js'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ FAIL:', msg); } };

// Synthetic items: control every field so parity math is exact. `mh` = maxHealthBonus,
// a clean additive with no affinity/specialisation/random modifier → deterministic.
let uid = 0;
const mk = (over) => ({
  id: over.id ?? `syn_${uid++}`,
  name: over.name ?? 'Syn', description: '', rarity: 'common', tier: ItemTier.Common,
  cost: 10, icon: '❔', unlocked: true, tags: over.tags ?? ['utility'],
  ...over,
});
const weapon1h = (mh) => mk({ weaponType: 'shotgun', maxHealthBonus: mh });   // → weapon-1h
const weapon2h = (mh) => mk({ weaponType: 'melee', maxHealthBonus: mh });     // → weapon-2h
const shield   = (mh) => mk({ shield: true, maxHealthBonus: mh });            // → offhand
const amulet   = (mh) => mk({ slot: 'amulet', maxHealthBonus: mh });          // → amulet
const trinket  = (id, mh) => mk({ id, maxHealthBonus: mh });                  // → trinket

// Invariant: items[] must exactly equal all non-null equip-slot occupants + trinkets.
// This is the 8-slot v2 version (weapon, offhand, head, amulet, torso, legs, feet, ring).
const activeInvariant = (ps) => {
  const eq = ps.getEquipment();
  const equipSlots = [eq.weapon, eq.offhand, eq.head, eq.amulet,
                      eq.torso, eq.legs, eq.feet, eq.ring].filter(x => x);
  const expected = equipSlots.concat(ps.trinkets);
  const a = ps.items.map(i => i.id).sort();
  const b = expected.map(i => i.id).sort();
  return a.length === b.length && a.every((v, i) => v === b[i]);
};

// ---- classifier sanity ----
ok(classifyItemSlot(weapon1h(0)) === 'weapon-1h', 'shotgun → weapon-1h');
ok(classifyItemSlot(weapon2h(0)) === 'weapon-2h', 'melee → weapon-2h');
ok(classifyItemSlot(shield(0))   === 'offhand',   'shield → offhand');
ok(classifyItemSlot(amulet(0))   === 'amulet',    'slot:amulet → amulet');
ok(classifyItemSlot(trinket('t', 5)) === 'trinket', 'plain stat item → trinket');

// ---- 1 & 8: fill slots, parity, aggregation ----
{
  const ps = new PlayerStats();
  const W = weapon1h(10), O = shield(20), A = amulet(30);
  const T = [trinket('ta', 5), trinket('tb', 5), trinket('tc', 5)];
  ps.addItem(W); ps.addItem(O); ps.addItem(A); T.forEach(t => ps.addItem(t));
  ok(activeInvariant(ps), 'invariant holds after equipping W/O/A + 3 trinkets');
  // base 100 + 10+20+30 + 5*3 = 175
  ok(ps.getMaxHealth() === 175, `parity maxHealth == 175 (got ${ps.getMaxHealth()})`);
  ok(ps.getEquipment().weapon?.id === W.id, '1h weapon → weapon slot');
  ok(ps.getEquipment().offhand?.id === O.id, 'shield → offhand slot');
  ok(ps.getEquipment().amulet?.id === A.id, 'amulet → amulet slot');
}

// ---- 3 & 4: single weapon slot — swap/stash on second weapon ----
{
  const ps = new PlayerStats();
  const W = weapon1h(10), O = shield(20), A = amulet(30);
  ps.addItem(W); ps.addItem(O); ps.addItem(A);
  // Second 1h weapon: displaces W to stash, takes the weapon slot
  const W2 = weapon1h(100);
  const r = ps.addItem(W2);
  ok(ps.getEquipment().weapon?.id === W2.id, 'second 1h weapon displaces first → weapon slot');
  ok(r.displaced.some(d => d.id === W.id), 'displaced item is the old weapon (W)');
  ok(ps.getStash().some(s => s.id === W.id), 'displaced W landed in stash (not destroyed)');
  // lost W(10), gained W2(100): base 100 + 100 + 20 + 30 = 250
  ok(ps.getMaxHealth() === 250, `maxHealth 250 after weapon swap (got ${ps.getMaxHealth()})`);
  ok(activeInvariant(ps), 'invariant holds after weapon swap');
}

// ---- 2: two-hand fills weapon slot, blocks offhand, displaces prior weapon ----
{
  const ps = new PlayerStats();
  const W = weapon1h(10), O = shield(20);
  ps.addItem(W); ps.addItem(O);
  // Equip a two-hand weapon: displaces W to stash, nulls offhand
  const TH = weapon2h(7);
  const r = ps.addItem(TH);
  ok(ps.getEquipment().weapon?.id === TH.id, 'two-hand → weapon slot');
  ok(ps.hasTwoHandEquipped() === true, 'hasTwoHandEquipped true');
  ok(ps.getEquipment().offhand === null, 'two-hand blocks offhand (null)');
  ok(r.displaced.some(d => d.id === W.id), 'two-hand displaced prior 1h weapon to stash');
  ok(ps.getStash().some(s => s.id === O.id), 'two-hand displaced offhand to stash');
  // lost W(10)+O(20), gained TH(7): base 100 + 7 = 107
  ok(ps.getMaxHealth() === 107, `maxHealth 107 after two-hand (got ${ps.getMaxHealth()})`);
  ok(activeInvariant(ps), 'invariant holds after two-hand');
}

// ---- offhand vs two-hand: adding shield while 2h equipped displaces the 2h ----
{
  const ps = new PlayerStats();
  const TH = weapon2h(7);
  ps.addItem(TH);
  ok(ps.getEquipment().offhand === null, 'offhand blocked while 2h equipped');
  // Now add a shield: should displace TH to stash, shield goes to offhand
  const O = shield(15);
  const r = ps.addItem(O);
  ok(ps.getEquipment().weapon === null, 'weapon slot cleared when 2h displaced by shield add');
  ok(ps.getEquipment().offhand?.id === O.id, 'shield goes to offhand after displacing 2h');
  ok(r.displaced.some(d => d.id === TH.id), 'adding shield displaced 2h weapon to stash');
  // base 100 + 15 = 115
  ok(ps.getMaxHealth() === 115, `maxHealth 115 after shield displaces 2h (got ${ps.getMaxHealth()})`);
  ok(activeInvariant(ps), 'invariant holds after shield-displaces-2h');
}

// ---- 5: stash overflow → overflow returned for refund ----
{
  const ps = new PlayerStats();
  let overflowSeen = null;
  // Each new shield displaces the prior offhand into the stash. 1 equipped, then
  // STASH_CAP get stashed, then the next displacement overflows.
  for (let i = 0; i < PlayerStats.STASH_CAP + 3; i++) {
    const r = ps.addItem(shield(1));
    if (r.overflow) overflowSeen = r.overflow;
  }
  ok(ps.getStash().length === PlayerStats.STASH_CAP, `stash capped at ${PlayerStats.STASH_CAP} (got ${ps.getStash().length})`);
  ok(overflowSeen !== null, 'past STASH_CAP a displaced item is returned as overflow (caller sells it)');
  ok(activeInvariant(ps), 'invariant holds with full stash');
}

// ---- 6: trinket unique-ID stacking — each unique-ID trinket is a separate active item ----
{
  const ps = new PlayerStats();
  for (let i = 0; i < 50; i++) ps.addItem(trinket('tri_' + i, 2));
  ok(ps.trinkets.length === 50, `50 unique-ID trinkets all active (got ${ps.trinkets.length})`);
  ok(ps.items.filter(i => i.id.startsWith('tri_')).length === 50, 'all 50 unique-ID trinkets in items[]');
  ok(ps.getMaxHealth() === 100 + 50 * 2, `unique-ID trinket stack aggregates: 200 (got ${ps.getMaxHealth()})`);
  ok(activeInvariant(ps), 'invariant holds with 50 unique trinkets');
}

// ---- 7: trinket upgrade path — same-ID add bumps upgradeLevel, still contributes correctly ----
{
  const ps = new PlayerStats();
  for (let i = 0; i < 50; i++) ps.addItem(trinket('same_id', 2));
  // Upgrade path: 1 instance at level 50, contributing mh*50
  ok(ps.trinkets.length === 1, `50 same-ID adds → 1 upgraded instance (got ${ps.trinkets.length})`);
  ok(ps.trinkets[0].upgradeLevel === 50, `upgrade level === 50 (got ${ps.trinkets[0].upgradeLevel})`);
  ok(ps.getMaxHealth() === 100 + 2 * 50, `upgraded trinket scales by upgradeLevel: 200 (got ${ps.getMaxHealth()})`);
  ok(activeInvariant(ps), 'invariant holds with upgraded trinket');
}

// ---- 9: duo fanfare fires on the completing purchase (regression: double updateDuos) ----
{
  const combo = DUO_COMBOS.find(d => ItemDatabase.getItemById(d.item1Id) && ItemDatabase.getItemById(d.item2Id));
  if (!combo) { console.error('  ! no resolvable duo in catalog — skipping duo test'); }
  else {
    const ps = new PlayerStats();
    const first = ItemDatabase.getItemById(combo.item1Id);
    const second = ItemDatabase.getItemById(combo.item2Id);
    const r1 = ps.addItem(first);
    ok(!r1.newDuos.some(d => d.id === combo.id), 'owning half a duo does NOT yet fire it');
    const r2 = ps.addItem(second);
    ok(r2.newDuos.some(d => d.id === combo.id), `completing duo "${combo.name}" fires newDuos (fanfare works)`);
  }
}

console.log(`\nequipment-slot QA: ${pass} passed, ${fail} failed`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);
