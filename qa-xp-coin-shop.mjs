#!/usr/bin/env node
// QA for the XP-orb / coin-pickup / shop-auto-buy batch.
// Drives the real game instance (window.__game) headlessly:
//   1. XP orbs are the chunkier size (radius bumped 4 -> 6)
//   2. A kill NO LONGER banks gold instantly — gold drops as coin pickups
//   3. Coins magnet into the player and bank their gold on contact
//   4. Shop Auto-Buy drains gold: buys every affordable item + rerolls until broke
// Screenshots gameplay (orbs/coins) + the shop (Auto-Buy button) on desktop + mobile.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/xp-coin-shop';
fs.mkdirSync(OUT, { recursive: true });

console.log('Building frontend...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.css':'text/css','.mp3':'audio/mpeg' };
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = false;
const check = (name, ok, detail = '') => {
  if (!ok) fail = true;
  console.log(`  [${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
});

async function run(label, viewport, shotPrefix) {
  console.log(`\n=== ${label} (${viewport.width}x${viewport.height}) ===`);
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1200);

  // Enter a live run.
  await page.evaluate(() => { const g = window.__game; g.startNewGame(); g.state = 'playing'; });
  await sleep(150);

  // 1. Manufacture a clean kill AT the player, capturing gold before/right-after.
  //    A minimal enemy literal is enough — handleEnemyKill only reads type/typeData/x/y.
  const kill = await page.evaluate(() => {
    const g = window.__game;
    const enemy = { type: 'grunt', x: g.player.x, y: g.player.y, typeData: { xpValue: 12, goldValue: 20 } };
    const goldBefore = g.player.gold;
    const coinsBefore = g.coins.length;
    g.handleEnemyKill(enemy);
    const spawnedCoins = g.coins.slice(coinsBefore);
    const coinGold = spawnedCoins.reduce((s, c) => s + c.goldAmount, 0);
    return {
      goldBefore,
      goldRightAfter: g.player.gold,       // must equal goldBefore — no instant gold
      coinsSpawned: g.coins.length - coinsBefore,
      coinGold,
      xpOrbRadius: g.xpOrbs.length ? g.xpOrbs[0].radius : null,
    };
  });
  // Radius now scales (gently, log) with the gem's value so merged/high-value orbs
  // read as chunkier and are easier to grab — base >= 6, capped at 16.
  check('XP orbs use value-scaled radius (>=6, <=16)', kill.xpOrbRadius >= 6 && kill.xpOrbRadius <= 16, `radius=${kill.xpOrbRadius}`);
  check('kill drops coins (not instant gold)', kill.coinsSpawned > 0, `${kill.coinsSpawned} coins worth ${kill.coinGold}g`);
  check('gold NOT banked at moment of kill', kill.goldRightAfter === kill.goldBefore, `${kill.goldBefore} -> ${kill.goldRightAfter}`);

  // 2. Run a frame so the on-player coins magnet in and bank their gold.
  await page.evaluate(() => { const g = window.__game; g.update(0.05); g.update(0.05); });
  const collected = await page.evaluate(() => ({ gold: window.__game.player.gold }));
  check('coins bank their gold on pickup', collected.gold >= kill.goldBefore + kill.coinGold, `${kill.goldBefore} + ${kill.coinGold} <= ${collected.gold}`);
  await page.screenshot({ path: path.join(OUT, `${shotPrefix}-playing.png`) });

  // 3. Shop Auto-Buy drains gold until you can't afford another item or reroll.
  await page.evaluate(() => {
    const g = window.__game;
    g.startNewGame();
    g.player.gold = 140;
    g.enterShop();               // populates shopItems + reroll cost, state='shop'
  });
  await page.evaluate(() => { const g = window.__game; g.update(0.05); }); // release frame (disarm)
  await sleep(60);
  await page.screenshot({ path: path.join(OUT, `${shotPrefix}-shop.png`) });

  const before = await page.evaluate(() => ({
    gold: window.__game.player.gold,
    owned: window.__game.playerStats.items.length,
  }));
  // Click the Auto-Buy button using the shared shop layout geometry.
  await page.evaluate(() => {
    const g = window.__game;
    const L = g.getShopLayout();
    g.input.mouseX = L.autoBuyX;
    g.input.mouseY = L.rerollY + L.buttonHeight / 2;
    g.input.mouseDown = true;
  });
  await page.evaluate(() => { const g = window.__game; g.update(0.05); });
  await sleep(80);
  const after = await page.evaluate(() => {
    const g = window.__game;
    const cheapest = g.shopItems.reduce((m, it) => it ? Math.min(m, g.playerStats.getItemPrice(it, g.waveManager.currentWave)) : m, Infinity);
    return {
      gold: g.player.gold,
      owned: g.playerStats.items.length,
      rerollCost: g.shopRerollCost,
      cheapest,
    };
  });
  check('Auto-Buy purchased items', after.owned > before.owned, `${before.owned} -> ${after.owned} owned`);
  check('Auto-Buy spent gold', after.gold < before.gold, `${before.gold} -> ${after.gold}g`);
  check('Auto-Buy stopped when broke', !(after.gold >= after.cheapest || after.gold >= after.rerollCost),
    `gold=${after.gold}, cheapest=${after.cheapest}, reroll=${after.rerollCost}`);

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  await page.close();
}

await run('Desktop', { width: 1280, height: 800 }, 'desktop');
await run('Mobile',  { width: 390, height: 844 }, 'mobile');

await browser.close();
server.close();

console.log(`\nScreenshots → ${OUT}`);
console.log(fail ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(fail ? 1 : 0);
