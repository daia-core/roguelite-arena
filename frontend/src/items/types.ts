// Item type definitions — the shape of every item, its tags/kinds, and weapon patterns.
// Split out of the old ItemSystem monolith so the data catalog, the type contract, and
// the runtime logic (ItemDatabase / PlayerStats) each live in their own file. Nothing
// here has behaviour; it is pure types + the two small pure helpers that classify an item.

export const ItemTier = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Legendary: 4
} as const;

export type ItemTier = typeof ItemTier[keyof typeof ItemTier];

export type ItemTag = 'melee' | 'ranged' | 'defensive' | 'economic' | 'elemental' | 'utility';

// At-a-glance category shown on item cards (orthogonal to the synergy tags above):
//   weapon  = adds/changes an attack (swing-altering, aux weapon, projectile modifier)
//   passive = an always-on stat or on-hit effect
//   active  = a periodic/triggered effect that fires on its own (bomb drop, nova pulse)
// Items can be several at once (a spear that also grants move speed = weapon + passive).
export type ItemKind = 'weapon' | 'passive' | 'active';

// Derive an item's kinds from its fields, so the roster stays correct without hand-tagging
// all ~200 entries. Weapon/active are detected by the mechanical fields they use; anything
// with a plain stat/effect is passive. Every item resolves to at least one kind.
export function getItemKinds(item: Item): ItemKind[] {
  const kinds: ItemKind[] = [];
  const isWeapon = item.weaponType !== undefined
    || item.swingDamageMult !== undefined || item.swingRangeBonus !== undefined
    || item.swingArcBonus !== undefined || item.swingCooldownMult !== undefined
    || item.swingAoe !== undefined || item.meleeDamageMult !== undefined
    || item.orbitOrbs !== undefined || item.auxMelee === true
    || item.multishot !== undefined || item.piercing !== undefined
    || item.homing === true || item.projectileSpeed !== undefined
    || item.multicast !== undefined;
  const isActive = item.bombDrop === true || item.novaPulse === true;
  const isPassive = !isWeapon && !isActive
    || item.damageMultiplier !== undefined || item.fireRateMultiplier !== undefined
    || item.critChance !== undefined || item.critDamageMultiplier !== undefined
    || item.speedMultiplier !== undefined || item.maxHealthBonus !== undefined
    || item.healthRegen !== undefined || item.armor !== undefined
    || item.lifesteal !== undefined || item.thorns !== undefined
    || item.dodge !== undefined || item.xpMagnet !== undefined
    || item.goldBonus !== undefined || item.luck !== undefined
    || item.interestBonus !== undefined || item.aoeRadiusMult !== undefined;
  if (isWeapon) kinds.push('weapon');
  if (isActive) kinds.push('active');
  if (isPassive || kinds.length === 0) kinds.push('passive');
  return kinds;
}

// Resolve an item's equipment slot CATEGORY. Uses the explicit `slot` field when the
// item declares one (gear pieces + amulet keystones do); otherwise infers from mechanics:
//   • a melee or laser weaponType is a committed, "big" weapon → two-hand
//   • any other weaponType (shotgun, orbital, one-hand blade) → one-hand
//   • a pure shield item → offhand
//   • everything else → trinket (unlimited stacking, no equip)
// Kept pure + dependency-free so both the runtime and QA can call it.
export function classifyItemSlot(item: Item): EquipSlot {
  if (item.slot) return item.slot;
  if (item.weaponType) {
    // melee and laser are the heavy, defining weapons → two-hand.
    if (item.weaponType === 'melee' || item.weaponType === 'laser') return 'weapon-2h';
    return 'weapon-1h';
  }
  // A shield with no other build-defining weapon role is an off-hand.
  if (item.shield) return 'offhand';
  return 'trinket';
}

// The live-loadout holder an EquipSlot category maps to. Both weapon categories share
// the single `weapon` holder; every other gear category has a like-named holder.
// `trinket` has no holder (it lives in the unlimited trinket pile).
export type EquipHolder = 'weapon' | 'offhand' | 'head' | 'amulet' | 'torso' | 'legs' | 'feet' | 'ring';

