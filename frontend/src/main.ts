// Main entry point - game loop and initialization

import { Game } from './Game';
import { STARTING_CLASSES } from './Classes';
import { AoeZone } from './AoeZone';
import { SpriteSheet } from './sprites';
import { UISprites } from './UISprites';
import { getItemIcon, getArtifactIcon } from './items/itemIcons';
import { panelCanvas, WOOD_THEME } from './pixel/panel';
import './style.css';

// Initialize sprite systems
SpriteSheet.init();
UISprites.init();

// Dev/QA hook: lets tooling inspect the sprite registry. Not a public API.
(window as unknown as { __SpriteSheet: typeof SpriteSheet }).__SpriteSheet = SpriteSheet;
// Dev/QA hook: lets tooling render/inspect item icons. Not a public API.
(window as unknown as { __getItemIcon: typeof getItemIcon }).__getItemIcon = getItemIcon;
// Dev/QA hook: lets tooling render/inspect the hand-crafted artifact icons.
(window as unknown as { __getArtifactIcon: typeof getArtifactIcon }).__getArtifactIcon = getArtifactIcon;

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

// Dev/QA hook: lets headless tooling drive/inspect the game. Not a public API.
(window as unknown as { __game: Game }).__game = game;
// Dev/QA hook: lets tooling spawn an AoE zone to verify pixel-art rendering. Not a public API.
(window as unknown as { __AoeZone: typeof AoeZone }).__AoeZone = AoeZone;
// Dev/QA hook: lets tooling enumerate the starting-class roster. Not a public API.
(window as unknown as { __STARTING_CLASSES: typeof STARTING_CLASSES }).__STARTING_CLASSES = STARTING_CLASSES;

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

  // Size AND position the display box to the VISUAL viewport, in explicit px.
  // Using `100%`/`100vh` sized the box to the *large* viewport (URL-bar-hidden
  // height) while the internal buffer was built from the visualViewport (the
  // actually-visible height). That mismatch stretched the frame vertically and
  // pushed its top — where the HUD lives — up behind the browser URL/status bar,
  // clipping it. Matching the box to the visual viewport (same aspect as the
  // buffer) removes the stretch and keeps the HUD on-screen. offsetTop/Left
  // handle pinch-zoom / on-screen-keyboard insets.
  const vv = window.visualViewport;
  if (vv) {
    canvas.style.width = vv.width + 'px';
    canvas.style.height = vv.height + 'px';
    canvas.style.left = vv.offsetLeft + 'px';
    canvas.style.top = vv.offsetTop + 'px';
  } else {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  // Let the game rebuild size-dependent structures (quadtrees, pathfinding grid)
  window.dispatchEvent(new Event('game-resize'));
}

window.addEventListener('resize', resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeCanvas);
  // The URL bar sliding in/out fires 'scroll' (viewport offset/size change) too.
  window.visualViewport.addEventListener('scroll', resizeCanvas);
}
resizeCanvas();

// Menu UI visibility is now handled in game loop on state changes
