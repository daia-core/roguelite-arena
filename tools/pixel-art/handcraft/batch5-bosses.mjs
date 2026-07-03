// Hand-crafted BOSS sprites — batch 5 (Felix: "go through each monster/enemy and
// hand craft improvements"). The 5 bosses were still on the auto-enhancer and did not
// meet the SPRITE-STYLE boss bar (crowns/capes/weapons/glow accents, a silhouette
// distinct from every regular enemy). Redrawn from scratch at 24x24, scale 8, light
// top-left, hue-shifted ramps (cool shadows / warm highlights), 2-frame idle.
//
//   boss_necrolord   — gold-crowned bone LICH KING, green soul-eyes, navy robe, soul staff
//   boss_flamefiend  — hulking horned FIRE DEMON, molten cracks, flame mane, fists ablaze
//   boss_voidbeast   — floating ELDRITCH EYE-HORROR, giant central eye + lesser eyes, tentacles
//   boss_stormking   — armored STORM SOVEREIGN, spiked crown crackling, cape, thunder scepter
//   boss_ancientgolem— colossal rune-carved STONE TITAN, glowing amber core + rune eyes
//
// frame-2 idle is a subtle living-glow pulse (+ small bob on some), NOT a redraw.

// pulse(): frame-2 helper. Recolor certain palette indices up one "energy" step so the
// glow breathes without moving the silhouette. `map` = { fromIndex: toIndex }.
function pulse(grid, map) {
  return grid.map((row) => row.map((c) => (map[c] ?? c)));
}
// bob(): shift a grid down by n rows (drop the last n, prepend n empty rows) for a float idle.
function bob(grid, n = 1) {
  const w = grid[0].length;
  const empty = Array.from({ length: n }, () => Array(w).fill(0));
  return [...empty, ...grid.slice(0, grid.length - n)];
}

// ============================================================ NECROLORD
// Bone lich-king: gold spiked crown w/ red gem, skull face w/ glowing green soul-eyes,
// broad navy robe with a green-glowing ribcage clasp, a soul-staff (green orb) at his left.
const necrolord = {
  name: 'boss_necrolord', scale: 8, frameRate: 3,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#3b3b6b',     // 2 robe navy base
    '#565699',     // 3 robe highlight (warm violet)
    '#26264a',     // 4 robe shadow (cool)
    '#14142c',     // 5 robe deep / hollow
    '#ece7cf',     // 6 bone
    '#b0a888',     // 7 bone shadow
    '#2fbf7a',     // 8 soul green mid
    '#8dffbe',     // 9 soul green bright
    '#e8c24a',     // 10 crown gold
    '#8a6418',     // 11 gold shadow / staff wood
    '#b23a3a',     // 12 gem red
  ],
  frames: [[
    [0,0,0,0,0,0,0,0,10,0,10,0,10,0,10,0,0,0,0,0,9,0,0,0],
    [0,0,0,0,0,0,0,10,10,11,10,11,10,11,10,10,0,0,0,8,9,8,0,0],
    [0,0,0,0,0,0,0,1,10,10,10,12,10,10,10,1,0,0,0,8,9,8,0,0],
    [0,0,0,0,0,0,0,1,11,11,11,11,11,11,11,1,0,0,0,1,8,1,0,0],
    [0,0,0,0,0,0,1,6,6,6,6,6,6,6,6,6,1,0,0,0,11,0,0,0],
    [0,0,0,0,0,0,1,6,6,7,6,6,6,7,6,6,1,0,0,0,11,0,0,0],
    [0,0,0,0,0,0,1,6,1,8,9,1,1,9,8,1,6,1,0,0,11,0,0,0],
    [0,0,0,0,0,0,1,6,1,9,8,1,1,8,9,1,6,1,0,0,11,0,0,0],
    [0,0,0,0,0,0,1,6,6,7,1,7,7,1,7,6,6,1,0,0,11,0,0,0],
    [0,0,0,0,0,0,0,1,6,1,6,1,6,1,6,1,6,1,0,0,11,0,0,0],
    [0,0,0,0,0,0,1,1,1,6,1,6,1,6,1,6,1,1,1,0,11,0,0,0],
    [0,0,0,0,1,1,3,3,2,2,2,2,2,2,2,2,3,3,1,1,11,0,0,0],
    [0,0,0,1,3,3,2,2,2,4,8,8,8,4,2,2,2,2,3,1,11,0,0,0],
    [0,0,1,3,3,2,2,2,4,8,9,9,9,8,4,2,2,2,4,1,11,0,0,0],
    [0,0,1,3,2,2,2,2,4,8,9,12,9,8,4,2,2,2,4,1,11,0,0,0],
    [0,0,1,2,2,2,2,2,2,4,8,9,8,4,2,2,2,2,4,1,11,0,0,0],
    [0,0,1,4,2,2,2,2,2,2,4,4,4,2,2,2,2,2,4,1,11,0,0,0],
    [0,0,1,4,2,2,2,2,2,2,2,2,2,2,2,2,2,2,5,1,11,0,0,0],
    [0,0,1,5,4,2,2,2,2,2,2,2,2,2,2,2,2,4,5,1,11,0,0,0],
    [0,0,1,5,4,4,2,2,2,2,2,2,2,2,2,2,4,4,5,1,11,0,0,0],
    [0,0,0,1,5,4,4,2,2,2,2,2,2,2,2,4,4,5,1,0,11,0,0,0],
    [0,0,0,1,5,5,4,4,2,2,4,2,2,4,2,4,5,5,1,1,11,1,0,0],
    [0,0,0,0,1,5,1,4,1,4,1,4,4,1,4,1,5,1,0,0,1,0,0,0],
    [0,0,0,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,0,0,0,0,0],
  ]],
};
necrolord.frames.push(pulse(necrolord.frames[0], { 8: 9, 2: 3 }));

