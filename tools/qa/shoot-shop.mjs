// Screenshot the shop + pause screens by forcing game state via the __game hook
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../frontend/dist');
const OUT = process.argv[2] || '/tmp/roguelite-shots/shots-shop';
fs.mkdirSync(OUT, { recursive: true });

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

async function shoot(viewport, suffix) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
    defaultViewport: viewport,
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  // #startBtn now opens the class-select screen (PoE skill-tree rework) → g.player null,
  // so the old click screenshotted the wrong screen. startNewGame() = stable QA entry;
  // then enter a combat node so g.player exists before we force the wave→shop.
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
  await new Promise((r) => setTimeout(r, 1000));

  // Force wave end → shop, with gold to spend
  await page.evaluate(() => {
    const g = window.__game;
    g.player.gold = 250;
    g.enemies.length = 0;
    g.waveManager.waveEnemiesRemaining = 0;
    g.waveManager.enemiesAlive = 0;
  });
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT, `shop-${suffix}.png`) });

  await browser.close();
}

await shoot({ width: 1280, height: 720, deviceScaleFactor: 1 }, 'desktop');
await shoot({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, 'portrait');
server.close();
console.log('done →', OUT);
