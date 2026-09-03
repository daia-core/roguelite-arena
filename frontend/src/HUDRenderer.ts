// HUDRenderer — extracted from Game.ts (step 13 of de-god-classing)
// Owns: drawHUD(), updateMobileSkillButtons()
// Pure render/DOM — no mutation of core game state.

import { Player } from './Player';
import { Enemy } from './Enemy';
import { WaveManager } from './WaveManager';
import { PlayerStats } from './ItemSystem';
import { Renderer } from './Renderer';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';
import { UISprites } from './UISprites';
import { getActiveSkillById } from './ActiveSkillSystem';
import { formatShort } from './utils';

export interface HUDRendererDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  getPlayer(): Player | null;
  getPlayerStats(): PlayerStats;
  getWaveManager(): WaveManager;
  getEnemies(): Enemy[];
  getActiveSkillCooldownQ(): number;
  getActiveSkillCooldownE(): number;
  getGearButtonRect(): { x: number; y: number; width: number; height: number };
  getSafeAreaTop(zoom: number): number;
  getSkillTreePoints(): number;
  /** Number of unique enemy types killed this run — for Trophy Rack HUD counter. */
  getKilledEnemyTypesCount(): number;
  /** Active Harvest Momentum stack count (0 when no stacks / item not held). */
  getHarvestMomentumStacks(): number;
  /** Seconds remaining on the current Harvest Momentum kill window (0 when inactive). */
  getHarvestMomentumTimer(): number;
  /** Waves survived this run — for Grindstone wave-ramp counter. */
  getWavesSurvived(): number;
  /** Current kill-stack count (0–20 float; decays after the 2s grace window). */
  getKillStackCount(): number;
  /** Seconds elapsed since the last kill (drives drain-urgency feedback). */
  getKillStackTimer(): number;
  /** Growing Malice stack count — floor(runPlaySeconds / 15). */
  getGrowingMaliceStacks(): number;
}

export class HUDRenderer {
  private deps: HUDRendererDeps;

  constructor(deps: HUDRendererDeps) {
    this.deps = deps;
  }

