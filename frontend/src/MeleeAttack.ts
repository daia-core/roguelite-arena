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
    ctx.imageSmoothingEnabled = false;

    const progress = 1 - (this.lifetime / this.maxLifetime);
    const fadeStrength = Math.sin(progress * Math.PI); // 0 to 1 to 0 over lifetime

    const startAngle = this.angle - this.arc / 2;
    const endAngle = this.angle + this.arc / 2;

    // PURE PIXEL ART: Use dithering for fade effect instead of alpha
    const pixelSize = 8;
    const numPixels = Math.floor((this.arc * this.range) / (pixelSize * 1.5));

    for (let i = 0; i < numPixels; i++) {
      // Dithered visibility: skip pixels based on fade strength
      // When fadeStrength = 1.0, draw all pixels
      // When fadeStrength = 0.5, draw 50% in checkerboard
      // When fadeStrength = 0.0, draw nothing
      const ditherThreshold = (i % 4) / 4; // 0, 0.25, 0.5, 0.75 pattern
      if (fadeStrength < ditherThreshold * 0.8) continue; // Skip this pixel

      const angleStep = startAngle + (endAngle - startAngle) * (i / numPixels);
      const px = this.x + Math.cos(angleStep) * this.range;
      const py = this.y + Math.sin(angleStep) * this.range;

      // Outer yellow pixels
      ctx.fillStyle = '#ffc800';
      ctx.fillRect(Math.floor(px - pixelSize / 2), Math.floor(py - pixelSize / 2), pixelSize, pixelSize);

      // Inner white pixels for highlight (every other pixel)
      if (i % 2 === 0) {
        ctx.fillStyle = '#ffffff';
        const innerRadius = this.range - pixelSize;
        const ipx = this.x + Math.cos(angleStep) * innerRadius;
        const ipy = this.y + Math.sin(angleStep) * innerRadius;
        ctx.fillRect(Math.floor(ipx - pixelSize / 2), Math.floor(ipy - pixelSize / 2), pixelSize * 0.6, pixelSize * 0.6);
      }
    }

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
