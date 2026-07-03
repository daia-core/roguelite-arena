#!/usr/bin/env node
// GENERALIZED sprite enhancer — modern pixel-art form-lighting, applied uniformly and safely.
//
// Usage:  node enhance-sprite.mjs <name> [<name> ...]
//         node enhance-sprite.mjs --all-enemies
//
// Method (SPRITE-STYLE.md modern technique, silhouette-preserving):
//   Loads the COMMITTED original sprite grid (from /tmp/orig-spritedata.ts) and rewrites only
//   INTERIOR fill tones. Transparent cells and pure-black outline cells are copied verbatim, so
//   the silhouette + hitbox are byte-identical.
//
//   Interior cells get INNER-RIM form light from the top-left:
//     - a cell whose UP or LEFT neighbour is "empty" (transparent or outline) sits on the lit
//       top-left edge  → lift toward a warm, hue-shifted HIGHLIGHT (both up&left empty = corner,
//       lifted more).
//     - a cell whose DOWN or RIGHT neighbour is "empty" sits on the shaded bottom-right edge
//       → drop toward a cool, hue-shifted SHADOW.
//     - fully-surrounded interior cells keep their base tone.
//   Highlights rotate hue toward warm (~50°) and raise lightness; shadows rotate toward cool
//   (~250°), lower lightness and slightly raise saturation — this is hue-shifted ramping, the
//   core modern technique (never lightness-only).
//
//   SAFETY: already-saturated bright cells (S>0.55 && L>0.5) are treated as glow/eyes and left
//   UNSHIFTED so we never dull an eye-light or gem. Lightness is clamped so highlights don't clip
//   to white and shadows don't merge into the black outline.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SPRITES_DIR = path.join(HERE, 'sprites');
const ORIG = '/tmp/orig-spritedata.ts';

// ---- load committed original sprite data ----
const srcTs = fs.readFileSync(ORIG, 'utf8')
  .replace(/import type[^\n]*\n/, '')
  .replace(/export const ENEMY_SPRITE_DATA\s*:\s*Record<[^>]*>\s*=\s*/, 'return ')
  .replace(/^\/\*[\s\S]*?\*\//, '');
const DATA = new Function(srcTs + '\n')();

const NON_ENEMY = new Set(['player','skeleton','bullet','enemy_bullet','orbiting_orb','bomb','xp','gold','health_orb','worm_head','worm_body','eggsac']);

// ---- colour helpers ----
function hexToRgb(hex) {
  const m = hex.replace('#','');
  return [parseInt(m.slice(0,2),16), parseInt(m.slice(2,4),16), parseInt(m.slice(4,6),16)];
}
function rgbToHex(r,g,b) {
  const h = (n) => Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0');
  return '#' + h(r) + h(g) + h(b);
}
function rgbToHsl(r,g,b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if (max===min){ h=s=0; }
  else {
    const d=max-min;
    s = l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      default: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return [h*360, s, l];
}
function hslToRgb(h,s,l) {
  h/=360;
  let r,g,b;
  if (s===0){ r=g=b=l; }
  else {
    const hue2rgb=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
    const q = l<0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return [r*255,g*255,b*255];
}
// rotate a hue toward a target hue by frac (0..1) along the shortest arc
function rotateHue(h, target, frac) {
  let diff = ((target - h + 540) % 360) - 180; // shortest signed distance
  return (h + diff*frac + 360) % 360;
}

// Shift a base hex toward highlight (dir>0) or shadow (dir<0), strength scaled by |dir|.
function shift(hex, dir) {
  if (dir === 0) return hex;
  const [r,g,b] = hexToRgb(hex);
  let [h,s,l] = rgbToHsl(r,g,b);
  const strong = Math.abs(dir) >= 2;
  if (dir > 0) {
    // highlight: warmer hue, higher L, slightly lower S
    h = rotateHue(h, 50, strong ? 0.22 : 0.13);
    l = Math.min(0.92, l + (strong ? 0.20 : 0.12));
    s = Math.max(0, s - 0.04);
  } else {
    // shadow: cooler hue, lower L, slightly higher S
    h = rotateHue(h, 250, strong ? 0.20 : 0.12);
    l = Math.max(0.10, l - (strong ? 0.15 : 0.11));
    s = Math.min(1, s + 0.06);
  }
  const [nr,ng,nb] = hslToRgb(h,s,l);
  return rgbToHex(nr,ng,nb);
}

function enhance(name) {
  const sp = DATA[name];
  if (!sp) { console.log(`  skip ${name}: not in original data`); return false; }
  const OP = sp.palette;
  const blackIdx = OP.indexOf('#000000');
  const isEmptyIdx = (idx) => idx === 0 || idx === blackIdx; // transparent or outline

  // classify which original palette entries are "glow" (leave unshifted)
  const glow = OP.map(hex => {
    if (hex === 'transparent' || hex === '#000000') return true; // never shift
    const [r,g,b] = hexToRgb(hex);
    const [,s,l] = rgbToHsl(r,g,b);
    return (s > 0.55 && l > 0.5); // saturated + bright = eye/gem/glow
  });

  // new palette accumulates unique hexes; start with transparent + black at 0/1 like the format
  const newPalette = ['transparent'];
  const idxOf = new Map();
  idxOf.set('transparent', 0);
  const getIdx = (hex) => {
    if (idxOf.has(hex)) return idxOf.get(hex);
    const i = newPalette.length; newPalette.push(hex); idxOf.set(hex, i); return i;
  };
  getIdx('#000000'); // ensure outline is index 1 for readability

  const newFrames = sp.frames.map((frame) => {
    const H = frame.length, W = frame[0].length;
    const empty = (y,x) => (y<0||x<0||y>=H||x>=W) ? true : isEmptyIdx(frame[y][x]);
    const outRows = [];
    for (let y=0;y<H;y++){
      const row=[];
      for (let x=0;x<W;x++){
        const idx = frame[y][x];
        if (idx === 0) { row.push(0); continue; }
        if (idx === blackIdx) { row.push(getIdx('#000000')); continue; }
        const baseHex = OP[idx];
        if (glow[idx]) { row.push(getIdx(baseHex)); continue; } // leave glow untouched
        // inner-rim lighting
        const up = empty(y-1,x), left = empty(y,x-1);
        const down = empty(y+1,x), right = empty(y,x+1);
        let dir = 0;
        if (up || left) dir += (up && left) ? 2 : 1;      // top-left lit edge/corner
        if (down || right) dir -= (down && right) ? 2 : 1; // bottom-right shaded edge/corner
        // net direction; clamp to [-2,2]
        dir = Math.max(-2, Math.min(2, dir));
        const newHex = shift(baseHex, dir);
        row.push(getIdx(newHex));
      }
      outRows.push(row);
    }
    return outRows;
  });

  const out = { name, scale: sp.scale ?? 8, frameRate: sp.frameRate ?? 6, palette: newPalette, frames: newFrames };
  fs.writeFileSync(path.join(SPRITES_DIR, `${name}.json`), JSON.stringify(out, null, 2) + '\n');
  console.log(`  ${name}: ${OP.length}→${newPalette.length} colours, ${newFrames.length} frame(s)`);
  return true;
}

// ---- CLI ----
let names = process.argv.slice(2);
if (names.includes('--all-enemies')) {
  names = Object.keys(DATA).filter(n => !NON_ENEMY.has(n));
}
if (names.length === 0) { console.error('usage: enhance-sprite.mjs <name>... | --all-enemies'); process.exit(1); }
let n = 0;
for (const name of names) if (enhance(name)) n++;
console.log(`\nEnhanced ${n} sprite(s).`);
