#!/usr/bin/env node
// QA: Harvest Momentum — on-kill fire rate stacks (harvestMomentum mechanic).
//
// Verifies (on the SHIPPED frontend/dist) that:
//   1. blood_rush_t2 exists with harvestMomentum: 0.10
//   2. blood_frenzy_t3 exists with harvestMomentum: 0.15
//   3. getHarvestMomentum() aggregates correctly across copies
//   4. When stacks are live (timer > 0), runtimeFireRateMult is boosted by harvestMomentum × stacks
//   5. When timer expires (≤ 0), stacks clear and frMult returns to identity
//   6. Control: no item → fire rate unaffected regardless of stacks
//   7. No console/page errors throughout.

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
  const near = (a, b, eps = 1e-4) => Math.abs(a - b) < eps;

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
  const frMult = () => g.playerStats.runtimeFireRateMult;

  // --- 1. Catalog presence ---
  const br = DB.getItemById('blood_rush_t2');
  const bf = DB.getItemById('blood_frenzy_t3');
  out.catalogBloodRush = !!br && near(br.harvestMomentum, 0.10);
  out.catalogBloodFrenzy = !!bf && near(bf.harvestMomentum, 0.15);

  // --- 2. getHarvestMomentum() aggregates correctly ---
  fresh();
  giveItem('blood_rush_t2');
  out.getterSingle = near(g.playerStats.getHarvestMomentum(), 0.10);
  giveItem('blood_frenzy_t3');  // two items → sum to 0.25
  out.getterCombo = near(g.playerStats.getHarvestMomentum(), 0.25);

  // --- 3. Live stacks → fire rate boosted ---
  // TypeScript private fields are runtime-accessible in JS — we inject state directly
  // to avoid needing an actual enemy-kill pathway in headless mode.
  fresh();
  giveItem('blood_rush_t2');
  g.harvestMomentumStacks = 3;
  g.harvestMomentumTimer = 2.0; // 2s remaining
  step();
  // Expected fr: 1 + 0.10 × 3 = 1.30
  out.stacksFrBoosted = near(frMult(), 1.30, 0.002);
  out.stacksStillAlive = g.harvestMomentumStacks === 3;

  // --- 4. Timer expires → stacks clear, frMult returns to 1 ---
  g.harvestMomentumStacks = 3;
  g.harvestMomentumTimer = 0.001; // essentially expired
  step(10); // ~0.167s → timer goes negative → clears
  out.expiredStacksClear = g.harvestMomentumStacks === 0;
  out.expiredFrIdentity = near(frMult(), 1.0, 0.002);

  // --- 5. Control: no item held → bonus not applied even with injected stacks ---
  fresh(); // no items → getHarvestMomentum() === 0
  g.harvestMomentumStacks = 5;
  g.harvestMomentumTimer = 2.0;
  step();
  out.controlFrIdentity = near(frMult(), 1.0, 0.002);

  return out;
});

await browser.close();
server.close();

console.log('\n=== Harvest Momentum — on-kill fire rate stacks ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const checks = [
  'catalogBloodRush', 'catalogBloodFrenzy',
  'getterSingle', 'getterCombo',
  'stacksFrBoosted', 'stacksStillAlive',
  'expiredStacksClear', 'expiredFrIdentity',
  'controlFrIdentity',
];
const pass = result && !result.fatal
  && checks.every(k => result[k] === true)
  && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
