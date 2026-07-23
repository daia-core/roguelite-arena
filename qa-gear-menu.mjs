#!/usr/bin/env node
// QA for the gear-menu + event-reward-card + skip batch.
// Drives the real game instance (window.__game) headlessly:
//   1. gear button (top-right) opens the pause overlay
//   2. Sound toggle flips the audio enabled flag + button label
//   3. End Run cashes out souls (state -> gameover, souls increased)
//   4. Restart Run resets the run
//   5. an event that grants an artifact shows the reward card (name/rarity/desc)
//   6. the reward screen's Skip button declines without granting
// Screenshots the pause overlay (desktop + mobile) and the event card.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/gear-menu';
fs.mkdirSync(OUT, { recursive: true });

console.log('Building frontend...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.css':'text/css','.mp3':'audio/mpeg' };
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let fail = false;
const check = (name, ok, detail = '') => {
  if (!ok) fail = true;
  console.log(`  [${ok ? 'OK ' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
});

async function run(label, viewport, shotPrefix) {
  console.log(`\n=== ${label} (${viewport.width}x${viewport.height}) ===`);
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1200);

  // Enter a live run.
  await page.evaluate(() => { const g = window.__game; g.startNewGame(); g.state = 'playing'; });
  await sleep(300);

  // 1. Gear button opens the pause overlay.
  await page.evaluate(() => {
    const g = window.__game;
    const r = g.gearButtonRect();
    g.input.mouseX = r.x + r.width / 2;
    g.input.mouseY = r.y + r.height / 2;
    g.input.mouseDown = true;
  });
  await sleep(200);
  const afterGear = await page.evaluate(() => window.__game.state);
  check('gear opens pause overlay', afterGear === 'paused', `state=${afterGear}`);
  await page.screenshot({ path: path.join(OUT, `${shotPrefix}-paused.png`) });

  // 2. Sound toggle flips the audio flag + label (button index 1).
  // screenScale / pausedTopY / columnRects moved from Game → PauseScene (TS private, JS-accessible).
  const sound = await page.evaluate(() => {
    const g = window.__game;
    const ps = g.scenes.paused;
    const before = g.audio.isEnabled();
    const { s, W, isMobile } = ps.screenScale();
    const r = ps.columnRects(5, ps.pausedTopY(s, isMobile), s, W, isMobile)[1];
    g.input.mouseX = r.x + r.width / 2; g.input.mouseY = r.y + r.height / 2; g.input.mouseDown = true;
    return { before };
  });
  await sleep(150);
  const soundAfter = await page.evaluate(() => window.__game.audio.isEnabled());
  check('sound toggle flips enabled flag', soundAfter === !sound.before, `${sound.before} -> ${soundAfter}`);

  // 3. End Run cashes out souls (button index 2). Force a non-zero wave so the
  //    banking is observable (souls = wave + bossKills*10).
  const endRun = await page.evaluate(() => {
    const g = window.__game;
    const ps = g.scenes.paused;
    g.waveManager.currentWave = 7;
    const soulsBefore = g.metaProgression.souls;
    const { s, W, isMobile } = ps.screenScale();
    const r = ps.columnRects(5, ps.pausedTopY(s, isMobile), s, W, isMobile)[2];
    g.input.mouseX = r.x + r.width / 2; g.input.mouseY = r.y + r.height / 2; g.input.mouseDown = true;
    return { soulsBefore, wave: 7 };
  });
  await sleep(200);
  const endState = await page.evaluate(() => ({ state: window.__game.state, souls: window.__game.metaProgression.souls }));
  check('End Run -> gameover', endState.state === 'gameover', `state=${endState.state}`);
  check('End Run banks souls', endState.souls > endRun.soulsBefore, `${endRun.soulsBefore} -> ${endState.souls}`);

  // 4. Restart Run from a fresh pause.
  await page.evaluate(() => { const g = window.__game; g.startNewGame(); g.state = 'playing'; });
  await sleep(200);
  await page.evaluate(() => {
    const g = window.__game;
    const r = g.gearButtonRect();
    g.input.mouseX = r.x + r.width / 2; g.input.mouseY = r.y + r.height / 2; g.input.mouseDown = true;
  });
  await sleep(150);
  await page.evaluate(() => {
    const g = window.__game;
    const ps = g.scenes.paused;
    const { s, W, isMobile } = ps.screenScale();
    const r = ps.columnRects(5, ps.pausedTopY(s, isMobile), s, W, isMobile)[3]; // Restart Run
    g.input.mouseX = r.x + r.width / 2; g.input.mouseY = r.y + r.height / 2; g.input.mouseDown = true;
  });
  await sleep(200);
  const restartState = await page.evaluate(() => window.__game.state);
  check('Restart Run opens class select', restartState === 'classselect', `state=${restartState}`);

  // 5. Event that grants an artifact shows the reward card.
  // currentEvent / eventResultText / eventReward + wrapText / columnRects / rewardCardHeight
  // moved from Game → EventScene (TS private, JS-accessible via g.scenes.event).
  await page.evaluate(() => {
    const g = window.__game;
    const es = g.scenes.event;
    g.startNewGame(); g.state = 'playing';
    es.currentEvent = { title: 'Test Shrine', text: 'A shrine hums with power.', options: [{ label: 'Touch it', result: 'Power flows into you!', effects: [{ kind: 'artifact' }] }] };
    es.eventResultText = null; es.eventReward = null; g.state = 'event';
  });
  await sleep(150);
  // Tap option 0 using the exact geometry updateEvent recomputes.
  await page.evaluate(() => {
    const g = window.__game;
    const es = g.scenes.event;
    const { s, W, isMobile } = es.screenScale();
    const ev = es.currentEvent;
    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 560));
    const titlePx = s(isMobile ? 14 : 18);
    const titleLines = es.wrapText(ev.title, contentW - s(24), titlePx).length;
    let y = s(isMobile ? 26 : 34) + titleLines * (titlePx + s(4)) + s(isMobile ? 6 : 8);
    const bodyPx = s(isMobile ? 9 : 11);
    y += es.wrapText(ev.text, contentW - s(24), bodyPx).length * (bodyPx + s(5));
    y += s(10);
    const r = es.columnRects(ev.options.length, y, s, W, isMobile)[0];
    g.input.mouseX = r.x + r.width / 2; g.input.mouseY = r.y + r.height / 2; g.input.mouseDown = true;
  });
  await sleep(200);
  const evReward = await page.evaluate(() => {
    const es = window.__game.scenes.event;
    return { hasReward: !!es.eventReward, reward: es.eventReward, resultText: es.eventResultText };
  });
  check('event grants + captures a reward card', evReward.hasReward, evReward.reward ? `${evReward.reward.name} (${evReward.reward.rarity})` : 'none');
  check('event result text set', !!evReward.resultText, evReward.resultText || '');
  await page.screenshot({ path: path.join(OUT, `${shotPrefix}-event-card.png`) });

  // Continue clears the card + returns to map.
  await page.evaluate(() => {
    const g = window.__game;
    const es = g.scenes.event;
    const { s, W, H, isMobile } = es.screenScale();
    const ev = es.currentEvent;
    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 560));
    const titlePx = s(isMobile ? 14 : 18);
    const titleLines = es.wrapText(ev.title, contentW - s(24), titlePx).length;
    let y = s(isMobile ? 26 : 34) + titleLines * (titlePx + s(4)) + s(isMobile ? 6 : 8);
    const bodyPx = s(isMobile ? 9 : 11);
    y += es.wrapText(ev.text, contentW - s(24), bodyPx).length * (bodyPx + s(5));
    y += s(10);
    y += es.wrapText(es.eventResultText, contentW - s(24), bodyPx).length * (bodyPx + s(5)) + s(10);
    const cardW = contentW - s(16);
    if (es.eventReward) y += es.rewardCardHeight(cardW, s, isMobile);
    y += s(12);
    const r = es.columnRects(1, y, s, W, isMobile)[0];
    g.input.mouseX = r.x + r.width / 2; g.input.mouseY = r.y + r.height / 2; g.input.mouseDown = true;
    void H;
  });
  await sleep(200);
  const afterContinue = await page.evaluate(() => ({ state: window.__game.state, reward: window.__game.scenes.event.eventReward }));
  check('event Continue -> map, card cleared', afterContinue.state === 'map' && !afterContinue.reward, `state=${afterContinue.state}`);

  // 6. Reward screen Skip declines without granting.
  // columnRects for the reward screen → RewardScene (TS private, JS-accessible via g.scenes.reward).
  await page.evaluate(() => { const g = window.__game; g.startNewGame(); g.state = 'playing'; });
  await sleep(150);
  // offerArtifactReward is private but reachable at runtime; drive it directly.
  // Enter the reward screen first, then tap on a LATER frame — the on-state-change
  // input disarm (correct anti-clickthrough) ignores a press held across the switch.
  const skipResult = await page.evaluate(() => {
    const g = window.__game;
    const heldBefore = g.artifacts.held.length;
    g.offerArtifactReward('TEST ELITE', () => { g.state = 'map'; });
    return { heldBefore, inReward: g.state === 'reward', skippable: g.rewardSkippable, choices: g.rewardChoices.length };
  });
  await sleep(150); // let the disarm clear while released
  await page.evaluate(() => {
    const g = window.__game;
    const rs = g.scenes.reward;
    const { s, W, isMobile } = rs.screenScale();
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460)); void cardW;
    const cardH = s(isMobile ? 74 : 68);
    const gap = s(12);
    const topY = s(isMobile ? 72 : 92);
    const skipY = topY + g.rewardChoices.length * (cardH + gap) + s(4);
    const r = rs.columnRects(1, skipY, s, W, isMobile)[0];
    g.input.mouseX = r.x + r.width / 2; g.input.mouseY = r.y + r.height / 2; g.input.mouseDown = true;
  });
  await sleep(200);
  const skipAfter = await page.evaluate(() => ({ state: window.__game.state, held: window.__game.artifacts.held.length }));
  check('reward screen is skippable', skipResult.inReward && skipResult.skippable);
  check('Skip declines without granting', skipAfter.held === skipResult.heldBefore && skipAfter.state === 'map', `held ${skipResult.heldBefore} -> ${skipAfter.held}, state=${skipAfter.state}`);

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  await page.close();
}

await run('Desktop', { width: 1280, height: 800 }, 'desktop');
await run('Mobile',  { width: 390, height: 844 }, 'mobile');

await browser.close();
server.close();

console.log(`\nScreenshots → ${OUT}`);
console.log(fail ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(fail ? 1 : 0);
