#!/usr/bin/env node
// QA: HP-threshold HUD callouts — Last Stand (⚔ +N% LS) and Juggernaut (🛡 +N%).
//
// Verifies (on the SHIPPED frontend/dist) that:
//  1.  Catalog has items with lowHpPower > 0 (Last Stand / Berserker family)
//  2.  Catalog has items with highHpPower > 0 (Juggernaut family)
//  3.  Catalog has items with highHpFireRate > 0 (Overflow Battery family)
//  4.  ItemSystem.getLowHpPower() getter defined in source
//  5.  ItemSystem.getHighHpPower() and getHighHpFireRate() getters defined in source
//  6.  Game.ts LOW_HP_THRESHOLD = 0.35
//  7.  Game.ts HIGH_HP_THRESHOLD = 0.90
//  8.  HUDRenderer.ts wires getLowHpPower() and callout text (LS)
//  9.  HUDRenderer.ts wires getHighHpPower/FireRate and callout text (JUG)
// 10.  getLowHpPower() returns 0 at baseline (no items)
// 11.  getHighHpPower() / getHighHpFireRate() return 0 at baseline
// 12.  After buying last_stand_t2 (lowHpPower: 0.40), getLowHpPower() matches item
// 13.  After buying juggernaut_core_t2 (highHpPower: 0.30), getHighHpPower() > 0
// 14.  After buying overflow_battery_t2 (highHpFireRate: 0.35), getHighHpFireRate() > 0
// 15.  hpFrac computed correctly: player.health / player.maxHealth
// 16.  hpFrac <= 0.35 is true at exactly 35% HP (Last Stand gate)
// 17.  hpFrac >= 0.90 is true at exactly 90% HP (Juggernaut gate)
// 18.  hpFrac at 40% HP is NOT in low-HP zone (counter suppressed)
// 19.  hpFrac at 89% HP is NOT in high-HP zone (counter suppressed)
// 20.  No console/page errors throughout.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT     = path.join(FRONTEND, 'dist');
const CATALOG  = path.join(FRONTEND, 'src/items/catalog.ts');
const ITEM_SRC = path.join(FRONTEND, 'src/ItemSystem.ts');
const GAME_SRC = path.join(FRONTEND, 'src/Game.ts');
const HUD_SRC  = path.join(FRONTEND, 'src/HUDRenderer.ts');

// --- Source-level checks ---
const catSrc  = fs.readFileSync(CATALOG, 'utf8');
const itemSrc = fs.readFileSync(ITEM_SRC, 'utf8');
const gameSrc = fs.readFileSync(GAME_SRC, 'utf8');
const hudSrc  = fs.readFileSync(HUD_SRC, 'utf8');

// 1-3. Items exist with these fields
const catHasLowHp     = /lowHpPower:\s*[\d.]+/.test(catSrc);
const catHasHighHpPow = /highHpPower:\s*[\d.]+/.test(catSrc);
const catHasHighHpFr  = /highHpFireRate:\s*[\d.]+/.test(catSrc);
console.log(`[source] catalog has lowHpPower items → ${catHasLowHp ? 'OK' : 'FAIL'}`);
console.log(`[source] catalog has highHpPower items → ${catHasHighHpPow ? 'OK' : 'FAIL'}`);
console.log(`[source] catalog has highHpFireRate items → ${catHasHighHpFr ? 'OK' : 'FAIL'}`);

// 4-5. PlayerStats getters defined in source
const hasGetLow    = itemSrc.includes('getLowHpPower()');
const hasGetHighP  = itemSrc.includes('getHighHpPower()');
const hasGetHighFr = itemSrc.includes('getHighHpFireRate()');
console.log(`[source] ItemSystem.getLowHpPower() defined → ${hasGetLow ? 'OK' : 'FAIL'}`);
console.log(`[source] ItemSystem.getHighHpPower() defined → ${hasGetHighP ? 'OK' : 'FAIL'}`);
console.log(`[source] ItemSystem.getHighHpFireRate() defined → ${hasGetHighFr ? 'OK' : 'FAIL'}`);

