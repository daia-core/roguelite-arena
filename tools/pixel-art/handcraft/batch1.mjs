// Hand-crafted enemy sprites — batch 1 (the worst readers from baseline review).
// Format matches pixelpng.mjs: export const sprites = [{name,scale,palette,frames:[grid]}]
// Palette idx 0 = transparent, idx 1 = '#000000' outline. Grids are 16x16
// (brutes/bosses larger). Light top-left, hue-shifted ramps, catch-lit eyes,
// asymmetry for personality, chunky silhouettes.

// ---- shared palette helpers (per-sprite palettes below) ----
const T = 0, K = 1; // transparent, black outline

// GARGOYLE — stone winged demon. Big folded wings, horns, glowing eyes,
// crouched menace. Stone = cool grey ramp, warm amber eyes as accent.
const gargoyle = {
  name: 'gargoyle', scale: 8, frameRate: 6,
  //        0    1    2(hi) 3(mid) 4(shad) 5(dk)  6(eye) 7(eyeK) 8(horn) 9(wingHi)
  palette: ['transparent','#000000','#9fb0bd','#6e8493','#455a6b','#2d3d4d','#ffcf4d','#b5761a','#c3d2db','#7d94a1'],
  frames: [[
    [K,K,T,T,K,8,T,T,T,8,K,T,T,K,K,T],
    [K,9,K,T,K,8,K,T,K,8,K,T,K,9,K,T],
    [K,9,2,K,K,2,2,K,2,2,K,K,2,9,K,T],
    [K,2,9,3,K,2,3,3,3,2,K,3,9,2,K,T],
    [K,2,2,9,K,6,7,3,6,7,K,9,2,2,K,T],
    [K,9,2,3,K,6,6,4,6,6,K,3,2,9,K,T],
    [K,2,9,3,3,3,4,4,4,3,3,3,9,2,K,T],
    [T,K,2,9,3,4,4,5,5,4,4,3,9,2,K,T],
    [T,K,9,2,3,4,5,K,K,5,4,3,2,9,K,T],
    [T,T,K,2,3,3,4,5,5,4,3,3,2,K,T,T],
    [T,T,K,9,3,3,4,4,4,4,3,3,9,K,T,T],
    [T,T,T,K,2,3,K,4,4,K,3,2,K,T,T,T],
    [T,T,T,K,2,K,T,K,K,T,K,2,K,T,T,T],
    [T,T,T,K,K,T,K,3,3,K,T,K,K,T,T,T],
    [T,T,T,T,T,K,2,K,K,2,K,T,T,T,T,T],
    [T,T,T,T,T,K,K,T,T,K,K,T,T,T,T,T],
  ]],
};

