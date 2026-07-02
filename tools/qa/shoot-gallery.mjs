// Screenshot the dev sprite gallery: spawns `vite dev`, captures /gallery.html
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/Users/daia/code/daia/workspace/work/roguelite-game/frontend';
const OUT = process.argv[2] || '/tmp/roguelite-shots/gallery.png';
const PORT = 5200 + Math.floor(Math.random() * 400);

// detached → own process group, so we can kill vite AND its children reliably
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: FRONTEND,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
const cleanup = () => { try { process.kill(-vite.pid, 'SIGKILL'); } catch {} };
process.on('exit', cleanup);
process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(1); });
let ready = false;
let baseURL = '';
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('vite dev timeout')), 30000);
  vite.stdout.on('data', (d) => {
    const m = String(d).match(/Local:\s+(http:\/\/\S+?)\//);
    if (m) { baseURL = m[1]; ready = true; clearTimeout(timer); resolve(); }
  });
  vite.stderr.on('data', (d) => process.stderr.write(d));
  vite.on('exit', (c) => { if (!ready) { clearTimeout(timer); reject(new Error('vite exited ' + c)); } });
});

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 1500, height: 1000 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${baseURL}/gallery.html`, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: OUT, fullPage: true });
await browser.close();
cleanup();
console.log('done →', OUT);
process.exit(0);
