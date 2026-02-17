// ──────────────────────────────────────────────
// CompactionService: 长时记忆压缩
// ──────────────────────────────────────────────

import type { AgentRuntimeState, SwarmEvent } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";
import { CompactionScheduler } from "@corpcraft/event-bus";

export class CompactionService {
  private readonly runtimeStates = new Map<string, AgentRuntimeState>();
  private readonly scheduler: CompactionScheduler;
  private unsubscribe: Unsubscribe | null = null;

  constructor(private readonly bus: IEventBus) {
    this.scheduler = new CompactionScheduler(10, this.compact.bind(this));
  }

  // ── Lifecycle ──

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      [
        "TASK_CLOSED",
        "ARTIFACT_READY",
        "EVIDENCE_READY",
        "TASK_FAILED",
        "COMPACTION_TICK",
      ],
      this.handleEvent.bind(this),
    );
  }

  // ── Handler ──

  private async handleEvent(event: SwarmEvent): Promise<void> {
    const agentId =
      event.claimed_by ?? (event.payload?.agent_id as string | undefined);
    if (!agentId) return;

    // Record event; scheduler auto-triggers compaction every N events
    this.scheduler.recordEvent(agentId);
  }

  // ── Compaction logic ──

  private async compact(agentId: string): Promise<void> {
    // Gather recent events involving this agent
    const recentEvents = await this.bus.query({
      claimed_by: agentId,
      limit: 50,
    });

    const completed = recentEvents.filter(
      (e: SwarmEvent) => e.status === "CLOSED" || e.topic === "TASK_CLOSED",
    );
    const pending = recentEvents.filter((e: SwarmEvent) => e.status === "OPEN");
    const evidenceRefs = recentEvents
      .filter((e: SwarmEvent) => e.topic === "EVIDENCE_READY")
      .map((e: SwarmEvent) => e.event_id);

    const summary = [
      `=== Compaction for agent ${agentId} at ${new Date().toISOString()} ===`,
      `Completed tasks: ${completed.length}`,
      ...completed.slice(0, 5).map((e: SwarmEvent) => `  - ${e.intent} (${e.event_id})`),
      `Pending tasks: ${pending.length}`,
      ...pending.slice(0, 5).map((e: SwarmEvent) => `  - ${e.intent} (${e.event_id})`),
      `Evidence refs: ${evidenceRefs.length}`,
      evidenceRefs.slice(0, 5).join(", "),
    ].join("\n");

    this.runtimeStates.set(agentId, {
      agent_id: agentId,
      compacted_memory: summary,
      working_set_refs: evidenceRefs.slice(0, 10),
      last_compaction_at: Date.now(),
    });
  }

  // ── Queries ──

  getRuntimeState(agentId: string): AgentRuntimeState | undefined {
    return this.runtimeStates.get(agentId);
  }

  getAllRuntimeStates(): Map<string, AgentRuntimeState> {
    return this.runtimeStates;
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
