#!/usr/bin/env node
// Probe for Felix's report: "projectiles pass through enemies quite a lot".
//
// The swept test (segmentCircleHit) was correct, but its CANDIDATE set came from an
// endpoint-only quadtree query, retrieve(proj). A fast projectile whose endpoint box
// resolves into a different quadtree leaf than an enemy it swept THROUGH never listed
// that enemy as a candidate, so segmentCircleHit never ran on it and the shot visibly
// passed through.
//
// The invariant that actually matters for correctness: the candidate set must contain
// EVERY enemy the swept path truly intersects. We prove it over many randomized layouts
// (real Quadtree + real segmentCircleHit compiled from src):
//   - count "true hits" = enemies segmentCircleHit says the path crosses (ground truth)
//   - OLD candidate set (endpoint-only) misses some of them (the bug)
//   - NEW candidate set (swept box padded by max radius) misses NONE of them (the fix)
import path from 'node:path';
import fs from 'node:fs';
import * as esbuild from 'esbuild';

const GAME = '/workspace/work/roguelite-game/frontend';
const TMP = path.join(GAME, '.qa-tmp');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(GAME, 'src/Quadtree.ts'), path.join(GAME, 'src/utils.ts')],
  format: 'esm', outdir: TMP, logLevel: 'warning',
});
const { Quadtree } = await import(path.join(TMP, 'Quadtree.js'));
const { segmentCircleHit } = await import(path.join(TMP, 'utils.js'));

const WORLD = 4000;
const ENEMY_R = 18;   // small mob radius (bosses larger; pad=90 covers them)
const PROJ_R = 4;
const PAD = 90;

// Deterministic RNG so the probe is reproducible.
let seed = 1234567;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

function sweptBoxCandidates(tree, px0, py0, x1, y1) {
  const minX = Math.min(px0, x1), maxX = Math.max(px0, x1);
  const minY = Math.min(py0, y1), maxY = Math.max(py0, y1);
  return tree.retrieve({
    x: (minX + maxX) / 2, y: (minY + maxY) / 2,
    width: (maxX - minX) + PAD * 2, height: (maxY - minY) + PAD * 2,
  });
}

let trials = 0, bugTrials = 0, oldMissesTotal = 0, newMissesTotal = 0;
for (let t = 0; t < 400; t++) {
  const tree = new Quadtree({ x: 0, y: 0, width: WORLD, height: WORLD }, 10, 5, 0);
  const enemies = [];
  const n = 200 + Math.floor(rnd() * 200);
  for (let i = 0; i < n; i++) {
    enemies.push({ id: `e${i}`, x: rnd() * WORLD, y: rnd() * WORLD, radius: ENEMY_R, dead: false });
  }
  for (const e of enemies) tree.insert(e);

  // A fast shot: random origin, long random travel this frame (up to 1200px).
  const px0 = rnd() * WORLD, py0 = rnd() * WORLD;
  const ang = rnd() * Math.PI * 2;
  const travel = 400 + rnd() * 800;
  const x1 = px0 + Math.cos(ang) * travel, y1 = py0 + Math.sin(ang) * travel;
  const proj = { x: x1, y: y1, radius: PROJ_R };

  // Ground truth: every enemy the swept path truly crosses.
  const trueHits = enemies.filter(e =>
    segmentCircleHit(px0, py0, x1, y1, e.x, e.y, e.radius + PROJ_R)
  );
  if (trueHits.length === 0) continue;
  trials++;

  const oldSet = new Set(tree.retrieve(proj).map(e => e.id));
  const newSet = new Set(sweptBoxCandidates(tree, px0, py0, x1, y1).map(e => e.id));

  const oldMisses = trueHits.filter(e => !oldSet.has(e.id)).length;
  const newMisses = trueHits.filter(e => !newSet.has(e.id)).length;
  oldMissesTotal += oldMisses;
  newMissesTotal += newMisses;
  if (oldMisses > 0) bugTrials++;
}

fs.rmSync(TMP, { recursive: true, force: true });

console.log('Swept-collision candidate-query probe (real Quadtree + real segmentCircleHit)');
console.log(`  trials with >=1 true swept hit:        ${trials}`);
console.log(`  trials where OLD endpoint query missed a true hit (the bug): ${bugTrials}`);
console.log(`  total true-hit enemies missed by OLD:  ${oldMissesTotal}`);
console.log(`  total true-hit enemies missed by NEW:  ${newMissesTotal}`);

let fail = false;
if (bugTrials === 0) { console.error('  ! probe did not reproduce the bug — layout not exercising the tree'); fail = true; }
if (newMissesTotal > 0) { console.error('  ! FIX INEFFECTIVE: swept-box query still misses swept-through enemies'); fail = true; }

if (fail) { console.error('\nFAIL'); process.exit(1); }
console.log(`\nPASS: OLD query dropped ${oldMissesTotal} real hits across ${bugTrials} trials; NEW query drops 0.`);
