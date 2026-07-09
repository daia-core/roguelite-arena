#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the melee-STACKS refactor:
//   A. Default swing: with NO items, the player auto-swings nearby enemies AND
//      the gun still fires projectiles (both coexist from scratch).
//   B. Crescent Blade (formerly weaponType:'melee') now STACKS — it no longer
//      replaces the gun: getWeaponType stays 'auto-aim', projectiles keep firing,
//      and the swing gets stronger. This is the reported bug fix.
//   C. Thunder Hammer grants a full-circle AOE swing (swingAoe > 0, arc == 2π).
//   D. The AOE-radius stat getter exists and defaults to 1 (hook for AOE builds).
// Boots straight into a real wave (startNewGame leaves state='map' now), forces
// 'playing', and steps the deterministic g.update(dt) loop.
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
  // Drop a wall of immortal dummies around the player, in swing reach.
  const spawnRing = (n, dist) => {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const NO = { shouldShoot:false, shouldTeleport:false, shouldSummon:false, shouldScream:false, shouldStomp:false, splitInto:0, poisonTrail:false, sporeCloud:false, shouldHeal:false, shouldSpawnMinion:false };
      // statusFX stub: StatusEffectManager was wired into updateEnemies after this script was
      // written (enemy.statusFX.tick() is called every frame). Provide a no-op mock so the
      // immortal dummies work without pulling in the real engine.
      const statusFX = {
        tick: () => ({ dotDamage: 0, doomDetonation: null, poisonSpreads: false, daggerDot: false }),
        getBonusCritChanceReceived: () => 0,
        getBonusCritDamageReceived: () => 0,
        getIncomingDamageMult: () => 1,
        getDirectHitMult: () => 1,
        getFlatHitBonus: () => 0,
        checkCondemned: () => 0,
        apply: () => [], has: () => false,
      };
      const ex = g.player.x + Math.cos(a) * dist, ey = g.player.y + Math.sin(a) * dist;
      g.enemies.push({
        id: 5000 + i, type: 'slime', x: ex, y: ey, lastX: ex, lastY: ey,
        radius: 14, dead: false, health: 1e9, hp: 1e9,
        frozenTimer: 0, poisonTimer: 0, contactCooldown: 999, usePathfinding: false,
        typeData: { isBoss: false, damage: 5, xpValue: 1, goldValue: 1 },
        statusFX,
        takeDamage(d){ this.health -= d; this._dmg=(this._dmg||0)+d; return null; },
        applyKnockback(){}, checkWallCollision(){}, draw(){}, updatePath(){},
        collidesWith(){ return false; }, update(){ return NO; }
      });
    }
  };
  const forcePlaying = () => { g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing'; };
  const totalDmg = () => g.enemies.reduce((s,e)=>s+(e._dmg||0),0);

  // === A. DEFAULT SWING + GUN COEXIST (no items) ===
  g.startNewGame(); forcePlaying();
  out.defaultWeapon = g.playerStats.getWeaponType(); // 'auto-aim'
  spawnRing(8, 45);
  let sawMeleeA=false, sawProjA=false;
  for (let i=0;i<180;i++){ g.update(1/60); if (g.meleeAttacks.length) sawMeleeA=true; if (g.projectiles.length) sawProjA=true; }
  out.defaultSwingSwung = sawMeleeA;   // the free swing fires
  out.defaultGunFired = sawProjA;      // the gun fires
  out.defaultSwingDamage = totalDmg() > 0;

  // === B. CRESCENT BLADE STACKS (bug fix) ===
  g.startNewGame(); forcePlaying();
  giveItem('melee_sword_t2');           // former weaponType:'melee'
  out.crescentWeaponType = g.playerStats.getWeaponType(); // must STAY 'auto-aim'
  spawnRing(8, 45);
  let sawMeleeB=false, sawProjB=false;
  for (let i=0;i<180;i++){ g.update(1/60); if (g.meleeAttacks.length) sawMeleeB=true; if (g.projectiles.length) sawProjB=true; }
  out.crescentProjectilesStillFire = sawProjB; // the reported bug: this must be TRUE now
  out.crescentSwingWorks = sawMeleeB;

  // === C. THUNDER HAMMER = AOE SWING ===
  g.startNewGame(); forcePlaying();
  giveItem('hammer_weapon_t3');
  out.hammerSwingAoe = g.playerStats.getSwingAoe(); // > 0
  spawnRing(10, 80);
  let hammerArc = 0;
  for (let i=0;i<180;i++){ g.update(1/60); if (g.meleeAttacks.length) hammerArc = Math.max(hammerArc, g.meleeAttacks[0].arc); }
  out.hammerFullCircle = hammerArc >= Math.PI * 2 - 0.01;

  // === D. AOE STAT HOOK ===
  g.startNewGame(); forcePlaying();
  out.aoeMultBaseline = g.playerStats.getAoeRadiusMult(); // 1

  return out;
});

await browser.close();
server.close();

console.log('\n=== Melee-stacks refactor (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result && !result.fatal
  && result.defaultWeapon === 'auto-aim'
  && result.defaultSwingSwung === true
  && result.defaultGunFired === true
  && result.defaultSwingDamage === true
  && result.crescentWeaponType === 'auto-aim'
  && result.crescentProjectilesStillFire === true
  && result.crescentSwingWorks === true
  && result.hammerSwingAoe > 0
  && result.hammerFullCircle === true
  && result.aoeMultBaseline === 1
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
