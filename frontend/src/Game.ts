// Main game state machine

import { Player } from './Player';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { Particle, DamageNumber, spawnHitParticles, spawnKillParticles, spawnXPParticles, spawnHealthOrbParticles } from './Particle';
import { WaveManager } from './WaveManager';
import { PlayerStats, ItemDatabase, type Item } from './ItemSystem';
import { SaveManager } from './SaveManager';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { pointInRect } from './utils';
import { HealthOrb } from './Pickup';

export type GameState = 'menu' | 'playing' | 'shop' | 'paused' | 'gameover';

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private input: Input;
  private audio: AudioManager;

  state: GameState = 'menu';

  // Game entities
  player: Player | null = null;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  damageNumbers: DamageNumber[] = [];
  healthOrbs: HealthOrb[] = [];

  // Systems
  waveManager: WaveManager;
  playerStats: PlayerStats;

  // Shop state
  shopItems: Item[] = [];
  selectedShopItem: number = -1;
  shopRerollCost: number = 2;
  shopRerolls: number = 0;

  // Stats
  kills: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.audio = new AudioManager();
    this.waveManager = new WaveManager();
    this.playerStats = new PlayerStats();

    // Connect input to game state
    this.input.setGameStateGetter(() => this.state);

    this.setupUI();
  }

  private setupUI(): void {
    // Start button
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.startNewGame();
      });
    }

    // Continue button
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this.continueGame();
      });

      // Show/hide based on saved game
      continueBtn.style.display = SaveManager.hasSavedRun() ? 'block' : 'none';
    }
  }

  startNewGame(): void {
    SaveManager.clearRun();

    this.playerStats = new PlayerStats();
    this.player = new Player(this.canvas.width / 2, this.canvas.height / 2, this.playerStats);
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.damageNumbers = [];
    this.healthOrbs = [];
    this.kills = 0;

    this.waveManager.reset();
    this.waveManager.startWave(1);

    this.state = 'playing';
  }

  continueGame(): void {
    const save = SaveManager.loadRun();

    this.playerStats = new PlayerStats();

    // Restore items
    if (save.items) {
      save.items.forEach(itemId => {
        const item = ItemDatabase.getItemById(itemId);
        if (item) this.playerStats.addItem(item);
      });
    }

    this.player = new Player(this.canvas.width / 2, this.canvas.height / 2, this.playerStats);

    // Restore stats
    if (save.level) {
      this.player.level = save.level;
      this.player.xp = save.xp ?? 0;
      this.player.xpToNextLevel = 100 * Math.pow(1.5, save.level - 1);
    }
    if (save.gold !== undefined) this.player.gold = save.gold;
    if (save.health !== undefined) this.player.health = save.health;

    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.damageNumbers = [];
    this.healthOrbs = [];
    this.kills = 0;

    const wave = save.wave ?? 1;
    this.waveManager.reset();
    this.waveManager.startWave(wave);

    this.state = 'playing';
  }

  update(dt: number): void {
    this.renderer.update(dt);

    switch (this.state) {
      case 'menu':
        this.updateMenu();
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'shop':
        this.updateShop();
        break;
      case 'gameover':
        this.updateGameOver();
        break;
    }
  }

  private updateMenu(): void {
    // Update continue button visibility
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.style.display = SaveManager.hasSavedRun() ? 'block' : 'none';
    }
  }

  private updatePlaying(dt: number): void {
    if (!this.player) return;

    // Input
    const movement = this.input.getMovementVector();

    // Player update
    this.player.update(dt, movement.x, movement.y, this.canvas.width, this.canvas.height);

    // Player shooting
    const newProjectiles = this.player.tryShoot(this.enemies);
    if (newProjectiles.length > 0) {
      this.projectiles.push(...newProjectiles);
      this.audio.playShoot();
    }

    // Abilities
    if (this.input.consumeDash()) {
      if (this.player.tryDash()) {
        this.audio.playDash();
      }
    }

    if (this.input.consumeBlast()) {
      const blast = this.player.tryBlast();
      if (blast.success) {
        this.audio.playBlast();
        this.handleBlastDamage(blast.damage, blast.radius);
        this.renderer.addScreenShake(0.5); // Bigger shake for blast ability
      }
    }

    // Wave manager
    this.enemies = this.waveManager.update(dt, this.enemies, this.canvas.width, this.canvas.height);

    // Enemies
    for (const enemy of this.enemies) {
      const result = enemy.update(dt, this.player.x, this.player.y);

      // Enemy shooting
      if (result.shouldShoot) {
        const angle = enemy.getAngleToPlayer(this.player.x, this.player.y);
        this.projectiles.push(new Projectile(
          enemy.x,
          enemy.y,
          angle,
          enemy.typeData.damage,
          300,
          false
        ));
        this.audio.playShoot();
      }

      // Enemy-player collision
      if (enemy.collidesWith(this.player.x, this.player.y, this.player.radius)) {
        const damaged = this.player.takeDamage(enemy.typeData.damage);
        if (damaged) {
          this.renderer.addScreenShake(0.3);
          this.renderer.addHitFlash(0.5);
          this.particles.push(...spawnHitParticles(this.player.x, this.player.y, 12));
        }
        enemy.dead = true; // Enemy dies on contact
      }
    }

    // Projectiles
    for (const proj of this.projectiles) {
      proj.update(dt, this.canvas.width, this.canvas.height);

      if (proj.fromPlayer) {
        // Player projectile hits enemies
        for (const enemy of this.enemies) {
          if (proj.hasHit(enemy.id)) continue; // Already hit (piercing)

          if (enemy.collidesWith(proj.x, proj.y, proj.radius)) {
            const isCrit = this.player.rollCrit();
            let damage = isCrit ? this.player.getCritDamage(proj.damage) : proj.damage;

            enemy.takeDamage(damage);
            proj.markHit(enemy.id);

            // Knockback
            const knockback = this.playerStats.getKnockback();
            if (knockback > 0) {
              const angle = Math.atan2(enemy.y - proj.y, enemy.x - proj.x);
              enemy.x += Math.cos(angle) * knockback * dt;
              enemy.y += Math.sin(angle) * knockback * dt;
            }

            // Lifesteal
            const lifesteal = this.playerStats.getLifesteal();
            if (lifesteal > 0) {
              this.player.heal(damage * lifesteal);
            }

            this.audio.playHit();
            this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 6));
            this.damageNumbers.push(new DamageNumber(enemy.x, enemy.y - 20, damage, isCrit));
            // More shake on crit
            this.renderer.addScreenShake(isCrit ? 0.12 : 0.05);
            this.renderer.addImpactFlash(enemy.x, enemy.y);

            if (enemy.dead) {
              this.handleEnemyKill(enemy);
            }
          }
        }
      } else {
        // Enemy projectile hits player
        if (this.player.collidesWith(proj.x, proj.y, proj.radius)) {
          const damaged = this.player.takeDamage(proj.damage);
          if (damaged) {
            this.renderer.addScreenShake(0.25);
            this.renderer.addHitFlash(0.4);
            this.particles.push(...spawnHitParticles(this.player.x, this.player.y, 10));
          }
          proj.dead = true;
        }
      }
    }

    // Particles
    for (const particle of this.particles) {
      particle.update(dt);
    }

    // Damage numbers
    for (const num of this.damageNumbers) {
      num.update(dt);
    }

    // Health orbs
    for (const orb of this.healthOrbs) {
      orb.update(dt);

      // Check pickup collision
      if (orb.collidesWith(this.player.x, this.player.y, this.player.radius)) {
        this.player.heal(orb.healAmount);
        orb.dead = true;
        this.particles.push(...spawnHealthOrbParticles(orb.x, orb.y));
        this.audio.playHit(); // Reuse hit sound for pickup
      }
    }

    // Cleanup dead entities
    this.enemies = this.enemies.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.particles = this.particles.filter(p => !p.dead);
    this.damageNumbers = this.damageNumbers.filter(n => !n.dead);
    this.healthOrbs = this.healthOrbs.filter(o => !o.dead);

    // Check wave completion
    if (this.waveManager.isWaveComplete()) {
      this.enterShop();
    }

    // Check game over
    if (this.player.dead) {
      this.gameOver();
    }

    // Auto-save
    this.autoSave();
  }

  private handleBlastDamage(damage: number, radius: number): void {
    if (!this.player) return;

    for (const enemy of this.enemies) {
      const dist = Math.sqrt(
        (enemy.x - this.player.x) ** 2 + (enemy.y - this.player.y) ** 2
      );

      if (dist < radius + enemy.typeData.radius) {
        enemy.takeDamage(damage);
        this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 8));

        if (enemy.dead) {
          this.handleEnemyKill(enemy);
        }
      }
    }

    // Visual effect
    this.particles.push(...spawnHitParticles(this.player.x, this.player.y, 30));
  }

  private handleEnemyKill(enemy: Enemy): void {
    if (!this.player) return;

    this.kills++;
    this.audio.playKill();
    this.particles.push(...spawnKillParticles(enemy.x, enemy.y));
    this.particles.push(...spawnXPParticles(enemy.x, enemy.y));
    // More shake for bigger enemies
    const shakeAmount = enemy.type === 'demon' || enemy.type === 'troll' ? 0.25 : 0.1;
    this.renderer.addScreenShake(shakeAmount);

    // XP and gold (all enemies drop gold now)
    const leveledUp = this.player.addXP(enemy.typeData.xpValue);
    this.player.addGold(enemy.typeData.goldValue);

    if (leveledUp) {
      this.audio.playLevelUp();
      this.renderer.addScreenShake(0.2);
    }

    // Health orb drop (18% chance)
    if (Math.random() < 0.18) {
      this.healthOrbs.push(new HealthOrb(enemy.x, enemy.y));
    }

    // Explosion on kill
    if (this.playerStats.hasExplosionOnKill()) {
      const explosionRadius = 80;
      for (const otherEnemy of this.enemies) {
        if (otherEnemy === enemy) continue;

        const dist = Math.sqrt(
          (otherEnemy.x - enemy.x) ** 2 + (otherEnemy.y - enemy.y) ** 2
        );

        if (dist < explosionRadius) {
          otherEnemy.takeDamage(this.playerStats.getDamage() * 2);
          this.particles.push(...spawnHitParticles(otherEnemy.x, otherEnemy.y));
        }
      }
      this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 20));
    }
  }

  private enterShop(): void {
    this.shopItems = ItemDatabase.getRandomItems(4);
    this.selectedShopItem = -1;
    this.shopRerollCost = 2; // Reset reroll cost to 2 gold
    this.shopRerolls = 0;
    this.state = 'shop';
    this.audio.playWaveComplete();

    // Save progress
    this.autoSave();
  }

  private updateShop(): void {
    // Mouse hover detection for shop items
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    // Responsive layout
    const isMobile = this.canvas.width < 800;
    const itemWidth = isMobile ? Math.min(320, this.canvas.width - 40) : 200;
    const itemHeight = isMobile ? 160 : 120;
    const gap = isMobile ? 15 : 20;

    let startX: number, startY: number;

    if (isMobile) {
      // Vertical stack on mobile
      startX = (this.canvas.width - itemWidth) / 2;
      startY = 150;
    } else {
      // Horizontal row on desktop (4 items)
      startX = this.canvas.width / 2 - (itemWidth * 4 + gap * 3) / 2;
      startY = 200;
    }

    this.selectedShopItem = -1;

    for (let i = 0; i < this.shopItems.length; i++) {
      const x = isMobile ? startX : startX + i * (itemWidth + gap);
      const y = isMobile ? startY + i * (itemHeight + gap) : startY;

      if (pointInRect(mouseX, mouseY, { x, y, width: itemWidth, height: itemHeight })) {
        this.selectedShopItem = i;

        // Purchase on click
        if (this.input.mouseDown && this.player) {
          const item = this.shopItems[i];
          if (this.player.gold >= item.cost) {
            this.player.gold -= item.cost;
            this.playerStats.addItem(item);

            // Update player max health if needed
            if (item.maxHealthBonus) {
              const oldMax = this.player.maxHealth;
              this.player.maxHealth = this.playerStats.getMaxHealth();
              const healthPercent = this.player.health / oldMax;
              this.player.health = this.player.maxHealth * healthPercent;
            }

            // Add shield
            if (item.shield) {
              this.player.shield = true;
            }

            this.audio.playPurchase();
            this.input.mouseDown = false; // Prevent accidental double purchase
          }
        }
      }
    }

    // Reroll button - position based on layout
    const buttonWidth = isMobile ? 280 : 200;
    const buttonHeight = isMobile ? 70 : 50;
    const continueY = isMobile ? startY + this.shopItems.length * (itemHeight + gap) + 20 : 400;
    const rerollY = continueY + buttonHeight + 15;

    const rerollBtn = {
      x: this.canvas.width / 2 - buttonWidth / 2,
      y: isMobile ? continueY : rerollY,
      width: buttonWidth,
      height: buttonHeight
    };

    if (pointInRect(mouseX, mouseY, rerollBtn) && this.input.mouseDown && this.player) {
      if (this.player.gold >= this.shopRerollCost) {
        this.player.gold -= this.shopRerollCost;
        this.shopItems = ItemDatabase.getRandomItems(4);
        this.shopRerollCost *= 2; // Double the cost
        this.shopRerolls++;
        this.audio.playPurchase();
        this.input.mouseDown = false;
      }
    }

    // Continue button - position based on layout
    const continueBtn = {
      x: this.canvas.width / 2 - buttonWidth / 2,
      y: isMobile ? rerollY : continueY,
      width: buttonWidth,
      height: buttonHeight
    };

    if (pointInRect(mouseX, mouseY, continueBtn) && this.input.mouseDown) {
      this.startNextWave();
      this.input.mouseDown = false; // Prevent multiple clicks
    }
  }

  private startNextWave(): void {
    this.waveManager.startWave(this.waveManager.currentWave + 1);
    this.state = 'playing';

    // Reset mouse state to prevent accidental clicks
    this.input.mouseDown = false;
  }

  private updateGameOver(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    // Retry button
    const retryBtn = { x: this.canvas.width / 2 - 100, y: 400, width: 200, height: 50 };

    if (pointInRect(mouseX, mouseY, retryBtn) && this.input.mouseDown) {
      this.startNewGame();
    }
  }

  private gameOver(): void {
    this.state = 'gameover';
    this.audio.playGameOver();

    // Update meta stats
    SaveManager.updateMetaAfterRun(this.waveManager.currentWave, this.kills);
    SaveManager.clearRun();
  }

  private autoSave(): void {
    if (!this.player || this.state !== 'playing') return;

    SaveManager.saveRun({
      wave: this.waveManager.currentWave,
      xp: this.player.xp,
      level: this.player.level,
      gold: this.player.gold,
      health: this.player.health,
      items: this.playerStats.items.map(item => item.id)
    });
  }

  draw(): void {
    this.renderer.clear();
    this.renderer.beginFrame();

    switch (this.state) {
      case 'menu':
        this.drawMenu();
        break;
      case 'playing':
        this.drawPlaying();
        break;
      case 'shop':
        this.drawShop();
        break;
      case 'gameover':
        this.drawGameOver();
        break;
    }

    this.renderer.endFrame();
  }

  private drawMenu(): void {
    this.renderer.drawText('ROGUELITE', this.canvas.width / 2, 100, {
      size: 48,
      bold: true,
      align: 'center',
      color: '#00ff00'
    });

    this.renderer.drawText('Controls: WASD or Touch Joystick', this.canvas.width / 2, 200, {
      size: 16,
      align: 'center'
    });

    this.renderer.drawText('Abilities: SPACE (Dash), E (Blast)', this.canvas.width / 2, 230, {
      size: 16,
      align: 'center'
    });

    // Stats
    const stats = SaveManager.getStats();
    this.renderer.drawText(`Highest Wave: ${stats.highestWave}`, this.canvas.width / 2, 300, {
      size: 18,
      align: 'center'
    });

    this.renderer.drawText(`Total Runs: ${stats.totalRuns}`, this.canvas.width / 2, 330, {
      size: 18,
      align: 'center'
    });

    this.renderer.drawText(`Total Kills: ${stats.totalKills}`, this.canvas.width / 2, 360, {
      size: 18,
      align: 'center'
    });
  }

  private drawPlaying(): void {
    if (!this.player) return;

    const ctx = this.renderer.getContext();

    // Draw entities
    for (const particle of this.particles) {
      particle.draw(ctx);
    }

    for (const projectile of this.projectiles) {
      projectile.draw(ctx);
    }

    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }

    for (const orb of this.healthOrbs) {
      orb.draw(ctx);
    }

    this.player.draw(ctx);

    for (const num of this.damageNumbers) {
      num.draw(ctx);
    }

    // Draw joystick
    this.input.drawJoystick(ctx);

    // Draw UI
    this.drawHUD();
  }

  private drawHUD(): void {
    if (!this.player) return;

    // Detect mobile
    const isMobile = this.canvas.width < this.canvas.height;

    // Calculate safe area padding
    const basePadding = 10;
    const topPadding = Math.max(basePadding, 20); // Account for notches
    const sidePadding = Math.max(basePadding, 15);

    // Mobile scaling factors
    const textScale = isMobile ? 2.0 : 1;
    const barHeightScale = isMobile ? 2.2 : 1; // More prominent bars on mobile

    // Health bar
    const hpLabelSize = Math.round(14 * textScale);
    const barHeight = Math.round(20 * barHeightScale);
    this.renderer.drawText('HP', sidePadding, topPadding, { size: hpLabelSize, bold: true });
    this.renderer.drawHealthBar(sidePadding + 30, topPadding, 200, barHeight, this.player.health, this.player.maxHealth);

    const barWidth = Math.min(200, this.canvas.width * 0.35);
    const hpValueSize = Math.round(14 * textScale);
    this.renderer.drawText(`${Math.ceil(this.player.health)}/${this.player.maxHealth}`, sidePadding + 30 + barWidth + 10, topPadding + 2, { size: hpValueSize });

    // XP bar
    const xpOffset = Math.round(30 * textScale);
    this.renderer.drawText('XP', sidePadding, topPadding + xpOffset, { size: hpLabelSize, bold: true });
    this.renderer.drawProgressBar(sidePadding + 30, topPadding + xpOffset, 200, barHeight, this.player.xp / this.player.xpToNextLevel, '#00ff00');
    const levelSize = Math.round(14 * textScale);
    this.renderer.drawText(`Level ${this.player.level}`, sidePadding + 30 + barWidth + 10, topPadding + xpOffset + 2, { size: levelSize });

    // Gold
    const goldOffset = Math.round(60 * textScale);
    const goldSize = Math.round(16 * textScale);
    this.renderer.drawText(`Gold: ${this.player.gold}`, sidePadding, topPadding + goldOffset, { size: goldSize, bold: true, color: '#ffff00' });

    // Wave info (top right)
    let waveText = `Wave ${this.waveManager.currentWave}`;
    let waveColor = '#00ffff';

    if (this.waveManager.isBossWave) {
      waveText += ' - BOSS';
      waveColor = '#ff0000';
    } else if (this.waveManager.isHordeWave) {
      waveText += ' - HORDE';
      waveColor = '#ff6600';
    }

    const waveSize = Math.round(20 * textScale);
    this.renderer.drawText(waveText, this.canvas.width - sidePadding, topPadding, {
      size: waveSize,
      bold: true,
      align: 'right',
      color: waveColor
    });

    const enemySize = Math.round(16 * textScale);
    this.renderer.drawText(`Enemies: ${this.enemies.length + this.waveManager.waveEnemiesRemaining}`, this.canvas.width - sidePadding, topPadding + xpOffset, {
      size: enemySize,
      align: 'right'
    });

    // Ability cooldowns (bottom left, above joystick zone)
    const abilityY = this.canvas.height - 180;

    // Dash
    const dashCD = this.player.dashCooldown;
    const dashReady = dashCD <= 0;
    const abilityTextSize = Math.round(14 * textScale);
    const abilityCDSize = Math.round(12 * textScale);
    this.renderer.drawText('DASH', sidePadding, abilityY, {
      size: abilityTextSize,
      bold: true,
      color: dashReady ? '#00ff00' : '#888888'
    });
    if (!dashReady) {
      this.renderer.drawText(`${dashCD.toFixed(1)}s`, sidePadding, abilityY + 18, { size: abilityCDSize });
    }

    // Blast
    const blastCD = this.player.blastCooldown;
    const blastReady = blastCD <= 0;
    this.renderer.drawText('BLAST', sidePadding + 100, abilityY, {
      size: abilityTextSize,
      bold: true,
      color: blastReady ? '#00ff00' : '#888888'
    });
    if (!blastReady) {
      this.renderer.drawText(`${blastCD.toFixed(1)}s`, sidePadding + 100, abilityY + 18, { size: abilityCDSize });
    }

    // Shield indicator
    if (this.player.shield) {
      const shieldSize = Math.round(20 * textScale);
      this.renderer.drawText('🛡️ SHIELD ACTIVE', this.canvas.width / 2, topPadding, {
        size: shieldSize,
        bold: true,
        align: 'center',
        color: '#00ffff'
      });
    }
  }

  private drawShop(): void {
    const isMobile = this.canvas.width < 800;

    this.renderer.drawText('SHOP', this.canvas.width / 2, isMobile ? 35 : 50, {
      size: isMobile ? 56 : 36,
      bold: true,
      align: 'center',
      color: '#ffff00'
    });

    if (!this.player) return;

    this.renderer.drawText(`Gold: ${this.player.gold}`, this.canvas.width / 2, isMobile ? 95 : 100, {
      size: isMobile ? 32 : 20,
      align: 'center',
      color: '#ffff00'
    });

    // Draw shop items - responsive layout
    const itemWidth = isMobile ? Math.min(380, this.canvas.width - 40) : 200;
    const itemHeight = isMobile ? 200 : 120;
    const gap = isMobile ? 18 : 20;

    let startX: number, startY: number;

    if (isMobile) {
      // Vertical stack on mobile - center vertically in viewport
      startX = (this.canvas.width - itemWidth) / 2;
      // Calculate total content height and center it
      const totalHeight = this.shopItems.length * (itemHeight + gap) - gap + 240; // 240 for header + buttons
      startY = Math.max(135, (this.canvas.height - totalHeight) / 2 + 80);
    } else {
      // Horizontal row on desktop (4 items)
      startX = this.canvas.width / 2 - (itemWidth * 4 + gap * 3) / 2;
      startY = 200;
    }

    const ctx = this.renderer.getContext();

    for (let i = 0; i < this.shopItems.length; i++) {
      const item = this.shopItems[i];
      const x = isMobile ? startX : startX + i * (itemWidth + gap);
      const y = isMobile ? startY + i * (itemHeight + gap) : startY;
      const hovered = this.selectedShopItem === i;

      // Background
      ctx.fillStyle = hovered ? '#444444' : '#222222';
      ctx.fillRect(x, y, itemWidth, itemHeight);

      // Border (color by rarity)
      const rarityColors: Record<string, string> = {
        common: '#888888',
        rare: '#0088ff',
        epic: '#aa00ff',
        legendary: '#ffaa00'
      };
      ctx.strokeStyle = rarityColors[item.rarity] ?? '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, itemWidth, itemHeight);

      // Icon
      this.renderer.drawText(item.icon, x + itemWidth / 2, y + (isMobile ? 20 : 15), {
        size: isMobile ? 68 : 32,
        align: 'center'
      });

      // Name
      this.renderer.drawText(item.name, x + itemWidth / 2, y + (isMobile ? 95 : 55), {
        size: isMobile ? 26 : 14,
        bold: true,
        align: 'center'
      });

      // Description
      this.renderer.drawText(item.description, x + itemWidth / 2, y + (isMobile ? 125 : 75), {
        size: isMobile ? 20 : 11,
        align: 'center'
      });

      // Cost
      const canAfford = this.player.gold >= item.cost;
      this.renderer.drawText(`${item.cost} gold`, x + itemWidth / 2, y + (isMobile ? 155 : 95), {
        size: isMobile ? 24 : 12,
        bold: true,
        align: 'center',
        color: canAfford ? '#ffff00' : '#ff0000'
      });
    }

    // Button dimensions
    const buttonWidth = isMobile ? 340 : 200;
    const buttonHeight = isMobile ? 90 : 50;
    const continueY = isMobile ? startY + this.shopItems.length * (itemHeight + gap) + 25 : 400;
    const rerollY = continueY + buttonHeight + 20;

    // Reroll button
    const canAffordReroll = this.player.gold >= this.shopRerollCost;
    const rerollButtonY = isMobile ? continueY : rerollY;

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      rerollButtonY,
      buttonWidth,
      buttonHeight,
      `Reroll (${this.shopRerollCost}g)`,
      false,
      canAffordReroll,
      isMobile
    );

    // Continue button
    const continueButtonY = isMobile ? rerollY : continueY;
    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      continueButtonY,
      buttonWidth,
      buttonHeight,
      'Next Wave',
      false,
      true,
      isMobile
    );
  }

  private drawGameOver(): void {
    this.renderer.drawText('GAME OVER', this.canvas.width / 2, 100, {
      size: 48,
      bold: true,
      align: 'center',
      color: '#ff0000'
    });

    this.renderer.drawText(`Wave Reached: ${this.waveManager.currentWave}`, this.canvas.width / 2, 200, {
      size: 24,
      align: 'center'
    });

    this.renderer.drawText(`Kills: ${this.kills}`, this.canvas.width / 2, 240, {
      size: 24,
      align: 'center'
    });

    if (this.player) {
      this.renderer.drawText(`Level: ${this.player.level}`, this.canvas.width / 2, 280, {
        size: 24,
        align: 'center'
      });
    }

    // Retry button
    this.renderer.drawButton(
      this.canvas.width / 2 - 100,
      400,
      200,
      50,
      'Retry',
      false
    );
  }
}
