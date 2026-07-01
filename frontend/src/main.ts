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
    <canvas id="gameCanvas"></canvas>
    <div id="menu-ui">
      <button id="startBtn" class="menu-btn">New Game</button>
      <button id="continueBtn" class="menu-btn" style="display: none;">Continue</button>
      <button id="upgradesBtn" class="menu-btn">Upgrades</button>
    </div>
    <div id="joystick-zone"></div>
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
  const dashBtn = document.querySelector<HTMLButtonElement>('#dashBtn')!;
  const blastBtn = document.querySelector<HTMLButtonElement>('#blastBtn')!;

  if (game.state === 'playing') {
    touchControls.style.display = 'flex';

    // Update button states based on cooldowns
    if (game.player) {
      const dashCD = game.player.dashCooldown;
      const blastCD = game.player.blastCooldown;

      dashBtn.disabled = dashCD > 0;
      dashBtn.textContent = dashCD > 0 ? dashCD.toFixed(1) : 'DASH';

      blastBtn.disabled = blastCD > 0;
      blastBtn.textContent = blastCD > 0 ? blastCD.toFixed(1) : 'BLAST';
    }
  } else {
    touchControls.style.display = 'none';
  }
}, 100);
