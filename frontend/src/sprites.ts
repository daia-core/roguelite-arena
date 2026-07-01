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
    const size = 32;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    // Player - a knight/warrior pixel art
    const pixels = [
      [0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,2,2,1,1,2,2,1,1,1,0,0,0],
      [0,0,1,1,1,2,2,2,1,1,2,2,2,1,1,1,0,0],
      [0,0,1,1,1,1,1,1,3,3,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,3,3,3,3,3,3,1,1,1,0,0,0],
      [0,0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0,0],
      [0,0,0,0,3,3,3,3,3,3,3,3,3,3,0,0,0,0],
      [0,0,0,4,4,3,3,3,3,3,3,3,3,4,4,0,0,0],
      [0,0,4,4,4,4,3,3,3,3,3,3,4,4,4,4,0,0],
      [0,4,4,5,5,4,4,3,3,3,3,4,4,5,5,4,4,0],
      [0,4,5,5,5,5,4,4,4,4,4,4,5,5,5,5,4,0],
      [0,0,4,5,5,4,4,4,4,4,4,4,4,5,5,4,0,0],
      [0,0,0,4,4,4,6,6,0,0,6,6,4,4,4,0,0,0],
      [0,0,0,0,6,6,6,0,0,0,0,6,6,6,0,0,0,0],
      [0,0,0,6,6,6,0,0,0,0,0,0,6,6,6,0,0,0],
    ];

    const colors = [
      'transparent',  // 0
      '#8b7355',      // 1 - skin
      '#000000',      // 2 - eyes
      '#c0c0c0',      // 3 - helmet/armor silver
      '#4a90e2',      // 4 - armor blue
      '#2e5c8a',      // 5 - armor dark blue
      '#654321',      // 6 - boots brown
    ];

    const scale = 2;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

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
  }

  private static createSlimeSprite() {
    const size = 24;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,2,2,1,1,2,2,1,1,1,0],
      [1,1,1,2,2,3,2,2,2,3,2,1,1,1],
      [1,1,1,2,2,2,1,1,2,2,2,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,4,1,1,1,1,4,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
    ];

    const colors = [
      'transparent',
      '#4ade80',     // 1 - green slime
      '#ffffff',     // 2 - eyes white
      '#000000',     // 3 - pupils
      '#22c55e',     // 4 - slime highlights
    ];

    const scale = 2;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('slime', canvas);
  }

  private static createGoblinSprite() {
    const size = 24;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,1,2,2,1,1,0,0],
      [0,1,1,1,2,3,1,1,2,3,1,1,1,0],
      [0,1,1,1,1,1,4,4,1,1,1,1,1,0],
      [0,0,1,1,4,4,4,4,4,4,1,1,0,0],
      [0,0,0,1,1,5,5,5,5,1,1,0,0,0],
      [0,0,5,5,1,5,5,5,5,1,5,5,0,0],
      [0,5,5,5,5,5,5,5,5,5,5,5,5,0],
      [0,0,5,5,6,5,0,0,5,6,5,5,0,0],
    ];

    const colors = [
      'transparent',
      '#7cb342',     // 1 - green skin
      '#ffeb3b',     // 2 - eyes yellow
      '#d32f2f',     // 3 - eyes red glow
      '#8b4513',     // 4 - nose/mouth
      '#4a4a4a',     // 5 - armor dark
      '#2196f3',     // 6 - armor accent
    ];

    const scale = 2;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('goblin', canvas);
  }

  private static createSkeletonSprite() {
    const size = 24;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,1,2,2,1,1,0,0],
      [0,1,1,1,2,2,1,1,2,2,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,3,3,3,3,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,0,0,1,1,1,1,1,0],
      [0,1,1,1,0,0,0,0,0,0,1,1,1,0],
    ];

    const colors = [
      'transparent',
      '#e0e0e0',     // 1 - bone white
      '#000000',     // 2 - eye sockets
      '#8b0000',     // 3 - mouth/teeth
    ];

    const scale = 2;
    pixels.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel > 0) {
          ctx.fillStyle = colors[pixel];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });

    this.sprites.set('skeleton', canvas);
  }

  private static createDemonSprite() {
    const size = 32;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
      [0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0],
      [0,1,1,2,2,1,1,0,0,1,1,2,2,1,1,0],
      [0,1,2,2,2,2,1,0,0,1,2,2,2,2,1,0],
      [0,0,1,1,1,1,3,3,3,3,1,1,1,1,0,0],
      [0,0,0,3,3,3,3,3,3,3,3,3,3,0,0,0],
      [0,0,3,3,4,4,3,3,3,3,4,4,3,3,0,0],
      [0,3,3,3,4,5,4,3,3,4,5,4,3,3,3,0],
      [0,3,3,3,4,4,3,3,3,3,4,4,3,3,3,0],
      [0,0,3,3,3,3,6,6,6,6,3,3,3,3,0,0],
      [0,0,0,3,3,6,6,6,6,6,6,3,3,0,0,0],
      [0,0,0,0,3,3,6,6,6,6,3,3,0,0,0,0],
      [0,0,0,3,3,3,3,0,0,3,3,3,3,0,0,0],
      [0,0,3,3,3,0,0,0,0,0,0,3,3,3,0,0],
    ];

    const colors = [
      'transparent',
      '#ffd700',     // 1 - horns gold
      '#ff8c00',     // 2 - horns dark
      '#8b0000',     // 3 - body dark red
      '#ff0000',     // 4 - eyes red
      '#ffff00',     // 5 - eyes yellow glow
      '#000000',     // 6 - mouth/shadow
    ];

    const scale = 2;
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
      const size = 16;
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
    const size = 24;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,1,1,1,1,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,1,1,1,2,2,1,1,0,0],
      [0,1,1,2,2,3,2,1,1,2,2,3,2,1,1,0],
      [0,1,1,2,3,3,2,1,1,2,3,3,2,1,1,0],
      [0,0,1,1,1,1,4,4,4,4,1,1,1,1,0,0],
      [0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0],
      [0,0,1,4,4,5,4,4,4,4,5,4,4,1,0,0],
      [0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0],
      [0,1,4,4,4,4,6,6,6,6,4,4,4,4,1,0],
      [0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0],
    ];

    const colors = [
      'transparent',
      '#ff8c00',     // 1 - horns
      '#ff0000',     // 2 - eyes
      '#ffff00',     // 3 - eye glow
      '#8b0000',     // 4 - body dark red
      '#ff4500',     // 5 - highlights
      '#000000',     // 6 - mouth
    ];

    const scale = 2;
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
    const size = 28;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,1,1,1,2,2,1,1,0,0],
      [0,1,1,1,2,2,1,1,1,1,2,2,1,1,1,0],
      [0,1,1,1,1,1,3,3,3,3,1,1,1,1,1,0],
      [0,0,1,1,3,3,3,3,3,3,3,3,1,1,0,0],
      [0,0,0,1,1,3,3,4,4,3,3,1,1,0,0,0],
      [0,0,4,4,1,1,1,1,1,1,1,1,4,4,0,0],
      [0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,0],
      [0,4,4,5,5,4,0,0,0,0,4,5,5,4,4,0],
      [0,0,4,4,4,0,0,0,0,0,0,4,4,4,0,0],
    ];

    const colors = [
      'transparent',
      '#567d46',     // 1 - green skin
      '#000000',     // 2 - eyes
      '#8b4513',     // 3 - tusks/teeth
      '#696969',     // 4 - armor
      '#4a4a4a',     // 5 - armor dark
    ];

    const scale = 2;
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
    const size = 24;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,1,2,2,1,1,0,0],
      [0,1,1,1,2,3,1,1,2,3,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,4,4,4,4,1,1,1,0,0],
      [0,0,0,1,1,1,4,4,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,0,0,1,1,1,1,1,0],
      [0,1,1,0,0,0,0,0,0,0,0,1,1,0],
      [1,1,0,0,0,0,0,0,0,0,0,0,1,1],
    ];

    const colors = [
      'transparent',
      '#9370db',     // 1 - ghostly purple
      '#000000',     // 2 - eye sockets
      '#4b0082',     // 3 - eye glow
      '#8b008b',     // 4 - mouth
    ];

    const scale = 2;
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
    const size = 24;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,2,2,2,2,2,2,2,2,1,0,0],
      [0,1,2,2,3,3,2,2,3,3,2,2,1,0],
      [0,1,2,2,3,4,2,2,3,4,2,2,1,0],
      [0,0,1,2,2,2,5,5,2,2,2,1,0,0],
      [0,0,0,1,2,5,5,5,5,2,1,0,0,0],
      [0,0,6,6,1,1,1,1,1,1,6,6,0,0],
      [0,6,6,6,6,6,6,6,6,6,6,6,6,0],
      [0,6,6,7,7,6,0,0,6,7,7,6,6,0],
    ];

    const colors = [
      'transparent',
      '#000000',     // 1 - hood outline
      '#2c2c54',     // 2 - hood/robe dark
      '#ffffff',     // 3 - eyes
      '#00ff00',     // 4 - eye glow green
      '#8b0000',     // 5 - mouth
      '#1a1a2e',     // 6 - robe body
      '#474787',     // 7 - robe highlights
    ];

    const scale = 2;
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
    const size = 32;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,1,1,1,2,2,1,1,0,0],
      [0,1,1,1,2,2,1,1,1,1,2,2,1,1,1,0],
      [0,1,1,1,1,1,1,3,3,1,1,1,1,1,1,0],
      [0,0,1,1,1,3,3,3,3,3,3,1,1,1,0,0],
      [0,0,0,1,1,1,3,3,3,3,1,1,1,0,0,0],
      [0,0,4,4,1,1,1,1,1,1,1,1,4,4,0,0],
      [0,4,4,4,4,1,1,1,1,1,1,4,4,4,4,0],
      [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
      [4,4,5,5,4,4,4,0,0,4,4,4,5,5,4,4],
      [0,4,4,4,4,4,0,0,0,0,4,4,4,4,4,0],
    ];

    const colors = [
      'transparent',
      '#4a7c59',     // 1 - green skin
      '#ff0000',     // 2 - red eyes
      '#8b4513',     // 3 - tusks
      '#5f4c3b',     // 4 - brown clothing
      '#3d2f24',     // 5 - clothing dark
    ];

    const scale = 2;
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
    const size = 24;
    const canvas = this.createCanvas(size, size);
    const ctx = canvas.getContext('2d')!;

    const pixels = [
      [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,1,1,2,2,1,1,1,1,2,2,1,1,0],
      [0,1,1,2,3,2,1,1,2,3,2,1,1,0],
      [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,4,4,4,4,1,1,0,0,0],
      [0,0,0,0,4,4,4,4,4,4,0,0,0,0],
      [0,0,1,1,1,1,0,0,1,1,1,1,0,0],
      [0,1,1,1,0,0,0,0,0,0,1,1,1,0],
      [1,1,1,0,0,0,0,0,0,0,0,1,1,1],
    ];

    const colors = [
      'transparent',
      '#e0e0e0',     // 1 - ghostly white
      '#000000',     // 2 - eyes
      '#00ffff',     // 3 - eye glow cyan
      '#8b0000',     // 4 - mouth screaming
    ];

    const scale = 2;
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
}
