// ──────────────────────────────────────────────
// GenWar Simulation 契约 (V2 预埋 — Sprint 5+ 实现)
// ──────────────────────────────────────────────

export interface SimScenario {
  scenario_id: string;
  name: string;
  base_snapshot: {
    agents: string[];
    resources: { hp: number; mp: number; ap: number };
    intel_reports: string[];
    active_tasks: string[];
  };
  variables: SimVariable[];
  created_at: number;
}

export type SimVariableType = "NUMERIC" | "ENUM" | "BOOLEAN";

export interface SimVariable {
  name: string;
  type: SimVariableType;
  range?: [number, number];
  options?: string[];
  default_value: unknown;
}

export type SimOutcome = "WIN" | "LOSS" | "DRAW";

export interface SimResult {
  result_id: string;
  scenario_id: string;
  iterations: number;
  metrics: {
    win_rate: number;
    expected_cost: { tokens: number; cash: number; minutes: number };
    risk_score: number;
    confidence_interval: [number, number];
  };
  recommendations: string[];
  detailed_runs?: SimRunSummary[];
  created_at: number;
}

export interface SimRunSummary {
  run_index: number;
  outcome: SimOutcome;
  key_events: string[];
  resource_delta: { hp: number; mp: number; ap: number };
}
