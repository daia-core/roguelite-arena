/**
 * Medieval Background Decorations
 * Non-interactive atmospheric elements: gravel, stones, branches, grass tufts
 * Rendered on the static background layer for performance
 */

export interface Decoration {
  x: number;
  y: number;
  type: 'gravel' | 'stone' | 'branch' | 'grass' | 'pebble';
  size: number;
  rotation: number;
  variant: number; // Which visual variant (0-2)
}

export class BackgroundDecorations {
  private decorations: Decoration[] = [];

  /**
   * Generate medieval ground decorations scattered across the arena
   */
  generate(width: number, height: number, density: number = 0.3): Decoration[] {
    this.decorations = [];

    // Calculate how many decorations based on density and area
    const area = width * height;
    const count = Math.floor((area / 10000) * density * 100);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;

      // Weighted type selection (more gravel/pebbles, fewer large objects)
      const rand = Math.random();
      let type: Decoration['type'];
      if (rand < 0.4) type = 'gravel';
      else if (rand < 0.7) type = 'pebble';
      else if (rand < 0.85) type = 'stone';
      else if (rand < 0.95) type = 'branch';
      else type = 'grass';

      this.decorations.push({
        x,
        y,
        type,
        size: this.getSizeForType(type),
        rotation: Math.random() * Math.PI * 2,
        variant: Math.floor(Math.random() * 3)
      });
    }

    return this.decorations;
  }

  /**
   * Draw all decorations to a canvas context
   */
  draw(ctx: CanvasRenderingContext2D) {
    for (const dec of this.decorations) {
      ctx.save();
      ctx.translate(dec.x, dec.y);
      ctx.rotate(dec.rotation);

      switch (dec.type) {
        case 'gravel':
          this.drawGravel(ctx, dec.size, dec.variant);
          break;
        case 'pebble':
          this.drawPebble(ctx, dec.size, dec.variant);
          break;
        case 'stone':
          this.drawStone(ctx, dec.size, dec.variant);
          break;
        case 'branch':
          this.drawBranch(ctx, dec.size, dec.variant);
          break;
        case 'grass':
          this.drawGrass(ctx, dec.size, dec.variant);
          break;
      }

      ctx.restore();
    }
  }

  private getSizeForType(type: Decoration['type']): number {
    switch (type) {
      case 'gravel': return 2 + Math.random() * 2;
      case 'pebble': return 3 + Math.random() * 4;
      case 'stone': return 8 + Math.random() * 8;
      case 'branch': return 12 + Math.random() * 16;
      case 'grass': return 6 + Math.random() * 6;
      default: return 4;
    }
  }

  // Pixel art drawing methods for each decoration type

  private drawGravel(ctx: CanvasRenderingContext2D, size: number, variant: number) {
    // Tiny gravel pieces (1-3 pixels)
    const colors = ['#292524', '#3f3f46', '#52525b'];
    ctx.fillStyle = colors[variant % colors.length];
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }

  private drawPebble(ctx: CanvasRenderingContext2D, size: number, variant: number) {
    // Small rounded pebbles
    const palettes = [
      { shadow: '#292524', mid: '#57534e', highlight: '#78716c' },
      { shadow: '#3f3f46', mid: '#71717a', highlight: '#a1a1aa' },
      { shadow: '#44403c', mid: '#78716c', highlight: '#a8a29e' }
    ];
    const palette = palettes[variant % palettes.length];

    // Pixel art rounded stone
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(-size / 2, -size / 2, size, size);

    ctx.fillStyle = palette.mid;
    ctx.fillRect(-size / 2 + 1, -size / 2 + 1, size - 2, size - 2);

    ctx.fillStyle = palette.highlight;
    ctx.fillRect(-size / 2 + 2, -size / 2 + 2, size / 2, size / 3);
  }

  private drawStone(ctx: CanvasRenderingContext2D, size: number, variant: number) {
    // Larger irregular stones with cracks
    const palettes = [
      { base: '#57534e', dark: '#292524', light: '#a8a29e' },
      { base: '#71717a', dark: '#3f3f46', light: '#d4d4d8' },
      { base: '#78716c', dark: '#44403c', light: '#d6d3d1' }
    ];
    const palette = palettes[variant % palettes.length];

    // Irregular shape using pixel blocks
    ctx.fillStyle = palette.dark;
    ctx.fillRect(-size / 2, -size / 2, size, size);

    ctx.fillStyle = palette.base;
    ctx.fillRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4);

    // Top highlight
    ctx.fillStyle = palette.light;
    ctx.fillRect(-size / 2 + 3, -size / 2 + 3, size / 2, size / 3);

    // Cracks (dark lines)
    ctx.fillStyle = palette.dark;
    if (variant === 0) {
      ctx.fillRect(-size / 4, -size / 2 + 4, 2, size - 8);
    } else if (variant === 1) {
      ctx.fillRect(-size / 2 + 4, -size / 4, size - 8, 2);
    }
  }

  private drawBranch(ctx: CanvasRenderingContext2D, size: number, variant: number) {
    // Fallen branches/twigs
    const woodColors = [
      { base: '#78350f', dark: '#451a03', light: '#92400e' },
      { base: '#92400e', dark: '#78350f', light: '#b45309' },
      { base: '#5a3825', dark: '#3e2723', light: '#8b6914' }
    ];
    const palette = woodColors[variant % woodColors.length];

    // Main branch (horizontal line with texture)
    ctx.fillStyle = palette.dark;
    ctx.fillRect(-size / 2, -2, size, 4);

    ctx.fillStyle = palette.base;
    ctx.fillRect(-size / 2 + 1, -1, size - 2, 2);

    // Wood grain texture
    ctx.fillStyle = palette.light;
    for (let x = -size / 2 + 2; x < size / 2 - 2; x += 6) {
      ctx.fillRect(x, 0, 2, 1);
    }

    // Small twig jutting out
    if (variant === 1) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(size / 4, -4, 2, 6);
    }
  }

  private drawGrass(ctx: CanvasRenderingContext2D, size: number, variant: number) {
    // Grass tufts (medieval ground cover)
    const grassColors = [
      { base: '#365314', dark: '#1a2e05', light: '#4d7c0f' },
      { base: '#14532d', dark: '#052e16', light: '#166534' },
      { base: '#3f6212', dark: '#1a2e05', light: '#65a30d' }
    ];
    const palette = grassColors[variant % grassColors.length];

    // Small grass blades (vertical lines)
    ctx.fillStyle = palette.dark;
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * (size / 3);
      ctx.fillRect(offsetX - 1, -size / 2, 2, size);
    }

    ctx.fillStyle = palette.base;
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * (size / 3);
      ctx.fillRect(offsetX, -size / 2 + 1, 1, size - 2);
    }

    // Tips highlighted
    ctx.fillStyle = palette.light;
    for (let i = 0; i < 3; i++) {
      const offsetX = (i - 1) * (size / 3);
      ctx.fillRect(offsetX, -size / 2 + 1, 1, size / 3);
    }
  }
}
