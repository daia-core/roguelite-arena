#!/usr/bin/env node
// Live visual verify for the equipment/slot rework: drives the real build into the
// shop, equips a full loadout (2 weapons, offhand, amulet), stacks trinkets, and
// forces a weapon SWAP so the stash strip is populated — then screenshots mobile +
// desktop and asserts the model's runtime state + no console/page errors.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const SHOTS = path.join(FRONTEND, '..', 'shots');

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
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
fs.mkdirSync(SHOTS, { recursive: true });

const SIZES = [
  { name: 'equip-phone', w: 390, h: 844 },
  { name: 'equip-desktop', w: 1440, h: 900 },
];

let failures = 0;
for (const size of SIZES) {
  await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => window.dispatchEvent(new Event('game-resize')));
  await new Promise(r => setTimeout(r, 250));

  const state = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { fatal: 'no __game' };
    const DB = window.__ItemDatabase;
    if (!DB) return { fatal: 'no __ItemDatabase' };
    g.startNewGame();
    const by = (id) => DB.getItemById(id);
    // Two one-hand weapons (shotgun + orbital) → weaponA + weaponB.
    const shotgun = DB.getUnlockedItems().find(i => i.weaponType === 'shotgun');
    const orbital = DB.getUnlockedItems().find(i => i.weaponType === 'orbital');
    const laser   = DB.getUnlockedItems().find(i => i.weaponType === 'laser'); // 2h, used to force a swap later? no—keep 1h build
    const shieldItem = DB.getUnlockedItems().find(i => i.shield);
    const amuletItem = DB.getUnlockedItems().find(i => i.slot === 'amulet');
    const trinketItems = DB.getUnlockedItems().filter(i =>
      !i.weaponType && !i.shield && i.slot !== 'amulet').slice(0, 5);

    if (shotgun) g.playerStats.addItem(shotgun);
    if (orbital) g.playerStats.addItem(orbital);
    if (shieldItem) g.playerStats.addItem(shieldItem);
    if (amuletItem) g.playerStats.addItem(amuletItem);
    trinketItems.forEach(t => { g.playerStats.addItem(t); g.playerStats.addItem(t); }); // stack some
    // Force a weapon SWAP so the stash gets an item: buy a third 1h weapon.
    const thirdWeapon = DB.getUnlockedItems().filter(i => i.weaponType && i.weaponType !== 'melee' && i.weaponType !== 'laser')[2]
      || DB.getUnlockedItems().find(i => i.weaponType === 'shotgun');
    let swapRes = null;
    if (thirdWeapon) swapRes = g.playerStats.addItem(thirdWeapon);

    g.enterShop();
    if (g.shopItems.filter(Boolean).length < 6) {
      g.shopItems = DB.getWeightedShopItems(6, 5, g.playerStats.items, 1).slice(0, 6);
    }
    g.state = 'shop';
    const eq = g.playerStats.getEquipment();
    return {
      weaponA: eq.weaponA?.name ?? null,
      weaponB: eq.weaponB?.name ?? null,
      offhand: eq.offhand?.name ?? null,
      amulet: eq.amulet?.name ?? null,
      trinketCount: g.playerStats.trinkets.length,
      stashCount: g.playerStats.getStash().length,
      twoHand: g.playerStats.hasTwoHandEquipped(),
      activeCount: g.playerStats.items.length,
    };
  });

  if (state.fatal) { console.log(`FATAL ${size.name}: ${state.fatal}`); failures++; continue; }
  await new Promise(r => setTimeout(r, 200));
  const shot = path.join(SHOTS, `${size.name}.png`);
  await page.screenshot({ path: shot });
  const okStash = state.stashCount >= 1;
  const okSlots = state.weaponA && state.offhand;
  if (!okStash || !okSlots) failures++;
  console.log(`${(okStash && okSlots) ? 'PASS' : 'FAIL'}  ${size.name}: A=${state.weaponA} B=${state.weaponB} off=${state.offhand} amu=${state.amulet} trinkets=${state.trinketCount} stash=${state.stashCount} active=${state.activeCount} → ${shot}`);
}

if (errors.length) { console.log('\nConsole/page errors:'); errors.slice(0,10).forEach(e => console.log('  ' + e)); }
console.log(`\n${failures === 0 && errors.length === 0 ? '✅ VISUAL VERIFY PASS' : '❌ ' + failures + ' failures' + (errors.length ? ' + ' + errors.length + ' errors' : '')}`);
await browser.close();
server.close();
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
