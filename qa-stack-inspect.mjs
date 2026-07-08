// Visual proof: equip a Burn item, force it to +5 (upgradeLevel 6), open its inspect
// popup, and screenshot. Chips must read the full stacked value (e.g. "+72% Burn").
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] });

async function shoot(vp, label) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle2', timeout: 30000 });
  const info = await page.evaluate(() => {
    const g = window.__game, DB = window.__ItemDatabase;
    g.startNewGame();
    // a real equip-slot item with a clear scalable stat (ring, x1.15 damage)
    const src = DB.getItemById('damage_t1');
    const clone = JSON.parse(JSON.stringify(src));
    clone.upgradeLevel = 6; // "+5"
    g.playerStats.addItem(clone);
    // equip it and open the inspect popup for its slot
    const eq = g.playerStats.getEquipment();
    let key = null;
    for (const k of Object.keys(eq)) if (eq[k] && eq[k].id === clone.id) key = k;
    // enter shop so the equipment grid + inspect popup are drawable
    g.playerStats.gold = 9999;
    g.enterShop();
    g.inspectedEquipKey = key;
    g.update(1 / 60);
    return { id: clone.id, baseBurn: src.burn, key, equipped: !!key };
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `shots/stack-inspect-${label}.png` });
  await page.close();
  return { info, errs: errs.length };
}

console.log(JSON.stringify(await shoot({ width: 390, height: 844, deviceScaleFactor: 2 }, 'mobile-390')));
console.log(JSON.stringify(await shoot({ width: 1280, height: 800, deviceScaleFactor: 1 }, 'desktop-1280')));
await browser.close();
