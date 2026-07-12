// qa-dash.mjs — prove the DASH button/key is wired end-to-end after the fix:
// pressing dash (via the real Input flag the button/keys set) makes g.update run
// player.tryDash, which (1) grants i-frames, (2) moves the player at dash speed,
// and (3) works while standing still (falls back to last-faced direction).
// Exercises the input→game-loop→player path I touched (game-dev regression rule).
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
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game handle' };
  const out = {};

  const forcePlaying = () => { g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing'; };
  g.startNewGame(); forcePlaying();

  // Park the player mid-arena so bounds-clamping doesn't mask dash movement.
  g.player.x = g.worldWidth / 2;
  g.player.y = g.worldHeight / 2;

  // === A. Standing still: dash still moves you (last-faced dir defaults to right) ===
  g.input.dashPressed = true;               // the flag the button pointerdown / Space set
  const sx = g.player.x, sy = g.player.y;
  const cd0 = g.player.dashCooldown;
  g.update(1 / 60);                          // game loop should consume dash + tryDash
  out.dashCooldownArmed = g.player.dashCooldown > 0 && cd0 === 0;
  out.iFramesGranted = g.player.invincibilityTimer > 0;
  // run the 0.2s dash out and measure travel
  for (let i = 0; i < 12; i++) g.update(1 / 60);
  out.standingDashMoved = Math.hypot(g.player.x - sx, g.player.y - sy) > 40;

  // === B. Cooldown blocks a second dash immediately ===
  g.input.dashPressed = true;
  const bx = g.player.x, by = g.player.y;
  g.update(1 / 60);
  out.blockedOnCooldown = Math.hypot(g.player.x - bx, g.player.y - by) < 20 && g.player.dashDuration <= 0;

  // === C. After cooldown, a directional dash goes the way you're moving (down) ===
  g.player.dashCooldown = 0;
  g.player.x = g.worldWidth / 2; g.player.y = g.worldHeight / 2;
  // stub movement input = straight down
  const realGMV = g.input.getMovementVector.bind(g.input);
  g.input.getMovementVector = () => ({ x: 0, y: 1 });
  g.input.dashPressed = true;
  const cx = g.player.x, cy = g.player.y;
  for (let i = 0; i < 13; i++) g.update(1 / 60);
  g.input.getMovementVector = realGMV;
  out.directionalDashMovedDown = (g.player.y - cy) > 40 && Math.abs(g.player.x - cx) < 15;

  return out;
});

console.log('=== Dash wiring ===');
console.log(JSON.stringify(result, null, 2));
console.log('console/page errors:', errors.length);
if (errors.length) console.log(errors.slice(0, 5));

const pass = result && !result.fatal &&
  result.dashCooldownArmed && result.iFramesGranted &&
  result.standingDashMoved && result.blockedOnCooldown &&
  result.directionalDashMovedDown &&
  errors.length === 0;
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
await browser.close();
server.close();
process.exit(pass ? 0 : 1);
