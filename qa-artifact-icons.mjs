#!/usr/bin/env node
// QA for artifact icons — asserts every artifact's icon resolves to a painted
// pixel sprite (never a raw emoji / blank) and screenshots a labeled sheet so the
// new authored glyphs (book, banner) can be eyeballed. Assumes dist/ is built.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT_DIR = '/workspace/work/roguelite-game';
const FRONTEND = path.join(ROOT_DIR, 'frontend');
const DIST = path.join(FRONTEND, 'dist');
const OUT = path.join(ROOT_DIR, 'shots/pixel-art');
fs.mkdirSync(OUT, { recursive: true });

const src = fs.readFileSync(path.join(FRONTEND, 'src/ArtifactSystem.ts'), 'utf8');
// Pull {name, icon} pairs in roster order.
const ARTS = [...src.matchAll(/name:\s*(?:'([^']*)'|"([^"]*)"),\s*icon:\s*'([^']*)'/g)]
  .map(m => ({ name: m[1] || m[2], icon: m[3] }));
console.log(`Found ${ARTS.length} artifacts`);

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css' };
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
  defaultViewport: { width: 900, height: 700 },
});
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate((arts) => {
  const getIcon = window.__getItemIcon;
  if (!getIcon) return { error: 'window.__getItemIcon not exposed' };
  const out = [];
  for (const a of arts) {
    try {
      const s = getIcon(a.icon);
      const c = document.createElement('canvas'); c.width = s.width; c.height = s.height;
      const cx = c.getContext('2d'); cx.drawImage(s, 0, 0);
      const d = cx.getImageData(0, 0, s.width, s.height).data;
      let painted = 0; const colors = new Set();
      for (let i = 0; i < d.length; i += 4) if (d[i+3] > 0) { painted++; colors.add(`${d[i]},${d[i+1]},${d[i+2]}`); }
      out.push({ name: a.name, icon: a.icon, ok: painted > 4 && colors.size >= 2, painted, colors: colors.size });
    } catch (err) { out.push({ name: a.name, icon: a.icon, ok: false, reason: String(err) }); }
  }
  return { out };
}, ARTS);

let fail = false;
if (result.error) { console.log('ERROR:', result.error); fail = true; }
else for (const r of result.out) {
  const tag = r.ok ? 'ok  ' : 'FAIL';
  if (!r.ok) fail = true;
  console.log(`  [${tag}] ${r.name.padEnd(20)} ${r.icon}  ${r.reason || `${r.painted}px ${r.colors}c`}`);
}

// Visual sheet with names.
await page.evaluate((arts) => {
  const getIcon = window.__getItemIcon;
  document.body.innerHTML = '';
  document.body.style.background = '#0f0f1e';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;padding:18px;align-items:flex-start;';
  for (const a of arts) {
    const s = getIcon(a.icon); if (!s) continue;
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;width:120px;';
    const c = document.createElement('canvas');
    const scale = 1.4;
    c.width = Math.round(s.width * scale); c.height = Math.round(s.height * scale);
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
    cx.drawImage(s, 0, 0, c.width, c.height);
    c.style.cssText = 'image-rendering:pixelated;border:1px solid #333;background:#1a1a2e;';
    const label = document.createElement('div');
    label.textContent = a.name; label.style.cssText = 'color:#eee;font-size:12px;text-align:center;';
    box.appendChild(c); box.appendChild(label); wrap.appendChild(box);
  }
  document.body.appendChild(wrap);
}, ARTS);
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: path.join(OUT, 'artifact-icons.png'), fullPage: true });

await browser.close();
server.close();
console.log('\nConsole errors:', consoleErrors.length);
consoleErrors.slice(0, 10).forEach(e => console.log('  -', e));
console.log(`Artifact sheet -> ${OUT}/artifact-icons.png`);
if (fail || consoleErrors.length) { console.log('\nRESULT: FAIL'); process.exit(1); }
console.log('\nRESULT: PASS');
