// Extract every id and name from the live catalog (handles both multi-line and
// single-line item literals) so the next generation batch can dedupe against them.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('frontend/src/items/catalog.ts', 'utf8');
const ids = [...src.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1]);
const names = [...src.matchAll(/name:\s*(?:'([^']*)'|"([^"]*)")/g)].map(m => m[1] ?? m[2]);
writeFileSync('/tmp/existing.json', JSON.stringify({ ids, names }));
console.log(`ids=${ids.length} names=${names.length} uniqueIds=${new Set(ids).size} uniqueNames=${new Set(names).size}`);
