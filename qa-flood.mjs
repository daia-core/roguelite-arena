// Flood verification — confirm the stage floods with enemies (VS-style) and
// that enemies now tank multiple hits (FLOOD_HP_MULT). Neutralizes player damage
// so enemies accumulate, then measures peak concurrent alive enemies + HP.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');

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

const res = await page.evaluate(async () => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game' };
  g.startNewGame();
  // Force directly into combat (mirrors Game internals: startWave + state=playing).
  g.enemies = [];
  g.projectiles = [];
  g.waveManager.reset();
  g.waveManager.startWave(1);
  g.state = 'playing';
  // Neutralize player damage so enemies accumulate — nuke projectiles each frame.
  const dt = 1 / 60;
  let peak = 0;
  let maxEnemyHP = 0, minEnemyHP = Infinity;
  let sampledFirstSlimeHP = null;
  for (let i = 0; i < 12 * 60; i++) {
    g.update(dt);
    // Kill player offense: clear projectiles so nothing dies to the player.
    if (g.projectiles) g.projectiles.length = 0;
    if (g.player) g.player.health = g.player.maxHealth; // keep alive so we measure flood
    const alive = (g.enemies || []).filter(e => !e.dead);
    if (alive.length > peak) peak = alive.length;
    for (const e of alive) {
      if (e.maxHealth > maxEnemyHP) maxEnemyHP = e.maxHealth;
      if (e.maxHealth < minEnemyHP) minEnemyHP = e.maxHealth;
      if (sampledFirstSlimeHP === null && /slime/i.test(e.type || e.typeData?.type || '')) {
        sampledFirstSlimeHP = e.maxHealth;
      }
    }
    if (g.state !== 'playing' && i > 120) break;
  }
  // Draw one more frame so the canvas shows the live swarm for the screenshot.
  if (g.draw) g.draw();
  return {
    state: g.state,
    wave: g.waveManager?.currentWave,
    totalInWave: g.waveManager?.totalEnemiesInWave,
    peak,
    maxEnemyHP: Math.round(maxEnemyHP),
    minEnemyHP: isFinite(minEnemyHP) ? Math.round(minEnemyHP) : null,
    sampledFirstSlimeHP: sampledFirstSlimeHP != null ? Math.round(sampledFirstSlimeHP) : null,
  };
});
console.log(JSON.stringify(res, null, 2));
console.log('errors:', errors.length, errors.slice(0, 3));

// Screenshot the flooded arena for a designer's-eye review.
await page.screenshot({ path: '/workspace/work/roguelite-game/shots/flood-mobile.png' });
console.log('shot: shots/flood-mobile.png');

// Verdict
const ok = res.peak >= 20 && res.minEnemyHP >= 2;
console.log(ok ? '✅ FLOOD OK — peak swarm + tanky enemies' : '⚠️ CHECK — peak or HP below target');

await browser.close();
server.kill?.('SIGKILL');
process.exit(0);
