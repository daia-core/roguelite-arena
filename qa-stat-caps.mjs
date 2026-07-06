#!/usr/bin/env node
// STAT-CAP + OFFER-FILTER test. Proves Felix's balancing request:
//  1) Quality-of-life / economy stats enemies DON'T scale against are hard-capped
//     (gold ×10, xp-magnet ×10, dodge 75%).
//  2) Combat stats enemies DO scale against stay UNCAPPED for balance — a runaway
//     build still multiplies far past the QoL cap — but are numerically sane
//     (finite, ≤ 1e15) so no stat ever reads Infinity/NaN.
//  3) Once a capped stat is maxed, items whose ONLY effect is that stat are no
//     longer offered in the shop; items with an uncapped effect still are; and
//     passing no stats leaves the old (unfiltered) behaviour intact.
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
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };

  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  const stack = (s, id, n) => { const it = DB.getItemById(id); for (let k = 0; k < n; k++) s.addItem(it); };

  const PS = g.playerStats.constructor;
  const GOLD = PS.GOLD_MULT_CAP, XPM = PS.XP_MAGNET_CAP, DODGE = PS.DODGE_CAP, SANE = PS.SANITY_MULT_CAP;

  // ---- A) Economy / QoL stats are hard-capped ----
  {
    g.startNewGame();
    const s = g.playerStats;
    stack(s, 'gold_bonus_t2', 40);   // 1.25^40 ≈ 7.5e3  → must clamp to GOLD
    stack(s, 'xp_magnet_t1', 40);    // 1.30^40 ≈ 3.6e4  → must clamp to XPM
    stack(s, 'dodge_t2', 40);        // +0.08×40 = 3.2    → must clamp to DODGE
    ok('gold capped', s.getGoldBonus() === GOLD, `gold=${s.getGoldBonus()} cap=${GOLD}`);
    ok('xp-magnet capped', s.getXPMagnet() === XPM, `xpm=${s.getXPMagnet()} cap=${XPM}`);
    ok('dodge capped', s.getDodgeChance() === DODGE, `dodge=${s.getDodgeChance()} cap=${DODGE}`);
  }

  // ---- B) Combat stats: uncapped for balance, but numerically sane ----
  {
    g.startNewGame();
    const s = g.playerStats;
    // Moderate build: must scale FAR past the QoL cap (proves combat isn't balance-capped).
    stack(s, 'damage_t1', 30); // 1.15^30 ≈ 66×
    const dMod = s.getDamage();
    ok('combat scales past QoL cap', dMod > GOLD * s.baseDamage, `dmg=${dMod} > ${GOLD}×base(${s.baseDamage})`);
    ok('combat finite (moderate)', finite(dMod), `dmg=${dMod}`);

    // Extreme build: raw product overflows past the sanity ceiling → must clamp, never Infinity.
    stack(s, 'damage_t1', 400); // pushes 1.15^430 ≈ 1e26 → clamps to SANE
    const dExt = s.getDamage();
    ok('extreme damage finite (no Infinity/NaN)', finite(dExt), `dmg=${dExt}`);
    ok('extreme damage clamped to sanity ceiling', dExt <= SANE, `dmg=${dExt} ceil=${SANE}`);
    ok('fire rate finite', finite(s.getFireRate()), `fr=${s.getFireRate()}`);
    ok('crit mult finite', finite(s.getCritMultiplier()), `cm=${s.getCritMultiplier()}`);
    ok('melee mult finite', finite(s.getMeleeDamageMult()), `m=${s.getMeleeDamageMult()}`);
    ok('ranged mult finite', finite(s.getRangedDamageMult()), `r=${s.getRangedDamageMult()}`);
    ok('elemental mult finite', finite(s.getElementalDamageMult()), `e=${s.getElementalDamageMult()}`);
  }

  // ---- C) Offer filter: maxed capped-stat items disappear from the shop ----
  {
    g.startNewGame();
    const s = g.playerStats;
    const dodgeItem = DB.getItemById('dodge_t2');
    const goldItem = DB.getItemById('gold_bonus_t2');
    const dmgItem = DB.getItemById('damage_t1');

    // Below cap → a pure-dodge item is NOT considered fully capped.
    ok('pure-dodge NOT capped below max', s.isItemFullyCapped(dodgeItem) === false, `dodge=${s.getDodgeChance()}`);

    // Drive dodge to its cap, then the pure-dodge item is fully capped, but a
    // pure-damage item (uncapped stat) never is.
    stack(s, 'dodge_t2', 40);
    ok('pure-dodge fully capped at max', s.isItemFullyCapped(dodgeItem) === true, `dodge=${s.getDodgeChance()}`);
    ok('pure-damage never fully capped', s.isItemFullyCapped(dmgItem) === false, 'combat item');

    // Also cap gold, then the pure-gold item is filtered too.
    stack(s, 'gold_bonus_t2', 40);
    ok('pure-gold fully capped at max', s.isItemFullyCapped(goldItem) === true, `gold=${s.getGoldBonus()}`);

    // Draw the shop many times WITH stats → capped items must never appear;
    // an uncapped combat item still can.
    let sawDodge = 0, sawGold = 0, sawDamage = 0, totalOffers = 0;
    for (let d = 0; d < 300; d++) {
      const offers = DB.getWeightedShopItems(6, 15, s.items, s.getLuck(), s);
      totalOffers += offers.length;
      for (const o of offers) {
        if (o.id === 'dodge_t2') sawDodge++;
        if (o.id === 'gold_bonus_t2') sawGold++;
        if (o.id === 'damage_t1') sawDamage++;
      }
    }
    ok('capped dodge item never offered (with stats)', sawDodge === 0, `sawDodge=${sawDodge}/${totalOffers}`);
    ok('capped gold item never offered (with stats)', sawGold === 0, `sawGold=${sawGold}/${totalOffers}`);
    ok('uncapped damage item still offered', sawDamage > 0, `sawDamage=${sawDamage}/${totalOffers}`);

    // Without stats → old behaviour, capped item can still appear (filter is opt-in).
    let sawDodgeNoStats = 0;
    for (let d = 0; d < 300; d++) {
      const offers = DB.getWeightedShopItems(6, 15, s.items, s.getLuck());
      for (const o of offers) if (o.id === 'dodge_t2') sawDodgeNoStats++;
    }
    ok('filter is opt-in (no stats → dodge can appear)', sawDodgeNoStats > 0, `sawDodgeNoStats=${sawDodgeNoStats}`);
  }

  return { checks };
});

await browser.close();
server.close();

console.log('\n=== Stat caps + offer filter (shipped frontend/dist) ===');
let pass = result && !result.fatal && errors.length === 0;
if (result.fatal) { console.log('FATAL:', result.fatal); }
else {
  for (const c of result.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  — ${c.detail}`);
    if (!c.pass) pass = false;
  }
}
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
