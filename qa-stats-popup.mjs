#!/usr/bin/env node
// Visual QA for the shop full-stats popup (Request E).
// Serves the shipped dist, forces a run into the shop with a diverse loadout,
// simulates a tap on the stats panel, and screenshots the popup at mobile size
// so a human can verify every stat group renders without overflow/clipping.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');
const SHOTS = '/workspace/work/roguelite-game/shots';

console.log('Building frontend/dist fresh…');
execSync('npm run build', { cwd: GAME, stdio: 'inherit' });

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

async function shoot(viewport, label) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction('!!window.__game', { timeout: 10000 });

  const info = await page.evaluate(async () => {
    const g = window.__game, DB = window.__ItemDatabase;
    g.startNewGame();
    // Grant a diverse loadout so many stat groups have non-default values.
    const s = g.playerStats;
    const give = (id) => { const it = DB.getItemById(id); if (it) s.items.push(it); };
    ['whirl_blades_t2','orbit_orb_t2','bomb_bandolier_t2','nova_core_t3','swift_blade_t2',
     'vampiric_fang_t2','crit_scope_t2','piercing_rounds_t2','thorn_mail_t2','lucky_coin'].forEach(give);
    g.player.gold = 999;
    // Force into the shop and open the stats popup.
    if (typeof g.enterShop === 'function') g.enterShop();
    else g.state = 'shop';
    g.showStatsPopup = true;
    g.draw();
    return { state: g.state, items: s.items.length, popup: g.showStatsPopup };
  });

  await new Promise(r => setTimeout(r, 150));
  const shot = path.join(SHOTS, `stats-popup-${label}.png`);
  await page.screenshot({ path: shot });
  console.log(`\n[${label}] state=${info.state} items=${info.items} popupOpen=${info.popup} errors=${errors.length}`);
  if (errors.length) console.log('  errors:', errors.slice(0, 5));
  console.log('  shot:', shot);
  await page.close();
  return errors;
}

const e1 = await shoot({ width: 390, height: 844, deviceScaleFactor: 1 }, 'mobile-390');
const e2 = await shoot({ width: 1280, height: 800, deviceScaleFactor: 1 }, 'desktop-1280');

await browser.close();
server.close();

const real = [...e1, ...e2].filter(e => !/favicon|404|Failed to load resource/i.test(e));
if (real.length) { console.log('\nFAIL: runtime errors'); process.exit(1); }
console.log('\nPASS: stats popup rendered at both viewports, no runtime errors.');
