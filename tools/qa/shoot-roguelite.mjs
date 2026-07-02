// Screenshot the roguelite game: menu + gameplay frames
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const DIST = '/Users/daia/code/daia/workspace/work/roguelite-game/frontend/dist';
const OUT = process.argv[2] || '/tmp/roguelite-shots/shots';
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox','--disable-gpu','--hide-scrollbars'],
  defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[page error]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));

await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: path.join(OUT, '01-menu.png') });

// Start the game
await page.click('#startBtn').catch(e => console.log('start click failed:', e.message));
await new Promise(r => setTimeout(r, 2500));
await page.screenshot({ path: path.join(OUT, '02-gameplay-early.png') });

// Move around a bit so we see the player animate + enemies converge
const hold = async (key, ms) => { await page.keyboard.down(key); await new Promise(r => setTimeout(r, ms)); await page.keyboard.up(key); };
await hold('d', 900); await hold('w', 700); await hold('a', 600);
await page.screenshot({ path: path.join(OUT, '03-gameplay-moving.png') });

// Let combat happen
await new Promise(r => setTimeout(r, 6000));
await hold('s', 500); await hold('d', 500);
await page.screenshot({ path: path.join(OUT, '04-gameplay-late.png') });

// Try dash + blast for effects
await page.keyboard.press('Space').catch(()=>{});
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: path.join(OUT, '05-abilities.png') });

// Zoomed crop of center for pixel-art inspection
const clip = { x: 1280/2 - 200, y: 720/2 - 150, width: 400, height: 300 };
await page.screenshot({ path: path.join(OUT, '06-center-crop.png'), clip });

await browser.close();
server.close();
console.log('done →', OUT);
