// qa-catalog-integrity.mjs — static integrity gate for the item catalog.
//
// A pre-commit check for the boundary that has bitten before: the amulet slot
// fill (Jul 6) shipped with 2 duplicate item NAMES that a later commit had to
// clean up. tsc catches an invalid FIELD and qa-shop-8slot.mjs exercises slot
// routing, but neither catches a duplicate id/name before it ships. This does,
// in one cheap static pass (no chromium, no build).
//
// The catalog mixes formatting — older entries are multi-line, newer ones are
// single-line `{ id: ... }` — so all LIVE-catalog data is read with full-source
// regex (never a line scan, which silently sees only the single-line entries).
//
// Checks:
//   LIVE catalog  → duplicate id, duplicate name         (full-source scan)
//   pending spec  → the above PLUS, per single-line item: unknown field (tsc
//                   would reject), invalid tag/tier/rarity, missing required
//                   field, and id/name collision with the live catalog — so the
//                   51-item batch is proven paste-clean BEFORE it touches tsc.
//
// Usage:
//   node qa-catalog-integrity.mjs                 # gate the LIVE catalog
//   node qa-catalog-integrity.mjs --spec FILE.md  # + validate a pending spec's
//                                                 # ```ts blocks and print the
//                                                 # post-fill per-slot totals.
// Exit 0 = clean, 1 = issues found (so it can gate a batch content commit).

import { readFileSync } from 'node:fs';

const TYPES = 'frontend/src/items/types.ts';
const CATALOG = 'frontend/src/items/catalog.ts';

const VALID_TAGS = new Set(['melee', 'ranged', 'defensive', 'economic', 'elemental', 'utility']);
const VALID_TIERS = new Set(['ItemTier.Common', 'ItemTier.Uncommon', 'ItemTier.Rare', 'ItemTier.Legendary']);
const VALID_RARITY = new Set(['common', 'rare', 'epic', 'legendary']);
const REQUIRED = ['id', 'name', 'description', 'rarity', 'tier', 'cost', 'icon', 'unlocked', 'tags'];
const SLOTS = ['head', 'torso', 'legs', 'feet', 'ring', 'amulet'];

// Valid Item field names, parsed from the interface so this never drifts from
// the type contract.
function validFields() {
  const src = readFileSync(TYPES, 'utf8');
  const m = src.match(/export interface Item \{([\s\S]*?)\n\}/);
  if (!m) throw new Error('could not find `interface Item` in ' + TYPES);
  const fields = new Set();
  for (const line of m[1].split('\n')) {
    const fm = line.match(/^\s*([a-zA-Z][a-zA-Z0-9]*)\??\s*:/);
    if (fm) fields.add(fm[1]);
  }
  return fields;
}

// All id / name values across the WHOLE source (format-agnostic).
function scanAll(src) {
  const ids = [...src.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
  const names = [
    ...[...src.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]),
  ];
  const slots = {};
  for (const m of src.matchAll(/slot:\s*'([^']+)'/g)) slots[m[1]] = (slots[m[1]] || 0) + 1;
  return { ids, names, slots };
}

function dupes(arr) {
  const seen = new Set();
  const dup = new Set();
  for (const x of arr) (seen.has(x) ? dup : seen).add(x);
  return [...dup];
}

const fields = validFields();
const catSrc = readFileSync(CATALOG, 'utf8');
const errors = [];

// --- gate the live catalog (full-source, formatting-agnostic) ---
const live = scanAll(catSrc);
console.log(`live catalog: ${live.ids.length} items`);
for (const d of dupes(live.ids)) errors.push(`[catalog] duplicate id '${d}'`);
for (const d of dupes(live.names)) errors.push(`[catalog] duplicate name '${d}'`);

// --- optionally validate a pending spec (its items are uniformly single-line) ---
const specArg = process.argv.indexOf('--spec');
if (specArg !== -1 && process.argv[specArg + 1]) {
  const specPath = process.argv[specArg + 1];
  const specSrc = readFileSync(specPath, 'utf8');
  const liveIds = new Set(live.ids);
  const liveNames = new Set(live.names);
  const seenIds = new Map();
  const seenNames = new Map();
  const specSlots = {};
  let n = 0;

  for (const block of specSrc.matchAll(/```ts\n([\s\S]*?)```/g)) {
    for (const ln of block[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{ id:'))) {
      n++;
      const iid = (ln.match(/id:\s*'([^']+)'/) || [])[1] || '???';
      const name = (ln.match(/name:\s*"([^"]+)"/) || ln.match(/name:\s*'([^']+)'/) || [])[1] || '???';
      const add = (msg) => errors.push(`[spec:${iid}] ${msg}`);

      // object keys = a word right after `{` or `,` (ignores in-string colons).
      for (const km of ln.matchAll(/[{,]\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/g)) {
        if (!fields.has(km[1])) add(`unknown field '${km[1]}' (not on Item interface)`);
      }
      for (const req of REQUIRED) {
        if (!new RegExp(`[{,]\\s*${req}\\s*:`).test(ln)) add(`missing required field '${req}'`);
      }
      const tagm = ln.match(/tags:\s*\[([^\]]*)\]/);
      if (tagm) for (const t of tagm[1].matchAll(/'([^']+)'/g)) {
        if (!VALID_TAGS.has(t[1])) add(`invalid tag '${t[1]}'`);
      }
      const tm = ln.match(/tier:\s*(ItemTier\.\w+)/);
      if (tm && !VALID_TIERS.has(tm[1])) add(`invalid tier ${tm[1]}`);
      const rm = ln.match(/rarity:\s*'([^']+)'/);
      if (rm && !VALID_RARITY.has(rm[1])) add(`invalid rarity '${rm[1]}'`);

      if (liveIds.has(iid)) add('id collides with live catalog');
      if (seenIds.has(iid)) add(`duplicate id within spec`);
      seenIds.set(iid, name);
      if (liveNames.has(name)) add(`name '${name}' collides with live catalog`);
      if (seenNames.has(name)) add(`duplicate name '${name}' within spec (other id ${seenNames.get(name)})`);
      seenNames.set(name, iid);

      const slot = (ln.match(/slot:\s*'([^']+)'/) || [])[1] || '(inferred)';
      specSlots[slot] = (specSlots[slot] || 0) + 1;
    }
  }
  console.log(`spec ${specPath}: ${n} new items`);
  console.log('post-fill slot totals (live + spec):');
  for (const s of SLOTS) {
    const tot = (live.slots[s] || 0) + (specSlots[s] || 0);
    console.log(`  ${s}: ${live.slots[s] || 0} + ${specSlots[s] || 0} = ${tot}${tot === 20 ? ' ✓' : '  (not 20)'}`);
  }
}

console.log('');
if (errors.length === 0) {
  console.log('RESULT: CLEAN — no duplicate ids/names, no invalid fields.');
  process.exit(0);
} else {
  console.log(`RESULT: ${errors.length} ISSUE(S) FOUND:`);
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
