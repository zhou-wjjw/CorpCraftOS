// ──────────────────────────────────────────────
// Recovery: SOS / FAILED / RETRY → 分类 + 指数退避
// ──────────────────────────────────────────────

import type { SwarmEvent, FailureCategory } from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

const MAX_RETRIES = 2;
const MAX_PROCESSED = 2000;

// ── Helpers ──

interface RetryState {
  count: number;
  lastAttempt: number;
}

/**
 * Classify a failure event into one of five categories by inspecting
 * payload.reason and payload.error.
 */
function classifyFailure(event: SwarmEvent): FailureCategory {
  const reason = String(event.payload?.reason ?? "").toLowerCase();
  const error = String(event.payload?.error ?? "").toLowerCase();
  const combined = `${reason} ${error}`;

  // Execution completed but Claude reported failure — this is permanent, not transient.
  // Retrying won't help because Claude already tried and decided it cannot succeed.
  if (/execution_failed/.test(reason)) {
    return "MODEL";
  }

  if (/timeout|network|econnrefused|econnreset|socket|dns/.test(combined)) {
    return "TRANSIENT";
  }
  if (/tool|plugin|api|rate.?limit|quota/.test(combined)) {
    return "TOOLING";
  }
  if (/model|inference|hallucin|token.?limit|context.?length/.test(combined)) {
    return "MODEL";
  }
  if (/policy|permission|forbidden|unauthorized|compliance/.test(combined)) {
    return "POLICY";
  }
  if (/inject|attack|malicious|exploit|xss|sql/.test(combined)) {
    return "MALICE";
  }
  return "TRANSIENT"; // default — assume transient
}

/** Exponential back-off with jitter, capped at 60 s. */
function exponentialBackoffMs(retryCount: number): number {
  const base = 1000 * Math.pow(2, retryCount);
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.min(base + jitter, 60_000);
}

// ── Recovery class ──

export class Recovery {
  private unsubscribe: Unsubscribe | null = null;
  private retryStates = new Map<string, RetryState>();
  private processedEvents = new Set<string>();
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  /** Exposed for MetricsCollector aggregation */
  readonly failureCounts: Record<FailureCategory, number> = {
    TRANSIENT: 0,
    TOOLING: 0,
    MODEL: 0,
    POLICY: 0,
    MALICE: 0,
  };

  constructor(private readonly bus: IEventBus) {}

  // ── Lifecycle ──

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      ["SOS_ERROR", "TASK_FAILED", "TASK_RETRY_SCHEDULED"],
      this.handleFailure.bind(this),
    );
  }

  // ── Handler ──

  private async handleFailure(event: SwarmEvent): Promise<void> {
    // Idempotent
    if (this.processedEvents.has(event.event_id)) return;
    this.processedEvents.add(event.event_id);

    // Bounded cleanup to prevent memory leak
    if (this.processedEvents.size > MAX_PROCESSED) {
      const toDelete: string[] = [];
      let count = 0;
      for (const id of this.processedEvents) {
        if (count++ >= MAX_PROCESSED / 4) break;
        toDelete.push(id);
      }
      for (const id of toDelete) this.processedEvents.delete(id);
    }

    const category = classifyFailure(event);
    this.failureCounts[category]++;

    // Resolve the original event ID, then trace through the retry chain
    // to find the ROOT task ID. This prevents retry counters from resetting
    // when each retry gets a new event_id.
    let originalEventId =
      (event.payload?.original_event_id as string) ?? event.event_id;

    const origEvent = await this.bus.getEvent(originalEventId);
    if (origEvent?.payload?.retry_of) {
      originalEventId = origEvent.payload.retry_of as string;
    }

    // Non-retryable → send to dead-letter queue
    if (category !== "TRANSIENT") {
      await this.bus.deadLetter(event, `Non-retryable failure: ${category}`);
      return;
    }

    // Check if original event is already OPEN (e.g. lease-expiry handler reset it)
    const original = await this.bus.getEvent(originalEventId);
    if (original && original.status === "OPEN") {
      // Already re-queued by the bus; no need to duplicate
      return;
    }

    // Retry accounting
    const state = this.retryStates.get(originalEventId) ?? {
      count: 0,
      lastAttempt: 0,
    };

    if (state.count >= MAX_RETRIES) {
      await this.bus.deadLetter(
        event,
        `Max retries (${MAX_RETRIES}) exhausted for ${originalEventId}`,
      );
      this.retryStates.delete(originalEventId);
      return;
    }

    state.count++;
    state.lastAttempt = Date.now();
    this.retryStates.set(originalEventId, state);

    const delayMs = exponentialBackoffMs(state.count);

    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      void this.publishRetry(event, originalEventId, state.count);
    }, delayMs);

    this.pendingTimers.add(timer);
  }

  private async publishRetry(
    failedEvent: SwarmEvent,
    originalEventId: string,
    retryCount: number,
  ): Promise<void> {
    const original = await this.bus.getEvent(originalEventId);
    const intent = original?.intent ?? failedEvent.intent;
    const tags = original?.required_tags ?? failedEvent.required_tags;
    const riskLevel = original?.risk_level ?? failedEvent.risk_level;
    const budget = original?.budget ?? failedEvent.budget;

    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "TASK_POSTED",
        intent,
        required_tags: tags,
        risk_level: riskLevel,
        budget,
        payload: {
          // Always point retry_of to the root task, not intermediate retries
          retry_of: (original?.payload?.retry_of as string) ?? originalEventId,
          retry_count: retryCount,
        },
        parent_event_id: original?.parent_event_id,
      }),
    );
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.retryStates.clear();
    this.processedEvents.clear();
  }
}
