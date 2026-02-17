// ──────────────────────────────────────────────
// WebSocket Client Message Handlers
// Wired: PolicyAuditService for APPROVAL_DECISION
// ──────────────────────────────────────────────

import type {
  ClientMessage,
  ServerMessage,
  PongMsg,
  EventPushMsg,
  ModeChangedMsg,
  SummonRequestMsg,
  SummonResolvedMsg,
  ZoneJoinRequestMsg,
  CollabSessionUpdateMsg,
  AgentStatusReportMsg,
} from "@corpcraft/contracts";
import type { SwarmEngine } from "@corpcraft/swarm-engine";
import type { PolicyAuditService } from "@corpcraft/policy-audit";

/** Any message that can be sent back to a single client */
export type OutboundMessage = ServerMessage | PongMsg;

/** Dependencies injected into the handler */
export interface HandlerDeps {
  engine: SwarmEngine;
  policyAudit: PolicyAuditService;
  /** Broadcast a message to ALL connected clients */
  broadcast?: (msg: ServerMessage) => void;
}

/**
 * Parse and handle a single incoming WebSocket message.
 * Responses are sent via the `send` callback.
 */
export async function handleClientMessage(
  raw: string,
  deps: HandlerDeps,
  send: (msg: OutboundMessage) => void,
): Promise<void> {
  let msg: ClientMessage;

  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    console.error("[WS] Invalid JSON received:", raw.slice(0, 200));
    return;
  }

  if (!msg || typeof msg.type !== "string") {
    console.error("[WS] Message missing 'type' field");
    return;
  }

  switch (msg.type) {
    case "CREATE_INTENT": {
      const event = await deps.engine.router.routeIntent(msg.intent, {
        budget: msg.budget,
        risk_level: msg.risk_level,
      });
      const push: EventPushMsg = {
        type: "EVENT_PUSH",
        event,
        seq: 0,
        timestamp: Date.now(),
      };
      send(push);
      return;
    }

    case "SUBSCRIBE_EVENTS": {
      console.log("[WS] Client subscribed to topics:", msg.topics ?? "ALL");
      return;
    }

    case "PING": {
      const pong: PongMsg = {
        type: "PONG",
        timestamp: Date.now(),
      };
      send(pong);
      return;
    }

    case "APPROVAL_DECISION": {
      // Find the approval record by event_id and decide
      const pending = deps.policyAudit.getPendingApprovals();
      const record = pending.find((r) => r.event_id === msg.event_id);
      if (record) {
        await deps.policyAudit.decide(
          record.approval_id,
          msg.decision,
          "ws-client",
          msg.reason,
        );
        console.log(
          `[WS] Approval ${msg.decision} for event=${msg.event_id} (approval=${record.approval_id})`,
        );
      } else {
        console.warn(
          `[WS] No pending approval found for event_id=${msg.event_id}`,
        );
      }
      return;
    }

    case "SET_EXECUTION_MODE": {
      deps.engine.setExecutionMode(msg.mode);
      console.log(`[WS] Execution mode set to: ${msg.mode}`);
      if (deps.broadcast) {
        const modeMsg: ModeChangedMsg = {
          type: "MODE_CHANGED",
          mode: msg.mode,
          timestamp: Date.now(),
        };
        deps.broadcast(modeMsg);
      }
      return;
    }

    // ── Agent Summoning & Collaboration Messages ──

    case "SUMMON_DECISION": {
      const { payload } = msg;
      if (deps.engine.summoner) {
        await deps.engine.summoner.resolveRequest(payload);
        console.log(
          `[WS] Summon decision: ${payload.decision} for request ${payload.request_id}`,
        );
        if (deps.broadcast) {
          const resolved: SummonResolvedMsg = {
            type: "SUMMON_RESOLVED",
            payload,
            timestamp: Date.now(),
          };
          deps.broadcast(resolved);
        }
      }
      return;
    }

    case "ZONE_JOIN_DECISION": {
      const { payload } = msg;
      console.log(
        `[WS] Zone join decision: ${payload.approved ? "approved" : "rejected"} for request ${payload.request_id}`,
      );
      // The CollabProtocol listens for ZONE_JOIN_RESOLVED events on the bus
      return;
    }

    case "SET_AUTONOMY_LEVEL": {
      const { payload } = msg;
      const agent = deps.engine.matcherRegistry.get(payload.agent_id);
      if (agent) {
        agent.autonomy_level = payload.level;
        console.log(
          `[WS] Autonomy level set: agent ${payload.agent_id} → level ${payload.level}`,
        );
      }
      return;
    }

    case "FORCE_JOIN_ZONE": {
      const { payload } = msg;
      console.log(
        `[WS] Force join: agent ${payload.agent_id} → zone ${payload.zone_id}`,
      );
      // The CollabProtocol handles the join flow with trigger="USER"
      return;
    }

    default: {
      console.warn(
        "[WS] Unknown message type:",
        (msg as Record<string, unknown>).type,
      );
      return;
    }
  }
}
