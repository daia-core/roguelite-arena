// qa-wave-projectile-clear.mjs — prove leftover projectiles despawn at wave start
// while pickups (xpOrbs + coins) survive the transition.
import puppeteer from 'puppeteer-core';

const base = 'http://localhost:4173/';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game handle' };
  const out = {};

  g.startNewGame();
  g.waveManager.reset();
  g.waveManager.startWave(1);
  g.state = 'playing';

  // Seed in-flight projectiles via the real pool path.
  for (let i = 0; i < 8; i++) {
    const p = g.projectilePool.acquire();
    p.init(100 + i, 100, 0, 5, 300, true, false);
    g.projectiles.push(p);
  }
  // Seed pickups that MUST survive the wave transition.
  g.xpOrbs.push(new (window.__XPOrb || Object)(200, 200, 3));
  const preXp = g.xpOrbs.length;
  const preCoins = g.coins.length;
  out.projectilesBefore = g.projectiles.length;
  out.xpBefore = preXp;
  out.poolBefore = g.projectilePool.getSize();

  // Advance to the next wave (the single funnel all wave starts go through).
  g.startNextWave();

  out.projectilesAfter = g.projectiles.length;         // expect 0
  out.xpAfter = g.xpOrbs.length;                        // expect unchanged
  out.coinsAfter = g.coins.length;                      // expect unchanged
  out.poolAfter = g.projectilePool.getSize();           // expect grew (released back)
  out.stillPlaying = g.state === 'playing';

  // A fresh wave can still spawn projectiles normally (nothing broke the pool).
  const p2 = g.projectilePool.acquire();
  p2.init(300, 300, 0, 5, 300, true, false);
  g.projectiles.push(p2);
  out.canSpawnAfter = g.projectiles.length === 1;

  return { out, preXp, preCoins };
});

console.log('=== Wave projectile clear ===');
console.log(JSON.stringify(result, null, 2));
console.log('console/page errors:', errors.length);
if (errors.length) console.log(errors.slice(0, 5));

const o = result.out || {};
const pass = result && !result.fatal &&
  o.projectilesBefore === 8 &&
  o.projectilesAfter === 0 &&
  o.xpAfter === result.preXp && o.xpAfter > 0 &&
  o.coinsAfter === result.preCoins &&
  o.poolAfter >= o.poolBefore + 8 &&
  o.canSpawnAfter === true &&
  o.stillPlaying === true &&
  errors.length === 0;
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
await browser.close();
process.exit(pass ? 0 : 1);
