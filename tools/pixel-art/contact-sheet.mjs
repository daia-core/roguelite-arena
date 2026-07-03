// Render enemy JSON sprites into labeled contact sheets on a grass-green
// background (game context). Groups sprites N per row across several sheets.
//   node tools/pixel-art/contact-sheet.mjs <json-dir> <outdir> [prefix]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(filePath, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(filePath, png);
}
function parseHex(hex) { if (!hex || hex === 'transparent') return null; const h = hex.replace('#',''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }

// tiny 3x5 bitmap font for labels
const FONT = {
  A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['011','100','100','100','011'],D:['110','101','101','101','110'],E:['111','100','110','100','111'],F:['111','100','110','100','100'],G:['011','100','101','101','011'],H:['101','101','111','101','101'],I:['111','010','010','010','111'],J:['001','001','001','101','010'],K:['101','101','110','101','101'],L:['100','100','100','100','111'],M:['101','111','111','101','101'],N:['101','111','111','111','101'],O:['010','101','101','101','010'],P:['110','101','110','100','100'],Q:['010','101','101','110','011'],R:['110','101','110','101','101'],S:['011','100','010','001','110'],T:['111','010','010','010','010'],U:['101','101','101','101','111'],V:['101','101','101','101','010'],W:['101','101','111','111','101'],X:['101','101','010','101','101'],Y:['101','101','010','010','010'],Z:['111','001','010','100','111'],_:['000','000','000','000','111'],' ':['000','000','000','000','000'],0:['111','101','101','101','111'],1:['010','110','010','010','111'],2:['110','001','010','100','111'],3:['110','001','010','001','110'],4:['101','101','111','001','001'],5:['111','100','110','001','110'],6:['011','100','110','101','010'],7:['111','001','010','010','010'],8:['010','101','010','101','010'],9:['010','101','011','001','110']};
function drawText(rgba, W, x, y, text, scale = 2) {
  const up = text.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      if (g[r][c] === '1') for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        const px = cx + c*scale + sx, py = y + r*scale + sy, i = (py*W+px)*4;
        rgba[i]=235; rgba[i+1]=245; rgba[i+2]=235; rgba[i+3]=255;
      }
    }
    cx += 4 * scale;
  }
}

const [jsonDir, outDir, prefix = 'enemy'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json')).sort();
const sprites = files.map(f => JSON.parse(fs.readFileSync(path.join(jsonDir, f), 'utf8')));

const CELL = 200;        // per-sprite cell (px)
const COLS = 5;
const PER_SHEET = 15;    // 3 rows of 5
const LABEL_H = 22;

for (let s = 0; s < sprites.length; s += PER_SHEET) {
  const group = sprites.slice(s, s + PER_SHEET);
  const rows = Math.ceil(group.length / COLS);
  const W = COLS * CELL, H = rows * CELL;
  const rgba = new Uint8Array(W * H * 4);
  // grass-green backdrop
  for (let i = 0; i < W*H; i++) { rgba[i*4]=0x6a; rgba[i*4+1]=0xb6; rgba[i*4+2]=0x3e; rgba[i*4+3]=255; }
  group.forEach((sp, gi) => {
    const col = gi % COLS, row = (gi / COLS) | 0;
    const cx0 = col * CELL, cy0 = row * CELL;
    const frame = sp.frames[0];
    const gw = frame[0].length, gh = frame.length;
    const scale = Math.min((CELL - 24) / gw, (CELL - 24 - LABEL_H) / gh) | 0;
    const sw = gw * scale, sh = gh * scale;
    const ox = cx0 + ((CELL - sw) >> 1), oy = cy0 + ((CELL - LABEL_H - sh) >> 1) + 4;
    const colors = sp.palette.map(parseHex);
    frame.forEach((rowArr, gy) => rowArr.forEach((cell, gx) => {
      const rgb = colors[cell]; if (!rgb || cell === 0) return;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        const px = ox+gx*scale+sx, py = oy+gy*scale+sy, i = (py*W+px)*4;
        rgba[i]=rgb[0]; rgba[i+1]=rgb[1]; rgba[i+2]=rgb[2]; rgba[i+3]=255;
      }
    }));
    drawText(rgba, W, cx0 + 8, cy0 + CELL - LABEL_H + 2, sp.name, 2);
  });
  const sheetIdx = (s / PER_SHEET) | 0;
  const file = path.join(outDir, `${prefix}-sheet-${sheetIdx}.png`);
  writePNG(file, W, H, rgba);
  console.log('wrote', file);
}
