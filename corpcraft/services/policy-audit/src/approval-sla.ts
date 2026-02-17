// ──────────────────────────────────────────────
// ApprovalSLAMonitor: SLA 超时 / 提醒 / 升级
// THREE TIERS:
//   FAST     (LOW risk)    – 5 min timeout, 3 min reminder  → DOWNGRADE_TO_DRAFT
//   STANDARD (MEDIUM risk) – 15 min timeout, 10 min reminder → DOWNGRADE_TO_DRAFT
//   CRITICAL (HIGH risk)   – 30 min timeout, 20 min reminder → ESCALATE → +30 min → AUTO_REJECT
// ──────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import type { ApprovalRecord, DowngradeSpec } from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus } from "@corpcraft/event-bus";
import type { ApprovalEngine } from "./approval-engine.js";

interface TimerSet {
  reminder: ReturnType<typeof setTimeout>;
  timeout: ReturnType<typeof setTimeout>;
  /** Second-phase timer for CRITICAL tier (ESCALATE → AUTO_REJECT) */
  secondPhase?: ReturnType<typeof setTimeout>;
}

export class ApprovalSLAMonitor {
  private readonly bus: IEventBus;
  private readonly engine: ApprovalEngine;
  private readonly timers = new Map<string, TimerSet>();
  private readonly processedIds = new Set<string>();

  constructor(bus: IEventBus, engine: ApprovalEngine) {
    this.bus = bus;
    this.engine = engine;
  }

  // ── Lifecycle ──────────────────────────────────

  init(): void {
    // Wire up: engine calls us when a new approval is created
    this.engine.onNewApproval = this.onNewApproval.bind(this);
  }

  shutdown(): void {
    for (const ts of this.timers.values()) {
      clearTimeout(ts.reminder);
      clearTimeout(ts.timeout);
      if (ts.secondPhase) clearTimeout(ts.secondPhase);
    }
    this.timers.clear();
  }

  // ── New approval handler ───────────────────────

  onNewApproval(record: ApprovalRecord): void {
    // Idempotency
    if (this.processedIds.has(record.approval_id)) return;
    this.processedIds.add(record.approval_id);

    const { sla, default_action_on_timeout } = record.policy;

    // ── Reminder timer ──
    const reminder = setTimeout(async () => {
      // Only fire if still pending
      const current = this.engine.getRecord(record.approval_id);
      if (!current || (current.status !== "PENDING" && current.status !== "REMINDED")) return;

      this.engine.updateRecord(record.approval_id, {
        status: "REMINDED",
        reminded_at: Date.now(),
      });

      await this.bus.publish(
        createSwarmEvent({
          event_id: randomUUID(),
          topic: "SOS_ERROR",
          intent: "approval.reminder",
          payload: {
            type: "APPROVAL_REMINDER",
            approval_id: record.approval_id,
            event_id: record.event_id,
            tier: record.policy.tier,
            message: `Approval ${record.approval_id} awaiting decision (${record.policy.tier} tier)`,
          },
          risk_level: record.policy.risk_level,
          parent_event_id: record.event_id,
        }),
      );
    }, sla.first_reminder_ms);

    // ── Timeout timer ──
    const timeout = setTimeout(async () => {
      const current = this.engine.getRecord(record.approval_id);
      if (!current || (current.status !== "PENDING" && current.status !== "REMINDED")) return;

      await this.handleTimeout(record, default_action_on_timeout);
    }, sla.timeout_ms);

    this.timers.set(record.approval_id, { reminder, timeout });

    // ── Queue congestion check ──
    this.checkCongestion();
  }

  // ── Timeout action dispatcher ──────────────────

  private async handleTimeout(
    record: ApprovalRecord,
    action: string,
  ): Promise<void> {
    switch (action) {
      case "DOWNGRADE_TO_DRAFT":
        await this.handleDowngrade(record);
        break;
      case "ESCALATE":
        await this.handleEscalation(record);
        break;
      case "AUTO_REJECT":
        await this.handleAutoReject(record);
        break;
    }
  }

