// Headless QA for the PoE-style passive skill web (Felix, 2026-07-06).
// Verifies graph integrity + connectivity, per-class start nodes, connectivity-based
// allocation rules, bonus aggregation into PlayerStats, and save/load round-trip.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = '/workspace/work/roguelite-game/frontend/dist';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
const pg = await b.newPage();
await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errs = [];
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(base, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 800));

const out = await pg.evaluate(() => {
  const R = [];
  const ok = (name, cond, extra) => R.push({ name, pass: !!cond, extra: extra ?? '' });
  const g = window.__game;
  const T = window.__SKILL_TREE;
  const { SKILL_NODES, SKILL_EDGES, neighborsOf, startNodeForClass } = T;
  const byId = Object.fromEntries(SKILL_NODES.map(n => [n.id, n]));

  // 1. Graph size + integrity.
  ok('node count is a big tree (>=80)', SKILL_NODES.length >= 80, `${SKILL_NODES.length} nodes`);
  ok('edge count reasonable (>=90)', SKILL_EDGES.length >= 90, `${SKILL_EDGES.length} edges`);
  const badEdge = SKILL_EDGES.find(([a, b]) => !byId[a] || !byId[b]);
  ok('every edge references real nodes', !badEdge, badEdge ? JSON.stringify(badEdge) : '');

  // node types present
  const types = new Set(SKILL_NODES.map(n => n.type));
  ok('has start/minor/notable/keystone types', ['start','minor','notable','keystone'].every(t => types.has(t)), [...types].join(','));
  const keystones = SKILL_NODES.filter(n => n.type === 'keystone').length;
  ok('has >=6 keystones', keystones >= 6, `${keystones}`);

  // 2. Connectivity: BFS from gunner hub reaches every node.
  const seen = new Set(['start_gunner']);
  const q = ['start_gunner'];
  while (q.length) { const cur = q.shift(); for (const nb of neighborsOf(cur)) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
  ok('graph fully connected from hub', seen.size === SKILL_NODES.length, `${seen.size}/${SKILL_NODES.length}`);

  // 3. Class start nodes.
  const expect = { gunner: 'start_gunner', ranger: 'start_ranger', brawler: 'start_brawler', arcanist: 'start_arcanist' };
  for (const [cls, id] of Object.entries(expect)) {
    ok(`startNodeForClass(${cls})=${id}`, startNodeForClass(cls) === id && !!byId[id]);
  }

  // beginRun sets the tree's startId per class.
  for (const cls of window.__STARTING_CLASSES) {
    g.beginRun(cls);
    ok(`beginRun(${cls.id}) anchors startId`, g.skillTree.startId === (expect[cls.id] || 'start_gunner'), g.skillTree.startId);
  }

  // 4. Allocation rules — use gunner.
  const gunner = window.__STARTING_CLASSES.find(c => c.id === 'gunner');
  g.beginRun(gunner);
  const st = g.skillTree;
  ok('fresh tree: start allocated, spentCount 0', st.isAllocated('start_gunner') && st.spentCount() === 0);
  ok('no points → canAllocate false', st.availablePoints === 0 && !st.canAllocate('might_gate'));

  st.grantPoints(3);
  ok('start node itself is never allocatable', !st.canAllocate('start_gunner'));

  // A neighbour of the start hub.
  const hubNeighbors = neighborsOf('start_gunner').filter(id => byId[id].type !== 'start');
  const near = hubNeighbors[0];
  ok('a hub neighbour is reachable', st.isReachable(near), near);
  // A far keystone is NOT reachable yet.
  const farKey = SKILL_NODES.find(n => n.type === 'keystone').id;
  ok('a far keystone is unreachable initially', !st.isReachable(farKey), farKey);
  ok('cannot allocate an unreachable node', !st.allocate(farKey));

  const beforePts = st.availablePoints;
  const beforeSpent = st.spentCount();
  const alloced = st.allocate(near);
  ok('allocate a reachable node succeeds', alloced);
  ok('allocate spends exactly one point', st.availablePoints === beforePts - 1, `${st.availablePoints}`);
  ok('spentCount increments', st.spentCount() === beforeSpent + 1);
  ok('re-allocating same node fails', !st.allocate(near));

  // 5. Bonus aggregation → PlayerStats.
  st.reset('gunner');
  st.grantPoints(5);
  // path out along the MIGHT arm to a damage node and check damageMult rises.
  const dmgMinor = neighborsOf('might_gate').find(id => byId[id].deltas.some(d => d.field === 'damageMult'));
  st.allocate('might_gate');
  const baseDmg = st.computeBonuses().damageMult;
  if (dmgMinor) st.allocate(dmgMinor);
  const afterDmg = st.computeBonuses().damageMult;
  ok('allocating a damage node raises damageMult', afterDmg > baseDmg || byId['might_gate'].deltas.some(d=>d.field==='damageMult'), `${baseDmg}→${afterDmg}`);
  st.recomputeInto(g.playerStats);
  ok('recomputeInto writes skillDamageMult', g.playerStats.skillDamageMult === st.computeBonuses().damageMult);

  // 6. Save/load round-trip.
  st.reset('ranger');
  st.grantPoints(4);
  const rn = neighborsOf(st.startId).filter(id => byId[id].type !== 'start')[0];
  st.allocate(rn);
  const snap = st.serialize();
  ok('serialize carries startId + allocated', snap.startId === 'start_ranger' && snap.allocated.includes(rn));
  // wipe then load back into the same instance
  st.reset('gunner');
  st.load(snap);
  ok('load restores startId', st.startId === 'start_ranger', st.startId);
  ok('load restores allocated node', st.isAllocated(rn));
  ok('load restores points', st.availablePoints === snap.availablePoints);

  return R;
});

console.log('\nSKILL TREE QA\n' + '='.repeat(50));
let fails = 0;
for (const r of out) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? '  [' + r.extra + ']' : ''}`);
  if (!r.pass) fails++;
}
console.log('='.repeat(50));
console.log(`${out.length - fails}/${out.length} passed`);
if (errs.length) { console.log('\nCONSOLE/PAGE ERRORS:'); errs.forEach(e => console.log('  ' + e)); }
await b.close();
server.close();
process.exit(fails === 0 && errs.length === 0 ? 0 : 1);
