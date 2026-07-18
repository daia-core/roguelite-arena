#!/usr/bin/env node
/**
 * qa-lifesteal-artifacts.mjs — verify Bloodmage's Seal and Crimson Covenant artifacts.
 *
 * Features added 2026-07-19:
 *   bloodmages_seal  (epic)       — lifestealAdd: 0.08  (+8% lifesteal)
 *   crimson_covenant (legendary)  — lifestealAdd: 0.15, damageMult: 1.25
 *
 * Tests:
 *   bloodmagesSealInRollable     — artifact exists, lifestealAdd 0.08, rarity epic
 *   crimsonCovenantInRollable    — artifact exists, lifestealAdd 0.15, damageMult 1.25, rarity legendary
 *   lifestealStatAfterSeal       — artifactLifestealAdd = 0.08 after granting seal
 *   lifestealStatAfterBoth       — artifactLifestealAdd = 0.23 (0.08+0.15) with both artifacts
 *   getLifestealIncludes         — getLifesteal() includes artifactLifestealAdd contribution
 *   covenantBoostsDamage         — crimson_covenant raises artifactDamageMult to 1.25
 *   lifestealHealsOnHit          — with seal held, a hit restores HP proportional to damage
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-lifesteal-artifacts.mjs
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
  const ARTIFACTS = window.__ARTIFACTS;
  if (!g || !ARTIFACTS) return { fatal: 'missing handles' };

  const out = {};
  const near = (a, b, eps = 0.001) => Math.abs(a - b) < eps;

  function freshRun() {
    g.startNewGame();
    g.state = 'playing';
    g.update(0);
  }

  const ROLLABLE = ARTIFACTS.filter(a => !a.curse);

  // ─── 1. Catalog checks ───────────────────────────────────────────────────────
  const seal = ROLLABLE.find(a => a.id === 'bloodmages_seal');
  out.bloodmagesSealInRollable = !!(
    seal && near(seal.lifestealAdd, 0.08) && seal.rarity === 'epic'
  );

  const cov = ROLLABLE.find(a => a.id === 'crimson_covenant');
  out.crimsonCovenantInRollable = !!(
    cov && near(cov.lifestealAdd, 0.15) && near(cov.damageMult, 1.25) && cov.rarity === 'legendary'
  );

  // ─── 2. Stat contribution — seal alone ──────────────────────────────────────
  freshRun();
  const lsBefore = g.playerStats.artifactLifestealAdd;   // expect 0 (no artifact)
  g.artifacts.add(seal, g.playerStats);
  const lsAfterSeal = g.playerStats.artifactLifestealAdd; // expect 0.08
  out.lifestealStatAfterSeal = lsBefore === 0 && near(lsAfterSeal, 0.08);

  // ─── 3. Stat contribution — both artifacts ───────────────────────────────────
  g.artifacts.add(cov, g.playerStats);
  const lsAfterBoth = g.playerStats.artifactLifestealAdd; // expect 0.23
  out.lifestealStatAfterBoth = near(lsAfterBoth, 0.23);

  // ──��� 4. getLifesteal() reflects artifact contribution ────────────────────────
  freshRun();
  const baseLifesteal = g.playerStats.getLifesteal();
  g.artifacts.add(seal, g.playerStats);
  const withSealLifesteal = g.playerStats.getLifesteal();
  out.getLifestealIncludes = withSealLifesteal > baseLifesteal &&
    near(withSealLifesteal - baseLifesteal, 0.08);

  // ─── 5. Covenant also boosts damage ─────────────────────────────────────────
  freshRun();
  g.artifacts.add(cov, g.playerStats);
  out.covenantBoostsDamage = near(g.playerStats.artifactDamageMult, 1.25);

  // ─── 6. Lifesteal heals on hit ───────────────────────────────────────────────
  // Verify that heal(damage * getLifesteal()) produces the correct HP change.
  // Set health to 1 so there's room to receive the full lifesteal heal.
  freshRun();
  g.artifacts.add(seal, g.playerStats);  // +8% lifesteal
  g.player.health = 1;  // 1 HP so the 80 HP heal is not capped by maxHealth
  const hpBefore = g.player.health;
  const fakeDamage = 1000;
  const ls = g.playerStats.getLifesteal();  // 0.08
  const expectedHeal = Math.min(fakeDamage * ls, g.player.maxHealth - 1);
  g.player.heal(fakeDamage * ls);
  const hpAfter = g.player.health;
  const healed = hpAfter - hpBefore;
  out.lifestealHealsOnHit = healed > 0 && near(healed, expectedHeal, 1);

  out._debug = {
    lsBefore, lsAfterSeal: +lsAfterSeal.toFixed(3), lsAfterBoth: +lsAfterBoth.toFixed(3),
    baseLifesteal: +baseLifesteal.toFixed(3), withSealLifesteal: +withSealLifesteal.toFixed(3),
    cov_damageMult: g.playerStats.artifactDamageMult,
    healed: +healed.toFixed(2), expectedHeal: +expectedHeal.toFixed(2),
  };
  return out;
});

await browser.close();
server.close();

const CHECKS = [
  'bloodmagesSealInRollable', 'crimsonCovenantInRollable',
  'lifestealStatAfterSeal', 'lifestealStatAfterBoth',
  'getLifestealIncludes', 'covenantBoostsDamage', 'lifestealHealsOnHit',
];
let pass = 0;
for (const k of CHECKS) {
  const ok = results[k] === true;
  console.log(`${ok ? '✅' : '❌'} ${k}`);
  if (ok) pass++;
}
if (results._debug) console.log('debug:', JSON.stringify(results._debug));
if (pageErrors.length) console.log('page errors:', pageErrors);
if (results.fatal) { console.error('FATAL:', results.fatal); process.exit(1); }

const allPass = pass === CHECKS.length;
console.log(`\n${allPass ? 'PASS' : 'FAIL'} (${pass}/${CHECKS.length})`);
process.exit(allPass ? 0 : 1);
