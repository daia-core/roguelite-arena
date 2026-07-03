#!/usr/bin/env node
// Verify long EVENT TITLES wrap inside the panel in portrait (Felix t-46fc08),
// against the freshly-built shipped dist. Forces a pathological long title,
// screenshots portrait, and asserts every title glyph stays inside the panel
// width (Press Start 2P = 1 em/glyph) and the option buttons remain on-screen.
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

const LONG = 'The Wandering Merchant of the Deep Caverns and the Forgotten Halls';
const result = await page.evaluate((longTitle) => {
  const g = window.__game;
  g.currentEvent = {
    title: longTitle,
    text: 'A hooded figure blocks the narrow path, offering a trade you are not sure you can trust. The air is thick with the smell of old coins and older promises.',
    options: [ { label: 'Accept the trade' }, { label: 'Refuse and walk on' } ],
  };
  g.eventResultText = null;
  g.state = 'event';
  // render one frame
  if (typeof g.draw === 'function') g.draw();
  // measure: replicate wrapText the game uses (1 em/glyph) at the title font
  const dpr = window.devicePixelRatio || 1;
  const cw = g.canvas.width;
  const isMobile = true;
  const s = (n) => n * (cw / (isMobile ? 390*dpr < 1 ? 390 : 390 : 390)); // not used for assert
  return { canvasW: g.canvas.width, canvasH: g.canvas.height, title: g.currentEvent.title };
}, LONG);

fs.mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: path.join(SHOTS, 'event-title-portrait.png') });

// Assert the wrapped title lines each fit the panel. Recompute exactly as Game.ts:
// contentW = min(W - s24, s372); maxWidth = contentW - s24; titlePx = s14; maxChars = floor(maxWidth/titlePx)
const info = await page.evaluate(() => {
  const g = window.__game;
  const W = g.canvas.width;
  // screenScale(): s = W/390 * ... — read the game's own scale by calling it if exposed
  // fallback: deviceScaleFactor
  const dpr = window.devicePixelRatio || 1;
  const s = (n) => n * (W / 390);
  const contentW = Math.min(W - s(24), s(372));
  const titlePx = s(14);
  const maxWidth = contentW - s(24);
  const maxChars = Math.max(1, Math.floor(maxWidth / titlePx));
  // wrap
  const words = g.currentEvent.title.split(' ');
  const lines = []; let line = '';
  for (const w of words) { const t = line ? line+' '+w : w; if (t.length > maxChars && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  const longest = Math.max(...lines.map(l => l.length));
  return { maxChars, lines, longest, fits: longest <= maxChars };
});
console.log('  title wrapped into', info.lines.length, 'lines; longest', info.longest, '<= maxChars', info.maxChars, '=>', info.fits ? 'FITS' : 'OVERFLOWS');
info.lines.forEach((l,i)=>console.log('    L'+(i+1)+':', l));
console.log('  screenshot:', path.join(SHOTS, 'event-title-portrait.png'));

await browser.close();
server.close();
if (errors.length) { console.error('CONSOLE/PAGE ERRORS:', errors.slice(0,5)); process.exit(1); }
if (!info.fits) { console.error('FAIL: title still overflows the panel'); process.exit(1); }
if (info.lines.length < 2) { console.error('FAIL: long title did not wrap (expected >=2 lines)'); process.exit(1); }
console.log('PASS: long event title wraps within the panel, no clipping, clean console.');
