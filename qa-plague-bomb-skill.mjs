#!/usr/bin/env node
/**
 * qa-plague-bomb-skill.mjs — verify Plague Bomb active skill
 *
 * Plague Bomb: massive persistent poison DoT zone (8s) that damages all enemies who
 * linger inside. Uses AoeZone(damage=0) for the visual ring + pushActiveDmgZone for
 * the ongoing enemy damage. This pattern had a documented bug fixed 2026-07-09:
 * AoeZone previously had damage=baseDmg/5 which was hitting the PLAYER (AoeZones are
 * player-damage constructs). This test guards against regression of that fix.
 *
 * Tests:
 *   scrollExists          — scroll_plague_bomb in catalog with activatesSkill 'plague_bomb'
 *   skillEquipped         — getEquippedSkillIdQ() returns 'plague_bomb' after equipping
 *   aoeZoneDamageZero     — the visual AoeZone has damage === 0 (REGRESSION GUARD: was baseDmg/5)
 *   activeDmgZoneQueued   — activeDmgZones has ≥1 new persistent DoT zone entry
 *   activeDmgZoneRadius   — the zone's radius ≈ 140 (skill.radius default)
 *   activeDmgZoneLifetime — zone's remaining ≈ 8.0s (plague_bomb duration)
 *   poisonApplied         — enemy inside radius at cast gets poisonTimer ≥ 6.0
 *   cooldownSet           — activeSkillCooldown ≈ 8.0s (base cooldown)
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-plague-bomb-skill.mjs
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

  const near = (a, b, eps = 1.0) => Math.abs(a - b) < eps;

  // ─── 1. Catalog check ────────────────────────────────────────────────────────
  const scroll = DB.getItemById('scroll_plague_bomb');
  const scrollExists = !!(scroll && scroll.activatesSkill === 'plague_bomb');

  // ─── 2. Start a fresh run and equip the scroll ───────────────────────────────
  g.startNewGame();
  if (scroll) g.playerStats.addItem(scroll);
  g.state = 'playing';
  g.update(0);  // sync lastUpdateState
  if (!g.player) return { fatal: 'player null after startNewGame', scrollExists };

  const skillEquipped = g.playerStats.getEquippedSkillIdQ() === 'plague_bomb';

  // ─── 3. Position player and inject one fake enemy inside radius ──────────────
  // Plague Bomb radius ≈ 140. Place enemy at (px+50, py) to be well inside.
  const px = 400, py = 300;
  g.player.x = px;
  g.player.y = py;
  const fakeEnemy = { x: px + 50, y: py, dead: false, poisonTimer: 0 };
  const origEnemies = g.enemies;
  g.enemies = [fakeEnemy];

  // ─── 4. Record baseline ─────────────────────────────────────────────────────
  const aoeZonesBefore = g.aoeZones.length;
  const activeDmgBefore = (g['activeDmgZones'] || []).length;

  // ─── 5. Fire the skill ──────────────────────────────────────────────────────
  g['activeSkillCooldown'] = 0;
  g.useActiveSkill('q');

  // ─── 6. Restore enemies ─────────────────────────────────────────────────────
  g.enemies = origEnemies;

  // ─── 7. Collect results ─────────────────────────────────────────────────────
  const newAoeZones = g.aoeZones.slice(aoeZonesBefore);
  const activeDmgZones = g['activeDmgZones'] || [];
  const newActiveDmg = activeDmgZones.slice(activeDmgBefore);
  const cooldown = g['activeSkillCooldown'];
  const enemyPoison = fakeEnemy.poisonTimer;

  // The visual AoeZone must have damage === 0 (regression guard for the Jul-09 bug)
  const aoeZoneDamageZero = newAoeZones.length >= 1 && newAoeZones.every(z => z.damage === 0);

  // The persistent DoT zone must be queued
  const activeDmgZoneQueued = newActiveDmg.length >= 1;
  const firstZone = newActiveDmg[0] ?? {};
  const activeDmgZoneRadius = near(firstZone.r ?? 0, 140, 20);
  const activeDmgZoneLifetime = near(firstZone.remaining ?? 0, 8.0, 1.0);

  // Enemy inside radius at cast time should have poisonTimer ≥ 6.0
  const poisonApplied = enemyPoison >= 6.0;

  // Cooldown should match base (8s)
  const cooldownSet = near(cooldown, 8.0, 0.5);

  return {
    scrollExists,
    skillEquipped,
    aoeZoneDamageZero,
    activeDmgZoneQueued,
    activeDmgZoneRadius,
    activeDmgZoneLifetime,
    poisonApplied,
    cooldownSet,
    _debug: {
      cooldown: +cooldown.toFixed(3),
      newAoeZones: newAoeZones.length,
      newAoeZonesDamages: newAoeZones.map(z => z.damage),
      newActiveDmg: newActiveDmg.length,
      firstZoneR: firstZone.r ?? null,
      firstZoneRemaining: firstZone.remaining ?? null,
      enemyPoison: +enemyPoison.toFixed(3),
    },
  };
});

await browser.close();
server.close();

const CHECKS = [
  'scrollExists',
  'skillEquipped',
  'aoeZoneDamageZero',
  'activeDmgZoneQueued',
  'activeDmgZoneRadius',
  'activeDmgZoneLifetime',
  'poisonApplied',
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
