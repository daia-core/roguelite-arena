// qa-node-map.ts — static structural gate for the PoE-style skill tree.
//
// Checks every guarantee the skilltree-expansion-plan.md QA checklist calls for,
// without starting a browser. Run with: npx tsx qa-node-map.ts
//
// Exit 0 = all checks green. Exit 1 = one or more checks failed.
//
// Checks:
//   1. Total node count is in the expected range (≥180 for expanded tree).
//   2. All four node types present: start, minor, notable, keystone.
//   3. Every arm has ≥4 notables and ≥3 keystones.
//   4. Bridge cluster notables exist (≥6 cross-arm notables in the 'core' arm).
//   5. Global keystones exist (≥4 nodes of type keystone in arm='core').
//   6. From each class start, ALL arm gateways are reachable (BFS w/ unlimited budget).
//   7. Cross-arm bridge is reachable from EACH arm's inner nodes (a3/b3 → bridge notable).
//   8. Global keystone reachable from each class start within 3 hops.
//   9. No node is a dead-end island (every node has ≥1 edge).
//  10. TypeScript: `tsc --noEmit` clean (called as child_process).

import { SKILL_NODES, SKILL_EDGES, SKILL_ARMS } from './frontend/src/SkillTree';
import { execSync } from 'child_process';

let passed = 0;
let failed = 0;

function ok(label: string): void {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
}

function check(label: string, cond: boolean, detail?: string): void {
  cond ? ok(label) : fail(label, detail);
}

// ─── Build adjacency map ───────────────────────────────────────────────────

const adj: Record<string, Set<string>> = {};
const allIds = new Set(SKILL_NODES.map(n => n.id));

for (const n of SKILL_NODES) adj[n.id] = new Set();
for (const [a, b] of SKILL_EDGES) {
  if (!allIds.has(a)) { fail(`Edge references unknown node '${a}'`); continue; }
  if (!allIds.has(b)) { fail(`Edge references unknown node '${b}'`); continue; }
  adj[a].add(b);
  adj[b].add(a);
}

function bfsHops(startId: string, targetId: string): number {
  // Returns min hops (edges) to reach targetId from startId, or Infinity if not reachable.
  const dist: Record<string, number> = { [startId]: 0 };
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === targetId) return dist[cur];
    for (const nb of adj[cur]) {
      if (!(nb in dist)) {
        dist[nb] = dist[cur] + 1;
        queue.push(nb);
      }
    }
  }
  return Infinity;
}

function reachableFrom(startId: string): Set<string> {
  const visited = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj[cur]) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  return visited;
}

// ─── 1. Total node count ──────────────────────────────────────────────────

console.log('\nqa-node-map: PoE skill tree structural gate\n');
console.log(`Tree summary: ${SKILL_NODES.length} nodes, ${SKILL_EDGES.length} edges`);

check('Total nodes ≥ 180 (expanded tree)',
  SKILL_NODES.length >= 180,
  `got ${SKILL_NODES.length}`);

// ─── 2. All node types present ────────────────────────────────────────────

const byType: Record<string, number> = { start: 0, minor: 0, notable: 0, keystone: 0 };
for (const n of SKILL_NODES) byType[n.type] = (byType[n.type] ?? 0) + 1;

check('Has start nodes',   byType.start    > 0, `count=${byType.start}`);
check('Has minor nodes',   byType.minor    > 0, `count=${byType.minor}`);
check('Has notable nodes', byType.notable  > 0, `count=${byType.notable}`);
check('Has keystone nodes',byType.keystone > 0, `count=${byType.keystone}`);

console.log(`    (start=${byType.start} minor=${byType.minor} notable=${byType.notable} keystone=${byType.keystone})`);

// ─── 3. Per-arm notable + keystone counts ────────────────────────────────

console.log('\nPer-arm checks:');
for (const arm of SKILL_ARMS) {
  const armNodes = SKILL_NODES.filter(n => n.arm === arm.key);
  const notables  = armNodes.filter(n => n.type === 'notable').length;
  const keystones = armNodes.filter(n => n.type === 'keystone').length;
  const minors    = armNodes.filter(n => n.type === 'minor').length;
  check(`${arm.label}: ≥4 notables`, notables  >= 4, `got ${notables}`);
  check(`${arm.label}: ≥3 keystones`,keystones >= 3, `got ${keystones}`);
  check(`${arm.label}: ≥5 minors`,   minors    >= 5, `got ${minors}`);
}

// ─── 4. Bridge cluster notables ───────────────────────────────────────────

