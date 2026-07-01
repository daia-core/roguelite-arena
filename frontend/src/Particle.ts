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

  constructor(config: ParticleConfig = { x: 0, y: 0 }) {
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

  /**
   * Initialize/reinitialize particle (for object pooling)
   */
  init(config: ParticleConfig): void {
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
    this.dead = false;
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
    const pixelSize = Math.max(2, Math.round(this.size * sizeScale));

    // PIXEL ART PARTICLES: Draw as crisp pixel squares with dithering, not smooth circles
    ctx.imageSmoothingEnabled = false;

    // Core pixel
    const x = Math.floor(this.x);
    const y = Math.floor(this.y);
    ctx.fillStyle = this.color;
    ctx.fillRect(x - pixelSize / 2, y - pixelSize / 2, pixelSize, pixelSize);

    // Dithered edge pixels for larger particles (creates gradient effect)
    if (pixelSize >= 6) {
      // Parse color to create darker shade for dither
      const darkenColor = (color: string, factor: number = 0.7): string => {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `#${Math.floor(r * factor).toString(16).padStart(2, '0')}${Math.floor(g * factor).toString(16).padStart(2, '0')}${Math.floor(b * factor).toString(16).padStart(2, '0')}`;
      };

      const darkColor = darkenColor(this.color);
      ctx.fillStyle = darkColor;

      // Checkerboard dither around edges
      const half = pixelSize / 2;
      for (let dx = -half - 2; dx <= half + 2; dx += 2) {
        for (let dy = -half - 2; dy <= half + 2; dy += 2) {
          if (Math.abs(dx) > half || Math.abs(dy) > half) {
            if ((Math.floor(dx / 2) + Math.floor(dy / 2)) % 2 === 0) {
              ctx.fillRect(x + dx, y + dy, 2, 2);
            }
          }
        }
      }
    }

    // Optional: Subtle additive glow for very bright particles
    if (this.color.includes('ff')) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (this.lifetime / this.maxLifetime) * 0.3;
      ctx.fillStyle = this.color;
      ctx.fillRect(x - pixelSize / 2 - 1, y - pixelSize / 2 - 1, pixelSize + 2, pixelSize + 2);
    }

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
  vx: number; // GAME FEEL: Add horizontal velocity
  vy: number;
  gravity: number; // GAME FEEL: Add gravity for arc
  color: string;
  isCrit: boolean;
  scale: number = 1;
  rotation: number = 0;
  dead: boolean = false;

  constructor(x: number = 0, y: number = 0, damage: number = 0, isCrit: boolean = false) {
    this.x = x;
    this.y = y;
    this.text = Math.round(damage).toString();
    this.lifetime = 1000;
    this.maxLifetime = this.lifetime;
    // GAME FEEL: Physics-based movement (arc like projectiles)
    this.vx = (Math.random() - 0.5) * 40; // Random horizontal spread
    this.vy = -80 - Math.random() * 20; // Initial upward velocity with variance
    this.gravity = 150; // Gravity pulling downward
    this.isCrit = isCrit;
    this.color = isCrit ? '#ff0000' : '#ffffff';
    // Start large for crits
    this.scale = isCrit ? 1.6 : 1.2;
    this.rotation = isCrit ? (Math.random() - 0.5) * 0.3 : 0;
  }

  /**
   * Initialize/reinitialize damage number (for object pooling)
   */
  init(x: number, y: number, damage: number, isCrit: boolean = false): void {
    this.x = x;
    this.y = y;
    this.text = Math.round(damage).toString();
    this.lifetime = 1000;
    this.maxLifetime = this.lifetime;
    this.vx = (Math.random() - 0.5) * 40;
    this.vy = -80 - Math.random() * 20;
    this.gravity = 150;
    this.isCrit = isCrit;
    this.color = isCrit ? '#ff0000' : '#ffffff';
    this.scale = isCrit ? 1.6 : 1.2;
    this.rotation = isCrit ? (Math.random() - 0.5) * 0.3 : 0;
    this.dead = false;
  }

  update(dt: number): void {
    // GAME FEEL: Apply physics (arc trajectory)
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt; // Apply gravity
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

// NEW: Critical hit particles (bigger, brighter)
export function spawnCritParticles(x: number, y: number, count: number = 32): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 200 + Math.random() * 150;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: i % 3 === 0 ? '#ffff00' : i % 3 === 1 ? '#ff8800' : '#ffffff',
      size: 6 + Math.random() * 6, // BIGGER
      lifetime: 500 + Math.random() * 400,
      gravity: 250
    }));
  }
  return particles;
}

// NEW: Explosion particles (massive burst)
export function spawnExplosionParticles(x: number, y: number, count: number = 64): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 180 + Math.random() * 250;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.3 ? '#ff4400' : '#ff8800',
      size: 8 + Math.random() * 8, // VERY BIG
      lifetime: 700 + Math.random() * 500,
      gravity: 400
    }));
  }
  return particles;
}

// NEW: Freeze particles (icy shards)
export function spawnFreezeParticles(x: number, y: number, count: number = 20): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 120;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50,
      color: Math.random() > 0.5 ? '#88ccff' : '#aaddff',
      size: 4 + Math.random() * 5,
      lifetime: 600 + Math.random() * 400,
      gravity: 150
    }));
  }
  return particles;
}

// NEW: Poison particles (bubbling green)
export function spawnPoisonParticles(x: number, y: number, count: number = 12): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 60;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80, // Rise up
      color: Math.random() > 0.5 ? '#44ff44' : '#66ff66',
      size: 3 + Math.random() * 4,
      lifetime: 800 + Math.random() * 600,
      gravity: -50 // Float upward
    }));
  }
  return particles;
}

// NEW: Lightning particles (crackling bolts)
export function spawnLightningParticles(x: number, y: number, count: number = 16): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 150 + Math.random() * 200;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.5 ? '#aaffff' : '#ffffff',
      size: 5 + Math.random() * 6,
      lifetime: 300 + Math.random() * 300, // Fast flash
      gravity: 0 // No gravity
    }));
  }
  return particles;
}

// NEW: Level up particles (celebration)
export function spawnLevelUpParticles(x: number, y: number, count: number = 40): Particle[] {
  const particles: Particle[] = [];
  const colors = ['#ffff00', '#ff8800', '#ff44ff', '#00ffff', '#88ff00'];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI; // Upward burst
    const speed = 150 + Math.random() * 200;
    particles.push(new Particle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 8, // BIG
      lifetime: 1000 + Math.random() * 800,
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

// Removed duplicate functions - better versions defined above with count parameter

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
