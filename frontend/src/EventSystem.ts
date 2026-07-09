// Event nodes (the `?` rooms). A text choice screen with 2-3 options, each with
// an outcome the game applies (grant an artifact, gamble gold, heal-for-a-cost,
// take a boon with a downside…). Kept data-driven: effects are descriptors that
// Game.ts resolves at the combat/economy sites it already owns.

export type EventEffect =
  | { kind: 'artifact' }                 // grant a random un-held artifact (pick)
  | { kind: 'gold'; amount: number }     // +/- gold
  | { kind: 'heal'; frac: number }       // heal frac * maxHP
  | { kind: 'hurt'; frac: number }       // lose frac * maxHP (event damage never kills)
  | { kind: 'maxHp'; amount: number }    // +/- max HP
  | { kind: 'item' }                     // grant a random shop-tier item
  | { kind: 'curse'; id: string }        // devil-deal price: grant a SPECIFIC curse artifact by id
  | { kind: 'nothing' };

// A stat the player must ALREADY have enough of for a gated option to be selectable.
// Values are read from PlayerStats at the moment the event opens (Game.meetsRequirement).
export type EventStat =
  | 'meleeDmgPct'   // melee-damage bonus above base, in % — (getMeleeDamageMult()-1)*100
  | 'rangedDmgPct'  // ranged-damage bonus above base, in %
  | 'critPct'       // crit chance, in %
  | 'moveSpeedPct'  // move-speed bonus above base, in %
  | 'armor'         // flat armor
  | 'maxHp'         // flat max HP
  | 'gold';         // current gold on hand

/** A Slay-the-Spire-style stat gate: the option is only pickable when stat >= min. */
export interface EventRequirement {
  stat: EventStat;
  min: number;
  /** Short human tag shown on the button, e.g. 'Melee +30%'. */
  label: string;
}

export interface EventOption {
  label: string;
  effects: EventEffect[];
  /** Shown after the option is chosen, before returning to the map. */
  result: string;
  /**
   * Optional stat gate. When present and unmet, the option renders locked (greyed,
   * un-clickable) with the requirement shown; when met it reads as an unlocked choice.
   */
  requirement?: EventRequirement;
}

export interface GameEvent {
  id: string;
  title: string;
  text: string;
  options: EventOption[];
}

