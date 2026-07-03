#!/usr/bin/env node
// QA for the raw-shape→sprite conversion (worms, orbiting orb, bomb, XP orb).
// Verifies every newly-referenced sprite name resolves to a real sprite with
// drawn (non-transparent) pixels, then screenshots them enlarged for eyeballing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/pixel-art';
fs.mkdirSync(OUT, { recursive: true });

console.log('Building frontend...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.css':'text/css' };
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

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
  defaultViewport: { width: 800, height: 300 },
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

// The names our converted draw() methods now call SpriteSheet.get() with.
const NAMES = ['worm_head','worm_body','orbiting_orb','bomb','xp'];

const result = await page.evaluate((names) => {
  const SS = window.__SpriteSheet;
  if (!SS) return { error: 'SpriteSheet not exposed on window (__SpriteSheet)' };
  const out = {};
  for (const n of names) {
    const s = SS.get(n);
    if (!s) { out[n] = { ok: false, reason: 'null sprite' }; continue; }
    // Count non-transparent pixels to prove it actually drew something.
    const c = document.createElement('canvas');
    c.width = s.width; c.height = s.height;
    const cx = c.getContext('2d');
    cx.drawImage(s, 0, 0);
    const d = cx.getImageData(0, 0, s.width, s.height).data;
    let painted = 0, colors = new Set();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i+3] > 0) { painted++; colors.add(`${d[i]},${d[i+1]},${d[i+2]}`); }
    }
    out[n] = { ok: painted > 0, w: s.width, h: s.height, painted, colors: colors.size };
  }
  return out;
}, NAMES);

console.log('\n=== Sprite resolution ===');
let fail = false;
if (result.error) { console.log('ERROR:', result.error); fail = true; }
else {
  for (const n of NAMES) {
    const r = result[n];
    const status = r.ok ? 'OK ' : 'FAIL';
    if (!r.ok) fail = true;
    console.log(`  [${status}] ${n.padEnd(14)} ${r.ok ? `${r.w}x${r.h}, ${r.painted}px, ${r.colors} colors` : r.reason}`);
  }
}

// Render all sprites enlarged onto the page for a visual sheet.
await page.evaluate((names) => {
  const SS = window.__SpriteSheet;
  document.body.innerHTML = '';
  document.body.style.background = '#0f0f1e';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:24px;padding:24px;align-items:flex-end;';
  for (const n of names) {
    const s = SS.get(n); if (!s) continue;
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px;';
    const c = document.createElement('canvas');
    const scale = 4;
    c.width = s.width * scale; c.height = s.height * scale;
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
    cx.drawImage(s, 0, 0, c.width, c.height);
    c.style.cssText = 'image-rendering:pixelated;border:1px solid #333;';
    const label = document.createElement('div');
    label.textContent = n; label.style.cssText = 'color:#eee;font-family:monospace;font-size:12px;';
    box.appendChild(c); box.appendChild(label); wrap.appendChild(box);
  }
  document.body.appendChild(wrap);
}, NAMES);

await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: path.join(OUT, 'converted-sprites.png') });

await browser.close();
server.close();

console.log('\nConsole errors:', consoleErrors.length);
consoleErrors.slice(0, 10).forEach(e => console.log('  -', e));
console.log(`Sprite sheet → ${OUT}/converted-sprites.png`);
if (fail || consoleErrors.length) { console.log('\nRESULT: FAIL'); process.exit(1); }
console.log('\nRESULT: PASS');
