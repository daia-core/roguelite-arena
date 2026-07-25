#!/usr/bin/env node
// TRANSFORMATION HINTS QA — verifies the TransformationSystem data model that powers
// the purple border + "✦ NAME" / "N/M NAME" progress text on shop cards.
//
// The ShopScene.getCardTransformInfo() method is private, so this test verifies its
// CONTRACT by exercising the underlying TransformationTracker APIs it depends on:
//   - getProgress(tag)      → { current, required, transformation }
//   - hasTransformation(id) → boolean
//   - trackItemPickup(tags) → activates transformation after requiredCount items
//
// WHAT THIS COVERS:
//  A) Initial state: getProgress returns correct required count for all 6 transformations
//  B) No-spoil gate: current === 0 → ShopScene skips the hint (don't reveal unseen xforms)
//  C) Partial progress: 1 of 3 melee items → hint visible but NOT completing
//  D) Completing card:  2 of 3 melee items → hint IS completing → purple border
//  E) Activation: after 3rd pickup, hasTransformation('berserker') = true
//  F) Post-activation: hasTransformation true → ShopScene's guard skips the hint
//  G) Multi-tag: item with ['melee','ranged'] advances BOTH counters correctly
//  H) Independence: activating one transformation does not affect other tag counters
//  I) Full addItem path: s.addItem() correctly triggers trackItemPickup (integration)

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
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };

  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: String(detail ?? '') });

  // ── A) Initial state ─────────────────────────────────────────────────────────
  // All 6 transformations require exactly 3 items of their tag.
  {
    g.startNewGame();
    const xf = g.playerStats.transformations;
    const tags = ['melee','ranged','defensive','economic','elemental','utility'];
    for (const tag of tags) {
      const p = xf.getProgress(tag);
      ok(`A:${tag} initial required=3`, p.required === 3, `required=${p.required}`);
      ok(`A:${tag} initial current=0`,  p.current  === 0, `current=${p.current}`);
    }
  }

  // ── B) No-spoil gate ─────────────────────────────────────────────────────────
  // When current === 0, ShopScene skips the hint. Verify getProgress returns 0 and
  // that the predicate `current === 0 → continue` is the correct branching point.
  {
    g.startNewGame();
    const xf = g.playerStats.transformations;
    const p = xf.getProgress('melee');
    ok('B:no-spoil: current=0 → hint suppressed (predicate correct)', p.current === 0,
       `current=${p.current} (ShopScene: if current===0 continue)`);
  }

  // ── C) Partial progress (1 of 3) ─────────────────────────────────────────────
  // After 1 melee pickup: current=1; hint shows, NOT completing.
  {
    g.startNewGame();
    const xf = g.playerStats.transformations;
    xf.trackItemPickup(['melee']); // 1st melee
    const p = xf.getProgress('melee');
    ok('C:partial: current=1 after 1 pickup', p.current === 1, `current=${p.current}`);
    ok('C:partial: required still 3',         p.required === 3, `required=${p.required}`);
    // wouldComplete = current + 1 >= required = 2 >= 3 = false → progress text, NOT purple completing border
    const wouldComplete = (p.current + 1) >= p.required;
    ok('C:partial: wouldComplete=false (progress hint, not completing)',
       wouldComplete === false, `wouldComplete=${wouldComplete}`);
    ok('C:partial: transformation NOT yet active', !xf.hasTransformation('berserker'),
       `hasTransformation=${xf.hasTransformation('berserker')}`);
  }

  // ── D) Completing card (2 of 3) ──────────────────────────────────────────────
  // After 2 melee pickups: current=2; wouldComplete=true → purple border + "✦ NAME" text.
  {
    g.startNewGame();
    const xf = g.playerStats.transformations;
    xf.trackItemPickup(['melee']); // 1st
    xf.trackItemPickup(['melee']); // 2nd
    const p = xf.getProgress('melee');
    ok('D:completing: current=2 after 2 pickups', p.current === 2, `current=${p.current}`);
    const wouldComplete = (p.current + 1) >= p.required; // 3 >= 3 → true
    ok('D:completing: wouldComplete=true → purple completing border',
       wouldComplete === true, `wouldComplete=${wouldComplete}`);
    ok('D:completing: transformation NOT yet active', !xf.hasTransformation('berserker'),
       `hasTransformation=${xf.hasTransformation('berserker')}`);
    // Verify name returned by getProgress matches BERSERKER
    ok('D:completing: transformation name correct',
       p.transformation?.name === 'Berserker Rage',
       `name=${p.transformation?.name}`);
  }

  // ── E) Activation (3 of 3) ───────────────────────────────────────────────────
  // After 3rd pickup, the transformation activates (via trackItemPickup return value).
  {
    g.startNewGame();
    const xf = g.playerStats.transformations;
    xf.trackItemPickup(['melee']); // 1
    xf.trackItemPickup(['melee']); // 2
    const activatedId = xf.trackItemPickup(['melee']); // 3 → activates
    ok('E:activation: trackItemPickup returns berserker id',
       activatedId === 'berserker', `activatedId=${activatedId}`);
    ok('E:activation: hasTransformation("berserker") = true',
       xf.hasTransformation('berserker'), `hasTransformation=${xf.hasTransformation('berserker')}`);
    const p = xf.getProgress('melee');
    ok('E:activation: current=3 after 3 pickups', p.current === 3, `current=${p.current}`);
  }

  // ── F) Post-activation: hint suppressed ──────────────────────────────────────
  // ShopScene skips items whose transformation is already active:
  //   if (ps.transformations.hasTransformation(xf.id)) continue;
  // Verify that hasTransformation returns true and the predicate fires correctly.
  {
    g.startNewGame();
    const xf = g.playerStats.transformations;
    xf.trackItemPickup(['melee']); xf.trackItemPickup(['melee']); xf.trackItemPickup(['melee']);
    // Now transformation is active. Even if we add more melee items, hint is suppressed.
    xf.trackItemPickup(['melee']); // 4th pickup — still active
    const p = xf.getProgress('melee');
    ok('F:post-active: hasTransformation=true suppresses hint',
       xf.hasTransformation('berserker'), `hasTransformation=${xf.hasTransformation('berserker')}`);
    ok('F:post-active: current=4 (accumulates past required)',
       p.current === 4, `current=${p.current}`);
    // Verify the ShopScene guard: if hasTransformation(id) → skip hint
    const hintSuppressed = xf.hasTransformation('berserker');
    ok('F:post-active: hint suppression guard fires correctly', hintSuppressed, `suppressed=${hintSuppressed}`);
  }

  // ── G) Multi-tag items advance both counters ──────────────────────────────────
  // An item tagged ['melee','ranged'] should advance BOTH the melee and ranged counters.
  {
    g.startNewGame();
    const xf = g.playerStats.transformations;
    xf.trackItemPickup(['melee','ranged']); // dual-tag
    const pMelee  = xf.getProgress('melee');
    const pRanged = xf.getProgress('ranged');
    ok('G:multi-tag: melee counter incremented',  pMelee.current  === 1, `melee current=${pMelee.current}`);
    ok('G:multi-tag: ranged counter incremented', pRanged.current === 1, `ranged current=${pRanged.current}`);
    // Verify other tags unaffected
    const pDef = xf.getProgress('defensive');
    ok('G:multi-tag: defensive counter unaffected', pDef.current === 0, `defensive current=${pDef.current}`);
  }

  // ── H) Independence: one transform does not bleed into others ────────────────
  {
    g.startNewGame();
    const xf = g.playerStats.transformations;
    // Activate Berserker (melee × 3)
    xf.trackItemPickup(['melee']); xf.trackItemPickup(['melee']); xf.trackItemPickup(['melee']);
    ok('H:independence: berserker active', xf.hasTransformation('berserker'), '');
    ok('H:independence: marksman NOT active', !xf.hasTransformation('marksman'), '');
    ok('H:independence: fortress NOT active', !xf.hasTransformation('fortress'), '');
    const pRanged = xf.getProgress('ranged');
    ok('H:independence: ranged progress still 0', pRanged.current === 0, `ranged=${pRanged.current}`);
  }

  // ── I) Full addItem path (integration) ───────────────────────────────────────
  // Verify that s.addItem() correctly triggers trackItemPickup, linking the item
  // acquisition path to the transformation tracker.
  {
    g.startNewGame();
    const s = g.playerStats;
    const item1 = DB.getItemById('damage_t1');       // Iron Ring — melee tag
    const item2 = DB.getItemById('attack_speed_t1'); // Swift Gloves — melee tag
    if (!item1 || !item2) {
      checks.push({ name: 'I:addItem path', pass: false, detail: 'damage_t1 or attack_speed_t1 not in DB' });
    } else {
      s.addItem(item1);
      s.addItem(item2);
      const p = s.transformations.getProgress('melee');
      ok('I:addItem: 2 addItem calls → current=2', p.current === 2, `current=${p.current}`);
      const wouldComplete = (p.current + 1) >= p.required; // 3 >= 3 → true
      ok('I:addItem: wouldComplete=true after 2 melee addItems',
         wouldComplete === true, `wouldComplete=${wouldComplete}`);
    }
  }

  return { checks, errors: [] };
});

await browser.close();
server.close();

if (result.fatal) { console.error('FATAL:', result.fatal); process.exit(1); }

let pass = 0, fail = 0;
for (const c of result.checks) {
  const sym = c.pass ? '✓' : '✗';
  console.log(`  ${sym} ${c.name}${c.detail ? '  [' + c.detail + ']' : ''}`);
  if (c.pass) pass++; else fail++;
}
if (errors.length) { console.error('\nConsole errors:'); errors.forEach(e => console.error(' ', e)); }
console.log(`\n${pass}/${pass+fail} PASS${fail ? `  ← ${fail} FAILED` : ''}`);
process.exit(fail > 0 || errors.length > 0 ? 1 : 0);
