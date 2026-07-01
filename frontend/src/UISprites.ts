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
   * Create pixel art buttons (medieval stone/wood with metal trim)
   */
  private static createButtons() {
    const createButton = (
      baseColor: string,
      highlightColor: string,
      shadowColor: string,
      glowColor: string
    ): UIButton => {
      const width = 200;
      const height = 50;

      // Normal state
      const normal = this.createCanvas(width, height);
      const nCtx = normal.getContext('2d')!;

      // Base (stone texture)
      nCtx.fillStyle = shadowColor;
      nCtx.fillRect(0, 0, width, height);
      nCtx.fillStyle = baseColor;
      nCtx.fillRect(2, 2, width - 4, height - 4);

      // Top highlight
      nCtx.fillStyle = highlightColor;
      nCtx.fillRect(4, 4, width - 8, height / 3);

      // Border trim (metal)
      nCtx.fillStyle = '#a0a0a0';
      nCtx.fillRect(0, 0, width, 2);
      nCtx.fillRect(0, height - 2, width, 2);
      nCtx.fillRect(0, 0, 2, height);
      nCtx.fillRect(width - 2, 0, 2, height);

      // Hover state (brighter with glow)
      const hover = this.createCanvas(width, height);
      const hCtx = hover.getContext('2d')!;

      hCtx.fillStyle = shadowColor;
      hCtx.fillRect(0, 0, width, height);
      hCtx.fillStyle = highlightColor;
      hCtx.fillRect(2, 2, width - 4, height - 4);

      hCtx.fillStyle = this.lightenColor(highlightColor, 1.3);
      hCtx.fillRect(4, 4, width - 8, height / 2);

      // Glowing border
      hCtx.fillStyle = glowColor;
      hCtx.fillRect(0, 0, width, 3);
      hCtx.fillRect(0, height - 3, width, 3);
      hCtx.fillRect(0, 0, 3, height);
      hCtx.fillRect(width - 3, 0, 3, height);

      // Disabled state (grayscale, darker)
      const disabled = this.createCanvas(width, height);
      const dCtx = disabled.getContext('2d')!;

      dCtx.fillStyle = '#1a1a1a';
      dCtx.fillRect(0, 0, width, height);
      dCtx.fillStyle = '#2a2a2a';
      dCtx.fillRect(2, 2, width - 4, height - 4);

      dCtx.fillStyle = '#555555';
      dCtx.fillRect(0, 0, width, 2);
      dCtx.fillRect(0, height - 2, width, 2);
      dCtx.fillRect(0, 0, 2, height);
      dCtx.fillRect(width - 2, 0, 2, height);

      return { normal, hover, disabled, width, height };
    };

    // Different button types
    this.buttons.set('primary', createButton('#3a3a3a', '#4a4a4a', '#1a1a1a', '#4ade80'));
    this.buttons.set('danger', createButton('#7f1d1d', '#991b1b', '#450a0a', '#ef4444'));
    this.buttons.set('success', createButton('#14532d', '#166534', '#052e16', '#22c55e'));
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

  private static lightenColor(color: string, factor: number): string {
    const hex = color.replace('#', '');
    const r = Math.min(255, Math.floor(parseInt(hex.substring(0, 2), 16) * factor));
    const g = Math.min(255, Math.floor(parseInt(hex.substring(2, 4), 16) * factor));
    const b = Math.min(255, Math.floor(parseInt(hex.substring(4, 6), 16) * factor));
    return `rgb(${r}, ${g}, ${b})`;
  }
}
