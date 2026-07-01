// Melee attack entity (for melee weapons)

export class MeleeAttack {
  x: number;
  y: number;
  angle: number; // Center angle
  arc: number; // Total arc in radians
  range: number;
  damage: number;
  lifetime: number;
  dead: boolean = false;
  knockback: number;
  maxLifetime: number = 0.2; // 200ms swing duration
  hitEnemies: Set<number> = new Set(); // Track hit enemies

  constructor(
    x: number,
    y: number,
    angle: number,
    arc: number,
    range: number,
    damage: number,
    knockback: number = 0
  ) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.arc = arc;
    this.range = range;
    this.damage = damage;
    this.knockback = knockback;
    this.lifetime = this.maxLifetime;
  }

  update(dt: number, playerX: number, playerY: number): void {
    // Follow player position
    this.x = playerX;
    this.y = playerY;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.dead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const progress = 1 - (this.lifetime / this.maxLifetime);
    const alpha = Math.sin(progress * Math.PI); // Fade in and out

    // Draw arc
    ctx.strokeStyle = `rgba(255, 200, 0, ${alpha * 0.8})`;
    ctx.lineWidth = 8;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffaa00';

    const startAngle = this.angle - this.arc / 2;
    const endAngle = this.angle + this.arc / 2;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.range, startAngle, endAngle);
    ctx.stroke();

    // Inner glow
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.range, startAngle, endAngle);
    ctx.stroke();

    ctx.restore();
  }

  // Check if point is within the arc
  isPointInArc(x: number, y: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.range) return false;

    const pointAngle = Math.atan2(dy, dx);
    const startAngle = this.angle - this.arc / 2;
    const endAngle = this.angle + this.arc / 2;

    // Normalize angles
    const normalizeAngle = (a: number) => {
      while (a < -Math.PI) a += Math.PI * 2;
      while (a > Math.PI) a -= Math.PI * 2;
      return a;
    };

    const normPoint = normalizeAngle(pointAngle);
    const normStart = normalizeAngle(startAngle);
    const normEnd = normalizeAngle(endAngle);

    if (normStart <= normEnd) {
      return normPoint >= normStart && normPoint <= normEnd;
    } else {
      return normPoint >= normStart || normPoint <= normEnd;
    }
  }

  markHit(enemyId: number): void {
    this.hitEnemies.add(enemyId);
  }

  hasHit(enemyId: number): boolean {
    return this.hitEnemies.has(enemyId);
  }
}
