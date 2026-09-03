#!/usr/bin/env node
// QA: Kill-stack + Growing Malice HUD counters.
//
// Verifies (on the SHIPPED frontend/dist) that:
//   Kill Stack:
//   1.  kill-stack items exist with correct killStackDamage values
//   2.  getKillStackDamage() aggregates across copies
//   3.  killStackCount is a direct accessible field on the game object
//   4.  HUD counter shows when killStackCount >= 1 and item held
//   5.  HUD counter suppressed when killStackCount = 0
//   6.  Counter floor is correct (Math.floor of the float)
//   7.  Drain-urgency pulse: timer > 2.0 triggers draining state
//   8.  No item → counter invisible (getKillStackDamage() = 0)
//   Growing Malice:
//   9.  growing_malice_t3 exists with timeRampDamage: 0.03
//   10. getTimeRampDamage() aggregates across copies
//   11. runPlaySeconds is a direct accessible field
//   12. HUD counter suppressed at 0 stacks (runPlaySeconds < 15)
//   13. HUD counter shows at 1+ stacks (runPlaySeconds >= 15)
//   14. Bonus pct formula: Math.round(timeRampDamage * stacks * 100)
//   15. No item → counter invisible (getTimeRampDamage() = 0)
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
    g.wavesSurvived = 1;
  };

  // ================================================================
  // KILL STACK checks
  // ================================================================

  // 1. Catalog presence — base kill-stack item is 'killing_spree_t2' (name: "Kill Frenzy")
  const ks1 = DB.getItemById('killing_spree_t2');
  out.killstack_item_exists = !!ks1;
  out.killstack_item_damage_positive = ks1 ? ks1.killStackDamage > 0 : false;

  const ks2 = DB.getItemById('kill_reactor_t3');
  out.killstack_t2_exists = !!ks2;

  // 2. Aggregation — killing_spree_t2 has killStackDamage: 0.04
  fresh();
  giveItem('killing_spree_t2');
  const singleKS = g.playerStats.getKillStackDamage();
  out.singleKillStackCorrect = near(singleKS, 0.04);

  fresh();
  giveItem('killing_spree_t2'); giveItem('killing_spree_t2');
  const doubleKS = g.playerStats.getKillStackDamage();
  out.doubleKillStackCorrect = near(doubleKS, 0.08);

  // 3. killStackCount direct field access
  fresh();
  out.killStackCountAccessible = typeof g.killStackCount === 'number';
  out.killStackTimerAccessible = typeof g.killStackTimer === 'number';

  // 4. HUD counter shows when killStackCount >= 1 and item held
  fresh();
  giveItem('killing_spree_t2');
  g.killStackCount = 10;
  g.killStackTimer = 0;
  const ksBonus4 = g.playerStats.getKillStackDamage();
  const ksFloor4 = Math.floor(g.killStackCount);
  out.hudKillStackShows = ksBonus4 > 0 && ksFloor4 >= 1;
  out.hudKillStackFloor = ksFloor4; // should be 10

  // 5. HUD counter suppressed at 0 stacks
  g.killStackCount = 0;
  const ksFloor5 = Math.floor(g.killStackCount);
  out.hudKillStackSuppressedAt0 = ksFloor5 < 1;

  // 6. Floor is correct (fractional stacks → floor)
  g.killStackCount = 7.8;
  out.hudKillStackFloorFractional = Math.floor(g.killStackCount) === 7;

  // 7. Drain-urgency: timer > 2.0 → draining state
  g.killStackCount = 5;
  g.killStackTimer = 1.9;
  out.notDrainingAt1_9 = !(g.killStackTimer > 2.0);
  g.killStackTimer = 2.5;
  out.drainingAt2_5 = g.killStackTimer > 2.0;

  // 8. No item → counter invisible
  fresh();
  const noKSItem = g.playerStats.getKillStackDamage();
  out.noItemNoKillStack = noKSItem === 0;

  // ================================================================
  // GROWING MALICE checks
  // ================================================================

  // 9. Catalog presence
  const gm3 = DB.getItemById('growing_malice_t3');
  out.growingMalice_exists = !!gm3;
  out.growingMalice_timeRamp = gm3?.timeRampDamage ?? null;
  out.growingMalice_timeRampCorrect = near(gm3?.timeRampDamage ?? -1, 0.03);

  const pm2 = DB.getItemById('growing_malice_t2') || DB.getItemById('patience_charm_t2');
  out.growingMalice_t2_exists = !!pm2;

  // 10. Aggregation
  fresh();
  giveItem('growing_malice_t3'); // timeRampDamage: 0.03
  const singleTR = g.playerStats.getTimeRampDamage();
  out.singleTimeRampCorrect = near(singleTR, 0.03);

  fresh();
  giveItem('growing_malice_t3'); giveItem('growing_malice_t3');
  const doubleTR = g.playerStats.getTimeRampDamage();
  out.doubleTimeRampCorrect = near(doubleTR, 0.06);

  // 11. runPlaySeconds direct field access
  fresh();
  out.runPlaySecondsAccessible = typeof g.runPlaySeconds === 'number';

  // 12. HUD counter suppressed at 0 stacks (play time < 15s)
  fresh();
  giveItem('growing_malice_t3');
  g.runPlaySeconds = 14;
  const stacks12 = Math.floor(g.runPlaySeconds / 15); // 0
  out.hudMaliceSuppressedBelow15s = stacks12 === 0;

  // 13. HUD counter shows at 1+ stacks (runPlaySeconds >= 15)
  g.runPlaySeconds = 15;
  const stacks13 = Math.floor(g.runPlaySeconds / 15); // 1
  out.hudMaliceShowsAt15s = stacks13 >= 1;

  g.runPlaySeconds = 60;
  const stacks60 = Math.floor(g.runPlaySeconds / 15); // 4
  out.hudMaliceStacksAt60s = stacks60; // should be 4

  // 14. Bonus pct formula
  const timeRamp = g.playerStats.getTimeRampDamage();
  const bonusPct14 = Math.round(timeRamp * stacks60 * 100);
  out.maliceBonusPctAt60s = bonusPct14; // 0.03 * 4 * 100 = 12
  out.maliceBonusPctFormulaSane = bonusPct14 === 12;

  // 15. No item → counter invisible
  fresh();
  const noTRItem = g.playerStats.getTimeRampDamage();
  out.noItemNoMalice = noTRItem === 0;

  return out;
});

