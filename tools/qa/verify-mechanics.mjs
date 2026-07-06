// Headless regression test for the new economy/build mechanics:
//  1. Banking interest applies once when you reach the shop, respects the cap.
//  2. Interest scales with a banker item (interestBonus).
//  3. Trade-off items apply BOTH their bonus and their penalty.
// Serves the local dist and drives it via the window.__game hook.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.resolve(HERE, '../../frontend/dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const errors = [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));
// Clicking #startBtn now opens the class-select screen (added with the PoE skill-tree
// rework — "starting class sets your entry point"), which leaves g.player null and
// crashes the tests below. startNewGame() is the game's documented stable headless-QA
// entry point: it runs beginRun(Gunner) directly → a live player on the map.
await page.evaluate(() => window.__game.startNewGame());
await new Promise((r) => setTimeout(r, 800));

// --- Test 1: base interest (no banker item), 200 gold at wave 1 → 10% = 20, cap 12 ---
// The node-map layer (added after this test was written) means startNewGame() lands
// in 'map', not 'playing' — so the wave-complete→enterShop path (which grants interest)
// never fires from a fresh start. Drive the map: pick a combat node to enter 'playing',
// THEN empty the wave so it completes and routes to the shop.
const t1 = await page.evaluate(async () => {
  const g = window.__game;
  if (g.state === 'map') {
    const ids = g.mapSystem.reachable();
    const combat = ids.find((id) => {
      const n = g.mapSystem.nodeById(id);
      return n && (n.type === 'battle' || n.type === 'elite' || n.type === 'boss');
    });
    g.onMapNodePicked(combat || ids[0]);
  }
  g.player.gold = 200;
  g.playerStats.items = []; // no banker items
  g.waveManager.currentWave = 1;
  const before = g.player.gold;
  g.enemies.length = 0;
  g.waveManager.waveEnemiesRemaining = 0;
  g.waveManager.enemiesAlive = 0;
  return { before, state: g.state };
});
await new Promise((r) => setTimeout(r, 2600)); // let wave-complete → enterShop fire
const r1 = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, gold: g.player.gold, interest: g.lastInterestGained };
});

// --- Test 2: interest with a banker item + verify trade-off penalty applies ---
const t2 = await page.evaluate(() => {
  const g = window.__game;
  const DB = g.constructor;
  // pull the actual item defs off the running database via a shop reroll pool
  const piggy = window.__ItemDatabase?.getItemById?.('piggy_bank_t2');
  return { hasHook: !!window.__ItemDatabase };
});

// Direct stat-logic check via the exposed playerStats (no hook needed):
const r2 = await page.evaluate(() => {
  const g = window.__game;
  const ps = g.playerStats;
  // Snapshot baseline
  const baseDmg = ps.getDamage();
  const baseArmor = ps.getArmor();
  const baseHP = ps.getMaxHealth();
  // NOTE: getDamage/getArmor/getMaxHealth/getInterestBonus all read a MEMOIZED
  // aggregate that only recomputes on addItem()/invalidateAgg(). Pushing to
  // ps.items directly leaves the cache stale, so invalidate after each push
  // before reading the derived stat — otherwise the penalties look like no-ops.
  // Reckless Charm: +40% dmg, -3 armor
  ps.items.push({ id: 'reckless_charm_t2', name: 'Reckless Charm', tags: ['melee'], damageMultiplier: 1.4, armor: -3 });
  ps.invalidateAgg?.();
  const dmgAfter = ps.getDamage();
  const armorAfter = ps.getArmor();
  // Blood Pact: +50% dmg, -35 max HP
  ps.items.push({ id: 'blood_pact_t3', name: 'Blood Pact', tags: ['melee'], damageMultiplier: 1.5, maxHealthBonus: -35 });
  ps.invalidateAgg?.();
  const hpAfter = ps.getMaxHealth();
  // Piggy Bank interest bonus
  ps.items.push({ id: 'piggy_bank_t2', name: 'Piggy Bank', tags: ['economic'], interestBonus: 0.08 });
  ps.invalidateAgg?.();
  const interestBonus = ps.getInterestBonus();
  return {
    dmgWentUp: dmgAfter > baseDmg,
    armorWentDown: armorAfter === baseArmor - 3,
    hpWentDown: hpAfter === baseHP - 35,
    interestBonus,
  };
});

