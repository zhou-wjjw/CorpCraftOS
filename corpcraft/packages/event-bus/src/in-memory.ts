// ──────────────────────────────────────────────
// InMemoryEventBus: 内存实现 (Sprint 0-1)
// 后续可替换为 Redis Streams / NATS JetStream
// ──────────────────────────────────────────────

import type {
  SwarmEvent,
  EventTopic,
  SwarmMetrics,
} from "@corpcraft/contracts";
import { createEmptyMetrics, createSwarmEvent } from "@corpcraft/contracts";
import type {
  IEventBus,
  EventFilter,
  ClaimResult,
  EventHandler,
  Unsubscribe,
  DeadLetterEntry,
} from "./types.js";
import { ClaimManager } from "./claim-manager.js";
import { IdempotencyGuard } from "./idempotency.js";
import { DeadLetterQueue } from "./dead-letter-queue.js";

export class InMemoryEventBus implements IEventBus {
  /** All events, ordered by created_at */
  private events = new Map<string, SwarmEvent>();
  /** Topic -> Set of handlers */
  private subscribers = new Map<EventTopic, Set<EventHandler>>();
  /** Claim lease manager */
  private claimManager: ClaimManager;
  /** Idempotency dedup */
  private idempotency = new IdempotencyGuard();
  /** Dead letter queue */
  private dlq = new DeadLetterQueue();

  /** Sequence counter for WS push */
  private seq = 0;

  /** Metrics counters */
  private tasksCompleted1h = 0;
  private tasksFailed1h = 0;
  private totalTokens1h = 0;
  private totalCost1h = 0;
  private taskDurations: number[] = [];
  private metricsResetTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.claimManager = new ClaimManager((eventId, agentId) => {
      this.handleLeaseExpired(eventId, agentId);
    });

