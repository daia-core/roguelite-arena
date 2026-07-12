// Visual proof: equip a Burn item, force it to +5 (upgradeLevel 6), open its inspect
// popup, and screenshot. Chips must read the full stacked value (e.g. "+72% Burn").
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
const BASE = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });

async function shoot(vp, label) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));
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
server.close();