  // ── DOWNGRADE_TO_DRAFT ─────────────────────────

  private async handleDowngrade(record: ApprovalRecord): Promise<void> {
    const downgradeSpec: DowngradeSpec = record.policy.sla.downgrade_spec ?? {
      strip_external_send: true,
      strip_shell_exec: true,
    };

    this.engine.updateRecord(record.approval_id, {
      status: "TIMEOUT_DOWNGRADED",
      decided_at: Date.now(),
      decided_by: "SLA_MONITOR",
      decision_reason: "Timeout – downgraded to draft mode",
    });

    // Auto-approve with downgrade spec
    await this.bus.publish(
      createSwarmEvent({
        event_id: randomUUID(),
        topic: "APPROVAL_DECISION",
        intent: "approval.timeout_downgrade",
        payload: {
          approval_id: record.approval_id,
          decision: "APPROVE",
          decided_by: "SLA_MONITOR",
          reason: "Timeout – downgraded to draft mode",
          original_event_id: record.event_id,
          downgrade_spec: downgradeSpec,
        },
        risk_level: record.policy.risk_level,
        parent_event_id: record.event_id,
      }),
    );
  }

  // ── ESCALATE (CRITICAL tier) ───────────────────

  private async handleEscalation(record: ApprovalRecord): Promise<void> {
    this.engine.updateRecord(record.approval_id, {
      status: "TIMEOUT_ESCALATED",
    });

    await this.bus.publish(
      createSwarmEvent({
        event_id: randomUUID(),
        topic: "SOS_ERROR",
        intent: "approval.escalation",
        payload: {
          type: "APPROVAL_ESCALATION",
          approval_id: record.approval_id,
          event_id: record.event_id,
          tier: record.policy.tier,
          escalation_target: record.policy.sla.escalation_target ?? "admin",
          message: `CRITICAL approval ${record.approval_id} escalated after timeout`,
        },
        risk_level: record.policy.risk_level,
        parent_event_id: record.event_id,
      }),
    );

    // Start second-phase timer: 30 more minutes → AUTO_REJECT
    const secondPhaseMs = record.policy.sla.timeout_ms; // same duration again
    const secondPhase = setTimeout(async () => {
      const current = this.engine.getRecord(record.approval_id);
      if (!current || current.status !== "TIMEOUT_ESCALATED") return;
      await this.handleAutoReject(record);
    }, secondPhaseMs);

    const timers = this.timers.get(record.approval_id);
    if (timers) {
      timers.secondPhase = secondPhase;
    }
  }

  // ── AUTO_REJECT ────────────────────────────────

  private async handleAutoReject(record: ApprovalRecord): Promise<void> {
    this.engine.updateRecord(record.approval_id, {
      status: "TIMEOUT_REJECTED",
      decided_at: Date.now(),
      decided_by: "SLA_MONITOR",
      decision_reason: "Timeout – auto-rejected",
    });

    await this.bus.publish(
      createSwarmEvent({
        event_id: randomUUID(),
        topic: "APPROVAL_DECISION",
        intent: "approval.timeout_reject",
        payload: {
          approval_id: record.approval_id,
          decision: "REJECT",
          decided_by: "SLA_MONITOR",
          reason: "Timeout – auto-rejected",
          original_event_id: record.event_id,
        },
        risk_level: record.policy.risk_level,
        parent_event_id: record.event_id,
      }),
    );
  }

  // ── Queue congestion ───────────────────────────

  private async checkCongestion(): Promise<void> {
    const pending = this.engine.getPending();
    if (pending.length > 10) {
      await this.bus.publish(
        createSwarmEvent({
          event_id: randomUUID(),
          topic: "SOS_ERROR",
          intent: "approval.queue_congestion",
          payload: {
            type: "QUEUE_CONGESTION",
            pending_count: pending.length,
            message: `Approval queue congested: ${pending.length} pending approvals`,
          },
          risk_level: "HIGH",
        }),
      );
    }
  }
}
