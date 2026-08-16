#!/usr/bin/env node
// Regression gate for explosion-on-kill status-amp fix (2026-08-16).
//
// Bug: handleEnemyKill() explosion-on-kill splash called otherEnemy.takeDamage(raw)
// without applying any enemy debuff amplifiers, even after explosion-on-HIT was fixed.
// Builds stacking Fragility / Brittle / Condemned on enemies got zero amplification
// from kill-explosion splash, making the mechanic silent and inconsistent.
//
// Fix: kill-explosion now mirrors the explosion-on-hit + chain-lightning pattern:
//   1. getIncomingDamageMult() × getDirectHitMult() + getFlatHitBonus() per splash target.
//   2. checkCondemned(false) per splash target.
//   3. Execute threshold check after each splash takeDamage().
//
// Checks:
//   1. killExpl Fragility amp:  Fragility×10 on splash target → delta > base (2×damage)
//   2. killExpl Brittle amp:    Brittle×5 on splash target → delta > base (flat bonus)
//   3. killExpl control:        No debuff → delta ≈ 2×damage (within ±2)
//   4. killExpl execute:        secondary at 19% HP → dead after kill-explosion
//
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

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, protocolTimeout: 120000, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
page.setViewport({ width: 390, height: 844 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'missing __game global' };
  const out = {};

  // Helper: spin up a fresh wave and force playing state.
  const spawnFresh = () => {
    g.startNewGame();
    g.startNextWave();
    g.state = 'playing';
    for (let i = 0; i < 10; i++) g.update(1.0);
  };

  // Pick exactly 2 live non-boss enemies, position them, set HP to 10k.
  // Returns { eKiller, eSecondary } or null if <2 enemies available.
  const setupPair = (killerX, killerY, secX, secY) => {
    const live = g.enemies.filter(e => !e.dead && !e.typeData?.isBoss && !e.isMiniboss);
    if (live.length < 2) return null;
    const eKiller    = live[0];
    const eSecondary = live[1];
    // Park every other enemy out of the explosion radius so they don't interfere.
    for (const e of g.enemies) {
      if (e !== eKiller && e !== eSecondary) e.dead = true;
    }
    eKiller.x    = killerX; eKiller.y    = killerY;
    eSecondary.x = secX;    eSecondary.y = secY;
    eKiller.health    = eKiller.maxHealth    = 10000;
    eSecondary.health = eSecondary.maxHealth = 10000;
    return { eKiller, eSecondary };
  };

  // Enable kill-explosion (skillExplosionOnHit drives hasExplosionOnKill too).
  const savedChain   = g.playerStats.skillChainAdd;
  const savedExplosion = g.playerStats.skillExplosionOnHit;
  const savedCrit    = g.playerStats.baseCritChance;
  const savedExec    = g.playerStats.skillExecuteAdd;
  const savedDmg     = g.playerStats.damageBase ?? g.playerStats.baseWeaponDamage;

  g.playerStats.skillChainAdd       = 0;    // no chain lightning — isolate kill-explosion
  g.playerStats.skillExplosionOnHit = true;  // enables both on-hit AND on-kill explosions
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  // Fix base damage to a known value (100) so we can predict 2×100=200 base splash.
  // Use whichever writable property getDamage() reads from.
  const fixDamage = () => {
    if (g.playerStats.damageBase !== undefined) g.playerStats.damageBase = 100;
    else if (g.playerStats.baseWeaponDamage !== undefined) g.playerStats.baseWeaponDamage = 100;
    // Compute the actual getDamage() output so we know our base.
  };
  fixDamage();
  const measuredBase = g.playerStats.getDamage ? g.playerStats.getDamage() : 100;
  const expectedSplash = measuredBase * 2;
  out.expectedSplash = Math.round(expectedSplash * 10) / 10;

  // ── 1. Fragility amplification ──────────────────────────────────────────────
  spawnFresh();
  g.playerStats.skillChainAdd       = 0;
  g.playerStats.skillExplosionOnHit = true;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;
  fixDamage();

  {
    // Place secondary within 80-unit explosion radius (30 units away).
    const pair = setupPair(100, 100, 130, 100);
    if (!pair) {
      out.killExplFragility = 'skipped-need-2-enemies';
    } else {
      const { eKiller, eSecondary } = pair;
      eSecondary.statusFX.apply('fragility', { stacks: 10 }); // +15% → mult=1.15
      const hpBefore = eSecondary.health;
      eKiller.dead = true; // mark as dead so handleEnemyKill processes it
      g.handleEnemyKill(eKiller);
      const delta = hpBefore - eSecondary.health;
      // base = 2×damage; Fragility×10 → 1.15× → delta > base
      out.killExplFragility    = delta > expectedSplash;
      out.killExplFragilityDmg = Math.round(delta * 10) / 10;
    }
  }

  // ── 2. Brittle amplification (flat bonus per hit) ─────────────────────────
  spawnFresh();
  g.playerStats.skillChainAdd       = 0;
  g.playerStats.skillExplosionOnHit = true;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;
  fixDamage();

  {
    const pair = setupPair(100, 100, 130, 100);
    if (!pair) {
      out.killExplBrittle = 'skipped-need-2-enemies';
    } else {
      const { eKiller, eSecondary } = pair;
      eSecondary.statusFX.apply('brittle', { stacks: 5 }); // +5 flat
      const hpBefore = eSecondary.health;
      eKiller.dead = true;
      g.handleEnemyKill(eKiller);
      const delta = hpBefore - eSecondary.health;
      // base = 2×damage; brittle×5 → +5 flat → delta > base
      out.killExplBrittle    = delta > expectedSplash;
      out.killExplBrittleDmg = Math.round(delta * 10) / 10;
    }
  }

  // ── 3. Control: no debuffs → exactly 2×damage ────────────────────────────
  spawnFresh();
  g.playerStats.skillChainAdd       = 0;
  g.playerStats.skillExplosionOnHit = true;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;
  fixDamage();

  {
    const pair = setupPair(100, 100, 130, 100);
    if (!pair) {
      out.killExplControl = 'skipped-need-2-enemies';
    } else {
      const { eKiller, eSecondary } = pair;
      // No debuffs — baseline measurement.
      const hpBefore = eSecondary.health;
      eKiller.dead = true;
      g.handleEnemyKill(eKiller);
      const delta = hpBefore - eSecondary.health;
      // Allow ±5 for weapon damage multiplier variance.
      out.killExplControl    = Math.abs(delta - expectedSplash) < 5;
      out.killExplControlDmg = Math.round(delta * 10) / 10;
    }
  }

  // ── 4. Execute threshold fires via kill-explosion ─────────────────────────
  spawnFresh();
  g.playerStats.skillChainAdd       = 0;
  g.playerStats.skillExplosionOnHit = true;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;
  g.playerStats.skillExecuteAdd = 0.20; // 20% execute threshold

  {
    const pair = setupPair(100, 100, 130, 100);
    if (!pair) {
      out.killExplExecute = 'skipped-need-2-enemies';
    } else {
      const { eKiller, eSecondary } = pair;
      // Set secondary to 19% HP — within execute zone but won't die from raw splash alone
      // if damage is low enough; execute should finish it.
      eSecondary.health = eSecondary.maxHealth * 0.19;
      // Use low base damage so splash alone won't kill it, but execute will.
      if (g.playerStats.damageBase !== undefined) g.playerStats.damageBase = 1;
      else if (g.playerStats.baseWeaponDamage !== undefined) g.playerStats.baseWeaponDamage = 1;
      const deadBefore = eSecondary.dead;
      eKiller.dead = true;
      g.handleEnemyKill(eKiller);
      const deadAfter = eSecondary.dead;
      out.killExplExecute = !deadBefore && deadAfter;
    }
  }

  // Restore all mutated stats.
  g.playerStats.skillChainAdd       = savedChain;
  g.playerStats.skillExplosionOnHit = savedExplosion;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = savedCrit;
  g.playerStats.skillExecuteAdd = savedExec;
  if (g.playerStats.damageBase !== undefined) g.playerStats.damageBase = savedDmg;
  else if (g.playerStats.baseWeaponDamage !== undefined) g.playerStats.baseWeaponDamage = savedDmg;

  return out;
});

