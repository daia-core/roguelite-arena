# Balance review — the 8 Jul-4 mechanics (post-ship, holistic)

**Date:** 2026-07-04 (evening) · **Trigger:** 8 features shipped fast in one day; regression QA (76/76, `qa-roguelite.mjs` + 6 harnesses) proved they don't crash or conflict, but **regression QA ≠ balance review** — it never asked whether the numbers are well-tuned or whether any combo is degenerate. This is that pass, grounded in the actual code (not opinion).

**One-line verdict:** All 8 are **mechanically safe** — the two interactions that *would* be genuine bugs (an exponential dagger storm and a curse-stack soft-lock) are both correctly guarded. No fix shipped. Two **tuning** observations are left for Felix to decide with playtest feel, since changing brand-new devil-deal numbers is a design call, not a correctness fix.

Scope: level-up pick-1-of-3, devil deals, Fourleaf Charm, Soul Tithe, Ceremonial Daggers, Pen Nib (+ the batch-2/3 item redesigns already covered in their own daily-note QA).

---

## ✅ Mechanically safe — verified in code

**1. Ceremonial Daggers — no exponential storm.**
`handleEnemyKill(enemy, fromDagger)` (`Game.ts:1906`) spawns daggers only when `!fromDagger` (`:1934`). A dagger's *own* kill can't spawn more daggers → the chain is bounded to **one generation per primary kill**. A dense pack yields `3 × packSize` daggers max, not a cascade. Each dagger = 50% of *current* shot damage (`DAGGER_DMG_MULT = 0.5`, `:1891`), so it scales with the build but never recurses. **Correctly designed.**

**2. Curses cannot stack — no soft-lock.**
`ArtifactSystem.add()` (`:211`) returns `false` if the id is already held; `withFlag()` (`:206`) reads only the *first* flagged artifact. So each curse applies **exactly once**:
- `curse_sloth` (−30% move) floors move-speed at 0.7×, never 0.
- `curse_dullness` (−25% fire rate) floors fire-rate at 0.75×, never 0.
- `curse_frailty` (+50% damage taken) applies once via the `glassCannon` flag.

Repeated devil pacts cannot drive any of these to a run-ending value. This was the one place a real bug could hide (a −25%-fire-rate curse applied 4× = can't shoot) and it's **explicitly prevented** — the `case 'curse'` comment at `Game.ts:3387` even documents the idempotent no-op.

**3. Soul Tithe — uncapped but slow, so fair.**
`+1% permanent damage every 50 kills` (`SOUL_TITHE_DMG_PER = 0.01`, `SOUL_TITHE_DMG_EVERY = 50`, `:189-190`), uncapped. "Uncapped" reads scary but the *rate* is the governor: +100% needs 5,000 kills. Runs are long/endless (boss tiers at wave 50+), so a deep ~1,500–3,000-kill run banks roughly **+30% to +60% damage** — a strong-but-earned legendary payoff for holding it most of a run, folded multiplicatively at `Game.ts:3080`. Health orb every 10th kill is minor sustain. **No cap needed.**

**4. Fourleaf Charm — self-capping.**
"Every on-hit status proc rolls twice, keep the better" is a probability transform: `p → 1-(1-p)²`. It asymptotes to 100%, so it's **bounded by construction** — a 30% proc becomes ~51% (~1.7×), a 60% proc becomes 84% (~1.4×). Strong keystone for a status/DoT build, but it can't exceed certainty and gives *diminishing* returns on already-high chances. **Well-behaved.**

**5. Pen Nib — deterministic, linear.**
Every 10th shot = 3× damage + full pierce (`loadedShot`). Fixed 10% uptime; scales with fire rate only linearly (more shots → same 1-in-10 ratio). No multiplicative blowup with multicast (each shot counts once toward the counter). **Fine at Epic/Rare tier.**

**On-kill synergy check (Soul Tithe + Ceremonial Daggers + Killing Spree):** daggers raise kill *rate* → Soul-Tithe milestones and Killing-Spree stacks accrue faster. But every term is linear/bounded (Killing Spree is capped at `KILL_STACK_MAX` and decays; Soul Tithe is 1%/50; daggers are single-generation). The result is the *intended* snowball, **not** an exponential runaway.

---

## ⚠️ Tuning observations — Felix's call, NOT changed

Left un-touched deliberately: these are feel/design judgments on brand-new content, better decided at the controller than by me unilaterally.

**A. "Devil's Bargain → Trade your skin for strength" may be a dead option.**
It grants **one random rollable artifact** for **+50% damage-taken forever** (`EventSystem.ts:150`). In a bullet-hell, permanent +50% squish is a huge, run-defining price; a single *random* artifact (often a common stat-stick) rarely justifies it — so the rational pick is almost always "Refuse," and the "hard decision" collapses. A pact nobody takes isn't a risk axis.
- Note the contrast that works: **Bleeding Altar** offers a clean *safe path* (option 2: −25% current HP for an artifact, **no curse** — heals back) alongside its cursed greedy path, so it's a genuine safe-vs-greedy choice. Devil's Bargain has **no** safe middle option, so its cursed picks must actually tempt.
- If you want it tempting: guarantee a **higher-rarity** artifact, or soften the curse to ~+30% damage taken. (The "Trade your speed for gold" option — 120 gold for −30% move — is better calibrated: 120g is genuinely build-enabling early, and the price bites where it hurts a dodging game.)

**B. Free boon after the curse is already held.**
Because curses dedup (finding #2), re-taking the **same** pact after you already carry its curse grants the boon (random artifact / 120 gold / 60 maxHP) with **no additional price** — the `case 'curse'` no-op at `Game.ts:3389` means only the boon half lands the second time. `?` events are drawn randomly (`randomEvent()`), so over a long run the same devil event can recur, letting you farm boons for free once you've paid the curse once (each artifact roll pulls a *new* unheld artifact until the pool drains). Mild and RNG-gated — arguably "you already paid" — but it does soften the "permanent price" fantasy.
- If devil deals should stay strictly priced: hide/disable a pact option whose curse is already held, or gate the boon on the curse actually applying.

---

## Bottom line

No correctness fix was warranted — the fast Jul-4 shipping did **not** introduce a bug, and the guards (dagger re-entrancy, curse dedup) show the risky interactions were anticipated. The only open questions are two **tuning** calls on the devil-deal economy (A, B) that want Felix's playtest feel. Content budget respected: this pull added **zero** content, only analysis + verification.
