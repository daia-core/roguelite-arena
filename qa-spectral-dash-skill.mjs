#!/usr/bin/env node
/**
 * qa-spectral-dash-skill.mjs — verify Spectral Dash active skill
 *
 * Spectral Dash: phase through 5 nearest enemies in rapid succession (6× dmg each).
 * Uses the same AoeZone(damage=0) + pushPendingDmg pattern as Overcharge Battery and
 * plague_bomb (both had bugs where damage hit the player instead). This test guards
 * the same class of regression for the spectral_dash path.
 *
 * Tests:
 *   scrollExists        — scroll_spectral_dash is in catalog with activatesSkill 'spectral_dash'
 *   skillEquipped       — after addItem(scroll), getEquippedSkillIdQ() returns 'spectral_dash'
 *   playerMoves         — player teleports away from (200,200) toward the last target
 *   iFramesGranted      — invincibilityTimer >= 0.5 immediately after casting
 *   aoeZonesDamageZero  — all new AoeZones spawned have damage === 0 (no player self-hit)
 *   pendingDmgQueued    — 5 new pendingDmg entries pushed (one per enemy target)
 *   cooldownSet         — activeSkillCooldown ≈ 9.0s (base cooldown, no cdMult artifact)
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-spectral-dash-skill.mjs
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
  const scroll = DB.getItemById('scroll_spectral_dash');
  const scrollExists = !!(scroll && scroll.activatesSkill === 'spectral_dash');

  // ─── 2. Start a fresh run and equip the scroll ───────────────────────────────
  g.startNewGame();
  if (scroll) g.playerStats.addItem(scroll);
  g.state = 'playing';
  g.update(0);  // sync lastUpdateState
  if (!g.player) return { fatal: 'player null after startNewGame', scrollExists };

  const skillEquipped = g.playerStats.getEquippedSkillIdQ() === 'spectral_dash';

  // ─── 3. Place 5 fake enemies at known positions ───────────────────────────────
  // Player starts near (200,200) (world origin offset). Enemies are placed at
  // increasing offsets so the 5th enemy is furthest from origin — that's where
  // the player should teleport to (sort by distance from player, take nearest 5).
  g.player.x = 200;
  g.player.y = 200;
  const fakeEnemies = [
    { x: 220, y: 200, dead: false },
    { x: 240, y: 200, dead: false },
    { x: 260, y: 200, dead: false },
    { x: 280, y: 200, dead: false },
    { x: 300, y: 200, dead: false },  // ← nearest 5th (300 is furthest in x but still nearest 5)
  ];
  // Inject into the game's enemy array — spectral_dash reads ctx.enemies directly.
  const origEnemies = g.enemies;
  g.enemies = fakeEnemies;

  // ─── 4. Record baseline ─────────────────────────────────────────────────────
  const playerXBefore = g.player.x;
  const playerYBefore = g.player.y;
  const aoeZonesBefore = g.aoeZones.length;
  const pendingDmgBefore = g.pendingDmg ? g.pendingDmg.length : -1;

  // ─── 5. Fire the skill ──────────────────────────────────────────────────────
  g.activeSkillCooldown = 0;
  g.useActiveSkill('q');

  // ─── 6. Restore enemies ─────────────────────────────────────────────────────
  g.enemies = origEnemies;

  // ─── 7. Collect results ─────────────────────────────────────────────────────
  const playerXAfter = g.player.x;
  const playerYAfter = g.player.y;
  const newAoeZones = g.aoeZones.slice(aoeZonesBefore);
  const newPendingDmg = g.pendingDmg ? g.pendingDmg.slice(pendingDmgBefore) : [];
  const iFrames = g.player.invincibilityTimer;
  const cooldown = g.activeSkillCooldown;

  // The last (5th) enemy target is at x=300, y=200.
  // Player should teleport there (clamped to world bounds — worldWidth is typically 1600+).
  const playerMoves = Math.abs(playerXAfter - playerXBefore) > 5 || Math.abs(playerYAfter - playerYBefore) > 5;
  const playerNearLastTarget = near(playerXAfter, 300, 5) && near(playerYAfter, 200, 5);

  return {
    scrollExists,
    skillEquipped,
    playerMoves,
    playerNearLastTarget,
    iFramesGranted: iFrames >= 0.5,
    aoeZonesDamageZero: newAoeZones.length >= 5 && newAoeZones.every(z => z.damage === 0),
    pendingDmgQueued: newPendingDmg.length >= 5,
    cooldownSet: near(cooldown, 9.0, 0.2),
    _debug: {
      playerXBefore, playerYBefore,
      playerXAfter, playerYAfter,
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
  'playerMoves',
  'playerNearLastTarget',
  'iFramesGranted',
  'aoeZonesDamageZero',
  'pendingDmgQueued',
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
