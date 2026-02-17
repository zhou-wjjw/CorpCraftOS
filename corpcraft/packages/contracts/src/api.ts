// ──────────────────────────────────────────────
// REST API Request / Response Types
// ──────────────────────────────────────────────

import type { SwarmEvent, RiskLevel, Budget } from "./events";
import type { AgentEntity } from "./entities";
import type { SkillManifest } from "./skills";

// ── Intents ──

export interface CreateIntentRequest {
  intent: string;
  budget?: Budget;
  risk_level?: RiskLevel;
  tags?: string[];
}

export interface CreateIntentResponse {
  event: SwarmEvent;
}

// ── Events ──

export interface EventQueryParams {
  status?: string;
  topic?: string;
  limit?: number;
  offset?: number;
}

export interface ClaimRequest {
  agent_id: string;
  lease_ms?: number;
}

export interface ClaimResponse {
  ok: boolean;
  lease_expiry?: number;
  reason?: string;
}

export interface HeartbeatResponse {
  ok: boolean;
  renewed_until?: number;
}

export interface CompleteRequest {
  agent_id: string;
  artifacts?: Array<{ name: string; uri: string; sha256?: string }>;
  evidence_pack_id?: string;
  cost_delta?: { tokens_used: number; minutes_used: number; cash_used: number };
}

// ── Approvals ──

export interface ApprovalRequest {
  event_id: string;
  reason: string;
  risk_level: RiskLevel;
}

export interface ApprovalDecisionRequest {
  decision: "APPROVE" | "REJECT";
  reason?: string;
}

// ── Assets ──

export interface EquipSkillsRequest {
  skill_ids: Array<{ id: string; version: string }>;
}

// ── Agents ──

export interface AgentListResponse {
  agents: AgentEntity[];
}

export interface SkillListResponse {
  skills: SkillManifest[];
}

// ── Execution Mode ──

import type { ExecutionModeValue } from "./ws-messages";

export interface ExecutionModeResponse {
  mode: ExecutionModeValue;
}

export interface SetExecutionModeRequest {
  mode: ExecutionModeValue;
}

// ── Simulation (占位, Sprint 4+) ──

export interface NotImplementedResponse {
  error: "NOT_IMPLEMENTED";
  message: string;
  target_sprint: number;
}
