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

  // Class-select screen (added 2026-07-05): the start button now lands in
  // 'classselect', not 'map'/'playing', and no player exists until a class is
  // picked. Pick the first starting class (gunner) so a run — and g.player —
  // actually exists before the kite-bot wires itself in.
  await page.evaluate(() => {
    const g = window.__game;
    if (g.state === 'classselect' && window.__STARTING_CLASSES) {
      g.beginRun(window.__STARTING_CLASSES[0]);
    }
  });
  await new Promise((r) => setTimeout(r, 100));

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
        if (g.state === 'gameover') {
          S.records.push({
            wave: g.waveManager.currentWave, died: true,
            durSec: +(S.simTime - S.waveStartTime).toFixed(1),
            hpStart: +S.waveStartHp.toFixed(0), hpEnd: 0,
            level: g.player?.level ?? 0, gold: g.player?.gold ?? 0,
          });
          return true;
        }
        // Node-map layer (added after this bot was first written): a run no longer
        // drops straight into combat — startNewGame() lands in 'map' and every
        // wave is gated behind picking a node. Drive it exactly the way the real
        // state machine does: pick a node via onMapNodePicked (private, but reachable
        // at runtime — TS `private` is compile-time only and vite doesn't mangle).
        // Prefer combat nodes (battle/elite/boss) so we keep measuring fights; fall
        // back to any reachable node if only non-combat ones are offered. When the
        // pick lands us in combat, (re)set the per-wave bookkeeping here — this is
        // the single point where a new fight actually begins.
        // Safety: if a run ever lands back on class-select, re-pick immediately.
        if (g.state === 'classselect') {
          if (window.__STARTING_CLASSES) g.beginRun(window.__STARTING_CLASSES[0]);
          continue;
        }
        // Level-up choice screen (reworked 2026-07-05 to a queued 1-of-3 offer):
        // the bot has no strategy, so just take the first offered card and keep
        // fighting. grantLevelupItem is compile-time-private but callable at
        // runtime; it fires the same duo/transform/HP side effects a real pick does.
        if (g.state === 'levelup') {
          if (Array.isArray(g.levelupChoices) && g.levelupChoices.length > 0) {
            g.grantLevelupItem(g.levelupChoices[0]);
          } else if (g.state === 'levelup') {
            g.state = 'playing';
          }
          continue;
        }
        if (g.state === 'map') {
          const ids = g.mapSystem.reachable();
          if (!ids || ids.length === 0) { g.startNextWave(); continue; }
          const combat = ids.find((id) => {
            const n = g.mapSystem.nodeById(id);
            return n && (n.type === 'battle' || n.type === 'elite' || n.type === 'boss');
          });
          g.onMapNodePicked(combat || ids[0]);
          if (g.state === 'playing') {
            S.lastWave = g.waveManager.currentWave;
            S.waveStartTime = S.simTime;
            S.waveStartHp = g.player.health;
            S.waveStartGold = g.player.gold;
          }
          continue;
        }
        // Reward screen (elite/boss/treasure spoils): replicate the real "skip"
        // click inline. updateReward()'s skip path fires the reward's `then`
        // callback and clears reward state — and for VICTORY SPOILS `then` is
        // enterShop(), so we must run it rather than forcing state='map' (which
        // would silently skip the shop and strand the run). Skip (grant nothing)
        // keeps the sim's economy honest — free artifacts would skew balance data.
        if (g.state === 'reward') {
          const then = g.rewardThen;
          g.rewardChoices = [];
          g.rewardThen = null;
          g.rewardSkippable = false;
          if (typeof then === 'function') then();
          else g.state = 'map';
          continue;
        }
        // Event/rest never gate the shop — the game returns to 'map' after them.
        // Auto-resolve so the bot never stalls on a UI click it can't make.
        if (g.state === 'event' || g.state === 'rest') {
          g.state = 'map';
          continue;
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
          // Real "Continue" button routes back through the node-map (toMapFromShop),
          // NOT straight into the next wave. Calling startNextWave() here bypassed
          // the map, left mapSystem on a consumed node, and stalled the run — the
          // wave-3–6 STUCK. Hand back to the map; the map handler picks the next
          // combat node and resets per-wave bookkeeping.
          g.toMapFromShop();
        }
        g.update(DT);
        S.simTime += DT;
        if (S.simTime - S.waveStartTime > 180) {
          // Wave stuck >3 sim-minutes: record and bail. Capture WHY — which state
          // and (if we're stuck on the map) what nodes are reachable — so a stall
          // is diagnosable instead of a silent "STUCK".
          let reach = null;
          try { reach = g.mapSystem?.reachable?.() ?? null; } catch { reach = 'err'; }
          S.records.push({
            wave: S.lastWave, stuck: true, durSec: 180,
            state: g.state, reachable: reach,
            enemies: g.enemies?.length ?? -1,
            level: g.player?.level ?? 0, gold: g.player?.gold ?? 0,
          });
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
  const why = last?.stuck ? ` (STUCK @ state='${last.state}' enemies=${last.enemies} reachable=${JSON.stringify(last.reachable)})` : (last?.died ? ' (DIED)' : '');
  console.log(`run ${r}: reached wave ${last?.wave}${why}`);
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
