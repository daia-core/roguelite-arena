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
    const clone = (it) => it ? JSON.parse(JSON.stringify(it)) : null;
    // Fill an 8-slot loadout: 1 weapon, offhand, head, amulet, torso, legs, feet, ring.
    const pick = (fn) => DB.getUnlockedItems().find(fn);
    const weapon = pick(i => i.weaponType === 'shotgun');
    const shieldItem = pick(i => i.shield);
    const head   = pick(i => i.slot === 'head');
    const amulet = pick(i => i.slot === 'amulet');
    const torso  = pick(i => i.slot === 'torso');
    const legs   = pick(i => i.slot === 'legs');
    const feet   = pick(i => i.slot === 'feet');
    const ring   = pick(i => i.slot === 'ring');
    [weapon, shieldItem, head, amulet, torso, legs, feet, ring].forEach(it => {
      if (it) g.playerStats.addItem(clone(it));
    });
    // Upgrade the ring twice so an upgrade badge (+2) is visible in the strip.
    if (ring) { g.playerStats.addItem(clone(ring)); g.playerStats.addItem(clone(ring)); }
    // A couple of trinkets for the stash/trinket row.
    const trinketItems = DB.getUnlockedItems().filter(i =>
      !i.weaponType && !i.shield && !i.slot).slice(0, 2);
    trinketItems.forEach(t => g.playerStats.addItem(clone(t)));

    g.enterShop();
    g.state = 'shop';
    const eq = g.playerStats.getEquipment();
    return {
      weapon: eq.weapon?.name ?? null,
      offhand: eq.offhand?.name ?? null,
      head: eq.head?.name ?? null,
      amulet: eq.amulet?.name ?? null,
      torso: eq.torso?.name ?? null,
      legs: eq.legs?.name ?? null,
      feet: eq.feet?.name ?? null,
      ring: eq.ring?.name ?? null,
      ringLevel: eq.ring?.upgradeLevel ?? null,
      trinketCount: g.playerStats.trinkets.length,
      shopCount: (g.shopItems || []).filter(Boolean).length,
      twoHand: g.playerStats.hasTwoHandEquipped(),
      activeCount: g.playerStats.items.length,
    };
  });

  if (state.fatal) { console.log(`FATAL ${size.name}: ${state.fatal}`); failures++; continue; }
  await new Promise(r => setTimeout(r, 200));
  const shot = path.join(SHOTS, `${size.name}.png`);
  await page.screenshot({ path: shot });
  const okSlots = state.weapon && state.offhand && state.head && state.amulet
    && state.torso && state.legs && state.feet && state.ring;
  const okShop = state.shopCount === 3;
  const okBadge = state.ringLevel === 3;
  const ok = okSlots && okShop && okBadge;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${size.name}: wpn=${state.weapon} off=${state.offhand} head=${state.head} amu=${state.amulet} torso=${state.torso} legs=${state.legs} feet=${state.feet} ring=${state.ring}(L${state.ringLevel}) trinkets=${state.trinketCount} shop=${state.shopCount} active=${state.activeCount} → ${shot}`);
}

if (errors.length) { console.log('\nConsole/page errors:'); errors.slice(0,10).forEach(e => console.log('  ' + e)); }
console.log(`\n${failures === 0 && errors.length === 0 ? '✅ VISUAL VERIFY PASS' : '❌ ' + failures + ' failures' + (errors.length ? ' + ' + errors.length + ' errors' : '')}`);
await browser.close();
server.close();
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