export function slotHolder(slot: EquipSlot): EquipHolder | null {
  switch (slot) {
    case 'weapon-1h':
    case 'weapon-2h': return 'weapon';
    case 'offhand': return 'offhand';
    case 'head': return 'head';
    case 'amulet': return 'amulet';
    case 'torso': return 'torso';
    case 'legs': return 'legs';
    case 'feet': return 'feet';
    case 'ring': return 'ring';
    default: return null; // trinket
  }
}

// True when the item never equips into a slot (unlimited-stacking trinket pile).
export function isTrinket(item: Item): boolean {
  return classifyItemSlot(item) === 'trinket';
}

// Short human label for an item's equip slot — the "what is this / where does it go"
// badge on shop cards and the inspect tooltip. A trinket reads as "Trinket" so the
// unlimited-stacking pile is never confused with limited gear.
export function slotLabel(item: Item): string {
  switch (classifyItemSlot(item)) {
    case 'weapon-1h': return '1H Weapon';
    case 'weapon-2h': return '2H Weapon';
    case 'offhand': return 'Off-Hand';
    case 'head': return 'Head';
    case 'amulet': return 'Amulet';
    case 'torso': return 'Torso';
    case 'legs': return 'Legs';
    case 'feet': return 'Feet';
    case 'ring': return 'Ring';
    default: return 'Trinket';
  }
}

// Turn an item's raw numeric fields into short, readable stat lines ("+15% Damage",
// "+2 Armor", "Shield"). Pure + dependency-free so the shop card, the inspect
// tooltip, and QA can all render the same at-a-glance breakdown. Storage conventions:
//   • multiplier fields are stored as 1.15 → shown as "+15%" (v-1)
//   • fraction fields are stored as 0.12 → shown as "+12%" (v)
//   • flat fields are stored as 15 → shown as "+15" (may be negative, e.g. -10 Max HP)
// Booleans render as a bare capability label. Long-tail/exotic fields are left to the
// hand-written description so this list stays a scannable core, not an exhaustive dump.
// A single displayed stat, tagged so the UI can colour drawbacks distinctly.
// `neg` is true when this line is a downside (a reduction to a higher-is-better
// stat) — every field surfaced here is one where "more is better", so a value
// below the identity (multiplier <1, or a negative flat/fraction) is always a
// penalty. Powerful drawback-gated items lean on this to render their trade-off
// in red instead of hiding it in the same green as their upside.
export interface ItemStatSegment { text: string; neg: boolean; }

export function itemStatSegments(item: Item): ItemStatSegment[] {
  const segs: ItemStatSegment[] = [];
  const mul = (v: number | undefined, label: string) => {
    if (v === undefined) return;
    const p = Math.round((v - 1) * 100);
    if (p !== 0) segs.push({ text: `${p > 0 ? '+' : ''}${p}% ${label}`, neg: p < 0 });
  };
  const frac = (v: number | undefined, label: string) => {
    if (v === undefined) return;
    const p = Math.round(v * 100);
    if (p !== 0) segs.push({ text: `${p > 0 ? '+' : ''}${p}% ${label}`, neg: p < 0 });
  };
  const flat = (v: number | undefined, label: string) => {
    if (v === undefined || v === 0) return;
    segs.push({ text: `${v > 0 ? '+' : ''}${v} ${label}`, neg: v < 0 });
  };
  const flag = (v: boolean | undefined, label: string) => { if (v) segs.push({ text: label, neg: false }); };

  // Offense
  mul(item.damageMultiplier, 'Damage');
  mul(item.meleeDamageMult, 'Melee Dmg');
  mul(item.rangedDamageMult, 'Ranged Dmg');
  mul(item.elementalDamageMult, 'Elemental Dmg');
  mul(item.fireRateMultiplier, 'Fire Rate');
  frac(item.critChance, 'Crit');
  mul(item.critDamageMultiplier, 'Crit Dmg');
  flat(item.multishot, 'Multishot');
  flat(item.piercing, 'Pierce');
  // Defense / survival
  flat(item.maxHealthBonus, 'Max HP');
  flat(item.healthRegen, 'HP/s');
  flat(item.armor, 'Armor');
  frac(item.lifesteal, 'Lifesteal');
  frac(item.thorns, 'Thorns');
  frac(item.dodge, 'Dodge');
  // Utility / economy
  mul(item.speedMultiplier, 'Speed');
  mul(item.xpMagnet, 'XP Range');
  mul(item.goldBonus, 'Gold');
  frac(item.luck, 'Luck');
  // On-hit / status chances
  frac(item.chainLightning, 'Chain');
  frac(item.freeze, 'Freeze');
  frac(item.burn, 'Burn');
  frac(item.bleed, 'Bleed');
  frac(item.doom, 'Doom');
  frac(item.wound, 'Wound');
  frac(item.multicast, 'Multicast');
  // Capability flags
  flag(item.shield, 'Shield');
  flag(item.homing, 'Homing');
  flag(item.poison, 'Poison');
  flag(!!item.knockback, 'Knockback');
  flag(item.explosionOnHit, 'Explode on Hit');
  flag(item.bombDrop, 'Bomb Drop');
  flag(item.novaPulse, 'Nova Pulse');
  flag(item.auxMelee, 'Orbit Blade');
  flat(item.orbitOrbs, 'Orbit Orbs');
  return segs;
}

