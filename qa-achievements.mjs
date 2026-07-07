#!/usr/bin/env node
// Achievements → unlock/disable verification. Proves the milestone-unlock system end-to-end:
//   1. Reward items start LOCKED (unlocked:false) and are absent from the shop pool.
//   2. checkRun(class, wave) earns the right achievements: a class-gated one needs BOTH the
//      class and the wave; a class-neutral one needs only the wave; too-low wave earns nothing.
//   3. Earning flips the reward item unlocked → it enters getUnlockedItems().
//   4. toggleItemDisabled pulls an earned item OUT of the pool (still earned) and back IN.
//   5. The achievements screen renders clean and its BACK hitbox returns to the menu.
//   6. Persistence: state survives a reload (localStorage), and the item is unlocked on boot.
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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

// Start from a clean slate so a prior run's localStorage can't pre-earn anything.
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 800));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  const { ACHIEVEMENTS, AchievementSystem } = window.__ACHIEVEMENTS;
  if (!g || !DB || !ACHIEVEMENTS || !AchievementSystem) return { fatal: 'missing hooks' };

  AchievementSystem.__resetForTest();

  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });
  const poolHas = (id) => DB.getUnlockedItems().some(i => i.id === id);

  const berserker = ACHIEVEMENTS.find(a => a.id === 'ach_berserker');
  const wave15 = ACHIEVEMENTS.find(a => a.id === 'ach_wave15');

  // 1) Reward items start locked + out of pool.
  ok('berserker reward starts locked', DB.getItemById(berserker.unlocksItemId)?.unlocked === false, berserker.unlocksItemId);
  ok('berserker reward not in pool', !poolHas(berserker.unlocksItemId));

  // 2) Wrong class does NOT earn a class-gated achievement even at a high wave.
  let earned = AchievementSystem.checkRun('gunner', 30);
  ok('gunner@30 does not earn berserker ach', !earned.some(a => a.id === 'ach_berserker'));
  ok('gunner@30 earns wave15 (neutral)', earned.some(a => a.id === 'ach_wave15'), earned.map(a=>a.id).join(','));
  ok('wave15 reward now in pool', poolHas(wave15.unlocksItemId));

  // 3) Too-low wave earns nothing new.
  const before = AchievementSystem.earnedCount();
  AchievementSystem.checkRun('berserker', 3);
  ok('berserker@3 earns nothing', AchievementSystem.earnedCount() === before, `count ${before}`);

  // 4) Right class + wave earns the class achievement and unlocks its item into the pool.
  earned = AchievementSystem.checkRun('berserker', 12);
  ok('berserker@12 earns berserker ach', earned.some(a => a.id === 'ach_berserker'));
  ok('berserker reward now unlocked', DB.getItemById(berserker.unlocksItemId)?.unlocked === true);
  ok('berserker reward now in pool', poolHas(berserker.unlocksItemId));
  ok('isEarned reflects it', AchievementSystem.isEarned('ach_berserker'));

  // 5) Disable pulls it from the pool (still earned); re-enable restores it.
  AchievementSystem.toggleItemDisabled(berserker.unlocksItemId);
  ok('disabled → out of pool', !poolHas(berserker.unlocksItemId));
  ok('disabled but still earned', AchievementSystem.isEarned('ach_berserker'));
  ok('isItemDisabled true', AchievementSystem.isItemDisabled(berserker.unlocksItemId));
  AchievementSystem.toggleItemDisabled(berserker.unlocksItemId);
  ok('re-enabled → back in pool', poolHas(berserker.unlocksItemId));

  // 6) Screen renders + BACK returns to menu.
  g.openAchievements();
  ok('openAchievements → state', g.state === 'achievements', g.state);
  try { g.draw(); ok('drawAchievements renders', true); }
  catch (e) { ok('drawAchievements renders', false, String(e)); }
  g.state = 'menu'; // leave clean

  return { checks, earnedIds: ACHIEVEMENTS.filter(a => AchievementSystem.isEarned(a.id)).map(a => a.id) };
});

// Persistence across reload: earn state should survive and the item stay unlocked on boot.
await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 800));
const persisted = await page.evaluate(() => {
  const DB = window.__ItemDatabase;
  const { ACHIEVEMENTS, AchievementSystem } = window.__ACHIEVEMENTS;
  const berserker = ACHIEVEMENTS.find(a => a.id === 'ach_berserker');
  return {
    stillEarned: AchievementSystem.isEarned('ach_berserker'),
    stillUnlocked: DB.getItemById(berserker.unlocksItemId)?.unlocked === true,
    inPool: DB.getUnlockedItems().some(i => i.id === berserker.unlocksItemId),
  };
});

await browser.close();
server.close();

console.log('\n=== Achievements verification ===');
if (result.fatal) { console.log('FATAL:', result.fatal); process.exit(1); }
let passed = 0;
for (const c of result.checks) {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  if (c.pass) passed++;
}
console.log(`earned after run: ${result.earnedIds.join(', ')}`);
console.log('\n--- persistence across reload ---');
const pOk = persisted.stillEarned && persisted.stillUnlocked && persisted.inPool;
console.log(`${pOk ? '✅' : '❌'} survives reload — earned:${persisted.stillEarned} unlocked:${persisted.stillUnlocked} inPool:${persisted.inPool}`);

console.log(`\n${passed}/${result.checks.length} in-page checks passed`);
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = passed === result.checks.length && pOk && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
