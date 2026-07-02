#!/usr/bin/env node
// Roguelite QA harness — adapted from Mission Control harness
// Builds a fresh production bundle, serves frontend/dist (what actually ships),
// drives Chromium, captures errors, and screenshots.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist'); // the deployed Vite build — NOT the stale canvas copy
const OUT = '/workspace/work/roguelite-game/shots/qa';
fs.mkdirSync(OUT, { recursive: true });

// Build fresh so QA always exercises exactly what ships (prevents testing a stale dist).
console.log('Building frontend (npm run build)...');
try {
  execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });
} catch (e) {
  console.error('\n=== Roguelite QA Report ===');
  console.error('BUILD FAILED — cannot QA a build that does not compile.');
  process.exit(1);
}

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

  const file = path.join(ROOT, p);

  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();
const log = [];

page.on('console', m => {
  if (m.type() === 'error') {
    const t = m.text();
    if (!/Failed to load resource/.test(t)) {
      log.push(`[console.error] ${t}`);
    }
  }
});

page.on('pageerror', e => log.push(`[pageerror] ${e.message}`));

page.on('response', r => {
  if (r.status() === 404 && !r.url().includes('favicon.ico')) {
    log.push(`[404] ${r.url()}`);
  }
});

page.on('requestfailed', r => {
  const u = r.url();
  const err = r.failure()?.errorText || '';
  if (u.includes('favicon.ico')) return;
  log.push(`[requestfailed] ${u} — ${err}`);
});

// Load the game
console.log('Loading roguelite game...');
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000)); // Give sprites time to render

// Check if sprites loaded
const spriteCheck = await page.evaluate(() => {
  // Look for canvas element
  const canvas = document.querySelector('#gameCanvas');
  if (!canvas) return { found: false, error: 'No #gameCanvas found' };

  // Check if game initialized
  const ctx = canvas.getContext('2d');
  if (!ctx) return { found: false, error: 'No 2D context' };

  return {
    found: true,
    canvasSize: `${canvas.width}x${canvas.height}`,
    bodyText: document.body.innerText.length
  };
});

// Screenshot the initial state
await page.screenshot({ path: path.join(OUT, 'menu.png'), fullPage: false });

// Try to start game by clicking the start button
try {
  await page.click('button', { timeout: 5000 });
  await new Promise(r => setTimeout(r, 2000)); // Let game start
  await page.screenshot({ path: path.join(OUT, 'gameplay.png'), fullPage: false });
} catch (e) {
  log.push(`[interaction] Could not click start button: ${e.message}`);
}

await browser.close();
server.close();

// Report
console.log('\n=== Roguelite QA Report ===');
console.log('Canvas found:', spriteCheck.found);
if (spriteCheck.canvasSize) console.log('Canvas size:', spriteCheck.canvasSize);
console.log('Body text length:', spriteCheck.bodyText);
console.log('\nErrors:', log.length);
log.forEach(e => console.log('  ', e));
console.log(`\nScreenshots → ${OUT}`);

process.exit(log.length > 0 ? 1 : 0);
