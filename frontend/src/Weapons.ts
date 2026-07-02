// Auxiliary "stacking" weapon entities — these run ALONGSIDE the primary weapon
// (auto-aim / shotgun / melee / …), never replacing it. Each is a lightweight
// kinematic + collision-query entity in the MeleeAttack mould: it moves/animates
// itself and exposes a hit test; Game.ts owns the actual damage application so all
// the crit / knockback / kill / particle logic stays in one place.

/**
 * A pixel energy orb that circles the player at a fixed radius. Contact damages
 * enemies, with a short per-enemy re-hit cooldown so it grinds rather than
 * one-shot-deletes everything it touches.
 */
export class OrbitingOrb {
  x: number = 0;
  y: number = 0;
  angle: number; // current orbit angle (radians)
  orbitRadius: number; // distance from the player
  radius: number = 11; // the orb's own body radius (collision + draw)
  damage: number;
  dead: boolean = false;
  private hitCooldowns: Map<number, number> = new Map(); // enemyId -> seconds until re-hittable

  constructor(startAngle: number, orbitRadius: number, damage: number) {
    this.angle = startAngle;
    this.orbitRadius = orbitRadius;
    this.damage = damage;
  }

  update(dt: number, px: number, py: number, spinSpeed: number, orbitRadius: number, damage: number): void {
    // Live-follow the owner's current stats so buying more orbit items / damage
    // updates existing orbs without respawning them.
    this.orbitRadius = orbitRadius;
    this.damage = damage;
    this.angle += spinSpeed * dt;
    this.x = px + Math.cos(this.angle) * this.orbitRadius;
    this.y = py + Math.sin(this.angle) * this.orbitRadius;

    // Tick down per-enemy hit cooldowns.
    for (const [id, t] of this.hitCooldowns) {
      const nt = t - dt;
      if (nt <= 0) this.hitCooldowns.delete(id);
      else this.hitCooldowns.set(id, nt);
    }
  }

  canHit(enemyId: number): boolean {
    return !this.hitCooldowns.has(enemyId);
  }

  markHit(enemyId: number, cooldown: number = 0.35): void {
    this.hitCooldowns.set(enemyId, cooldown);
  }

  collidesWith(ex: number, ey: number, er: number): boolean {
    const dx = ex - this.x;
    const dy = ey - this.y;
    const rr = this.radius + er;
    return dx * dx + dy * dy <= rr * rr;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const r = this.radius;
    // Outer dark ring for contrast
    ctx.fillStyle = '#003b5c';
    ctx.beginPath();
    ctx.arc(Math.floor(this.x), Math.floor(this.y), r, 0, Math.PI * 2);
    ctx.fill();
    // Cyan energy body
    ctx.fillStyle = '#22e0ff';
    ctx.beginPath();
    ctx.arc(Math.floor(this.x), Math.floor(this.y), r - 3, 0, Math.PI * 2);
    ctx.fill();
    // White hot core
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.floor(this.x) - 2, Math.floor(this.y) - 2, 4, 4);
    ctx.restore();
  }
}

/**
 * A bomb dropped at the player's location. Sits with a short fuse (blinking
 * faster as it nears), then flags `detonated` for one frame so Game.ts applies
 * the AoE blast and marks it dead.
 */
export class Bomb {
  x: number;
  y: number;
  fuse: number;
  maxFuse: number;
  blastRadius: number;
  damage: number;
  dead: boolean = false;
  detonated: boolean = false; // true for the single frame the blast should resolve

  constructor(x: number, y: number, fuse: number, blastRadius: number, damage: number) {
    this.x = x;
    this.y = y;
    this.fuse = fuse;
    this.maxFuse = fuse;
    this.blastRadius = blastRadius;
    this.damage = damage;
  }

  update(dt: number): void {
    if (this.dead || this.detonated) return;
    this.fuse -= dt;
    if (this.fuse <= 0) this.detonated = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const x = Math.floor(this.x);
    const y = Math.floor(this.y);
    // Blink rate accelerates toward detonation.
    const t = 1 - this.fuse / this.maxFuse;
    const blinkHz = 3 + t * 12;
    const lit = Math.floor(this.fuse * blinkHz) % 2 === 0;
    // Body
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    // Fuse spark
    ctx.fillStyle = lit ? '#ff3300' : '#ffcc00';
    ctx.fillRect(x - 2, y - 14, 4, 5);
    ctx.restore();
  }
}

/**
 * An expanding shockwave ring (nova pulse) centred where it spawned. Damages each
 * enemy once as the leading edge of the ring passes over it.
 */
export class Shockwave {
  x: number;
  y: number;
  radius: number = 8;
  maxRadius: number;
  speed: number;
  damage: number;
  band: number = 26; // ring thickness for the hit test
  dead: boolean = false;
  private hitEnemies: Set<number> = new Set();

  constructor(x: number, y: number, maxRadius: number, damage: number, speed: number = 520) {
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.damage = damage;
    this.speed = speed;
  }

  update(dt: number): void {
    this.radius += this.speed * dt;
    if (this.radius >= this.maxRadius) this.dead = true;
  }

  canHit(enemyId: number): boolean {
    return !this.hitEnemies.has(enemyId);
  }

  markHit(enemyId: number): void {
    this.hitEnemies.add(enemyId);
  }

  // Enemy is caught by the ring if its centre sits within the leading band.
  ringContains(ex: number, ey: number, er: number): boolean {
    const dist = Math.hypot(ex - this.x, ey - this.y);
    return dist + er >= this.radius - this.band && dist - er <= this.radius;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const fade = 1 - this.radius / this.maxRadius; // 1 -> 0
    const steps = Math.max(24, Math.floor(this.radius / 6));
    const px = 6;
    for (let i = 0; i < steps; i++) {
      // Dither the ring out as it expands.
      if ((i % 4) / 4 > fade * 1.1) continue;
      const a = (Math.PI * 2 * i) / steps;
      const rx = this.x + Math.cos(a) * this.radius;
      const ry = this.y + Math.sin(a) * this.radius;
      ctx.fillStyle = i % 2 === 0 ? '#a0f0ff' : '#ffffff';
      ctx.fillRect(Math.floor(rx - px / 2), Math.floor(ry - px / 2), px, px);
    }
    ctx.restore();
  }
}
