/**
 * AchievementsScene — the achievements browser screen (step 8 of Game.ts de-god-classing).
 *
 * Owns the achievements UI: row list, earned/disabled toggle, back button.
 * AchievementSystem (static class) is the ground truth for earned/disabled state;
 * this scene reads it directly (no callbacks needed — it's not Game.ts state).
 */

import type { Scene } from './scenes/Scene';
import { AchievementSystem, ACHIEVEMENTS } from './AchievementSystem';
import { ItemDatabase } from './ItemSystem';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { pointInRect } from './utils';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';

// ─── Deps ─────────────────────────────────────────────────────────────────────

export interface AchievementsSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;

  /** Navigate back to the previous screen (usually 'menu' or 'gameover'). */
  onBack(): void;
}

// ─── AchievementsScene ────────────────────────────────────────────────────────

export class AchievementsScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly deps: AchievementsSceneDeps;

  constructor(deps: AchievementsSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.deps = deps;
  }

  update(_dt: number): void {
    if (!this.input.mouseDown) return;
    const { rowW, rowH, gap, x0, topY, back } = this.layout();
    const mx = this.input.mouseX, my = this.input.mouseY;

    // Back button.
    if (pointInRect(mx, my, back)) {
      this.input.mouseDown = false;
      this.deps.onBack();
      return;
    }

    // Tapping an EARNED row toggles its reward item in/out of the shop pool.
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const y = topY + i * (rowH + gap);
      if (pointInRect(mx, my, { x: x0, y, width: rowW, height: rowH })) {
        this.input.mouseDown = false;
        const ach = ACHIEVEMENTS[i];
        if (AchievementSystem.isEarned(ach.id)) {
          AchievementSystem.toggleItemDisabled(ach.unlocksItemId);
        }
        return;
      }
    }
  }

  draw(): void {
    const ctx = this.renderer.getContext();
    const { s, W, isMobile, rowW, rowH, gap, x0, topY, back } = this.layout();

    // Backdrop.
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    this.renderer.drawText('ACHIEVEMENTS', W / 2, s(isMobile ? 24 : 30), { size: s(isMobile ? 15 : 20), align: 'center', color: '#ffd700' });
    this.renderer.drawText(
      `${AchievementSystem.earnedCount()} / ${ACHIEVEMENTS.length} earned  ·  tap an unlocked reward to enable/disable it`,
      W / 2, s(isMobile ? 24 : 30) + s(isMobile ? 16 : 20),
      { size: s(isMobile ? 7 : 9), align: 'center', color: '#c8b998', maxWidth: rowW }
    );

    const iconBox = s(isMobile ? 22 : 26);
    const nameX = x0 + s(10) + iconBox + s(8);
    // Split each row into a left column (name + desc) and a right column (status + reward name)
    // so the two never overlap; drawText auto-shrinks anything wider than its column.
    const rightX = x0 + rowW - s(10);
    const leftColW = rowW * 0.52;
    const rightColW = rowW * 0.42;

    ACHIEVEMENTS.forEach((ach, i) => {
      const y = topY + i * (rowH + gap);
      const earned = AchievementSystem.isEarned(ach.id);
      const disabled = earned && AchievementSystem.isItemDisabled(ach.unlocksItemId);
      const reward = ItemDatabase.getItemById(ach.unlocksItemId);

      drawPanel(ctx, x0, y, rowW, rowH, DARK_WOOD_THEME, 4, 71 + i);

      // Left icon: full-colour when earned, dimmed lock when still locked.
      this.renderer.drawText(earned ? ach.icon : '🔒', x0 + s(10) + iconBox / 2, y + rowH / 2 + s(3), { size: iconBox, align: 'center', color: '#ffffff' });

      const nameColor = earned ? '#ffd700' : '#8a7f68';
      this.renderer.drawText(ach.name, nameX, y + s(isMobile ? 13 : 15), { size: s(isMobile ? 10 : 12), align: 'left', color: nameColor, maxWidth: leftColW });
      // On earned rows the reward name occupies the right column, so clamp the desc to end
      // before it (with a gap); on locked rows the desc gets the full left column width.
      const descMaxW = earned ? Math.max(s(60), rightX - rightColW - nameX - s(8)) : leftColW;
      this.renderer.drawText(ach.desc, nameX, y + s(isMobile ? 30 : 34), { size: s(isMobile ? 7 : 8), align: 'left', color: earned ? '#d8c9a8' : '#7d735e', maxWidth: descMaxW });

      // Right column: status + (when earned) the reward it grants.
      if (earned) {
        const status = disabled ? 'DISABLED' : 'ENABLED';
        const statusColor = disabled ? '#ff6b6b' : '#8ce99a';
        this.renderer.drawText(status, rightX, y + s(isMobile ? 15 : 17), { size: s(isMobile ? 8 : 9), align: 'right', color: statusColor });
        const rewardName = reward ? `${reward.icon} ${reward.name}` : ach.unlocksItemId;
        this.renderer.drawText(rewardName, rightX, y + s(isMobile ? 31 : 35), { size: s(isMobile ? 7 : 8), align: 'right', color: disabled ? '#8a7f68' : '#c8b998', maxWidth: rightColW });
      } else {
        this.renderer.drawText('LOCKED', rightX, y + rowH / 2 + s(3), { size: s(isMobile ? 8 : 9), align: 'right', color: '#6b6250' });
      }
    });

    // Back button.
    drawPanel(ctx, back.x, back.y, back.width, back.height, DARK_WOOD_THEME, 4, 99);
    this.renderer.drawText('BACK', back.x + back.width / 2, back.y + back.height / 2 + s(4), { size: s(isMobile ? 11 : 13), align: 'center', color: '#ffd700' });
  }

  /** Shared row layout — same geometry for update() hit-testing and draw() rendering. */
  private layout() {
    const { s, W, H, isMobile } = this.screenScale();
    const rowW = Math.min(W - s(24), s(isMobile ? 360 : 520));
    const rowH = s(isMobile ? 46 : 52);
    const gap = s(8);
    const x0 = (W - rowW) / 2;
    const topY = s(isMobile ? 78 : 96);
    const backH = s(isMobile ? 34 : 38);
    const backW = Math.min(rowW, s(200));
    const backY = topY + ACHIEVEMENTS.length * (rowH + gap) + s(8);
    const back = { x: (W - backW) / 2, y: backY, width: backW, height: backH };
    return { s, W, H, isMobile, rowW, rowH, gap, x0, topY, back };
  }

  /** Zoom/scale helpers — same computation as Game.screenScale(). */
  private screenScale() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;
    return { zoom, s, W, H, isMobile };
  }
}
