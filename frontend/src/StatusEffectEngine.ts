/**
 * StatusEffectEngine — composable, data-driven status-effect system.
 *
 * Architecture:
 *   - STATUS_EFFECT_DEFS: one record per effect type (damage, stacks, synergy, visuals)
 *   - StatusEffectManager: per-enemy instance managing all active effects
 *   - Enemy adds `statusFX: StatusEffectManager` and delegates DoT/debuff logic here
 *   - applyOnHitEffects in Game.ts calls statusFX.apply(...) instead of directly setting timers
 *   - Legacy flat timer fields on Enemy kept as bridge getters for backward compat
 *
 * Adding a new effect: add an entry to STATUS_EFFECT_DEFS + optionally reference it in items.
 * No Game.ts surgery required per new effect.
 */

// ─── Effect ID catalog ────────────────────────────────────────────────────────

export type StatusEffectId =
  // Damage-over-time (DoT)
  | 'burn'
  | 'bleed'
  | 'poison'
  | 'doom'
  // Crowd control
  | 'freeze'
  | 'slow'
  | 'stun'
  // Universal amplifiers (the Soulstone "debuff amp" family)
  | 'fragility'      // +% all damage taken per stack
  | 'exposed'        // +% direct-hit damage taken per stack
  | 'brittle'        // +flat damage per hit per stack
  | 'shattered'      // −armor per stack
  | 'wound'          // +% chance to double stacks of next applied effect
  | 'condemned'      // accumulate charges; at threshold next crit deals massive bonus
  | 'dazed'          // +% crit chance received per stack
  | 'disoriented'    // +% crit damage received per stack
  | 'debilitated'    // −% damage dealt per stack (enemy offense reduction)
  | 'crippled';      // −% attack range per stack

// ─── Effect definition ────────────────────────────────────────────────────────

export type EffectCategory =
  | 'dot'          // damage-over-time: ticks per second
  | 'dot_special'  // special DoT (doom's detonation logic)
  | 'cc'           // crowd-control: movement/action
  | 'amp'          // debuff amplifier: increases damage taken
  | 'amp_flat'     // flat-damage-per-hit amplifier
  | 'debuff';      // enemy offense/ability reduction

interface SynergyDef {
  /** Which effect to also apply on this effect's application. */
  effectId: StatusEffectId;
  /** 0–1 chance. */
  chance: number;
  /** Stacks of the synergy effect to apply (default 1). */
  stacks?: number;
}

export interface StatusEffectDef {
  id: StatusEffectId;
  displayName: string;
  category: EffectCategory;
  /** How many stacks can accumulate (1 = no stacking, just refresh). */
  maxStacks: number;
  /** How long one application lasts in seconds (before expire/refresh). */
  baseDuration: number;
  /** For DoTs: damage per second (scaled by woundMult and amplifiers). */
  dpsBase?: number;
  /** For 'doom': fraction of deal-damage stored per hit (0.5 = 50% of hit stored). */
  doomStoreFraction?: number;
  /** For 'doom': fuse time in seconds. */
  doomFuseDuration?: number;
  /** For 'amp' category: multiplied damage taken added per stack (0.015 = +1.5%). */
  ampPerStack?: number;
  /** For 'amp_flat': flat damage added per stack per hit. */
  flatDamagePerStack?: number;
  /** For 'cc': movement speed multiplier per stack (0.15 = 15% slow per stack). */
  slowPerStack?: number;
  /** For 'condemned': charges needed before next crit detonates. */
  condemnedThreshold?: number;
  /** Bonus crit damage multiplier on condemned detonation (5 = +500%). */
  condemnedBonusCritMult?: number;
  /** For 'dazed': extra crit chance per stack (0.01 = 1%). */
  critChancePerStack?: number;
  /** For 'disoriented': extra crit damage multiplier per stack (0.01 = 1%). */
  critDamagePerStack?: number;
  /** For 'debilitated': enemy damage reduction fraction per stack (0.01 = 1% less). */
  damageReductionPerStack?: number;
  /** For 'shattered': armor reduction per stack (flat). */
  armorReductionPerStack?: number;
  /** On this effect being applied, roll a synergy chain. */
  onApplySynergy?: SynergyDef;
  /** On this effect being applied, roll a buff-chain proc on the PLAYER (future use). */
  onApplyPlayerBuff?: { buffId: string; chance: number };
  /** Poison-specific: spread to a nearby enemy on host death. */
  spreadsOnDeath?: boolean;
  /** Display color (CSS hex). Used in Enemy drawStatusEffects. */
  color: string;
  /** Secondary color for visual variety (e.g. doom skull). */
  color2?: string;
}