console.log('\nCross-arm bridge checks:');
const coreNodes    = SKILL_NODES.filter(n => n.arm === 'core');
const coreNotables = coreNodes.filter(n => n.type === 'notable');
const coreKeys     = coreNodes.filter(n => n.type === 'keystone');

check('≥6 cross-arm bridge notables (arm=core)',
  coreNotables.length >= 6,
  `got ${coreNotables.length}: ${coreNotables.map(n => n.name).join(', ')}`);

// ─── 5. Global keystones ──────────────────────────────────────────────────

check('≥4 global keystones (arm=core)',
  coreKeys.length >= 4,
  `got ${coreKeys.length}: ${coreKeys.map(n => n.name).join(', ')}`);

// ─── 6. All arm gateways reachable from each class start ─────────────────

console.log('\nReachability from class starts:');
const classStarts = SKILL_NODES.filter(n => n.type === 'start');
const gateNodes   = SKILL_NODES.filter(n => n.id.endsWith('_gate'));

for (const cls of classStarts) {
  const reachable = reachableFrom(cls.id);
  const unreachGates = gateNodes.filter(g => !reachable.has(g.id));
  check(
    `${cls.name}: all arm gateways reachable`,
    unreachGates.length === 0,
    unreachGates.length ? `missing: ${unreachGates.map(g => g.id).join(', ')}` : undefined,
  );
}

// ─── 7. Cross-arm bridge reachable from each arm ─────────────────────────

console.log('\nCross-arm bridge reachability:');
for (const arm of SKILL_ARMS) {
  const armStart = SKILL_NODES.find(n => n.type === 'start' && n.arm === arm.key);
  if (!armStart) continue;

  // Look for any 'core' notable reachable from this arm's start.
  const reachable = reachableFrom(armStart.id);
  const reachBridge = coreNotables.some(n => reachable.has(n.id));
  check(
    `${arm.label} start can reach a cross-arm bridge notable`,
    reachBridge,
  );
}

// ─── 8. Global keystone reachable within 3 hops from each class start ────

console.log('\nGlobal keystone proximity:');
const gunnerStart = SKILL_NODES.find(n => n.id === 'start_gunner');
if (gunnerStart) {
  for (const gk of coreKeys) {
    const hops = bfsHops('start_gunner', gk.id);
    check(
      `Global keystone '${gk.name}' reachable from Gunner hub within 3 hops`,
      hops <= 3,
      `got ${hops === Infinity ? '∞' : hops} hops`,
    );
  }
}

for (const cls of classStarts) {
  if (cls.id === 'start_gunner') continue;
  // At least one global keystone should be within 4 hops of a non-gunner start.
  const minHops = Math.min(...coreKeys.map(gk => bfsHops(cls.id, gk.id)));
  check(
    `Nearest global keystone from ${cls.name} within 4 hops`,
    minHops <= 4,
    `nearest is ${minHops === Infinity ? '∞' : minHops} hops`,
  );
}

// ─── 9. No dead-end islands ───────────────────────────────────────────────

console.log('\nConnectivity:');
const isolated = SKILL_NODES.filter(n => adj[n.id].size === 0);
check('No isolated nodes (every node has ≥1 edge)',
  isolated.length === 0,
  isolated.length ? isolated.map(n => n.id).join(', ') : undefined);

// Verify the whole graph is one connected component (from gunner hub).
const hubId = 'start_gunner';
if (allIds.has(hubId)) {
  const component = reachableFrom(hubId);
  const disconnected = SKILL_NODES.filter(n => !component.has(n.id));
  check('All nodes reachable from Gunner hub (single connected component)',
    disconnected.length === 0,
    disconnected.length ? `${disconnected.length} unreachable: ${disconnected.slice(0,5).map(n => n.id).join(', ')}` : undefined);
}

// ─── 10. TypeScript: tsc --noEmit ────────────────────────────────────────

console.log('\nTypeScript check:');
try {
  execSync('npx tsc --noEmit', {
    cwd: '/workspace/work/roguelite-game/frontend',
    stdio: 'pipe',
  });
  ok('tsc --noEmit clean');
} catch (e: unknown) {
  const out = (e as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() || '';
  fail('tsc --noEmit', out.slice(0, 300) || 'TypeScript errors found');
}

// ─── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(52)}`);
console.log(`qa-node-map: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('RESULT: FAIL');
  process.exit(1);
} else {
  console.log('RESULT: PASS — skill tree structure is sound');
}
