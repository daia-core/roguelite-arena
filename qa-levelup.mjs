#!/usr/bin/env node
// Verifies the LEVEL-UP pick-1-of-3 upgrade screen on the SHIPPED frontend/dist.
// On level-up the sim pauses (state -> 'levelup'), three weighted items are rolled,
// and tapping one grants it (with the shop's duo/HP/shield side effects) then returns
// to 'playing'. Extra level-ups earned while the screen is open QUEUE and open
// back-to-back so a big XP orb never eats a choice. An empty eligible pool must not
// trap the player on a blank screen.
//
// TS `private` is compile-time only, so g.grantXP / g.levelupChoices / g.state are all
// reachable at runtime. Boots a real wave and drives g.update + synthetic taps.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/levelup';
fs.mkdirSync(OUT, { recursive: true });

console.log('Building frontend (npm run build)...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

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
await page.setViewport({ width: 390, height: 844 }); // mobile-first
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game handle' };
  const out = {};
  const step = (n = 1) => { for (let i = 0; i < n; i++) g.update(1/60); };

  // Boot a real wave.
  g.startNewGame(); g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing';

  // --- Force a single level-up: park XP just under threshold, grant the rest. ---
  const forceLevelUp = () => {
    g.player.xp = g.player.xpToNextLevel - 1;
    g.grantXP(2); // crosses the threshold exactly once
  };

  const lvlBefore = g.player.level;
  forceLevelUp();
  out.stateIsLevelup = g.state === 'levelup';           // sim paused on the choice screen
  out.leveledOnce = g.player.level === lvlBefore + 1;    // exactly one level gained
  out.hasThreeChoices = Array.isArray(g.levelupChoices) && g.levelupChoices.length === 3;
  out.choicesAreItems = out.hasThreeChoices && g.levelupChoices.every(c => c && c.id && c.name);

  // While on the level-up screen, gameplay updates must NOT advance the fight
  // (enemies frozen). Record an enemy position, step, confirm it didn't move.
  const anyEnemy = (g.enemies || []).find(e => !e.dead);
  const ex = anyEnemy ? anyEnemy.x : null;
  step(10);
  out.simPausedOnScreen = anyEnemy ? Math.abs(anyEnemy.x - ex) < 1e-6 : true;
  out.stillLevelupAfterSteps = g.state === 'levelup';    // no auto-dismiss

  // --- Pick card 0 via a synthetic tap at its rect center (mirror draw geometry). ---
  const itemsBefore = g.playerStats.items.length;
  const pickedId = g.levelupChoices[0].id;
  // Compute the card-0 rect exactly as drawLevelup/updateLevelup do.
  const sc = g.screenScale();            // { s, W, isMobile, ... }
  const s = sc.s, W = sc.W, isMobile = sc.isMobile;
  const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
  const cardH = s(isMobile ? 74 : 68);
  const x0 = (W - cardW) / 2;
  const topY = s(isMobile ? 72 : 92);
  g.input.mouseX = x0 + cardW / 2;
  g.input.mouseY = topY + cardH / 2;
  g.input.mouseDown = true;
  step(); // updateLevelup consumes the tap

  out.itemGranted = g.playerStats.items.length === itemsBefore + 1;
  out.grantedTheClicked = g.playerStats.items.some(it => it.id === pickedId);
  out.returnedToPlaying = g.state === 'playing';
  out.choicesCleared = g.levelupChoices.length === 0;

  // --- Queue test: two level-ups crossed rapidly must open back-to-back. ---
  g.state = 'playing';
  g.player.xp = g.player.xpToNextLevel - 1; g.grantXP(2); // level A -> opens screen
  const wasLevelupA = g.state === 'levelup';
  // Earn ANOTHER level while the screen is up (simulate a second orb resolving).
  g.player.xp = g.player.xpToNextLevel - 1; g.grantXP(2); // queued, screen stays up
  const stillUpAfterSecond = g.state === 'levelup';
  // Pick A.
  g.input.mouseX = x0 + cardW / 2; g.input.mouseY = topY + cardH / 2; g.input.mouseDown = true; step();
  // Should immediately present the SECOND choice, not return to play.
  const secondScreenOpened = g.state === 'levelup' && g.levelupChoices.length === 3;
  // Pick B.
  g.input.mouseX = x0 + cardW / 2; g.input.mouseY = topY + cardH / 2; g.input.mouseDown = true; step();
  const backToPlayAfterBoth = g.state === 'playing';
  out.queueBackToBack = wasLevelupA && stillUpAfterSecond && secondScreenOpened && backToPlayAfterBoth;

  // --- A stray tap on empty canvas space must NOT grant anything / crash. ---
  g.state = 'playing'; g.player.xp = g.player.xpToNextLevel - 1; g.grantXP(2);
  const nBefore = g.playerStats.items.length;
  g.input.mouseX = 2; g.input.mouseY = 2; g.input.mouseDown = true; step(); // corner, no card
  out.missTapNoGrant = g.playerStats.items.length === nBefore && g.state === 'levelup';
  // clean up: pick something so we leave the screen
  g.input.mouseX = x0 + cardW / 2; g.input.mouseY = topY + cardH / 2; g.input.mouseDown = true; step();

  return out;
});

// Screenshot the level-up screen on mobile + desktop for visual QA.
async function shot(vp, name) {
  await page.setViewport(vp);
  await page.evaluate(() => {
    const g = window.__game;
    g.startNewGame(); g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing';
    g.player.xp = g.player.xpToNextLevel - 1; g.grantXP(2);
  });
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: path.join(OUT, name) });
}
await shot({ width: 390, height: 844 }, 'levelup-mobile.png');
await shot({ width: 1280, height: 800 }, 'levelup-desktop.png');

await browser.close();
server.close();

console.log('\n=== Level-up pick-1-of-3 (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('Screenshots →', OUT);

const checks = ['stateIsLevelup','leveledOnce','hasThreeChoices','choicesAreItems',
  'simPausedOnScreen','stillLevelupAfterSteps','itemGranted','grantedTheClicked',
  'returnedToPlaying','choicesCleared','queueBackToBack','missTapNoGrant'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
