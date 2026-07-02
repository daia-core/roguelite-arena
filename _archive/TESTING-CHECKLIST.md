# Game-Feel Implementation Testing Checklist

## Quick Visual Verification Guide

Use this checklist to verify all 8 game-feel improvements are working correctly in-game.

---

## ✅ 1. Hit Pause / Freeze Frames

**Test:** Shoot an enemy
**Expected Behavior:**
- [ ] Brief time freeze (everything pauses for ~50ms on hit)
- [ ] Longer freeze on critical hits (~80ms)
- [ ] Everything slows (enemies, projectiles, particles) during freeze
- [ ] Feels weighty and impactful, not floaty

**Visual Cue:** Game appears to "stutter" slightly on every hit (this is intentional!)

---

## ✅ 2. Enemy Knockback Physics

**Test:** Hit an enemy with projectiles
**Expected Behavior:**
- [ ] Enemy pushed away from damage source
- [ ] Smooth deceleration (not instant stop)
- [ ] Knockback direction matches hit angle
- [ ] Golem enemies do NOT get knocked back

**Visual Cue:** Enemies slide backward smoothly, slowing down naturally

---

## ✅ 3. White Hit Flash

**Test:** Land a hit on any enemy
**Expected Behavior:**
- [ ] Enemy sprite flashes bright white for 1-2 frames
- [ ] Very brief flash (barely noticeable but adds punch)
- [ ] Works on all enemy types
- [ ] Flash is additive (brightens the sprite)

**Visual Cue:** Quick white "blink" on enemy when hit

---

## ✅ 4. Damage Number Physics

**Test:** Deal damage to enemies
**Expected Behavior:**
- [ ] Damage numbers arc upward then fall (like projectiles)
- [ ] Numbers spread horizontally (not all straight up)
- [ ] Gravity pulls numbers downward after peak
- [ ] Critical hits start larger and rotate slightly

**Visual Cue:** Numbers follow parabolic arc, not straight vertical line

---

## ✅ 5. Player Invincibility Frames

**Test:** Take damage from an enemy
**Expected Behavior:**
- [ ] Player blinks rapidly (10 times per second) after damage
- [ ] Yellow glow around player during i-frames
- [ ] Cannot take damage for ~500ms after hit
- [ ] Dash ability makes player blink during dash

**Visual Cue:** Player flickers with yellow glow after damage

---

## ✅ 6. Enhanced Screen Shake

**Test:** Hit and kill enemies
**Expected Behavior:**
- [ ] Small shake on every hit (more than before)
- [ ] Bigger shake on critical hits
- [ ] Even bigger shake on enemy kills
- [ ] Massive shake on boss/large enemy kills
- [ ] Blast ability causes shake based on hit count

**Visual Cue:** Camera vibrates noticeably on all combat events

---

## ✅ 7. Impact Particles on Every Hit

**Test:** Attack enemies
**Expected Behavior:**
- [ ] Small particle burst on EVERY hit (not just kills)
- [ ] 8 particles spread in circle from impact point
- [ ] Orange/yellow colored particles
- [ ] Particles have gravity and fall

**Visual Cue:** Orange burst on every projectile impact

---

## ✅ 8. Enemy Hitstun

**Test:** Watch enemy behavior when hit
**Expected Behavior:**
- [ ] Enemy freezes for ~100ms when damaged
- [ ] Enemy doesn't move during hitstun
- [ ] Ranged enemies don't shoot during hitstun
- [ ] Creates brief window for repositioning

**Visual Cue:** Enemy "pauses" momentarily when hit

---

## Cumulative "Juice" Test

**Test:** Play normally for 30 seconds
**Expected Overall Feel:**
- [ ] Every hit feels satisfying and impactful
- [ ] Combat feels "crunchy" and responsive
- [ ] Visual and physical feedback on all actions
- [ ] Game feels more polished than before
- [ ] Hits have weight and presence

**Success Criteria:** Combat should feel dramatically better than before implementation. Each hit should provide multiple layers of feedback (freeze + flash + shake + particles + knockback + hitstun).

---

## Performance Test

**Test:** Engage 10+ enemies at once
**Expected Behavior:**
- [ ] Game maintains 60 FPS
- [ ] No stuttering beyond intentional hit pause
- [ ] Smooth knockback physics
- [ ] No particle lag

**Check:** Open browser DevTools > Performance Monitor while playing

---

## Known Good Behaviors

These are INTENTIONAL design choices:

1. **Brief stuttering on hits** = Hit pause working correctly
2. **Player blinks after damage** = I-frames working correctly
3. **Enemies slide backward** = Knockback physics working correctly
4. **Screen shakes frequently** = Enhanced feedback working correctly

If you see these, the implementation is working as designed!

---

## Debugging

If something doesn't work:

1. **Open Browser Console** (F12)
   - Check for TypeScript errors
   - Look for red error messages

2. **Verify Build**
   ```bash
   cd frontend
   npm run build
   ```
   Should complete without errors

3. **Check File Modifications**
   - Game.ts: timeScale system
   - Enemy.ts: knockback, hitstun, flash
   - Player.ts: invincibility frames
   - Particle.ts: damage number physics

4. **Common Issues**
   - **No hit pause:** Check `timeScale` logic in Game.ts
   - **No knockback:** Verify `applyKnockback()` called in projectile collision
   - **No flash:** Check `hitFlashTimer` in Enemy.draw()
   - **No i-frames:** Verify `invincibilityTimer` check in Player.takeDamage()

---

## Success Metrics

**Before Implementation:**
- Functional but bland combat
- Minimal visual feedback
- Instant enemy reactions
- No physics-based movement

**After Implementation:**
- Satisfying, weighty combat
- Rich multi-layered feedback
- Smooth physics reactions
- Professional game feel

If the game feels dramatically more fun to play, the implementation succeeded!
