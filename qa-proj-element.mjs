#!/usr/bin/env node
// Behavioral verification for PROJECTILE ELEMENT TINTING (task t-89b66d).
// Builds the SHIPPED bundle (frontend/dist), drives it headless, and asserts the
// real runtime behavior — not a claim. Mirrors qa-damagetype.mjs.
//
// What it proves:
//   A. No elemental items -> getShotElement()='physical'; a real shot volley is all
//      'physical' with the default cyan color (backward compatible).
//   B..E. A burn/freeze/chain/poison item -> the build's shots become fire/ice/
//      lightning/poison and carry the matching ELEMENT_COLORS tint.
//   F. Priority: with two elements, the strongest wins (freeze 0.9 beats burn 0.5).
//   G. REACHABILITY (cp-b7): drive the genuine Player.shoot() with a real enemy and
//      forceFire, and assert the RETURNED projectiles carry the element — not just the
//      getter. This is the path the game actually fires through every frame.
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
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game handle' };
  g.startNewGame();
  g.state = 'playing';
  if (!g.player) return { fatal: `no player after startNewGame (state=${g.state})` };

  const s = g.playerStats;
  const out = {};
  let __tn = 0;
  const give = (fields) => { const it = { id: `__test_${__tn++}`, __test: true, tags: [], ...fields }; s.addItem(it); return it; };
  const clear = () => { for (const it of s.items.filter(i => i.__test)) s.removeItem(it.id); };

  // Fire a genuine volley through Player.shoot() and report the element+color the
  // returned projectiles actually carry (the real per-frame firing path).
  const fireEl = () => {
    const e = { x: g.player.x + 60, y: g.player.y, dead: false, typeData: { isBoss: false } };
    const shots = g.player.tryShoot([e], true); // forceFire bypasses cooldown
    if (!shots || shots.length === 0) return { n: 0 };
    return { n: shots.length, type: shots[0].damageType, color: shots[0].color,
             allSame: shots.every(p => p.damageType === shots[0].damageType) };
  };

  // --- A: no elemental items -> physical ---
  clear();
  out.A_getter = s.getShotElement();
  out.A_shot = fireEl();

  // --- B: burn -> fire ---
  clear(); give({ burn: 0.5 });
  out.B_getter = s.getShotElement();
  out.B_shot = fireEl();

  // --- C: freeze -> ice ---
  clear(); give({ freeze: 0.5 });
  out.C_getter = s.getShotElement();
  out.C_shot = fireEl();

  // --- D: chain lightning -> lightning ---
  clear(); give({ chainLightning: 0.5 });
  out.D_getter = s.getShotElement();
  out.D_shot = fireEl();

  // --- E: poison -> poison ---
  clear(); give({ poison: true });
  out.E_getter = s.getShotElement();
  out.E_shot = fireEl();

  // --- F: priority (freeze 0.9 beats burn 0.5) -> ice ---
  clear(); give({ burn: 0.5 }); give({ freeze: 0.9 });
  out.F_getter = s.getShotElement();

  clear();
  return out;
});

await browser.close();
server.close();

console.log('\n=== Projectile element-tint verification (on shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const C = {
  physical: '#00ffff', fire: '#ff6b2b', ice: '#7fdfff', lightning: '#ffd43b', poison: '#7bd44f',
};
const okShot = (shot, el) => shot && shot.n > 0 && shot.type === el && shot.color === C[el] && shot.allSame === true;
const pass = result && !result.fatal
  && result.A_getter === 'physical' && okShot(result.A_shot, 'physical')
  && result.B_getter === 'fire' && okShot(result.B_shot, 'fire')
  && result.C_getter === 'ice' && okShot(result.C_shot, 'ice')
  && result.D_getter === 'lightning' && okShot(result.D_shot, 'lightning')
  && result.E_getter === 'poison' && okShot(result.E_shot, 'poison')
  && result.F_getter === 'ice'
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
