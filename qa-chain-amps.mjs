#!/usr/bin/env node
// Regression gate for chain-lightning + explosion-on-hit status-amp fix (2026-08-16).
//
// Bug: applyOnHitEffects() secondary-damage paths skipped all enemy debuff amplifiers
// that the primary weapon paths (projectile / melee / aux) correctly apply:
//
//   Chain lightning (60% damage arc) — nearest.statusFX.* never consulted
//   Explosion on hit (50% AoE splash) — other.statusFX.* never consulted
//
// This meant builds that stack Fragility / Brittle / Exposed / Condemned on enemies
// got no amplification benefit from chain lightning or explosion splash damage.
//
// Fix: each secondary damage path now mirrors the primary weapon pattern:
//   1. getIncomingDamageMult() × getDirectHitMult() + getFlatHitBonus() applied per target.
//   2. checkCondemned(false) applied (chain/splash aren't independent crit rolls).
//   3. Execute threshold check added after each secondary-target takeDamage().
//
// Checks:
//   1. Chain Fragility amp:    Fragility×10 on chain target → delta > base (60)
//   2. Chain Brittle amp:      Brittle×5 on chain target → delta > base (60) via flat bonus
//   3. Chain control:          No debuff → delta == base (60 ± float)
//   4. Explosion Fragility amp: Fragility×10 on splash target → delta > base (50)
//   5. Explosion Brittle amp:  Brittle×5 on splash target → delta > base (50)
//   6. Execute via chain:      chain lightning honours execute threshold
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

  const spawnFresh = () => {
    g.startNewGame();
    g.startNextWave();
    g.state = 'playing';
    for (let i = 0; i < 10; i++) g.update(1.0);
  };

  // Set up two enemies in known positions, kill all others, return the pair.
  // Returns null if < 2 non-boss enemies are available.
  const setupTwoPair = (primaryX, primaryY, targetX, targetY) => {
    const all = g.enemies.filter(e => !e.dead && !e.typeData?.isBoss && !e.isMiniboss);
    if (all.length < 2) return null;
    const ePrimary = all[0];
    const eTarget  = all[1];
    // Mark all others dead so chain-lightning picks exactly eTarget.
    for (const e of g.enemies) {
      if (e !== ePrimary && e !== eTarget) e.dead = true;
    }
    ePrimary.x = primaryX; ePrimary.y = primaryY;
    eTarget.x  = targetX;  eTarget.y  = targetY;
    ePrimary.health = ePrimary.maxHealth = 10000;
    eTarget.health  = eTarget.maxHealth  = 10000;
    return { ePrimary, eTarget };
  };

  // Save / restore helpers
  const save = (obj, ...keys) => Object.fromEntries(keys.map(k => [k, obj[k]]));
  const restore = (obj, saved) => Object.assign(obj, saved);

  // ── CHAIN LIGHTNING TESTS ───────────────────────────────────────────────────

  // Save player stats we'll mutate.
  const psSaved = save(g.playerStats,
    'skillChainAdd', 'skillExplosionOnHit', 'baseCritChance');

  // Force 100% chain lightning, no explosion, no crits.
  g.playerStats.skillChainAdd      = 1;
  g.playerStats.skillExplosionOnHit = false;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  // === 1. Chain Fragility amplification. ===
  spawnFresh();
  // Re-apply stat overrides (startNewGame may reset some).
  g.playerStats.skillChainAdd      = 1;
  g.playerStats.skillExplosionOnHit = false;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  {
    const pair = setupTwoPair(100, 100, 150, 100); // 50 units apart < 200 chain range
    if (!pair) {
      out.chainFragility = 'skipped-need-2-enemies';
    } else {
      const { ePrimary, eTarget } = pair;
      eTarget.statusFX.apply('fragility', { stacks: 10 }); // +15% → mult = 1.15
      const hpBefore = eTarget.health;
      g.applyOnHitEffects(ePrimary, 100);
      const delta = hpBefore - eTarget.health;
      // base chain = 100 * 0.6 * elem(≈1) = 60; fragility×10 → 60 * 1.15 = 69
      out.chainFragility = delta > 60;
      out.chainFragilityDmg = Math.round(delta * 10) / 10;
    }
  }

  // === 2. Chain Brittle amplification (flat bonus). ===
  spawnFresh();
  g.playerStats.skillChainAdd      = 1;
  g.playerStats.skillExplosionOnHit = false;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  {
    const pair = setupTwoPair(100, 100, 150, 100);
    if (!pair) {
      out.chainBrittle = 'skipped-need-2-enemies';
    } else {
      const { ePrimary, eTarget } = pair;
      eTarget.statusFX.apply('brittle', { stacks: 5 }); // +5 flat
      const hpBefore = eTarget.health;
      g.applyOnHitEffects(ePrimary, 100);
      const delta = hpBefore - eTarget.health;
      // base = 60; brittle×5 → 60 + 5 = 65
      out.chainBrittle = delta > 60;
      out.chainBrittleDmg = Math.round(delta * 10) / 10;
    }
  }

  // === 3. Chain control: no debuffs → exactly base damage. ===
  spawnFresh();
  g.playerStats.skillChainAdd      = 1;
  g.playerStats.skillExplosionOnHit = false;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  {
    const pair = setupTwoPair(100, 100, 150, 100);
    if (!pair) {
      out.chainControl = 'skipped-need-2-enemies';
    } else {
      const { ePrimary, eTarget } = pair;
      // No debuffs applied.
      const hpBefore = eTarget.health;
      g.applyOnHitEffects(ePrimary, 100);
      const delta = hpBefore - eTarget.health;
      // base chain = 60 exactly (elem = 1, no amps); allow ±1 for float rounding
      out.chainControl = Math.abs(delta - 60) < 2;
      out.chainControlDmg = Math.round(delta * 10) / 10;
    }
  }

  // Restore player stats before explosion tests.
  restore(g.playerStats, psSaved);

  // ── EXPLOSION ON HIT TESTS ──────────────────────────────────────────────────

  const psSaved2 = save(g.playerStats,
    'skillChainAdd', 'skillExplosionOnHit', 'baseCritChance');
  g.playerStats.skillChainAdd       = 0;    // no chain lightning
  g.playerStats.skillExplosionOnHit = true;  // explosion on hit
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  // === 4. Explosion Fragility amplification. ===
  spawnFresh();
  g.playerStats.skillChainAdd       = 0;
  g.playerStats.skillExplosionOnHit = true;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  {
    // Place within 80 units for explosion splash radius.
    const pair = setupTwoPair(100, 100, 130, 100); // 30 units apart < 80 radius
    if (!pair) {
      out.explosionFragility = 'skipped-need-2-enemies';
    } else {
      const { ePrimary, eTarget } = pair;
      eTarget.statusFX.apply('fragility', { stacks: 10 }); // +15%
      const hpBefore = eTarget.health;
      g.applyOnHitEffects(ePrimary, 100);
      const delta = hpBefore - eTarget.health;
      // base splash = 100 * 0.5 * 1.0 = 50; fragility×10 → 50 * 1.15 = 57.5
      out.explosionFragility = delta > 50;
      out.explosionFragilityDmg = Math.round(delta * 10) / 10;
    }
  }

  // === 5. Explosion Brittle amplification. ===
  spawnFresh();
  g.playerStats.skillChainAdd       = 0;
  g.playerStats.skillExplosionOnHit = true;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  {
    const pair = setupTwoPair(100, 100, 130, 100);
    if (!pair) {
      out.explosionBrittle = 'skipped-need-2-enemies';
    } else {
      const { ePrimary, eTarget } = pair;
      eTarget.statusFX.apply('brittle', { stacks: 5 }); // +5 flat
      const hpBefore = eTarget.health;
      g.applyOnHitEffects(ePrimary, 100);
      const delta = hpBefore - eTarget.health;
      // base = 50; brittle×5 → 55
      out.explosionBrittle = delta > 50;
      out.explosionBrittleDmg = Math.round(delta * 10) / 10;
    }
  }

  restore(g.playerStats, psSaved2);

  // === 6. Execute via chain lightning. ===
  spawnFresh();
  g.playerStats.skillChainAdd       = 1;
  g.playerStats.skillExplosionOnHit = false;
  if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;

  {
    const pair = setupTwoPair(100, 100, 150, 100);
    if (!pair) {
      out.chainExecute = 'skipped-need-2-enemies';
    } else {
      const { ePrimary, eTarget } = pair;
      // Set eTarget to just above execute threshold at 20%.
      eTarget.health = eTarget.maxHealth * 0.19; // 19% — within execute zone
      // Need non-boss, non-miniboss (already ensured by getLive filter).
      // Set execute threshold via playerStats — use skillExecuteThreshold if it exists.
      const savedExec = g.playerStats.skillExecuteAdd;
      g.playerStats.skillExecuteAdd = 0.20; // 20% execute threshold
      const deadBefore = eTarget.dead;
      g.applyOnHitEffects(ePrimary, 1); // tiny damage — execute should fire anyway
      const deadAfter = eTarget.dead;
      g.playerStats.skillExecuteAdd = savedExec;
      out.chainExecute = !deadBefore && deadAfter;
    }
  }

  restore(g.playerStats, psSaved);

  return out;
});

