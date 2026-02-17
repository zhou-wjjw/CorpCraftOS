// ──────────────────────────────────────────────
// HUD: HP / MP / AP 生命线
// ──────────────────────────────────────────────

export interface ResourceBar {
  current: number;
  max: number;
  /** Per-hour rate: positive = regeneration, negative = burn */
  rate: number;
}

export interface HudState {
  /** HP: 现金流/粮草 */
  hp: ResourceBar;
  /** MP: 算力/Token/自动化额度 */
  mp: ResourceBar;
  /** AP: 士气/负荷 (人类精力槽) */
  ap: ResourceBar;
  /** Last update timestamp */
  updated_at: number;
}

export function createDefaultHud(): HudState {
  return {
    hp: { current: 10000, max: 10000, rate: 0 },
    mp: { current: 5000, max: 5000, rate: -100 },
    ap: { current: 100, max: 100, rate: 5 },
    updated_at: Date.now(),
  };
}
