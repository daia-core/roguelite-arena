#!/usr/bin/env node
// Behavioral verification for the DAMAGE-TYPE SPLIT (melee / ranged / elemental).
// Builds the SHIPPED bundle (frontend/dist), drives it headless, and asserts the
// real runtime behavior — not a claim. Mirrors qa-builddiv.mjs.
//
// Cases:
//   A. No type items -> all three multipliers default to 1 (backward compatible).
//   B. A melee item raises getMeleeDamage only; ranged/global unchanged.
//   C. A ranged item raises getRangedDamage only; melee/global unchanged.
//   D. Per-type mults compose with global getDamage (getMeleeDamage = getDamage * meleeMult).
//   E. Elemental mult multiplies across items (getElementalDamageMult).
//   F. The real DB items shipped with the right fields
//      (Sniper's Focus ranged 1.40, Brawler's Rage melee 1.45 / ranged 0.88, Overcharged Core elemental 1.55).
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
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };
  g.startNewGame();
  // startNewGame now opens on the node-map meta screen; drop straight into combat
  // for this stats-focused harness (the map layer has its own test, qa-node-map).
  g.state = 'playing';
  if (!g.player) return { fatal: `no player after startNewGame (state=${g.state})` };

  const s = g.playerStats;
  const out = {};
  // Add/remove through the real API so the stat memoization invalidates correctly
  // (production code only ever mutates items via addItem/removeItem — never touch
  // s.items directly, or the cache goes stale, which is the whole point of the test).
  let __tn = 0;
  const give = (fields) => { const it = { id: `__test_${__tn++}`, __test: true, tags: [], ...fields }; s.addItem(it); return it; };
  const clear = () => { for (const it of s.items.filter(i => i.__test)) s.removeItem(it.id); };

  // --- Case A: defaults are 1 with no type items ---
  clear();
  out.A_melee = s.getMeleeDamageMult();
  out.A_ranged = s.getRangedDamageMult();
  out.A_elem = s.getElementalDamageMult();

  // --- Case B: melee item raises melee only ---
  clear();
  const base0 = s.getDamage();
  give({ meleeDamageMult: 1.45, tags: [] });
  out.B_meleeMult = s.getMeleeDamageMult();          // 1.45
  out.B_rangedMult = s.getRangedDamageMult();         // 1 (unchanged)
  out.B_meleeDmg = s.getMeleeDamage();                // base0 * 1.45
  out.B_rangedDmg = s.getRangedDamage();              // base0 (global unchanged by a pure meleeMult)
  out.B_base = base0;

  // --- Case C: ranged item raises ranged only ---
  clear();
  give({ rangedDamageMult: 1.40, tags: [] });
  out.C_rangedMult = s.getRangedDamageMult();         // 1.40
  out.C_meleeMult = s.getMeleeDamageMult();           // 1

  // --- Case D: compose with global getDamage ---
  clear();
  const d = s.getDamage();
  give({ meleeDamageMult: 2.0, tags: [] });
  out.D_meleeEqualsDx2 = Math.abs(s.getMeleeDamage() - d * 2.0) < 1e-6;

  // --- Case E: elemental mult composes across items ---
  clear();
  give({ elementalDamageMult: 1.35, tags: [] });
  give({ elementalDamageMult: 1.55, tags: [] });
  out.E_elem = s.getElementalDamageMult();            // 1.35 * 1.55 = 2.0925
  clear();

  // --- Case F: real DB items shipped with the right fields ---
  const sniper = DB.getItemById('snipers_focus_t2');
  const brawler = DB.getItemById('brawlers_rage_t2');
  const core = DB.getItemById('overcharged_core_t3');
  out.F_sniperRanged = sniper && sniper.rangedDamageMult;      // 1.40
  out.F_brawlerMelee = brawler && brawler.meleeDamageMult;      // 1.45
  out.F_brawlerRangedPenalty = brawler && brawler.rangedDamageMult; // 0.88
  out.F_coreElem = core && core.elementalDamageMult;            // 1.55

  return out;
});

await browser.close();
server.close();

console.log('\n=== Damage-type split verification (on shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const approx = (a, b) => Math.abs(a - b) < 1e-6;
const pass = result && !result.fatal
  && result.A_melee === 1 && result.A_ranged === 1 && result.A_elem === 1
  // CROSS_TYPE_BLEED = 0.5 (universality): a pure-melee item bleeds half its bonus
  // into the ranged mult (1.45 → ranged 1 + 0.45×0.5 = 1.225) and vice-versa. The
  // off-type is no longer exactly 1 — assert the bled value.
  && approx(result.B_meleeMult, 1.45) && approx(result.B_rangedMult, 1.225)
  && approx(result.B_meleeDmg, result.B_base * 1.45) && approx(result.B_rangedDmg, result.B_base * 1.225)
  && approx(result.C_rangedMult, 1.40) && approx(result.C_meleeMult, 1.20)
  && result.D_meleeEqualsDx2 === true
  && approx(result.E_elem, 1.35 * 1.55)
  && approx(result.F_sniperRanged, 1.40) && approx(result.F_brawlerMelee, 1.45)
  && approx(result.F_brawlerRangedPenalty, 0.88) && approx(result.F_coreElem, 1.55)
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
