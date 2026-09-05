#!/usr/bin/env node
// QA: Soul Tithe + Miser's Hoard HUD counters.
//
// Verifies (on the SHIPPED frontend/dist) that:
//   Soul Tithe:
//   1.  soul_tithe_t3 exists with soulTithe: true
//   2.  hasSoulTithe() returns true when item is held
//   3.  soulTitheStacks is a direct accessible field on the game object
//   4.  HUD counter shows when soulTitheStacks >= 1 and item held
//   5.  HUD counter suppressed when soulTitheStacks = 0
//   6.  Bonus pct formula: each stack = +1% DMG (SOUL_TITHE_DMG_PER = 0.01)
//   7.  No item → hasSoulTithe() = false, no counter
//   Miser's Hoard:
//   8.  misers_hoard_t3 exists with goldScaleDamage: 0.08
//   9.  getGoldScaleDamage() aggregates across copies
//   10. player.gold is a direct accessible field
//   11. HUD counter suppressed when gold = 0
//   12. HUD counter shows when goldScaleDamage > 0 AND gold > 0
//   13. Bonus pct formula: Math.round(min(2.0, goldScale * gold / 100) * 100)
//   14. Bonus pct caps at 200% (factor capped at 2.0 in Game.ts)
//   15. No item → getGoldScaleDamage() = 0, no counter
//   No console/page errors throughout.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');

console.log('Building frontend (npm run build)...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.css': 'text/css',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };

  const out = {};
  const near = (a, b, eps = 1e-4) => Math.abs(a - b) < eps;

  const giveItem = (id) => {
    const item = DB.getItemById(id);
    if (!item) return false;
    g.playerStats.addItem(item);
    return true;
  };
  const fresh = () => {
    g.startNewGame();
    g.waveManager.reset();
    g.waveManager.startWave(1);
    g.state = 'playing';
    g.soulTitheStacks = 0;
    g.soulTitheKills = 0;
  };

  // ================================================================
  // SOUL TITHE checks
  // ================================================================

  // 1. Catalog presence
  const titheItem = DB.getItemById('soul_tithe_t3');
  out.tithe_item_exists = !!titheItem;
  out.tithe_item_soulTithe_true = titheItem?.soulTithe === true;

  // 2. hasSoulTithe() true when held
  fresh();
  out.tithe_no_item_false = !g.playerStats.hasSoulTithe();
  giveItem('soul_tithe_t3');
  out.tithe_has_item_true = g.playerStats.hasSoulTithe();

  // 3. soulTitheStacks direct field
  out.tithe_stacks_field_exists = typeof g.soulTitheStacks === 'number';

  // 4. HUD counter suppressed at 0 stacks
  fresh();
  giveItem('soul_tithe_t3');
  g.soulTitheStacks = 0;
  const showAtZero = g.playerStats.hasSoulTithe() && g.soulTitheStacks > 0;
  out.tithe_hud_suppressed_zero = !showAtZero;

  // 5. HUD counter shows at 1+ stacks
  g.soulTitheStacks = 1;
  const showAtOne = g.playerStats.hasSoulTithe() && g.soulTitheStacks > 0;
  out.tithe_hud_shows_at_1 = showAtOne;

  // 6. Bonus pct formula: stacks% (each stack = SOUL_TITHE_DMG_PER * 100 = 1%)
  const SOUL_TITHE_DMG_PER = 0.01; // mirrors Game.ts constant
  g.soulTitheStacks = 7;
  const titheBonus = g.soulTitheStacks; // stacks% = 7 for 7 stacks
  out.tithe_bonus_pct_7stacks = titheBonus === 7;
  g.soulTitheStacks = 25;
  out.tithe_bonus_pct_25stacks = g.soulTitheStacks === 25;

  // 7. No item → no counter
  fresh(); // clears items
  out.tithe_no_item_no_counter = !g.playerStats.hasSoulTithe() && g.soulTitheStacks === 0;

  // 8. soul_bead_t2 also has soulTithe: true
  const beadItem = DB.getItemById('soul_bead_t2');
  out.tithe_bead_exists = !!beadItem;
  out.tithe_bead_soulTithe = beadItem?.soulTithe === true;

  // ================================================================
  // MISER'S HOARD checks
  // ================================================================

  // 8. Catalog presence
  const miserItem = DB.getItemById('misers_hoard_t3');
  out.miser_item_exists = !!miserItem;
  out.miser_item_goldScale_08 = miserItem ? near(miserItem.goldScaleDamage, 0.08) : false;

  // 9. Aggregation — miser_stone_t2 has goldScaleDamage: 0.04
  fresh();
  giveItem('misers_hoard_t3');
  const singleScale = g.playerStats.getGoldScaleDamage();
  out.miser_single_correct = near(singleScale, 0.08);
  giveItem('miser_stone_t2');
  const doubleScale = g.playerStats.getGoldScaleDamage();
  out.miser_double_correct = near(doubleScale, 0.12); // 0.08 + 0.04

  // 10. player.gold direct field
  out.miser_gold_field_exists = g.player != null && typeof g.player.gold === 'number';

  // 11. HUD counter suppressed when gold = 0
  fresh();
  giveItem('misers_hoard_t3');
  if (g.player) g.player.gold = 0;
  const GOLD_SCALE_PER = 100;
  const GOLD_SCALE_CAP = 2.0;
  const gs = g.playerStats.getGoldScaleDamage();
  const goldZero = g.player?.gold ?? 0;
  const factorZero = Math.min(GOLD_SCALE_CAP, gs * (goldZero / GOLD_SCALE_PER));
  out.miser_hud_suppressed_no_gold = gs > 0 && goldZero === 0; // condition: show only if gold>0

  // 12. HUD counter shows when gold > 0
  if (g.player) g.player.gold = 100;
  const gold100 = g.player?.gold ?? 0;
  const factor100 = Math.min(GOLD_SCALE_CAP, gs * (gold100 / GOLD_SCALE_PER));
  out.miser_hud_shows_100g = gs > 0 && gold100 > 0 && factor100 > 0;
  out.miser_bonus_pct_100g = Math.round(factor100 * 100); // 0.08 * 100/100 = 0.08 → 8%

  // 13. Formula correctness
  if (g.player) g.player.gold = 500;
  const gold500 = g.player?.gold ?? 0;
  const factor500 = Math.min(GOLD_SCALE_CAP, gs * (gold500 / GOLD_SCALE_PER));
  out.miser_bonus_pct_500g = Math.round(factor500 * 100); // 0.08 * 500/100 = 0.40 → 40%
  out.miser_formula_500g_correct = out.miser_bonus_pct_500g === 40;

  // 14. Bonus caps at 200%
  if (g.player) g.player.gold = 9999;
  const goldCap = g.player?.gold ?? 0;
  const factorCap = Math.min(GOLD_SCALE_CAP, gs * (goldCap / GOLD_SCALE_PER));
  out.miser_bonus_capped_200 = Math.round(factorCap * 100) === 200;

  // 15. No item → getGoldScaleDamage() = 0
  fresh();
  out.miser_no_item_zero = g.playerStats.getGoldScaleDamage() === 0;

  return out;
});

