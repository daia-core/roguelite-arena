// Main entry point - game loop and initialization

import { Game } from './Game';
import { SpriteSheet } from './sprites';
import { UISprites } from './UISprites';
import { panelCanvas, WOOD_THEME } from './pixel/panel';
import './style.css';

// Initialize sprite systems
SpriteSheet.init();
UISprites.init();

// Pixel-art wood textures for the DOM menu buttons (see .menu-btn in style.css)
const HOVER_WOOD = { ...WOOD_THEME, face: '#9a6a3e', faceLight: '#b98756', faceDark: '#7a4e2a' };
document.documentElement.style.setProperty(
  '--pixel-btn',
  `url(${panelCanvas(260, 72, WOOD_THEME, 4).toDataURL()})`
);
document.documentElement.style.setProperty(
  '--pixel-btn-hover',
  `url(${panelCanvas(260, 72, HOVER_WOOD, 4, 5).toDataURL()})`
);

// Setup canvas
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div id="game-container">
    <canvas id="gameCanvas"></canvas>
    <div id="menu-ui">
      <button id="startBtn" class="menu-btn">New Game</button>
      <button id="continueBtn" class="menu-btn" style="display: none;">Continue</button>
      <button id="upgradesBtn" class="menu-btn">Village</button>
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

  // The world IS the canvas (no camera): zoomFactor sets how much arena fits on
  // screen. 3.2 made 128px sprites display at ~40px — far too small to read as
  // chunky pixel art. 1.6 shows sprites at ~80px (Brotato scale); small screens
  // get a bit more room to kite.
  const zoomFactor = viewport.width < 500 ? 2.0 : 1.6;
  canvas.width = Math.round(viewport.width * zoomFactor);
  canvas.height = Math.round(viewport.height * zoomFactor);

  // CSS scales down to viewport size (creates zoom-out effect)
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  // Let the game rebuild size-dependent structures (quadtrees, pathfinding grid)
  window.dispatchEvent(new Event('game-resize'));
}

window.addEventListener('resize', resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeCanvas);
}
resizeCanvas();

// Menu UI visibility is now handled in game loop on state changes
