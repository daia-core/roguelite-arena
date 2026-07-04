#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the CEREMONIAL DAGGERS on-kill proc item.
// On every kill, throw 3 homing spectral daggers that seek nearby enemies. The chain is
// BOUNDED to one generation per primary kill: a dagger's own kill (fromDagger=true) never
// spawns more daggers, so a dense pack can't cascade into an exponential dagger storm.
//
//   1. Data: ceremonial_daggers_t3 exists, ceremonialDaggers===3, legendary, 🗡️ icon.
//   2. Default: fresh PlayerStats has getDaggerCount()===0.
//   3. Control: WITHOUT the item, a kill spawns NO dagger projectiles.
//   4. Spawn: WITH the item, one kill spawns exactly 3 dagger projectiles.
//   5. Shape: every spawned dagger is a homing player projectile flagged isDagger.
//   6. Damage: each dagger's damage == getDamage()*0.5 (scales with the build).
//   7. RECURSION GUARD (critical): handleEnemyKill(enemy, /*fromDagger*/ true) spawns 0
//      daggers — proving a dagger's own kill can't re-trigger the on-kill spawn.
//   8. Stacking: 2 copies -> getDaggerCount()===6 and one kill spawns 6 daggers.
//
// TS `private` is compile-time only, so g.handleEnemyKill / g.projectiles are reachable at
// runtime. window.__ItemDatabase exposes the catalog. A stub enemy of type 'slime' (xp/gold
// 0) skips all death-branch special-casing so the only projectiles added are the daggers.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/daggers';
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

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
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
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const stub = () => ({ type: 'slime', isMiniboss: false, x: 100, y: 100,
    typeData: { isBoss: false, xpValue: 0, goldValue: 0, damage: 0 } });
  const daggers = () => g.projectiles.filter(p => p.isDagger);

  // === 1. Catalog entry. ===
  const item = DB.getItemById('ceremonial_daggers_t3');
  out.itemExists = !!item && item.ceremonialDaggers === 3;
  out.itemLegendary = !!item && item.rarity === 'legendary' && item.icon === '🗡️';

  // === 2. Default: no daggers on a fresh run. ===
  g.startNewGame();
  out.noDaggersDefault = g.playerStats.getDaggerCount() === 0;

  // === 3. Control: killing without the item spawns no daggers. ===
  g.handleEnemyKill(stub(), false);
  out.controlNoDaggers = daggers().length === 0;

  // === 4/5/6. Spawn + shape + damage WITH the item held. ===
  g.startNewGame();
  if (item) g.playerStats.addItem(item);
  out.daggerCountOne = g.playerStats.getDaggerCount() === 3;

  g.handleEnemyKill(stub(), false);       // one PRIMARY kill
  const d = daggers();
  out.spawnsThree = d.length === 3;
  out.daggersAreHomingPlayer = d.length === 3 &&
    d.every(p => p.fromPlayer === true && p.homing === true && p.isDagger === true && p.turnSpeed > 0);
  const expectDmg = g.playerStats.getDamage() * 0.5;
  out.daggerDamageHalf = d.length > 0 && d.every(p => near(p.damage, expectDmg));

  // === 7. RECURSION GUARD: a dagger's own kill spawns NO new daggers. ===
  g.startNewGame();
  if (item) g.playerStats.addItem(item);
  const before = daggers().length;               // 0
  g.handleEnemyKill(stub(), true);               // fromDagger = true
  out.recursionGuard = (daggers().length - before) === 0;

  // === 8. Stacking: 2 copies -> 6 daggers per kill. ===
  g.startNewGame();
  if (item) { g.playerStats.addItem(item); g.playerStats.addItem(item); }
  out.stackTwoCopies = g.playerStats.getDaggerCount() === 6;
  g.handleEnemyKill(stub(), false);
  out.spawnsSixStacked = daggers().length === 6;

  return out;
});

await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  g.startNewGame();
  const item = DB.getItemById('ceremonial_daggers_t3');
  if (item) g.playerStats.addItem(item);
  // Fan a burst of daggers so the spectral trails are visible in the shot.
  for (let k = 0; k < 3; k++) g.handleEnemyKill({ type: 'slime', isMiniboss: false, x: 195 + k*20, y: 400,
    typeData: { isBoss: false, xpValue: 0, goldValue: 0, damage: 0 } }, false);
  g.state = 'playing';
});
await new Promise(r => setTimeout(r, 120));
await page.screenshot({ path: path.join(OUT, 'daggers-mobile.png') });

await browser.close();
server.close();

console.log('\n=== Ceremonial Daggers on-kill proc (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('Screenshots →', OUT);

const checks = ['itemExists','itemLegendary','noDaggersDefault','controlNoDaggers','daggerCountOne',
  'spawnsThree','daggersAreHomingPlayer','daggerDamageHalf','recursionGuard','stackTwoCopies','spawnsSixStacked'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
