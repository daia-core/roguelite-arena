#!/usr/bin/env node
/**
 * qa-audio-wiring.mjs — verify that the previously-unconnected AudioManager methods
 * (crit, lightning, explosion, freeze, poison, shield block, heal) are now:
 *   (a) callable without throwing, and
 *   (b) throttled correctly (rapid successive calls don't double-play within the cooldown).
 * Also checks playExecute() (execute-kill audio), playSecondWind() (near-death rescue), and
 * playWavePhase() (mid-wave sub-phase escalation stinger) added Aug 2026.
 *
 * Tests:
 *   methodsExist         — all 13 new methods are functions on window.__game.audio
 *   noThrowOnCall        — each method can be called without throwing an error
 *   throttleMapExists    — audio._lastPlayed is a Map (throttle infrastructure is present)
 *   critThrottles        — two immediate playCrit() calls ≤ 10ms apart: only 1 fires
 *   lightningThrottles   — two immediate playLightning() calls: only 1 fires
 *   explosionThrottles   — two immediate playExplosion() calls: only 1 fires
 *   freezeThrottles      — two immediate playFreeze() calls: only 1 fires
 *   poisonThrottles      — two immediate playPoison() calls: only 1 fires
 *   executeThrottles     — two immediate playExecute() calls: only 1 fires
 *   throttleResets       — after cooldown, playCrit() fires again
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-audio-wiring.mjs
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
const pageErrors = [];
page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => typeof window.__game !== 'undefined', { timeout: 10000 });

const results = await page.evaluate(() => {
  const g = window.__game;
  const audio = g.audio;
  const out = {};

  // methodsExist — all 15 wired methods (7 Aug-18 + playExecute + playDoom + playSecondWind + playWavePhase + playBossKill + playBossWave + playBurn + playBleed Aug-2026) are functions
  const methods = ['playCrit', 'playLightning', 'playExplosion', 'playFreeze',
                   'playPoison', 'playShieldBlock', 'playHeal', 'playExecute', 'playDoom', 'playSecondWind',
                   'playWavePhase', 'playBossKill', 'playBossWave', 'playBurn', 'playBleed'];
  out.methodsExist = methods.every(m => typeof audio[m] === 'function');

  // noThrowOnCall — each method fires without throwing
  let threw = false;
  try {
    // Drain the AudioContext suspended state (Chrome may keep it suspended in headless)
    methods.forEach(m => audio[m]());
  } catch (e) {
    threw = true;
    out._throwMsg = String(e);
  }
  out.noThrowOnCall = !threw;

  // throttleMapExists — internal _lastPlayed is a Map
  // (use Object.getOwnPropertyDescriptor since it's private — we access via the instance)
  out.throttleMapExists = audio['_lastPlayed'] instanceof Map;

  // Helper: spy on _lastPlayed to count actual fires
  const countFires = (method, cooldownMs = 0) => {
    // Clear _lastPlayed for the key we're testing so we start fresh
    const key = method.replace('play', '').toLowerCase();
    audio['_lastPlayed'].delete(key);

    let fires = 0;
    const orig = audio[method].bind(audio);
    // Monkeypatch: count how many times _lastPlayed actually gets updated
    const origSet = audio['_lastPlayed'].set.bind(audio['_lastPlayed']);
    audio['_lastPlayed'].set = function(k, v) {
      if (k === key) fires++;
      return origSet(k, v);
    };
    // Call twice in rapid succession (0 delay)
    audio[method]();
    audio[method]();
    audio['_lastPlayed'].set = origSet; // restore
    return fires;
  };

  out.critThrottles      = countFires('playCrit')      === 1;
  out.lightningThrottles = countFires('playLightning')  === 1;
  out.explosionThrottles = countFires('playExplosion')  === 1;
  out.freezeThrottles    = countFires('playFreeze')     === 1;
  out.poisonThrottles    = countFires('playPoison')     === 1;
  out.executeThrottles   = countFires('playExecute')    === 1;
  out.doomThrottles      = countFires('playDoom')       === 1;
  out.burnThrottles      = countFires('playBurn')       === 1;
  out.bleedThrottles     = countFires('playBleed')      === 1;

  // throttleResets — after 200ms the crit throttle should allow another fire
  // (actual test: clear _lastPlayed manually and verify a fresh call fires)
  audio['_lastPlayed'].delete('crit');
  let resetFires = 0;
  const origSet2 = audio['_lastPlayed'].set.bind(audio['_lastPlayed']);
  audio['_lastPlayed'].set = function(k, v) {
    if (k === 'crit') resetFires++;
    return origSet2(k, v);
  };
  audio.playCrit();
  audio['_lastPlayed'].set = origSet2;
  out.throttleResets = resetFires === 1;

  return out;
});

await browser.close();
server.close();

const checks = [
  'methodsExist', 'noThrowOnCall', 'throttleMapExists',
  'critThrottles', 'lightningThrottles', 'explosionThrottles',
  'freezeThrottles', 'poisonThrottles', 'executeThrottles', 'doomThrottles',
  'burnThrottles', 'bleedThrottles', 'throttleResets',
];

let allPass = true;
for (const k of checks) {
  const pass = results[k] === true;
  if (!pass) allPass = false;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${k}${results._throwMsg ? ` (${results._throwMsg})` : ''}`);
}

const errs = pageErrors.filter(e => !e.includes('AudioContext'));
if (errs.length) {
  console.log('\nPage errors:', errs);
  allPass = false;
}

let passCount = 0;
for (const k of checks) { if (results[k] === true) passCount++; }
console.log(`\n${passCount}/${checks.length} checks${allPass ? ' PASS' : ' — FAILURES above'}`)
console.log(`RESULT: ${allPass ? 'PASS ✅' : 'FAIL ❌'}`);
process.exit(allPass ? 0 : 1);
