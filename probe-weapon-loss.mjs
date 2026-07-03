#!/usr/bin/env node
// Repro probe for Felix's B4: "projectile / orb spiral removed after i bought some upgrade".
// Grants the orbital primary weapon + an orbiting-orb ring, then simulates buying EVERY
// other item one at a time, asserting the weapon type and orb count never regress.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');
console.log('Building dist…');
execSync('npm run build', { cwd: GAME, stdio: 'inherit' });

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
await page.waitForFunction('!!window.__game && !!window.__ItemDatabase', { timeout: 10000 });

const out = await page.evaluate(async () => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  const log = [];
  g.startNewGame();

  // Grant the orb-spiral build: orbital primary weapon + a ring of orbiting orbs.
  const orbital = DB.getItemById('orbital_weapon_t3');
  const ring = DB.getItemById('orbit_orb_swarm_t3');
  g.playerStats.addItem(orbital);
  g.playerStats.addItem(ring);

  const wt0 = g.playerStats.getWeaponType();
  const oc0 = g.playerStats.getOrbitOrbCount();
  log.push(`baseline: weapon=${wt0} orbs=${oc0}`);

  // Simulate buying every OTHER item once; after each, weapon must stay 'orbital'
  // and orbs must never drop below baseline.
  const all = DB.getUnlockedItems();
  const regressions = [];
  for (const item of all) {
    if (item.id === 'orbital_weapon_t3' || item.id === 'orbit_orb_swarm_t3') continue;
    g.playerStats.addItem(item);
    const wt = g.playerStats.getWeaponType();
    const oc = g.playerStats.getOrbitOrbCount();
    if (wt !== wt0 || oc < oc0) {
      regressions.push(`buying '${item.id}' (${item.name}, weaponType=${item.weaponType||'-'}) => weapon=${wt} orbs=${oc}`);
    }
    // roll back so each purchase is tested in isolation
    g.playerStats.removeItem(item.id);
  }

  // ---- Scenario A: auto-aim projectile fan, then buy a weapon item ----
  g.startNewGame();
  g.playerStats.addItem(DB.getItemById('multishot_t3')); // projectile fan on default auto-aim
  const aWeapon0 = g.playerStats.getWeaponType();
  const aShots0 = 1 + g.playerStats.getMultishot();
  g.playerStats.addItem(DB.getItemById('orbital_weapon_t3')); // buy an "upgrade" that is a weapon
  const aWeapon1 = g.playerStats.getWeaponType();
  log.push(`scenarioA: auto-aim fan (${aWeapon0}, ${aShots0} shots) -> bought orbital weapon -> now ${aWeapon1}`);

  // ---- Scenario B: buy a weapon AFTER already owning orbital ----
  g.startNewGame();
  g.playerStats.addItem(DB.getItemById('orbital_weapon_t3'));
  const bWeapon0 = g.playerStats.getWeaponType();
  g.playerStats.addItem(DB.getItemById('flamethrower_t3') || DB.getUnlockedItems().find(i => i.weaponType && i.id !== 'orbital_weapon_t3'));
  const bWeapon1 = g.playerStats.getWeaponType();
  log.push(`scenarioB: had orbital (${bWeapon0}) -> bought another weapon -> now ${bWeapon1} (2nd weapon ${bWeapon0===bWeapon1?'WASTED (ignored)':'took over'})`);

  // ---- Scenario C: OFFER-LAYER — once weapon-committed, shop never offers a weapon ----
  const held = [DB.getItemById('orbital_weapon_t3')]; // committed weapon
  let weaponOffers = 0, samples = 40;
  for (let i = 0; i < samples; i++) {
    const offer = DB.getWeightedShopItems(6, 12, held, 0);
    weaponOffers += offer.filter(it => it.weaponType).length;
  }
  log.push(`scenarioC: with a committed weapon, ${weaponOffers} weapon items across ${samples}x6 shop rolls (want 0)`);

  const held2 = [DB.getItemById('multishot_t3')]; // auto-aim build investment
  let weaponOffers2 = 0;
  for (let i = 0; i < samples; i++) {
    const offer = DB.getWeightedShopItems(6, 12, held2, 0);
    weaponOffers2 += offer.filter(it => it.weaponType).length;
  }
  log.push(`scenarioC: with an auto-aim build, ${weaponOffers2} weapon items across ${samples}x6 rolls (want 0)`);

  return { log, wt0, oc0, regressions };
});

await browser.close();
server.close();

for (const l of out.log) console.log('  ' + l);
if (out.regressions.length) {
  console.log(`\nREGRESSIONS (${out.regressions.length}) — buying these silently changed the active weapon / dropped orbs:`);
  for (const r of out.regressions.slice(0, 20)) console.log('  ✗ ' + r);
} else {
  console.log('\nNo regression: orb build survived every single-item purchase.');
}
