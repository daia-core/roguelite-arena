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
import { MetaProgression } from './MetaProgression';

export type GameState = 'menu' | 'playing' | 'shop' | 'paused' | 'gameover' | 'upgrades';

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
  metaProgression: MetaProgression;

  // Shop state
  shopItems: Item[] = [];
  selectedShopItem: number = -1;
  shopRerollCost: number = 2;
  shopRerolls: number = 0;

  // Stats
  kills: number = 0;
  bossKills: number = 0;
  soulsEarnedThisRun: number = 0;

  // Game over details
  gameOverStats: {
    wavesReached: number;
    enemiesKilled: number;
    goldEarned: number;
    itemsCollected: number;
    soulsEarned: number;
  } = {
    wavesReached: 0,
    enemiesKilled: 0,
    goldEarned: 0,
    itemsCollected: 0,
    soulsEarned: 0
  };

  // Pause
  pauseRequested: boolean = false;

  // Wave modifier announcement
  waveModifierTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.audio = new AudioManager();
    this.waveManager = new WaveManager();
    this.playerStats = new PlayerStats();
    this.metaProgression = new MetaProgression();

    // Connect input to game state
    this.input.setGameStateGetter(() => this.state);

    // Escape key for pause
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.state === 'playing') {
          this.state = 'paused';
        } else if (this.state === 'paused') {
          this.state = 'playing';
        }
      }
    });

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

    // Upgrades button
    const upgradesBtn = document.getElementById('upgradesBtn');
    if (upgradesBtn) {
      upgradesBtn.addEventListener('click', () => {
        this.state = 'upgrades';
      });
    }
  }

  startNewGame(): void {
    SaveManager.clearRun();

    this.playerStats = new PlayerStats();

    // Apply meta-progression starting item
    if (this.metaProgression.hasStartingItem()) {
      const commonItems = ItemDatabase.getItemsByRarity('common');
      if (commonItems.length > 0) {
        const randomItem = commonItems[Math.floor(Math.random() * commonItems.length)];
        this.playerStats.addItem(randomItem);
      }
    }

    this.player = new Player(this.canvas.width / 2, this.canvas.height / 2, this.playerStats);

    // Apply meta-progression bonuses
    const damageBonus = this.metaProgression.getStartingDamageBonus();
    if (damageBonus > 0) {
      this.player.stats.baseDamage *= (1 + damageBonus);
    }

    const healthBonus = this.metaProgression.getStartingHealthBonus();
    if (healthBonus > 0) {
      this.player.maxHealth += healthBonus;
      this.player.health = this.player.maxHealth;
    }

    const goldBonus = this.metaProgression.getStartingGoldBonus();
    if (goldBonus > 0) {
      this.player.gold += goldBonus;
    }

    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.damageNumbers = [];
    this.healthOrbs = [];
    this.kills = 0;
    this.bossKills = 0;
    this.soulsEarnedThisRun = 0;

    this.waveManager.reset();
    this.waveManager.startWave(1);
    this.waveModifierTimer = 3;

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
      case 'paused':
        this.updatePaused();
        break;
      case 'gameover':
        this.updateGameOver();
        break;
      case 'upgrades':
        this.updateUpgrades();
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

    // Wave modifier announcement timer
    if (this.waveModifierTimer > 0) {
      this.waveModifierTimer -= dt;
    }

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
        // Wizard fires homing projectiles (slightly curved toward player - handled in projectile update)
        this.projectiles.push(new Projectile(
          enemy.x,
          enemy.y,
          angle,
          enemy.typeData.damage,
          enemy.type === 'wizard' ? 250 : 300,
          false
        ));
        this.audio.playShoot();
      }

      // Golem stomp
      if (result.shouldStomp) {
        const stompRadius = 100;
        const dist = Math.sqrt(
          (this.player.x - enemy.x) ** 2 + (this.player.y - enemy.y) ** 2
        );
        if (dist < stompRadius) {
          const damaged = this.player.takeDamage(enemy.typeData.damage * 1.5);
          if (damaged) {
            this.renderer.addScreenShake(0.6);
            this.renderer.addHitFlash(0.6);
            this.particles.push(...spawnHitParticles(this.player.x, this.player.y, 15));
          }
        }
        // Visual effect
        this.particles.push(...spawnHitParticles(enemy.x, enemy.y, 25));
        this.renderer.addScreenShake(0.4);
      }

      // Poison trail
      if (result.poisonTrail) {
        this.particles.push(new Particle({
          x: result.poisonTrail.x,
          y: result.poisonTrail.y,
          vx: 0,
          vy: 0,
          color: '#00ff00',
          size: 6,
          lifetime: 2,
          fadeOut: true
        }));
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
            // Golem is immune to knockback
            if (knockback > 0 && enemy.type !== 'golem') {
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

    // Track boss kills
    if (enemy.type === 'demon') {
      this.bossKills++;
      this.renderer.addScreenShake(0.8); // Extreme shake for boss death
    }

    this.audio.playKill();
    this.particles.push(...spawnKillParticles(enemy.x, enemy.y));
    this.particles.push(...spawnXPParticles(enemy.x, enemy.y));

    // More shake for bigger enemies
    const shakeAmount = enemy.type === 'demon' ? 0.8 :
                       (enemy.type === 'troll' || enemy.type === 'golem') ? 0.3 : 0.1;
    this.renderer.addScreenShake(shakeAmount);

    // XP and gold with meta-progression multipliers
    const xpMultiplier = this.metaProgression.getXPGainMultiplier();
    const goldMultiplier = this.metaProgression.getGoldGainMultiplier();

    // Apply modifiers from wave type
    let finalXP = enemy.typeData.xpValue * xpMultiplier;
    let finalGold = enemy.typeData.goldValue * goldMultiplier;

    if (this.waveManager.waveModifier === 'elite') {
      finalGold *= 1.5;
      finalXP *= 1.5;
    } else if (this.waveManager.waveModifier === 'tank') {
      finalGold *= 2;
      finalXP *= 2;
    }

    // Mimic drops 2x gold
    if (enemy.type === 'mimic') {
      finalGold *= 2;
    }

    const leveledUp = this.player.addXP(Math.floor(finalXP));
    this.player.addGold(Math.floor(finalGold));

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

    // Apply meta-progression reroll discount
    const rerollDiscount = this.metaProgression.getRerollDiscount();
    this.shopRerollCost = rerollDiscount.startCost;
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

    // Responsive layout - detect portrait mode for better fitting
    const isPortrait = this.canvas.width < this.canvas.height;
    const isMobile = this.canvas.width < 800;
    const itemWidth = isPortrait ? Math.min(280, this.canvas.width - 40) : isMobile ? Math.min(380, this.canvas.width - 40) : 200;
    const itemHeight = isPortrait ? 140 : isMobile ? 200 : 120;
    const gap = isPortrait ? 8 : isMobile ? 18 : 20;

    let startX: number, startY: number;

    if (isMobile) {
      // Vertical stack on mobile
      startX = (this.canvas.width - itemWidth) / 2;
      startY = isPortrait ? 100 : 135;
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

    // Button positioning - MUST MATCH drawShop() exactly to fix alignment bug
    const buttonWidth = isMobile ? 340 : 200;
    const buttonHeight = isMobile ? 90 : 50;
    const buttonSpacing = 20;

    // Calculate button Y positions - ensure they fit on screen
    const itemsEndY = isMobile ? startY + this.shopItems.length * (itemHeight + gap) : 320;
    const continueY = isMobile ? Math.min(itemsEndY + 25, this.canvas.height - buttonHeight * 2 - buttonSpacing - 20) : 400;
    const rerollY = continueY + buttonHeight + buttonSpacing;

    // Continue button (Next Wave) - ALWAYS FIRST
    const continueBtn = {
      x: this.canvas.width / 2 - buttonWidth / 2,
      y: continueY,
      width: buttonWidth,
      height: buttonHeight
    };

    if (pointInRect(mouseX, mouseY, continueBtn) && this.input.mouseDown) {
      this.startNextWave();
      this.input.mouseDown = false;
    }

    // Reroll button - ALWAYS SECOND (below continue)
    const rerollBtn = {
      x: this.canvas.width / 2 - buttonWidth / 2,
      y: rerollY,
      width: buttonWidth,
      height: buttonHeight
    };

    if (pointInRect(mouseX, mouseY, rerollBtn) && this.input.mouseDown && this.player) {
      if (this.player.gold >= this.shopRerollCost) {
        this.player.gold -= this.shopRerollCost;
        this.shopItems = ItemDatabase.getRandomItems(4);

        // Apply reroll cost scaling with cap from meta-progression
        const rerollDiscount = this.metaProgression.getRerollDiscount();
        this.shopRerollCost = Math.min(this.shopRerollCost * 2, rerollDiscount.maxCost);

        this.shopRerolls++;
        this.audio.playPurchase();
        this.input.mouseDown = false;
      }
    }
  }

  private startNextWave(): void {
    this.waveManager.startWave(this.waveManager.currentWave + 1);
    this.waveModifierTimer = 3; // Show wave modifier for 3 seconds
    this.state = 'playing';

    // Reset mouse state to prevent accidental clicks
    this.input.mouseDown = false;
  }

  private updatePaused(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    const buttonWidth = 200;
    const buttonHeight = 50;
    const spacing = 20;

    // Resume button
    const resumeBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: 250, width: buttonWidth, height: buttonHeight };
    // Restart button
    const restartBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: 250 + buttonHeight + spacing, width: buttonWidth, height: buttonHeight };
    // Main menu button
    const menuBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: 250 + (buttonHeight + spacing) * 2, width: buttonWidth, height: buttonHeight };

    if (pointInRect(mouseX, mouseY, resumeBtn) && this.input.mouseDown) {
      this.state = 'playing';
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, restartBtn) && this.input.mouseDown) {
      this.startNewGame();
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, menuBtn) && this.input.mouseDown) {
      this.state = 'menu';
      SaveManager.clearRun();
      this.input.mouseDown = false;
    }
  }

  private updateUpgrades(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    const isMobile = this.canvas.width < 800;
    const upgradeWidth = isMobile ? Math.min(350, this.canvas.width - 40) : 320;
    const upgradeHeight = isMobile ? 120 : 100;
    const gap = 15;

    const upgrades = this.metaProgression.getAllUpgrades();
    const startX = (this.canvas.width - upgradeWidth) / 2;
    const startY = 140;

    for (let i = 0; i < upgrades.length; i++) {
      const upgrade = upgrades[i];
      const x = startX;
      const y = startY + i * (upgradeHeight + gap);

      if (pointInRect(mouseX, mouseY, { x, y, width: upgradeWidth, height: upgradeHeight })) {
        if (this.input.mouseDown && this.metaProgression.canPurchaseUpgrade(upgrade.id)) {
          this.metaProgression.purchaseUpgrade(upgrade.id);
          this.audio.playPurchase();
          this.input.mouseDown = false;
        }
      }
    }

    // Back button
    const backBtn = { x: this.canvas.width / 2 - 100, y: this.canvas.height - 80, width: 200, height: 50 };
    if (pointInRect(mouseX, mouseY, backBtn) && this.input.mouseDown) {
      this.state = 'menu';
      this.input.mouseDown = false;
    }
  }

  private updateGameOver(): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    const buttonWidth = 200;
    const buttonHeight = 50;
    const spacing = 20;
    const startY = this.canvas.height - 200;

    // Try again button
    const retryBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: startY, width: buttonWidth, height: buttonHeight };
    // Upgrades button
    const upgradesBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: startY + buttonHeight + spacing, width: buttonWidth, height: buttonHeight };
    // Main menu button
    const menuBtn = { x: this.canvas.width / 2 - buttonWidth / 2, y: startY + (buttonHeight + spacing) * 2, width: buttonWidth, height: buttonHeight };

    if (pointInRect(mouseX, mouseY, retryBtn) && this.input.mouseDown) {
      this.startNewGame();
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, upgradesBtn) && this.input.mouseDown) {
      this.state = 'upgrades';
      this.input.mouseDown = false;
    }

    if (pointInRect(mouseX, mouseY, menuBtn) && this.input.mouseDown) {
      this.state = 'menu';
      this.input.mouseDown = false;
    }
  }

  private gameOver(): void {
    this.state = 'gameover';
    this.audio.playGameOver();

    // Calculate souls earned
    this.soulsEarnedThisRun = MetaProgression.calculateSoulsEarned(
      this.waveManager.currentWave,
      this.bossKills
    );
    this.metaProgression.addSouls(this.soulsEarnedThisRun);

    // Store game over stats
    this.gameOverStats = {
      wavesReached: this.waveManager.currentWave,
      enemiesKilled: this.kills,
      goldEarned: this.player?.gold ?? 0,
      itemsCollected: this.playerStats.items.length,
      soulsEarned: this.soulsEarnedThisRun
    };

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
      case 'paused':
        this.drawPaused();
        break;
      case 'gameover':
        this.drawGameOver();
        break;
      case 'upgrades':
        this.drawUpgrades();
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

    // Souls display
    this.renderer.drawText(`Souls: ${this.metaProgression.souls}`, this.canvas.width / 2, 270, {
      size: 24,
      bold: true,
      align: 'center',
      color: '#9370db'
    });

    // Stats
    const stats = SaveManager.getStats();
    this.renderer.drawText(`Highest Wave: ${stats.highestWave}`, this.canvas.width / 2, 320, {
      size: 18,
      align: 'center'
    });

    this.renderer.drawText(`Total Runs: ${stats.totalRuns}`, this.canvas.width / 2, 350, {
      size: 18,
      align: 'center'
    });

    this.renderer.drawText(`Total Kills: ${stats.totalKills}`, this.canvas.width / 2, 380, {
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

    // Draw wave modifier announcement
    if (this.waveModifierTimer > 0 && this.waveManager.waveModifierText) {
      const alpha = Math.min(1, this.waveModifierTimer);
      const ctx = this.renderer.getContext();
      ctx.save();
      ctx.globalAlpha = alpha;

      const modifierColor = this.waveManager.waveModifier === 'horde' ? '#ff6600' :
                           this.waveManager.waveModifier === 'elite' ? '#ff00ff' :
                           this.waveManager.waveModifier === 'speed' ? '#00ffff' :
                           this.waveManager.waveModifier === 'tank' ? '#888888' :
                           this.waveManager.waveModifier === 'chaos' ? '#ff0000' :
                           this.waveManager.isBossWave ? '#ff0000' : '#ffff00';

      this.renderer.drawText(this.waveManager.waveModifierText, this.canvas.width / 2, this.canvas.height / 2 - 50, {
        size: 32,
        bold: true,
        align: 'center',
        color: modifierColor
      });

      ctx.restore();
    }
  }

  private drawHUD(): void {
    if (!this.player) return;

    const ctx = this.renderer.getContext();

    // Detect mobile
    const isMobile = this.canvas.width < this.canvas.height;

    // Calculate safe area padding
    const basePadding = 10;
    const topPadding = Math.max(basePadding, 20); // Account for notches
    const sidePadding = Math.max(basePadding, 15);

    // Mobile scaling factors
    const textScale = isMobile ? 2.0 : 1;
    const barHeightScale = isMobile ? 2.2 : 1;

    // Draw HUD background panel (semi-transparent)
    const hudBgHeight = Math.round(95 * textScale);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, this.canvas.width, hudBgHeight);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.canvas.width, hudBgHeight);
    ctx.restore();

    // Health bar with icon
    const hpLabelSize = Math.round(16 * textScale);
    const barHeight = Math.round(24 * barHeightScale);
    this.renderer.drawText('❤', sidePadding, topPadding, { size: hpLabelSize, bold: true, color: '#ef4444' });
    this.renderer.drawHealthBar(sidePadding + Math.round(25 * textScale), topPadding, 200, barHeight, this.player.health, this.player.maxHealth);

    const barWidth = Math.min(200, this.canvas.width * 0.35);
    const hpValueSize = Math.round(14 * textScale);
    this.renderer.drawText(`${Math.ceil(this.player.health)}/${this.player.maxHealth}`, sidePadding + Math.round(25 * textScale) + barWidth + 10, topPadding + 4, {
      size: hpValueSize,
      bold: true,
      color: '#ffffff'
    });

    // XP bar
    const xpOffset = Math.round(32 * textScale);
    this.renderer.drawText('⭐', sidePadding, topPadding + xpOffset, { size: hpLabelSize, bold: true, color: '#ffd700' });
    this.renderer.drawProgressBar(sidePadding + Math.round(25 * textScale), topPadding + xpOffset, 200, barHeight, this.player.xp / this.player.xpToNextLevel, '#4ade80');
    const levelSize = Math.round(14 * textScale);
    this.renderer.drawText(`Lv ${this.player.level}`, sidePadding + Math.round(25 * textScale) + barWidth + 10, topPadding + xpOffset + 4, {
      size: levelSize,
      bold: true,
      color: '#ffd700'
    });

    // Gold with icon
    const goldOffset = Math.round(64 * textScale);
    const goldSize = Math.round(18 * textScale);
    this.renderer.drawText(`💰 ${this.player.gold}`, sidePadding, topPadding + goldOffset, {
      size: goldSize,
      bold: true,
      color: '#ffd700'
    });

    // Wave info (top right) with icon
    let waveText = `🌊 Wave ${this.waveManager.currentWave}`;
    let waveColor = '#4a9eff';

    if (this.waveManager.isBossWave) {
      waveText = `👹 Wave ${this.waveManager.currentWave} - BOSS`;
      waveColor = '#ef4444';
    } else if (this.waveManager.isHordeWave) {
      waveText = `⚡ Wave ${this.waveManager.currentWave} - HORDE`;
      waveColor = '#f97316';
    }

    const waveSize = Math.round(24 * textScale);
    this.renderer.drawText(waveText, this.canvas.width - sidePadding, topPadding, {
      size: waveSize,
      bold: true,
      align: 'right',
      color: waveColor
    });

    const enemySize = Math.round(16 * textScale);
    this.renderer.drawText(`Enemies: ${this.enemies.length + this.waveManager.waveEnemiesRemaining}`, this.canvas.width - sidePadding, topPadding + xpOffset + 4, {
      size: enemySize,
      align: 'right',
      color: '#cccccc'
    });

    // Ability cooldowns (bottom left, above joystick zone)
    const abilityY = this.canvas.height - Math.round(180 * textScale);
    const abilityBoxSize = Math.round(80 * textScale);
    const abilitySpacing = Math.round(90 * textScale);

    // Draw ability boxes
    const dashCD = this.player.dashCooldown;
    const dashReady = dashCD <= 0;
    const blastCD = this.player.blastCooldown;
    const blastReady = blastCD <= 0;

    // Dash ability box
    ctx.save();
    ctx.fillStyle = dashReady ? 'rgba(74, 222, 128, 0.2)' : 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(sidePadding, abilityY, abilityBoxSize, abilityBoxSize);
    ctx.strokeStyle = dashReady ? '#4ade80' : '#666666';
    ctx.lineWidth = 3;
    ctx.strokeRect(sidePadding, abilityY, abilityBoxSize, abilityBoxSize);
    ctx.restore();

    const abilityTextSize = Math.round(16 * textScale);
    const abilityCDSize = Math.round(20 * textScale);
    this.renderer.drawText('DASH', sidePadding + abilityBoxSize / 2, abilityY + Math.round(20 * textScale), {
      size: abilityTextSize,
      bold: true,
      align: 'center',
      color: dashReady ? '#4ade80' : '#888888'
    });
    if (!dashReady) {
      this.renderer.drawText(`${dashCD.toFixed(1)}`, sidePadding + abilityBoxSize / 2, abilityY + Math.round(45 * textScale), {
        size: abilityCDSize,
        bold: true,
        align: 'center',
        color: '#ffffff'
      });
    } else {
      this.renderer.drawText('⚡', sidePadding + abilityBoxSize / 2, abilityY + Math.round(40 * textScale), {
        size: Math.round(24 * textScale),
        align: 'center'
      });
    }

    // Blast ability box
    ctx.save();
    ctx.fillStyle = blastReady ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(sidePadding + abilitySpacing, abilityY, abilityBoxSize, abilityBoxSize);
    ctx.strokeStyle = blastReady ? '#ef4444' : '#666666';
    ctx.lineWidth = 3;
    ctx.strokeRect(sidePadding + abilitySpacing, abilityY, abilityBoxSize, abilityBoxSize);
    ctx.restore();

    this.renderer.drawText('BLAST', sidePadding + abilitySpacing + abilityBoxSize / 2, abilityY + Math.round(20 * textScale), {
      size: abilityTextSize,
      bold: true,
      align: 'center',
      color: blastReady ? '#ef4444' : '#888888'
    });
    if (!blastReady) {
      this.renderer.drawText(`${blastCD.toFixed(1)}`, sidePadding + abilitySpacing + abilityBoxSize / 2, abilityY + Math.round(45 * textScale), {
        size: abilityCDSize,
        bold: true,
        align: 'center',
        color: '#ffffff'
      });
    } else {
      this.renderer.drawText('💥', sidePadding + abilitySpacing + abilityBoxSize / 2, abilityY + Math.round(40 * textScale), {
        size: Math.round(24 * textScale),
        align: 'center'
      });
    }

    // Shield indicator (center top, below HUD)
    if (this.player.shield) {
      const shieldSize = Math.round(24 * textScale);
      this.renderer.drawText('🛡️ SHIELD ACTIVE', this.canvas.width / 2, topPadding + goldOffset + Math.round(10 * textScale), {
        size: shieldSize,
        bold: true,
        align: 'center',
        color: '#4a9eff'
      });
    }
  }

  private drawShop(): void {
    const isPortrait = this.canvas.width < this.canvas.height;
    const isMobile = this.canvas.width < 800;

    // Shop title with fancy styling
    this.renderer.drawText('SHOP', this.canvas.width / 2, isMobile ? 25 : 50, {
      size: isMobile ? 64 : 48,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    if (!this.player) return;

    // Gold display with icon
    this.renderer.drawText(`Gold: ${this.player.gold}`, this.canvas.width / 2, isMobile ? 75 : 100, {
      size: isMobile ? 32 : 24,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    // Draw shop items - responsive layout (MUST MATCH updateShop positions)
    const itemWidth = isPortrait ? Math.min(280, this.canvas.width - 40) : isMobile ? Math.min(380, this.canvas.width - 40) : 200;
    const itemHeight = isPortrait ? 140 : isMobile ? 200 : 120;
    const gap = isPortrait ? 8 : isMobile ? 18 : 20;

    let startX: number, startY: number;

    if (isMobile) {
      // Vertical stack on mobile
      startX = (this.canvas.width - itemWidth) / 2;
      startY = isPortrait ? 100 : 135;
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

      // Rarity colors with better palette
      const rarityColors: Record<string, string> = {
        common: '#888888',
        rare: '#4a9eff',
        epic: '#a855f7',
        legendary: '#ffd700'
      };
      const rarityColor = rarityColors[item.rarity] ?? '#ffffff';

      // Card shadow/glow effect
      if (hovered) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = rarityColor;
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x - 2, y - 2, itemWidth + 4, itemHeight + 4);
        ctx.restore();
      }

      // Background with gradient
      const gradient = ctx.createLinearGradient(x, y, x, y + itemHeight);
      gradient.addColorStop(0, hovered ? '#3a3a3a' : '#222222');
      gradient.addColorStop(1, hovered ? '#2a2a2a' : '#1a1a1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, itemWidth, itemHeight);

      // Border with rarity color (thicker for better visibility)
      ctx.strokeStyle = rarityColor;
      ctx.lineWidth = hovered ? 5 : 4;
      ctx.strokeRect(x, y, itemWidth, itemHeight);

      // Inner shadow for depth
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, itemWidth - 4, itemHeight - 4);

      // Icon with better positioning
      this.renderer.drawText(item.icon, x + itemWidth / 2, y + (isPortrait ? 15 : isMobile ? 20 : 15), {
        size: isPortrait ? 48 : isMobile ? 68 : 32,
        align: 'center'
      });

      // Name with better contrast
      this.renderer.drawText(item.name, x + itemWidth / 2, y + (isPortrait ? 70 : isMobile ? 95 : 55), {
        size: isPortrait ? 20 : isMobile ? 26 : 16,
        bold: true,
        align: 'center',
        color: rarityColor
      });

      // Description
      this.renderer.drawText(item.description, x + itemWidth / 2, y + (isPortrait ? 95 : isMobile ? 125 : 75), {
        size: isPortrait ? 14 : isMobile ? 20 : 12,
        align: 'center',
        color: '#cccccc'
      });

      // Cost with better styling
      const canAfford = this.player.gold >= item.cost;
      this.renderer.drawText(`${item.cost} gold`, x + itemWidth / 2, y + (isPortrait ? 120 : isMobile ? 165 : 100), {
        size: isPortrait ? 18 : isMobile ? 28 : 14,
        bold: true,
        align: 'center',
        color: canAfford ? '#ffd700' : '#ef4444'
      });
    }

    // Button dimensions and positioning - MUST MATCH updateShop
    const buttonWidth = isMobile ? 340 : 200;
    const buttonHeight = isMobile ? 90 : 50;
    const buttonSpacing = 20;

    // Calculate button Y positions - ensure they fit on screen
    const itemsEndY = isMobile ? startY + this.shopItems.length * (itemHeight + gap) : 320;
    const continueY = isMobile ? Math.min(itemsEndY + 25, this.canvas.height - buttonHeight * 2 - buttonSpacing - 20) : 400;
    const rerollY = continueY + buttonHeight + buttonSpacing;

    // Continue button (Next Wave) - ALWAYS FIRST
    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      continueY,
      buttonWidth,
      buttonHeight,
      'Next Wave',
      false,
      true,
      isMobile
    );

    // Reroll button - ALWAYS SECOND (below continue)
    const canAffordReroll = this.player.gold >= this.shopRerollCost;
    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      rerollY,
      buttonWidth,
      buttonHeight,
      `Reroll (${this.shopRerollCost}g)`,
      false,
      canAffordReroll,
      isMobile
    );
  }

  private drawPaused(): void {
    const ctx = this.renderer.getContext();
    const isMobile = this.canvas.width < 800;

    // Dim background with stronger overlay
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Pause menu panel
    const panelWidth = isMobile ? Math.min(400, this.canvas.width - 40) : 500;
    const panelHeight = isMobile ? 450 : 400;
    const panelX = (this.canvas.width - panelWidth) / 2;
    const panelY = (this.canvas.height - panelHeight) / 2;

    // Panel background with gradient
    const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    gradient.addColorStop(0, '#2a2a2a');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Panel border
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 4;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Inner border for depth
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);

    // Title
    this.renderer.drawText('⏸ PAUSED', this.canvas.width / 2, panelY + 60, {
      size: isMobile ? 56 : 64,
      bold: true,
      align: 'center',
      color: '#4a9eff'
    });

    const buttonWidth = isMobile ? Math.min(300, panelWidth - 40) : 280;
    const buttonHeight = isMobile ? 70 : 60;
    const spacing = 20;
    const startY = panelY + 150;

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY,
      buttonWidth,
      buttonHeight,
      'Resume',
      false,
      true,
      isMobile
    );

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY + buttonHeight + spacing,
      buttonWidth,
      buttonHeight,
      'Restart Run',
      false,
      true,
      isMobile
    );

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY + (buttonHeight + spacing) * 2,
      buttonWidth,
      buttonHeight,
      'Main Menu',
      false,
      true,
      isMobile
    );
  }

  private drawUpgrades(): void {
    this.renderer.drawText('PERMANENT UPGRADES', this.canvas.width / 2, 50, {
      size: 36,
      bold: true,
      align: 'center',
      color: '#9370db'
    });

    this.renderer.drawText(`Souls: ${this.metaProgression.souls}`, this.canvas.width / 2, 100, {
      size: 24,
      bold: true,
      align: 'center',
      color: '#ffff00'
    });

    const isMobile = this.canvas.width < 800;
    const upgradeWidth = isMobile ? Math.min(350, this.canvas.width - 40) : 320;
    const upgradeHeight = isMobile ? 120 : 100;
    const gap = 15;

    const upgrades = this.metaProgression.getAllUpgrades();
    const startX = (this.canvas.width - upgradeWidth) / 2;
    const startY = 140;

    const ctx = this.renderer.getContext();

    for (let i = 0; i < upgrades.length; i++) {
      const upgrade = upgrades[i];
      const x = startX;
      const y = startY + i * (upgradeHeight + gap);

      const isMaxLevel = upgrade.currentLevel >= upgrade.maxLevel;
      const canAfford = this.metaProgression.canPurchaseUpgrade(upgrade.id);

      // Background
      ctx.fillStyle = canAfford ? '#2d4a2d' : isMaxLevel ? '#4a4a2d' : '#2a2a2a';
      ctx.fillRect(x, y, upgradeWidth, upgradeHeight);

      // Border
      ctx.strokeStyle = isMaxLevel ? '#ffff00' : canAfford ? '#00ff00' : '#666666';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, upgradeWidth, upgradeHeight);

      // Icon
      this.renderer.drawText(upgrade.icon, x + 20, y + 20, {
        size: 32
      });

      // Name
      this.renderer.drawText(upgrade.name, x + 70, y + 20, {
        size: 16,
        bold: true
      });

      // Level
      this.renderer.drawText(`[${upgrade.currentLevel}/${upgrade.maxLevel}]`, x + upgradeWidth - 60, y + 20, {
        size: 14,
        color: isMaxLevel ? '#ffff00' : '#ffffff'
      });

      // Description
      this.renderer.drawText(upgrade.description, x + 70, y + 45, {
        size: 12,
        color: '#aaaaaa'
      });

      // Cost
      if (!isMaxLevel) {
        const cost = upgrade.costs[upgrade.currentLevel];
        this.renderer.drawText(`Cost: ${cost} souls`, x + 70, y + 70, {
          size: 14,
          bold: true,
          color: canAfford ? '#00ff00' : '#ff0000'
        });
      } else {
        this.renderer.drawText('MAX LEVEL', x + 70, y + 70, {
          size: 14,
          bold: true,
          color: '#ffff00'
        });
      }
    }

    // Back button
    this.renderer.drawButton(
      this.canvas.width / 2 - 100,
      this.canvas.height - 80,
      200,
      50,
      'Back to Menu',
      false
    );
  }

  private drawGameOver(): void {
    const ctx = this.renderer.getContext();
    const isMobile = this.canvas.width < 800;

    // Dramatic dark overlay
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Title with pulsing effect
    const pulseScale = 1 + Math.sin(Date.now() / 300) * 0.05;
    ctx.save();
    ctx.translate(this.canvas.width / 2, isMobile ? 60 : 80);
    ctx.scale(pulseScale, pulseScale);
    this.renderer.drawText('💀 GAME OVER', 0, 0, {
      size: isMobile ? 56 : 72,
      bold: true,
      align: 'center',
      color: '#ef4444'
    });
    ctx.restore();

    // Stats panel
    const panelWidth = isMobile ? Math.min(380, this.canvas.width - 40) : 500;
    const panelHeight = isMobile ? 380 : 320;
    const panelX = (this.canvas.width - panelWidth) / 2;
    const panelY = isMobile ? 140 : 170;

    // Panel background with gradient
    const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
    gradient.addColorStop(0, '#2a2a2a');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

    // Panel border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    // Inner border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 3, panelY + 3, panelWidth - 6, panelHeight - 6);

    // Stats with icons
    const statsY = panelY + 50;
    const lineSpacing = isMobile ? 45 : 40;
    const statSize = isMobile ? 24 : 22;

    this.renderer.drawText(`🌊 Wave: ${this.gameOverStats.wavesReached}`, this.canvas.width / 2, statsY, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#4a9eff'
    });

    this.renderer.drawText(`⚔️ Kills: ${this.gameOverStats.enemiesKilled}`, this.canvas.width / 2, statsY + lineSpacing, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ef4444'
    });

    this.renderer.drawText(`💰 Gold: ${this.gameOverStats.goldEarned}`, this.canvas.width / 2, statsY + lineSpacing * 2, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    this.renderer.drawText(`🎁 Items: ${this.gameOverStats.itemsCollected}`, this.canvas.width / 2, statsY + lineSpacing * 3, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#a855f7'
    });

    // Souls earned (highlighted prominently)
    const soulsY = statsY + lineSpacing * 4 + 20;
    ctx.save();
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#9370db';
    this.renderer.drawText(`✨ Souls Earned: ${this.gameOverStats.soulsEarned} ✨`, this.canvas.width / 2, soulsY, {
      size: isMobile ? 32 : 36,
      bold: true,
      align: 'center',
      color: '#c084fc'
    });
    ctx.restore();

    // Buttons
    const buttonWidth = isMobile ? Math.min(300, this.canvas.width - 60) : 260;
    const buttonHeight = isMobile ? 70 : 60;
    const spacing = 18;
    const startY = this.canvas.height - (isMobile ? 240 : 220);

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY,
      buttonWidth,
      buttonHeight,
      'Try Again',
      false,
      true,
      isMobile
    );

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY + buttonHeight + spacing,
      buttonWidth,
      buttonHeight,
      'View Upgrades',
      false,
      true,
      isMobile
    );

    this.renderer.drawButton(
      this.canvas.width / 2 - buttonWidth / 2,
      startY + (buttonHeight + spacing) * 2,
      buttonWidth,
      buttonHeight,
      'Main Menu',
      false,
      true,
      isMobile
    );
  }
}
