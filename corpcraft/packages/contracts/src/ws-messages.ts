// ──────────────────────────────────────────────
// WebSocket Protocol Messages
// ──────────────────────────────────────────────

import type { AgentEntity, AutonomyLevel, Position3D } from "./entities";
import type { SwarmEvent } from "./events";
import type { HudState } from "./budget";
import type {
  SummonRequest,
  SummonResolution,
  ZoneJoinRequest,
  ZoneCollabSession,
  StatusReport,
} from "./summoning";

// ── Server → Client Messages ──

export interface SceneStateMsg {
  type: "SCENE_STATE";
  agents: AgentEntity[];
  timestamp: number;
}

export interface EventPushMsg {
  type: "EVENT_PUSH";
  event: SwarmEvent;
  seq: number;
  timestamp: number;
}

export type AnimationKind =
  | "WALK"
  | "FORGE"
  | "IDLE"
  | "ALERT"
  | "CELEBRATE";

export interface AnimationCmdMsg {
  type: "ANIMATION_CMD";
  agent_id: string;
  animation: AnimationKind;
  target_position?: Position3D;
  duration_ms?: number;
  timestamp: number;
}

export interface PipStreamReadyMsg {
  type: "PIP_STREAM_READY";
  agent_id: string;
  pip_url: string;
  timestamp: number;
}

export interface HudUpdateMsg {
  type: "HUD_UPDATE";
  hud: HudState;
  timestamp: number;
}

export interface MetricsSnapshotMsg {
  type: "METRICS_SNAPSHOT";
  metrics: Record<string, number>;
  timestamp: number;
}

export interface TeamStatusMsg {
  type: "TEAM_STATUS";
  teamName: string;
  members: Array<{
    name: string;
    status: "idle" | "working" | "done" | "error";
    currentTask?: string;
  }>;
  timestamp: number;
}

export type ExecutionModeValue = "mock" | "claude" | "team";

export interface ModeChangedMsg {
  type: "MODE_CHANGED";
  mode: ExecutionModeValue;
  timestamp: number;
}

// ── Agent Summoning & Collaboration Messages (Server → Client) ──

export interface SummonRequestMsg {
  type: "SUMMON_REQUEST";
  payload: SummonRequest;
  timestamp: number;
}

export interface SummonResolvedMsg {
  type: "SUMMON_RESOLVED";
  payload: SummonResolution;
  timestamp: number;
}

export interface ZoneJoinRequestMsg {
  type: "ZONE_JOIN_REQUEST";
  payload: ZoneJoinRequest;
  timestamp: number;
}

export interface CollabSessionUpdateMsg {
  type: "COLLAB_SESSION_UPDATE";
  payload: ZoneCollabSession;
  timestamp: number;
}

export interface AgentStatusReportMsg {
  type: "AGENT_STATUS_REPORT";
  payload: StatusReport;
  timestamp: number;
}

export type ServerMessage =
  | SceneStateMsg
  | EventPushMsg
  | AnimationCmdMsg
  | PipStreamReadyMsg
  | HudUpdateMsg
  | MetricsSnapshotMsg
  | TeamStatusMsg
  | ModeChangedMsg
  | SummonRequestMsg
  | SummonResolvedMsg
  | ZoneJoinRequestMsg
  | CollabSessionUpdateMsg
  | AgentStatusReportMsg;

// ── Client → Server Messages ──

export interface CreateIntentMsg {
  type: "CREATE_INTENT";
  intent: string;
  budget?: { max_tokens?: number; max_minutes?: number; max_cash?: number };
  risk_level?: "LOW" | "MEDIUM" | "HIGH";
  request_id: string;
}

export interface SubscribeEventsMsg {
  type: "SUBSCRIBE_EVENTS";
  topics?: string[];
}

export interface PingMsg {
  type: "PING";
  timestamp: number;
}

export interface PongMsg {
  type: "PONG";
  timestamp: number;
}

export interface ApprovalDecisionMsg {
  type: "APPROVAL_DECISION";
  event_id: string;
  decision: "APPROVE" | "REJECT";
  reason?: string;
}

export interface SetExecutionModeMsg {
  type: "SET_EXECUTION_MODE";
  mode: ExecutionModeValue;
}

// ── Agent Summoning & Collaboration Messages (Client → Server) ──

export interface SummonDecisionMsg {
  type: "SUMMON_DECISION";
  payload: SummonResolution;
}

export interface ZoneJoinDecisionMsg {
  type: "ZONE_JOIN_DECISION";
  payload: {
    request_id: string;
    approved: boolean;
    reason?: string;
  };
}

export interface SetAutonomyLevelMsg {
  type: "SET_AUTONOMY_LEVEL";
  payload: {
    agent_id: string;
    level: AutonomyLevel;
  };
}

export interface ForceJoinZoneMsg {
  type: "FORCE_JOIN_ZONE";
  payload: {
    agent_id: string;
    zone_id: string;
  };
}

export type ClientMessage =
  | CreateIntentMsg
  | SubscribeEventsMsg
  | PingMsg
  | ApprovalDecisionMsg
  | SetExecutionModeMsg
  | SummonDecisionMsg
  | ZoneJoinDecisionMsg
  | SetAutonomyLevelMsg
  | ForceJoinZoneMsg;
