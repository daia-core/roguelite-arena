// Headless balance simulator: an auto-playing kite-bot runs the game at
// simulation speed (synchronous update loop, no rendering wait) and logs
// per-wave combat + economy metrics. Data-driven balancing instead of vibes.
//
//   node simulate-balance.mjs [runs=3] [maxWave=15] [outJson]
//
// Needs puppeteer-core resolvable from cwd and a built frontend/dist.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const RUNS = Number(process.argv[2] ?? 3);
const MAX_WAVE = Number(process.argv[3] ?? 15);
const OUT = process.argv[4] ?? '/tmp/roguelite-shots/balance-sim.json';
const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../frontend/dist');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
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

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--mute-audio'],
  defaultViewport: { width: 1280, height: 720 },
});

async function simulateRun(page, maxWave) {
  await page.goto(base, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 900));
  await page.click('#startBtn');
  await new Promise((r) => setTimeout(r, 300));

  await page.evaluate(() => {
    const g = window.__game;
    // Kiting bot: flee weighted enemy threat + dodge enemy shots + avoid walls
    const bot = () => {
      const p = g.player;
      if (!p) return { x: 0, y: 0 };
      let fx = 0, fy = 0;
      for (const e of g.enemies) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 500 * 500) {
          const d = Math.sqrt(d2) || 1;
          const w = 60 / Math.max(d - 30, 25);
          fx += (dx / d) * w; fy += (dy / d) * w;
        }
      }
      for (const pr of g.projectiles) {
        if (pr.fromPlayer) continue;
        const dx = p.x - pr.x, dy = p.y - pr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 180 * 180) {
          const d = Math.sqrt(d2) || 1;
          const w = 120 / Math.max(d, 25);
          fx += (dx / d) * w; fy += (dy / d) * w;
        }
      }
      const W = g.canvas.width, H = g.canvas.height, m = 160;
      if (p.x < m) fx += (m - p.x) * 0.05;
      if (p.x > W - m) fx -= (p.x - (W - m)) * 0.05;
      if (p.y < m) fy += (m - p.y) * 0.05;
      if (p.y > H - m) fy -= (p.y - (H - m)) * 0.05;
      const mag = Math.hypot(fx, fy);
      if (mag < 0.01) {
        return { x: Math.sign(W / 2 - p.x) * 0.4, y: Math.sign(H / 2 - p.y) * 0.4 };
      }
      return { x: fx / mag, y: fy / mag };
    };
    g.input.getMovementVector = bot;
    window.__sim = {
      records: [],
      purchases: [],
      simTime: 0,
      waveStartTime: 0,
      waveStartHp: g.player ? g.player.health : 100,
      waveStartGold: g.player ? g.player.gold : 0,
      lastWave: g.waveManager.currentWave,
    };
  });

  // Advance simulation in chunks (sync loop inside the page)
  let done = false;
  let safety = 400; // chunks
  while (!done && safety-- > 0) {
    done = await page.evaluate((maxWave) => {
      const g = window.__game;
      const S = window.__sim;
      const DT = 1 / 60;
      for (let i = 0; i < 4000; i++) {
        if (g.state === 'gameOver') {
          S.records.push({
            wave: g.waveManager.currentWave, died: true,
            durSec: +(S.simTime - S.waveStartTime).toFixed(1),
            hpStart: +S.waveStartHp.toFixed(0), hpEnd: 0,
            level: g.player?.level ?? 0, gold: g.player?.gold ?? 0,
          });
          return true;
        }
        if (g.state === 'shop') {
          // Record completed wave
          S.records.push({
            wave: S.lastWave, died: false,
            durSec: +(S.simTime - S.waveStartTime).toFixed(1),
            hpStart: +S.waveStartHp.toFixed(0),
            hpEnd: +g.player.health.toFixed(0),
            goldEarned: g.player.gold - S.waveStartGold,
            level: g.player.level, gold: g.player.gold,
          });
          if (S.lastWave >= maxWave) return true;
          // Greedy buy: multiple passes, prefer expensive (usually stronger)
          const wave = g.waveManager.currentWave;
          for (let pass = 0; pass < 3; pass++) {
            const idx = g.shopItems
              .map((it, j) => ({ it, j }))
              .filter((o) => o.it)
              .sort((a, b) => g.playerStats.getItemPrice(b.it, wave) - g.playerStats.getItemPrice(a.it, wave));
            for (const { it, j } of idx) {
              const price = g.playerStats.getItemPrice(it, wave);
              if (g.player.gold >= price) {
                g.player.gold -= price;
                g.playerStats.addItem(it);
                if (it.maxHealthBonus) {
                  const oldMax = g.player.maxHealth;
                  g.player.maxHealth = g.playerStats.getMaxHealth();
                  g.player.health = g.player.maxHealth * (g.player.health / oldMax);
                }
                S.purchases.push({ wave, name: it.name, price });
                g.shopItems[j] = null;
              }
            }
          }
          g.startNextWave();
          S.lastWave = g.waveManager.currentWave;
          S.waveStartTime = S.simTime;
          S.waveStartHp = g.player.health;
          S.waveStartGold = g.player.gold;
        }
        g.update(DT);
        S.simTime += DT;
        if (S.simTime - S.waveStartTime > 180) {
          // Wave stuck >3 sim-minutes: record and bail
          S.records.push({ wave: S.lastWave, stuck: true, durSec: 180, level: g.player.level, gold: g.player.gold });
          return true;
        }
      }
      return false;
    }, maxWave);
  }

  return page.evaluate(() => ({ records: window.__sim.records, purchases: window.__sim.purchases }));
}

const runs = [];
for (let r = 0; r < RUNS; r++) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error(`[run ${r}] pageerror:`, e.message));
  const result = await simulateRun(page, MAX_WAVE);
  runs.push(result);
  const last = result.records.at(-1);
  console.log(`run ${r}: reached wave ${last?.wave}${last?.died ? ' (DIED)' : ''}${last?.stuck ? ' (STUCK)' : ''}`);
  await page.close();
}

await browser.close();
server.close();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(runs, null, 2));

// Aggregate table
console.log('\nwave | dur(s) | hpStart→hpEnd | goldEarned | level');
const byWave = new Map();
for (const run of runs) {
  for (const rec of run.records) {
    if (rec.died || rec.stuck) continue;
    if (!byWave.has(rec.wave)) byWave.set(rec.wave, []);
    byWave.get(rec.wave).push(rec);
  }
}
for (const [wave, recs] of [...byWave.entries()].sort((a, b) => a[0] - b[0])) {
  const avg = (k) => (recs.reduce((s, x) => s + (x[k] ?? 0), 0) / recs.length).toFixed(1);
  console.log(`${String(wave).padStart(4)} | ${avg('durSec').padStart(6)} | ${avg('hpStart').padStart(5)}→${avg('hpEnd').padEnd(5)} | ${avg('goldEarned').padStart(6)} | ${avg('level')}`);
}
console.log(`\nfull data → ${OUT}`);
