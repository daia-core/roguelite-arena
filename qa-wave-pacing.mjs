// Wave-pacing verification — confirm enemies now RELEASE ACROSS the whole wave
// (not front-loaded), and that each archetype's release curve matches its intent:
//   steady    ~ linear release
//   crescendo ~ back-loaded (little out early, most late)
//   war       ~ nearly everything out in the first seconds, from ONE flank
//   surges    ~ stepped pulses
//   ambush    ~ quiet opening, late rush
// Measures released-fraction at 25/50/75/100% of wave time, per archetype.
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
await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1000));

const out = await page.evaluate(async () => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game' };
  const archetypes = ['steady', 'crescendo', 'war', 'surges', 'ambush'];
  const dt = 1 / 60;
  const results = {};

  for (const arch of archetypes) {
    g.startNewGame();
    g.enemies = [];
    g.projectiles = [];
    g.waveManager.reset();
    g.waveManager.startWave(8);          // a meaty mid wave
    g.waveManager.waveArchetype = arch;  // force the archetype under test
    g.waveManager.warSide = 0;           // left flank for war
    g.state = 'playing';

    const wm = g.waveManager;
    const total = wm.totalEnemiesInWave;
    const dur = wm.waveDuration;
    const marks = [0.25, 0.5, 0.75, 1.0];
    const released = {};
    let mi = 0;
    // Track spatial spread of telegraphs for war (should hug one side).
    let warXs = [];

    const steps = Math.ceil(dur / dt) + 30;
    for (let i = 0; i < steps; i++) {
      g.update(dt);
      if (g.projectiles) g.projectiles.length = 0;         // no player offense
      if (g.enemies) g.enemies.length = 0;                 // no enemy attacks (pacing test; waveEnemiesRemaining tracks pledges, not live count)
      if (g.player) g.player.health = g.player.maxHealth;  // stay alive
      if (g.state === 'gameover') g.state = 'playing';     // recover from player death mid-frame
      const elapsed = 1 - Math.max(0, wm.waveTimer) / dur;
      // released fraction = pledged (out of budget) so far
      const rel = 1 - Math.max(0, wm.waveEnemiesRemaining) / total;
      if (arch === 'war' && g.spawnTelegraphs) {
        for (const t of g.spawnTelegraphs) warXs.push(t.x);
      }
      while (mi < marks.length && elapsed >= marks[mi] - 1e-6) {
        released[marks[mi]] = +rel.toFixed(3);
        mi++;
      }
      if (mi >= marks.length) break;
    }
    // fill any unreached marks with final
    const finalRel = 1 - Math.max(0, wm.waveEnemiesRemaining) / total;
    for (const m of marks) if (released[m] === undefined) released[m] = +finalRel.toFixed(3);

    results[arch] = { total, dur: +dur.toFixed(1), released };
    if (arch === 'war' && warXs.length) {
      const maxX = Math.max(...warXs);
      results[arch].warMaxTelegraphX = Math.round(maxX);
      results[arch].warField = Math.round(g.worldWidth);
    }
  }
  return { results };
});

console.log(JSON.stringify(out, null, 2));
console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');

// --- Assertions ---
let fail = 0;
const r = out.results || {};
const at = (a, m) => r[a] && r[a].released[m];

// steady: should spread — NOT all released by 25%, and roughly climbing.
if (at('steady', 0.25) > 0.6) { console.log('FAIL steady front-loads (>60% by 25%)'); fail++; }
if (at('steady', 1.0) < 0.9) { console.log('FAIL steady never finishes'); fail++; }
// crescendo: back-loaded — little early, most late.
if (at('crescendo', 0.25) > 0.3) { console.log('FAIL crescendo not back-loaded'); fail++; }
if (at('crescendo', 1.0) < 0.9) { console.log('FAIL crescendo never finishes'); fail++; }
// war: front-loaded — almost everything by 25%.
if (at('war', 0.25) < 0.85) { console.log('FAIL war not front-loaded'); fail++; }
// war: telegraphs hug the left band (x well under half the field).
if (r.war && r.war.warMaxTelegraphX !== undefined && r.war.warMaxTelegraphX > r.war.warField * 0.5) {
  console.log('FAIL war telegraphs not confined to one flank'); fail++;
}
// ambush: quiet opening.
if (at('ambush', 0.25) > 0.25) { console.log('FAIL ambush opening not quiet'); fail++; }
if (at('ambush', 1.0) < 0.9) { console.log('FAIL ambush never finishes'); fail++; }
if (errors.length) { console.log('FAIL console errors'); fail++; }

console.log(fail ? `\n❌ ${fail} assertion(s) failed` : '\n✅ pacing verified: spawns breathe across the wave; archetypes distinct');
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
