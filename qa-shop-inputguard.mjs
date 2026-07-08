#!/usr/bin/env node
// Verifies the held-touch INSTA-BUY fix: a press that was already down when the
// shop opens must NOT buy an item — a fresh touchdown is required.
// Reproduces the report: hold to move → wave ends → shop opens under the finger.
//   A. Held press across the playing→shop transition buys NOTHING on entry.
//   B. After releasing and pressing fresh over a card, the purchase DOES go through.
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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 600));

const out = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game' };
  const canvas = g.canvas;

  g.startNewGame();
  // Simulate the finger held down DURING gameplay (touchstart set mouseDown).
  g.state = 'playing';
  g.update(0.016);            // establish lastUpdateState = 'playing'
  g.input.mouseDown = true;   // finger is physically held

  // Wave ends → shop opens (still holding).
  g.enterShop();
  g.player.gold = 9999;       // plenty to afford anything

  // Aim the held finger at the centre of card 0.
  const ss = window.__shopScene; const L = ss ? ss.getShopLayout() : g.getShopLayout?.();
  const cx = L.startX + L.itemWidth / 2;
  const cy = L.startY + L.itemHeight / 2;
  g.input.mouseX = cx; g.input.mouseY = cy;

  const itemsBefore = g.playerStats.items.length;
  const goldBefore = g.player.gold;

  // First shop tick with the HELD press: the transition guard must disarm it.
  g.update(0.016);
  const heldBought = g.playerStats.items.length !== itemsBefore || g.player.gold !== goldBefore;

  // Now RELEASE then a FRESH press (mousedown) over the same card. (Uses the mouse
  // path — it shares the same pressDisarmed logic as touch and needs no synthetic
  // TouchEvent, which headless Chromium can't construct with changedTouches.)
  canvas.dispatchEvent(new MouseEvent('mouseup'));   // clears the disarm
  g.input.mouseX = cx; g.input.mouseY = cy;
  canvas.dispatchEvent(new MouseEvent('mousedown')); // fresh press → mouseDown=true
  const goldBefore2 = g.player.gold;
  const itemsBefore2 = g.playerStats.items.length;
  g.update(0.016);
  const freshBought = g.playerStats.items.length > itemsBefore2 || g.player.gold < goldBefore2;

  return { heldBought, freshBought };
});

console.log('\n=== SHOP INPUT-GUARD QA ===');
if (out.fatal) { console.log('FATAL: ' + out.fatal); process.exit(1); }
const aPass = out.heldBought === false;
const bPass = out.freshBought === true;
console.log(`${aPass ? 'PASS' : 'FAIL'}  A: held press across playing→shop buys nothing  (bought=${out.heldBought})`);
console.log(`${bPass ? 'PASS' : 'FAIL'}  B: fresh touchdown over a card DOES purchase     (bought=${out.freshBought})`);
if (errors.length) { console.log('\nErrors:'); errors.slice(0,8).forEach(e => console.log('  ' + e)); }
const ok = aPass && bPass && errors.length === 0;
console.log(`\n${ok ? '✅ ALL PASS' : '❌ FAIL'}`);

await browser.close();
server.close();
process.exit(ok ? 0 : 1);
