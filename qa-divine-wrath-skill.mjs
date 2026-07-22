#!/usr/bin/env node
/**
 * qa-divine-wrath-skill.mjs — verify Divine Wrath active skill
 *
 * Divine Wrath: 3 holy waves hit ALL enemies simultaneously; player is invincible during.
 * Fires 3 deferred damage zones (pushPendingDmg, r=900 each) at the player position.
 * Each wave uses AoeZone(damage=0) for visuals — the same class of pattern that had
 * self-hit bugs in plague_bomb and Overcharge Battery before their fixes.
 *
 * Tests:
 *   scrollExists        — scroll_divine_wrath is in catalog with activatesSkill 'divine_wrath'
 *   skillEquipped       — after addItem(scroll), getEquippedSkillIdQ() returns 'divine_wrath'
 *   iFramesGranted      — invincibilityTimer >= 1.9 immediately after cast (grants 2.0s)
 *   aoeZonesDamageZero  — all 3 new AoeZones have damage === 0 (no player self-hit)
 *   pendingDmgQueued    — 3 new pendingDmg entries pushed (one per wave)
 *   pendingDmgRadius    — all 3 pendingDmg entries have r = 900 (screen-wide hit)
 *   cooldownSet         — activeSkillCooldown ≈ 16.0s (base cooldown, no cdMult artifact)
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-divine-wrath-skill.mjs
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
  const DB = window.__ItemDatabase;
  if (!g || !DB) return { fatal: 'missing __game or __ItemDatabase' };

  const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

  // ─── 1. Catalog check ────────────────────────────────────────────────────────
  const scroll = DB.getItemById('scroll_divine_wrath');
  const scrollExists = !!(scroll && scroll.activatesSkill === 'divine_wrath');

  // ─── 2. Start a fresh run and equip the scroll ───────────────────────────────
  g.startNewGame();
  if (scroll) g.playerStats.addItem(scroll);
  g.state = 'playing';
  g.update(0);  // sync lastUpdateState
  if (!g.player) return { fatal: 'player null after startNewGame', scrollExists };

  const skillEquipped = g.playerStats.getEquippedSkillIdQ() === 'divine_wrath';

  // ─── 3. Position player and inject one fake enemy ─────────────────────────────
  // Divine Wrath hits ALL enemies within r=900 — inject one to confirm pendingDmg
  // targeting; the test checks queue entries, not actual hit counts.
  g.player.x = 400;
  g.player.y = 300;
  const fakeEnemy = { x: 420, y: 300, dead: false };
  const origEnemies = g.enemies;
  g.enemies = [fakeEnemy];

  // ─── 4. Record baseline ─────────────────────────────────────────────────────
  const aoeZonesBefore = g.aoeZones.length;
  const pendingDmgBefore = g.pendingDmg ? g.pendingDmg.length : -1;

  // ─── 5. Fire the skill ──────────────────────────────────────────────────────
  g.activeSkillCooldown = 0;
  g.useActiveSkill('q');

  // ─── 6. Restore enemies ─────────────────────────────────────────────────────
  g.enemies = origEnemies;

  // ─── 7. Collect results ─────────────────────────────────────────────────────
  const newAoeZones = g.aoeZones.slice(aoeZonesBefore);
  const newPendingDmg = g.pendingDmg ? g.pendingDmg.slice(pendingDmgBefore) : [];
  const iFrames = g.player.invincibilityTimer;
  const cooldown = g.activeSkillCooldown;

  return {
    scrollExists,
    skillEquipped,
    iFramesGranted: iFrames >= 1.9,
    aoeZonesDamageZero: newAoeZones.length >= 3 && newAoeZones.every(z => z.damage === 0),
    pendingDmgQueued: newPendingDmg.length >= 3,
    pendingDmgRadius: newPendingDmg.length >= 3 && newPendingDmg.every(p => near(p.r, 900, 10)),
    cooldownSet: near(cooldown, 16.0, 0.5),
    _debug: {
      iFrames: +iFrames.toFixed(3),
      cooldown: +cooldown.toFixed(3),
      newAoeZones: newAoeZones.length,
      newAoeZonesDamages: newAoeZones.map(z => z.damage),
      newPendingDmg: newPendingDmg.length,
      newPendingDmgR: newPendingDmg.map(p => p.r),
    },
  };
});

await browser.close();
server.close();

const CHECKS = [
  'scrollExists',
  'skillEquipped',
  'iFramesGranted',
  'aoeZonesDamageZero',
  'pendingDmgQueued',
  'pendingDmgRadius',
  'cooldownSet',
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
