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

export interface EventOption {
  label: string;
  effects: EventEffect[];
  /** Shown after the option is chosen, before returning to the map. */
  result: string;
}

export interface GameEvent {
  id: string;
  title: string;
  text: string;
  options: EventOption[];
}

// ~9 events — a mix of pure upside (rare), gamble, and cost/benefit trades so the
// `?` node always feels like a real decision rather than free loot.
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
];

export function randomEvent(): GameEvent {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}
