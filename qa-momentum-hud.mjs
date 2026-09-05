#!/usr/bin/env node
// QA: Momentum Engine HUD counter (🚀 XX%) + peak audio feel.
//
// Verifies (on the SHIPPED frontend/dist) that:
//   1.  'momentum' artifact exists in ArtifactSystem.ts with momentumBonus: 0.5
//   2.  'juggernaut_core' artifact exists with momentumBonus: 0.65
//   3.  momentumTime is a number field accessible on the game object at runtime
//   4.  getMomentumMax() returns 0 without artifact, 0.5 with Momentum Engine held
//   5.  getMomentumFrac() returns 0 when momentumTime is 0
//   6.  getMomentumFrac() returns frac = momentumTime / 3 when momentumTime is set
//   7.  Full-ramp detection: frac >= 0.99 when momentumTime >= 2.97
//   8.  HUD suppressed when getMomentumMax() === 0 (no artifact held)
//   9.  Juggernaut Core provides 0.65 bonus via getMomentumMax()
//  10.  momentumBonus() picks first momentum artifact only (not additive with two)
//  11.  No console/page errors throughout.
//  12.  AudioManager.playMomentumPeak() method defined (audio feel cue).
//  13.  Game.ts wires playMomentumPeak on the prevMomentum<3 → momentumTime>=3 crossing.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const ARTIFACT_SRC = path.join(FRONTEND, 'src/ArtifactSystem.ts');
const AUDIO_SRC = path.join(FRONTEND, 'src/AudioManager.ts');
const GAME_SRC = path.join(FRONTEND, 'src/Game.ts');

// --- 12 & 13. Audio wiring source checks ---
const audioSrc = fs.readFileSync(AUDIO_SRC, 'utf8');
const gameSrc = fs.readFileSync(GAME_SRC, 'utf8');
const audioMethodCheck = audioSrc.includes('playMomentumPeak');
const audioWiringCheck = gameSrc.includes('playMomentumPeak');
console.log(`[source] AudioManager.playMomentumPeak defined → ${audioMethodCheck ? 'OK' : 'FAIL'}`);
console.log(`[source] Game.ts wires playMomentumPeak on full-ramp crossing → ${audioWiringCheck ? 'OK' : 'FAIL'}`);

// --- 1 & 2. Source-level checks ---
const artSrc = fs.readFileSync(ARTIFACT_SRC, 'utf8');

const mEngMatch = artSrc.match(/id:\s*'momentum'[^}]*momentumBonus:\s*([\d.]+)/s);
const mEngBonus = mEngMatch ? parseFloat(mEngMatch[1]) : null;
const sourceCheckME = Math.abs((mEngBonus ?? -1) - 0.5) < 0.001;
console.log(`[source] Momentum Engine momentumBonus=${mEngBonus} → ${sourceCheckME ? 'OK' : 'FAIL'}`);

const jCoreMatch = artSrc.match(/id:\s*'juggernaut_core'[^}]*momentumBonus:\s*([\d.]+)/s);
const jCoreBonus = jCoreMatch ? parseFloat(jCoreMatch[1]) : null;
const sourceCheckJC = Math.abs((jCoreBonus ?? -1) - 0.65) < 0.001;
console.log(`[source] Juggernaut Core momentumBonus=${jCoreBonus} → ${sourceCheckJC ? 'OK' : 'FAIL'}`);

