// Targeted visual check on the LIVE build: own the Storm Surge partner (Seeking Rune),
// force a shop whose first card is Storm Essence, and screenshot to confirm the synergy
// card renders the named combo ("⚡ STORM SURGE") + its effect text (not a vague badge).
// Also confirms the owned non-stacking item (Seeking Rune) is NOT in a freshly-rolled shop.
import puppeteer from 'puppeteer-core';

const URL = 'https://roguelite-game-blush.vercel.app/';
const errors = [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));
await page.click('#startBtn');
await new Promise((r) => setTimeout(r, 800));

const info = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  g.player.gold = 999;
  g.waveManager.currentWave = 5;
  // Own the partner so buying Storm Essence would COMPLETE Storm Surge.
  g.playerStats.items = [DB.getItemById('homing_t3')]; // Seeking Rune (non-stacking)
  // Enter shop, then force a curated set of cards to exercise the synergy UI.
  g.enterShop?.();
  g.state = 'shop';
  g.shopItems = [
    DB.getItemById('chain_lightning_t3'), // Storm Essence → completes Storm Surge
    DB.getItemById('crit_chance_t3'),      // Assassin's Mark → teaches a pairing (🔗)
    DB.getItemById('damage_t1'),           // Iron Ring → plain
    DB.getItemById('armor_t2'),
    DB.getItemById('multishot_t3'),
    DB.getItemById('lifesteal_t3'),
  ];
  g.lockedShopItems = new Set();
  // Sanity: a normally-generated shop must NOT contain the owned non-stacking item.
  let homingSeen = 0;
  for (let n = 0; n < 100; n++) {
    if (DB.getWeightedShopItems(6, 11, g.playerStats.items, 0).some((i) => i.id === 'homing_t3')) homingSeen++;
  }
  return { homingSeenInRolledShops: homingSeen, cards: g.shopItems.map((i) => i.name) };
});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: '/tmp/roguelite-synergy-shop.png' });
await browser.close();
console.log(JSON.stringify({ ...info, errors }, null, 2));
