/**
 * Procedural pixel-art UI panels and buttons. Game-agnostic core:
 * draws bevelled, outlined, subtly-textured panels on an art-pixel grid —
 * the classic wood/stone/parchment look — either onto a game canvas or as a
 * generated image for styling DOM elements (CSS background).
 */

import { hash2 } from './hash';

export interface PanelTheme {
  face: string;
  faceLight: string; // bevel top-left
  faceDark: string; // bevel bottom-right
  outline: string;
  /** Optional grain/speckle colors laid over the face. */
  grain?: string[];
  /** 0-1, how much of the face gets grain pixels. Default 0.08 */
  grainDensity?: number;
  /** Horizontal wood-plank grain instead of speckle. */
  woodGrain?: boolean;
}

export const WOOD_THEME: PanelTheme = {
  face: '#8a5a32',
  faceLight: '#a97748',
  faceDark: '#6b4423',
  outline: '#2e1c0e',
  grain: ['#7a4e2a', '#94663a'],
  woodGrain: true,
};

export const DARK_WOOD_THEME: PanelTheme = {
  face: '#6b4423',
  faceLight: '#8a5a32',
  faceDark: '#503318',
  outline: '#241407',
  grain: ['#5e3b1e', '#775031'],
  woodGrain: true,
};

export const STONE_THEME: PanelTheme = {
  face: '#8d8d85',
  faceLight: '#a8a89e',
  faceDark: '#6f6f68',
  outline: '#2c2c28',
  grain: ['#82827a', '#989890'],
  grainDensity: 0.1,
};

export const PARCHMENT_THEME: PanelTheme = {
  face: '#e8d5a8',
  faceLight: '#f4e6c2',
  faceDark: '#cdb684',
  outline: '#5a4426',
  grain: ['#e0cb98'],
  grainDensity: 0.05,
};

/**
 * Draw a pixel-art panel in art-pixel units. Rounded via 2-step cut corners,
 * 1px outline, 1px bevel (light top-left / dark bottom-right), textured face.
 * (x, y, w, h are in canvas px; art alignment happens internally.)
 */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: PanelTheme,
  artScale: number = 4,
  salt: number = 0
): void {
  const cols = Math.max(6, Math.round(w / artScale));
  const rows = Math.max(6, Math.round(h / artScale));
  const px = (ax: number, ay: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + ax * artScale, y + ay * artScale, artScale, artScale);
  };

  // Corner cut: skip art pixels outside the rounded corner mask
  const cut = (ax: number, ay: number): boolean => {
    const cx = Math.min(ax, cols - 1 - ax);
    const cy = Math.min(ay, rows - 1 - ay);
    return (cx === 0 && cy < 2) || (cy === 0 && cx < 2);
  };

  for (let ay = 0; ay < rows; ay++) {
    for (let ax = 0; ax < cols; ax++) {
      if (cut(ax, ay)) continue;
      const isEdge =
        ax === 0 || ay === 0 || ax === cols - 1 || ay === rows - 1 ||
        cut(ax - 1, ay) || cut(ax + 1, ay) || cut(ax, ay - 1) || cut(ax, ay + 1);
      if (isEdge) {
        px(ax, ay, theme.outline);
        continue;
      }
      const isBevelLight = ax === 1 || ay === 1 || cut(ax - 2, ay) || cut(ax, ay - 2);
      const isBevelDark = ax === cols - 2 || ay === rows - 2 || cut(ax + 2, ay) || cut(ax, ay + 2);
      if (isBevelLight && !isBevelDark) {
        px(ax, ay, theme.faceLight);
      } else if (isBevelDark) {
        px(ax, ay, theme.faceDark);
      } else {
        // Face with grain
        let color = theme.face;
        if (theme.grain && theme.grain.length) {
          if (theme.woodGrain) {
            // Horizontal streaks: rows of grain color with wobble
            const streak = hash2(0, ay + ((ax / 9) | 0), salt + 13);
            if (streak < 0.3) {
              color = theme.grain[Math.floor(hash2(0, ay, salt + 17) * theme.grain.length)];
            }
          } else if (hash2(ax, ay, salt + 13) < (theme.grainDensity ?? 0.08)) {
            color = theme.grain[Math.floor(hash2(ax, ay, salt + 17) * theme.grain.length)];
          }
        }
        px(ax, ay, color);
      }
    }
  }
}

/**
 * Generate a panel as a standalone canvas — for caching, or for DOM styling
 * via `canvas.toDataURL()` as a CSS background-image.
 */
export function panelCanvas(
  w: number,
  h: number,
  theme: PanelTheme,
  artScale: number = 4,
  salt: number = 0
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawPanel(canvas.getContext('2d')!, 0, 0, w, h, theme, artScale, salt);
  return canvas;
}
