#!/usr/bin/env node
// HIT-STOP (freeze-frame "punch") test — proves the feel feature is real and
// correctly GATED, driven through the genuine production code paths on the
// shipped frontend/dist bundle (cp-b3: build fresh + test what ships; cp-b7:
// exercise the real handleEnemyKill + update() loop, not a mocked shim).
//
//  A) Clamp/merge: triggerHitPause takes the longer request and never exceeds
//     the hard ceiling (0.13s) — gameplay can't be frozen unfairly long.
//  B) Gating: a REAL enemy killed via the genuine handleEnemyKill arms a freeze
//     ONLY when it's a boss (~0.12) or miniboss (~0.06) — fodder arms nothing
//     (the arena clears thousands of trash/sec; a per-kill freeze would stutter).
//  C) Freeze behaviour through the real update() loop: while the timer is >0 the
//     playing sim advances by dt=0 (a real enemy does NOT move) yet the timer
//     drains by REAL time and gameplay resumes once it hits 0.
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
  if (typeof g.triggerHitPause !== 'function') return { fatal: 'no triggerHitPause on Game' };

  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  // ---- A) Clamp / take-the-max ----
  g.startNewGame();
  g.hitPauseTimer = 0;
  g.triggerHitPause(1.0);
  ok('clamp: triggerHitPause(1.0) capped at 0.13', near(g.hitPauseTimer, 0.13), `timer=${g.hitPauseTimer}`);
  g.hitPauseTimer = 0;
  g.triggerHitPause(0.05); g.triggerHitPause(0.02);
  ok('take-max: 0.05 then 0.02 stays 0.05', near(g.hitPauseTimer, 0.05), `timer=${g.hitPauseTimer}`);

  // ---- Spawn REAL enemies to kill through the genuine handler ----
  // Mirror the real loadFromSave combat-entry: reset + start wave 1 + playing.
  g.waveManager.reset();
  g.waveManager.startWave(1);
  g.state = 'playing';
  for (let i = 0; i < 80 && g.enemies.length === 0; i++) g.update(0.2);
  ok('spawned real enemies via the live wave loop', g.enemies.length > 0, `count=${g.enemies.length}`);
  const e = g.enemies.find(x => !x.dead) || g.enemies[0];
  const savedTD = e.typeData, savedMini = e.isMiniboss;

  // ---- B) Gating on the REAL handleEnemyKill ----
  // fodder → no freeze
  g.hitPauseTimer = 0;
  e.isMiniboss = false;
  e.typeData = Object.assign({}, savedTD, { isBoss: false });
  g.handleEnemyKill(e);
  ok('gate: fodder kill arms NO hit-stop', g.hitPauseTimer === 0, `timer=${g.hitPauseTimer}`);
  // boss → ~0.12
  g.hitPauseTimer = 0;
  e.isMiniboss = false;
  e.typeData = Object.assign({}, savedTD, { isBoss: true });
  g.handleEnemyKill(e);
  ok('gate: boss kill arms ~0.12 hit-stop', near(g.hitPauseTimer, 0.12), `timer=${g.hitPauseTimer}`);
  // miniboss → ~0.06
  g.hitPauseTimer = 0;
  e.typeData = Object.assign({}, savedTD, { isBoss: false });
  e.isMiniboss = true;
  g.handleEnemyKill(e);
  ok('gate: miniboss kill arms ~0.06 hit-stop', near(g.hitPauseTimer, 0.06), `timer=${g.hitPauseTimer}`);
  e.typeData = savedTD; e.isMiniboss = savedMini;

  // ---- C) Freeze behaviour through the real update() loop ----
  const p = g.player;
  const en = g.enemies.find(x => !x.dead) || g.enemies[0];
  en.dead = false;
  // Park it far to the right of the player so any enemy type closes inward.
  const place = () => { en.x = p.x + 600; en.y = p.y; };

  // sanity: a normal frame moves it
  g.hitPauseTimer = 0;
  place();
  let x0 = en.x;
  g.update(0.05);
  ok('sanity: enemy moves on a normal frame', Math.abs(en.x - x0) > 1e-3, `dx=${(en.x - x0).toFixed(3)}`);

  // freeze: no movement, timer drains
  place();
  g.hitPauseTimer = 0.1;
  x0 = en.x;
  g.update(0.05);
  ok('freeze: enemy does NOT move during hit-stop', Math.abs(en.x - x0) < 1e-9, `dx=${(en.x - x0).toExponential(2)}`);
  ok('freeze: timer drains by REAL dt (0.1→0.05)', near(g.hitPauseTimer, 0.05), `timer=${g.hitPauseTimer}`);
  g.update(0.05); // 0.05 → 0.0
  ok('freeze: timer reaches 0 after the window', g.hitPauseTimer <= 0, `timer=${g.hitPauseTimer}`);

  // resume: movement returns
  place();
  x0 = en.x;
  g.update(0.05);
  ok('resume: enemy moves again after hit-stop', Math.abs(en.x - x0) > 1e-3, `dx=${(en.x - x0).toFixed(3)}`);

  return { checks };
});

await browser.close();
server.close();

console.log('\n=== Hit-stop (shipped frontend/dist) ===');
let pass = result && !result.fatal && errors.length === 0;
if (result.fatal) { console.log('FATAL:', result.fatal); }
else {
  for (const c of result.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  — ${c.detail}`);
    if (!c.pass) pass = false;
  }
}
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
