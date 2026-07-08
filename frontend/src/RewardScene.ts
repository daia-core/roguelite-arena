/**
 * RewardScene — the artifact-pick screen (step 10 of Game.ts de-god-classing).
 *
 * Shown after wave clears, boss kills, elite kills, and treasure rooms.
 * Game.ts retains reward state (choices, title, skippable, continuation callback)
 * via offerArtifactReward(); RewardScene reads it through getters and fires
 * onSelectArtifact / onSkip when the player acts.
 */

import type { Scene } from './scenes/Scene';
import type { Artifact } from './ArtifactSystem';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { pointInRect } from './utils';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';

// ─── Deps ─────────────────────────────────────────────────────────────────────

export interface RewardSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;

  /** The 1-of-3 artifact choices currently on offer (empty until offerArtifactReward). */
  getRewardChoices(): Artifact[];
  /** Screen header text (e.g. "BOSS SPOILS"). */
  getRewardTitle(): string;
  /** Whether a Skip / Decline button should be rendered. */
  isRewardSkippable(): boolean;

  /** Player picked an artifact — Game grants it, clears state, and runs continuation. */
  onSelectArtifact(artifact: Artifact): void;
  /** Player clicked Skip — Game clears state and runs continuation. */
  onSkip(): void;
}

// ─── RewardScene ──────────────────────────────────────────────────────────────

export class RewardScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly deps: RewardSceneDeps;

  constructor(deps: RewardSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.deps = deps;
  }

  // ─── Scene interface ────────────────────────────────────────────────────────

  update(_dt: number): void {
    if (!this.input.mouseDown) return;
    const { s, W, isMobile } = this.screenScale();
    const choices = this.deps.getRewardChoices();
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
    const cardH = s(isMobile ? 74 : 68);
    const gap = s(12);
    const x0 = (W - cardW) / 2;
    const topY = s(isMobile ? 72 : 92);
    const mx = this.input.mouseX;
    const my = this.input.mouseY;

    for (let i = 0; i < choices.length; i++) {
      const y = topY + i * (cardH + gap);
      if (pointInRect(mx, my, { x: x0, y, width: cardW, height: cardH })) {
        this.input.mouseDown = false;
        this.deps.onSelectArtifact(choices[i]);
        return;
      }
    }

    // Skip button — same geometry as the draw pass so hit-test never drifts.
    if (this.deps.isRewardSkippable()) {
      const skipY = topY + choices.length * (cardH + gap) + s(4);
      const r = this.columnRects(1, skipY, s, W, isMobile)[0];
      if (pointInRect(mx, my, r)) {
        this.input.mouseDown = false;
        this.deps.onSkip();
      }
    }
  }

  draw(): void {
    const ctx = this.renderer.getContext();
    const { s, W, isMobile } = this.screenScale();
    const choices = this.deps.getRewardChoices();
    const title = this.deps.getRewardTitle();

    // Dark parchment backdrop.
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    // Header.
    this.renderer.drawText(title || 'CHOOSE AN ARTIFACT', W / 2, s(isMobile ? 26 : 34), {
      size: s(isMobile ? 14 : 20), align: 'center', color: '#ffd700',
    });
    this.renderer.drawText('Artifacts last the whole run', W / 2, s(isMobile ? 26 : 34) + s(isMobile ? 16 : 20), {
      size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998',
    });

    // Artifact cards.
    const rarityColor: Record<string, string> = { rare: '#74c0fc', epic: '#b06bd9', legendary: '#f2b04e' };
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
    const cardH = s(isMobile ? 74 : 68);
    const gap = s(12);
    const x0 = (W - cardW) / 2;
    const topY = s(isMobile ? 72 : 92);
    const bodyPx = s(isMobile ? 8 : 9);
    const iconBox = s(isMobile ? 28 : 30);
    const textX = x0 + s(12) + iconBox + s(8);
    const textW = cardW - (textX - x0) - s(12);

    choices.forEach((a, i) => {
      const y = topY + i * (cardH + gap);
      drawPanel(ctx, x0, y, cardW, cardH, DARK_WOOD_THEME, 11 + i, 53);
      this.renderer.drawArtifactIcon(a.id, x0 + s(12), y + (cardH - iconBox) / 2, iconBox, 'left');
      this.renderer.drawText(a.name, textX, y + s(isMobile ? 16 : 18), {
        size: s(isMobile ? 11 : 13), align: 'left', color: rarityColor[a.rarity] || '#ffffff',
      });
      this.renderer.drawText(a.rarity.toUpperCase(), x0 + cardW - s(12), y + s(isMobile ? 16 : 18), {
        size: s(7), align: 'right', color: rarityColor[a.rarity] || '#ffffff',
      });
      for (const [li, line] of this.renderer.wrapLines(a.desc, textW, bodyPx).entries()) {
        this.renderer.drawText(line, textX, y + s(isMobile ? 34 : 36) + li * (bodyPx + s(3)), {
          size: bodyPx, align: 'left', color: '#d8c9a8',
        });
      }
    });

    // Optional Skip / Decline button.
    if (this.deps.isRewardSkippable()) {
      const skipY = topY + choices.length * (cardH + gap) + s(4);
      const r = this.columnRects(1, skipY, s, W, isMobile)[0];
      this.renderer.drawButton(r.x, r.y, r.width, r.height, 'Skip', false, true, isMobile);
    }
  }

  // ─── Private layout helpers ─────────────────────────────────────────────────

  /** DPI-aware scale helpers — mirrors Game.ts screenScale(). */
  private screenScale() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;
    return { zoom, s, W, H, isMobile };
  }

  /** Centred vertical stack of button rects — identical geometry to Game.ts columnRects(). */
  private columnRects(
    n: number,
    topY: number,
    s: (v: number) => number,
    W: number,
    isMobile: boolean,
  ): { x: number; y: number; width: number; height: number }[] {
    const bw = Math.min(W - s(40), s(isMobile ? 320 : 440));
    const bh = s(isMobile ? 54 : 48);
    const gap = s(12);
    const x = (W - bw) / 2;
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < n; i++) rects.push({ x, y: topY + i * (bh + gap), width: bw, height: bh });
    return rects;
  }
}
