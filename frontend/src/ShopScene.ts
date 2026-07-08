/**
 * ShopScene — the between-waves shop screen (step 6 of Game.ts de-god-classing).
 *
 * Owns all UI state for the shop: item selection, overlay flags (combos/stats),
 * toast, inspect popup, equipment strip hit-rects, and all draw/update logic.
 *
 * Game.ts retains ownership of shop inventory (shopItems, lockedShopItems,
 * shopRerollCost) because enterShop() / purchaseShopItem() / rerollShop() all
 * mutate those fields; ShopScene reads them via callbacks in ShopSceneDeps.
 */

import type { Scene } from './scenes/Scene';
import type { GameState } from './Game';
import { type Item, type EquipHolderKey, ItemDatabase, PlayerStats,
  classifyItemSlot, slotLabel, itemStatSegments, descRestatesStats, getItemKinds } from './ItemSystem';
import { Player } from './Player';
import { Input } from './Input';
import { Renderer } from './Renderer';
import { AudioManager } from './AudioManager';
import { pointInRect, formatShort } from './utils';
import { drawPanel, DARK_WOOD_THEME } from './pixel/panel';
import { DUO_COMBOS } from './DuoSystem';
import { SkillTree } from './SkillTree';
import type { Evolution } from './EvolutionSystem';

// ─── Deps ────────────────────────────────────────────────────────────────────

export interface ShopSceneDeps {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  input: Input;
  audio: AudioManager;

  // Live read access (returned by reference — mutations in Game.ts are visible).
  getPlayer(): Player | null;
  getPlayerStats(): PlayerStats;
  getSkillTree(): SkillTree;
  getWave(): number;
  getEvolutions(): Evolution[];

  // Shared mutable shop inventory (owned by Game.ts — pass by reference).
  getShopItems(): (Item | null)[];
  getLockedItems(): Set<number>;
  getLastInterestGained(): number;
  getShopRerollCost(): number;

  // Mutation callbacks — each does the full action + any follow-up in Game.ts.
  onPurchase(slotIndex: number): boolean;
  onReroll(): boolean;
  onContinue(): void;
  onOpenSkillTree(): void;

  // Post-mutation sync helpers (also used by equipment-strip tap handlers).
  onSyncMaxHealth(): void;
  onUpdateMobileSkills(): void;
}

// ─── ShopScene ───────────────────────────────────────────────────────────────

export class ShopScene implements Scene {
  private readonly deps: ShopSceneDeps;

  // ── UI state (owned exclusively by this scene) ───────────────────────────

  selectedShopItem: number = -1;
  showCombosOverlay: boolean = false;
  showStatsPopup: boolean = false;
  private statsPanelRect: { x: number; y: number; width: number; height: number } =
    { x: 0, y: 0, width: 0, height: 0 };

  // Equipped-item inspect popup.
  private inspectedEquipKey: EquipHolderKey | null = null;
  private inspectUnequipRect: { x: number; y: number; width: number; height: number } | null = null;
  private inspectSellRect: { x: number; y: number; width: number; height: number } | null = null;

  // Equipment strip hit-rects (written by drawEquipmentStrip, read by handleEquipmentStripTap).
  private equipSlotRects: Array<{ key: EquipHolderKey; x: number; y: number; width: number; height: number }> = [];
  private stashItemRects: Array<{ index: number; x: number; y: number; width: number; height: number }> = [];
  private stashSellRects: Array<{ index: number; x: number; y: number; width: number; height: number }> = [];

  // Toast — wall-clock timestamped so it fades without threading dt in.
  private shopToastText = '';
  private shopToastAt = 0;
  private static readonly TOAST_MS = 1800;

  constructor(deps: ShopSceneDeps) {
    this.deps = deps;
  }

  /** Reset UI state for a fresh shop entry. Called by Game.ts in enterShop(). */
  enter(_prev?: GameState): void {
    this.selectedShopItem = -1;
    this.showCombosOverlay = false;
    this.showStatsPopup = false;
    this.inspectedEquipKey = null;
    this.deps.input.mouseDown = false;
  }

  /** Show a one-line toast (equip/bench/sell feedback). Also called by Game.ts
   *  purchaseShopItem() for "Item +N" upgrade toasts. */
  showToast(text: string): void {
    this.shopToastText = text;
    this.shopToastAt = Date.now();
  }

  // ── Scene interface ───────────────────────────────────────────────────────

  update(_dt: number): void {
    this.updateShop();
  }

  draw(): void {
    this.drawShop();
  }

  // ─── Layout helpers ───────────────────────────────────────────────────────

  /**
   * Shared shop layout for drawShop + updateShop — click hitboxes MUST match
   * visuals, so both consume this. Values are canvas px, derived from display
   * (CSS) sizes via the zoom factor so the shop reads identically at any zoom.
   */
  private getShopLayout() {
    const canvas = this.deps.canvas;
    const zoom = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const cssW = canvas.width / zoom;
    const cssH = canvas.height / zoom;
    const isPortrait = cssW < cssH;
    const isMobile = cssW < 800;
    const s = (v: number) => Math.round(v * zoom);

    const shopItems = this.deps.getShopItems();
    const SLOTS = Math.max(3, shopItems.length);
    const cols = isPortrait ? 1 : 3;
    const rows = Math.ceil(SLOTS / cols);

    const gapCss = isPortrait ? 8 : 12;
    const gap = s(gapCss);

    const sidePanels = !isPortrait && !isMobile;
    const leftGutterCss = sidePanels ? 242 : 16;
    const rightGutterCss = sidePanels ? 240 : 16;
    const gridRegionWCss = Math.max(60, cssW - leftGutterCss - rightGutterCss);
    const preferredItemWidthCss = isPortrait
      ? Math.min(300, cssW - 32)
      : isMobile ? Math.min(360, cssW - 60) : 200;
    const itemWidthCss = Math.min(
      preferredItemWidthCss,
      (gridRegionWCss - (cols - 1) * gapCss) / cols
    );
    const itemWidth = s(itemWidthCss);
    const rowWidthCss = cols * itemWidthCss + (cols - 1) * gapCss;
    const startXCss = leftGutterCss + (gridRegionWCss - rowWidthCss) / 2;

    const buttonHeightCss = isMobile ? 48 : 44;
    const buttonSpacingCss = 10;
    const bottomMarginCss = 14;
    const gridToButtonGapCss = 12;
    const buttonBandCss =
      buttonHeightCss * 2 + buttonSpacingCss + bottomMarginCss + gridToButtonGapCss;

    const gridTopCss = isMobile ? 176 : 120;

    const preferredItemHeightCss = isPortrait ? 92 : isMobile ? 100 : 150;
    const minItemHeightCss = isMobile ? 34 : 70;
    const availForItemsCss = cssH - gridTopCss - buttonBandCss;
    const fittedItemHeightCss = (availForItemsCss - (rows - 1) * gapCss) / rows;
    const itemHeightCss = Math.max(
      minItemHeightCss,
      Math.min(preferredItemHeightCss, fittedItemHeightCss)
    );
    const itemHeight = s(itemHeightCss);

    const startY = s(gridTopCss);
    const startX = s(startXCss);

    const buttonWidth = s(isMobile ? 240 : 220);
    const buttonHeight = s(buttonHeightCss);
    const buttonSpacing = s(buttonSpacingCss);
    const itemsEndY = startY + rows * (itemHeight + gap);
    const continueY = Math.min(
      itemsEndY + s(gridToButtonGapCss - gapCss),
      canvas.height - buttonHeight * 2 - buttonSpacing - s(bottomMarginCss)
    );
    const rerollY = continueY + buttonHeight + buttonSpacing;
    const splitGap = s(10);
    const splitButtonWidth = Math.floor((buttonWidth - splitGap) / 2);
    const rowCenterX = canvas.width / 2;
    const rerollX = rowCenterX - buttonWidth / 2 + splitButtonWidth / 2;
    const autoBuyX = rowCenterX + buttonWidth / 2 - splitButtonWidth / 2;

    return {
      zoom, s, isPortrait, isMobile, cols,
      itemWidth, itemHeight, gap, startX, startY,
      lockButtonSize: s(isMobile ? 34 : 26),
      buttonWidth, buttonHeight, continueY, rerollY,
      splitButtonWidth, rerollX, autoBuyX,
      iconY: Math.round(itemHeight * 0.12),
      iconSize: s(isMobile ? 20 : 30),
      nameY: Math.round(itemHeight * 0.5),
      nameSize: s(isMobile ? 9 : 10),
      descY: Math.round(itemHeight * 0.66),
      descSize: s(8),
      costY: Math.round(itemHeight * 0.82),
      costSize: s(11),
      synergySize: s(7),
    };
  }