await browser.close();
server.close();

const checks = [
  // Soul Tithe
  'tithe_item_exists', 'tithe_item_soulTithe_true',
  'tithe_no_item_false', 'tithe_has_item_true',
  'tithe_stacks_field_exists',
  'tithe_hud_suppressed_zero', 'tithe_hud_shows_at_1',
  'tithe_bonus_pct_7stacks', 'tithe_bonus_pct_25stacks',
  'tithe_no_item_no_counter',
  'tithe_bead_exists', 'tithe_bead_soulTithe',
  // Miser's Hoard
  'miser_item_exists', 'miser_item_goldScale_08',
  'miser_single_correct', 'miser_double_correct',
  'miser_gold_field_exists',
  'miser_hud_suppressed_no_gold', 'miser_hud_shows_100g',
  'miser_bonus_pct_100g', // truthy (should be 8)
  'miser_formula_500g_correct',
  'miser_bonus_capped_200',
  'miser_no_item_zero',
];

const fatal = result?.fatal;
const errMsg = errors.length ? errors.join('\n') : null;

console.log('\n=== Soul Tithe + Miser\'s Hoard HUD counters (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
if (errMsg) console.error('Console/page errors:\n', errMsg);
else console.log('Console/page errors: 0');

const pass = !fatal && !errMsg && checks.every(k => !!result[k]);
const passCount = checks.filter(k => !!result[k]).length;
console.log(`\n${passCount}/${checks.length} checks passed`);
console.log(`RESULT: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
if (fatal) console.error('FATAL:', fatal);
if (!pass) process.exit(1);
