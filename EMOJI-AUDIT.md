# Roguelite — Emoji cleanup audit

**Date:** 2026-07-03 (evening) · **Author:** Daia (read-only investigation, no code changed)
**Trigger:** Felix — *"Create pixel art sprites for every single item… Emojis should not be used anywhere (clean up)."*

## Verdict

The substance of the request is **DONE**. Every colourful emoji in the game routes through the
pixel-sprite system and renders as a generated pixel-art sprite — **not** as a literal emoji glyph.
The `icon: '🗡️'` strings that remain in the data files are **sprite lookup keys**, by design, not
on-screen emoji.

What is genuinely *left* is a small, borderline set: a few **monochrome Unicode dingbat symbols**
still drawn as text (map-node markers, the souls `✦`, the combos `★`), plus some **dead emoji
metadata** that is never rendered. Whether the dingbats count as "emoji to remove" is a **scope
judgment call for Felix** — see Recommendation.

## How icons actually work (the key architectural fact)

`Renderer.drawItemIcon(emoji, …)` → `getItemIcon(emoji)` (in `src/items/itemIcons.ts`) maps the
emoji **string → a sprite name → a procedurally-generated pixel sprite**. So an item declaring
`icon: '🔥'` renders a pixel *flame sprite*, never the 🔥 glyph. `itemIcons.ts` holds the full
emoji→sprite map (~1230–1279). This is what commit `1e658f8` ("remove all UI emoji") established.

## Categorised findings (383 code occurrences + 133 comment-only)

### ✅ Render as pixel sprites — NOT violations (emoji = lookup key)
| Source | Count | Path |
|---|---|---|
| `items/catalog.ts` item `icon:` | ~200 | `drawItemIcon` → sprite |
| `DuoSystem.ts` duo `icon:` | 15 | `drawItemIcon` (Game.ts:4263/4289); mapped itemIcons 1277–1279 |
| `MetaProgression.ts` upgrade `icon:` (19) | 19 | drawn at `VillageScene.ts:844` via `drawItemIcon`; every emoji mapped |
| `Game.ts:3923` lock/unlock buttons `🔒/🔓` | 2 | `drawItemIcon` → lock/unlock sprites |
| `Game.ts:3942` recycle button `♻️` | 1 | `drawItemIcon` → recycle sprite |

All of the above are correct. No change needed.

### 🟡 Dead metadata — never rendered (cosmetic source hygiene only)
- `VillageScene.ts:88–95` — building `icon: '🔥'/'🛡️'/…` (8). Buildings render as pixel art by
  `kind`; the `icon` field is **never drawn**. Safe to delete the field; zero visual effect.
- `Game.ts:2433` — `console.log('🎉 DUO UNLOCKED …')`. Console only, never on-screen.

### 🔴 Genuinely rendered as TEXT glyphs — the only real "still not a sprite" cases
All are **monochrome dingbats** (not colour emoji), drawn via `drawText`:
1. **Map-node markers** — `MapSystem.ts:46` `ICONS`: `⚔` battle, `☠` elite, `?` event, `◆`
   treasure, `☼` rest, `♠` boss → drawn at `Game.ts:2777`.
2. **Souls currency `✦`** — `VillageScene.ts:722, 794, 823, 865`.
3. **Combos counter `★`** — `Game.ts:3707` (`COMBOS 3★`).

## Recommendation (needs Felix's scope call)

The literal reading of "no emojis **anywhere**" argues for converting the three 🔴 groups to small
pixel sprites too, for a 100% glyph-free pixel aesthetic. But they are deliberate monochrome UI
symbols that already read cleanly in a retro UI, and the map-node set has a dedicated
`qa-node-map.mjs`. This is a **taste call**, so it was left for Felix rather than blind-deployed to
the live game overnight mid-iteration:

- **If "yes, truly zero glyphs":** replace the 6 map-node markers with pixel node sprites
  (sword/skull/chest/campfire/`?`-sign/crown), and add small `✦`/`★` pixel glyphs — extend the
  `UISprites` programmatic-icon pattern (heart/star/coin/level/wave). Then rebuild → deploy →
  `qa-node-map.mjs` + headless QA → changelog. Est. one focused session.
- **If "the monochrome symbols are fine":** just delete the dead `icon` field from
  `VillageScene`'s building defs + the `🎉` console log for hygiene. No visual change.

Tracked as task **t-emoji-final** (game project).
