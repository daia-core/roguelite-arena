import type { Scene } from './scenes/Scene';
import type { GameState } from './Game';
import type { Renderer } from './Renderer';
import type { Input } from './Input';
import { AudioManager } from './AudioManager';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';
import { pointInRect } from './utils';

export interface RestSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;
  audio: AudioManager;
  /**
   * Apply the chosen option's game effects (heal or train) and return the
   * outcome text to display. Game.ts owns all player/stat mutation;
   * RestScene owns only the screen state.
   */
  onChoose: (choice: 'rest' | 'train') => string;
  /** Called when the player clicks "Continue" — returns control to the map. */
  onDone: () => void;
  /** Returns the current wave number so we can warn when a boss wave is next. */
  getWave?: () => number;
  /** Returns current and max player HP so the scene can show concrete heal value. */
  getPlayerHp?: () => { current: number; max: number };
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
  private readonly audio: AudioManager;
  private readonly onChoose: (choice: 'rest' | 'train') => string;
  private readonly onDone: () => void;
  private readonly getWave?: () => number;
  private readonly getPlayerHp?: () => { current: number; max: number };

  private restResolved: boolean = false;
  private restResultText: string = '';

  constructor(deps: RestSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.audio = deps.audio;
    this.onChoose = deps.onChoose;
    this.onDone = deps.onDone;
    this.getWave = deps.getWave;
    this.getPlayerHp = deps.getPlayerHp;
  }

  /** Returns boss-wave-next info for use in both draw() and update(). */
  private bossWaveNext(): { is: boolean; waveNum: number } {
    const w = this.getWave ? this.getWave() : 0;
    const next = w + 1;
    return { is: w > 0 && next % 10 === 0, waveNum: next };
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
      // Keep in sync with draw(): HP line (if available) + subtitle line.
      const hp = this.getPlayerHp ? this.getPlayerHp() : null;
      if (hp) { y += s(isMobile ? 13 : 16); }   // HP: X / Y line
      y += s(isMobile ? 15 : 18);                 // "Take a moment" subtitle
      // Boss-wave warning shifts the button row down — keep in sync with draw().
      const bwn = this.bossWaveNext();
      if (bwn.is) y += s(isMobile ? 8 : 7) + s(6);
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
        this.audio.playMapNavigate(); // GAME FEEL: soft nav cue on Continue → map
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
      // Show current HP so the player can make an informed rest-vs-train call.
      const hp = this.getPlayerHp ? this.getPlayerHp() : null;
      // HP colour: red when wounded (<50%), yellow when partial, white when healthy.
      const hpColor = hp && hp.current < hp.max * 0.5
        ? '#ff6b6b'
        : hp && hp.current < hp.max
          ? '#ffe066'
          : '#d8c9a8';
      if (hp) {
        // Show HP on its own line so it doesn't clip on narrow mobile viewports.
        this.renderer.drawText(`HP: ${hp.current} / ${hp.max}`, W / 2, y, { size: bodyPx, align: 'center', color: hpColor });
        y += s(isMobile ? 13 : 16);
        this.renderer.drawText('Take a moment. Choose one.', W / 2, y, { size: s(isMobile ? 7 : 9), align: 'center', color: '#d8c9a8' });
      } else {
        this.renderer.drawText('Take a moment. Choose one.', W / 2, y, { size: bodyPx, align: 'center', color: '#d8c9a8' });
      }
      y += s(isMobile ? 15 : 18);

      // Boss-wave-incoming warning — shown when the next combat wave is a boss wave (wave % 10 === 0).
      // Rest is the smarter choice when a boss looms: survive to spend, not train to die.
      const bwn = this.bossWaveNext();
      if (bwn.is) {
        const warnSize = s(isMobile ? 8 : 7);
        this.renderer.drawText(
          `⚠ BOSS WAVE ${bwn.waveNum} INCOMING — rest up!`,
          W / 2, y,
          { size: warnSize, align: 'center', color: '#ff6b6b' }
        );
        y += warnSize + s(6);
      }

      // Compute the concrete rest heal amount for the button label (no Unicode arrows — pixel font).
      const healAmt = hp ? Math.round(0.4 * hp.max) : null;
      const restLabel = hp && hp.current >= hp.max
        ? 'Rest — already at full HP'
        : healAmt !== null
          ? `Rest — +${Math.min(healAmt, hp!.max - hp!.current)} HP`
          : 'Rest — heal 40% HP';

      const rects = this.columnRects(2, y, s, W, isMobile);
      this.renderer.drawButton(rects[0].x, rects[0].y, rects[0].width, rects[0].height, restLabel, false, true, isMobile);
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
