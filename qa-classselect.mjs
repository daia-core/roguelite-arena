#!/usr/bin/env node
// Class-select verification. Proves the run-start loadout picker works end-to-end:
//   1. openClassSelect() enters the 'classselect' state and drawClassSelect() renders clean.
//   2. Each class's beginRun() grants the right starting weapon + stat tilt and lands in 'map'.
//   3. The BRAWLER (melee weaponType) suppresses the gun — tryShoot returns no projectiles —
//      while ranged classes DO fire. (Felix: "start with only a melee weapon etc.")
//   4. Item universality holds: a pure-ranged damage item still lifts melee damage, and a
//      pure-melee damage item still lifts ranged damage (CROSS_TYPE_BLEED), so no dead picks.
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
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  const CLASSES = window.__STARTING_CLASSES;
  if (!g) return { fatal: 'no __game' };
  if (!CLASSES) return { fatal: 'no __STARTING_CLASSES' };

  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail });

  // 1) openClassSelect enters the screen and draws without throwing.
  g.openClassSelect();
  ok('openClassSelect → state', g.state === 'classselect', g.state);
  try { g.draw(); ok('drawClassSelect renders', true); }
  catch (e) { ok('drawClassSelect renders', false, String(e)); }

  // tryShoot needs a target and an off cooldown; give it a dummy enemy right next to
  // the player and forceFire so the cooldown gate is bypassed. The melee-suppression
  // check runs BEFORE the fire, so this cleanly measures "does this loadout shoot a gun".
  const dummyEnemy = (p) => ({ x: p.x + 20, y: p.y, typeData: { isBoss: false } });
  const firesGun = (p) => { try { return p.tryShoot([dummyEnemy(p)], true).length > 0; } catch { return null; } };

  // 2) Each class builds a correct run.
  const perClass = {};
  for (const cls of CLASSES) {
    g.beginRun(cls);
    const p = g.player, st = p.stats;
    const heldIds = st.items.map(i => i.id);
    const info = {
      landedInMap: g.state === 'map',
      selectedId: g.getSelectedClassId(),
      hasStartItem: cls.startItemId ? heldIds.includes(cls.startItemId) : true,
      weaponType: st.getWeaponType(),
      maxHealth: Math.round(p.maxHealth),
      firesGun: firesGun(p),
    };
    perClass[cls.id] = info;
    ok(`${cls.id}: lands in map`, info.landedInMap, g.state);
    ok(`${cls.id}: selectedId set`, info.selectedId === cls.id, info.selectedId);
    ok(`${cls.id}: start weapon granted`, info.hasStartItem, heldIds.join(','));
  }

  // 3) Melee suppression — brawler's weaponType is 'melee' and its gun is suppressed;
  //    the gunner (default auto-aim) DOES fire.
  ok('brawler weaponType=melee', perClass.brawler?.weaponType === 'melee', perClass.brawler?.weaponType);
  ok('brawler gun suppressed', perClass.brawler?.firesGun === false, perClass.brawler?.firesGun);
  ok('gunner gun fires', perClass.gunner?.firesGun === true, perClass.gunner?.firesGun);

  // 4) Stat tilt sanity: brawler is tankier than gunner; arcanist is squishier.
  ok('brawler tankier than gunner', perClass.brawler?.maxHealth > perClass.gunner?.maxHealth,
     `${perClass.brawler?.maxHealth} vs ${perClass.gunner?.maxHealth}`);
  ok('arcanist squishier than gunner', perClass.arcanist?.maxHealth < perClass.gunner?.maxHealth,
     `${perClass.arcanist?.maxHealth} vs ${perClass.gunner?.maxHealth}`);

  // 5) Item universality — a PURE-RANGED damage item lifts melee damage, and a PURE-MELEE
  //    damage item lifts ranged damage (CROSS_TYPE_BLEED = 0.5). Pick items that carry only
  //    one type's multiplier so the cross-bleed is unambiguous.
  const findOneType = (haveKey, lackKey) => DB.getAllItems().find(i => i[haveKey] && i[haveKey] !== 1 && !i[lackKey]);
  const rangedItem = findOneType('rangedDamageMult', 'meleeDamageMult');
  const meleeItem  = findOneType('meleeDamageMult', 'rangedDamageMult');

  if (rangedItem) {
    g.beginRun(CLASSES[0]); // gunner, clean slate
    const st = g.player.stats;
    const meleeBefore = st.getMeleeDamage();
    st.addItem(rangedItem);
    const meleeAfter = st.getMeleeDamage();
    const expectedBleed = 1 + (rangedItem.rangedDamageMult - 1) * st.constructor.CROSS_TYPE_BLEED;
    ok('ranged dmg item lifts melee (bleed)', meleeAfter > meleeBefore + 1e-6,
       `${meleeBefore.toFixed(2)}→${meleeAfter.toFixed(2)} (item ${rangedItem.id} x${rangedItem.rangedDamageMult}, bleed→x${expectedBleed.toFixed(3)})`);
  } else ok('ranged dmg item lifts melee (bleed)', false, 'no single-type ranged item found');

  if (meleeItem) {
    g.beginRun(CLASSES[0]);
    const st = g.player.stats;
    const rangedBefore = st.getRangedDamage();
    st.addItem(meleeItem);
    const rangedAfter = st.getRangedDamage();
    ok('melee dmg item lifts ranged (bleed)', rangedAfter > rangedBefore + 1e-6,
       `${rangedBefore.toFixed(2)}→${rangedAfter.toFixed(2)} (item ${meleeItem.id} x${meleeItem.meleeDamageMult})`);
  } else ok('melee dmg item lifts ranged (bleed)', false, 'no single-type melee item found');

  // Reset to menu so we don't leave a live run around.
  g.state = 'menu';
  return { checks, perClass };
});

await browser.close();
server.close();

console.log('\n=== Class-select verification ===');
if (result.fatal) { console.log('FATAL:', result.fatal); process.exit(1); }
console.log(JSON.stringify(result.perClass, null, 2));
let passed = 0;
for (const c of result.checks) {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
  if (c.pass) passed++;
}
console.log(`\n${passed}/${result.checks.length} checks passed`);
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = passed === result.checks.length && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
