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

    // Glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.globalCompositeOperation = 'lighter';

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
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
  dead: boolean = false;

  constructor(x: number, y: number, damage: number, isCrit: boolean = false) {
    this.x = x;
    this.y = y;
    this.text = Math.round(damage).toString();
    this.lifetime = 1000;
    this.maxLifetime = this.lifetime;
    this.vy = -60; // Float upward
    this.color = isCrit ? '#ff0000' : '#ffffff';
  }

  update(dt: number): void {
    this.y += this.vy * dt;
    this.lifetime -= dt * 1000;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const alpha = this.lifetime / this.maxLifetime;
    ctx.globalAlpha = alpha;

    // Glow effect for damage numbers
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    ctx.fillStyle = this.color;
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.x, this.y);

    ctx.restore();
  }
}

// Particle spawner utility functions
export function spawnHitParticles(x: number, y: number, count: number = 16): Particle[] {
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

export function spawnKillParticles(x: number, y: number, count: number = 32): Particle[] {
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

export function spawnXPParticles(x: number, y: number, count: number = 5): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 40;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50, // Float upward
      color: '#00ff00',
      size: 6,
      lifetime: 600 + Math.random() * 400,
      gravity: -50 // Negative gravity for upward float
    }));
  }
  return particles;
}
