#!/usr/bin/env node
// Pixel art QA — screenshot sprites at 4x zoom to verify hue-shifting and asymmetry
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = '/workspace/canvas/roguelite';
const OUT = '/workspace/work/roguelite-game/shots/pixel-art';
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html':'text/html',
  '.js':'text/javascript',
  '.json':'application/json',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.mp3':'audio/mpeg',
  '.css':'text/css'
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';

  const CANVAS_ROOT = '/workspace/canvas';
  const file = p.startsWith('/canvas/')
    ? path.join(CANVAS_ROOT, p.replace(/^\/canvas\//, ''))
    : path.join(ROOT, p);

  if ((!file.startsWith(ROOT) && !file.startsWith(CANVAS_ROOT)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }

  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise(r => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;
console.log('serving', ROOT, 'on', base);

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
  defaultViewport: { width: 800, height: 600 },
});

const page = await browser.newPage();

// Load the game
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));

// Start game
try {
  await page.click('button');
  await new Promise(r => setTimeout(r, 3000)); // Let sprites spawn
} catch (e) {
  console.log('Could not start game:', e.message);
}

// Extract sprites from canvas and analyze
const spriteAnalysis = await page.evaluate(() => {
  const canvas = document.querySelector('#gameCanvas');
  if (!canvas) return { error: 'No canvas found' };

  const ctx = canvas.getContext('2d');

  // Sample player position (center) and enemy positions
  const w = canvas.width;
  const h = canvas.height;

  // Get image data from center (where player usually is)
  const centerX = Math.floor(w / 2);
  const centerY = Math.floor(h / 2);

  // Sample a 200x200 region around center
  const size = 200;
  const imageData = ctx.getImageData(centerX - size/2, centerY - size/2, size, size);

  // Count unique colors
  const colors = new Set();
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i+1];
    const b = imageData.data[i+2];
    const a = imageData.data[i+3];
    if (a > 0) { // Only non-transparent pixels
      colors.add(`rgb(${r},${g},${b})`);
    }
  }

  return {
    uniqueColors: colors.size,
    sampleColors: Array.from(colors).slice(0, 15), // First 15 colors as sample
    canvasSize: `${w}x${h}`
  };
});

console.log('\n=== Pixel Art Analysis ===');
console.log('Canvas size:', spriteAnalysis.canvasSize);
console.log('Unique colors in center region:', spriteAnalysis.uniqueColors);
console.log('Sample colors:', spriteAnalysis.sampleColors?.join(', '));

// Take a zoomed screenshot of the center (where player is)
await page.evaluate(() => {
  const canvas = document.querySelector('#gameCanvas');
  // Pause game to freeze sprites
  if (window.gameInstance && window.gameInstance.paused !== undefined) {
    window.gameInstance.paused = true;
  }
});

// Full gameplay screenshot
await page.screenshot({ path: path.join(OUT, 'gameplay-full.png'), fullPage: false });

// Zoom in on center (player area) - take screenshot of specific region
const centerClip = await page.evaluate(() => {
  const canvas = document.querySelector('#gameCanvas');
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - 200,
    y: rect.top + rect.height / 2 - 200,
    width: 400,
    height: 400
  };
});

await page.screenshot({
  path: path.join(OUT, 'sprites-zoomed.png'),
  clip: centerClip
});

await browser.close();
server.close();

console.log(`\nScreenshots → ${OUT}`);
console.log('  - gameplay-full.png (full game view)');
console.log('  - sprites-zoomed.png (400x400 center region with player/enemies)');
