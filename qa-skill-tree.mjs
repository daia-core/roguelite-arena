// Skill-tree expansion QA — verify the enlarged PoE-style web:
//   • node/edge count grew substantially (way larger than the old 88)
//   • graph is fully connected from the gunner hub (no orphan nodes)
//   • every keystone is reachable by pathing outward (allocatable given points)
//   • behaviour keystones actually change PlayerStats getters — build-defining
//   • rendering the tree throws no console errors
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const GAME = '/workspace/work/roguelite-game/frontend';
const ROOT = path.join(GAME, 'dist');
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
await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 1000));

const out = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { fatal: 'no __game' };
  const NODES = window.__SKILL_NODES;
  const EDGES = window.__SKILL_EDGES;
  const NEI = window.__skillNeighbors;
  if (!NODES || !EDGES || !NEI) return { fatal: 'no tree hooks' };

  const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
  const keystones = NODES.filter(n => n.type === 'keystone');
  const notables = NODES.filter(n => n.type === 'notable');
  const minors = NODES.filter(n => n.type === 'minor');
  const starts = NODES.filter(n => n.type === 'start');

  // Connectivity: BFS from the gunner hub across all edges; every node must be reachable.
  const seen = new Set(['start_gunner']);
  const q = ['start_gunner'];
  while (q.length) {
    const id = q.shift();
    for (const nb of NEI(id)) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
  }
  const orphans = NODES.filter(n => !seen.has(n.id)).map(n => n.id);

  // Reachability: with unlimited points, greedily allocate every node adjacent to the
  // allocated set — confirms every keystone can actually be pathed to (allocatable).
  const st = g.skillTree;
  st.reset('gunner');
  st.grantPoints(1000000);
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const n of NODES) {
      if (st.canAllocate(n.id)) { st.allocate(n.id); progressed = true; }
    }
  }
  const unallocatedKeystones = keystones.filter(k => !st.isAllocated(k.id)).map(k => k.id);
  const totalAllocatable = st.spentCount();

  // Behaviour verification: fresh gunner run, allocate a PATH to each behaviour
  // keystone and confirm the effect reaches the PlayerStats getter. We do a simpler,
  // robust check: allocate EVERYTHING (done above), recompute, read the getters.
  g.selectedClassId = 'gunner';
  g.startNewGame();
  const st2 = g.skillTree;
  st2.reset('gunner');
  st2.grantPoints(1000000);
  let p2 = true;
  while (p2) { p2 = false; for (const n of NODES) if (st2.canAllocate(n.id)) { st2.allocate(n.id); p2 = true; } }
  st2.recomputeInto(g.playerStats);
  const ps = g.playerStats;
  const behaviour = {
    piercing: ps.getPiercing(),
    multishot: ps.getMultishot(),
    lifesteal: +ps.getLifesteal().toFixed(3),
    thorns: +ps.getThorns().toFixed(3),
    chain: +ps.getChainLightningChance().toFixed(3),
    execute: +ps.getExecuteThreshold().toFixed(3),
    knockback: ps.getKnockback(),
    explosionOnHit: ps.hasExplosionOnHit(),
    // sanity: a stat scalar should also be well above 1 with the whole tree
    damageMult: +ps.skillDamageMult.toFixed(2),
  };

  return {
    counts: { nodes: NODES.length, edges: EDGES.length, keystones: keystones.length, notables: notables.length, minors: minors.length, starts: starts.length },
    orphans,
    unallocatedKeystones,
    totalAllocatable,
    behaviour,
    keystoneNames: keystones.map(k => k.name),
  };
});

console.log(JSON.stringify(out, null, 2));
console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');

// --- Assertions ---
let fail = 0;
const c = out.counts || {};
if (!out || out.fatal) { console.log('FAIL fatal:', out && out.fatal); fail++; }
if ((c.nodes || 0) < 150) { console.log(`FAIL tree not "way larger" (${c.nodes} nodes, want >=150)`); fail++; }
if ((c.keystones || 0) < 15) { console.log(`FAIL too few keystones (${c.keystones}, want >=15)`); fail++; }
if ((out.orphans || []).length) { console.log('FAIL orphan nodes:', out.orphans); fail++; }
if ((out.unallocatedKeystones || []).length) { console.log('FAIL unreachable keystones:', out.unallocatedKeystones); fail++; }
const b = out.behaviour || {};
if (!(b.piercing >= 4)) { console.log('FAIL pierce not granted', b.piercing); fail++; }
if (!(b.multishot >= 3)) { console.log('FAIL multishot not granted', b.multishot); fail++; }
if (!(b.lifesteal >= 0.15)) { console.log('FAIL lifesteal not granted', b.lifesteal); fail++; }
if (!(b.thorns >= 0.6)) { console.log('FAIL thorns not granted', b.thorns); fail++; }
if (!(b.chain >= 0.5)) { console.log('FAIL chain not granted', b.chain); fail++; }
if (!(b.execute >= 0.15)) { console.log('FAIL execute not granted', b.execute); fail++; }
if (!(b.knockback >= 200)) { console.log('FAIL knockback not granted', b.knockback); fail++; }
if (b.explosionOnHit !== true) { console.log('FAIL explosion not granted', b.explosionOnHit); fail++; }
if (!(b.damageMult > 1.5)) { console.log('FAIL stat scalar not applied', b.damageMult); fail++; }
if (errors.length) { console.log('FAIL console errors'); fail++; }

console.log(fail ? `\n❌ ${fail} assertion(s) failed` : '\n✅ skill tree verified: large connected web, all keystones reachable, behaviour grants live');
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