// ─── All effect definitions ───────────────────────────────────────────────────

export const STATUS_EFFECT_DEFS: Record<StatusEffectId, StatusEffectDef> = {

  // ── DoTs ────────────────────────────────────────────────────────────────────

  burn: {
    id: 'burn', displayName: 'Burn', category: 'dot',
    maxStacks: 1, baseDuration: 2.0, dpsBase: 16,
    color: '#ff6b35', color2: '#ff9240',
    onApplySynergy: { effectId: 'slow', chance: 0.20, stacks: 2 },
  },

  bleed: {
    id: 'bleed', displayName: 'Bleed', category: 'dot',
    maxStacks: 3,  // stacks increase severity
    baseDuration: 4.0, dpsBase: 6,  // base; Game multiplies by woundMult
    color: '#e03030', color2: '#ff7070',
    // Bleed → Poison synergy chain
    onApplySynergy: { effectId: 'poison', chance: 0.25 },
  },

  poison: {
    id: 'poison', displayName: 'Poison', category: 'dot',
    maxStacks: 1, baseDuration: 3.0, dpsBase: 7,
    spreadsOnDeath: true,
    color: '#4fd44f', color2: '#9be62b',
    // Poison → Doom chain
    onApplySynergy: { effectId: 'doom', chance: 0.20 },
  },

  doom: {
    id: 'doom', displayName: 'Doom', category: 'dot_special',
    maxStacks: 1, baseDuration: 2.5,
    doomStoreFraction: 1.5, doomFuseDuration: 2.5,
    color: '#9b59b6', color2: '#6c3483',
    // Doom → Burn chain (detonation triggers fire spread)
    onApplySynergy: { effectId: 'burn', chance: 0.15 },
  },

  // ── Crowd control ────────────────────────────────────────────────────────────

  freeze: {
    id: 'freeze', displayName: 'Frozen', category: 'cc',
    maxStacks: 1, baseDuration: 1.0,
    slowPerStack: 1.0,  // full stop
    color: '#74d7ec', color2: '#c6f4ff',
  },

  slow: {
    id: 'slow', displayName: 'Slowed', category: 'cc',
    maxStacks: 5, baseDuration: 2.5,
    slowPerStack: 0.12,  // 12% per stack, capped at 65% total
    color: '#8be9e9', color2: '#c3f4f4',
  },

  stun: {
    id: 'stun', displayName: 'Stunned', category: 'cc',
    maxStacks: 1, baseDuration: 0.8,
    slowPerStack: 1.0,
    color: '#ffd43b', color2: '#ffec8b',
  },

  // ── Amplifier debuffs ─────────────────────────────────────────────────────────

  fragility: {
    id: 'fragility', displayName: 'Fragility', category: 'amp',
    maxStacks: 20, baseDuration: 6.0,
    ampPerStack: 0.015,  // +1.5% all damage taken per stack → max +30%
    color: '#e8d0ff', color2: '#c080ff',
  },

  exposed: {
    id: 'exposed', displayName: 'Exposed', category: 'amp',
    maxStacks: 10, baseDuration: 5.0,
    ampPerStack: 0.04,   // +4% direct-hit damage per stack → max +40%
    color: '#ffba6b', color2: '#ff8c1a',
  },

  brittle: {
    id: 'brittle', displayName: 'Brittle', category: 'amp_flat',
    maxStacks: 15, baseDuration: 5.0,
    flatDamagePerStack: 1.0,  // +1 flat damage per hit per stack → up to +15
    color: '#d0c8b0', color2: '#a89880',
  },

  shattered: {
    id: 'shattered', displayName: 'Shattered', category: 'amp',
    maxStacks: 10, baseDuration: 6.0,
    armorReductionPerStack: 1,  // -1 armor per stack
    color: '#b0d8f8', color2: '#5090c0',
  },

  wound: {
    id: 'wound', displayName: 'Wound', category: 'amp',
    maxStacks: 4, baseDuration: 6.0,
    ampPerStack: 0.0,  // unique: on NEXT status application, double its stacks
    color: '#cc2020', color2: '#ff6060',
  },

  condemned: {
    id: 'condemned', displayName: 'Condemned', category: 'amp',
    maxStacks: 10, baseDuration: 8.0,
    condemnedThreshold: 10,
    condemnedBonusCritMult: 5.0,  // +500% crit damage when detonated
    ampPerStack: 0.0,
    color: '#8040c0', color2: '#c880ff',
  },

  dazed: {
    id: 'dazed', displayName: 'Dazed', category: 'amp',
    maxStacks: 10, baseDuration: 5.0,
    critChancePerStack: 0.01,   // +1% crit chance received per stack
    ampPerStack: 0.0,
    color: '#f8e070', color2: '#ffe030',
  },

  disoriented: {
    id: 'disoriented', displayName: 'Disoriented', category: 'amp',
    maxStacks: 10, baseDuration: 5.0,
    critDamagePerStack: 0.01,  // +1% crit damage received per stack
    ampPerStack: 0.0,
    color: '#f8c090', color2: '#f09050',
  },

  debilitated: {
    id: 'debilitated', displayName: 'Debilitated', category: 'debuff',
    maxStacks: 10, baseDuration: 6.0,
    damageReductionPerStack: 0.01,  // -1% enemy damage per stack
    color: '#90e090', color2: '#40b040',
  },

  crippled: {
    id: 'crippled', displayName: 'Crippled', category: 'debuff',
    maxStacks: 5, baseDuration: 5.0,
    slowPerStack: 0.0,  // range reduction — handled by enemy attack logic
    color: '#c0c890', color2: '#909850',
  },
};

