#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the PEN NIB / Loaded Shot every-Nth-shot item.
// While held, every 10th PRIMARY shot is "loaded": triple damage and pierces every enemy.
// The counter lives in Game.updatePlaying (this.shotsFired), tagging the volley loaded on
// each 10th shot. A loaded projectile is uniquely identifiable: radius 13 + golden color.
//
//   1. Data: pen_nib_t3 exists, loadedShot===true, epic, 🎯 icon.
//   2. Default: fresh PlayerStats hasLoadedShot()===false and shotsFired===0.
//   3. Held: hasLoadedShot()===true.
//   4. Cadence: driving real shots, a loaded projectile appears at shot 10 and 20, and at
//      NO other shot (1-9, 11-19). (The 10th, not the 9th or 11th.)
//   5. Triple damage: the loaded shot's damage == 3x a normal shot's damage.
//   6. Pierces all: the loaded projectile carries a high maxPierceCount (pierces every enemy).
//   7. Control: WITHOUT the item, driving shots never tags a loaded projectile and never
//      ticks shotsFired.
//   8. Reset: startNewGame() zeroes shotsFired.
//
// TS `private` is compile-time only, so g.updatePlaying / g.shotsFired / g.player are reachable.
// We drive real frames (health topped so the player survives), read the loaded signature off the
// live projectile array, then strip loaded projectiles between shots so a stale in-flight loaded
// round can't false-positive the next shot's check.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/pennib';
fs.mkdirSync(OUT, { recursive: true });

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

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, protocolTimeout: 120000, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };
  const out = {};
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  const isLoaded = (p) => p.radius === 13 && p.color === '#ffd43b';
  const stripLoaded = () => { g.projectiles = g.projectiles.filter(p => !isLoaded(p)); };

  // === 1. Catalog entry. ===
  const item = DB.getItemById('pen_nib_t3');
  out.itemExists = !!item && item.loadedShot === true;
  out.itemRarity = !!item && item.rarity === 'epic' && item.icon === '🎯';

  // === 2. Default. ===
  g.startNewGame();
  out.noLoadedDefault = g.playerStats.hasLoadedShot() === false && g.shotsFired === 0;

  // === Drive real shots and record the loaded flag + a sample damage per shot number. ===
  // Returns { loadedAtShot: {n: bool}, dmgAtShot: {n: number}, pierceAtShot: {n: number}, maxShot }
  const driveShots = (targetShots) => {
    g.state = 'playing';
    g.waveManager.startWave(1); // activate spawning so the auto-aim always has a target
    const loadedAtShot = {}, dmgAtShot = {}, pierceAtShot = {};
    let last = g.shotsFired;
    let frames = 0;
    while (g.shotsFired < targetShots && frames < 4000) {
      frames++;
      if (g.player) g.player.health = g.player.maxHealth; // survive the drive
      // keep the wave live so targets never dry up (enemies below never die)
      g.waveManager.waveActive = true;
      if (g.enemies.length === 0) g.waveManager.spawnTimer = 0;
      // Keep the sim LEAN so each frame stays O(1): cap the auto-spawned enemy list to a
      // handful (waveManager keeps seeding targets, so the auto-aim always has something to
      // fire at) and top their health, and wipe accumulated projectiles each frame. Nothing
      // damages the capped enemies (bullets are cleared before they travel), so no kill side
      // effects fire and the drive reaches `targetShots` in a few frames rather than grinding
      // through thousands of accumulated entities (the old O(n^2) drive timed out).
      if (g.enemies.length > 3) g.enemies.length = 3;
      for (const e of g.enemies) { e.health = e.maxHealth; e.dead = false; }
      g.projectiles.length = 0;
      g.updatePlaying(0.3); // big dt clears the fire cooldown so it fires ~every frame
      if (g.shotsFired > last) {
        last = g.shotsFired;
        const loaded = g.projectiles.find(isLoaded);
        loadedAtShot[last] = !!loaded;
        // sample this shot's damage/pierce: loaded round if present, else a normal bullet
        const sample = loaded || g.projectiles.find(p => p.fromPlayer);
        if (sample) { dmgAtShot[last] = sample.damage; pierceAtShot[last] = sample.maxPierceCount; }
        stripLoaded(); // clear the loaded round so it can't taint the next shot's check
      }
    }
    return { loadedAtShot, dmgAtShot, pierceAtShot, frames };
  };

  // === 3/4/5/6. WITH Pen Nib held. ===
  g.startNewGame();
  if (item) g.playerStats.addItem(item);
  out.loadedHeld = g.playerStats.hasLoadedShot() === true;
  const held = driveShots(21);
  out.cadenceCorrect =
    held.loadedAtShot[10] === true && held.loadedAtShot[20] === true &&
    [1,2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,19].every(n => held.loadedAtShot[n] === false);
  // triple damage: shot 10 (loaded) vs shot 9 (normal)
  out.tripleDamage = !!held.dmgAtShot[9] && !!held.dmgAtShot[10] &&
    near(held.dmgAtShot[10], held.dmgAtShot[9] * 3);
  out.piercesAll = (held.pierceAtShot[10] || 0) >= 999;

  // === 7. Control: no item -> no loaded shots, counter never ticks. ===
  g.startNewGame(); // no Pen Nib
  const ctrl = driveShots(15);
  // shotsFired only ticks while the item is held, so it must stay 0 for the whole control drive
  out.controlNoLoaded = g.shotsFired === 0 &&
    Object.keys(ctrl.loadedAtShot).length === 0;

  // === 8. Reset. ===
  g.startNewGame();
  if (item) g.playerStats.addItem(item);
  driveShots(3);
  const midShots = g.shotsFired;
  g.startNewGame();
  out.resetClears = midShots >= 3 && g.shotsFired === 0;

  return out;
});

await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  g.startNewGame();
  const item = DB.getItemById('pen_nib_t3');
  if (item) g.playerStats.addItem(item);
  g.state = 'playing';
});
await new Promise(r => setTimeout(r, 250));
await page.screenshot({ path: path.join(OUT, 'pennib-mobile.png') });

await browser.close();
server.close();

console.log('\n=== Pen Nib / Loaded Shot every-10th (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('Screenshots →', OUT);

const checks = ['itemExists','itemRarity','noLoadedDefault','loadedHeld','cadenceCorrect',
  'tripleDamage','piercesAll','controlNoLoaded','resetClears'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
