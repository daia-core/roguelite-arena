#!/usr/bin/env node
// Mobile-first visual QA for the COMBOS guide overlay.
// Serves the SHIPPED dist, drives it at a phone viewport (390x844), enters the
// shop with one duo active + one duo one-away (so both overlay sections render),
// opens the overlay, and screenshots shop + overlay. LOOK at the output.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = '/workspace/work/roguelite-game/frontend/dist';
const SHOTS = '/workspace/work/roguelite-game/shots';
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

async function shoot(w, h, tag) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => {
    const g = window.__game, DB = window.__ItemDatabase;
    g.startNewGame();
    const s = g.playerStats;
    const give = (id) => { const it = DB.getItemById(id); if (it) s.items.push(it); };
    // One ACTIVE duo (storm_surge) + one ONE-AWAY duo (assassins_creed: own crit_chance_t3 only)
    give('chain_lightning_t3'); give('homing_t3');
    give('crit_chance_t3');
    give('lifesteal_t3'); // opens another one-away (vampiric_fury needs damage_t3)
    g.player.gold = 500;
    g.enterShop();
    g.showCombosOverlay = true;
  });
  await new Promise(r => setTimeout(r, 400));
  const file = path.join(SHOTS, `synergy-${tag}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
  await page.close();
}

// Phone portrait (Felix's device) + desktop for comparison
await shoot(390, 844, 'mobile');
await shoot(1440, 900, 'desktop');

await browser.close();
server.close();
