/**
 * PauseScene — the in-run pause overlay (step 11 of Game.ts de-god-classing).
 *
 * Owns the pause menu UI and input: Resume / Sound toggle / End Run /
 * Restart Run / Main Menu. Renders the frozen arena behind the overlay via
 * `drawPlayingUnderlay` callback (Game.ts keeps drawPlaying because the arena
 * draw is also needed while the game is actually running).
 */

import type { Scene } from './scenes/Scene';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { MetaProgression } from './MetaProgression';
import { pointInRect } from './utils';

// ─── Deps ─────────────────────────────────────────────────────────────────────

export interface PauseSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;
  audio: AudioManager;

  /** Render the frozen arena behind the pause overlay. */
  drawPlayingUnderlay(): void;
  /** Live read of the current wave number. */
  getCurrentWave(): number;
  /** Live read of boss kills this run. */
  getBossKills(): number;

  /** Resume to playing state. */
  onResume(): void;
  /** Cash out souls and end the run now. */
  onEndRun(): void;
  /** Restart from class select. */
  onRestartRun(): void;
  /** Return to main menu (abandons the run). */
  onMainMenu(): void;
}

// ─── PauseScene ───────────────────────────────────────────────────────────────

export class PauseScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly audio: AudioManager;
  private readonly deps: PauseSceneDeps;

  constructor(deps: PauseSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.audio = deps.audio;
    this.deps = deps;
  }

  update(_dt: number): void {
    if (!this.input.mouseDown) return;
    const { s, W, isMobile } = this.screenScale();
    const rects = this.columnRects(5, this.pausedTopY(s, isMobile), s, W, isMobile);
    const mx = this.input.mouseX;
    const my = this.input.mouseY;

    if (pointInRect(mx, my, rects[0])) {          // Resume
      this.input.mouseDown = false;
      this.deps.onResume();
    } else if (pointInRect(mx, my, rects[1])) {   // Sound toggle
      this.audio.toggle();
      this.input.mouseDown = false;
    } else if (pointInRect(mx, my, rects[2])) {   // End Run — cash out souls now
      this.input.mouseDown = false;
      this.deps.onEndRun();
    } else if (pointInRect(mx, my, rects[3])) {   // Restart Run
      this.input.mouseDown = false;
      this.deps.onRestartRun();
    } else if (pointInRect(mx, my, rects[4])) {   // Main Menu (abandons the run)
      this.input.mouseDown = false;
      this.deps.onMainMenu();
    }
  }

  draw(): void {
    // Keep the frozen arena visible behind the overlay so pause reads as
    // "stopped mid-run", not a blank screen.
    this.deps.drawPlayingUnderlay();

    const ctx = this.renderer.getContext();
    const { s, W, H, isMobile } = this.screenScale();

    // Dim the arena.
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const titleY = s(isMobile ? 96 : 100);
    this.renderer.drawText('PAUSED', W / 2, titleY, {
      size: s(isMobile ? 26 : 40), bold: true, align: 'center', color: '#ffd700',
    });

    // Make "End Run" an informed choice: show what banking now is worth.
    const wave = this.deps.getCurrentWave();
    const souls = MetaProgression.calculateSoulsEarned(wave, this.deps.getBossKills());
    this.renderer.drawText(
      `Wave ${wave}  ·  end now to bank ${souls} souls`,
      W / 2, titleY + s(isMobile ? 24 : 34),
      { size: s(isMobile ? 10 : 12), align: 'center', color: '#c8b998' }
    );

    const labels = [
      'Resume',
      this.audio.isEnabled() ? 'Sound: On' : 'Sound: Off',
      'End Run',
      'Restart Run',
      'Main Menu',
    ];
    const rects = this.columnRects(labels.length, this.pausedTopY(s, isMobile), s, W, isMobile);
    for (let i = 0; i < labels.length; i++) {
      const r = rects[i];
      this.renderer.drawButton(r.x, r.y, r.width, r.height, labels[i], false, true, isMobile);
    }
  }

  // ─── Shared geometry helpers ─────────────────────────────────────────────────

  /** Pause/menu overlay buttons — shared topY so draw and update never drift. */
  private pausedTopY(s: (v: number) => number, isMobile: boolean): number {
    return s(isMobile ? 150 : 172);
  }

  private screenScale() {
    const zoom = this.canvas.clientWidth ? this.canvas.width / this.canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const isMobile = W / zoom < 800;
    return { zoom, s, W, H, isMobile };
  }

  /** A centred vertical stack of button rects — geometry both draw & update use. */
  private columnRects(n: number, topY: number, s: (v: number) => number, W: number, isMobile: boolean) {
    const bw = Math.min(W - s(40), s(isMobile ? 320 : 440));
    const bh = s(isMobile ? 54 : 48);
    const gap = s(12);
    const x = (W - bw) / 2;
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < n; i++) rects.push({ x, y: topY + i * (bh + gap), width: bw, height: bh });
    return rects;
  }
}
