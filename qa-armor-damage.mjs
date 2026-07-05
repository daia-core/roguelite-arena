// Armor-damage verification — reproduces Felix's "I barely take damage even early
// with minimal stats" bug. Simulates maxed meta armor (+15) with minimal run stats,
// stands the player in a swarm, and measures HP lost over 10s. Flat armor floored
// every hit to 1 (near-immune); percentage mitigation should now drain real HP.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');
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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));

const res = await page.evaluate(async () => {
  let res_sampleHit = null;
  const g = window.__game;
  if (!g) return { fatal: 'no __game' };
  g.startNewGame();
  g.enemies = [];
  g.projectiles = [];
  g.waveManager.reset();
  g.waveManager.startWave(1);
  g.state = 'playing';

  // Simulate a player who has unlocked maxed Starting Armor (+15) but has NO run items.
  g.player.stats.metaArmor = 15;
  const armorSeen = Math.round(g.player.stats.getArmor());

  const dt = 1 / 60;
  const startHP = g.player.maxHealth;
  const px = g.player.x, py = g.player.y;
  // Neutralize the player's offense so enemies survive to keep contacting (we're
  // measuring INCOMING damage, not clear speed).
  g.player.stats.baseDamage = 0;
  let contacts = 0, rawAmounts = [];
  const origTake = g.player.takeDamage.bind(g.player);
  g.player.takeDamage = (amt, ...rest) => { rawAmounts.push(amt); const d = origTake(amt, ...rest); if (d) contacts++; return d; };

  // Let one wave spawn a swarm.
  for (let i = 0; i < 3 * 60; i++) { if (g.projectiles) g.projectiles.length = 0; g.update(dt); }
  // Now force contact: each frame, hold the player still and glue a handful of alive
  // enemies onto it so the swarm is guaranteed to be in contact range.
  for (let i = 0; i < 10 * 60; i++) {
    g.player.x = px; g.player.y = py;
    if (g.projectiles) g.projectiles.length = 0;
    const alive = (g.enemies || []).filter(e => !e.dead);
    for (const e of alive.slice(0, 8)) { e.x = px + (Math.random()*10-5); e.y = py + (Math.random()*10-5); }
    g.update(dt);
    if (g.player.dead) break;
  }
  const hpLost = Math.round(startHP - g.player.health);
  const sampleHit = rawAmounts.length ? Math.round(rawAmounts.reduce((a,b)=>a+b,0)/rawAmounts.length*10)/10 : null;
  res_sampleHit = sampleHit;
  if (g.draw) g.draw();
  return { armorSeen, startHP: Math.round(startHP), hpLost, contactsThatHurt: contacts, avgRawContactDmg: res_sampleHit, dead: g.player.dead };
});
console.log(JSON.stringify(res, null, 2));
console.log('errors:', errors.length, errors.slice(0, 3));

// With +15 armor and no run stats, standing in a wave-1 swarm for 10s should now cost
// real HP (percentage mitigation). Old flat armor floored hits to 1 → near-zero loss.
const ok = res.hpLost >= 15 && res.contactsThatHurt >= 5 && errors.length === 0;
console.log(ok ? `✅ ARMOR OK — took ${res.hpLost} dmg over 10s at +15 armor (real pressure restored)`
              : `⚠️ CHECK — only ${res.hpLost} HP lost / ${res.contactsThatHurt} hits at +15 armor`);

await browser.close();
server.kill?.('SIGKILL');
process.exit(ok ? 0 : 1);
