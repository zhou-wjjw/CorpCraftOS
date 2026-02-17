// ──────────────────────────────────────────────
// Summoning & Collaboration Contracts
//
// Types shared between swarm-engine, autonomy-engine,
// gateway, and the frontend.
// ──────────────────────────────────────────────

// ── Agent Summoning ──

export type SummonReason =
  | "SKILL_GAP"
  | "OVERLOAD"
  | "DECOMPOSITION"
  | "EXPLICIT";

export type SummonUrgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SummonRequest {
  request_id: string;
  requesting_agent_id: string;
  requesting_agent_name: string;
  reason: SummonReason;
  required_tags: string[];
  urgency: SummonUrgency;
  target_zone_id: string;
  /** Description of what the agent is working on */
  context: string;
  /** Template to use if a new agent must be recruited */
  suggested_template?: string;
  /** Optional task description for the summoned agent.
   *  Seeded into SharedWorkPlan but subject to CollabProtocol negotiation. */
  suggested_task?: string;
  /** Milliseconds before auto-resolution (default: 30000) */
  approval_timeout_ms: number;
  /** Timestamp when the request was created */
  created_at: number;
}

export type SummonDecision =
  | "APPROVED"
  | "REJECTED"
  | "AUTO_APPROVED"
  | "QUEUED";

export type SummonDecider = "USER" | "SYSTEM" | "AGENT";

export interface SummonResolution {
  request_id: string;
  decision: SummonDecision;
  decided_by: SummonDecider;
  /** ID of the agent that was spawned or reused */
  spawned_agent_id?: string;
  reason?: string;
}

// ── Zone Collaboration ──

export type CollabRole = "LEAD" | "CONTRIBUTOR" | "OBSERVER";

export type JoinStatus =
  | "PENDING_USER"
  | "PENDING_AGENTS"
  | "ACTIVE"
  | "REJECTED";

export type JoinTrigger = "USER" | "AGENT" | "SUMMON";

export interface CollabMember {
  agent_id: string;
  agent_name: string;
  role: CollabRole;
  join_status: JoinStatus;
  capabilities: string[];
  joined_at?: number;
}

export type PlannedTaskStatus = "PLANNED" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export type TaskSource = "USER" | "AGENT" | "SYSTEM";

export interface PlannedTask {
  task_id: string;
  intent: string;
  /** 1 (highest) to 10 (lowest) */
  priority: number;
  estimated_minutes: number;
  assigned_to?: string;
  status: PlannedTaskStatus;
  source: TaskSource;
}

export interface SharedWorkPlan {
  tasks: PlannedTask[];
  /** task_id -> agent_id */
  assignments: Record<string, string>;
  /** [prerequisite_task_id, dependent_task_id] */
  dependencies: [string, string][];
  estimated_completion: number;
}

export interface ZoneCollabSession {
  session_id: string;
  zone_id: string;
  members: CollabMember[];
  work_plan: SharedWorkPlan;
  created_at: number;
  updated_at: number;
}

export interface ZoneJoinRequest {
  request_id: string;
  agent_id: string;
  agent_name: string;
  zone_id: string;
  trigger: JoinTrigger;
  /** Milliseconds before fallback resolution */
  timeout_ms: number;
  created_at: number;
}

export interface ZoneJoinResolution {
  request_id: string;
  approved: boolean;
  decided_by: SummonDecider;
  reason?: string;
}

// ── Agent Work Planning ──

export type BlockerType =
  | "WAITING_APPROVAL"
  | "WAITING_AGENT"
  | "SKILL_MISSING"
  | "RESOURCE_LIMIT";

export interface Blocker {
  blocker_id: string;
  description: string;
  blocked_task_id: string;
  type: BlockerType;
  since: number;
}

export interface TaskSummary {
  event_id: string;
  intent: string;
  priority_score: number;
  source: TaskSource;
  estimated_minutes: number;
  progress_pct: number;
  dependencies: string[];
}

// ── Context Snapshot Stack (Anti-Amnesia Memory) ──

export interface StackedTaskSnapshot {
  task: TaskSummary;
  interrupted_at: number;
  /** Markdown summary of the work-in-progress at the moment of interruption.
   *  Compiled from recent TASK_PROGRESS events (thinking + tool_use + text).
   *  Injected as system prompt prefix when the task is resumed. */
  context_snapshot: string;
}

export interface AgentWorkState {
  agent_id: string;
  current_task: TaskSummary | null;
  /** Stack of interrupted tasks with their context snapshots.
   *  Push on force-interrupt, pop on task completion to resume. */
  task_stack: StackedTaskSnapshot[];
  pending_queue: TaskSummary[];
  completed_count: number;
  blockers: Blocker[];
  last_report_at: number;
}

export interface StatusReport {
  agent_id: string;
  agent_name: string;
  current_task: {
    intent: string;
    progress_pct: number;
    eta_minutes: number;
  } | null;
  pending_count: number;
  top_pending: Array<{
    intent: string;
    priority: number;
    estimated_minutes: number;
  }>;
  blockers: Blocker[];
  total_completed_today: number;
  next_available_at: number;
}

// ── Collaboration Messages (structured inter-agent) ──

export type CollabMessageType =
  | "CAPABILITY_ANNOUNCE"
  | "WORK_PLAN_PROPOSE"
  | "TASK_CLAIM_INTENT"
  | "TASK_HANDOFF"
  | "STATUS_UPDATE"
  | "HELP_REQUEST"
  | "PRIORITY_OVERRIDE";

export interface CollabMessage {
  type: CollabMessageType;
  zone_id: string;
  from_agent_id: string;
  payload: Record<string, unknown>;
  timestamp: number;
}
