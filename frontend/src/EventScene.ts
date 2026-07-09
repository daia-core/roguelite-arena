import type { Scene } from './scenes/Scene';
import type { GameState } from './Game';
import type { Renderer } from './Renderer';
import type { Input } from './Input';
import { randomEvent, type GameEvent, type EventOption, type EventRequirement } from './EventSystem';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';
import { pointInRect } from './utils';

/**
 * The item/artifact card shown after an event option resolves (e.g. got a random artifact).
 * Returned by onOptionPicked so Game.ts doesn't have to reach into the scene's private state.
 */
export type EventReward = {
  name: string;
  rarity: string;
  desc: string;
  icon: string;
  artifactId?: string;
};

export interface EventSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;
  /**
   * Apply the chosen option's game effects and return the outcome text + optional reward card.
   * Game.ts owns all the player/artifact mutation; EventScene owns only the screen state.
   */
  onOptionPicked: (opt: EventOption) => { resultText: string; reward: EventReward | null };
  /** Called when the player clicks "Continue" — returns control to the map. */
  onDone: () => void;
  /**
   * True when the player currently meets a gated option's stat requirement.
   * Game owns PlayerStats; the scene only asks yes/no so it can lock the button.
   */
  meetsRequirement: (req: EventRequirement) => boolean;
}

/**
 * EventScene — the `?` node's text-choice screen.
 *
 * Step 4 of the incremental Game.ts de-god-classing (see ARCHITECTURE.md).
 * Logic moved verbatim from Game.drawEvent / Game.updateEvent + helpers; the only
 * change is reading shared context off deps, and returning reward data via callback
 * instead of writing to Game fields.
 */
