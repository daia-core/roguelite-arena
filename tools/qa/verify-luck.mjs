// Headless regression test for the Luck stat (build-diversity: high-roller economy):
//  1. getLuck() sums item.luck across owned items and caps at +200%.
//  2. Luck tilts getWeightedShopItems toward higher rarities (statistical: a high-luck
//     shop yields materially more Rare/Legendary items than a no-luck shop).
//  3. The three luck items exist in the database with the expected luck values + tradeoff.
// Serves the shipped local dist and drives it via the window.__game / __ItemDatabase hooks.
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
await page.click('#startBtn');
await new Promise((r) => setTimeout(r, 800));

// --- Test 1: getLuck() sums item.luck and caps at 2.0 ---
const t1 = await page.evaluate(() => {
  const ps = window.__game.playerStats;
  ps.items = [];
  const zero = ps.getLuck();
  ps.items.push({ id: 'rabbits_foot_t1', tags: ['economic'], luck: 0.15 });
  ps.items.push({ id: 'four_leaf_clover_t3', tags: ['economic'], luck: 0.40, damageMultiplier: 0.90 });
  const summed = ps.getLuck(); // 0.55
  // Overstack past the cap
  for (let i = 0; i < 10; i++) ps.items.push({ id: 'cosmic_dice_t4', tags: ['economic'], luck: 0.80 });
  const capped = ps.getLuck(); // 0.55 + 8.0 -> capped at 2.0
  ps.items = [];
  return { zero, summed, capped };
});

// --- Test 2: luck raises shop rarity. Sample many shops at luck 0 vs luck 2, count Rare+Legendary. ---
const t2 = await page.evaluate(() => {
  const DB = window.__ItemDatabase;
  if (!DB) return { hasHook: false };
  const wave = 15; // all tiers available
  const SAMPLES = 400;
  const countTop = (luck) => {
    let top = 0, total = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const items = DB.getWeightedShopItems(4, wave, [], luck);
      for (const it of items) { total++; if (it.tier >= 3) top++; } // Rare(3)/Legendary(4)
    }
    return top / total;
  };
  return { hasHook: true, noLuckTopRate: countTop(0), highLuckTopRate: countTop(2.0) };
});

// --- Test 3: the three luck items exist with expected shape ---
const t3 = await page.evaluate(() => {
  const DB = window.__ItemDatabase;
  const rabbit = DB.getItemById('rabbits_foot_t1');
  const clover = DB.getItemById('four_leaf_clover_t3');
  const dice = DB.getItemById('cosmic_dice_t4');
  return {
    rabbit: rabbit ? { luck: rabbit.luck } : null,
    clover: clover ? { luck: clover.luck, dmg: clover.damageMultiplier } : null,
    dice: dice ? { luck: dice.luck, tier: dice.tier } : null,
  };
});

await browser.close();
server.close();

const result = {
  test1_getLuck: {
    ...t1,
    pass: t1.zero === 0 && Math.abs(t1.summed - 0.55) < 1e-9 && t1.capped === 2.0,
  },
  test2_shopRarity: {
    ...t2,
    // High luck must lift the Rare+Legendary rate meaningfully above the no-luck baseline.
    pass: t2.hasHook && t2.highLuckTopRate > t2.noLuckTopRate * 1.3 && t2.highLuckTopRate > t2.noLuckTopRate,
  },
  test3_items: {
    ...t3,
    pass: t3.rabbit?.luck === 0.15 &&
          t3.clover?.luck === 0.40 && t3.clover?.dmg === 0.90 &&
          t3.dice?.luck === 0.80 && t3.dice?.tier === 4,
  },
  errors,
};
console.log(JSON.stringify(result, null, 2));
const ok = result.test1_getLuck.pass && result.test2_shopRarity.pass && result.test3_items.pass && errors.length === 0;
console.log(ok ? 'ALL PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
