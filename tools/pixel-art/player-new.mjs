#!/usr/bin/env node
// Improved player.json — SURGICAL modern-technique pass.
//
// Instead of re-typing the grid (error-prone), we LOAD the original player sprite from
// the committed spriteData.ts and rewrite only interior tones, cell by cell. The
// silhouette (every transparent + black-outline cell) is therefore preserved EXACTLY.
// What changes (SPRITE-STYLE.md modern technique):
//   - flat half-and-half face shading → form light from top-left (hue-shifted skin
//     shadow on the right/under-chin, warm highlight on the top-left cheek/brow)
//   - eyes get a 1px catch-light so the face reads as alive
//   - the two floating brown torso pixels (arm hint) are removed; the hard light/dark
//     shirt seam becomes a 3-step ramp (rim-highlight top-left → light → mid → shadow)
//   - a highlight runs down the lit (left) leg
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, 'sprites', 'player.json');

// New palette. Index 0 transparent, 1 outline; the rest are the original tones plus a
// few hue-shifted highlight/shadow steps for form modelling.
const palette = [
  'transparent', // 0
  '#000000',     // 1 outline
  // skin ramp
  '#c48360',     // 2 skin shadow (hue-shifted, a touch less saturated so it reads as shade not sunburn)
  '#d18d66',     // 3 skin mid (orig)
  '#f0b48a',     // 4 skin light (orig)
  '#ffd3a6',     // 5 skin highlight (warm)
  // hair
  '#5a3115',     // 6 hair shadow
  '#7a4a24',     // 7 hair mid (orig)
  '#96603a',     // 8 hair light (orig)
  // shirt (blue) ramp
  '#39699c',     // 9  shirt shadow (orig)
  '#3f74ab',     // 10 shirt mid
  '#4f8fd0',     // 11 shirt light (orig)
  '#7bb4ec',     // 12 shirt rim-highlight
  // pants
  '#3b5677',     // 13 pants mid (orig)
  '#4a6a90',     // 14 pants highlight
  // belt / boot / buckle / eye
  '#5a3a20',     // 15 belt+boot mid (orig)
  '#6b4423',     // 16 boot (orig)
  '#f2d94e',     // 17 buckle (orig)
  '#2b2b33',     // 18 eye (orig)
  '#dfe9ff',     // 19 eye catch-light
];

// Load original player frames from the committed original (saved to /tmp), NOT the
// working spriteData.ts (which may already carry an in-progress edit).
const origTs = fs.readFileSync('/tmp/orig-player-spritedata.ts', 'utf8')
  .replace(/import type[^\n]*\n/, '')
  .replace(/export const ENEMY_SPRITE_DATA\s*:\s*Record<[^>]*>\s*=\s*/, 'return ')
  .replace(/^\/\*[\s\S]*?\*\/\s*/, '');
const origData = new Function(origTs + '\n')();
const orig = origData.player;
// Original palette index → hex, so we can reason about what each original cell WAS.
const OP = orig.palette; // ['transparent','#000000','#f0b48a',...]
const hexOf = (frame, y, x) => OP[frame[y][x]];
const g0 = orig.frames[0]; // 16×16
const H = g0.length, W = g0[0].length;

// New-palette index by hex (first match).
const NI = {}; palette.forEach((h, i) => { if (!(h in NI)) NI[h] = i; });
const T = 0, O = 1;

// Per-region tone chooser. Given the ORIGINAL cell hex + position, return the new index.
// Everything transparent/outline is copied verbatim → silhouette frozen.
function remap(frame, y, x) {
  const hex = hexOf(frame, y, x);
  if (hex === 'transparent') return T;
  if (hex === '#000000') return O;

  // Classify original region by its base hue.
  const isSkin = hex === '#f0b48a' || hex === '#d18d66';          // 2/3 light+mid skin
  const isEye = hex === '#2b2b33';
  const isHair = hex === '#7a4a24' || hex === '#96603a';           // 4/5
  const isShirt = hex === '#4f8fd0' || hex === '#39699c';          // 6/7
  const isBrownTorso = hex === '#5a3a20' && y <= 10;               // floating arm pixels 8 in torso rows
  const isBelt = hex === '#5a3a20' && y === 11;
  const isBuckle = hex === '#f2d94e';
  const isPants = hex === '#3b5677';
  const isBoot = hex === '#6b4423';

  // Head occupies rows 1..6; light from top-left → highlight upper-left, shadow lower-right.
  if (isEye) {
    // Add catch-light to the immediate upper-right of each pupil (top-left lit source
    // → the glint sits toward the light). Handled in a post-pass; here keep eye.
    return NI['#2b2b33'];
  }
  if (isHair) {
    // top-left rows lighter, right/bottom darker
    if (y <= 2 && x <= 6) return NI['#96603a'];      // hi
    if (x >= W - 5) return NI['#5a3115'];             // shadow right
    return NI['#7a4a24'];
  }
  if (isSkin) {
    const rightEdgeSkin = x >= 10;                    // far-right of the face
    const topLeft = y <= 4 && x <= 6;
    if (rightEdgeSkin || y >= 6) {                    // right side + chin underside → shadow
      return NI['#c48360'];
    }
    if (topLeft) return NI['#ffd3a6'];                // lit brow/cheek highlight
    if (x >= 8) return NI['#d18d66'];                 // gentle mid before the shadow
    return NI['#f0b48a'];                             // lit skin
  }
  if (isBrownTorso) {
    // Remove the floating arm pixels → fill with the shirt tone appropriate to position.
    return x <= 5 ? NI['#4f8fd0'] : x >= 9 ? NI['#39699c'] : NI['#3f74ab'];
  }
  if (isShirt) {
    // 4-step horizontal ramp: rim-hi (x<=4) → light → mid → shadow (x>=10), plus a
    // touch darker on the lowest torso row.
    if (x <= 3) return NI['#7bb4ec'];
    if (x <= 5) return NI['#4f8fd0'];
    if (x <= 8) return NI['#3f74ab'];
    return NI['#39699c'];
  }
  if (isBelt) return NI['#5a3a20'];
  if (isBuckle) return NI['#f2d94e'];
  if (isPants) return x <= 5 ? NI['#4a6a90'] : NI['#3b5677'];  // lit left leg
  if (isBoot) return NI['#6b4423'];
  return NI[hex] ?? O; // fallback
}

function buildFrame(frame) {
  const grid = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) row.push(remap(frame, y, x));
    grid.push(row);
  }
  // Post-pass: add eye catch-lights. Find eye cells; put a 1px highlight to the pixel
  // immediately RIGHT of each pupil if that pixel is currently skin (toward the light).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      if (frame[y][x] === orig.palette.indexOf('#2b2b33')) {
        // right neighbour → catch-light if it's a skin tone in the new grid
        const rn = grid[y][x + 1];
        if ([NI['#f0b48a'], NI['#d18d66'], NI['#ffd3a6'], NI['#c48360']].includes(rn)) {
          grid[y][x + 1] = NI['#dfe9ff'];
        }
      }
    }
  }
  return grid;
}

const frames = orig.frames.map(buildFrame);
const out = { name: 'player', scale: orig.scale ?? 8, frameRate: orig.frameRate ?? 6, palette, frames };
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${OUT}: ${frames.length} frames, ${W}x${H}, palette ${palette.length}`);