  // "COMBOS ?" help button — top-left of the shop header.
  private getCombosButtonRect() {
    const canvas = this.deps.canvas;
    const zoom = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const isMobile = canvas.width / zoom < 800;
    const width = s(isMobile ? 96 : 108);
    const height = s(isMobile ? 30 : 30);
    return { x: s(8), y: s(6), width, height };
  }

  // "SKILLS" button — top-CENTER of the shop header.
  private getSkillsButtonRect() {
    const canvas = this.deps.canvas;
    const zoom = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const isMobile = canvas.width / zoom < 800;
    const width = s(isMobile ? 96 : 108);
    const height = s(isMobile ? 30 : 30);
    return { x: Math.round((canvas.width - width) / 2), y: s(6), width, height };
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  private updateShop(): void {
    const player = this.deps.getPlayer();
    if (!player) return;

    const mouseX = this.deps.input.mouseX;
    const mouseY = this.deps.input.mouseY;

    const { s, cols, itemWidth, itemHeight, gap, startX, startY, lockButtonSize,
      buttonWidth, buttonHeight, continueY, rerollY,
      splitButtonWidth, rerollX, autoBuyX } = this.getShopLayout();

    this.selectedShopItem = -1;

    // EQUIPPED-ITEM INSPECT POPUP — modal while open.
    if (this.inspectedEquipKey !== null) {
      if (this.deps.input.mouseDown) {
        this.handleInspectPopupTap(mouseX, mouseY);
        this.deps.input.mouseDown = false;
      }
      return;
    }

    // COMBOS guide button.
    const combosBtn = this.getCombosButtonRect();
    if (this.showCombosOverlay) {
      if (this.deps.input.mouseDown) {
        this.showCombosOverlay = false;
        this.deps.input.mouseDown = false;
      }
      return;
    }
    if (pointInRect(mouseX, mouseY, combosBtn) && this.deps.input.mouseDown) {
      this.showCombosOverlay = true;
      this.deps.input.mouseDown = false;
      return;
    }

    // SKILLS button — open skill tree from the shop.
    if (pointInRect(mouseX, mouseY, this.getSkillsButtonRect()) && this.deps.input.mouseDown) {
      this.deps.input.mouseDown = false;
      this.deps.onOpenSkillTree();
      return;
    }

    // Full-stats popup.
    if (this.showStatsPopup) {
      if (this.deps.input.mouseDown) {
        this.showStatsPopup = false;
        this.deps.input.mouseDown = false;
      }
      return;
    }
    if (pointInRect(mouseX, mouseY, this.statsPanelRect) && this.deps.input.mouseDown) {
      this.showStatsPopup = true;
      this.deps.input.mouseDown = false;
      return;
    }

    // EQUIPMENT STRIP — checked before shop cards.
    if (this.deps.input.mouseDown && this.handleEquipmentStripTap(mouseX, mouseY)) {
      this.deps.input.mouseDown = false;
      return;
    }

    const shopItems = this.deps.getShopItems();
    const lockedItems = this.deps.getLockedItems();

    for (let i = 0; i < shopItems.length; i++) {
      const item = shopItems[i];
      if (!item) continue;

      const gridCol = i % cols;
      const gridRow = Math.floor(i / cols);
      const x = startX + gridCol * (itemWidth + gap);
      const y = startY + gridRow * (itemHeight + gap);

      const lockButtonX = x + itemWidth - lockButtonSize - s(4);
      const lockButtonY = y + s(4);

      if (pointInRect(mouseX, mouseY, { x: lockButtonX, y: lockButtonY, width: lockButtonSize, height: lockButtonSize })) {
        if (this.deps.input.mouseDown) {
          if (lockedItems.has(i)) {
            lockedItems.delete(i);
          } else {
            lockedItems.add(i);
          }
          this.deps.audio.playPurchase();
          this.deps.input.mouseDown = false;
        }
      } else if (pointInRect(mouseX, mouseY, { x, y, width: itemWidth, height: itemHeight })) {
        this.selectedShopItem = i;
        if (this.deps.input.mouseDown) {
          if (this.deps.onPurchase(i)) {
            this.deps.audio.playPurchase();
            this.deps.input.mouseDown = false;
          }
        }
      }
    }

    // Continue button (Next Wave).
    const continueBtn = {
      x: this.deps.canvas.width / 2 - buttonWidth / 2,
      y: continueY,
      width: buttonWidth,
      height: buttonHeight,
    };
    if (pointInRect(mouseX, mouseY, continueBtn) && this.deps.input.mouseDown) {
      this.deps.onContinue();
      this.deps.input.mouseDown = false;
    }

    // Reroll button (left half of second row).
    const rerollBtn = {
      x: rerollX - splitButtonWidth / 2,
      y: rerollY,
      width: splitButtonWidth,
      height: buttonHeight,
    };
    if (pointInRect(mouseX, mouseY, rerollBtn) && this.deps.input.mouseDown) {
      if (this.deps.onReroll()) {
        this.deps.audio.playPurchase();
        this.deps.input.mouseDown = false;
      }
    }

    // Auto-Buy button (right half of second row).
    const autoBuyBtn = {
      x: autoBuyX - splitButtonWidth / 2,
      y: rerollY,
      width: splitButtonWidth,
      height: buttonHeight,
    };
    if (pointInRect(mouseX, mouseY, autoBuyBtn) && this.deps.input.mouseDown) {
      this.autoBuyAll();
      this.deps.input.mouseDown = false;
    }
  }

  /**
   * Auto-Buy: greedily buy every affordable item, then reroll and repeat until
   * neither another item nor a reroll can be afforded.
   */
  private autoBuyAll(): void {
    const player = this.deps.getPlayer();
    if (!player) return;

    let didAnything = false;
    const MAX_PASSES = 1000;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let boughtThisPass = false;
      const items = this.deps.getShopItems();
      for (let i = 0; i < items.length; i++) {
        if (this.deps.onPurchase(i)) {
          boughtThisPass = true;
          didAnything = true;
        }
      }
      if (this.deps.onReroll()) {
        didAnything = true;
        continue;
      }
      if (!boughtThisPass) break;
    }
    if (didAnything) this.deps.audio.playPurchase();
  }

  // ─── Equipment strip ──────────────────────────────────────────────────────

