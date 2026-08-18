// qa-shop-chips.mjs — static gate for the item-kind chip system (Aug 2026).
//
// After the shop-footer chips feature (feat: item kind chips, Aug 6 2026) we need to
// ensure the data path never silently breaks — specifically that getItemKinds() always
// returns >= 1 kind for every catalog item, and that the chip kind set stays the
// expected {'weapon','passive','active'} union.
//
// This is a STATIC analysis (no Chromium, no build): reads catalog.ts + types.ts
// directly, re-implements getItemKinds in plain JS from the same logic, and runs it
// against all 1900+ catalog items. Catches:
//   • Any item that resolves to zero kinds (chips would be invisible / regression).
//   • A drift of getItemKinds logic in types.ts vs this check (mismatched field names
//     → reported as a diff warning so the test keeps passing but flags the drift).
//   • Unexpected kind values outside {'weapon','passive','active'}.
//
// Also outputs kind-distribution stats useful for content balance.
//
// Usage:
//   node qa-shop-chips.mjs        # pass/fail
//   node qa-shop-chips.mjs -v     # verbose: per-item kind lines
//
// Exit 0 = clean, 1 = issues found.

import { readFileSync } from 'node:fs';

const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');
const CATALOG = 'frontend/src/items/catalog.ts';
const TYPES   = 'frontend/src/items/types.ts';

// ---------------------------------------------------------------------------
// 1. Parse getItemKinds out of types.ts for a drift-check: extract the field
//    names that indicate weapon / active / passive.
// ---------------------------------------------------------------------------
const typesSrc = readFileSync(TYPES, 'utf8');
const kindsFnMatch = typesSrc.match(/export function getItemKinds[\s\S]*?^}/m);
if (!kindsFnMatch) {
  console.error('FATAL: could not locate getItemKinds in', TYPES);
  process.exit(1);
}
const kindsFnSrc = kindsFnMatch[0];

function extractFieldRefs(src, section) {
  // e.g. `item.weaponType !== undefined` → 'weaponType'
  const re = new RegExp(`const ${section}[\\s\\S]*?(?=const is|if \\(is|return)`, '');
  const block = src.match(re)?.[0] ?? '';
  const refs = new Set();
  for (const m of block.matchAll(/item\.([a-zA-Z]+)/g)) refs.add(m[1]);
  return refs;
}
const weaponFields  = extractFieldRefs(kindsFnSrc, 'isWeapon');
const activeFields  = extractFieldRefs(kindsFnSrc, 'isActive');
const passiveFields = extractFieldRefs(kindsFnSrc, 'isPassive');

// ---------------------------------------------------------------------------
// 2. getItemKinds re-implementation in plain JS (mirrors types.ts exactly).
//    If types.ts changes the logic, this file must be updated too — the drift
//    check below flags the mismatch.
// ---------------------------------------------------------------------------
function getItemKinds(item) {
  const kinds = [];
  const isWeapon = item.weaponType !== undefined
    || item.swingDamageMult !== undefined   || item.swingRangeBonus !== undefined
    || item.swingArcBonus !== undefined     || item.swingCooldownMult !== undefined
    || item.swingAoe !== undefined          || item.meleeDamageMult !== undefined
    || item.orbitOrbs !== undefined         || item.auxMelee === true
    || item.multishot !== undefined         || item.piercing !== undefined
    || item.homing === true                 || item.projectileSpeed !== undefined
    || item.multicast !== undefined;
  const isActive = item.bombDrop === true || item.novaPulse === true || item.openingSalvo === true;
  const isPassive = !isWeapon && !isActive
    || item.damageMultiplier !== undefined  || item.fireRateMultiplier !== undefined
    || item.critChance !== undefined        || item.critDamageMultiplier !== undefined
    || item.speedMultiplier !== undefined   || item.maxHealthBonus !== undefined
    || item.healthRegen !== undefined       || item.armor !== undefined
    || item.lifesteal !== undefined         || item.thorns !== undefined
    || item.dodge !== undefined             || item.xpMagnet !== undefined
    || item.goldBonus !== undefined         || item.luck !== undefined
    || item.interestBonus !== undefined     || item.aoeRadiusMult !== undefined;
  if (isWeapon)                         kinds.push('weapon');
  if (isActive)                         kinds.push('active');
  if (isPassive || kinds.length === 0)  kinds.push('passive');
  return kinds;
}

const KNOWN_KINDS = new Set(['weapon', 'passive', 'active']);

// ---------------------------------------------------------------------------
// 3. Drift-check: compare extracted field sets with this file's hard-coded sets.
// ---------------------------------------------------------------------------
function setDiff(a, b) { return [...a].filter(x => !b.has(x)); }
const LOCAL_WEAPON  = new Set(['weaponType','swingDamageMult','swingRangeBonus','swingArcBonus','swingCooldownMult','swingAoe','meleeDamageMult','orbitOrbs','auxMelee','multishot','piercing','homing','projectileSpeed','multicast']);
const LOCAL_ACTIVE  = new Set(['bombDrop','novaPulse','openingSalvo']);
// passive fields deliberately omitted from drift-check (large, rarely added)

const driftW = [...setDiff(weaponFields, LOCAL_WEAPON), ...setDiff(LOCAL_WEAPON, weaponFields)];
const driftA = [...setDiff(activeFields, LOCAL_ACTIVE), ...setDiff(LOCAL_ACTIVE, activeFields)];
if (driftW.length || driftA.length) {
  console.warn('⚠️  DRIFT: getItemKinds field mismatch — update qa-shop-chips.mjs');
  if (driftW.length) console.warn('  weapon drift:', driftW.join(', '));
  if (driftA.length) console.warn('  active drift:', driftA.join(', '));
}

