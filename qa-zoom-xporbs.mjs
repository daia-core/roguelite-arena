#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) three things Felix asked for:
//   1. ZOOM-OUT: the simulation world is 2x the canvas in each dimension, the
//      player spawns at world-centre, and gameplay bounds use world dims.
//   2. XP-AS-ORBS: killing an enemy spawns collectable XP gems (not instant XP),
//      and those gems home to the player and grant XP on contact.
//   3. DENSER SPAWNS: a live wave fills the field with a crowd (burst spawning).
// Deterministic: steps the real g.update(dt) loop, no rAF.
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
  if (!g.player || g.state !== 'playing') return { fatal: `bad start state=${g.state} player=${!!g.player}` };
  const step = (n) => { for (let i=0;i<n;i++) g.update(1/60); };
  const out = {};

  // --- 1. ZOOM-OUT world dims ---
  out.canvasW = g.canvas.width; out.canvasH = g.canvas.height;
  out.worldW = g.worldWidth; out.worldH = g.worldHeight;
  out.worldIs2x = (g.worldWidth === g.canvas.width * 2) && (g.worldHeight === g.canvas.height * 2);
  out.playerAtWorldCentre =
    Math.abs(g.player.x - g.worldWidth / 2) < 1 && Math.abs(g.player.y - g.worldHeight / 2) < 1;

  // --- 2. XP AS ORBS: kill an enemy, expect gems (not instant XP) that then collect ---
  g.xpOrbs.length = 0;
  const xpBefore = g.player.xp;
  const lvlBefore = g.player.level;
  const mockEnemy = {
    type: 'slime', x: g.player.x + 25, y: g.player.y,
    typeData: { xpValue: 40, goldValue: 5, isBoss: false }
  };
  g.handleEnemyKill(mockEnemy);
  out.orbsSpawned = g.xpOrbs.length;                       // expect >=1
  out.orbsAreEntities = g.xpOrbs.every(o => typeof o.update === 'function' && typeof o.xpAmount === 'number');
  out.xpAtKill = g.player.xp;                              // XP NOT granted yet (still == before)
  out.xpDeferred = (g.player.xp === xpBefore && g.player.level === lvlBefore);
  const orbSum = g.xpOrbs.reduce((s, o) => s + o.xpAmount, 0);
  out.orbSum = orbSum;                                      // orbs carry the full award
  // Step: orbs are within magnet range (spawned 25px away) → home in and collect.
  step(120);
  out.orbsLeft = g.xpOrbs.length;                          // expect 0 (all collected)
  out.xpGranted = (g.player.level > lvlBefore) || (g.player.xp > xpBefore);

  // --- 3. DENSER SPAWNS: run a live wave, track peak crowd size ---
  g.startNewGame();
  let peak = 0;
  for (let i = 0; i < 240; i++) { g.update(1/60); peak = Math.max(peak, g.enemies.length); }
  out.peakEnemies = peak;                                  // burst spawning should crowd the field

  return out;
});

await browser.close();
server.close();

console.log('\n=== Zoom-out + XP-orbs + spawn density (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result && !result.fatal
  && result.worldIs2x
  && result.playerAtWorldCentre
  && result.orbsSpawned >= 1
  && result.orbsAreEntities
  && result.xpDeferred
  && result.orbSum > 0
  && result.orbsLeft === 0
  && result.xpGranted
  && result.peakEnemies >= 8
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
