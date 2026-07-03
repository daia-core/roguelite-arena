// Hand-crafted enemy sprites — batch 2. The two MOST-SEEN enemies (waves 1-2,
// every run) that were still on the original flat legacy path in sprites.ts and
// never migrated to the data pipeline: slime + goblin. Same rules as batch1:
// black outline, light top-left, hue-shifted ramps, catch-lit eyes, asymmetry,
// chunky silhouette. 16x16, scale 8. 2-frame idle breathe for organic bodies.
const T = 0, K = 1;

// SLIME — gooey translucent dome. Glossy top-left shine, darker cool core at the
// base, two catch-lit eyes, a little grin, one drip on the right for asymmetry.
// Green is allowed here (rule 9 exception) but pushed saturated + dark-outlined
// with a hot shine so it never camouflages into the grass.
const slime = {
  name: 'slime', scale: 8, frameRate: 5,
  //        0    1     2 base    3 hi(warm) 4 shine    5 shad(cool) 6 deep     7 white   8 pupil   9 mouth
  palette: ['transparent','#000000','#46a12a','#86d84a','#ecffd2','#2c6b3a','#193f2b','#ffffff','#12241b','#0e3320'],
  frames: [[
    [T,T,T,T,T,T,K,K,K,K,T,T,T,T,T,T],
    [T,T,T,T,T,K,3,3,2,2,K,T,T,T,T,T],
    [T,T,T,T,K,3,4,3,2,2,2,K,T,T,T,T],
    [T,T,T,K,3,4,4,3,2,2,2,5,K,T,T,T],
    [T,T,K,3,4,3,2,2,2,2,2,2,5,K,T,T],
    [T,T,K,3,2,2,2,2,2,2,2,2,5,K,T,T],
    [T,K,2,2,7,7,2,2,2,7,7,2,2,5,K,T],
    [T,K,2,2,7,8,2,2,2,7,8,2,2,5,K,T],
    [K,2,2,2,7,7,2,2,2,2,2,2,2,2,5,K],
    [K,2,2,2,2,2,2,2,2,2,2,2,2,2,5,K],
    [K,2,2,2,2,9,9,9,9,9,2,2,2,5,6,K],
    [K,2,3,2,2,2,2,2,2,2,2,2,5,5,6,K],
    [T,K,2,2,2,2,2,2,2,2,5,5,6,6,K,T],
    [T,K,5,5,2,2,2,2,5,5,6,6,6,K,T,T],
    [T,T,K,K,5,5,5,5,5,6,6,K,K,T,T,T],
    [T,T,T,T,K,K,K,K,K,K,K,T,T,T,T,T],
  ], [
    // frame 2: subtle squash — dome 1px shorter, base 1px wider, eyes lower.
    [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
    [T,T,T,T,T,T,K,K,K,K,T,T,T,T,T,T],
    [T,T,T,T,K,3,4,3,2,2,2,K,T,T,T,T],
    [T,T,T,K,3,4,4,3,2,2,2,5,K,T,T,T],
    [T,T,K,3,4,3,2,2,2,2,2,2,5,K,T,T],
    [T,K,2,3,2,2,2,2,2,2,2,2,2,5,K,T],
    [T,K,2,2,7,7,2,2,2,7,7,2,2,5,K,T],
    [K,2,2,2,7,8,2,2,2,7,8,2,2,2,5,K],
    [K,2,2,2,7,7,2,2,2,2,2,2,2,2,5,K],
    [K,2,2,2,2,2,2,2,2,2,2,2,2,2,5,K],
    [K,2,2,2,2,9,9,9,9,9,2,2,2,5,6,K],
    [K,2,3,2,2,2,2,2,2,2,2,2,5,5,6,K],
    [K,2,2,2,2,2,2,2,2,2,5,5,6,6,6,K],
    [K,5,5,2,2,2,2,2,5,5,6,6,6,6,5,K],
    [T,K,K,5,5,5,5,5,5,6,6,6,K,K,K,T],
    [T,T,T,K,K,K,K,K,K,K,K,K,T,T,T,T],
  ]],
};

// GOBLIN — hunched olive humanoid, oversized pointed ears (one bigger), hooked
// nose, angry glowing eyes, jagged fang grin, crude brown loincloth. Skin is
// olive/yellow-green (NOT slime's pure green) so the two read as different
// creatures. Head tilted left, right shoulder raised for menace.
const goblin = {
  name: 'goblin', scale: 8, frameRate: 6,
  //        0    1     2 skin    3 hi(warm) 4 shad(cool) 5 deep    6 eyeglow 7 fang     8 cloth   9 clothHi  10 clothShad 11 pupil
  palette: ['transparent','#000000','#7ba838','#b4d95f','#4f7826','#33521a','#ffd23d','#fbf4d8','#8a4a22','#b06a34','#5c3016','#7a1f10'],
  frames: [[
    [T,T,K,T,T,T,T,T,T,T,T,T,T,T,T,T],
    [T,K,3,K,T,T,K,K,K,K,K,K,T,T,T,T],
    [T,K,3,2,K,K,3,3,2,2,2,2,K,K,T,T],
    [T,K,2,2,3,3,2,2,2,2,2,2,3,2,K,T],
    [T,T,K,K,2,2,2,2,2,2,2,2,2,4,K,T],
    [T,T,T,K,3,2,5,6,2,2,5,6,2,4,K,T],
    [T,T,T,K,2,2,6,11,2,2,6,11,4,K,T,T],
    [T,T,T,K,2,2,2,5,5,2,2,2,4,K,T,T],
    [T,T,K,2,2,2,2,5,5,5,2,4,4,K,T,T],
    [T,T,K,2,2,2,2,2,2,2,2,2,4,K,T,T],
    [T,T,K,2,7,2,7,2,7,2,7,2,4,K,T,T],
    [T,T,K,4,2,2,2,2,2,2,2,4,K,T,T,T],
    [T,T,T,K,K,4,4,4,4,4,K,K,T,T,T,T],
    [T,T,T,K,8,9,8,8,8,9,8,K,T,T,T,T],
    [T,T,T,K,8,10,K,K,K,8,10,K,T,T,T,T],
    [T,T,T,T,K,2,K,T,K,2,K,T,T,T,T,T],
  ], [
    // frame 2: subtle snarl — grin closes to a fanged line, jaw tenses.
    [T,T,K,T,T,T,T,T,T,T,T,T,T,T,T,T],
    [T,K,3,K,T,T,K,K,K,K,K,K,T,T,T,T],
    [T,K,3,2,K,K,3,3,2,2,2,2,K,K,T,T],
    [T,K,2,2,3,3,2,2,2,2,2,2,3,2,K,T],
    [T,T,K,K,2,2,2,2,2,2,2,2,2,4,K,T],
    [T,T,T,K,3,2,5,6,2,2,5,6,2,4,K,T],
    [T,T,T,K,2,2,6,11,2,2,6,11,4,K,T,T],
    [T,T,T,K,2,2,2,5,5,2,2,2,4,K,T,T],
    [T,T,K,2,2,2,2,5,5,5,2,4,4,K,T,T],
    [T,T,K,2,2,2,2,2,2,2,2,2,4,K,T,T],
    [T,T,K,2,7,7,7,7,7,7,7,2,4,K,T,T],
    [T,T,K,4,2,2,2,2,2,2,2,4,K,T,T,T],
    [T,T,T,K,K,4,4,4,4,4,K,K,T,T,T,T],
    [T,T,T,K,8,9,8,8,8,9,8,K,T,T,T,T],
    [T,T,T,K,8,10,K,K,K,8,10,K,T,T,T,T],
    [T,T,T,T,K,2,K,T,K,2,K,T,T,T,T,T],
  ]],
};

// BLOB — bigger, tankier, TOXIC red cousin of the slime. Lopsided amorphous
// body (bulges right), sickly acid bubbles inside + at the edges, angry scowl
// eyes. Red so it never reads as the green slime; cooler crimson shadows sink
// the underside, warm orange catch-light on the top-left crown.
const blob = {
  name: 'blob', scale: 8, frameRate: 5,
  //        0    1     2 base    3 hi(warm) 4 shine    5 shad(cool) 6 deep    7 eye     8 pupil   9 toxic   10 toxicHi
  palette: ['transparent','#000000','#d13b2e','#f5743a','#ffd9a0','#8f2233','#571526','#fff3c0','#12241b','#a6dc3a','#e6ff8f'],
  frames: [[
    [T,T,T,T,T,T,T,T,T,K,K,T,T,T,T,T],
    [T,T,T,T,K,K,K,T,K,3,3,K,T,T,T,T],
    [T,T,T,K,3,3,2,K,3,2,2,5,K,T,T,T],
    [T,T,K,3,4,2,2,2,2,2,2,2,5,K,T,T],
    [T,K,3,4,2,2,2,2,2,2,2,2,2,5,K,T],
    [T,K,2,2,2,2,2,2,2,2,2,2,2,5,5,K],
    [K,2,2,1,1,2,2,2,2,1,1,2,2,2,5,K],
    [K,2,9,10,10,2,2,2,2,10,10,2,2,2,5,K],
    [K,2,2,10,8,2,2,2,2,8,10,2,9,2,5,K],
    [K,2,2,2,2,2,5,5,5,2,2,2,2,2,5,K],
    [K,2,2,2,2,9,2,2,2,9,2,2,2,5,6,K],
    [K,5,2,2,2,2,2,2,2,2,2,2,5,5,6,K],
    [T,K,5,2,2,2,2,2,2,2,2,5,5,6,K,T],
    [T,K,6,5,5,2,2,2,5,5,5,6,6,K,T,T],
    [T,T,K,K,6,5,5,5,5,6,6,K,K,T,T,T],
    [T,T,T,T,K,K,6,6,6,K,K,T,T,T,T,T],
  ], [
    // frame 2: toxic churn — bubbles migrate, body squashes wider + shorter.
    [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T],
    [T,T,T,T,T,T,T,T,K,K,K,T,T,T,T,T],
    [T,T,T,K,K,3,2,K,3,2,2,5,K,T,T,T],
    [T,T,K,3,4,2,2,2,2,2,2,2,5,K,T,T],
    [T,K,3,4,2,2,2,2,2,2,2,2,2,5,K,T],
    [T,K,2,2,2,2,2,2,2,2,2,2,2,5,5,K],
    [K,2,9,1,1,2,2,2,2,1,1,9,2,2,5,K],
    [K,2,2,10,10,2,2,2,2,10,10,2,2,2,5,K],
    [K,2,2,10,8,2,2,2,2,8,10,2,2,2,5,K],
    [K,2,2,2,2,2,5,5,5,2,2,2,2,2,5,K],
    [K,2,2,2,2,2,2,2,2,2,2,2,2,5,6,K],
    [K,5,2,2,2,2,2,2,2,2,2,2,5,5,6,K],
    [K,5,5,2,2,2,2,2,2,2,2,5,5,6,6,K],
    [T,K,6,5,5,2,2,2,5,5,5,6,6,6,K,T],
    [T,K,K,6,5,5,5,5,5,5,6,6,K,K,T,T],
    [T,T,T,K,K,6,6,6,6,6,K,K,T,T,T,T],
  ]],
};

export const sprites = [slime, goblin, blob];
