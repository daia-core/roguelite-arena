#!/usr/bin/env node
// Targeted verification for the health-orb pickup magnet (getXPMagnet -> pickup range).
// Builds the SHIPPED bundle (frontend/dist), drives it headless, steps the real game loop
// with a fixed dt, and asserts: orbs inside the attract radius get vacuumed + collected,
// orbs outside it do NOT move, and a magnet item widens the radius. Deterministic (no rAF).
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
  g.state = 'playing'; // node-map opens first now; jump into combat (map covered by qa-node-map)
  if (!g.player) return { fatal: `no player after startNewGame (state=${g.state})` };

  // Helper: a minimal orb honoring the interface the pickup loop uses (x,y,radius,healAmount,dead,update,collidesWith)
  const mkOrb = (x, y) => ({ x, y, radius: 8, healAmount: 20, dead: false, update(){}, collidesWith(px,py,r){ return Math.hypot(this.x-px, this.y-py) <= this.radius + r; } });
  const step = (n) => { for (let i=0;i<n;i++) g.update(1/60); };
  const dist = (o) => Math.hypot(o.x - g.player.x, o.y - g.player.y);

  const out = {};

  // --- Case A: baseline magnet (no items), orb at 55px — inside the 60px baseline vacuum ---
  // Route item changes through the real API so the stat memoization invalidates.
  for (const it of g.playerStats.items.filter(i => i.__test)) g.playerStats.removeItem(it.id);
  out.baseMagnet = g.playerStats.getXPMagnet();               // expect 1
  g.player.health = 10; g.player.maxHealth = 200;             // room to observe a heal
  g.healthOrbs.length = 0;
  const a = mkOrb(g.player.x + 55, g.player.y);
  g.healthOrbs.push(a);
  const aStart = dist(a);
  step(6);
  const aMid = dist(a);              // should have shrunk (being pulled in)
  step(60);
  out.A_start = Math.round(aStart);
  out.A_movedInEarly = aMid < aStart - 1;
  out.A_collected = a.dead === true; // vacuumed all the way in
  out.A_healed = g.player.health > 10;

  // --- Case B: orb at 200px — OUTSIDE the 60px baseline range, must NOT move ---
  g.healthOrbs.length = 0;
  const b = mkOrb(g.player.x + 200, g.player.y);
  g.healthOrbs.push(b);
  const bStart = dist(b);
  step(30);
  out.B_start = Math.round(bStart);
  out.B_stayedPut = Math.abs(dist(b) - bStart) < 0.5 && b.dead === false;

  // --- Case C: a magnet item (xpMagnet 2) widens range so a 100px orb is now pulled ---
  g.playerStats.addItem({ id: '__test_magnet', __test: true, xpMagnet: 2, tags: [] });
  out.itemMagnet = g.playerStats.getXPMagnet();               // expect 2
  g.healthOrbs.length = 0;
  const c = mkOrb(g.player.x + 100, g.player.y);              // >60 (base) but <120 (2x)
  g.healthOrbs.push(c);
  const cStart = dist(c);
  step(40);
  out.C_pulled = dist(c) < cStart - 1 || c.dead === true;

  return out;
});

await browser.close();
server.close();

console.log('\n=== Magnet verification (on shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result && !result.fatal
  && result.baseMagnet === 1
  && result.A_movedInEarly && result.A_collected && result.A_healed
  && result.B_stayedPut
  && result.itemMagnet === 2 && result.C_pulled
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