export class EventScene implements Scene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly onOptionPicked: (opt: EventOption) => { resultText: string; reward: EventReward | null };
  private readonly onDone: () => void;
  private readonly meetsRequirement: (req: EventRequirement) => boolean;

  private currentEvent: GameEvent | null = null;
  private eventResultText: string | null = null;
  private eventReward: EventReward | null = null;
  /** Event ids seen this run — used to avoid replaying the same event back-to-back. */
  private visitedEventIds: Set<string> = new Set();

  private static readonly RARITY_COLOR: Record<string, string> = {
    common: '#cbd5e1', rare: '#74c0fc', epic: '#b06bd9', legendary: '#f2b04e',
  };

  constructor(deps: EventSceneDeps) {
    this.canvas = deps.canvas;
    this.renderer = deps.renderer;
    this.input = deps.input;
    this.onOptionPicked = deps.onOptionPicked;
    this.onDone = deps.onDone;
    this.meetsRequirement = deps.meetsRequirement;
  }

  /** An option is locked when it carries a stat gate the player doesn't yet meet. */
  private isLocked(opt: EventOption): boolean {
    return !!opt.requirement && !this.meetsRequirement(opt.requirement);
  }

  /** Button caption — appends the requirement tag so gated choices read their stake. */
  private optionLabel(opt: EventOption): string {
    if (!opt.requirement) return opt.label;
    return this.isLocked(opt)
      ? `${opt.label}  🔒 ${opt.requirement.label}`
      : `${opt.label}  ✓ ${opt.requirement.label}`;
  }

  /** Call at the start of every new run so events don't persist across runs. */
  resetVisited(): void {
    this.visitedEventIds.clear();
  }

  enter(_prev: GameState): void {
    this.currentEvent = randomEvent(this.visitedEventIds);
    if (this.currentEvent) this.visitedEventIds.add(this.currentEvent.id);
    this.eventResultText = null;
    this.eventReward = null;
    // Disarm any held press so it can't immediately register as a button tap.
    this.input.mouseDown = false;
  }

  update(_dt: number): void {
    if (!this.input.mouseDown) return;
    const ev = this.currentEvent;
    if (!ev) return;
    const { s, W, H, isMobile } = this.screenScale();
    const mx = this.input.mouseX;
    const my = this.input.mouseY;

    // Recompute the same vertical anchor the draw pass uses so hit-testing never drifts.
    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 560));
    const titlePx = s(isMobile ? 14 : 18);
    const titleLines = this.wrapText(ev.title, contentW - s(24), titlePx).length;
    let y = s(isMobile ? 26 : 34) + titleLines * (titlePx + s(4)) + s(isMobile ? 6 : 8);
    const bodyPx = s(isMobile ? 9 : 11);
    y += this.wrapText(ev.text, contentW - s(24), bodyPx).length * (bodyPx + s(5));
    y += s(10);

    if (this.eventResultText === null) {
      const rects = this.columnRects(ev.options.length, y, s, W, isMobile);
      for (let i = 0; i < ev.options.length; i++) {
        if (pointInRect(mx, my, rects[i])) {
          this.input.mouseDown = false;
          if (this.isLocked(ev.options[i])) return; // gated: unmet requirement, not selectable
          const { resultText, reward } = this.onOptionPicked(ev.options[i]);
          this.eventResultText = resultText;
          this.eventReward = reward;
          return;
        }
      }
    } else {
      y += this.wrapText(this.eventResultText, contentW - s(24), bodyPx).length * (bodyPx + s(5)) + s(10);
      const cardW = contentW - s(16);
      if (this.eventReward) y += this.rewardCardHeight(cardW, s, isMobile);
      y += s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      if (pointInRect(mx, my, r)) {
        this.input.mouseDown = false;
        this.currentEvent = null;
        this.eventResultText = null;
        this.eventReward = null;
        this.onDone();
      }
    }
    void H;
  }

  draw(): void {
    const ctx = this.renderer.getContext();
    const { s, W, H, isMobile } = this.screenScale();
    this.paintBackdrop();
    const ev = this.currentEvent;
    if (!ev) return;

    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 560));
    const x0 = (W - contentW) / 2;
    drawPanel(ctx, x0 - s(8), s(12), contentW + s(16), H - s(24), DARK_WOOD_THEME, 7, 31);

    let y = s(isMobile ? 26 : 34);
    const titlePx = s(isMobile ? 14 : 18);
    for (const line of this.wrapText(ev.title, contentW - s(24), titlePx)) {
      this.renderer.drawText(line, W / 2, y, { size: titlePx, align: 'center', color: '#ffd700' });
      y += titlePx + s(4);
    }
    y += s(isMobile ? 6 : 8);

    const bodyPx = s(isMobile ? 9 : 11);
    for (const line of this.wrapText(ev.text, contentW - s(24), bodyPx)) {
      this.renderer.drawText(line, W / 2, y, { size: bodyPx, align: 'center', color: '#d8c9a8' });
      y += bodyPx + s(5);
    }
    y += s(10);

    if (this.eventResultText === null) {
      const rects = this.columnRects(ev.options.length, y, s, W, isMobile);
      ev.options.forEach((opt, i) => {
        const r = rects[i];
        // Locked (unmet stat gate) → greyed, un-clickable; the tag shows what it needs.
        this.renderer.drawButton(r.x, r.y, r.width, r.height, this.optionLabel(opt), false, !this.isLocked(opt), isMobile);
      });
    } else {
      for (const line of this.wrapText(this.eventResultText, contentW - s(24), bodyPx)) {
        this.renderer.drawText(line, W / 2, y, { size: bodyPx, align: 'center', color: '#8ce99a' });
        y += bodyPx + s(5);
      }
      y += s(10);
      const cardW = contentW - s(16);
      if (this.eventReward) {
        this.drawRewardCard((W - cardW) / 2, y, cardW, s, isMobile);
        y += this.rewardCardHeight(cardW, s, isMobile);
      }
      y += s(12);
      const r = this.columnRects(1, y, s, W, isMobile)[0];
      this.renderer.drawButton(r.x, r.y, r.width, r.height, 'Continue', true, true, isMobile);
    }
  }

  // ---- Private helpers ----

  /** Height of the reward card (0 when no reward was granted by the event). */
  private rewardCardHeight(cardW: number, s: (v: number) => number, isMobile: boolean): number {
    if (!this.eventReward) return 0;
    const bodyPx = s(isMobile ? 8 : 9);
    const descLines = this.wrapText(this.eventReward.desc, cardW - s(24), bodyPx).length;
    return s(isMobile ? 32 : 34) + descLines * (bodyPx + s(3)) + s(10);
  }

  /** Draw the card showing the item/artifact the event just granted. */
  private drawRewardCard(x0: number, y: number, cardW: number, s: (v: number) => number, isMobile: boolean): void {
    if (!this.eventReward) return;
    const ctx = this.renderer.getContext();
    const h = this.rewardCardHeight(cardW, s, isMobile);
    drawPanel(ctx, x0, y, cardW, h, DARK_WOOD_THEME, 23, 67);
    const color = EventScene.RARITY_COLOR[this.eventReward.rarity] || '#ffffff';
    const iconBox = s(isMobile ? 26 : 28);
    const textX = x0 + s(12) + iconBox + s(8);
    const textW = cardW - (textX - x0) - s(12);
    if (this.eventReward.artifactId) {
      this.renderer.drawArtifactIcon(this.eventReward.artifactId, x0 + s(12), y + (h - iconBox) / 2, iconBox, 'left');
    } else {
      this.renderer.drawItemIcon(this.eventReward.icon, x0 + s(12), y + (h - iconBox) / 2, iconBox, 'left');
    }
    this.renderer.drawText(this.eventReward.name, textX, y + s(isMobile ? 15 : 17), { size: s(isMobile ? 11 : 13), align: 'left', color });
    this.renderer.drawText(this.eventReward.rarity.toUpperCase(), x0 + cardW - s(12), y + s(isMobile ? 15 : 17), { size: s(7), align: 'right', color });
    const bodyPx = s(isMobile ? 8 : 9);
    for (const [li, line] of this.wrapText(this.eventReward.desc, textW, bodyPx).entries()) {
      this.renderer.drawText(line, textX, y + s(isMobile ? 32 : 34) + li * (bodyPx + s(3)), { size: bodyPx, align: 'left', color: '#d8c9a8' });
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
