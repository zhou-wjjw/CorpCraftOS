// ──────────────────────────────────────────────
// Observability / Metrics 契约 (V2 新增)
// ──────────────────────────────────────────────

export type FailureCategory =
  | "TRANSIENT"
  | "TOOLING"
  | "MODEL"
  | "POLICY"
  | "MALICE";

export interface SwarmMetrics {
  timestamp: number;

  // Queue health
  queue_depth: number;
  claim_conflict_rate_1m: number;
  retry_storm_detected: boolean;

  // Task throughput
  tasks_completed_1h: number;
  tasks_failed_1h: number;
  avg_task_duration_ms: number;

  // Approval latency
  approval_pending_count: number;
  approval_p50_ms: number;
  approval_p95_ms: number;

  // Resource consumption
  total_tokens_1h: number;
  total_cost_1h: number;

  // Failure breakdown
  failure_breakdown: Record<FailureCategory, number>;
}

export interface HealthCheck {
  service: string;
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  last_check_at: number;
  details?: string;
}

export function createEmptyMetrics(): SwarmMetrics {
  return {
    timestamp: Date.now(),
    queue_depth: 0,
    claim_conflict_rate_1m: 0,
    retry_storm_detected: false,
    tasks_completed_1h: 0,
    tasks_failed_1h: 0,
    avg_task_duration_ms: 0,
    approval_pending_count: 0,
    approval_p50_ms: 0,
    approval_p95_ms: 0,
    total_tokens_1h: 0,
    total_cost_1h: 0,
    failure_breakdown: {
      TRANSIENT: 0,
      TOOLING: 0,
      MODEL: 0,
      POLICY: 0,
      MALICE: 0,
    },
  };
}
