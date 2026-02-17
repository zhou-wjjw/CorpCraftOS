// ──────────────────────────────────────────────
// @corpcraft/event-bus — Event Bus abstraction
// ──────────────────────────────────────────────

export type {
  IEventBus,
  ClaimResult,
  EventFilter,
  EventHandler,
  Unsubscribe,
  DeadLetterEntry,
} from "./types.js";

export { InMemoryEventBus } from "./in-memory.js";
export { ClaimManager, DEFAULT_LEASE_MS, HIGH_RISK_LEASE_MS, HEARTBEAT_INTERVAL_MS } from "./claim-manager.js";
export { IdempotencyGuard } from "./idempotency.js";
export { CompactionScheduler } from "./compaction-scheduler.js";
export { DeadLetterQueue } from "./dead-letter-queue.js";