await browser.close();
server.close();

if (result.fatal) { console.error('FATAL:', result.fatal); process.exit(1); }
if (errors.length) console.warn('Console errors:', errors.slice(0, 3));

const baseLabel = result.expectedSplash !== undefined ? ` (base ≈ ${result.expectedSplash})` : '';

const checks = [
  ['killExplFragility', `Kill-explosion: Fragility×10 on secondary → damage > base${baseLabel}`, result.killExplFragility],
  ['killExplBrittle',   `Kill-explosion: Brittle×5 on secondary → damage > base (flat bonus)${baseLabel}`, result.killExplBrittle],
  ['killExplControl',   `Kill-explosion: no debuffs → damage ≈ base (within ±5)${baseLabel}`,  result.killExplControl],
  ['killExplExecute',   'Kill-explosion: execute threshold fires when secondary at 19% HP',       result.killExplExecute],
];

let passed = 0, skipped = 0;
for (const [key, label, val] of checks) {
  if (typeof val === 'string' && val.startsWith('skipped')) {
    console.log(`  SKIP  ${label} (${val})`);
    skipped++;
  } else if (val === true) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label} → ${JSON.stringify(val)}`);
  }
}
if (result.killExplFragilityDmg !== undefined) console.log(`        (Fragility dmg=${result.killExplFragilityDmg})`);
if (result.killExplBrittleDmg   !== undefined) console.log(`        (Brittle dmg=${result.killExplBrittleDmg})`);
if (result.killExplControlDmg   !== undefined) console.log(`        (control dmg=${result.killExplControlDmg})`);

const failed = checks.filter(([,, v]) => v !== true && !(typeof v === 'string' && v.startsWith('skipped'))).length;
console.log(`\n${passed}/${checks.length - skipped} checks PASS, ${skipped} skipped`);
process.exitCode = failed > 0 ? 1 : 0;
if (failed === 0) console.log('RESULT: PASS ✅');
else console.log('RESULT: FAIL ❌');
