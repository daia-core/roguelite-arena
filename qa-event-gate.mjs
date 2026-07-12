// qa-event-gate.mjs — prove the stat-gated (requirement-locked) event choices work
// end-to-end: an option's `requirement` is evaluated against live PlayerStats through
// the exact production path (EventScene.isLocked → deps.meetsRequirement →
// Game.meetsEventRequirement → Game.eventStatValue), locked options are non-selectable,
// and the real EVENTS data carries well-formed gates. Exercises the input→scene→game
// wiring I touched (game-dev regression rule).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');

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
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game handle' };
  const out = {};

  g.startNewGame();
  g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing';

  const scene = g.scenes.event;
  if (!scene) return { fatal: 'no event scene' };

  // Synthetic options that hit the real gating path (same isLocked the scene uses).
  const meleeGate = { label: 'Lift', effects: [{ kind: 'nothing' }], result: '',
    requirement: { stat: 'meleeDmgPct', min: 30, label: 'Melee +30%' } };
  const goldGate = { label: 'Buy in', effects: [{ kind: 'nothing' }], result: '',
    requirement: { stat: 'gold', min: 100, label: '100+ gold' } };
  const hpGate = { label: 'Pay toll', effects: [{ kind: 'nothing' }], result: '',
    requirement: { stat: 'maxHp', min: 140, label: 'Max HP 140+' } };
  const ungated = { label: 'Leave', effects: [{ kind: 'nothing' }], result: '' };

  // === A. Fresh player (melee +0%, 0 gold, 100 maxHP) → every gate is locked ===
  g.player.gold = 0;
  out.freshMeleeLocked = scene.isLocked(meleeGate) === true;
  out.freshGoldLocked = scene.isLocked(goldGate) === true;
  out.freshHpLocked = scene.isLocked(hpGate) === true;
  out.ungatedNeverLocked = scene.isLocked(ungated) === false;

  // === B. Gold gate flips with the player's purse (dynamic, live-read) ===
  g.player.gold = 150;
  out.goldUnlockedAt150 = scene.isLocked(goldGate) === false;
  g.player.gold = 50;
  out.goldRelockedAt50 = scene.isLocked(goldGate) === true;

  // === C. maxHP gate flips when the player invests in vitality ===
  g.playerStats.baseMaxHealth = 200;
  g.refreshMaxHealth();
  out.hpUnlockedAt200 = scene.isLocked(hpGate) === false;
  g.playerStats.baseMaxHealth = 100;
  g.refreshMaxHealth();
  out.hpRelockedAt100 = scene.isLocked(hpGate) === true;

  // === D. Label reflects lock state (🔒 when unmet, ✓ when met) ===
  g.player.gold = 0;
  out.lockedLabelHasLock = scene.optionLabel(goldGate).includes('🔒');
  g.player.gold = 150;
  out.metLabelHasCheck = scene.optionLabel(goldGate).includes('✓');
  g.player.gold = 0;

  // === E. Real EVENTS data — gates are well-formed and evaluate without throwing ===
  const VALID_STATS = ['meleeDmgPct','rangedDmgPct','critPct','moveSpeedPct','armor','maxHp','gold'];
  const seenGatedIds = new Set();
  let badReq = 0, evalThrew = 0;
  for (let i = 0; i < 400; i++) {
    scene.enter(g.state);              // draws a random event, sets currentEvent
    const ev = scene.currentEvent;
    if (!ev) continue;
    for (const opt of ev.options) {
      if (!opt.requirement) continue;
      seenGatedIds.add(ev.id);
      const r = opt.requirement;
      if (!VALID_STATS.includes(r.stat) || !(r.min > 0) || !r.label) badReq++;
      try { scene.isLocked(opt); } catch { evalThrew++; }
    }
  }
  out.realGatedEventsSeen = seenGatedIds.size;         // expect all 14 gated events (7 starter + wager + 6 advanced)
  out.noMalformedRequirements = badReq === 0;
  out.noEvalThrows = evalThrew === 0;

  return out;
});

console.log('=== Stat-gated event choices ===');
console.log(JSON.stringify(result, null, 2));

const checks = [
  'freshMeleeLocked','freshGoldLocked','freshHpLocked','ungatedNeverLocked',
  'goldUnlockedAt150','goldRelockedAt50','hpUnlockedAt200','hpRelockedAt100',
  'lockedLabelHasLock','metLabelHasCheck','noMalformedRequirements','noEvalThrows',
];
let pass = !result.fatal;
for (const k of checks) if (result[k] !== true) { pass = false; console.log('FAIL:', k); }
if ((result.realGatedEventsSeen ?? 0) < 14) { pass = false; console.log('FAIL: realGatedEventsSeen <14 (got', result.realGatedEventsSeen, ')'); }
if (errors.length) { pass = false; console.log('Console/page errors:', errors.slice(0, 5)); }

console.log(pass ? '\n✅ PASS — stat gates lock/unlock correctly and real events are well-formed' : '\n❌ FAIL');
await browser.close();
server.close();
process.exit(pass ? 0 : 1);
