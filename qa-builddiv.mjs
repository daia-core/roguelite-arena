#!/usr/bin/env node
// Behavioral verification for the build-diversity features Felix asked for
// (interest on banked gold, luck stat, trade-off item downsides).
// Builds the SHIPPED bundle (frontend/dist), drives it headless, and asserts
// the real runtime behavior — not a claim. Mirrors qa-magnet.mjs.
//
// Cases:
//   A. Baseline interest = floor(gold * 0.10), added to gold.
//   B. Interest is CAPPED at 10 + wave*2 (hoarding can't snowball).
//   C. A banking item (interestBonus) actually raises the rate.
//   D. Luck sums additively across items (getLuck).
//   E. A trade-off item's DOWNSIDE is live (Reckless Charm armor -3 lowers getArmor).
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

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game handle' };
  g.startNewGame();
  if (!g.player || g.state !== 'playing') return { fatal: `bad start state=${g.state} player=${!!g.player}` };

  const out = {};
  const clearItems = () => { g.playerStats.items = g.playerStats.items.filter(it => !it.__test); };
  const setWave = (w) => { g.waveManager.currentWave = w; };

  // --- Case A: baseline interest = floor(gold * 0.10), added to gold ---
  clearItems();
  setWave(10);                 // cap = 10 + 10*2 = 30, well above the expected 10
  g.player.gold = 100;
  g.enterShop();
  out.A_interest = g.lastInterestGained;      // expect 10
  out.A_goldAfter = g.player.gold;            // expect 110

  // --- Case B: interest capped at 10 + wave*2 ---
  clearItems();
  setWave(1);                  // cap = 12
  g.player.gold = 1000;        // uncapped would be floor(1000*0.10) = 100
  g.enterShop();
  out.B_interest = g.lastInterestGained;      // expect 12 (capped), NOT 100

  // --- Case C: a banking item raises the rate ---
  clearItems();
  setWave(30);                 // cap = 70, above the expected 18
  g.playerStats.items.push({ __test: true, interestBonus: 0.08, tags: [] });
  out.C_bonus = g.playerStats.getInterestBonus();   // expect 0.08
  g.player.gold = 100;
  g.enterShop();
  out.C_interest = g.lastInterestGained;      // expect floor(100*0.18) = 18 (baseline was 10)

  // --- Case D: luck sums additively across items ---
  clearItems();
  g.playerStats.items.push({ __test: true, luck: 0.15, tags: [] });
  g.playerStats.items.push({ __test: true, luck: 0.40, tags: [] });
  out.D_luck = g.playerStats.getLuck();       // expect 0.55

  // --- Case E: a trade-off DOWNSIDE is live (armor -3 lowers getArmor) ---
  clearItems();
  const armorBase = g.playerStats.getArmor();
  g.playerStats.items.push({ __test: true, armor: -3, tags: [] });
  out.E_armorDrop = armorBase - g.playerStats.getArmor();   // expect 3
  clearItems();

  return out;
});

await browser.close();
server.close();

console.log('\n=== Build-diversity verification (on shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const approx = (a, b) => Math.abs(a - b) < 1e-6;
const pass = result && !result.fatal
  && result.A_interest === 10 && result.A_goldAfter === 110
  && result.B_interest === 12
  && approx(result.C_bonus, 0.08) && result.C_interest === 18
  && approx(result.D_luck, 0.55)
  && result.E_armorDrop === 3
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
