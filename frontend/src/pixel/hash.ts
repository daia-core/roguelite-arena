/**
 * Deterministic hashing + blocky value noise for pixel-art procedural work.
 * Game-agnostic: no imports, no state. Same inputs → same outputs forever,
 * which keeps procedurally painted scenes stable across frames and resizes.
 */

/** Deterministic 2D hash → [0, 1). */
export function hash2(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/**
 * Two-octave blocky value noise with per-pixel jitter, tuned for art-pixel
 * grids: produces organic tonal patches without visible square block edges.
 */
export function patchNoise(x: number, y: number, salt: number): number {
  const jx = Math.floor((hash2(x, y, salt + 7) - 0.5) * 7);
  const jy = Math.floor((hash2(x, y, salt + 9) - 0.5) * 7);
  return (
    hash2((x + jx) >> 4, (y + jy) >> 4, salt + 11) * 0.55 +
    hash2((x + jy) >> 3, (y + jx) >> 3, salt + 23) * 0.35 +
    hash2(x, y, salt + 31) * 0.1
  );
}

/** 4x4 Bayer matrix (values 0..15) for ordered dithering. */
export const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

/** Ordered-dither test: returns true if a pixel at (x,y) should be painted for
 * the given strength in [0,1]. Use instead of alpha gradients in pixel art. */
export function dither(x: number, y: number, strength: number): boolean {
  return BAYER4[(x % 4) + (y % 4) * 4] / 16 < strength;
}