// ─── Active effect instance ───────────────────────────────────────────────────

export interface ActiveStatusEffect {
  defId: StatusEffectId;
  stacks: number;
  /** Remaining duration in seconds. Refreshed on re-application. */
  duration: number;
  /** Power scalar from the applier (e.g. doom stores hit * power). */
  power: number;
  /** For doom: stored detonation damage. */
  doomStored: number;
  /** For tick-rate DoTs: sub-second accumulator. */
  tickAccum: number;
  /** Whether this was applied from a Ceremonial Dagger (re-entrancy guard). */
  fromDagger: boolean;
}

// ─── StatusEffectManager ─────────────────────────────────────────────────────

export class StatusEffectManager {
  private effects = new Map<StatusEffectId, ActiveStatusEffect>();

  /** Cumulative wound multiplier for DoT damage (legacy compat). */
  woundMult = 1;

  // ── Apply ────────────────────────────────────────────────────────────────────

  /**
   * Apply or refresh/stack an effect on this enemy.
   * Returns the list of synergy effects to also apply (caller handles them to avoid recursion).
   */
  apply(
    id: StatusEffectId,
    opts: {
      stacks?: number;
      duration?: number;
      power?: number;
      fromDagger?: boolean;
      doomDamage?: number;  // for doom: direct damage to add to stored
    }
  ): SynergyDef[] {
    const def = STATUS_EFFECT_DEFS[id];
    const stacks = opts.stacks ?? 1;
    const duration = opts.duration ?? def.baseDuration;
    const power = opts.power ?? 1;

    const existing = this.effects.get(id);

    if (existing) {
      // Refresh duration; stack up to max
      existing.duration = Math.max(existing.duration, duration);
      existing.stacks = Math.min(def.maxStacks, existing.stacks + stacks);
      if (opts.fromDagger !== undefined) existing.fromDagger = opts.fromDagger;
      if (id === 'doom' && opts.doomDamage) {
        existing.doomStored += opts.doomDamage;
        existing.duration = def.doomFuseDuration ?? def.baseDuration; // refresh fuse
      }
      if (id === 'wound') {
        this.woundMult = Math.min(3, this.woundMult + 0.5);
      }
    } else {
      this.effects.set(id, {
        defId: id, stacks, duration, power,
        doomStored: id === 'doom' ? (opts.doomDamage ?? 0) : 0,
        tickAccum: 0,
        fromDagger: opts.fromDagger ?? false,
      });
      if (id === 'wound') {
        this.woundMult = Math.min(3, this.woundMult + 0.5);
      }
    }

    // Return synergy candidates (caller decides whether to apply them)
    return def.onApplySynergy ? [def.onApplySynergy] : [];
  }

