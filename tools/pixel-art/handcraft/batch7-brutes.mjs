// Hand-crafted enemy sprites — batch 7. THE BRUTE / DEMON FAMILY (Felix: "go through
// each monster/enemy and hand craft improvements"). The auto-enhancer left these three
// as generic blobs that didn't sell their in-game roles:
//   imp   — small(16) fast dark-red teleporter (blinks on hit). Was a vague red lump.
//           Redrawn as a lean mischievous devil: two horns, big yellow eyes, a barbed
//           whipping tail, tiny wings, purple teleport-shimmer accent. Clearly SMALL & quick.
//   troll — big(18) slow green regenerating brute (200 HP). Redrawn as a hulking hunched
//           tusked ogre: tiny head sunk between huge shoulders, giant dragging fists,
//           warty darker-green spots, underbite tusks, a faint regen glow. Distinct from
//           the upright orc (also green) by the hunch + bulk + tusks.
//   demon — huge(20) crimson burst-SHOOTER (500 HP, the biggest non-boss). Redrawn as a
//           winged fire-demon: broad BAT WINGS (the big silhouette statement), two curved
//           horns, fanged maw, a charged fire-bolt in the claw (the "shoots bursts" tell).
//           WINGS deliberately differentiate it from the flamefiend BOSS (horns+mane, no wings)
//           and from the small imp.
// Light top-left, black exterior outline, hue-shifted ramps (cool shadows / warm highlights),
// asymmetry for personality. 2-frame idle added after silhouettes validated. Grass-verified.

