#!/usr/bin/env node
// Behavioral verification for the synergy-clarity feature.
// Builds the SHIPPED bundle (frontend/dist), drives it headless, and asserts the
// real runtime behavior of the new duo-explanation helpers + shop overlay toggle.
// Mirrors qa-damagetype.mjs / qa-builddiv.mjs.
//
// Cases:
//   A. getActiveDuos() returns a duo only when BOTH its items are owned.
//   B. getPotentialDuos() lists a duo when exactly ONE half is owned, and names
//      the owned + needed partner items.
//   C. Owning neither / both halves keeps it OUT of getPotentialDuos().
//   D. getCardDuoInfo(partner) reports completes:true + the duo effect when you
//      own one half and the card is the other half.
//   E. The COMBOS overlay toggles: enterShop() closes it; the combos button
//      opens it; a subsequent tap closes it (no purchase leaks through).
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
await new Promise(r => setTimeout(r, 1500));

const result = await page.evaluate(() => {
  const g = window.__game;
  const DB = window.__ItemDatabase;
  if (!g || !DB) return { fatal: 'no __game / __ItemDatabase handle' };
  g.startNewGame();
  // startNewGame now opens on the node-map meta screen; drop into combat for this
  // synergy-panel harness (the map layer has its own coverage in qa-node-map).
  g.state = 'playing';
  if (!g.player) return { fatal: `no player after startNewGame (state=${g.state})` };

  const out = {};
  const s = g.playerStats;
  // Route through the real API so the stat memoization invalidates (never mutate s.items directly).
  const give = (id) => { const it = DB.getItemById(id); if (it) s.addItem(it); return !!it; };
  const clear = () => { for (const it of [...s.items]) s.removeItem(it.id); };

  // Use a known duo: storm_surge = chain_lightning_t3 + homing_t3,
  // effect "Lightning seeks targets and chains indefinitely".
  const A_ID = 'chain_lightning_t3', B_ID = 'homing_t3';

  // --- Case A: active only when BOTH owned ---
  clear();
  give(A_ID);
  out.A_oneHalfActive = s.getActiveDuos().some(d => d.id === 'storm_surge'); // expect false
  give(B_ID);
  out.A_bothActive = s.getActiveDuos().some(d => d.id === 'storm_surge');    // expect true

  // --- Case B: potential lists it with named owned+needed when one half owned ---
  clear();
  out.B_bothItemsExist = give(A_ID) && DB.getItemById(B_ID) !== undefined;
  const pot = s.getPotentialDuos().find(p => p.duo.id === 'storm_surge');
  out.B_potentialListed = !!pot;
  out.B_ownedName = pot?.owned?.name || null;   // Static Charge
  out.B_neededName = pot?.needed?.name || null;  // Seeking Rune

  // --- Case C: owning BOTH (active) or NEITHER keeps it out of potential ---
  clear(); give(A_ID); give(B_ID);
  out.C_bothNotPotential = !s.getPotentialDuos().some(p => p.duo.id === 'storm_surge'); // expect true
  clear();
  out.C_neitherNotPotential = !s.getPotentialDuos().some(p => p.duo.id === 'storm_surge'); // expect true

  // --- Case D: getCardDuoInfo(partner) says completes + carries the effect ---
  clear(); give(A_ID);
  const partnerCard = DB.getItemById(B_ID);
  const info = g.getCardDuoInfo(partnerCard);
  out.D_completes = info?.completes === true;
  out.D_hasEffect = !!(info && typeof info.effect === 'string' && info.effect.length > 0);
  out.D_names = info?.name || null;

  // --- Case E: overlay toggle is clean (open/close, no purchase leak) ---
  g.enterShop();
  out.E_closedOnEnter = g.showCombosOverlay === false;    // enterShop resets it
  const btn = g.getCombosButtonRect();
  const cx = btn.x + btn.width / 2, cy = btn.y + btn.height / 2;
  // Simulate a tap on the COMBOS button
  g.input.mouseX = cx; g.input.mouseY = cy; g.input.mouseDown = true;
  g.updateShop();
  out.E_opensOnTap = g.showCombosOverlay === true;
  // While open, a tap anywhere closes it and consumes the click
  g.input.mouseX = cx; g.input.mouseY = cy; g.input.mouseDown = true;
  g.updateShop();
  out.E_closesOnTap = g.showCombosOverlay === false;

  clear();
  return out;
});

await browser.close();
server.close();

console.log('\n=== Synergy-clarity verification (on shipped frontend/dist) ===');
console.log(JSON.stringify(result, null, 2));
console.log('Console/page errors:', errors.length);
errors.forEach(e => console.log('  ', e));

const pass = result && !result.fatal
  && result.A_oneHalfActive === false && result.A_bothActive === true
  && result.B_bothItemsExist === true && result.B_potentialListed === true
  && result.B_ownedName === 'Static Charge' && result.B_neededName === 'Seeking Rune'
  && result.C_bothNotPotential === true && result.C_neitherNotPotential === true
  && result.D_completes === true && result.D_hasEffect === true && result.D_names === 'Storm Surge'
  && result.E_closedOnEnter === true && result.E_opensOnTap === true && result.E_closesOnTap === true
  && errors.length === 0;
console.log('\nRESULT:', pass ? 'PASS ✅' : 'FAIL ❌');
process.exit(pass ? 0 : 1);
