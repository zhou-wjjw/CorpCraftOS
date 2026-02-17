// ──────────────────────────────────────────────
// ClaimManager: Lease / Heartbeat / Timeout
// ──────────────────────────────────────────────

import type { SwarmEvent } from "@corpcraft/contracts";

export const DEFAULT_LEASE_MS = 120_000; // 2 minutes
export const HIGH_RISK_LEASE_MS = 300_000; // 5 minutes
export const HEARTBEAT_INTERVAL_MS = 10_000; // 10 seconds

interface LeaseEntry {
  agent_id: string;
  event_id: string;
  expires_at: number;
  timer: ReturnType<typeof setTimeout>;
}

export type LeaseExpiredCallback = (eventId: string, agentId: string) => void;

export class ClaimManager {
  private leases = new Map<string, LeaseEntry>();
  private claimConflicts = 0;
  private conflictResetTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private onLeaseExpired: LeaseExpiredCallback) {
    // Reset conflict counter every minute for metrics
    this.conflictResetTimer = setInterval(() => {
      this.claimConflicts = 0;
    }, 60_000);
  }

  /**
   * Attempt to claim an event. Returns true if successful.
   * Atomic in single-threaded Node.js.
   */
  claim(
    event: SwarmEvent,
    agentId: string,
    leaseMs?: number,
  ): { ok: true; lease_expiry: number } | { ok: false; reason: string } {
    // Already claimed by same agent? Return existing lease (idempotent)
    const existing = this.leases.get(event.event_id);
    if (existing && existing.agent_id === agentId) {
      return { ok: true, lease_expiry: existing.expires_at };
    }

    // Already claimed by someone else?
    if (event.status !== "OPEN") {
      this.claimConflicts++;
      return {
        ok: false,
        reason: `Event ${event.event_id} is ${event.status}, claimed by ${event.claimed_by ?? "unknown"}`,
      };
    }

    const duration = leaseMs ?? (event.risk_level === "HIGH" ? HIGH_RISK_LEASE_MS : DEFAULT_LEASE_MS);
    const expiresAt = Date.now() + duration;

    const timer = setTimeout(() => {
      this.expireLease(event.event_id);
    }, duration);

    this.leases.set(event.event_id, {
      agent_id: agentId,
      event_id: event.event_id,
      expires_at: expiresAt,
      timer,
    });

    return { ok: true, lease_expiry: expiresAt };
  }

  /**
   * Renew a lease. Returns true if renewed, false if not found or wrong agent.
   */
  heartbeat(eventId: string, agentId: string): boolean {
    const entry = this.leases.get(eventId);
    if (!entry || entry.agent_id !== agentId) return false;

    // Clear old timer
    clearTimeout(entry.timer);

    // Calculate remaining lease or default
    const newDuration = DEFAULT_LEASE_MS;
    entry.expires_at = Date.now() + newDuration;
    entry.timer = setTimeout(() => {
      this.expireLease(eventId);
    }, newDuration);

    return true;
  }

  /**
   * Release a claim voluntarily.
   */
  release(eventId: string, agentId: string): boolean {
    const entry = this.leases.get(eventId);
    if (!entry || entry.agent_id !== agentId) return false;

    clearTimeout(entry.timer);
    this.leases.delete(eventId);
    return true;
  }

  /** Check if an event is currently claimed */
  isActive(eventId: string): boolean {
    return this.leases.has(eventId);
  }

  /** Get the agent holding a lease */
  getHolder(eventId: string): string | undefined {
    return this.leases.get(eventId)?.agent_id;
  }

  /** Get claim conflicts per minute (for metrics) */
  getConflictRate(): number {
    return this.claimConflicts;
  }

  get activeLeaseCount(): number {
    return this.leases.size;
  }

  private expireLease(eventId: string): void {
    const entry = this.leases.get(eventId);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.leases.delete(eventId);
    this.onLeaseExpired(eventId, entry.agent_id);
  }

  shutdown(): void {
    for (const entry of this.leases.values()) {
      clearTimeout(entry.timer);
    }
    this.leases.clear();
    if (this.conflictResetTimer) {
      clearInterval(this.conflictResetTimer);
      this.conflictResetTimer = null;
    }
  }
}
