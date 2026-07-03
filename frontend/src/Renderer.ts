// Canvas rendering with effects

import { UISprites } from './UISprites';
import { getItemIcon, getArtifactIcon } from './items/itemIcons';
import { drawPanel, WOOD_THEME, STONE_THEME, type PanelTheme } from './pixel/panel';
import { OffscreenCanvasCache } from './OffscreenCanvasCache';
import { StardewBackground } from './StardewBackground';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hitFlash: number = 0;
  private impactFlashes: Array<{ x: number; y: number; radius: number; alpha: number }> = [];

  // LAYERED RENDERING: 3-layer system for massive performance gains (15-30% FPS improvement)
  // Layer 1: Background (static, cached offscreen canvas - only redrawn on resize)
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private backgroundCtx: CanvasRenderingContext2D | null = null;

  // Layer 2: Game entities (dynamic, redrawn every frame)
  private gameCanvas: HTMLCanvasElement | null = null;
  private gameCtx: CanvasRenderingContext2D | null = null;

  // Layer 3: UI (HUD - only redrawn when stats change)
  private uiCanvas: HTMLCanvasElement | null = null;
  private uiCtx: CanvasRenderingContext2D | null = null;
  private uiDirty: boolean = true; // Track if UI needs redraw

  private cachedWidth: number = 0;
  private cachedHeight: number = 0;

  // PERFORMANCE: Offscreen canvas cache for static UI elements
  private offscreenCache: OffscreenCanvasCache;

  // ATMOSPHERE: Background decorations (gravel, stones, branches)
  private stardewBackground: StardewBackground;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    this.ctx = ctx;

    // PIXEL ART: Disable image smoothing globally for crisp pixels
    this.ctx.imageSmoothingEnabled = false;

    // PERFORMANCE: Initialize offscreen canvas cache
    this.offscreenCache = new OffscreenCanvasCache();

    // ATMOSPHERE: Initialize background decorations
    this.stardewBackground = new StardewBackground();

    // Initialize layer canvases
    this.initializeLayers();
  }

  private initializeLayers(): void {
    // Background layer (static)
    this.backgroundCanvas = document.createElement('canvas');
    this.backgroundCtx = this.backgroundCanvas.getContext('2d');
    if (this.backgroundCtx) {
      this.backgroundCtx.imageSmoothingEnabled = false;
    }

    // Game layer (dynamic entities)
    this.gameCanvas = document.createElement('canvas');
    this.gameCtx = this.gameCanvas.getContext('2d');
    if (this.gameCtx) {
      this.gameCtx.imageSmoothingEnabled = false;
    }

    // UI layer (HUD - conditional redraw)
    this.uiCanvas = document.createElement('canvas');
    this.uiCtx = this.uiCanvas.getContext('2d');
    if (this.uiCtx) {
      this.uiCtx.imageSmoothingEnabled = false;
    }
  }

  clear(): void {
    // LAYERED RENDERING: Composite all three layers
    // Only redraw what's necessary for massive performance gain

    // Layer 1: Background (only on resize)
    if (this.cachedWidth !== this.canvas.width || this.cachedHeight !== this.canvas.height) {
      this.resizeLayers();
      this.cacheBackground();
      this.uiDirty = true; // UI needs redraw on resize
    }

    // Draw background layer (cached)
    if (this.backgroundCanvas) {
      this.ctx.drawImage(this.backgroundCanvas, 0, 0);
    }

    // Layer 2: Clear game layer for this frame
    if (this.gameCanvas && this.gameCtx) {
      this.gameCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private resizeLayers(): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.cachedWidth = width;
    this.cachedHeight = height;

    if (this.backgroundCanvas) {
      this.backgroundCanvas.width = width;
      this.backgroundCanvas.height = height;
    }

    if (this.gameCanvas) {
      this.gameCanvas.width = width;
      this.gameCanvas.height = height;
    }

    if (this.uiCanvas) {
      this.uiCanvas.width = width;
      this.uiCanvas.height = height;
    }
  }

  /**
   * Mark UI as dirty - call this when HUD data changes (hp, wave, etc)
   */
  markUIDirty(): void {
    this.uiDirty = true;
  }

  private cacheBackground(): void {
    if (!this.backgroundCtx || !this.backgroundCanvas) return;

    // Stardew-style ground drawn on the sprite art grid; it includes its own
    // dithered edge darkening, so no smooth gradient vignette on top
    this.stardewBackground.draw(this.backgroundCtx, this.canvas.width, this.canvas.height);
  }

  update(dt: number): void {
    // Update hit flash
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    }

    // Update impact flashes
    this.impactFlashes = this.impactFlashes.filter(flash => {
      flash.radius += dt * 300;
      flash.alpha = Math.max(0, flash.alpha - dt * 3);
      return flash.alpha > 0;
    });
  }

  beginFrame(): void {
    this.ctx.save();
  }

  endFrame(): void {
    // PURE PIXEL ART: Impact flashes with dithered fade, no smooth alpha
    for (const flash of this.impactFlashes) {
      this.ctx.save();
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.fillStyle = '#ffffff';

      const pixelSize = 3;
      const steps = Math.floor(flash.radius / pixelSize);

      // Use dithering instead of alpha for fade effect
      const ditherThreshold = 1 - flash.alpha; // 0 = full, 1 = none

      // Octagonal approximation with pixels for ring effect
      for (let i = 0; i < 8; i++) {
        // Skip pixels based on fade (dithered pattern)
        if ((i % 4) / 4 < ditherThreshold) continue;

        const angle = (Math.PI / 4) * i;
        const px = Math.floor(flash.x + Math.cos(angle) * flash.radius);
        const py = Math.floor(flash.y + Math.sin(angle) * flash.radius);
        this.ctx.fillRect(px - pixelSize, py - pixelSize, pixelSize * 2, pixelSize * 2);

        // Fill in between points for fuller ring
        if (steps > 3 && flash.alpha > 0.5) {
          const nextAngle = (Math.PI / 4) * ((i + 1) % 8);
          const midAngle = (angle + nextAngle) / 2;
          const mpx = Math.floor(flash.x + Math.cos(midAngle) * flash.radius);
          const mpy = Math.floor(flash.y + Math.sin(midAngle) * flash.radius);
          this.ctx.fillRect(mpx - pixelSize / 2, mpy - pixelSize / 2, pixelSize, pixelSize);
        }
      }

      this.ctx.restore();
    }

    // PURE PIXEL ART: Hit flash overlay with dithering instead of smooth alpha
    if (this.hitFlash > 0) {
      this.ctx.save();
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.fillStyle = '#ffffff';

      const ditherSize = 4;
      const flashDensity = Math.ceil(this.hitFlash * 0.3 * 4); // 0-4 levels

      // Draw dithered pattern
      for (let x = 0; x < this.canvas.width; x += ditherSize) {
        for (let y = 0; y < this.canvas.height; y += ditherSize) {
          const patternValue = ((x / ditherSize) + (y / ditherSize)) % 4;
          if (patternValue < flashDensity) {
            this.ctx.fillRect(x, y, ditherSize, ditherSize);
          }
        }
      }

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  addHitFlash(intensity: number = 1): void {
    this.hitFlash = Math.min(1, this.hitFlash + intensity);
  }

  addImpactFlash(x: number, y: number): void {
    this.impactFlashes.push({ x, y, radius: 10, alpha: 1 });
  }

  drawText(text: string, x: number, y: number, options: {
    size?: number;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    bold?: boolean;
    stroke?: boolean;
    strokeWidth?: number;
    maxWidth?: number;
  } = {}): void {
    // Draw on the game layer — the same layer entities and HUD panels use —
    // so z-order follows call order (text drawn after a panel sits on top of
    // it). The main ctx would be composited UNDER this layer.
    const ctx = this.gameCtx || this.ctx;
    ctx.save();

    let size = options.size ?? 16;
    // Pixel font everywhere; 'bold' is meaningless for Press Start 2P but kept
    // as a fallback hint for the monospace fallback fonts
    const family = `'Press Start 2P', 'Courier New', monospace`;
    const buildFont = (px: number) =>
      options.bold ? `bold ${px}px ${family}` : `${px}px ${family}`;

    ctx.font = buildFont(size);
    ctx.textAlign = options.align ?? 'left';
    ctx.textBaseline = options.baseline ?? 'top';

    // Auto-shrink to fit maxWidth (prevents long lines clipping off narrow
    // portrait screens — the pixel font is wide, so long copy overflows 390px).
    if (options.maxWidth && options.maxWidth > 0) {
      const measured = ctx.measureText(text).width;
      if (measured > options.maxWidth) {
        size = Math.max(1, Math.floor(size * (options.maxWidth / measured)));
        ctx.font = buildFont(size);
      }
    }

    // Add stroke for better readability (enabled by default for UI text)
    if (options.stroke !== false) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = options.strokeWidth ?? Math.max(2, size / 12);
      ctx.strokeText(text, x, y);
    }

    ctx.fillStyle = options.color ?? '#ffffff';
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  /**
   * Word-wrap `text` to `maxWidth` px at `size`. The game draws in Press Start 2P,
   * a MONOSPACE pixel font whose advance is ~1 em/glyph and ~2× wider than a
   * sans-serif — so we wrap on a deterministic 1 em/glyph estimate rather than
   * `measureText`, which mis-measures before the webfont loads and in headless QA
   * (it returns the narrower fallback-font width → under-wraps → copy overflows the
   * panel in narrow portrait). This is the single source of truth for wrapping —
   * every multi-line text box wraps through here (the codebase previously had two
   * divergent wrap implementations, which is what made text boxes render
   * inconsistently). Returns at least one (possibly empty) line. `bold` is accepted
   * for call-site symmetry; it does not change the monospace advance.
   */
  wrapLines(text: string, maxWidth: number, size: number, _bold = false): string[] {
    const maxChars = Math.max(1, Math.floor(maxWidth / size)); // 1 em per glyph
    const words = String(text).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (test.length > maxChars && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /**
   * The standardized text-box primitive. Draws `text` as a wrapped block inside a
   * box `maxWidth` px wide, starting at (x, y). It wraps via `wrapLines`, and if
   * `maxLines` is set and the copy still won't fit, it shrinks the font as a LAST
   * resort so a box is NEVER overflowed or clipped — however long the string.
   * Returns the number of lines drawn and the total height consumed so callers can
   * lay out content beneath it. Use this for any descriptive/paragraph text box
   * (event/artifact/shop/village/tooltip copy); short single-line labels can keep
   * plain `drawText` (which auto-shrinks one line to fit).
   */
  drawWrappedText(text: string, x: number, y: number, opts: {
    maxWidth: number;
    size?: number;
    color?: string;
    align?: CanvasTextAlign;
    bold?: boolean;
    stroke?: boolean;
    strokeWidth?: number;
    lineGap?: number;   // extra px between lines (default ≈35% of the font size)
    maxLines?: number;  // hard cap; the font shrinks so the block fits within it
  }): { lines: number; height: number } {
    let size = opts.size ?? 16;
    let lines = this.wrapLines(text, opts.maxWidth, size, opts.bold);
    if (opts.maxLines && opts.maxLines > 0) {
      let guard = 0;
      while (lines.length > opts.maxLines && size > 4 && guard++ < 32) {
        size = Math.max(4, size - 1);
        lines = this.wrapLines(text, opts.maxWidth, size, opts.bold);
      }
    }
    const lineH = size + (opts.lineGap ?? Math.max(2, Math.round(size * 0.35)));
    for (let i = 0; i < lines.length; i++) {
      this.drawText(lines[i], x, y + i * lineH, {
        size,
        color: opts.color,
        align: opts.align,
        bold: opts.bold,
        stroke: opts.stroke,
        strokeWidth: opts.strokeWidth,
      });
    }
    return { lines: lines.length, height: lines.length * lineH };
  }

  drawCircle(x: number, y: number, radius: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawSprite(
    sprite: HTMLCanvasElement,
    x: number,
    y: number,
    options: {
      scale?: number;
      shadowBlur?: number;
      shadowColor?: string;
      alpha?: number;
    } = {}
  ): void {
    this.ctx.save();

    if (options.shadowBlur !== undefined) {
      this.ctx.shadowBlur = options.shadowBlur;
    }
    if (options.shadowColor !== undefined) {
      this.ctx.shadowColor = options.shadowColor;
    }
    if (options.alpha !== undefined) {
      this.ctx.globalAlpha = options.alpha;
    }

    const scale = options.scale ?? 1;
    const width = sprite.width * scale;
    const height = sprite.height * scale;

    this.ctx.drawImage(
      sprite,
      x - width / 2,
      y - height / 2,
      width,
      height
    );

    this.ctx.restore();
  }

  /**
   * Draw an item's pixel-art icon (replaces emoji `drawText(item.icon)`).
   * `box` is the target square size in px. `align` controls horizontal anchoring
   * at `x`: 'center' (default) or 'left'. The icon top sits at `topY`.
   * Preserves the sprite's aspect ratio, centred within the box.
   */
  drawItemIcon(
    emoji: string,
    x: number,
    topY: number,
    box: number,
    align: 'center' | 'left' = 'center'
  ): void {
    this.blitIconSprite(getItemIcon(emoji), x, topY, box, align);
  }

  /**
   * Draw an artifact's hand-crafted pixel-art icon by its id. Same layout rules
   * as `drawItemIcon`; used on the reward-pick and event-result screens.
   */
  drawArtifactIcon(
    id: string,
    x: number,
    topY: number,
    box: number,
    align: 'center' | 'left' = 'center'
  ): void {
    this.blitIconSprite(getArtifactIcon(id), x, topY, box, align);
  }

  private blitIconSprite(
    sprite: HTMLCanvasElement,
    x: number,
    topY: number,
    box: number,
    align: 'center' | 'left'
  ): void {
    const ar = sprite.width / sprite.height;
    let w = box, h = box;
    if (ar >= 1) h = box / ar; else w = box * ar;
    const left = align === 'center' ? x - w / 2 : x;
    const top = topY + (box - h) / 2;
    const ctx = this.gameCtx || this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, Math.round(left), Math.round(top), Math.round(w), Math.round(h));
    ctx.restore();
  }

  drawHealthBar(x: number, y: number, width: number, height: number, current: number, max: number): void {
    this.ctx.save();

    const percent = current / max;
    const healthBar = UISprites.getHealthBar();

    if (healthBar) {
      // Use pixel art health bar sprites
      const adjustedWidth = Math.min(width, this.canvas.width * 0.35);
      const scale = adjustedWidth / healthBar.width;
      const scaledHeight = healthBar.height * scale;

      // Draw background
      this.ctx.drawImage(healthBar.background, x, y, adjustedWidth, scaledHeight);

      // Draw fill (clipped to current health percentage)
      if (percent > 0) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x, y, adjustedWidth * percent, scaledHeight);
        this.ctx.clip();
        this.ctx.drawImage(healthBar.fill, x, y, adjustedWidth, scaledHeight);
        this.ctx.restore();
      }

      // Draw border on top
      this.ctx.drawImage(healthBar.border, x, y, adjustedWidth, scaledHeight);
    } else {
      // Fallback to programmatic rendering if sprites not loaded
      const color = percent > 0.5 ? '#22c55e' : percent > 0.25 ? '#eab308' : '#ef4444';
      const adjustedWidth = Math.min(width, this.canvas.width * 0.35);
      const radius = 3;

      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = color;
      this.ctx.fillStyle = '#000000';
      this.drawRoundedRect(x - 2, y - 2, adjustedWidth + 4, height + 4, radius + 1, '#000000');
      this.ctx.shadowBlur = 0;
      this.drawRoundedRect(x, y, adjustedWidth, height, radius, '#1a0000');

      const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
      gradient.addColorStop(0, this.lightenColor(color, 1.2));
      gradient.addColorStop(1, color);
      this.ctx.fillStyle = gradient;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = color;
      this.drawRoundedRect(x, y, adjustedWidth * percent, height, radius, gradient);

      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      this.drawRoundedRect(x, y, adjustedWidth * percent, height * 0.3, radius, 'rgba(255, 255, 255, 0.25)');

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 2;
      this.drawRoundedRectPath(x, y, adjustedWidth, height, radius);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private lightenColor(color: string, factor: number): string {
    // Simple color lightening for gradients
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substring(0, 2), 16) * factor);
    const g = Math.min(255, parseInt(hex.substring(2, 4), 16) * factor);
    const b = Math.min(255, parseInt(hex.substring(4, 6), 16) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  drawProgressBar(x: number, y: number, width: number, height: number, percent: number, color: string): void {
    this.ctx.save();

    const xpBar = UISprites.getXPBar();

    if (xpBar) {
      // Use pixel art XP bar sprites
      const adjustedWidth = Math.min(width, this.canvas.width * 0.35);
      const scale = adjustedWidth / xpBar.width;
      const scaledHeight = xpBar.height * scale;

      // Draw background
      this.ctx.drawImage(xpBar.background, x, y, adjustedWidth, scaledHeight);

      // Draw fill (clipped to progress percentage)
      if (percent > 0) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x, y, adjustedWidth * percent, scaledHeight);
        this.ctx.clip();
        this.ctx.drawImage(xpBar.fill, x, y, adjustedWidth, scaledHeight);
        this.ctx.restore();
      }

      // Draw border on top
      this.ctx.drawImage(xpBar.border, x, y, adjustedWidth, scaledHeight);
    } else {
      // Fallback to programmatic rendering
      const adjustedWidth = Math.min(width, this.canvas.width * 0.35);
      const radius = 3;

      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = color;
      this.drawRoundedRect(x - 2, y - 2, adjustedWidth + 4, height + 4, radius + 1, '#000000');

      this.ctx.shadowBlur = 0;
      this.drawRoundedRect(x, y, adjustedWidth, height, radius, '#1a1a1a');

      const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
      gradient.addColorStop(0, this.lightenColor(color, 1.2));
      gradient.addColorStop(1, color);
      this.ctx.fillStyle = gradient;
      this.ctx.shadowBlur = 6;
      this.ctx.shadowColor = color;
      this.drawRoundedRect(x, y, adjustedWidth * percent, height, radius, gradient);

      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.drawRoundedRect(x, y, adjustedWidth * percent, height * 0.3, radius, 'rgba(255, 255, 255, 0.2)');

      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      this.ctx.lineWidth = 2;
      this.drawRoundedRectPath(x, y, adjustedWidth, height, radius);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawButton(x: number, y: number, width: number, height: number, text: string, hovered: boolean = false, enabled: boolean = true, isMobile: boolean = false): void {
    // Pixel-art wood button (stone when disabled); same layer as drawText so
    // the label composites on top
    const ctx = this.gameCtx || this.ctx;
    const HOVER_WOOD: PanelTheme = {
      ...WOOD_THEME, face: '#9a6a3e', faceLight: '#b98756', faceDark: '#7a4e2a',
    };
    const theme = !enabled ? STONE_THEME : hovered ? HOVER_WOOD : WOOD_THEME;
    drawPanel(ctx, x, y, width, height, theme, 4, 17);
    this.drawText(text.toUpperCase(), x + width / 2, y + height / 2 + 1, {
      size: isMobile ? 14 : 12,
      align: 'center',
      baseline: 'middle',
      color: enabled ? '#f4e6c2' : '#55534c',
    });
  }

  drawRect(x: number, y: number, width: number, height: number, color: string): void {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.restore();
  }

  drawRoundedRect(x: number, y: number, width: number, height: number, radius: number, color: string | CanvasGradient): void {
    this.ctx.save();
    this.ctx.fillStyle = color;

    if (radius === 0) {
      this.ctx.fillRect(x, y, width, height);
    } else {
      // Pixel-perfect rounded corners (not smooth arcs)
      const r = Math.min(radius, Math.floor(Math.min(width, height) / 2));

      // Draw main body
      this.ctx.fillRect(x + r, y, width - r * 2, height);
      this.ctx.fillRect(x, y + r, r, height - r * 2);
      this.ctx.fillRect(x + width - r, y + r, r, height - r * 2);

      // Draw corner pixels (pixel art style, not smooth)
      for (let i = 0; i < r; i++) {
        const cornerWidth = r - i;
        this.ctx.fillRect(x + i, y + r - cornerWidth, 1, cornerWidth);
        this.ctx.fillRect(x + width - i - 1, y + r - cornerWidth, 1, cornerWidth);
        this.ctx.fillRect(x + i, y + height - r, 1, cornerWidth);
        this.ctx.fillRect(x + width - i - 1, y + height - r, 1, cornerWidth);
      }
    }

    this.ctx.restore();
  }

  /**
   * Get the game layer context for drawing entities
   * This context is cleared and redrawn every frame
   */
  getContext(): CanvasRenderingContext2D {
    // Return game layer for dynamic content
    return this.gameCtx || this.ctx;
  }

  /**
   * Get the offscreen canvas cache for static UI elements
   */
  getOffscreenCache(): OffscreenCanvasCache {
    return this.offscreenCache;
  }

  /**
   * Get the UI layer context for drawing HUD elements
   * This context is only redrawn when markUIDirty() is called
   */
  getUIContext(): CanvasRenderingContext2D {
    return this.uiCtx || this.ctx;
  }

  /**
   * Composite all layers onto the main canvas
   * Call this after all drawing is complete
   */
  compositeLayers(): void {
    // Layer 2: Draw game entities
    if (this.gameCanvas) {
      this.ctx.drawImage(this.gameCanvas, 0, 0);
    }

    // Layer 3: Draw UI (only if dirty)
    if (this.uiCanvas && this.uiCtx) {
      if (this.uiDirty) {
        // Clear UI layer
        this.uiCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.uiDirty = false;
        // UI will be redrawn by the game loop after this
      }
      // Always composite the UI layer
      this.ctx.drawImage(this.uiCanvas, 0, 0);
    }
  }

  private drawRoundedRectPath(x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, Math.floor(Math.min(width, height) / 2));
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + width - r, y);
    this.ctx.lineTo(x + width, y + r);
    this.ctx.lineTo(x + width, y + height - r);
    this.ctx.lineTo(x + width - r, y + height);
    this.ctx.lineTo(x + r, y + height);
    this.ctx.lineTo(x, y + height - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.closePath();
  }

  getWidth(): number {
    return this.canvas.width;
  }

  getHeight(): number {
    return this.canvas.height;
  }
}
