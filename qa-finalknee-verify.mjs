#!/usr/bin/env node
// FINAL-KNEE VERIFY (diagnostic): confirm the FINAL REALIZED-DAMAGE KNEE actually bounds
// the number an enemy takes. The general balance probe reads getRangedDamage() ×
// getCritMultiplier() directly, which BYPASSES Player.getCritDamage() (where the knee
// lives). This harness stacks the same runaway crit hoard, then compares the raw product
// against what the real hit path — player.getCritDamage(shot) — returns, and derives
// hits-to-kill against the wave-20 bruiser/boss the player actually faces.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
console.log('Building frontend...');
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
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 500));

const out = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g || !DB) return { fatal: 'no globals' };
  const clone = (it) => JSON.parse(JSON.stringify(it));
  const waveScale = w => (1 + (w - 1) * 0.15) * Math.pow(1.18, Math.max(0, w - 7)) * Math.pow(1.15, Math.max(0, w - 10));
  const surv = w => 2.6 * (1 + Math.max(0, w - 4) * 0.22);
  const enemyHP = (baseHP, w) => baseHP * waveScale(w) * surv(w);

  const dmgItems = DB.getUnlockedItems().filter(i => i.damageMultiplier && i.damageMultiplier > 1);
  const rangedItems = DB.getUnlockedItems().filter(i => i.rangedDamageMult && i.rangedDamageMult > 1);
  const critChanceItems = DB.getUnlockedItems().filter(i => i.critChance && i.critChance > 0);
  const critMultItems = DB.getUnlockedItems().filter(i => i.critDamageMultiplier && i.critDamageMultiplier > 1);

  const measure = () => {
    const ps = g.playerStats;
    const shot = ps.getRangedDamage();
    const critMult = ps.getCritMultiplier();
    const rawProduct = shot * critMult;                 // what the probe measured (bypasses knee)
    const realizedHit = g.player.getCritDamage(shot);    // the REAL hit path (knee applied)
    return {
      sameStats: g.player.stats === ps,
      shot: Math.round(shot),
      critMult: Math.round(critMult),
      rawProduct: Math.round(rawProduct),
      realizedHit: Math.round(realizedHit),
      compression: +(rawProduct / Math.max(1, realizedHit)).toFixed(1),
    };
  };

  // medium (below knee — must be identical), heavy crit, and the runaway critHeavy.
  const states = {};
  g.startNewGame();
  dmgItems.slice(0, 5).forEach(it => g.playerStats.addItem(clone(it)));
  rangedItems.slice(0, 3).forEach(it => g.playerStats.addItem(clone(it)));
  dmgItems.slice(0, 2).forEach(it => { g.playerStats.addItem(clone(it)); g.playerStats.addItem(clone(it)); });
  states.medium = measure();

  g.startNewGame();
  dmgItems.forEach(it => g.playerStats.addItem(clone(it)));
  rangedItems.forEach(it => g.playerStats.addItem(clone(it)));
  dmgItems.slice(0, 4).forEach(it => { for (let k = 0; k < 4; k++) g.playerStats.addItem(clone(it)); });
  states.heavy = measure();

  g.startNewGame();
  dmgItems.forEach(it => g.playerStats.addItem(clone(it)));
  rangedItems.forEach(it => g.playerStats.addItem(clone(it)));
  dmgItems.slice(0, 4).forEach(it => { for (let k = 0; k < 4; k++) g.playerStats.addItem(clone(it)); });
  critChanceItems.forEach(it => g.playerStats.addItem(clone(it)));
  critMultItems.forEach(it => g.playerStats.addItem(clone(it)));
  critMultItems.slice(0, 4).forEach(it => { for (let k = 0; k < 4; k++) g.playerStats.addItem(clone(it)); });
  states.critHeavy = measure();

  const hit = states.critHeavy.realizedHit;
  const htk = {};
  for (const w of [13, 15, 20]) {
    htk['w'+w] = {
      bruiser: +(enemyHP(250, w) / hit).toFixed(2),
      boss: +(enemyHP(600, w) / hit).toFixed(2),
    };
  }
  return { states, critHeavyHitsToKill: htk, knee: { K: g.playerStats.constructor.FINAL_DMG_KNEE, E: g.playerStats.constructor.FINAL_DMG_EXP } };
});

console.log('\n=== FINAL-KNEE VERIFY ===');
if (out.fatal) { console.log('FATAL:', out.fatal); process.exit(1); }
console.log('knee: K=' + out.knee.K + ' E=' + out.knee.E);
for (const [k, s] of Object.entries(out.states)) {
  console.log(`  ${k.padEnd(9)}: shot=${s.shot.toLocaleString().padStart(10)} crit=${s.critMult.toLocaleString()}x  rawProduct=${s.rawProduct.toLocaleString().padStart(16)}  ->  REALIZED=${s.realizedHit.toLocaleString().padStart(10)} (${s.compression}x compressed)  sameStats=${s.sameStats}`);
}
console.log('\ncritHeavy realized hits-to-kill (>=1 means no longer a one-shot):');
for (const [w, v] of Object.entries(out.critHeavyHitsToKill)) {
  console.log(`  ${w}: bruiser ${v.bruiser}x | boss ${v.boss}x`);
}

// Assertions: medium unchanged; critHeavy realized must be bounded well under 1e6.
const med = out.states.medium;
const ch = out.states.critHeavy;
let pass = true;
if (med.rawProduct !== med.realizedHit) { console.log('FAIL: medium build was altered by the knee (should be below it).'); pass = false; }
if (ch.realizedHit > 1_000_000) { console.log('FAIL: critHeavy realized still exceeds 1,000,000.'); pass = false; }
if (!ch.sameStats) { console.log('WARN: g.player.stats !== g.playerStats — measurement path may differ from game.'); }
console.log('\n' + (pass ? 'PASS — final knee bounds the realized hit; normal builds untouched.' : 'FAIL — see above.'));

await browser.close();
server.close();
process.exit(pass ? 0 : 1);
