#!/usr/bin/env node
// Mobile screenshots of each melee STYLE mid-swing, so the animated weapon sprite +
// AoE highlight can be eyeballed. For each style we begin a run, place enemies in
// the swing zone, inject a MeleeAttack at ~45% progress (peak of the animation),
// draw the world once, and screenshot at 390×844.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots';
console.log('Building frontend...');
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
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));

const styles = [
  { style: 'arc', weapon: 'brawler_blade_t1' },
  { style: 'thrust', weapon: 'melee_spear_t2' },
  { style: 'slam', weapon: 'melee_hammer_t2' },
  { style: 'spin', weapon: 'hammer_weapon_t3' }, // unstyled swingAoe → spin
];

for (const { style, weapon } of styles) {
  await page.evaluate((weapon) => {
    const g = window.__game;
    const DB = window.__ItemDatabase;
    const MA = window.__MeleeAttack;
    g.beginRun(window.__STARTING_CLASSES[0]);
    const s = g.playerStats;
    const it = DB.getItemById(weapon);
    if (it) s.addItem(it);
    const p = g.player;
    const reach = s.getSwingRange() + s.getSwingAoe();
    // Force the combat state so draw() renders the arena (beginRun lands on the map).
    g.state = 'playing';
    // The live rAF loop calls update() every frame, which would tick our injected
    // swing to death before the screenshot. Freeze update() to a no-op so the swing
    // stays pinned at its peak-animation frame while draw() keeps rendering it.
    g.update = () => {};
    // Inject a swing at peak animation (progress ~0.45 → lifetime ~55% left).
    const arc = s.getMeleeStyle() === 'spin' ? Math.PI * 2 : s.getSwingArc();
    const swing = new MA(p.x, p.y, 0, arc, reach, s.getSwingDamage(), s.getSwingKnockback(), s.getMeleeStyle());
    swing.lifetime = swing.maxLifetime * 0.55;
    g.meleeAttacks.length = 0;
    g.meleeAttacks.push(swing);
    g.draw();
  }, weapon);
  await new Promise(r => setTimeout(r, 120));
  const file = path.join(OUT, `melee-${style}-390.png`);
  await page.screenshot({ path: file });
  console.log('shot:', file);
}

await browser.close();
server.close();
console.log('done');