  /**
   * Draw the equipment strip — 8 gear slots (2 rows of 4) + the stash row.
   * Writes equipSlotRects/stashItemRects/stashSellRects for updateShop hit-testing.
   */
  private drawEquipmentStrip(
    ctx: CanvasRenderingContext2D,
    s: (n: number) => number,
    isMobile: boolean,
    x: number,
    y: number,
    width: number
  ): void {
    const ps = this.deps.getPlayerStats();
    const eq = ps.getEquipment();
    const offhandDisabled = ps.isOffhandDisabled();
    this.equipSlotRects = [];
    this.stashItemRects = [];
    this.stashSellRects = [];

    const boxH = isMobile ? s(22) : s(28);
    const gap = s(4);
    const cols = 4;
    const boxW = (width - gap * (cols - 1)) / cols;
    const rowGap = s(3);
    const labels: Record<EquipHolderKey, string> = {
      weapon: 'WEAPON', offhand: 'OFF', head: 'HEAD', amulet: 'AMULET',
      torso: 'TORSO', legs: 'LEGS', feet: 'FEET', ring: 'RING',
    };
    const keys: EquipHolderKey[] = ['weapon', 'offhand', 'head', 'amulet', 'torso', 'legs', 'feet', 'ring'];

    keys.forEach((key, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const bx = x + col * (boxW + gap);
      const by = y + row * (boxH + rowGap);
      this.equipSlotRects.push({ key, x: bx, y: by, width: boxW, height: boxH });

      const disabled = key === 'offhand' && offhandDisabled;
      const occupant = eq[key];
      const level = occupant?.upgradeLevel ?? 1;

      ctx.save();
      ctx.fillStyle = disabled ? '#1a1408' : (occupant ? '#3a2c12' : '#241a0c');
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeStyle = disabled ? '#3a3018' : (occupant ? '#c8a15a' : '#5c4a28');
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, boxW, boxH);
      ctx.restore();

      this.deps.renderer.drawText(labels[key], bx + s(3), by + s(2), {
        size: s(4.5), color: disabled ? '#4a3f22' : '#a5915f', align: 'left'
      });

      if (disabled) {
        this.deps.renderer.drawText('2H', bx + boxW / 2, by + boxH / 2 - s(2), {
          size: s(6), color: '#5a4a28', align: 'center'
        });
      } else if (occupant) {
        this.deps.renderer.drawItemIcon(occupant.icon, bx + boxW / 2, by + s(isMobile ? 9 : 11), s(isMobile ? 12 : 15));
        if (level > 1) {
          this.deps.renderer.drawText(`+${level - 1}`, bx + boxW - s(2), by + boxH - s(7), {
            size: s(isMobile ? 6 : 7), color: '#ffe08a', align: 'right'
          });
        }
      } else {
        this.deps.renderer.drawText('—', bx + boxW / 2, by + boxH / 2 - s(3), {
          size: s(8), color: '#5c4a28', align: 'center'
        });
      }
    });

    const stripRows = Math.ceil(keys.length / cols);
    const stripBottom = y + stripRows * boxH + (stripRows - 1) * rowGap;

    const anyEquipped = keys.some(k => eq[k]);
    if (anyEquipped) {
      this.deps.renderer.drawText('tap gear ▸ inspect', x + width - s(2), stripBottom + s(2), {
        size: s(5), color: '#7a6a44', align: 'right'
      });
    }

