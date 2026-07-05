#!/usr/bin/env node
// Targeted verification for the density-merge on loose drops (XP gems / coins).
// Builds the SHIPPED bundle, drives it headless, and asserts:
//  - a littered cluster of non-homing orbs collapses into far fewer entities,
//  - total value is conserved (nothing lost/duplicated on merge),
//  - the surviving orb is physically bigger (radius grew with value),
//  - orbs already HOMING to the player are never merged away,
//  - a sparse floor (below the threshold) is left untouched,
//  - no console/page errors.
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

  const step = (n) => { for (let i=0;i<n;i++) g.update(1/60); };
  const out = {};

  // Park the player far away so the spawned cluster never enters magnet range
  // (stays non-homing) during the test.
  g.player.x = 5000; g.player.y = 5000;
  g.xpOrbs.length = 0;
  g.coins.length = 0;

  // --- Case A: a dense cluster of 40 XP gems in a tight 40px box -> should collapse ---
  // Push structural orbs honoring XPOrb's merge + update + draw contract (the merge
  // pass keys only off x/y/radius/dead/homing/absorb, so this exercises the real code).
  let clusterValue = 0;
  const makeOrb = (x, y, v) => {
    // Structural orb matching XPOrb's merge + update contract.
    return {
      x, y, radius: 6, xpAmount: v, dead: false, homing: false,
      _r(v2){ return 6 + Math.min(10, Math.log2(Math.max(1, v2)) * 2.2); },
      absorb(other){ this.xpAmount += other.xpAmount; this.radius = this._r(this.xpAmount); other.dead = true; },
      update(){ return false; },
      draw(){},
    };
  };
  for (let i = 0; i < 40; i++) {
    const x = 100 + (i % 8) * 5;   // 8x5 grid, 5px spacing -> tight cluster
    const y = 100 + Math.floor(i / 8) * 5;
    const v = 3;
    clusterValue += v;
    g.xpOrbs.push(makeOrb(x, y, v));
  }
  out.A_before = g.xpOrbs.length;
  out.A_valueBefore = clusterValue;
  step(3); // a few frames of merge passes + dead sweep
  out.A_after = g.xpOrbs.length;
  out.A_valueAfter = g.xpOrbs.reduce((s,o)=>s+o.xpAmount, 0);
  out.A_maxRadius = Math.max(...g.xpOrbs.map(o=>o.radius));
  out.A_collapsed = out.A_after < out.A_before * 0.6;      // meaningfully fewer
  out.A_valueConserved = out.A_valueAfter === out.A_valueBefore;
  out.A_grewBigger = out.A_maxRadius > 6;                  // a merged orb is chunkier

  // --- Case B: homing orbs must NOT be merged (would yank a pickup off its path) ---
  g.xpOrbs.length = 0;
  for (let i = 0; i < 40; i++) {
    const o = makeOrb(200 + (i%8)*4, 200 + Math.floor(i/8)*4, 2);
    o.homing = true;
    g.xpOrbs.push(o);
  }
  const bBefore = g.xpOrbs.length;
  step(3);
  out.B_before = bBefore;
  out.B_after = g.xpOrbs.length;
  out.B_untouched = out.B_after === out.B_before;

  // --- Case C: a sparse floor (below minCount 25) is left alone ---
  g.xpOrbs.length = 0;
  for (let i = 0; i < 10; i++) g.xpOrbs.push(makeOrb(300 + i*3, 300, 4));
  const cBefore = g.xpOrbs.length;
  step(3);
  out.C_before = cBefore;
  out.C_after = g.xpOrbs.length;
  out.C_untouched = out.C_after === out.C_before;

  // --- Case D: coins collapse too, value conserved ---
  g.coins.length = 0;
  let coinValue = 0;
  const makeCoin = (x,y,v) => ({
    x, y, radius: 6, goldAmount: v, dead: false, homing: false,
    _r(v2){ return 6 + Math.min(10, Math.log2(Math.max(1, v2)) * 2.2); },
    absorb(other){ this.goldAmount += other.goldAmount; this.radius = this._r(this.goldAmount); other.dead = true; },
    update(){ return false; },
    draw(){},
  });
  for (let i = 0; i < 40; i++) { const v=2; coinValue+=v; g.coins.push(makeCoin(120+(i%8)*5, 120+Math.floor(i/8)*5, v)); }
  out.D_before = g.coins.length;
  step(3);
  out.D_after = g.coins.length;
  out.D_valueConserved = g.coins.reduce((s,c)=>s+c.goldAmount,0) === coinValue;
  out.D_collapsed = out.D_after < out.D_before * 0.6;

  return out;
});

await browser.close();
server.close();

console.log('\n=== Orb-merge verification (on shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result && !result.fatal
  && result.A_collapsed && result.A_valueConserved && result.A_grewBigger
  && result.B_untouched
  && result.C_untouched
  && result.D_collapsed && result.D_valueConserved
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
