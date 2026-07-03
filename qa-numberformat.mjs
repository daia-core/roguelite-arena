#!/usr/bin/env node
// Verify Felix's 9:05 report: (1) huge damage numbers (e.g. 515,000,000) must
// render abbreviated ("515M"), not as a giant raw digit string; (2) the portrait
// HUD must clear the status bar (no top clipping). Runs against a freshly-built
// dist, drives the REAL game (exercises the real formatShort via createDamageNumber),
// asserts the abbreviations + that every rendered glyph exists in the pixel font,
// and screenshots portrait + landscape for a top-clearance eyeball.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');
const SHOTS = '/workspace/work/roguelite-game/shots';
console.log('Building frontend/dist fresh…');
execSync('npm run build', { cwd: GAME, stdio: 'inherit' });

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
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

fs.mkdirSync(SHOTS, { recursive: true });

// Glyphs the pixel font can draw (Particle.ts digitPatterns). Any char in a
// formatted damage string outside this set renders BLANK — a silent regression.
const GLYPHS = new Set('0123456789KMBT.'.split(''));

// --- Portrait run: start a wave, inject large hits, read back formatted text ---
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__game, { timeout: 10000 });

const cases = [
  { dmg: 515000000, want: '515M' },
  { dmg: 1500, want: '1.5K' },
  { dmg: 12345, want: '12K' },
  { dmg: 2400000000, want: '2.4B' },
  { dmg: 999, want: '999' },
  { dmg: 1000000, want: '1M' },
];

const out = await page.evaluate((cases) => {
  const g = window.__game;
  // Get the game into a playing state with a player so drawHUD runs.
  if (typeof g.startNewGame === 'function' && !g.player) { try { g.startNewGame(); } catch {} }
  const results = [];
  for (const c of cases) {
    // Push a damage number through the real pool path (exercises real formatShort).
    const dn = g.createDamageNumber ? g.createDamageNumber(100, 100, c.dmg, false) : null;
    results.push({ dmg: c.dmg, want: c.want, got: dn ? dn.text : '(no createDamageNumber)' });
  }
  // Inflate HUD numbers to confirm the panel path also formats (gold + hp).
  if (g.player) { g.player.gold = 515000000; g.player.health = 4200000; g.player.maxHealth = 9900000; }
  g.state = 'playing';
  // Spawn floating damage numbers at the player (screen-centre) so the NEW pixel-font
  // suffix glyphs (K/M/B/.) are visibly rendered, not just asserted as in-set.
  if (g.player && g.createDamageNumber) {
    const px = g.player.x, py = g.player.y;
    g.damageNumbers.push(g.createDamageNumber(px, py - 40, 515000000, true));
    g.damageNumbers.push(g.createDamageNumber(px - 60, py, 1500, false));
    g.damageNumbers.push(g.createDamageNumber(px + 60, py, 2400000000, false));
  }
  if (typeof g.draw === 'function') g.draw();
  return {
    results,
    hasPlayer: !!g.player,
    canvasW: g.canvas.width, canvasH: g.canvas.height,
    gold: g.player ? g.player.gold : null,
  };
}, cases);

await page.screenshot({ path: path.join(SHOTS, 'numberformat-portrait.png') });

// --- Landscape run: confirm the portrait floor does NOT waste space in landscape ---
await page.setViewport({ width: 900, height: 500, deviceScaleFactor: 2 });
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__game, { timeout: 10000 });
await page.evaluate(() => {
  const g = window.__game;
  if (typeof g.startNewGame === 'function' && !g.player) { try { g.startNewGame(); } catch {} }
  if (g.player) { g.player.gold = 777000000; }
  g.state = 'playing';
  if (typeof g.draw === 'function') g.draw();
});
await page.screenshot({ path: path.join(SHOTS, 'numberformat-landscape.png') });

await browser.close();
server.close();

// --- Assertions ---
let fail = false;
console.log('\nDamage-number formatting (real game path):');
for (const r of out.results) {
  const ok = r.got === r.want;
  const glyphOk = [...String(r.got)].every(ch => GLYPHS.has(ch));
  if (!ok || !glyphOk) fail = true;
  console.log(`  ${String(r.dmg).padStart(11)} -> "${r.got}"  ${ok ? 'OK' : 'WANT "'+r.want+'"'}  ${glyphOk ? '' : '[UNRENDERABLE GLYPH]'}`);
}
console.log(`\n  player present: ${out.hasPlayer}; HUD gold set to ${out.gold} (formatShort applied in drawHUD)`);
console.log('  screenshots:', path.join(SHOTS, 'numberformat-portrait.png'), '+', path.join(SHOTS, 'numberformat-landscape.png'));

if (errors.length) { console.error('\nCONSOLE/PAGE ERRORS:', errors.slice(0, 6)); process.exit(1); }
if (!out.hasPlayer) { console.error('\nWARN: no player — could not exercise HUD path (createDamageNumber still tested).'); }
if (fail) { console.error('\nFAIL: a damage number formatted wrong or used an unrenderable glyph.'); process.exit(1); }
console.log('\nPASS: large numbers abbreviate correctly, every glyph is renderable, console clean.');
