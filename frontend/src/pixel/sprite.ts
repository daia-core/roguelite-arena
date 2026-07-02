/**
 * Data-driven pixel sprite renderer. Game-agnostic core:
 * a sprite is a palette + one or more index grids; this module turns that data
 * into canvases, animations, and effect variants (tint silhouettes, dithered
 * transparency) — everything a 2D canvas pixel game needs to draw creatures.
 */

export interface SpriteDef {
  /** Canvas pixels per art pixel. Default 8. */
  scale?: number;
  /** Frames per second when frames.length > 1. Default 6 (idle). */
  frameRate?: number;
  /** Index 0 must be 'transparent'; by convention index 1 is the outline. */
  palette: string[];
  /** One or more 2D index grids (rows of palette indices). */
  frames: number[][][];
}

export interface RenderedSprite {
  frames: HTMLCanvasElement[];
  frameRate: number;
}

/** Render one index grid to a canvas. */
export function renderGrid(
  grid: number[][],
  palette: string[],
  scale: number
): HTMLCanvasElement {
  const rows = grid.length;
  const cols = Math.max(...grid.map((r) => r.length));
  const canvas = document.createElement('canvas');
  canvas.width = cols * scale;
  canvas.height = rows * scale;
  const ctx = canvas.getContext('2d')!;
  grid.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell > 0 && palette[cell] && palette[cell] !== 'transparent') {
        ctx.fillStyle = palette[cell];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });
  });
  return canvas;
}

/** Render a full sprite definition (all frames). */
export function renderSprite(def: SpriteDef): RenderedSprite {
  const scale = def.scale ?? 8;
  return {
    frames: def.frames.map((f) => renderGrid(f, def.palette, scale)),
    frameRate: def.frameRate ?? 6,
  };
}

const tintCache = new Map<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();

/**
 * A solid-color silhouette of a sprite (for hit flashes, spawn blinks).
 * Pixel-perfect: exactly the sprite's opaque pixels, in the tint color.
 * Cached per (canvas, color).
 */
export function tintSilhouette(
  sprite: HTMLCanvasElement,
  color: string
): HTMLCanvasElement {
  let byColor = tintCache.get(sprite);
  if (!byColor) {
    byColor = new Map();
    tintCache.set(sprite, byColor);
  }
  const cached = byColor.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(sprite, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  byColor.set(color, canvas);
  return canvas;
}

/**
 * Draw a sprite with dithered transparency (checkerboard-style hole pattern)
 * instead of smooth alpha — the pixel-art way to show ghosts/phasing.
 * coverage: fraction of 2px cells kept, e.g. 0.6 keeps ~60%.
 */
export function drawDithered(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  coverage: number,
  ditherSize: number = 4
): void {
  ctx.save();
  ctx.beginPath();
  // Sparse coverage keeps every Nth cell; dense coverage skips every Nth cell.
  const sparse = coverage < 0.5;
  const n = sparse
    ? Math.max(1, Math.round(1 / Math.max(0.02, coverage)))
    : Math.max(2, Math.round(1 / Math.max(0.02, 1 - coverage)));
  let i = 0;
  for (let dx = 0; dx < sprite.width; dx += ditherSize) {
    for (let dy = 0; dy < sprite.height; dy += ditherSize) {
      i++;
      const keep = sparse ? i % n === 0 : i % n !== 0;
      if (keep) {
        ctx.rect(x + dx, y + dy, ditherSize, ditherSize);
      }
    }
  }
  ctx.clip();
  ctx.drawImage(sprite, x, y);
  ctx.restore();
}
