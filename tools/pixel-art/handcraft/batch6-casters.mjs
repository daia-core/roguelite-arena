// Hand-crafted enemy sprites — batch 6. THE CASTER / SUPPORT FAMILY (Felix: "go through
// each monster/enemy and hand craft improvements"). The auto-enhancer left these five
// robed humanoids blurring together — worst offender the SHIELDER, which read as two
// disembodied grey shields, not a creature. Redrawn as five DISTINCT silhouettes + roles:
//   wizard      — classic pointed-hat blue mage, staff+orb (ranged homing caster)
//   necromancer — dark hooded raiser-of-dead, green skull-staff + necro glow
//   healer      — bright medic in white/green robe holding a glowing healing cross
//   shielder    — stout armored guardian BEHIND one big tower shield (fix: one creature)
//   summoner    — purple hooded cultist, arms up conjuring a glowing rune-portal orb
// All 16x16, scale 8, light top-left, hue-shifted ramps (cool shadows / warm highlights),
// 2-frame idle added after silhouettes validated. Grass-verified before ship.

// ---------------------------------------------------------------- WIZARD
const wizard = {
  name: 'wizard', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#2f6ea8',     // 2 hat/robe base blue
    '#57a2d6',     // 3 highlight (warm-blue)
    '#1d4b76',     // 4 shadow (cool)
    '#eef4f8',     // 5 beard white
    '#b9ccd8',     // 6 beard shadow
    '#e6b58a',     // 7 skin
    '#ffd84d',     // 8 eye glow
    '#8a5a2b',     // 9 staff wood
    '#79e6ff',     // 10 orb glow
    '#ffe27a',     // 11 star accent
  ],
  frames: [[
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,3,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,3,2,2,4,1,0,0,0,0,0],
    [0,0,0,0,1,3,2,11,2,4,1,0,0,0,0,0],
    [0,0,0,1,3,2,2,2,2,2,4,1,0,0,0,0],
    [0,0,1,3,2,2,2,2,2,2,2,4,1,0,10,0],
    [0,1,4,4,4,4,4,4,4,4,4,4,4,1,10,1],
    [0,0,1,7,8,7,7,7,7,8,7,1,0,1,9,1],
    [0,0,1,7,5,5,7,7,5,5,7,1,0,1,9,1],
    [0,0,1,5,5,5,5,5,5,5,5,1,0,1,9,1],
    [0,0,1,2,5,5,5,5,5,5,2,1,0,1,9,1],
    [0,0,1,2,2,5,5,5,5,2,2,1,1,1,9,1],
    [0,0,1,2,2,2,6,6,2,2,2,7,7,1,9,1],
    [0,0,1,2,2,2,2,2,2,2,2,1,0,1,9,1],
    [0,0,0,1,2,2,1,1,2,2,1,0,0,1,1,0],
    [0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- NECROMANCER
const necromancer = {
  name: 'necromancer', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#33345e',     // 2 robe base (navy)
    '#4c4e82',     // 3 highlight (warm-navy)
    '#22233f',     // 4 shadow (cool)
    '#14152a',     // 5 hood void
    '#7bf06b',     // 6 necro glow (green eyes/orb)
    '#3a9c34',     // 7 glow shadow
    '#c9cbe0',     // 8 staff bone / skull
    '#8f91ad',     // 9 bone shadow
  ],
  frames: [[
    [0,0,0,0,0,1,1,1,1,0,0,0,1,1,1,0],
    [0,0,0,0,1,3,2,2,2,1,0,1,8,8,8,1],
    [0,0,0,1,3,2,5,5,2,4,1,1,8,6,8,1],
    [0,0,1,3,2,5,5,5,5,2,4,1,1,9,1,0],
    [0,0,1,2,5,5,6,5,6,5,5,2,1,9,1,0],
    [0,0,1,2,5,5,6,5,6,5,5,2,1,9,1,0],
    [0,0,1,2,2,5,5,5,5,5,2,2,1,9,1,0],
    [0,0,1,3,2,2,2,2,2,2,2,4,1,9,1,0],
    [0,0,1,3,2,2,2,2,2,2,2,4,1,9,1,0],
    [0,0,1,2,2,2,7,6,7,2,2,2,1,9,1,0],
    [0,0,1,2,2,2,6,6,6,2,2,2,1,1,1,0],
    [0,0,1,2,2,2,2,6,2,2,2,2,1,0,0,0],
    [0,0,1,4,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,0,1,4,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,0,0,1,4,2,1,1,2,4,1,1,0,0,0,0],
    [0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- HEALER
const healer = {
  name: 'healer', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#eaf6ee',     // 2 white robe base
    '#ffffff',     // 3 highlight
    '#b9d8c4',     // 4 shadow (cool-green)
    '#2ecc71',     // 5 green trim base
    '#7be8a6',     // 6 green highlight
    '#1c8a4b',     // 7 green shadow
    '#e6b58a',     // 8 skin
    '#153b26',     // 9 eyes
    '#8affc0',     // 10 heal-cross glow
  ],
  frames: [[
    [0,0,0,0,0,0,0,10,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,10,0,0,0],
    [0,0,0,0,1,5,6,6,5,7,1,0,0,0,0,0],
    [0,0,0,1,5,6,6,6,6,5,7,1,0,10,0,0],
    [0,0,0,1,5,8,8,8,8,8,5,1,0,0,0,0],
    [0,0,0,1,7,8,9,8,8,9,8,1,0,0,0,0],
    [0,0,0,1,2,8,8,8,8,8,4,1,0,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,0,1,2,2,2,10,10,2,2,2,4,1,0,0,0],
    [0,0,1,2,2,10,10,10,10,2,2,4,1,0,0,0],
    [0,0,1,2,2,2,10,10,2,2,2,4,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,0,1,3,2,2,2,2,2,2,4,4,1,0,0,0],
    [0,0,1,3,2,2,2,2,2,2,4,4,1,0,0,0],
    [0,0,0,1,2,2,1,1,2,2,4,1,0,0,0,0],
    [0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- SHIELDER
const shielder = {
  name: 'shielder', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#9aa7ad',     // 2 shield steel base
    '#cdd6da',     // 3 steel highlight
    '#6f7d84',     // 4 steel shadow (cool)
    '#48545a',     // 5 deep shadow
    '#f2d24b',     // 6 shield boss/emblem gold
    '#b5411f',     // 7 helm crest red
    '#5a4636',     // 8 body/leather behind shield
    '#e6b58a',     // 9 eye slit glow
  ],
  frames: [[
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,4,3,3,4,1,0,0,0,0,0,0],
    [0,0,0,1,4,2,9,9,2,4,1,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,1,3,3,3,3,3,3,3,3,3,3,4,1,0,0],
    [0,1,3,2,2,2,2,6,2,2,2,2,4,1,0,0],
    [0,1,3,2,2,2,6,6,6,2,2,2,4,1,8,1],
    [0,1,3,2,2,6,6,6,6,6,2,2,4,8,8,1],
    [0,1,3,2,2,2,6,6,6,2,2,2,4,1,8,1],
    [0,1,3,2,2,2,2,6,2,2,2,2,4,1,1,0],
    [0,1,3,2,2,2,2,2,2,2,2,2,4,1,0,0],
    [0,1,4,2,2,2,2,2,2,2,2,4,5,1,0,0],
    [0,1,4,4,2,2,2,2,2,2,4,4,5,1,0,0],
    [0,0,1,5,4,4,4,4,4,4,5,1,1,0,0,0],
    [0,0,0,1,8,8,1,1,8,8,1,0,0,0,0,0],
    [0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0],
  ]],
};

// ---------------------------------------------------------------- SUMMONER
const summoner = {
  name: 'summoner', scale: 8, frameRate: 5,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#7d3fb0',     // 2 robe base purple
    '#a566d6',     // 3 highlight (warm-violet)
    '#5a2a86',     // 4 shadow (cool)
    '#3a1a5e',     // 5 deep shadow / hood void
    '#e58cff',     // 6 portal glow bright
    '#c05de0',     // 7 portal mid
    '#ffe27a',     // 8 rune gold
    '#e6b58a',     // 9 hand skin
  ],
  frames: [[
    [0,0,0,0,0,0,6,6,6,0,0,0,0,0,0,0],
    [0,0,0,0,0,6,7,8,7,6,0,0,0,0,0,0],
    [0,0,0,0,0,6,8,6,8,6,0,0,0,0,0,0],
    [0,0,0,1,1,0,6,7,6,0,1,1,0,0,0,0],
    [0,0,1,9,9,1,0,6,0,1,9,9,1,0,0,0],
    [0,0,1,4,2,1,0,0,0,1,2,4,1,0,0,0],
    [0,0,1,2,2,4,1,1,1,4,2,2,1,0,0,0],
    [0,0,0,1,4,2,5,5,5,2,4,1,0,0,0,0],
    [0,0,0,1,2,5,6,5,6,5,2,1,0,0,0,0],
    [0,0,0,1,2,5,5,5,5,5,2,1,0,0,0,0],
    [0,0,1,3,2,2,5,5,5,2,2,4,1,0,0,0],
    [0,0,1,3,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,0,1,3,2,2,8,2,8,2,2,4,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,4,1,0,0,0],
    [0,0,0,1,4,2,1,1,2,4,1,1,0,0,0,0],
    [0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0],
  ]],
};

// Subtle 2-frame idle: a gentle 1px "breathe" — the whole creature settles down one
// row on frame 2 (a soft bob), preserving the base. Keeps them alive next to the
// bobbing regular enemies without a full redraw (per SPRITE-STYLE frame guidance).
function bob(grid) {
  const w = grid[0].length;
  const empty = Array(w).fill(0);
  return [empty, ...grid.slice(0, grid.length - 1)];
}
for (const s of [wizard, necromancer, healer, shielder, summoner]) {
  s.frames = [s.frames[0], bob(s.frames[0])];
}

export const sprites = [wizard, necromancer, healer, shielder, summoner];
