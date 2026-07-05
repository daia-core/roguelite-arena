#!/usr/bin/env node
// INTERACTION QA (shipped frontend/dist): the CEREMONIAL DAGGERS re-entrancy guard must
// hold across EVERY kill path, not just the direct projectile hit.
//
// The documented invariant (qa-daggers.mjs) is: "a dagger's own kill never spawns more
// daggers, so the chain is bounded to one generation per PRIMARY kill — a dense pack can't
// cascade into an exponential dagger storm." The direct-hit path threads that origin
// (handleEnemyKill(enemy, proj.isDagger)), but a dagger that HITS-without-killing then runs
// applyOnHitEffects, whose PROC-kills (chain lightning, explosion-on-hit) and whose applied
// DoTs (poison/burn/bleed/doom, resolved later in killByDot) killed via handleEnemyKill(...)
// with the DEFAULT fromDagger=false -> those kills spawned a fresh generation of daggers.
// That is the cascade this QA reproduces and locks shut.
//
// Deterministic levers (no flaky proc rolls):
//   - explosion-on-hit (explosive_t3) is a BOOLEAN -> fires on every hit.
//   - 4x chain_lightning_t3 = 0.25*4 = 1.0 chance -> rollProc(1.0) always true.
//   - poison_t3 applies a DoT; we then call killByDot() directly to resolve it.
// A stub enemy of type 'slime' (xp/gold 0) skips every death-branch special-case, so the
// only projectiles that appear are the daggers under test. TS `private` is compile-time
// only, so g.applyOnHitEffects / g.killByDot / g.handleEnemyKill are reachable at runtime.
//
// Checks:
//   1. Data: ceremonial_daggers_t3 exists (ceremonialDaggers===3).
//   2. CONTROL (explosion, non-dagger origin): a normal hit whose explosion kills a neighbor
//      DOES spawn 3 daggers (the guard must not over-suppress legitimate on-kills).
//   3. FIX TARGET (explosion, dagger origin): a dagger hit whose explosion kills a neighbor
//      spawns 0 daggers.
//   4. CONTROL (chain, non-dagger origin): chain-lightning kill spawns 3 daggers.
//   5. FIX TARGET (chain, dagger origin): chain-lightning kill spawns 0 daggers.
//   6. CONTROL (DoT, non-dagger origin): a non-dagger poison -> killByDot spawns 3 daggers,
//      and the enemy is NOT tagged dagger-origin.
//   7. FIX TARGET (DoT, dagger origin): a dagger's poison tags the enemy, and the later
//      killByDot spawns 0 daggers.
//   8. REGRESSION: the original direct-hit guard still holds — handleEnemyKill(e, true)==0.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/dagger-cascade';
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

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
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

  const daggerItem = DB.getItemById('ceremonial_daggers_t3');
  const explosive = DB.getItemById('explosive_t3');
  const chain = DB.getItemById('chain_lightning_t3');
  const poison = DB.getItemById('poison_t3');
  const daggers = () => g.projectiles.filter(p => p.isDagger);

  // A minimal enemy sufficient for the explosion/chain/DoT loops + handleEnemyKill.
  // xp/gold 0 => the kill skips every death-branch special-case; health huge on the
  // directly-"hit" enemy so it survives (only the neighbor / the DoT resolves to a kill).
  const mkEnemy = (x, y, health = 1) => ({
    type: 'slime', isMiniboss: false, x, y, dead: false,
    health, maxHealth: health,
    poisonTimer: 0, burnTimer: 0, bleedTimer: 0, poisonSpreads: false,
    woundMult: 1, doomTimer: 0, doomStored: 0, daggerDot: false,
    lastX: x, lastY: y,
    typeData: { isBoss: false, xpValue: 0, goldValue: 0, damage: 0, radius: 10 },
    takeDamage(d) { this.health -= d; if (this.health <= 0) this.dead = true; return null; },
  });
  const setWorld = (...es) => { g.enemies.length = 0; g.enemies.push(...es); g.projectiles.length = 0; };

  // === 1. Catalog entry. ===
  out.itemExists = !!daggerItem && daggerItem.ceremonialDaggers === 3;

  // === 2/3. Explosion-on-hit proc kill. ===
  // Control: a NON-dagger hit whose explosion kills the neighbor spawns 3 daggers.
  g.startNewGame();
  g.playerStats.addItem(daggerItem); g.playerStats.addItem(explosive);
  setWorld(mkEnemy(100, 100, 1e9), mkEnemy(120, 100, 1));
  g.applyOnHitEffects(g.enemies[0], 100, false);
  out.controlExplosionSpawns = daggers().length === 3;

  // Fix target: a DAGGER hit whose explosion kills the neighbor spawns 0.
  g.startNewGame();
  g.playerStats.addItem(daggerItem); g.playerStats.addItem(explosive);
  setWorld(mkEnemy(100, 100, 1e9), mkEnemy(120, 100, 1));
  g.applyOnHitEffects(g.enemies[0], 100, true);
  out.daggerExplosionSuppressed = daggers().length === 0;

  // === 4/5. Chain-lightning proc kill (4 copies -> 100% chance). ===
  g.startNewGame();
  g.playerStats.addItem(daggerItem);
  for (let i = 0; i < 4; i++) g.playerStats.addItem(chain);
  setWorld(mkEnemy(100, 100, 1e9), mkEnemy(150, 100, 1));
  g.applyOnHitEffects(g.enemies[0], 100, false);
  out.controlChainSpawns = daggers().length === 3;

  g.startNewGame();
  g.playerStats.addItem(daggerItem);
  for (let i = 0; i < 4; i++) g.playerStats.addItem(chain);
  setWorld(mkEnemy(100, 100, 1e9), mkEnemy(150, 100, 1));
  g.applyOnHitEffects(g.enemies[0], 100, true);
  out.daggerChainSuppressed = daggers().length === 0;

  // === 6. DoT control: a non-dagger poison, resolved by killByDot, spawns 3. ===
  g.startNewGame();
  g.playerStats.addItem(daggerItem); g.playerStats.addItem(poison);
  setWorld(mkEnemy(100, 100, 1e9));
  g.applyOnHitEffects(g.enemies[0], 100, false);
  out.controlDotTagFalse = g.enemies[0].daggerDot === false;
  g.killByDot(g.enemies[0]);
  out.controlDotSpawns = daggers().length === 3;

  // === 7. DoT fix target: a dagger's poison tags the enemy; killByDot spawns 0. ===
  g.startNewGame();
  g.playerStats.addItem(daggerItem); g.playerStats.addItem(poison);
  setWorld(mkEnemy(100, 100, 1e9));
  g.applyOnHitEffects(g.enemies[0], 100, true);
  out.daggerDotTagged = g.enemies[0].daggerDot === true;
  g.killByDot(g.enemies[0]);
  out.daggerDotSuppressed = daggers().length === 0;

  // === 8. Regression: the original direct-hit guard still holds. ===
  g.startNewGame();
  g.playerStats.addItem(daggerItem);
  setWorld();
  g.handleEnemyKill(mkEnemy(100, 100, 1), true);
  out.directGuardHolds = daggers().length === 0;

  return out;
});

await browser.close();
server.close();

console.log('\n=== Ceremonial Daggers cascade / re-entrancy interaction QA ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const checks = ['itemExists','controlExplosionSpawns','daggerExplosionSuppressed',
  'controlChainSpawns','daggerChainSuppressed','controlDotTagFalse','controlDotSpawns',
  'daggerDotTagged','daggerDotSuppressed','directGuardHolds'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