// ---------------------------------------------------------------- IMP (16x16, small)
const imp = {
  name: 'imp', scale: 8, frameRate: 6,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#9c1f1f',     // 2 skin base (dark red)
    '#c8422f',     // 3 highlight (warm)
    '#6d1220',     // 4 shadow (cool-crimson)
    '#ffd23d',     // 5 eye glow yellow
    '#f0e6a0',     // 6 tusk/fang / horn tip
    '#3a5f4c',     // 7 (unused reserve)
    '#b6f0ff',     // 8 teleport shimmer (cyan-violet)
    '#d98cff',     // 9 teleport shimmer 2 (violet)
    '#e8b090',     // 10 belly highlight
  ],
  frames: [[
    [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
    [0,0,1,6,1,0,0,0,0,0,0,1,6,1,0,0],
    [0,8,0,1,3,1,1,1,1,1,1,3,1,0,9,0],
    [0,0,0,1,3,2,2,2,2,2,2,4,1,0,0,0],
    [0,0,1,3,2,5,5,2,2,5,5,2,4,1,0,0],
    [0,0,1,3,2,5,5,2,2,5,5,2,4,1,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,4,1,0,0],
    [0,0,0,1,2,6,6,6,6,6,6,2,1,0,0,0],
    [0,0,0,1,3,2,10,10,10,10,2,4,1,0,0,0],
    [0,0,0,0,1,2,10,10,10,10,2,1,0,0,0,0],
    [0,0,0,0,1,3,2,2,2,2,4,1,0,0,0,0],
    [0,0,0,1,3,2,1,0,1,2,2,1,0,1,1,0],
    [0,0,0,1,2,1,0,0,0,1,2,1,1,4,2,1],
    [0,0,1,3,2,1,0,0,0,1,2,4,1,2,2,1],
    [0,0,1,2,1,0,0,0,0,0,1,2,1,1,1,0],
    [0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- TROLL (18x18, brute)
const troll = {
  name: 'troll', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#4a7c59',     // 2 skin base (troll green)
    '#6fa46e',     // 3 highlight (warm-green)
    '#335b45',     // 4 shadow (cool)
    '#24443a',     // 5 deep shadow
    '#2f5a3f',     // 6 wart spots
    '#f0ead0',     // 7 tusks/claws
    '#c94f3a',     // 8 mouth/gum red
    '#ffd23d',     // 9 eyes
    '#8fe08a',     // 10 regen glow
    '#b6d99a',     // 11 belly light
  ],
  frames: [[
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,3,2,2,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,3,2,9,2,9,2,1,0,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0,0,0],
    [0,0,0,1,1,2,8,7,8,8,7,2,1,1,0,0,0,0],
    [0,0,1,3,3,1,2,2,2,2,2,1,3,4,1,0,0,0],
    [0,1,3,2,3,2,2,6,2,2,6,2,2,3,4,1,0,0],
    [0,1,3,2,2,2,6,2,2,2,2,6,2,2,4,1,0,0],
    [0,1,2,2,2,2,2,2,11,11,2,2,2,2,4,1,0,0],
    [1,3,2,2,6,2,2,11,10,11,2,2,6,2,2,4,1,0],
    [1,3,2,2,2,2,2,11,11,11,2,2,2,2,2,4,1,0],
    [1,2,2,2,2,2,2,2,11,2,2,2,2,6,2,4,1,0],
    [0,1,4,7,2,2,2,2,2,2,2,2,2,2,4,1,0,0],
    [0,1,7,7,1,4,2,2,2,2,2,2,4,1,1,0,0,0],
    [0,1,7,1,0,1,2,2,4,4,2,2,1,0,0,0,0,0],
    [0,0,1,0,0,1,4,4,1,1,4,4,1,0,0,0,0,0],
    [0,0,0,0,1,7,7,1,0,0,1,7,7,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- DEMON (18x18, winged shooter)
const demon = {
  name: 'demon', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#8b1a1a',     // 2 body base (crimson)
    '#c33b2c',     // 3 highlight (warm)
    '#5c0f1c',     // 4 shadow (cool-crimson)
    '#3a0a16',     // 5 deep shadow / wing membrane dark
    '#7a1420',     // 6 wing membrane mid
    '#ffd23d',     // 7 eyes / fire core
    '#ff7a1a',     // 8 fire mid
    '#ffe9a0',     // 9 horn/fang bone
    '#e04a2a',     // 10 fire outer
  ],
  frames: [[
    [0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
    [0,1,6,1,0,0,1,9,0,0,9,1,0,0,1,6,1,0],
    [1,6,5,6,1,1,3,2,1,1,2,3,1,1,6,5,6,1],
    [1,5,6,5,6,1,2,7,2,2,7,2,1,6,5,6,5,1],
    [0,1,5,6,5,1,2,2,2,2,2,2,1,5,6,5,1,0],
    [0,0,1,5,6,1,3,2,2,2,2,3,1,6,5,1,0,0],
    [0,0,0,1,5,1,2,2,8,8,2,2,1,5,1,0,0,0],
    [0,0,0,0,1,2,2,9,8,8,9,2,2,1,0,0,0,0],
    [0,0,0,0,1,3,2,2,2,2,2,2,3,1,0,0,0,0],
    [0,0,0,1,3,2,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,0,0,1,2,2,2,4,2,2,4,2,2,4,1,0,0,0],
    [0,0,1,10,2,2,4,1,2,2,1,4,2,2,4,1,0,0],
    [0,0,1,8,3,2,1,0,1,1,0,1,2,2,4,1,0,0],
    [0,1,10,7,2,1,0,0,0,0,0,0,1,2,4,1,0,0],
    [0,1,8,10,1,0,0,0,0,0,0,0,1,3,2,1,0,0],
    [0,0,1,1,0,0,0,0,0,0,0,0,0,1,2,4,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,1,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
  ]],
};

// Subtle 2-frame idle — brutes/demon "breathe" (settle 1 row) so they stay alive next to
// the bobbing regular enemies, without a full redraw (per SPRITE-STYLE frame guidance).
function bob(grid) {
  const w = grid[0].length;
  const empty = Array(w).fill(0);
  return [empty, ...grid.slice(0, grid.length - 1)];
}
for (const s of [imp, troll, demon]) {
  s.frames = [s.frames[0], bob(s.frames[0])];
}

export const sprites = [imp, troll, demon];
