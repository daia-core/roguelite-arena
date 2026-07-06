// Force-spawn patterned enemies + boss, screenshot combat
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../frontend/dist');
const OUT = process.argv[2] || '/tmp/roguelite-shots/shots-combat';
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
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
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(base, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1200));
// #startBtn now opens the class-select screen (PoE skill-tree rework) → g.player null,
// so the old click never reached live combat. startNewGame() = stable QA entry; then
// enter a combat node so enemies spawn and g.player exists for the pattern-spawn below.
await page.evaluate(async () => {
  const g = window.__game;
  g.startNewGame();
  await new Promise((r) => setTimeout(r, 300));
  if (g.state === 'map') {
    const ids = g.mapSystem.reachable();
    const combat = ids.find((id) => { const n = g.mapSystem.nodeById(id); return n && (n.type === 'battle' || n.type === 'elite' || n.type === 'boss'); });
    g.onMapNodePicked(combat || ids[0]);
  }
});
await new Promise((r) => setTimeout(r, 800));

await new Promise((r) => setTimeout(r, 2000));
const spawned = await page.evaluate(() => {
  const g = window.__game;
  if (!g.enemies.length) return 'NO ENEMIES YET';
  const EnemyClass = Object.getPrototypeOf(g.enemies[0]).constructor;
  g.enemies.length = 0;
  g.waveManager.waveEnemiesRemaining = 0;
  const specs = [
    ['spinner', 320, 200], ['construct', 960, 200], ['wizard', 320, 520],
    ['spiraler', 960, 520], ['shielder', 200, 360], ['exploder', 1080, 360],
    ['boss_stormking', 640, 180],
  ];
  for (const [type, x, y] of specs) g.enemies.push(new EnemyClass(x, y, type));
  g.player.x = 640; g.player.y = 460;
  return 'spawned ' + g.enemies.length;
});
console.log(spawned);
await new Promise((r) => setTimeout(r, 2600));
await page.screenshot({ path: path.join(OUT, 'combat-patterns.png') });
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: path.join(OUT, 'combat-patterns2.png') });
await browser.close();
server.close();
console.log('done →', OUT);
