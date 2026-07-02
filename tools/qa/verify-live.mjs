// Verify the LIVE production deploy: menu wood buttons + portrait shop clickability.
// Usage: CHROME_BIN=/usr/bin/chromium node tools/qa/verify-live.mjs <liveUrl> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'https://roguelite-game-blush.vercel.app';
const OUT = process.argv[3] || '/tmp/roguelite-live';
fs.mkdirSync(OUT, { recursive: true });

const launch = (viewport) => puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: viewport,
});

const errors = [];

// 1. Menu screenshot (portrait phone viewport)
{
  const browser = await launch({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('menu: ' + e.message));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, 'live-01-menu-portrait.png') });
  await browser.close();
}

// 2. Portrait shop + real click test
{
  const browser = await launch({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('shop: ' + e.message));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.click('#startBtn');
  await new Promise((r) => setTimeout(r, 1000));

  // Force wave end -> shop, with gold to spend
  const preState = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { ok: false };
    g.player.gold = 500;
    g.enemies.length = 0;
    if (g.waveManager) { g.waveManager.waveEnemiesRemaining = 0; g.waveManager.enemiesAlive = 0; }
    return { ok: true, gold: g.player.gold };
  });
  await new Promise((r) => setTimeout(r, 2600));
  await page.screenshot({ path: path.join(OUT, 'live-02-shop-portrait.png') });

  // Replicate the game's own hitbox math (Game.getShopLayout + updateShop) to find
  // the first purchasable card, click its CENTER, and confirm gold drops -> proves the
  // portrait click hitbox aligns with the visible card (the bug that was fixed).
  const clickResult = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { ok: false, reason: 'no __game' };
    const L = g.getShopLayout();
    const items = g.shopItems || [];
    let target = null;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it) continue;
      const cost = it.cost ?? it.price ?? 0;
      if (cost > g.player.gold) continue;
      const x = L.isMobile ? L.startX : L.startX + (i % 3) * (L.itemWidth + L.gap);
      const y = L.isMobile ? L.startY + i * (L.itemHeight + L.gap)
                           : L.startY + Math.floor(i / 3) * (L.itemHeight + L.gap);
      target = { i, cx: x + L.itemWidth / 2, cy: y + L.itemHeight / 2, cost, name: it.name };
      break;
    }
    // canvas-px center -> viewport css px
    const cv = document.querySelector('canvas');
    const r = cv.getBoundingClientRect();
    const map = target ? { px: r.left + target.cx * (r.width / cv.width),
                           py: r.top + target.cy * (r.height / cv.height) } : null;
    return { ok: true, state: g.state, goldBefore: g.player.gold, isPortrait: L.isPortrait,
             itemCount: items.filter(Boolean).length, target, map };
  });

  let bought = null;
  if (clickResult.ok && clickResult.map) {
    // Portrait/mobile uses the TOUCH path (scaled to canvas backing store), so fire a
    // held touch — mouse events would use unscaled coords and miss on hi-DPI. Held so the
    // rAF update loop catches input.mouseDown at the card coords.
    const { px, py } = clickResult.map;
    if (page.touchscreen.touchStart) {
      await page.touchscreen.touchStart(px, py);
      await new Promise((r) => setTimeout(r, 260));
      await page.touchscreen.touchEnd();
    } else {
      await page.touchscreen.tap(px, py);
    }
    await new Promise((r) => setTimeout(r, 500));
    bought = await page.evaluate((goldBefore) => {
      const g = window.__game;
      return { goldAfter: g.player.gold, goldDropped: g.player.gold < goldBefore,
               ownedItems: (g.playerStats && g.playerStats.items && g.playerStats.items.length) ?? null };
    }, clickResult.goldBefore);
    await page.screenshot({ path: path.join(OUT, 'live-03-shop-after-click.png') });
  }

  console.log(JSON.stringify({ preState, clickResult, bought, errors }, null, 2));
  await browser.close();
}

if (errors.length) console.log('PAGE ERRORS:', errors);
console.log('done ->', OUT);
