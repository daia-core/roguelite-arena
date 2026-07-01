// Particle system for visual effects

export interface ParticleConfig {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  color?: string;
  size?: number;
  lifetime?: number;
  gravity?: number;
  fadeOut?: boolean;
}

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  lifetime: number;
  maxLifetime: number;
  gravity: number;
  fadeOut: boolean;
  dead: boolean = false;

  constructor(config: ParticleConfig) {
    this.x = config.x;
    this.y = config.y;
    this.vx = config.vx ?? (Math.random() - 0.5) * 4;
    this.vy = config.vy ?? (Math.random() - 0.5) * 4;
    this.color = config.color ?? '#ffff00';
    this.size = config.size ?? 3;
    this.lifetime = config.lifetime ?? 1000;
    this.maxLifetime = this.lifetime;
    this.gravity = config.gravity ?? 0;
    this.fadeOut = config.fadeOut ?? true;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;

    this.lifetime -= dt * 1000;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    if (this.fadeOut) {
      const alpha = this.lifetime / this.maxLifetime;
      ctx.globalAlpha = alpha;
    }

    // Detect mobile and scale particle size
    const isMobile = ctx.canvas.width < ctx.canvas.height;
    const sizeScale = isMobile ? 1.5 : 1;

    // Glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.globalCompositeOperation = 'lighter';

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * sizeScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Floating damage number
export class DamageNumber {
  x: number;
  y: number;
  text: string;
  lifetime: number;
  maxLifetime: number;
  vy: number;
  color: string;
  isCrit: boolean;
  scale: number = 1;
  rotation: number = 0;
  dead: boolean = false;

  constructor(x: number, y: number, damage: number, isCrit: boolean = false) {
    this.x = x;
    this.y = y;
    this.text = Math.round(damage).toString();
    this.lifetime = 1000;
    this.maxLifetime = this.lifetime;
    this.vy = -60; // Float upward
    this.isCrit = isCrit;
    this.color = isCrit ? '#ff0000' : '#ffffff';
    // Start large for crits
    this.scale = isCrit ? 1.6 : 1.2;
    this.rotation = isCrit ? (Math.random() - 0.5) * 0.3 : 0;
  }

  update(dt: number): void {
    this.y += this.vy * dt;
    this.lifetime -= dt * 1000;

    // Animate scale: start big, shrink to normal, then float
    const progress = 1 - (this.lifetime / this.maxLifetime);
    if (progress < 0.2) {
      // First 20%: scale down from initial to 1.0
      this.scale = this.isCrit ? 1.6 - (progress / 0.2) * 0.6 : 1.2 - (progress / 0.2) * 0.2;
    } else {
      // After 20%: stay at 1.0
      this.scale = 1.0;
    }

    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const alpha = this.lifetime / this.maxLifetime;
    ctx.globalAlpha = alpha;

    // Translate and rotate for crits
    ctx.translate(this.x, this.y);
    if (this.isCrit) {
      ctx.rotate(this.rotation);
    }

    // Detect mobile based on canvas orientation
    const isMobile = ctx.canvas.width < ctx.canvas.height;
    const baseFontSize = isMobile ? 48 : 36;
    const critFontSize = isMobile ? 72 : 54;
    const fontSize = this.isCrit ? critFontSize : baseFontSize;

    // Stronger glow effect
    ctx.shadowBlur = this.isCrit ? 25 : 15;
    ctx.shadowColor = this.color;

    // Draw outline for better visibility
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = this.isCrit ? 5 : 4;
    ctx.font = `bold ${fontSize * this.scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(this.text, 0, 0);

    // Fill with color (gradient for crits)
    if (this.isCrit) {
      const gradient = ctx.createLinearGradient(0, -fontSize * this.scale / 2, 0, fontSize * this.scale / 2);
      gradient.addColorStop(0, '#ff4444');
      gradient.addColorStop(0.5, '#ff0000');
      gradient.addColorStop(1, '#cc0000');
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = this.color;
    }
    ctx.font = `bold ${fontSize * this.scale}px Arial`;
    ctx.fillText(this.text, 0, 0);

    ctx.restore();
  }
}

// Particle spawner utility functions
export function spawnHitParticles(x: number, y: number, count: number = 24): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 150 + Math.random() * 100;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: i % 2 === 0 ? '#ffaa00' : '#ffff00',
      size: 4 + Math.random() * 4,
      lifetime: 400 + Math.random() * 300,
      gravity: 200
    }));
  }
  return particles;
}

export function spawnKillParticles(x: number, y: number, count: number = 48): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 180;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.5 ? '#ff0000' : Math.random() > 0.5 ? '#ffff00' : '#ff6600',
      size: 5 + Math.random() * 6,
      lifetime: 600 + Math.random() * 400,
      gravity: 300
    }));
  }
  return particles;
}

export function spawnXPParticles(x: number, y: number, count: number = 8): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 50;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      color: i % 2 === 0 ? '#00ff00' : '#86efac',
      size: 7 + Math.random() * 3,
      lifetime: 700 + Math.random() * 400,
      gravity: -60
    }));
  }
  return particles;
}

export function spawnLevelUpParticles(x: number, y: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 200;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100,
      color: i % 3 === 0 ? '#ffff00' : i % 3 === 1 ? '#00ffff' : '#ff00ff',
      size: 8 + Math.random() * 6,
      lifetime: 1000 + Math.random() * 500,
      gravity: -80
    }));
  }
  return particles;
}

export function spawnExplosionParticles(x: number, y: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 180 + Math.random() * 220;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: i % 2 === 0 ? '#ff6600' : '#ff0000',
      size: 7 + Math.random() * 8,
      lifetime: 600 + Math.random() * 400,
      gravity: 300
    }));
  }
  return particles;
}

export function spawnHealthOrbParticles(x: number, y: number, count: number = 12): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 60;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      color: i % 2 === 0 ? '#ff4466' : '#ffaacc',
      size: 5 + Math.random() * 4,
      lifetime: 500 + Math.random() * 300,
      gravity: 150
    }));
  }
  return particles;
}
