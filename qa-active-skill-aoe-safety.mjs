#!/usr/bin/env node
/**
 * qa-active-skill-aoe-safety.mjs — AoeZone self-hit regression guard for ALL 34 active skills
 *
 * The AoeZone(damage=N) class hits the PLAYER (not enemies). Several bugs were found and fixed
 * where active skills accidentally used AoeZone(damage>0) for their visual effects:
 *   - plague_bomb (Jul 09 2026): AoeZone had damage=baseDmg/5 → self-hit; fixed → damage=0
 *   - Overcharge Battery (Jul 18 2026): nova AoeZone had damage=ocDmg → self-hit; fixed → damage=0
 *
 * This test fires ALL 34 active skills and asserts: any new AoeZone spawned has damage === 0.
 * Skills that spawn no AoeZones are marked SKIP (no AoeZone risk).
 *
 * This replaces the need for 34 individual skill-specific AoeZone tests. Running this file
 * after any active-skill addition or refactor catches the whole class at once.
 *
 * Usage: CHROME_BIN=/usr/bin/chromium node qa-active-skill-aoe-safety.mjs
 */

import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'frontend/dist');

const server = http.createServer((req, res) => {
  let fp = path.join(DIST, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(fp)) fp = path.join(DIST, 'index.html');
  const ext = path.extname(fp).slice(1);
  const mime = { html: 'text/html', js: 'application/javascript', css: 'text/css', png: 'image/png' };
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  headless: true,
});
const page = await browser.newPage();
const pageErrors = [];
page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });

// All 34 active skills (skill_id → scroll_item_id)
const SKILLS = [
  ['arcane_barrage',   'scroll_arcane_barrage'],
  ['armageddon',       'scroll_armageddon'],
  ['black_hole',       'scroll_black_hole'],
  ['blade_storm',      'scroll_blade_storm'],
  ['blizzard',         'scroll_blizzard'],
  ['blood_nova',       'scroll_blood_nova'],
  ['bone_spear',       'scroll_bone_spear'],
  ['chain_lightning',  'scroll_chain_lightning'],
  ['circle_power',     'scroll_circle_power'],
  ['crystal_burst',    'scroll_crystal_burst'],
  ['curse_wave',       'scroll_curse_wave'],
  ['divine_wrath',     'scroll_divine_wrath'],
  ['doom_comet',       'scroll_doom_comet'],
  ['earthquake',       'scroll_earthquake'],
  ['frost_nova',       'scroll_frost_nova'],
  ['gravity_pull',     'scroll_gravity_pull'],
  ['hellfire_rain',    'scroll_hellfire_rain'],
  ['inferno_aura',     'scroll_inferno_aura'],
  ['lightning_storm',  'scroll_lightning_storm'],
  ['meteor',           'scroll_meteor'],
  ['mirror_strike',    'scroll_mirror_strike'],
  ['orbital_strike',   'scroll_orbital_strike'],
  ['phoenix_beam',     'scroll_phoenix_beam'],
  ['plague_bomb',      'scroll_plague_bomb'],
  ['poison_cloud',     'scroll_poison_cloud'],
  ['rune_field',       'scroll_rune_field'],
  ['shadow_step',      'scroll_shadow_step'],
  ['soul_shatter',     'scroll_soul_shatter'],
  ['spectral_dash',    'scroll_spectral_dash'],
  ['spectral_shield',  'scroll_spectral_shield'],
  ['thunder_clap',     'scroll_thunder_clap'],
  ['time_warp',        'scroll_time_warp'],
  ['vampire_burst',    'scroll_vampire_burst'],
  ['void_pulse',       'scroll_void_pulse'],
];

