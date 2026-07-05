#!/usr/bin/env node
// Equipment inspect-popup QA (Felix's ask: "clicking an equipped item should open a
// tooltip showing its stats, with buttons for unequip or sell"). Drives the REAL shipped
// dist through puppeteer: equips gear, taps a slot to OPEN the inspect popup, then taps the
// popup's Unequip / Sell buttons and asserts state + gold math. Also covers the stash flow
// (tap stash icon → equip, tap stash ✕ → sell) which is unchanged.
//
// Interaction contract under test (8-slot model):
//   • tap an occupied slot         → inspect popup opens (inspectedEquipKey set), no mutation
//   • popup UNEQUIP button         → item benched to stash (slot freed, no gold change), popup closes
//   • popup SELL button            → item sold: removed + gold += recycleValue, popup closes
//   • tap off the buttons          → popup closes, nothing mutated
//   • tap a stash icon             → item equipped
//   • tap a stash sell-✕ badge     → item sold
//   • aggregation parity + maxHealth resync hold after every mutation
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

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, protocolTimeout: 60000, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 600));

const out = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game' };
  const DB = window.__ItemDatabase;
  const canvas = g.canvas;
  const R = {};

  // Item ids: one-hand, two-hand, shield, amulet.
  const SHOTGUN = 'shotgun_weapon_t2';   // weapon-1h → weapon holder
  const SPEAR   = 'melee_spear_t2';      // weapon-2h → weapon holder (disables offhand)
  const SHIELD  = 'shield_t3';           // offhand
  const AMULET  = 'fourleaf_charm_t3';   // amulet

  const get = id => JSON.parse(JSON.stringify(DB.getItemById(id)));

  // Fresh-tap helper: aim input at (x,y), then present a fresh press to the shop tick.
  // We set input state DIRECTLY (mouseX/Y + mouseDown, clearing any held-over
  // pressDisarmed from the screen transition) rather than relying on synthetic
  // MouseEvents — a bare dispatched MouseEvent carries clientX=0 and, more
  // importantly, the real disarm-until-release guard can swallow the first press.
  // This is the same idiom qa-shop-inputguard.mjs uses to simulate a tap.
  const tap = (x, y) => {
    g.input.mouseX = x; g.input.mouseY = y;
    g.input.mouseDown = true;
    g.update(0.016);
    g.input.mouseDown = false; // release, so the next tap is a fresh press
  };
  const center = r => { if (!r) throw new Error('center() got null rect'); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };

  const parity = () => {
    const eq = g.playerStats.getEquipment();
    const active = [eq.weapon, eq.offhand, eq.head, eq.amulet, eq.torso, eq.legs, eq.feet, eq.ring]
      .filter(Boolean).concat(g.playerStats.trinkets);
    const a = active.map(i => i.id).sort().join(',');
    const b = g.playerStats.items.map(i => i.id).sort().join(',');
    return a === b;
  };

  // SETUP: a clean run with a 1-hand weapon + shield + amulet equipped.
  const fresh = () => {
    g.startNewGame();
    g.enterShop();
    g.player.gold = 0;
    g.inspectedEquipKey = null;
    g.playerStats.addItem(get(SHOTGUN)); // weapon
    g.playerStats.addItem(get(SHIELD));  // offhand
    g.playerStats.addItem(get(AMULET));  // amulet
    // Settle the screen-change disarm: update()'s top-of-frame guard runs
    // disarmUntilRelease() on the first tick after a state change (menu→shop),
    // which would swallow the very first tap. Run one throwaway tick with no
    // press so lastUpdateState syncs to 'shop', then release, so the next tap()
    // is seen as a fresh press by updateShop rather than eaten by the guard.
    g.input.mouseDown = false;
    g.update(0.016);
    g.input.mouseDown = false;
    g.draw(); // populate equipSlotRects
  };

  try {
  // 1. OPEN POPUP: tapping an occupied slot opens the inspect popup, mutates nothing.
  fresh();
  {
    const goldBefore = g.player.gold;
    const itemsBefore = g.playerStats.items.length;
    const amu = g.equipSlotRects.find(r => r.key === 'amulet');
    const c = center(amu);
    tap(c.x, c.y);
    R.tapOpensPopup = g.inspectedEquipKey === 'amulet';
    R.openNoMutation = g.player.gold === goldBefore && g.playerStats.items.length === itemsBefore;
    R.openParity = parity();
  }

  // 2. UNEQUIP BUTTON: with the amulet popup open, tap Unequip → benched to stash.
  {
    g.draw(); // popup draw populates inspectUnequipRect / inspectSellRect
    const goldBefore = g.player.gold;
    const c = center(g.inspectUnequipRect);
    tap(c.x, c.y);
    const eq = g.playerStats.getEquipment();
    R.unequipFreesSlot = eq.amulet === null;
    R.unequipToStash = g.playerStats.getStash().some(i => i.id === AMULET);
    R.unequipNoGold = g.player.gold === goldBefore;
    R.unequipClosesPopup = g.inspectedEquipKey === null;
    R.unequipParity = parity();
  }

  // 3. EQUIP FROM STASH: tap the benched amulet icon → re-equips into amulet slot.
  {
    g.draw();
    const amuStash = g.stashItemRects.find(r => g.playerStats.getStash()[r.index] && g.playerStats.getStash()[r.index].id === AMULET);
    if (!amuStash) throw new Error('scenario 3: benched amulet has no stash rect');
    // The sell-✕ badge sits over the icon's TOP-RIGHT corner and is hit-tested first,
    // so aim at the icon's lower-left quadrant (clear of the badge) to exercise the
    // equip path rather than accidentally selling.
    const c = { x: amuStash.x + amuStash.width * 0.25, y: amuStash.y + amuStash.height * 0.75 };
    tap(c.x, c.y);
    const eq = g.playerStats.getEquipment();
    R.equipFromStash = !!(eq.amulet && eq.amulet.id === AMULET);
    R.equipEmptiesStash = !g.playerStats.getStash().some(i => i.id === AMULET);
    R.equipParity = parity();
  }

  // 4. SELL BUTTON: open the shield popup, tap Sell → removed + gold += recycle, gone.
  {
    g.draw();
    const off = g.equipSlotRects.find(r => r.key === 'offhand');
    let c = center(off);
    tap(c.x, c.y); // open shield popup
    R.sellPopupOpened = g.inspectedEquipKey === 'offhand';
    g.draw();
    const occupant = g.playerStats.getEquipment().offhand;
    const recycle = g.playerStats.getRecycleValue(occupant);
    const goldBefore = g.player.gold;
    c = center(g.inspectSellRect);
    tap(c.x, c.y); // sell it
    R.sellRemovesItem = !g.playerStats.items.some(i => i.id === SHIELD);
    R.sellNotEquipped = g.playerStats.getEquipment().offhand === null;
    R.sellNotInStash = !g.playerStats.getStash().some(i => i.id === SHIELD);
    R.sellRefundsGold = g.player.gold === goldBefore + recycle && recycle > 0;
    R.sellClosesPopup = g.inspectedEquipKey === null;
    R.sellParity = parity();
  }

  // 5. TAP-OFF CLOSES: open a popup, tap a corner (off the buttons) → closes, no mutation.
  {
    fresh();
    const amu = g.equipSlotRects.find(r => r.key === 'amulet');
    let c = center(amu);
    tap(c.x, c.y); // open
    g.draw();
    const goldBefore = g.player.gold;
    const itemsBefore = g.playerStats.items.length;
    tap(2, 2); // top-left corner — off every button
    R.tapOffCloses = g.inspectedEquipKey === null;
    R.tapOffNoMutation = g.player.gold === goldBefore && g.playerStats.items.length === itemsBefore;
    R.tapOffParity = parity();
  }

  // 6. UNEQUIP WHEN STASH FULL: fill the stash to cap, open a slot popup, tap Unequip →
  //    it SELLS instead of benching (tap is never a dead no-op).
  {
    fresh();
    const CAP = g.playerStats.constructor.STASH_CAP;
    // Fill the stash to cap with DISTINCT items. Duplicates hit addItem's upgrade
    // path (bump level, never stash), so we feed distinct non-trinket catalog items:
    // each occupies an equip holder and displaces the previous occupant into the
    // stash. Bounded so a non-filling item can never hang the headless evaluate.
    const distinct = DB.getAllItems()
      .filter(it => it.id !== AMULET && it.id !== SHOTGUN && it.id !== SHIELD)
      .filter(it => {
        const s = window.__classifyItemSlot ? window.__classifyItemSlot(it) : null;
        return s && s !== 'trinket'; // trinkets stack in their own pile, never the stash
      });
    for (let k = 0; k < distinct.length && g.playerStats.getStash().length < CAP; k++) {
      g.playerStats.addItem(JSON.parse(JSON.stringify(distinct[k])));
    }
    const stashFull = g.playerStats.getStash().length === CAP;
    g.draw();
    const amu = g.equipSlotRects.find(r => r.key === 'amulet');
    let c = center(amu);
    tap(c.x, c.y); // open amulet popup
    g.draw();
    const occupant = g.playerStats.getEquipment().amulet;
    const recycle = occupant ? g.playerStats.getRecycleValue(occupant) : 0;
    const goldBefore = g.player.gold;
    c = center(g.inspectUnequipRect);
    tap(c.x, c.y); // unequip → must SELL (stash full)
    R.fullStashSetup = stashFull && !!occupant;
    R.fullStashSlotEmptied = g.playerStats.getEquipment().amulet === null;
    R.fullStashStillCap = g.playerStats.getStash().length === CAP; // amulet NOT benched
    R.fullStashSoldForGold = g.player.gold === goldBefore + recycle && recycle > 0;
    R.fullStashParity = parity();
  }

  // 7. EMPTY-SLOT TAP is inert: remove the shield so offhand is empty, tap it → no popup,
  //    nothing mutates.
  {
    fresh();
    g.playerStats.removeItem('shield_t3');
    g.draw();
    const off = g.equipSlotRects.find(r => r.key === 'offhand');
    const itemsBefore = g.playerStats.items.length;
    const goldBefore = g.player.gold;
    const c = center(off);
    tap(c.x, c.y);
    R.emptySlotNoPopup = g.inspectedEquipKey === null;
    R.emptySlotInert = g.playerStats.items.length === itemsBefore && g.player.gold === goldBefore;
    R.emptySlotParity = parity();
  }

  // 8. TWO-HAND handling: equip a spear (2-hand). Open the weapon popup, Unequip → spear
  //    benched, parity holds.
  {
    fresh();
    g.playerStats.removeItem('shotgun_weapon_t2');
    g.playerStats.addItem(get(SPEAR)); // 2-hand → weapon holder, offhand disabled
    R.twoHandEquipped = g.playerStats.hasTwoHandEquipped();
    g.draw();
    const w = g.equipSlotRects.find(r => r.key === 'weapon');
    let c = center(w);
    tap(c.x, c.y); // open weapon popup
    g.draw();
    c = center(g.inspectUnequipRect);
    tap(c.x, c.y); // unequip spear
    const eq = g.playerStats.getEquipment();
    R.twoHandBenched = eq.weapon === null && g.playerStats.getStash().some(i => i.id === SPEAR);
    R.twoHandParity = parity();
  }
  } catch (e) { R._error = String(e && e.message || e); }

  return R;
});

console.log('\n=== Equipment inspect-popup (shipped frontend/dist) ===');
if (out.fatal) { console.log('FATAL: ' + out.fatal); process.exit(1); }
console.log(JSON.stringify(out, null, 2));
console.log('Console/page errors: ' + errors.length);
if (errors.length) errors.slice(0, 8).forEach(e => console.log('  ' + e));

const checks = [
  'tapOpensPopup','openNoMutation','openParity',
  'unequipFreesSlot','unequipToStash','unequipNoGold','unequipClosesPopup','unequipParity',
  'equipFromStash','equipEmptiesStash','equipParity',
  'sellPopupOpened','sellRemovesItem','sellNotEquipped','sellNotInStash','sellRefundsGold','sellClosesPopup','sellParity',
  'tapOffCloses','tapOffNoMutation','tapOffParity',
  'fullStashSetup','fullStashSlotEmptied','fullStashStillCap','fullStashSoldForGold','fullStashParity',
  'emptySlotNoPopup','emptySlotInert','emptySlotParity',
  'twoHandEquipped','twoHandBenched','twoHandParity',
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
