#!/usr/bin/env node
/**
 * qa-temporal-hourglass.mjs — verify Temporal Hourglass artifact (−30% active-skill CDR)
 *
 * Feature added 2026-07-18: "Temporal Hourglass" (epic artifact, cdMult: 0.7) reduces
 * active skill cooldown duration by 30%. This is the first artifact that modifies the
 * active-skill cooldown axis — previously no artifact touched cooldowns.
 *
 * Tests:
 *   temporalHourglassInRollable  — artifact exists in ROLLABLE pool (not a curse),
 *                                   has cdMult: 0.7, icon ⏳, rarity epic
 *   statAfterGrant               — after adding the artifact, playerStats.artifactCdMult
 *                                   equals 0.7 (default is 1.0)
 *   cooldownAfterFire            — after firing frost_nova (base 5s cd), the cooldown
 *                                   timer is set to 5 × 0.7 = 3.5s (not the full 5s)
 *   baselineWithoutArtifact      — without the artifact, frost_nova fires at full 5s cd
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-temporal-hourglass.mjs
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
  const DB = window.__ItemDatabase;
  if (!g || !ARTIFACTS || !DB) return { fatal: 'missing handles' };

  const out = {};
  const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

  // ── Helper: start a fresh run with a frost_nova scroll equipped ──────────────────
  function freshRun() {
    g.startNewGame();
    // frost_nova scroll — base cooldown 5s
    const scroll = DB.getItemById('scroll_frost_nova');
    if (scroll) g.playerStats.addItem(scroll);
    g.state = 'playing';
    g.update(0);  // sync lastUpdateState
    // Reset both skill cooldowns to 0 so skills can fire immediately
    g.activeSkillCooldown = 0;
    g.activeSkillCooldownE = 0;
  }

  // ─── 1. Catalog check ───────────────────────────────────────────────────────────
  const ROLLABLE = ARTIFACTS.filter(a => !a.curse);
  const th = ROLLABLE.find(a => a.id === 'temporal_hourglass');
  out.temporalHourglassInRollable = !!(th && th.cdMult === 0.7 && th.rarity === 'epic' && th.icon === '⏳');

  // ─── 2. Stat after grant: artifactCdMult becomes 0.7 ──────────────────────────
  freshRun();
  const cdMultBefore = g.playerStats.artifactCdMult;  // expect 1.0 (no artifact yet)
  g.artifacts.add(th, g.playerStats);
  const cdMultAfter = g.playerStats.artifactCdMult;   // expect 0.7
  out.statAfterGrant = cdMultBefore === 1 && near(cdMultAfter, 0.7);

  // ─── 3. Cooldown after fire (with artifact) ─────────────────────────────────────
  // Skill is already equipped (scroll_frost_nova was added in freshRun above).
  // Artifact is already applied. Call useActiveSkill to fire it.
  g.useActiveSkill('q');
  const cdWithArtifact = g.activeSkillCooldown;  // expect 5 × 0.7 = 3.5
  out.cooldownAfterFire = near(cdWithArtifact, 3.5, 0.05);

  // ─── 4. Baseline without artifact (control) ─────────────────────────────────────
  freshRun();  // fresh run, no artifact — cdMult resets to 1.0
  g.useActiveSkill('q');
  const cdBaseline = g.activeSkillCooldown;  // expect 5.0
  out.baselineWithoutArtifact = near(cdBaseline, 5.0, 0.05);

  // Attach measured values for debugging
  out._debug = {
    cdMultBefore, cdMultAfter,
    cdWithArtifact: +cdWithArtifact.toFixed(3),
    cdBaseline: +cdBaseline.toFixed(3),
  };
  return out;
});

await browser.close();
server.close();

const CHECKS = ['temporalHourglassInRollable', 'statAfterGrant', 'cooldownAfterFire', 'baselineWithoutArtifact'];
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
