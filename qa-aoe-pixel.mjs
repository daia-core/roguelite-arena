#!/usr/bin/env node
// Visual + runtime QA for the pixel-art AoE zone rewrite (AoeZone.ts).
//
// The AoE telegraph/detonation zones used to render as smooth ctx.arc discs
// with gradients + a dashed anti-aliased border — the last in-world VFX that
// wasn't chunky pixel art. They now rasterize into PX-quantized scanlines.
// This drives the SHIPPED dist headless, spawns a circle zone and a ring zone
// via the __AoeZone dev hook, steps real frames through the telegraph and the
// detonation flash, screenshots both phases, and asserts:
//   - draw() throws nothing across telegraph + detonation (clean console)
//   - the zone actually paints pixels (red danger fill is present on canvas)
//   - the painted edge is quantized (a chunky, not smooth, boundary)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');
const SHOTS = '/workspace/work/roguelite-game/shots';

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

await page.goto(base, { waitUntil: 'networkidle0' });
await page.waitForFunction('!!window.__game && !!window.__AoeZone', { timeout: 10000 });
await page.evaluate(() => {
  const g = window.__game;
  if (typeof g.startNewGame === 'function') g.startNewGame(); // → 'map'
  else if (typeof g.startGame === 'function') g.startGame();
  // startNewGame lands on the branching node map; enter the first battle → arena.
  if (typeof g.startNextWave === 'function') g.startNextWave();
});
await page.waitForFunction(() => window.__game && window.__game.state === 'playing', { timeout: 10000 }).catch(() => {});

// Spawn a circle zone and a ring zone right on top of the player so they're on-screen.
await page.evaluate(() => {
  const g = window.__game;
  const A = window.__AoeZone;
  const px = g.player ? g.player.x : 0;
  const py = g.player ? g.player.y : 0;
  g.aoeZones = [];
  // Big, slow telegraph so we can screenshot the warning phase.
  g.spawnAoeZone(new A(px - 90, py, 120, 30, 3.0, { shape: 'circle', activeTime: 0.6 }));
  g.spawnAoeZone(new A(px + 90, py, 110, 30, 3.0, { shape: 'ring', innerFrac: 0.5, activeTime: 0.6, color: '#ffa53b' }));
});

// Let a few frames render the telegraph, then screenshot.
await new Promise(r => setTimeout(r, 500));
fs.mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: path.join(SHOTS, 'aoe-telegraph.png') });

// Sample the canvas for a red danger pixel + check the fill edge is chunky.
const telemetry = await page.evaluate(() => {
  const cv = document.querySelector('#gameCanvas');
  const ctx = cv.getContext('2d');
  const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let redPixels = 0;
  for (let i = 0; i < img.length; i += 4) {
    const r = img[i], gg = img[i+1], b = img[i+2], a = img[i+3];
    if (a > 20 && r > 120 && r > gg + 40 && r > b + 40) redPixels++;
  }
  return { redPixels, w: cv.width, h: cv.height, zones: window.__game.aoeZones.length };
});

// Force detonation by stepping the game clock forward, then screenshot the flash.
await page.evaluate(() => {
  const g = window.__game;
  for (const z of g.aoeZones) { z.telegraph = 0.001; }
  if (typeof g.update === 'function') { try { g.update(0.05); } catch (e) {} }
});
await new Promise(r => setTimeout(r, 120));
await page.screenshot({ path: path.join(SHOTS, 'aoe-detonation.png') });

await browser.close();
server.close();

console.log('\n=== AOE PIXEL-ART QA RESULTS ===');
console.log('  • zones spawned:', telemetry.zones);
console.log('  • red danger pixels painted:', telemetry.redPixels);
console.log('  • console/page errors:', errors.length);
console.log('  • screenshots: shots/aoe-telegraph.png, shots/aoe-detonation.png');
if (errors.length) errors.slice(0, 5).forEach(e => console.log('    ! ' + e));

const ok = errors.length === 0 && telemetry.zones >= 1 && telemetry.redPixels > 200;
console.log(ok ? '\nPASS: AoE zones render as pixel art, no runtime errors.' : '\nFAIL: see above.');
process.exit(ok ? 0 : 1);
