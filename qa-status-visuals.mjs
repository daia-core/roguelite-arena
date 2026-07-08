#!/usr/bin/env node
// Visual + runtime QA for the pixel-art status-effect overlays (Enemy.drawStatusEffects).
//
// Phase 3b built the status ENGINES (burn/bleed/poison/doom/wound/freeze) — they tick in the
// Game enemy loop and deal damage — but they fired INVISIBLY: nothing on the enemy told you it
// was ignited, poisoned, bleeding, frozen, wounded or doomed. Phase 4 adds chunky pixel-art
// overlays for each. This drives the SHIPPED dist headless, gets into a live wave, grabs real
// enemies, sets each status timer (the exact public fields the Game tick loop reads and the
// on-hit apply path at Game.ts:2011-2041 writes), steps real frames, screenshots, and asserts:
//   - draw() throws nothing across a multi-status enemy (clean console)
//   - each status paints pixels in its palette (cyan frozen, orange/red flame, green poison,
//     red bleed, purple doom) — i.e. the overlays actually render, not just compile
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
await page.waitForFunction('!!window.__game', { timeout: 10000 });
await page.evaluate(() => {
  const g = window.__game;
  if (typeof g.startNewGame === 'function') g.startNewGame(); // → 'map'
  else if (typeof g.startGame === 'function') g.startGame();
  if (typeof g.startNextWave === 'function') g.startNextWave(); // enter first battle → arena
});
await page.waitForFunction(() => window.__game && window.__game.state === 'playing', { timeout: 10000 }).catch(() => {});
// Survivor waves spawn enemies over time — wait until at least a few are alive.
await page.waitForFunction(() => window.__game && window.__game.enemies && window.__game.enemies.filter(e => !e.dead).length >= 1, { timeout: 10000 }).catch(() => {});

// Grab live enemies, pin them near the player (frozen halts movement) and light every status
// so all six overlays are on-screen at once. These are the exact fields Game.ts writes on hit.
const setup = await page.evaluate(() => {
  const g = window.__game;
  const alive = g.enemies.filter(e => !e.dead);
  const px = g.player ? g.player.x : 0;
  const py = g.player ? g.player.y : 0;
  // Cluster up to 6 enemies around the player so overlays sit inside the viewport.
  const ring = alive.slice(0, 6);
  const statuses = [
    e => { e.frozenTimer = 3; },
    e => { e.burnTimer = 3; },
    e => { e.poisonTimer = 3; e.poisonSpreads = true; },
    e => { e.bleedTimer = 4; },
    e => { e.woundMult = 2.5; },
    e => { e.doomTimer = 2.5; e.doomStored = 50; },
  ];
  ring.forEach((e, i) => {
    const a = (i / Math.max(1, ring.length)) * Math.PI * 2;
    e.x = px + Math.cos(a) * 95;
    e.y = py + Math.sin(a) * 95;
    e.frozenTimer = 3; // pin them all so they don't wander off between frames
    statuses[i % statuses.length](e);
    // Doom's rune is a small blinking glyph — mark every enemy so the aggregate count is robust.
    e.doomTimer = 2.5; e.doomStored = 50;
  });
  // Belt-and-braces: one enemy carries ALL statuses so a single draw() exercises every branch.
  if (ring[0]) { const e = ring[0]; e.burnTimer = 3; e.poisonTimer = 3; e.bleedTimer = 4; e.woundMult = 2.5; }
  return { alive: alive.length, lit: ring.length };
});

// Let a handful of frames animate the flames/bubbles/drips, then screenshot.
await new Promise(r => setTimeout(r, 500));
fs.mkdirSync(SHOTS, { recursive: true });
await page.screenshot({ path: path.join(SHOTS, 'status-effects.png') });

// Sample the canvas for each status palette. Loose thresholds — we're proving the overlay paints,
// not pixel-matching. Palettes: frozen #7fdfff/#eaffff (cyan), burn ff3b00/ff8c1a/ffd23d (orange),
// poison 4fd44f/9be62b (green), bleed d61f1f (red), doom a83bff/ff5cf0 (purple/magenta).
const telemetry = await page.evaluate(() => {
  const cv = document.querySelector('#gameCanvas');
  const ctx = cv.getContext('2d');
  const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
  // Frozen/burn/poison/bleed paint large areas and are counted here on the multi-status cluster.
  // Doom's rune is tiny + blinking + heavily background-dependent in colour, so it gets its own
  // exact-location isolation pass below rather than a whole-canvas colour scan.
  let cyan = 0, orange = 0, green = 0, red = 0;
  for (let i = 0; i < img.length; i += 4) {
    const r = img[i], gg = img[i+1], b = img[i+2], a = img[i+3];
    if (a < 20) continue;
    if (b > 180 && gg > 160 && r < 180 && b >= gg) cyan++;                 // icy frozen tint/shards
    if (r > 200 && gg > 60 && gg < 200 && b < 90) orange++;                 // flame
    if (gg > 190 && r < 170 && b < 120 && gg > r + 50 && gg > b + 90) green++; // bright poison bubbles (not arena floor)
    if (r > 170 && gg < 90 && b < 90) red++;                                // bleed droplets
  }
  return { cyan, orange, green, red, purple: 0, w: cv.width, h: cv.height, enemies: window.__game.enemies.filter(e=>!e.dead).length };
});

