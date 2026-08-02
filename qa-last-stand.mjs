#!/usr/bin/env node
// QA: Last Stand — lowHpPower mechanic.
//
// Verifies (on the SHIPPED frontend/dist) that the lowHpPower stat:
//   1. last_stand_t2 exists in the catalog with the expected lowHpPower value.
//   2. berserker_drive_t3 exists with its expected lowHpPower value.
//   3. getLowHpPower() aggregates both items correctly.
//   4. At/under 35% HP (LOW_HP_THRESHOLD) BOTH runtimeDamageMult AND runtimeFireRateMult
//      are boosted by the lowHpPower fraction (the "danger power" spike).
//   5. Above the threshold, neither mult is boosted.
//   6. Control: no item → runtime mults stay identity.
//   7. No console/page errors throughout.
//
// This mirrors qa-overflow-battery.mjs (highHpFireRate coverage) for the low-HP family.
// Added 2026-08-02 after the 35% HP threshold tick mark shipped without runtime coverage.

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
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.css': 'text/css',
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
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
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
    g.playerStats.addItem(item);
    return true;
  };
  const fresh = () => {
    g.startNewGame();
    g.waveManager.reset();
    g.waveManager.startWave(1);
    g.state = 'playing';
  };
  const step = (n = 1) => { for (let i = 0; i < n; i++) g.update(1 / 60); };
  const dMult = () => g.playerStats.runtimeDamageMult;
  const frMult = () => g.playerStats.runtimeFireRateMult;

  // --- 1. Catalog presence ---
  const ls = DB.getItemById('last_stand_t2');
  const bd = DB.getItemById('berserker_drive_t3');
  out.catalogLastStand = !!ls && near(ls.lowHpPower, 0.40);
  out.catalogBerserkerDrive = !!bd && near(bd.lowHpPower, 0.60);

  // --- 2. getLowHpPower() aggregates correctly ---
  fresh();
  giveItem('last_stand_t2');
  out.getterSingle = near(g.playerStats.getLowHpPower(), 0.40);
  giveItem('berserker_drive_t3');  // second item → should sum to 1.00
  out.getterCombo = near(g.playerStats.getLowHpPower(), 1.00);

  // --- 3. Both mults boosted at low HP (≤35%) ---
  fresh();
  giveItem('last_stand_t2');
  g.player.health = Math.floor(g.player.maxHealth * 0.35); // exactly at threshold
  step();
  out.lowHpDm = near(dMult(), 1.40);  // 1 + 0.40
  out.lowHpFr = near(frMult(), 1.40); // same fraction applied to both axes

  // --- 4. No bonus when above threshold ---
  g.player.health = Math.ceil(g.player.maxHealth * 0.36); // just above threshold
  step();
  out.safeHpDm = near(dMult(), 1.0);
  out.safeHpFr = near(frMult(), 1.0);

  // --- 5. Full HP → no bonus ---
  g.player.health = g.player.maxHealth;
  step();
  out.fullHpDm = near(dMult(), 1.0);
  out.fullHpFr = near(frMult(), 1.0);

  // --- 6. Control: no item → identity mults ---
  fresh();
  step();
  out.noItemDm = near(dMult(), 1.0);
  out.noItemFr = near(frMult(), 1.0);

  return out;
});

await browser.close();
server.close();

console.log('\n=== Last Stand — lowHpPower mechanic ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const checks = [
  'catalogLastStand', 'catalogBerserkerDrive',
  'getterSingle', 'getterCombo',
  'lowHpDm', 'lowHpFr',
  'safeHpDm', 'safeHpFr',
  'fullHpDm', 'fullHpFr',
  'noItemDm', 'noItemFr',
];
const pass = result && !result.fatal
  && checks.every(k => result[k] === true)
  && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
