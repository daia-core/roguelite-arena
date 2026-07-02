/**
 * Procedural pixel-art terrain painter. Game-agnostic core:
 * given a tone ramp, optional organic patches (dirt/sand/etc.) and a set of
 * decoration stamps (tiny grid+palette sprites, same data format as
 * pixel/sprite.ts), paints a stable, deterministic ground onto a canvas —
 * everything aligned to one art-pixel grid so it reads as hand-tiled pixel art.
 */

import { hash2, patchNoise, dither } from './hash';

export interface TerrainDecoration {
  /** Tiny index grid, same conventions as SpriteDef frames. */
  grid: number[][];
  palette: string[];
  /** Candidate spacing in art pixels — one roll per cellSize×cellSize cell. */
  cellSize: number;
  /** Chance per cell that this decoration is stamped. */
  chance: number;
  /** Distinct salt so different decorations don't correlate. */
  salt: number;
}

export interface TerrainPatches {
  colors: { base: string; dark: string; light: string };
  /** Candidate spacing in art pixels. */
  cellSize: number;
  chance: number;
  minRadius: number;
  maxRadius: number;
  salt: number;
}

export interface TerrainConfig {
  /** Canvas pixels per art pixel (match your sprite scale). */
  artScale: number;
  tones: { base: string; light: string; dark: string };
  /** patchNoise thresholds: above light → light tone, below dark → dark tone. */
  toneThresholds?: { light: number; dark: number };
  toneSalt?: number;
  patches?: TerrainPatches;
  decorations?: TerrainDecoration[];
  /** Dithered darkening toward canvas edges (pixel-art vignette). */
  edgeFade?: { width: number; color: string };
}

export function paintTerrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cfg: TerrainConfig
): void {
  const ART = cfg.artScale;
  const cols = Math.ceil(width / ART);
  const rows = Math.ceil(height / ART);
  const px = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * ART, y * ART, ART, ART);
  };

  // Base + tonal patches
  const { light: lightT, dark: darkT } = cfg.toneThresholds ?? { light: 0.62, dark: 0.34 };
  const toneSalt = cfg.toneSalt ?? 0;
  ctx.fillStyle = cfg.tones.base;
  ctx.fillRect(0, 0, width, height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const n = patchNoise(x, y, toneSalt);
      if (n > lightT) px(x, y, cfg.tones.light);
      else if (n < darkT) px(x, y, cfg.tones.dark);
    }
  }

  // Organic material patches (dirt, sand, ...): irregular blobs, dithered rim
  if (cfg.patches) {
    const p = cfg.patches;
    for (let cy = 0; cy < rows / p.cellSize + 1; cy++) {
      for (let cx = 0; cx < cols / p.cellSize + 1; cx++) {
        if (hash2(cx, cy, p.salt) > p.chance) continue;
        const centerX = Math.floor((cx + 0.25 + hash2(cx, cy, p.salt + 2) * 0.5) * p.cellSize);
        const centerY = Math.floor((cy + 0.25 + hash2(cx, cy, p.salt + 4) * 0.5) * p.cellSize);
        const radius = p.minRadius + hash2(cx, cy, p.salt + 6) * (p.maxRadius - p.minRadius);
        const r = Math.ceil(radius + 2);
        for (let y = centerY - r; y <= centerY + r; y++) {
          for (let x = centerX - r; x <= centerX + r; x++) {
            if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
            const wobble = (hash2(x, y, p.salt + 8) - 0.5) * 3.5;
            const dist = Math.hypot(x - centerX, y - centerY) + wobble;
            if (dist > radius) continue;
            if (dist > radius - 1.6 && (x + y) % 2 === 0) continue; // dithered rim
            const speckle = hash2(x, y, p.salt + 10);
            px(x, y, speckle < 0.12 ? p.colors.dark : speckle > 0.88 ? p.colors.light : p.colors.base);
          }
        }
      }
    }
  }

  // Decoration stamps
  for (const deco of cfg.decorations ?? []) {
    const gw = Math.max(...deco.grid.map((r) => r.length));
    const gh = deco.grid.length;
    for (let cy = 0; cy < rows / deco.cellSize + 1; cy++) {
      for (let cx = 0; cx < cols / deco.cellSize + 1; cx++) {
        if (hash2(cx, cy, deco.salt) > deco.chance) continue;
        const dx = Math.floor(cx * deco.cellSize + hash2(cx, cy, deco.salt + 2) * Math.max(1, deco.cellSize - gw));
        const dy = Math.floor(cy * deco.cellSize + hash2(cx, cy, deco.salt + 4) * Math.max(1, deco.cellSize - gh));
        deco.grid.forEach((row, gy) => {
          row.forEach((cell, gx) => {
            if (cell > 0 && deco.palette[cell] && deco.palette[cell] !== 'transparent') {
              px(dx + gx, dy + gy, deco.palette[cell]);
            }
          });
        });
      }
    }
  }

  // Dithered edge fade (replaces smooth gradient vignettes)
  if (cfg.edgeFade) {
    const { width: fade, color } = cfg.edgeFade;
    ctx.fillStyle = color;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.min(x, y, cols - 1 - x, rows - 1 - y);
        if (d >= fade) continue;
        if (dither(x, y, 1 - d / fade)) {
          ctx.fillRect(x * ART, y * ART, ART, ART);
        }
      }
    }
  }
}
