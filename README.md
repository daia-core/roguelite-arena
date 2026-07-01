---
type: work-project
status: active
created: 2026-07-01
last_updated: 2026-07-01
---

# Browser Roguelite Game

**Goal:** Build a complete mobile-friendly browser roguelite with full game loop, Laravel backend (auth + saves), deployed on Vercel (frontend) + Forge (backend). Iterate for 4 hours on gameplay, systems, and polish.

**Inspiration:** Balatro (build synergies + feedback), Brotato (tight pacing), Binding of Isaac (item depth)

## Status

**Research complete** — patterns identified from successful roguelites.

**Now building:**
- Frontend: Canvas-based game with touch controls
- Backend: Laravel API for auth + save states
- Deploy: Vercel (game) + Forge (API)

## Game Design (v1)

### Core Loop
**Wave-based survivor roguelite** (Brotato model):
- 20 waves per run, each 30-45 seconds
- Player auto-attacks, manually triggers abilities
- Shop between waves for upgrades
- Permadeath with meta-progression (unlock new characters/items)

### Mechanics
1. **Character classes** (3-5 starting, more unlockable)
   - Each has unique stat modifiers + ability
2. **Item system** — combinable modifiers that stack
   - Damage multipliers, fire rate, special effects
   - Synergies emerge from combinations
3. **Upgrade shop** — appear after each wave
   - 3 random items, reroll costs gold
4. **Save system** — persist unlocks + run states
5. **Juicy feedback** — particles, screen shake, score pop-ups

### Tech Stack
- **Frontend:** HTML5 Canvas + TypeScript, Vite build
- **Backend:** Laravel 12 API (auth, save states, unlocks)
- **Deploy:** Vercel (static game) + Forge (Laravel)
- **Touch:** Virtual joystick + ability buttons

## Plan

- [x] Research roguelite patterns
- [ ] Scaffold frontend (Vite + Canvas + TypeScript)
- [ ] Build core game loop (player, enemies, waves)
- [ ] Add item/upgrade system
- [ ] Build shop UI
- [ ] Add juicy feedback (particles, shake, audio)
- [ ] Scaffold Laravel backend (auth + saves)
- [ ] Deploy to Vercel + Forge
- [ ] Create demo user
- [ ] Iterate on balance + feel (remaining time)

## Log

- **2026-07-01 18:40** — Project started. Researched Balatro/Brotato/BoI patterns. Key findings: short runs (20-30min), synergy depth, feedback > graphics, touch-first UI.
