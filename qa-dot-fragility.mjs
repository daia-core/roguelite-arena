#!/usr/bin/env node
// Regression gate for the DoT + Doom Fragility amplifier fix (2026-08-16).
//
// Bug: DoT damage (burn/bleed/poison) and Doom detonation only applied woundMult,
// skipping Fragility (getIncomingDamageMult = +% all damage received).
// This meant a debuffer/DoT hybrid build got zero synergy from Fragilizing targets —
// the most natural synergy pairing (apply Fragility → stack DoTs) was silently dead.
//
// Fix: tickDoT now multiplies by fragMult = enemy.statusFX.getIncomingDamageMult(),
// and Doom detonation payload also multiplies by getIncomingDamageMult().
//
// Checks:
//   1. Burn tick: enemy with Fragility×5 takes more burn damage than without.
//   2. Fragility×0 control: no debuffs → Fragility mult = 1 (no change).
//   3. Doom detonation: enemy with Fragility×5 receives more Doom payload than without.
//   4. Bleed tick: enemy with Fragility×5 takes more bleed damage than without.
//   5. Poison tick: enemy with Fragility×5 takes more poison damage than without.
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

  const getLiveNonBoss = (n) => g.enemies
    .filter(e => !e.dead && !e.typeData?.isBoss && !e.isMiniboss)
    .slice(0, n);

  // Helper: pin enemy HP, suppress wound mult (set to 1), strip Fragility, return HP before.
  const pinHP = (e, hp) => {
    e.health = e.maxHealth = hp;
    e.woundMult = 1;
  };

  // Helper: isolate two test enemies so ONLY DoT + Fragility affects their HP delta.
  // Three contamination sources eliminated:
  //   (a) In-flight player projectiles hitting one enemy but not the other.
  //   (b) New player shots during g.update() (player auto-fires every frame).
  //   (c) Explosion-on-kill AoE from other dying enemies (1ee49ad fix).
  const isolateForDoT = (e1, e2) => {
    g.projectiles.length = 0;                    // (a) clear in-flight projectiles
    if (g.player) g.player.shootCooldown = 9999; // (b) suppress new shots this update
    for (const e of g.enemies) {
      if (e !== e1 && e !== e2) e.dead = true;   // (c) cull other enemies
    }
    g.enemies = g.enemies.filter(e => !e.dead);
  };

  // === 1. Burn: Fragility×5 → more burn damage than no debuff. ===
  spawnFresh();
  let [eBase, eFrag] = getLiveNonBoss(2);
  if (!eBase || !eFrag) {
    out.burnFrag = 'skipped-need-2-enemies';
  } else {
    pinHP(eBase, 10000); pinHP(eFrag, 10000);
    eFrag.statusFX.apply('fragility', { stacks: 5 });
    // Apply 1 second of burn.
    eBase.burnTimer = 5.0; eFrag.burnTimer = 5.0;
    // Stop bleed/poison so only burn ticks.
    eBase.bleedTimer = 0; eFrag.bleedTimer = 0;
    eBase.poisonTimer = 0; eFrag.poisonTimer = 0;
    isolateForDoT(eBase, eFrag);
    const hpBaseBefore = eBase.health;
    const hpFragBefore = eFrag.health;
    g.update(1.0);
    const dmgBase = hpBaseBefore - eBase.health;
    const dmgFrag = hpFragBefore - eFrag.health;
    out.burnFrag = dmgFrag > dmgBase;
    out.burnDmgBase = Math.round(dmgBase * 100) / 100;
    out.burnDmgFrag = Math.round(dmgFrag * 100) / 100;
  }

  // === 2. Fragility×0 control: mult returns 1, burn damage unchanged. ===
  spawnFresh();
  let [eCtrl] = getLiveNonBoss(1);
  if (!eCtrl) {
    out.controlMult = 'skipped-no-enemy';
  } else {
    const m = eCtrl.statusFX.getIncomingDamageMult();
    out.controlMult = m === 1;
    out.controlMultVal = m;
  }

  // === 3. Doom detonation: Fragility×5 → more payload than without. ===
  spawnFresh();
  let [eDoomBase, eDoomFrag] = getLiveNonBoss(2);
  if (!eDoomBase || !eDoomFrag) {
    out.doomFrag = 'skipped-need-2-enemies';
  } else {
    pinHP(eDoomBase, 10000); pinHP(eDoomFrag, 10000);
    eDoomFrag.statusFX.apply('fragility', { stacks: 5 });
    // Arm doom: store 1000 damage, timer near expiry.
    eDoomBase.doomStored = 1000; eDoomBase.doomTimer = 0.01;
    eDoomFrag.doomStored = 1000; eDoomFrag.doomTimer = 0.01;
    isolateForDoT(eDoomBase, eDoomFrag);
    const hpDbBefore = eDoomBase.health;
    const hpDfBefore = eDoomFrag.health;
    g.update(0.1); // Trigger detonation.
    const dmgDoomBase = hpDbBefore - eDoomBase.health;
    const dmgDoomFrag = hpDfBefore - eDoomFrag.health;
    out.doomFrag = dmgDoomFrag > dmgDoomBase;
    out.doomDmgBase = Math.round(dmgDoomBase);
    out.doomDmgFrag = Math.round(dmgDoomFrag);
  }

  // === 4. Bleed: Fragility×5 → more bleed damage than without. ===
  spawnFresh();
  let [eBleedBase, eBleedFrag] = getLiveNonBoss(2);
  if (!eBleedBase || !eBleedFrag) {
    out.bleedFrag = 'skipped-need-2-enemies';
  } else {
    pinHP(eBleedBase, 10000); pinHP(eBleedFrag, 10000);
    eBleedFrag.statusFX.apply('fragility', { stacks: 5 });
    eBleedBase.bleedTimer = 5.0; eBleedFrag.bleedTimer = 5.0;
    eBleedBase.burnTimer = 0; eBleedFrag.burnTimer = 0;
    eBleedBase.poisonTimer = 0; eBleedFrag.poisonTimer = 0;
    // Equalise starting positions so both enemies travel the same distance during g.update().
    // Bleed damage = (6 + min(18, moved×1.5))×dt — if the enemies spawn at different distances
    // from the player, the one that moves further can out-damage the Fragility bonus (25%).
    // Placing both at the same coordinates removes spawn randomness and isolates Fragility
    // as the sole variable. Use a corner far from centre so movement is non-zero.
    eBleedBase.x = eBleedFrag.x = 100; eBleedBase.y = eBleedFrag.y = 300;
    eBleedBase.lastX = eBleedBase.x; eBleedBase.lastY = eBleedBase.y;
    eBleedFrag.lastX = eBleedFrag.x; eBleedFrag.lastY = eBleedFrag.y;
    isolateForDoT(eBleedBase, eBleedFrag);
    const hpBbBefore = eBleedBase.health;
    const hpBfBefore = eBleedFrag.health;
    g.update(1.0);
    const dmgBleedBase = hpBbBefore - eBleedBase.health;
    const dmgBleedFrag = hpBfBefore - eBleedFrag.health;
    out.bleedFrag = dmgBleedFrag > dmgBleedBase;
    out.bleedDmgBase = Math.round(dmgBleedBase * 100) / 100;
    out.bleedDmgFrag = Math.round(dmgBleedFrag * 100) / 100;
  }

  // === 5. Poison: Fragility×5 → more poison damage than without. ===
  spawnFresh();
  let [ePoisBase, ePoisFrag] = getLiveNonBoss(2);
  if (!ePoisBase || !ePoisFrag) {
    out.poisonFrag = 'skipped-need-2-enemies';
  } else {
    pinHP(ePoisBase, 10000); pinHP(ePoisFrag, 10000);
    ePoisFrag.statusFX.apply('fragility', { stacks: 5 });
    ePoisBase.poisonTimer = 5.0; ePoisFrag.poisonTimer = 5.0;
    ePoisBase.burnTimer = 0; ePoisFrag.burnTimer = 0;
    ePoisBase.bleedTimer = 0; ePoisFrag.bleedTimer = 0;
    isolateForDoT(ePoisBase, ePoisFrag);
    const hpPbBefore = ePoisBase.health;
    const hpPfBefore = ePoisFrag.health;
    g.update(1.0);
    const dmgPoisBase = hpPbBefore - ePoisBase.health;
    const dmgPoisFrag = hpPfBefore - ePoisFrag.health;
    out.poisonFrag = dmgPoisFrag > dmgPoisBase;
    out.poisonDmgBase = Math.round(dmgPoisBase * 100) / 100;
    out.poisonDmgFrag = Math.round(dmgPoisFrag * 100) / 100;
  }

  return out;
});

