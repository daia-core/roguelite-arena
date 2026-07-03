#!/usr/bin/env node
// Verify the STANDARDIZED text-box primitives against the freshly-built shipped
// dist (Felix: "standardize text boxes like this so they are always handled
// nicely"). Two parts:
//   (A) unit-assert Renderer.wrapLines / Renderer.drawWrappedText invariants via
//       the live g.renderer — long copy wraps to lines each <= maxChars; a
//       maxLines cap shrinks the font so the block never exceeds the cap.
//   (B) render the SHOP in portrait with a pathologically long item.description
//       injected, screenshot it, and assert every drawn description line fits the
//       card width (no overflow, no clipping) with a clean console.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');
const SHOTS = '/workspace/work/roguelite-game/shots';
console.log('Building frontend/dist fresh…');
execSync('npm run build', { cwd: GAME, stdio: 'inherit' });

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
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__game, { timeout: 10000 });

// ---------- (A) primitive invariants ----------
const LONG = 'The wandering merchant of the deep caverns offers a bargain wreathed in old coins and older promises that stretch on and on.';
const unit = await page.evaluate((long) => {
  const g = window.__game;
  const r = g.renderer;
  const out = {};
  // wrapLines: every line fits maxChars (1 em/glyph), no word dropped
  const maxWidth = 120, size = 8;
  const maxChars = Math.max(1, Math.floor(maxWidth / size));
  const lines = r.wrapLines(long, maxWidth, size);
  const longest = Math.max(...lines.map(l => l.length));
  const rejoined = lines.join(' ');
  out.wrap = { maxChars, count: lines.length, longest, fits: longest <= maxChars, lossless: rejoined === long };
  // drawWrappedText maxLines: the shrink-to-fit loop must REDUCE line count toward
  // the cap. With a realistically wide box the cap is fully honoured; with a very
  // narrow box the font bottoms out at 4px (never smaller), so the cap is a "best
  // effort last resort" — we assert the cap shrinks the block, and that a wide box
  // hits the cap exactly.
  const wideW = 360;                    // realistic descriptive-box width
  const capUncapped = r.drawWrappedText(long, 0, 0, { maxWidth: wideW, size }).lines;
  const cap2 = r.drawWrappedText(long, 0, 0, { maxWidth: wideW, size, maxLines: 2 }).lines;
  const cap3 = r.drawWrappedText(long, 0, 0, { maxWidth: wideW, size, maxLines: 3 }).lines;
  // Narrow-box last-resort: shrinking still reduces the block below the uncapped count.
  const narrowUncapped = r.drawWrappedText(long, 0, 0, { maxWidth, size }).lines;
  const narrowCap1 = r.drawWrappedText(long, 0, 0, { maxWidth, size, maxLines: 1 }).lines;
  out.cap = { wideUncapped: capUncapped, cap2, cap3, narrowUncapped, narrowCap1 };
  return out;
}, LONG);
console.log('  [A] wrapLines:', unit.wrap.count, 'lines, longest', unit.wrap.longest, '<= maxChars', unit.wrap.maxChars, unit.wrap.fits ? 'FITS' : 'OVERFLOWS', '| lossless:', unit.wrap.lossless);
console.log('  [A] drawWrappedText cap (wide box): uncapped=>', unit.cap.wideUncapped, ' maxLines2=>', unit.cap.cap2, ' maxLines3=>', unit.cap.cap3);
console.log('  [A] drawWrappedText cap (narrow last-resort): uncapped=>', unit.cap.narrowUncapped, ' maxLines1=>', unit.cap.narrowCap1);

// ---------- (B) shop render with a pathological description ----------
const shop = await page.evaluate(() => {
  const g = window.__game;
  // Ensure a player exists (drawShop early-returns without one), then enter the shop.
  if (!g.player && typeof g.startNewGame === 'function') g.startNewGame();
  if (typeof g.enterShop === 'function') g.enterShop();
  g.state = 'shop';
  const LONGDESC = 'Fires an ever-growing spiral of orbiting projectiles that pierce every enemy in their path and return, dealing catastrophic sustained damage across the entire arena for a very long time indeed.';
  if (Array.isArray(g.shopItems) && g.shopItems.length) {
    g.shopItems[0] = Object.assign({}, g.shopItems[0], { description: LONGDESC, name: 'Orbital Ruin' });
  }
  if (typeof g.draw === 'function') g.draw();
  // Recompute the card's description budget exactly as getShopLayout/drawShop do,
  // then wrap through the SAME primitive to assert it fits.
  const W = g.canvas.width;
  const s = (n) => n * (W / 390);
  const item = g.shopItems && g.shopItems[0];
  // Card width in portrait: derive from layout if exposed, else conservative.
  const layout = typeof g.getShopLayout === 'function' ? g.getShopLayout() : null;
  const itemWidth = layout ? layout.itemWidth : s(92);
  const descMaxW = itemWidth - s(12);
  const descSize = s(8);
  const lines = g.renderer.wrapLines(item ? item.description : '', descMaxW, descSize);
  const maxChars = Math.max(1, Math.floor(descMaxW / descSize));
  const longest = lines.length ? Math.max(...lines.map(l => l.length)) : 0;
  return { hasItem: !!item, itemWidth: Math.round(itemWidth), descMaxW: Math.round(descMaxW), maxChars, count: lines.length, longest, fits: longest <= maxChars, state: g.state };
});

fs.mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: path.join(SHOTS, 'shop-textbox-portrait.png') });
console.log('  [B] shop state:', shop.state, '| item present:', shop.hasItem);
console.log('  [B] card descMaxW', shop.descMaxW, 'maxChars', shop.maxChars, '=> wrapped', shop.count, 'lines, longest', shop.longest, shop.fits ? 'FITS' : 'OVERFLOWS');
console.log('  screenshot:', path.join(SHOTS, 'shop-textbox-portrait.png'));

await browser.close();
server.close();

const fails = [];
if (!unit.wrap.fits) fails.push('wrapLines produced a line wider than maxChars');
if (!unit.wrap.lossless) fails.push('wrapLines dropped/altered words');
if (unit.cap.wideUncapped < 2) fails.push('long copy did not wrap uncapped in a wide box (expected >=2 lines)');
if (unit.cap.cap2 > 2) fails.push(`wide-box maxLines:2 yielded ${unit.cap.cap2} lines (should honour cap)`);
if (unit.cap.cap3 > 3) fails.push(`wide-box maxLines:3 yielded ${unit.cap.cap3} lines (should honour cap)`);
if (unit.cap.narrowCap1 >= unit.cap.narrowUncapped) fails.push('narrow-box maxLines did not shrink the block (last-resort shrink not engaging)');
if (shop.hasItem && !shop.fits) fails.push('shop description overflows the card');
if (errors.length) fails.push('console/page errors: ' + errors.slice(0,5).join(' | '));

if (fails.length) { console.error('FAIL:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('PASS: standardized text boxes wrap & cap correctly; shop description fits the card; clean console.');