  drawHUD(): void {
    const player = this.deps.getPlayer();
    if (!player) return;

    const ctx = this.deps.renderer.getContext();
    const canvas = this.deps.canvas;
    // The canvas renders larger than the viewport and is CSS-scaled down;
    // size HUD elements in display pixels and convert via the zoom factor so
    // readability is identical on any screen.
    const zoom = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const art = Math.max(2, s(3));
    const isPortrait = canvas.width < canvas.height;
    // Top origin for HUD panels: base margin plus the device safe-area inset so the
    // notch / status bar never clips the HP/wave panels in portrait.
    const topY = s(6) + this.deps.getSafeAreaTop(zoom);

    const pad = s(8);
    const iconS = s(20);
    const barW = s(isPortrait ? 104 : 170);
    const barH = s(12);
    const rowGap = s(7);
    const textS = s(9);

    const drawBar = (
      x: number, y: number, w: number, h: number,
      frac: number, fill: string, bg: string
    ) => {
      ctx.fillStyle = '#241407';
      ctx.fillRect(x - s(2), y - s(2), w + s(4), h + s(4));
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
    };

    // --- Left panel: HP / XP / gold ---
    const rowH = Math.max(iconS, barH) + rowGap;
    const panelW = pad * 2 + iconS + s(6) + barW + s(isPortrait ? 64 : 78);
    const panelH = pad * 2 + rowH * 3 - rowGap;
    drawPanel(ctx, s(6), topY, panelW, panelH, DARK_WOOD_THEME, art);

    const x0 = s(6) + pad + s(2);
    let y = topY + pad + s(2);
    const barX = x0 + iconS + s(6);
    const textX = barX + barW + s(8);

    const hpFrac = player.health / player.maxHealth;
    const heart = UISprites.getIcon('heart');
    if (heart) ctx.drawImage(heart, x0, y, iconS, iconS);
    const hpBarY = y + Math.round((iconS - barH) / 2);
    drawBar(barX, hpBarY, barW, barH, hpFrac,
      hpFrac > 0.6 ? '#4ade80' : hpFrac > 0.3 ? '#fbbf24' : '#ef4444', '#3c0000');
    // High-HP threshold tick mark — appears when the player has any 90%-HP bonus
    // (Juggernaut / Overflow Battery / Pristine Engine). Gold when bonus is active;
    // pulses when HP is dropping toward the threshold. Mirrors boss-phase marker pattern.
    const ps = this.deps.getPlayerStats();
    if (ps.getHighHpFireRate() > 0 || ps.getHighHpPower() > 0) {
      const tx = barX + Math.round(barW * 0.90);
      const atThreshold = hpFrac >= 0.90;
      const approaching = hpFrac >= 0.80 && !atThreshold;
      const tickAlpha = approaching ? 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 280)) : 1.0;
      ctx.save();
      ctx.globalAlpha = tickAlpha;
      ctx.fillStyle = atThreshold ? '#fbbf24' : '#ffffff'; // gold = bonus active, white = lost
      ctx.fillRect(tx - 1, hpBarY - s(2), 2, barH + s(4));
      ctx.restore();
    }
    // Low-HP threshold tick mark — appears when the player has any lowHpPower bonus
    // (Last Stand / Berserker family). Red when bonus is active (HP ≤ 35%); white
    // when bonus is not yet active; pulses when HP is approaching the threshold.
    if (ps.getLowHpPower() > 0) {
      const LOW_HP_THRESHOLD = 0.35;
      const tx = barX + Math.round(barW * LOW_HP_THRESHOLD);
      const atThreshold = hpFrac <= LOW_HP_THRESHOLD;
      const approaching = hpFrac > LOW_HP_THRESHOLD && hpFrac < LOW_HP_THRESHOLD + 0.10;
      const tickAlpha = approaching ? 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 280)) : 1.0;
      ctx.save();
      ctx.globalAlpha = tickAlpha;
      ctx.fillStyle = atThreshold ? '#ef4444' : '#ffffff'; // red = bonus active, white = not yet
      ctx.fillRect(tx - 1, hpBarY - s(2), 2, barH + s(4));
      ctx.restore();
    }
    this.deps.renderer.drawText(
      `${formatShort(Math.ceil(player.health))}/${formatShort(player.maxHealth)}`,
      textX, y + Math.round(iconS / 2), { size: textS, baseline: 'middle', color: '#ffffff' }
    );

    y += rowH;
    const star = UISprites.getIcon('star');
    if (star) ctx.drawImage(star, x0, y, iconS, iconS);
    drawBar(barX, y + Math.round((iconS - barH) / 2), barW, barH,
      player.xp / player.xpToNextLevel, '#4a9eff', '#101c30');
    this.deps.renderer.drawText(`LV ${player.level}`, textX, y + Math.round(iconS / 2), {
      size: textS, baseline: 'middle', color: '#ffd700'
    });

    y += rowH;
    const coin = UISprites.getIcon('coin');
    if (coin) ctx.drawImage(coin, x0, y, iconS, iconS);
    this.deps.renderer.drawText(`${formatShort(player.gold)}`, barX, y + Math.round(iconS / 2), {
      size: s(11), baseline: 'middle', color: '#ffd700'
    });

    // --- Right panel: wave + enemies remaining ---
    const waveManager = this.deps.getWaveManager();
    let waveText = `WAVE ${waveManager.currentWave}`;
    let waveColor = '#9ecbff';
    if (waveManager.isBossWave) {
      waveText += ' BOSS'; waveColor = '#ff6b6b';
    } else {
      // Show all wave modifiers in the persistent HUD so players always know
      // what type of wave they're in, even if they missed the start banner.
      const mod = waveManager.waveModifier;
      if (mod === 'horde')     { waveText += ' HORDE';  waveColor = '#ffa94d'; }
      else if (mod === 'elite')     { waveText += ' ELITE';  waveColor = '#ffd43b'; }
      else if (mod === 'miniboss')  { waveText += ' MINI';   waveColor = '#cc88ff'; }
      else if (mod === 'reward')    { waveText += ' LOOT';   waveColor = '#69db7c'; }
      else if (mod === 'speed')     { waveText += ' FAST';   waveColor = '#74c0fc'; }
      else if (mod === 'tank')      { waveText += ' TANK';   waveColor = '#c9a870'; }
      else if (mod === 'chaos')     { waveText += ' CHAOS';  waveColor = '#ff79a8'; }
      else if (mod === 'challenge') { waveText += ' CHAL';   waveColor = '#ff9f43'; }
    }

    const rPanelW = pad * 2 + s(isPortrait ? 118 : 150);
    const rPanelH = pad * 2 + s(34);
    const rx = canvas.width - rPanelW - s(6);
    drawPanel(ctx, rx, topY, rPanelW, rPanelH, DARK_WOOD_THEME, art, 3);
    this.deps.renderer.drawText(waveText, rx + rPanelW / 2, topY + pad + s(4), {
      size: s(isPortrait ? 9 : 11), align: 'center', color: waveColor
    });
    const t = Math.max(0, Math.ceil(waveManager.waveTimer));
    const timerText = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.deps.renderer.drawText(
      `${timerText}  ·  ${this.deps.getEnemies().length + waveManager.waveEnemiesRemaining}`,
      rx + rPanelW / 2, topY + pad + s(22),
      { size: s(8), align: 'center', color: t <= 5 ? '#ffd43b' : '#cfd8e3' }
    );

    // --- Gear button (opens the pause/menu overlay to cash out souls, restart, etc.) ---
    const g = this.deps.getGearButtonRect();
    drawPanel(ctx, g.x, g.y, g.width, g.height, DARK_WOOD_THEME, art, 9);
    this.deps.renderer.drawText('\u2699', g.x + g.width / 2, g.y + g.height / 2 + s(1), {
      size: s(18), align: 'center', baseline: 'middle', color: '#ffe8b0'
    });

    // --- Boss health bar (bottom center, with name) ---
    const boss = this.deps.getEnemies().find((e) => e.typeData.isBoss);
    if (boss) {
      const BOSS_NAMES: Record<string, string> = {
        boss_necrolord: 'NECRO LORD',
        boss_flamefiend: 'FLAME FIEND',
        boss_voidbeast: 'VOID BEAST',
        boss_stormking: 'STORM KING',
        boss_ancientgolem: 'ANCIENT GOLEM',
      };
      const bw = Math.min(s(420), canvas.width - s(60));
      const bh = s(14);
      const bx = Math.round((canvas.width - bw) / 2);
      const by = canvas.height - s(48);
      drawPanel(ctx, bx - s(12), by - s(26), bw + s(24), bh + s(38), DARK_WOOD_THEME, art, 7);
      this.deps.renderer.drawText(BOSS_NAMES[boss.type] ?? 'BOSS', canvas.width / 2, by - s(14), {
        size: s(9), align: 'center', color: '#ff6b6b'
      });
      drawBar(bx, by, bw, bh, boss.health / boss.maxHealth, '#e03131', '#3c0000');
      // Phase threshold tick marks at 66% and 33% HP — telegraph the phase
      // transitions so players can prepare. Pulse slightly when the boss is
      // within 10% of crossing a threshold.
      const healthFrac = boss.health / boss.maxHealth;
      for (const threshold of [2 / 3, 1 / 3]) {
        const mx = bx + Math.round(bw * threshold);
        const approaching = healthFrac > threshold && healthFrac < threshold + 0.10;
        const pulse = approaching ? 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 280)) : 0.55;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx - 1, by - s(2), 2, bh + s(4));
        ctx.restore();
      }
    } else {
      // --- Miniboss health bar (bottom center, with name) — only when no main boss is alive ---
      const miniboss = this.deps.getEnemies().find((e) => e.isMiniboss && !e.typeData.isBoss);
      if (miniboss) {
        const MINIBOSS_NAMES: Record<string, string> = {
          troll: 'MOUNTAIN TROLL',
          cyclops: 'CYCLOPS',
          golem: 'STONE GOLEM',
          necromancer: 'NECROMANCER',
          banshee: 'BANSHEE',
          summoner: 'SUMMONER',
        };
        const label = MINIBOSS_NAMES[miniboss.type] ?? miniboss.type.replace(/_/g, ' ').toUpperCase();
        const bw = Math.min(s(320), canvas.width - s(60));
        const bh = s(10);
        const bx = Math.round((canvas.width - bw) / 2);
        const by = canvas.height - s(44);
        drawPanel(ctx, bx - s(12), by - s(24), bw + s(24), bh + s(34), DARK_WOOD_THEME, art, 7);
        this.deps.renderer.drawText(label, canvas.width / 2, by - s(13), {
          size: s(8), align: 'center', color: '#ffa94d'
        });
        drawBar(bx, by, bw, bh, miniboss.health / miniboss.maxHealth, '#e8731a', '#3c1500');
      }
    }

    // --- Active Skill indicators (bottom-left, below the status panel) ---
    // Dual-slot: Q = primary (slot 1), E = secondary (slot 2).
    // Draw a bar for each equipped slot; stacked vertically.
    const playerStats = this.deps.getPlayerStats();
    const activeSkillIdQ = playerStats.getEquippedSkillIdQ();
    const activeSkillIdE = playerStats.getEquippedSkillId();
    const skX = s(6);
    const skSize = s(28);
    const skBarW = skSize + s(64);
    let skillBarH = 0;

    const isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    const drawSkillBar = (skillId: string, cdFrac: number, cdSecs: number, keyLabel: string, yPos: number) => {
      const sk = getActiveSkillById(skillId);
      if (!sk) return;
      // Background pill
      ctx.fillStyle = '#241407';
      ctx.fillRect(skX - s(2), yPos - s(2), skBarW + s(4), skSize + s(4));
      // Cooldown fill (purple = ready, dark = on cooldown)
      ctx.fillStyle = cdFrac > 0 ? '#3a1a5c' : '#5a2d82';
      ctx.fillRect(skX, yPos, skBarW, skSize);
      // Progress bar (drains as cooldown ticks down)
      if (cdFrac > 0) {
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(skX, yPos, Math.round(skBarW * (1 - cdFrac)), skSize);
      }
      // Icon
      ctx.font = `${s(14)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sk.icon, skX + s(14), yPos + skSize / 2);
      // Name + status label (show TAP on touch devices, [KEY] on keyboard)
      const readyLabel = isTouchDevice ? 'TAP READY' : `[${keyLabel}] READY`;
      const label = cdFrac > 0 ? `${cdSecs}s` : readyLabel;
      ctx.font = `bold ${s(7)}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sk.name, skX + s(30), yPos + s(9));
      ctx.font = `${s(7)}px monospace`;
      ctx.fillStyle = cdFrac > 0 ? '#cc99ff' : '#a0ffa0';
      ctx.fillText(label, skX + s(30), yPos + s(20));
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    };

    if (activeSkillIdQ) {
      const skYQ = topY + panelH + s(8);
      const cdQ = this.deps.getActiveSkillCooldownQ();
      const skQ = getActiveSkillById(activeSkillIdQ);
      const cdFracQ = skQ && cdQ > 0 ? cdQ / skQ.cooldown : 0;
      drawSkillBar(activeSkillIdQ, cdFracQ, Math.ceil(cdQ), 'Q', skYQ);
      skillBarH += s(36);
    }
    if (activeSkillIdE) {
      const skYE = topY + panelH + s(8) + (activeSkillIdQ ? s(36) : 0);
      const cdE = this.deps.getActiveSkillCooldownE();
      const skE = getActiveSkillById(activeSkillIdE);
      const cdFracE = skE && cdE > 0 ? cdE / skE.cooldown : 0;
      drawSkillBar(activeSkillIdE, cdFracE, Math.ceil(cdE), 'E', skYE);
      skillBarH += s(36);
    }

    // --- Status callouts under the left panel ---
    let statusY = topY + panelH + s(8) + skillBarH;
    if (player.shield) {
      this.deps.renderer.drawText('SHIELD ACTIVE', s(10), statusY, { size: s(8), color: '#4a9eff' });
      statusY += s(14);
    }
    const specialization = playerStats.getWeaponSpecialization();
    if (specialization === 'melee' || specialization === 'ranged') {
      this.deps.renderer.drawText(`${specialization.toUpperCase()} +20%`, s(10), statusY, {
        size: s(8), color: specialization === 'melee' ? '#ff8c42' : '#5ee0e0'
      });
      statusY += s(14);
    }
    // Banked skill points — pulse gold to remind the player that the skill tree will open
    // at the next wave-end. Appears mid-wave the moment a level-up banks a point.
    const pendingSkillPts = this.deps.getSkillTreePoints();
    if (pendingSkillPts > 0) {
      const pulse = 0.65 + 0.35 * Math.abs(Math.sin(Date.now() / 520));
      ctx.save();
      ctx.globalAlpha = pulse;
      this.deps.renderer.drawText(
        `⬆ ${pendingSkillPts} SKILL PT${pendingSkillPts > 1 ? 'S' : ''}`,
        s(10), statusY, { size: s(8), color: '#ffd700' }
      );
      ctx.restore();
      statusY += s(14);
    }

    // Trophy Rack type counter — only shown when the player holds at least one
    // Trophy Rack family item. Shows "🏆 N/9" where 9 types × 3%/type = 27% hits
    // the 25% cap (or the effective threshold for the player's per-type bonus).
    const trophyPerType = playerStats.getTrophyRackCritBonus(1); // >0 iff item held
    if (trophyPerType > 0) {
      const typeCount = this.deps.getKilledEnemyTypesCount();
      // Effective cap threshold: types needed to hit the 25% hard cap at current bonus/type.
      const capThreshold = Math.ceil(0.25 / trophyPerType);
      this.deps.renderer.drawText(
        `\uD83C\uDFC6 ${typeCount}/${capThreshold}`,
        s(10), statusY, { size: s(8), color: '#ffd24d' }
      );
      statusY += s(14);
    }

    // Harvest Momentum stack counter — only when the player holds Blood Rush / Blood Frenzy
    // and has at least one active stack. Shows current stacks/max + urgency pulse when the
    // 3-second kill window is about to expire, so the player can prioritise the next kill.
    const harvestBonus = playerStats.getHarvestMomentum();
    if (harvestBonus > 0) {
      const stacks = this.deps.getHarvestMomentumStacks();
      const timer  = this.deps.getHarvestMomentumTimer();
      if (stacks > 0) {
        const HARVEST_MAX = 8;
        const expiring = timer < 1.5; // last 1.5 s — urgent
        const pulse = expiring
          ? 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 120))
          : 1.0;
        // Colour: bright green at high stacks, warm yellow at mid, orange at low.
        const stackColor = stacks >= 6 ? '#00e676' : stacks >= 3 ? '#ffd43b' : '#ff8c42';
        ctx.save();
        ctx.globalAlpha = pulse;
        this.deps.renderer.drawText(
          `\u26A1 ${stacks}/${HARVEST_MAX} FLOW`,
          s(10), statusY, { size: s(8), color: stackColor }
        );
        ctx.restore();
        statusY += s(14);
      }
    }

    // Grindstone wave-ramp counter — only when the player holds at least one Grindstone-
    // family item AND has accumulated a bonus (wave 2+). Shows the permanent damage gain
    // so players can see the ramp paying off without doing the maths themselves.
    // Formula: bonus = waveRampDamage × max(0, wavesSurvived − 1).
    const waveRamp = playerStats.getWaveRampDamage();
    if (waveRamp > 0) {
      const waves = this.deps.getWavesSurvived();
      const bonusFrac = waveRamp * Math.max(0, waves - 1);
      if (bonusFrac > 0) {
        const bonusPct = Math.round(bonusFrac * 100);
        this.deps.renderer.drawText(
          `\u2699 +${bonusPct}% DMG`,
          s(10), statusY, { size: s(8), color: '#c8c8c8' }
        );
        statusY += s(14);
      }
    }

    // Kill-stack counter — only when the player holds a Killing Spree / Kill Frenzy / Kill
    // Reactor family item. Shows the current stack count (caps at 20, decays 12/s after a
    // 2s grace window). Pulses when draining so the player can prioritise the next kill.
    const killStackBonus = playerStats.getKillStackDamage();
    if (killStackBonus > 0) {
      const ks = this.deps.getKillStackCount();
      const ksFloor = Math.floor(ks);
      if (ksFloor >= 1) {
        const KILL_STACK_MAX = 20;
        const draining = this.deps.getKillStackTimer() > 2.0; // grace window passed
        const pulse = draining
          ? 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 150))
          : 1.0;
        const ksColor = ksFloor >= 15 ? '#ff4444' : ksFloor >= 8 ? '#ff8c42' : '#ffd700';
        ctx.save();
        ctx.globalAlpha = pulse;
        this.deps.renderer.drawText(
          `\uD83D\uDC80 \u00D7${ksFloor}/${KILL_STACK_MAX}`,
          s(10), statusY, { size: s(8), color: ksColor }
        );
        ctx.restore();
        statusY += s(14);
      }
    }

    // Growing Malice time-ramp counter — only when the player holds a Growing Malice /
    // Malice Engine / Patience Charm item. Shows the cumulative permanent damage bonus so
    // the player can see the time investment paying off without opening the stats popup.
    // Formula: bonus = timeRampDamage × floor(runPlaySeconds / 15).
    const timeRamp = playerStats.getTimeRampDamage();
    if (timeRamp > 0) {
      const maliceStacks = this.deps.getGrowingMaliceStacks();
      if (maliceStacks > 0) {
        const bonusPct = Math.round(timeRamp * maliceStacks * 100);
        this.deps.renderer.drawText(
          `\uD83D\uDD25 +${bonusPct}% DMG`,
          s(10), statusY, { size: s(8), color: '#ff6b35' }
        );
        statusY += s(14);
      }
    }
  }

  /**
   * Update the mobile skill buttons (blastBtn / skillEBtn) to reflect the currently
   * equipped Q/E skills — shows skill icon + short name, disabled when no skill is
   * equipped in that slot. Called after any item acquisition that might change scrolls.
   */
  updateMobileSkillButtons(): void {
    const blastBtn = document.getElementById('blastBtn') as HTMLButtonElement | null;
    const skillEBtn = document.getElementById('skillEBtn') as HTMLButtonElement | null;
    const playerStats = this.deps.getPlayerStats();
    const qSkillId = playerStats.getEquippedSkillIdQ();
    const eSkillId = playerStats.getEquippedSkillId();
    if (blastBtn) {
      const sk = qSkillId ? getActiveSkillById(qSkillId) : null;
      if (sk) {
        const name = sk.name.length > 7 ? sk.name.slice(0, 6) + '…' : sk.name;
        blastBtn.innerHTML = `${sk.icon}<span style="font-size:9px">${name}</span>`;
        blastBtn.disabled = false;
      } else {
        blastBtn.innerHTML = `🔮<span>Q</span>`;
        blastBtn.disabled = true;
      }
    }
    if (skillEBtn) {
      const sk = eSkillId ? getActiveSkillById(eSkillId) : null;
      if (sk) {
        const name = sk.name.length > 7 ? sk.name.slice(0, 6) + '…' : sk.name;
        skillEBtn.innerHTML = `${sk.icon}<span style="font-size:9px">${name}</span>`;
        skillEBtn.disabled = false;
      } else {
        skillEBtn.innerHTML = `✨<span>E</span>`;
        skillEBtn.disabled = true;
      }
    }
  }
}