export function itemStatLines(item: Item): string[] {
  return itemStatSegments(item).map(s => s.text);
}

// True when the hand-written description merely restates the auto-generated stat
// lines (e.g. description "+8% damage" vs stat row "+8% Damage") — pure redundancy
// that shows the same numbers twice on a card, so the shop card + inspect popup skip
// drawing the description entirely and let the green stat row stand alone.
//
// Token-subsumption, not exact match: a description is a restatement when every
// meaningful token in it is already accounted for by the stat row (after dropping
// filler words and mapping wording synonyms — "health"→"hp", "move speed"→"speed",
// "projectile"→"multishot", etc.). This suppresses the ~165 catalog items whose
// description just rewords the numbers ("+15 max health" vs "+15 Max HP",
// "+45% melee/swing damage, -8% fire rate" vs "+45% Melee Dmg · -8% Fire Rate") while
// keeping any description that introduces genuinely new words (flavour or extra
// mechanics not in the stat row).
const RESTATE_STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'with', 'to', 'of', 'per', 'on', 'in', 'at',
  'hit', 'hits', 'your', 'you', 'all', 'each', 'every', 'then', 'plus', 'also', 'for',
  'gain', 'gains', 'grant', 'grants', 'more', 'less', 'extra', 'is', 'are', 'by', 'up',
  'enemies', 'enemy', 'foes', 'foe', 'chance', 'shots', 'shot', 'bullets', 'bullet',
  'attack', 'attacks', 'earned', 'heal', 'heals', 'massive', 'nearby', 'that', 'from',
  'strong', 'weak', 'slight', 'huge', 'minor', 'major', 'high', 'low', 'small', 'big',
]);
// Wording synonyms → canonical stat vocabulary. Empty string = drop (noise word).
const RESTATE_SYN: Record<string, string> = {
  health: 'hp', hp: 'hp', hps: 'hps', hpsec: 'hps', sec: 's', s: 's',
  move: '', movement: '', movespeed: 'speed', speed: 'speed',
  dmg: 'damage', damage: 'damage', melee: 'melee', swing: 'melee', ranged: 'ranged',
  elemental: 'elemental', fire: 'fire', rate: 'rate', firerate: 'fire',
  crit: 'crit', critical: 'crit', dodge: 'dodge', armor: 'armor', armour: 'armor',
  projectile: 'multishot', projectiles: 'multishot', multishot: 'multishot',
  pierce: 'pierce', piercing: 'pierce',
  lifesteal: 'lifesteal', leech: 'lifesteal', thorns: 'thorns', reflect: 'thorns',
  explode: 'explode', explodes: 'explode', explosion: 'explode', explosions: 'explode',
  explosive: 'explode',
  gold: 'gold', luck: 'luck', xp: 'xp', exp: 'xp', experience: 'xp', pickup: 'xp',
  range: 'xp', homing: 'homing', knockback: 'knockback', max: 'max', regen: '',
  lightning: 'chain', chain: 'chain',
};
function restateTokens(s: string): Set<string> {
  const raw = s.toLowerCase().replace(/[^a-z0-9%+\-]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let t of raw) {
    // fold "+15%" and "15%" together (a description dropping the leading + still
    // restates the same number); keep "-" so negatives stay distinct.
    t = t.replace(/^\+/, '');
    if (RESTATE_STOP.has(t)) continue;
    const mapped = t in RESTATE_SYN ? RESTATE_SYN[t] : t;
    if (mapped) out.add(mapped);
  }
  return out;
}
export function descRestatesStats(description: string, stats: string[]): boolean {
  if (stats.length === 0) return false;
  const descTokens = restateTokens(description);
  if (descTokens.size === 0) return true; // nothing but filler beyond the stats
  const statTokens = restateTokens(stats.join(' '));
  for (const t of descTokens) if (!statTokens.has(t)) return false;
  return true;
}

