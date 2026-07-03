// Hand-crafted enemy sprite — batch 3. BOMBARDIER: the last enemy still rendering
// as the raw fallback flat disc (spriteName === '' with NO custom draw). It spawns
// from wave 7+ (often in pairs late) — exactly the wave Felix was play-testing — so
// it was the single worst-reading enemy in the game. Design: a stout, iron-helmeted
// artillery brute cradling a lit black bomb (the fuse spark is the readable identity
// = "this thing throws explosives"). Red armor plate so it reads as dangerous, but
// distinct from the olive goblin and the toxic-green-eyed red blob. Light top-left,
// hue-shifted ramps (cool steel/crimson shadows, warm highlights), asymmetry (bomb
// held aloft on the right, head cocked), amber eyes glowing under the helm rim.
// 16x16, scale 8. Frame 2: fuse spark flares brighter + arm bobs (the danger tell).

const bombardier = {
  name: 'bombardier', scale: 8, frameRate: 6,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#8f9aa6',     // 2 steel base
    '#d2dae4',     // 3 steel hi (warm-light)
    '#515c72',     // 4 steel shadow (cool)
    '#c0392b',     // 5 red armor base
    '#ec6a3c',     // 6 red hi (warm)
    '#7c1f2c',     // 7 red shadow (cool)
    '#ffd23d',     // 8 eye amber glow
    '#23272f',     // 9 bomb iron
    '#4a5361',     // 10 bomb hi (rim-light)
    '#ffe36b',     // 11 fuse spark (hot)
    '#ff6a1e',     // 12 fuse ember
    '#4a2f1c',     // 13 leather boot
    '#7a4a24',     // 14 leather hi
  ],
  frames: [[
    // 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,11, 0, 0], // fuse spark
    [ 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1,12, 1, 0], // helm crest / fuse ember
    [ 0, 0, 0, 1, 3, 3, 3, 2, 1, 0, 0, 1, 9,12, 9, 1], // helm dome / bomb top
    [ 0, 0, 1, 3, 3, 2, 2, 2, 4, 1, 1, 9,10, 9, 9, 1], // helm / bomb body
    [ 0, 1, 2, 3, 2, 2, 2, 2, 4, 1, 9, 9,10, 9, 9, 1], // helm rim / bomb
    [ 0, 1, 2, 1, 8, 8, 1, 8, 8, 1, 9, 9, 9, 9, 1, 0], // eyes under rim / bomb
    [ 0, 0, 1, 5, 5, 5, 5, 5, 5, 6, 6, 9, 9, 1, 0, 0], // jaw + arm rising to bomb
    [ 0, 1, 6, 6, 5, 5, 5, 5, 5, 5, 6, 6, 1, 1, 0, 0], // pauldrons (shoulders)
    [ 0, 1, 5, 6, 5, 3, 7, 5, 5, 5, 5, 5, 1, 0, 0, 0], // chest + steel rivet(3)
    [ 0, 1, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 1, 0, 0, 0], // chest seam(7)
    [ 0, 1, 5, 5, 5, 3, 7, 5, 5, 5, 7, 1, 0, 0, 0, 0], // belly + rivet
    [ 0, 0, 1, 7, 5, 5, 5, 5, 5, 7, 1, 0, 0, 0, 0, 0], // waist narrows
    [ 0, 0, 1, 7, 7, 7, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0], // belt (dark band)
    [ 0, 0, 1, 5, 5, 1, 1, 5, 5, 1, 0, 0, 0, 0, 0, 0], // thighs, clear gap
    [ 0, 0, 1,13,14, 1, 1,13,14, 1, 0, 0, 0, 0, 0, 0], // legs (leather)
    [ 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0], // boots
  ], [
    // frame 2: fuse flares brighter (bigger hot spark + ember cluster), eyes
    // narrow to a menacing squint. Body identical so it's clearly the same brute.
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,11,11, 0, 0], // brighter spark
    [ 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1,12,11,12, 1], // ember flare
    [ 0, 0, 0, 1, 3, 3, 3, 2, 1, 0, 0, 1, 9,12, 9, 1], // helm / bomb top
    [ 0, 0, 1, 3, 3, 2, 2, 2, 4, 1, 1, 9,10, 9, 9, 1], // helm / bomb
    [ 0, 1, 2, 3, 2, 2, 2, 2, 4, 1, 9, 9,10, 9, 9, 1], // helm rim / bomb
    [ 0, 1, 2, 1, 8, 1, 1, 1, 8, 1, 9, 9, 9, 9, 1, 0], // eyes squint / bomb
    [ 0, 0, 1, 5, 5, 5, 5, 5, 5, 6, 6, 9, 9, 1, 0, 0], // jaw + arm
    [ 0, 1, 6, 6, 5, 5, 5, 5, 5, 5, 6, 6, 1, 1, 0, 0], // pauldrons
    [ 0, 1, 5, 6, 5, 3, 7, 5, 5, 5, 5, 5, 1, 0, 0, 0], // chest + rivet
    [ 0, 1, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 1, 0, 0, 0], // chest seam
    [ 0, 1, 5, 5, 5, 3, 7, 5, 5, 5, 7, 1, 0, 0, 0, 0], // belly + rivet
    [ 0, 0, 1, 7, 5, 5, 5, 5, 5, 7, 1, 0, 0, 0, 0, 0], // waist
    [ 0, 0, 1, 7, 7, 7, 7, 7, 7, 7, 1, 0, 0, 0, 0, 0], // belt
    [ 0, 0, 1, 5, 5, 1, 1, 5, 5, 1, 0, 0, 0, 0, 0, 0], // thighs
    [ 0, 0, 1,13,14, 1, 1,13,14, 1, 0, 0, 0, 0, 0, 0], // legs
    [ 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0], // boots
  ]],
};

