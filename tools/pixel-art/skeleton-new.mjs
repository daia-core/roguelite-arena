#!/usr/bin/env node
// Improved skeleton.json — SURGICAL modern-technique pass (same method as player-new.mjs).
//
// We LOAD the committed original skeleton grid and rewrite only interior tones, cell by cell,
// so the silhouette (every transparent + black-outline cell) is preserved EXACTLY. What changes
// (SPRITE-STYLE.md modern technique):
//   - flat bone (near-single beige) → form light from top-left: warm highlight on the top-left
//     of the skull/ribs/limbs, cool hue-shifted shadow on the right side and undersides
//   - the two flat green eye slabs become glowing sockets: dark socket rim + a bright green
//     core with a hot near-white center pixel, so the eyes read as living eye-lights
//   - ribs get a highlight lip on their top edge (bone catches the top-left light)
//   - the loincloth gets a small warm highlight so it isn't a flat red block
//   - the steel sword gets a rim-highlight up its lit (left) edge
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, 'sprites', 'skeleton.json');

// New palette. Index 0 transparent, 1 outline; original tones kept, plus hue-shifted
// highlight/shadow steps for form modelling and a hot eye core.
const palette = [
  'transparent', // 0
  '#000000',     // 1 outline
  // bone ramp (warm highlight → light → mid → cool shadow)
  '#fff6dc',     // 2 bone highlight (orig, warm)
  '#efe2be',     // 3 bone light (new — a step between hi and mid so the ramp reads smooth)
  '#e3d4ae',     // 4 bone mid (orig)
  '#c6b48c',     // 5 bone shadow (new, slightly cooler/desaturated)
  '#a2967c',     // 6 bone deep shadow (orig #a2967c)
  '#6b665f',     // 7 socket/rib dark (orig)
  // eyes (glow)
  '#1f7a2e',     // 8  eye socket rim (dark green, so the glow has depth)
  '#45e05f',     // 9  eye glow mid (orig green)
  '#b8ffca',     // 10 eye glow hot core (near-white green)
  // loincloth
  '#a03028',     // 11 cloth mid (orig)
  '#c14b3a',     // 12 cloth highlight (new, warmer/lighter)
  '#5f1b22',     // 13 cloth shadow (orig)
  // sword steel
  '#b9c2d4',     // 14 steel highlight (orig)
  '#66708a',     // 15 steel mid (orig)
  '#d9e2f2',     // 16 steel rim-highlight (new, brightest lit edge)
];

// Load original skeleton frames from the committed original saved to /tmp.
const origTs = fs.readFileSync('/tmp/orig-skeleton-spritedata.ts', 'utf8')
  .replace(/import type[^\n]*\n/, '')
  .replace(/export const ENEMY_SPRITE_DATA\s*:\s*Record<[^>]*>\s*=\s*/, 'return ')
  .replace(/^\/\*[\s\S]*?\*\/\s*/, '');
const origData = new Function(origTs + '\n')();
const orig = origData.skeleton;
const OP = orig.palette; // original palette hex list
const hexOf = (frame, y, x) => OP[frame[y][x]];
const g0 = orig.frames[0];
const H = g0.length, W = g0[0].length;

// New-palette index by hex (first match).
const NI = {}; palette.forEach((h, i) => { if (!(h in NI)) NI[h] = i; });
const T = 0, O = 1;

// Original tone hexes we classify against.
const BONE_HI = '#fff6dc', BONE_MID = '#e3d4ae', BONE_DK = '#a2967c', RIBDK = '#6b665f';
const EYE = '#45e05f', CLOTH = '#a03028', CLOTHDK = '#5f1b22', STEEL_HI = '#b9c2d4', STEEL_MID = '#66708a';

