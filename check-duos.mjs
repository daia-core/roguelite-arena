import { readFileSync } from 'node:fs';
const cat = readFileSync('frontend/src/items/catalog.ts', 'utf8');
const catIds = new Set([...cat.matchAll(/id: '([^']+)'/g)].map((m) => m[1]));
const duo = readFileSync('frontend/src/DuoSystem.ts', 'utf8');
const refs = [...duo.matchAll(/item[12]Id: '([^']+)'/g)].map((m) => m[1]);
let missing = 0;
for (const r of new Set(refs)) if (!catIds.has(r)) { console.log('MISSING duo item id:', r); missing++; }
console.log('duo item refs:', new Set(refs).size, '| missing:', missing);