// ============================================================ FLAMEFIEND
// Hulking fire demon: two up-curving horns (asymmetric, right bigger), a flame mane
// between them, glowing eyes, fanged snarl, molten cracks glowing across a red hulk,
// heavy fists with fireball glow.
const flamefiend = {
  name: 'boss_flamefiend', scale: 8, frameRate: 4,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#d8402a',     // 2 red base
    '#ff7a3c',     // 3 red highlight (warm orange)
    '#9e2417',     // 4 red shadow (cool-dark)
    '#5c1109',     // 5 deep shadow
    '#ffd44a',     // 6 molten glow bright (yellow)
    '#ff9124',     // 7 molten glow mid (orange)
    '#2a0906',     // 8 horn / claw dark
    '#ffe9a0',     // 9 fire mane bright / fang
  ],
  frames: [[
    [0,0,0,0,0,0,0,0,0,0,0,9,9,0,0,0,0,0,0,8,0,0,0,0],
    [0,0,0,0,8,0,0,0,0,0,9,6,6,9,0,0,0,0,8,8,0,0,0,0],
    [0,0,0,8,8,0,0,0,0,9,6,7,7,6,9,0,0,8,8,8,0,0,0,0],
    [0,0,0,1,8,8,0,0,9,6,7,3,3,7,6,9,0,8,8,8,0,0,0,0],
    [0,0,0,0,1,8,8,0,6,7,3,2,2,3,7,6,8,8,1,0,0,0,0,0],
    [0,0,0,0,0,1,8,7,2,3,2,2,2,2,3,2,7,8,1,0,0,0,0,0],
    [0,0,0,0,0,1,4,2,2,2,2,2,2,2,2,2,2,4,1,0,0,0,0,0],
    [0,0,0,0,1,4,2,2,6,6,2,2,2,2,6,6,2,2,4,1,0,0,0,0],
    [0,0,0,0,1,2,2,2,6,1,2,2,2,2,1,6,2,2,2,1,0,0,0,0],
    [0,0,0,0,1,4,2,2,2,2,4,7,7,4,2,2,2,2,4,1,0,0,0,0],
    [0,0,0,0,1,4,2,2,9,1,9,1,1,9,1,9,2,2,4,1,0,0,0,0],
    [0,0,0,1,4,2,2,2,2,7,6,7,7,6,7,2,2,2,2,4,1,0,0,0],
    [0,0,1,4,2,2,2,7,6,6,2,2,2,2,6,6,7,2,2,2,4,1,0,0],
    [0,0,1,2,2,2,2,7,6,2,2,2,2,2,2,6,7,2,2,2,2,1,0,0],
    [0,1,4,2,2,2,2,2,7,2,2,6,6,2,2,7,2,2,2,2,2,4,1,0],
    [0,1,2,2,4,2,2,2,2,2,6,7,7,6,2,2,2,2,4,2,2,2,1,0],
    [0,1,2,4,4,2,2,2,2,2,2,7,7,2,2,2,2,2,2,4,4,2,1,0],
    [0,1,4,4,0,1,4,2,2,2,2,2,2,2,2,2,2,4,1,0,4,4,1,0],
    [0,1,4,1,0,1,4,4,2,2,2,2,2,2,2,2,4,4,1,0,1,4,1,0],
    [0,0,1,0,0,1,2,4,4,2,2,2,2,2,2,4,4,2,1,0,0,1,0,0],
    [0,0,0,0,0,1,2,2,4,4,2,2,2,2,4,4,2,2,1,0,0,0,0,0],
    [0,0,0,0,0,1,4,7,6,4,4,2,2,4,4,6,7,4,1,0,0,0,0,0],
    [0,0,0,0,0,1,4,6,6,7,1,4,4,1,7,6,6,4,1,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,0,1,1,0,1,1,1,1,0,0,0,0,0,0],
  ]],
};
flamefiend.frames.push(pulse(flamefiend.frames[0], { 7: 6, 2: 3, 4: 2 }));