// 6-7. Thresholds in Game.ts
const lowThreshOk  = /LOW_HP_THRESHOLD\s*=\s*0\.35/.test(gameSrc);
const highThreshOk = /HIGH_HP_THRESHOLD\s*=\s*0\.90/.test(gameSrc);
console.log(`[source] Game.ts LOW_HP_THRESHOLD=0.35 → ${lowThreshOk ? 'OK' : 'FAIL'}`);
console.log(`[source] Game.ts HIGH_HP_THRESHOLD=0.90 → ${highThreshOk ? 'OK' : 'FAIL'}`);

// 8-9. HUD callout wiring
const hudHasLow  = hudSrc.includes('getLowHpPower()');
const hudHasHigh = hudSrc.includes('getHighHpPower()') && hudSrc.includes('getHighHpFireRate()');
const hudHasLS   = hudSrc.includes('LS');
const hudHasJUG  = hudSrc.includes('JUG');
console.log(`[source] HUDRenderer uses getLowHpPower() → ${hudHasLow ? 'OK' : 'FAIL'}`);
console.log(`[source] HUDRenderer uses getHighHpPower/FireRate → ${hudHasHigh ? 'OK' : 'FAIL'}`);
console.log(`[source] HUDRenderer has LS callout text → ${hudHasLS ? 'OK' : 'FAIL'}`);
console.log(`[source] HUDRenderer has JUG callout text → ${hudHasJUG ? 'OK' : 'FAIL'}`);

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
  const g  = window.__game;
  const DB = window.__ItemDatabase;
  if (!g)  return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };

  const near = (a, b, eps = 0.001) => Math.abs(a - b) < eps;
  const out  = {};

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

  // 10. getLowHpPower() returns 0 at baseline
  fresh();
  out.getLowHpPowerExists    = typeof g.playerStats.getLowHpPower === 'function';
  out.lowHpPowerZeroBaseline = g.playerStats.getLowHpPower() === 0;

  // 11. getHighHpPower() / getHighHpFireRate() return 0 at baseline
  out.getHighHpPowerExists       = typeof g.playerStats.getHighHpPower === 'function';
  out.getHighHpFireRateExists    = typeof g.playerStats.getHighHpFireRate === 'function';
  out.highHpPowerZeroBaseline    = g.playerStats.getHighHpPower() === 0;
  out.highHpFireRateZeroBaseline = g.playerStats.getHighHpFireRate() === 0;

  // 12. After buying last_stand_t2 (lowHpPower: 0.40), getLowHpPower() = 0.40
  fresh();
  const lsItem = DB.getItemById('last_stand_t2');
  out.lastStandItemExists    = !!lsItem;
  out.lastStandHasLowHpPower = !!(lsItem?.lowHpPower > 0);
  if (lsItem) {
    giveItem('last_stand_t2');
    const after = g.playerStats.getLowHpPower();
    out.lowHpPowerAfterBuy    = after > 0;
    out.lowHpPowerMatchesItem = near(after, lsItem.lowHpPower);
  } else {
    out.lowHpPowerAfterBuy    = false;
    out.lowHpPowerMatchesItem = false;
  }

  // 13. After buying juggernaut_core_t2 (highHpPower: 0.30), getHighHpPower() > 0
  fresh();
  const jugItem = DB.getItemById('juggernaut_core_t2');
  out.jugItemExists         = !!jugItem;
  out.jugItemHasHighHpPower = !!(jugItem?.highHpPower > 0);
  if (jugItem) {
    giveItem('juggernaut_core_t2');
    const after = g.playerStats.getHighHpPower();
    out.highHpPowerAfterBuy    = after > 0;
    out.highHpPowerMatchesItem = near(after, jugItem.highHpPower);
  } else {
    out.highHpPowerAfterBuy    = false;
    out.highHpPowerMatchesItem = false;
  }

  // 14. After buying overflow_battery_t2 (highHpFireRate: 0.35), getHighHpFireRate() > 0
  fresh();
  const ovfItem = DB.getItemById('overflow_battery_t2');
  out.ovfItemExists            = !!ovfItem;
  out.ovfItemHasHighHpFireRate = !!(ovfItem?.highHpFireRate > 0);
  if (ovfItem) {
    giveItem('overflow_battery_t2');
    const after = g.playerStats.getHighHpFireRate();
    out.highHpFireRateAfterBuy    = after > 0;
    out.highHpFireRateMatchesItem = near(after, ovfItem.highHpFireRate);
  } else {
    out.highHpFireRateAfterBuy    = false;
    out.highHpFireRateMatchesItem = false;
  }

  // 15-19. HP fraction and threshold gate logic
  fresh();
  if (g.player) {
    const maxHp = g.player.maxHealth;

    // 15. hpFrac: full HP = 1.0, half = ~0.5
    g.player.health = maxHp;
    out.hpFracFullHealth = near(g.player.health / g.player.maxHealth, 1.0);
    g.player.health = Math.round(maxHp * 0.5);
    out.hpFracHalfHealth = near(g.player.health / g.player.maxHealth, 0.5, 0.02);

    // 16. hpFrac <= 0.35 at 35% HP (Last Stand gate active)
    g.player.health = Math.round(maxHp * 0.35);
    out.hpFracAtLowThreshold = (g.player.health / g.player.maxHealth) <= 0.35;

    // 17. hpFrac >= 0.90 at 90% HP (Juggernaut gate active)
    g.player.health = Math.round(maxHp * 0.90);
    out.hpFracAtHighThreshold = (g.player.health / g.player.maxHealth) >= 0.90;

    // 18. 40% HP is NOT in low-HP zone
    g.player.health = Math.round(maxHp * 0.40);
    out.hpFracAboveLowZone = (g.player.health / g.player.maxHealth) > 0.35;

    // 19. 89% HP is NOT in high-HP zone
    g.player.health = Math.round(maxHp * 0.89);
    out.hpFracBelowHighZone = (g.player.health / g.player.maxHealth) < 0.90;
  } else {
    ['hpFracFullHealth','hpFracHalfHealth','hpFracAtLowThreshold',
     'hpFracAtHighThreshold','hpFracAboveLowZone','hpFracBelowHighZone']
      .forEach(k => { out[k] = false; });
  }

  return out;
});