// Per-cell tone chooser. Transparent/outline copied verbatim → silhouette frozen.
function remap(frame, y, x) {
  const hex = hexOf(frame, y, x);
  if (hex === 'transparent') return T;
  if (hex === '#000000') return O;

  // --- Bone: apply top-left form light. The skull sits rows ~1..5, ribs/torso ~6..9,
  // legs ~10..15. Light from top-left → left/top cells warm-light, right/bottom cells cool-shadow.
  if (hex === BONE_HI || hex === BONE_MID || hex === BONE_DK) {
    const leftLit = x <= 4;
    const rightShade = x >= 10;
    const lowRow = y >= 11;                 // leg undersides fall into shadow
    if (hex === BONE_DK) {
      // deepest originally-shadowed cells: keep them deep, but the ones on the LIT side lift to mid
      return leftLit && !lowRow ? NI['#c6b48c'] : NI['#a2967c'];
    }
    // originally hi/mid bone
    if (leftLit && y <= 5) return NI['#fff6dc'];         // lit skull brow → brightest
    if (rightShade || lowRow) return NI['#c6b48c'];      // right side + leg undersides → cool shadow
    if (x <= 6) return NI['#efe2be'];                    // gentle light on the left-center
    return NI['#e3d4ae'];                                // mid elsewhere
  }
  if (hex === RIBDK) {
    // rib-shadow gaps stay dark (they're the gaps BETWEEN ribs) — keep as socket dark
    return NI['#6b665f'];
  }

  // --- Eyes: build a glow. The original flat green slab becomes a socket rim + hot core.
  // We give every eye cell the mid glow here; a post-pass adds the dark rim + hot core so
  // the eye reads as a light source rather than a flat sticker.
  if (hex === EYE) return NI['#45e05f'];

  // --- Loincloth: a touch of warm highlight on the lit-left, shadow kept.
  if (hex === CLOTH) return x <= 4 ? NI['#c14b3a'] : NI['#a03028'];
  if (hex === CLOTHDK) return NI['#5f1b22'];

  // --- Sword steel: rim-highlight up the lit edge.
  if (hex === STEEL_HI) return NI['#d9e2f2'];
  if (hex === STEEL_MID) return NI['#66708a'];

  return NI[hex] ?? O; // fallback
}

function buildFrame(frame) {
  const grid = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) row.push(remap(frame, y, x));
    grid.push(row);
  }
  // Post-pass: sculpt the eye glow. For each run of original eye cells, darken the outer rim,
  // keep the middle mid-green, and add a hot near-white core so the eye reads as a glowing light.
  const eyeIdxOrig = OP.indexOf('#45e05f');
  for (let y = 0; y < H; y++) {
    // find horizontal runs of eye cells on this row
    let x = 0;
    while (x < W) {
      if (frame[y][x] === eyeIdxOrig) {
        let x2 = x;
        while (x2 < W && frame[y][x2] === eyeIdxOrig) x2++;
        const len = x2 - x;
        // Each eye is a short (usually 2px) glowing socket. Paint it as a left-lit glow:
        //   len 1 → single hot pixel
        //   len 2 → [glow-mid, hot-core]  (the light source sits inner/toward center of skull)
        //   len>=3 → [dark rim, glow-mid…, hot-core, dark rim] for a fuller socket
        // The black skull outline already frames each eye, so we don't need a heavy dark rim on
        // a 2px eye — that made the eyes read as half-lit slivers. Keep the glow clean + centered.
        if (len === 1) {
          grid[y][x] = NI['#b8ffca'];
        } else if (len === 2) {
          // Hot core faces the skull midline so the two eyes read as a matched, inward-glowing
          // pair rather than both looking the same way. Left-half eye → hot on its right pixel;
          // right-half eye → hot on its left pixel.
          const leftHalf = x + 0.5 < W / 2;
          grid[y][x]     = leftHalf ? NI['#45e05f'] : NI['#b8ffca'];
          grid[y][x + 1] = leftHalf ? NI['#b8ffca'] : NI['#45e05f'];
        } else {
          for (let k = x; k < x2; k++) {
            const rel = k - x;
            const isRim = (rel === 0 || rel === len - 1);
            const isCore = (rel === len - 2);      // hot core just inside the inner rim
            grid[y][k] = isRim ? NI['#1f7a2e'] : isCore ? NI['#b8ffca'] : NI['#45e05f'];
          }
        }
      }
      x++;
    }
  }
  return grid;
}

const frames = orig.frames.map(buildFrame);
const out = { name: 'skeleton', scale: orig.scale ?? 8, frameRate: orig.frameRate ?? 6, palette, frames };
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${OUT}: ${frames.length} frames, ${W}x${H}, palette ${palette.length}`);