// ============================================================ VOIDBEAST
// Floating eldritch eye-horror: bulbous dark-purple mass, ONE huge central eye (magenta
// iris, white sclera), 3 lesser eyes, a jagged void-maw below the eye, writhing tentacles
// trailing under it, cosmic sparkle accents.
const voidbeast = {
  name: 'boss_voidbeast', scale: 8, frameRate: 4,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#5b2a86',     // 2 void purple base
    '#8b52c4',     // 3 highlight (warm violet)
    '#3a1a5c',     // 4 shadow (cool)
    '#1e0e33',     // 5 deep void
    '#ff5db0',     // 6 eye iris (magenta)
    '#ffd3ec',     // 7 sclera / glow
    '#c78dff',     // 8 tentacle mid
    '#ffef9c',     // 9 star sparkle
  ],
  frames: [[
    [0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,3,3,2,2,2,3,2,1,1,0,0,0,0,9,0,0],
    [0,0,0,0,0,1,3,3,2,2,2,2,2,2,2,2,4,1,0,0,0,0,0,0],
    [0,0,0,0,1,3,2,2,2,2,2,2,2,2,2,2,2,4,1,0,0,0,0,0],
    [0,0,0,1,3,2,2,2,2,2,2,2,2,2,2,2,2,4,4,1,0,0,0,0],
    [0,0,1,3,2,2,2,7,7,7,7,7,7,7,2,2,2,2,4,4,1,0,0,0],
    [0,0,1,2,2,2,7,7,7,7,7,7,7,7,7,2,2,2,4,4,1,0,0,0],
    [0,1,3,2,2,7,7,7,6,6,6,6,7,7,7,7,2,2,2,4,1,0,0,0],
    [0,1,2,2,2,7,7,6,6,1,1,6,6,6,7,7,2,2,2,4,1,0,9,0],
    [0,1,2,2,2,7,7,6,1,5,5,1,6,6,7,7,2,2,2,4,1,0,0,0],
    [0,1,2,2,2,7,7,6,6,1,1,6,6,6,7,7,2,2,2,2,1,0,0,0],
    [0,1,4,2,2,2,7,7,6,6,6,6,7,7,7,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,2,7,7,7,7,7,7,7,2,2,2,2,2,1,0,0,0,0],
    [0,0,1,4,2,7,2,2,7,7,7,7,2,2,2,7,2,2,4,1,0,0,0,0],
    [0,0,1,4,2,7,7,2,1,5,5,1,2,2,7,7,2,2,4,1,0,0,0,0],
    [0,0,0,1,4,2,7,7,1,6,6,1,7,7,2,2,4,1,0,0,0,0,0,0],
    [0,0,0,1,4,4,2,2,2,2,2,2,2,2,4,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,4,2,8,4,2,4,2,8,4,2,4,1,0,0,0,0,0,0,0],
    [0,0,0,1,8,1,4,8,1,4,1,8,4,1,8,4,1,8,1,0,0,0,0,0],
    [0,0,1,8,4,0,1,8,4,1,8,1,4,8,1,0,4,8,4,1,0,0,0,0],
    [0,0,1,8,1,0,0,1,8,1,8,4,1,8,1,0,1,8,1,0,0,0,0,0],
    [0,0,0,1,0,0,0,1,4,1,1,8,1,1,4,0,0,1,0,0,0,0,0,0],
    [0,0,8,1,0,0,0,0,1,0,0,1,0,0,1,0,0,8,1,0,0,0,0,0],
    [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  ]],
};
voidbeast.frames.push(pulse(bob(voidbeast.frames[0], 1), { 6: 7, 2: 3 }));

