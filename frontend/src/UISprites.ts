/**
 * Pixel Art UI Sprite System
 * Custom crafted pixel art for all UI elements:
 * - Health bars
 * - XP/Progress bars
 * - Buttons
 * - Icons and decorative elements
 */

export interface UIBar {
  background: HTMLCanvasElement;
  fill: HTMLCanvasElement;
  border: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface UIButton {
  normal: HTMLCanvasElement;
  hover: HTMLCanvasElement;
  disabled: HTMLCanvasElement;
  width: number;
  height: number;
}

export class UISprites {
  private static healthBar: UIBar | null = null;
  private static xpBar: UIBar | null = null;
  private static buttons: Map<string, UIButton> = new Map();
  private static icons: Map<string, HTMLCanvasElement> = new Map();

  static init() {
    this.createHealthBar();
    this.createXPBar();
    this.createButtons();
    this.createIcons();
  }

  static getHealthBar(): UIBar | null {
    return this.healthBar;
  }

  static getXPBar(): UIBar | null {
    return this.xpBar;
  }

  static getButton(type: string): UIButton | null {
    return this.buttons.get(type) || null;
  }

  static getIcon(name: string): HTMLCanvasElement | null {
    return this.icons.get(name) || null;
  }

  private static createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false; // Crisp pixel art
    return canvas;
  }

  /**
   * Create pixel art health bar (medieval style with gems/notches)
   */
  private static createHealthBar() {
    const width = 300;
    const height = 24;

    // Background (dark stone texture)
    const bg = this.createCanvas(width, height);
    const bgCtx = bg.getContext('2d')!;

    // Stone pattern with pixel art
    for (let x = 0; x < width; x += 4) {
      for (let y = 0; y < height; y += 4) {
        const noise = Math.random() < 0.5 ? '#1a0000' : '#0f0000';
        bgCtx.fillStyle = noise;
        bgCtx.fillRect(x, y, 4, 4);
      }
    }

    // Notches every 30px (segmented bar)
    bgCtx.fillStyle = '#000000';
    for (let x = 30; x < width; x += 30) {
      bgCtx.fillRect(x - 1, 0, 2, height);
    }

    // Fill (red gem/crystal with gradient effect)
    const fill = this.createCanvas(width, height);
    const fillCtx = fill.getContext('2d')!;

    // Create pixelated gradient using bands
    const bands = [
      { y: 0, h: 4, color: '#ef4444' },   // Top highlight
      { y: 4, h: 4, color: '#dc2626' },   // Upper mid
      { y: 8, h: 8, color: '#b91c1c' },   // Mid (largest)
      { y: 16, h: 4, color: '#991b1b' },  // Lower mid
      { y: 20, h: 4, color: '#7f1d1d' },  // Shadow
    ];

    for (const band of bands) {
      fillCtx.fillStyle = band.color;
      fillCtx.fillRect(0, band.y, width, band.h);
    }

    // Gem shine effect (diagonal highlight pixels)
    fillCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let x = 0; x < width; x += 8) {
      fillCtx.fillRect(x, 2, 4, 2);
      fillCtx.fillRect(x + 2, 4, 4, 2);
    }

    // Border (ornate medieval frame)
    const border = this.createCanvas(width, height);
    const borderCtx = border.getContext('2d')!;

    // Outer frame (gold)
    borderCtx.fillStyle = '#eab308';
    borderCtx.fillRect(0, 0, width, 2);           // Top
    borderCtx.fillRect(0, height - 2, width, 2);  // Bottom
    borderCtx.fillRect(0, 0, 2, height);          // Left
    borderCtx.fillRect(width - 2, 0, 2, height);  // Right

    // Highlights (lighter gold)
    borderCtx.fillStyle = '#fde047';
    borderCtx.fillRect(2, 2, width - 4, 1);       // Top inner highlight
    borderCtx.fillRect(2, 2, 1, height - 4);      // Left inner highlight

    // Shadows (darker gold)
    borderCtx.fillStyle = '#ca8a04';
    borderCtx.fillRect(2, height - 3, width - 4, 1);  // Bottom inner shadow
    borderCtx.fillRect(width - 3, 2, 1, height - 4);  // Right inner shadow

    // Corner decorations (small gems)
    const corners = [
      [0, 0], [width - 6, 0], [0, height - 6], [width - 6, height - 6]
    ];
    for (const [x, y] of corners) {
      borderCtx.fillStyle = '#dc2626';
      borderCtx.fillRect(x + 1, y + 1, 4, 4);
      borderCtx.fillStyle = '#ef4444';
      borderCtx.fillRect(x + 2, y + 2, 2, 2);
    }