// GOLEM — hulking rock brute, cracked stone body, mossy top, heavy arms,
// single-color grass-safe warm stone (brown-grey, not the blue-grey trio).
const golem = {
  name: 'golem', scale: 8, frameRate: 6,
  //        0   1   2(hi)  3(mid)  4(shad) 5(dk)   6(moss) 7(crack) 8(eye)
  palette: ['transparent','#000000','#b79a72','#8a6f4e','#5f4a30','#3d2f1e','#7bb54a','#2a2012','#8ef0ff'],
  frames: [[
    [T,T,T,T,K,K,6,6,6,K,K,T,T,T,T,T],
    [T,T,T,K,6,2,2,6,2,2,6,K,T,T,T,T],
    [T,T,K,2,2,3,3,3,3,3,3,2,K,T,T,T],
    [T,K,2,3,K,8,3,3,3,8,K,3,2,K,T,T],
    [T,K,3,3,K,8,8,3,8,8,K,3,3,K,T,T],
    [K,K,3,3,3,3,3,3,3,3,3,3,3,K,K,T],
    [K,2,K,3,3,7,3,3,3,7,3,3,K,2,K,T],
    [K,2,K,2,4,4,4,4,4,4,4,4,2,K,2,K],
    [K,2,K,2,4,7,4,4,4,4,7,4,2,K,2,K],
    [K,2,K,2,4,4,4,5,5,4,4,4,2,K,2,K],
    [K,2,2,2,4,4,5,5,5,5,4,4,2,2,2,K],
    [T,K,K,2,4,4,5,5,5,5,4,4,2,K,K,T],
    [T,T,K,2,2,K,5,5,5,5,K,2,2,K,T,T],
    [T,T,K,2,K,T,K,5,5,K,T,K,2,K,T,T],
    [T,T,K,K,K,T,K,K,K,K,T,K,K,K,T,T],
    [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  ]],
};

// CONSTRUCT — arcane metal automaton. Boxy plated torso, glowing core,
// antennae, blue-steel with cyan energy. Reads as a robot, not a blob.
const construct = {
  name: 'construct', scale: 8, frameRate: 6,
  //        0   1   2(hi)  3(mid)  4(shad) 5(dk)   6(core) 7(coreHi) 8(bolt)
  palette: ['transparent','#000000','#c7d3dc','#8ea3b3','#566b7e','#33424f','#22d3ee','#a5f3fc','#facc15'],
  frames: [[
    [T,T,T,T,K,T,T,T,T,T,T,K,T,T,T,T],
    [T,T,T,T,K,8,T,T,T,T,8,K,T,T,T,T],
    [T,T,T,K,2,K,T,T,T,T,K,2,K,T,T,T],
    [T,T,K,2,2,2,K,K,K,K,2,2,2,K,T,T],
    [T,K,2,2,K,6,6,7,7,6,6,K,2,2,K,T],
    [T,K,2,3,K,6,7,K,K,7,6,K,3,2,K,T],
    [T,K,2,3,K,6,6,7,7,6,6,K,3,2,K,T],
    [K,2,2,3,3,3,3,3,3,3,3,3,3,2,2,K],
    [K,2,3,3,4,4,4,6,6,4,4,4,3,3,2,K],
    [K,2,3,4,4,K,4,6,6,4,K,4,4,3,2,K],
    [K,K,3,4,4,4,4,4,4,4,4,4,4,3,K,K],
    [T,K,2,4,4,5,5,5,5,5,5,4,4,2,K,T],
    [T,K,2,4,K,5,5,K,K,5,5,K,4,2,K,T],
    [T,K,2,2,K,K,5,K,K,5,K,K,2,2,K,T],
    [T,T,K,K,T,K,5,K,K,5,K,T,K,K,T,T],
    [T,T,T,T,T,K,K,T,T,K,K,T,T,T,T,T],
  ]],
};

// DASHER — fast lunging beast. Sleek arrowhead body with a snarling head +
// motion streaks, not an abstract star. Warm red-orange, speed lines.
const dasher = {
  name: 'dasher', scale: 8, frameRate: 6,
  //        0   1   2(hi)   3(mid)  4(shad) 5(dk)   6(eye) 7(teeth) 8(streak)
  palette: ['transparent','#000000','#ff8a3d','#f45a2a','#c23016','#7e1c0d','#fff27a','#ffe9d6','#ffcf9e'],
  frames: [[
    [T,T,T,T,T,T,T,T,T,T,T,T,K,K,T,T],
    [T,8,T,T,T,T,T,T,T,T,K,K,2,2,K,T],
    [T,T,8,T,T,T,T,T,K,K,2,2,2,3,2,K],
    [8,T,T,8,T,T,K,K,2,2,3,3,6,K,3,K],
    [T,8,T,T,K,K,2,2,3,3,3,6,K,7,3,K],
    [T,T,K,K,2,2,3,3,3,4,3,3,7,7,3,K],
    [K,2,2,3,3,3,4,4,4,4,4,3,3,3,K,T],
    [K,2,3,3,4,4,4,5,5,4,4,4,3,K,T,T],
    [K,3,4,4,4,5,5,K,K,5,4,4,K,T,T,T],
    [T,K,4,4,5,5,K,T,T,K,4,K,T,T,T,T],
    [T,T,K,4,5,K,T,T,K,2,3,K,T,T,T,T],
    [T,8,T,K,K,T,T,K,2,3,K,T,T,T,T,T],
    [8,T,8,T,T,T,K,2,3,K,T,T,T,T,T,T],
    [T,8,T,T,T,K,2,3,K,T,T,T,T,T,T,T],
    [T,T,T,T,T,K,K,K,T,T,T,T,T,T,T,T],
    [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  ]],
};

// PHASER — spectral teleporter. Ghostly diamond wraith with a bright core eye
// and phasing tail wisps, translucent cool blue. Reads as a creature.
const phaser = {
  name: 'phaser', scale: 8, frameRate: 6,
  //        0   1   2(hi)   3(mid)  4(shad) 5(core) 6(coreHi) 7(wisp) 8(eyeK)
  palette: ['transparent','#000000','#bfe9ff','#6ab6e6','#3a72b0','#e8f7ff','#ffffff','#4f8fd0','#123a5a'],
  frames: [[
    [T,T,T,T,T,T,T,K,K,T,T,T,T,T,T,T],
    [T,T,T,T,T,T,K,2,2,K,T,T,T,T,T,T],
    [T,T,T,T,T,K,2,3,3,2,K,T,T,T,T,T],
    [T,T,T,T,K,2,3,3,3,3,2,K,T,T,T,T],
    [T,T,T,K,2,3,3,5,5,3,3,2,K,T,T,T],
    [T,T,K,2,3,3,5,6,6,5,3,3,2,K,T,T],
    [T,K,2,3,3,5,6,K,K,6,5,3,3,2,K,T],
    [K,2,3,3,5,5,K,4,4,K,5,5,3,3,2,K],
    [K,2,3,3,5,6,K,K,K,K,6,5,3,3,2,K],
    [T,K,2,3,3,5,6,6,6,6,5,3,3,2,K,T],
    [T,T,K,2,3,3,5,5,5,5,3,3,2,K,T,T],
    [T,T,T,K,2,3,3,4,4,3,3,2,K,T,T,T],
    [T,T,7,T,K,2,3,3,3,3,2,K,T,7,T,T],
    [T,7,T,7,T,K,2,4,4,2,K,T,7,T,7,T],
    [T,T,7,T,T,7,K,2,2,K,7,T,7,T,T,T],
    [T,7,T,T,7,T,T,K,K,T,T,7,T,7,T,T],
  ]],
};

// SPINNER — spiked whirling hazard, but make it a creature: an armored
// spin-top beetle with a face + radial spikes, warm brass + dark shell.
const spinner = {
  name: 'spinner', scale: 8, frameRate: 6,
  //        0   1   2(hi)   3(mid)  4(shad) 5(dk)   6(eye) 7(spikeHi) 8(gem)
  palette: ['transparent','#000000','#f0c66b','#c9922f','#8a5e1c','#4d3210','#ff5a5a','#ffe9a8','#7ad4ff'],
  frames: [[
    [T,K,T,T,T,K,K,K,K,K,K,T,T,T,K,T],
    [K,7,K,T,K,2,2,3,3,2,2,K,T,K,7,K],
    [T,K,7,K,2,2,3,3,3,3,2,2,K,7,K,T],
    [T,T,K,2,2,3,3,3,3,3,3,2,2,K,T,T],
    [K,K,2,3,3,3,6,6,6,6,3,3,3,2,K,K],
    [7,2,3,3,3,6,7,7,7,7,6,3,3,3,2,7],
    [K,2,3,3,4,6,7,K,K,7,6,4,3,3,2,K],
    [K,2,3,4,4,4,7,K,K,7,4,4,4,3,2,K],
    [K,2,3,4,4,4,4,8,8,4,4,4,4,3,2,K],
    [7,2,3,3,4,4,4,8,8,4,4,4,3,3,2,7],
    [K,K,2,3,3,5,4,4,4,4,5,3,3,2,K,K],
    [T,T,K,2,3,5,5,5,5,5,5,3,2,K,T,T],
    [T,K,7,K,2,3,5,5,5,5,3,2,K,7,K,T],
    [K,7,K,T,K,2,2,5,5,2,2,K,T,K,7,K],
    [T,K,T,T,T,K,K,K,K,K,K,T,T,T,K,T],
    [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
  ]],
};

// DRUID — nature caster, not furniture. Hooded green-robed figure, wooden
// staff with a leaf, glowing eyes under the hood, antlers for silhouette.
const druid = {
  name: 'druid', scale: 8, frameRate: 6,
  //        0   1   2(robeHi) 3(robeMid) 4(robeShad) 5(skin) 6(eye) 7(staff) 8(leaf) 9(antler)
  palette: ['transparent','#000000','#5aa85a','#3d7d3f','#255127','#c9a27a','#c6ff6b','#7a5230','#8ede4a','#b79b6e'],
  frames: [[
    [T,T,T,9,T,T,T,T,T,T,9,T,T,K,8,T],
    [T,T,9,T,9,T,K,K,K,9,T,9,T,K,8,8],
    [T,T,K,9,K,K,2,2,2,K,9,K,T,K,7,K],
    [T,T,K,2,2,2,2,2,2,2,2,K,T,K,7,K],
    [T,K,2,2,K,5,5,5,5,K,2,2,K,K,7,K],
    [T,K,2,3,K,5,6,5,6,K,3,2,K,K,7,K],
    [T,K,2,3,3,5,5,5,5,3,3,2,K,K,7,K],
    [T,K,2,3,3,3,K,K,3,3,3,2,K,K,7,K],
    [K,2,3,3,3,3,3,3,3,3,3,3,2,K,7,K],
    [K,2,3,3,4,3,3,3,3,4,3,3,2,K,7,K],
    [K,2,3,4,4,4,3,3,4,4,4,3,2,K,7,K],
    [K,2,3,4,4,4,4,4,4,4,4,3,2,K,7,K],
    [K,2,4,4,4,4,4,4,4,4,4,4,2,K,7,K],
    [T,K,2,4,4,4,4,4,4,4,4,2,K,T,K,T],
    [T,K,4,4,4,K,4,4,K,4,4,4,K,T,T,T],
    [T,T,K,K,K,T,K,K,T,K,K,K,T,T,T,T],
  ]],
};

// CYCLOPS — brute with ONE huge central eye as the hero feature. Beefy
// warm-tan body, hunched shoulders, single fist raised. 18 wide brute.
const cyclops = {
  name: 'cyclops', scale: 8, frameRate: 6,
  //        0   1   2(hi)  3(mid)  4(shad) 5(dk)   6(eyeW) 7(iris) 8(brow) 9(nail)
  palette: ['transparent','#000000','#e0a86a','#c07f3f','#8a5626','#5c3818','#f6f4e8','#3a2a1a','#7a4a22','#f0e0c0'],
  frames: [[
    [T,T,T,T,K,K,K,K,K,K,K,K,T,T,T,T],
    [T,T,T,K,2,2,3,3,3,3,2,2,K,T,T,T],
    [T,T,K,2,3,3,3,8,8,3,3,3,2,K,T,T],
    [T,K,2,3,3,K,K,K,K,K,K,3,3,2,K,T],
    [T,K,3,3,K,6,6,6,6,6,6,K,3,3,K,T],
    [K,2,3,K,6,6,7,7,7,6,6,6,K,3,2,K],
    [K,2,3,K,6,7,7,K,7,7,6,6,K,3,2,K],
    [K,2,3,K,6,6,7,7,7,6,6,6,K,3,2,K],
    [K,9,3,3,K,6,6,6,6,6,K,3,3,3,9,K],
    [T,K,3,3,3,K,K,K,K,K,3,3,3,3,K,T],
    [T,K,2,3,4,4,4,4,4,4,4,4,3,2,K,T],
    [K,2,3,4,4,4,K,4,4,K,4,4,4,3,2,K],
    [K,2,3,4,5,4,K,4,4,K,4,5,4,3,2,K],
    [K,9,4,4,4,5,K,4,4,K,5,4,4,9,K,T],
    [T,K,K,4,K,T,K,4,4,K,T,K,4,K,K,T],
    [T,T,T,K,K,T,K,K,K,K,T,K,K,T,T,T],
  ]],
};

export const sprites = [gargoyle, golem, construct, dasher, phaser, spinner, druid, cyclops];
