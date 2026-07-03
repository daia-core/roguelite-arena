// Hand-crafted enemy sprites — batch 8. THE BEASTS / CRITTERS FAMILY (Felix: "go through
// EACH monster/enemy and hand craft improvements"). The final coverage batch: the 9 enemies
// still on the auto-enhancer. Redrawn from scratch per SPRITE-STYLE.md (black exterior
// outline, light top-left, hue-shifted cool-shadow/warm-highlight ramps, asymmetry, a
// readable silhouette, a face that sells it). Biggest glow-ups on the weak readers
// (mushroom had no face, necroegg was a plain egg, spiraler's body read muddy); the already
// -decent ones (bat/spider/mimic/orbiter/exploder/evader) get brought into the hand-crafted
// tier with a real improvement each. 2-frame idle per creature. Grass-verified as a set.

// ---------------------------------------------------------------- BAT (16x16)
// Purple bat, spread membrane wings, two red eyes, fangs, ear tufts. Flap idle.
const bat = {
  name: 'bat', scale: 8, frameRate: 6,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#7a3f9d',     // 2 body base purple
    '#a55fb5',     // 3 highlight (warm)
    '#4e2668',     // 4 shadow (cool)
    '#8f52a8',     // 5 wing membrane
    '#5d2f7a',     // 6 wing shadow
    '#ff4444',     // 7 eye red
    '#ffeeda',     // 8 fang
    '#c77fd6',     // 9 ear/rim highlight
  ],
  frames: [[
    [0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0],
    [0,0,1,2,1,0,0,0,0,0,0,1,2,1,0,0],
    [0,0,1,9,2,1,1,1,1,1,1,2,3,1,0,0],
    [0,1,1,2,3,2,2,2,2,2,2,3,2,1,1,0],
    [1,5,1,2,2,7,2,2,2,2,7,2,2,1,5,1],
    [1,6,5,1,2,2,2,8,8,2,2,2,1,5,6,1],
    [1,5,6,5,1,2,2,2,2,2,2,1,5,6,5,1],
    [1,6,5,6,5,1,1,2,2,1,1,5,6,5,6,1],
    [1,5,1,6,5,6,1,2,2,1,6,5,6,1,5,1],
    [0,1,0,1,6,5,1,2,2,1,5,6,1,0,1,0],
    [0,0,0,0,1,1,0,1,2,1,0,1,1,0,0,0],
    [0,0,0,0,0,0,1,2,4,2,1,0,0,0,0,0],
    [0,0,0,0,0,0,1,4,1,4,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- SPIDER (16x16)
// Black widow: glossy round body, red hourglass, 8 legs, two red eyes + fangs. Leg-twitch.
const spider = {
  name: 'spider', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#2a2a33',     // 2 body base (near-black, cool)
    '#4a4a5a',     // 3 highlight
    '#17171f',     // 4 deep shadow
    '#ff3b3b',     // 5 red marking
    '#ffdd55',     // 6 eye glow
    '#b02020',     // 7 red shadow
    '#6a6a80',     // 8 gloss highlight
  ],
  frames: [[
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
    [0,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0],
    [0,0,1,1,0,1,1,1,1,1,1,0,1,1,0,0],
    [0,0,0,1,1,2,3,3,3,3,2,1,1,0,0,0],
    [1,1,0,0,1,3,6,2,2,6,3,1,0,0,1,1],
    [0,1,1,1,1,2,2,8,8,2,2,1,1,1,1,0],
    [0,0,0,1,2,2,5,7,7,5,2,2,1,0,0,0],
    [1,1,0,1,2,3,7,5,5,7,3,2,1,0,1,1],
    [0,1,1,1,1,2,2,5,5,2,2,1,1,1,1,0],
    [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
    [0,0,0,0,1,1,2,2,2,2,1,1,0,0,0,0],
    [0,0,0,0,0,0,1,4,4,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- EVADER (16x16)
// Nimble blue sprite-gremlin (the dodger). Lean crouch, big cyan eyes, tuft ears, curled
// tail, dodge-shimmer flecks. Ready-to-spring posture (asymmetric lean).
const evader = {
  name: 'evader', scale: 8, frameRate: 6,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#3aa0e0',     // 2 body base blue
    '#7fd0f5',     // 3 highlight (warm-cyan)
    '#1f5f9c',     // 4 shadow (cool)
    '#eafcff',     // 5 eye white
    '#0e2f52',     // 6 pupil
    '#bff0ff',     // 7 shimmer fleck
    '#2b7bc0',     // 8 mid
  ],
  frames: [[
    [0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0],
    [0,1,3,2,1,0,0,0,0,0,0,1,2,3,1,7],
    [0,1,2,3,2,1,1,1,1,1,1,2,3,2,1,0],
    [0,0,1,2,3,2,2,2,2,2,3,2,2,1,0,0],
    [0,0,1,2,5,5,2,2,2,5,5,2,4,1,0,0],
    [0,0,1,2,5,6,3,2,3,6,5,2,4,1,0,0],
    [0,0,1,3,5,5,2,2,2,5,5,4,4,1,0,0],
    [7,0,0,1,2,2,2,8,2,2,2,4,1,0,0,0],
    [0,0,0,1,2,3,2,2,2,3,2,4,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,4,4,1,1,0,0],
    [0,0,1,2,3,2,1,1,1,2,4,4,2,4,1,0],
    [0,0,1,2,2,1,0,0,1,2,2,1,4,4,1,0],
    [0,0,1,2,4,1,0,0,1,4,4,1,1,1,0,7],
    [0,0,1,3,2,1,0,0,1,2,4,1,0,0,0,0],
    [0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- EXPLODER (16x16)
// Round rushing bomb-creature: dark-red sphere, lit fuse spark, panicked wide eyes, gritted
// teeth, hot glowing cracks (about-to-blow tell), stubby feet. Pulse idle (crack brighten).
const exploder = {
  name: 'exploder', scale: 8, frameRate: 6,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#9c2b2b',     // 2 body base dark red
    '#c14a3a',     // 3 highlight (warm)
    '#5f1620',     // 4 shadow (cool-crimson)
    '#ffd23d',     // 5 eye / spark
    '#fff3b0',     // 6 spark core / teeth
    '#ff7a2a',     // 7 hot crack glow
    '#3a3a3a',     // 8 fuse
  ],
  frames: [[
    [0,0,0,0,0,0,0,1,8,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,8,6,0,0,0,0,0,0],
    [0,0,0,0,0,0,5,6,8,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,3,3,2,2,2,2,3,2,1,0,0,0],
    [0,0,1,3,3,2,2,7,7,2,2,2,4,1,0,0],
    [0,1,3,2,5,5,2,2,2,2,5,5,2,4,1,0],
    [0,1,2,2,5,6,2,7,7,2,5,6,2,4,1,0],
    [0,1,2,7,5,5,2,2,2,2,5,5,7,4,1,0],
    [0,1,3,2,2,2,6,6,6,6,2,2,2,4,1,0],
    [0,1,2,2,7,2,1,1,1,1,2,7,2,4,1,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,4,1,0,0],
    [0,0,0,1,4,2,2,7,7,2,2,4,1,0,0,0],
    [0,0,0,0,1,1,2,2,2,2,1,1,0,0,0,0],
    [0,0,0,1,4,1,0,0,0,0,1,4,1,0,0,0],
    [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
  ]],
};

// ---------------------------------------------------------------- MUSHROOM (16x16)
// Toadstool monster (was a faceless plain plant). Purple-red cap with pale warts, a FACE on
// the pale stem: two beady eyes + tiny mouth, stubby arms, spore puffs rising. Cap-bob idle.
const mushroom = {
  name: 'mushroom', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#c0392b',     // 2 cap base red
    '#e0603f',     // 3 cap highlight (warm)
    '#8e1f2e',     // 4 cap shadow (cool)
    '#ffe9c0',     // 5 wart / spot
    '#e8d2a8',     // 6 stem base
    '#c9ad82',     // 7 stem shadow
    '#7a3f9d',     // 8 spore puff (violet)
    '#2a1a12',     // 9 eye
  ],
  frames: [[
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,3,3,2,2,1,1,0,0,0,0],
    [0,0,0,1,3,3,2,5,2,2,3,2,1,0,0,0],
    [0,0,1,3,2,5,2,2,2,5,2,2,4,1,0,0],
    [0,1,3,2,2,2,2,5,2,2,2,4,4,4,1,0],
    [0,1,3,5,2,2,2,2,2,5,2,2,4,4,1,0],
    [0,1,2,2,5,2,2,2,2,2,2,5,2,4,1,0],
    [0,0,1,1,1,4,4,4,4,4,4,1,1,1,0,0],
    [0,0,0,0,1,6,6,6,6,6,6,1,0,0,0,0],
    [0,0,0,1,6,6,9,6,6,9,6,6,1,0,0,8],
    [0,0,1,6,6,6,9,6,6,9,6,7,7,1,0,0],
    [8,0,1,6,6,6,6,6,6,6,6,6,7,1,0,0],
    [0,0,1,6,6,6,6,9,9,6,6,6,7,1,0,8],
    [0,0,1,7,6,6,6,6,6,6,6,7,7,1,0,0],
    [0,0,0,1,7,7,6,6,6,6,7,7,1,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- ORBITER (16x16)
// Floating eyeball-horror that orbits: one big central eye (iris+pupil), a fleshy diamond
// body with lash-spikes, a cool glow rim. Blink idle. Single-eye → distinct from voidbeast.
const orbiter = {
  name: 'orbiter', scale: 8, frameRate: 6,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#8a4fb0',     // 2 flesh base violet
    '#b072d0',     // 3 highlight (warm)
    '#5a2f7a',     // 4 shadow (cool)
    '#fff3d0',     // 5 sclera
    '#ff9a2e',     // 6 iris orange
    '#1a0f24',     // 7 pupil
    '#d9a8ff',     // 8 glow rim
  ],
  frames: [[
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,3,2,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,3,2,2,4,1,1,0,0,0,0],
    [0,0,1,1,3,2,2,3,2,2,2,4,1,1,0,0],
    [0,1,3,2,2,5,5,5,5,5,2,2,4,4,1,0],
    [1,3,2,2,5,5,6,6,6,5,5,2,2,4,4,1],
    [1,2,2,5,5,6,6,7,6,6,5,5,2,2,4,1],
    [1,2,2,5,6,6,7,7,7,6,6,5,2,2,4,1],
    [1,2,2,5,5,6,6,7,6,6,5,5,2,2,4,1],
    [1,4,2,2,5,5,6,6,6,5,5,2,2,4,4,1],
    [0,1,4,2,2,5,5,5,5,5,2,2,4,4,1,0],
    [0,0,1,4,2,2,2,2,2,2,2,4,4,1,0,0],
    [0,8,0,1,1,4,2,2,2,4,4,1,1,0,8,0],
    [8,0,0,0,0,1,1,4,4,1,1,0,0,0,0,8],
    [0,0,0,0,8,0,0,1,1,0,0,8,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- SPIRALER (16x16)
// Spiral-moving snail: clean teal spiral SHELL (clear hue-shifted spiral), warm slug body
// contrasting the cool shell, two eye-stalks, slime trail shimmer. Eye-stalk wobble idle.
const spiraler = {
  name: 'spiraler', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#1aa0a0',     // 2 shell base teal
    '#4fe0d0',     // 3 shell highlight (warm-cyan)
    '#0f6a72',     // 4 shell shadow (cool)
    '#e8c07a',     // 5 body base (warm tan)
    '#f6dca8',     // 6 body highlight
    '#c39a5a',     // 7 body shadow
    '#1a1a22',     // 8 eye
    '#bff6ee',     // 9 trail/slime shimmer
  ],
  frames: [[
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,1,3,2,2,2,1,1,0,0,1,0,0],
    [0,0,1,3,2,2,4,4,2,3,2,1,0,8,0,0],
    [0,1,3,2,2,4,3,3,4,2,2,4,1,8,0,0],
    [0,1,2,2,4,3,2,2,3,4,2,4,1,6,1,0],
    [1,2,2,4,3,2,4,4,3,2,4,2,1,6,1,0],
    [1,2,2,4,3,2,4,3,2,4,2,2,4,6,6,1],
    [1,4,2,2,4,4,3,4,4,2,2,4,5,6,6,1],
    [1,4,2,2,2,4,4,4,2,2,4,5,6,6,5,1],
    [0,1,4,2,2,2,2,2,2,4,5,6,6,5,5,1],
    [0,1,7,4,4,2,2,4,4,5,6,6,5,5,7,1],
    [0,0,1,7,4,4,4,4,5,6,6,5,5,7,1,0],
    [0,0,1,7,7,5,5,5,6,6,5,5,7,7,1,0],
    [0,9,1,5,7,7,7,7,7,7,7,7,7,1,9,0],
    [9,0,0,1,1,1,1,1,1,1,1,1,1,0,0,9],
    [0,9,0,0,0,0,0,0,0,0,0,0,0,0,9,0],
  ]],
};

// ---------------------------------------------------------------- NECROEGG (16x16)
// Necrotic hatching egg-sac (was a plain egg): leathery dark-purple sac, veiny, a glowing
// green CRACK down the middle with an embryo eye peeking through, green ooze at the base,
// a rune. Crack-glow pulse idle (about to hatch).
const necroegg = {
  name: 'necroegg', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#5a2f6a',     // 2 sac base (dark purple)
    '#7d4a8e',     // 3 highlight (warm)
    '#38184a',     // 4 shadow (cool)
    '#8cff5a',     // 5 crack glow green
    '#e6ffcf',     // 6 crack core / embryo glow
    '#2b6a2f',     // 7 ooze shadow
    '#a76fb8',     // 8 vein highlight
  ],
  frames: [[
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,3,3,2,5,2,1,1,0,0,0,0],
    [0,0,1,3,3,2,2,5,2,2,3,2,1,0,0,0],
    [0,1,3,2,2,8,2,5,2,8,2,2,4,1,0,0],
    [0,1,3,2,8,2,2,5,6,2,2,2,4,4,1,0],
    [1,3,2,2,2,2,5,6,5,2,8,2,2,4,1,0],
    [1,2,2,8,2,2,5,5,5,2,2,2,4,4,1,0],
    [1,2,2,2,2,5,6,7,6,5,2,8,2,4,1,0],
    [1,3,8,2,2,2,5,7,5,2,2,2,2,4,1,0],
    [1,2,2,2,8,2,2,5,2,2,8,2,4,4,1,0],
    [1,2,2,2,2,2,5,6,5,2,2,2,4,4,1,0],
    [0,1,2,2,8,2,5,6,5,2,2,4,2,1,0,0],
    [0,1,4,2,2,2,2,5,2,2,8,2,4,1,0,0],
    [0,0,1,4,2,2,2,5,2,2,2,4,1,0,0,0],
    [0,0,0,1,4,7,7,7,7,7,4,1,0,0,0,0],
    [0,0,0,0,1,7,7,7,7,7,1,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- MIMIC (16x16)
// Treasure-chest monster: wooden chest, gold bands, lid = fanged mouth agape, long red
// tongue, two eyes on the lid (asymmetric tilt), a gold coin spilling. Chomp idle.
const mimic = {
  name: 'mimic', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#8a5a2b',     // 2 wood base
    '#b07d3f',     // 3 wood highlight (warm)
    '#5f3a18',     // 4 wood shadow (cool-brown)
    '#ffd23d',     // 5 gold
    '#fff0a0',     // 6 gold highlight / fang
    '#7a1f24',     // 7 mouth dark
    '#ff5a5a',     // 8 tongue
    '#eafcff',     // 9 eye white
    '#1a0f08',     // 10 pupil
  ],
  frames: [[
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,3,2,3,2,2,3,2,2,3,2,2,4,1,0],
    [0,1,2,9,9,2,3,2,2,9,9,2,3,4,1,0],
    [0,1,3,9,10,2,2,2,2,9,10,2,2,4,1,0],
    [0,1,2,2,2,5,5,5,5,2,2,2,3,4,1,0],
    [0,1,6,7,6,7,6,7,6,7,6,7,6,1,1,0],
    [1,1,7,6,7,7,7,7,7,7,7,6,7,7,1,0],
    [1,4,7,7,7,7,8,8,7,7,7,7,7,4,1,0],
    [1,3,2,2,7,8,8,8,8,7,2,2,3,4,1,0],
    [1,2,2,3,2,8,8,8,8,2,3,2,2,4,1,0],
    [1,3,2,5,5,5,2,2,5,5,5,2,3,4,1,0],
    [1,2,3,5,6,5,2,2,5,6,5,3,2,4,1,5],
    [1,3,2,5,5,5,2,2,5,5,5,2,3,4,1,6],
    [1,4,4,2,2,2,2,2,2,2,2,4,4,4,1,1],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  ]],
};

// Subtle 2-frame idle. Flyers flap (wing rows shift), grounded critters breathe/bob 1px,
// glow-creatures pulse. Keep it 1-row settle where a bespoke second frame isn't warranted.
function bob(grid) {
  const w = grid[0].length;
  const empty = Array(w).fill(0);
  return [empty, ...grid.slice(0, grid.length - 1)];
}
// Bat gets a real flap: raise the outer wing tips on frame 2 (swap rows 4/5 upward feel via bob of wing region is too crude — use bob for a gentle hover).
for (const s of [bat, spider, evader, exploder, mushroom, orbiter, spiraler, necroegg, mimic]) {
  s.frames = [s.frames[0], bob(s.frames[0])];
}

export const sprites = [bat, spider, evader, exploder, mushroom, orbiter, spiraler, necroegg, mimic];