    this.healthBar = { background: bg, fill, border, width, height };
  }

  /**
   * Create pixel art XP bar (magical glowing blue crystal)
   */
  private static createXPBar() {
    const width = 300;
    const height = 18;

    // Background (dark mystic texture)
    const bg = this.createCanvas(width, height);
    const bgCtx = bg.getContext('2d')!;

    bgCtx.fillStyle = '#0a0a1a';
    bgCtx.fillRect(0, 0, width, height);

    // Star pattern background
    bgCtx.fillStyle = '#1a1a2e';
    for (let x = 0; x < width; x += 12) {
      for (let y = 0; y < height; y += 12) {
        if (Math.random() < 0.3) {
          bgCtx.fillRect(x, y, 2, 2);
        }
      }
    }

    // Fill (cyan/blue magical glow)
    const fill = this.createCanvas(width, height);
    const fillCtx = fill.getContext('2d')!;

    const xpBands = [
      { y: 0, h: 3, color: '#67e8f9' },   // Top bright glow
      { y: 3, h: 3, color: '#22d3ee' },   // Upper
      { y: 6, h: 6, color: '#06b6d4' },   // Mid
      { y: 12, h: 3, color: '#0891b2' },  // Lower
      { y: 15, h: 3, color: '#0e7490' },  // Shadow
    ];

    for (const band of xpBands) {
      fillCtx.fillStyle = band.color;
      fillCtx.fillRect(0, band.y, width, band.h);
    }

    // Sparkle effect
    fillCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let x = 4; x < width; x += 16) {
      fillCtx.fillRect(x, 1, 2, 1);
      fillCtx.fillRect(x + 1, 2, 2, 1);
    }

    // Border (silver/cyan frame)
    const border = this.createCanvas(width, height);
    const borderCtx = border.getContext('2d')!;

    borderCtx.fillStyle = '#06b6d4';
    borderCtx.fillRect(0, 0, width, 1);           // Top
    borderCtx.fillRect(0, height - 1, width, 1);  // Bottom
    borderCtx.fillRect(0, 0, 1, height);          // Left
    borderCtx.fillRect(width - 1, 0, 1, height);  // Right

    borderCtx.fillStyle = '#67e8f9';
    borderCtx.fillRect(1, 1, width - 2, 1);       // Top highlight
    borderCtx.fillRect(1, 1, 1, height - 2);      // Left highlight

    this.xpBar = { background: bg, fill, border, width, height };
  }

  /**
   * Create pixel art buttons (medieval stone/wood with metal trim and rounded corners)
   */
  private static createButtons() {
    const createButton = (
      material: 'stone' | 'wood'
    ): UIButton => {
      const width = 200;
      const height = 50;

      // Normal state
      const normal = this.createCanvas(width, height);
      const nCtx = normal.getContext('2d')!;
      this.drawMedievalButton(nCtx, width, height, material, 'normal');

      // Hover state (brighter with glow)
      const hover = this.createCanvas(width, height);
      const hCtx = hover.getContext('2d')!;
      this.drawMedievalButton(hCtx, width, height, material, 'hover');

      // Disabled state (grayscale, darker)
      const disabled = this.createCanvas(width, height);
      const dCtx = disabled.getContext('2d')!;
      this.drawMedievalButton(dCtx, width, height, material, 'disabled');

      return { normal, hover, disabled, width, height };
    };

    // Different button types
    this.buttons.set('primary', createButton('stone'));
    this.buttons.set('danger', createButton('stone'));
    this.buttons.set('success', createButton('wood'));
  }

  /**
   * Draw a medieval button with proper pixel art rounded corners and texture
   */
  private static drawMedievalButton(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    material: 'stone' | 'wood',
    state: 'normal' | 'hover' | 'disabled'
  ) {
    const cornerRadius = 6; // Pixel art rounded corners

    // Material color palettes
    const stonePalette = {
      normal: { base: '#57534e', mid: '#78716c', highlight: '#a8a29e', shadow: '#292524', trim: '#eab308' },
      hover: { base: '#78716c', mid: '#a8a29e', highlight: '#d6d3d1', shadow: '#44403c', trim: '#fde047' },
      disabled: { base: '#1c1917', mid: '#292524', highlight: '#44403c', shadow: '#0c0a09', trim: '#52525b' }
    };
    const woodPalette = {
      normal: { base: '#78350f', mid: '#92400e', highlight: '#b45309', shadow: '#451a03', trim: '#d97706' },
      hover: { base: '#92400e', mid: '#b45309', highlight: '#d97706', shadow: '#78350f', trim: '#f59e0b' },
      disabled: { base: '#27272a', mid: '#3f3f46', highlight: '#52525b', shadow: '#18181b', trim: '#71717a' }
    };

    const palette = material === 'stone' ? stonePalette[state] : woodPalette[state];

    // Draw rounded rectangle outline (shadow)
    ctx.fillStyle = palette.shadow;
    this.drawRoundedRect(ctx, 0, 0, width, height, cornerRadius);

    // Main body (base color with texture)
    ctx.fillStyle = palette.base;
    this.drawRoundedRect(ctx, 2, 2, width - 4, height - 4, cornerRadius - 2);

    // Add texture pattern (medieval stone/wood grain)
    if (material === 'stone') {
      // Stone texture: random pixel noise
      ctx.fillStyle = palette.mid;
      for (let y = 6; y < height - 6; y += 4) {
        for (let x = 6; x < width - 6; x += 4) {
          if (Math.random() < 0.4) {
            ctx.fillRect(x, y, 2, 2);
          }
        }
      }
      // Cracks/details
      ctx.fillStyle = palette.shadow;
      const crackY1 = Math.floor(height * 0.4);
      const crackY2 = Math.floor(height * 0.7);
      for (let x = 10; x < width - 10; x += 16) {
        if (Math.random() < 0.5) {
          ctx.fillRect(x, crackY1, 2, 1);
          ctx.fillRect(x + 4, crackY2, 2, 1);
        }
      }
    } else {
      // Wood texture: horizontal grain lines
      ctx.fillStyle = palette.mid;
      for (let y = 8; y < height - 8; y += 6) {
        ctx.fillRect(6, y, width - 12, 2);
        // Knots/details
        if (y % 12 === 2) {
          ctx.fillStyle = palette.shadow;
          ctx.fillRect(width / 2 - 4, y, 8, 3);
          ctx.fillStyle = palette.mid;
        }
      }
    }

    // Top highlight (beveled edge)
    ctx.fillStyle = palette.highlight;
    this.drawRoundedRect(ctx, 4, 4, width - 8, height / 3, cornerRadius - 3);

    // Metal trim border (ornate frame)
    ctx.fillStyle = palette.trim;
    // Top
    ctx.fillRect(cornerRadius, 0, width - cornerRadius * 2, 2);
    // Bottom
    ctx.fillRect(cornerRadius, height - 2, width - cornerRadius * 2, 2);
    // Left
    ctx.fillRect(0, cornerRadius, 2, height - cornerRadius * 2);
    // Right
    ctx.fillRect(width - 2, cornerRadius, 2, height - cornerRadius * 2);

    // Corner trim pieces (pixel art rounded)
    const corners = [
      { x: 2, y: 2 }, { x: width - 4, y: 2 },
      { x: 2, y: height - 4 }, { x: width - 4, y: height - 4 }
    ];
    for (const corner of corners) {
      ctx.fillRect(corner.x, corner.y, 2, 2);
    }

    // Hover glow effect
    if (state === 'hover') {
      ctx.fillStyle = palette.trim;
      ctx.globalAlpha = 0.3;
      this.drawRoundedRect(ctx, 0, 0, width, height, cornerRadius);
      ctx.globalAlpha = 1.0;
    }
  }

  /**
   * Draw a pixel-art rounded rectangle
   */
  private static drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    // Main body
    ctx.fillRect(x + radius, y, width - radius * 2, height);
    ctx.fillRect(x, y + radius, radius, height - radius * 2);
    ctx.fillRect(x + width - radius, y + radius, radius, height - radius * 2);

    // Rounded corners (pixel art style)
    // Top-left
    ctx.fillRect(x + 2, y + radius - 2, 2, 2);
    ctx.fillRect(x + radius - 2, y + 2, 2, 2);
    // Top-right
    ctx.fillRect(x + width - radius, y + 2, 2, 2);
    ctx.fillRect(x + width - 4, y + radius - 2, 2, 2);
    // Bottom-left
    ctx.fillRect(x + 2, y + height - radius, 2, 2);
    ctx.fillRect(x + radius - 2, y + height - 4, 2, 2);
    // Bottom-right
    ctx.fillRect(x + width - radius, y + height - 4, 2, 2);
    ctx.fillRect(x + width - 4, y + height - radius, 2, 2);
  }

  /**
   * Create pixel art icons (heart, star, coin, etc.)
   */
  private static createIcons() {
    // Heart icon (8x8)
    const heart = this.createCanvas(24, 24);
    const heartCtx = heart.getContext('2d')!;
    const heartPixels = [
      [0,0,1,1,0,0,1,1,0],
      [0,1,2,2,1,1,2,2,1],
      [1,2,2,3,2,2,3,2,2],
      [1,2,2,2,2,2,2,2,2],
      [1,2,2,2,2,2,2,2,1],
      [0,1,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,1,0,0],
      [0,0,0,1,2,1,0,0,0],
      [0,0,0,0,1,0,0,0,0],
    ];
    const heartColors = ['transparent', '#7f1d1d', '#dc2626', '#fca5a5'];
    this.drawPixelIcon(heartCtx, heartPixels, heartColors, 2.5);
    this.icons.set('heart', heart);

    // Star icon (experience)
    const star = this.createCanvas(24, 24);
    const starCtx = star.getContext('2d')!;
    const starPixels = [
      [0,0,0,0,1,1,0,0,0,0],
      [0,0,0,1,2,2,1,0,0,0],
      [0,0,0,1,2,2,1,0,0,0],
      [0,1,1,1,2,2,1,1,1,0],
      [1,2,2,2,3,3,2,2,2,1],
      [0,1,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,2,1,0,0],
      [0,0,1,2,2,2,2,1,0,0],
      [0,1,1,1,2,2,1,1,1,0],
      [0,1,0,0,1,1,0,0,1,0],
    ];
    const starColors = ['transparent', '#0891b2', '#06b6d4', '#67e8f9'];
    this.drawPixelIcon(starCtx, starPixels, starColors, 2.2);
    this.icons.set('star', star);

    // Coin icon (gold)
    const coin = this.createCanvas(20, 20);
    const coinCtx = coin.getContext('2d')!;
    const coinPixels = [
      [0,0,1,1,1,1,0,0],
      [0,1,2,2,2,2,1,0],
      [1,2,3,3,2,2,2,1],
      [1,2,2,2,2,2,2,1],
      [1,2,2,2,2,2,2,1],
      [1,2,2,2,2,3,3,1],
      [0,1,2,2,2,2,1,0],
      [0,0,1,1,1,1,0,0],
    ];
    const coinColors = ['transparent', '#854d0e', '#ca8a04', '#fde047'];
    this.drawPixelIcon(coinCtx, coinPixels, coinColors, 2.5);
    this.icons.set('coin', coin);

    // Level badge (ornate shield)
    const levelBadge = this.createCanvas(28, 28);
    const levelCtx = levelBadge.getContext('2d')!;
    const levelPixels = [
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,1,0,0,0],
      [0,0,1,2,3,3,3,3,3,3,2,1,0,0],
      [0,1,2,3,4,4,4,4,4,4,3,2,1,0],
      [1,2,3,4,5,5,5,5,5,5,4,3,2,1],
      [1,2,3,4,5,5,5,5,5,5,4,3,2,1],
      [1,2,3,4,4,4,4,4,4,4,4,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,2,1],
      [0,1,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,2,2,2,2,2,1,0,0],
      [0,0,0,1,1,2,2,2,2,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,0,0,0,0,0],
    ];
    const levelColors = [
      'transparent',
      '#78716c',    // 1 - outline (stone gray)
      '#a8a29e',    // 2 - shield mid
      '#d6d3d1',    // 3 - shield light
      '#3b82f6',    // 4 - inner royal blue
      '#60a5fa'     // 5 - inner highlight
    ];
    this.drawPixelIcon(levelCtx, levelPixels, levelColors, 2);
    this.icons.set('level', levelBadge);

    // Wave banner (scroll/flag)
    const waveBanner = this.createCanvas(32, 24);
    const waveCtx = waveBanner.getContext('2d')!;
    const wavePixels = [
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,3,3,3,3,3,3,3,3,2,1],
      [1,2,3,4,4,4,4,4,4,3,2,1],
      [1,2,3,4,4,4,4,4,4,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,1,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,0,0,0],
    ];
    const waveColors = [
      'transparent',
      '#7c2d12',    // 1 - banner outline (dark crimson)
      '#dc2626',    // 2 - banner red
      '#f87171',    // 3 - banner highlight
      '#fca5a5'     // 4 - inner light
    ];
    this.drawPixelIcon(waveCtx, wavePixels, waveColors, 2.5);
    this.icons.set('wave', waveBanner);
  }

  private static drawPixelIcon(
    ctx: CanvasRenderingContext2D,
    pixels: number[][],
    colors: string[],
    scale: number
  ): void {
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });
  }
}
