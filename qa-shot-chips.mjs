#!/usr/bin/env node
// Screenshot the shop screen (desktop + portrait) to eyeball the new category chips
// (weapon/passive/active) on item cards and confirm no overlap with name/description.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = '/workspace/work/roguelite-game/frontend/dist';
const OUT = '/tmp/roguelite-shots';
fs.mkdirSync(OUT, { recursive: true });

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

async function shoot(viewport, suffix) {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--hide-scrollbars'], defaultViewport: viewport });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    const g = window.__game, DB = window.__ItemDatabase;
    g.startNewGame();
    g.player.gold = 300;
    // Curate a mix that exercises weapon / passive / active chips + multi-kind.
    const ids = ['whirlwind_cleaver_t2','executioners_maul_t3','ring_of_widening_t1','vampiric_edge_t2','bomb_bandolier_t2','nova_core_t3'];
    g.shopItems = ids.map(id => DB.getItemById(id)).filter(Boolean).slice(0, 4);
    g.state = 'shop';
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, `chips-${suffix}.png`) });
  await browser.close();
}

await shoot({ width: 1280, height: 720, deviceScaleFactor: 1 }, 'desktop');
await shoot({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, 'portrait');
server.close();
console.log('done →', OUT);
