import type { Scene } from './scenes/Scene';
import type { GameState } from './Game';
import type { Renderer } from './Renderer';
import type { Input } from './Input';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';
import { pointInRect } from './utils';

export interface RestSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;
  /**
   * Apply the chosen option's game effects (heal or train) and return the
   * outcome text to display. Game.ts owns all player/stat mutation;
   * RestScene owns only the screen state.
   */
  onChoose: (choice: 'rest' | 'train') => string;
  /** Called when the player clicks "Continue" — returns control to the map. */
  onDone: () => void;
}

/**
 * RestScene — the campfire node's heal-or-upgrade screen.
 *
 * Step 5 of the incremental Game.ts de-god-classing (see ARCHITECTURE.md).
 * Logic moved verbatim from Game.drawRest / Game.updateRest; the only change is
 * reading shared context off deps and returning effect data via callback instead
 * of writing to Game fields.
 */
export class RestScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly onChoose: (choice: 'rest' | 'train') => string;
  private readonly onDone: () => void;

  private restResolved: boolean = false;
  private restResultText: string = '';

  constructor(deps: RestSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.onChoose = deps.onChoose;
    this.onDone = deps.onDone;
  }

  enter(_prev: GameState): void {
    this.restResolved = false;
    this.restResultText = '';
    // Disarm any held press so it can't immediately register as a button tap.
    this.input.mouseDown = false;
  }

  update(_dt: number): void {
    if (!this.input.mouseDown) return;
    const { s, W, H, isMobile } = this.screenScale();
    const mx = this.input.mouseX;
    const my = this.input.mouseY;
    let y = s(isMobile ? 30 : 40) + s(isMobile ? 22 : 28);

    if (!this.restResolved) {
      y += s(isMobile ? 18 : 22);
      const rects = this.columnRects(2, y, s, W, isMobile);
      if (pointInRect(mx, my, rects[0])) {
        this.input.mouseDown = false;
        this.restResultText = this.onChoose('rest');
        this.restResolved = true;
        return;
      }
      if (pointInRect(mx, my, rects[1])) {
        this.input.mouseDown = false;
        this.restResultText = this.onChoose('train');
        this.restResolved = true;
        return;
      }
    } else {
      const contentW = Math.min(W - s(24), s(isMobile ? 372 : 520));
      const bodyPx = s(isMobile ? 9 : 11);
      y += this.wrapText(this.restResultText, contentW - s(24), bodyPx).length * (bodyPx + s(5)) + s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      if (pointInRect(mx, my, r)) {
        this.input.mouseDown = false;
        this.onDone();
      }
    }
    void H;
  }

  draw(): void {
    const ctx = this.renderer.getContext();
    const { s, W, H, isMobile } = this.screenScale();
    this.paintBackdrop();

    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 520));
    const x0 = (W - contentW) / 2;
    drawPanel(ctx, x0 - s(8), s(12), contentW + s(16), H - s(24), DARK_WOOD_THEME, 19, 61);

    let y = s(isMobile ? 30 : 40);
    this.renderer.drawText('A QUIET CAMPFIRE', W / 2, y, { size: s(isMobile ? 14 : 18), align: 'center', color: '#ffd700' });
    y += s(isMobile ? 22 : 28);
    const bodyPx = s(isMobile ? 9 : 11);

    if (!this.restResolved) {
      this.renderer.drawText('Take a moment. Choose one.', W / 2, y, { size: bodyPx, align: 'center', color: '#d8c9a8' });
      y += s(isMobile ? 18 : 22);
      const rects = this.columnRects(2, y, s, W, isMobile);
      this.renderer.drawButton(rects[0].x, rects[0].y, rects[0].width, rects[0].height, 'Rest — heal 40% HP', false, true, isMobile);
      this.renderer.drawButton(rects[1].x, rects[1].y, rects[1].width, rects[1].height, 'Train — +15 max HP', false, true, isMobile);
    } else {
      for (const line of this.wrapText(this.restResultText, contentW - s(24), bodyPx)) {
        this.renderer.drawText(line, W / 2, y, { size: bodyPx, align: 'center', color: '#8ce99a' });
        y += bodyPx + s(5);
      }
      y += s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      this.renderer.drawButton(r.x, r.y, r.width, r.height, 'Continue', true, true, isMobile);
    }
  }

  /** Zoom-scale helper — same computation as Game.screenScale(). */
  private screenScale() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;
    return { zoom, s, W, H, isMobile };
  }

  /** Centred vertical stack of button rects — geometry draw & update share. */
  private columnRects(n: number, topY: number, s: (v: number) => number, W: number, isMobile: boolean) {
    const bw = Math.min(W - s(40), s(isMobile ? 320 : 440));
    const bh = s(isMobile ? 54 : 48);
    const gap = s(12);
    const x = (W - bw) / 2;
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < n; i++) rects.push({ x, y: topY + i * (bh + gap), width: bw, height: bh });
    return rects;
  }

  /** Word-wrap — delegates to the renderer's canonical wrapLines. */
  private wrapText(text: string, maxWidth: number, fontPx: number): string[] {
    return this.renderer.wrapLines(text, maxWidth, fontPx);
  }

  /** Dark parchment background. */
  private paintBackdrop(): void {
    const ctx = this.renderer.getContext();
    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
}
