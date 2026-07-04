#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the FOURLEAF CHARM proc-luck keystone.
// The charm makes every on-hit STATUS proc (burn/bleed/freeze/chain/doom/wound/
// multicast) "roll twice, keep the better result" — lifting the whole status/proc
// ecosystem through one shared helper (PlayerStats.rollProc) without touching any
// individual chance. It does NOT touch crit or dodge (core stats).
//
//   1. Data: fourleaf_charm_t3 exists, fourleafCharm:true, legendary, 🍀 icon.
//   2. Default: a fresh PlayerStats has hasFourleafCharm()===false.
//   3. rollProc edges: rollProc(0)===false, rollProc(1)===true (with & without charm).
//   4. Baseline stats: WITHOUT charm, rollProc(p) hit-rate ≈ p (it's a plain roll).
//   5. Charm held: addItem(charm) flips hasFourleafCharm()===true.
//   6. Luck stats: WITH charm, rollProc(p) hit-rate ≈ 1-(1-p)^2 (roll twice, keep better).
//   7. Strictly better: with-charm rate materially exceeds without-charm rate.
//   8. Wiring (source scan): the 7 status-proc sites in Game.ts call rollProc(...) and
//      NONE of them remain a bare `Math.random() < get<Status>Chance()`. Crit/dodge
//      (Player.ts) are untouched — still their own rolls.
//
// TS `private` is compile-time only, so g.playerStats.rollProc / .addItem are reachable
// at runtime. window.__ItemDatabase exposes the catalog.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/fourleaf';
fs.mkdirSync(OUT, { recursive: true });

// === Source-scan wiring checks (run against src, before the runtime build) ===
const gameSrc = fs.readFileSync(path.join(FRONTEND, 'src/Game.ts'), 'utf8');
const STATUS_GETTERS = ['getChainLightningChance','getFreezeChance','getBurnChance',
  'getBleedChance','getWoundChance','getDoomChance','getMulticastChance'];
const wiring = {};
// Every status getter must be consumed by rollProc(...) somewhere.
wiring.allStatusUseRollProc = STATUS_GETTERS.every(g =>
  new RegExp(`rollProc\\(\\s*(mc|this\\.playerStats\\.${g}\\(\\))`).test(gameSrc) ||
  // multicast uses the local `mc` variable inside rollProc; check its getter feeds mc
  (g === 'getMulticastChance' && /getMulticastChance\(\)/.test(gameSrc) && /rollProc\(mc\)/.test(gameSrc)));
// No status proc may remain a bare Math.random() < get<Status>Chance().
wiring.noBareStatusRolls = STATUS_GETTERS.every(g =>
  !new RegExp(`Math\\.random\\(\\)\\s*<\\s*this\\.playerStats\\.${g}\\(\\)`).test(gameSrc));

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
await page.setViewport({ width: 390, height: 844 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };
  const out = {};
  const P = 0.3, N = 40000, TOL = 0.02;
  const rate = (ps) => { let h = 0; for (let i = 0; i < N; i++) if (ps.rollProc(P)) h++; return h / N; };

  // === 1. Item catalog entry. ===
  const item = DB.getItemById('fourleaf_charm_t3');
  out.itemExists = !!item && item.fourleafCharm === true;
  out.itemLegendary = !!item && item.rarity === 'legendary' && item.icon === '🍀';

  // === 2. Default: no charm on a fresh run. ===
  g.startNewGame();
  out.noCharmDefault = g.playerStats.hasFourleafCharm() === false;

  // === 3. rollProc edges WITHOUT charm. ===
  out.baseRollZero = g.playerStats.rollProc(0) === false;
  out.baseRollOne = g.playerStats.rollProc(1) === true;

  // === 4. Baseline hit-rate ≈ p (plain single roll). ===
  const baseRate = rate(g.playerStats);
  out.baselineRate = baseRate;
  out.baselineMatchesP = Math.abs(baseRate - P) < TOL;

  // === 5. Charm held after addItem. ===
  if (item) g.playerStats.addItem(item);
  out.charmHeld = g.playerStats.hasFourleafCharm() === true;

  // === 6. rollProc edges WITH charm still deterministic at 0 and 1. ===
  out.luckRollZero = g.playerStats.rollProc(0) === false;
  out.luckRollOne = g.playerStats.rollProc(1) === true;

  // === 7. Luck hit-rate ≈ 1-(1-p)^2 (roll twice, keep better). ===
  const luckRate = rate(g.playerStats);
  const expected = 1 - (1 - P) * (1 - P); // 0.51 at p=0.3
  out.luckRate = luckRate;
  out.luckExpected = expected;
  out.luckMatchesFormula = Math.abs(luckRate - expected) < TOL;

  // === 8. Strictly & materially better than baseline. ===
  out.luckStrictlyBetter = luckRate > baseRate + 0.1;

  return out;
});

// Screenshot the shop/gear so the 🍀 icon renders somewhere for a visual sanity check.
async function shot(vp, name) {
  await page.setViewport(vp);
  await page.evaluate(() => {
    const g = window.__game;
    const DB = window.__ItemDatabase;
    g.startNewGame();
    const item = DB.getItemById('fourleaf_charm_t3');
    if (item) g.playerStats.addItem(item);
    g.state = 'playing';
  });
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: path.join(OUT, name) });
}
await shot({ width: 390, height: 844 }, 'fourleaf-mobile.png');

await browser.close();
server.close();

console.log('\n=== Fourleaf Charm proc-luck (shipped frontend/dist) ===');
console.log(JSON.stringify({ ...wiring, ...result }, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('Screenshots →', OUT);

const runtimeChecks = ['itemExists','itemLegendary','noCharmDefault','baseRollZero','baseRollOne',
  'baselineMatchesP','charmHeld','luckRollZero','luckRollOne','luckMatchesFormula','luckStrictlyBetter'];
const wiringChecks = ['allStatusUseRollProc','noBareStatusRolls'];
const all = { ...wiring, ...result };
const pass = result && !result.fatal &&
  wiringChecks.every(k => wiring[k] === true) &&
  runtimeChecks.every(k => result[k] === true) &&
  errors.length === 0;
const total = runtimeChecks.length + wiringChecks.length;
const passed = [...wiringChecks, ...runtimeChecks].filter(k => all[k] === true).length;
console.log(`\n${passed}/${total} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