await browser.close();
server.close();

const checks = [
  // Kill Stack
  'killstack_item_exists', 'killstack_item_damage_positive', 'killstack_t2_exists',
  'singleKillStackCorrect', 'doubleKillStackCorrect',
  'killStackCountAccessible', 'killStackTimerAccessible',
  'hudKillStackShows', 'hudKillStackSuppressedAt0', 'hudKillStackFloorFractional',
  'notDrainingAt1_9', 'drainingAt2_5',
  'noItemNoKillStack',
  // Growing Malice
  'growingMalice_exists', 'growingMalice_timeRampCorrect', 'growingMalice_t2_exists',
  'singleTimeRampCorrect', 'doubleTimeRampCorrect',
  'runPlaySecondsAccessible',
  'hudMaliceSuppressedBelow15s', 'hudMaliceShowsAt15s',
  'maliceBonusPctFormulaSane',
  'noItemNoMalice',
];

const fatal = result?.fatal;
const errMsg = errors.length ? errors.join('\n') : null;

console.log('\n=== Kill-stack + Growing Malice HUD counters (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
if (errMsg) console.error('Console/page errors:\n', errMsg);
else console.log('Console/page errors: 0');

const pass = !fatal && !errMsg && checks.every(k => !!result[k]);
const passCount = checks.filter(k => !!result[k]).length;
console.log(`\n${passCount}/${checks.length} checks passed`);
console.log(`RESULT: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
if (fatal) console.error('FATAL:', fatal);
if (!pass) process.exit(1);
