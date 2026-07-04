import type { GameState } from '../Game';

/**
 * A single game screen (menu, shop, map, …), owning its own render + input for one
 * `GameState`. The keystone of the incremental `Game.ts` de-god-classing (see
 * ARCHITECTURE-REVIEW.md): each `updateX`/`drawX` pair moves into a `Scene` behind this
 * interface, while `Game` keeps only the shared context (player, systems, renderer,
 * input) and the state machine that dispatches to the active scene.
 *
 * Scenes read the shared context from the `Game` instance handed to them at
 * construction. `enter`/`exit` are the single home for per-transition setup/teardown
 * (e.g. the input-disarm-on-screen-change rule).
 */
export interface Scene {
  /** Called once when this scene becomes active. `prev` is the state left behind. */
  enter?(prev: GameState): void;
  /** Per-frame logic. `dt` is seconds since last frame. */
  update(dt: number): void;
  /** Per-frame render. Scenes draw via the shared `renderer` on the game context. */
  draw(): void;
  /** Called once when leaving this scene. `next` is the state being entered. */
  exit?(next: GameState): void;
}
