#!/usr/bin/env node
// Verifies (on the SHIPPED frontend/dist) the DEVIL-DEAL risk axis — the game's first
// permanent-downside choice. A devil event hands a strong, run-long BOON welded to a
// permanent CURSE artifact. Curses fold their (negative) stats through the same static
// path as any artifact, but are EXCLUDED from the random artifact pools, so they arrive
// ONLY as the price of a pact. "Walk away" is always free.
//
//   1. Data: 3 curses exist, each carries curse:true + a real stat malus.
//   2. Data: 2 devil events exist (devil_bargain, devil_altar) with a walk-away option.
//   3. Curses are NOT in the random reward pool (ROLLABLE excludes them) — many draws,
//      never a curse.
//   4. Taking a pact grants BOTH the boon (artifact/gold/maxHp) AND the named curse,
//      and the curse's malus actually folds into playerStats (speed/fireRate/incoming dmg).
//   5. Walking away grants NOTHING (no curse, no artifact, no gold change).
//   6. grantArtifact dedupe: granting the same curse twice is a no-op (idempotent).
//
// TS `private` is compile-time only, so g.artifacts / g.currentEvent / g.applyEventEffect
// are all reachable at runtime. window.__EVENTS / __ARTIFACTS expose the registries.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/devildeal';
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
await page.setViewport({ width: 390, height: 844 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const EVENTS = window.__EVENTS;
  const ARTIFACTS = window.__ARTIFACTS;
  if (!g) return { fatal: 'no __game handle' };
  if (!EVENTS) return { fatal: 'no __EVENTS handle' };
  if (!ARTIFACTS) return { fatal: 'no __ARTIFACTS handle' };
  const out = {};
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const fresh = () => { g.startNewGame(); g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing'; };

  const CURSE_IDS = ['curse_frailty','curse_sloth','curse_dullness'];

  // === 1. Curse catalog: all 3 exist, flagged curse:true, carry a real malus. ===
  const curses = CURSE_IDS.map(id => ARTIFACTS.find(a => a.id === id));
  out.cursesExist = curses.every(Boolean);
  out.cursesFlagged = out.cursesExist && curses.every(c => c.curse === true);
  out.cursesHaveMalus = out.cursesExist && curses.every(c =>
    (c.speedMult !== undefined && c.speedMult < 1) ||
    (c.fireRateMult !== undefined && c.fireRateMult < 1) ||
    (c.glassTakenMult !== undefined && c.glassTakenMult > 1));

  // === 2. Devil events exist and each carries a free walk-away option. ===
  const devilBargain = EVENTS.find(e => e.id === 'devil_bargain');
  const devilAltar = EVENTS.find(e => e.id === 'devil_altar');
  out.devilEventsExist = !!devilBargain && !!devilAltar;
  const hasWalkAway = (ev) => ev.options.some(o => o.effects.length === 1 && o.effects[0].kind === 'nothing');
  out.devilHasWalkAway = out.devilEventsExist && hasWalkAway(devilBargain) && hasWalkAway(devilAltar);
  // Each devil event has at least one option that grants a curse.
  const hasCurseOption = (ev) => ev.options.some(o => o.effects.some(f => f.kind === 'curse'));
  out.devilHasCurseOption = out.devilEventsExist && hasCurseOption(devilBargain) && hasCurseOption(devilAltar);

  // === 3. Curses are NEVER in the random reward pool. ===
  // Drive many artifact-grant events; assert no curse is ever granted this way.
  fresh();
  let sawCurseInRandom = false;
  for (let i = 0; i < 60; i++) {
    g.artifacts.reset(); g.artifacts.applyStatic(g.playerStats);
    g.applyEventEffect({ kind: 'artifact' });
    if (g.artifacts.held.some(a => a.curse)) { sawCurseInRandom = true; break; }
  }
  out.cursesNotInRandomPool = !sawCurseInRandom;

  // === 4a. FRAILTY pact: grant boon+curse, curse folds incoming-damage malus. ===
  fresh();
  g.applyEventEffect({ kind: 'artifact' });                 // boon
  g.applyEventEffect({ kind: 'curse', id: 'curse_frailty' }); // price
  out.frailtyHeld = g.artifacts.has('curse_frailty');
  out.frailtyBoonAlso = g.artifacts.held.length >= 2;        // curse + at least one boon artifact
  out.frailtyIncomingMalus = g.artifacts.incomingDamageMult() >= 1.5; // +50% dmg taken

  // === 4b. SLOTH pact: gold boon + speed malus folds into artifactSpeedMult. ===
  fresh();
  const gold0 = g.player.gold;
  g.applyEventEffect({ kind: 'gold', amount: 120 });
  g.applyEventEffect({ kind: 'curse', id: 'curse_sloth' });
  out.slothGold = g.player.gold === gold0 + 120;
  out.slothHeld = g.artifacts.has('curse_sloth');
  out.slothSpeedMalus = g.playerStats.artifactSpeedMult < 1 && near(g.playerStats.artifactSpeedMult, 0.7);

  // === 4c. DULLNESS pact: maxHp+artifact boon + fire-rate malus. ===
  fresh();
  const maxHp0 = g.player.maxHealth;
  g.applyEventEffect({ kind: 'maxHp', amount: 60 });
  g.applyEventEffect({ kind: 'artifact' });
  g.applyEventEffect({ kind: 'curse', id: 'curse_dullness' });
  out.dullnessMaxHp = g.player.maxHealth === maxHp0 + 60;
  out.dullnessHeld = g.artifacts.has('curse_dullness');
  out.dullnessFireMalus = g.playerStats.artifactFireRateMult < 1 && near(g.playerStats.artifactFireRateMult, 0.75);

  // === 5. Walk-away grants NOTHING. ===
  fresh();
  const g0 = g.player.gold, h0 = g.artifacts.held.length;
  g.applyEventEffect({ kind: 'nothing' });
  out.walkAwayNoGrant = g.player.gold === g0 && g.artifacts.held.length === h0;

  // === 6. Curse grant is idempotent (dedupe — same curse twice = one copy). ===
  fresh();
  g.applyEventEffect({ kind: 'curse', id: 'curse_sloth' });
  const afterFirst = g.artifacts.held.filter(a => a.id === 'curse_sloth').length;
  g.applyEventEffect({ kind: 'curse', id: 'curse_sloth' });
  const afterSecond = g.artifacts.held.filter(a => a.id === 'curse_sloth').length;
  out.curseIdempotent = afterFirst === 1 && afterSecond === 1;

  return out;
});

// Screenshot a devil event on mobile + desktop for visual QA.
async function shot(vp, name) {
  await page.setViewport(vp);
  await page.evaluate(() => {
    const g = window.__game;
    const EVENTS = window.__EVENTS;
    g.startNewGame(); g.waveManager.reset(); g.waveManager.startWave(1);
    g.currentEvent = EVENTS.find(e => e.id === 'devil_bargain');
    g.eventResultText = null; g.eventReward = null;
    g.state = 'event';
  });
  await new Promise(r => setTimeout(r, 250));
  await page.screenshot({ path: path.join(OUT, name) });
}
await shot({ width: 390, height: 844 }, 'devildeal-mobile.png');
await shot({ width: 1280, height: 800 }, 'devildeal-desktop.png');

await browser.close();
server.close();

console.log('\n=== Devil-deal risk axis (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('Screenshots →', OUT);

const checks = ['cursesExist','cursesFlagged','cursesHaveMalus','devilEventsExist','devilHasWalkAway',
  'devilHasCurseOption','cursesNotInRandomPool','frailtyHeld','frailtyBoonAlso','frailtyIncomingMalus',
  'slothGold','slothHeld','slothSpeedMalus','dullnessMaxHp','dullnessHeld','dullnessFireMalus',
  'walkAwayNoGrant','curseIdempotent'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
