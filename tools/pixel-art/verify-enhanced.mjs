import fs from 'node:fs';
const rd = (p) => {
  let s = fs.readFileSync(p, 'utf8')
    .replace(/import type[^\n]*\n/, '')
    .replace(/export const ENEMY_SPRITE_DATA\s*:\s*Record<[^>]*>\s*=\s*/, 'return ')
    .replace(/^\/\*[\s\S]*?\*\//, '');
  return new Function(s + '\n')();
};
const cur = rd('/workspace/work/roguelite-game/frontend/src/spriteData.ts');
const orig = rd('/tmp/orig-spritedata.ts');
const NON = new Set(['player','skeleton','bullet','enemy_bullet','orbiting_orb','bomb','xp','gold','health_orb','worm_head','worm_body','eggsac']);
const enemies = Object.keys(orig).filter(n => !NON.has(n));
const notEnhanced = [];
for (const n of enemies) {
  if (cur[n].palette.length <= orig[n].palette.length) notEnhanced.push(`${n}(${orig[n].palette.length}->${cur[n].palette.length})`);
}
console.log('enemies:', enemies.length, '| enhanced:', enemies.length - notEnhanced.length);
console.log('NOT enhanced:', notEnhanced.length ? notEnhanced.join(', ') : 'none — all good');
console.log('player:', cur.player.palette.length, 'skeleton:', cur.skeleton.palette.length, '(should be 20 / 17, untouched)');
