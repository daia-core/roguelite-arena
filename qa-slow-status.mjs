// qa-slow-status.mjs — prove the new Slow/Chill status is wired end-to-end through the
// SAME harness the other status engines use: a real enemy, real g.update(dt) ticking, and
// the real applyOnHitEffects path. Also confirms the tripled catalog loads with no errors.
// Exercises the entity/status path I touched (game-dev regression rule).
import puppeteer from 'puppeteer-core';

const base = 'http://localhost:4173/';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g) return { fatal: 'no __game handle' };
  if (!DB) return { fatal: 'no __ItemDatabase handle' };
  const out = {};

  out.catalogCount = DB.getAllItems ? DB.getAllItems().length : (DB.items ? DB.items.length : null);

  const giveItem = (id) => { const it = DB.getItemById(id); if (!it) return false; g.playerStats.addItem(it); return true; };
  const forcePlaying = () => { g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing'; };
  const NO = { shouldShoot:false, shouldTeleport:false, shouldSummon:false, shouldScream:false, shouldStomp:false, splitInto:0, poisonTrail:false, sporeCloud:false, shouldHeal:false, shouldSpawnMinion:false };
  const dummy = (x, y, hp = 1e9) => {
    const e = {
      id: Math.floor(Math.random()*1e6), type: 'slime', x, y,
      radius: 14, dead: false, health: hp, hp,
      frozenTimer: 0, slowTimer: 0, slowFactor: 1, poisonTimer: 0, burnTimer: 0, bleedTimer: 0,
      poisonSpreads: false, woundMult: 1, doomTimer: 0, doomStored: 0, lastX: x, lastY: y,
      contactCooldown: 999, usePathfinding: false,
      typeData: { isBoss:false, damage:5, xpValue:1, goldValue:1, radius:14 },
      knockbackVelocityX:0, knockbackVelocityY:0, hitFlashTimer:0,
      // Minimal StatusEffectManager stub (mirrors qa-status-engines) so the new-engine
      // statusFX.tick path runs; the legacy slowTimer/slowFactor assertions still hold.
      statusFX: {
        tick(){ return { dotDamage:0, doomDetonation:null, poisonSpreads:false, daggerDot:false }; },
        has(){ return false; }, get(){ return null; },
        getIncomingDamageMult(){ return 1; }, getDirectHitMult(){ return 1; },
        getFlatHitBonus(){ return 0; }, getBonusCritChanceReceived(){ return 0; },
        getBonusCritDamageReceived(){ return 0; }, checkCondemned(){ return 0; },
        apply(){ return []; }, applySynergyChain(){},
        setBurnTimer(){}, setBleedTimer(){}, setPoisonTimer(){}, setFreezeTimer(){},
      },
      takeDamage(d){ this.health -= d; return null; },
      applyKnockback(){}, checkWallCollision(){}, draw(){}, updatePath(){},
      collidesWith(){ return false; }, update(){ return NO; }
    };
    g.enemies.push(e); return e;
  };
  const stepN = (n) => { for (let i=0;i<n;i++) g.update(1/60); };

  // === A. Slow item grants slow-strength on playerStats ===
  g.startNewGame(); forcePlaying();
  // find a real slow item from the tripled catalog
  const slowItem = DB.getAllItems().find((i) => i.slow && i.slow > 0);
  out.foundSlowItem = slowItem ? slowItem.id : null;
  if (slowItem) giveItem(slowItem.id);
  out.slowStrength = g.playerStats.getSlowStrength();
  out.slowStrengthPositive = out.slowStrength > 0;

  // === B. applyOnHitEffects sets slowTimer + slowFactor on a hit enemy ===
  const e = dummy(g.player.x + 400, g.player.y + 400);
  // call the private on-hit path the same way a real hit would
  g.applyOnHitEffects(e, 20, false);
  out.slowTimerSet = e.slowTimer > 0;
  out.slowFactorReduced = e.slowFactor < 1;
  out.slowFactorValue = Math.round(e.slowFactor * 100) / 100;

  // === C. Game tick decrements slowTimer and restores slowFactor when it expires ===
  const before = e.slowTimer;
  stepN(6); // 0.1s
  out.slowTimerDecays = e.slowTimer < before;
  // run it out fully
  e.slowTimer = 0.05; e.slowFactor = 0.6; stepN(10);
  out.slowFactorRestoredOnExpiry = e.slowFactor === 1 && e.slowTimer <= 0;

  return out;
});

console.log('=== Slow/Chill status + tripled catalog ===');
console.log(JSON.stringify(result, null, 2));
console.log('console/page errors:', errors.length);
if (errors.length) console.log(errors.slice(0, 5));

const pass = result && !result.fatal &&
  result.catalogCount >= 1000 &&
  result.slowStrengthPositive &&
  result.slowTimerSet && result.slowFactorReduced &&
  result.slowTimerDecays && result.slowFactorRestoredOnExpiry &&
  errors.length === 0;
console.log('RESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
await browser.close();
process.exit(pass ? 0 : 1);