  /**
   * Apply a synergy chain: roll each candidate and apply if it wins.
   * Limited to one level of chaining to avoid infinite loops.
   */
  applySynergyChain(synergies: SynergyDef[], power: number, fromDagger: boolean): void {
    for (const s of synergies) {
      if (Math.random() < s.chance) {
        // One level deep only — don't recurse synergy chains
        this.apply(s.effectId, { stacks: s.stacks ?? 1, power, fromDagger });
      }
    }
  }

  // ── Tick ─────────────────────────────────────────────────────────────────────

  /**
   * Advance all effects by dt seconds.
   *
   * Returns:
   *   - `dotDamage`: total DoT damage to deal this frame (before woundMult — already multiplied)
   *   - `doomDetonation`: doom detonation payload (null if no detonation this frame)
   *   - `poisonSpreads`: true if poison spread should trigger on death
   *   - `daggerDot`: true if the active DoT was from a dagger
   */
  tick(
    dt: number,
    enemyMovedDist: number
  ): {
    dotDamage: number;
    doomDetonation: { payload: number; aoeFraction: number } | null;
    poisonSpreads: boolean;
    daggerDot: boolean;
  } {
    let dotDamage = 0;
    let doomDetonation: { payload: number; aoeFraction: number } | null = null;
    let poisonSpreads = false;
    let daggerDot = false;
    const toExpire: StatusEffectId[] = [];

    for (const [id, eff] of this.effects) {
      const def = STATUS_EFFECT_DEFS[id];
      eff.duration -= dt;
      if (eff.duration <= 0) {
        if (id === 'doom' && eff.doomStored > 0) {
          // Fuse expired → detonate
          const payload = eff.doomStored * this.woundMult;
          doomDetonation = { payload, aoeFraction: 0.25 };
          eff.doomStored = 0;
        }
        toExpire.push(id);
        continue;
      }

      if (def.category === 'dot') {
        const dps = (def.dpsBase ?? 0) * eff.stacks;
        if (id === 'bleed') {
          // Bleed: base DPS + bonus per pixel moved (punishes rushers)
          const movementBonus = Math.min(18, enemyMovedDist * 1.5);
          dotDamage += (dps + movementBonus) * dt;
        } else {
          dotDamage += dps * dt;
        }
        if (eff.fromDagger) daggerDot = true;
      }

      if (def.category === 'dot' && def.spreadsOnDeath) {
        poisonSpreads = true;
      }

      if (id === 'doom' && def.category === 'dot_special') {
        // Doom stores from hits — nothing to tick; detonation handled above on expire
        if (eff.fromDagger) daggerDot = true;
      }
    }

    // Apply woundMult to DoT damage
    dotDamage *= this.woundMult;

    // Expire spent effects
    for (const id of toExpire) {
      this.effects.delete(id);
    }
    // Wound mult decays as wound stacks expire
    const woundEff = this.effects.get('wound');
    if (!woundEff) {
      this.woundMult = Math.max(1, this.woundMult - 0.3 * dt);
    }

    return { dotDamage, doomDetonation, poisonSpreads, daggerDot };
  }

  // ── Damage calculation helpers ────────────────────────────────────────────────

