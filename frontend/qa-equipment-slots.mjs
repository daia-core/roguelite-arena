#!/usr/bin/env node
// Headless QA for the 2026-07-05 equipment/slot rework (Felix's ask: gear is a
// limited build decision — 2 weapons OR 1 two-hand + offhand + amulet, everything
// else a freely-stacking trinket, displaced gear goes to a capped stash).
//
// Proves the admission-control layer over PlayerStats.items[]:
//   1. slot limits           — weapons never exceed 2 hands, offhand/amulet ≤ 1
//   2. two-hand              — fills weaponA, blocks weaponB, displaces both 1h weapons
//   3. auto-swap → stash     — a displaced occupant lands in the stash (not destroyed)
//   4. stash overflow → sell — past STASH_CAP, addItem returns `overflow` to refund
//   5. trinket stacking      — unlimited copies, all active
//   6. aggregation parity    — items[] == equipped-nonnull + trinkets, and a clean
//                              additive stat (getMaxHealth) exactly tracks the active set
//   7. duo fanfare           — completing a duo returns newDuos (the double-updateDuos bug)
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

// Invariant checked after every mutation: items[] is EXACTLY the non-null equipped
// slots followed by the trinkets (the single aggregation source of truth).
const activeInvariant = (ps) => {
  const eq = ps.getEquipment();
  const expected = [eq.weaponA, eq.weaponB, eq.offhand, eq.amulet].filter(x => x).concat(ps.trinkets);
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

// ---- 1 & 3 & 6: fill slots, no displacement, parity ----
{
  const ps = new PlayerStats();
  const W = weapon1h(10), O = shield(20), A = amulet(30);
  const T = [trinket('ta', 5), trinket('tb', 5), trinket('tc', 5)];
  ps.addItem(W); ps.addItem(O); ps.addItem(A); T.forEach(t => ps.addItem(t));
  ok(activeInvariant(ps), 'invariant holds after equipping W/O/A + 3 trinkets');
  // base 100 + 10+20+30 + 5*3 = 175
  ok(ps.getMaxHealth() === 175, `parity maxHealth == 175 (got ${ps.getMaxHealth()})`);
  ok(ps.getEquipment().weaponA?.id === W.id && ps.getEquipment().weaponB === null, 'one 1h weapon → weaponA only');

  // second 1h weapon fills weaponB
  const W2 = weapon1h(100);
  ps.addItem(W2);
  ok(ps.getEquipment().weaponB?.id === W2.id, 'second 1h weapon → weaponB');
  ok(ps.getMaxHealth() === 275, `maxHealth 275 with 2 weapons (got ${ps.getMaxHealth()})`);
  ok(activeInvariant(ps), 'invariant holds with 2 weapons');

  // 1: third 1h weapon — both hands full → weaponA displaced to stash, still only 2 weapons active
  const W3 = weapon1h(1000);
  const r = ps.addItem(W3);
  ok(ps.getEquipment().weaponA?.id === W3.id, 'third 1h weapon swaps into weaponA');
  ok(r.displaced.some(d => d.id === W.id), 'displaced item is the old weaponA (W)');
  ok(ps.getStash().some(s => s.id === W.id), 'displaced W landed in the stash (not destroyed)');
  const weaponCount = [ps.getEquipment().weaponA, ps.getEquipment().weaponB].filter(x => x).length;
  ok(weaponCount === 2, `never more than 2 weapons equipped (got ${weaponCount})`);
  // active lost W(10), gained W3(1000): 275 - 10 + 1000 = 1265
  ok(ps.getMaxHealth() === 1265, `maxHealth 1265 after swap (got ${ps.getMaxHealth()})`);
  ok(activeInvariant(ps), 'invariant holds after weapon swap');

  // ---- 2: two-hand fills A, blocks B, displaces BOTH one-hand weapons ----
  const TH = weapon2h(7);
  const r2 = ps.addItem(TH);
  ok(ps.getEquipment().weaponA?.id === TH.id, 'two-hand → weaponA');
  ok(ps.getEquipment().weaponB === null, 'two-hand blocks weaponB (null)');
  ok(ps.hasTwoHandEquipped() === true, 'hasTwoHandEquipped true');
  ok(r2.displaced.some(d => d.id === W3.id) && r2.displaced.some(d => d.id === W2.id),
     'two-hand displaced both prior 1h weapons to stash');
  // lost W3(1000)+W2(100), gained TH(7): 1265 - 1100 + 7 = 172
  ok(ps.getMaxHealth() === 172, `maxHealth 172 after two-hand (got ${ps.getMaxHealth()})`);
  ok(activeInvariant(ps), 'invariant holds after two-hand');
}

// ---- 4: stash overflow → overflow returned for refund ----
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

// ---- 5: trinket unlimited stacking ----
{
  const ps = new PlayerStats();
  for (let i = 0; i < 50; i++) ps.addItem(trinket('stack_me', 2));
  ok(ps.trinkets.length === 50, `50 trinket copies stack (got ${ps.trinkets.length})`);
  ok(ps.items.filter(i => i.id === 'stack_me').length === 50, 'all 50 trinket copies are active in items[]');
  ok(ps.getMaxHealth() === 100 + 50 * 2, `trinket stack aggregates (got ${ps.getMaxHealth()})`);
}

// ---- 7: duo fanfare fires on the completing purchase (regression: double updateDuos) ----
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