    // Reset hourly metrics every hour
    this.metricsResetTimer = setInterval(() => {
      this.tasksCompleted1h = 0;
      this.tasksFailed1h = 0;
      this.totalTokens1h = 0;
      this.totalCost1h = 0;
      this.taskDurations = [];
    }, 3600_000);
  }

  // ── Core read/write ──

  async publish(event: SwarmEvent): Promise<SwarmEvent> {
    // Idempotency check
    if (event.idempotency_key) {
      const existing = this.idempotency.check(event.idempotency_key);
      if (existing) {
        const existingEvent = this.events.get(existing);
        if (existingEvent) return existingEvent;
      }
    }

    // Store event
    this.events.set(event.event_id, event);

    // Record idempotency
    if (event.idempotency_key) {
      this.idempotency.record(event.idempotency_key, event.event_id);
    }

    // Track metrics
    if (event.topic === "TASK_CLOSED") {
      this.tasksCompleted1h++;
      const parent = event.parent_event_id
        ? this.events.get(event.parent_event_id)
        : null;
      if (parent) {
        this.taskDurations.push(event.created_at - parent.created_at);
      }
    }
    if (event.topic === "TASK_FAILED") {
      this.tasksFailed1h++;
    }
    if (event.cost_delta) {
      this.totalTokens1h += event.cost_delta.tokens_used;
      this.totalCost1h += event.cost_delta.cash_used;
    }

    // Notify subscribers
    this.seq++;
    const handlers = this.subscribers.get(event.topic);
    if (handlers) {
      const promises = Array.from(handlers).map((handler) =>
        handler(event).catch((err) => {
          console.error(
            `[EventBus] Handler error for ${event.topic}:`,
            err,
          );
          // Move to DLQ on handler failure
          this.dlq.push(event, `Handler error: ${String(err)}`);
        }),
      );
      await Promise.allSettled(promises);
    }

    return event;
  }

  subscribe(topics: EventTopic[], handler: EventHandler): Unsubscribe {
    for (const topic of topics) {
      if (!this.subscribers.has(topic)) {
        this.subscribers.set(topic, new Set());
      }
      this.subscribers.get(topic)!.add(handler);
    }

    return () => {
      for (const topic of topics) {
        this.subscribers.get(topic)?.delete(handler);
      }
    };
  }

  async getEvent(eventId: string): Promise<SwarmEvent | null> {
    return this.events.get(eventId) ?? null;
  }

  async query(filter: EventFilter): Promise<SwarmEvent[]> {
    let results = Array.from(this.events.values());

    if (filter.status) {
      results = results.filter((e) => e.status === filter.status);
    }
    if (filter.topic) {
      results = results.filter((e) => e.topic === filter.topic);
    }
    if (filter.parent_event_id) {
      results = results.filter(
        (e) => e.parent_event_id === filter.parent_event_id,
      );
    }
    if (filter.claimed_by) {
      results = results.filter((e) => e.claimed_by === filter.claimed_by);
    }
    if (filter.since) {
      results = results.filter((e) => e.created_at >= filter.since!);
    }

    // Sort by created_at descending
    results.sort((a, b) => b.created_at - a.created_at);

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  // ── Claim Lease protocol ──

  async claim(
    eventId: string,
    agentId: string,
    leaseMs?: number,
  ): Promise<ClaimResult> {
    const event = this.events.get(eventId);
    if (!event) {
      return { ok: false, reason: `Event ${eventId} not found` };
    }

    const result = this.claimManager.claim(event, agentId, leaseMs);
    if (result.ok) {
      event.status = "CLAIMED";
      event.claimed_by = agentId;
      event.updated_at = Date.now();

      // Publish TASK_CLAIMED
      await this.publish(
        createSwarmEvent({
          event_id: `${eventId}-claimed-${Date.now()}`,
          topic: "TASK_CLAIMED",
          intent: event.intent,
          payload: { original_event_id: eventId, agent_id: agentId },
          parent_event_id: eventId,
          status: "CLOSED",
        }),
      );
    }

    return result;
  }

  async heartbeat(eventId: string, agentId: string): Promise<boolean> {
    return this.claimManager.heartbeat(eventId, agentId);
  }

  async release(eventId: string, agentId: string): Promise<void> {
    const released = this.claimManager.release(eventId, agentId);
    if (released) {
      const event = this.events.get(eventId);
      if (event) {
        event.status = "OPEN";
        event.claimed_by = undefined;
        event.updated_at = Date.now();
      }
    }
  }

  // ── DLQ ──

  async deadLetter(event: SwarmEvent, reason: string): Promise<void> {
    this.dlq.push(event, reason);
  }

  async getDLQ(limit?: number): Promise<DeadLetterEntry[]> {
    return this.dlq.get(limit);
  }

  async retryFromDLQ(eventId: string): Promise<void> {
    const event = this.dlq.remove(eventId);
    if (event) {
      event.status = "OPEN";
      event.claimed_by = undefined;
      event.updated_at = Date.now();
      await this.publish(event);
    }
  }

  // ── Replay ──

  async *replay(
    fromTimestamp: number,
    toTimestamp?: number,
  ): AsyncIterable<SwarmEvent> {
    const to = toTimestamp ?? Date.now();
    const sorted = Array.from(this.events.values())
      .filter((e) => e.created_at >= fromTimestamp && e.created_at <= to)
      .sort((a, b) => a.created_at - b.created_at);

    for (const event of sorted) {
      yield event;
    }
  }

  // ── Metrics ──

  getMetricsSnapshot(): SwarmMetrics {
    const metrics = createEmptyMetrics();

    // Queue depth: OPEN events
    metrics.queue_depth = Array.from(this.events.values()).filter(
      (e) => e.status === "OPEN",
    ).length;

    // Claim conflict rate
    metrics.claim_conflict_rate_1m = this.claimManager.getConflictRate();

    // Retry storm: >20 retries in current events
    const retries = Array.from(this.events.values()).filter(
      (e) => e.topic === "TASK_RETRY_SCHEDULED",
    ).length;
    metrics.retry_storm_detected = retries > 20;

    // Task throughput
    metrics.tasks_completed_1h = this.tasksCompleted1h;
    metrics.tasks_failed_1h = this.tasksFailed1h;
    metrics.avg_task_duration_ms =
      this.taskDurations.length > 0
        ? this.taskDurations.reduce((a, b) => a + b, 0) /
          this.taskDurations.length
        : 0;

    // Approval metrics
    const pendingApprovals = Array.from(this.events.values()).filter(
      (e) => e.topic === "APPROVAL_REQUIRED" && e.status === "OPEN",
    );
    metrics.approval_pending_count = pendingApprovals.length;

    // Resource consumption
    metrics.total_tokens_1h = this.totalTokens1h;
    metrics.total_cost_1h = this.totalCost1h;

    metrics.timestamp = Date.now();
    return metrics;
  }

  // ── Internal ──

  private async handleLeaseExpired(
    eventId: string,
    agentId: string,
  ): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) return;

    // FIX: Don't reset a CLOSED/FAILED event back to OPEN
    if (event.status === "CLOSED" || event.status === "FAILED") {
      console.info(
        `[EventBus] Lease expired but event already ${event.status}: event=${eventId}, agent=${agentId}`,
      );
      return;
    }

    console.warn(
      `[EventBus] Lease expired: event=${eventId}, agent=${agentId}`,
    );

    // Reset event to OPEN for re-matching
    event.status = "OPEN";
    event.claimed_by = undefined;
    event.updated_at = Date.now();

    // Publish retry event
    await this.publish(
      createSwarmEvent({
        event_id: `${eventId}-retry-${Date.now()}`,
        topic: "TASK_RETRY_SCHEDULED",
        intent: event.intent,
        payload: {
          original_event_id: eventId,
          reason: "lease_expired",
          expired_agent: agentId,
        },
        parent_event_id: eventId,
        required_tags: event.required_tags,
        risk_level: event.risk_level,
        budget: event.budget,
      }),
    );
  }

  /** Get current sequence number */
  get currentSeq(): number {
    return this.seq;
  }

  /** Total events stored */
  get eventCount(): number {
    return this.events.size;
  }

  async shutdown(): Promise<void> {
    this.claimManager.shutdown();
    this.idempotency.shutdown();
    clearInterval(this.metricsResetTimer);
  }
}
