// ──────────────────────────────────────────────
// AuditLog: Append-only event log for forensics,
// replay, and approval metrics.
// ──────────────────────────────────────────────

import type { SwarmEvent, FailureCategory } from "@corpcraft/contracts";
import { EVENT_TOPICS } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

export interface AuditEntry {
  event: SwarmEvent;
  recorded_at: number;
}

export interface ApprovalStats {
  pending: number;
  p50_ms: number;
  p95_ms: number;
}

export class AuditLog {
  private readonly bus: IEventBus;
  private readonly entries: AuditEntry[] = [];
  private readonly processedEventIds = new Set<string>();

  private unsubscribe: Unsubscribe | null = null;

  constructor(bus: IEventBus) {
    this.bus = bus;
  }

  // ── Lifecycle ──────────────────────────────────

  init(): void {
    // Subscribe to ALL event topics
    this.unsubscribe = this.bus.subscribe(
      [...EVENT_TOPICS],
      this.handleEvent.bind(this),
    );
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  // ── Event handler ──────────────────────────────

  private async handleEvent(event: SwarmEvent): Promise<void> {
    // Idempotency guard
    if (this.processedEventIds.has(event.event_id)) return;
    this.processedEventIds.add(event.event_id);

    this.entries.push({
      event,
      recorded_at: Date.now(),
    });
  }

  // ── Public API ─────────────────────────────────

  /**
   * Get full log, optionally filtered to events in a task's parent chain.
   */
  getLog(taskId?: string): AuditEntry[] {
    if (!taskId) return [...this.entries];

    // Collect all event IDs that belong to this task tree
    const taskEventIds = this.collectTaskTree(taskId);
    return this.entries.filter((e) => taskEventIds.has(e.event.event_id));
  }

  /**
   * Replay events for a task and all sub-tasks in chronological order.
   */
  replay(taskId: string): AuditEntry[] {
    const taskEventIds = this.collectTaskTree(taskId);
    return this.entries
      .filter((e) => taskEventIds.has(e.event.event_id))
      .sort((a, b) => a.event.created_at - b.event.created_at);
  }

  /**
   * Filter entries by failure category in their payload.
   */
  getByFailureCategory(category: FailureCategory): AuditEntry[] {
    return this.entries.filter((e) => {
      const payload = e.event.payload as Record<string, unknown>;
      return payload.failure_category === category;
    });
  }

  /**
   * Compute approval latency stats from APPROVAL_DECISION events.
   */
  getApprovalStats(): ApprovalStats {
    // Find APPROVAL_DECISION events that have timing data
    const decisionEntries = this.entries.filter(
      (e) => e.event.topic === "APPROVAL_DECISION",
    );

    // Count pending APPROVAL_REQUIRED events (no matching decision)
    const requiredIds = new Set(
      this.entries
        .filter((e) => e.event.topic === "APPROVAL_REQUIRED")
        .map((e) => e.event.event_id),
    );
    const decidedOriginalIds = new Set(
      decisionEntries.map(
        (e) => (e.event.payload as Record<string, unknown>).original_event_id as string,
      ),
    );
    const pendingCount = [...requiredIds].filter(
      (id) => !decidedOriginalIds.has(id),
    ).length;

    // Compute latencies: time between APPROVAL_REQUIRED and APPROVAL_DECISION
    const latencies: number[] = [];
    for (const de of decisionEntries) {
      const originalId = (de.event.payload as Record<string, unknown>)
        .original_event_id as string;
      const requiredEntry = this.entries.find(
        (e) =>
          e.event.topic === "APPROVAL_REQUIRED" &&
          e.event.event_id === originalId,
      );
      if (requiredEntry) {
        latencies.push(de.event.created_at - requiredEntry.event.created_at);
      }
    }

    return {
      pending: pendingCount,
      p50_ms: percentile(latencies, 50),
      p95_ms: percentile(latencies, 95),
    };
  }

  // ── Internal helpers ───────────────────────────

  /**
   * Walk the parent_event_id chain to collect the full tree of event IDs
   * belonging to a task (root event + all descendants).
   */
  private collectTaskTree(taskId: string): Set<string> {
    const ids = new Set<string>();
    // Add the root
    ids.add(taskId);

    // BFS: find all events whose parent_event_id is in our set
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of this.entries) {
        if (ids.has(entry.event.event_id)) continue;
        if (
          entry.event.parent_event_id &&
          ids.has(entry.event.parent_event_id)
        ) {
          ids.add(entry.event.event_id);
          changed = true;
        }
      }
    }

    return ids;
  }
}

// ── Utility ──────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const arr = [...sorted].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, idx)];
}
