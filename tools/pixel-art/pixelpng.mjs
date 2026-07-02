// Minimal PNG writer + pixel-art sprite renderer (no deps, pure Node).
// Usage as CLI:  node pixelpng.mjs <sprite-module.mjs> <outdir>
//   where sprite-module.mjs does:  export const sprites = [{ name, scale?, palette, frames }]
//   - palette: string[] of '#rrggbb' (index 0 ignored/transparent, or 'transparent')
//   - frames: number[][][] (one or more 2D index grids)
// Renders each frame at the sprite scale (default 8) on a checkered backdrop
// so transparency and silhouette are visible, side by side in one PNG.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8Array of w*h*4 */
export function writePNG(filePath, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

function parseHex(hex) {
  if (!hex || hex === 'transparent') return null;
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Render frames side by side on a checkered backdrop. */
export function renderSprite({ name, scale = 8, palette, frames }, outDir) {
  const pad = 8;
  const gh = Math.max(...frames.map(f => f.length));
  const gw = Math.max(...frames.map(f => Math.max(...f.map(r => r.length))));
  const w = frames.length * (gw * scale + pad) + pad;
  const h = gh * scale + pad * 2;
  const rgba = new Uint8Array(w * h * 4);
  // checkered backdrop (two dark greys so black outlines still show)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = ((x >> 3) + (y >> 3)) % 2 ? 58 : 46;
      const i = (y * w + x) * 4;
      rgba[i] = v; rgba[i + 1] = v + 4; rgba[i + 2] = v; rgba[i + 3] = 255;
    }
  }
  const colors = palette.map(parseHex);
  frames.forEach((grid, fi) => {
    const ox = pad + fi * (gw * scale + pad);
    grid.forEach((row, gy) => {
      row.forEach((cell, gx) => {
        const rgb = colors[cell];
        if (!rgb || cell === 0) return;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = ox + gx * scale + sx;
            const py = pad + gy * scale + sy;
            const i = (py * w + px) * 4;
            rgba[i] = rgb[0]; rgba[i + 1] = rgb[1]; rgba[i + 2] = rgb[2]; rgba[i + 3] = 255;
          }
        }
      });
    });
  });
  const file = path.join(outDir, `${name}.png`);
  writePNG(file, w, h, rgba);
  return file;
}

// CLI
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const [modPath, outDir] = process.argv.slice(2);
  if (!modPath || !outDir) {
    console.error('usage: node pixelpng.mjs <sprite-module.mjs> <outdir>');
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const mod = await import(path.resolve(modPath));
  for (const s of mod.sprites) console.log('wrote', renderSprite(s, outDir));
}
