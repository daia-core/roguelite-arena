#!/usr/bin/env node
// PARITY test for the PlayerStats memoization refactor. Proves the memoized item
// aggregation returns EXACTLY what an independent from-scratch re-loop over the item
// list computes — for every numeric/boolean getter, after every incremental add, and
// after removals (to prove the invalidation on add/remove is correct).
//
// It reconstructs each getter's math independently in the page, from stats.items +
// the same base/meta/transformation/duo/artifact fields, and asserts equality. Any
// drift (a getter still reading a stale cache, a missed field) fails loudly.
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
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };

  const approx = (a, b) => Math.abs(a - b) < 1e-9;

  // Independent recomputation of every getter, purely from stats.items + the same
  // side fields the real getters read. Mirrors the pre-refactor loop math exactly.
  const expected = (s) => {
    const items = s.items;
    const prod = (key) => { let m = 1; for (const i of items) if (i[key]) m *= i[key]; return m; };
    const sum  = (key) => { let a = 0; for (const i of items) if (i[key]) a += i[key]; return a; };
    const any  = (key) => items.some(i => i[key]);
    const tf = s.transformations.getTotalBonuses();
    const du = s.duos.getTotalBonuses();

    // getWeaponSpecialization / getSpecializationBonus (unchanged, recompute for getDamage)
    let melee = 0, ranged = 0;
    for (const i of items) { if (i.tags.includes('melee')) melee++; if (i.tags.includes('ranged')) ranged++; }
    const spec = (melee>0&&ranged===0)?'melee':(ranged>0&&melee===0)?'ranged':(melee>0&&ranged>0)?'mixed':'none';
    const specBonus = (spec==='melee'||spec==='ranged')?1.2:1.0;

    // DIMINISHING RETURNS (2026-07-05): the item damage multiplier passes through a
    // soft knee before it multiplies in — mirror softKneeDamageMult from the game.
    const KNEE = s.constructor.DMG_DR_KNEE, DREXP = s.constructor.DMG_DR_EXP;
    const knee = (m) => (m > KNEE ? KNEE * Math.pow(m / KNEE, DREXP) : m);
    // AGGREGATE KNEE (2026-07-06): getDamage() wraps its FINAL product in a second soft
    // knee so a fully-stacked build stays finite. Mirror it here (applied to the whole
    // product, incl. skillDamageMult) so every downstream getter inherits the same
    // compressed base the real getters do.
    const AKNEE = s.constructor.DMG_AGG_KNEE, AEXP = s.constructor.DMG_AGG_EXP;
    const aggKnee = (d) => (d > AKNEE ? AKNEE * Math.pow(d / AKNEE, AEXP) : d);
    // CRIT KNEE (2026-07-06): getCritMultiplier() passes the crit product through its
    // own soft knee (crit was the last unbounded damage axis). Mirror critKneeMultiplier.
    const CKNEE = s.constructor.CRIT_KNEE, CEXP = s.constructor.CRIT_EXP;
    const critKnee = (m) => (m > CKNEE ? CKNEE * Math.pow(m / CKNEE, CEXP) : m);
    const damage = aggKnee(s.baseDamage * knee(prod('damageMultiplier')) * specBonus
      * tf.damageMultiplier * du.damageMultiplier * s.artifactDamageMult * s.runtimeDamageMult
      * s.skillDamageMult);
    // UNIVERSALITY (2026-07-05): each damage-type mult keeps its own bonus and bleeds
    // CROSS_TYPE_BLEED of the OTHER type's bonus above baseline. Mirror the getters
    // (including the same soft knee applied to the combined type multiplier).
    const BLEED = s.constructor.CROSS_TYPE_BLEED;
    const rawMelee = prod('meleeDamageMult');
    const rawRanged = prod('rangedDamageMult');
    const meleeDamageMult = knee(rawMelee * (1 + (rawRanged - 1) * BLEED));
    const rangedDamageMult = knee(rawRanged * (1 + (rawMelee - 1) * BLEED));
    const meleeDamage = damage * meleeDamageMult;
    // getFireRate now also bleeds in swing-cooldown items (melee attack-speed helps the gun).
    const swingCd = prod('swingCooldownMult');
    let fireRate = s.baseFireRate * prod('fireRateMultiplier');
    if (swingCd !== 1) fireRate /= 1 + (swingCd - 1) * BLEED;
    fireRate *= tf.fireRateMultiplier * du.fireRateMultiplier * s.artifactFireRateMult * s.runtimeFireRateMult;
    const piercing = sum('piercing') + du.piercing;
    const multishot = sum('multishot');

    return {
      getDamage: damage,
      getMeleeDamageMult: meleeDamageMult,
      getRangedDamageMult: rangedDamageMult,
      getElementalDamageMult: prod('elementalDamageMult'),
      getMeleeDamage: meleeDamage,
      getRangedDamage: damage * rangedDamageMult,
      getFireRate: fireRate,
      getSpeed: Math.min(s.baseSpeed * prod('speedMultiplier') * tf.speedMultiplier * du.speedMultiplier * s.artifactSpeedMult, s.maxSpeed),
      getMaxHealth: Math.max(1, s.baseMaxHealth + sum('maxHealthBonus') + tf.maxHealthBonus + s.artifactMaxHealthBonus),
      getCritChance: Math.min(1, s.baseCritChance + sum('critChance') + tf.critChance + du.critChance + s.artifactCritChanceBonus),
      getCritMultiplier: Math.min(s.constructor.SANITY_MULT_CAP, critKnee(
        s.baseCritMultiplier * prod('critDamageMultiplier') * tf.critDamageMultiplier
        * s.artifactCritMultMult * s.skillCritMultMult)),
      getHealthRegen: sum('healthRegen'),
      getArmor: s.metaArmor + sum('armor') + tf.armor,
      getLifesteal: Math.min(1, sum('lifesteal') + du.lifesteal),
      getThorns: sum('thorns'),
      getProjectileSpeed: s.baseProjectileSpeed * prod('projectileSpeed'),
      getKnockback: sum('knockback'),
      getPiercing: sum('piercing') + du.piercing,
      getXPMagnet: Math.min(s.constructor.XP_MAGNET_CAP, prod('xpMagnet') * tf.xpMagnet),
      getGoldBonus: Math.min(s.constructor.GOLD_MULT_CAP, prod('goldBonus') * tf.goldBonus),
      getDodgeChance: Math.min(s.constructor.DODGE_CAP, sum('dodge')),
      getChainLightningChance: Math.min(1, sum('chainLightning') + du.chainLightning),
      getFreezeChance: Math.min(1, sum('freeze') + du.freeze),
      getBurnChance: Math.min(1, sum('burn')),
      getBleedChance: Math.min(1, sum('bleed')),
      hasPoisonSpread: any('poisonSpread'),
      getDoomChance: Math.min(1, sum('doom')),
      getWoundChance: Math.min(1, sum('wound')),
      getMulticastChance: Math.min(0.9, sum('multicast')),
      getRerollDiscount: Math.min(0.9, sum('rerollDiscount')),
      getShopDiscount: Math.min(0.3, sum('shopDiscount') + tf.shopDiscount),
      getInterestBonus: Math.min(0.4, sum('interestBonus')),
      getLuck: Math.min(1.0, sum('luck')),
      hasExplosionOnHit: any('explosionOnHit'),
      hasShield: any('shield'),
      hasHoming: any('homing'),
      hasPoison: any('poison'),
      getMultishot: sum('multishot'),
      getOrbitOrbCount: sum('orbitOrbs'),
      getOrbitDamage: damage * 0.9 * prod('orbitDamageMult'),
      hasAuxMelee: any('auxMelee'),
      getAuxMeleeDamage: meleeDamage * 1.1 * prod('auxMeleeDamageMult'),
      getSwingDamage: meleeDamage * (0.6 * prod('swingDamageMult') * prod('auxMeleeDamageMult')),
      getSwingRange: 70 + sum('swingRangeBonus') + piercing * 12,
      getSwingArc: Math.min(Math.PI*0.7 + sum('swingArcBonus') + multishot * (Math.PI*0.06), Math.PI*2),
      getSwingInterval: 0.85 * prod('swingCooldownMult'),
      getAoeRadiusMult: prod('aoeRadiusMult'),
      getSwingAoe: sum('swingAoe') * prod('aoeRadiusMult'),
      hasBombDrop: any('bombDrop'),
      getBombDamage: damage * 3.0 * prod('bombDamageMult'),
      getBombCooldown: Math.max(0.6, 3.5 * prod('bombCooldownMult')),
      hasNova: any('novaPulse'),
      getNovaDamage: damage * 1.6 * prod('novaDamageMult'),
      getNovaCooldown: Math.max(0.8, 4.0 * prod('novaCooldownMult')),
    };
  };

  const actual = (s) => {
    const o = {};
    for (const k of Object.keys(expected(s))) o[k] = s[k]();
    return o;
  };

  const compareOnce = (s, label, mismatches) => {
    const exp = expected(s);
    const act = {};
    for (const k of Object.keys(exp)) act[k] = s[k]();
    for (const k of Object.keys(exp)) {
      const e = exp[k], a = act[k];
      const eq = (typeof e === 'boolean') ? (e === a) : approx(e, a);
      if (!eq) mismatches.push(`${label} · ${k}: memo=${a} expected=${e}`);
    }
  };

  const mismatches = [];
  let checks = 0;
  const all = DB.getAllItems();

  // 1) Incremental add: after EACH item added, all getters must match a fresh recompute.
  g.startNewGame();
  const s = g.playerStats;
  for (let n = 0; n < all.length; n++) {
    s.addItem(all[n]);
    compareOnce(s, `add#${n}(${all[n].id})`, mismatches);
    checks++;
    if (mismatches.length > 8) break; // stop early on a clear failure
  }

  // 2) Removal path: strip items back down, checking invalidation each time.
  if (mismatches.length === 0) {
    for (let n = all.length - 1; n >= 0; n -= 7) {
      const id = s.items[Math.floor(s.items.length/2)]?.id;
      if (id) { s.removeItem(id); compareOnce(s, `rm→${s.items.length}`, mismatches); checks++; }
      if (mismatches.length > 8) break;
    }
  }

  // 3) A realistic mixed loadout snapshot, plus meta armor set (exercise metaArmor path).
  if (mismatches.length === 0) {
    g.startNewGame();
    const s2 = g.playerStats;
    s2.metaArmor = 12;
    const pick = ['damage_t1','crit_chance_t2','lifesteal_t2','orbit_orb_t2','whirl_blades_t2','nova_core_t3','luck_charm_t2'];
    for (const id of pick) { const it = DB.getItemById(id); if (it) s2.addItem(it); }
    compareOnce(s2, 'mixed+meta12', mismatches);
    checks++;
  }

  return { checks, mismatchCount: mismatches.length, mismatches: mismatches.slice(0, 12), itemsTested: all.length };
});

await browser.close();
server.close();

console.log('\n=== PlayerStats memoization parity (shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result && !result.fatal && result.mismatchCount === 0 && result.checks > 100 && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