// --- Doom isolation pass ---------------------------------------------------------------------
// Doom's mark is a small, blinking, alpha-blended rune drawn just ABOVE the enemy. In the crowded
// multi-status cluster it's occluded by neighbouring bodies and the wave banner, so it can't be
// counted reliably there. Isolate it: keep ONE enemy on open floor, pin it, give it ONLY doom, and
// sample a bright-blink frame. Now the rune is the only magenta source in the play area.
// Sample a tight box at the rune's EXACT screen position (world→canvas is just /WORLD_SCALE, no
// camera translate) and count "magenta" pixels — ones where GREEN is the minimum channel and both
// red and blue clear it. Over the green arena floor green is the MAX channel, so this is an
// unmistakable, blend-robust signature for the purple rune regardless of the background it sits on.
async function sampleDoom() {
  return await page.evaluate(() => {
    const g = window.__game;
    const e = g.enemies.find(x => x.doomTimer > 0 && !x.dead);
    if (!e) return { found: false, purple: 0, samples: [] };
    const cv = document.querySelector('#gameCanvas');
    const ctx = cv.getContext('2d');
    const S = g.WORLD_SCALE || 2;
    const cx = Math.round(e.x / S);
    const cy = Math.round((e.y - (e.typeData ? e.typeData.radius : 14) - 8) / S); // rune sits above the head
    const half = 22;
    const x0 = Math.max(0, cx - half), y0 = Math.max(0, cy - half);
    const w = Math.min(cv.width - x0, half * 2), h = Math.min(cv.height - y0, half * 2);
    const img = ctx.getImageData(x0, y0, w, h).data;
    let purple = 0; const samples = [];
    for (let i = 0; i < img.length; i += 4) {
      const r = img[i], gg = img[i+1], b = img[i+2], a = img[i+3];
      if (a < 20) continue;
      if (gg < r - 20 && gg < b - 20 && r > 90 && b > 90) { purple++; if (samples.length < 8) samples.push([r, gg, b]); }
    }
    return { found: true, purple, samples };
  });
}
await page.evaluate(() => {
  const g = window.__game;
  const px = g.player ? g.player.x : 0;
  const py = g.player ? g.player.y : 0;
  const keep = g.enemies.find(e => !e.dead);
  g.enemies = keep ? [keep] : [];
  if (keep) {
    keep.x = px + 150; keep.y = py - 150;    // open floor, clear of the player (drawn on top) & banner
    keep.maxHealth = 1e9; keep.health = 1e9; // invincible so the player's auto-fire can't kill it mid-sample
    keep.frozenTimer = 5;                    // pin it (its icy disc sits on the body, not the rune)
    keep.burnTimer = 0; keep.poisonTimer = 0; keep.bleedTimer = 0; keep.woundMult = 1;
    keep.doomTimer = 5; keep.doomStored = 80; // long fuse so it can't detonate before we shoot
  }
});
// Sample across several frames and take the brightest — the rune blinks, so catch a lit moment.
// The rune is a tiny, blinking, alpha-blended glyph — any single frame is fragile at the detection
// margin. Sum matches across a full blink period so a real, persistent rune accumulates a stable
// signal well clear of zero, while a non-rendering rune stays at zero.
let doomPx = 0, doomPeak = 0, doomSamples = [];
for (let k = 0; k < 24; k++) { await new Promise(r => setTimeout(r, 50)); const s = await sampleDoom(); doomPx += s.purple; if (s.purple > doomPeak) { doomPeak = s.purple; doomSamples = s.samples; } }
await page.screenshot({ path: path.join(SHOTS, 'status-doom.png') });
void doomSamples;
telemetry.purple = doomPx;

await browser.close();
server.close();

console.log('\n=== STATUS-EFFECT PIXEL-ART QA RESULTS ===');
console.log('  • enemies alive / lit:', setup.alive, '/', setup.lit);
console.log('  • frozen (cyan) px:', telemetry.cyan);
console.log('  • burn (orange) px:', telemetry.orange);
console.log('  • poison (green) px:', telemetry.green);
console.log('  • bleed (red)   px:', telemetry.red);
console.log('  • doom (purple) px summed:', telemetry.purple, '| peak frame:', doomPeak, '| canvas:', telemetry.w + 'x' + telemetry.h);
console.log('  • console/page errors:', errors.length);
console.log('  • screenshot: shots/status-effects.png');
if (errors.length) errors.slice(0, 5).forEach(e => console.log('    ! ' + e));

// Each overlay must paint. Frozen tint is the biggest area; doom rune is small but distinct.
const checks = {
  'enemies present': setup.lit >= 1,
  'no console errors': errors.length === 0,
  'frozen paints': telemetry.cyan > 100,
  'burn paints': telemetry.orange > 10,
  'poison paints': telemetry.green > 10,
  'bleed paints': telemetry.red > 10,
  'doom paints': telemetry.purple > 25, // isolated rune, summed over a blink period (~36px observed)
};
let ok = true;
for (const [k, v] of Object.entries(checks)) { if (!v) { ok = false; console.log('  ✗ FAILED:', k); } }
console.log(ok ? '\nPASS: status overlays render as pixel art, no runtime errors.' : '\nFAIL: see above.');
process.exit(ok ? 0 : 1);