await browser.close();
server.close();

if (result.fatal) { console.error('FATAL:', result.fatal); process.exit(1); }
if (errors.length) console.warn('Console errors:', errors.slice(0, 3));

const checks = [
  ['chainFragility',    'Chain lightning: Fragility×10 on target → damage > base 60',         result.chainFragility],
  ['chainBrittle',      'Chain lightning: Brittle×5 on target → damage > base 60 (flat bonus)',result.chainBrittle],
  ['chainControl',      'Chain lightning: no debuffs → damage ≈ 60 (within ±2)',               result.chainControl],
  ['explosionFragility','Explosion-on-hit: Fragility×10 on splash target → damage > base 50',  result.explosionFragility],
  ['explosionBrittle',  'Explosion-on-hit: Brittle×5 on splash target → damage > base 50',     result.explosionBrittle],
  ['chainExecute',      'Chain lightning: execute threshold fires on low-HP chain target',       result.chainExecute],
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

if (result.chainFragilityDmg  !== undefined) console.log(`        (chain Fragility×10 dmg=${result.chainFragilityDmg}, base≈60)`);
if (result.chainBrittleDmg    !== undefined) console.log(`        (chain Brittle×5 dmg=${result.chainBrittleDmg}, base≈60)`);
if (result.chainControlDmg    !== undefined) console.log(`        (chain control dmg=${result.chainControlDmg}, expected≈60)`);
if (result.explosionFragilityDmg !== undefined) console.log(`        (expl Fragility×10 dmg=${result.explosionFragilityDmg}, base≈50)`);
if (result.explosionBrittleDmg   !== undefined) console.log(`        (expl Brittle×5 dmg=${result.explosionBrittleDmg}, base≈50)`);

const failed = checks.filter(([,, v]) => v !== true && !(typeof v === 'string' && v.startsWith('skipped'))).length;
console.log(`\n${passed}/${checks.length - skipped} checks PASS, ${skipped} skipped`);
process.exitCode = failed > 0 ? 1 : 0;
if (failed === 0) console.log('RESULT: PASS ✅');
else console.log('RESULT: FAIL ❌');
