/**
 * ClassSelectScene — the class selection screen (step 9 of Game.ts de-god-classing).
 *
 * Shown at the start of every run (openClassSelect → state 'classselect').
 * Picking a class card calls onSelectClass(), which triggers beginRun() in Game.ts.
 */

import type { Scene } from './scenes/Scene';
import { STARTING_CLASSES, type StartingClass } from './Classes';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { pointInRect } from './utils';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';

// ─── Deps ─────────────────────────────────────────────────────────────────────

export interface ClassSelectSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;

  /** Called when the player taps a class card; Game.ts runs beginRun(). */
  onSelectClass(cls: StartingClass): void;
}

// ─── ClassSelectScene ─────────────────────────────────────────────────────────

export class ClassSelectScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly deps: ClassSelectSceneDeps;

  constructor(deps: ClassSelectSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.deps = deps;
  }

  update(_dt: number): void {
    if (!this.input.mouseDown) return;
    const { cardW, cardH, gap, x0, topY } = this.layout();
    const mx = this.input.mouseX, my = this.input.mouseY;
    for (let i = 0; i < STARTING_CLASSES.length; i++) {
      const y = topY + i * (cardH + gap);
      if (pointInRect(mx, my, { x: x0, y, width: cardW, height: cardH })) {
        this.input.mouseDown = false;
        this.deps.onSelectClass(STARTING_CLASSES[i]);
        return;
      }
    }
  }

  draw(): void {
    const ctx = this.renderer.getContext();
    const { s, W, isMobile, cardW, cardH, gap, x0, topY } = this.layout();

    // Backdrop.
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    this.renderer.drawText('CHOOSE YOUR CLASS', W / 2, s(isMobile ? 26 : 34), { size: s(isMobile ? 14 : 20), align: 'center', color: '#ffd700' });
    this.renderer.drawText('Your starting weapon & stat tilt for the run', W / 2, s(isMobile ? 26 : 34) + s(isMobile ? 16 : 20), { size: s(isMobile ? 8 : 9), align: 'center', color: '#c8b998' });

    const bodyPx = s(isMobile ? 8 : 9);
    const iconBox = s(isMobile ? 30 : 32);
    const textX = x0 + s(12) + iconBox + s(8);
    const textW = cardW - (textX - x0) - s(12);

    STARTING_CLASSES.forEach((cls, i) => {
      const y = topY + i * (cardH + gap);
      drawPanel(ctx, x0, y, cardW, cardH, DARK_WOOD_THEME, 11 + i, 53);
      this.renderer.drawText(cls.icon, x0 + s(12) + iconBox / 2, y + cardH / 2 + s(4), { size: iconBox, align: 'center', color: '#ffffff' });
      this.renderer.drawText(cls.name, textX, y + s(isMobile ? 16 : 18), { size: s(isMobile ? 12 : 14), align: 'left', color: '#ffd700' });
      for (const [li, line] of this.renderer.wrapLines(cls.blurb, textW, bodyPx).entries()) {
        this.renderer.drawText(line, textX, y + s(isMobile ? 32 : 34) + li * (bodyPx + s(3)), { size: bodyPx, align: 'left', color: '#d8c9a8' });
      }
    });
  }

  /** Shared card layout — same geometry for update() hit-testing and draw() rendering. */
  private layout() {
    const { s, W, isMobile } = this.screenScale();
    const cardW = Math.min(W - s(32), s(isMobile ? 340 : 460));
    const cardH = s(isMobile ? 70 : 66);
    const gap = s(12);
    const x0 = (W - cardW) / 2;
    const topY = s(isMobile ? 64 : 88);
    return { s, W, isMobile, cardW, cardH, gap, x0, topY };
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
