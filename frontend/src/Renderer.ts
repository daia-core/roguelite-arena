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

  drawRect(x: number, y: number, width: number, height: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
  }

  drawCircle(x: number, y: number, radius: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawHealthBar(x: number, y: number, width: number, height: number, current: number, max: number): void {
    this.ctx.save();

    // Outer glow
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = 'rgba(0, 255, 0, 0.5)';

    // Background
    this.ctx.fillStyle = '#330000';
    this.ctx.fillRect(x, y, width, height);

    // Health
    const percent = current / max;
    const color = percent > 0.5 ? '#00ff00' : percent > 0.25 ? '#ffff00' : '#ff0000';
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.fillRect(x, y, width * percent, height);

    // Border
    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.restore();
  }

  drawProgressBar(x: number, y: number, width: number, height: number, percent: number, color: string): void {
    this.ctx.save();

    // Outer glow
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = color;

    // Background
    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(x, y, width, height);

    // Progress
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width * percent, height);

    // Border
    this.ctx.shadowBlur = 0;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.restore();
  }

  drawButton(x: number, y: number, width: number, height: number, text: string, hovered: boolean = false): void {
    // Button background
    this.ctx.fillStyle = hovered ? '#555555' : '#333333';
    this.ctx.fillRect(x, y, width, height);

    // Border
    this.ctx.strokeStyle = hovered ? '#ffffff' : '#888888';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);

    // Text
    this.drawText(text, x + width / 2, y + height / 2, {
      align: 'center',
      baseline: 'middle',
      size: 18,
      bold: true
    });
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
