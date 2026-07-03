// Math and collision utilities

// Abbreviate large numbers so they stay readable on-screen (515000000 -> "515M",
// 1500 -> "1.5K"). Damage/gold scale exponentially late-game, so a raw value blows
// past any text box. Uses K/M/B/T suffixes; one decimal only when it adds signal
// (1.5K but 12K, not 12.0K), and never a decimal on the raw <1000 range.
export function formatShort(n: number): string {
  const neg = n < 0;
  let v = Math.abs(Math.round(n));
  if (v < 1000) return (neg ? '-' : '') + v.toString();
  const units = [
    { d: 1e12, s: 'T' },
    { d: 1e9, s: 'B' },
    { d: 1e6, s: 'M' },
    { d: 1e3, s: 'K' },
  ];
  for (const u of units) {
    if (v >= u.d) {
      const scaled = v / u.d;
      // One decimal for 1-9.9x (keeps precision where it matters), none for >=10x.
      const str = scaled >= 10 ? Math.floor(scaled).toString() : (Math.floor(scaled * 10) / 10).toString();
      return (neg ? '-' : '') + str + u.s;
    }
  }
  return (neg ? '-' : '') + v.toString();
}

export interface Point {
  x: number;
  y: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Calculate distance between two points
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate angle between two points
export function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Circle-circle collision detection
export function circleCollision(a: Circle, b: Circle): boolean {
  const dist = distance(a.x, a.y, b.x, b.y);
  return dist < a.radius + b.radius;
}

// Point-circle collision detection
export function pointInCircle(px: number, py: number, circle: Circle): boolean {
  return distance(px, py, circle.x, circle.y) < circle.radius;
}

// Swept collision: does the segment (ax,ay)->(bx,by) come within `radius` of the
// circle at (cx,cy)? Used so fast projectiles can't tunnel PAST a small enemy in
// one frame — we test the whole path travelled this step, not just the endpoint.
export function segmentCircleHit(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, radius: number
): boolean {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  // Degenerate (no movement): fall back to a point test at the endpoint.
  let t = lenSq > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t; // clamp to the segment
  const closestX = ax + dx * t, closestY = ay + dy * t;
  const ex = cx - closestX, ey = cy - closestY;
  return ex * ex + ey * ey <= radius * radius;
}

// Clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Linear interpolation
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Random integer between min and max (inclusive)
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random float between min and max
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Pick random element from array
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Shuffle array in place
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Normalize vector
export function normalize(x: number, y: number): Point {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

// Check if point is inside rectangle
export function pointInRect(px: number, py: number, rect: Rectangle): boolean {
  return px >= rect.x && px <= rect.x + rect.width &&
         py >= rect.y && py <= rect.y + rect.height;
}
