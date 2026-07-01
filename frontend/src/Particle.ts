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

    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);

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

    ctx.fillStyle = this.color;
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.x, this.y);

    ctx.restore();
  }
}

// Particle spawner utility functions
export function spawnHitParticles(x: number, y: number, count: number = 8): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 100 + Math.random() * 50;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: '#ffaa00',
      size: 2 + Math.random() * 2,
      lifetime: 300 + Math.random() * 200,
      gravity: 200
    }));
  }
  return particles;
}

export function spawnKillParticles(x: number, y: number, count: number = 16): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 120;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.5 ? '#ff0000' : '#ffff00',
      size: 3 + Math.random() * 3,
      lifetime: 500 + Math.random() * 300,
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
      vy: Math.sin(angle) * speed,
      color: '#00ff00',
      size: 2,
      lifetime: 400 + Math.random() * 200,
      gravity: 100
    }));
  }
  return particles;
}
