#!/usr/bin/env node
// Restores the per-sprite JSON source files that build-sprite-data.mjs consumes,
// extracting them back OUT of the generated frontend/src/spriteData.ts (whose source
// JSONs were lost). After this runs, the documented edit-JSON→rebuild workflow works
// again and a rebuild reproduces spriteData.ts byte-for-byte (round-trip verified in
// qa-sprite-roundtrip / the caller).
//
//   node tools/pixel-art/extract-json.mjs [out-dir]   (default: tools/pixel-art/sprites)
//
// spriteData.ts is data-only (an object literal of {scale,frameRate,palette,frames}).
// We strip the TS-only bits (comment header, `import type`, the typed declaration) and
// evaluate the remaining object literal in a sandbox — no TS compiler needed.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SPRITE_DATA = path.join(HERE, '..', '..', 'frontend', 'src', 'spriteData.ts');
const OUT_DIR = process.argv[2] || path.join(HERE, 'sprites');
fs.mkdirSync(OUT_DIR, { recursive: true });

let src = fs.readFileSync(SPRITE_DATA, 'utf8');
// Turn the TS module into an evaluatable expression: drop the import and the typed
// `export const NAME: Type =`, keep just the `{ ... }` object literal.
src = src.replace(/import type[^\n]*\n/, '');
src = src.replace(/export const ENEMY_SPRITE_DATA\s*:\s*Record<[^>]*>\s*=\s*/, 'return ');
const data = new Function(src.replace(/^\/\*[\s\S]*?\*\/\s*/, '') + '\n')();

const names = Object.keys(data);
for (const name of names) {
  const d = data[name];
  // Emit in the exact field order build-sprite-data.mjs expects, name first.
  const json = { name, scale: d.scale ?? 8, frameRate: d.frameRate ?? 6, palette: d.palette, frames: d.frames };
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(json, null, 2) + '\n');
}
console.log(`extracted ${names.length} sprites → ${OUT_DIR}`);
console.log(names.join(', '));
