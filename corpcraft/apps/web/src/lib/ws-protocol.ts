// ──────────────────────────────────────────────
// WS Protocol Helpers — Typed message constructors
// ──────────────────────────────────────────────

import type {
  CreateIntentMsg,
  PingMsg,
  ApprovalDecisionMsg,
  SetExecutionModeMsg,
  ExecutionModeValue,
} from "@corpcraft/contracts";

/**
 * Build a CREATE_INTENT message for the WS server.
 */
export function createIntentMessage(
  intent: string,
  requestId: string,
  budget?: { max_tokens?: number; max_minutes?: number; max_cash?: number },
  risk_level?: "LOW" | "MEDIUM" | "HIGH",
): CreateIntentMsg {
  return {
    type: "CREATE_INTENT",
    intent,
    request_id: requestId,
    ...(budget ? { budget } : {}),
    ...(risk_level ? { risk_level } : {}),
  };
}

/**
 * Build a PING message for keep-alive.
 */
export function createPingMessage(): PingMsg {
  return {
    type: "PING",
    timestamp: Date.now(),
  };
}

/**
 * Build an APPROVAL_DECISION message.
 */
export function createApprovalDecision(
  eventId: string,
  decision: "APPROVE" | "REJECT",
): ApprovalDecisionMsg {
  return {
    type: "APPROVAL_DECISION",
    event_id: eventId,
    decision,
  };
}

/**
 * Build a SET_EXECUTION_MODE message to change the gateway execution mode.
 */
export function createSetExecutionMode(
  mode: ExecutionModeValue,
): SetExecutionModeMsg {
  return {
    type: "SET_EXECUTION_MODE",
    mode,
  };
}
