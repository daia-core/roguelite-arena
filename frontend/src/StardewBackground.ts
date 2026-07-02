/**
 * The game's ground: a Stardew-warm grass config for the generic pixel-art
 * terrain painter (src/pixel/terrain.ts). All actual painting logic lives in
 * the reusable core; this file is just palette + decoration data.
 * Art grid is 8px to match the sprite scale, so ground and sprites read as
 * one coherent pixel-art scene.
 */

import { paintTerrain, type TerrainConfig } from './pixel/terrain';

const TUFT_DARK = '#417a24';
const TUFT_LIGHT = '#8ed95e';

const flower = (petal: string, salt: number) => ({
  grid: [
    [0, 1, 0],
    [1, 2, 1],
    [0, 1, 0],
    [0, 0, 3],
  ],
  palette: ['transparent', petal, '#c9720f', TUFT_DARK],
  cellSize: 52,
  chance: 0.16,
  salt,
});

const GRASS_CONFIG: TerrainConfig = {
  artScale: 8,
  tones: { base: '#6ab63e', light: '#7cc94e', dark: '#5aa233' },
  patches: {
    colors: { base: '#a97c50', dark: '#8f6742', light: '#c19467' },
    cellSize: 60,
    chance: 0.55,
    minRadius: 5,
    maxRadius: 13,
    salt: 40,
  },
  decorations: [
    // three-blade grass tuft
    {
      grid: [
        [1, 2, 1],
        [1, 1, 1],
      ],
      palette: ['transparent', TUFT_DARK, TUFT_LIGHT],
      cellSize: 15,
      chance: 0.16,
      salt: 60,
    },
    // small two-blade sprout
    {
      grid: [
        [2, 0],
        [1, 1],
      ],
      palette: ['transparent', TUFT_DARK, TUFT_LIGHT],
      cellSize: 13,
      chance: 0.15,
      salt: 80,
    },
    flower('#f4f4e8', 100),
    flower('#f2d94e', 120),
    flower('#e88fb0', 140),
    flower('#e8964f', 160),
    // small stone
    {
      grid: [
        [0, 1, 1, 0],
        [2, 1, 2, 3],
        [0, 3, 3, 0],
        [0, 0, 4, 0],
      ],
      palette: ['transparent', '#b8b6a6', '#9a9788', '#6f6d60', TUFT_DARK],
      cellSize: 57,
      chance: 0.12,
      salt: 180,
    },
  ],
  edgeFade: { width: 12, color: 'rgba(16, 36, 8, 0.45)' },
};

export class StardewBackground {
  draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    paintTerrain(ctx, width, height, GRASS_CONFIG);
  }
}
