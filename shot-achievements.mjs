// Visual capture: (1) the achievements screen with a mix of earned/disabled/locked rows, and
// (2) a shop card showing a build-lock item's negative stats in RED. Verifies the two new
// surfaces render for a human eyeball, not just the assert-based QA.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots';
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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1000));

// 1) Achievements screen — earn a few, disable one, then open the screen.
await page.evaluate(() => {
  const { AchievementSystem } = window.__ACHIEVEMENTS;
  AchievementSystem.__resetForTest();
  AchievementSystem.checkRun('berserker', 12);   // earns berserker + (wave-neutral nothing at 12? wave15/20 need higher)
  AchievementSystem.checkRun('ranger', 22);      // earns ranger + wave15 + wave20
  AchievementSystem.toggleItemDisabled('ach_rangers_quiver'); // show a DISABLED row
  window.__game.openAchievements();
});
await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: path.join(OUT, 'achievements-390.png') });
console.log('shot: achievements-390.png');

// 2) Shop card with red negatives — force three build-lock items into the shop.
await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  const cls = window.__STARTING_CLASSES.find(c => c.id === 'gunner');
  g.beginRun(cls);
  g.player.gold = 999;
  g.shopItems = ['bl_prism_of_ruin', 'bl_titans_bulwark', 'bl_leechbound_pact'].map(id => DB.getItemById(id));
  g.state = 'shop';
});
await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: path.join(OUT, 'shop-drawbacks-390.png') });
console.log('shot: shop-drawbacks-390.png');

await browser.close(); server.close();
