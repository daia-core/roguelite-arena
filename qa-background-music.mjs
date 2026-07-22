#!/usr/bin/env node
/**
 * qa-background-music.mjs — verify the atmospheric background music system.
 *
 * Feature added 2026-07-23: AudioManager gains startMusic()/stopMusic() and a
 * musicPlaying getter. Wired into Game.ts:
 *   - startMusic() called in startNextWave() (the map→combat transition) and in
 *     continueGame() (save-restore path). Idempotent — no-ops if already playing.
 *   - stopMusic() called in gameOver() and openClassSelect() (return-to-menu path).
 *
 * Tests:
 *   musicOffByDefault     — musicPlaying is false before startMusic()
 *   musicOnAfterStart     — musicPlaying is true after startMusic()
 *   doubleStartIdempotent — calling startMusic() twice doesn't error (idempotent)
 *   musicOffAfterStop     — musicPlaying is false after stopMusic()
 *   toggleStopsMusic      — toggle() while music is playing sets musicPlaying false
 *   gameStartsMusic       — beginRun() + startNextWave() → musicPlaying is true
 *   menuReturnStopsMusic  — openClassSelect() → musicPlaying is false
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-background-music.mjs
 */

import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'frontend/dist');

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(DIST, p);
  const ext  = path.extname(file);
  const mime = { '.html': 'text/html', '.js': 'text/javascript',
                 '.css': 'text/css', '.svg': 'image/svg+xml',
                 '.png': 'image/png', '.mp3': 'audio/mpeg' };
  try {
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404); res.end();
  }
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const URL      = `http://127.0.0.1:${port}/`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security',
         '--autoplay-policy=no-user-gesture-required'],
  headless: true,
});

const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.error('PAGE ERR:', m.text()); });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => typeof window.__game !== 'undefined', { timeout: 10000 });

const results = await page.evaluate(() => {
  const g = window.__game;
  const audio = g.audio;

  const out = {};

  // musicOffByDefault — before any startMusic call
  out.musicOffByDefault = audio.musicPlaying === false;

  // musicOnAfterStart
  audio.startMusic();
  out.musicOnAfterStart = audio.musicPlaying === true;

  // doubleStartIdempotent — should not throw, still playing
  let threw = false;
  try { audio.startMusic(); } catch { threw = true; }
  out.doubleStartIdempotent = !threw && audio.musicPlaying === true;

  // musicOffAfterStop
  audio.stopMusic();
  out.musicOffAfterStop = audio.musicPlaying === false;

  // toggleStopsMusic — enable is restored to test toggle behaviour
  audio.startMusic();
  audio.toggle(); // mutes → sets musicPlaying=false
  out.toggleStopsMusic = audio.musicPlaying === false;
  audio.toggle(); // restore enabled (music won't restart automatically, that's correct)

  // gameStartsMusic — verify startNextWave() (the wave-entry path) triggers music.
  // beginRun sets up the run (state='map'); startNextWave() enters combat + calls startMusic().
  // startNextWave is private in TS but accessible at runtime (same pattern as qa-evolution).
  g.beginRun('gunner');   // init player/stats, state='map'
  g.startNextWave();      // map→playing transition, calls this.audio.startMusic()
  out.gameStartsMusic = audio.musicPlaying === true;

  // menuReturnStopsMusic — openClassSelect() wires stopMusic(); test that path
  g.openClassSelect();
  out.menuReturnStopsMusic = audio.musicPlaying === false;

  return out;
});

server.close();
await browser.close();

const TESTS = [
  'musicOffByDefault',
  'musicOnAfterStart',
  'doubleStartIdempotent',
  'musicOffAfterStop',
  'toggleStopsMusic',
  'gameStartsMusic',
  'menuReturnStopsMusic',
];

let pass = 0, fail = 0;
for (const t of TESTS) {
  if (results[t]) {
    console.log(`✅ ${t}`);
    pass++;
  } else {
    console.log(`❌ ${t}  (got: ${results[t]})`);
    fail++;
  }
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'} (${pass}/${TESTS.length})`);
process.exit(fail > 0 ? 1 : 0);
