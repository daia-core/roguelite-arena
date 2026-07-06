#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the 8-SLOT + UPGRADE rework (v2):
//   • 8 equipment holders: weapon / offhand / head / amulet / torso / legs / feet / ring.
//   • A 2h weapon fills `weapon` AND disables `offhand` (benching any offhand).
//   • Buying an item you already own UPGRADES it (+1 level) instead of adding a copy;
//     aggregation scales each contribution by the level ("amulet +N" = bought N times).
//   • Additive fields scale ×N; multiplicative fields scale ^N; sell value scales ×N.
//   • Aggregation parity: items[] == equipped-nonnull + trinkets (id multiset).
//   • Shop offers exactly 3 items.
//
// TS `private` is compile-time only, so g.playerStats internals are reachable at runtime.
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

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, protocolTimeout: 120000, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 600));

const out = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game' };
  const DB = window.__ItemDatabase;
  const R = {};

  const clone = id => JSON.parse(JSON.stringify(DB.getItemById(id)));
  const eqOf = () => g.playerStats.getEquipment();

  // items[] must equal equipped-nonnull + trinkets (order-independent by id multiset).
  const parity = () => {
    const eq = eqOf();
    const active = ['weapon','offhand','head','amulet','torso','legs','feet','ring']
      .map(k => eq[k]).filter(Boolean).concat(g.playerStats.trinkets);
    const a = active.map(i => i.id).sort().join(',');
    const b = g.playerStats.items.map(i => i.id).sort().join(',');
    return a === b;
  };

  const fresh = () => { g.startNewGame(); g.enterShop(); g.player.gold = 0; };

  // ---- 1. 8-SLOT ROUTING: each gear piece lands in its own holder. ----
  fresh();
  {
    g.playerStats.addItem(clone('shotgun_weapon_t2')); // weapon-1h → weapon
    g.playerStats.addItem(clone('head_iron_helm'));    // head
    g.playerStats.addItem(clone('fourleaf_charm_t3')); // amulet (slot override)
    g.playerStats.addItem(clone('torso_chainmail'));   // torso
    g.playerStats.addItem(clone('legs_greaves'));      // legs
    g.playerStats.addItem(clone('feet_swift_sandals'));// feet
    g.playerStats.addItem(clone('ring_copper_band'));  // ring
    const eq = eqOf();
    R.routeWeapon = eq.weapon && eq.weapon.id === 'shotgun_weapon_t2';
    R.routeHead   = eq.head && eq.head.id === 'head_iron_helm';
    R.routeAmulet = eq.amulet && eq.amulet.id === 'fourleaf_charm_t3';
    R.routeTorso  = eq.torso && eq.torso.id === 'torso_chainmail';
    R.routeLegs   = eq.legs && eq.legs.id === 'legs_greaves';
    R.routeFeet   = eq.feet && eq.feet.id === 'feet_swift_sandals';
    R.routeRing   = eq.ring && eq.ring.id === 'ring_copper_band';
    R.routeParity = parity();
  }

  // ---- 2. NEW GEAR CLASSIFIES CORRECTLY via classifyItemSlot ----
  {
    const cs = window.__classifyItemSlot;
    R.clsHead  = cs(DB.getItemById('head_iron_helm'))    === 'head';
    R.clsTorso = cs(DB.getItemById('torso_chainmail'))   === 'torso';
    R.clsLegs  = cs(DB.getItemById('legs_greaves'))      === 'legs';
    R.clsFeet  = cs(DB.getItemById('feet_swift_sandals'))=== 'feet';
    R.clsRing  = cs(DB.getItemById('ring_copper_band'))  === 'ring';
  }

  // ---- 3. TWO-HAND disables the offhand ----
  fresh();
  {
    g.playerStats.addItem(clone('shield_t3'));       // offhand occupied
    R.thBeforeOffhand = eqOf().offhand && eqOf().offhand.id === 'shield_t3';
    g.playerStats.addItem(clone('melee_spear_t2'));  // 2h weapon
    R.thTwoHand = g.playerStats.hasTwoHandEquipped();
    R.thOffhandDisabled = g.playerStats.isOffhandDisabled();
    R.thOffhandBenched = eqOf().offhand === null
      && g.playerStats.getStash().some(i => i.id === 'shield_t3');
    R.thParity = parity();
  }

  // ---- 4. UPGRADE-ON-DUPLICATE: additive field scales ×N ----
  fresh();
  {
    // torso_padded_vest = +20 maxHealth (additive). Base maxHealth 100.
    const baseMax = g.playerStats.getMaxHealth();
    g.playerStats.addItem(clone('torso_padded_vest'));       // +20 → level 1
    const lvl1 = g.playerStats.getMaxHealth();
    const r1 = g.playerStats.addItem(clone('torso_padded_vest')); // upgrade → level 2
    const lvl2 = g.playerStats.getMaxHealth();
    const r2 = g.playerStats.addItem(clone('torso_padded_vest')); // level 3
    const lvl3 = g.playerStats.getMaxHealth();
    R.upgUpgradedFlag = r1.upgraded === true && r2.upgraded === true;
    R.upgLevel3 = eqOf().torso && eqOf().torso.upgradeLevel === 3;
    R.upgNoDuplicateCopies = g.playerStats.items.filter(i => i.id === 'torso_padded_vest').length === 1;
    R.upgAdditiveScales = (lvl1 - baseMax) === 20 && (lvl2 - baseMax) === 40 && (lvl3 - baseMax) === 60;
  }

  // ---- 5. UPGRADE multiplicative field scales ^N ----
  // NOTE: compare LEVEL-to-LEVEL ratios (not against a no-item base), because equipping
  // a tagged item can flip getSpecializationBonus() and shift the base — that's a real
  // interaction, orthogonal to the upgrade math we're checking here.
  fresh();
  {
    // ring_bloodstone = ×1.18 damage. Each upgrade should multiply damage by 1.18.
    g.playerStats.addItem(clone('ring_bloodstone'));   // level 1
    const d1 = g.playerStats.getDamage();
    g.playerStats.addItem(clone('ring_bloodstone'));   // level 2
    const d2 = g.playerStats.getDamage();
    g.playerStats.addItem(clone('ring_bloodstone'));   // level 3
    const d3 = g.playerStats.getDamage();
    const near = (a, b) => Math.abs(a - b) < 0.01;
    R.upgMultL1 = near(d2 / d1, 1.18);
    R.upgMultL2 = near(d3 / d1, 1.18 * 1.18);
  }

  // ---- 6. UPGRADE == buying N copies (equivalence to old stacking) ----
  fresh();
  {
    // A trinket that stacks: bloodletter_t2 (×1.1 damage; the old damage_t1/Iron Ring
    // is now a ring slot per the 2026-07-06 classification audit, so it no longer
    // stacks as a trinket — use a genuinely-still-trinket damage item here). Buying 3
    // → level 3 → each step ×1.1. (Its lifesteal field doesn't affect getDamage.)
    g.playerStats.addItem(clone('bloodletter_t2'));
    const b1 = g.playerStats.getDamage();
    g.playerStats.addItem(clone('bloodletter_t2'));
    g.playerStats.addItem(clone('bloodletter_t2'));
    const b3 = g.playerStats.getDamage();
    const near = (a, b) => Math.abs(a - b) < 0.01;
    R.trinketUpgrades = g.playerStats.trinkets.length === 1
      && g.playerStats.trinkets[0].upgradeLevel === 3;
    R.trinketStackMath = near(b3 / b1, Math.pow(1.1, 2)); // level 1→3 = ×1.1²
  }

  // ---- 7. SELL value scales with level ----
  fresh();
  {
    // torso_padded_vest cost 12 → sell base floor(12*0.25)=3 (clean integer).
    g.playerStats.addItem(clone('torso_padded_vest'));
    const rec1 = g.playerStats.getSellValue(eqOf().torso);
    g.playerStats.addItem(clone('torso_padded_vest')); // level 2
    const rec2 = g.playerStats.getSellValue(eqOf().torso);
    g.playerStats.addItem(clone('torso_padded_vest')); // level 3
    const rec3 = g.playerStats.getSellValue(eqOf().torso);
    R.sellScales = rec1 === 3 && rec2 === 6 && rec3 === 9;
  }

  // ---- 8. SHOP offers exactly 3 items ----
  fresh();
  {
    g.enterShop();
    // shopItems is populated on shop entry; count non-null.
    const n = (g.shopItems || []).filter(Boolean).length;
    R.shopOffersThree = n === 3;
  }

  // ---- 9. RESET clears the 8-slot loadout ----
  {
    g.startNewGame();
    const eq = eqOf();
    R.resetClears = ['weapon','offhand','head','amulet','torso','legs','feet','ring']
      .every(k => eq[k] === null)
      && g.playerStats.stash.length === 0 && g.playerStats.trinkets.length === 0;
  }

  return R;
});

