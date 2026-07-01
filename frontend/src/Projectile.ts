// Projectile entity (player and enemy bullets)

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  speed: number;
  color: string;
  fromPlayer: boolean;
  piercing: boolean;
  lifetime: number;
  dead: boolean = false;
  hitEnemies: Set<number> = new Set(); // Track hit enemies for piercing

  constructor(
    x: number,
    y: number,
    angle: number,
    damage: number,
    speed: number,
    fromPlayer: boolean,
    piercing: boolean = false
  ) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = fromPlayer ? 3 : 4;
    this.damage = damage;
    this.color = fromPlayer ? '#00ffff' : '#ff0000';
    this.fromPlayer = fromPlayer;
    this.piercing = piercing;
    this.lifetime = 3000; // 3 seconds max
  }

  update(dt: number, canvasWidth: number, canvasHeight: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.lifetime -= dt * 1000;
    if (this.lifetime <= 0) {
      this.dead = true;
    }

    // Kill if out of bounds
    if (this.x < -50 || this.x > canvasWidth + 50 ||
        this.y < -50 || this.y > canvasHeight + 50) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Glow effect
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  markHit(enemyId?: number): void {
    if (this.piercing && enemyId !== undefined) {
      this.hitEnemies.add(enemyId);
    } else {
      this.dead = true;
    }
  }

  hasHit(enemyId: number): boolean {
    return this.hitEnemies.has(enemyId);
  }
}