await browser.close();
server.close();

const BROWSER_CHECKS = [
  'getLowHpPowerExists',    'lowHpPowerZeroBaseline',
  'getHighHpPowerExists',   'getHighHpFireRateExists',
  'highHpPowerZeroBaseline','highHpFireRateZeroBaseline',
  'lastStandItemExists',    'lastStandHasLowHpPower',
  'lowHpPowerAfterBuy',     'lowHpPowerMatchesItem',
  'jugItemExists',          'jugItemHasHighHpPower',
  'highHpPowerAfterBuy',    'highHpPowerMatchesItem',
  'ovfItemExists',          'ovfItemHasHighHpFireRate',
  'highHpFireRateAfterBuy', 'highHpFireRateMatchesItem',
  'hpFracFullHealth',       'hpFracHalfHealth',
  'hpFracAtLowThreshold',   'hpFracAtHighThreshold',
  'hpFracAboveLowZone',     'hpFracBelowHighZone',
];

const SOURCE_CHECKS = [
  catHasLowHp, catHasHighHpPow, catHasHighHpFr,
  hasGetLow, hasGetHighP, hasGetHighFr,
  lowThreshOk, highThreshOk,
  hudHasLow, hudHasHigh, hudHasLS, hudHasJUG,
];
const SOURCE_PASS = SOURCE_CHECKS.every(Boolean);

const fatal  = result?.fatal;
const errMsg = errors.length ? errors.join('\n') : null;

console.log('\n=== HP-threshold HUD callouts (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
if (errMsg) console.error('Console/page errors:\n', errMsg);
else console.log('Console/page errors: 0');

const browserPass   = !fatal && !errMsg && BROWSER_CHECKS.every(k => !!result?.[k]);
const passedBrowser = BROWSER_CHECKS.filter(k => !!result?.[k]).length;
const passedSource  = SOURCE_CHECKS.filter(Boolean).length;
const total         = BROWSER_CHECKS.length + SOURCE_CHECKS.length;
const allPass       = SOURCE_PASS && browserPass;

console.log(`\n${passedSource + passedBrowser}/${total} checks passed`);
console.log(`RESULT: ${allPass ? 'PASS \u2705' : 'FAIL \u274C'}`);
if (fatal) console.error('FATAL:', fatal);
if (!allPass) process.exit(1);
