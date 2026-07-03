#!/usr/bin/env node
// Improved orc.json — SURGICAL modern-technique pass (same method as player-new.mjs / skeleton-new.mjs).
//
// Loads the committed original orc grid and rewrites ONLY interior tones, cell by cell, so the
// silhouette (every transparent + exterior black-outline cell) is preserved EXACTLY. The orc was
// the flattest of the early enemies: a single mid-green body with no form modelling, two black
// eye-slabs, and a flat brown/steel weapon. Modern technique applied (SPRITE-STYLE.md):
//   - flat green body → 4-tone HUE-SHIFTED form light from top-left: a warm (toward-yellow)
//     highlight on the top-left of the head/shoulders, a cool (toward blue-green) shadow down the
//     right side + undersides. No pillow shading — light has a direction.
//   - the red under-eyes become GLOWING eyes: bright red with a hot amber core pixel facing inward,
//     so the two eyes read as a menacing matched pair instead of dull red smears under black slabs.
//   - the steel axe-head gets a bright rim-highlight up its lit (top-left) edge.
//   - the brown handle/belt/arms get a warm highlight on their lit-left cells (kept the deep-brown
//     shadow), so the wood/leather has form instead of reading as one flat brown block.
//   - the cream tusks keep their bright value (already the face highlight) — untouched.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(HERE, 'sprites', 'orc.json');
const orig = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const OP = orig.palette;

// New palette: originals kept + hue-shifted highlight/shadow steps.
const palette = [
  'transparent', // 0
  '#000000',     // 1 outline
  // green ramp (warm highlight → light → mid → cool shadow → deep shadow)
  '#c6d46e',     // 2 green warm highlight (NEW — brighter + warmer than the old light)
  '#a6c052',     // 3 green light (orig #a6c052)
  '#6f8f44',     // 4 green mid (orig #6f8f44)
  '#52704a',     // 5 green cool shadow (NEW — desaturated, shifted toward blue-green)
  '#46633c',     // 6 green deep shadow (orig #46633c)
  // face
  '#f5ead0',     // 7 tusk/cream (orig)
  // eyes (glow)
  '#f24b39',     // 8 eye bright red (a touch hotter than orig #e33b2c)
  '#ffcf4a',     // 9 eye hot amber core (NEW)
  '#5a1712',     // 10 eye deep socket (NEW — unused unless a 3px eye appears; keeps ramp honest)
  // weapon / leather
  '#8a5a30',     // 11 brown mid (orig)
  '#a56b3a',     // 12 brown warm highlight (NEW)
  '#57351f',     // 13 brown deep shadow (orig)
  // steel
  '#cdd6dc',     // 14 steel light (orig)
  '#7a8894',     // 15 steel mid (orig)
  '#e9eef4',     // 16 steel rim highlight (NEW, brightest lit edge)
];
const NI = {}; palette.forEach((h, i) => { if (!(h in NI)) NI[h] = i; });
const T = 0, O = 1;

// Original tone hexes we classify against.
const G_LIGHT = '#a6c052', G_MID = '#6f8f44', G_DEEP = '#46633c';
const CREAM = '#f5ead0', RED = '#e33b2c';
const BROWN = '#8a5a30', BROWN_DK = '#57351f';
const STEEL_HI = '#cdd6dc', STEEL_MID = '#7a8894';
const hexOf = (frame, y, x) => OP[frame[y][x]];

function buildFrame(frame) {
  const H = frame.length, W = frame[0].length;
  // normalize the idle-bounce vertical offset: find the top content row this frame.
  let top = 0; for (let y = 0; y < H; y++) { if (frame[y].some(v => v !== 0)) { top = y; break; } }

  const isEdgeLit = (y, x) => {
    // a cell is on the lit rim if the cell up or up-left is outside the body (transparent/outline)
    const up = (y > 0) ? OP[frame[y - 1][x]] : 'transparent';
    const upl = (y > 0 && x > 0) ? OP[frame[y - 1][x - 1]] : 'transparent';
    const isOut = (h) => h === 'transparent' || h === '#000000';
    return isOut(up) || isOut(upl);
  };

  const grid = frame.map((row, y) => row.map((_, x) => {
    const hex = hexOf(frame, y, x);
    const yy = y - top; // normalized row
    if (hex === 'transparent') return T;
    if (hex === '#000000') return O;

    // --- Green body: top-left warm light → bottom-right cool shadow.
    if (hex === G_LIGHT) {
      // the old left-highlight column — brightest at the top, drop to plain light lower down.
      return yy <= 5 ? NI['#c6d46e'] : NI['#a6c052'];
    }
    if (hex === G_MID) {
      if (yy <= 4 && x <= 6) return NI['#a6c052'];        // lit top-left face → light
      if (x >= 9 || yy >= 10) return NI['#52704a'];        // right side + undersides → cool shadow
      return NI['#6f8f44'];                                 // mid elsewhere
    }
    if (hex === G_DEEP) return NI['#46633c'];               // deep shadow stays

    // --- Cream tusks: keep bright (face highlight).
    if (hex === CREAM) return NI['#f5ead0'];

    // --- Red eyes: post-pass sculpts the hot core; here map to bright red.
    if (hex === RED) return NI['#f24b39'];

    // --- Brown wood/leather: warm highlight on the lit-left cells, deep shadow kept.
    if (hex === BROWN) return (x <= 5 || isEdgeLit(y, x)) ? NI['#a56b3a'] : NI['#8a5a30'];
    if (hex === BROWN_DK) return NI['#57351f'];

    // --- Steel axe: rim highlight up the lit edge, else keep the two steel tones.
    if (hex === STEEL_HI) return isEdgeLit(y, x) ? NI['#e9eef4'] : NI['#cdd6dc'];
    if (hex === STEEL_MID) return NI['#7a8894'];

    return NI[hex] ?? O;
  }));

  // Post-pass: sculpt each horizontal run of red eye cells into a glowing eye with a hot amber
  // core facing the FACE midline (the centroid of all eye cells), so the two eyes read as a
  // matched inward-glowing pair rather than both glancing the same way.
  const redIdx = OP.indexOf(RED);
  let eyeSumX = 0, eyeN = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (frame[y][x] === redIdx) { eyeSumX += x; eyeN++; }
  const eyeCenterX = eyeN ? eyeSumX / eyeN : W / 2;
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (frame[y][x] === redIdx) {
        let x2 = x; while (x2 < W && frame[y][x2] === redIdx) x2++;
        const len = x2 - x;
        if (len === 1) {
          grid[y][x] = NI['#ffcf4a'];
        } else if (len === 2) {
          const leftHalf = (x + 0.5) < eyeCenterX;   // this eye sits left of the face midline
          grid[y][x]     = leftHalf ? NI['#f24b39'] : NI['#ffcf4a'];
          grid[y][x + 1] = leftHalf ? NI['#ffcf4a'] : NI['#f24b39'];
        } else {
          for (let k = x; k < x2; k++) {
            const rel = k - x, isRim = (rel === 0 || rel === len - 1), isCore = (rel === len - 2);
            grid[y][k] = isRim ? NI['#5a1712'] : isCore ? NI['#ffcf4a'] : NI['#f24b39'];
          }
        }
      }
      x++;
    }
  }
  return grid;
}

const frames = orig.frames.map(buildFrame);
const out = { name: 'orc', scale: orig.scale ?? 8, frameRate: orig.frameRate ?? 6, palette, frames };
fs.writeFileSync(SRC, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${SRC}: ${frames.length} frames, palette ${palette.length}`);
