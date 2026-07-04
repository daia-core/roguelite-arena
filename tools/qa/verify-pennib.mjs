// Focused reachability + mechanic check for Pen Nib (Loaded Shot).
// Per cp-b7: verify the item is (a) present, (b) actually reachable through the real
// shop-roll path, and (c) that its mechanic fires — every 10th primary shot is loaded
// (triple damage + full pierce). Serves the freshly-built dist and drives window.__game.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.resolve(HERE, '../../frontend/dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const errors = [];
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
});
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));
await page.click('#startBtn');
await new Promise((r) => setTimeout(r, 800));

const checks = [];
const rec = (name, pass, detail) => checks.push({ name, pass, detail });

// (a) present in catalog, unlocked, correct flag
const present = await page.evaluate(() => {
  const it = window.__ItemDatabase?.getItemById?.('pen_nib_t3');
  return it ? { name: it.name, unlocked: it.unlocked, loadedShot: it.loadedShot, tier: it.tier, cost: it.cost, rarity: it.rarity } : null;
});
rec('present in catalog', !!present, JSON.stringify(present));
rec('unlocked', present?.unlocked === true, `unlocked=${present?.unlocked}`);
rec('loadedShot flag set', present?.loadedShot === true, `loadedShot=${present?.loadedShot}`);

// (b) reachable — appears in the weighted shop pool over many rolls (real obtain path)
const reach = await page.evaluate(() => {
  const DB = window.__ItemDatabase;
  let seen = 0, rolls = 0;
  // roll a big shop many times across a few waves; count Pen Nib appearances
  for (let wave = 1; wave <= 12; wave++) {
    for (let n = 0; n < 40; n++) {
      const items = DB.getWeightedShopItems(6, wave, [], 0);
      rolls++;
      if (items.some((i) => i.id === 'pen_nib_t3')) seen++;
    }
  }
  return { seen, rolls };
});
rec('reachable via shop roll', reach.seen > 0, `appeared in ${reach.seen}/${reach.rolls} shop rolls`);

// (c) mechanic fires — grant Pen Nib, fire primary volleys, confirm every 10th is loaded
const mech = await page.evaluate(async () => {
  const g = window.__game;
  if (g.state === 'map') {
    const ids = g.mapSystem.reachable();
    const combat = ids.find((id) => { const nn = g.mapSystem.nodeById(id); return nn && (nn.type === 'battle' || nn.type === 'elite' || nn.type === 'boss'); });
    g.onMapNodePicked(combat || ids[0]);
  }
  await new Promise((r) => setTimeout(r, 300));
  // grant Pen Nib through the REAL add path (addItem → invalidateAgg), not a raw assign
  const pen = window.__ItemDatabase.getItemById('pen_nib_t3');
  g.playerStats.addItem(pen);
  const hasLoaded = g.playerStats.hasLoadedShot?.();
  // reset shot counter, force shots and capture the loaded volley's damage/pierce.
  g.shotsFired = 0;
  // find a baseline (normal) projectile damage from an unloaded shot, then the 10th.
  const samples = [];
  const baseDmg = () => {
    // read current per-shot damage estimate off playerStats
    return g.playerStats.getDamage ? g.playerStats.getDamage() : null;
  };
  return { hasLoaded, everN: 10, baseDamage: baseDmg() };
});
void mech;

// (c2) drive the actual shot path: spawn an enemy in front, let it auto-fire, and watch
// for a projectile with the loaded signature (radius 13 golden, pierce 999).
const fire = await page.evaluate(async () => {
  const g = window.__game;
  // Deterministic: set to 9 so the NEXT primary volley is the 10th → loaded.
  g.shotsFired = 9;
  const hasLoaded = g.playerStats.hasLoadedShot();   // read in the live loop context
  let loadedSeen = null, ticks = 0;
  // keep an enemy alive in front so shots have a target and the game keeps firing
  const spawnDummy = () => {
    if (g.enemies.length < 3 && g.spawnEnemyAt) {
      try { g.spawnEnemyAt('grunt', g.player.x + 200, g.player.y); } catch {}
    }
  };
  const t0 = Date.now();
  while (Date.now() - t0 < 8000 && !loadedSeen) {
    spawnDummy();
    await new Promise((r) => setTimeout(r, 40));
    ticks++;
    for (const pr of g.projectiles) {
      if (!pr.fromPlayer) continue;
      const isLoaded = pr.radius >= 12 && pr.maxPierceCount >= 100;
      // Capture the loaded shot AND the base damage at that same instant, so the
      // ×3 ratio is measured against the true concurrent base (not a stale sample).
      if (isLoaded && !loadedSeen) {
        loadedSeen = { radius: pr.radius, pierce: pr.maxPierceCount, color: pr.color, damage: pr.damage, baseAtInstant: Math.round(g.playerStats.getDamage()) };
      }
    }
  }
  return { hasLoaded, loadedSeen, ticks, shotsFired: g.shotsFired };
});
const ratio = fire.loadedSeen ? (fire.loadedSeen.damage / fire.loadedSeen.baseAtInstant) : null;
rec('hasLoadedShot() true when held', fire.hasLoaded === true, `hasLoadedShot=${fire.hasLoaded}`);
rec('loaded projectile observed (fat golden, high pierce)', !!fire.loadedSeen, JSON.stringify(fire.loadedSeen));
rec('loaded damage = 3× base at same instant', ratio !== null && ratio > 2.8 && ratio < 3.2, `ratio=${ratio && ratio.toFixed(2)} (loaded=${fire.loadedSeen?.damage}, base=${fire.loadedSeen?.baseAtInstant})`);

rec('no page/console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();

let allPass = true;
console.log('\n=== Pen Nib (Loaded Shot) verification ===');
for (const c of checks) { console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? '  — ' + c.detail : ''}`); if (!c.pass) allPass = false; }
console.log(allPass ? '\nALL CHECKS PASSED\n' : '\nSOME CHECKS FAILED\n');
process.exit(allPass ? 0 : 1);
