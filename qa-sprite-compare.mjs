#!/usr/bin/env node
// SPRITE BEFORE/AFTER COMPARISON HARNESS.
// Felix's rule: every sprite change must be proven visibly better than what it replaced.
//
//   MODE=baseline node qa-sprite-compare.mjs   → renders the CURRENT sprites (run this
//                                                 BEFORE editing) to shots/sprite-baseline/<name>.png
//   MODE=after    node qa-sprite-compare.mjs   → renders the NEW sprites and composites each
//                                                 next to its saved baseline into
//                                                 shots/sprite-compare/<name>.png (BEFORE | AFTER),
//                                                 plus a single contact sheet sprite-compare-sheet.png
//
// Sprites are drawn at 8× nearest-neighbour so individual pixels + shading read clearly.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const MODE = (process.env.MODE || 'baseline').toLowerCase();
const ONLY = process.env.SPRITES ? process.env.SPRITES.split(',').map(s => s.trim()) : null;
const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const SHOTS = '/workspace/work/roguelite-game/shots';
const BASELINE_DIR = path.join(SHOTS, 'sprite-baseline');
const COMPARE_DIR = path.join(SHOTS, 'sprite-compare');
fs.mkdirSync(BASELINE_DIR, { recursive: true });
fs.mkdirSync(COMPARE_DIR, { recursive: true });

// The full sprite roster. Override with SPRITES=player,slime,... to focus a pass.
const ALL_SPRITES = [
  'player',
  'slime','goblin','skeleton','demon','imp','orc','wraith','necromancer','troll','banshee',
  'bat','wizard','mimic','spider','golem','ghost','mushroom','gargoyle','blob','necroegg',
  'cyclops','phantom','druid','construct','swarm','dasher','evader','orbiter','spiraler',
  'bullet','enemy_bullet','orbiting_orb','bomb','xp','gold','health_orb',
];
const NAMES = ONLY || ALL_SPRITES;

console.log(`Building frontend...`);
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
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1000));

// Extract each sprite as an 8×-upscaled PNG data URL (crisp nearest-neighbour).
const SCALE = 8;
const rendered = await page.evaluate((names, scale) => {
  const SS = window.__SpriteSheet;
  if (!SS) return { fatal: 'no __SpriteSheet handle' };
  const out = [];
  for (const name of names) {
    const src = SS.get(name);
    if (!src) { out.push({ name, missing: true }); continue; }
    const w = src.width, h = src.height;
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = h * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    out.push({ name, dataUrl: c.toDataURL('image/png'), w: c.width, h: c.height });
  }
  return { out };
}, NAMES, SCALE);

if (rendered.fatal) { console.error('FATAL:', rendered.fatal); await browser.close(); server.close(); process.exit(1); }

const dataUrlToBuf = (u) => Buffer.from(u.split(',')[1], 'base64');
const missing = rendered.out.filter(r => r.missing).map(r => r.name);

if (MODE === 'baseline') {
  let n = 0;
  for (const r of rendered.out) {
    if (r.missing) continue;
    fs.writeFileSync(path.join(BASELINE_DIR, `${r.name}.png`), dataUrlToBuf(r.dataUrl));
    n++;
  }
  console.log(`\nBaseline saved: ${n} sprites → ${BASELINE_DIR}`);
  if (missing.length) console.log('  Missing (no sprite registered):', missing.join(', '));
} else {
  // AFTER: composite each new sprite next to its baseline, and build a contact sheet.
  const baselines = {};
  for (const r of rendered.out) {
    const bp = path.join(BASELINE_DIR, `${r.name}.png`);
    if (fs.existsSync(bp)) baselines[r.name] = 'data:image/png;base64,' + fs.readFileSync(bp).toString('base64');
  }
  const composites = await page.evaluate(async (items, baselines) => {
    const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = u; });
    const results = [];
    const PAD = 16, LABEL = 22, GAP = 24;
    for (const it of items) {
      if (it.missing) continue;
      const after = await load(it.dataUrl);
      const before = baselines[it.name] ? await load(baselines[it.name]) : null;
      const cellW = it.w, cellH = it.h;
      const totalW = PAD*2 + cellW*2 + GAP;
      const totalH = PAD*2 + LABEL + cellH;
      const c = document.createElement('canvas');
      c.width = totalW; c.height = totalH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#20222b'; ctx.fillRect(0,0,totalW,totalH);
      ctx.fillStyle = '#cfd3dc'; ctx.font = 'bold 16px monospace'; ctx.textBaseline = 'top';
      ctx.fillText('BEFORE', PAD, 6);
      ctx.fillText('AFTER', PAD + cellW + GAP, 6);
      ctx.fillStyle = '#7fd08a'; ctx.font = '13px monospace';
      ctx.fillText(it.name, PAD + cellW + GAP, totalH - 18);
      // checker backdrop so transparency + shading read
      const drawChecker = (ox) => { for (let y=0;y<cellH;y+=16) for (let x=0;x<cellW;x+=16){ ctx.fillStyle=((x/16+y/16)%2)?'#2b2e39':'#33374a'; ctx.fillRect(ox+x, PAD+LABEL+y, 16,16);} };
      drawChecker(PAD); drawChecker(PAD+cellW+GAP);
      if (before) ctx.drawImage(before, PAD, PAD+LABEL, cellW, cellH);
      ctx.drawImage(after, PAD+cellW+GAP, PAD+LABEL, cellW, cellH);
      results.push({ name: it.name, dataUrl: c.toDataURL('image/png'), w: totalW, h: totalH });
    }
    return results;
  }, rendered.out, baselines);

  for (const r of composites) fs.writeFileSync(path.join(COMPARE_DIR, `${r.name}.png`), dataUrlToBuf(r.dataUrl));
  console.log(`\nComparisons saved: ${composites.length} → ${COMPARE_DIR}`);
  const noBaseline = rendered.out.filter(r => !r.missing && !baselines[r.name]).map(r => r.name);
  if (noBaseline.length) console.log('  ⚠ no baseline captured for:', noBaseline.join(', '), '(run MODE=baseline first)');
  if (missing.length) console.log('  Missing sprites:', missing.join(', '));
}

await browser.close();
server.close();
console.log('Page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
process.exit(0);
