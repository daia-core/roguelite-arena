#!/usr/bin/env node
// Genuine mobile playthrough QA — the "play it as Felix would" pass.
// Serves the SHIPPED dist, drives a REAL game at 390x844 (Felix's phone) into a
// mid-run swarm with several aux weapons active, then:
//   1. measures actual frame cost (g.update + g.draw) under the heaviest load,
//   2. reports entity counts + the smallest enemy's on-screen px size after the 2x zoom-out,
//   3. screenshots the swarm so a human can LOOK at visual clarity.
// Exits non-zero if FPS under load drops below a playable floor.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');
const SHOTS = '/workspace/work/roguelite-game/shots';

// Build the shipped bundle fresh so we test EXACTLY what ships (the hollow-verify fix).
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
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(async () => {
  const g = window.__game, DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  g.startNewGame();
  const s = g.playerStats;
  const give = (id) => { const it = DB.getItemById(id); if (it) { s.items.push(it); return true; } return false; };
  // A diverse stacked loadout: all four aux systems (real ids) + move speed.
  const wanted = ['whirl_blades_t2','orbit_orb_t2','orbit_orb_swarm_t3','bomb_bandolier_t2','nova_core_t3','swift_blade_t2'];
  const granted = wanted.filter(give);
  g.player.gold = 0;

  // Drive the REAL update loop and STOP mid-swarm (while still playing) so we
  // measure/scree​nshot under combat load, not in the post-wave shop. Track the
  // worst single-frame cost across the whole run = true peak-load frame time.
  const dt = 1/60;
  let peakEnemies = 0, worstFrameMs = 0;
  for (let i = 0; i < 75 * 60; i++) {
    const f0 = performance.now();
    g.update(dt);
    const fm = performance.now() - f0;
    if (fm > worstFrameMs && i > 30) worstFrameMs = fm; // ignore warm-up frames
    const n = (g.enemies || []).filter(e => !e.dead).length;
    if (n > peakEnemies) peakEnemies = n;
    // Stop once we're deep in a filled wave-1 swarm, still in combat.
    if (g.state === 'playing' && n >= 22) break;
    if (g.state !== 'playing' && i > 60) break; // died or shop — stop
  }

  const enemies = (g.enemies || []).filter(e => !e.dead);
  const alive = enemies.length;
  const state = g.state;

  // Smallest enemy radius in WORLD px, then convert to ON-SCREEN px.
  // main.ts: canvas.width = viewport.width * zoomFactor (2.0 on <500px), CSS scales to 100%.
  // So on-screen px = worldPx / zoomFactor.
  // NB: enemies RENDER at their sprite dimensions (Enemy.draw uses sprite.width/
  // height), which are much larger than the collision hitbox measured here — so
  // this is the on-screen COLLISION diameter (a lower bound on the visible sprite),
  // reported for context only. Visible legibility is judged from the screenshot.
  const zoomFactor = 2.0;
  let minR = Infinity, maxR = 0;
  for (const e of enemies) {
    const r = e.typeData?.radius ?? e.radius ?? 0;
    if (r > 0) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); }
  }
  const smallestHitboxOnScreenPx = isFinite(minR) ? +((minR * 2) / zoomFactor).toFixed(1) : null;
  const largestHitboxOnScreenPx = maxR ? +((maxR * 2) / zoomFactor).toFixed(1) : null;

  // Measure real frame cost under THIS swarm load (update + draw), 60 frames.
  // Keep it short so the swarm stays on screen for the screenshot.
  const t0 = performance.now();
  const N = 60;
  for (let i = 0; i < N; i++) { g.update(dt); g.draw(); }
  const msPerFrame = (performance.now() - t0) / N;
  const estFPS = Math.round(1000 / msPerFrame);
  const worstFPS = worstFrameMs > 0 ? Math.round(1000 / worstFrameMs) : null;
  g.draw(); // final draw so the screenshot shows the current swarm

  // Entity breakdown for context.
  const counts = {
    enemies: alive,
    projectiles: (g.projectiles || []).length,
    particles: (g.particles || []).length,
    xpOrbs: (g.xpOrbs || g.pickups || []).length,
    orbitOrbs: (g.orbitOrbs || []).length,
  };

  return { state, granted, alive, peakEnemies, smallestHitboxOnScreenPx, largestHitboxOnScreenPx,
           msPerFrame: +msPerFrame.toFixed(2), estFPS, worstFrameMs: +worstFrameMs.toFixed(2), worstFPS, counts };
});

// Screenshot the live swarm (game is paused at the post-loop state; take it now).
await new Promise(r => setTimeout(r, 200));
const shotPath = path.join(SHOTS, 'mobile-swarm-390.png');
await page.screenshot({ path: shotPath });

console.log('\n=== Mobile playthrough (shipped frontend/dist, 390x844) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length, errors.slice(0, 5));
console.log('Screenshot:', shotPath);

await browser.close();
server.close();

// Verdicts.
const FPS_FLOOR = 40;   // below this a phone run feels laggy
const MIN_SWARM = 18;   // wave-1 should fill the arena with a real crowd (VS feel)
let pass = true;
if (result.fatal) { console.log('FATAL:', result.fatal); process.exit(1); }
if (errors.length) { console.log('❌ console/page errors present'); pass = false; }
if (result.granted.length < 6) { console.log(`❌ only ${result.granted.length}/6 aux-weapon items loaded — id drift`); pass = false; }
if (result.estFPS < FPS_FLOOR) { console.log(`❌ est FPS ${result.estFPS} < floor ${FPS_FLOOR} under ${result.alive} enemies`); pass = false; }
else { console.log(`✅ FPS ${result.estFPS} (worst-frame ${result.worstFPS}) ≥ ${FPS_FLOOR} under ${result.alive} enemies (peak ${result.peakEnemies})`); }
if (result.peakEnemies < MIN_SWARM) { console.log(`⚠️  peak ${result.peakEnemies} enemies < ${MIN_SWARM} — swarm may feel thin`); }
else { console.log(`✅ swarm density: peak ${result.peakEnemies} enemies on-screen`); }
console.log(`ℹ️  collision hitbox on-screen: ${result.smallestHitboxOnScreenPx}–${result.largestHitboxOnScreenPx}px (sprites render larger; judge legibility from the screenshot)`);
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
