#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the SOUL TITHE on-kill milestone item.
// While held: every 10th kill drops a health orb, every 50th kill banks a PERMANENT
// +1% damage stack for the rest of the run (uncapped). The counter only ticks while
// the item is held ("every Nth kill SINCE you bought it"), and the permanent stacks
// fold into runtimeDamageMult via updateRuntimeModifiers.
//
//   1. Data: soul_tithe_t3 exists, soulTithe:true, legendary, 👻 icon.
//   2. Default: fresh PlayerStats has hasSoulTithe()===false.
//   3. Control: WITHOUT the item, killing does NOT tick the tithe counter/stacks.
//   4. Cadence: WITH the item, the 10th kill drops the first orb (not the 9th), and
//      exactly 5 orbs by the 50th kill (base 18% random drop suppressed for the count).
//   5. Permanent stack: 1 stack at 50 kills, 2 at 100.
//   6. Damage fold: runtimeDamageMult == 1 + 0.01*stacks after updateRuntimeModifiers.
//   7. Reset: startNewGame() zeroes both soulTitheKills and soulTitheStacks.
//
// TS `private` is compile-time only, so g.handleEnemyKill / g.updateRuntimeModifiers /
// g.soulTitheKills / g.soulTitheStacks are reachable at runtime. window.__ItemDatabase
// exposes the catalog. A stub enemy of type 'slime' (xp/gold 0) skips all death-branch
// special-casing so the only pickups added are Soul Tithe's own orbs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/soultithe';
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
  // Kill N stub enemies. When `quiet`, suppress the 18% random health-orb drop (and any
  // other RNG) so healthOrbs.length reflects ONLY Soul Tithe's deterministic drops.
  const killN = (n, quiet) => {
    const orig = Math.random;
    if (quiet) Math.random = () => 0.999;
    for (let i = 0; i < n; i++) g.handleEnemyKill(stub());
    if (quiet) Math.random = orig;
  };

  // === 1. Catalog entry. ===
  const item = DB.getItemById('soul_tithe_t3');
  out.itemExists = !!item && item.soulTithe === true;
  out.itemLegendary = !!item && item.rarity === 'legendary' && item.icon === '👻';

  // === 2. Default: no tithe on a fresh run. ===
  g.startNewGame();
  out.noTitheDefault = g.playerStats.hasSoulTithe() === false;

  // === 3. Control: killing without the item never ticks the counter. ===
  killN(50, true);
  out.controlNoTithe = g.soulTitheKills === 0 && g.soulTitheStacks === 0;

  // === 4/5. Cadence + permanent stacks WITH the item held. ===
  g.startNewGame();
  if (item) g.playerStats.addItem(item);
  out.titheHeld = g.playerStats.hasSoulTithe() === true;

  const orbs0 = g.healthOrbs.length;      // 0 after startNewGame
  killN(9, true);
  out.noOrbBefore10 = (g.healthOrbs.length - orbs0) === 0 && g.soulTitheKills === 9;
  killN(1, true);                          // the 10th kill
  out.orbAt10 = (g.healthOrbs.length - orbs0) === 1 && g.soulTitheKills === 10;
  killN(40, true);                         // up to the 50th
  out.fiveOrbsAt50 = (g.healthOrbs.length - orbs0) === 5;
  out.oneStackAt50 = g.soulTitheStacks === 1;

  // === 6. Damage fold: runtimeDamageMult == 1 + 0.01*stacks. ===
  g.updateRuntimeModifiers(0.016, false);
  out.dmgFold1pct = near(g.playerStats.runtimeDamageMult, 1.01);
  killN(50, true);                         // to 100 kills -> 2 stacks
  out.twoStacksAt100 = g.soulTitheStacks === 2;
  g.updateRuntimeModifiers(0.016, false);
  out.dmgFold2pct = near(g.playerStats.runtimeDamageMult, 1.02);

  // === 7. Reset clears run-state. ===
  g.startNewGame();
  out.resetClears = g.soulTitheKills === 0 && g.soulTitheStacks === 0;

  return out;
});

await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  g.startNewGame();
  const item = DB.getItemById('soul_tithe_t3');
  if (item) g.playerStats.addItem(item);
  g.state = 'playing';
});
await new Promise(r => setTimeout(r, 250));
await page.screenshot({ path: path.join(OUT, 'soultithe-mobile.png') });

await browser.close();
server.close();

console.log('\n=== Soul Tithe on-kill milestone (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('Screenshots →', OUT);

const checks = ['itemExists','itemLegendary','noTitheDefault','controlNoTithe','titheHeld',
  'noOrbBefore10','orbAt10','fiveOrbsAt50','oneStackAt50','dmgFold1pct','twoStacksAt100',
  'dmgFold2pct','resetClears'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