  /**
   * Combined damage multiplier from all amp-category debuffs.
   * Applies to ALL incoming damage.
   */
  getIncomingDamageMult(): number {
    let mult = 1;
    const fragility = this.effects.get('fragility');
    if (fragility) mult += fragility.stacks * (STATUS_EFFECT_DEFS.fragility.ampPerStack ?? 0);
    const shattered = this.effects.get('shattered');
    if (shattered) {
      // Shattered reduces effective armor → handled separately in takeDamage
    }
    return mult;
  }

  /**
   * Extra multiplier on DIRECT (non-DoT) hits only.
   */
  getDirectHitMult(): number {
    let mult = 1;
    const exposed = this.effects.get('exposed');
    if (exposed) mult += exposed.stacks * (STATUS_EFFECT_DEFS.exposed.ampPerStack ?? 0);
    return mult;
  }

  /**
   * Flat bonus damage added to every direct hit.
   */
  getFlatHitBonus(): number {
    let flat = 0;
    const brittle = this.effects.get('brittle');
    if (brittle) flat += brittle.stacks * (STATUS_EFFECT_DEFS.brittle.flatDamagePerStack ?? 0);
    return flat;
  }

  /**
   * Armor reduction from Shattered stacks.
   */
  getArmorReduction(): number {
    const shattered = this.effects.get('shattered');
    if (!shattered) return 0;
    return shattered.stacks * (STATUS_EFFECT_DEFS.shattered.armorReductionPerStack ?? 0);
  }

  /**
   * Bonus crit chance added to incoming attacks (Dazed).
   */
  getBonusCritChanceReceived(): number {
    const dazed = this.effects.get('dazed');
    if (!dazed) return 0;
    return dazed.stacks * (STATUS_EFFECT_DEFS.dazed.critChancePerStack ?? 0);
  }

  /**
   * Bonus crit damage multiplier on incoming crits (Disoriented).
   */
  getBonusCritDamageReceived(): number {
    const disoriented = this.effects.get('disoriented');
    if (!disoriented) return 0;
    return disoriented.stacks * (STATUS_EFFECT_DEFS.disoriented.critDamagePerStack ?? 0);
  }

  /**
   * Enemy's own damage is reduced by Debilitated.
   */
  getEnemyDamageMult(): number {
    const deb = this.effects.get('debilitated');
    if (!deb) return 1;
    return Math.max(0.3, 1 - deb.stacks * (STATUS_EFFECT_DEFS.debilitated.damageReductionPerStack ?? 0));
  }

  /**
   * Speed multiplier from CC effects (Freeze/Slow/Stun).
   * Returns 0 = fully frozen; 0.35 = heavily slowed; 1 = normal.
   */
  getSpeedMult(): number {
    if (this.effects.has('freeze') || this.effects.has('stun')) return 0;
    const slow = this.effects.get('slow');
    if (!slow) return 1;
    const reduction = Math.min(0.65, slow.stacks * (STATUS_EFFECT_DEFS.slow.slowPerStack ?? 0));
    return 1 - reduction;
  }

  /**
   * Check condemned: if stacks >= threshold and next hit is a crit, detonate.
   * Returns bonus crit multiplier to ADD (0 if no detonation).
   * Removes stacks on detonation.
   */
  checkCondemned(isCrit: boolean): number {
    const cond = this.effects.get('condemned');
    if (!cond || !isCrit) return 0;
    const def = STATUS_EFFECT_DEFS.condemned;
    if (cond.stacks >= (def.condemnedThreshold ?? 10)) {
      cond.stacks = 0;
      this.effects.delete('condemned');
      return def.condemnedBonusCritMult ?? 5.0;
    }
    return 0;
  }

  // ── Legacy bridge accessors (used by Enemy.ts for backward compat) ─────────────

  get burnTimer(): number {
    return this.effects.get('burn')?.duration ?? 0;
  }
  get bleedTimer(): number {
    return this.effects.get('bleed')?.duration ?? 0;
  }
  get poisonTimer(): number {
    return this.effects.get('poison')?.duration ?? 0;
  }
  get doomTimer(): number {
    return this.effects.get('doom')?.duration ?? 0;
  }
  get doomStored(): number {
    return this.effects.get('doom')?.doomStored ?? 0;
  }
  get frozenTimer(): number {
    return this.effects.get('freeze')?.duration ?? 0;
  }
  get slowTimer(): number {
    return this.effects.get('slow')?.duration ?? 0;
  }
  get slowFactor(): number {
    return this.getSpeedMult();
  }

