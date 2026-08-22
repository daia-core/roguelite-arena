#!/usr/bin/env node
// Static gate: verify every item in the catalog has ≥1 valid kind (weapon/passive/active),
// matching the getItemKinds() logic in items/types.ts. Catches any item added without the
// mechanical fields getItemKinds uses, so "New Item" never silently shows an empty kind chip.
//
// Also acts as a count drift-check: if ITEM_CATALOG grows/shrinks unexpectedly the assertion
// will catch it and force a deliberate update of the expected count below.
//
// Added: 2026-08-06. Recreated after container restart (qa-shop-chips was not committed).
import path from 'node:path';
import fs from 'node:fs';
import * as esbuild from 'esbuild';

const GAME = '/workspace/work/roguelite-game/frontend';
const TMP  = path.join(GAME, '.qa-tmp-chips');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

// Bundle types + catalog together so getItemKinds() can run on the real roster.
await esbuild.build({
  entryPoints: [
    path.join(GAME, 'src/items/types.ts'),
    path.join(GAME, 'src/items/catalog.ts'),
  ],
  bundle: true, format: 'esm', splitting: true,
  outdir: TMP, logLevel: 'warning',
});

const { getItemKinds } = await import(path.join(TMP, 'types.js'));
const { ITEM_CATALOG }  = await import(path.join(TMP, 'catalog.js'));

const VALID_KINDS = new Set(['weapon', 'passive', 'active']);
const EXPECTED_COUNT = 1918;  // update deliberately when catalog grows

let pass = 0, fail = 0;
const ok  = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ FAIL:', msg); } };

// ── 1. Count check ────────────────────────────────────────────────────────────
ok(
  ITEM_CATALOG.length === EXPECTED_COUNT,
  `catalog count: expected ${EXPECTED_COUNT}, got ${ITEM_CATALOG.length}`
);

// ── 2. Every item resolves to ≥1 valid kind ───────────────────────────────────
const badKind = [];
for (const item of ITEM_CATALOG) {
  const kinds = getItemKinds(item);
  const valid = kinds.length > 0 && kinds.every(k => VALID_KINDS.has(k));
  if (!valid) {
    badKind.push({ id: item.id, name: item.name, kinds });
  }
}
ok(badKind.length === 0,
  `${badKind.length} items have no valid kind: ` +
  badKind.slice(0, 5).map(i => `${i.id}(${i.kinds})`).join(', ')
);

// ── 3. Drift check: getItemKinds always returns ≥1 kind (the fallback passive path) ──
// If someone edits the function and removes the fallback, a pure-stat item would return [].
const pureStatSample = [{
  id: '_test_pure_stat', name: 'Test', description: '', rarity: 'common', tier: 1,
  cost: 1, icon: '?', unlocked: true, tags: ['utility'],
  maxHealthBonus: 10,   // only a stat bonus — no weapon/active fields
}];
const sampleKinds = getItemKinds(pureStatSample[0]);
ok(sampleKinds.includes('passive'),
  `getItemKinds fallback broken — pure-stat item returned: [${sampleKinds}]`
);

// ── 4. Known-kind sanity samples ──────────────────────────────────────────────
// A weapon item must include 'weapon', an active must include 'active'.
const weaponSample = ITEM_CATALOG.find(i => i.weaponType !== undefined);
if (weaponSample) {
  ok(getItemKinds(weaponSample).includes('weapon'),
    `weapon-typed item ${weaponSample.id} not classified as weapon`
  );
} else {
  ok(false, 'no weapon-typed item found in catalog — unexpected');
}

const activeSample = ITEM_CATALOG.find(i => i.bombDrop === true || i.novaPulse === true);
if (activeSample) {
  ok(getItemKinds(activeSample).includes('active'),
    `active item ${activeSample.id} not classified as active`
  );
} else {
  console.warn('  ⚠  no bombDrop/novaPulse item found — active-kind check skipped');
}

// ── Result ────────────────────────────────────────────────────────────────────
fs.rmSync(TMP, { recursive: true, force: true });

if (fail === 0) {
  console.log(`qa-shop-chips: ${pass}/${pass + fail} PASS — all ${ITEM_CATALOG.length} items have valid kinds`);
  process.exit(0);
} else {
  console.error(`qa-shop-chips: ${fail} FAIL (${pass} pass)`);
  process.exit(1);
}
