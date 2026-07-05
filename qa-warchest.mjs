#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the WAR CHEST wave-end economy item.
// While held, the end of each wave banks gold equal to 3x the current wave number. The
// payout is folded in at Game.enterShop() (the wave-end -> shop transition), right after
// banking interest. Additive across copies (getWarChest() sums the field).
//
//   1. Data: war_chest_t3 exists, warChest===3, rare, 💰 icon, economic tag.
//   2. Default: fresh PlayerStats getWarChest()===0.
//   3. Held: getWarChest()===3.
//   4. Payout scales with wave: with gold zeroed (so interest==0), enterShop() at wave W
//      leaves the player holding exactly 3*W gold. Checked at two waves (3 -> 9, 7 -> 21).
//   5. Additive stack: two copies -> getWarChest()===6 -> payout 6*W.
//   6. Control: WITHOUT the item, enterShop() with gold zeroed pays out nothing (stays 0).
//   7. Reset: startNewGame() clears getWarChest() back to 0.
//
// TS `private` is compile-time only, so g.enterShop / g.player / g.waveManager are reachable.
// We isolate the payout by zeroing gold before each enterShop() call (interest on 0 gold is 0),
// so the resulting gold is purely the War Chest payout.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/warchest';
fs.mkdirSync(OUT, { recursive: true });

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

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, protocolTimeout: 120000, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };
  const out = {};

  // Bank the War Chest payout for a given wave with gold pre-zeroed, and return the gold
  // the player is left holding (== the payout, since interest on 0 gold is 0).
  const payoutAtWave = (wave) => {
    g.waveManager.currentWave = wave;
    g.player.gold = 0;
    g.enterShop();
    return g.player.gold;
  };

  // === 1. Catalog entry. ===
  // Clone on every acquire: items now carry instance state (upgradeLevel) and the
  // catalog returns a SHARED ref, so re-adding one raw object upgrades it across blocks.
  const clone = () => JSON.parse(JSON.stringify(DB.getItemById('war_chest_t3')));
  const item = DB.getItemById('war_chest_t3');
  out.itemExists = !!item && item.warChest === 3;
  out.itemRarity = !!item && item.rarity === 'rare' && item.icon === '💰' &&
    Array.isArray(item.tags) && item.tags.includes('economic');

  // === 2. Default. ===
  g.startNewGame();
  out.noWarChestDefault = g.playerStats.getWarChest() === 0;

  // === 3. Held. ===
  g.startNewGame();
  if (item) g.playerStats.addItem(clone());
  out.warChestHeld = g.playerStats.getWarChest() === 3;

  // === 4. Payout scales with the wave number. ===
  out.payoutScales = payoutAtWave(3) === 9 && payoutAtWave(7) === 21;

  // === 5. Additive across copies (second copy deepens the payout). ===
  g.startNewGame();
  if (item) { g.playerStats.addItem(clone()); g.playerStats.addItem(clone()); }
  out.additiveStack = g.playerStats.getWarChest() === 6 && payoutAtWave(5) === 30;

  // === 6. Control: no item -> no payout. ===
  g.startNewGame();
  out.controlNoPayout = payoutAtWave(7) === 0;

  // === 7. Reset. ===
  g.startNewGame();
  if (item) g.playerStats.addItem(clone());
  const midHeld = g.playerStats.getWarChest();
  g.startNewGame();
  out.resetClears = midHeld === 3 && g.playerStats.getWarChest() === 0;

  return out;
});

await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  g.startNewGame();
  const item = DB.getItemById('war_chest_t3');
  if (item) g.playerStats.addItem(item);
  g.state = 'playing';
});
await new Promise(r => setTimeout(r, 250));
await page.screenshot({ path: path.join(OUT, 'warchest-mobile.png') });

await browser.close();
server.close();

console.log('\n=== War Chest wave-end economy (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('Screenshots →', OUT);

const checks = ['itemExists','itemRarity','noWarChestDefault','warChestHeld','payoutScales',
  'additiveStack','controlNoPayout','resetClears'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
