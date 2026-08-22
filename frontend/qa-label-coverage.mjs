// One-off: verify every character in the affected damage-number labels has a
// glyph pattern in DamageNumber.digitPatterns (the 03:17 + 03:52 visual fixes).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'src/Particle.ts'), 'utf8');
const start = src.indexOf('digitPatterns: Record');
const block = src.slice(start, src.indexOf('};', start));
const keys = new Set([...block.matchAll(/^\s*'(.)':/gm)].map(m => m[1]));

const labels = [
  'DODGE', 'COUNTER!', 'SECOND WIND', 'LEVEL UP',
  '👑 BOSS SLAIN!', '⚔️ MINIBOSS SLAIN!', '⏳+50%',
  '515M', '1.5K', '-25',
];
// Emoji / pictographs rendered as intentional blank gaps (👑 ⚔️ ⏳ …).
const emoji = /[\u{1F000}-\u{1FFFF}\u2600-\u27BF\u2300-\u23FF\uFE0F]/u;

let allOk = true;
for (const label of labels) {
  const missing = [];
  for (const ch of label) {
    if (ch === ' ' || emoji.test(ch)) continue; // intentional gaps
    if (!keys.has(ch)) missing.push(ch);
  }
  const ok = missing.length === 0;
  if (!ok) allOk = false;
  console.log(ok ? '✅' : '❌', JSON.stringify(label), ok ? 'all glyphs present' : 'MISSING: ' + missing.join(','));
}
console.log('---');
console.log('glyph keys:', [...keys].sort().join(' '));
console.log(allOk ? 'RESULT: PASS — every affected label fully renderable' : 'RESULT: FAIL');
process.exit(allOk ? 0 : 1);
