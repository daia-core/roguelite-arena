// Main entry point - game loop and initialization

import { Game } from './Game';
import { SpriteSheet } from './sprites';
import { UISprites } from './UISprites';
import './style.css';

// Initialize sprite systems
SpriteSheet.init();
UISprites.init();

// Setup canvas
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div id="game-container">
    <canvas id="gameCanvas"></canvas>
    <div id="menu-ui">
      <button id="startBtn" class="menu-btn">New Game</button>
      <button id="continueBtn" class="menu-btn" style="display: none;">Continue</button>
      <button id="upgradesBtn" class="menu-btn">Upgrades</button>
    </div>
    <div id="joystick-zone"></div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas')!;
const game = new Game(canvas);

// Game loop
let lastTime = performance.now();
let lastState: string = game.state;

function gameLoop(currentTime: number): void {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap dt at 100ms
  lastTime = currentTime;

  game.update(dt);
  game.draw();

  // OPTIMIZATION: Update menu visibility only on state change (not polling)
  if (game.state !== lastState) {
    const menuUI = document.querySelector<HTMLDivElement>('#menu-ui')!;
    menuUI.style.display = game.state === 'menu' ? 'flex' : 'none';
    lastState = game.state;
  }

  requestAnimationFrame(gameLoop);
}

// Start game loop
requestAnimationFrame(gameLoop);

// Handle window resize
function resizeCanvas(): void {
  // Use visualViewport for mobile or fallback to window.inner*
  const viewport = window.visualViewport || {
    width: window.innerWidth,
    height: window.innerHeight
  };

  // ZOOM OUT: Render at higher resolution, scale down via CSS for zoomed-out effect
  const zoomFactor = 3.2; // 2x more zoom (was 1.6x, now 3.2x = 220% more game area)
  canvas.width = viewport.width * zoomFactor;
  canvas.height = viewport.height * zoomFactor;

  // CSS scales down to viewport size (creates zoom-out effect)
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

window.addEventListener('resize', resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeCanvas);
}
resizeCanvas();

// Menu UI visibility is now handled in game loop on state changes