console.log('\n=== 8-slot + upgrade rework — v2 (shipped frontend/dist) ===');
if (out.fatal) { console.log('FATAL: ' + out.fatal); process.exit(1); }
console.log(JSON.stringify(out, null, 2));
console.log('Console/page errors: ' + errors.length);
if (errors.length) errors.slice(0, 8).forEach(e => console.log('  ' + e));

const checks = [
  'routeWeapon','routeHead','routeAmulet','routeTorso','routeLegs','routeFeet','routeRing','routeParity',
  'clsHead','clsTorso','clsLegs','clsFeet','clsRing',
  'thBeforeOffhand','thTwoHand','thOffhandDisabled','thOffhandBenched','thParity',
  'upgUpgradedFlag','upgLevel3','upgNoDuplicateCopies','upgAdditiveScales',
  'upgMultL1','upgMultL2',
  'trinketUpgrades','trinketStackMath',
  'sellScales',
  'shopOffersThree',
  'resetClears',
];
const passed = checks.filter(k => out[k] === true).length;
const failedKeys = checks.filter(k => out[k] !== true);
console.log(`\n${passed}/${checks.length} checks passed`);
if (failedKeys.length) console.log('FAILED: ' + failedKeys.join(', '));
const ok = passed === checks.length && errors.length === 0;
console.log(`RESULT: ${ok ? 'PASS ✅' : 'FAIL ❌'}`);

await browser.close();
server.close();
process.exit(ok ? 0 : 1);
