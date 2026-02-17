// ──────────────────────────────────────────────
// MetricsCollector: 聚合指标
// ──────────────────────────────────────────────

import type { SwarmMetrics, FailureCategory } from "@corpcraft/contracts";
import type { IEventBus } from "@corpcraft/event-bus";
import type { Recovery } from "./recovery.js";

export class MetricsCollector {
  constructor(
    private readonly bus: IEventBus,
    private readonly recovery: Recovery,
  ) {}

  /**
   * Aggregate metrics from the event bus snapshot and the
   * recovery module's failure breakdown counters.
   */
  getMetrics(): SwarmMetrics {
    const busMetrics = this.bus.getMetricsSnapshot();

    // Merge failure counts tracked by the Recovery module
    const breakdown = { ...busMetrics.failure_breakdown };
    for (const [cat, count] of Object.entries(this.recovery.failureCounts)) {
      breakdown[cat as FailureCategory] += count;
    }

    return {
      ...busMetrics,
      failure_breakdown: breakdown,
      timestamp: Date.now(),
    };
  }
}
