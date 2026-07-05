// Save system using LocalStorage

export interface SaveData {
  // Run state
  wave: number;
  xp: number;
  level: number;
  gold: number;
  health: number;
  items: string[]; // Item IDs
  artifactIds: string[]; // Held artifact IDs (map-granted run modifiers)
  actMap: any; // Serialized node-map (branching act graph + current position)
  skillTree?: { availablePoints: number; totalEarned: number; ranks: Record<string, number> }; // per-run skill-tree state

  // Meta progression
  unlockedItems: string[];
  highestWave: number;
  totalRuns: number;
  totalKills: number;
}

export class SaveManager {
  private static SAVE_KEY = 'roguelite_save';
  private static RUN_KEY = 'roguelite_current_run';

  // Save current run state
  static saveRun(data: Partial<SaveData>): void {
    try {
      const existing = this.loadRun();
      const merged = { ...existing, ...data };
      localStorage.setItem(this.RUN_KEY, JSON.stringify(merged));
    } catch (e) {
      console.error('Failed to save run:', e);
    }
  }

  // Load current run state
  static loadRun(): Partial<SaveData> {
    try {
      const data = localStorage.getItem(this.RUN_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load run:', e);
    }
    return {};
  }

  // Clear current run
  static clearRun(): void {
    try {
      localStorage.removeItem(this.RUN_KEY);
    } catch (e) {
      console.error('Failed to clear run:', e);
    }
  }

  // Save meta progression
  static saveMeta(data: Partial<SaveData>): void {
    try {
      const existing = this.loadMeta();
      const merged = { ...existing, ...data };
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.error('Failed to save meta:', e);
    }
  }

  // Load meta progression
  static loadMeta(): Partial<SaveData> {
    try {
      const data = localStorage.getItem(this.SAVE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load meta:', e);
    }
    return {
      unlockedItems: [],
      highestWave: 0,
      totalRuns: 0,
      totalKills: 0
    };
  }

  // Update meta stats after run
  static updateMetaAfterRun(wave: number, kills: number): void {
    const meta = this.loadMeta();

    this.saveMeta({
      highestWave: Math.max(meta.highestWave ?? 0, wave),
      totalRuns: (meta.totalRuns ?? 0) + 1,
      totalKills: (meta.totalKills ?? 0) + kills
    });
  }

  // Check if has saved run
  static hasSavedRun(): boolean {
    return localStorage.getItem(this.RUN_KEY) !== null;
  }

  // Get stats summary
  static getStats(): { highestWave: number; totalRuns: number; totalKills: number } {
    const meta = this.loadMeta();
    return {
      highestWave: meta.highestWave ?? 0,
      totalRuns: meta.totalRuns ?? 0,
      totalKills: meta.totalKills ?? 0
    };
  }
}