// Weapon attack patterns (Brotato-inspired)
export type WeaponType =
  | 'auto-aim' // Default: auto-aim bullets
  | 'shotgun' // Spread of projectiles
  | 'laser' // Continuous beam
  | 'orbital' // Rotating projectiles around player
  | 'melee'; // Swing/slash around player

// The visual + hit-shape of a melee swing. Purely how a swing READS and connects;
// the damage/reach/arc numbers still come from the swing stats. Lets one melee
// pipeline express the whole Brotato melee family (blades sweep, spears thrust,
// heavy weapons whirl or slam) instead of a single generic pixel arc.
//   arc    — a directional sweeping slash (swords/blades). Default.
//   thrust — a narrow, deep forward lunge (spears/rapiers): long reach, tight arc.
//   spin   — a full 360° whirl (heavy blades / when swingAoe is active).
//   slam   — an overhead smash onto a circular zone out front (hammers/mauls).
export type MeleeStyle = 'arc' | 'thrust' | 'spin' | 'slam';

// EQUIPMENT SLOTS (2026-07-05 v2 rework). Gear is a limited build decision with 8
// distinct slots. Every item resolves to exactly one EquipSlot category:
//   weapon-1h — a one-hand weapon; leaves the off-hand free.
//   weapon-2h — a two-hand weapon; fills the weapon slot AND disables the off-hand.
//   offhand   — a shield / off-hand focus (disabled while a 2h weapon is equipped).
//   head      — helmets / hats.
//   amulet    — a single build-defining keystone / necklace.
//   torso     — body armor.
//   legs      — leg armor.
//   feet      — boots.
//   ring      — rings.
//   trinket   — everything else: unlimited stacking, never equipped, no slot.
// The field is optional on the data so the catalog doesn't need every entry hand-
// tagged; classifyItemSlot() infers a sensible slot from the item's mechanics when
// `slot` is absent. Gear pieces + amulet keystones are hand-tagged via `slot`.
export type EquipSlot =
  | 'weapon-1h' | 'weapon-2h' | 'offhand'
  | 'head' | 'amulet' | 'torso' | 'legs' | 'feet' | 'ring'
  | 'trinket';

export interface Item {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  tier: ItemTier;
  cost: number;
  icon: string;
  unlocked: boolean;
  tags: ItemTag[]; // For synergy detection and affinity system

  // EQUIPMENT SLOT (optional; classifyItemSlot infers it when absent). Set explicitly
  // only to override the inferred slot — e.g. promoting a keystone to 'amulet' or
  // tagging a gear piece as head/torso/legs/feet/ring.
  slot?: EquipSlot;

  // UPGRADE LEVEL (2026-07-05 v2). Instance-only state on the copy the player OWNS
  // (never on the shared catalog object — clone before mutating). Default 1. Buying an
  // item you already have increments this instead of adding a copy; aggregation scales
  // each contribution by the level ("Amulet +7" = the item's effect applied 7×, exactly
  // as if bought 7 times). Absent/undefined is treated as level 1.
  upgradeLevel?: number;

  // Weapon system (Brotato-inspired)
  weaponType?: WeaponType; // Changes attack behavior
  weaponRange?: number; // For melee weapons
  weaponArc?: number; // For melee sweep angle (radians)

