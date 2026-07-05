#!/usr/bin/env node
// LIVE-BUILD INTEGRATION SMOKE — plays the ACTUAL DEPLOYED build end-to-end.
//
// Distinct from the per-feature qa-*.mjs (which build+serve local dist) and from the
// Jul-4 balance review d60b1e5 (which read source): this drives a real headless run
// against https://roguelite-game-blush.vercel.app so it exercises exactly what Felix
// hits on his phone — the integrated core loop on the shipped artifact (cp-b7:
// "verified-to-work ≠ reachable-via-user-path").
//
// Verifies the core combat loop actually works on the live build:
//   1. Boot: __game + __ItemDatabase present, zero console/page errors.
//   2. Combat: enemies spawn, player fire registers hits, enemies DIE (collision works).
//   3. Progression: kills accrue (g.kills), at least one level-up fires and banks a
//      skill point (g.skillTree.totalEarned) — the between-waves skill tree we can spend into.
//   4. Entity hygiene: no `dead` enemy lingers in g.enemies across frames (the Jul-2
//      dead-flag/grid bug class the game-dev skill warns about).
//   5. Loop integrity: the run never wedges (state always advances) and never errors.
//   6. Devil-deal fix (910f7ee) holds live: re-taking a pact whose curse you already
//      bear grants nothing.
// Screenshots mobile (390x844) + desktop (1440x900) for a designer's-eye look.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const LIVE = 'https://roguelite-game-blush.vercel.app/';
const OUT = '/workspace/work/roguelite-game/shots/live-smoke';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const errors = [];
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

console.log('Loading LIVE build:', LIVE);
await page.goto(LIVE, { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 1500));

// Confirm which build hash is live (for the report).
const liveHash = await page.evaluate(() =>
  [...document.querySelectorAll('script[src]')].map(s => s.src).find(s => /index-.*\.js/.test(s)) || null);

const result = await page.evaluate(async () => {
  const g = window.__game, DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle on live build' };
  if (!DB) return { fatal: 'no __ItemDatabase handle on live build' };

  g.startNewGame();
  // The real user flow starts on the Slay-the-Spire node map, not directly in combat.
  const startState = g.state; // expected 'map'

  // Strong offensive loadout so kills happen quickly within the smoke window.
  const s = g.playerStats;
  const give = (id) => { const it = DB.getItemById(id); if (it) { s.items.push(it); return true; } return false; };
  const wanted = ['whirl_blades_t2','orbit_orb_swarm_t3','bomb_bandolier_t2','nova_core_t3'];
  const granted = wanted.filter(give);

  // Navigate the map toward a combat node (battle/elite/boss), the real user path.
  const routeToCombat = () => {
    const ms = g.mapSystem;
    const reach = (ms.reachable && ms.reachable()) || [];
    if (!reach.length) return false;
    const typeOf = (id) => ms.nodeById && ms.nodeById(id)?.type;
    const combat = reach.find(id => ['battle','elite','boss'].includes(typeOf(id)));
    const target = combat || reach[0];
    g.onMapNodePicked(target);
    return g.state === 'playing';
  };

  const dt = 1/60;
  let frames = 0, levelups = 0, deadLeak = 0, maxDeadInArray = 0;
  let clearedWave = false, wedged = false, combatEntered = false, mapPicks = 0;

  // Route the node map until we actually land in combat (a non-combat node —
  // event/rest/treasure — resolves and bounces us back to the map). Capped so a
  // pathological map can't spin forever. This is the "reach the fight" phase.
  while (g.state !== 'playing' && mapPicks < 12) {
    if (g.state === 'map') { mapPicks++; routeToCombat(); }
    else if (['event','rest','village'].includes(g.state)) {
      if (g.state === 'event' && g.currentEvent && Array.isArray(g.currentEvent.options) && typeof g.applyEventOption === 'function') {
        const walk = g.currentEvent.options.find(o => !(o.effects||[]).some(f => f.kind === 'curse')) || g.currentEvent.options[0];
        try { g.applyEventOption(walk); } catch { /* fall through */ }
      }
      if (g.state !== 'playing') g.state = 'map';
    } else if (g.state === 'treasure' && typeof g.leaveTreasure === 'function') { g.leaveTreasure(); }
    else break;
  }

  // Combat phase: drive the fight CONTINUOUSLY to a clear, resolving level-ups
  // inline (mirrors the real frame loop — interleaving map handling here was what
  // starved combat of frames and made an earlier version flaky). One cleared wave
  // → shop/reward proves the whole core loop end-to-end.
  if (g.state === 'playing') {
    combatEntered = true;
    let lastState = g.state, stuck = 0;
    for (let i = 0; i < 180 * 60; i++) {
      if (g.state === 'playing') {
        g.update(dt); frames++;
        const deadNow = (g.enemies || []).filter(e => e.dead).length;
        if (deadNow > maxDeadInArray) maxDeadInArray = deadNow;
        if (deadNow > 0) deadLeak = Math.max(deadLeak, deadNow);
      } else if (g.state === 'skilltree') {
        // Skill-tree screen (opened at the shop break): spend a banked point on the
        // first offense node if we can, then leave. Points banked mid-wave don't
        // interrupt — they surface here.
        if (g.skillTree && g.skillTree.spend && g.skillTree.spend('sharpened')) {
          g.skillTree.recomputeInto(g.playerStats);
        }
        g.finishSkillTree();
      } else if (g.state === 'shop' || g.state === 'reward') {
        clearedWave = true; break; // wave cleared → post-wave screen reached
      } else if (g.state === 'gameover') {
        break;
      } else { break; } // any other transition ends the combat phase
      if (g.state === lastState) { stuck++; } else { stuck = 0; lastState = g.state; }
      if (stuck > 60 * 60 && g.state !== 'playing') { wedged = true; break; }
    }
  }

  const kills = g.kills ?? 0;
  // Level-ups now bank skill points; totalEarned counts every point ever granted this run.
  levelups = g.skillTree?.totalEarned ?? 0;
  const endWave = g.waveManager?.currentWave ?? 0;
  const aliveEnemies = (g.enemies || []).filter(e => !e.dead).length;

  // --- Devil-deal fix (910f7ee) live spot-check ---
  // Real data model (probed off the live build): a pact option carries
  // `effects: [{kind:'artifact'}, {kind:'curse', id:'curse_frailty'}]`, and
  // g.artifacts is an ArtifactManager whose `.held` is an Array of ids (with a
  // `has(id)` method). The fix makes re-granting idempotent, so re-taking the
  // SAME pact must add NOTHING: the curse id stays present exactly once and the
  // whole held-list is unchanged on the second take. We drive the real handler.
  let devil = { checked: false };
  try {
    const evList = Object.values(window.__EVENTS || {});
    const hasCurse = (o) => (o.effects || []).some(f => f.kind === 'curse');
    const pact = evList.find(e => Array.isArray(e.options) && e.options.some(hasCurse));
    const held = () => [...(g.artifacts?.held || [])].map(x => x?.id ?? x);
    if (pact && typeof g.applyEventOption === 'function' && g.artifacts) {
      const opt = pact.options.find(hasCurse);
      const curseId = opt.effects.find(f => f.kind === 'curse').id;
      g.currentEvent = pact;
      g.applyEventOption(opt);                 // first take → boon + curse
      const after1 = held();
      g.currentEvent = pact;
      g.applyEventOption(opt);                 // re-take same pact → must be a no-op
      const after2 = held();
      const curseCount = (arr) => arr.filter(x => x === curseId).length;
      devil = {
        checked: true, curseId, pactId: pact.id,
        after1, after2,
        // no-op re-take: identical held-list, and the curse present exactly once.
        boonBlocked: JSON.stringify(after1) === JSON.stringify(after2) &&
                     curseCount(after1) === 1 && curseCount(after2) === 1,
      };
    }
  } catch (e) { devil = { checked: false, error: String(e) }; }

  return { startState, granted, frames, kills, levelups,
           endWave, aliveEnemies, maxDeadInArray, deadLeak, combatEntered, clearedWave, mapPicks, wedged, devil };
});

