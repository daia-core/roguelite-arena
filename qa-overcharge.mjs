#!/usr/bin/env node
/**
 * qa-overcharge.mjs — verify Overcharge Battery nova uses pendingDmg (enemy damage),
 * NOT AoeZone damage > 0 (which hits the player).
 *
 * Bug fixed Jul 18 2026: the overcharge nova was spawning AoeZone(damage=ocDmg, ...)
 * which damaged the PLAYER instead of enemies. Fix: AoeZone(damage=0) + pendingDmg.
 *
 * Tests:
 *   overchargeArtifactExists   — artifacts.overchargeEvery() is a function
 *   novaUsesAoeZeroDmg         — after nova fires, all NEW aoeZones have damage === 0
 *   novaAddsPendingDmg         — pendingDmg gets a new entry with r=130 after the nova
 *   playerHpUnchangedAfterNova — player HP does not decrease (no self-hit)
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-overcharge.mjs
 *
 * Approach: patch g.player.tryShoot to always return one fake projectile (satisfying
 * the "newProjectiles.length > 0" gate that wraps the overcharge block), and stub out
 * updateEnemies / updateProjectileCollisions / updateMeleeCollisions so the update tick
 * doesn't crash on missing real Enemy state.
 */

import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'frontend/dist');

const server = http.createServer((req, res) => {
  let fp = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(fp)) fp = path.join(DIST, 'index.html');
  const ext = path.extname(fp).slice(1);
  const mime = { html: 'text/html', js: 'application/javascript', css: 'text/css', png: 'image/png' };
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  headless: true,
});
const page = await browser.newPage();
const pageErrors = [];
page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });

const results = await page.evaluate(() => {
  const g = window.__game;

  // 1. Artifact method exists check
  const overchargeArtifactExists = typeof g.artifacts?.overchargeEvery === 'function';

  // 2. Fresh game — beginRun creates g.player (state='map')
  g.startNewGame();

  // 3. Force to playing state and sync lastUpdateState
  g.state = 'playing';
  g.update(0);  // state 'menu'→'playing': triggers disarmUntilRelease, lastUpdateState='playing'

  if (!g.player) {
    return { fatal: 'player is null after startNewGame+update', overchargeArtifactExists };
  }

  // 4. Grant the overcharge artifact — overchargeEvery() now returns 6
  const ocArtifact = {
    id: 'overcharge_battery', name: 'Overcharge Battery', icon: '🔋',
    rarity: 'epic', desc: 'Every 6th shot fires a free nova.',
    flags: ['overcharge'], overchargeEvery: 6,
  };
  g.artifacts.add(ocArtifact, g.playerStats);

  // 5. Patch tryShoot to always fire one projectile — bypasses the "no enemies" gate
  //    (the overcharge block lives inside "if (newProjectiles.length > 0)").
  //    Fake projectile carries all fields spawnVolley reads so it can pool correctly.
  const origTryShoot = g.player.tryShoot.bind(g.player);
  g.player.tryShoot = (_enemies, forceFire) => {
    if (forceFire) return []; // suppress multicast bonus volleys — only count primary
    return [{
      x: g.player.x + 10, y: g.player.y, vx: 1, vy: 0,
      damage: 10, speed: 300, fromPlayer: true, piercing: false,
      maxPierceCount: 1, homing: false, turnSpeed: 0, noTrail: false,
    }];
  };

  // 6. Stub out the post-shot update methods that need real Enemy instances — they
  //    run AFTER updatePlayerTick (where the overcharge fires) so stubbing is safe.
  const origUpdateEnemies = g.updateEnemies?.bind(g);
  const origUpdateProjectileCollisions = g.updateProjectileCollisions?.bind(g);
  const origUpdateMeleeCollisions = g.updateMeleeCollisions?.bind(g);
  const origUpdatePickupsAndCleanup = g.updatePickupsAndCleanup?.bind(g);
  if (g.updateEnemies) g.updateEnemies = () => {};
  if (g.updateProjectileCollisions) g.updateProjectileCollisions = () => {};
  if (g.updateMeleeCollisions) g.updateMeleeCollisions = () => {};
  if (g.updatePickupsAndCleanup) g.updatePickupsAndCleanup = () => {};

  // 7. Record HP and array lengths before the shot
  const hpBefore = g.player.health;
  const aoeZonesBefore = g.aoeZones.length;
  const pendingDmgBefore = g.pendingDmg.length;

  // 8. Prime: overchargeShotCount=5 → 6th shot → 6 % 6 = 0 → nova fires
  g.overchargeShotCount = 5;
  g.player.shootCooldown = 0;  // ensure shot fires on the very first tick

  // 9. One tick — updatePlayerTick fires → fake shot → count 5→6 → nova
  g.update(1 / 60);

  // 10. Restore patches
  g.player.tryShoot = origTryShoot;
  if (origUpdateEnemies) g.updateEnemies = origUpdateEnemies;
  if (origUpdateProjectileCollisions) g.updateProjectileCollisions = origUpdateProjectileCollisions;
  if (origUpdateMeleeCollisions) g.updateMeleeCollisions = origUpdateMeleeCollisions;
  if (origUpdatePickupsAndCleanup) g.updatePickupsAndCleanup = origUpdatePickupsAndCleanup;

  // 11. Collect results
  const hpAfter = g.player.health;
  const newZones = g.aoeZones.slice(aoeZonesBefore);
  const newPending = g.pendingDmg.slice(pendingDmgBefore);

  return {
    overchargeArtifactExists,
    hpBefore,
    hpAfter,
    playerHpUnchangedAfterNova: hpAfter >= hpBefore,
    aoeZonesBefore,
    aoeZonesAfter: g.aoeZones.length,
    novaUsesAoeZeroDmg: newZones.length > 0 && newZones.every(z => z.damage === 0),
    newZonesDamage: newZones.map(z => z.damage),
    pendingDmgBefore,
    pendingDmgAfter: g.pendingDmg.length,
    novaAddsPendingDmg: newPending.some(p => p.r === 130),
    newPendingR: newPending.map(p => p.r),
    overchargeShotCount: g.overchargeShotCount,
  };
});

console.log('\n=== Overcharge Battery — enemy-damage nova, no self-hit ===');
console.log(JSON.stringify(results, null, 2));
console.log(`Console/page errors: ${pageErrors.length}`);

if (results.fatal) {
  console.log(`\nRESULT: FAIL ❌  (fatal: ${results.fatal})`);
  await browser.close();
  server.close();
  process.exit(1);
}

const checks = {
  overchargeArtifactExists: results.overchargeArtifactExists,
  novaUsesAoeZeroDmg: results.novaUsesAoeZeroDmg,
  novaAddsPendingDmg: results.novaAddsPendingDmg,
  playerHpUnchangedAfterNova: results.playerHpUnchangedAfterNova,
};

const failed = Object.entries(checks).filter(([, v]) => !v);
Object.entries(checks).forEach(([k, v]) => console.log(`  ${v ? '✓' : '✗'} ${k}: ${v}`));

await browser.close();
server.close();

if (failed.length > 0) {
  console.log(`\nRESULT: FAIL ❌  (${failed.length} check(s) failed)`);
  process.exit(1);
}
console.log(`\n${Object.keys(checks).length}/${Object.keys(checks).length} checks passed`);
console.log('RESULT: PASS ✅');