  // AUXILIARY STACKING WEAPONS — these run ALONGSIDE the primary weapon (they do
  // NOT replace weaponType), so a gun build can also spin blades, orbit orbs,
  // drop bombs and pulse novas. Additive/count fields stack across copies;
  // boolean fields don't (a duplicate is wasted, so the shop stops offering it).
  orbitOrbs?: number; // extra energy orbs circling the player (additive)
  orbitDamageMult?: number; // scales orbit-orb contact damage
  auxMelee?: boolean; // a whirling melee arc that swings on its own timer
  auxMeleeDamageMult?: number; // scales the aux melee damage
  bombDrop?: boolean; // periodically drop a bomb at the player's feet
  bombDamageMult?: number; // scales bomb blast damage
  bombCooldownMult?: number; // <1 = bombs drop faster (multiplies the base cooldown)
  novaPulse?: boolean; // periodic expanding shockwave from the player
  novaDamageMult?: number; // scales nova damage
  novaCooldownMult?: number; // <1 = novas fire faster

  // MELEE SWING — every player has a default swing that auto-hits nearby enemies.
  // These fields let items shape it into distinct melee builds. The swing STACKS on
  // top of the (always-firing) ranged weapon, so a melee build still shoots weakly.
  swingDamageMult?: number; // scales the default swing damage (multiplicative)
  swingRangeBonus?: number; // flat range added to the swing reach (px)
  swingArcBonus?: number; // radians added to the swing arc width
  swingCooldownMult?: number; // <1 = swing faster, >1 = slower/heavier
  swingAoe?: number; // radius of a full-circle AOE burst on each swing (px); makes the swing hit all around
  aoeRadiusMult?: number; // GLOBAL area multiplier — scales swing AOE, nova, and bomb radii
  meleeStyle?: MeleeStyle; // swing shape/animation (arc default; thrust/spin/slam for spears/heavies)

  // Stat modifiers
  damageMultiplier?: number;
  // Per-damage-type multipliers (Brotato-style). These layer ON TOP of the global
  // damageMultiplier and only apply to the matching source, so an item can read
  // "+45% melee dmg, -10% ranged dmg" — a real specialisation cost that makes a
  // melee build and a ranged build mechanically different, not just a tag.
  meleeDamageMult?: number; // multiplies melee-weapon hits only
  rangedDamageMult?: number; // multiplies projectile hits only
  elementalDamageMult?: number; // multiplies on-hit elemental effects (chain, explosion)
  fireRateMultiplier?: number;
  critChance?: number; // Additive
  critDamageMultiplier?: number; // Multiplicative
  speedMultiplier?: number;
  maxHealthBonus?: number; // Additive
  healthRegen?: number; // HP per second
  armor?: number; // Flat damage reduction

  // Special effects
  piercing?: number; // Number of enemies to pierce
  explosionOnHit?: boolean;
  chainLightning?: number; // Percentage chance
  lifesteal?: number; // Percentage
  thorns?: number; // Percentage reflect
  shield?: boolean;
  multishot?: number; // Extra projectiles
  projectileSpeed?: number;
  knockback?: number;
  xpMagnet?: number; // Multiplier for pickup range
  goldBonus?: number; // Multiplier
  dodge?: number; // Percentage chance to evade
  poison?: boolean; // DoT effect
  freeze?: number; // Percentage chance to slow
  homing?: boolean; // Bullets curve toward enemies

  // STATUS ENGINES (Phase 3b — inspired by Soulstone Survivors). Each is an on-hit
  // status that ticks in the enemy loop, so they stack across a whole DoT/status build
  // and are mechanically distinct from raw damage. All apply from BOTH ranged and melee.
  burn?: number; // chance to Ignite: fast, short fire DoT (bigger ticks than poison)
  bleed?: number; // chance to Bleed: DoT that hits harder while the enemy is moving (punishes rushers)
  poisonSpread?: boolean; // a poisoned enemy that dies infects the nearest enemy (chain plague)
  doom?: number; // chance to mark with Doom: stores a share of damage, then detonates — executes if stored >= current HP
  wound?: number; // chance on-hit to Wound: amplifies ALL damage-over-time already on that enemy (DoT multiplier)
  multicast?: number; // chance the ranged weapon fires a bonus volley the same frame