  /** @deprecated use apply('burn') */
  set burnTimer(v: number) {
    if (v > 0) this.apply('burn', { duration: v });
    else this.effects.delete('burn');
  }
  /** @deprecated use apply('bleed') */
  set bleedTimer(v: number) {
    if (v > 0) this.apply('bleed', { duration: v });
    else this.effects.delete('bleed');
  }
  /** @deprecated use apply('poison') */
  set poisonTimer(v: number) {
    if (v > 0) this.apply('poison', { duration: v });
    else this.effects.delete('poison');
  }
  /** @deprecated use apply('freeze') */
  set frozenTimer(v: number) {
    if (v > 0) this.apply('freeze', { duration: v });
    else this.effects.delete('freeze');
  }

  // ── Inspection ───────────────────────────────────────────────────────────────

  has(id: StatusEffectId): boolean {
    return this.effects.has(id);
  }

  get(id: StatusEffectId): ActiveStatusEffect | undefined {
    return this.effects.get(id);
  }

  getAll(): ReadonlyMap<StatusEffectId, ActiveStatusEffect> {
    return this.effects;
  }

  /** True if ANY damaging DoT is active. */
  hasDot(): boolean {
    return this.effects.has('burn') || this.effects.has('bleed') ||
           this.effects.has('poison') || this.effects.has('doom');
  }

  /** True if frozen or stunned (can't move). */
  isImmobile(): boolean {
    return this.effects.has('freeze') || this.effects.has('stun');
  }

  reset(): void {
    this.effects.clear();
    this.woundMult = 1;
  }
}

// ─── Item effect helper ───────────────────────────────────────────────────────

/**
 * Convenience: given a set of item-driven proc chances, roll and return which
 * status effects to apply. Used by Game.applyOnHitEffects.
 *
 * opts.roll: a function(chance) → boolean (the existing playerStats.rollProc)
 */
export interface OnHitProcOpts {
  roll: (chance: number) => boolean;
  burnChance: number;
  bleedChance: number;
  freezeChance: number;
  doomChance: number;
  woundChance: number;
  fragileChance: number;
  exposedChance: number;
  condemnedChance: number;
  hasPoison: boolean;
  poisonSpreads: boolean;
  elementalMult: number;
  damage: number;
  fromDagger: boolean;
}

export interface OnHitProcResult {
  effects: Array<{ id: StatusEffectId; opts: Parameters<StatusEffectManager['apply']>[1] }>;
}

export function rollOnHitProcs(opts: OnHitProcOpts): OnHitProcResult {
  const effects: OnHitProcResult['effects'] = [];

  if (opts.hasPoison) {
    effects.push({ id: 'poison', opts: { fromDagger: opts.fromDagger } });
  }
  if (opts.roll(opts.burnChance)) {
    effects.push({ id: 'burn', opts: { fromDagger: opts.fromDagger } });
  }
  if (opts.roll(opts.bleedChance)) {
    effects.push({ id: 'bleed', opts: { fromDagger: opts.fromDagger } });
  }
  if (opts.roll(opts.freezeChance)) {
    effects.push({ id: 'freeze', opts: {} });
  }
  if (opts.roll(opts.doomChance)) {
    effects.push({ id: 'doom', opts: {
      doomDamage: opts.damage * 1.5 * opts.elementalMult,
      fromDagger: opts.fromDagger,
    }});
  }
  if (opts.roll(opts.woundChance)) {
    effects.push({ id: 'wound', opts: {} });
  }
  if (opts.roll(opts.fragileChance)) {
    effects.push({ id: 'fragility', opts: { stacks: 2 } });
  }
  if (opts.roll(opts.exposedChance)) {
    effects.push({ id: 'exposed', opts: { stacks: 2 } });
  }
  if (opts.roll(opts.condemnedChance)) {
    effects.push({ id: 'condemned', opts: { stacks: 1 } });
  }

  return { effects };
}
