// Main entry point - game loop and initialization

import { Game } from './Game';
import { SpriteSheet } from './sprites';
import './style.css';

// Initialize sprite system
SpriteSheet.init();

// Setup canvas
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div id="game-container">
    <canvas id="gameCanvas" width="1200" height="800"></canvas>
    <div id="menu-ui">
      <button id="startBtn" class="menu-btn">New Game</button>
      <button id="continueBtn" class="menu-btn" style="display: none;">Continue</button>
    </div>
    <div id="touch-controls">
      <button id="dashBtn" class="ability-btn">DASH</button>
      <button id="blastBtn" class="ability-btn">BLAST</button>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas')!;
const game = new Game(canvas);

// Game loop
let lastTime = performance.now();

function gameLoop(currentTime: number): void {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap dt at 100ms
  lastTime = currentTime;

  game.update(dt);
  game.draw();

  requestAnimationFrame(gameLoop);
}

// Start game loop
requestAnimationFrame(gameLoop);

// Handle window resize
function resizeCanvas(): void {
  const container = document.querySelector<HTMLDivElement>('#game-container')!;
  const rect = container.getBoundingClientRect();

  const aspectRatio = 1200 / 800;
  let width = rect.width;
  let height = width / aspectRatio;

  if (height > rect.height) {
    height = rect.height;
    width = height * aspectRatio;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Hide menu UI when playing
setInterval(() => {
  const menuUI = document.querySelector<HTMLDivElement>('#menu-ui')!;
  if (game.state === 'menu') {
    menuUI.style.display = 'flex';
  } else {
    menuUI.style.display = 'none';
  }

  // Show/hide touch controls based on state
  const touchControls = document.querySelector<HTMLDivElement>('#touch-controls')!;
  if (game.state === 'playing') {
    touchControls.style.display = 'flex';
  } else {
    touchControls.style.display = 'none';
  }
}, 100);
