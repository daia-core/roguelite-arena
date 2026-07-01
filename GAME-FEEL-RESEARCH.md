---
type: research
date: 2026-07-01
tags: [research, game-feel, juice, physics]
---

# Game-Feel and Physics Improvements (2026)

**Verdict:** Great game-feel comes from **cumulative feedback layers** (not single effects). The best roguelites combine hit pause, knockback physics, visual flashes, particles, camera response, and sound into a unified "punch" that makes every hit satisfying.

## Core Game-Feel Principles

### 1. **Hit Pause / Freeze Frames**
**What:** Brief slow-motion on impact makes hits feel weighty and gives players time to appreciate their actions.

**Implementation:**
- **Duration:** 0.05-0.1 seconds (50-100ms) for roguelites
  - Platformers use 0.3s, but top-down shooters need faster pace
- **Time scale:** 0.05-0.1x speed (almost frozen)
- **Nuanced approach:** Pause only attacker + hit enemy, not entire game (keeps other enemies/projectiles moving)

**Source:** [GDQuest - Juicy Attacks](https://www.gdquest.com/library/juicy_attack/), [Roman Lukš Blog](https://romanluks.eu/blog/how-can-i-implement-game-feel-in-my-game/)

### 2. **Knockback Physics**
**What:** Enemies pushed away on hit with smooth deceleration creates weight and impact.

**Implementation:**
- **Direction:** Away from damage source (`-global_position.direction_to(source_position)`)
- **Initial force:** 300 units/sec for medium enemies, 150 for heavy, 500 for light
- **Decay:** `lerp(current_velocity, 0, delta * 10.0)` - smooth exponential falloff
- **Visual:** Enemies rotate slightly during knockback (easing function for natural feel)

**Why it works:** "Knockback that decays gradually feels weighty; instant stop feels mechanical." - GDQuest

**Source:** [GDQuest - Juicy Attacks](https://www.gdquest.com/library/juicy_attack/)

### 3. **Hit Flash (Visual Confirmation)**
**What:** Brief white flash on hit enemies signals successful damage.

**Implementation:**
- **Color:** Pure white (`#ffffff`) or additive blend
- **Duration:** 1-2 frames (16-32ms at 60fps)
- **Method:** Sprite color multiply or shader override

**Quote:** "This gives clear visual feedback to the player that their hit connected successfully." - GDQuest

**Source:** [GDQuest - Juicy Attacks](https://www.gdquest.com/library/juicy_attack/)

### 4. **Damage Numbers with Physics**
**What:** Floating numbers that arc upward with gravity feel dynamic vs. static text.

**Implementation:**
- **Initial velocity:** Upward 60-100 units/sec + random horizontal (-20 to +20)
- **Gravity:** Downward acceleration (150-200 units/sec²)
- **Result:** Numbers arc like projectiles, not float linearly

**Source:** [GDQuest - Juicy Attacks](https://www.gdquest.com/library/juicy_attack/)

### 5. **Screen Shake / Camera Trauma**
**What:** Camera vibration on key events emphasizes impact.

**Implementation:**
- **Small hit:** 0.1-0.2 intensity, 0.2s duration
- **Kill/explosion:** 0.4-0.6 intensity, 0.3s duration
- **Boss hit:** 0.8-1.0 intensity, 0.4s duration
- **Decay:** Exponential falloff feels natural

**Source:** [GameDev Academy - Game Feel](https://gamedevacademy.org/game-feel-tutorial/)

### 6. **Cumulative Effect Principle**
**Critical insight:** "Rather than using individual effects in isolation, overlaying screen shake, animation adjustments, and sound effects creates a cumulative impact." - GameDev Academy

**The "Juice Stack" for a single hit:**
1. Hit pause (0.05s freeze)
2. Enemy knockback (300 units/sec)
3. White flash (2 frames)
4. Impact particles (8-12 burst)
5. Screen shake (0.2 intensity)
6. Damage number (physics arc)
7. Sound effect (with pitch variation)

**Source:** [GameDev Academy - Game Feel](https://gamedevacademy.org/game-feel-tutorial/)

## Roguelite-Specific Insights

### **Hades vs Enter the Gungeon vs Nuclear Throne**
- **Hades:** Faster early clear (15 sec rooms), strong knockback on all attacks, heavy screen shake
- **Enter the Gungeon:** Slower early game but massive gun variety, knockback + stun on heavy weapons
- **Nuclear Throne:** Intense speed, mutations affect knockback/movement, frantic pacing

**Key takeaway:** Modern roguelites prioritize SPEED + FEEDBACK over realism. Fast clear times (15-30 sec rooms) with constant visual/audio reinforcement.

**Source:** [Going Rogue Podcast - Hades Transcript](https://github.com/ScottBurger/going_rogue_podcast/blob/master/docs/transcripts/hades.txt)

## Implementation Priority (High → Low)

### **Immediate Impact (< 1 hour):**
1. ✅ Hit pause on enemy damage (0.05s freeze)
2. ✅ Enemy knockback physics (smooth decay)
3. ✅ White flash on hit enemies
4. ✅ Enhanced screen shake on kills

### **High Impact (1-2 hours):**
5. ✅ Damage numbers with physics (arc upward)
6. ✅ Player invincibility frames with visual feedback
7. ✅ Impact particles on every hit (not just kills)
8. ✅ Enemy hitstun (brief pause when damaged)

### **Polish (2-4 hours):**
9. Weapon recoil animation (player sprite kickback)
10. Muzzle flash on projectile spawn
11. Enemy death dissolve effect (not instant disappear)
12. Dodge roll invincibility + trail effect

## Current Game vs. Best Practices

| Feature | Current | Target | Gap |
|---------|---------|--------|-----|
| **Hit feedback** | Particles only | Freeze + flash + knock + shake | 🔴 Missing 75% |
| **Knockback** | None | 300 u/s with decay | 🔴 Missing |
| **Screen shake** | On damage taken | On ALL hits + kills | 🟡 Partial |
| **Damage numbers** | Static float | Physics arc | 🟡 Needs physics |
| **Hit pause** | None | 0.05s freeze | 🔴 Missing |
| **Invincibility frames** | None | 0.5s with blink | 🔴 Missing |

## Sources
- [GDQuest - Juicing Up Your Game Attacks](https://www.gdquest.com/library/juicy_attack/)
- [GameDev Academy - How To Improve Game Feel](https://gamedevacademy.org/game-feel-tutorial/)
- [Roman Lukš - How Can I Implement Game Feel?](https://romanluks.eu/blog/how-can-i-implement-game-feel-in-my-game/)
- [HackRead - The Juice Factor: Designing Game Feel](https://hackread.com/the-juice-factor-designing-game-feel/) (May 2026)
- [Shane Sicienski - Hitstop in Beat 'Em Ups](https://shane-sicienski.com/blog/blog-post-title-one-55pmn)
- [Going Rogue Podcast - Hades Transcript](https://github.com/ScottBurger/going_rogue_podcast/blob/master/docs/transcripts/hades.txt)
- [Nuclear Throne Review](https://klipplays.neocities.org/nuclear_throne)
