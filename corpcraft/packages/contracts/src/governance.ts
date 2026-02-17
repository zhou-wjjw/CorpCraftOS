// ──────────────────────────────────────────────
// Governance / Approval SLA 契约 (V2 新增)
// ──────────────────────────────────────────────

import type { RiskLevel } from "./events";

export type ApprovalTier = "FAST" | "STANDARD" | "CRITICAL";

export type ApprovalTimeoutAction =
  | "DOWNGRADE_TO_DRAFT"
  | "AUTO_REJECT"
  | "ESCALATE";

export interface DowngradeSpec {
  strip_external_send: boolean;
  strip_shell_exec: boolean;
  max_tokens_override?: number;
}

export interface ApprovalSLA {
  timeout_ms: number;
  first_reminder_ms: number;
  escalation_target?: string;
  downgrade_spec?: DowngradeSpec;
}

export interface ApprovalPolicy {
  policy_id: string;
  risk_level: RiskLevel;
  tier: ApprovalTier;
  sla: ApprovalSLA;
  default_action_on_timeout: ApprovalTimeoutAction;
}

export interface EscalationRule {
  from_tier: ApprovalTier;
  to_tier: ApprovalTier;
  after_ms: number;
  notify: string[];
}

export type ApprovalStatus =
  | "PENDING"
  | "REMINDED"
  | "APPROVED"
  | "REJECTED"
  | "TIMEOUT_DOWNGRADED"
  | "TIMEOUT_ESCALATED"
  | "TIMEOUT_REJECTED";

export interface ApprovalRecord {
  approval_id: string;
  event_id: string;
  policy: ApprovalPolicy;
  status: ApprovalStatus;
  requested_at: number;
  reminded_at?: number;
  decided_at?: number;
  decided_by?: string;
  decision_reason?: string;
}

// ── Pre-defined policy table ──
// | risk_level | tier     | timeout | reminder | default_action     |
// |------------|----------|---------|----------|--------------------|
// | LOW        | FAST     | 5min    | 3min     | DOWNGRADE_TO_DRAFT |
// | MEDIUM     | STANDARD | 15min   | 10min    | DOWNGRADE_TO_DRAFT |
// | HIGH       | CRITICAL | 30min   | 20min    | ESCALATE           |

export const DEFAULT_POLICIES: ApprovalPolicy[] = [
  {
    policy_id: "pol-low",
    risk_level: "LOW",
    tier: "FAST",
    sla: {
      timeout_ms: 5 * 60_000,
      first_reminder_ms: 3 * 60_000,
      downgrade_spec: {
        strip_external_send: true,
        strip_shell_exec: false,
      },
    },
    default_action_on_timeout: "DOWNGRADE_TO_DRAFT",
  },
  {
    policy_id: "pol-medium",
    risk_level: "MEDIUM",
    tier: "STANDARD",
    sla: {
      timeout_ms: 15 * 60_000,
      first_reminder_ms: 10 * 60_000,
      downgrade_spec: {
        strip_external_send: true,
        strip_shell_exec: true,
      },
    },
    default_action_on_timeout: "DOWNGRADE_TO_DRAFT",
  },
  {
    policy_id: "pol-high",
    risk_level: "HIGH",
    tier: "CRITICAL",
    sla: {
      timeout_ms: 30 * 60_000,
      first_reminder_ms: 20 * 60_000,
      escalation_target: "admin",
    },
    default_action_on_timeout: "ESCALATE",
  },
];
