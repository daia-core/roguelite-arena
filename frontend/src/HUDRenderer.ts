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
    drawBar(barX, y + Math.round((iconS - barH) / 2), barW, barH, hpFrac,
      hpFrac > 0.6 ? '#4ade80' : hpFrac > 0.3 ? '#fbbf24' : '#ef4444', '#3c0000');
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
    if (waveManager.isBossWave) { waveText += ' BOSS'; waveColor = '#ff6b6b'; }
    else if (waveManager.isHordeWave) { waveText += ' HORDE'; waveColor = '#ffa94d'; }

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
