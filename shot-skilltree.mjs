// Visual QA: render the PoE-style skill-tree screen at mobile + desktop, default zoom
// and zoomed-out, with a few nodes allocated, for eyeballing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = '/workspace/work/roguelite-game/frontend/dist';
const OUT = '/workspace/work/roguelite-game/shots';
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.json':'application/json','.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port + '/';
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'] });
fs.mkdirSync(OUT, { recursive: true });

async function shot(name, vp, classId, prep) {
  const pg = await b.newPage();
  await pg.setViewport(vp);
  await pg.goto(base, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 700));
  await pg.evaluate((classId, prep) => {
    const g = window.__game;
    const cls = window.__STARTING_CLASSES.find(c => c.id === classId);
    g.beginRun(cls);
    const st = g.skillTree;
    st.grantPoints(8);
    const T = window.__SKILL_TREE;
    // allocate a small path out of the start for visual variety
    const path0 = [];
    const near = T.neighborsOf(st.startId).filter(id => { const n = T.SKILL_NODES.find(x=>x.id===id); return n && n.type !== 'start'; });
    for (const id of near.slice(0, 2)) { if (st.allocate(id)) path0.push(id); const next = T.neighborsOf(id).filter(x=>{const n=T.SKILL_NODES.find(y=>y.id===x); return n && n.type!=='start' && !st.isAllocated(x);}); if (next[0]) st.allocate(next[0]); }
    st.recomputeInto(g.playerStats);
    g.state = 'skilltree';
    if (prep === 'zoomout') { g.stApplyZoom(0.35); }
    g.draw();
  }, classId, prep);
  await new Promise(r => setTimeout(r, 150));
  await pg.screenshot({ path: path.join(OUT, name) });
  await pg.close();
  console.log('wrote', name);
}

await shot('skilltree-mobile.png', { width: 390, height: 844, deviceScaleFactor: 2 }, 'arcanist', 'default');
await shot('skilltree-mobile-zoomout.png', { width: 390, height: 844, deviceScaleFactor: 2 }, 'arcanist', 'zoomout');
await shot('skilltree-desktop.png', { width: 1440, height: 900, deviceScaleFactor: 1 }, 'ranger', 'default');
await shot('skilltree-desktop-zoomout.png', { width: 1440, height: 900, deviceScaleFactor: 1 }, 'gunner', 'zoomout');
await b.close(); server.close();
