// Hand-crafted enemy sprites — batch 4. THE SPECTRAL FAMILY (Felix: "go through each
// monster/enemy and hand craft improvements"). The auto-enhancer left these four
// reading as near-identical pale/purple blobs — worst offender the PHANTOM, which read
// as a purple CAT (ear-like bumps), not a fast stealth shade. Redrawn as four DISTINCT
// silhouettes so they never blur together on grass:
//   ghost   — dopey rounded sheet, big eyes, wavy hem (the friendly/floaty one)
//   phantom — sleek forward-leaning shade + a speed-smear trail (the fast invisible one)
//   wraith  — pointed hood over a hollow void with burning eyes (the reaper)
//   banshee — long flowing hair + wide screaming mouth + sound-ripple arcs (the screamer)
// All 16x16, scale 8, light top-left, hue-shifted ramps (cool shadows / warm highlights),
// 2-frame idle (bob / flicker / scream). Bottoms fade to tattered wisps — they float.

// ---------------------------------------------------------------- GHOST
// Pale-cyan (#e0f7fa) classic sheet ghost. Deliberately dopey/soft to contrast the
// three menacing spirits: rounded dome, big dark eyes, small "o" mouth, 3-lobe wavy hem.
const ghost = {
  name: 'ghost', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#cfeef3',     // 2 base cyan-white
    '#f2fdff',     // 3 highlight (warm-pale)
    '#8fbccb',     // 4 shadow (cool)
    '#5e8a9d',     // 5 deep shadow (cool-blue)
    '#16242c',     // 6 eyes / mouth (dark hollow)
    '#a9dbe8',     // 7 cheek mid
  ],
  frames: [[
    // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,3,3,3,2,1,0,0,0,0,0,0],
    [0,0,0,1,3,3,2,2,2,4,1,0,0,0,0,0],
    [0,0,1,3,3,2,2,2,2,2,4,1,0,0,0,0],
    [0,1,3,3,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,1,3,2,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,1,2,2,6,6,2,2,6,6,2,2,5,1,0,0],
    [0,1,2,2,6,6,2,2,6,6,2,2,5,1,0,0],
    [0,1,2,2,7,2,2,2,2,7,2,2,5,1,0,0],
    [0,1,2,2,2,2,6,6,2,2,2,2,5,1,0,0],
    [0,1,4,2,2,2,6,6,2,2,2,4,5,1,0,0],
    [0,1,4,2,2,2,2,2,2,2,2,4,5,1,0,0],
    [0,1,4,4,2,2,2,2,2,2,4,4,5,1,0,0],
    [0,1,1,2,2,1,1,2,2,1,1,2,1,1,0,0],
    [0,0,1,1,0,0,1,1,0,0,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ], [
    // frame 2: gentle bob down 1px + hem sway (lobes shift), eyes blink half-close
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,3,3,3,2,1,0,0,0,0,0,0],
    [0,0,0,1,3,3,2,2,2,4,1,0,0,0,0,0],
    [0,0,1,3,3,2,2,2,2,2,4,1,0,0,0,0],
    [0,1,3,3,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,1,3,2,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,1,2,2,6,6,2,2,6,6,2,2,5,1,0,0],
    [0,1,2,2,7,2,2,2,2,7,2,2,5,1,0,0],
    [0,1,2,2,2,2,6,6,2,2,2,2,5,1,0,0],
    [0,1,4,2,2,2,6,6,2,2,2,4,5,1,0,0],
    [0,1,4,2,2,2,2,2,2,2,2,4,5,1,0,0],
    [0,1,4,4,2,2,2,2,2,2,4,4,5,1,0,0],
    [0,1,2,1,1,2,2,1,1,2,2,1,1,0,0,0],
    [0,1,1,0,0,1,1,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- PHANTOM
// Dark-violet (#a569bd) FAST (speed 140) stealth shade — invisible until close. NOT a
// cat. Sleek and forward-LEANING (motion), narrow, with a trailing speed-smear behind
// (the readable "fast + phasing" tell) and hollow glowing slit eyes. No mouth — a void.
const phantom = {
  name: 'phantom', scale: 8, frameRate: 8,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#a05fbf',     // 2 violet base
    '#c98fd8',     // 3 highlight (warm-violet)
    '#6b3f86',     // 4 shadow (cool)
    '#432458',     // 5 deep shadow / hollow
    '#eaf6ff',     // 6 eye glow (cold white)
    '#7d52a8',     // 7 smear trail (faint)
  ],
  frames: [[
    // leaning right; body cols ~5-13, smear tail streaks back to the left
    [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,3,2,1,0,0,0,0],
    [0,0,0,0,0,0,1,3,3,2,2,4,1,0,0,0],
    [0,0,0,0,0,1,3,3,2,2,2,4,1,0,0,0],
    [0,0,0,0,1,3,3,2,2,2,2,2,4,1,0,0],
    [0,0,0,1,2,6,6,2,2,6,6,2,4,1,0,0],
    [0,0,7,2,2,6,6,2,2,6,6,2,4,1,0,0],
    [0,7,2,2,2,2,2,2,2,2,2,2,5,1,0,0],
    [7,2,2,2,2,2,2,2,2,2,2,5,5,1,0,0],
    [0,7,2,2,2,2,2,2,2,2,5,5,1,0,0,0],
    [0,0,7,2,2,2,2,2,2,5,5,1,0,0,0,0],
    [0,0,0,7,2,2,2,2,5,5,1,0,0,0,0,0],
    [0,0,0,0,1,4,2,5,5,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,5,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ], [
    // frame 2: phase-flicker — smear trail thins/breaks, eyes flare wider, body dithers
    [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,3,3,2,1,0,0,0,0],
    [0,0,0,0,0,0,1,3,3,2,2,4,1,0,0,0],
    [0,0,0,0,0,1,3,3,2,2,2,4,1,0,0,0],
    [0,0,0,0,1,3,3,2,2,2,2,2,4,1,0,0],
    [0,0,0,1,2,6,6,6,2,6,6,6,4,1,0,0],
    [0,0,0,2,2,6,6,2,2,6,6,2,4,1,0,0],
    [0,0,2,2,2,2,2,2,2,2,2,2,5,1,0,0],
    [0,7,2,2,2,2,2,2,2,2,2,5,5,1,0,0],
    [0,0,2,2,2,2,2,2,2,2,5,5,1,0,0,0],
    [0,0,0,7,2,2,2,2,2,5,5,1,0,0,0,0],
    [0,0,0,0,2,2,2,2,5,5,1,0,0,0,0,0],
    [0,0,0,0,1,4,2,5,5,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,5,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- WRAITH
// Purple (#9370db) phasing menace. A hooded REAPER: pointed hood peak, dark hollow
// interior (no face — just a void) with two burning cyan eyes, tattered cloak, faint
// skeletal claw hints at the sides. The peak + void reads instantly as "wraith".
const wraith = {
  name: 'wraith', scale: 8, frameRate: 6,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#8a63d6',     // 2 cloak base
    '#ab8ee6',     // 3 cloak highlight (warm)
    '#5f45a0',     // 4 cloak shadow (cool)
    '#3a2870',     // 5 deep shadow
    '#0c0a1e',     // 6 hood void (near-black)
    '#3fe0ff',     // 7 burning eyes (cyan)
    '#c9b6f2',     // 8 claw bone
  ],
  frames: [[
    // pointed hood peak; hollow void window with TWO distinct burning eyes (bridge of
    // void between them so they never merge into a visor); skeletal claw nubs at sides.
    // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,3,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,3,3,2,4,1,0,0,0,0,0],
    [0,0,0,0,1,3,3,2,2,2,4,1,0,0,0,0],
    [0,0,0,1,3,2,6,6,6,6,2,4,1,0,0,0],
    [0,0,1,3,2,7,7,6,6,7,7,2,4,1,0,0],
    [0,0,1,3,2,7,7,6,6,7,7,2,4,1,0,0],
    [0,0,1,3,2,2,6,6,6,6,2,2,4,1,0,0],
    [0,0,1,3,4,2,2,2,2,2,2,4,4,1,0,0],
    [0,1,8,1,3,2,2,2,2,2,2,4,1,8,1,0],
    [0,0,0,1,4,2,2,3,2,4,2,2,1,0,0,0],
    [0,0,0,1,4,2,2,2,2,2,2,5,1,0,0,0],
    [0,0,0,1,4,2,4,2,2,4,5,5,1,0,0,0],
    [0,0,0,1,1,4,2,1,4,2,5,1,1,0,0,0],
    [0,0,0,0,1,1,1,0,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ], [
    // frame 2: eyes flare (bleed up into the brow + down below), hem tatters shift
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,3,3,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,3,3,2,4,1,0,0,0,0,0],
    [0,0,0,0,1,3,3,2,2,2,4,1,0,0,0,0],
    [0,0,0,1,3,2,7,6,6,7,2,4,1,0,0,0],
    [0,0,1,3,2,7,7,6,6,7,7,2,4,1,0,0],
    [0,0,1,3,2,7,7,6,6,7,7,2,4,1,0,0],
    [0,0,1,3,2,2,7,6,6,7,2,2,4,1,0,0],
    [0,0,1,3,4,2,2,2,2,2,2,4,4,1,0,0],
    [0,1,8,1,3,2,2,3,2,2,2,4,1,8,1,0],
    [0,0,0,1,4,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,4,2,2,2,2,4,2,5,1,0,0,0],
    [0,0,0,1,4,2,4,2,2,2,5,5,1,0,0,0],
    [0,0,0,1,4,1,2,4,1,2,5,1,1,0,0,0],
    [0,0,0,1,1,0,1,1,1,0,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- BANSHEE
// Pale grey-white (#e0e0e0) screamer. A wailing woman-spirit: long flowing hair framing
// a shrieking face, wide-open dark mouth (the AoE-scream tell), hollow eyes, and two
// sound-ripple arcs flanking the head. Long trailing hair = distinct from the ghost.
const banshee = {
  name: 'banshee', scale: 8, frameRate: 6,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#dcdce6',     // 2 spirit base (cool-white)
    '#f6f6fb',     // 3 highlight
    '#a6a6c0',     // 4 shadow (cool)
    '#74748e',     // 5 deep shadow / hair depth
    '#141422',     // 6 eyes / screaming mouth
    '#bfe9ff',     // 7 scream ripple (cold glow)
  ],
  frames: [[
    // 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,3,3,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,5,3,2,2,2,4,5,1,0,0,0,0],
    [0,0,1,5,2,2,2,2,2,2,4,5,1,0,0,0],
    [0,7,1,5,2,6,6,2,6,6,2,5,1,7,0,0],
    [7,0,1,5,2,6,6,2,6,6,2,4,1,0,7,0],
    [0,7,1,5,2,2,2,2,2,2,2,5,1,7,0,0],
    [0,0,1,5,2,2,6,6,6,2,2,5,1,0,0,0],
    [0,0,1,5,4,2,6,6,6,2,4,5,1,0,0,0],
    [0,0,1,5,5,2,2,6,2,2,5,5,1,0,0,0],
    [0,0,1,1,5,4,2,2,2,4,5,1,1,0,0,0],
    [0,0,0,1,5,5,4,2,4,5,5,1,0,0,0,0],
    [0,0,0,1,1,5,5,4,5,5,1,1,0,0,0,0],
    [0,0,0,0,1,5,1,5,1,5,1,0,0,0,0,0],
    [0,0,0,0,1,1,0,1,0,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ], [
    // frame 2: mouth gapes wider (scream), ripple arcs push outward + brighten, hair sways
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,3,3,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,5,3,2,2,2,4,5,1,0,0,0,0],
    [7,0,1,5,2,2,2,2,2,2,4,5,1,0,0,7],
    [0,7,1,5,2,6,6,2,6,6,2,5,1,7,0,0],
    [0,0,1,5,2,6,6,2,6,6,2,4,1,0,0,0],
    [0,7,1,5,2,2,2,2,2,2,2,5,1,7,0,0],
    [0,0,1,5,2,2,6,6,6,2,2,5,1,0,0,0],
    [0,0,1,5,4,2,6,6,6,2,4,5,1,0,0,0],
    [0,0,1,5,5,2,6,6,6,2,5,5,1,0,0,0],
    [0,0,1,1,5,4,2,6,2,4,5,1,1,0,0,0],
    [0,0,0,1,5,5,4,2,4,5,5,1,0,0,0,0],
    [0,0,0,1,1,5,5,4,5,5,1,1,0,0,0,0],
    [0,0,0,1,5,1,5,1,5,1,5,1,0,0,0,0],
    [0,0,0,1,1,0,1,0,1,0,1,1,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]],
};

export const sprites = [ghost, phantom, wraith, banshee];