    // Stash row.
    const stash = ps.getStash();
    if (stash.length > 0) {
      const rowY = stripBottom + s(4);
      const iconBox = isMobile ? s(18) : s(22);
      this.deps.renderer.drawText(`STASH ${stash.length}/${PlayerStats.STASH_CAP} · tap ▸ equip`, x + s(2), rowY, {
        size: s(5.5), color: '#9c8a5c', align: 'left'
      });
      const iconsY = rowY + s(8);
      const sellBadge = s(isMobile ? 8 : 9);
      for (let i = 0; i < stash.length; i++) {
        const ix = x + i * (iconBox + s(5));
        ctx.save();
        ctx.fillStyle = '#241a0c';
        ctx.fillRect(ix, iconsY, iconBox, iconBox);
        ctx.strokeStyle = '#5c4a28';
        ctx.lineWidth = 1;
        ctx.strokeRect(ix, iconsY, iconBox, iconBox);
        ctx.restore();
        this.deps.renderer.drawItemIcon(stash[i].icon, ix + iconBox / 2, iconsY + iconBox / 2 - s(4), s(isMobile ? 11 : 13));
        this.stashItemRects.push({ index: i, x: ix, y: iconsY, width: iconBox, height: iconBox });

        const sbx = ix + iconBox - sellBadge + s(1);
        const sby = iconsY - s(1);
        ctx.save();
        ctx.fillStyle = '#5a1e14';
        ctx.fillRect(sbx, sby, sellBadge, sellBadge);
        ctx.strokeStyle = '#c85a3c';
        ctx.lineWidth = 1;
        ctx.strokeRect(sbx, sby, sellBadge, sellBadge);
        ctx.restore();
        this.deps.renderer.drawText('✕', sbx + sellBadge / 2, sby + sellBadge / 2 - s(3), {
          size: s(isMobile ? 6 : 7), color: '#ffd0c0', align: 'center'
        });
        const pad = s(2);
        this.stashSellRects.push({ index: i, x: sbx - pad, y: sby - pad, width: sellBadge + pad * 2, height: sellBadge + pad * 2 });
      }
    }
  }

  /**
   * Equipment strip tap handler. Returns true if the tap hit an interactive region.
   * Priority: stash sell ✕ badges → stash icons → equipped slots.
   */
  private handleEquipmentStripTap(mx: number, my: number): boolean {
    const player = this.deps.getPlayer();
    if (!player) return false;
    const ps = this.deps.getPlayerStats();
    const stash = ps.getStash();

    // 1. Stash sell ✕ badges.
    for (const r of this.stashSellRects) {
      if (pointInRect(mx, my, r)) {
        const item = stash[r.index];
        if (item) {
          const refund = ps.getSellValue(item);
          ps.removeItem(item.id);
          player.gold += refund;
          this.deps.onSyncMaxHealth();
          this.deps.onUpdateMobileSkills();
          this.deps.audio.playPurchase();
          this.showToast(`Sold ${item.name} · +${refund}g`);
        }
        return true;
      }
    }

    // 2. Stash icons → equip.
    for (const r of this.stashItemRects) {
      if (pointInRect(mx, my, r)) {
        const item = stash[r.index];
        if (item && ps.equipFromStash(r.index)) {
          this.deps.onSyncMaxHealth();
          this.deps.audio.playPurchase();
          this.showToast(`Equipped ${item.name}`);
        }
        return true;
      }
    }

    // 3. Equipped slots → open inspect popup.
    for (const r of this.equipSlotRects) {
      if (pointInRect(mx, my, r)) {
        const occupant = ps.getEquipment()[r.key];
        if (!occupant) return false;
        this.inspectedEquipKey = r.key;
        this.deps.audio.playPurchase();
        return true;
      }
    }

    return false;
  }

  /** Modal input handler for the equipped-item inspect popup. */
  private handleInspectPopupTap(mx: number, my: number): boolean {
    if (this.inspectedEquipKey === null) return false;
    const player = this.deps.getPlayer();
    if (!player) return false;
    const ps = this.deps.getPlayerStats();
    const key = this.inspectedEquipKey;
    const occupant = ps.getEquipment()[key];
    if (!occupant) { this.inspectedEquipKey = null; return true; }

    if (this.inspectUnequipRect && pointInRect(mx, my, this.inspectUnequipRect)) {
      if (ps.unequipToStash(key)) {
        this.showToast(`Benched ${occupant.name}`);
      } else {
        const refund = ps.getSellValue(occupant);
        ps.removeItem(occupant.id);
        player.gold += refund;
        this.showToast(`Stash full — sold ${occupant.name} · +${refund}g`);
      }
      this.deps.onSyncMaxHealth();
      this.deps.onUpdateMobileSkills();
      this.deps.audio.playPurchase();
      this.inspectedEquipKey = null;
      return true;
    }

    if (this.inspectSellRect && pointInRect(mx, my, this.inspectSellRect)) {
      const refund = ps.getSellValue(occupant);
      ps.removeItem(occupant.id);
      player.gold += refund;
      this.deps.onSyncMaxHealth();
      this.deps.onUpdateMobileSkills();
      this.deps.audio.playPurchase();
      this.showToast(`Sold ${occupant.name} · +${refund}g`);
      this.inspectedEquipKey = null;
      return true;
    }

    // Tap anywhere else closes the popup.
    this.inspectedEquipKey = null;
    return true;
  }

  // ─── Card info helpers ────────────────────────────────────────────────────

  private getCardDuoInfo(item: Item): { name: string; partner: string; effect: string; completes: boolean } | null {
    const ps = this.deps.getPlayerStats();
    let discovery: { name: string; partner: string; effect: string; completes: boolean } | null = null;
    for (const duo of DUO_COMBOS) {
      const isItem1 = item.id === duo.item1Id;
      const isItem2 = item.id === duo.item2Id;
      if (!isItem1 && !isItem2) continue;
      const partnerId = isItem1 ? duo.item2Id : duo.item1Id;
      const partner = ItemDatabase.getItemById(partnerId);
      const ownsPartner = ps.items.some(o => o.id === partnerId);
      const effect = duo.specialEffect || duo.description;
      if (ownsPartner) {
        return { name: duo.name, partner: partner?.name ?? '?', effect, completes: true };
      }
      if (!discovery) discovery = { name: duo.name, partner: partner?.name ?? '?', effect, completes: false };
    }
    return discovery;
  }

  private getCardEvolutionInfo(item: Item): { name: string } | null {
    const ps = this.deps.getPlayerStats();
    const ownedIds = new Set(ps.items.map(i => i.id));
    for (const evo of this.deps.getEvolutions()) {
      if (item.id === evo.catalystItemId && ownedIds.has(evo.baseWeaponId) && !ownedIds.has(evo.evolvedWeaponId)) {
        return { name: evo.name };
      }
      if (item.id === evo.baseWeaponId && ownedIds.has(evo.catalystItemId) && !ownedIds.has(evo.evolvedWeaponId)) {
        return { name: evo.name };
      }
    }
    return null;
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  private drawShop(): void {
    const { s, isMobile, cols, itemWidth, itemHeight, gap, startX, startY, lockButtonSize,
      buttonWidth, buttonHeight, continueY, rerollY,
      splitButtonWidth, rerollX, autoBuyX,
      nameSize, descSize, costSize,
      synergySize } = this.getShopLayout();
    const ctx = this.deps.renderer.getContext();
    const canvas = this.deps.canvas;

    const titleSize = s(isMobile ? 16 : 22);
    const titleY = s(isMobile ? 10 : 20);
    this.deps.renderer.drawText('SHOP', canvas.width / 2 + s(2), titleY + s(2), {
      size: titleSize, align: 'center', color: '#241407', stroke: false
    });
    this.deps.renderer.drawText('SHOP', canvas.width / 2, titleY, {
      size: titleSize, align: 'center', color: '#ffd700'
    });

    const player = this.deps.getPlayer();
    if (!player) return;

    const ps = this.deps.getPlayerStats();
    const shopItems = this.deps.getShopItems();
    const lockedItems = this.deps.getLockedItems();

    this.deps.renderer.drawText(`${player.gold} G`, canvas.width / 2, s(isMobile ? 32 : 50), {
      size: s(10), align: 'center', color: '#ffd700'
    });

    // COMBOS help button.
    {
      const btn = this.getCombosButtonRect();
      const activeCount = ps.getActiveDuos().length;
      ctx.save();
      ctx.fillStyle = activeCount > 0 ? '#3d2f12' : '#2e1c0e';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeStyle = activeCount > 0 ? '#ffd43b' : '#c8a15a';
      ctx.lineWidth = 2;
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
      ctx.restore();
      const label = activeCount > 0 ? `COMBOS ${activeCount}★` : 'COMBOS ?';
      this.deps.renderer.drawText(label, btn.x + btn.width / 2, btn.y + Math.round(btn.height * 0.28), {
        size: s(8), align: 'center', color: activeCount > 0 ? '#ffe066' : '#e5d9c3'
      });
    }

    // SKILLS button.
    {
      const btn = this.getSkillsButtonRect();
      const pts = this.deps.getSkillTree().availablePoints;
      ctx.save();
      ctx.fillStyle = pts > 0 ? '#153d20' : '#2e1c0e';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeStyle = pts > 0 ? '#69db7c' : '#c8a15a';
      ctx.lineWidth = 2;
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
      ctx.restore();
      const label = pts > 0 ? `SKILLS +${pts}` : 'SKILLS';
      this.deps.renderer.drawText(label, btn.x + btn.width / 2, btn.y + Math.round(btn.height * 0.28), {
        size: s(8), align: 'center', color: pts > 0 ? '#a8e063' : '#e5d9c3'
      });
    }

    // Banking interest earned.
    const lastInterest = this.deps.getLastInterestGained();
    if (lastInterest > 0) {
      this.deps.renderer.drawText(
        `+${lastInterest}g interest`,
        canvas.width / 2, s(isMobile ? 46 : 66),
        { size: s(7), align: 'center', color: '#8ce99a' }
      );
    }

    // PLAYER STATS PANEL.
    const statPanelPadding = s(8);
    const statPanelWidth = isMobile ? canvas.width - s(20) : s(220);
    const statPanelHeight = isMobile ? s(38) : s(140);
    const statPanelX = s(10);
    const statPanelY = isMobile ? s(64) : s(56);

    drawPanel(ctx, statPanelX, statPanelY, statPanelWidth, statPanelHeight, DARK_WOOD_THEME, 4, 11);
    this.statsPanelRect = { x: statPanelX, y: statPanelY, width: statPanelWidth, height: statPanelHeight };

    const fr = ps.getFireRate();
    const stats: Array<[string, string, string]> = [
      ['HP', `${formatShort(Math.ceil(player.health))}/${formatShort(ps.getMaxHealth())}`, '#ff6b6b'],
      ['DMG', `${formatShort(ps.getDamage())}`, '#ffa94d'],
      ['FIRE', `${fr >= 1000 ? formatShort(fr) : fr.toFixed(1)}/S`, '#ff8787'],
      ['SPD', `${formatShort(ps.getSpeed())}`, '#66d9e8'],
      ['CRIT', `${formatShort(Math.floor(ps.getCritChance() * 100))}%`, '#ffd43b'],
      ['MULTI', `${formatShort(ps.getMultishot())}`, '#69db7c'],
    ];

    if (isMobile) {
      const statSize = s(7);
      const colW = (statPanelWidth - statPanelPadding * 2) / 3;
      stats.forEach(([label, value, color], idx) => {
        const colX = statPanelX + statPanelPadding + (idx % 3) * colW;
        const rowY = statPanelY + s(8) + Math.floor(idx / 3) * s(15);
        this.deps.renderer.drawText(`${label} ${value}`, colX, rowY, {
          size: statSize, color, align: 'left'
        });
      });
    } else {
      const statSize = s(9);
      stats.forEach(([label, value, color], idx) => {
        const rowY = statPanelY + s(14) + idx * s(19);
        this.deps.renderer.drawText(label, statPanelX + statPanelPadding + 4, rowY, {
          size: statSize, color: '#c8b998', align: 'left'
        });
        this.deps.renderer.drawText(value, statPanelX + statPanelWidth - statPanelPadding - 4, rowY, {
          size: statSize, color, align: 'right'
        });
      });
    }

    if (isMobile) {
      this.deps.renderer.drawText('TAP ▸ ALL STATS', statPanelX + statPanelWidth - statPanelPadding - 2, statPanelY + statPanelHeight - s(5), {
        size: s(5.5), color: '#ffe08a', align: 'right'
      });
    } else {
      this.deps.renderer.drawText('TAP FOR ALL STATS ▸', statPanelX + statPanelWidth / 2, statPanelY + statPanelHeight - s(9), {
        size: s(7), color: '#ffe08a', align: 'center'
      });
    }

    // EQUIPMENT STRIP.
    this.drawEquipmentStrip(ctx, s, isMobile, statPanelX, statPanelY + statPanelHeight + s(6), statPanelWidth);

    // SHOP TOAST.
    if (this.shopToastText) {
      const age = Date.now() - this.shopToastAt;
      if (age < ShopScene.TOAST_MS) {
        const fade = Math.min(1, (ShopScene.TOAST_MS - age) / 400);
        ctx.save();
        ctx.globalAlpha = fade;
        const ty = s(isMobile ? 44 : 66);
        this.deps.renderer.drawText(this.shopToastText, canvas.width / 2, ty, {
          size: s(isMobile ? 7 : 9), color: '#ffe08a', align: 'center'
        });
        ctx.restore();
      } else {
        this.shopToastText = '';
      }
    }

    // INVENTORY PANEL (trinkets, desktop-only).
    const invPanelPadding = s(6);
    const invPanelWidth = s(220);
    const invPanelMaxHeight = s(200);
    const invPanelX = canvas.width - s(230);
    const invPanelY = s(56);

    if (!isMobile && ps.trinkets.length > 0) {
      const itemCounts = new Map<string, { item: Item; count: number }>();
      for (const item of ps.trinkets) {
        const existing = itemCounts.get(item.id);
        if (existing) {
          existing.count++;
        } else {
          itemCounts.set(item.id, { item, count: 1 });
        }
      }
      const uniqueItems = Array.from(itemCounts.values());
      const iconSize = s(24);
      const iconsPerRow = 6;
      const rows = Math.ceil(uniqueItems.length / iconsPerRow);
      const invPanelHeight = Math.min(invPanelMaxHeight, rows * (iconSize + s(4)) + invPanelPadding * 2 + s(18));
      drawPanel(ctx, invPanelX, invPanelY, invPanelWidth, invPanelHeight, DARK_WOOD_THEME, 4, 23);
      this.deps.renderer.drawText('TRINKETS', invPanelX + invPanelWidth / 2, invPanelY + s(8), {
        size: s(8), align: 'center', color: '#d0bfff'
      });
      const gridStartX = invPanelX + invPanelPadding;
      const gridStartY = invPanelY + s(20);
      for (let i = 0; i < uniqueItems.length; i++) {
        const { item, count } = uniqueItems[i];
        const col = i % iconsPerRow;
        const row = Math.floor(i / iconsPerRow);
        const x = gridStartX + col * (iconSize + s(4));
        const y = gridStartY + row * (iconSize + s(4));
        this.deps.renderer.drawItemIcon(item.icon, x + iconSize / 2, y + s(2), s(18));
        if (count > 1) {
          const badgeSize = s(12);
          const badgeX = x + iconSize - badgeSize / 2 - 2;
          const badgeY = y - badgeSize / 2 + 2;
          ctx.save();
          ctx.fillStyle = '#241407';
          ctx.fillRect(badgeX - badgeSize / 2, badgeY - badgeSize / 2, badgeSize, badgeSize);
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1;
          ctx.strokeRect(badgeX - badgeSize / 2, badgeY - badgeSize / 2, badgeSize, badgeSize);
          ctx.restore();
          this.deps.renderer.drawText(`x${count}`, badgeX, badgeY - badgeSize / 4, {
            size: s(7), align: 'center', color: '#ffffff'
          });
        }
      }
    }

    // Card grid.
    const wave = this.deps.getWave();
    for (let i = 0; i < shopItems.length; i++) {
      const item = shopItems[i];
      if (!item) continue;

      const gridCol = i % cols;
      const gridRow = Math.floor(i / cols);
      const x = startX + gridCol * (itemWidth + gap);
      const y = startY + gridRow * (itemHeight + gap);
      const hovered = this.selectedShopItem === i;

      const rarityColors: Record<string, string> = {
        common: '#d7d3c8', rare: '#4a9eff', epic: '#a855f7', legendary: '#ffd700'
      };
      const rarityColor = rarityColors[item.rarity] ?? '#ffffff';

      const hasSynergy = ps.hasSynergyWith(item);
      const ownedTags = [...new Set(ps.items.flatMap(it => it.tags))];
      const matchingTags = item.tags.filter(tag => ownedTags.includes(tag));
      const hasTagMatch = matchingTags.length > 0;
      const isDuplicate = ps.items.some(owned => owned.id === item.id);
      const duoInfo = this.getCardDuoInfo(item);
      const completesDuo = duoInfo?.completes ?? false;
      const evoInfo = this.getCardEvolutionInfo(item);

      drawPanel(ctx, x, y, itemWidth, itemHeight, DARK_WOOD_THEME, 4, i);
      let borderColor = rarityColor;
      if (completesDuo) borderColor = '#ffd43b';
      else if (evoInfo) borderColor = '#ff9f43';
      else if (isDuplicate) borderColor = '#4a9eff';
      else if (hasTagMatch || hasSynergy) borderColor = '#7bd94a';
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = hovered ? 6 : 3;
      ctx.strokeRect(x + 6, y + 6, itemWidth - 12, itemHeight - 12);
      ctx.restore();

      // Lock button.
      const lockButtonX = x + itemWidth - lockButtonSize - s(4);
      const lockButtonY = y + s(4);
      const isLocked = lockedItems.has(i);
      ctx.save();
      ctx.fillStyle = isLocked ? '#ffd700' : '#2e1c0e';
      ctx.fillRect(lockButtonX, lockButtonY, lockButtonSize, lockButtonSize);
      ctx.strokeStyle = isLocked ? '#fff3bf' : '#6b4423';
      ctx.lineWidth = 2;
      ctx.strokeRect(lockButtonX, lockButtonY, lockButtonSize, lockButtonSize);
      ctx.restore();
      this.deps.renderer.drawItemIcon(isLocked ? '🔒' : '🔓', lockButtonX + lockButtonSize / 2, lockButtonY + Math.round(lockButtonSize * 0.12), Math.round(lockButtonSize * 0.76), 'center');

      // Card content.
      const cardInset = s(8);
      const pad = s(isMobile ? 6 : 8);
      const contentTop = y + cardInset;
      const contentBottom = y + itemHeight - cardInset;
      const contentH = contentBottom - contentTop;

      const iconBox = Math.min(Math.round(contentH * 0.94), Math.round(itemWidth * 0.34));
      const iconLeft = x + cardInset;
      const iconCX = iconLeft + iconBox / 2;
      const iconCY = y + itemHeight / 2;
      const iconTop = iconCY - iconBox / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(iconLeft, iconTop, iconBox, iconBox);
      ctx.strokeStyle = rarityColor;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.strokeRect(iconLeft, iconTop, iconBox, iconBox);
      ctx.restore();
      const spriteSize = Math.round(iconBox * 0.74);
      this.deps.renderer.drawItemIcon(item.icon, iconCX, iconCY - spriteSize / 2, spriteSize, 'center');

      const textX = iconLeft + iconBox + pad;
      const textRight = x + itemWidth - cardInset;
      const textW = Math.max(s(30), textRight - textX);
      const lockLeft = x + itemWidth - lockButtonSize - s(4);
      const nameMaxW = Math.max(s(30), lockLeft - textX - s(4));

      const drawPill = (px: number, py: number, label: string, fs: number,
        textColor: string, bgColor: string, borderColor: string): number => {
        const w = Math.round(label.length * fs) + s(9);
        const h = fs + s(6);
        ctx.save();
        ctx.fillStyle = bgColor;
        ctx.fillRect(px, py, w, h);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, w, h);
        ctx.restore();
        this.deps.renderer.drawText(label, px + w / 2, py + s(3), {
          size: fs, align: 'center', color: textColor, stroke: false,
        });
        return w;
      };

      let ty = contentTop;

      // Row 1 — name.
      this.deps.renderer.drawText(item.name, textX, ty, {
        size: nameSize, align: 'left', color: rarityColor, maxWidth: nameMaxW,
      });
      ty += nameSize + s(5);

      // Row 2 — slot/type badge + synergy indicator.
      const SLOT_LABELS: Record<string, string> = {
        'weapon-1h': 'WEAPON', 'weapon-2h': '2H WEAPON', 'offhand': 'OFF-HAND',
        'head': 'HEAD', 'amulet': 'AMULET', 'torso': 'TORSO', 'legs': 'LEGS',
        'feet': 'FEET', 'ring': 'RING', 'trinket': 'TRINKET',
      };
      const slot = classifyItemSlot(item);
      const isTrinket = slot === 'trinket';
      const badgeS = synergySize;
      const badgeLabel = SLOT_LABELS[slot] ?? slot.toUpperCase();
      const badgeW = drawPill(
        textX, ty, badgeLabel, badgeS,
        isTrinket ? '#f3e8ff' : '#e6fff7',
        isTrinket ? '#4a2d6b' : '#12463a',
        isTrinket ? '#c084fc' : '#4ec9b0',
      );

      if (completesDuo || evoInfo || duoInfo || hasTagMatch || hasSynergy) {
        let indicatorText = '';
        let indicatorColor = '#7bd94a';
        if (completesDuo && duoInfo) { indicatorText = duoInfo.name.toUpperCase(); indicatorColor = '#ffd43b'; }
        else if (evoInfo) { indicatorText = `EVO: ${evoInfo.name.toUpperCase()}`; indicatorColor = '#ff9f43'; }
        else if (duoInfo) { indicatorText = `+ ${duoInfo.partner}`; indicatorColor = '#74c0fc'; }
        else if (hasTagMatch) { indicatorText = `${matchingTags.map(t => t.toUpperCase()).join('/')} FIT`; indicatorColor = '#7bd94a'; }
        else if (hasSynergy) { indicatorText = 'GOOD FIT'; indicatorColor = '#7bd94a'; }
        if (indicatorText) {
          this.deps.renderer.drawText(indicatorText, textRight, ty + s(1), {
            size: badgeS, align: 'right', color: indicatorColor,
            maxWidth: Math.max(s(20), textW - badgeW - s(6)),
          });
        }
      }
      ty += badgeS + s(6) + s(5);

      // Row 3 — stat lines.
      const statS = Math.max(s(6), Math.round(descSize * 0.9));
      const segs = itemStatSegments(item);
      const itemStats = segs.map(sg => sg.text);
      if (segs.length > 0) {
        const sep = '  ·  ';
        const totalChars = segs.reduce((n, sg) => n + sg.text.length, 0) + sep.length * Math.max(0, segs.length - 1);
        const effS = Math.min(statS, Math.max(1, Math.floor(textW / Math.max(1, totalChars))));
        let sx = textX;
        for (let si = 0; si < segs.length; si++) {
          if (si > 0) {
            this.deps.renderer.drawText(sep, sx, ty, { size: effS, align: 'left', color: '#6b6250' });
            sx += sep.length * effS;
          }
          this.deps.renderer.drawText(segs[si].text, sx, ty, {
            size: effS, align: 'left', color: segs[si].neg ? '#ff6b6b' : '#8ce99a',
          });
          sx += segs[si].text.length * effS;
        }
        ty += statS + s(5);
      }

      // Footer row.
      const kindColors: Record<string, string> = { weapon: '#f0637a', passive: '#6aa9ff', active: '#ffc14d' };
      const kinds = getItemKinds(item);
      const footerS = Math.max(s(6), Math.round(descSize * 0.82));
      const footerY = contentBottom - footerS;

      // Row 4 — description.
      const descTop = ty;
      const descBottomLimit = footerY - s(4);
      const descLineH = descSize + Math.max(2, Math.round(descSize * 0.35));
      const descMaxLines = Math.max(1, Math.floor((descBottomLimit - descTop) / descLineH));
      const cardShowDesc = (completesDuo && duoInfo) || !descRestatesStats(item.description, itemStats);
      if (cardShowDesc) {
        this.deps.renderer.drawWrappedText(
          completesDuo && duoInfo ? duoInfo.effect : item.description,
          textX, descTop,
          {
            size: descSize, align: 'left',
            color: completesDuo && duoInfo ? '#ffe066' : '#e5d9c3',
            maxWidth: textW, maxLines: descMaxLines,
          }
        );
      }

      // Price.
      const isCascade = (item as any)._cascade === true;
      const finalPrice = isCascade ? 0 : ps.getItemPrice(item, wave);
      const canAfford = isCascade || player.gold >= finalPrice;
      const priceLabel = isCascade ? 'FREE!' : `${finalPrice} G`;
      const priceW = Math.round(priceLabel.length * costSize) + s(4);
      this.deps.renderer.drawText(priceLabel, textRight, footerY - s(1), {
        size: costSize, align: 'right',
        color: isCascade ? '#69db7c' : (canAfford ? '#ffd700' : '#ef4444'),
      });

      // Category + tags.
      const catLabel = kinds.map(k => k.toUpperCase()).join('/');
      const footerText = item.tags.length ? `${catLabel}  ·  ${item.tags.join(' ')}` : catLabel;
      this.deps.renderer.drawText(footerText, textX, footerY, {
        size: footerS, align: 'left',
        color: kinds.length === 1 ? kindColors[kinds[0]] : '#b7a888',
        maxWidth: Math.max(s(20), textRight - priceW - s(6) - textX),
      });
    }

    // Buttons.
    this.deps.renderer.drawButton(
      canvas.width / 2 - buttonWidth / 2, continueY, buttonWidth, buttonHeight,
      'Next Wave', false, true, isMobile
    );

    const freeReroll = shopItems.filter(item => item !== null && item !== undefined).length === 0;
    const shopRerollCost = this.deps.getShopRerollCost();
    const effectiveRerollCost = freeReroll ? 0 : shopRerollCost;
    const canAffordReroll = player.gold >= effectiveRerollCost;
    this.deps.renderer.drawButton(
      rerollX - splitButtonWidth / 2, rerollY, splitButtonWidth, buttonHeight,
      freeReroll ? 'Reroll (FREE)' : `Reroll (${shopRerollCost}g)`,
      false, canAffordReroll, isMobile
    );

    const cheapestPrice = shopItems.reduce((min, it) => {
      if (!it) return min;
      const p = ps.getItemPrice(it, wave);
      return Math.min(min, p);
    }, Infinity);
    const canAutoBuy = player.gold >= cheapestPrice || canAffordReroll;
    this.deps.renderer.drawButton(
      autoBuyX - splitButtonWidth / 2, rerollY, splitButtonWidth, buttonHeight,
      'Auto-Buy', false, canAutoBuy, isMobile
    );

    // Overlays (drawn last so they sit on top).
    if (this.showCombosOverlay) this.drawCombosOverlay();
    if (this.showStatsPopup) this.drawStatsPopup();
    if (this.inspectedEquipKey !== null) this.drawInspectPopup();
  }

  // ─── Inspect popup ────────────────────────────────────────────────────────

  private drawInspectPopup(): void {
    const key = this.inspectedEquipKey;
    if (key === null) { this.inspectUnequipRect = this.inspectSellRect = null; return; }
    const ps = this.deps.getPlayerStats();
    const item = ps.getEquipment()[key];
    if (!item) { this.inspectedEquipKey = null; return; }

    const ctx = this.deps.renderer.getContext();
    const canvas = this.deps.canvas;
    const zoom = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = canvas.width;
    const H = canvas.height;
    const isMobile = W / zoom < 800;

    const rarityColor: Record<string, string> = {
      common: '#c8c8c8', rare: '#74c0fc', epic: '#b06bd9', legendary: '#f2b04e',
    };
    const nameCol = rarityColor[item.rarity] ?? '#ffffff';
    const level = item.upgradeLevel ?? 1;
    const segs = itemStatSegments(item, level);
    const statsArr = segs.map(sg => sg.text);

    const pad = s(10);
    const panelW = Math.min(W - s(24), s(isMobile ? 300 : 360));
    const bodySize = s(isMobile ? 8 : 9);
    const lineH = bodySize + Math.max(2, Math.round(bodySize * 0.35));
    const headSize = s(isMobile ? 11 : 13);
    const iconBox = s(isMobile ? 34 : 40);

    const textW = panelW - pad * 2;
    const charsPerLine = Math.max(8, Math.floor(textW / bodySize));
    const estLines = Math.ceil(item.description.length / charsPerLine);
    const descRedundant = descRestatesStats(item.description, itemStatSegments(item).map(sg => sg.text));
    const descLineCount = descRedundant ? 0 : Math.min(4, Math.max(1, estLines));

    const headerH = Math.max(iconBox, headSize + lineH);
    const statsH = statsArr.length > 0 ? (statsArr.length * lineH + s(4)) : 0;
    const descH = descLineCount > 0 ? descLineCount * lineH + s(4) : 0;
    const btnH = s(isMobile ? 26 : 30);
    const panelH = pad + headerH + s(6) + statsH + descH + s(8) + btnH + pad;

    const px = (W - panelW) / 2;
    const py = Math.max(s(12), (H - panelH) / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(8,5,2,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawPanel(ctx, px, py, panelW, panelH, DARK_WOOD_THEME, 41, 88);

    const contentX = px + pad;
    let cy = py + pad;
    ctx.save();
    ctx.fillStyle = '#241a0c';
    ctx.fillRect(contentX, cy, iconBox, iconBox);
    ctx.strokeStyle = nameCol;
    ctx.lineWidth = 2;
    ctx.strokeRect(contentX, cy, iconBox, iconBox);
    ctx.restore();
    this.deps.renderer.drawItemIcon(item.icon, contentX + iconBox / 2, cy + iconBox / 2 - s(6), s(isMobile ? 18 : 22));

    const headTextX = contentX + iconBox + pad;
    this.deps.renderer.drawText(item.name, headTextX, cy + s(2), {
      size: headSize, align: 'left', color: nameCol, maxWidth: panelW - (headTextX - px) - pad,
    });
    const slotStr = level > 1 ? `${slotLabel(item)}  ·  +${level - 1}` : slotLabel(item);
    this.deps.renderer.drawText(slotStr, headTextX, cy + headSize + s(6), {
      size: bodySize, align: 'left', color: '#c9b98f',
    });
    cy += headerH + s(6);

    if (segs.length > 0) {
      const statCols = isMobile ? 1 : 2;
      const colW = textW / statCols;
      for (let i = 0; i < segs.length; i++) {
        const col = i % statCols;
        const rowY = cy + Math.floor(i / statCols) * lineH;
        this.deps.renderer.drawText(segs[i].text, contentX + col * colW, rowY, {
          size: bodySize, align: 'left', color: segs[i].neg ? '#ff6b6b' : '#8ce99a',
        });
      }
      cy += Math.ceil(segs.length / statCols) * lineH + s(4);
    }

    if (descLineCount > 0) {
      this.deps.renderer.drawWrappedText(item.description, contentX, cy, {
        maxWidth: textW, size: bodySize, align: 'left', color: '#c8b998', maxLines: descLineCount,
      });
      cy += descLineCount * lineH + s(8);
    } else {
      cy += s(8);
    }

    const refund = ps.getSellValue(item);
    const btnGap = s(8);
    const btnW = (textW - btnGap) / 2;
    const unX = contentX;
    const sellX = contentX + btnW + btnGap;
    const btnY = py + panelH - pad - btnH;

    const drawBtn = (bx: number, label: string, face: string, border: string, textCol: string) => {
      ctx.save();
      ctx.fillStyle = face;
      ctx.fillRect(bx, btnY, btnW, btnH);
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, btnY, btnW, btnH);
      ctx.restore();
      this.deps.renderer.drawText(label, bx + btnW / 2, btnY + btnH / 2 - bodySize / 2, {
        size: bodySize, align: 'center', color: textCol,
      });
    };
    drawBtn(unX, 'UNEQUIP', '#2c3a4a', '#5a86b0', '#d6ecff');
    drawBtn(sellX, `SELL +${refund}g`, '#4a2a18', '#c8894c', '#ffe0c8');

    this.inspectUnequipRect = { x: unX, y: btnY, width: btnW, height: btnH };
    this.inspectSellRect = { x: sellX, y: btnY, width: btnW, height: btnH };
  }

  // ─── Stats popup ──────────────────────────────────────────────────────────

  private drawStatsPopup(): void {
    const ctx = this.deps.renderer.getContext();
    const canvas = this.deps.canvas;
    const zoom = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = canvas.width;
    const H = canvas.height;
    const isMobile = W / zoom < 800;
    const ps = this.deps.getPlayerStats();

    const num = (v: number) => formatShort(v);
    const pct = (v: number) => `${formatShort(Math.round(v * 100))}%`;
    const mult = (v: number) => (v >= 1000 ? `${formatShort(v)}x` : `${v.toFixed(2)}x`);
    const rate = (v: number, dp: number, suf: string) =>
      `${v >= 1000 ? formatShort(v) : v.toFixed(dp)}${suf}`;
    type Row = [string, string, boolean];
    const groups: Array<[string, string, Row[]]> = [
      ['OFFENSE', '#ffa94d', [
        ['Damage', num(ps.getDamage()), true],
        ['Fire Rate', rate(ps.getFireRate(), 2, '/s'), true],
        ['Multishot', `+${num(ps.getMultishot())}`, ps.getMultishot() > 0],
        ['Crit Chance', pct(ps.getCritChance()), true],
        ['Crit Damage', mult(ps.getCritMultiplier()), true],
        ['Piercing', num(ps.getPiercing()), ps.getPiercing() > 0],
        ['Knockback', num(ps.getKnockback()), ps.getKnockback() > 0],
        ['Projectile Speed', num(ps.getProjectileSpeed()), false],
        ['Melee Dmg', mult(ps.getMeleeDamageMult()), ps.getMeleeDamageMult() > 1.001],
        ['Ranged Dmg', mult(ps.getRangedDamageMult()), ps.getRangedDamageMult() > 1.001],
        ['Elemental Dmg', mult(ps.getElementalDamageMult()), ps.getElementalDamageMult() > 1.001],
      ]],
      ['DEFENSE', '#74c0fc', [
        ['Max Health', num(ps.getMaxHealth()), true],
        ['Armor', num(ps.getArmor()), ps.getArmor() > 0],
        ['Dodge', pct(ps.getDodgeChance()), ps.getDodgeChance() > 0],
        ['HP Regen', rate(ps.getHealthRegen(), 1, '/s'), ps.getHealthRegen() > 0],
        ['Shield', ps.hasShield() ? 'YES' : '-', ps.hasShield()],
        ['Lifesteal', pct(ps.getLifesteal()), ps.getLifesteal() > 0],
        ['Thorns', num(ps.getThorns()), ps.getThorns() > 0],
      ]],
      ['UTILITY', '#8ce99a', [
        ['Move Speed', num(ps.getSpeed()), true],
        ['XP Magnet', mult(ps.getXPMagnet()), ps.getXPMagnet() > 1.001],
      ]],
      ['ECONOMY', '#ffd43b', [
        ['Gold Bonus', pct(ps.getGoldBonus() - 1), ps.getGoldBonus() > 1.001],
        ['Luck', pct(ps.getLuck()), ps.getLuck() > 0],
        ['Shop Discount', pct(ps.getShopDiscount()), ps.getShopDiscount() > 0],
        ['Reroll Discount', pct(ps.getRerollDiscount()), ps.getRerollDiscount() > 0],
        ['Bank Interest', pct(ps.getInterestBonus()), ps.getInterestBonus() > 0],
      ]],
      ['SPECIAL', '#e599f7', [
        ['Chain Lightning', pct(ps.getChainLightningChance()), ps.getChainLightningChance() > 0],
        ['Freeze', pct(ps.getFreezeChance()), ps.getFreezeChance() > 0],
        ['Poison', ps.hasPoison() ? 'YES' : '-', ps.hasPoison()],
        ['Homing', ps.hasHoming() ? 'YES' : '-', ps.hasHoming()],
        ['Explode on Kill', ps.hasExplosionOnKill() ? 'YES' : '-', ps.hasExplosionOnKill()],
        ['Explode on Hit', ps.hasExplosionOnHit() ? 'YES' : '-', ps.hasExplosionOnHit()],
        ['Orbit Orbs', num(ps.getOrbitOrbCount()), ps.getOrbitOrbCount() > 0],
        ['Bomb Drop', ps.hasBombDrop() ? 'YES' : '-', ps.hasBombDrop()],
        ['Nova Pulse', ps.hasNova() ? 'YES' : '-', ps.hasNova()],
        ['Aux Melee', ps.hasAuxMelee() ? 'YES' : '-', ps.hasAuxMelee()],
      ]],
    ];

    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const contentW = Math.min(W - s(24), s(isMobile ? 372 : 620));
    const x0 = (W - contentW) / 2;
    drawPanel(ctx, x0 - s(8), s(10), contentW + s(16), H - s(20), DARK_WOOD_THEME, 4, 77);

    const headSize = s(isMobile ? 11 : 14);
    const bodySize = s(isMobile ? 7.5 : 9);
    const lineH = bodySize + s(6);
    let y = s(isMobile ? 20 : 28);
    this.deps.renderer.drawText('ALL STATS & BONUSES', W / 2, y, { size: headSize, align: 'center', color: '#ffd700' });
    y += headSize + s(5);
    this.deps.renderer.drawText('Tap anywhere to close', W / 2, y, { size: s(7), align: 'center', color: '#9a8a6a' });
    y += s(7) + s(10);

    const cols = isMobile ? 1 : 2;
    const colGap = s(16);
    const colW = (contentW - colGap * (cols - 1)) / cols;
    const yStart = y;
    const yBudget = H - s(30);
    let col = 0;
    let cy = yStart;
    const colX = (c: number) => x0 + c * (colW + colGap);

    const drawGroup = (title: string, color: string, rows: Row[]) => {
      const visible = rows.filter(([, , show]) => show);
      if (visible.length === 0) return;
      const blockH = lineH + visible.length * lineH + s(6);
      if (cy + blockH > yBudget && col < cols - 1) { col++; cy = yStart; }
      const cx = colX(col);
      this.deps.renderer.drawText(title, cx, cy, { size: bodySize, align: 'left', color });
      cy += lineH;
      for (const [label, value] of visible) {
        this.deps.renderer.drawText(label, cx + s(6), cy, { size: bodySize, align: 'left', color: '#c8b998' });
        this.deps.renderer.drawText(value, cx + colW - s(6), cy, { size: bodySize, align: 'right', color: '#ffffff' });
        cy += lineH;
      }
      cy += s(6);
    };

    for (const [title, color, rows] of groups) drawGroup(title, color, rows);
  }

  // ─── Combos overlay ───────────────────────────────────────────────────────

  private drawCombosOverlay(): void {
    const ctx = this.deps.renderer.getContext();
    const canvas = this.deps.canvas;
    const zoom = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;
    const s = (v: number) => Math.round(v * zoom);
    const W = canvas.width;
    const H = canvas.height;
    const isMobile = W / zoom < 800;

    const ps = this.deps.getPlayerStats();
    const active = ps.getActiveDuos();
    const potential = ps.getPotentialDuos();

    const wrap = (text: string, px: number, maxW: number): string[] =>
      this.deps.renderer.wrapLines(text, maxW, px);

    const pad = s(16);
    const contentW = Math.min(W - pad * 2, s(isMobile ? 360 : 560));
    const x0 = (W - contentW) / 2;
    let y = s(isMobile ? 20 : 30);
    const bodySize = s(isMobile ? 8 : 9);
    const headSize = s(isMobile ? 11 : 14);
    const lineH = bodySize + s(4);

    ctx.save();
    ctx.fillStyle = '#120b05';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawPanel(ctx, x0 - s(8), s(10), contentW + s(16), H - s(20), DARK_WOOD_THEME, 4, 77);

    this.deps.renderer.drawText('COMBOS GUIDE', W / 2, y, { size: headSize, align: 'center', color: '#ffd700' });
    y += headSize + s(6);
    this.deps.renderer.drawText('Tap anywhere to close', W / 2, y, { size: s(7), align: 'center', color: '#9a8a6a' });
    y += s(7) + s(12);

    this.deps.renderer.drawText('ACTIVE NOW', x0, y, { size: bodySize, align: 'left', color: '#8ce99a' });
    y += lineH;
    if (active.length === 0) {
      this.deps.renderer.drawText('None yet — pair items below to trigger one.', x0, y, {
        size: bodySize, align: 'left', color: '#c8b998', maxWidth: contentW
      });
      y += lineH;
    } else {
      for (const duo of active) {
        this.deps.renderer.drawItemIcon(duo.icon, x0, y - s(1), bodySize + s(2), 'left');
        this.deps.renderer.drawText(duo.name, x0 + bodySize + s(4), y, {
          size: bodySize, align: 'left', color: '#ffe066', maxWidth: contentW - bodySize - s(4)
        });
        y += lineH;
        for (const l of wrap(duo.specialEffect || duo.description, bodySize, contentW - s(10))) {
          this.deps.renderer.drawText(l, x0 + s(10), y, { size: bodySize, align: 'left', color: '#e5d9c3' });
          y += lineH;
        }
        y += s(3);
      }
    }
    y += s(8);

    this.deps.renderer.drawText('ONE ITEM AWAY', x0, y, { size: bodySize, align: 'left', color: '#74c0fc' });
    y += lineH;
    if (potential.length === 0) {
      this.deps.renderer.drawText('Buy items to start a combo pairing.', x0, y, {
        size: bodySize, align: 'left', color: '#c8b998', maxWidth: contentW
      });
      y += lineH;
    } else {
      const maxShown = isMobile ? 4 : 6;
      for (const { duo, owned, needed } of potential.slice(0, maxShown)) {
        this.deps.renderer.drawItemIcon(duo.icon, x0, y - s(1), bodySize + s(2), 'left');
        this.deps.renderer.drawText(duo.name, x0 + bodySize + s(4), y, {
          size: bodySize, align: 'left', color: '#74c0fc', maxWidth: contentW - bodySize - s(4)
        });
        y += lineH;
        const pairLine = `have ${owned?.name ?? '?'} + get ${needed?.name ?? '?'}`;
        for (const l of wrap(pairLine, bodySize, contentW - s(10))) {
          this.deps.renderer.drawText(l, x0 + s(10), y, { size: bodySize, align: 'left', color: '#a9c9ff' });
          y += lineH;
        }
        for (const l of wrap(`→ ${duo.specialEffect || duo.description}`, bodySize, contentW - s(10))) {
          this.deps.renderer.drawText(l, x0 + s(10), y, { size: bodySize, align: 'left', color: '#e5d9c3' });
          y += lineH;
        }
        y += s(3);
      }
      if (potential.length > maxShown) {
        this.deps.renderer.drawText(`+${potential.length - maxShown} more…`, x0 + s(10), y, {
          size: s(7), align: 'left', color: '#9a8a6a'
        });
        y += lineH;
      }
    }
    y += s(10);

    const legend: Array<[string, string]> = [
      ['#ffd43b', 'Gold border = completes a COMBO'],
      ['#7bd94a', 'Green border = fits your build (tag synergy)'],
      ['#4a9eff', 'Blue border = you already own it (stacks)'],
    ];
    this.deps.renderer.drawText('CARD BORDERS', x0, y, { size: bodySize, align: 'left', color: '#ffd43b' });
    y += lineH;
    for (const [color, text] of legend) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(x0, y, s(10), s(10));
      ctx.restore();
      this.deps.renderer.drawText(text, x0 + s(16), y, {
        size: bodySize, align: 'left', color: '#e5d9c3', maxWidth: contentW - s(16)
      });
      y += lineH;
    }
  }
}
