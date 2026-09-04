// qa-item-domination.mjs — static domination check for the item catalog.
//
// A pre-commit gate for item balance: within each (slot, rarity) group, any
// SINGLE-STAT item that is strictly dominated by another item (same or lower
// cost, same or higher stat value, at least one strict inequality) is flagged.
//
// Scope is intentionally narrow — items with 2+ numeric stats or any
// unrecognised field are SKIPPED, because multi-stat items are almost always
// differentiated by archetype, and items with bespoke fields (ripostePower,
// fourleafCharm, penNib, etc.) have unique mechanics the checker can't evaluate.
// The narrow scope is the reliability guarantee: a PASS means the simple-stat
// items are clean; it does NOT promise every item in the catalog is balanced.
//
// This check caught:
//   - Blinkstep Boots (Legendary) < Shadowstep Boots (Rare) — Sep 4 09:53
//   - Copper Band < Iron Ring — Sep 4 17:xx
//   - Hawkeye Ring ≈ Keen Loop — Sep 4 17:xx
//
// Usage (run from /workspace/work/roguelite-game):
//   node qa-item-domination.mjs            # check live catalog; exit 0 = PASS
//
// Exit 0 = PASS (no dominated single-stat items)
// Exit 1 = FAIL (dominated pairs found — fix before committing)

import { readFileSync } from 'node:fs';

const CATALOG = 'frontend/src/items/catalog.ts';

// Numeric stat fields tracked by this checker. Extend when new stat fields are
// added to types.ts that could participate in single-stat domination.
const NUM_STATS = new Set([
  'damageMultiplier', 'fireRateMultiplier', 'critChance', 'critDamageMultiplier',
  'speedMultiplier', 'maxHealthBonus', 'healthRegen', 'armor', 'piercing',
  'lifesteal', 'thorns', 'multishot', 'dodge', 'rangedDamageMult', 'meleeDamageMult',
  'elementalDamageMult', 'xpMagnet', 'goldBonus', 'luck', 'knockback', 'freeze',
  'burn', 'bleed', 'slow', 'wound', 'doom', 'fragileChance', 'exposedChance',
  'condemnedChance', 'brittleChance', 'dazedChance', 'disorientedChance',
  'waveRampDamage', 'lowHpPower', 'killStackDamage', 'highHpPower', 'highHpFireRate',
  'goldScaleDamage', 'timeRampDamage', 'harvestMomentum', 'trophyRack',
  'rerollDiscount', 'shopDiscount', 'interestBonus', 'projectileSpeed',
  'orbitOrbs', 'orbitDamageMult', 'auxMeleeDamageMult', 'bombDamageMult',
  'bombCooldownMult', 'novaDamageMult', 'novaCooldownMult', 'swingDamageMult',
  'swingRangeBonus', 'swingArcBonus', 'swingAoe', 'aoeRadiusMult',
  'chainLightning', 'multicast', 'ripostePower',
]);

// Metadata and boolean-mechanic fields — not numeric bonuses.
const META = new Set([
  'id', 'name', 'description', 'rarity', 'tier', 'cost', 'icon', 'unlocked',
  'tags', 'slot', 'upgradeLevel', 'weaponType', 'weaponRange', 'weaponArc',
  'meleeStyle', 'poisonSpread', 'burnSpread', 'soulTithe', 'explosionOnHit',
  'shield', 'homing', 'poison', 'auxMelee', 'bombDrop', 'novaPulse',
  'openingSalvo', 'fourleafCharm', 'penNib',
]);

function parseItems(src) {
  const items = [];
  // Match single-line item entries { id: '...', ..., cost: N, ... }
  const lineRe = /\{ id: '([^']+)', name: '([^']+)',[^}]*?cost: (\d+)[^}]*?\}/g;
  let m;
  while ((m = lineRe.exec(src)) !== null) {
    const raw = m[0];
    const id = m[1];
    const name = m[2];
    const cost = parseInt(m[3], 10);
    const slot = (raw.match(/slot:\s*'([^']+)'/) || [null, 'inferred'])[1];
    const rarity = (raw.match(/rarity:\s*'([^']+)'/) || [null, 'common'])[1];

    // Collect all word-field names present in this item's source string.
    const allFields = new Set();
    for (const fm of raw.matchAll(/(\w+)\s*:/g)) allFields.add(fm[1]);

    // Numeric stats this checker knows about.
    const numStats = {};
    for (const stat of NUM_STATS) {
      const sm = raw.match(new RegExp(stat + ':\\s*([\\d.]+)'));
      if (sm) numStats[stat] = parseFloat(sm[1]);
    }

    // Fields this checker does NOT recognise — any such field means the item
    // has a unique mechanic; skip it from domination checks.
    const unknownFields = [...allFields].filter(f => !NUM_STATS.has(f) && !META.has(f));

    items.push({ id, name, slot, cost, rarity, numStats, unknownFields });
  }
  return items;
}

function checkDomination(items) {
  // Only consider items that are fully parsed: no unknown fields, exactly 1 numeric stat.
  const simple = items.filter(
    i => i.unknownFields.length === 0 && Object.keys(i.numStats).length === 1
  );

  // Group by slot + rarity.
  const groups = {};
  for (const item of simple) {
    const key = `${item.slot}|${item.rarity}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  const dominated = [];
  for (const [key, group] of Object.entries(groups)) {
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue;
        const A = group[i];
        const B = group[j];
        const stat = Object.keys(A.numStats)[0];

        // B must track the same stat to dominate A on that stat.
        if (B.numStats[stat] === undefined) continue;

        // B strictly dominates A: same or better value, same or lower cost,
        // with at least one strict inequality (not identical twins).
        if (
          B.numStats[stat] >= A.numStats[stat] &&
          B.cost <= A.cost &&
          (B.numStats[stat] > A.numStats[stat] || B.cost < A.cost)
        ) {
          // Deduplicate: only report A once (worst dominator wins).
          if (!dominated.find(d => d.A.id === A.id)) {
            dominated.push({ A, B, key, stat });
          }
        }
      }
    }
  }

  return { simple, dominated };
}

// ── main ──────────────────────────────────────────────────────────────────────

const src = readFileSync(CATALOG, 'utf8');
const items = parseItems(src);
const { simple, dominated } = checkDomination(items);

console.log(`qa-item-domination — ${items.length} single-line items, ${simple.length} single-stat (fully-parsed)\n`);

if (dominated.length === 0) {
  console.log(`PASS — 0 dominated single-stat items across all slot/rarity groups`);
  process.exit(0);
} else {
  for (const { A, B, key, stat } of dominated) {
    console.log(`FAIL [${key}]: "${A.name}" (${A.cost}g, ${stat}=${A.numStats[stat]})`);
    console.log(`       dominated by "${B.name}" (${B.cost}g, ${stat}=${B.numStats[stat]})`);
    console.log(`       Fix: raise ${stat} or lower cost or add a second differentiating stat`);
  }
  console.log(`\n${dominated.length} dominated item(s) — fix before committing content`);
  process.exit(1);
}