// SWARM — the auto-enhanced version read as disconnected fragments (floating bee
// parts + a stray beak), not one creature. A swarm is conceptually MANY small
// things, so the fix is a tight CLUSTER of angry hornets packed into one buzzing
// ball silhouette: overlapping orange/black-striped bodies, MULTIPLE red eyes
// (the "many creatures" tell), pale wing-haze flecks at the edges for frantic
// motion. Fast + small in-game (radius 8) so it must read as a dense menacing mass.
const swarm = {
  name: 'swarm', scale: 8, frameRate: 8,
  palette: [
    'transparent', // 0
    '#000000',     // 1 outline
    '#f39c12',     // 2 hornet orange base
    '#ffc247',     // 3 orange hi (warm)
    '#b5651d',     // 4 orange shadow (cool-ish)
    '#3a2410',     // 5 stripe black-brown
    '#e8f0ff',     // 6 wing haze (pale)
    '#ff3b30',     // 7 eye (angry red)
    '#2a1a08',     // 8 deep shadow
  ],
  frames: [[
    // 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    [ 0, 0, 0, 0, 0, 0, 6, 6, 0, 0, 0, 0, 0, 0, 0, 0], // wing nub (top)
    [ 0, 0, 0, 6, 1, 1, 1, 1, 1, 1, 6, 0, 0, 0, 0, 0], // two bumps
    [ 0, 0, 1, 1, 3, 2, 2, 3, 2, 2, 1, 1, 0, 0, 0, 0], // bump backs
    [ 0, 1, 3, 2, 7, 2, 1, 2, 2, 7, 2, 3, 1, 0, 0, 0], // eyes + body gap
    [ 6, 1, 2, 2, 2, 2, 5, 2, 2, 2, 2, 2, 1, 6, 0, 0], // stripe / wing nubs
    [ 0, 1, 3, 7, 2, 1, 8, 1, 2, 7, 2, 2, 3, 1, 0, 0], // eyes + dark gap(8)
    [ 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 6, 0], // mid mass
    [ 6, 1, 2, 7, 2, 1, 8, 1, 2, 2, 7, 2, 2, 1, 0, 0], // gap + eyes
    [ 0, 1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1, 0, 0, 0], // body
    [ 0, 1, 2, 2, 7, 2, 5, 2, 7, 2, 2, 2, 1, 6, 0, 0], // eyes + stripe
    [ 0, 6, 1, 3, 2, 2, 2, 2, 2, 2, 3, 1, 0, 0, 0, 0], // bumps
    [ 0, 0, 1, 1, 2, 7, 2, 2, 7, 2, 1, 1, 0, 0, 0, 0], // bottom bumps + eyes
    [ 0, 0, 0, 6, 1, 1, 3, 3, 1, 1, 6, 0, 0, 0, 0, 0], // bottom edge
    [ 0, 0, 0, 0, 0, 6, 1, 1, 6, 0, 0, 0, 0, 0, 0, 0], // wing nub (bottom)
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ], [
    // frame 2: buzz jitter — wing nubs jump to the sides, eyes and dark gaps shift
    // one cell, stripes slide, so the whole mass vibrates in place. Same silhouette.
    [ 0, 0, 0, 0, 0, 6, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0], // wing nubs split
    [ 0, 0, 0, 6, 1, 1, 1, 1, 1, 1, 6, 0, 0, 0, 0, 0],
    [ 0, 0, 1, 1, 2, 3, 2, 2, 3, 2, 1, 1, 0, 0, 0, 0],
    [ 0, 1, 3, 7, 2, 2, 1, 2, 7, 2, 2, 3, 1, 0, 0, 0], // eyes shifted
    [ 6, 1, 2, 2, 2, 5, 2, 2, 2, 2, 5, 2, 1, 6, 0, 0],
    [ 0, 1, 3, 2, 7, 1, 2, 8, 1, 2, 7, 2, 3, 1, 0, 0], // dark gap moved
    [ 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 6, 0],
    [ 6, 1, 2, 2, 7, 1, 2, 8, 1, 7, 2, 2, 2, 1, 0, 0],
    [ 0, 1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1, 0, 0, 0],
    [ 0, 1, 2, 7, 2, 5, 2, 7, 2, 2, 2, 2, 1, 6, 0, 0],
    [ 0, 6, 1, 3, 2, 2, 2, 2, 2, 2, 3, 1, 0, 0, 0, 0],
    [ 0, 0, 1, 1, 2, 2, 7, 7, 2, 2, 1, 1, 0, 0, 0, 0],
    [ 0, 0, 0, 6, 1, 1, 3, 3, 1, 1, 6, 0, 0, 0, 0, 0],
    [ 0, 6, 0, 0, 0, 6, 1, 1, 6, 0, 0, 6, 0, 0, 0, 0],
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ]],
};

export const sprites = [bombardier, swarm];
