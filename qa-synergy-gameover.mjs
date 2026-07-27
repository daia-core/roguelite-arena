#!/usr/bin/env node
// QA: synergy badges on the game over screen.
//
// Injects mock gameOverStats with 2 transformations + 2 duos into the live
// build, forces the gameover state, waits a frame, screenshots, and asserts:
//   1. No console/page errors
//   2. Pixels of the injected glow colors appear somewhere on the canvas
//      (proves the badge background + border actually painted)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const GAME   = '/workspace/work/roguelite-game/frontend';
const ROOT   = path.join(GAME, 'dist');
const SHOTS  = '/workspace/work/roguelite-game/shots';
fs.mkdirSync(SHOTS, { recursive: true });

console.log('Building frontend/dist…');
execSync('npm run build', { cwd: GAME, stdio: 'inherit' });

const MIME = {
  '.html':'text/html','.js':'text/javascript','.json':'application/json',
  '.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.css':'text/css',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
});
const page = await browser.newPage();
// Mobile-portrait viewport (typical Felix play viewport)
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(base, { waitUntil: 'networkidle0' });
await page.waitForFunction('!!window.__game', { timeout: 10000 });

// Inject synergy data with known glow colors, then force gameover state.
// We use two transformations + two duos so the row definitely has multiple badges.
const injected = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { error: 'no __game' };

  // Snapshot items for the item strip fallback (can be empty)
  g.gameOverStats = {
    wavesReached: 12,
    enemiesKilled: 347,
    bossesDefeated: 2,
    goldEarned: 480,
    itemsCollected: 14,
    soulsEarned: 24,
    personalBest: 10,
    className: 'Berserker',
    runDurationMs: 4 * 60 * 1000 + 32 * 1000,
    itemsBought: [
      { icon: '⚔️', rarity: 'epic' },
      { icon: '🗡️', rarity: 'rare' },
      { icon: '🛡️', rarity: 'common' },
    ],
    // Two transformations with distinct glow colors
    transformationsActive: [
      { icon: '⚔️', name: 'Berserker Rage',    glowColor: '#dc2626' },
      { icon: '🎯', name: 'Master Marksman',   glowColor: '#3b82f6' },
    ],
    // Two duos with distinct glow colors
    duosActive: [
      { icon: '⚡🌊', name: 'Storm Surge',       glowColor: '#60a5fa' },
      { icon: '🔥💀', name: 'Toxic Storm',        glowColor: '#84cc16' },
    ],
  };
  // Mark no new achievements so the banner doesn't push layout
  g.newAchievementsThisRun = [];
  g.state = 'gameover';
  return { ok: true };
});

if (injected.error) {
  console.log('Injection failed:', injected.error);
  await browser.close(); server.close(); process.exit(1);
}

// Let the game loop render at least one gameover frame
await new Promise(r => setTimeout(r, 600));

// Grab canvas pixel data and check for synergy glow colors
const pixelCheck = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas' };

  const tmpC = document.createElement('canvas');
  tmpC.width = canvas.width; tmpC.height = canvas.height;
  const cx = tmpC.getContext('2d');
  cx.drawImage(canvas, 0, 0);
  const imageData = cx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;

  // Count pixels matching each target color (within tolerance of ±30 per channel)
  function countColor(r, g, b, tol = 30) {
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i+3] < 50) continue; // skip near-transparent
      if (Math.abs(d[i]-r) <= tol && Math.abs(d[i+1]-g) <= tol && Math.abs(d[i+2]-b) <= tol) n++;
    }
    return n;
  }

  return {
    w: canvas.width, h: canvas.height,
    // dc2626 = rgb(220,38,38) — Berserker transformation crimson
    berserker_red: countColor(220, 38, 38),
    // 3b82f6 = rgb(59,130,246) — Master Marksman blue
    marksman_blue: countColor(59, 130, 246),
    // 60a5fa = rgb(96,165,250) — Storm Surge light blue
    storm_blue: countColor(96, 165, 250),
    // 84cc16 = rgb(132,204,22) — Toxic Storm lime
    toxic_lime: countColor(132, 204, 22),
    total_pixels: d.length / 4,
  };
});

const SHOT = path.join(SHOTS, 'synergy-gameover.png');
await page.screenshot({ path: SHOT });

await browser.close();
server.close();

console.log('\n=== SYNERGY GAMEOVER QA ===');
console.log(`  Canvas: ${pixelCheck.w}×${pixelCheck.h}  total pixels: ${pixelCheck.total_pixels.toLocaleString()}`);
console.log(`  Berserker red  (#dc2626) pixels: ${pixelCheck.berserker_red}`);
console.log(`  Marksman blue  (#3b82f6) pixels: ${pixelCheck.marksman_blue}`);
console.log(`  Storm blue     (#60a5fa) pixels: ${pixelCheck.storm_blue}`);
console.log(`  Toxic lime     (#84cc16) pixels: ${pixelCheck.toxic_lime}`);
console.log(`  Console/page errors: ${errors.length}  ${errors.slice(0,3).join('; ')}`);
console.log(`  Screenshot: ${SHOT}`);

let fail = false;
if (errors.length > 0) { console.log('  FAIL: console/page errors'); fail = true; }
if (pixelCheck.berserker_red < 10) { console.log('  FAIL: no berserker red pixels (transformation badge missing)'); fail = true; }
if (pixelCheck.marksman_blue < 10) { console.log('  FAIL: no marksman blue pixels (transformation badge missing)'); fail = true; }
if (pixelCheck.storm_blue < 5)     { console.log('  FAIL: no storm blue pixels (duo badge missing)'); fail = true; }
if (pixelCheck.toxic_lime < 5)     { console.log('  FAIL: no toxic lime pixels (duo badge missing)'); fail = true; }

if (fail) { console.log('\nRESULT: FAIL ❌'); process.exit(1); }
console.log('\nRESULT: PASS ✅');