// --- Test 3: non-stacking items are hidden from the shop once owned ---
// homing_t3 (Seeking Rune) is pure `homing:true` → a 2nd copy does nothing (hasHoming uses
// .some()), so once owned it must never be offered. damage_t1 (Iron Ring) stacks → stays offered.
const r3 = await page.evaluate(() => {
  const DB = window.__ItemDatabase;
  const homing = DB.getItemById('homing_t3');   // non-stacking (boolean flag only)
  const iron = DB.getItemById('damage_t1');      // stacking (damageMultiplier)
  const stacksHoming = DB.itemStacks(homing);
  const stacksIron = DB.itemStacks(iron);
  // Own BOTH; roll a big sample of end-game shops (all tiers unlocked at wave 11).
  const owned = [homing, iron];
  let homingOffered = 0, ironOffered = 0;
  for (let n = 0; n < 400; n++) {
    const shop = DB.getWeightedShopItems(6, 11, owned, 0);
    for (const it of shop) {
      if (it.id === 'homing_t3') homingOffered++;
      if (it.id === 'damage_t1') ironOffered++;
    }
  }
  return { stacksHoming, stacksIron, homingOffered, ironOffered };
});

// --- Test 4: synergies are legible — the card knows the named combo + partner + effect ---
const r4 = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  const storm = DB.getItemById('chain_lightning_t3'); // Storm Essence, half of Storm Surge
  const iron = DB.getItemById('damage_t1');            // not in any duo
  // (a) partner NOT owned → discovery info (teaches the pairing), completes=false
  g.playerStats.items = [];
  const discovery = g.getCardDuoInfo(storm);
  // (b) own the partner (Seeking Rune) → completing the combo now
  g.playerStats.items = [DB.getItemById('homing_t3')];
  const completing = g.getCardDuoInfo(storm);
  // (c) item in no duo → null
  const none = g.getCardDuoInfo(iron);
  return {
    discovery: { name: discovery?.name, partner: discovery?.partner, completes: discovery?.completes, hasEffect: !!discovery?.effect },
    completing: { name: completing?.name, partner: completing?.partner, completes: completing?.completes },
    noneIsNull: none === null,
  };
});

// --- Test 5: player base speed raised to 240 and hard-capped at 480 ---
const r5 = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  g.playerStats.items = [];
  const base = g.playerStats.getSpeed();          // no items → base 240
  // Stack every speed-boosting item several times over so the raw product blows
  // well past the cap, then confirm getSpeed() clamps to exactly maxSpeed.
  const speedItems = DB.getAllItems().filter(i => (i.speedMultiplier ?? 1) > 1);
  g.playerStats.items = [...speedItems, ...speedItems, ...speedItems];
  // getSpeed() reads a MEMOIZED aggregate that only recomputes when the item list
  // changes through addItem()/invalidateAgg(). Assigning .items directly (as this
  // test does) leaves the cache stale, so force a recompute before reading — else
  // getSpeed() returns the base 240 as if no items were equipped.
  g.playerStats.invalidateAgg?.();
  const capped = g.playerStats.getSpeed();
  const maxSpeed = g.playerStats.maxSpeed;
  g.playerStats.items = [];
  return { base, capped, maxSpeed, speedItemCount: speedItems.length };
});

// --- Test 6: UPGRADE-ON-DUPLICATE (Felix's "buy the same amulet again → Amulet +N") ---
// Buying an item you already own must BUMP its upgradeLevel (not add a 2nd copy / swap),
// and level N must contribute exactly as if bought N times: multiplicative stats ^N,
// additive stats ×N. Uses fresh PlayerStats instances so the sheet is known-clean.
const r6 = await page.evaluate(() => {
  const DB = window.__ItemDatabase;
  const PS = window.__game.playerStats.constructor; // PlayerStats
  const clone = (id) => JSON.parse(JSON.stringify(DB.getItemById(id)));
  const countOwned = (p, id) => {
    let n = 0;
    for (const k of ['weapon', 'offhand', 'head', 'amulet', 'torso', 'legs', 'feet', 'ring'])
      if (p.equipment[k]?.id === id) n++;
    n += p.trinkets.filter((i) => i.id === id).length;
    n += p.stash.filter((i) => i.id === id).length;
    return n;
  };

  // (a) Multiplicative scaling + upgrade contract — Hunter's Fang amulet (pure +8% dmg).
  const ps = new PS();
  const base = ps.getDamage();
  const a1 = ps.addItem(clone('am_hunters_fang')); // fresh buy → new instance, level 1
  ps.invalidateAgg?.();
  const d1 = ps.getDamage();
  const a2 = ps.addItem(clone('am_hunters_fang')); // duplicate → upgrade to +1 (level 2)
  ps.invalidateAgg?.();
  const d2 = ps.getDamage();
  const a3 = ps.addItem(clone('am_hunters_fang')); // duplicate → upgrade to +2 (level 3)
  ps.invalidateAgg?.();
  const d3 = ps.getDamage();
  const copies = countOwned(ps, 'am_hunters_fang');

  // (b) Additive scaling — Warding Bead amulet (+2 armor): level 2 must give +4 armor.
  const ps2 = new PS();
  const baseArmor = ps2.getArmor();
  ps2.addItem(clone('am_warding_bead'));
  ps2.invalidateAgg?.();
  const armor1 = ps2.getArmor();
  ps2.addItem(clone('am_warding_bead')); // upgrade → level 2
  ps2.invalidateAgg?.();
  const armor2 = ps2.getArmor();

  return {
    a1: { upgraded: a1.upgraded, level: a1.upgradeLevel },
    a2: { upgraded: a2.upgraded, level: a2.upgradeLevel },
    a3: { upgraded: a3.upgraded, level: a3.upgradeLevel },
    copies, base, d1, d2, d3, baseArmor, armor1, armor2,
  };
});