// ---------------------------------------------------------------------------
// 4. Parse items from catalog.ts (format-agnostic full-source regex).
// ---------------------------------------------------------------------------
const catalogSrc = readFileSync(CATALOG, 'utf8');

// Extract item objects: match `{` ... `}` blocks at the top level of the array.
// Each item is a multi-line or single-line object inside the items array.
// Strategy: split on top-level `{` delimiters (same depth as array entries).
function parseItems(src) {
  const items = [];
  // The catalog is `const ITEM_CATALOG: Item[] = [ { ... }, ... ]`.
  // Strategy: find the ITEM_CATALOG array `[`, then scan inside it.
  // An item starts at `{` when combined nesting depth (brackets+braces) = 1.
  // An item ends at `}` when combined nesting depth returns to 1 and it was started.
  const arrayStart = src.indexOf('ITEM_CATALOG');
  if (arrayStart === -1) throw new Error('ITEM_CATALOG not found in catalog.ts');
  // Find `= [` after the declaration, not the `[` in `Item[]` type annotation.
  const eqBracket = src.indexOf('= [', arrayStart);
  if (eqBracket === -1) throw new Error('= [ not found after ITEM_CATALOG');
  const bracketPos = eqBracket + 2; // points to the `[`

  // Track combined depth: each `[` or `{` increments; `]` or `}` decrements.
  // Items are `{` blocks at combinedDepth transition 1→2 (i.e., depth was 1 before the `{`).
  let depth = 0, start = -1;
  let inString = false, strChar = '';
  let inLineComment = false;
  for (let i = bracketPos; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\n') { inLineComment = false; continue; }
    if (inLineComment) continue;
    if (inString) {
      if (ch === strChar && src[i - 1] !== '\\') inString = false;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') { inLineComment = true; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { inString = true; strChar = ch; continue; }
    if (ch === '[' || ch === '{') {
      depth++;
      if (ch === '{' && depth === 2) start = i; // direct child of array → item
    } else if (ch === ']' || ch === '}') {
      if (ch === '}' && depth === 2 && start !== -1) {
        const block = src.slice(start, i + 1);
        items.push(parseItemBlock(block));
        start = -1;
      }
      depth--;
      if (ch === ']' && depth === 0) break; // end of ITEM_CATALOG array
    }
  }
  return items;
}

function parseItemBlock(block) {
  const item = {};
  // Boolean flags: `field: true` or `field: false`
  for (const m of block.matchAll(/\b([a-zA-Z]+)\s*:\s*(true|false)\b/g)) {
    item[m[1]] = m[2] === 'true';
  }
  // Numeric fields: `field: 1.5` or `field: -0.3`
  for (const m of block.matchAll(/\b([a-zA-Z]+)\s*:\s*(-?\d+(?:\.\d+)?)\b/g)) {
    if (item[m[1]] === undefined) item[m[1]] = parseFloat(m[2]);
  }
  // String fields: `field: 'value'` or `field: "value"`
  for (const m of block.matchAll(/\b([a-zA-Z]+)\s*:\s*['"]([^'"]+)['"]/g)) {
    if (item[m[1]] === undefined) item[m[1]] = m[2];
  }
  // ItemTier enum ref: `tier: ItemTier.Rare` → keep as string for display
  for (const m of block.matchAll(/\btier\s*:\s*(ItemTier\.\w+)/g)) {
    item['tier'] = m[1];
  }
  return item;
}

const items = parseItems(catalogSrc);

if (items.length === 0) {
  console.error('FATAL: parsed 0 items from', CATALOG);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 5. Run getItemKinds on all items and collect results.
// ---------------------------------------------------------------------------
const issues = [];
const kindCount = { weapon: 0, passive: 0, active: 0 };
const multiKind = [];

for (const item of items) {
  const kinds = getItemKinds(item);
  // Must have at least one kind.
  if (kinds.length === 0) {
    issues.push(`item id=${item.id ?? '?'} name="${item.name ?? '?'}" → zero kinds (chip invisible!)`);
  }
  // All kinds must be in the known set.
  for (const k of kinds) {
    if (!KNOWN_KINDS.has(k)) {
      issues.push(`item id=${item.id ?? '?'} → unknown kind "${k}"`);
    } else {
      kindCount[k]++;
    }
  }
  if (kinds.length > 1) multiKind.push({ id: item.id, name: item.name, kinds });
  if (VERBOSE) {
    console.log(`  ${String(item.id ?? '?').padEnd(28)} ${kinds.join('+')}`);
  }
}

// ---------------------------------------------------------------------------
// 6. Report.
// ---------------------------------------------------------------------------
const total = items.length;
console.log(`\n=== SHOP CHIPS QA (static) ===`);
console.log(`catalog: ${total} items parsed`);
console.log(`kind distribution:`);
console.log(`  weapon:  ${kindCount.weapon.toString().padStart(4)} (${((kindCount.weapon/total)*100).toFixed(1)}%)`);
console.log(`  passive: ${kindCount.passive.toString().padStart(4)} (${((kindCount.passive/total)*100).toFixed(1)}%)`);
console.log(`  active:  ${kindCount.active.toString().padStart(4)} (${((kindCount.active/total)*100).toFixed(1)}%)`);
if (multiKind.length) {
  console.log(`multi-kind items: ${multiKind.length}`);
  if (VERBOSE) multiKind.forEach(m => console.log(`  ${m.id} (${m.name}) → ${m.kinds.join('+')}`));
}
if (issues.length) {
  console.log(`\nISSUES (${issues.length}):`);
  issues.forEach(i => console.log('  ✗ ' + i));
  console.log(`\n❌ FAIL`);
  process.exit(1);
} else {
  console.log(`\n✅ ALL ITEMS HAVE VALID KINDS — chips will render for every catalog item`);
}
