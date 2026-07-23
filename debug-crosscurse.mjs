import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_BIN || '/usr/bin/chromium',
  args: ['--no-sandbox','--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.goto('file://' + path.join(__dirname, 'frontend/dist/index.html'), { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const EVENTS = window.__EVENTS;
  
  function fresh() {
    g.startNewGame();
    g.waveManager.reset();
    g.waveManager.startWave(1);
    g.player.gold = 200;
    g.state = 'event';
  }
  
  fresh();
  g.applyEventEffect({ kind: 'curse', id: 'curse_sloth' });
  
  const rotCrown = EVENTS.find(e => e.id === 'devil_rot_crown');
  const rotCrownOpt = rotCrown?.options.find(o => o.effects.some(f => f.kind === 'curse'));
  
  const maxHpBefore = g.player.maxHealth;
  const artifactsBefore = g.artifacts.held.length;
  const heldBefore = g.artifacts.held.map(a => a.id);
  
  const rotResult = g.applyEventOption(rotCrownOpt);
  
  const maxHpAfter = g.player.maxHealth;
  const heldAfter = g.artifacts.held.map(a => a.id);
  
  return {
    rotCrownCurseId: rotCrownOpt?.effects.find(f => f.kind === 'curse')?.id,
    hadCurseTorporBefore: heldBefore.includes('curse_torpor'),
    maxHpBefore,
    maxHpAfter,
    maxHpDelta: maxHpAfter - maxHpBefore,
    heldBefore,
    heldAfter,
    resultText: rotResult?.resultText,
    alreadyBearMatch: /already bear/i.test(rotResult?.resultText ?? ''),
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
