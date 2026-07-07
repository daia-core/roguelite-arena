#!/usr/bin/env node
// WEAPON-EVOLUTION test. Proves the VS-style evolution feature is real and REACHABLE
// through the genuine wave-clear path (cp-b7: a test-injection passing is not proof of
// reachability — so we drive the actual updatePlaying() loop, not the handler directly).
//
//  A) Data reachability: every base weapon + catalyst is a shop-obtainable item
//     (unlocked:true); every evolved weapon exists, is unlocked:false, and NEVER rolls
//     in the weighted shop across many draws (evolution-only).
//  B) Logic: the real EvolutionSystem instance offers an evolution iff base+catalyst are
//     owned AND wave >= 8, and never once the evolved weapon is already owned.
//  C) End-to-end through production code: set up a player holding base+catalyst, force the
//     wave complete at wave 8, run the REAL update loop, and assert the base weapon was
//     replaced in-place by the evolved weapon and the announcement banner fired.
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
  if (!g.evolutionSystem) return { fatal: 'no evolutionSystem on Game' };

  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

  const EVOS = g.evolutionSystem.getAllEvolutions();
  ok('evolutions defined', EVOS.length >= 4, `count=${EVOS.length}`);

  // ---- A) Data reachability ----
  {
    const unlockedIds = new Set(DB.getUnlockedItems().map(i => i.id));
    for (const e of EVOS) {
      const bw = DB.getItemById(e.baseWeaponId);
      const cat = DB.getItemById(e.catalystItemId);
      const ev = DB.getItemById(e.evolvedWeaponId);
      ok(`${e.id}: base '${e.baseWeaponId}' obtainable`, bw && unlockedIds.has(e.baseWeaponId), bw ? 'unlocked' : 'MISSING');
      ok(`${e.id}: catalyst '${e.catalystItemId}' obtainable`, cat && unlockedIds.has(e.catalystItemId), cat ? 'unlocked' : 'MISSING');
      ok(`${e.id}: evolved '${e.evolvedWeaponId}' exists`, !!ev, ev ? 'ok' : 'MISSING');
      ok(`${e.id}: evolved is NOT unlocked (evolution-only)`, ev && ev.unlocked === false, ev ? `unlocked=${ev.unlocked}` : 'MISSING');
    }

    // Evolved weapons must never roll in the weighted shop across many draws & waves.
    g.startNewGame();
    const s = g.playerStats;
    const evolvedIds = new Set(EVOS.map(e => e.evolvedWeaponId));
    let sawEvolvedInShop = 0, totalOffers = 0;
    for (let wave = 1; wave <= 15; wave++) {
      for (let d = 0; d < 40; d++) {
        const offers = DB.getWeightedShopItems(6, wave, s.items, s.getLuck(), s);
        totalOffers += offers.length;
        for (const o of offers) if (evolvedIds.has(o.id)) sawEvolvedInShop++;
      }
    }
    ok('evolved weapons NEVER offered in shop', sawEvolvedInShop === 0, `saw=${sawEvolvedInShop}/${totalOffers} offers`);
  }

  // ---- B) EvolutionSystem logic (real instance) ----
  {
    const e = EVOS[0]; // shotgun_evolution: base shotgun_weapon_t2 + catalyst explosive_t3
    const bw = DB.getItemById(e.baseWeaponId);
    const cat = DB.getItemById(e.catalystItemId);
    const ev = DB.getItemById(e.evolvedWeaponId);

    // Below required wave → not offered.
    ok('logic: no evo at wave 7 (base+catalyst)', g.evolutionSystem.checkEvolutions([bw, cat], 7).length === 0, 'wave 7');
    // Missing catalyst → not offered even at wave 8.
    ok('logic: no evo without catalyst', g.evolutionSystem.checkEvolutions([bw], 8).length === 0, 'base only');
    // Base + catalyst + wave 8 → offered.
    const offered = g.evolutionSystem.checkEvolutions([bw, cat], 8);
    ok('logic: evo offered at wave 8 with base+catalyst', offered.some(x => x.id === e.id), `offered=${offered.map(x=>x.id).join(',')}`);
    // Already evolved → not offered again.
    ok('logic: no re-evo once evolved owned', g.evolutionSystem.checkEvolutions([ev, cat], 8).length === 0, 'has evolved');
  }

  // ---- C) End-to-end through the genuine wave-clear path ----
  {
    const e = EVOS[0];
    g.startNewGame();
    const s = g.playerStats;
    // Give the player the base weapon + catalyst as a real run would.
    s.addItem(DB.getItemById(e.baseWeaponId));
    s.addItem(DB.getItemById(e.catalystItemId));
    const hadBaseBefore = s.items.some(i => i.id === e.baseWeaponId);
    const hadEvolvedBefore = s.items.some(i => i.id === e.evolvedWeaponId);

    // Drive the GENUINE path: put the game into the playing state (startNewGame lands on
    // 'map'), set the wave to the evolution threshold, force the wave complete, and run the
    // real update loop (only updatePlaying — reached in 'playing' state — fires the check).
    g.state = 'playing';
    g.waveManager.currentWave = 8;
    g.waveManager.waveComplete = true;
    g.evolutionBannerTimer = 0;
    g.evolutionBannerText = '';
    g.update(0.016); // real frame → updatePlaying → isWaveComplete → checkWeaponEvolution

    const hasEvolvedAfter = s.items.some(i => i.id === e.evolvedWeaponId);
    const stillHasBaseAfter = s.items.some(i => i.id === e.baseWeaponId);
    const stillHasCatalyst = s.items.some(i => i.id === e.catalystItemId);

    ok('e2e: precondition (had base, not evolved)', hadBaseBefore && !hadEvolvedBefore, `base=${hadBaseBefore} evolved=${hadEvolvedBefore}`);
    ok('e2e: base weapon replaced by evolved via real loop', hasEvolvedAfter && !stillHasBaseAfter, `evolved=${hasEvolvedAfter} base=${stillHasBaseAfter}`);
    ok('e2e: catalyst kept (effect stacks on)', stillHasCatalyst, `catalyst=${stillHasCatalyst}`);
    ok('e2e: announcement banner fired', g.evolutionBannerTimer > 0 && /EVOLVED/.test(g.evolutionBannerText), `text="${g.evolutionBannerText}" t=${g.evolutionBannerTimer}`);
  }

  // ---- D) Shop card evolution hint (getCardEvolutionInfo) ----
  // Verifies the discovery logic so players see "EVO: NAME" on the catalyst card
  // when they own the base weapon (and vice versa), making evolutions discoverable
  // without reading the COMBOS guide.
  {
    const e = EVOS[0]; // shotgun_evolution: base=shotgun_weapon_t2, catalyst=explosive_t3
    const bw = DB.getItemById(e.baseWeaponId);
    const cat = DB.getItemById(e.catalystItemId);

    g.startNewGame();
    const s = g.playerStats;

    // No items → neither card should show an evo hint
    const noHintForCat = g.getCardEvolutionInfo(cat);
    const noHintForBase = g.getCardEvolutionInfo(bw);
    ok('hint: no evo hint when player owns neither item', noHintForCat === null && noHintForBase === null,
      `cat=${JSON.stringify(noHintForCat)} base=${JSON.stringify(noHintForBase)}`);

    // Player owns base weapon → catalyst card should show the evo hint
    s.addItem(bw);
    const hintOnCat = g.getCardEvolutionInfo(cat);
    ok('hint: catalyst card shows evo name when base is owned', hintOnCat?.name === e.name,
      `hint=${JSON.stringify(hintOnCat)} expected=${e.name}`);

    // Player owns catalyst → base weapon card should show the evo hint
    s.removeItem(e.baseWeaponId);
    s.addItem(cat);
    const hintOnBase = g.getCardEvolutionInfo(bw);
    ok('hint: base weapon card shows evo name when catalyst is owned', hintOnBase?.name === e.name,
      `hint=${JSON.stringify(hintOnBase)} expected=${e.name}`);

    // Once evolved, no hint (evolution already happened)
    s.addItem(bw);
    s.addItem(DB.getItemById(e.evolvedWeaponId));
    const noHintAfterEvo = g.getCardEvolutionInfo(cat);
    ok('hint: no evo hint once evolved weapon is already owned', noHintAfterEvo === null,
      `hint=${JSON.stringify(noHintAfterEvo)}`);
  }

  return { checks };
});

await browser.close();
server.close();

console.log('\n=== Weapon evolution (shipped frontend/dist) ===');
let pass = result && !result.fatal && errors.length === 0;
if (result.fatal) { console.log('FATAL:', result.fatal); }
else {
  for (const c of result.checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}  — ${c.detail}`);
    if (!c.pass) pass = false;
  }
}
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