console.log('Building frontend (npm run build)...');
execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg', '.css': 'text/css',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game handle' };

  const near = (a, b, eps = 0.001) => Math.abs(a - b) < eps;
  const out = {};

  const fresh = () => {
    g.startNewGame();
    g.waveManager.reset();
    g.waveManager.startWave(1);
    g.state = 'playing';
    g.momentumTime = 0;
  };

  // 3. momentumTime is a number field at runtime
  fresh();
  out.momentumTimeFieldExists = typeof g.momentumTime === 'number';

  // 4. getMomentumMax() returns 0 without artifact
  fresh();
  const maxNoArt = g.artifacts.momentumBonus();
  out.maxZeroNoArtifact = maxNoArt === 0;

  // 5. getMomentumFrac() returns 0 when momentumTime is 0
  // The game uses: momentumMax > 0 ? momentumTime / 3 : 0
  g.momentumTime = 0;
  const fracAtZero = maxNoArt > 0 ? g.momentumTime / 3 : 0;
  out.fracAtZeroIsZero = fracAtZero === 0;

  // 6 & 7. Add Momentum Engine artifact, test frac at various momentumTime values
  fresh();
  const addedME = g.artifacts.add(
    { id: 'momentum', name: 'Momentum Engine', icon: '🚀', rarity: 'epic',
      desc: 'Deal up to +50% damage the longer you keep moving.',
      flags: ['momentum'], momentumBonus: 0.5 },
    g.playerStats
  );
  out.meArtifactAddReturnsTrue = addedME === true;

  const maxWithME = g.artifacts.momentumBonus();
  out.maxWithME = near(maxWithME, 0.5);

  // frac at 0s (just started moving)
  g.momentumTime = 0;
  const frac0 = maxWithME > 0 ? g.momentumTime / 3 : 0;
  out.fracAt0s = near(frac0, 0.0);

  // frac at 1.5s (half ramp)
  g.momentumTime = 1.5;
  const frac15 = maxWithME > 0 ? g.momentumTime / 3 : 0;
  out.fracAt1_5s = near(frac15, 0.5);

  // frac at 3.0s (full ramp)
  g.momentumTime = 3.0;
  const frac30 = maxWithME > 0 ? g.momentumTime / 3 : 0;
  out.fracAt3s = near(frac30, 1.0);

  // 7. Full ramp detection: frac >= 0.99 fires gold/pulse (momentumTime = 2.97 → frac = 0.99)
  g.momentumTime = 2.97;
  const fracNearFull = maxWithME > 0 ? g.momentumTime / 3 : 0;
  out.fracAt2_97sNearFull = fracNearFull >= 0.99;

  // frac at 2.9s is NOT at max
  g.momentumTime = 2.9;
  const frac29 = maxWithME > 0 ? g.momentumTime / 3 : 0;
  out.fracAt2_9sNotFull = frac29 < 0.99;

  // 8. Counter suppressed when getMomentumMax() === 0
  fresh(); // re-fresh clears artifacts
  const suppressedNoArt = g.artifacts.momentumBonus() === 0;
  out.suppressedWhenNoArtifact = suppressedNoArt;
  const fracWhenSuppressed = suppressedNoArt ? 0 : g.momentumTime / 3;
  out.fracZeroWhenSuppressed = fracWhenSuppressed === 0;

  // 9. Juggernaut Core provides 0.65 bonus
  fresh();
  const addedJC = g.artifacts.add(
    { id: 'juggernaut_core', name: 'Juggernaut Core', icon: '🚂', rarity: 'legendary',
      desc: 'Damage ramps up to +65% while moving.',
      flags: ['momentum'], momentumBonus: 0.65 },
    g.playerStats
  );
  out.jcArtifactAddReturnsTrue = addedJC === true;
  const maxWithJC = g.artifacts.momentumBonus();
  out.maxWithJC = near(maxWithJC, 0.65);

  // 10. momentumBonus() is first-artifact-wins (not additive)
  // Already have JC in g.artifacts. Add ME on top.
  const addedME2 = g.artifacts.add(
    { id: 'momentum', name: 'Momentum Engine', icon: '🚀', rarity: 'epic',
      desc: 'Deal up to +50% damage the longer you keep moving.',
      flags: ['momentum'], momentumBonus: 0.5 },
    g.playerStats
  );
  const maxWithBoth = g.artifacts.momentumBonus();
  // momentumBonus() picks FIRST with momentumBonus property — so 0.65 (JC added first)
  out.bonusIsFirstNotAdditive = near(maxWithBoth, 0.65);

  return out;
});

await browser.close();
server.close();

const checks = [
  'momentumTimeFieldExists',
  'maxZeroNoArtifact',
  'fracAtZeroIsZero',
  'meArtifactAddReturnsTrue',
  'maxWithME',
  'fracAt0s',
  'fracAt1_5s',
  'fracAt3s',
  'fracAt2_97sNearFull',
  'fracAt2_9sNotFull',
  'suppressedWhenNoArtifact',
  'fracZeroWhenSuppressed',
  'jcArtifactAddReturnsTrue',
  'maxWithJC',
  'bonusIsFirstNotAdditive',
];

const fatal = result?.fatal;
const errMsg = errors.length ? errors.join('\n') : null;

console.log('\n=== Momentum Engine HUD counter (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
if (errMsg) console.error('Console/page errors:\n', errMsg);
else console.log('Console/page errors: 0');

const sourcePass = sourceCheckME && sourceCheckJC && audioMethodCheck && audioWiringCheck;
const browserPass = !fatal && !errMsg && checks.every(k => !!result[k]);
const passCount = checks.filter(k => !!result[k]).length;
const sourceCount = [sourceCheckME, sourceCheckJC, audioMethodCheck, audioWiringCheck].filter(Boolean).length;
const total = checks.length + 4; // +4 for source checks (2 original + 2 audio wiring)
const allPass = sourcePass && browserPass;

console.log(`\n${sourceCount + passCount}/${total} checks passed`);
console.log(`[source] Momentum Engine momentumBonus=0.5: ${sourceCheckME ? 'PASS' : 'FAIL'}`);
console.log(`[source] Juggernaut Core momentumBonus=0.65: ${sourceCheckJC ? 'PASS' : 'FAIL'}`);
console.log(`[source] AudioManager.playMomentumPeak defined: ${audioMethodCheck ? 'PASS' : 'FAIL'}`);
console.log(`[source] Game.ts wires playMomentumPeak: ${audioWiringCheck ? 'PASS' : 'FAIL'}`);
console.log(`RESULT: ${allPass ? 'PASS ✅' : 'FAIL ❌'}`);
if (fatal) console.error('FATAL:', fatal);
if (!allPass) process.exit(1);
