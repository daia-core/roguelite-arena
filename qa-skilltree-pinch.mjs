// Headless QA for pinch-to-zoom on the skill-tree screen (Felix, 2026-07-06).
// Dispatches real two-finger TouchEvents at the canvas and asserts the web zooms
// with the spread, zooms out on a pinch-in, stays within clamps, and that a
// two-finger gesture never leaks a node-allocating tap.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
console.log('Building frontend (npm run build)...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const pg = await b.newPage();
await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errs = [];
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(base, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 800));

const frame = () => new Promise(r => setTimeout(r, 120));

// Fire a multi-touch event of `type` with fingers at canvas-relative points [{x,y},...].
async function touch(type, pts) {
  await pg.evaluate((type, pts) => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    const touches = pts.map((p, i) => new Touch({
      identifier: i + 1, target: c,
      clientX: r.left + p.x, clientY: r.top + p.y,
    }));
    c.dispatchEvent(new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches, targetTouches: touches, changedTouches: touches,
    }));
  }, type, pts);
}

// Enter the skill-tree screen with some points banked.
await pg.evaluate(() => {
  const g = window.__game;
  const gunner = window.__STARTING_CLASSES.find(c => c.id === 'gunner');
  g.beginRun(gunner);
  g.skillTree.grantPoints(5);
  g.openSkillTree(false);
});
await frame();

const read = () => pg.evaluate(() => ({
  zoom: window.__game.stZoom,
  state: window.__game.state,
  spent: window.__game.skillTree.spentCount(),
}));

const R = [];
const ok = (name, cond, extra) => R.push({ name, pass: !!cond, extra: extra ?? '' });

const base0 = await read();
ok('on skill-tree screen', base0.state === 'skilltree', base0.state);

// --- Pinch OUT: two fingers spreading apart should zoom IN (stZoom up) ---
const cx = 195, cy = 400;
await touch('touchstart', [{ x: cx - 30, y: cy }, { x: cx + 30, y: cy }]);
await frame();
await touch('touchmove', [{ x: cx - 120, y: cy }, { x: cx + 120, y: cy }]);
await frame();
const spread = await read();
ok('spreading fingers zooms in', spread.zoom > base0.zoom + 1e-3, `${base0.zoom.toFixed(3)}→${spread.zoom.toFixed(3)}`);
ok('two-finger gesture allocates nothing', spread.spent === 0, `spent=${spread.spent}`);

// --- Pinch IN: bring fingers together should zoom OUT (stZoom down) ---
await touch('touchmove', [{ x: cx - 20, y: cy }, { x: cx + 20, y: cy }]);
await frame();
const pinched = await read();
ok('pinching fingers zooms out', pinched.zoom < spread.zoom - 1e-3, `${spread.zoom.toFixed(3)}→${pinched.zoom.toFixed(3)}`);
await touch('touchend', []);
await frame();

// --- Upper clamp: an extreme spread never exceeds the 1.4 ceiling ---
await touch('touchstart', [{ x: cx - 10, y: cy }, { x: cx + 10, y: cy }]);
await frame();
await touch('touchmove', [{ x: 0, y: cy }, { x: 390, y: cy }]);
await frame();
await touch('touchmove', [{ x: 0, y: 0 }, { x: 390, y: 844 }]);
await frame();
const hi = await read();
ok('zoom clamps at the 1.4 ceiling', hi.zoom <= 1.4 + 1e-6, `${hi.zoom.toFixed(3)}`);
await touch('touchend', []);
await frame();

// --- Lower clamp: an extreme pinch never drops below the 0.16 floor ---
await touch('touchstart', [{ x: 0, y: 0 }, { x: 390, y: 844 }]);
await frame();
await touch('touchmove', [{ x: cx - 2, y: cy }, { x: cx + 2, y: cy }]);
await frame();
const lo = await read();
ok('zoom clamps at the 0.16 floor', lo.zoom >= 0.16 - 1e-6, `${lo.zoom.toFixed(3)}`);
await touch('touchend', []);
await frame();

// --- After the pinch, the node-allocation path is still intact ---
const singleOk = await pg.evaluate(() => {
  const g = window.__game;
  const T = window.__SKILL_TREE;
  const byId = Object.fromEntries(T.SKILL_NODES.map(n => [n.id, n]));
  const near = T.neighborsOf('start_gunner').find(id => byId[id].type !== 'start');
  const before = g.skillTree.spentCount();
  g.skillTree.allocate(near); // proves the allocation path is untouched by the pinch work
  return g.skillTree.spentCount() === before + 1;
});
ok('single-node allocation still works post-pinch', singleOk);

console.log('\nSKILL TREE PINCH QA\n' + '='.repeat(50));
let fails = 0;
for (const r of R) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? '  [' + r.extra + ']' : ''}`);
  if (!r.pass) fails++;
}
console.log('='.repeat(50));
console.log(`${R.length - fails}/${R.length} passed`);
if (errs.length) { console.log('\nCONSOLE/PAGE ERRORS:'); errs.forEach(e => console.log('  ' + e)); }
await b.close();
server.close();
process.exit(fails === 0 && errs.length === 0 ? 0 : 1);
