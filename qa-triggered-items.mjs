#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the CONDITIONAL / TRIGGERED item layer —
// the game's first non-static item effects. Each pays out only while a run condition
// holds, folded into playerStats.runtimeDamageMult / runtimeFireRateMult by
// Game.updateRuntimeModifiers (driven each frame from g.update).
//
//   1. Grindstone (waveRampDamage 0.06) — permanent +6% dmg per wave survived
//      (payout on wavesSurvived-1, so wave 1 = 0).
//   2. Last Stand (lowHpPower 0.6) — below 35% HP: +60% dmg AND +60% fire rate;
//      nothing at full HP.
//   3. Killing Spree (killStackDamage 0.04) — +4% dmg per stack (kill streak),
//      and the stacks DRAIN once the grace window lapses.
//   4. Juggernaut Plating (highHpPower 0.4) — at/above 90% HP: +40% dmg; nothing when hurt.
//   5. Miser's Hoard (goldScaleDamage 0.08) — +8% dmg per 100 gold, capped at +200%.
//   6. No item held ⇒ runtime multipliers stay identity (no accidental always-on).
//
// TS `private` is compile-time only, so g.wavesSurvived / g.killStackCount / the
// runtime mults are all readable at runtime. Boots into a real wave and steps g.update.
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
  const out = {};
  const near = (a, b) => Math.abs(a - b) < 1e-6;

  const giveItem = (id) => {
    const item = DB.getItemById(id);
    if (!item) return false;
    g.playerStats.addItem(item);
    return true;
  };
  const fresh = () => { g.startNewGame(); g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing'; };
  const step = (n = 1) => { for (let i = 0; i < n; i++) g.update(1/60); };
  const dMult = () => g.playerStats.runtimeDamageMult;
  const frMult = () => g.playerStats.runtimeFireRateMult;

  // === 0. Item catalog presence (all 5 exist and carry their field) ===
  out.itemsExist = ['grindstone_t3','last_stand_t3','killing_spree_t3','juggernaut_t3','misers_hoard_t3']
    .every(id => !!DB.getItemById(id));

  // === 1. GRINDSTONE ===
  fresh(); giveItem('grindstone_t3');
  g.wavesSurvived = 1; step(); out.grindWave1 = near(dMult(), 1.0);          // wave 1 → no ramp
  g.wavesSurvived = 6; step(); out.grindWave6 = near(dMult(), 1 + 0.06 * 5); // +30%

  // === 2. LAST STAND ===
  fresh(); giveItem('last_stand_t3');
  g.player.health = g.player.maxHealth;        step(); out.lastStandFullHp = near(dMult(), 1.0) && near(frMult(), 1.0);
  g.player.health = g.player.maxHealth * 0.20; step(); out.lastStandLowDmg = near(dMult(), 1.6);
  out.lastStandLowFr = near(frMult(), 1.6);

  // === 3. KILLING SPREE ===
  fresh(); giveItem('killing_spree_t3');
  g.killStackCount = 10; g.killStackTimer = 0; step(); out.spree10 = near(dMult(), 1 + 0.04 * 10); // +40%
  // Drain: past the grace window, stacks fall over time.
  g.killStackCount = 10; g.killStackTimer = 5; const before = g.killStackCount; step(30);
  out.spreeDrains = g.killStackCount < before;

  // === 4. JUGGERNAUT ===
  fresh(); giveItem('juggernaut_t3');
  g.player.health = g.player.maxHealth;        step(); out.juggFull = near(dMult(), 1.4);
  g.player.health = g.player.maxHealth * 0.50; step(); out.juggHurt = near(dMult(), 1.0);

  // === 5. MISER'S HOARD ===
  fresh(); giveItem('misers_hoard_t3');
  g.player.gold = 500;  step(); out.miser500 = near(dMult(), 1 + 0.08 * 5);  // +40%
  g.player.gold = 5000; step(); out.miserCap = near(dMult(), 1 + 2.0);       // capped at +200%

  // === 6. NO ITEM ⇒ identity ===
  fresh(); g.wavesSurvived = 8; g.killStackCount = 15; g.player.gold = 9999; step();
  out.noItemIdentity = near(dMult(), 1.0) && near(frMult(), 1.0);

  return out;
});

await browser.close();
server.close();

console.log('\n=== Conditional / triggered items (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const checks = ['itemsExist','grindWave1','grindWave6','lastStandFullHp','lastStandLowDmg','lastStandLowFr',
  'spree10','spreeDrains','juggFull','juggHurt','miser500','miserCap','noItemIdentity'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
