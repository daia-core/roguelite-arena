// Canvas rendering with effects

import { UISprites } from './UISprites';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private screenShake: number = 0;
  private shakeOffsetX: number = 0;
  private shakeOffsetY: number = 0;
  private hitFlash: number = 0;
  private impactFlashes: Array<{ x: number; y: number; radius: number; alpha: number }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    this.ctx = ctx;

    // PIXEL ART: Disable image smoothing globally for crisp pixels
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(): void {
    // Dark background
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Subtle pixel art grid pattern for depth
    this.ctx.save();
    this.ctx.globalAlpha = 0.03;
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
    this.ctx.restore();

    // Vignette effect (darker at edges)
    const gradient = this.ctx.createRadialGradient(
      this.canvas.width / 2, this.canvas.height / 2, 0,
      this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height) * 0.7
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  update(dt: number): void {
    // Update screen shake
    if (this.screenShake > 0) {
      this.screenShake -= dt;
      const intensity = this.screenShake * 15;
      this.shakeOffsetX = (Math.random() - 0.5) * intensity;
      this.shakeOffsetY = (Math.random() - 0.5) * intensity;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

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
    this.ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
  }

  endFrame(): void {
    // Draw impact flashes as PIXEL ART (no smooth arcs)
    for (const flash of this.impactFlashes) {
      this.ctx.save();
      this.ctx.globalAlpha = flash.alpha;
      this.ctx.imageSmoothingEnabled = false;

      // Draw pixelated expanding ring instead of smooth circle
      const pixelSize = 3;
      const steps = Math.floor(flash.radius / pixelSize);
      this.ctx.fillStyle = '#ffffff';

      // Octagonal approximation with pixels for ring effect
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const px = Math.floor(flash.x + Math.cos(angle) * flash.radius);
        const py = Math.floor(flash.y + Math.sin(angle) * flash.radius);
        this.ctx.fillRect(px - pixelSize, py - pixelSize, pixelSize * 2, pixelSize * 2);

        // Fill in between points for fuller ring
        if (steps > 3) {
          const nextAngle = (Math.PI / 4) * ((i + 1) % 8);
          const midAngle = (angle + nextAngle) / 2;
          const mpx = Math.floor(flash.x + Math.cos(midAngle) * flash.radius);
          const mpy = Math.floor(flash.y + Math.sin(midAngle) * flash.radius);
          this.ctx.fillRect(mpx - pixelSize / 2, mpy - pixelSize / 2, pixelSize, pixelSize);
        }
      }

      this.ctx.restore();
    }

    // Draw hit flash overlay
    if (this.hitFlash > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = this.hitFlash * 0.3;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    this.ctx.restore();
  }

  addScreenShake(intensity: number): void {
    this.screenShake = Math.max(this.screenShake, intensity);
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
  } = {}): void {
    this.ctx.save();

    const size = options.size ?? 16;
    const font = options.bold ? `bold ${size}px Arial` : `${size}px Arial`;

    this.ctx.font = font;
    this.ctx.textAlign = options.align ?? 'left';
    this.ctx.textBaseline = options.baseline ?? 'top';

    // Add stroke for better readability (enabled by default for UI text)
    if (options.stroke !== false) {
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = options.strokeWidth ?? Math.max(2, size / 12);
      this.ctx.strokeText(text, x, y);
    }

    this.ctx.fillStyle = options.color ?? '#ffffff';
    this.ctx.fillText(text, x, y);

    this.ctx.restore();
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
    this.ctx.save();

    const button = UISprites.getButton('primary');

    if (button) {
      // Use pixel art button sprites
      const sprite = !enabled ? button.disabled : hovered ? button.hover : button.normal;
      const scale = Math.min(width / button.width, height / button.height);
      const scaledWidth = button.width * scale;
      const scaledHeight = button.height * scale;

      // Center the button sprite
      const drawX = x + (width - scaledWidth) / 2;
      const drawY = y + (height - scaledHeight) / 2;

      this.ctx.drawImage(sprite, drawX, drawY, scaledWidth, scaledHeight);
    } else {
      // Fallback to programmatic rendering
      const radius = 4;

      if (enabled) {
        this.ctx.shadowBlur = hovered ? 25 : 15;
        this.ctx.shadowColor = hovered ? 'rgba(74, 222, 128, 0.6)' : 'rgba(74, 222, 128, 0.3)';
      }

      const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
      if (enabled) {
        if (hovered) {
          gradient.addColorStop(0, '#4a4a4a');
          gradient.addColorStop(1, '#2a2a2a');
        } else {
          gradient.addColorStop(0, '#3a3a3a');
          gradient.addColorStop(1, '#1a1a1a');
        }
      } else {
        gradient.addColorStop(0, '#2a2a2a');
        gradient.addColorStop(1, '#1a1a1a');
      }
      this.ctx.fillStyle = gradient;
      this.drawRoundedRectPath(x, y, width, height, radius);
      this.ctx.fill();

      this.ctx.shadowBlur = 0;
      const highlightGradient = this.ctx.createLinearGradient(x, y, x, y + height / 3);
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      this.ctx.fillStyle = highlightGradient;
      this.drawRoundedRectPath(x, y, width, height / 3, radius);
      this.ctx.fill();

      if (enabled && !hovered) {
        const pulseIntensity = Math.sin(Date.now() / 300) * 0.4 + 0.6;
        this.ctx.strokeStyle = `rgba(74, 222, 128, ${pulseIntensity})`;
        this.ctx.lineWidth = 4;
      } else if (enabled && hovered) {
        this.ctx.strokeStyle = '#4ade80';
        this.ctx.lineWidth = 5;
      } else {
        this.ctx.strokeStyle = '#555555';
        this.ctx.lineWidth = 3;
      }
      this.drawRoundedRectPath(x, y, width, height, radius);
      this.ctx.stroke();

      this.ctx.strokeStyle = enabled ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
      this.ctx.lineWidth = 1;
      this.drawRoundedRectPath(x + 2, y + 2, width - 4, height - 4, Math.max(0, radius - 2));
      this.ctx.stroke();
    }

    this.ctx.restore();

    // Text with shadow for readability
    this.ctx.save();
    if (enabled) {
      this.ctx.shadowBlur = 4;
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      this.ctx.shadowOffsetY = 2;
    }

    const fontSize = isMobile ? 32 : 20;
    this.drawText(text, x + width / 2, y + height / 2, {
      align: 'center',
      baseline: 'middle',
      size: fontSize,
      bold: true,
      color: enabled ? '#ffffff' : '#777777'
    });

    this.ctx.restore();
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

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getWidth(): number {
    return this.canvas.width;
  }

  getHeight(): number {
    return this.canvas.height;
  }
}
