// Canvas rendering with effects

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
  }

  clear(): void {
    this.ctx.fillStyle = '#0a0a0a';
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
    // Draw impact flashes
    for (const flash of this.impactFlashes) {
      this.ctx.save();
      this.ctx.globalAlpha = flash.alpha;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
      this.ctx.stroke();
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
  } = {}): void {
    this.ctx.save();

    const size = options.size ?? 16;
    const font = options.bold ? `bold ${size}px Arial` : `${size}px Arial`;

    this.ctx.font = font;
    this.ctx.fillStyle = options.color ?? '#ffffff';
    this.ctx.textAlign = options.align ?? 'left';
    this.ctx.textBaseline = options.baseline ?? 'top';
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
    const color = percent > 0.5 ? '#00ff00' : percent > 0.25 ? '#ffff00' : '#ff0000';

    // Adjust width for smaller screens
    const adjustedWidth = Math.min(width, this.canvas.width * 0.35);

    // Outer glow box
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = color;

    // Dark border (outer)
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(x - 2, y - 2, adjustedWidth + 4, height + 4);

    // Background
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#1a0000';
    this.ctx.fillRect(x, y, adjustedWidth, height);

    // Health with gradient
    const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(color, 1.3));
    gradient.addColorStop(1, color);
    this.ctx.fillStyle = gradient;
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = color;
    this.ctx.fillRect(x, y, adjustedWidth * percent, height);

    // Inner highlight
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fillRect(x, y, adjustedWidth * percent, height * 0.3);

    // Border (bright)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, adjustedWidth, height);

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

    // Adjust width for smaller screens
    const adjustedWidth = Math.min(width, this.canvas.width * 0.35);

    // Outer glow box
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = color;

    // Dark border (outer)
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(x - 2, y - 2, adjustedWidth + 4, height + 4);

    // Background
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(x, y, adjustedWidth, height);

    // Progress with gradient
    const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.lightenColor(color, 1.3));
    gradient.addColorStop(1, color);
    this.ctx.fillStyle = gradient;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = color;
    this.ctx.fillRect(x, y, adjustedWidth * percent, height);

    // Inner highlight
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    this.ctx.fillRect(x, y, adjustedWidth * percent, height * 0.3);

    // Border (bright)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, adjustedWidth, height);

    this.ctx.restore();
  }

  drawButton(x: number, y: number, width: number, height: number, text: string, hovered: boolean = false, enabled: boolean = true, isMobile: boolean = false): void {
    // Button background
    if (enabled) {
      this.ctx.fillStyle = hovered ? '#555555' : '#333333';
    } else {
      this.ctx.fillStyle = '#222222';
    }
    this.ctx.fillRect(x, y, width, height);

    // Border with pulse effect for affordable buttons
    if (enabled && !hovered) {
      const pulseIntensity = Math.sin(Date.now() / 200) * 0.3 + 0.7;
      this.ctx.strokeStyle = `rgba(0, 255, 0, ${pulseIntensity})`;
    } else {
      this.ctx.strokeStyle = enabled ? (hovered ? '#ffffff' : '#888888') : '#555555';
    }
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);

    // Text
    const fontSize = isMobile ? 32 : 18;
    this.drawText(text, x + width / 2, y + height / 2, {
      align: 'center',
      baseline: 'middle',
      size: fontSize,
      bold: true,
      color: enabled ? '#ffffff' : '#888888'
    });
  }

  drawRect(x: number, y: number, width: number, height: number, color: string): void {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
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
