/**
 * Pixel art sprite generator
 * Creates all game sprites as pixel art canvases
 */

export class SpriteSheet {
  private static sprites: Map<string, HTMLCanvasElement> = new Map();

  // Initialize all sprites
  static init() {
    this.createPlayerSprite();
    this.createEnemySprites();
    this.createProjectileSprites();
    this.createItemSprites();
    this.createPickupSprites();
  }

  static get(name: string): HTMLCanvasElement | null {
    return this.sprites.get(name) || null;
  }

  private static createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private static createPlayerSprite() {
    const size = 66;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Player - detailed knight with HUE-SHIFTED color ramps, dithering, and rim lighting
    const pixels = [
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

    const colors = [
      'transparent',  // 0
      '#c79b6d',      // 1 - skin outline (colored, not black)
      '#8b7355',      // 2 - skin base
      '#654321',      // 3 - eye pupils
      '#e8e8e8',      // 4 - helmet silver highlight
      '#9a9a9a',      // 5 - helmet mid (hue-shifted cooler)
      '#2b5a8a',      // 6 - armor blue shadow (hue-shifted toward purple-blue)
      '#6db3f2',      // 7 - armor blue mid
      '#ffffff',      // 8 - armor rim light (warm highlight)
      '#5a0a0a',      // 9 - cape deep shadow (hue-shifted toward purple-red)
      '#b22222',      // 10 - cape mid red
      '#ff6347',      // 11 - cape warm highlight
      '#e5c29d',      // 12 - skin highlight (warm shift)
      '#ffd700',      // 13 - helmet gold accent (warm rim light)
      '#4a90e2',      // 14 - armor light edge (rim lighting)
      '#c44545',      // 15 - cape dithering mid-tone
      '#8b3a3a',      // 16 - cape outline (colored, not black)
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    // Add subtle glow effect around player (rim lighting shader simulation)
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)'; // Golden rim glow
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    this.sprites.set('player', canvas);
  }

  private static createEnemySprites() {
    // Slime enemy
    this.createSlimeSprite();
    // Goblin enemy
    this.createGoblinSprite();
    // Skeleton enemy
    this.createSkeletonSprite();
    // Demon boss
    this.createDemonSprite();
    // Imp enemy
    this.createImpSprite();
    // Orc enemy
    this.createOrcSprite();
    // Wraith enemy
    this.createWraithSprite();
    // Necromancer enemy
    this.createNecromancerSprite();
    // Troll enemy
    this.createTrollSprite();
    // Banshee enemy
    this.createBansheeSprite();
    // New enemies
    this.createBatSprite();
    this.createWizardSprite();
    this.createMimicSprite();
    this.createSpiderSprite();
    this.createGolemSprite();
    // Wave 2 new enemies
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
  }

  private static createSlimeSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Advanced slime: hue-shifted shadows (toward blue), clustered dithering, translucent glow
    const pixels = [
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

    const colors = [
      'transparent',
      '#22c55e',     // 1 - outline (colored, not black)
      '#4ade80',     // 2 - slime mid green
      '#86efac',     // 3 - slime highlight (warm shift toward yellow-green)
      '#ffffff',     // 4 - eyes white core
      '#f0f0f0',     // 5 - eyes light
      '#e0e0e0',     // 6 - top shine (warm)
      '#10b981',     // 7 - nucleus darker green
      '#0d7a52',     // 8 - shadow (hue-shifted toward blue-green, cooler)
      '#66d99d',     // 9 - dithering mid-tone (clustered pattern for organic feel)
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    // Add translucent glow (slime glows slightly)
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(134, 239, 172, 0.2)'; // Subtle green glow
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    this.sprites.set('slime', canvas);
  }

  private static createGoblinSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Advanced goblin: hue-shifted shadows, colored outlines, menacing red eye glow
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

    const colors = [
      'transparent',
      '#476b24',     // 1 - outline (colored, hue-shifted darker green)
      '#7cb342',     // 2 - skin mid green
      '#ffeb3b',     // 3 - eyes yellow core
      '#d32f2f',     // 4 - eyes red evil glow (rim light)
      '#8b4513',     // 5 - nose/mouth brown
      '#f5f5dc',     // 6 - sharp teeth beige
      '#2a2a2a',     // 7 - armor shadow (hue-shifted toward cool blue-gray)
      '#696969',     // 8 - armor mid
      '#a8a8a8',     // 9 - dagger blade highlight
      '#654321',     // 10 - dagger handle
      '#96d15f',     // 11 - skin highlight (warm shift toward yellow-green)
      '#3a3a3a',     // 12 - armor edge (colored outline)
      '#4a4a4a',     // 13 - armor dither mid-tone
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    // Evil eye glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(211, 47, 47, 0.25)'; // Red menacing glow
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    this.sprites.set('goblin', canvas);
  }

  private static createSkeletonSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Advanced skeleton: hue-shifted bone (warm highlights, cool shadows), intense eye glow
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

    const colors = [
      'transparent',
      '#9a9a9a',     // 1 - bone shadow (hue-shifted toward cool blue-gray)
      '#e0e0e0',     // 2 - bone white mid
      '#1a1a1a',     // 3 - eye socket deep shadow (not pure black)
      '#00ff00',     // 4 - eerie green glow (bright rim light in eyes)
      '#6b1010',     // 5 - mouth shadow (hue-shifted dark red-purple)
      '#ff0000',     // 6 - throat glow core
      '#faf8e8',     // 7 - bone highlight (warm shift toward yellow-white)
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    // Intense eerie glow from eyes
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'; // Strong green undead glow
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';

    this.sprites.set('skeleton', canvas);
  }

  private static createDemonSprite() {
    const size = 72;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed demon boss with massive horns, glowing eyes/mouth, armor/scales, wings
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

    const colors = [
      'transparent',
      '#ffd700',     // 1 - horns gold outer
      '#ffaa00',     // 2 - horns gold middle
      '#ff8c00',     // 3 - horns orange core
      '#8b0000',     // 4 - body dark red demonic
      '#ff0000',     // 5 - eyes red fierce
      '#ffff00',     // 6 - eyes yellow glow center
      '#000000',     // 7 - mouth/fangs darkness
      '#ff4500',     // 8 - mouth inner fire glow
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('demon', canvas);
  }

  private static createProjectileSprites() {
    // Player bullet
    const bullet = this.createCanvas(12, 12);
    const ctx = bullet.getContext('2d')!;

    // Diamond shaped bullet
    ctx.fillStyle = '#60a5fa';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(12, 6);
    ctx.lineTo(6, 12);
    ctx.lineTo(0, 6);
    ctx.fill();

    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    ctx.moveTo(6, 2);
    ctx.lineTo(10, 6);
    ctx.lineTo(6, 10);
    ctx.lineTo(2, 6);
    ctx.fill();

    this.sprites.set('bullet', bullet);

    // Enemy projectile
    const enemyBullet = this.createCanvas(10, 10);
    const ctx2 = enemyBullet.getContext('2d')!;
    ctx2.fillStyle = '#ef4444';
    ctx2.fillRect(3, 0, 4, 10);
    ctx2.fillRect(0, 3, 10, 4);
    ctx2.fillStyle = '#fca5a5';
    ctx2.fillRect(4, 2, 2, 6);
    ctx2.fillRect(2, 4, 6, 2);

    this.sprites.set('enemy_bullet', enemyBullet);
  }

  private static createItemSprites() {
    // Create pixel art for each item type
    const items = [
      { name: 'sword', color: '#c0c0c0', accent: '#ffffff' },
      { name: 'bow', color: '#8b4513', accent: '#daa520' },
      { name: 'armor', color: '#4169e1', accent: '#87ceeb' },
      { name: 'boots', color: '#654321', accent: '#8b6914' },
      { name: 'ring', color: '#ffd700', accent: '#ffed4e' },
      { name: 'amulet', color: '#9370db', accent: '#ba55d3' },
      { name: 'potion', color: '#ff1493', accent: '#ff69b4' },
    ];

    items.forEach(item => {
      const size = 24;
      const canvas = this.createCanvas(size, size);
      const ctx = canvas.getContext('2d')!;

      // Simple icon - 8x8 pixel grid scaled 2x
      ctx.fillStyle = item.color;
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = item.accent;
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = item.color;
      ctx.fillRect(6, 6, 4, 4);

      this.sprites.set(`item_${item.name}`, canvas);
    });
  }

  private static createPickupSprites() {
    // XP gem
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

    const xpColors = ['transparent', '#4ade80', '#86efac', '#dcfce7'];
    const scale = 1.7;

    xpPixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = xpColors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('xp', xp);

    // Gold coin
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

    const goldColors = ['transparent', '#b8860b', '#ffd700', '#ffed4e'];

    goldPixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx2.fillStyle = goldColors[pixel];
          ctx2.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('gold', gold);
  }

  private static createImpSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed imp with bat wings, sharp horns, and mischievous grin
    const pixels = [
      [0,7,7,0,0,1,1,1,1,1,1,1,1,0,0,7,7,0],
      [7,7,7,7,0,1,2,2,1,1,2,2,1,0,7,7,7,7],
      [7,8,8,7,1,1,2,2,1,1,2,2,1,1,7,8,8,7],
      [0,7,7,0,1,2,2,3,2,2,2,3,2,1,0,7,7,0],
      [0,0,0,1,1,2,3,3,2,2,3,3,2,1,1,0,0,0],
      [0,0,0,1,1,1,2,2,1,1,2,2,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,4,4,1,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,0],
      [0,0,0,0,1,4,4,5,4,4,5,4,4,1,0,0,0,0],
      [0,0,0,1,4,4,5,5,4,4,5,5,4,4,1,0,0,0],
      [0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0],
      [0,0,1,4,4,4,6,6,6,6,6,6,4,4,4,1,0,0],
      [0,0,0,1,4,4,4,6,6,6,6,4,4,4,1,0,0,0],
      [0,0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0,0],
      [0,0,0,0,0,1,1,4,4,4,4,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#ff8c00',     // 1 - horns orange
      '#ff0000',     // 2 - eyes red
      '#ffff00',     // 3 - eye glow yellow
      '#8b0000',     // 4 - body dark red
      '#ff4500',     // 5 - body highlights
      '#000000',     // 6 - mouth/grin
      '#4b0082',     // 7 - wings purple/dark
      '#6a0dad',     // 8 - wing membrane
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('imp', canvas);
  }

  private static createOrcSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed orc with heavy armor plates, large tusks, and battle scars
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,3,3,2,2,2,2,3,3,2,1,1,0,0],
      [0,1,1,2,2,3,3,2,2,2,2,3,3,2,2,1,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,1,2,2,4,4,4,4,4,4,4,4,4,4,2,2,1,0],
      [0,0,1,2,4,4,4,4,4,4,4,4,4,4,2,1,0,0],
      [0,0,1,1,2,4,4,5,5,5,5,4,4,2,1,1,0,0],
      [0,0,0,1,1,2,4,4,5,5,4,4,2,1,1,0,0,0],
      [0,0,6,6,1,1,2,2,2,2,2,2,1,1,6,6,0,0],
      [0,6,6,7,7,6,1,1,1,1,1,1,6,7,7,6,6,0],
      [0,6,7,7,7,7,6,6,6,6,6,6,7,7,7,7,6,0],
      [0,6,7,8,8,7,6,0,0,0,0,6,7,8,8,7,6,0],
      [0,0,6,7,7,6,0,0,0,0,0,0,6,7,7,6,0,0],
      [0,0,0,6,6,0,0,0,0,0,0,0,0,6,6,0,0,0],
    ];

    const colors = [
      'transparent',
      '#3d5a3d',     // 1 - dark green outline
      '#567d46',     // 2 - green skin base
      '#000000',     // 3 - eyes/scars
      '#f5f5dc',     // 4 - tusks beige
      '#fffacd',     // 5 - tusk highlight
      '#696969',     // 6 - heavy armor gray
      '#808080',     // 7 - armor plates light
      '#a9a9a9',     // 8 - armor highlight
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('orc', canvas);
  }

  private static createWraithSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed wraith with flowing wispy edges, eerie glow, and spectral chains
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0,0],
      [0,0,1,2,2,3,3,3,2,2,3,3,3,2,2,1,0,0],
      [0,1,2,2,3,3,4,3,2,2,3,4,3,3,2,2,1,0],
      [0,1,2,2,3,4,4,3,2,2,3,4,4,3,2,2,1,0],
      [0,1,2,2,2,3,3,2,2,2,2,3,3,2,2,2,1,0],
      [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
      [0,0,1,1,2,2,5,5,5,5,5,5,2,2,1,1,0,0],
      [0,0,0,1,2,2,2,5,5,5,5,2,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,2,5,5,2,2,2,1,0,0,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,1,2,2,1,1,6,0,0,6,1,1,2,2,1,0,0],
      [0,1,2,2,2,1,0,0,0,0,0,0,1,2,2,2,1,0],
      [0,1,2,1,1,0,0,0,0,0,0,0,0,1,1,2,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    ];

    const colors = [
      'transparent',
      '#6a4c93',     // 1 - dark purple outline
      '#9370db',     // 2 - ghostly purple base
      '#000000',     // 3 - eye sockets darkness
      '#4b0082',     // 4 - indigo eye glow
      '#8b008b',     // 5 - dark magenta mouth
      '#c0c0c0',     // 6 - spectral chains
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('wraith', canvas);
  }

  private static createNecromancerSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed necromancer with dark robes, glowing runes, and staff
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
      [0,1,2,2,3,3,3,2,2,2,2,3,3,3,2,2,1,0],
      [0,1,2,2,3,4,3,2,2,2,2,3,4,3,2,2,1,0],
      [0,0,1,2,2,3,3,2,2,2,2,3,3,2,2,1,0,0],
      [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,5,5,5,5,5,5,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,5,5,5,5,2,2,1,0,0,0,0],
      [0,0,6,6,1,1,2,2,2,2,2,2,1,1,6,6,0,0],
      [0,6,6,7,7,6,1,1,1,1,1,1,6,7,7,6,6,0],
      [0,6,7,8,7,7,6,6,6,6,6,6,7,7,8,7,6,0],
      [0,6,7,7,7,6,6,9,6,6,9,6,6,7,7,7,6,0],
      [0,0,6,7,7,6,0,0,0,0,0,0,6,7,7,6,0,0],
      [0,0,0,6,6,0,0,0,0,0,0,0,0,6,6,0,0,0],
      [0,10,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [10,10,11,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [10,11,11,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#000000',     // 1 - hood outline black
      '#2c2c54',     // 2 - hood/face dark purple
      '#ffffff',     // 3 - eyes white
      '#00ff00',     // 4 - eye glow green necromantic
      '#8b0000',     // 5 - mouth dark red
      '#1a1a2e',     // 6 - robe body dark
      '#474787',     // 7 - robe purple
      '#9370db',     // 8 - robe highlight/runes
      '#00ffff',     // 9 - glowing runes cyan
      '#654321',     // 10 - staff wood brown
      '#ff8c00',     // 11 - staff crystal orange
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('necromancer', canvas);
  }

  private static createTrollSprite() {
    const size = 72;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed massive troll with moss, huge hands/claws, brutish posture
    const pixels = [
      [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,2,2,1,1,1,1,2,2,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,2,2,3,2,1,1,2,3,2,2,1,1,1,0,0,0],
      [0,0,1,1,1,2,2,3,3,2,1,1,2,3,3,2,2,1,1,1,0,0],
      [0,0,1,1,1,1,2,2,2,1,1,1,1,2,2,2,1,1,1,1,0,0],
      [0,0,1,1,1,1,1,1,1,4,4,4,4,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,4,4,4,4,4,4,4,4,4,4,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,4,4,4,4,4,4,4,4,1,1,1,0,0,0,0],
      [0,0,0,5,5,1,1,1,4,5,5,5,5,4,1,1,1,5,5,0,0,0],
      [0,0,5,5,5,5,1,1,1,1,1,1,1,1,1,1,5,5,5,5,0,0],
      [0,5,5,6,6,5,5,1,1,1,1,1,1,1,1,5,5,6,6,5,5,0],
      [0,5,6,6,7,6,5,5,5,5,5,5,5,5,5,5,6,7,6,6,5,0],
      [0,5,6,7,7,6,5,5,5,5,5,5,5,5,5,5,6,7,7,6,5,0],
      [0,0,5,6,6,5,5,8,8,5,5,5,5,8,8,5,5,6,6,5,0,0],
      [0,0,0,5,5,5,8,8,8,8,0,0,8,8,8,8,5,5,5,0,0,0],
      [0,0,0,0,5,5,5,8,8,0,0,0,0,8,8,5,5,5,0,0,0,0],
      [0,0,0,0,0,5,5,5,0,0,0,0,0,0,5,5,5,0,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#4a7c59',     // 1 - green skin with moss
      '#ff0000',     // 2 - red eyes fierce
      '#ffff00',     // 3 - eye glow
      '#f5f5dc',     // 4 - large tusks beige
      '#5f4c3b',     // 5 - brown ragged clothing
      '#7d6b5a',     // 6 - clothing lighter
      '#3d2f24',     // 7 - clothing patches dark
      '#2e4d2e',     // 8 - moss/vegetation on body
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('troll', canvas);
  }

  private static createBansheeSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed banshee with long flowing hair, screaming expression, ethereal effect
    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [0,1,2,2,3,3,3,2,2,2,2,3,3,3,2,2,1,0],
      [0,1,2,2,3,4,3,2,2,2,2,3,4,3,2,2,1,0],
      [0,1,2,2,3,3,3,2,2,2,2,3,3,3,2,2,1,0],
      [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
      [0,0,1,2,2,2,5,5,5,5,5,5,2,2,2,1,0,0],
      [0,0,0,1,2,2,5,5,5,5,5,5,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,5,5,5,5,2,2,1,0,0,0,0],
      [0,0,0,0,0,1,2,2,5,5,2,2,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,1,2,2,1,1,0,0,1,1,2,2,1,0,0,0],
      [0,0,1,2,2,2,1,0,0,0,0,1,2,2,2,1,0,0],
      [0,1,2,2,1,1,0,0,0,0,0,0,1,1,2,2,1,0],
      [0,1,2,1,0,0,0,0,0,0,0,0,0,0,1,2,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    ];

    const colors = [
      'transparent',
      '#c0c0c0',     // 1 - ghostly outline silver
      '#e0e0e0',     // 2 - ghostly white/pale
      '#000000',     // 3 - eyes darkness
      '#00ffff',     // 4 - eye glow cyan ethereal
      '#8b0000',     // 5 - mouth screaming dark red
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('banshee', canvas);
  }

  private static createBatSprite() {
    const size = 36;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed bat with spread wings, small body, sharp ears
    const pixels = [
      [0,1,1,0,0,0,0,0,0,0,0,1,1,0],
      [1,1,2,1,0,0,0,0,0,0,1,2,1,1],
      [1,2,2,2,1,0,3,3,0,1,2,2,2,1],
      [0,1,2,2,1,3,3,3,3,1,2,2,1,0],
      [0,0,1,2,3,3,4,4,3,3,2,1,0,0],
      [0,0,0,1,3,4,4,4,4,3,1,0,0,0],
      [0,0,0,1,1,3,3,3,3,1,1,0,0,0],
      [0,0,1,2,2,1,1,1,1,2,2,1,0,0],
      [0,1,2,2,1,0,0,0,0,1,2,2,1,0],
      [1,2,2,1,0,0,0,0,0,0,1,2,2,1],
    ];

    const colors = [
      'transparent',
      '#4a235a',     // 1 - wing dark purple
      '#6a3d7c',     // 2 - wing membrane lighter
      '#2c1b3d',     // 3 - body/head dark
      '#ff0000',     // 4 - eyes red
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('bat', canvas);
  }

  private static createWizardSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed wizard with pointed hat, long beard, staff with crystal
    const pixels = [
      [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,0,1,1,2,2,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,2,3,3,3,3,2,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,3,3,3,2,2,2,1,0],
      [0,1,2,2,3,3,4,3,3,4,3,3,2,2,1,0],
      [0,0,1,2,2,3,3,3,3,3,3,2,2,1,0,0],
      [0,0,0,1,2,2,3,3,3,3,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,5,5,2,2,1,0,0,0,0],
      [0,5,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
      [5,5,5,0,0,0,1,1,1,1,0,0,0,0,0,0],
      [5,6,5,0,0,0,0,1,1,0,0,0,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#1f618d',     // 1 - hat/robe blue
      '#2980b9',     // 2 - robe lighter blue
      '#ecf0f1',     // 3 - face/beard white
      '#34495e',     // 4 - eyes dark
      '#8b4513',     // 5 - staff brown
      '#9b59b6',     // 6 - staff crystal purple
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('wizard', canvas);
  }

  private static createMimicSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed mimic chest with teeth, eye, and coin bait
    const pixels = [
      [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [1,1,2,2,3,3,3,3,3,3,3,3,2,2,1,1],
      [1,2,2,3,3,3,3,3,3,3,3,3,3,2,2,1],
      [1,2,3,3,4,4,4,4,4,4,4,4,3,3,2,1],
      [1,2,3,4,4,5,5,5,5,5,5,4,4,3,2,1],
      [1,2,3,4,4,4,4,4,4,4,4,4,4,3,2,1],
      [1,2,3,3,6,6,6,6,6,6,6,6,3,3,2,1],
      [1,2,2,3,6,7,6,6,6,6,7,6,3,2,2,1],
      [1,1,2,2,6,7,7,6,6,7,7,6,2,2,1,1],
      [0,1,1,2,2,6,6,6,6,6,6,2,2,1,1,0],
      [0,0,1,1,2,2,8,8,8,8,2,2,1,1,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
    ];

    const colors = [
      'transparent',
      '#654321',     // 1 - chest wood dark
      '#8b6914',     // 2 - chest wood medium
      '#daa520',     // 3 - chest trim gold
      '#1a1a1a',     // 4 - mouth/darkness
      '#ff0000',     // 5 - throat red
      '#ffffff',     // 6 - teeth white
      '#ffe135',     // 7 - coin bait gold
      '#8b0000',     // 8 - tongue
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('mimic', canvas);
  }

  private static createSpiderSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed spider with 8 legs, multiple eyes, hairy body
    const pixels = [
      [1,1,0,0,0,0,0,0,0,0,0,0,1,1],
      [0,1,1,0,0,0,0,0,0,0,0,1,1,0],
      [0,0,1,1,0,2,2,2,2,0,1,1,0,0],
      [0,0,0,1,2,2,2,2,2,2,1,0,0,0],
      [0,0,0,2,2,3,2,2,3,2,2,0,0,0],
      [0,0,2,2,2,3,2,2,3,2,2,2,0,0],
      [0,0,2,2,2,2,2,2,2,2,2,2,0,0],
      [0,2,2,4,2,2,2,2,2,2,4,2,2,0],
      [0,2,2,4,2,2,2,2,2,2,4,2,2,0],
      [0,0,2,2,2,2,2,2,2,2,2,2,0,0],
      [0,0,0,2,2,2,2,2,2,2,2,0,0,0],
      [0,0,1,1,0,2,2,2,2,0,1,1,0,0],
      [0,1,1,0,0,0,0,0,0,0,0,1,1,0],
      [1,1,0,0,0,0,0,0,0,0,0,0,1,1],
    ];

    const colors = [
      'transparent',
      '#1c1c1c',     // 1 - legs dark gray/black
      '#2c2c2c',     // 2 - body dark
      '#ff0000',     // 3 - eyes red
      '#4a4a4a',     // 4 - body markings
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('spider', canvas);
  }

  private static createGolemSprite() {
    const size = 72;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Detailed massive stone golem with cracks, glowing core, heavy build
    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,3,2,2,2,2,3,3,3,2,2,1,1,0],
      [0,1,2,2,2,3,4,3,2,2,2,2,3,4,3,2,2,2,1,0],
      [0,1,2,2,2,3,3,3,2,2,2,2,3,3,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,5,5,2,2,2,2,2,2,2,1,0],
      [1,1,2,2,2,2,2,2,5,5,5,5,2,2,2,2,2,2,1,1],
      [1,2,2,2,6,6,2,2,2,5,5,2,2,2,6,6,2,2,2,1],
      [1,2,2,6,6,6,6,2,2,2,2,2,2,6,6,6,6,2,2,1],
      [1,2,2,2,6,6,2,2,2,2,2,2,2,2,6,6,2,2,2,1],
      [1,2,2,2,2,2,2,2,7,7,7,7,2,2,2,2,2,2,2,1],
      [1,1,2,2,2,2,2,7,7,7,7,7,7,2,2,2,2,2,1,1],
      [0,1,2,2,2,2,2,2,7,7,7,7,2,2,2,2,2,2,1,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [0,0,1,1,2,2,2,8,8,0,0,8,8,2,2,2,1,1,0,0],
      [0,0,0,1,1,2,8,8,8,0,0,8,8,8,2,1,1,0,0,0],
      [0,0,0,0,1,1,1,8,0,0,0,0,8,1,1,1,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#546e7a',     // 1 - stone dark edges
      '#78909c',     // 2 - stone body gray
      '#000000',     // 3 - eyes darkness
      '#ff6f00',     // 4 - eye glow orange
      '#ff9800',     // 5 - chest core glow
      '#3d3d3d',     // 6 - cracks dark
      '#2c2c2c',     // 7 - body cracks
      '#607d8b',     // 8 - legs/feet stone
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('golem', canvas);
  }

  private static createGhostSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Translucent ghost with flowing ethereal form
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,2,2,3,3,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,5,5,5,5,5,5,2,2,2,1,0,0],
      [0,0,1,2,2,2,2,5,5,5,5,2,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,2,5,5,2,2,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,1,2,2,1,1,1,0,0,1,1,1,2,2,1,0,0],
      [0,1,2,2,2,1,0,0,0,0,0,0,1,2,2,2,1,0],
      [0,1,2,1,1,0,0,0,0,0,0,0,0,1,1,2,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
    ];

    const colors = [
      'transparent',
      '#b0e0e6',     // 1 - ghost outline light cyan
      '#e0f7fa',     // 2 - ghost body pale cyan
      '#000000',     // 3 - eye sockets
      '#00ffff',     // 4 - eye glow cyan
      '#add8e6',     // 5 - mouth/ethereal wisp
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('ghost', canvas);
  }

  private static createMushroomSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Poisonous mushroom with spots
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,1,1,2,2,2,3,2,2,3,2,2,2,1,1,0,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [0,1,2,2,3,2,2,2,4,2,2,2,2,3,2,2,1,0],
      [0,1,2,2,2,2,2,4,4,4,2,2,2,2,2,2,1,0],
      [1,1,2,2,2,2,2,2,4,2,2,2,2,2,2,2,1,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,0,0,0,5,5,5,5,5,5,5,5,0,0,0,0,0],
      [0,0,0,0,0,5,6,6,6,6,6,6,5,0,0,0,0,0],
      [0,0,0,0,0,5,6,6,6,6,6,6,5,0,0,0,0,0],
      [0,0,0,0,0,5,6,6,6,6,6,6,5,0,0,0,0,0],
      [0,0,0,0,0,5,5,5,5,5,5,5,5,0,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#6b2c91',     // 1 - cap outline purple
      '#8e44ad',     // 2 - cap purple
      '#ffffff',     // 3 - white spots
      '#d7bde2',     // 4 - light purple spots
      '#654321',     // 5 - stem outline brown
      '#8b7355',     // 6 - stem beige
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('mushroom', canvas);
  }

  private static createGargoyleSprite() {
    const size = 56;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Stone gargoyle with wings
    const pixels = [
      [0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0],
      [1,1,2,1,0,0,0,0,0,0,0,0,1,2,1,1],
      [1,2,2,2,1,0,0,3,3,0,0,1,2,2,2,1],
      [0,1,2,2,1,3,3,3,3,3,3,1,2,2,1,0],
      [0,0,1,2,3,3,4,3,3,4,3,3,2,1,0,0],
      [0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0],
      [0,0,0,1,3,3,3,5,5,3,3,3,1,0,0,0],
      [0,0,0,1,3,3,5,5,5,5,3,3,1,0,0,0],
      [0,0,0,1,1,3,3,5,5,3,3,1,1,0,0,0],
      [0,0,1,2,1,1,3,3,3,3,1,1,2,1,0,0],
      [0,1,2,2,2,1,1,1,1,1,1,2,2,2,1,0],
      [0,1,2,2,2,2,1,0,0,1,2,2,2,2,1,0],
      [0,0,1,2,2,2,1,0,0,1,2,2,2,1,0,0],
      [0,0,0,1,2,1,0,0,0,0,1,2,1,0,0,0],
    ];

    const colors = [
      'transparent',
      '#37474f',     // 1 - stone outline dark
      '#5d6d7e',     // 2 - wing/body stone gray
      '#78909c',     // 3 - body lighter gray
      '#000000',     // 4 - eyes darkness
      '#2c3e50',     // 5 - mouth/fangs
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('gargoyle', canvas);
  }

  private static createBlobSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Amorphous blob
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,2,3,3,2,2,3,3,2,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,2,2,3,3,3,2,2,2,1,0],
      [1,1,2,2,2,2,3,3,2,2,3,3,2,2,2,2,1,1],
      [1,2,2,2,2,2,2,2,4,4,2,2,2,2,2,2,2,1],
      [1,2,2,2,2,2,2,4,4,4,4,2,2,2,2,2,2,1],
      [1,2,2,2,2,2,2,2,4,4,2,2,2,2,2,2,2,1],
      [1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#c0392b',     // 1 - blob outline dark red
      '#e74c3c',     // 2 - blob body red
      '#000000',     // 3 - eyes
      '#d68910',     // 4 - nucleus/core
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('blob', canvas);
  }

  private static createNecroEggSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Dark egg with necromantic runes
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,2,2,3,2,2,3,2,2,2,2,1,1,0],
      [0,1,2,2,2,2,3,3,3,3,3,3,2,2,2,2,1,0],
      [1,1,2,2,2,2,2,3,3,3,3,2,2,2,2,2,1,1],
      [1,2,2,2,2,2,2,2,3,3,2,2,2,2,2,2,2,1],
      [1,2,2,4,2,2,2,2,2,2,2,2,2,4,2,2,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,2,2,4,4,2,2,2,2,2,2,4,4,2,2,2,1],
      [1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#5a0a0a',     // 1 - egg outline dark red
      '#8b0000',     // 2 - egg body dark red
      '#00ff00',     // 3 - necromantic glow green
      '#006400',     // 4 - darker runes
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('necroegg', canvas);
  }

  private static createCyclopsSprite() {
    const size = 60;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Large cyclops with one eye
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,0],
      [0,1,1,2,2,2,2,3,3,3,3,2,2,2,2,1,1,0],
      [0,1,2,2,2,2,3,3,3,3,3,3,2,2,2,2,1,0],
      [0,1,2,2,2,3,3,4,4,4,4,3,3,2,2,2,1,0],
      [0,1,2,2,2,3,4,4,5,5,4,4,3,2,2,2,1,0],
      [0,1,2,2,2,3,4,5,5,5,5,4,3,2,2,2,1,0],
      [0,1,2,2,2,3,4,4,5,5,4,4,3,2,2,2,1,0],
      [0,1,2,2,2,3,3,4,4,4,4,3,3,2,2,2,1,0],
      [0,0,1,2,2,2,3,3,3,3,3,3,2,2,2,1,0,0],
      [0,0,1,1,2,2,2,6,6,6,6,2,2,2,1,1,0,0],
      [0,0,0,1,2,2,2,2,6,6,2,2,2,2,1,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,0,0,1,1,1,2,2,2,2,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#9c6b20',     // 1 - skin outline brown
      '#d68910',     // 2 - skin tan
      '#000000',     // 3 - eye socket darkness
      '#ffffff',     // 4 - eye white
      '#ff0000',     // 5 - pupil red
      '#654321',     // 6 - mouth/teeth brown
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('cyclops', canvas);
  }

  private static createPhantomSprite() {
    const size = 42;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Wispy phantom (similar to ghost but darker purple)
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,3,3,3,2,2,3,3,3,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,2,2,3,3,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,2,5,5,5,5,5,5,2,2,2,1,0,0],
      [0,0,0,1,2,2,2,2,5,5,2,2,2,2,1,0,0,0],
      [0,0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0,0],
      [0,0,0,1,1,1,2,2,2,2,2,2,1,1,1,0,0,0],
      [0,0,1,2,2,1,1,0,0,0,0,1,1,2,2,1,0,0],
      [0,1,2,2,1,0,0,0,0,0,0,0,0,1,2,2,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
    ];

    const colors = [
      'transparent',
      '#7d3c98',     // 1 - phantom outline purple
      '#a569bd',     // 2 - phantom body light purple
      '#000000',     // 3 - eyes darkness
      '#8e44ad',     // 4 - eye glow purple
      '#6c3483',     // 5 - mouth wisp
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('phantom', canvas);
  }

  private static createDruidSprite() {
    const size = 48;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Nature druid with leaf motif
    const pixels = [
      [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
      [0,0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,3,3,2,2,3,3,3,2,2,1,1,0],
      [0,1,2,2,2,2,3,3,2,2,3,3,2,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
      [0,0,1,2,2,4,4,4,4,4,4,4,4,2,2,1,0,0],
      [0,0,0,1,2,2,4,4,4,4,4,4,2,2,1,0,0,0],
      [0,0,5,5,1,2,2,2,2,2,2,2,2,1,5,5,0,0],
      [0,5,5,6,6,1,1,1,1,1,1,1,1,6,6,5,5,0],
      [0,5,6,6,6,5,5,5,7,7,5,5,5,6,6,6,5,0],
      [0,5,6,6,6,5,0,0,0,0,0,0,5,6,6,6,5,0],
      [0,0,5,6,5,0,0,0,0,0,0,0,0,5,6,5,0,0],
      [0,0,0,5,0,0,0,0,0,0,0,0,0,0,5,0,0,0],
    ];

    const colors = [
      'transparent',
      '#1e8449',     // 1 - hood outline green
      '#27ae60',     // 2 - face/hood green
      '#654321',     // 3 - eyes brown
      '#8b4513',     // 4 - beard brown
      '#145a32',     // 5 - robe dark green
      '#27ae60',     // 6 - robe light green
      '#f1c40f',     // 7 - golden leaves/nature magic
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('druid', canvas);
  }

  private static createConstructSprite() {
    const size = 52;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Mechanical construct
    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0],
      [0,0,1,1,2,2,3,3,2,2,3,3,2,2,1,1,0,0],
      [0,1,1,2,2,3,4,3,2,2,3,4,3,2,2,1,1,0],
      [0,1,2,2,2,3,3,3,2,2,3,3,3,2,2,2,1,0],
      [0,1,2,2,2,2,2,2,5,5,2,2,2,2,2,2,1,0],
      [1,1,2,2,2,2,2,5,5,5,5,2,2,2,2,2,1,1],
      [1,2,2,2,2,2,2,2,5,5,2,2,2,2,2,2,2,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,2,6,6,2,2,2,2,2,2,2,2,6,6,2,2,1],
      [1,1,2,6,6,6,2,2,2,2,2,2,6,6,6,2,1,1],
      [0,1,2,2,6,6,2,2,2,2,2,2,6,6,2,2,1,0],
      [0,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,0],
      [0,0,1,1,2,2,2,7,7,7,7,2,2,2,1,1,0,0],
      [0,0,0,1,1,2,7,7,7,7,7,7,2,1,1,0,0,0],
      [0,0,0,0,1,1,1,7,7,7,7,1,1,1,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#616161',     // 1 - construct outline dark
      '#95a5a6',     // 2 - body gray metal
      '#000000',     // 3 - eyes darkness
      '#3498db',     // 4 - eye glow blue
      '#e67e22',     // 5 - core glow orange
      '#5d6d7e',     // 6 - armor plates
      '#34495e',     // 7 - legs/feet dark
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('construct', canvas);
  }

  private static createSwarmSprite() {
    const size = 30;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Small swarm creature (like a hornet/wasp)
    const pixels = [
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,1,0,0],
      [0,1,1,2,2,2,2,1,1,0],
      [1,1,2,2,3,3,2,2,1,1],
      [1,2,2,2,2,2,2,2,2,1],
      [1,2,2,4,2,2,4,2,2,1],
      [1,1,2,2,2,2,2,2,1,1],
      [0,1,1,2,2,2,2,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
    ];

    const colors = [
      'transparent',
      '#d68910',     // 1 - outline gold
      '#f39c12',     // 2 - body gold/yellow
      '#000000',     // 3 - eyes
      '#c0392b',     // 4 - red stripes
    ];

    const scale = 3;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('swarm', canvas);
  }
}

