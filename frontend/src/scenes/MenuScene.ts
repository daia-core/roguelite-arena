import type { Scene } from './Scene';
import type { Game } from '../Game';
import { SaveManager } from '../SaveManager';

/**
 * The title / main-menu screen. First scene extracted out of `Game.ts` as the pilot for
 * the Scene split (ARCHITECTURE-REVIEW.md step 1). Logic is moved verbatim from the old
 * `Game.updateMenu` / `Game.drawMenu`; the only change is reading the shared context
 * (`canvas`, `renderer`, `metaProgression`) off the `Game` instance instead of `this`.
 */
export class MenuScene implements Scene {
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  update(): void {
    // Update continue button visibility
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
      continueBtn.style.display = SaveManager.hasSavedRun() ? 'block' : 'none';
    }
  }

  draw(): void {
    const { canvas, renderer, metaProgression } = this.game;
    const zoom = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const cx = canvas.width / 2;

    // Title with a hard drop shadow for a chunky pixel look
    renderer.drawText('ROGUELITE', cx + s(4), s(64) + s(4), {
      size: s(42), align: 'center', color: '#241407', stroke: false
    });
    renderer.drawText('ROGUELITE', cx, s(64), {
      size: s(42), align: 'center', color: '#f2d94e', strokeWidth: s(4)
    });

    // Auto-fit long lines to the viewport so they never clip off narrow portrait.
    const textMax = canvas.width - s(24);
    renderer.drawText('WASD OR TOUCH JOYSTICK', cx, s(140), {
      size: s(10), align: 'center', color: '#dfe6ee', maxWidth: textMax
    });
    renderer.drawText('BUILD A BROKEN BUILD IN THE SHOP. SURVIVE.', cx, s(162), {
      size: s(10), align: 'center', color: '#dfe6ee', maxWidth: textMax
    });

    renderer.drawText(`SOULS ${metaProgression.souls}`, cx, s(196), {
      size: s(14), align: 'center', color: '#b197fc', maxWidth: textMax
    });

    const stats = SaveManager.getStats();
    renderer.drawText(
      `BEST WAVE ${stats.highestWave}   RUNS ${stats.totalRuns}   KILLS ${stats.totalKills}`,
      cx, s(226), { size: s(9), align: 'center', color: '#aab6c3', maxWidth: textMax }
    );
  }
}
