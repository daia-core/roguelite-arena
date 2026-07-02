/**
 * Medieval Pixel Art Sprite System with Animations
 * Follows hue-shifting, proper shading, and animation best practices
 */

export interface AnimatedSprite {
  frames: HTMLCanvasElement[];
  frameRate: number; // FPS (6 for idle, 8 for walk, 12 for attack)
  loop: boolean;
}

export interface SpriteAnimations {
  idle: AnimatedSprite;
  walk?: AnimatedSprite;
  attack?: AnimatedSprite;
}

export class SpriteSheet {
  private static sprites: Map<string, HTMLCanvasElement> = new Map();
  private static animations: Map<string, SpriteAnimations> = new Map();

  // Initialize all sprites
  static init() {
    this.createPlayerSprites();
    this.createEnemySprites();
    this.createProjectileSprites();
    this.createItemSprites();
    this.createPickupSprites();
  }

  static get(name: string): HTMLCanvasElement | null {
    return this.sprites.get(name) || null;
  }

  static getAnimation(name: string): SpriteAnimations | null {
    return this.animations.get(name) || null;
  }

  private static createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // Helper to draw pixel art from array
  private static drawPixels(
    ctx: CanvasRenderingContext2D,
    pixels: number[][],
    colors: string[],
    scale: number = 3
  ): void {
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });
  }

  // ==================== PLAYER SPRITES ====================
  private static createPlayerSprites() {
    const size = 66;

    // IDLE ANIMATION (2 frames, 6 FPS)
    const idleFrame1 = this.createCanvas(size, size);
    const idleFrame2 = this.createCanvas(size, size);

    // Frame 1: Neutral stance
    const idlePixels1 = [
      [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,12,12,1,1,12,12,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,2,2,2,1,1,2,2,2,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,2,2,3,2,1,1,2,3,2,2,1,1,1,0,0,0],
      [0,0,0,1,1,1,2,2,2,2,1,1,2,2,2,2,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,4,13,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,4,4,13,13,4,4,13,4,4,4,1,1,0,0,0,0],
      [0,0,0,0,0,1,4,5,5,4,4,4,4,5,5,4,1,0,0,0,0,0],
      [0,0,0,0,1,4,4,5,5,4,4,4,4,5,5,4,4,1,0,0,0,0],
      [0,0,0,14,6,4,4,4,4,4,4,4,4,4,4,4,4,6,14,0,0,0],
      [0,0,14,6,6,6,4,4,4,4,4,4,4,4,4,4,6,6,6,14,0,0],
      [0,6,6,7,7,6,6,4,4,4,4,4,4,4,4,6,6,7,7,6,6,0],
      [0,6,7,7,8,7,6,6,6,6,6,6,6,6,6,6,7,8,7,7,6,0],
      [0,0,6,7,7,6,6,9,9,6,6,6,6,9,9,6,6,7,7,6,0,0],
      [0,0,0,6,6,6,9,9,15,9,0,0,9,15,9,9,6,6,6,0,0,0],
      [0,0,0,0,6,9,9,15,9,0,0,0,0,9,15,9,9,6,0,0,0,0],
      [0,0,0,16,9,9,9,0,0,0,0,0,0,0,9,9,9,16,0,0,0,0],
      [0,0,16,10,10,9,0,0,0,0,0,0,0,0,9,10,10,16,0,0,0,0],
      [0,0,10,11,10,0,0,0,0,0,0,0,0,0,0,10,11,10,0,0,0,0],
      [0,0,0,10,10,10,0,0,0,0,0,0,0,0,10,10,10,0,0,0,0,0],
    ];

    // Frame 2: Slight breathing (shoulders up 1px)
    const idlePixels2 = [
      [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,12,12,1,1,12,12,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,2,2,2,1,1,2,2,2,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,2,2,3,2,1,1,2,3,2,2,1,1,1,0,0,0],
      [0,0,0,1,1,1,2,2,2,2,1,1,2,2,2,2,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,4,13,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,4,4,13,13,4,4,13,4,4,4,1,1,0,0,0,0],
      [0,0,0,0,1,4,4,5,5,4,4,4,4,5,5,4,4,1,0,0,0,0], // shoulders up
      [0,0,0,14,6,4,4,5,5,4,4,4,4,5,5,4,4,6,14,0,0,0],
      [0,0,14,6,6,4,4,4,4,4,4,4,4,4,4,4,4,6,6,14,0,0],
      [0,6,6,7,7,6,6,4,4,4,4,4,4,4,4,6,6,7,7,6,6,0],
      [0,6,7,7,8,7,6,6,6,6,6,6,6,6,6,6,7,8,7,7,6,0],
      [0,0,6,7,7,6,6,9,9,6,6,6,6,9,9,6,6,7,7,6,0,0],
      [0,0,0,6,6,6,9,9,15,9,0,0,9,15,9,9,6,6,6,0,0,0],
      [0,0,0,0,6,9,9,15,9,0,0,0,0,9,15,9,9,6,0,0,0,0],
      [0,0,0,16,9,9,9,0,0,0,0,0,0,0,9,9,9,16,0,0,0,0],
      [0,0,16,10,10,9,0,0,0,0,0,0,0,0,9,10,10,16,0,0,0,0],
      [0,0,10,11,10,0,0,0,0,0,0,0,0,0,0,10,11,10,0,0,0,0],
      [0,0,0,10,10,10,0,0,0,0,0,0,0,0,10,10,10,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ];

    // Medieval color palette with HUE SHIFTING
    const playerColors = [
      'transparent',  // 0
      '#a67c52',      // 1 - skin outline (warm brown, not black)
      '#c9a57b',      // 2 - skin base (peachy tan)
      '#5a3825',      // 3 - eye pupils (dark brown)
      '#c0c0c0',      // 4 - helmet silver base
      '#909090',      // 5 - helmet shadow (cool shift toward blue-gray)
      '#1e3a8a',      // 6 - armor royal blue shadow (deep, hue-shifted)
      '#3b82f6',      // 7 - armor royal blue mid
      '#ffffff',      // 8 - armor rim light (brightest highlight)
      '#7f1d1d',      // 9 - cape crimson shadow (hue-shifted toward purple-red)
      '#dc2626',      // 10 - cape crimson mid
      '#f87171',      // 11 - cape crimson highlight (warm shift toward orange-red)
      '#e5c9a3',      // 12 - skin highlight (warm peachy shift)
      '#eab308',      // 13 - helmet gold accent (warm)
      '#60a5fa',      // 14 - armor light edge (rim lighting)
      '#ef4444',      // 15 - cape bright highlight
      '#991b1b',      // 16 - cape outline (colored, not black)
    ];

    const scale = 3;
    this.drawPixels(idleFrame1.getContext('2d')!, idlePixels1, playerColors, scale);
    this.drawPixels(idleFrame2.getContext('2d')!, idlePixels2, playerColors, scale);

    // Store animation
    this.animations.set('player', {
      idle: {
        frames: [idleFrame1, idleFrame2],
        frameRate: 6, // 6 FPS for idle
        loop: true
      }
    });

    // Also store first frame as static sprite for compatibility
    this.sprites.set('player', idleFrame1);
  }

  // ==================== ENEMY SPRITES ====================
  private static createEnemySprites() {
    this.createSlimeSprite();
    this.createGoblinSprite();
    this.createSkeletonSprite();
    this.createDemonSprite();
    this.createImpSprite();
    this.createOrcSprite();
    this.createWraithSprite();
    this.createNecromancerSprite();
    this.createTrollSprite();
    this.createBansheeSprite();
    this.createBatSprite();
    this.createWizardSprite();
    this.createMimicSprite();
    this.createSpiderSprite();
    this.createGolemSprite();
    this.createGhostSprite();
    this.createMushroomSprite();
    this.createGargoyleSprite();
    this.createBlobSprite();
    this.createNecroEggSprite();
    this.createCyclopsSprite();
    this.createPhantomSprite();
    this.createDruidSprite();
    this.createConstructSprite();
    this.createSwarmSprite();
    // Additional enemy types
    this.createDasherSprite();
    this.createEvaderSprite();
    this.createOrbiterSprite();
    this.createSpiralerSprite();
  }

  private static createSlimeSprite() {
    const size = 48;

    // IDLE ANIMATION (2 frames - squish effect)
    const frame1 = this.createCanvas(size, size);
    const frame2 = this.createCanvas(size, size);

    // Frame 1: Normal shape
    const pixels1 = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,1,1,1,2,2,9,2,2,9,1,1,1,0,0,0],
      [0,0,1,1,2,2,2,3,3,3,3,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,3,9,3,3,9,3,2,2,1,1,0],
      [0,1,2,2,3,4,4,3,3,3,3,4,4,3,2,2,1,0],
      [1,1,2,3,3,4,5,4,3,3,4,5,4,3,3,2,1,1],
      [1,2,2,3,4,4,5,5,3,3,4,5,5,4,3,2,2,1],
      [1,2,3,3,4,5,5,6,3,3,4,5,6,5,3,3,2,1],
      [1,2,3,3,4,5,6,6,3,3,4,6,6,5,3,3,2,1],
      [1,2,3,3,3,4,5,5,3,3,3,5,5,4,3,3,2,1],
      [1,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,1],
      [1,2,2,3,3,7,7,3,3,3,3,7,7,3,3,2,2,1],
      [0,1,2,2,3,3,3,3,3,3,3,3,3,3,2,2,1,0],
      [0,1,1,2,2,2,8,8,2,9,8,8,2,2,2,1,1,0],
      [0,0,1,1,2,2,2,9,2,2,9,2,2,2,1,1,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
    ];

    // Frame 2: Slightly squished (wider, shorter)
    const pixels2 = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,1,1,1,2,2,9,2,2,9,2,2,1,1,1,0,0],
      [0,1,1,2,2,2,3,3,3,3,3,3,2,2,2,1,1,0],
      [1,1,2,2,3,3,3,9,3,3,9,3,3,3,2,2,1,1],
      [1,2,2,3,4,4,3,3,3,3,3,3,4,4,3,2,2,1],
      [1,2,3,3,4,5,4,3,3,3,3,4,5,4,3,3,2,1],
      [1,2,3,4,4,5,5,3,3,3,3,5,5,4,4,3,2,1],
      [1,2,3,4,5,5,6,3,3,3,3,6,5,5,4,3,2,1],
      [1,2,3,3,4,5,5,3,3,3,3,5,5,4,3,3,2,1],
      [1,2,2,3,3,3,3,3,7,7,3,3,3,3,3,2,2,1],
      [1,2,2,3,3,7,7,3,3,3,3,7,7,3,3,2,2,1],
      [0,1,2,2,3,3,3,3,3,3,3,3,3,3,2,2,1,0],
      [0,1,1,2,2,2,8,8,2,9,8,8,2,2,2,1,1,0],
      [0,0,1,1,2,2,2,9,2,2,9,2,2,2,1,1,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ];

    // Medieval green slime with hue shifting
    const slimeColors = [
      'transparent',
      '#166534',     // 1 - outline (dark forest green, not black)
      '#22c55e',     // 2 - slime mid green
      '#86efac',     // 3 - slime highlight (warm shift toward yellow-green)
      '#ffffff',     // 4 - eyes white core
      '#f0f0f0',     // 5 - eyes light
      '#e0e0e0',     // 6 - top shine (warm)
      '#14532d',     // 7 - nucleus darker green (hue-shifted cooler)
      '#0f5e3a',     // 8 - shadow (hue-shifted toward blue-green, cooler)
      '#6ee7b7',     // 9 - dithering mid-tone
    ];

    const scale = 3;
    this.drawPixels(frame1.getContext('2d')!, pixels1, slimeColors, scale);
    this.drawPixels(frame2.getContext('2d')!, pixels2, slimeColors, scale);

    this.animations.set('slime', {
      idle: {
        frames: [frame1, frame2],
        frameRate: 6,
        loop: true
      }
    });

    this.sprites.set('slime', frame1);
  }

  private static createGoblinSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Goblin with medieval aesthetic (menacing, crude)
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,11,2,2,11,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,4,2,2,3,3,4,2,2,1,1,0],
      [0,1,2,2,2,3,4,4,2,2,3,4,4,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,5,5,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,5,5,5,5,5,5,5,5,2,2,1,0,0],
      [0,0,0,1,2,2,5,6,6,6,6,5,2,2,1,0,0,0],
      [0,0,12,7,1,2,6,6,6,6,6,6,2,1,7,12,0,0],
      [0,12,7,7,7,1,1,1,1,1,1,1,1,7,7,7,12,0],
      [0,7,8,8,7,7,7,13,7,7,13,7,7,7,8,8,7,0],
      [0,0,7,8,8,7,7,0,0,0,0,7,7,8,8,7,0,0],
      [0,0,0,7,7,7,0,0,0,0,0,0,7,7,7,0,0,0],
      [9,0,0,0,7,0,0,0,0,0,0,0,0,7,0,0,0,9],
      [9,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9],
      [10,9,9,0,0,0,0,0,0,0,0,0,0,0,0,9,9,10],
    ];

    const goblinColors = [
      'transparent',
      '#3a5a24',     // 1 - outline (dark olive green)
      '#6b8e23',     // 2 - skin mid olive-green (medieval goblin tone)
      '#8b4513',     // 3 - eyes brown core
      '#ffd700',     // 4 - eyes yellow menacing glow
      '#654321',     // 5 - nose/mouth shadow brown
      '#f5deb3',     // 6 - sharp teeth wheat
      '#374151',     // 7 - crude armor shadow (dark cool gray)
      '#6b7280',     // 8 - crude armor mid gray
      '#9ca3af',     // 9 - dagger blade highlight
      '#5a3825',     // 10 - dagger handle dark wood
      '#90b854',     // 11 - skin highlight (warm shift toward yellow-green)
      '#4b5563',     // 12 - armor edge (colored outline)
      '#52525b',     // 13 - armor dither mid-tone
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, goblinColors, scale);

    this.sprites.set('goblin', canvas);
  }

  private static createSkeletonSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Medieval skeleton (undead, eerie)
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,7,2,2,7,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,3,3,3,2,2,3,3,3,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,3,3,4,3,2,2,3,4,3,3,2,2,1,0],
      [0,1,2,2,2,3,3,2,2,2,2,3,3,2,2,2,1,0],
      [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,5,5,5,5,5,5,2,2,1,0,0,0],
      [0,0,0,1,1,2,2,5,6,6,5,2,2,1,1,0,0,0],
      [0,0,0,0,1,1,2,2,5,5,2,2,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,0,0,0,0,1,2,2,1,1,0,0],
      [0,1,1,2,2,2,1,0,0,0,0,1,2,2,2,1,1,0],
      [0,1,2,2,2,1,0,0,0,0,0,0,1,2,2,2,1,0],
      [0,0,1,2,1,0,0,0,0,0,0,0,0,1,2,1,0,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
    ];

    const skeletonColors = [
      'transparent',
      '#78716c',     // 1 - bone shadow (warm gray, hue-shifted toward warm stone)
      '#e7e5e4',     // 2 - bone white mid (ivory)
      '#292524',     // 3 - eye socket deep shadow (dark warm brown, not pure black)
      '#22c55e',     // 4 - eerie green glow (bright magical rim light in eyes)
      '#57534e',     // 5 - mouth shadow (dark stone brown, hue-shifted)
      '#ef4444',     // 6 - throat glow core (cursed red)
      '#fafaf9',     // 7 - bone highlight (warm shift toward cream-white)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, skeletonColors, scale);

    this.sprites.set('skeleton', canvas);
  }

  private static createDemonSprite() {
    const size = 72;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Demon boss with medieval aesthetic (horns, flames, menacing)
    const pixels = [
      [0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,1,1,0,0,0,0,1,1,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,1,1,0,0,1,1,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,2,2,1,0,0,1,2,2,3,3,2,2,1,1,0],
      [0,1,2,2,3,3,3,3,2,1,0,0,1,2,3,3,3,3,2,2,1,0],
      [0,0,1,1,2,2,2,2,1,1,0,0,1,1,2,2,2,2,1,1,0,0],
      [0,0,0,1,1,1,1,1,4,4,4,4,4,4,1,1,1,1,1,0,0,0],
      [0,0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0,0],
      [0,0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0,0,0],
      [0,0,4,4,4,5,5,5,4,4,4,4,4,5,5,5,4,4,4,4,0,0],
      [0,4,4,4,5,5,6,5,4,4,4,4,4,5,6,5,5,4,4,4,4,0],
      [0,4,4,4,5,6,6,5,4,4,4,4,4,5,6,6,5,4,4,4,4,0],
      [0,4,4,4,4,5,5,4,4,4,4,4,4,4,5,5,4,4,4,4,4,0],
      [0,0,4,4,4,4,4,4,7,7,7,7,7,7,4,4,4,4,4,4,0,0],
      [0,0,0,4,4,4,4,7,7,7,7,7,7,7,7,4,4,4,4,0,0,0],
      [0,0,0,0,4,4,7,7,7,8,8,8,8,7,7,7,4,4,0,0,0,0],
      [0,0,0,0,0,4,4,7,7,7,7,7,7,7,7,4,4,0,0,0,0,0],
      [0,0,0,0,4,4,4,4,4,0,0,0,0,4,4,4,4,4,0,0,0,0],
      [0,0,0,4,4,4,4,0,0,0,0,0,0,0,0,4,4,4,4,0,0,0],
      [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,0],
    ];

    const demonColors = [
      'transparent',
      '#854d0e',     // 1 - horns gold shadow (dark warm gold)
      '#eab308',     // 2 - horns gold middle
      '#fde047',     // 3 - horns gold highlight (warm yellow shift)
      '#7f1d1d',     // 4 - body dark crimson demonic (hue-shifted red-purple)
      '#dc2626',     // 5 - eyes red fierce
      '#fbbf24',     // 6 - eyes yellow glow center
      '#1c1917',     // 7 - mouth/fangs darkness (warm dark stone, not black)
      '#f97316',     // 8 - mouth inner hellfire glow (orange-red)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, demonColors, scale);

    this.sprites.set('demon', canvas);
  }

  // ==================== SIMPLIFIED ENEMY SPRITES (Static for now) ====================
  // Due to file size constraints, remaining enemies are static but follow medieval palette

  private static createImpSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,7,7,0,0,1,1,1,1,1,1,1,1,0,0,7,7,0],
      [7,7,7,7,0,1,2,2,1,1,2,2,1,0,7,7,7,7],
      [7,8,8,7,1,1,2,2,1,1,2,2,1,1,7,8,8,7],
      [0,7,7,0,1,2,2,3,2,2,2,3,2,1,0,7,7,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,4,4,2,2,4,4,2,2,1,1,0,0],
      [0,1,1,2,2,2,4,4,2,2,4,4,2,2,2,1,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,5,5,5,5,5,5,5,5,2,2,1,0,0],
      [0,0,0,1,2,2,5,6,6,6,6,5,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,0,0,2,2,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,0,0,0,0,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,0,0,0,0,0,0,2,2,1,1,0,0],
      [0,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,0],
    ];

    const impColors = [
      'transparent',
      '#7f1d1d',     // 1 - imp skin shadow (dark crimson)
      '#dc2626',     // 2 - imp skin mid red
      '#fbbf24',     // 3 - eyes yellow glow
      '#f59e0b',     // 4 - eye flames orange
      '#292524',     // 5 - mouth shadow (dark warm)
      '#ef4444',     // 6 - mouth inner glow
      '#374151',     // 7 - wings shadow gray
      '#6b7280',     // 8 - wings mid gray
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, impColors, scale);
    this.sprites.set('imp', canvas);
  }

  private static createOrcSprite() {
    const size = 60;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,9,2,2,2,9,2,2,1,1,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,0,1,1,2,2,3,3,3,2,2,3,3,3,2,2,2,1,1,0],
      [0,1,1,2,2,3,3,4,3,2,2,3,4,3,3,2,2,1,1,0],
      [0,1,2,2,2,3,4,4,3,2,2,3,4,4,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,5,5,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,5,5,5,5,5,5,5,5,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,5,6,6,6,6,5,2,2,2,1,0,0,0],
      [0,0,0,1,1,2,2,2,6,6,6,6,2,2,2,1,1,0,0,0],
      [0,0,0,0,1,1,7,7,7,7,7,7,7,7,1,1,0,0,0,0],
      [0,0,0,10,7,7,8,8,7,7,7,7,8,8,7,7,10,0,0,0],
      [0,0,10,7,7,8,8,8,7,7,7,7,8,8,8,7,7,10,0,0],
      [0,0,7,7,8,8,8,7,7,0,0,7,7,8,8,8,7,7,0,0],
      [0,0,0,7,7,7,7,0,0,0,0,0,0,7,7,7,7,0,0,0],
      [0,0,0,0,7,7,0,0,0,0,0,0,0,0,7,7,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ];

    const orcColors = [
      'transparent',
      '#3f6212',     // 1 - orc skin outline (dark olive)
      '#65a30d',     // 2 - orc skin mid olive-green
      '#78350f',     // 3 - eyes brown base
      '#dc2626',     // 4 - eyes red menace glow
      '#57534e',     // 5 - tusks shadow brown
      '#e7e5e4',     // 6 - tusks ivory white
      '#1c1917',     // 7 - armor shadow (warm dark)
      '#44403c',     // 8 - armor mid brown-gray
      '#a3e635',     // 9 - skin highlight (warm yellow-green shift)
      '#292524',     // 10 - armor edge outline
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, orcColors, scale);
    this.sprites.set('orc', canvas);
  }

  private static createWraithSprite() {
    const size = 54;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,8,2,2,8,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,2,2,3,3,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,2,2,5,5,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,5,5,5,5,2,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,6,6,6,1,1,6,6,6,1,0,0,0,0],
      [0,0,0,1,6,6,7,6,1,1,6,7,6,6,1,0,0,0],
      [0,0,1,6,6,7,7,6,0,0,6,7,7,6,6,1,0,0],
      [0,0,1,6,7,7,6,0,0,0,0,6,7,7,6,1,0,0],
      [0,0,0,1,6,6,0,0,0,0,0,0,6,6,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0],
    ];

    const wraithColors = [
      'transparent',
      '#3730a3',     // 1 - wraith outline (deep indigo)
      '#6366f1',     // 2 - ethereal body mid indigo
      '#1e1b4b',     // 3 - eye sockets shadow (dark purple-blue)
      '#a78bfa',     // 4 - eyes purple glow
      '#312e81',     // 5 - mouth shadow (deep violet)
      '#4f46e5',     // 6 - wispy cloak mid
      '#818cf8',     // 7 - wispy cloak highlight (lighter indigo)
      '#c4b5fd',     // 8 - body highlight (ethereal lavender shift)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, wraithColors, scale);
    this.sprites.set('wraith', canvas);
  }

  private static createNecromancerSprite() {
    const size = 54;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,2,2,3,3,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,5,5,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,5,5,5,5,5,5,5,5,2,2,1,0,0],
      [0,0,0,1,2,2,5,6,6,6,6,5,2,2,1,0,0,0],
      [0,0,7,7,1,2,2,2,2,2,2,2,2,1,7,7,0,0],
      [0,7,7,7,7,1,1,1,1,1,1,1,1,7,7,7,7,0],
      [0,7,8,8,7,7,9,9,7,7,9,9,7,7,8,8,7,0],
      [0,0,7,8,8,7,9,9,0,0,9,9,7,8,8,7,0,0],
      [0,0,0,7,7,7,9,0,0,0,0,9,7,7,7,0,0,0],
      [0,0,0,0,7,7,0,0,0,0,0,0,7,7,0,0,0,0],
      [0,0,0,0,0,7,0,0,0,0,0,0,7,0,0,0,0,0],
    ];

    const necroColors = [
      'transparent',
      '#292524',     // 1 - hood outline (warm dark)
      '#a8a29e',     // 2 - face pale undead (cool gray-tan)
      '#1c1917',     // 3 - eye sockets deep shadow
      '#22c55e',     // 4 - eyes eerie green glow
      '#78716c',     // 5 - beard shadow (stone gray)
      '#e7e5e4',     // 6 - beard white
      '#3f3f46',     // 7 - robes shadow (dark cool gray)
      '#71717a',     // 8 - robes mid gray
      '#7c2d12',     // 9 - rune glow red-brown
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, necroColors, scale);
    this.sprites.set('necromancer', canvas);
  }

  private static createTrollSprite() {
    const size = 72;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,9,2,2,2,2,9,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,3,2,2,2,2,3,3,3,2,2,1,1,0],
      [0,1,2,2,3,3,4,3,2,2,2,2,3,4,3,3,2,2,1,0],
      [0,1,2,2,3,4,4,3,2,2,2,2,3,4,4,3,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,5,5,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,5,5,5,5,5,5,5,5,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,5,6,6,6,6,5,2,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,6,6,6,6,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,7,7,7,1,1,1,1,7,7,7,1,0,0,0,0],
      [0,0,0,1,7,7,8,7,7,1,1,7,7,8,7,7,1,0,0,0],
      [0,0,1,7,7,8,8,8,7,0,0,7,8,8,8,7,7,1,0,0],
      [0,0,1,7,8,8,8,7,0,0,0,0,7,8,8,8,7,1,0,0],
      [0,0,0,1,7,7,7,0,0,0,0,0,0,7,7,7,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0],
    ];

    const trollColors = [
      'transparent',
      '#365314',     // 1 - troll skin outline (dark forest green)
      '#4d7c0f',     // 2 - troll skin mid green
      '#78350f',     // 3 - eyes brown base
      '#f59e0b',     // 4 - eyes amber glow
      '#44403c',     // 5 - tusks shadow brown
      '#fef3c7',     // 6 - tusks ivory
      '#292524',     // 7 - fur shadow (warm dark)
      '#57534e',     // 8 - fur mid brown
      '#84cc16',     // 9 - skin highlight (warm lime shift)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, trollColors, scale);
    this.sprites.set('troll', canvas);
  }

  private static createBansheeSprite() {
    const size = 54;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,8,2,2,8,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,2,2,2,2,3,3,2,2,1,1,0],
      [0,1,2,2,3,4,3,2,2,2,2,3,4,3,2,2,1,0],
      [0,1,2,2,2,3,2,2,2,2,2,2,3,2,2,2,1,0],
      [0,0,1,2,2,2,2,2,5,5,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,5,5,5,5,2,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,5,5,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,6,6,6,1,1,6,6,6,1,0,0,0,0],
      [0,0,0,1,6,6,7,6,1,1,6,7,6,6,1,0,0,0],
      [0,0,1,6,6,7,7,6,0,0,6,7,7,6,6,1,0,0],
      [0,0,1,6,7,7,6,6,0,0,6,6,7,7,6,1,0,0],
      [0,0,0,1,6,6,6,0,0,0,0,6,6,6,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0],
    ];

    const bansheeColors = [
      'transparent',
      '#4c1d95',     // 1 - banshee outline (deep violet)
      '#8b5cf6',     // 2 - ethereal body mid violet
      '#312e81',     // 3 - eye sockets shadow
      '#c4b5fd',     // 4 - eyes ethereal glow (lavender)
      '#1e1b4b',     // 5 - mouth shadow (dark violet)
      '#6366f1',     // 6 - flowing hair mid indigo
      '#a78bfa',     // 7 - flowing hair highlight (purple)
      '#ddd6fe',     // 8 - body highlight (pale lavender shift)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, bansheeColors, scale);
    this.sprites.set('banshee', canvas);
  }

  private static createBatSprite() {
    const size = 42;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [1,1,0,0,0,0,0,0,2,2,0,0,0,0,0,0,1,1],
      [1,3,1,0,0,0,0,2,2,2,2,0,0,0,0,1,3,1],
      [0,1,3,1,0,0,2,2,2,2,2,2,0,0,1,3,1,0],
      [0,0,1,3,1,2,2,2,4,4,2,2,2,1,3,1,0,0],
      [0,0,0,1,2,2,2,4,4,4,4,2,2,2,1,0,0,0],
      [0,0,0,2,2,2,2,2,4,4,2,2,2,2,2,0,0,0],
      [0,0,2,2,2,5,5,2,2,2,2,5,5,2,2,2,0,0],
      [0,0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
      [0,0,0,2,2,2,2,6,6,6,6,2,2,2,2,0,0,0],
      [0,0,0,0,2,2,2,2,2,2,2,2,2,2,0,0,0,0],
      [0,0,0,0,0,2,2,2,2,2,2,2,2,0,0,0,0,0],
    ];

    const batColors = [
      'transparent',
      '#292524',     // 1 - wing shadow (warm dark)
      '#44403c',     // 2 - body/wing mid brown-gray
      '#57534e',     // 3 - wing membrane mid
      '#78716c',     // 4 - face/ears highlight (lighter warm gray)
      '#dc2626',     // 5 - eyes red glow
      '#e7e5e4',     // 6 - fangs ivory
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, batColors, scale);
    this.sprites.set('bat', canvas);
  }

  // Remaining enemies use simplified static sprites following medieval palette
  // To stay within file size limits, I'll create placeholder implementations

  private static createWizardSprite() {
    const size = 54;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Medieval wizard with pointy hat and staff
    const pixels = [
      [0,0,0,0,0,0,0,7,7,7,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,7,7,1,7,7,0,0,0,0,0,0,0],
      [0,0,0,0,0,7,7,1,1,1,7,7,0,0,0,0,0,0],
      [0,0,0,0,7,7,1,1,8,1,1,7,7,0,0,0,0,0],
      [0,0,0,7,7,1,1,1,1,1,1,1,7,7,0,0,0,0],
      [0,0,7,7,1,1,1,1,1,1,1,1,1,7,7,0,0,0],
      [0,7,7,1,1,1,1,1,1,1,1,1,1,1,7,7,0,0],
      [0,0,7,7,1,1,1,1,1,1,1,1,1,7,7,0,0,0],
      [0,0,0,7,7,7,7,7,7,7,7,7,7,7,0,0,0,0],
      [0,0,0,0,1,1,2,2,9,2,2,9,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,5,5,3,3,3,2,2,2,1,0],
      [0,0,1,2,2,2,2,5,5,5,5,2,2,2,2,1,0,0],
      [0,0,0,1,1,1,6,6,6,6,6,6,1,1,1,0,0,0],
      [0,0,0,0,1,6,6,6,0,0,6,6,6,1,0,0,0,0],
      [0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],
    ];

    const wizardColors = [
      'transparent',
      '#3730a3',     // 1 - robe deep indigo
      '#a8a29e',     // 2 - face pale (old wizard)
      '#422006',     // 3 - eye shadow
      '#a78bfa',     // 4 - eyes purple glow
      '#78716c',     // 5 - beard gray
      '#4f46e5',     // 6 - robe mid indigo
      '#6366f1',     // 7 - hat mid blue
      '#fbbf24',     // 8 - hat star/moon gold
      '#c4b5fd',     // 9 - face highlight
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, wizardColors, scale);
    this.sprites.set('wizard', canvas);
  }

  private static createMimicSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Mimic chest with teeth and evil eye
    const pixels = [
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [1,1,2,2,3,3,2,2,2,2,2,2,3,3,2,2,1,1],
      [1,2,2,3,3,3,3,2,2,2,2,3,3,3,3,2,2,1],
      [1,2,3,3,4,3,3,2,2,2,2,3,3,4,3,3,2,1],
      [1,2,2,3,3,3,2,2,2,2,2,2,3,3,3,2,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,2,5,5,2,2,6,6,6,6,2,2,5,5,2,2,1],
      [1,2,5,5,7,5,2,6,8,8,6,2,5,7,5,5,2,1],
      [1,2,5,7,7,5,2,6,8,8,6,2,5,7,7,5,2,1],
      [1,2,2,5,5,2,2,6,6,6,6,2,2,5,5,2,2,1],
      [1,2,2,2,2,9,9,9,9,9,9,9,9,2,2,2,2,1],
      [1,2,2,9,9,9,10,9,10,9,10,9,9,9,9,2,2,1],
      [0,1,2,2,9,10,10,10,10,10,10,10,9,2,2,1,0,0],
      [0,0,1,2,2,9,9,9,9,9,9,9,9,2,2,1,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
    ];

    const mimicColors = [
      'transparent',
      '#5a3825',     // 1 - chest outline (dark wood)
      '#92400e',     // 2 - chest wood mid brown
      '#eab308',     // 3 - gold trim mid
      '#fde047',     // 4 - gold trim highlight
      '#dc2626',     // 5 - eyes red core
      '#1c1917',     // 6 - mouth darkness
      '#f59e0b',     // 7 - eyes glow orange
      '#f5f5f4',     // 8 - teeth white
      '#78350f',     // 9 - tongue shadow brown
      '#ef4444',     // 10 - tongue red
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, mimicColors, scale);
    this.sprites.set('mimic', canvas);
  }

  private static createSpiderSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Giant spider with 8 legs
    const pixels = [
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [0,1,0,0,0,0,2,2,2,2,2,2,0,0,0,0,1,0],
      [0,0,1,0,0,2,2,2,2,2,2,2,2,0,0,1,0,0],
      [1,0,0,1,2,2,3,3,2,2,3,3,2,2,1,0,0,1],
      [0,1,0,2,2,3,4,3,2,2,3,4,3,2,2,0,1,0],
      [0,0,2,2,2,3,3,2,2,2,2,3,3,2,2,2,0,0],
      [0,0,2,2,2,2,2,2,5,5,2,2,2,2,2,2,0,0],
      [0,0,2,6,2,2,2,5,5,5,5,2,2,2,6,2,0,0],
      [0,2,2,6,6,2,5,5,7,7,5,5,2,6,6,2,2,0],
      [0,2,2,2,6,2,2,5,5,5,5,2,2,6,2,2,2,0],
      [0,0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0,0],
      [0,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,0],
      [1,0,0,0,2,2,2,2,0,0,2,2,2,2,0,0,0,1],
      [0,1,0,0,0,2,2,0,0,0,0,2,2,0,0,0,1,0],
      [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
    ];

    const spiderColors = [
      'transparent',
      '#1c1917',     // 1 - legs outline (very dark warm)
      '#292524',     // 2 - body shadow (dark warm brown)
      '#dc2626',     // 3 - eyes red core
      '#fbbf24',     // 4 - eyes amber glow
      '#44403c',     // 5 - body mid brown
      '#57534e',     // 6 - legs mid tone
      '#78716c',     // 7 - body highlight (lighter warm gray)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, spiderColors, scale);
    this.sprites.set('spider', canvas);
  }

  private static createGolemSprite() {
    const size = 72;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Stone golem - large and imposing
    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,8,2,2,2,2,8,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,3,2,2,2,2,3,3,3,2,2,1,1,0],
      [0,1,2,2,3,3,4,3,2,2,2,2,3,4,3,3,2,2,1,0],
      [0,1,2,2,3,4,4,3,2,2,2,2,3,4,4,3,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,5,5,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,5,5,5,5,5,5,5,5,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,5,6,6,6,6,5,2,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,6,6,6,6,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,7,7,7,7,7,1,1,1,1,7,7,7,7,7,0,0,0],
      [0,0,7,7,7,8,7,7,7,1,1,7,7,7,8,7,7,7,0,0],
      [0,7,7,7,8,8,8,7,0,0,0,0,7,8,8,8,7,7,7,0],
      [0,7,7,8,8,8,7,0,0,0,0,0,0,7,8,8,8,7,7,0],
      [0,0,7,7,7,7,0,0,0,0,0,0,0,0,7,7,7,7,0,0],
      [0,0,0,7,7,0,0,0,0,0,0,0,0,0,0,7,7,0,0,0],
    ];

    const golemColors = [
      'transparent',
      '#44403c',     // 1 - stone outline (dark warm gray)
      '#78716c',     // 2 - stone mid gray
      '#f59e0b',     // 3 - eyes amber core
      '#fbbf24',     // 4 - eyes amber bright glow
      '#57534e',     // 5 - mouth shadow (darker stone)
      '#a8a29e',     // 6 - teeth stone white
      '#292524',     // 7 - body shadow (very dark)
      '#a8a29e',     // 8 - stone highlight (warm light gray)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, golemColors, scale);
    this.sprites.set('golem', canvas);
  }

  private static createGhostSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Ethereal ghost with wispy tail
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,8,2,2,8,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,2,2,2,2,3,3,2,2,1,1,0],
      [0,1,2,2,3,4,3,2,2,2,2,3,4,3,2,2,1,0],
      [0,1,2,2,2,3,2,2,2,2,2,2,3,2,2,2,1,0],
      [0,0,1,2,2,2,2,2,5,5,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,5,5,5,5,2,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,5,5,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,6,6,6,1,1,6,6,6,1,0,0,0,0],
      [0,0,0,1,6,6,7,6,0,0,6,7,6,6,1,0,0,0],
      [0,0,1,6,6,7,6,0,0,0,0,6,7,6,6,1,0,0],
      [0,0,1,6,6,6,0,0,0,0,0,0,6,6,6,1,0,0],
      [0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ];

    const ghostColors = [
      'transparent',
      '#a78bfa',     // 1 - ghost outline (purple)
      '#ddd6fe',     // 2 - ethereal body pale lavender
      '#6b21a8',     // 3 - eye sockets shadow (deep purple)
      '#f5d0fe',     // 4 - eyes ethereal glow (bright pink-lavender)
      '#7c3aed',     // 5 - mouth shadow (violet)
      '#c4b5fd',     // 6 - wispy tail mid (lavender)
      '#e9d5ff',     // 7 - wispy tail highlight (pale)
      '#f5f3ff',     // 8 - body highlight (near white)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, ghostColors, scale);
    this.sprites.set('ghost', canvas);
  }

  private static createMushroomSprite() {
    const size = 42;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Poison mushroom creature
    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,8,2,8,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,2,2,2,3,3,2,2,1,1,0],
      [0,1,2,2,3,3,3,2,2,2,3,3,3,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,0,0,4,4,4,5,5,6,5,5,4,4,4,0,0,0],
      [0,0,0,4,4,5,5,7,7,7,5,5,4,4,0,0,0],
      [0,0,0,4,5,5,7,7,7,7,7,5,5,4,0,0,0],
      [0,0,0,4,5,5,7,7,7,7,7,5,5,4,0,0,0],
      [0,0,0,0,4,5,5,5,5,5,5,5,4,0,0,0,0],
      [0,0,0,0,0,4,4,4,4,4,4,4,0,0,0,0,0],
    ];

    const mushroomColors = [
      'transparent',
      '#7c2d12',     // 1 - cap outline (dark red-brown)
      '#991b1b',     // 2 - cap mid red
      '#fef3c7',     // 3 - cap spots cream
      '#78350f',     // 4 - stem outline (dark brown)
      '#92400e',     // 5 - stem shadow brown
      '#dc2626',     // 6 - cap gills red
      '#d97706',     // 7 - stem mid amber
      '#fecaca',     // 8 - cap highlight (light red)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, mushroomColors, scale);
    this.sprites.set('mushroom', canvas);
  }

  private static createGargoyleSprite() {
    const size = 60;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Stone gargoyle with wings
    const pixels = [
      [1,1,0,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1],
      [1,2,1,0,0,0,1,1,2,2,1,1,0,0,0,1,2,1],
      [0,1,2,1,0,1,1,2,2,2,2,1,1,0,1,2,1,0],
      [0,0,1,1,1,1,2,2,3,3,2,2,1,1,1,1,0,0],
      [0,0,0,1,1,2,2,3,4,4,3,2,2,1,1,0,0,0],
      [0,0,0,1,2,2,3,3,4,4,3,3,2,2,1,0,0,0],
      [0,0,1,1,2,2,3,3,3,3,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,5,5,3,3,3,3,5,5,2,2,1,1,0],
      [0,1,2,2,2,5,6,5,3,3,5,6,5,2,2,2,1,0],
      [0,0,1,2,2,2,5,5,3,3,5,5,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,2,7,7,2,2,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,7,7,7,7,2,2,1,0,0,0,0],
      [0,0,0,0,0,1,1,2,2,2,2,1,1,0,0,0,0,0],
      [0,0,0,0,1,2,2,2,0,0,2,2,2,1,0,0,0,0],
      [0,0,0,1,2,2,2,0,0,0,0,2,2,2,1,0,0,0],
      [0,0,0,1,2,2,0,0,0,0,0,0,2,2,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0],
    ];

    const gargoyleColors = [
      'transparent',
      '#292524',     // 1 - stone outline (very dark)
      '#57534e',     // 2 - stone mid gray-brown
      '#78716c',     // 3 - stone highlight
      '#a8a29e',     // 4 - horns/claws light gray
      '#dc2626',     // 5 - eyes red core
      '#fbbf24',     // 6 - eyes amber glow
      '#44403c',     // 7 - mouth shadow (dark stone)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, gargoyleColors, scale);
    this.sprites.set('gargoyle', canvas);
  }

  private static createBlobSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Toxic purple blob (bigger, more amorphous than slime)
    const pixels = [
      [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,9,2,2,2,9,2,2,2,1,1,0,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [1,1,2,2,3,3,3,2,2,2,2,3,3,3,2,2,1,1],
      [1,2,2,3,4,4,3,2,2,2,2,3,4,4,3,2,2,1],
      [1,2,3,3,4,5,4,3,2,2,3,4,5,4,3,3,2,1],
      [1,2,3,4,4,5,5,4,2,2,4,5,5,4,4,3,2,1],
      [1,2,3,4,5,5,6,5,2,2,5,6,5,5,4,3,2,1],
      [1,2,3,4,5,6,6,5,2,2,5,6,6,5,4,3,2,1],
      [1,2,3,3,4,5,5,4,2,2,4,5,5,4,3,3,2,1],
      [1,2,2,3,3,3,3,3,7,7,3,3,3,3,3,2,2,1],
      [1,2,2,2,3,3,7,7,7,7,7,7,3,3,2,2,2,1],
      [1,2,2,3,3,7,7,3,3,3,3,7,7,3,3,2,2,1],
      [0,1,2,2,3,3,3,3,8,8,3,3,3,3,2,2,1,0],
      [0,1,1,2,2,2,8,8,8,8,8,8,2,2,2,1,1,0],
      [0,0,1,1,2,2,2,8,2,2,8,2,2,2,1,1,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
    ];

    const blobColors = [
      'transparent',
      '#6b21a8',     // 1 - outline (deep purple)
      '#a855f7',     // 2 - blob mid purple
      '#c084fc',     // 3 - blob highlight
      '#d8b4fe',     // 4 - inner glow bright purple
      '#e9d5ff',     // 5 - brightest glow
      '#f5f3ff',     // 6 - core glow (near white)
      '#581c87',     // 7 - bubbles/nuclei shadow (darker purple)
      '#7c3aed',     // 8 - dither mid-tone (violet)
      '#e879f9',     // 9 - surface highlight (fuchsia tint)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, blobColors, scale);
    this.sprites.set('blob', canvas);
  }

  private static createNecroEggSprite() {
    const size = 42;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Cursed necromancer egg
    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,8,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,2,3,3,2,2,1,1,0],
      [0,1,2,2,3,3,4,3,4,3,3,2,2,1,0],
      [0,1,2,3,3,4,4,4,4,4,3,3,2,1,0],
      [1,1,2,3,4,4,5,5,5,4,4,3,2,1,1],
      [1,2,2,3,4,5,5,6,5,5,4,3,2,2,1],
      [1,2,3,3,4,5,6,6,6,5,4,3,3,2,1],
      [1,2,3,3,4,5,5,5,5,5,4,3,3,2,1],
      [1,2,3,3,3,4,4,4,4,4,3,3,3,2,1],
      [1,2,2,3,3,3,3,7,3,3,3,3,2,2,1],
      [0,1,2,2,3,3,3,3,3,3,3,2,2,1,0],
      [0,1,1,2,2,2,3,3,3,2,2,2,1,1,0],
      [0,0,1,1,2,2,2,2,2,2,2,1,1,0,0],
      [0,0,0,1,1,1,2,2,2,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    ];

    const necroeggColors = [
      'transparent',
      '#1e1b4b',     // 1 - egg outline (deep dark violet)
      '#312e81',     // 2 - egg shadow (dark indigo)
      '#4c1d95',     // 3 - egg mid purple
      '#6b21a8',     // 4 - egg highlight purple
      '#a78bfa',     // 5 - glow mid (bright purple)
      '#c4b5fd',     // 6 - glow bright (lavender)
      '#22c55e',     // 7 - cursed rune glow (eerie green)
      '#7c3aed',     // 8 - surface highlight (violet)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, necroeggColors, scale);
    this.sprites.set('necroegg', canvas);
  }

  private static createCyclopsSprite() {
    const size = 72;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // One-eyed giant cyclops
    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,9,2,2,2,9,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,2,3,3,3,3,3,3,3,2,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,3,3,3,3,3,3,2,2,2,1,0],
      [0,1,2,2,3,3,4,4,4,4,4,4,4,3,3,2,2,1,0],
      [0,1,2,2,3,4,4,4,5,5,5,4,4,4,3,2,2,1,0],
      [0,0,1,2,3,4,4,5,5,6,5,5,4,4,3,2,1,0,0],
      [0,0,0,1,3,3,4,5,6,7,6,5,4,3,3,1,0,0,0],
      [0,0,0,1,2,3,4,5,5,6,5,5,4,3,2,1,0,0,0],
      [0,0,0,0,1,2,3,4,4,4,4,4,3,2,1,0,0,0,0],
      [0,0,0,0,1,2,2,3,3,3,3,3,2,2,1,0,0,0,0],
      [0,0,0,0,0,1,2,2,8,8,8,2,2,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,8,8,8,8,8,1,1,0,0,0,0,0],
      [0,0,0,0,1,10,10,10,1,1,10,10,10,1,0,0,0,0],
      [0,0,0,1,10,10,10,0,0,0,0,10,10,10,1,0,0,0],
      [0,0,0,1,10,10,0,0,0,0,0,0,10,10,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0],
    ];

    const cyclopsColors = [
      'transparent',
      '#78350f',     // 1 - skin outline (dark warm brown)
      '#d97706',     // 2 - skin mid amber
      '#e7e5e4',     // 3 - eye white
      '#f5f5f4',     // 4 - eye bright
      '#dc2626',     // 5 - pupil red core
      '#ef4444',     // 6 - pupil red bright
      '#fbbf24',     // 7 - pupil glow center (gold)
      '#92400e',     // 8 - tusks/teeth shadow brown
      '#f59e0b',     // 9 - skin highlight (bright amber)
      '#57534e',     // 10 - fur/loincloth gray-brown
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, cyclopsColors, scale);
    this.sprites.set('cyclops', canvas);
  }

  private static createPhantomSprite() {
    const size = 54;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Dark phantom (more menacing than ghost, darker colors)
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,8,2,2,8,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,3,2,2,3,3,3,2,2,1,1,0],
      [0,1,2,2,3,3,4,3,2,2,3,4,3,3,2,2,1,0],
      [0,1,2,2,3,4,4,3,2,2,3,4,4,3,2,2,1,0],
      [0,0,1,2,2,3,3,2,2,2,2,3,3,2,2,1,0,0],
      [0,0,0,1,2,2,2,2,5,5,2,2,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,5,5,5,5,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,6,6,6,1,1,6,6,6,1,0,0,0,0],
      [0,0,0,1,6,6,7,6,1,1,6,7,6,6,1,0,0,0],
      [0,0,1,6,6,7,7,6,0,0,6,7,7,6,6,1,0,0],
      [0,0,1,6,7,7,6,6,0,0,6,6,7,7,6,1,0,0],
      [0,0,0,1,6,6,6,0,0,0,0,6,6,6,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0],
    ];

    const phantomColors = [
      'transparent',
      '#312e81',     // 1 - phantom outline (dark indigo)
      '#4f46e5',     // 2 - ethereal body mid indigo
      '#1e1b4b',     // 3 - eye sockets deep shadow
      '#818cf8',     // 4 - eyes bright indigo glow
      '#1e3a8a',     // 5 - mouth shadow (deep blue)
      '#3730a3',     // 6 - wispy cloak mid (darker than ghost)
      '#6366f1',     // 7 - wispy cloak highlight (indigo)
      '#7c3aed',     // 8 - body highlight (violet shift)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, phantomColors, scale);
    this.sprites.set('phantom', canvas);
  }

  private static createDruidSprite() {
    const size = 54;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Forest druid with leaves and staff
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,8,2,2,8,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,2,2,3,3,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,5,5,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,5,5,5,5,5,5,5,5,2,2,1,0,0],
      [0,0,0,1,2,2,5,6,6,6,6,5,2,2,1,0,0,0],
      [0,0,7,7,1,2,2,2,2,2,2,2,2,1,7,7,0,0],
      [0,7,7,7,7,1,1,1,1,1,1,1,1,7,7,7,7,0],
      [0,7,8,8,7,7,9,9,7,7,9,9,7,7,8,8,7,0],
      [0,0,7,8,8,7,9,9,0,0,9,9,7,8,8,7,0,0],
      [0,0,0,7,7,7,9,0,0,0,0,9,7,7,7,0,0,0],
      [0,0,0,0,7,7,0,0,0,0,0,0,7,7,0,0,0,0],
      [0,0,0,0,0,7,0,0,0,0,0,0,7,0,0,0,0,0],
    ];

    const druidColors = [
      'transparent',
      '#365314',     // 1 - hood outline (dark olive)
      '#d4d4d8',     // 2 - face pale (old druid)
      '#422006',     // 3 - eye shadow brown
      '#22c55e',     // 4 - eyes green nature glow
      '#78716c',     // 5 - beard shadow gray
      '#e7e5e4',     // 6 - beard white
      '#14532d',     // 7 - robes shadow (forest green)
      '#166534',     // 8 - robes mid green
      '#65a30d',     // 9 - leaf/nature accents (olive-green)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, druidColors, scale);
    this.sprites.set('druid', canvas);
  }

  private static createConstructSprite() {
    const size = 60;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Mechanical construct with gears
    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,8,2,2,8,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,3,2,2,3,3,3,2,2,1,1,0],
      [0,1,2,2,3,3,4,3,2,2,3,4,3,3,2,2,1,0],
      [0,1,2,2,3,4,4,3,2,2,3,4,4,3,2,2,1,0],
      [0,1,2,2,2,2,2,2,5,5,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,5,5,5,5,5,5,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,5,6,6,5,2,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,7,7,7,7,1,1,0,0,0,0,0],
      [0,0,0,7,7,7,7,7,1,1,7,7,7,7,7,0,0,0],
      [0,0,7,7,7,8,7,7,1,1,7,7,8,7,7,7,0,0],
      [0,7,7,7,8,8,8,7,0,0,7,8,8,8,7,7,7,0],
      [0,7,7,8,8,8,7,0,0,0,0,7,8,8,8,7,7,0],
      [0,0,7,7,7,7,0,0,0,0,0,0,7,7,7,7,0,0],
      [0,0,0,7,7,0,0,0,0,0,0,0,0,7,7,0,0,0],
    ];

    const constructColors = [
      'transparent',
      '#3f3f46',     // 1 - metal outline (dark zinc)
      '#71717a',     // 2 - metal mid gray
      '#f59e0b',     // 3 - eye core amber (machinery glow)
      '#fbbf24',     // 4 - eye bright amber
      '#52525b',     // 5 - mouth vent shadow
      '#dc2626',     // 6 - internal glow red
      '#27272a',     // 7 - body shadow (darker zinc)
      '#a1a1aa',     // 8 - metal highlight (light gray)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, constructColors, scale);
    this.sprites.set('construct', canvas);
  }

  private static createSwarmSprite() {
    const size = 36;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Insect swarm (cluster of small bugs)
    const pixels = [
      [0,0,1,0,0,0,0,1,0,0,0,1,0,0],
      [0,1,2,1,0,0,1,2,1,0,1,2,1,0],
      [0,0,1,0,0,0,0,1,0,0,0,1,0,0],
      [0,0,0,0,1,0,0,0,0,1,0,0,0,0],
      [1,0,0,1,2,1,0,0,1,2,1,0,0,1],
      [0,1,0,0,1,0,1,0,0,1,0,0,1,0],
      [0,0,1,0,0,1,2,1,0,0,0,1,0,0],
      [0,0,0,1,0,0,1,0,0,0,1,0,0,0],
      [0,1,0,0,1,0,0,0,1,0,0,0,1,0],
      [1,2,1,0,0,1,0,1,2,1,0,1,2,1],
      [0,1,0,0,0,0,1,0,1,0,0,0,1,0],
      [0,0,0,1,0,0,0,0,0,0,1,0,0,0],
    ];

    const swarmColors = [
      'transparent',
      '#78350f',     // 1 - bug outline (dark amber-brown)
      '#f59e0b',     // 2 - bug body (amber/gold)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, swarmColors, scale);
    this.sprites.set('swarm', canvas);
  }

  private static createDasherSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Fast dasher demon with motion blur effect
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,8,2,2,8,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [9,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,9],
      [9,9,1,2,2,3,4,3,2,2,3,4,3,2,2,1,9,9],
      [0,9,1,2,2,3,3,3,2,2,3,3,3,2,2,1,9,0],
      [0,0,1,2,2,2,2,2,5,5,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,5,5,5,5,5,5,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,5,5,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,6,6,6,6,1,1,0,0,0,0,0],
      [0,0,0,0,1,6,6,6,1,1,6,6,6,1,0,0,0,0],
      [0,0,0,1,6,6,7,6,0,0,6,7,6,6,1,0,0,0],
      [0,0,1,6,6,7,7,6,0,0,6,7,7,6,6,1,0,0],
      [0,0,1,6,7,7,6,0,0,0,0,6,7,7,6,1,0,0],
      [0,0,0,1,6,6,0,0,0,0,0,0,6,6,1,0,0,0],
      [0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0],
    ];

    const dasherColors = [
      'transparent',
      '#7f1d1d',     // 1 - body outline (dark crimson)
      '#dc2626',     // 2 - body mid red
      '#fbbf24',     // 3 - eyes amber core
      '#fde047',     // 4 - eyes bright glow
      '#991b1b',     // 5 - mouth shadow (darker red)
      '#dc2626',     // 6 - speed trail mid red
      '#ef4444',     // 7 - speed trail bright red
      '#f87171',     // 8 - body highlight (light red)
      '#dc2626',     // 9 - motion blur (semi-transparent effect)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, dasherColors, scale);
    this.sprites.set('dasher', canvas);
  }

  private static createEvaderSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Elusive evader with afterimage effect
    const pixels = [
      [9,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,9],
      [0,9,0,0,1,1,2,2,8,2,2,8,1,1,0,0,9,0],
      [0,0,9,1,1,2,2,2,2,2,2,2,2,1,1,9,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,2,2,3,3,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,5,5,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,5,5,5,5,5,5,5,5,2,2,1,0,0],
      [0,0,0,1,2,2,5,6,6,6,6,5,2,2,1,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,7,7,7,7,1,1,0,0,0,0,0],
      [0,0,0,0,1,7,7,7,1,1,7,7,7,1,0,0,0,0],
      [0,0,0,1,7,7,7,0,0,0,0,7,7,7,1,0,0,0],
      [0,0,1,7,7,7,0,0,0,0,0,0,7,7,7,1,0,0],
      [0,0,1,7,7,0,0,0,0,0,0,0,0,7,7,1,0,0],
      [0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
    ];

    const evaderColors = [
      'transparent',
      '#065f46',     // 1 - body outline (dark emerald)
      '#10b981',     // 2 - body mid emerald green
      '#fde047',     // 3 - eyes gold core
      '#fef08a',     // 4 - eyes bright glow
      '#047857',     // 5 - mouth shadow (darker green)
      '#6ee7b7',     // 6 - teeth/fangs (light green)
      '#10b981',     // 7 - dodge trail green
      '#6ee7b7',     // 8 - body highlight (light emerald)
      '#10b981',     // 9 - afterimage (semi-transparent effect)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, evaderColors, scale);
    this.sprites.set('evader', canvas);
  }

  private static createOrbiterSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Floating orbiter with rotating orbs around it
    const pixels = [
      [0,0,0,5,0,0,0,0,0,0,0,0,0,5,0,0,0,0],
      [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,8,2,2,1,1,0,0,0,0,0],
      [0,5,0,1,1,2,2,3,3,3,2,2,1,1,0,5,0,0],
      [0,0,0,1,2,2,3,4,3,4,3,2,2,1,0,0,0,0],
      [0,0,0,1,2,2,3,3,3,3,3,2,2,1,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,2,1,0,0,0,0],
      [0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0,0],
      [0,0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
      [0,0,0,5,0,0,0,0,0,0,0,0,0,5,0,0,0,0],
    ];

    const orbiterColors = [
      'transparent',
      '#6b21a8',     // 1 - core outline (deep purple)
      '#8b5cf6',     // 2 - core mid purple
      '#a78bfa',     // 3 - energy glow
      '#c4b5fd',     // 4 - bright energy
      '#7c3aed',     // 5 - orbiting satellites (violet)
      '#000000',     // 6 - (unused)
      '#000000',     // 7 - (unused)
      '#ddd6fe',     // 8 - core highlight (pale purple)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, orbiterColors, scale);
    this.sprites.set('orbiter', canvas);
  }

  private static createSpiralerSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Spiral pattern creature
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,8,2,2,8,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,4,4,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,4,4,5,5,4,4,3,2,2,1,1,0],
      [0,1,2,2,3,4,4,5,5,5,5,4,4,3,2,2,1,0],
      [0,1,2,2,3,4,5,5,6,6,5,5,4,3,2,2,1,0],
      [0,0,1,2,3,4,5,6,6,6,6,5,4,3,2,1,0,0],
      [0,0,0,1,3,4,5,6,7,7,6,5,4,3,1,0,0,0],
      [0,0,0,0,1,4,5,6,6,6,6,5,4,1,0,0,0,0],
      [0,0,0,0,1,3,4,5,5,5,5,4,3,1,0,0,0,0],
      [0,0,0,0,0,1,3,4,4,4,4,3,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,3,3,3,3,1,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
    ];

    const spiralerColors = [
      'transparent',
      '#164e63',     // 1 - spiral outline (dark cyan)
      '#06b6d4',     // 2 - spiral outer ring (cyan)
      '#22d3ee',     // 3 - spiral ring 2
      '#67e8f9',     // 4 - spiral ring 3
      '#a5f3fc',     // 5 - spiral ring 4 (light cyan)
      '#cffafe',     // 6 - spiral ring 5 (very light)
      '#f0fdfa',     // 7 - spiral center (near white)
      '#5eead4',     // 8 - highlight (teal tint)
    ];

    const scale = 3;
    this.drawPixels(ctx, pixels, spiralerColors, scale);
    this.sprites.set('spiraler', canvas);
  }

  private static createPlaceholderSprite(name: string, size: number, color: string) {
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Simple circle placeholder
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
    ctx.fill();

    this.sprites.set(name, canvas);
  }

  // ==================== PROJECTILES ====================
  private static createProjectileSprites() {
    // Player bullet - diamond shape with medieval blue
    const bullet = this.createCanvas(12, 12);
    const ctx = bullet.getContext('2d')!;

    ctx.fillStyle = '#3b82f6'; // Royal blue
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(12, 6);
    ctx.lineTo(6, 12);
    ctx.lineTo(0, 6);
    ctx.fill();

    ctx.fillStyle = '#93c5fd'; // Light blue highlight
    ctx.beginPath();
    ctx.moveTo(6, 2);
    ctx.lineTo(10, 6);
    ctx.lineTo(6, 10);
    ctx.lineTo(2, 6);
    ctx.fill();

    this.sprites.set('bullet', bullet);

    // Enemy projectile - crimson cross
    const enemyBullet = this.createCanvas(10, 10);
    const ctx2 = enemyBullet.getContext('2d')!;
    ctx2.fillStyle = '#dc2626'; // Crimson
    ctx2.fillRect(3, 0, 4, 10);
    ctx2.fillRect(0, 3, 10, 4);
    ctx2.fillStyle = '#f87171'; // Crimson highlight
    ctx2.fillRect(4, 2, 2, 6);
    ctx2.fillRect(2, 4, 6, 2);

    this.sprites.set('enemy_bullet', enemyBullet);
  }

  // ==================== ITEMS & PICKUPS ====================
  private static createItemSprites() {
    // Medieval-themed item icons
    const items = [
      { name: 'sword', primary: '#9ca3af', secondary: '#d4d4d4', accent: '#ffffff' }, // Silver sword
      { name: 'bow', primary: '#78716c', secondary: '#a8a29e', accent: '#eab308' }, // Wood bow with gold
      { name: 'armor', primary: '#1e3a8a', secondary: '#3b82f6', accent: '#93c5fd' }, // Royal blue armor
      { name: 'boots', primary: '#5a3825', secondary: '#8b6914', accent: '#cd853f' }, // Leather boots
      { name: 'ring', primary: '#854d0e', secondary: '#eab308', accent: '#fde047' }, // Gold ring
      { name: 'amulet', primary: '#6b21a8', secondary: '#a855f7', accent: '#e9d5ff' }, // Purple amulet
      { name: 'potion', primary: '#be123c', secondary: '#f43f5e', accent: '#fda4af' }, // Red potion
    ];

    items.forEach(item => {
      const size = 24;
      const canvas = this.createCanvas(size, size);
      const ctx = canvas.getContext('2d')!;

      // Simple icon - 8x8 pixel grid scaled 2x with medieval colors
      ctx.fillStyle = item.primary;
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = item.secondary;
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = item.accent;
      ctx.fillRect(6, 6, 4, 4);

      this.sprites.set(`item_${item.name}`, canvas);
    });
  }

  private static createPickupSprites() {
    // XP gem - emerald green
    const xp = this.createCanvas(12, 12);
    const ctx = xp.getContext('2d')!;

    const xpPixels = [
      [0,0,1,1,1,0,0],
      [0,1,2,2,2,1,0],
      [1,2,2,3,2,2,1],
      [1,2,3,3,3,2,1],
      [1,2,2,3,2,2,1],
      [0,1,2,2,2,1,0],
      [0,0,1,1,1,0,0],
    ];

    const xpColors = [
      'transparent',
      '#14532d',     // Dark forest green outline
      '#22c55e',     // Emerald mid
      '#86efac'      // Emerald highlight
    ];

    const scale = 1.7;
    this.drawPixels(ctx, xpPixels, xpColors, scale);
    this.sprites.set('xp', xp);

    // Gold coin - medieval gold
    const gold = this.createCanvas(12, 12);
    const ctx2 = gold.getContext('2d')!;

    const goldPixels = [
      [0,0,1,1,1,0,0],
      [0,1,2,2,2,1,0],
      [1,2,3,3,3,2,1],
      [1,2,3,2,3,2,1],
      [1,2,3,3,3,2,1],
      [0,1,2,2,2,1,0],
      [0,0,1,1,1,0,0],
    ];

    const goldColors = [
      'transparent',
      '#854d0e',     // Dark gold outline
      '#eab308',     // Gold mid
      '#fde047'      // Gold highlight
    ];

    this.drawPixels(ctx2, goldPixels, goldColors, scale);
    this.sprites.set('gold', gold);
  }
}
