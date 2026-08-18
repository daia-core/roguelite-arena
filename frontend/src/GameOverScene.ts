/**
 * GameOverScene — the game-over screen (step 7 of Game.ts de-god-classing).
 *
 * Owns the game-over UI: stat panel, buttons, achievements unlock banner.
 *
 * Game.ts retains ownership of gameOverStats / newAchievementsThisRun because
 * gameOver() populates both after the run ends; GameOverScene reads them via
 * callbacks in GameOverSceneDeps (same pattern as ShopScene/EventScene).
 */

import type { Scene } from './scenes/Scene';
import type { Achievement } from './AchievementSystem';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { pointInRect, formatShort } from './utils';

// ─── GameOverStats ────────────────────────────────────────────────────────────

export interface GameOverStats {
  wavesReached: number;
  enemiesKilled: number;
  bossesDefeated: number;
  goldEarned: number;
  itemsCollected: number;
  soulsEarned: number;
  personalBest: number;
  /** Display name of the class played this run (e.g. "Berserker"). */
  className: string;
  /** Run wall-clock duration in milliseconds. */
  runDurationMs: number;
  /** Snapshot of the items the player had when the run ended (icon + rarity for display). */
  itemsBought: Array<{ icon: string; rarity: 'common' | 'rare' | 'epic' | 'legendary' }>;
  /** Active duo synergies earned this run (icon + name + color for display). */
  duosActive: Array<{ icon: string; name: string; glowColor: string }>;
  /** Active transformations unlocked this run (icon + name + color for display). */
  transformationsActive: Array<{ icon: string; name: string; glowColor: string }>;
  /** Total enemy max-HP consumed this run — good proxy for damage dealt. */
  totalDamageDealt: number;
}

// ─── Deps ─────────────────────────────────────────────────────────────────────

export interface GameOverSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;

  /** Live read of game-over stats owned by Game.ts — populated in gameOver(). */
  getStats(): GameOverStats;
  /** Live read of achievements earned this run — populated in gameOver(). */
  getNewAchievements(): Achievement[];

  /** Navigate to class-select → begin a new run. */
  onRetry(): void;
  /** Navigate to the village upgrades screen. */
  onViewUpgrades(): void;
  /** Return to the main menu. */
  onMenu(): void;
  /** Open the achievements screen (desktop only, when achievements were earned). */
  onViewAchievements(): void;
}

// ─── GameOverScene ────────────────────────────────────────────────────────────