await browser.close();
server.close();

if (result.fatal) { console.error('FATAL:', result.fatal); process.exit(1); }
if (errors.length) console.warn('Console errors:', errors.slice(0, 3));

const checks = [
  ['burnFrag',    'Burn: Fragility×5 → burn damage higher than no-debuff',         result.burnFrag],
  ['controlMult', 'Control: no Fragility → getIncomingDamageMult === 1.0',          result.controlMult],
  ['doomFrag',    'Doom detonation: Fragility×5 → payload higher than no-debuff',   result.doomFrag],
  ['bleedFrag',   'Bleed: Fragility×5 → bleed damage higher than no-debuff',        result.bleedFrag],
  ['poisonFrag',  'Poison: Fragility×5 → poison damage higher than no-debuff',      result.poisonFrag],
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

if (result.burnDmgBase !== undefined)
  console.log(`        (burn base=${result.burnDmgBase}, Frag×5=${result.burnDmgFrag})`);
if (result.doomDmgBase !== undefined)
  console.log(`        (doom base=${result.doomDmgBase}, Frag×5=${result.doomDmgFrag})`);
if (result.bleedDmgBase !== undefined)
  console.log(`        (bleed base=${result.bleedDmgBase}, Frag×5=${result.bleedDmgFrag})`);
if (result.poisonDmgBase !== undefined)
  console.log(`        (poison base=${result.poisonDmgBase}, Frag×5=${result.poisonDmgFrag})`);
if (result.controlMultVal !== undefined)
  console.log(`        (control mult = ${result.controlMultVal})`);

const failed = checks.filter(([,, v]) => v !== true && !(typeof v === 'string' && v.startsWith('skipped'))).length;
console.log(`\n${passed}/${checks.length - skipped} checks PASS, ${skipped} skipped`);
process.exitCode = failed > 0 ? 1 : 0;
if (failed === 0) console.log('RESULT: PASS ✅');
else console.log('RESULT: FAIL ❌');
