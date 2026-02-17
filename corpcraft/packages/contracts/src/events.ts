// ──────────────────────────────────────────────
// SwarmEvent: 事件黑板的唯一真相源
// ──────────────────────────────────────────────

export const EVENT_TOPICS = [
  "TASK_POSTED",
  "TASK_DECOMPOSED",
  "TASK_ANALYZED",
  "TASK_CLAIMED",
  "TASK_PROGRESS",
  "ARTIFACT_READY",
  "EVIDENCE_READY",
  "INTEL_READY",
  "APPROVAL_REQUIRED",
  "APPROVAL_DECISION",
  "SOS_ERROR",
  "TASK_FAILED",
  "TASK_RETRY_SCHEDULED",
  "TASK_CLOSED",
  "COMPACTION_TICK",
  "ASSET_UPDATED",
  "SKILL_QUARANTINED",
  "HUD_SYNC",
  // Agent Summoning & Collaboration
  "AGENT_SUMMON_REQUEST",
  "AGENT_SUMMON_RESOLVED",
  "AGENT_STATUS_REPORT",
  "ZONE_JOIN_REQUEST",
  "ZONE_JOIN_RESOLVED",
  "ZONE_COLLAB_SYNC",
] as const;

export type EventTopic = (typeof EVENT_TOPICS)[number];

export type EventStatus =
  | "OPEN"
  | "CLAIMED"
  | "RESOLVING"
  | "BLOCKED"
  | "FAILED"
  | "CLOSED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Budget {
  max_tokens?: number;
  max_minutes?: number;
  max_cash?: number;
}

export interface CostDelta {
  tokens_used: number;
  minutes_used: number;
  cash_used: number;
}

export interface SwarmEvent {
  event_id: string;
  topic: EventTopic;
  intent: string;
  payload: Record<string, unknown>;

  required_tags: string[];
  risk_level: RiskLevel;
  budget: Budget;

  status: EventStatus;
  claimed_by?: string;
  parent_event_id?: string;

  idempotency_key?: string;
  cost_delta?: CostDelta;

  created_at: number;
  updated_at: number;
}

/** Helper to create a new SwarmEvent with sensible defaults */
export function createSwarmEvent(
  partial: Pick<SwarmEvent, "event_id" | "topic" | "intent"> &
    Partial<SwarmEvent>,
): SwarmEvent {
  const now = Date.now();
  return {
    payload: {},
    required_tags: [],
    risk_level: "LOW",
    budget: {},
    status: "OPEN",
    created_at: now,
    updated_at: now,
    ...partial,
  };
}