// ============================================================ STORMKING
// Armored storm sovereign: tall spiked crown crackling with cyan lightning, glowing
// white-blue eyes, plated blue armor with a lightning emblem, a cape behind the shoulders,
// and a thunder scepter (bright bolt) raised at his right.
const stormking = {
  name: 'boss_stormking', scale: 8, frameRate: 4,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#2f7fc4',     // 2 armor blue base
    '#5fb0e8',     // 3 armor highlight
    '#1d5490',     // 4 armor shadow (cool)
    '#122f52',     // 5 deep shadow
    '#eaf6ff',     // 6 lightning / eye glow (white)
    '#7ee0ff',     // 7 lightning mid (cyan)
    '#f4c542',     // 8 crown gold
    '#8a6418',     // 9 gold shadow
    '#24406b',     // 10 cape dark
  ],
  frames: [[
    [0,0,0,0,0,0,8,0,0,8,0,0,8,0,0,8,0,0,0,0,7,0,0,0],
    [0,0,0,0,0,0,8,8,9,8,8,9,8,8,9,8,0,0,0,7,6,7,0,0],
    [0,0,0,0,0,1,8,8,8,8,8,8,8,8,8,8,1,0,0,0,7,0,0,0],
    [0,0,0,0,0,1,8,9,8,9,8,9,8,9,8,9,1,0,0,6,7,6,0,0],
    [0,0,0,0,1,4,2,2,2,2,2,2,2,2,2,2,4,1,0,0,7,0,0,0],
    [0,0,0,0,1,2,3,2,6,6,2,2,6,6,2,3,2,1,0,7,6,7,0,0],
    [0,0,0,0,1,2,3,2,6,7,2,2,6,7,2,2,2,1,0,0,7,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,7,7,2,2,2,2,4,1,0,6,7,6,0,0],
    [0,0,0,0,0,1,4,2,2,4,4,4,4,2,2,4,1,0,0,0,7,0,0,0],
    [0,0,0,10,1,1,2,2,2,2,2,2,2,2,2,2,1,1,0,7,6,7,0,0],
    [0,0,10,10,1,3,3,2,2,7,7,7,7,2,2,3,3,1,0,0,7,0,0,0],
    [0,10,10,4,1,3,2,2,7,7,6,6,7,7,2,2,3,1,1,1,7,1,0,0],
    [0,10,4,4,1,2,2,2,7,6,6,6,6,7,2,2,2,1,3,3,7,3,1,0],
    [0,10,4,5,1,2,2,2,2,7,6,6,7,2,2,2,2,1,1,3,7,3,1,0],
    [0,10,10,5,1,4,2,2,2,2,7,7,2,2,2,2,4,1,0,1,7,1,0,0],
    [0,0,10,5,1,4,2,2,2,2,2,2,2,2,2,2,4,1,0,0,7,0,0,0],
    [0,0,1,5,5,1,4,2,2,2,2,2,2,2,2,4,1,5,1,0,7,0,0,0],
    [0,0,1,5,1,0,1,4,2,2,2,2,2,2,4,1,0,1,0,0,1,0,0,0],
    [0,0,0,1,0,0,1,4,2,2,4,4,2,2,4,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,2,2,4,1,1,4,2,2,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,4,2,4,1,0,1,4,2,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,4,4,1,0,0,0,1,4,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,4,1,0,0,0,0,0,1,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
  ]],
};
stormking.frames.push(pulse(stormking.frames[0], { 7: 6, 2: 3 }));