export class GameOverScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly deps: GameOverSceneDeps;

  constructor(deps: GameOverSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.deps = deps;
  }

  update(_dt: number): void {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;
    const isMobile = this.canvas.width < 800;
    const newAch = this.deps.getNewAchievements();
    const hasNewAch = newAch.length > 0;

    // Match draw() layout exactly so click zones align with the drawn buttons.
    const buttonWidth = isMobile ? Math.min(300, this.canvas.width - 60) : 260;
    const buttonHeight = isMobile ? 70 : 60;
    const spacing = 18;
    // Compute panel dimensions (must mirror draw() exactly for click-zone alignment).
    const updateStats = this.deps.getStats();
    const updateSynergies = [...(updateStats.transformationsActive ?? []), ...(updateStats.duosActive ?? [])];
    const updateSynRowH = updateSynergies.length > 0 ? (isMobile ? 42 : 38) : 0;
    const updatePanelH = (isMobile ? 502 : 426) + updateSynRowH;
    const updatePanelY = isMobile ? 140 : 170;
    const panelBottom = updatePanelY + updatePanelH;
    // On mobile: anchor buttons just below the panel to eliminate dead-space gap.
    // On desktop: keep legacy bottom-anchor (with extraSlot for 4th ach button).
    const extraSlot = (!isMobile && hasNewAch) ? buttonHeight + spacing : 0;
    const buttonBlockH = (buttonHeight + spacing) * 3 - spacing;
    const mobileNatural = panelBottom + 56;
    const startY = (isMobile && mobileNatural + buttonBlockH + 20 <= this.canvas.height)
      ? mobileNatural
      : this.canvas.height - (isMobile ? 240 : 220) - extraSlot;
    const bx = this.canvas.width / 2 - buttonWidth / 2;

    const retryBtn    = { x: bx, y: startY,                                width: buttonWidth, height: buttonHeight };
    const upgradesBtn = { x: bx, y: startY + (buttonHeight + spacing),     width: buttonWidth, height: buttonHeight };
    const menuBtn     = { x: bx, y: startY + (buttonHeight + spacing) * 2, width: buttonWidth, height: buttonHeight };
    const achBtn      = { x: bx, y: startY + (buttonHeight + spacing) * 3, width: buttonWidth, height: buttonHeight };

    if (pointInRect(mouseX, mouseY, retryBtn) && this.input.mouseDown) {
      this.deps.onRetry();
      this.input.mouseDown = false;
    } else if (pointInRect(mouseX, mouseY, upgradesBtn) && this.input.mouseDown) {
      this.deps.onViewUpgrades();
      this.input.mouseDown = false;
    } else if (pointInRect(mouseX, mouseY, menuBtn) && this.input.mouseDown) {
      this.deps.onMenu();
      this.input.mouseDown = false;
    } else if (!isMobile && hasNewAch && pointInRect(mouseX, mouseY, achBtn) && this.input.mouseDown) {
      this.deps.onViewAchievements();
      this.input.mouseDown = false;
    }
  }

  draw(): void {
    const ctx = this.renderer.getContext();
    const stats = this.deps.getStats();
    const newAch = this.deps.getNewAchievements();
    const isMobile = this.canvas.width < 800;

    // Synergy data (transformations first — more impressive — then duos)
    const synergies = [
      ...(stats.transformationsActive ?? []),
      ...(stats.duosActive ?? []),
    ];
    const hasSynergies = synergies.length > 0;
    const synRowH = hasSynergies ? (isMobile ? 42 : 38) : 0;

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
    this.renderer.drawText('GAME OVER', 0, 0, {
      size: isMobile ? 56 : 72,
      bold: true,
      align: 'center',
      color: '#ef4444'
    });
    ctx.restore();

    // Class + duration subtitle ("Berserker • 4:32")
    const { className, runDurationMs } = stats;
    if (className) {
      const totalSec = Math.floor(runDurationMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = String(totalSec % 60).padStart(2, '0');
      const durationLabel = runDurationMs > 0 ? `${mins}:${secs}` : '';
      const subtitle = durationLabel ? `${className}  •  ${durationLabel}` : className;
      this.renderer.drawText(subtitle, this.canvas.width / 2, isMobile ? 112 : 140, {
        size: isMobile ? 18 : 22,
        bold: false,
        align: 'center',
        color: '#9ca3af'
      });
    }

    // Stats panel — taller to fit Bosses stat + personal best + damage + optional synergy row
    const panelWidth = isMobile ? Math.min(380, this.canvas.width - 40) : 500;
    const panelHeight = (isMobile ? 502 : 426) + synRowH;
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

    // Stats rows
    const statsY = panelY + 50;
    const lineSpacing = isMobile ? 42 : 36;
    const statSize = isMobile ? 24 : 22;

    // Wave — with personal best comparison
    const { wavesReached, personalBest } = stats;
    const isNewBest = wavesReached > personalBest;
    const waveText = isNewBest
      ? `Wave: ${wavesReached}  ★ NEW BEST!`
      : `Wave: ${wavesReached}${personalBest > 0 ? `  (Best: ${personalBest})` : ''}`;
    this.renderer.drawText(waveText, this.canvas.width / 2, statsY, {
      size: statSize,
      bold: true,
      align: 'center',
      color: isNewBest ? '#fbbf24' : '#4a9eff'
    });

    this.renderer.drawText(`Kills: ${stats.enemiesKilled}`, this.canvas.width / 2, statsY + lineSpacing, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ef4444'
    });

    this.renderer.drawText(`Bosses: ${stats.bossesDefeated}`, this.canvas.width / 2, statsY + lineSpacing * 2, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#f97316'
    });

    this.renderer.drawText(`Gold: ${stats.goldEarned}`, this.canvas.width / 2, statsY + lineSpacing * 3, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#ffd700'
    });

    // Total damage dealt — key build-validation stat
    this.renderer.drawText(`Damage: ${formatShort(stats.totalDamageDealt)}`, this.canvas.width / 2, statsY + lineSpacing * 4, {
      size: statSize,
      bold: true,
      align: 'center',
      color: '#fb923c'
    });

    // Items row — icon strip if items are available, text fallback if not
    const itemRowY = statsY + lineSpacing * 5;
    const ownedItems = stats.itemsBought ?? [];
    if (ownedItems.length === 0) {
      // Fallback: plain text count (pre-patch save or empty run)
      this.renderer.drawText(`Items: ${stats.itemsCollected}`, this.canvas.width / 2, itemRowY, {
        size: statSize,
        bold: true,
        align: 'center',
        color: '#a855f7'
      });
    } else {
      // Icon strip: coloured rarity background + pixel-art icon, up to maxPerRow
      const boxSize = isMobile ? 36 : 32;
      const gap = 4;
      const stripPad = 16;
      const maxPerRow = Math.floor((panelWidth - stripPad * 2) / (boxSize + gap));
      const displayItems = ownedItems.slice(0, maxPerRow);
      const overflow = ownedItems.length - displayItems.length;
      const totalW = displayItems.length * (boxSize + gap) - gap;
      const stripStartX = Math.round(this.canvas.width / 2 - totalW / 2);
      const stripY = Math.round(itemRowY - boxSize / 2 + statSize / 2); // vertically centre in row

      const rarityBg: Record<string, string> = {
        common: '#6b7280', rare: '#3b82f6', epic: '#a855f7', legendary: '#ffd700',
      };

      displayItems.forEach((item, i) => {
        const ix = stripStartX + i * (boxSize + gap);
        const col = rarityBg[item.rarity] ?? '#6b7280';
        // Rarity tint background
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = col;
        ctx.fillRect(ix, stripY, boxSize, boxSize);
        ctx.restore();
        // Pixel-art icon (centred in box)
        this.renderer.drawItemIcon(item.icon, ix + boxSize / 2, stripY, boxSize);
        // Rarity border
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ix, stripY, boxSize, boxSize);
        ctx.restore();
      });

      // "+N more" label if items were clipped
      if (overflow > 0) {
        const labelX = stripStartX + displayItems.length * (boxSize + gap) + 2;
        const labelY = stripY + boxSize / 2;
        this.renderer.drawText(`+${overflow}`, labelX, labelY, {
          size: 13,
          bold: true,
          align: 'left',
          color: '#9ca3af',
        });
      }
    }

    // Synergy badges (duos + transformations earned this run)
    if (hasSynergies) {
      const synY = itemRowY + (isMobile ? 42 : 38); // below item strip
      const badgeFontSize = isMobile ? 13 : 12;
      const badgePadH = isMobile ? 8 : 6;
      const badgePadV = isMobile ? 5 : 4;
      const badgeGap = 8;
      ctx.font = `bold ${badgeFontSize}px Arial`;

      // Measure all badges so we can centre the row
      const badges = synergies.map(s => {
        const label = `${s.icon} ${s.name}`;
        const textW = ctx.measureText(label).width;
        return { label, textW, color: s.glowColor };
      });
      const totalW = badges.reduce((acc, b) => acc + b.textW + badgePadH * 2, 0)
        + badgeGap * (badges.length - 1);
      let bx2 = Math.round(this.canvas.width / 2 - totalW / 2);

      for (const badge of badges) {
        const bw = badge.textW + badgePadH * 2;
        const bh = badgeFontSize + badgePadV * 2;
        const by = synY - badgeFontSize - badgePadV;
        // Background
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = badge.color;
        ctx.fillRect(bx2, by, bw, bh);
        ctx.restore();
        // Border
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = badge.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx2, by, bw, bh);
        ctx.restore();
        // Text
        ctx.save();
        ctx.font = `bold ${badgeFontSize}px Arial`;
        ctx.fillStyle = badge.color;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(badge.label, bx2 + badgePadH, synY - badgePadV);
        ctx.restore();
        bx2 += bw + badgeGap;
      }
    }

    // Souls earned (highlighted prominently) — pushed down when synergy row is present
    const soulsY = statsY + lineSpacing * 6 + 20 + synRowH;
    ctx.save();
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#9370db';
    this.renderer.drawText(`Souls Earned: ${stats.soulsEarned}`, this.canvas.width / 2, soulsY, {
      size: isMobile ? 32 : 36,
      bold: true,
      align: 'center',
      color: '#c084fc'
    });
    ctx.restore();

    // Newly-earned achievements this run — gold "★ UNLOCKED" banner so the reward
    // is visible the moment it's earned (the item is already live for the next run).
    if (newAch.length > 0) {
      const unlockY = soulsY + (isMobile ? 44 : 40);
      const first = newAch[0];
      const extra = newAch.length - 1;
      const label = extra > 0
        ? `★ UNLOCKED: ${first.name} +${extra} more`
        : `★ UNLOCKED: ${first.name}`;
      this.renderer.drawText(label, this.canvas.width / 2, unlockY, {
        size: isMobile ? 18 : 20,
        bold: true,
        align: 'center',
        color: '#fbbf24'
      });
    }

    // Buttons
    const buttonWidth = isMobile ? Math.min(300, this.canvas.width - 60) : 260;
    const buttonHeight = isMobile ? 70 : 60;
    const spacing = 18;
    const hasNewAch = newAch.length > 0;
    // On mobile: anchor buttons just below the panel to eliminate the dead-space gap.
    // On desktop: keep legacy bottom-anchor (extraSlot reserves room for 4th ach button).
    const extraSlot = (!isMobile && hasNewAch) ? buttonHeight + spacing : 0;
    const panelBottomDraw = panelY + panelHeight;
    const buttonBlockHDraw = (buttonHeight + spacing) * 3 - spacing;
    const mobileNaturalDraw = panelBottomDraw + 56;
    const startY = (isMobile && mobileNaturalDraw + buttonBlockHDraw + 20 <= this.canvas.height)
      ? mobileNaturalDraw
      : this.canvas.height - (isMobile ? 240 : 220) - extraSlot;
    const bx = this.canvas.width / 2 - buttonWidth / 2;

    this.renderer.drawButton(bx, startY, buttonWidth, buttonHeight, 'Try Again', false, true, isMobile);
    this.renderer.drawButton(bx, startY + (buttonHeight + spacing), buttonWidth, buttonHeight, 'View Upgrades', false, true, isMobile);
    this.renderer.drawButton(bx, startY + (buttonHeight + spacing) * 2, buttonWidth, buttonHeight, 'Main Menu', false, true, isMobile);

    // Desktop only: "View Achievements" button when a new achievement was earned this run.
    if (!isMobile && hasNewAch) {
      this.renderer.drawButton(bx, startY + (buttonHeight + spacing) * 3, buttonWidth, buttonHeight, '🏆 View Achievements', false, true, isMobile);
    }
  }
}
