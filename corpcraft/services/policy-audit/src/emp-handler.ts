// ──────────────────────────────────────────────
// EMPHandler: Emergency Measures Protocol
// Handles APPROVAL_DECISION events where decision=REJECT.
// Terminates sandbox, revokes tokens, fails task,
// generates audit war report.
// ──────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import type { SwarmEvent } from "@corpcraft/contracts";
import { createSwarmEvent, createEvidencePack } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

export class EMPHandler {
  private readonly bus: IEventBus;
  private readonly processedEventIds = new Set<string>();

  private unsubscribe: Unsubscribe | null = null;

  constructor(bus: IEventBus) {
    this.bus = bus;
  }

  // ── Lifecycle ──────────────────────────────────

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      ["APPROVAL_DECISION"],
      this.handleDecision.bind(this),
    );
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  // ── Event handler ──────────────────────────────

  private async handleDecision(event: SwarmEvent): Promise<void> {
    // Idempotency guard
    if (this.processedEventIds.has(event.event_id)) return;
    this.processedEventIds.add(event.event_id);

    const payload = event.payload as Record<string, unknown>;
    if (payload.decision !== "REJECT") return;

    const approvalId = payload.approval_id as string;
    const originalEventId = payload.original_event_id as string;
    const reason = (payload.reason as string) ?? "Rejected by policy";

    // Step 1: Terminate sandbox (mock)
    this.terminateSandbox(originalEventId);

    // Step 2: Revoke tokens (mock)
    this.revokeTokens(originalEventId);

    // Step 3: Generate audit war report
    const warReport = createEvidencePack(
      randomUUID(),
      [
        {
          type: "LOG",
          note: `EMP triggered for approval ${approvalId}. ` +
            `Original event: ${originalEventId}. ` +
            `Reason: ${reason}. ` +
            `Actions taken: sandbox terminated, tokens revoked, task failed.`,
          created_at: Date.now(),
        },
      ],
      "policy-audit/emp-handler",
    );

    // Step 4: Publish TASK_FAILED event
    await this.bus.publish(
      createSwarmEvent({
        event_id: randomUUID(),
        topic: "TASK_FAILED",
        intent: "task.failed.emp",
        payload: {
          approval_id: approvalId,
          original_event_id: originalEventId,
          reason,
          war_report_pack_id: warReport.pack_id,
          war_report: warReport,
          emp_actions: [
            "SANDBOX_TERMINATED",
            "TOKENS_REVOKED",
            "TASK_FAILED",
          ],
        },
        risk_level: event.risk_level,
        status: "FAILED",
        parent_event_id: originalEventId,
      }),
    );
  }

  // ── Mock infrastructure actions ────────────────

  private terminateSandbox(eventId: string): void {
    // Mock: In production this would call the sandbox orchestrator
    // to destroy the container / VM associated with the agent.
    console.log(
      `[EMP] Sandbox terminated for event ${eventId}`,
    );
  }

  private revokeTokens(eventId: string): void {
    // Mock: In production this would call the token manager
    // to invalidate all API tokens issued to the agent.
    console.log(
      `[EMP] Tokens revoked for event ${eventId}`,
    );
  }
}