// ============================================================ ANCIENTGOLEM
// Colossal stone titan: huge blocky shoulders, cracked rune-carved body glowing with an
// inner amber core, glowing rune eyes, heavy fists, a bit of moss (green) for "ancient".
const ancientgolem = {
  name: 'boss_ancientgolem', scale: 8, frameRate: 3,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#8a9296',     // 2 stone base
    '#b9c0c2',     // 3 stone highlight (warm-grey)
    '#5f676b',     // 4 stone shadow (cool)
    '#3a4144',     // 5 deep crack
    '#ffb43c',     // 6 rune core bright (amber)
    '#d97a1e',     // 7 rune core mid
    '#6a9a3a',     // 8 moss green
    '#e8ecec',     // 9 stone spec highlight
  ],
  frames: [[
    [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,3,2,2,3,3,2,2,3,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,3,2,2,2,2,2,2,4,2,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,2,2,6,7,2,2,6,7,2,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,3,2,7,6,2,2,7,6,2,4,1,8,0,0,0,0,0,0],
    [0,0,0,0,0,1,2,4,2,2,5,5,2,2,4,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,2,2,4,5,1,1,5,4,2,4,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,2,2,2,2,2,2,2,2,1,1,1,0,0,0,0,0,0],
    [0,0,1,1,3,3,2,1,2,4,2,2,4,2,1,2,3,3,1,1,0,0,0,0],
    [0,1,3,3,2,2,2,1,4,2,2,2,2,4,1,2,2,2,3,3,1,0,0,0],
    [1,3,3,2,2,9,2,1,2,4,6,7,2,2,1,2,9,2,2,3,3,1,0,0],
    [1,3,2,2,4,2,2,1,4,6,6,6,7,4,1,2,2,4,2,2,3,1,0,0],
    [1,2,2,4,4,2,2,1,2,6,6,6,6,2,1,2,4,4,2,2,2,1,0,0],
    [1,4,2,2,8,2,4,1,4,7,6,6,7,4,1,4,2,8,2,2,4,1,0,0],
    [0,1,4,2,2,2,4,1,2,4,7,7,4,2,1,4,2,2,2,4,1,0,0,0],
    [0,1,4,4,2,4,4,1,1,2,2,2,2,1,1,4,4,2,4,4,1,0,0,0],
    [0,0,1,4,4,4,1,0,1,4,2,2,4,1,0,1,4,4,4,1,0,0,0,0],
    [0,0,1,4,5,4,1,0,1,2,2,4,2,1,0,1,4,5,4,1,0,0,0,0],
    [0,0,1,5,4,5,1,0,1,4,2,2,4,1,0,1,5,4,5,1,0,0,0,0],
    [0,0,1,4,5,4,1,0,1,4,2,4,4,1,0,1,4,5,4,1,0,0,0,0],
    [0,0,1,3,4,4,1,0,1,4,4,2,4,1,0,1,2,4,3,1,0,0,0,0],
    [0,0,1,2,3,2,1,0,1,4,2,2,4,1,0,1,3,2,4,1,0,0,0,0],
    [0,0,1,4,4,4,1,0,1,4,4,4,4,1,0,1,4,4,4,1,0,0,0,0],
    [0,0,0,1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,0,0,0,0,0],
  ]],
};
ancientgolem.frames.push(pulse(ancientgolem.frames[0], { 7: 6, 6: 6, 4: 4 }));
// golem idle: brighten the amber core (7->6) — the rune light breathes.
ancientgolem.frames[1] = pulse(ancientgolem.frames[0], { 7: 6 });

export const sprites = [necrolord, flamefiend, voidbeast, stormking, ancientgolem];
