#!/usr/bin/env node
// BALANCE PROBE (diagnostic, not a pass/fail gate): reproduce Felix's "2.3M dmg per
// projectile on wave 13, enemies insta-die" report by simulating a realistic snowball
// build and printing player projectile damage vs. wave-scaled enemy HP per wave.
//
// It buys a plausible damage-stacking loadout the way a player would (a handful of
// damage-multiplier items, some upgraded via duplicate-buy), then reads getRangedDamage()
// and compares it to makeEnemy-equivalent HP (waveScale × survivabilityMult × base HP)
// for a fodder (60), a bruiser (250) and a boss-tier (base × depth) enemy.
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

  // Enemy HP model (mirrors WaveManager.waveScale × survivabilityMult).
  // NOTE: must include the v3 lateSurge factor (1.15^max(0,w-10)) — without it this
  // probe UNDER-reports enemy HP by 1.5x@w13, 2x@w15, 4x@w20 (exactly Felix's
  // complaint range), making the game look more insta-killy than it ships.
  const waveScale = w => (1 + (w - 1) * 0.15) * Math.pow(1.18, Math.max(0, w - 7)) * Math.pow(1.15, Math.max(0, w - 10));
  const surv = w => 2.6 * (1 + Math.max(0, w - 4) * 0.22);
  const enemyHP = (baseHP, w) => baseHP * waveScale(w) * surv(w);
  const bossHP = (baseHP, w) => baseHP * waveScale(w) * (1 + Math.max(0, w / 10 - 1) * 0.35);

  // Build a realistic snowball: grab every damage-multiplier item and buy a spread,
  // upgrading a few via duplicate-buy (the new mechanic that compounds ^N).
  const dmgItems = DB.getUnlockedItems().filter(i => i.damageMultiplier && i.damageMultiplier > 1);
  const rangedItems = DB.getUnlockedItems().filter(i => i.rangedDamageMult && i.rangedDamageMult > 1);
  // CRIT items — the axis the original probe ignored. Felix's own wave-7 sheet was
  // "Crit 100% @ 927x", so the realized per-projectile number he sees (2.3M) is a CRIT
  // hit, not getRangedDamage(). getCritMultiplier() has NO diminishing-returns knee
  // (only the 1e15 sanity cap), so it is un-bounded by the 2026-07-06 aggregate knee,
  // which wraps getDamage() only. This probe now stacks crit and reports realized crit.
  const critChanceItems = DB.getUnlockedItems().filter(i => i.critChance && i.critChance > 0);
  const critMultItems = DB.getUnlockedItems().filter(i => i.critDamageMultiplier && i.critDamageMultiplier > 1);

  // Realized-damage snapshot for the current playerStats: the non-crit shot (what the
  // old probe read), the crit multiplier, the crit HIT (what Felix sees on a crit), and
  // the crit-weighted effective per-shot (chance-blended). getRangedDamage() alone can
  // never reproduce his 2.3M — only ranged x critMult can.
  const snap = () => {
    const ps = g.playerStats;
    const ranged = ps.getRangedDamage();
    const cc = Math.min(1, ps.getCritChance());
    const cm = ps.getCritMultiplier();
    return { ranged: Math.round(ranged), critChance: +(cc).toFixed(3), critMult: Math.round(cm),
             critHit: Math.round(ranged * cm), effective: Math.round(ranged * (1 + cc * (cm - 1))) };
  };

  // Snapshot damage at "light", "medium", "heavy" and "critHeavy" build states.
  const states = {};
  g.startNewGame();
  states.base = snap();

  // Light: 3 distinct damage items, level 1.
  g.startNewGame();
  dmgItems.slice(0, 3).forEach(it => g.playerStats.addItem(clone(it)));
  states.light = snap();

  // Medium: 5 damage items + 3 ranged items, a couple upgraded to +3.
  g.startNewGame();
  dmgItems.slice(0, 5).forEach(it => g.playerStats.addItem(clone(it)));
  rangedItems.slice(0, 3).forEach(it => g.playerStats.addItem(clone(it)));
  // upgrade the two strongest damage items to level 3
  dmgItems.slice(0, 2).forEach(it => { g.playerStats.addItem(clone(it)); g.playerStats.addItem(clone(it)); });
  states.medium = snap();

  // Heavy: everything DAMAGE, several upgraded to +5 (a late-game hoard) — but NO crit
  // items, so heavy.ranged is the exact ceiling the old probe measured.
  g.startNewGame();
  dmgItems.forEach(it => g.playerStats.addItem(clone(it)));
  rangedItems.forEach(it => g.playerStats.addItem(clone(it)));
  dmgItems.slice(0, 4).forEach(it => { for (let k = 0; k < 4; k++) g.playerStats.addItem(clone(it)); });
  states.heavy = snap();

  // CritHeavy: the SAME heavy hoard PLUS every crit item, crit-mult items upgraded — the
  // build class Felix described (near-100% crit at a huge crit multiplier). The gap
  // between critHeavy.critHit and heavy.ranged is the un-bounded crit axis in one number.
  g.startNewGame();
  dmgItems.forEach(it => g.playerStats.addItem(clone(it)));
  rangedItems.forEach(it => g.playerStats.addItem(clone(it)));
  dmgItems.slice(0, 4).forEach(it => { for (let k = 0; k < 4; k++) g.playerStats.addItem(clone(it)); });
  critChanceItems.forEach(it => g.playerStats.addItem(clone(it)));
  critMultItems.forEach(it => g.playerStats.addItem(clone(it)));
  critMultItems.slice(0, 4).forEach(it => { for (let k = 0; k < 4; k++) g.playerStats.addItem(clone(it)); });
  states.critHeavy = snap();

  // Damage-vs-HP table for the CRIT-HEAVY build (the class Felix actually plays — the
  // one that produced 2.3M/projectile). We compare enemy HP against the realized CRIT
  // hit (ranged x critMult), because that is the number he sees delete the screen. The
  // non-crit shot is shown alongside so the crit gap is explicit.
  g.startNewGame();
  dmgItems.forEach(it => g.playerStats.addItem(clone(it)));
  rangedItems.forEach(it => g.playerStats.addItem(clone(it)));
  dmgItems.slice(0, 4).forEach(it => { for (let k = 0; k < 4; k++) g.playerStats.addItem(clone(it)); });
  critChanceItems.forEach(it => g.playerStats.addItem(clone(it)));
  critMultItems.forEach(it => g.playerStats.addItem(clone(it)));
  critMultItems.slice(0, 4).forEach(it => { for (let k = 0; k < 4; k++) g.playerStats.addItem(clone(it)); });
  const shot = g.playerStats.getRangedDamage();
  const critHit = shot * g.playerStats.getCritMultiplier();
  const table = [];
  for (const w of [5, 7, 10, 13, 15, 20]) {
    const fodder = enemyHP(60, w);
    const bruiser = enemyHP(250, w);
    const boss = bossHP(3000, w); // rough boss base
    table.push({
      wave: w,
      shotDmg: Math.round(shot),
      critDmg: Math.round(critHit),
      fodderHP: Math.round(fodder),
      bruiserHP: Math.round(bruiser),
      bossHP: Math.round(boss),
      critHitsToKillFodder: +(fodder / critHit).toFixed(3),
      critHitsToKillBruiser: +(bruiser / critHit).toFixed(3),
      critHitsToKillBoss: +(boss / critHit).toFixed(3),
    });
  }

  return {
    dmgItemCount: dmgItems.length,
    rangedItemCount: rangedItems.length,
    critChanceItemCount: critChanceItems.length,
    critMultItemCount: critMultItems.length,
    states,
    table,
  };
});

