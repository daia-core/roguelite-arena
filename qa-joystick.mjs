#!/usr/bin/env node
// Joystick-anchor QA — verifies the dynamic-origin joystick fix against the REAL
// shipped source (frontend/src/Input.ts, transpiled with esbuild), driven through
// a minimal mock DOM. No production test hook required.
//
// Asserts:
//   1. On touchstart the joystick base anchors at the TOUCH point (fixedX/fixedY),
//      NOT the old fixed bottom-left corner (120, canvas.height-140).
//   2. On touchmove the origin (fixedX/fixedY) stays put; only the knob (delta) moves.
//   3. The knob delta clamps to radius 100.
//   4. A full-tilt drag reads as full-speed movement (|getMovementVector| ~= 1),
//      i.e. the getMovementVector divisor matches the touchmove clamp radius.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { transform } from '/workspace/work/roguelite-game/frontend/node_modules/esbuild/lib/main.js';

const SRC = '/workspace/work/roguelite-game/frontend/src/Input.ts';
const tmp = path.join(os.tmpdir(), `Input.qa.${Date.now()}.mjs`);
const { code } = await transform(fs.readFileSync(SRC, 'utf8'), { loader: 'ts', format: 'esm' });
fs.writeFileSync(tmp, code);

// ---- Minimal mock DOM ----
const CANVAS_W = 800, CANVAS_H = 1400;   // portrait-ish; height matters for the corner check
const RECT = { left: 0, top: 0, width: 400, height: 700 }; // CSS-scaled 2x down
const listeners = {};
const canvas = {
  width: CANVAS_W, height: CANVAS_H,
  getBoundingClientRect: () => RECT,
  addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
};
// Globals the Input module touches.
globalThis.window = { addEventListener: () => {} };
globalThis.document = { getElementById: () => null };
// navigator is read-only in Node 22 and only used by triggerHaptic (not on this
// test path), so we leave it as-is.

const { Input } = await import(tmp);
const input = new Input(canvas);
input.setGameStateGetter(() => 'playing');

const fire = (type, touches) => {
  const ev = { preventDefault() {}, changedTouches: touches };
  (listeners[type] || []).forEach(fn => fn(ev));
};

// Touch down at 60%/40% of the canvas (client coords) — deliberately NOT the old corner.
const scaleX = CANVAS_W / RECT.width, scaleY = CANVAS_H / RECT.height;
const downClientX = RECT.left + RECT.width * 0.6;
const downClientY = RECT.top + RECT.height * 0.4;
const expectX = (downClientX - RECT.left) * scaleX;
const expectY = (downClientY - RECT.top) * scaleY;

fire('touchstart', [{ identifier: 1, clientX: downClientX, clientY: downClientY }]);
const afterDown = { ...input.joystick };

// Drag far up-right, well past the 100 clamp.
fire('touchmove', [{ identifier: 1, clientX: downClientX + 400, clientY: downClientY - 400 }]);
const afterMove = { ...input.joystick };
const vec = input.getMovementVector();

fs.rmSync(tmp, { force: true });

const near = (a, b, tol) => Math.abs(a - b) <= tol;
const oldCornerX = 120, oldCornerY = CANVAS_H - 140;

const checks = [
  ['base anchors at touch-down point (not the corner)',
    near(afterDown.fixedX, expectX, 1) && near(afterDown.fixedY, expectY, 1)],
  ['base is NOT the old fixed bottom-left corner',
    !(near(afterDown.fixedX, oldCornerX, 1) && near(afterDown.fixedY, oldCornerY, 1))],
  ['origin stays put during drag (fixed == start, unchanged by touchmove)',
    near(afterMove.fixedX, afterDown.fixedX, 0.001) && near(afterMove.fixedY, afterDown.fixedY, 0.001)
    && near(afterMove.fixedX, afterMove.startX, 0.001)],
  ['knob delta clamps to radius 100',
    near(Math.hypot(afterMove.deltaX, afterMove.deltaY), 100, 0.5)],
  ['full-tilt drag reads as full-speed movement (|vector| ~= 1)',
    near(Math.hypot(vec.x, vec.y), 1, 0.02)],
];

console.log('\n=== Joystick anchor QA ===');
console.log(`touch-down canvas coord: (${expectX}, ${expectY})  |  old corner was: (${oldCornerX}, ${oldCornerY})`);
console.log(`after down : fixed=(${afterDown.fixedX}, ${afterDown.fixedY}) start=(${afterDown.startX}, ${afterDown.startY})`);
console.log(`after move : fixed=(${afterMove.fixedX}, ${afterMove.fixedY}) delta=(${afterMove.deltaX.toFixed(1)}, ${afterMove.deltaY.toFixed(1)}) |delta|=${Math.hypot(afterMove.deltaX, afterMove.deltaY).toFixed(1)}`);
console.log(`movement vector: (${vec.x.toFixed(3)}, ${vec.y.toFixed(3)}) |v|=${Math.hypot(vec.x, vec.y).toFixed(3)}\n`);

let pass = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (ok) pass++; }
console.log(`\n${pass}/${checks.length} checks passed`);
process.exit(pass === checks.length ? 0 : 1);
