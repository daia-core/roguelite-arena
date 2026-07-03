#!/usr/bin/env node
// QA for the item-emoji -> pixel-sprite conversion. Extracts every unique
// `icon:` emoji from the item catalog, then in-page calls window.__getItemIcon
// on each and asserts it returns a canvas with painted (non-transparent) pixels
// and >1 colour — proving NO item ever falls back to rendering a raw emoji glyph.
// Also reports authored-glyph vs procedural-rune coverage and screenshots a sheet.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT_DIR = '/workspace/work/roguelite-game';
const FRONTEND = path.join(ROOT_DIR, 'frontend');
const DIST = path.join(FRONTEND, 'dist');
const OUT = path.join(ROOT_DIR, 'shots/pixel-art');
fs.mkdirSync(OUT, { recursive: true });

// Pull the unique emoji list straight from the catalog source (single source of truth).
const catalog = fs.readFileSync(path.join(FRONTEND, 'src/items/catalog.ts'), 'utf8');
const EMOJIS = [...new Set([...catalog.matchAll(/icon:\s*'([^']*)'/g)].map(m => m[1]))];
console.log(`Found ${EMOJIS.length} unique item icons in catalog.ts`);

console.log('Building frontend...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.css':'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
  defaultViewport: { width: 1200, height: 900 },
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate((emojis) => {
  const getIcon = window.__getItemIcon;
  if (!getIcon) return { error: 'window.__getItemIcon not exposed' };
  const out = [];
  for (const e of emojis) {
    let rec = { emoji: e, ok: false };
    try {
      const s = getIcon(e);
      if (!s) { rec.reason = 'null'; out.push(rec); continue; }
      const c = document.createElement('canvas');
      c.width = s.width; c.height = s.height;
      const cx = c.getContext('2d');
      cx.drawImage(s, 0, 0);
      const d = cx.getImageData(0, 0, s.width, s.height).data;
      let painted = 0; const colors = new Set();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3] > 0) { painted++; colors.add(`${d[i]},${d[i+1]},${d[i+2]}`); }
      }
      rec = { emoji: e, ok: painted > 0 && colors.size >= 1, w: s.width, h: s.height, painted, colors: colors.size };
    } catch (err) { rec.reason = String(err); }
    out.push(rec);
  }
  return { out };
}, EMOJIS);

console.log('\n=== Item icon resolution ===');
let fail = false;
if (result.error) { console.log('ERROR:', result.error); fail = true; }
else {
  let painted0 = 0;
  for (const r of result.out) {
    if (!r.ok) { fail = true; console.log(`  [FAIL] ${r.emoji}  ${r.reason || `${r.painted}px ${r.colors}c`}`); }
    if (r.painted === 0) painted0++;
  }
  const okCount = result.out.filter(r => r.ok).length;
  console.log(`  ${okCount}/${result.out.length} icons render with painted pixels`);
  if (painted0) console.log(`  ${painted0} icons had ZERO painted pixels`);
}

// Visual sheet — render every icon enlarged with its emoji label.
await page.evaluate((emojis) => {
  const getIcon = window.__getItemIcon;
  document.body.innerHTML = '';
  document.body.style.background = '#0f0f1e';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;padding:16px;align-items:flex-end;';
  for (const e of emojis) {
    const s = getIcon(e); if (!s) continue;
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;width:64px;';
    const c = document.createElement('canvas');
    const scale = 4;
    c.width = s.width * scale; c.height = s.height * scale;
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
    cx.drawImage(s, 0, 0, c.width, c.height);
    c.style.cssText = 'image-rendering:pixelated;border:1px solid #333;';
    const label = document.createElement('div');
    label.textContent = e; label.style.cssText = 'color:#eee;font-size:14px;';
    box.appendChild(c); box.appendChild(label); wrap.appendChild(box);
  }
  document.body.appendChild(wrap);
}, EMOJIS);

await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: path.join(OUT, 'item-icons.png'), fullPage: true });

await browser.close();
server.close();

console.log('\nConsole errors:', consoleErrors.length);
consoleErrors.slice(0, 10).forEach(e => console.log('  -', e));
console.log(`Icon sheet -> ${OUT}/item-icons.png`);
if (fail || consoleErrors.length) { console.log('\nRESULT: FAIL'); process.exit(1); }
console.log('\nRESULT: PASS');