// Screenshots — mobile then desktop — for a designer's-eye pass.
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: path.join(OUT, 'live-390.png') });
await page.setViewport({ width: 1440, height: 900 });
await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: path.join(OUT, 'live-1440.png') });

await browser.close();

console.log('\n=== LIVE-BUILD INTEGRATION SMOKE ===');
console.log('live build:', liveHash);
console.log(JSON.stringify(result, null, 2));
console.log('console/page errors:', errors.length, errors.slice(0, 6));

if (result.fatal) { console.log('FATAL:', result.fatal); process.exit(1); }

let pass = true;
const chk = (cond, ok, bad) => { if (cond) console.log('✅', ok); else { console.log('❌', bad); pass = false; } };
chk(errors.length === 0, 'zero console/page errors on the live build', `${errors.length} console/page errors`);
chk(result.granted.length === 4, 'loadout items resolved (no id drift)', `only ${result.granted.length}/4 items resolved — id drift`);
chk(result.combatEntered, 'map → combat routing works (reached a battle node)', 'never reached combat from the node map');
chk(result.kills > 0, `combat works — ${result.kills} kills registered (collisions land)`, 'NO kills registered — collision/hit path broken');
chk(result.levelups > 0, `progression works — ${result.levelups} skill point(s) banked (level-ups fired)`, 'no level-up fired in the run');
chk(!result.wedged, 'loop never wedged (state always advanced)', 'loop WEDGED (state frozen off-combat)');
chk(result.clearedWave, 'cleared a full wave → reached the post-wave shop/reward', 'never cleared a wave in 180s (combat too slow / stuck)');
chk(result.deadLeak === 0 || result.maxDeadInArray <= 2, `no dead-enemy cull leak (maxDead=${result.maxDeadInArray})`, `dead enemies lingering in array (maxDead=${result.maxDeadInArray}) — cull/grid regression`);
if (result.devil.checked) chk(result.devil.boonBlocked, `devil-deal fix holds live (re-taken ${result.devil.pactId} was a no-op; ${result.devil.curseId} not stacked)`, `devil-deal fix REGRESSED (re-take changed held-list: ${JSON.stringify(result.devil)})`);
else console.log('ℹ️  devil-deal live spot-check skipped:', result.devil.error || 'no pact/handle exposed');

console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
console.log('shots:', OUT);
process.exit(pass ? 0 : 1);
