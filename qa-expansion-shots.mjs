// qa-expansion-shots.mjs — capture mobile + desktop screenshots of the tripled-content build:
// (1) an in-game frame with a Chilled/Slowed enemy (new frost-mote VFX), and
// (2) the shop screen (new items flow through the same offer UI).
// game-dev rule: after a visual change, eyeball mobile (390x844) AND desktop shots.
import puppeteer from 'puppeteer-core';

const base = 'http://localhost:4173/';
const outDir = 'shots';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--no-sandbox'] });

async function shoot(vp, label) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });

  // Start a game and force a Chilled enemy right next to the player, then paint one frame.
  await page.evaluate(() => {
    const g = window.__game;
    const DB = window.__ItemDatabase;
    g.startNewGame();
    g.waveManager.reset(); g.waveManager.startWave(1); g.state = 'playing';
    // grant a slow item so the on-hit path is live
    const slow = DB.getAllItems().find((i) => i.slow && i.slow > 0);
    if (slow) g.playerStats.addItem(DB.getItemById(slow.id));
    // drop a visible enemy near the player and chill it hard for the VFX
    const NO = { shouldShoot:false, shouldTeleport:false, shouldSummon:false, shouldScream:false, shouldStomp:false, splitInto:0, poisonTrail:false, sporeCloud:false, shouldHeal:false, shouldSpawnMinion:false };
    const px = g.player.x, py = g.player.y;
    for (const [dx, dy] of [[70,0],[-70,20],[0,80]]) {
      const e = {
        id: Math.floor(Math.random()*1e6), type:'slime', x:px+dx, y:py+dy, radius:16, dead:false, health:1e9, hp:1e9,
        frozenTimer:0, slowTimer:3, slowFactor:0.6, poisonTimer:0, burnTimer:0, bleedTimer:0, poisonSpreads:false, woundMult:1,
        doomTimer:0, doomStored:0, lastX:px+dx, lastY:py+dy, contactCooldown:999, usePathfinding:false,
        typeData:{ isBoss:false, damage:5, xpValue:1, goldValue:1, radius:16 }, knockbackVelocityX:0, knockbackVelocityY:0, hitFlashTimer:0,
        statusFX:{ tick(){ return { dotDamage:0, doomDetonation:null, poisonSpreads:false, daggerDot:false }; }, has(){ return false; }, get(){ return null; }, getIncomingDamageMult(){ return 1; }, getDirectHitMult(){ return 1; }, getFlatHitBonus(){ return 0; }, getBonusCritChanceReceived(){ return 0; }, getBonusCritDamageReceived(){ return 0; }, checkCondemned(){ return 0; }, apply(){ return []; }, applySynergyChain(){}, setBurnTimer(){}, setBleedTimer(){}, setPoisonTimer(){}, setFreezeTimer(){} },
        takeDamage(d){ this.health-=d; return null; }, applyKnockback(){}, checkWallCollision(){}, draw(){}, updatePath(){},
        collidesWith(){ return false; }, update(){ return NO; }
      };
      g.enemies.push(e);
    }
    g.update(1/60); // paint one frame with the chilled enemies on screen
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${outDir}/expansion-play-${label}.png` });

  // Now open the shop to show items flowing through the offer UI.
  await page.evaluate(() => {
    const g = window.__game;
    g.playerStats.gold = 9999;
    g.enterShop(); // private, but callable at runtime — real between-waves shop with fresh offers
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${outDir}/expansion-shop-${label}.png` });
  await page.close();
}

await shoot({ width: 390, height: 844, deviceScaleFactor: 2 }, 'mobile-390');
await shoot({ width: 1280, height: 800, deviceScaleFactor: 1 }, 'desktop-1280');

console.log('shots written: expansion-play/shop x mobile/desktop');
await browser.close();
