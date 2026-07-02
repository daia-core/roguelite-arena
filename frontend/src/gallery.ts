/**
 * Dev-only sprite gallery: renders every registered sprite with labels so art
 * can be reviewed at a glance (and screenshot by tooling). Served by
 * `vite dev` at /gallery.html; not part of the production build.
 */

import { SpriteSheet } from './sprites';
import { ENEMY_TYPES } from './Enemy';

SpriteSheet.init();

document.body.style.cssText =
  'background:#23272e;color:#dfe6ee;font-family:ui-monospace,monospace;padding:20px;margin:0;';

function section(title: string): HTMLDivElement {
  const h = document.createElement('h2');
  h.textContent = title;
  h.style.cssText = 'font-size:18px;margin:24px 0 8px;color:#9ecbff;';
  document.body.appendChild(h);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;';
  document.body.appendChild(grid);
  return grid;
}

function cell(grid: HTMLDivElement, name: string, sprite: HTMLCanvasElement | null, note = '') {
  const box = document.createElement('div');
  box.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;' +
    'background:#2d333c;border:1px solid #444;min-width:96px;';
  if (sprite) {
    // Draw onto a fresh canvas so the game's cached canvas isn't reparented
    const view = document.createElement('canvas');
    view.width = sprite.width;
    view.height = sprite.height;
    view.getContext('2d')!.drawImage(sprite, 0, 0);
    view.style.imageRendering = 'pixelated';
    box.appendChild(view);
  } else {
    const missing = document.createElement('div');
    missing.textContent = 'MISSING';
    missing.style.cssText =
      'width:96px;height:96px;display:flex;align-items:center;justify-content:center;' +
      'background:#5c2b2b;color:#ffb3b3;font-weight:bold;';
    box.appendChild(missing);
  }
  const label = document.createElement('div');
  label.textContent = note ? `${name} ${note}` : name;
  label.style.cssText = 'font-size:11px;color:#aab6c3;text-align:center;';
  box.appendChild(label);
  grid.appendChild(box);
}

// Player + enemies in ENEMY_TYPES order (bosses last), flagging sprite reuse
const seen = new Map<string, string>(); // spriteName -> first enemy using it
const enemies = section('Enemies');
cell(enemies, 'player', SpriteSheet.get('player'));
const bosses = section('Bosses');
for (const [type, data] of Object.entries(ENEMY_TYPES)) {
  const target = data.isBoss ? bosses : enemies;
  const reuse = seen.get(data.spriteName);
  seen.set(data.spriteName, type);
  cell(
    target,
    type,
    SpriteSheet.get(data.spriteName),
    reuse ? `(= ${reuse})` : ''
  );
}

// Everything else registered (projectiles, pickups, items)
const misc = section('Projectiles, pickups & items');
const enemySpriteNames = new Set(Object.values(ENEMY_TYPES).map((d) => d.spriteName));
for (const name of SpriteSheet.names()) {
  if (name === 'player' || enemySpriteNames.has(name)) continue;
  cell(misc, name, SpriteSheet.get(name));
}
