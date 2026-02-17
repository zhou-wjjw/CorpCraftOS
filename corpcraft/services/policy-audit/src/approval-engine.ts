// ──────────────────────────────────────────────
// ApprovalEngine: 审批引擎 — subscribes to APPROVAL_REQUIRED,
// creates ApprovalRecords, manages decisions.
// ──────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import type {
  SwarmEvent,
  RiskLevel,
  ApprovalPolicy,
  ApprovalRecord,
} from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

export class ApprovalEngine {
  private readonly bus: IEventBus;
  private readonly policies: ApprovalPolicy[];
  private readonly pendingApprovals = new Map<string, ApprovalRecord>();
  private readonly processedEventIds = new Set<string>();

  private unsubscribe: Unsubscribe | null = null;

  /** Callback invoked when a new ApprovalRecord is created (used by SLA monitor) */
  onNewApproval: ((record: ApprovalRecord) => void) | null = null;

  constructor(bus: IEventBus, policies: ApprovalPolicy[]) {
    this.bus = bus;
    this.policies = policies;
  }

  // ── Lifecycle ──────────────────────────────────

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      ["APPROVAL_REQUIRED"],
      this.handleApprovalRequired.bind(this),
    );
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  // ── Event handler ──────────────────────────────

  private async handleApprovalRequired(event: SwarmEvent): Promise<void> {
    // Idempotency guard
    if (this.processedEventIds.has(event.event_id)) return;
    this.processedEventIds.add(event.event_id);

    const policy = this.matchPolicy(event.risk_level);
    const record: ApprovalRecord = {
      approval_id: randomUUID(),
      event_id: event.event_id,
      policy,
      status: "PENDING",
      requested_at: Date.now(),
    };

    this.pendingApprovals.set(record.approval_id, record);
    this.onNewApproval?.(record);
  }

  // ── Public API ─────────────────────────────────

  /**
   * Record a human decision on a pending approval.
   * Publishes APPROVAL_DECISION event onto the bus.
   */
  async decide(
    approvalId: string,
    decision: "APPROVE" | "REJECT",
    decidedBy: string,
    reason?: string,
  ): Promise<void> {
    const record = this.pendingApprovals.get(approvalId);
    if (!record) return;

    record.status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    record.decided_at = Date.now();
    record.decided_by = decidedBy;
    record.decision_reason = reason;

    await this.bus.publish(
      createSwarmEvent({
        event_id: randomUUID(),
        topic: "APPROVAL_DECISION",
        intent: `approval.${decision.toLowerCase()}`,
        payload: {
          approval_id: approvalId,
          decision,
          decided_by: decidedBy,
          reason,
          original_event_id: record.event_id,
        },
        risk_level: record.policy.risk_level,
        parent_event_id: record.event_id,
      }),
    );
  }

  /**
   * Forcefully update a record (used by SLA monitor for timeout actions).
   */
  updateRecord(approvalId: string, patch: Partial<ApprovalRecord>): void {
    const record = this.pendingApprovals.get(approvalId);
    if (!record) return;
    Object.assign(record, patch);
  }

  getPending(): ApprovalRecord[] {
    return [...this.pendingApprovals.values()].filter(
      (r) => r.status === "PENDING" || r.status === "REMINDED",
    );
  }

  getRecord(approvalId: string): ApprovalRecord | null {
    return this.pendingApprovals.get(approvalId) ?? null;
  }

  getAllRecords(): ApprovalRecord[] {
    return [...this.pendingApprovals.values()];
  }

  // ── Internal helpers ───────────────────────────

  private matchPolicy(riskLevel: RiskLevel): ApprovalPolicy {
    const matched = this.policies.find((p) => p.risk_level === riskLevel);
    if (matched) return matched;
    // Fallback to the most restrictive policy
    return this.policies[this.policies.length - 1];
  }
}
