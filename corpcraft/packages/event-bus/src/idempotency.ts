// ──────────────────────────────────────────────
// IdempotencyGuard: 幂等去重
// ──────────────────────────────────────────────

interface IdempotencyEntry {
  event_id: string;
  expires_at: number;
}

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute

export class IdempotencyGuard {
  private store = new Map<string, IdempotencyEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private ttlMs: number = DEFAULT_TTL_MS) {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  /**
   * Check if an event with this idempotency key was already seen.
   * Returns the existing event_id if duplicate, null if new.
   */
  check(idempotencyKey: string): string | null {
    const entry = this.store.get(idempotencyKey);
    if (!entry) return null;
    if (entry.expires_at < Date.now()) {
      this.store.delete(idempotencyKey);
      return null;
    }
    return entry.event_id;
  }

  /** Record a new idempotency key */
  record(idempotencyKey: string, eventId: string): void {
    this.store.set(idempotencyKey, {
      event_id: eventId,
      expires_at: Date.now() + this.ttlMs,
    });
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expires_at < now) {
        this.store.delete(key);
      }
    }
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  get size(): number {
    return this.store.size;
  }
}
