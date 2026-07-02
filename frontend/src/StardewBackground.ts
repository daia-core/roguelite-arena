/**
 * Stardew Valley Style Tiled Background
 * Clean grass tiles with subtle variation - no scattered debris
 */

export class StardewBackground {
  private tileSize = 32; // Stardew uses 16x16, we'll use 32x32 for better visibility
  private tiles: Map<string, HTMLCanvasElement> = new Map();

  constructor() {
    this.createGrassTiles();
  }

  /**
   * Create various grass tile variations for natural look
   */
  private createGrassTiles() {
    // Stardew Valley grass color palette (warm, saturated greens)
    const grassColors = {
      base: '#6ebe30',      // Bright spring green
      dark: '#5ba02a',      // Darker grass
      bright: '#8fd649',    // Highlight green
      shadow: '#4a8521',    // Shadow green
      accent1: '#7ec850',   // Variation 1
      accent2: '#96d35f'    // Variation 2
    };

    // Create 4 grass tile variations for tiling variety
    for (let variant = 0; variant < 4; variant++) {
      const canvas = document.createElement('canvas');
      canvas.width = this.tileSize;
      canvas.height = this.tileSize;
      const ctx = canvas.getContext('2d')!;

      // Fill with base grass color
      ctx.fillStyle = grassColors.base;
      ctx.fillRect(0, 0, this.tileSize, this.tileSize);

      // Add grass blade details (simple vertical strokes)
      const bladePositions = this.getBladePositions(variant);
      for (const pos of bladePositions) {
        // Dark blade base
        ctx.fillStyle = grassColors.dark;
        ctx.fillRect(pos.x, pos.y, 2, 4);

        // Bright blade highlight
        ctx.fillStyle = grassColors.bright;
        ctx.fillRect(pos.x + 1, pos.y, 1, 2);
      }

      // Add subtle shadow pixels for depth
      if (variant % 2 === 0) {
        ctx.fillStyle = grassColors.shadow;
        ctx.fillRect(0, this.tileSize - 2, this.tileSize, 2);
      }

      // Add accent color variation
      const accentColor = variant < 2 ? grassColors.accent1 : grassColors.accent2;
      ctx.fillStyle = accentColor;
      // Small accent patches
      const accentX = (variant * 8) % this.tileSize;
      const accentY = (variant * 12) % this.tileSize;
      ctx.fillRect(accentX, accentY, 4, 4);

      this.tiles.set(`grass_${variant}`, canvas);
    }

    // Create a dirt path tile for variation
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = this.tileSize;
    dirtCanvas.height = this.tileSize;
    const dirtCtx = dirtCanvas.getContext('2d')!;

    // Stardew dirt colors
    const dirtColors = {
      base: '#a67c52',
      dark: '#8b6341',
      light: '#c49a6b'
    };

    dirtCtx.fillStyle = dirtColors.base;
    dirtCtx.fillRect(0, 0, this.tileSize, this.tileSize);

    // Add dirt texture (small dark/light pixels)
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * this.tileSize);
      const y = Math.floor(Math.random() * this.tileSize);
      dirtCtx.fillStyle = Math.random() > 0.5 ? dirtColors.dark : dirtColors.light;
      dirtCtx.fillRect(x, y, 2, 2);
    }

    this.tiles.set('dirt', dirtCanvas);
  }

  /**
   * Get grass blade positions for a tile variant
   */
  private getBladePositions(variant: number): Array<{x: number, y: number}> {
    const positions: Array<{x: number, y: number}> = [];
    const seed = variant * 100;

    // Deterministic pseudo-random blade placement
    for (let i = 0; i < 8; i++) {
      const x = ((seed + i * 17) % (this.tileSize - 2)) + 1;
      const y = ((seed + i * 23) % (this.tileSize - 4)) + 1;
      positions.push({ x, y });
    }

    return positions;
  }

  /**
   * Draw the tiled background across the entire canvas
   */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const cols = Math.ceil(width / this.tileSize) + 1;
    const rows = Math.ceil(height / this.tileSize) + 1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Use variant based on position for natural variety
        const variant = (row * 3 + col * 5) % 4;

        // Occasionally place a dirt tile (5% chance)
        const isDirt = (row * 7 + col * 11) % 20 === 0;
        const tileName = isDirt ? 'dirt' : `grass_${variant}`;

        const tile = this.tiles.get(tileName);
        if (tile) {
          ctx.drawImage(
            tile,
            col * this.tileSize,
            row * this.tileSize
          );
        }
      }
    }
  }
}
