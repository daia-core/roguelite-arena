#!/usr/bin/env node
// QA: Overflow Battery — highHpFireRate mechanic.
//
// Verifies (on the SHIPPED frontend/dist) that the highHpFireRate stat:
//   1. overflow_battery_t2 and pristine_engine_t3 exist in the catalog with the
//      expected highHpFireRate (and highHpPower for the combo) values.
//   2. getHighHpFireRate() returns the sum of all items' highHpFireRate.
//   3. At/above 90% HP the fire-rate multiplier is boosted by the expected fraction.
//   4. When damaged below 90% HP the fire-rate multiplier returns to baseline.
//   5. pristine_engine_t3 gives BOTH fire rate AND damage bonus at full HP.
//   6. No console/page errors throughout.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');

console.log('Building frontend (npm run build)...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = {
  '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.svg':'image/svg+xml', '.png':'image/png', '.mp3':'audio/mpeg', '.css':'text/css',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };

  const out = {};
  const near = (a, b, eps = 1e-5) => Math.abs(a - b) < eps;

  const giveItem = (id) => {
    const item = DB.getItemById(id);
    if (!item) return false;
    g.playerStats.addItem(item); // addItem clones internally — catalog is not mutated
    return true;
  };
  const fresh = () => {
    g.startNewGame();
    g.waveManager.reset();
    g.waveManager.startWave(1);
    g.state = 'playing';
  };
  const step = (n = 1) => { for (let i = 0; i < n; i++) g.update(1/60); };
  const dMult = () => g.playerStats.runtimeDamageMult;
  const frMult = () => g.playerStats.runtimeFireRateMult;

  // --- 1. Catalog presence ---
  const bat = DB.getItemById('overflow_battery_t2');
  const eng = DB.getItemById('pristine_engine_t3');
  out.catalogBattery = !!bat && bat.highHpFireRate === 0.35;
  out.catalogEngine  = !!eng && eng.highHpFireRate === 0.55 && eng.highHpPower === 0.25;

  // --- 2. getHighHpFireRate() aggregates correctly ---
  fresh();
  giveItem('overflow_battery_t2');
  out.getterSingle = near(g.playerStats.getHighHpFireRate(), 0.35);
  giveItem('overflow_battery_t2');   // second copy → should sum to 0.70
  out.getterDouble = near(g.playerStats.getHighHpFireRate(), 0.70);

  // --- 3. Fire rate bonus at full HP (overflow_battery_t2, single copy) ---
  fresh(); giveItem('overflow_battery_t2');
  g.player.health = g.player.maxHealth;        // full HP → threshold satisfied
  step();
  out.batteryFullHpFr = near(frMult(), 1.35);
  out.batteryFullHpDm = near(dMult(), 1.0);    // damage should be unaffected

  // --- 4. No bonus when below 90% HP ---
  g.player.health = g.player.maxHealth * 0.89;  // just below threshold
  step();
  out.batteryHurtFr = near(frMult(), 1.0);

  // --- 5. Combo item: pristine_engine_t3 — full HP gives BOTH bonuses ---
  fresh(); giveItem('pristine_engine_t3');
  g.player.health = g.player.maxHealth;
  step();
  out.engineFullFr = near(frMult(), 1.55);
  out.engineFullDm = near(dMult(), 1.25);

  // --- 6. Combo item: BOTH bonuses drop when hurt ---
  g.player.health = g.player.maxHealth * 0.80;
  step();
  out.engineHurtFr = near(frMult(), 1.0);
  out.engineHurtDm = near(dMult(), 1.0);

  // --- 7. Control: no item → runtime mults stay identity ---
  fresh();
  step();
  out.noItemFr = near(frMult(), 1.0);
  out.noItemDm = near(dMult(), 1.0);

  return out;
});

await browser.close();
server.close();

console.log('\n=== Overflow Battery — highHpFireRate mechanic ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const checks = [
  'catalogBattery', 'catalogEngine',
  'getterSingle', 'getterDouble',
  'batteryFullHpFr', 'batteryFullHpDm',
  'batteryHurtFr',
  'engineFullFr', 'engineFullDm',
  'engineHurtFr', 'engineHurtDm',
  'noItemFr', 'noItemDm',
];
const pass = result && !result.fatal
  && checks.every(k => result[k] === true)
  && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
