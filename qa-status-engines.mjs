#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the Phase-3b status engines:
//   A. Burn (Ignite)  — burnTimer ticks fire DoT onto an enemy over time.
//   B. Bleed          — bleedTimer ticks, and a MOVING enemy bleeds harder than a still one.
//   C. Doom           — a Doom mark stores damage then detonates; a low-HP marked enemy is executed.
//   D. Wound          — woundMult rises on-hit and multiplies a concurrent DoT (more damage dealt).
//   E. Poison-spread  — a poisoned+spread enemy that dies from poison infects a live neighbor.
//   F. Multicast      — a bonus volley fires the same frame (more projectiles than fireRate alone).
//   G. Melee applies statuses — a swing (no gun kills) puts a burn on an enemy it hits.
// Uses the __game / __ItemDatabase hooks and steps the deterministic g.update(dt) loop.
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

  const giveItem = (id) => { const it = DB.getItemById(id); if (!it) return false; g.playerStats.addItem(it); return true; };
  const forcePlaying = () => { g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing'; };
  const NO = { shouldShoot:false, shouldTeleport:false, shouldSummon:false, shouldScream:false, shouldStomp:false, splitInto:0, poisonTrail:false, sporeCloud:false, shouldHeal:false, shouldSpawnMinion:false };
  // A single immortal-ish dummy so DoT is measurable without the enemy dying.
  const dummy = (x, y, hp = 1e9) => {
    const e = {
      id: Math.floor(Math.random()*1e6), type: 'slime', x, y,
      radius: 14, dead: false, health: hp, hp,
      frozenTimer: 0, poisonTimer: 0, burnTimer: 0, bleedTimer: 0, poisonSpreads: false, woundMult: 1, doomTimer: 0, doomStored: 0, lastX: x, lastY: y,
      contactCooldown: 999, usePathfinding: false,
      typeData: { isBoss:false, damage:5, xpValue:1, goldValue:1, radius:14 },
      knockbackVelocityX:0, knockbackVelocityY:0, hitFlashTimer:0,
      takeDamage(d){ this.health -= d; this._dmg=(this._dmg||0)+d; return null; },
      applyKnockback(){}, checkWallCollision(){}, draw(){}, updatePath(){},
      collidesWith(){ return false; }, update(){ return NO; }
    };
    g.enemies.push(e); return e;
  };
  const stepN = (n) => { for (let i=0;i<n;i++) g.update(1/60); };

  // === A. BURN === (far away so gun/swing don't confound the DoT read)
  g.startNewGame(); forcePlaying();
  { const e = dummy(g.player.x + 5000, g.player.y + 5000);
    e.burnTimer = 2.0; const h0 = e.health; stepN(60);
    out.burnTicks = e.health < h0; out.burnTimerDecayed = e.burnTimer < 2.0; }

  // === B. BLEED scales with movement ===
  // Measure DoT in isolation via _dmg-free health tracking: place enemies FAR outside
  // gun/swing reach (5000px) so the only thing touching health is the bleed DoT tick.
  g.startNewGame(); forcePlaying();
  { const still = dummy(g.player.x + 5000, g.player.y + 5000);
    still.bleedTimer = 3.0; const s0 = still.health;
    for (let i=0;i<120;i++){ g.update(1/60); } // still: never moves, lastX==x each frame
    const stillLost = s0 - still.health;
    // moving enemy: teleport it each frame so measured movement is large
    const mover = dummy(g.player.x + 6000, g.player.y + 6000);
    mover.bleedTimer = 3.0; const m0 = mover.health; let mx = mover.x;
    for (let i=0;i<120;i++){ mx += 30; mover.x = mx; g.update(1/60); }
    const moverLost = m0 - mover.health;
    out.bleedStillLost = Math.round(stillLost);
    out.bleedMoverLost = Math.round(moverLost);
    out.bleedMoverHurtsMore = moverLost > stillLost * 1.3; }

  // === C. DOOM executes a low-HP marked enemy ===
  g.startNewGame(); forcePlaying();
  { const e = dummy(g.player.x + 400, g.player.y + 400, 30);
    e.doomStored = 200; e.doomTimer = 0.1; // big payload, short fuse, low HP => execute
    stepN(30);
    out.doomExecuted = e.dead === true; }

  // === D. WOUND amplifies a DoT === (far away for clean DoT-only reads)
  g.startNewGame(); forcePlaying();
  { const plain = dummy(g.player.x + 5000, g.player.y + 5000);
    plain.burnTimer = 2.0; const p0 = plain.health; stepN(60);
    const plainLost = p0 - plain.health;
    const wounded = dummy(g.player.x + 6000, g.player.y + 6000);
    wounded.burnTimer = 2.0; wounded.woundMult = 2; const w0 = wounded.health; stepN(60);
    const woundedLost = w0 - wounded.health;
    out.woundAmplifies = woundedLost > plainLost * 1.5; }

  // === E. POISON-SPREAD hops on death === (far away so ONLY poison kills the dying one,
  // routing through killByDot; a gun kill would route through handleEnemyKill and not spread)
  g.startNewGame(); forcePlaying();
  { const dying = dummy(g.player.x + 5000, g.player.y + 5000, 5); // low HP so poison kills it
    dying.poisonTimer = 3.0; dying.poisonSpreads = true;
    const neighbor = dummy(g.player.x + 5020, g.player.y + 5000, 1e9);
    let sawSpread = false;
    for (let i=0;i<120 && !sawSpread;i++){ g.update(1/60); if (neighbor.poisonTimer > 0) sawSpread = true; }
    out.poisonSpread = sawSpread; }

  // === F. MULTICAST fires bonus volleys ===
  g.startNewGame(); forcePlaying();
  { // baseline: count projectiles spawned over N frames with NO multicast
    const target = dummy(g.player.x + 120, g.player.y);
    let baseShots = 0; g.projectiles.length = 0;
    for (let i=0;i<120;i++){ g.update(1/60); baseShots += g.projectiles.length; g.projectiles.length = 0; }
    // now stack heavy multicast and count again
    giveItem('twin_echo_core_t4'); giveItem('echo_prism_t3');
    let mcShots = 0; g.projectiles.length = 0;
    for (let i=0;i<120;i++){ g.update(1/60); mcShots += g.projectiles.length; g.projectiles.length = 0; }
    out.multicastChance = g.playerStats.getMulticastChance();
    out.baseShots = baseShots; out.mcShots = mcShots;
    out.multicastFiresMore = mcShots > baseShots; }

  // === G. MELEE swing applies statuses (burn) ===
  g.startNewGame(); forcePlaying();
  { giveItem('ember_brand_t1'); // 25% burn
    // Give the swing huge reach + fast cadence and wrap the player in dummies so it
    // connects many times; assert at least one dummy got a burnTimer.
    const items = [];
    for (let k=0;k<3;k++) { const it = DB.getItemById('warglaive_storm_t3'); if (it) g.playerStats.addItem(it); }
    const ring = [];
    for (let i=0;i<8;i++){ const a=(Math.PI*2*i)/8; ring.push(dummy(g.player.x+Math.cos(a)*40, g.player.y+Math.sin(a)*40)); }
    let sawBurnFromMelee = false;
    for (let i=0;i<600 && !sawBurnFromMelee;i++){ g.update(1/60); if (ring.some(e=>e.burnTimer>0)) sawBurnFromMelee = true; }
    out.meleeAppliesStatus = sawBurnFromMelee; }

  return out;
});

await browser.close();
server.close();

console.log('\n=== Status engines (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result && !result.fatal
  && result.burnTicks === true
  && result.burnTimerDecayed === true
  && result.bleedMoverHurtsMore === true
  && result.doomExecuted === true
  && result.woundAmplifies === true
  && result.poisonSpread === true
  && result.multicastFiresMore === true
  && result.meleeAppliesStatus === true
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
