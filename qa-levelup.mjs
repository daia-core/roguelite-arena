#!/usr/bin/env node
// Verifies the SKILL TREE level-up flow on the SHIPPED frontend/dist.
//
// Felix (2026-07-05): "rework the level-up system so it uses a skill tree instead."
// New contract: a level-up during a wave fires its juice but does NOT pause the fight —
// it banks 1 skill point (g.skillTree.availablePoints). Points are allocated on the
// between-waves skill-tree screen: enterShop opens 'skilltree' ON TOP of the staged shop
// when points are banked; allocating a node applies its bonus to the live stats and
// Continue (finishSkillTree) lands the player on the SHOP. The SKILLS shop button reopens
// the tree. A new run resets the tree (no leak between runs).
//
// SkillTree API (post-rework): spend()→allocate(), canSpend()→canAllocate(),
// rankOf()→isAllocated() [nodes are boolean: either allocated or not, no multi-rank],
// isUnlocked()→isReachable(). Node IDs are arm-keyed: 'might_gate', 'might_a1', etc.
//
// TS `private` is compile-time only, so g.grantXP / g.enterShop / g.skillTree / g.state /
// g.openSkillTree / g.finishSkillTree are reachable at runtime. Boots a real wave.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const FRONTEND = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(FRONTEND, 'dist');
const OUT = '/workspace/work/roguelite-game/shots/skilltree';
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
  const forceLevelUp = () => { g.player.xp = g.player.xpToNextLevel - 1; g.grantXP(2); };

  // --- 1) A level-up mid-wave must NOT interrupt: no screen, banks a skill point. ---
  const lvlBefore = g.player.level;
  const anyEnemy = (g.enemies || []).find(e => !e.dead);
  const ex = anyEnemy ? anyEnemy.x : null;
  forceLevelUp();
  out.leveledOnce = g.player.level === lvlBefore + 1;
  out.noScreenMidWave = g.state === 'playing';                 // fight is NOT paused
  out.pointBanked = g.skillTree.availablePoints === 1;         // one SP banked
  step(10);
  out.fightKeptRunning = anyEnemy ? Math.abs(anyEnemy.x - ex) > 1e-9 || g.state === 'playing' : g.state === 'playing';

  // --- 2) Bank a SECOND point, then enter the shop: the skill-tree screen opens. ---
  forceLevelUp();
  out.twoBanked = g.skillTree.availablePoints === 2;
  g.enterShop();
  out.shopOpensSkillTree = g.state === 'skilltree';            // opened on top of staged shop

  // --- 3) Allocating a node (might_gate, adjacent to start_gunner) applies damage bonus. ---
  // might arm primary kind = 'dmg': delta { field:'damageMult', mul:1.04 } = +4% damage.
  const dmgBefore = g.playerStats.getDamage();
  const spent = g.skillTree.allocate('might_gate');
  g.skillTree.recomputeInto(g.playerStats);
  out.spendSucceeded = spent === true;
  out.pointConsumed = g.skillTree.availablePoints === 1;       // 2 → 1
  out.nodeAllocated = g.skillTree.isAllocated('might_gate') === true;
  const dmgAfter = g.playerStats.getDamage();
  out.damageBonusApplied = dmgAfter > dmgBefore * 1.02;        // +4% from dmg minor

  // --- 4) A node not adjacent to any allocated node cannot be bought. ---
  // 'might_nA' is adjacent to 'might_a1', which is NOT yet allocated.
  out.lockedNodeUnbuyable = g.skillTree.canAllocate('might_nA') === false;
  g.skillTree.allocate('might_a1');                            // now might_nA becomes reachable
  out.childUnlocksAfterParent = g.skillTree.isReachable('might_nA') === true;

  // --- 5) Continue (finishSkillTree) with points still banked lands on the SHOP. ---
  g.finishSkillTree();
  out.continueLandsOnShop = g.state === 'shop';

  // --- 6) The SKILLS shop button reopens the tree to spend leftover points. ---
  g.openSkillTree(true);
  out.reopensFromShop = g.state === 'skilltree';
  g.finishSkillTree();

  // --- 7) Double-allocate: re-allocating an already-allocated node is rejected. ---
  // might_gate is already in tree.allocated; allocate() must return false and not
  // decrease availablePoints (which is now 0 after steps 3+4, so reset it first).
  g.skillTree.availablePoints = 5;
  const pointsBefore = g.skillTree.availablePoints;
  const doubleResult = g.skillTree.allocate('might_gate');     // already allocated
  out.doubleAllocateBlocked = doubleResult === false && g.skillTree.availablePoints === pointsBefore;

  // --- 8) A new run resets the tree (no leak between runs). ---
  g.startNewGame();
  out.newRunResetsTree = g.skillTree.availablePoints === 0 && g.skillTree.isAllocated('might_gate') === false;
  // And the reset pushed identity bonuses back into stats.
  out.bonusesResetToIdentity = g.playerStats.skillDamageMult === 1;

  return out;
});

// Screenshot the skill-tree screen (opened via the shop break) on mobile + desktop.
async function shot(vp, name) {
  await page.setViewport(vp);
  await page.evaluate(() => {
    const g = window.__game;
    g.startNewGame(); g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing';
    // Bank a few points so the screen shows spendable nodes.
    for (let i = 0; i < 4; i++) { g.player.xp = g.player.xpToNextLevel - 1; g.grantXP(2); }
    g.enterShop(); // opens the skill-tree screen over the staged shop
  });
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(OUT, name) });
}
await shot({ width: 390, height: 844 }, 'skilltree-mobile.png');
await shot({ width: 1280, height: 800 }, 'skilltree-desktop.png');

await browser.close();
server.close();

console.log('\n=== Skill-tree flow (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));
console.log('Screenshots →', OUT);

const checks = ['leveledOnce','noScreenMidWave','pointBanked','fightKeptRunning','twoBanked',
  'shopOpensSkillTree','spendSucceeded','pointConsumed','nodeAllocated','damageBonusApplied',
  'lockedNodeUnbuyable','childUnlocksAfterParent','continueLandsOnShop','reopensFromShop',
  'doubleAllocateBlocked','newRunResetsTree','bonusesResetToIdentity'];
const pass = result && !result.fatal && checks.every(k => result[k] === true) && errors.length === 0;
console.log(`\n${checks.filter(k => result && result[k] === true).length}/${checks.length} checks passed`);
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