console.log('\n=== BALANCE PROBE — player damage vs enemy HP (crit-aware) ===');
if (out.fatal) { console.log('FATAL:', out.fatal); process.exit(1); }
console.log(`Catalog: ${out.dmgItemCount} dmg-mult + ${out.rangedItemCount} ranged + ${out.critChanceItemCount} crit-chance + ${out.critMultItemCount} crit-mult items`);
console.log('\nBuild states — ranged shot vs realized CRIT (the number Felix sees):');
for (const [k, s] of Object.entries(out.states)) {
  console.log(`  ${k.padEnd(9)}: shot=${s.ranged.toLocaleString().padStart(12)} | crit ${(s.critChance*100).toFixed(0)}% @ ${s.critMult.toLocaleString()}x => critHit=${s.critHit.toLocaleString().padStart(14)} | eff/shot=${s.effective.toLocaleString()}`);
}
const H = out.states.heavy, C = out.states.critHeavy;
console.log(`\n  >> crit axis (un-bounded by the getDamage aggregate knee):`);
console.log(`     heavy shot (no crit) ${H.ranged.toLocaleString()}  ->  critHeavy critHit ${C.critHit.toLocaleString()}  =  ${(C.critHit / Math.max(1,H.ranged)).toFixed(0)}x escape past the knee`);
console.log('\nCrit-heavy build — realized CRIT vs enemy HP per wave (hits-to-kill; <1 = one-shot):');
for (const r of out.table) {
  console.log(`  wave ${String(r.wave).padStart(2)}: crit=${r.critDmg.toLocaleString()} (shot ${r.shotDmg.toLocaleString()}) | fodder ${r.fodderHP.toLocaleString()}HP (${r.critHitsToKillFodder}x) | bruiser ${r.bruiserHP.toLocaleString()}HP (${r.critHitsToKillBruiser}x) | boss ${r.bossHP.toLocaleString()}HP (${r.critHitsToKillBoss}x)`);
}

await browser.close();
server.close();
process.exit(0);
