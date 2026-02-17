// ──────────────────────────────────────────────
// PolicyAuditService: Sprint 3 Risk Control facade
// Wires ApprovalEngine, ApprovalSLAMonitor,
// EMPHandler, and AuditLog into a single service.
// ──────────────────────────────────────────────

import {
  DEFAULT_POLICIES,
  type ApprovalRecord,
} from "@corpcraft/contracts";
import type { IEventBus } from "@corpcraft/event-bus";

import { ApprovalEngine } from "./approval-engine.js";
import { ApprovalSLAMonitor } from "./approval-sla.js";
import { EMPHandler } from "./emp-handler.js";
import { AuditLog, type AuditEntry, type ApprovalStats } from "./audit-log.js";

export class PolicyAuditService {
  private readonly engine: ApprovalEngine;
  private readonly slaMonitor: ApprovalSLAMonitor;
  private readonly empHandler: EMPHandler;
  private readonly auditLog: AuditLog;

  constructor(bus: IEventBus) {
    this.engine = new ApprovalEngine(bus, DEFAULT_POLICIES);
    this.slaMonitor = new ApprovalSLAMonitor(bus, this.engine);
    this.empHandler = new EMPHandler(bus);
    this.auditLog = new AuditLog(bus);
  }

  // ── Lifecycle ──────────────────────────────────

  init(): void {
    this.auditLog.init();
    this.engine.init();
    this.slaMonitor.init();
    this.empHandler.init();
  }

  shutdown(): void {
    this.slaMonitor.shutdown();
    this.empHandler.shutdown();
    this.engine.shutdown();
    this.auditLog.shutdown();
  }

  // ── Delegated public API ───────────────────────

  getPendingApprovals(): ApprovalRecord[] {
    return this.engine.getPending();
  }

  async decide(
    approvalId: string,
    decision: "APPROVE" | "REJECT",
    decidedBy: string,
    reason?: string,
  ): Promise<void> {
    await this.engine.decide(approvalId, decision, decidedBy, reason);
  }

  getAuditLog(taskId?: string): AuditEntry[] {
    return this.auditLog.getLog(taskId);
  }

  getApprovalStats(): ApprovalStats {
    return this.auditLog.getApprovalStats();
  }
}

// Re-export sub-modules for direct access if needed
export { ApprovalEngine } from "./approval-engine.js";
export { ApprovalSLAMonitor } from "./approval-sla.js";
export { EMPHandler } from "./emp-handler.js";
export { AuditLog } from "./audit-log.js";
export type { AuditEntry, ApprovalStats } from "./audit-log.js";
