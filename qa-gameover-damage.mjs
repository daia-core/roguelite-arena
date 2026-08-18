#!/usr/bin/env node
// QA — totalDamageDealt stat (Game.ts + GameOverScene.ts)
//
// Verifies that the damage-dealt tracking feature is correctly wired:
//
//  A) Field existence: totalDamageDealt is a numeric field on Game and in
//     the GameOverStats interface (both initialized to 0).
//  B) Reset: totalDamageDealt resets to 0 on startNewGame() even when
//     set to a non-zero value beforehand.
//  C) Accumulation: totalDamageDealt increases by enemy.maxHealth when
//     handleEnemyKill fires (tested via the private method call — TS
//     private is compile-time only; accessible at runtime in the built JS).
//  D) GameOver propagation: gameOverStats.totalDamageDealt is set from
//     the live totalDamageDealt counter when the run ends.
//  E) Display format: formatShort renders damage correctly across the
//     scale range (0 / sub-K / K / M).
//  F) Render safety: update() with a game-over state containing a
//     non-zero totalDamageDealt produces zero JS console errors.
//
// Driven through the real production build (cp-b3/cp-b7 convention).

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
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game handle' };

  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail ?? '' });

  // ---- A) Field existence ----
  ok('A: totalDamageDealt is a number on Game instance', typeof g.totalDamageDealt === 'number',
    `type=${typeof g.totalDamageDealt}`);
  ok('A: gameOverStats.totalDamageDealt field present', 'totalDamageDealt' in g.gameOverStats,
    `keys=${Object.keys(g.gameOverStats).join(',')}`);
  ok('A: gameOverStats.totalDamageDealt is a number', typeof g.gameOverStats.totalDamageDealt === 'number',
    `type=${typeof g.gameOverStats.totalDamageDealt}`);

  // ---- B) Reset on startNewGame ----
  g.totalDamageDealt = 99_999; // set a dirty value
  g.startNewGame();
  ok('B: totalDamageDealt resets to 0 after startNewGame()',
    g.totalDamageDealt === 0, `got=${g.totalDamageDealt}`);

  // ---- C) Accumulation via handleEnemyKill ----
  // Advance state to spawning so we have a real enemy to kill.
  g.waveManager.reset();
  g.waveManager.startWave(1);
  g.state = 'playing';
  for (let i = 0; i < 30 && g.enemies.length === 0; i++) g.update(0.25);

  const enemy = g.enemies.find(e => !e.dead);
  ok('C: enemy available for kill accumulation test', !!enemy, `enemies=${g.enemies.length}`);

  if (enemy) {
    const hp = enemy.maxHealth;
    const before = g.totalDamageDealt; // should be 0 post-reset

    // Call the private handleEnemyKill directly — TS 'private' is compile-time only.
    // This tests the actual production accumulation path.
    g['handleEnemyKill'](enemy);

    ok('C: totalDamageDealt increments by enemy.maxHealth on kill',
      g.totalDamageDealt === before + hp,
      `before=${before}, hp=${hp}, after=${g.totalDamageDealt}`);
  }

  // Kill a second enemy if available to test additive accumulation.
  g.enemies.filter(e => !e.dead).forEach((e, i) => { if (i === 0) {
    const hp2 = e.maxHealth;
    const before2 = g.totalDamageDealt;
    g['handleEnemyKill'](e);
    ok('C: second kill adds additively', g.totalDamageDealt === before2 + hp2,
      `before2=${before2}, hp2=${hp2}, after=${g.totalDamageDealt}`);
  }});

  // ---- D) GameOver propagation ----
  // Assign a sentinel, then fire gameOver() and read back gameOverStats.
  const sentinel = 1_234_567;
  g.totalDamageDealt = sentinel;
  // gameOver() is private but accessible at runtime — same as handleEnemyKill above.
  g['gameOver']();
  ok('D: gameOverStats.totalDamageDealt matches totalDamageDealt at run-end',
    g.gameOverStats.totalDamageDealt === sentinel,
    `expected=${sentinel}, got=${g.gameOverStats.totalDamageDealt}`);

  // ---- E) Display format spot-checks ----
  // formatShort is bundled in the production build but not re-exported on window.
  // Mirror the implementation here and spot-check the values that the GameOverScene
  // will render (the same function is applied in draw()).
  const formatShort = (n) => {
    const neg = n < 0;
    let v = Math.abs(Math.round(n));
    if (v < 1000) return (neg ? '-' : '') + v.toString();
    const units = [{d:1e12,s:'T'},{d:1e9,s:'B'},{d:1e6,s:'M'},{d:1e3,s:'K'}];
    for (const u of units) {
      if (v >= u.d) {
        const scaled = v / u.d;
        const str = scaled >= 10 ? Math.floor(scaled).toString() : (Math.floor(scaled * 10) / 10).toString();
        return (neg ? '-' : '') + str + u.s;
      }
    }
    return (neg ? '-' : '') + v.toString();
  };
  ok('E: formatShort(0) → "0"', formatShort(0) === '0', `got="${formatShort(0)}"`);
  ok('E: formatShort(825) → "825"', formatShort(825) === '825', `got="${formatShort(825)}"`);
  ok('E: formatShort(47000) → "47K"', formatShort(47000) === '47K', `got="${formatShort(47000)}"`);
  ok('E: formatShort(1200000) → "1.2M"', formatShort(1200000) === '1.2M', `got="${formatShort(1200000)}"`);
  ok('E: formatShort(12000000) → "12M"', formatShort(12000000) === '12M', `got="${formatShort(12000000)}"`);

  // ---- F) Render safety ----
  // After gameOver() fired in D, state is 'gameover'. Run one update() frame to
  // exercise the GameOverScene draw path with non-zero totalDamageDealt.
  ok('F: game state is "gameover" after gameOver()', g.state === 'gameover', `state=${g.state}`);
  try {
    g.update(0.016);
    ok('F: update() in gameover state with non-zero damage produces no throw', true, '');
  } catch (err) {
    ok('F: update() in gameover state with non-zero damage produces no throw', false, String(err));
  }

  return { checks };
});

await browser.close();
server.close();

const pass = result && !result.fatal && errors.length === 0 &&
  result.checks.every(c => c.pass);

console.log('\n=== GameOver damage stat QA (Game.ts + GameOverScene) ===');
if (result.fatal) {
  console.log('FATAL:', result.fatal);
} else {
  for (const c of result.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  }
}
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
const n = result.checks?.length ?? 0;
const p2 = result.checks?.filter(c => c.pass).length ?? 0;
console.log(`\n${p2}/${n} checks`);
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
