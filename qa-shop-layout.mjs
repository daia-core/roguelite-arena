#!/usr/bin/env node
// Verifies the responsive SHOP layout never overlaps, across many screen sizes.
// For each viewport it forces the game into the shop with a full 6-item stock,
// reads the REAL layout (g.getShopLayout(), the single source both draw+hit use),
// and asserts geometrically:
//   1. No item card overlaps the Continue or Reroll button (the reported bug).
//   2. No two item cards overlap each other.
//   3. Every card + both buttons stay within the canvas bounds.
//   4. The first card row starts below the stats-panel header (no header overlap).
// Also fails on any console/page error. Screenshots each size for eyeballing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const SHOTS = path.join(FRONTEND, '..', 'shots');

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

// A spread of real-world sizes: tall & short phones (portrait), landscape phones,
// small/medium/large desktop windows, plus deliberately cramped windows.
const SIZES = [
  { name: 'phone-portrait-tall',   w: 412, h: 915 },
  { name: 'phone-portrait-mid',    w: 390, h: 844 },
  { name: 'phone-portrait-short',  w: 360, h: 640 },
  { name: 'iphone-se-portrait',    w: 375, h: 667 },
  { name: 'phone-landscape',       w: 844, h: 390 },
  { name: 'phone-landscape-small', w: 667, h: 375 },
  { name: 'tablet-portrait',       w: 768, h: 1024 },
  { name: 'desktop-small',         w: 1024, h: 640 },
  { name: 'desktop-large',         w: 1440, h: 900 },
  { name: 'narrow-window',         w: 500, h: 700 },
  { name: 'short-window',          w: 900, h: 480 },
];

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

fs.mkdirSync(SHOTS, { recursive: true });

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

let failures = 0;
const report = [];

for (const size of SIZES) {
  await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 400));
  // Ensure the canvas has picked up this viewport.
  await page.evaluate(() => window.dispatchEvent(new Event('game-resize')));
  await new Promise(r => setTimeout(r, 250));

  const data = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { fatal: 'no __game' };
    g.startNewGame();
    // Own a handful of items so the desktop INVENTORY panel (right column) is
    // actually drawn — its gutter must be clear of the grid too.
    if (window.__ItemDatabase) {
      const stock = window.__ItemDatabase.getWeightedShopItems(8, 3, [], 1);
      stock.forEach(it => g.playerStats.addItem(it));
    }
    // Force the shop open with a full stock, regardless of run progress.
    g.enterShop();
    // Shop now offers exactly 3 items (8-slot rework). Top up to 3 if under-filled.
    if (g.shopItems.filter(Boolean).length < 3 && window.__ItemDatabase) {
      const items = window.__ItemDatabase.getWeightedShopItems(3, 1, [], 1);
      g.shopItems = items.slice(0, 3);
    }
    g.state = 'shop';
    const ss = window.__shopScene; const L = ss ? ss.getShopLayout() : g.getShopLayout?.();
    const W = g.canvas.width, H = g.canvas.height;

    // Rebuild the exact card rects the draw/hit loops use.
    const cards = [];
    for (let i = 0; i < g.shopItems.length; i++) {
      if (!g.shopItems[i]) continue;
      const col = i % L.cols, row = Math.floor(i / L.cols);
      cards.push({
        x: L.startX + col * (L.itemWidth + L.gap),
        y: L.startY + row * (L.itemHeight + L.gap),
        w: L.itemWidth, h: L.itemHeight,
      });
    }
    const cont = { x: W/2 - L.buttonWidth/2, y: L.continueY, w: L.buttonWidth, h: L.buttonHeight };
    const rer  = { x: W/2 - L.buttonWidth/2, y: L.rerollY,   w: L.buttonWidth, h: L.buttonHeight };
    // Stats panel header rect (mirrors drawShop): mobile full-width top strip.
    const isMobile = L.isMobile;
    const zoom = L.zoom;
    const sp = (v) => Math.round(v * zoom);
    const stats = {
      x: sp(10), y: isMobile ? sp(64) : sp(56),
      w: isMobile ? W - sp(20) : sp(220),
      h: isMobile ? sp(38) : sp(140),
    };
    // Inventory panel is desktop-only (right column), drawn when items are owned.
    const inv = (!isMobile && g.playerStats.items.length > 0)
      ? { x: W - sp(230), y: sp(56), w: sp(220), h: sp(200) }
      : null;
    return { W, H, cards, cont, rer, stats, inv, cols: L.cols };
  });

  if (data.fatal) { console.log(`FATAL ${size.name}: ${data.fatal}`); failures++; continue; }

  const { W, H, cards, cont, rer, stats, inv } = data;
  const issues = [];

  // 1. cards vs buttons
  for (let i = 0; i < cards.length; i++) {
    if (overlaps(cards[i], cont)) issues.push(`card${i} overlaps CONTINUE`);
    if (overlaps(cards[i], rer))  issues.push(`card${i} overlaps REROLL`);
  }
  // 2. cards vs each other
  for (let i = 0; i < cards.length; i++)
    for (let j = i+1; j < cards.length; j++)
      if (overlaps(cards[i], cards[j])) issues.push(`card${i} overlaps card${j}`);
  // 3. within canvas bounds
  const inBounds = (r, n) => {
    if (r.x < 0 || r.y < 0 || r.x + r.w > W + 1 || r.y + r.h > H + 1)
      issues.push(`${n} out of bounds (${r.x},${r.y},${r.w}x${r.h} in ${W}x${H})`);
  };
  cards.forEach((c,i) => inBounds(c, `card${i}`));
  inBounds(cont, 'continue'); inBounds(rer, 'reroll');
  // 4. header: no card may overlap the stats panel (full-width strip on mobile,
  //    left-side column on desktop) — a true rect test, since desktop cards sit
  //    to the RIGHT of the panel and legitimately start higher than its bottom.
  cards.forEach((c, i) => { if (overlaps(c, stats)) issues.push(`card${i} overlaps stats panel`); });
  if (inv) cards.forEach((c, i) => { if (overlaps(c, inv)) issues.push(`card${i} overlaps inventory panel`); });

  const shot = path.join(SHOTS, `shop-${size.name}.png`);
  await page.screenshot({ path: shot });

  const ok = issues.length === 0;
  if (!ok) failures++;
  report.push(`${ok ? 'PASS' : 'FAIL'}  ${size.name.padEnd(22)} ${size.w}x${size.h}  cols=${data.cols} cards=${cards.length}` + (ok ? '' : `\n        → ${issues.join('; ')}`));
}

console.log('\n=== SHOP LAYOUT QA ===');
report.forEach(r => console.log(r));
if (errors.length) { console.log('\nConsole/page errors:'); errors.slice(0,10).forEach(e => console.log('  ' + e)); }
console.log(`\n${failures === 0 && errors.length === 0 ? '✅ ALL PASS' : '❌ FAILURES: ' + failures + (errors.length ? ' + ' + errors.length + ' errors' : '')}`);

await browser.close();
server.close();
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