  // Brotato-inspired mechanics
  rerollDiscount?: number; // Reduce shop reroll cost
  shopDiscount?: number; // Reduce all shop prices
  interestBonus?: number; // Additional interest rate on banked gold (additive, e.g. 0.05 = +5%)
  luck?: number; // Raises shop rarity + health-orb drop chance (additive, e.g. 0.15 = +15%)

  // ---- CONDITIONAL / TRIGGERED DAMAGE (the game's first non-static item layer) ----
  // Unlike every field above (a flat always-on stat), these only pay out when a run
  // CONDITION is met — so they reward a play pattern, not just ownership. Each is an
  // additive rate summed across copies (stacking duplicates deepens the effect) and
  // is folded into the per-frame runtime damage/fire-rate multiplier by Game
  // (updateRuntimeModifiers), exactly like the momentum/berserk artifacts. Values are
  // "+fraction" (0.5 = +50%). Thresholds/caps live as constants in Game.ts.
  waveRampDamage?: number;   // Grindstone: permanent +dmg for each wave survived this run
  lowHpPower?: number;       // Last Stand: while HP is low, +dmg AND +fire rate
  killStackDamage?: number;  // Killing Spree: each kill adds a decaying +dmg stack
  highHpPower?: number;      // Juggernaut: while HP is high (unhurt), +dmg
  goldScaleDamage?: number;  // Miser's Hoard: +dmg scaling with unspent gold on hand

  // ---- ON-KILL MILESTONE (Soul Tithe) ----
  // A run-long on-kill counter: every 10th kill while held drops a health orb, and
  // every 50th kill banks a PERMANENT +1% damage stack (no cap) — so clear speed
  // itself becomes a scaling stat and a turn-1 pickup snowballs across the whole run.
  soulTithe?: boolean;

  // ---- ON-KILL PROC (Ceremonial Daggers) ----
  // On every kill, spawn this many homing spectral daggers that seek nearby enemies,
  // turning kills into a self-sustaining chain that clears trash and snowballs dense
  // waves. Additive across copies (more daggers per kill). Bounded against runaway
  // recursion in Game: a dagger's OWN kill never spawns more daggers (one generation
  // per primary kill), so a dense pack can't cascade into an exponential dagger storm.
  ceremonialDaggers?: number;

  // ---- EVERY-Nth-SHOT (Pen Nib / Loaded Shot) ----
  // While held, every 10th primary shot is "loaded": triple damage and pierces every
  // enemy. A predictable rhythm burst that rewards fire-rate builds. Boolean (OR'd
  // across copies) — a second copy can't shorten the cadence.
  loadedShot?: boolean;

  // ---- ON-WAVE-END ECONOMY (War Chest) ----
  // At the end of each wave, bank gold equal to this multiplier × the wave number — a
  // compounding income engine that scales the SHOP (greed builds) instead of combat, and
  // pays out ever bigger the longer you survive. Additive across copies. Folded in at the
  // wave-end shop transition, alongside banking interest.
  warChest?: number;

  // ---- EXECUTE (on-hit conditional, resolved in Game's projectile-hit path) ----
  // Instantly kill a NON-boss enemy the moment a hit leaves it at or below this
  // fraction of max HP. Stacked copies take the HIGHEST threshold (Math.max), not
  // a sum — cheap copies can't compound into "execute at full HP". The kill routes
  // through the normal kill path, so it still grants XP/gold and feeds Killing Spree.
  executeThreshold?: number; // e.g. 0.15 = execute enemies at/under 15% HP

  // ---- PROC LUCK (roll-twice-keep-better) ----
  // When held, every random on-hit STATUS proc (burn/bleed/freeze/chain/doom/wound/
  // multicast) rolls twice and takes the better result — a keystone that lifts the
  // whole status/proc ecosystem without touching any individual chance. Boolean
  // (OR'd across copies): a second copy can't roll three times. Does NOT touch crit
  // or dodge (core stats), only the status ecosystem this item is built around.
  fourleafCharm?: boolean;
}

export interface Weapon {
  id: string;
  name: string;
  baseName: string; // For combining (e.g., "Sword")
  tier: ItemTier;
  damage: number;
  icon: string;
  cost: number;
  unlocked: boolean;
}
