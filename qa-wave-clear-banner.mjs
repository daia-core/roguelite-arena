// QA — "WAVE X CLEARED!" celebration banner (feat added 2026-08-03)
//
// Verifies three behavioural guarantees:
//   1. No banner mid-wave (waveClearPending starts false).
//   2. Banner arms on wave complete: waveClearPending flips true, timer = 0.8s,
//      game stays in 'playing' state (no instant shop jump).
//   3. After exactly 0.8 s of game-time the banner clears and shop opens.
//
// waveClearTimer / waveClearPending are TypeScript-private but accessible at
// runtime via window.__game (TS compiles private to plain JS props).

import http from 'node:http';
import fs   from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.join('/workspace/work/roguelite-game/frontend', 'dist');
const MIME = {
  '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.svg':'image/svg+xml', '.png':'image/png', '.mp3':'audio/mpeg', '.css':'text/css',
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
await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game' };

  // ── Setup: start a fresh game in playing state ───────────────────────────
  g.startNewGame();
  g.state = 'playing';
  // Keep player alive for all frames below.
  const keepAlive = () => { if (g.player) g.player.health = g.player.maxHealth; };

  // ── Check 1: mid-wave — banner must NOT be active ─────────────────────────
  // A fresh game has waveManager.waveComplete = false → waveClearPending must be false.
  const midWavePending  = g.waveClearPending;
  const midWaveTimer    = g.waveClearTimer;
  const midWaveState    = g.state;

  // ── Check 2: arm the banner (force standard wave complete) ────────────────
  // Standard path = waveComplete true + pendingWaveArtifact false.
  g.waveManager.waveComplete    = true;
  g.pendingWaveArtifact         = false;
  // Enemies cleared — nothing to process.
  g.enemies     = [];
  g.projectiles = [];

  // One tick: should arm waveClearPending, NOT enter shop yet.
  const dt = 1 / 60;
  keepAlive();
  g.update(dt);

  const armedPending = g.waveClearPending;
  const armedTimer   = g.waveClearTimer;
  const armedState   = g.state;          // must still be 'playing'

  // ── Check 3: count down 0.8 s and verify shop entry ───────────────────────
  // We advance with fixed dt until the timer expires or 200 frames (> 3 s) to avoid inf-loop.
  let frames = 0;
  while (g.waveClearPending && frames < 200) {
    keepAlive();
    g.enemies     = [];
    g.projectiles = [];
    g.update(dt);
    frames++;
  }
  const afterState   = g.state;          // must be 'shop'
  const afterPending = g.waveClearPending;
  const afterTimer   = g.waveClearTimer;
  const elapsed      = +(frames * dt).toFixed(3);   // game-time consumed

  return {
    midWavePending, midWaveTimer, midWaveState,
    armedPending, armedTimer, armedState,
    afterState, afterPending, afterTimer, elapsed, frames,
  };
});

await browser.close();
server.close();

// ── Assertions ────────────────────────────────────────────────────────────────
if (result.fatal) { console.log('FATAL:', result.fatal); process.exit(1); }

let fail = 0;
const ok = (label, pass, detail = '') => {
  if (!pass) fail++;
  console.log(`  [${pass ? 'OK ' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
};

console.log('\n── Wave-Clear Banner QA ──');

// 1. No banner mid-wave
ok('mid-wave: banner not pending',       result.midWavePending === false,  `pending=${result.midWavePending}`);
ok('mid-wave: timer is 0',               result.midWaveTimer === 0,         `timer=${result.midWaveTimer}`);

// 2. Arms on wave-complete
ok('armed: waveClearPending flips true', result.armedPending === true,      `pending=${result.armedPending}`);
ok('armed: timer initialised at 0.8s',  Math.abs(result.armedTimer - 0.8) < 0.05,
                                                                             `timer=${result.armedTimer}`);
ok('armed: state stays "playing"',       result.armedState === 'playing',   `state=${result.armedState}`);

// 3. After 0.8 s → shop, timer cleared
ok('expired: state becomes "shop"',      result.afterState === 'shop',      `state=${result.afterState}`);
ok('expired: waveClearPending cleared',  result.afterPending === false,     `pending=${result.afterPending}`);
ok('expired: timer reset to 0',          result.afterTimer === 0,           `timer=${result.afterTimer}`);
ok('expired: elapsed ≈ 0.8 s',
   result.elapsed >= 0.75 && result.elapsed <= 0.90,
   `elapsed=${result.elapsed}s (${result.frames} frames)`);

if (consoleErrors.length) {
  ok('no console errors', false, consoleErrors.slice(0, 3).join(' | '));
}

console.log(fail ? `\n❌ ${fail} assertion(s) failed` : '\n✅ wave-clear banner verified: arms on clear, delays 0.8 s, lands in shop');
process.exit(fail ? 1 : 0);