await page.screenshot({ path: '/tmp/roguelite-mechanics-shop.png' });
await browser.close();
server.close();

const result = {
  test1_baseInterest: {
    ...t1, ...r1,
    expectedInterest: Math.min(10 + 1 * 2, Math.floor(200 * 0.10)), // min(12, 20) = 12
    pass: r1.state === 'shop' && r1.interest === 12 && r1.gold === 212,
  },
  test2_statLogic: { ...r2, pass: r2.dmgWentUp && r2.armorWentDown && r2.hpWentDown && Math.abs(r2.interestBonus - 0.08) < 1e-9 },
  test3_nonStackingExcluded: {
    ...r3,
    // homing is non-stacking (never re-offered when owned); iron stacks (still shows up).
    pass: r3.stacksHoming === false && r3.stacksIron === true && r3.homingOffered === 0 && r3.ironOffered > 0,
  },
  test4_synergyLegible: {
    ...r4,
    pass:
      r4.discovery.name === 'Storm Surge' && r4.discovery.partner === 'Seeking Rune' &&
      r4.discovery.completes === false && r4.discovery.hasEffect === true &&
      r4.completing.name === 'Storm Surge' && r4.completing.completes === true &&
      r4.noneIsNull === true,
  },
  test5_speedCap: {
    ...r5,
    // base is the new 240 floor; stacking many speed items must clamp to maxSpeed (480), not exceed it.
    pass: r5.base === 240 && r5.maxSpeed === 480 && r5.capped === 480 && r5.speedItemCount > 0,
  },
  test6_upgradeOnDuplicate: (() => {
    const MULT = 1.08; // am_hunters_fang damageMultiplier
    // Per-LEVEL ratio isolates the upgrade compounding: level N contributes value^N, so
    // d(N+1)/d(N) === MULT exactly (all constant sheet-wide multipliers cancel). NOTE we do
    // NOT check d1/base — the amulet is 'ranged'-tagged, so the first buy also activates the
    // ranged specialization bonus, which is a one-time step, not part of upgrade scaling.
    const ratioOk = (a, b) => a > 0 && Math.abs(b / a - MULT) < 1e-4;
    return {
      ...r6,
      pass:
        // upgrade CONTRACT: 1st buy is a fresh instance, each duplicate bumps the level
        r6.a1.upgraded === false && r6.a1.level === 1 &&
        r6.a2.upgraded === true && r6.a2.level === 2 &&
        r6.a3.upgraded === true && r6.a3.level === 3 &&
        r6.copies === 1 && // never a 2nd copy — the same instance deepens
        r6.d1 > r6.base && // the item is actually active at level 1
        // multiplicative stat compounds ^N (each upgrade applies the multiplier once more)
        ratioOk(r6.d1, r6.d2) && ratioOk(r6.d2, r6.d3) &&
        // additive stat scales ×N: +2 armor at level 2 = +4 over base
        r6.armor1 === r6.baseArmor + 2 && r6.armor2 === r6.baseArmor + 4,
    };
  })(),
  errors,
};
console.log(JSON.stringify(result, null, 2));
const ok = result.test1_baseInterest.pass && result.test2_statLogic.pass &&
  result.test3_nonStackingExcluded.pass && result.test4_synergyLegible.pass &&
  result.test5_speedCap.pass && result.test6_upgradeOnDuplicate.pass && errors.length === 0;
console.log(ok ? 'ALL PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
