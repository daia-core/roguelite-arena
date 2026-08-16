#!/usr/bin/env node
// Regression gate for the aux-weapon status-effect amplifier fix (2026-08-16).
//
// Bug: dealAuxDamage() skipped all enemy debuff amplifiers that both projectile and
// melee paths correctly apply:
//   • Dazed   — raises effective crit chance vs the target
//   • Disoriented — amplifies crit damage taken
//   • Fragility (getIncomingDamageMult) — +% all damage taken per stack
//   • Exposed  (getDirectHitMult)        — +% direct-hit damage taken
//   • Brittle  (getFlatHitBonus)         — flat bonus damage per hit
//   • Condemned (checkCondemned)         — 10-stack detonation multiplier on crit
//
// This meant orb/wave/bomb/active-skill hybrid builds got zero benefit from debuffing
// enemies — Fragility stacks, Exposed, Brittle, and Condemned were dead weight in
// any aux-weapon build.
//
// Fix: dealAuxDamage() now mirrors the projectile and melee paths:
//   1. Dazed/Disoriented checked before and after crit roll.
//   2. Status-effect amplifiers applied after boss multiplier.
//
// Checks:
//   1. getIncomingDamageMult callable on a live enemy's statusFX.
//   2. Fragility stacks: 2 Fragility stacks → getIncomingDamageMult > 1.
//   3. Fragility amplifies aux damage: enemy with Fragility takes more damage than without.
//   4. getBonusCritChanceReceived callable (Dazed plumbing).
//   5. getBonusCritDamageReceived callable (Disoriented plumbing).
//   6. Control: enemy with no debuffs — getIncomingDamageMult returns 1.
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

  // Helper: spawn a fresh game with enemies in play.
  const spawnFresh = () => {
    g.startNewGame();
    g.startNextWave();
    g.state = 'playing';
    for (let i = 0; i < 10; i++) g.update(1.0);
  };

  // Helper: get a live non-boss enemy.
  const getLive = () => g.enemies.find(e => !e.dead && !e.typeData?.isBoss && !e.isMiniboss) ?? null;

  // === 1. getIncomingDamageMult callable. ===
  spawnFresh();
  const e1 = getLive();
  if (!e1) { out.multCallable = 'skipped-no-enemy'; }
  else {
    try {
      const m = e1.statusFX.getIncomingDamageMult();
      out.multCallable = typeof m === 'number';
      out.multNoDebuffVal = m;
    } catch(e) { out.multCallable = `error: ${e.message}`; }
  }

  // === 2. Fragility stacks → getIncomingDamageMult > 1. ===
  spawnFresh();
  const e2 = getLive();
  if (!e2) { out.fragilityMult = 'skipped-no-enemy'; }
  else {
    try {
      // Apply 2 Fragility stacks directly via statusFX.apply().
      e2.statusFX.apply('fragility', { stacks: 2 });
      const m = e2.statusFX.getIncomingDamageMult();
      out.fragilityMult = m > 1;
      out.fragilityMultVal = m;
    } catch(e) { out.fragilityMult = `error: ${e.message}`; }
  }

  // === 3. Fragility amplifies actual aux damage output. ===
  // Compare health delta on two identical enemies — one with Fragility, one without.
  spawnFresh();
  const [eBase, eFrag] = g.enemies.filter(e => !e.dead && !e.typeData?.isBoss && !e.isMiniboss).slice(0, 2);
  if (!eBase || !eFrag) { out.fragilityAmplifiesDmg = 'skipped-need-2-enemies'; }
  else {
    // Pin both to a known HP and strip randomness from crits (set base crit to 0).
    const savedCrit = g.playerStats.getCritChance ? g.playerStats.getCritChance() : 0;
    eBase.health = eBase.maxHealth = 10000;
    eFrag.health = eFrag.maxHealth = 10000;
    // Apply Fragility only to eFrag.
    eFrag.statusFX.apply('fragility', { stacks: 5 });
    const hpBaseBefore = eBase.health;
    const hpFragBefore = eFrag.health;
    // Disable crits temporarily to isolate the Fragility effect.
    if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = -999;
    g.dealAuxDamage(eBase, 100, '#fff');
    g.dealAuxDamage(eFrag, 100, '#fff');
    if (g.playerStats.baseCritChance !== undefined) g.playerStats.baseCritChance = savedCrit;
    const dmgBase = hpBaseBefore - eBase.health;
    const dmgFrag = hpFragBefore - eFrag.health;
    out.fragilityAmplifiesDmg = dmgFrag > dmgBase;
    out.dmgBase = Math.round(dmgBase);
    out.dmgFrag = Math.round(dmgFrag);
  }

  // === 4. getBonusCritChanceReceived callable (Dazed plumbing). ===
  spawnFresh();
  const e4 = getLive();
  if (!e4) { out.dazedCallable = 'skipped-no-enemy'; }
  else {
    try {
      const v = e4.statusFX.getBonusCritChanceReceived();
      out.dazedCallable = typeof v === 'number';
    } catch(e) { out.dazedCallable = `error: ${e.message}`; }
  }

  // === 5. getBonusCritDamageReceived callable (Disoriented plumbing). ===
  spawnFresh();
  const e5 = getLive();
  if (!e5) { out.disorientedCallable = 'skipped-no-enemy'; }
  else {
    try {
      const v = e5.statusFX.getBonusCritDamageReceived();
      out.disorientedCallable = typeof v === 'number';
    } catch(e) { out.disorientedCallable = `error: ${e.message}`; }
  }

  // === 6. Control: no debuffs → getIncomingDamageMult returns exactly 1.0. ===
  spawnFresh();
  const e6 = getLive();
  if (!e6) { out.controlMult1 = 'skipped-no-enemy'; }
  else {
    try {
      const m = e6.statusFX.getIncomingDamageMult();
      out.controlMult1 = m === 1;
      out.controlMultVal = m;
    } catch(e) { out.controlMult1 = `error: ${e.message}`; }
  }

  return out;
});

