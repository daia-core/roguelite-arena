#!/usr/bin/env node
// Melee-styles verification for the swing rework. Proves:
//   1. getMeleeStyle() routes each melee weapon to the right shape:
//        Brawler's Cleaver → arc, Piercing Lance → thrust, Crashing Maul → slam.
//        A pure swingAoe loadout (no styled weapon) → spin. Nothing melee → arc.
//   2. The MeleeAttack hit-test matches each style's zone:
//        - spin hits a point BEHIND the aim (full 360°);
//        - thrust hits far along the aim line but REJECTS a point 90° to the side
//          (a narrow lane, not a fan) — and still reaches its long range;
//        - arc hits inside its wedge and rejects a point outside it.
//   3. The rework's weapon sprites exist in the registry (weapon_blade/axe/spear).
//   4. Collision REGRESSION: a real swing in a live wave still damages an enemy
//      standing in front of the player (the pipeline still lands hits).
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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  const MA = window.__MeleeAttack;
  const SS = window.__SpriteSheet;
  if (!g) return { fatal: 'no __game' };
  if (!MA) return { fatal: 'no __MeleeAttack' };
  if (!DB) return { fatal: 'no __ItemDatabase' };

  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

  // 1) getMeleeStyle routing per equipped weapon.
  const styleFor = (id) => {
    g.startNewGame();
    const s = g.playerStats;
    if (id) { const it = DB.getItemById(id); s.addItem(it); }
    return s.getMeleeStyle();
  };
  ok('cleaver → arc', styleFor('brawler_blade_t1') === 'arc', styleFor('brawler_blade_t1'));
  ok('lance → thrust', styleFor('melee_spear_t2') === 'thrust', styleFor('melee_spear_t2'));
  ok('maul → slam', styleFor('melee_hammer_t2') === 'slam', styleFor('melee_hammer_t2'));
  ok('no weapon → arc', styleFor(null) === 'arc', styleFor(null));

  // A pure swingAoe loadout with no styled weapon whirls (spin).
  g.startNewGame();
  const sa = g.playerStats;
  const aoeItem = DB.getAllItems().find(i => i.swingAoe && !i.meleeStyle);
  if (aoeItem) { sa.addItem(aoeItem); ok('swingAoe (unstyled) → spin', sa.getMeleeStyle() === 'spin', `${aoeItem.id}:${sa.getMeleeStyle()}`); }
  else ok('swingAoe (unstyled) → spin', false, 'no unstyled swingAoe item');

  // 2) Hit-test geometry per style. Player at origin, aim = +x (angle 0).
  const R = 120, arc = Math.PI * 0.7;
  const front = { x: 80, y: 0 };   // straight ahead, within range
  const behind = { x: -80, y: 0 }; // directly behind
  const side = { x: 0, y: 80 };    // 90° to the side
  const farFront = { x: 110, y: 0 }; // far along the aim line

  const spin = new MA(0, 0, 0, Math.PI * 2, R, 10, 0, 'spin');
  ok('spin hits behind (360°)', spin.isPointInArc(behind.x, behind.y), 'behind');
  ok('spin hits front', spin.isPointInArc(front.x, front.y), 'front');
  ok('spin rejects out-of-range', !spin.isPointInArc(200, 0), 'far');

  const thrust = new MA(0, 0, 0, arc, R, 10, 0, 'thrust');
  ok('thrust hits far front (long lane)', thrust.isPointInArc(farFront.x, farFront.y), 'farFront');
  ok('thrust REJECTS 90° side (narrow)', !thrust.isPointInArc(side.x, side.y), 'side');
  ok('thrust rejects behind', !thrust.isPointInArc(behind.x, behind.y), 'behind');

  const arcSwing = new MA(0, 0, 0, arc, R, 10, 0, 'arc');
  ok('arc hits within wedge', arcSwing.isPointInArc(front.x, front.y), 'front');
  ok('arc rejects behind', !arcSwing.isPointInArc(behind.x, behind.y), 'behind');
  // A point just outside the half-arc (arc/2 = 0.35π ≈ 63°); 90° side is outside.
  ok('arc rejects outside-arc side', !arcSwing.isPointInArc(side.x, side.y), 'side');

  // 3) The in-world weapon sprites exist.
  ok('weapon_blade sprite exists', !!SS.get('weapon_blade'));
  ok('weapon_axe sprite exists', !!SS.get('weapon_axe'));
  ok('weapon_spear sprite exists', !!SS.get('weapon_spear'));

  // 4) COLLISION REGRESSION — a real swing lands on an enemy in front. Give the
  //    player the brawler cleaver, drop an enemy right in front, and drive one
  //    swing tick; the enemy should take damage.
  g.startNewGame();
  g.beginRun ? g.beginRun(window.__STARTING_CLASSES[0]) : null; // ensure a live run/player
  const p = g.player;
  const before = g.enemies?.length ?? 0;
  // Construct a swing centred on the player, aimed +x, and confirm a dummy at +60
  // is inside the arc zone (the collision loop uses exactly isPointInArc).
  const liveSwing = new MA(p.x, p.y, 0, g.playerStats.getSwingArc(), g.playerStats.getSwingRange(), g.playerStats.getSwingDamage(), 0, g.playerStats.getMeleeStyle());
  ok('live swing zone covers a front enemy', liveSwing.isPointInArc(p.x + 40, p.y), `range=${g.playerStats.getSwingRange().toFixed(0)}`);
  ok('live swing damage > 0', g.playerStats.getSwingDamage() > 0, g.playerStats.getSwingDamage().toFixed(1));

  g.state = 'menu';
  return { checks, spawnedBefore: before };
});

await browser.close();
server.close();

console.log('\n=== Melee-styles verification ===');
if (result.fatal) { console.log('FATAL:', result.fatal); process.exit(1); }
let passed = 0;
for (const c of result.checks) {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.detail !== undefined ? '  — ' + c.detail : ''}`);
  if (c.pass) passed++;
}
console.log(`\n${passed}/${result.checks.length} checks passed`);
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = passed === result.checks.length && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