// ~33 events — a mix of pure upside (rare), gamble, cost/benefit trades, and
// stat-gated (requirement-locked) choices so the `?` node always feels like a real
// decision rather than free loot.
export const EVENTS: GameEvent[] = [
  {
    id: 'shrine',
    title: 'The Forgotten Shrine',
    text: 'A cracked altar hums with old power. An offering bowl waits.',
    options: [
      { label: 'Offer 30 gold', effects: [{ kind: 'gold', amount: -30 }, { kind: 'artifact' }],
        result: 'The shrine drinks your gold and answers with power.' },
      { label: 'Pray (costs nothing)', effects: [{ kind: 'heal', frac: 0.4 }],
        result: 'A warm calm restores some of your wounds.' },
      { label: 'Leave it be', effects: [{ kind: 'nothing' }],
        result: 'You step past. Some doors are best left shut.' },
    ],
  },
  {
    id: 'wager',
    title: 'The Gambler',
    text: 'A grinning figure shuffles bones. "Double or nothing on your luck?"',
    options: [
      { label: 'Bet 40 gold', effects: [{ kind: 'gold', amount: 40 }],
        result: 'The bones fall your way — you pocket the winnings.' },
      { label: 'Bet your blood', effects: [{ kind: 'hurt', frac: 0.2 }, { kind: 'artifact' }],
        result: 'Pain buys power. The figure cackles and vanishes.' },
      { label: 'Walk away', effects: [{ kind: 'nothing' }],
        result: 'You keep your gold and your blood. Wise.' },
    ],
  },
  {
    id: 'cache',
    title: 'Abandoned Cache',
    text: 'A supply crate, half-buried. The lock is rusted but weak.',
    options: [
      { label: 'Force it open', effects: [{ kind: 'item' }],
        result: 'The lid gives way — gear inside, still usable.' },
      { label: 'Take the coin pouch', effects: [{ kind: 'gold', amount: 50 }],
        result: 'A heavy pouch of gold. That will do nicely.' },
    ],
  },
  {
    id: 'transfusion',
    title: 'The Blood Pact',
    text: 'A vial of dark ichor promises strength woven into your veins.',
    options: [
      { label: 'Drink it', effects: [{ kind: 'maxHp', amount: 40 }, { kind: 'artifact' }],
        result: 'Your heart pounds harder — and something new stirs.' },
      { label: 'Pour it out', effects: [{ kind: 'heal', frac: 0.5 }],
        result: 'You wash your wounds with it instead. Refreshing.' },
      { label: 'Refuse', effects: [{ kind: 'nothing' }],
        result: 'You leave the vial untouched.' },
    ],
  },
  {
    id: 'merchant',
    title: 'Wandering Merchant',
    text: 'A cloaked trader spreads curious wares on a rug.',
    options: [
      { label: 'Buy the relic (60g)', effects: [{ kind: 'gold', amount: -60 }, { kind: 'artifact' }],
        result: 'A fair trade. The relic is yours.' },
      { label: 'Buy a trinket (20g)', effects: [{ kind: 'gold', amount: -20 }, { kind: 'item' }],
        result: 'A modest but useful buy.' },
      { label: 'Browse and leave', effects: [{ kind: 'nothing' }],
        result: 'Nothing catches your eye today.' },
    ],
  },
  {
    id: 'fountain',
    title: 'The Healing Fountain',
    text: 'Clear water bubbles up, faintly glowing. It smells of mint and iron.',
    options: [
      { label: 'Drink deeply', effects: [{ kind: 'heal', frac: 0.7 }],
        result: 'Vitality floods back into you.' },
      { label: 'Bottle it for later', effects: [{ kind: 'maxHp', amount: 25 }],
        result: 'You feel permanently hardier for carrying it.' },
    ],
  },
  {
    id: 'gauntlet',
    title: 'Trial of the Reckless',
    text: 'Runes offer power to those willing to fight wounded.',
    options: [
      { label: 'Accept the trial', effects: [{ kind: 'hurt', frac: 0.3 }, { kind: 'artifact' }, { kind: 'gold', amount: 30 }],
        result: 'Blood, gold, and power — the trial rewards the bold.' },
      { label: 'Decline', effects: [{ kind: 'nothing' }],
        result: 'You are not so desperate. Not yet.' },
    ],
  },
  {
    id: 'beggar',
    title: 'The Grateful Beggar',
    text: 'A ragged figure asks for coin. Their eyes are strangely knowing.',
    options: [
      { label: 'Give 25 gold', effects: [{ kind: 'gold', amount: -25 }, { kind: 'artifact' }],
        result: 'The beggar straightens, bows, and presses a gift into your hand.' },
      { label: 'Give nothing', effects: [{ kind: 'nothing' }],
        result: 'You keep walking. The eyes follow you out.' },
    ],
  },
  {
    id: 'armory',
    title: 'Ruined Armory',
    text: 'Racks of broken gear line the walls. One piece still gleams.',
    options: [
      { label: 'Salvage the gleaming piece', effects: [{ kind: 'item' }],
        result: 'You pry it loose — a genuine find.' },
      { label: 'Melt scrap for coin', effects: [{ kind: 'gold', amount: 35 }],
        result: 'The scrap fetches a decent price.' },
      { label: 'Rest among the ruins', effects: [{ kind: 'heal', frac: 0.35 }],
        result: 'A quiet moment mends you a little.' },
    ],
  },
  // ---- DEVIL DEALS — a hard risk axis. Each pact hands a strong, run-long boon
  // welded to a permanent CURSE (excluded from the normal artifact pool, so it only
  // ever arrives here). "Walk away" is always free — the deal is a real choice. ----
  {
    id: 'devil_bargain',
    title: "The Devil's Bargain",
    text: 'A horned silhouette offers power for a permanent price. Its grin does not waver.',
    options: [
      { label: 'Trade your skin for strength', effects: [{ kind: 'artifact' }, { kind: 'curse', id: 'curse_frailty' }],
        result: 'Power floods your veins — and your flesh turns paper-thin. (+artifact, take +50% damage forever)' },
      { label: 'Trade your speed for gold', effects: [{ kind: 'gold', amount: 120 }, { kind: 'curse', id: 'curse_sloth' }],
        result: 'Your purse grows heavy; your legs grow heavier still. (+120 gold, -30% move speed forever)' },
      { label: 'Refuse the pact', effects: [{ kind: 'nothing' }],
        result: 'You turn your back on the horned figure. It only laughs.' },
    ],
  },
  {
    id: 'devil_altar',
    title: 'The Bleeding Altar',
    text: 'Chains of old iron cradle a pulsing heart of stone. Take it — but it takes from you.',
    options: [
      { label: "Seize the stone heart", effects: [{ kind: 'maxHp', amount: 60 }, { kind: 'artifact' }, { kind: 'curse', id: 'curse_dullness' }],
        result: 'Vitality and power surge in — your trigger finger goes cold and slow. (+60 max HP, +artifact, -25% fire rate forever)' },
      { label: 'Bleed onto the altar', effects: [{ kind: 'hurt', frac: 0.25 }, { kind: 'artifact' }],
        result: 'You pay in blood, not chains — the altar accepts. (lose 25% HP, +artifact, no curse)' },
      { label: 'Leave the altar cold', effects: [{ kind: 'nothing' }],
        result: 'Some hearts are best left unbeaten. You walk on.' },
    ],
  },
  {
    id: 'devil_brittle_crown',
    title: 'The Brittle Crown',
    text: 'A crown of paper-thin gold amplifies every strike. The catch: it leeches density from your bones.',
    options: [
      { label: 'Wear the crown', effects: [{ kind: 'artifact' }, { kind: 'curse', id: 'curse_glass_bones' }],
        result: 'Power surges — and your frame grows dangerously light. (+artifact, -45 max HP forever)' },
      { label: 'Sell it for coin', effects: [{ kind: 'gold', amount: 60 }],
        result: 'Sixty gold and no regrets. Some crowns are better left unearned.' },
      { label: 'Leave it', effects: [{ kind: 'nothing' }],
        result: 'The crown remains. Another fool will find it.' },
    ],
  },
  {
    id: 'devil_starving_god',
    title: 'The Starving God',
    text: 'A gaunt deity offers its last reserves of power in exchange for your capacity to grow.',
    options: [
      { label: 'Accept the offering', effects: [{ kind: 'artifact' }, { kind: 'maxHp', amount: 50 }, { kind: 'curse', id: 'curse_famine' }],
        result: 'Vitality and power flood in — but hard-won lessons drain away faster now. (+artifact, +50 max HP, -40% XP forever)' },
      { label: 'Offer gold in prayer (40g)', effects: [{ kind: 'gold', amount: -40 }, { kind: 'heal', frac: 0.6 }],
        result: 'You feed the god in coin. It restores your wounds and asks nothing more.' },
      { label: 'Turn away', effects: [{ kind: 'nothing' }],
        result: 'The god watches you leave. Hungry.' },
    ],
  },

  // ---- ADDITIONAL REGULAR EVENTS — expand run variety on the ? node ----
  {
    id: 'pillar',
    title: 'The Memory Pillar',
    text: 'An ancient obelisk hums with inscribed runes. They pulse faintly as you approach.',
    options: [
      { label: 'Touch the runes', effects: [{ kind: 'item' }],
        result: 'Knowledge floods your hands — and something useful forms there.' },
      { label: 'Meditate before it', effects: [{ kind: 'heal', frac: 0.5 }],
        result: 'The quiet resonance knits your wounds.' },
      { label: 'Leave it standing', effects: [{ kind: 'nothing' }],
        result: 'The runes dim as you pass. Their secret stays buried.' },
    ],
  },
  {
    id: 'poison_well',
    title: 'The Poison Well',
    text: 'The water is black and smells of copper. Those who survive it grow stronger.',
    options: [
      { label: 'Drink deep', effects: [{ kind: 'hurt', frac: 0.25 }, { kind: 'artifact' }],
        result: 'It burns all the way down — and something inside you ignites.' },
      { label: 'Take a cautious sip', effects: [{ kind: 'hurt', frac: 0.1 }, { kind: 'heal', frac: 0.3 }],
        result: 'Minor pain, minor mending. Tested but intact.' },
      { label: 'Leave it alone', effects: [{ kind: 'nothing' }],
        result: 'Some strengths are not worth the cost.' },
    ],
  },
  {
    id: 'orc_champion',
    title: 'The Orc Champion',
    text: 'A scarred orc bars the path. "Fight me and take your prize. Or crawl past."',
    options: [
      { label: 'Accept the duel', effects: [{ kind: 'hurt', frac: 0.3 }, { kind: 'artifact' }, { kind: 'gold', amount: 40 }],
        result: 'You trade blows, bleed freely, and win. The orc nods with real respect.' },
      { label: 'Pay tribute (50g)', effects: [{ kind: 'gold', amount: -50 }, { kind: 'item' }],
        result: 'A tense exchange. Coin for passage and a trinket thrown in.' },
      { label: 'Back away', effects: [{ kind: 'nothing' }],
        result: 'You retreat slowly. The orc laughs but lets you pass.' },
    ],
  },
  {
    id: 'burial_mound',
    title: 'Ancient Burial Mound',
    text: 'Freshly disturbed earth. Something valuable was buried here — someone was buried with it.',
    options: [
      { label: 'Dig it up', effects: [{ kind: 'item' }, { kind: 'hurt', frac: 0.15 }],
        result: 'You find what you sought — but the dead never rest easy in these lands.' },
      { label: 'Leave an offering (20g)', effects: [{ kind: 'gold', amount: -20 }, { kind: 'heal', frac: 0.4 }],
        result: 'The mound accepts your gold. A warm peace settles over you.' },
      { label: 'Walk past', effects: [{ kind: 'nothing' }],
        result: 'You leave the dead undisturbed. Some peace is best kept.' },
    ],
  },
  {
    id: 'echoing_library',
    title: 'The Echoing Library',
    text: 'Shelves stretch out of sight. Books and scrolls crowd every surface, many still legible.',
    options: [
      { label: 'Study the stacks', effects: [{ kind: 'maxHp', amount: 30 }, { kind: 'item' }],
        result: 'Hours well spent — knowledge hardens the body and fills the hands.' },
      { label: 'Grab what you can carry', effects: [{ kind: 'item' }, { kind: 'gold', amount: 20 }],
        result: 'Useful gear and whatever coin fell loose from a tome.' },
      { label: 'Burn it — deny the enemy', effects: [{ kind: 'gold', amount: 80 }],
        result: 'The fire burns bright and brief. You sift the ash for coin.' },
    ],
  },
  {
    id: 'bone_witch',
    title: 'The Bone Witch',
    text: 'A hunched crone sits among trophies. "Trade me something — I will give something back."',
    options: [
      { label: 'Trade vitality for power', effects: [{ kind: 'maxHp', amount: -30 }, { kind: 'artifact' }],
        result: 'She takes what she needs — and hands you something older than your fear.' },
      { label: 'Trade gold for healing (40g)', effects: [{ kind: 'gold', amount: -40 }, { kind: 'heal', frac: 0.6 }],
        result: 'A fair trade. She mends your wounds with something sharp-smelling.' },
      { label: 'Offer nothing', effects: [{ kind: 'nothing' }],
        result: '"Come back with something worth trading." You leave empty-handed.' },
    ],
  },
  {
    id: 'trapped_chest',
    title: 'Suspicious Chest',
    text: 'A chest in the middle of the room — no door in, no enemies. Unnervingly neat.',
    options: [
      { label: 'Open it boldly', effects: [{ kind: 'item' }],
        result: 'It opens cleanly. Maybe it was just a chest.' },
      { label: 'Spike it first', effects: [{ kind: 'hurt', frac: 0.12 }, { kind: 'artifact' }],
        result: 'The spike triggers — but so does the real mechanism. Pain, and a real prize.' },
      { label: 'Leave it be', effects: [{ kind: 'nothing' }],
        result: 'You nudge it with your foot. It does not spring. You leave it.' },
    ],
  },
  {
    id: 'traveling_smith',
    title: 'The Traveling Smith',
    text: 'A smith has set up a makeshift forge in the ruins. Her hammer rings steady.',
    options: [
      { label: 'Commission two pieces (50g)', effects: [{ kind: 'gold', amount: -50 }, { kind: 'item' }, { kind: 'item' }],
        result: 'She works fast. Two pieces, paid for fairly.' },
      { label: 'Have her reinforce you (30g)', effects: [{ kind: 'gold', amount: -30 }, { kind: 'maxHp', amount: 25 }],
        result: 'She tempers something inside you. Your frame grows a little harder.' },
      { label: 'Watch but buy nothing', effects: [{ kind: 'nothing' }],
        result: 'The craft is admirable. You move on.' },
    ],
  },
  {
    id: 'haunted_mirror',
    title: 'The Haunted Mirror',
    text: 'Your reflection moves a beat behind — and it is holding something you are not.',
    options: [
      { label: 'Reach through the glass', effects: [{ kind: 'hurt', frac: 0.2 }, { kind: 'artifact' }],
        result: 'Cold fingers close on yours. You pull something back — and bleed.' },
      { label: 'Smash it', effects: [{ kind: 'gold', amount: 45 }],
        result: 'Seven years bad luck they say. The shards fetch decent coin either way.' },
      { label: 'Walk away', effects: [{ kind: 'nothing' }],
        result: 'You refuse to look again. The reflection is still there as you leave.' },
    ],
  },
  {
    id: 'flooded_vault',
    title: 'The Flooded Vault',
    text: 'Knee-deep black water. Something gleams beneath the surface in two separate spots.',
    options: [
      { label: 'Wade in and salvage both', effects: [{ kind: 'item' }, { kind: 'item' }],
        result: 'You surface cold, slow, and loaded. Worth it.' },
      { label: 'Dive for the brightest gleam', effects: [{ kind: 'artifact' }, { kind: 'hurt', frac: 0.15 }],
        result: 'The gleam was real. So was whatever bit you on the way back.' },
      { label: 'Drain what you can reach', effects: [{ kind: 'gold', amount: 55 }],
        result: 'Shallow pickings — but coin you can spend.' },
    ],
  },
  {
    id: 'twin_gamble',
    title: "The Twin's Challenge",
    text: 'Your shadow separates from you. "Survive the split and claim double the prize."',
    options: [
      { label: 'Accept the challenge', effects: [{ kind: 'hurt', frac: 0.3 }, { kind: 'artifact' }, { kind: 'artifact' }],
        result: 'Pain splits you apart. You reunite — battered, but carrying two prizes.' },
      { label: 'Bribe the twin (60g)', effects: [{ kind: 'gold', amount: -60 }, { kind: 'heal', frac: 0.35 }],
        result: 'Coin soothes the shadow. You recover and it rejoins you, satisfied.' },
      { label: 'Refuse', effects: [{ kind: 'nothing' }],
        result: 'Your shadow snaps back into place. The moment passes.' },
    ],
  },

  // ---- DEVIL DEALS (continued) — curse_myopia added, full curse roster covered ----
  {
    id: 'devil_hollow_eye',
    title: 'The Hollow Eye',
    text: 'A floating orb of obsidian promises perfect sight — at the cost of your precision.',
    options: [
      { label: 'Accept the vision', effects: [{ kind: 'artifact' }, { kind: 'gold', amount: 80 }, { kind: 'curse', id: 'curse_myopia' }],
        result: 'Your sight widens across the entire arena — but your aim goes blurry at its edges. (+artifact, +80g, -12% crit forever)' },
      { label: 'Refuse the eye', effects: [{ kind: 'nothing' }],
        result: 'The orb drifts away. You were the smarter one.' },
    ],
  },
  {
    id: 'devil_rot_crown',
    title: 'The Rot Crown',
    text: 'A crown woven from blighted vines promises a stronger body — and leaden legs.',
    options: [
      { label: 'Wear the crown', effects: [{ kind: 'maxHp', amount: 80 }, { kind: 'artifact' }, { kind: 'curse', id: 'curse_sloth' }],
        result: 'Life surges in — and your legs grow heavier with each step. (+80 max HP, +artifact, -30% move speed forever)' },
      { label: 'Tear it apart for coin', effects: [{ kind: 'gold', amount: 55 }, { kind: 'heal', frac: 0.25 }],
        result: 'The vines smoulder slowly. Their ash is surprisingly valuable, and the warmth mends you a little.' },
      { label: 'Leave it', effects: [{ kind: 'nothing' }],
        result: 'The crown waits for a braver fool.' },
    ],
  },

  // ---- STAT-GATED EVENTS — Slay-the-Spire-style requirement-locked choices. Each has a
  // "strong option" that only unlocks once the player has invested enough of a given stat,
  // so build identity opens doors a generalist can't. The gated option is always strictly
  // better than the fallback, and a free/neutral path is always available too. ----
  {
    id: 'boulder',
    title: 'The Fallen Boulder',
    text: 'A massive rock blocks a side-passage. Something glints in the gap behind it.',
    options: [
      { label: 'Lift the boulder aside', effects: [{ kind: 'artifact' }, { kind: 'gold', amount: 25 }],
        result: 'Muscle wins — the boulder rolls clear and the cache behind it is yours.',
        requirement: { stat: 'meleeDmgPct', min: 30, label: 'Melee +30%' } },
      { label: 'Squeeze an arm through (10g worth of scrapes)', effects: [{ kind: 'hurt', frac: 0.12 }, { kind: 'item' }],
        result: 'You skin your arm raw but wriggle one piece of gear loose.' },
      { label: 'Move on', effects: [{ kind: 'nothing' }],
        result: 'Not worth the effort. You leave the boulder where it lies.' },
    ],
  },
  {
    id: 'sniper_perch',
    title: 'The Distant Lantern',
    text: 'Across a ravine, a lantern hangs on a hook beside a strongbox. Too far to reach — but not too far to shoot.',
    options: [
      { label: 'Shoot the hook and drop the box', effects: [{ kind: 'artifact' }],
        result: 'One perfect shot. The strongbox tumbles down to your side of the ravine.',
        requirement: { stat: 'rangedDmgPct', min: 30, label: 'Ranged +30%' } },
      { label: 'Throw rocks until something gives (40g)', effects: [{ kind: 'gold', amount: -40 }, { kind: 'item' }],
        result: 'It takes a while and a sore arm, but the box finally falls.' },
      { label: 'Leave it hanging', effects: [{ kind: 'nothing' }],
        result: 'Some prizes hang just out of reach. You move on.' },
    ],
  },
  {
    id: 'tightrope',
    title: 'The Frayed Tightrope',
    text: 'A single rope spans a chasm to a treasure alcove. It will only bear someone quick and light on their feet.',
    options: [
      { label: 'Dash across before it snaps', effects: [{ kind: 'artifact' }, { kind: 'item' }],
        result: 'You cross in a blur — the rope parts behind you, but the alcove is already looted.',
        requirement: { stat: 'moveSpeedPct', min: 25, label: 'Move speed +25%' } },
      { label: 'Inch across carefully', effects: [{ kind: 'hurt', frac: 0.25 }, { kind: 'item' }],
        result: 'The rope snaps halfway. You fall, catch the ledge, and crawl up bloodied — with one prize.' },
      { label: 'Turn back', effects: [{ kind: 'nothing' }],
        result: 'You are no acrobat today. The alcove keeps its secrets.' },
    ],
  },
  {
    id: 'assassins_mark',
    title: 'The Sleeping Warden',
    text: 'A hulking guardian dozes atop a hoard. One precise strike to the weak point would end it before it wakes.',
    options: [
      { label: 'Strike the weak point', effects: [{ kind: 'artifact' }, { kind: 'gold', amount: 60 }],
        result: 'You find the seam in its armor. It never wakes — and the hoard is yours.',
        requirement: { stat: 'critPct', min: 25, label: 'Crit +25%' } },
      { label: 'Grab what you can and run', effects: [{ kind: 'gold', amount: 40 }, { kind: 'hurt', frac: 0.2 }],
        result: 'It stirs mid-grab. You snatch a handful of gold and flee, clipped on the way out.' },
      { label: 'Creep away quietly', effects: [{ kind: 'nothing' }],
        result: 'Better a live coward than a dead thief. You slip back into the dark.' },
    ],
  },
  {
    id: 'iron_gate',
    title: 'The Bent Portcullis',
    text: 'A rusted iron portcullis has jammed halfway. Behind it, a vault room. Holding it open takes a hardened frame.',
    options: [
      { label: 'Brace it on your shoulders', effects: [{ kind: 'item' }, { kind: 'item' }],
        result: 'Your armored frame takes the weight. You loot the vault and let the gate crash down behind you.',
        requirement: { stat: 'armor', min: 5, label: 'Armor 5+' } },
      { label: 'Prop it with a beam (risky)', effects: [{ kind: 'hurt', frac: 0.18 }, { kind: 'item' }],
        result: 'The beam holds just long enough. It splinters as you dive clear with one find.' },
      { label: 'Leave the vault sealed', effects: [{ kind: 'nothing' }],
        result: 'The gate wins this round. You move along the corridor.' },
    ],
  },
  {
    id: 'blood_toll',
    title: 'The Blood Toll',
    text: 'A crimson gate demands a heavy tribute of vitality — only the hale can afford to pay and walk on.',
    options: [
      { label: 'Pay the toll in blood', effects: [{ kind: 'hurt', frac: 0.3 }, { kind: 'artifact' }, { kind: 'artifact' }],
        result: 'You have life to spare. The gate drinks deep and opens onto a double hoard.',
        requirement: { stat: 'maxHp', min: 140, label: 'Max HP 140+' } },
      { label: 'Offer gold instead (70g)', effects: [{ kind: 'gold', amount: -70 }, { kind: 'artifact' }],
        result: 'The gate accepts coin, grudgingly, and grants a single prize.' },
      { label: 'Refuse to pay', effects: [{ kind: 'nothing' }],
        result: 'You keep your blood and your gold. The gate stays shut.' },
    ],
  },
  {
    id: 'high_roller',
    title: 'The High Roller',
    text: 'A velvet-clad dealer eyes your purse. "The big table is for serious coin only. Care to play?"',
    options: [
      { label: 'Buy into the high table (100g)', effects: [{ kind: 'gold', amount: -100 }, { kind: 'artifact' }, { kind: 'artifact' }],
        result: 'Real money buys real stakes. You cash out with two genuine treasures.',
        requirement: { stat: 'gold', min: 100, label: '100+ gold' } },
      { label: 'Play the penny table (20g)', effects: [{ kind: 'gold', amount: -20 }, { kind: 'item' }],
        result: 'Small stakes, small winnings — but winnings all the same.' },
      { label: 'Keep your purse shut', effects: [{ kind: 'nothing' }],
        result: 'The dealer shrugs. "Come back when you can afford to lose." You leave.' },
    ],
  },
];

export function randomEvent(): GameEvent {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}