await browser.close();
server.close();

if (result.fatal) { console.error('FATAL:', result.fatal); process.exit(1); }
if (errors.length) console.warn('Console errors:', errors.slice(0, 3));

const checks = [
  ['multCallable',         'getIncomingDamageMult() callable on live enemy statusFX',              result.multCallable],
  ['fragilityMult',        'Fragility×2 → getIncomingDamageMult > 1',                              result.fragilityMult],
  ['fragilityAmplifiesDmg','Fragility×5 → aux damage output is higher than without debuff',        result.fragilityAmplifiesDmg],
  ['dazedCallable',        'getBonusCritChanceReceived() callable (Dazed plumbing check)',         result.dazedCallable],
  ['disorientedCallable',  'getBonusCritDamageReceived() callable (Disoriented plumbing check)',   result.disorientedCallable],
  ['controlMult1',         'Control: no debuffs → getIncomingDamageMult === 1.0',                 result.controlMult1],
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

if (result.fragilityMultVal !== undefined)
  console.log(`        (Fragility×2 mult = ${result.fragilityMultVal.toFixed(3)})`);
if (result.dmgBase !== undefined)
  console.log(`        (base dmg=${result.dmgBase}, Fragility×5 dmg=${result.dmgFrag})`);
if (result.multNoDebuffVal !== undefined)
  console.log(`        (no-debuff mult = ${result.multNoDebuffVal})`);

const failed = checks.filter(([,, v]) => v !== true && !(typeof v === 'string' && v.startsWith('skipped'))).length;
console.log(`\n${passed}/${checks.length - skipped} checks PASS, ${skipped} skipped`);
process.exitCode = failed > 0 ? 1 : 0;
if (failed === 0) console.log('RESULT: PASS ✅');
else console.log('RESULT: FAIL ❌');
