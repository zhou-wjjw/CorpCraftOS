// ──────────────────────────────────────────────
// IEventBus: 事件总线抽象接口
// ──────────────────────────────────────────────

import type { SwarmEvent, EventTopic, EventStatus } from "@corpcraft/contracts";
import type { SwarmMetrics } from "@corpcraft/contracts";

/** Result of a claim attempt */
export type ClaimResult =
  | { ok: true; lease_expiry: number }
  | { ok: false; reason: string };

/** Filter for querying events */
export interface EventFilter {
  status?: EventStatus;
  topic?: EventTopic;
  parent_event_id?: string;
  claimed_by?: string;
  limit?: number;
  offset?: number;
  since?: number;
}

/** Dead letter entry */
export interface DeadLetterEntry {
  event: SwarmEvent;
  reason: string;
  at: number;
}

/** Event handler function */
export type EventHandler = (event: SwarmEvent) => Promise<void>;

/** Unsubscribe function */
export type Unsubscribe = () => void;

/**
 * IEventBus — the core abstraction for the SwarmEvent blackboard.
 *
 * All collaboration MUST go through this interface.
 * No static DAG orchestration allowed.
 */
export interface IEventBus {
  // ── Core read/write ──
  publish(event: SwarmEvent): Promise<SwarmEvent>;
  subscribe(topics: EventTopic[], handler: EventHandler): Unsubscribe;
  getEvent(eventId: string): Promise<SwarmEvent | null>;
  query(filter: EventFilter): Promise<SwarmEvent[]>;

  // ── Claim Lease protocol ──
  claim(eventId: string, agentId: string, leaseMs?: number): Promise<ClaimResult>;
  heartbeat(eventId: string, agentId: string): Promise<boolean>;
  release(eventId: string, agentId: string): Promise<void>;

  // ── DLQ (Dead Letter Queue) ──
  deadLetter(event: SwarmEvent, reason: string): Promise<void>;
  getDLQ(limit?: number): Promise<DeadLetterEntry[]>;
  retryFromDLQ(eventId: string): Promise<void>;

  // ── Replay (for migration verification + audit) ──
  replay(fromTimestamp: number, toTimestamp?: number): AsyncIterable<SwarmEvent>;

  // ── Metrics snapshot ──
  getMetricsSnapshot(): SwarmMetrics;

  // ── Lifecycle ──
  shutdown(): Promise<void>;
}
