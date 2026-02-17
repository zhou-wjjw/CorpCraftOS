// ──────────────────────────────────────────────
// CompactionScheduler: 长时任务记忆压缩调度
// ──────────────────────────────────────────────

const DEFAULT_TICK_INTERVAL = 10; // Every 10 events

export type CompactionCallback = (agentId: string) => Promise<void>;

export class CompactionScheduler {
  private counters = new Map<string, number>();

  constructor(
    private tickInterval: number = DEFAULT_TICK_INTERVAL,
    private onCompactionTick?: CompactionCallback,
  ) {}

  /**
   * Record an event processed by an agent. Returns true if compaction triggered.
   */
  recordEvent(agentId: string): boolean {
    const count = (this.counters.get(agentId) ?? 0) + 1;
    this.counters.set(agentId, count);

    if (count >= this.tickInterval) {
      this.counters.set(agentId, 0);
      this.onCompactionTick?.(agentId).catch((err) => {
        console.error(`[CompactionScheduler] Compaction failed for ${agentId}:`, err);
      });
      return true;
    }
    return false;
  }

  /** Reset counter for an agent */
  reset(agentId: string): void {
    this.counters.delete(agentId);
  }

  /** Get current event count for an agent */
  getCount(agentId: string): number {
    return this.counters.get(agentId) ?? 0;
  }
}