const results = await page.evaluate((SKILLS) => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g || !DB) return { fatal: 'missing __game or __ItemDatabase' };

  const skillResults = [];

  for (const [skillId, scrollId] of SKILLS) {
    // ─── 1. Check scroll exists in catalog ──────────────────────────────────────
    const scroll = DB.getItemById(scrollId);
    if (!scroll) {
      skillResults.push({ skillId, scrollId, status: 'MISS', note: 'scroll not in DB' });
      continue;
    }
    if (scroll.activatesSkill !== skillId) {
      skillResults.push({ skillId, scrollId, status: 'MISS', note: `activatesSkill=${scroll.activatesSkill}` });
      continue;
    }

    // ─── 2. Fresh run + equip scroll ────────────────────────────────────────────
    try {
      g.startNewGame();
    } catch (e) {
      skillResults.push({ skillId, scrollId, status: 'ERROR', note: `startNewGame threw: ${e.message}` });
      continue;
    }
    g.playerStats.addItem(scroll);
    g.state = 'playing';
    try { g.update(0); } catch (_) { /* ignore update errors, just need initial state */ }
    if (!g.player) {
      skillResults.push({ skillId, scrollId, status: 'ERROR', note: 'player null after startNewGame' });
      continue;
    }

    // ─── 3. Position player + inject fake enemy ──────────────────────────────────
    g.player.x = 400;
    g.player.y = 300;
    const origEnemies = g.enemies;
    // Comprehensive fake enemy matching the real Enemy class shape:
    // - typeData: needed for e.typeData.isBoss and e.typeData.radius/damage
    // - statusFX: needed for statusFX.apply(t, opts) calls in some skills
    // - takeDamage: needed for direct-damage skills
    const fakeEnemy = {
      x: 420, y: 300,
      dead: false, enraged: false, invulnerable: false,
      health: 100, maxHealth: 100,
      hp: 100, maxHp: 100,          // alias some skills use
      poisonTimer: 0, burnTimer: 0, frozenTimer: 0, slowTimer: 0,
      bleedTimer: 0, doomTimer: 0, doomStored: 0,
      slowFactor: 1, woundMult: 1,
      poisonSpreads: false, daggerDot: false,
      hitFlashTimer: 0, contactCooldown: 0,
      knockbackVelocityX: 0, knockbackVelocityY: 0,
      typeData: { isBoss: false, radius: 30, damage: 10, shootRate: 0 },
      // statusFX: stub; skills call statusFX.apply(type, opts)
      statusFX: { apply: () => null, applySynergyChain: () => null },
      // takeDamage: stub returning [] (no kill procs)
      takeDamage: () => [],
      get radius() { return this.typeData.radius; },
    };
    g.enemies = [fakeEnemy];

    // ─── 4. Record baseline ──────────────────────────────────────────────────────
    const aoeZonesBefore = g.aoeZones ? g.aoeZones.length : 0;
    const playerHpBefore = g.player.hp;

    // ─── 5. Fire the skill ───────────────────────────────────────────────────────
    g.activeSkillCooldown = 0;
    let fireError = null;
    try {
      g.useActiveSkill('q');
    } catch (e) {
      fireError = e.message;
    }

    // ─── 6. Restore enemies ──────────────────────────────────────────────────────
    g.enemies = origEnemies;

    // ─── 7. Collect + classify ───────────────────────────────────────────────────
    const newAoeZones = g.aoeZones ? g.aoeZones.slice(aoeZonesBefore) : [];
    const selfHitZones = newAoeZones.filter(z => typeof z.damage === 'number' && z.damage > 0);
    const playerHpAfter = g.player.hp;

    if (fireError) {
      skillResults.push({ skillId, scrollId, status: 'ERROR', note: fireError });
    } else if (selfHitZones.length > 0) {
      skillResults.push({
        skillId, scrollId, status: 'FAIL',
        note: `${selfHitZones.length} AoeZone(s) with damage>0: ${JSON.stringify(selfHitZones.map(z => z.damage))}`,
      });
    } else if (newAoeZones.length === 0) {
      // No AoeZones spawned — this skill doesn't use AoeZones (not a risk)
      skillResults.push({ skillId, scrollId, status: 'SKIP', note: 'no AoeZones spawned' });
    } else {
      skillResults.push({
        skillId, scrollId, status: 'PASS',
        note: `${newAoeZones.length} AoeZone(s) all damage=0`,
      });
    }
  }

  return { skillResults };
}, SKILLS);

await browser.close();
server.close();

if (results.fatal) {
  console.error('FATAL:', results.fatal);
  process.exit(1);
}

let pass = 0, fail = 0, skip = 0, miss = 0, err = 0;
for (const r of results.skillResults) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'SKIP' ? '⬜' :
               r.status === 'FAIL' ? '❌' : r.status === 'MISS' ? '⚠️' : '💥';
  console.log(`${icon} ${r.skillId.padEnd(20)} [${r.status}] ${r.note}`);
  if (r.status === 'PASS') pass++;
  else if (r.status === 'SKIP') skip++;
  else if (r.status === 'FAIL') fail++;
  else if (r.status === 'MISS') miss++;
  else err++;
}

if (pageErrors.length) console.log('\npage errors:', pageErrors.slice(0, 5));

console.log(`\nSummary: ${pass} PASS, ${skip} SKIP (no AoeZones), ${fail} FAIL, ${miss} MISS, ${err} ERROR`);
console.log(fail > 0
  ? `\nFAIL — ${fail} skill(s) spawn AoeZones with damage>0 (self-hit risk)`
  : `\nPASS — all skills with AoeZones use damage=0 (no self-hit risk)`);

process.exit(fail > 0 ? 1 : 0);
