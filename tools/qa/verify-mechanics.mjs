// Headless regression test for the new economy/build mechanics:
//  1. Banking interest applies once when you reach the shop, respects the cap.
//  2. Interest scales with a banker item (interestBonus).
//  3. Trade-off items apply BOTH their bonus and their penalty.
// Serves the local dist and drives it via the window.__game hook.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.resolve(HERE, '../../frontend/dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const errors = [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));
await page.click('#startBtn');
await new Promise((r) => setTimeout(r, 800));

// --- Test 1: base interest (no banker item), 200 gold at wave 1 → 10% = 20, cap 12 ---
const t1 = await page.evaluate(async () => {
  const g = window.__game;
  g.player.gold = 200;
  g.playerStats.items = []; // no banker items
  g.waveManager.currentWave = 1;
  const before = g.player.gold;
  g.enemies.length = 0;
  g.waveManager.waveEnemiesRemaining = 0;
  g.waveManager.enemiesAlive = 0;
  return { before };
});
await new Promise((r) => setTimeout(r, 2600)); // let wave-complete → enterShop fire
const r1 = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, gold: g.player.gold, interest: g.lastInterestGained };
});

// --- Test 2: interest with a banker item + verify trade-off penalty applies ---
const t2 = await page.evaluate(() => {
  const g = window.__game;
  const DB = g.constructor;
  // pull the actual item defs off the running database via a shop reroll pool
  const piggy = window.__ItemDatabase?.getItemById?.('piggy_bank_t2');
  return { hasHook: !!window.__ItemDatabase };
});

// Direct stat-logic check via the exposed playerStats (no hook needed):
const r2 = await page.evaluate(() => {
  const g = window.__game;
  const ps = g.playerStats;
  // Snapshot baseline
  const baseDmg = ps.getDamage();
  const baseArmor = ps.getArmor();
  const baseHP = ps.getMaxHealth();
  // Reckless Charm: +40% dmg, -3 armor
  ps.items.push({ id: 'reckless_charm_t2', name: 'Reckless Charm', tags: ['melee'], damageMultiplier: 1.4, armor: -3 });
  const dmgAfter = ps.getDamage();
  const armorAfter = ps.getArmor();
  // Blood Pact: +50% dmg, -35 max HP
  ps.items.push({ id: 'blood_pact_t3', name: 'Blood Pact', tags: ['melee'], damageMultiplier: 1.5, maxHealthBonus: -35 });
  const hpAfter = ps.getMaxHealth();
  // Piggy Bank interest bonus
  ps.items.push({ id: 'piggy_bank_t2', name: 'Piggy Bank', tags: ['economic'], interestBonus: 0.08 });
  const interestBonus = ps.getInterestBonus();
  return {
    dmgWentUp: dmgAfter > baseDmg,
    armorWentDown: armorAfter === baseArmor - 3,
    hpWentDown: hpAfter === baseHP - 35,
    interestBonus,
  };
});

await page.screenshot({ path: '/tmp/roguelite-mechanics-shop.png' });
await browser.close();
server.close();

const result = {
  test1_baseInterest: {
    ...t1, ...r1,
    expectedInterest: Math.min(10 + 1 * 2, Math.floor(200 * 0.10)), // min(12, 20) = 12
    pass: r1.state === 'shop' && r1.interest === 12 && r1.gold === 212,
  },
  test2_statLogic: { ...r2, pass: r2.dmgWentUp && r2.armorWentDown && r2.hpWentDown && Math.abs(r2.interestBonus - 0.08) < 1e-9 },
  errors,
};
console.log(JSON.stringify(result, null, 2));
const ok = result.test1_baseInterest.pass && result.test2_statLogic.pass && errors.length === 0;
console.log(ok ? 'ALL PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
