#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) that the new AUXILIARY weapons STACK
// on top of the primary weapon and actually deal damage:
//   1. Orbiting orbs spawn to match the item count and grind enemies.
//   2. A bomb-drop item drops bombs on a cooldown that detonate + damage.
//   3. A nova item pulses shockwaves that damage enemies.
//   4. A whirling-melee item swings an arc WHILE the gun still fires (coexist).
// Deterministic: steps the real g.update(dt) loop, no rAF.
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
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };
  const out = {};

  const giveItem = (id) => {
    const item = DB.getItemById(id);
    if (!item) return false;
    g.playerStats.addItem(item);
    return true;
  };
  // Spawn a ring of dummy enemies close to the player so every aux weapon can reach them.
  const spawnRing = (n, dist) => {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const NO_RESULT = { shouldShoot:false, shouldTeleport:false, shouldSummon:false, shouldScream:false, shouldStomp:false, splitInto:0, poisonTrail:false, sporeCloud:false, shouldHeal:false, shouldSpawnMinion:false };
      const e = {
        id: 1000 + i, type: 'slime', x: g.player.x + Math.cos(a) * dist, y: g.player.y + Math.sin(a) * dist,
        radius: 14, dead: false, health: 100000, hp: 100000,
        frozenTimer: 0, poisonTimer: 0, contactCooldown: 999, usePathfinding: false,
        typeData: { isBoss: false, damage: 5, xpValue: 1, goldValue: 1 },
        takeDamage(d) { this.health -= d; this._dmg = (this._dmg||0)+d; if (this.health<=0) this.dead=true; return null; },
        applyKnockback() {}, checkWallCollision() {}, draw() {}, updatePath() {},
        collidesWith() { return false; },  // never contact-damages the player
        update() { return NO_RESULT; }      // no enemy AI actions
      };
      g.enemies.push(e);
    }
  };
  const totalDmg = () => g.enemies.reduce((s,e)=>s+(e._dmg||0),0);

  // === 1. ORBITING ORBS ===
  g.startNewGame();
  out.baseWeapon = g.playerStats.getWeaponType();          // should stay 'auto-aim' throughout
  giveItem('orbit_orb_t2');                                 // +1 orb
  giveItem('orbit_orb_swarm_t3');                           // +2 orbs (=> 3 total, additive/stacks)
  out.orbCount = g.playerStats.getOrbitOrbCount();          // expect 3
  spawnRing(8, 70);
  const orbDmgBefore = totalDmg();
  for (let i=0;i<180;i++) g.update(1/60);
  out.orbsAlive = g.orbitingOrbs.length;                    // expect 3 (matches count)
  out.orbDamageDealt = totalDmg() - orbDmgBefore;           // expect > 0 (orbs grind ring)
  out.weaponStillPrimary = g.playerStats.getWeaponType();   // still 'auto-aim'

  // === 2. BOMBS ===
  g.startNewGame();
  giveItem('bomb_bandolier_t2');
  spawnRing(6, 40);
  const bombDmgBefore = totalDmg();
  let sawBomb = false;
  for (let i=0;i<360;i++){ g.update(1/60); if (g.bombs.length>0) sawBomb = true; }
  out.bombSpawned = sawBomb;                                // a bomb was dropped
  out.bombDamageDealt = totalDmg() - bombDmgBefore;         // detonation damaged enemies

  // === 3. NOVA ===
  g.startNewGame();
  giveItem('nova_core_t3');
  spawnRing(10, 120);
  const novaDmgBefore = totalDmg();
  let sawWave = false;
  for (let i=0;i<360;i++){ g.update(1/60); if (g.shockwaves.length>0) sawWave = true; }
  out.novaSpawned = sawWave;
  out.novaDamageDealt = totalDmg() - novaDmgBefore;

  // === 4. WHIRLING MELEE COEXISTS WITH SHOTS ===
  g.startNewGame();
  // Primary stays a gun (auto-aim). Add the aux melee — expect BOTH melee arcs AND projectiles.
  giveItem('whirl_blades_t2');
  out.primaryIsGun = g.playerStats.getWeaponType();         // 'auto-aim' (NOT replaced by melee)
  spawnRing(6, 60);
  let sawMelee = false, sawProjectile = false;
  for (let i=0;i<240;i++){
    g.update(1/60);
    if (g.meleeAttacks.length>0) sawMelee = true;
    if (g.projectiles.length>0) sawProjectile = true;
  }
  out.meleeAndShotsCoexist = sawMelee && sawProjectile;     // the key ask: they STACK

  return out;
});

await browser.close();
server.close();

console.log('\n=== Stacking / diverse aux weapons (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result && !result.fatal
  && result.baseWeapon === 'auto-aim'
  && result.orbCount === 3
  && result.orbsAlive === 3
  && result.orbDamageDealt > 0
  && result.weaponStillPrimary === 'auto-aim'
  && result.bombSpawned === true
  && result.bombDamageDealt > 0
  && result.novaSpawned === true
  && result.novaDamageDealt > 0
  && result.primaryIsGun === 'auto-aim'
  && result.meleeAndShotsCoexist === true
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
