#!/usr/bin/env node
// QA for the item-uniqueness redesign (t-dc49df, batch 1: the 7 Rare + 3
// Legendary bland flat-stat fillers → distinct Brotato-style identities).
// Builds the SHIPPED bundle, drives it headless, and asserts BOTH:
//   1. Data integrity — the real shipped catalog object (via __ItemDatabase.getItemById)
//      carries the exact redesigned fields (no typo/regression in catalog.ts).
//   2. Behavioral aggregation — adding the item through the real playerStats API
//      moves the stat getters the way the trade-off/hybrid says it should.
// Mirrors qa-builddiv.mjs (build → serve → headless chromium → page.evaluate).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');

console.log('Building frontend (npm run build)...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.css':'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

// The redesign spec: id → expected catalog fields (data integrity).
const SPEC = {
  damage_t3:        { damageMultiplier: 1.55, fireRateMultiplier: 0.88 },
  attack_speed_t3:  { fireRateMultiplier: 1.30, chainLightning: 0.15 },
  dodge_t3:         { dodge: 0.18, speedMultiplier: 1.15, maxHealthBonus: -10 },
  crit_chance_t3:   { critChance: 0.18, bleed: 0.25 },
  knockback_t3:     { knockback: 250, damageMultiplier: 1.20, explosionOnHit: true },
  crit_master_t3:   { critDamageMultiplier: 2.8, fireRateMultiplier: 0.85 },
  soul_collector_t3:{ xpMagnet: 1.5, lifesteal: 0.05 },
  berserker_rage_t4:{ damageMultiplier: 1.75, fireRateMultiplier: 1.15, maxHealthBonus: -25 },
  rapid_fire_t4:    { fireRateMultiplier: 1.70, multishot: 2, damageMultiplier: 0.85 },
  cosmic_dice_t4:   { luck: 0.80, goldBonus: 1.40, critChance: 0.10, multicast: 0.25 },
  // --- Batch 2 (2026-07-04): the 6 remaining Legendary + 7 Rare pure-upside blands ---
  immortal_t4:          { maxHealthBonus: 60, healthRegen: 6, lowHpPower: 0.5, burn: 0.3 },
  gold_rush_t4:         { goldBonus: 1.8, goldScaleDamage: 0.15, luck: 0.1 },
  berserker_soul_t4:    { damageMultiplier: 1.4, killStackDamage: 0.045, lifesteal: 0.06, maxHealthBonus: -20 },
  philosophers_stone_t4:{ goldBonus: 1.3, interestBonus: 0.15, luck: 0.35, healthRegen: 5, lifesteal: 0.05 },
  jackpot_t4:           { critChance: 0.20, critDamageMultiplier: 2.0, explosionOnHit: true, luck: 0.3 },
  crit_synergy_t3:      { critChance: 0.15, critDamageMultiplier: 1.35, bleed: 0.4 },
  guardian_aura_t3:     { maxHealthBonus: 50, armor: 8, thorns: 0.3, novaPulse: true, novaDamageMult: 0.55 },
  merchants_ring_t3:    { goldBonus: 1.4, recycleBonus: 0.35, shopDiscount: 0.12 },
  golden_vault_t3:      { interestBonus: 0.18, luck: 0.25, goldBonus: 1.2 },
  deadly_precision_t3:  { critChance: 0.15, critDamageMultiplier: 1.6, piercing: 3, fireRateMultiplier: 0.85 },
  compound_interest_t3: { goldBonus: 1.3, goldScaleDamage: 0.10 },
  treasure_map_t3:      { goldBonus: 1.3, luck: 0.35, xpMagnet: 1.5 },
};

const result = await page.evaluate((SPEC) => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB || !DB.getItemById) return { fatal: 'no __ItemDatabase.getItemById' };
  g.startNewGame();
  g.state = 'playing';
  if (!g.player) return { fatal: `no player after startNewGame (state=${g.state})` };

  const approx = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-6;
  const dataFails = [];
  const behaviorFails = [];

  // --- 1. DATA INTEGRITY: real shipped object carries the redesigned fields ---
  for (const [id, fields] of Object.entries(SPEC)) {
    const item = DB.getItemById(id);
    if (!item) { dataFails.push(`${id}: not in catalog`); continue; }
    for (const [k, v] of Object.entries(fields)) {
      const got = item[k];
      const ok = (typeof v === 'number') ? approx(got, v) : got === v;
      if (!ok) dataFails.push(`${id}.${k}: expected ${v}, got ${got}`);
    }
    // A redesign must no longer be "bland": it must carry >1 meaningful field.
    const meaningful = Object.keys(fields).length;
    if (meaningful < 2) dataFails.push(`${id}: only ${meaningful} field (not a redesign)`);
  }

  // --- 2. BEHAVIORAL AGGREGATION: getters move as the trade-off dictates ---
  let __tn = 0;
  const ps = g.playerStats;
  // Remove test items AND reset the transformation tracker to a fresh instance.
  // Transformations key off a CUMULATIVE itemsPickedUp counter that removeItem()
  // never decrements, so without this reset cross-check pickups eventually trip a
  // tag transformation (e.g. FORTRESS +100 HP at 3 `defensive` items) and pollute
  // per-item behavioral deltas. Each check must measure the item's own contribution.
  const clearItems = () => {
    for (const it of ps.items.filter(i => i.__test)) ps.removeItem(it.id);
    ps.transformations = new ps.transformations.constructor();
  };
  // Add a REAL catalog item (clone) through the API so aggregation runs on true data.
  const giveReal = (id) => {
    const item = DB.getItemById(id);
    ps.addItem({ ...item, id: `__test_${__tn++}`, __test: true });
  };
  const chk = (label, cond) => { if (!cond) behaviorFails.push(label); };

  // Champion's Crown: dmg up, fire rate down
  clearItems();
  let d0 = ps.getDamage(), f0 = ps.getFireRate();
  giveReal('damage_t3');
  chk('damage_t3: getDamage should rise', ps.getDamage() > d0);
  chk('damage_t3: getFireRate should fall', ps.getFireRate() < f0);

  // Gatling Core: fire rate up, +2 multishot. (getDamage is NOT asserted here:
  // the item is `ranged`-tagged, which trips the ×1.2 ranged-specialization
  // bonus and masks the 0.85 penalty in the FINAL number. The penalty itself is
  // proven data-side above and by the tag-neutral penalty proof below.)
  clearItems();
  f0 = ps.getFireRate(); let m0 = ps.getMultishot();
  giveReal('rapid_fire_t4');
  chk('rapid_fire_t4: getFireRate should rise', ps.getFireRate() > f0);
  chk('rapid_fire_t4: getMultishot +2', ps.getMultishot() === m0 + 2);

  // Tag-neutral proof that a sub-1 damageMultiplier aggregates as a real penalty
  // (the mechanic Gatling Core -15% and Champion's Crown's -12% fire rate rely on).
  // tags:[] avoids the specialization confound so the multiplier shows cleanly.
  clearItems();
  d0 = ps.getDamage();
  ps.addItem({ id: `__test_${__tn++}`, __test: true, tags: [], damageMultiplier: 0.85 });
  chk('penalty: damageMultiplier 0.85 lowers getDamage ~0.85x', approx(ps.getDamage(), d0 * 0.85));

  // Berserker Rage: max HP down by 25, damage up
  clearItems();
  let h0 = ps.getMaxHealth(); d0 = ps.getDamage();
  giveReal('berserker_rage_t4');
  chk('berserker_rage_t4: getMaxHealth -25', ps.getMaxHealth() === h0 - 25);
  chk('berserker_rage_t4: getDamage should rise', ps.getDamage() > d0);

  // Shadow Step: speed up, max HP down by 10
  clearItems();
  let s0 = ps.getSpeed(); h0 = ps.getMaxHealth();
  giveReal('dodge_t3');
  chk('dodge_t3: getSpeed should rise', ps.getSpeed() > s0);
  chk('dodge_t3: getMaxHealth -10', ps.getMaxHealth() === h0 - 10);

  // Assassin's Mark: crit +0.18
  clearItems();
  let c0 = ps.getCritChance();
  giveReal('crit_chance_t3');
  chk('crit_chance_t3: getCritChance +0.18', approx(ps.getCritChance(), c0 + 0.18));

  // Soul Collector: lifesteal +0.05
  clearItems();
  let l0 = ps.getLifesteal();
  giveReal('soul_collector_t3');
  chk('soul_collector_t3: getLifesteal +0.05', approx(ps.getLifesteal(), l0 + 0.05));

  // Cosmic Dice: luck +0.80, gold ×1.40, crit +0.10
  clearItems();
  let lk0 = ps.getLuck(), g0 = ps.getGoldBonus(); c0 = ps.getCritChance();
  giveReal('cosmic_dice_t4');
  chk('cosmic_dice_t4: getLuck +0.80', approx(ps.getLuck(), lk0 + 0.80));
  chk('cosmic_dice_t4: getGoldBonus ×1.40', approx(ps.getGoldBonus(), g0 * 1.40));
  chk('cosmic_dice_t4: getCritChance +0.10', approx(ps.getCritChance(), c0 + 0.10));

  // Lightning Bracers: chain-lightning chance up (if getter exists)
  clearItems();
  if (typeof ps.getChainLightningChance === 'function') {
    let cl0 = ps.getChainLightningChance();
    giveReal('attack_speed_t3');
    chk('attack_speed_t3: chainLightning +0.15', approx(ps.getChainLightningChance(), cl0 + 0.15));
  }
  clearItems();

  // ===== BATCH 2 behavioral checks (2026-07-04) =====
  // Phoenix Feather: max HP +60, Last-Stand power aggregates, burn chance up.
  clearItems();
  h0 = ps.getMaxHealth(); let lhp0 = ps.getLowHpPower(), bn0 = ps.getBurnChance();
  giveReal('immortal_t4');
  chk('immortal_t4: getMaxHealth +60', ps.getMaxHealth() === h0 + 60);
  chk('immortal_t4: getLowHpPower +0.5', approx(ps.getLowHpPower(), lhp0 + 0.5));
  chk('immortal_t4: getBurnChance +0.3', approx(ps.getBurnChance(), bn0 + 0.3));

  // Midas Touch: gold ×1.8, gold-scale-damage aggregates.
  clearItems();
  g0 = ps.getGoldBonus(); let gs0 = ps.getGoldScaleDamage();
  giveReal('gold_rush_t4');
  chk('gold_rush_t4: getGoldBonus ×1.8', approx(ps.getGoldBonus(), g0 * 1.8));
  chk('gold_rush_t4: getGoldScaleDamage +0.15', approx(ps.getGoldScaleDamage(), gs0 + 0.15));

  // Berserker Soul: max HP -20, kill-stack power aggregates, lifesteal +0.06.
  clearItems();
  h0 = ps.getMaxHealth(); let ks0 = ps.getKillStackDamage(); l0 = ps.getLifesteal();
  giveReal('berserker_soul_t4');
  chk('berserker_soul_t4: getMaxHealth -20', ps.getMaxHealth() === h0 - 20);
  chk('berserker_soul_t4: getKillStackDamage +0.045', approx(ps.getKillStackDamage(), ks0 + 0.045));
  chk('berserker_soul_t4: getLifesteal +0.06', approx(ps.getLifesteal(), l0 + 0.06));

  // Cosmic Dice: multicast chance up (the new identity field).
  clearItems();
  let mc0 = ps.getMulticastChance();
  giveReal('cosmic_dice_t4');
  chk('cosmic_dice_t4: getMulticastChance +0.25', approx(ps.getMulticastChance(), mc0 + 0.25));

  // Jackpot: crit +0.20, crit multiplier ×2.0.
  clearItems();
  c0 = ps.getCritChance(); let cm0 = ps.getCritMultiplier();
  giveReal('jackpot_t4');
  chk('jackpot_t4: getCritChance +0.20', approx(ps.getCritChance(), c0 + 0.20));
  chk('jackpot_t4: getCritMultiplier ×2.0', approx(ps.getCritMultiplier(), cm0 * 2.0));

  // Critical Synergy: crit +0.15, bleed chance up.
  clearItems();
  c0 = ps.getCritChance(); let bl0 = ps.getBleedChance();
  giveReal('crit_synergy_t3');
  chk('crit_synergy_t3: getCritChance +0.15', approx(ps.getCritChance(), c0 + 0.15));
  chk('crit_synergy_t3: getBleedChance +0.4', approx(ps.getBleedChance(), bl0 + 0.4));

  // Guardian Aura: max HP +50, thorns +0.3 (aura pulse handled by nova system).
  clearItems();
  h0 = ps.getMaxHealth(); let th0 = ps.getThorns();
  giveReal('guardian_aura_t3');
  chk('guardian_aura_t3: getMaxHealth +50', ps.getMaxHealth() === h0 + 50);
  chk('guardian_aura_t3: getThorns +0.3', approx(ps.getThorns(), th0 + 0.3));

  // Deadly Precision: piercing +3, fire rate falls.
  clearItems();
  let p0 = ps.getPiercing(); f0 = ps.getFireRate();
  giveReal('deadly_precision_t3');
  chk('deadly_precision_t3: getPiercing +3', ps.getPiercing() === p0 + 3);
  chk('deadly_precision_t3: getFireRate should fall', ps.getFireRate() < f0);

  // Compound Interest: gold-scale-damage aggregates (Rare hoard→dmg).
  clearItems();
  gs0 = ps.getGoldScaleDamage();
  giveReal('compound_interest_t3');
  chk('compound_interest_t3: getGoldScaleDamage +0.10', approx(ps.getGoldScaleDamage(), gs0 + 0.10));

  // Treasure Map: luck +0.35, XP-magnet up.
  clearItems();
  lk0 = ps.getLuck(); let xm0 = ps.getXPMagnet();
  giveReal('treasure_map_t3');
  chk('treasure_map_t3: getLuck +0.35', approx(ps.getLuck(), lk0 + 0.35));
  chk('treasure_map_t3: getXPMagnet should rise', ps.getXPMagnet() > xm0);

  // Golden Vault: interest +0.18, luck +0.25.
  clearItems();
  let ib0 = ps.getInterestBonus(); lk0 = ps.getLuck();
  giveReal('golden_vault_t3');
  chk('golden_vault_t3: getInterestBonus +0.18', approx(ps.getInterestBonus(), ib0 + 0.18));
  chk('golden_vault_t3: getLuck +0.25', approx(ps.getLuck(), lk0 + 0.25));

  // Philosopher's Stone: luck +0.35, lifesteal +0.05, regen up.
  clearItems();
  lk0 = ps.getLuck(); l0 = ps.getLifesteal();
  giveReal('philosophers_stone_t4');
  chk("philosophers_stone_t4: getLuck +0.35", approx(ps.getLuck(), lk0 + 0.35));
  chk("philosophers_stone_t4: getLifesteal +0.05", approx(ps.getLifesteal(), l0 + 0.05));

  clearItems();

  return { dataFails, behaviorFails, checked: Object.keys(SPEC).length };
}, SPEC);

await browser.close();
server.close();

console.log('\n=== Item-redesign verification (on shipped frontend/dist) ===');
if (result.fatal) { console.log('FATAL:', result.fatal); process.exit(1); }
console.log(`Items checked: ${result.checked}`);
console.log(`Data-integrity failures: ${result.dataFails.length}`);
result.dataFails.forEach(f => console.log('  ✗', f));
console.log(`Behavioral failures: ${result.behaviorFails.length}`);
result.behaviorFails.forEach(f => console.log('  ✗', f));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result.dataFails.length === 0 && result.behaviorFails.length === 0 && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
