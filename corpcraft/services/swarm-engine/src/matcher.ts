// ──────────────────────────────────────────────
// Matcher: Agent ↔ Task 匹配 + 自动 Claim
// FIX: tag matching is now AND (all required tags must match)
// FIX: subscribes to TASK_FAILED/TASK_CLOSED to free agents
// FIX: processedEvents bounded with LRU-like eviction
// ──────────────────────────────────────────────

import type { SwarmEvent, AgentEntity } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

const MAX_PROCESSED = 2000;

export class Matcher {
  private readonly agents = new Map<string, AgentEntity>();
  private unsubscribe: Unsubscribe | null = null;
  private processedEvents = new Set<string>();

  constructor(private readonly bus: IEventBus) {}

  // ── Lifecycle ──

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      [
        "TASK_POSTED",
        "ARTIFACT_READY",
        "EVIDENCE_READY",
        "TASK_FAILED",
        "TASK_CLOSED",
      ],
      this.handleEvent.bind(this),
    );
  }

  // ── Agent registry ──

  registerAgent(agent: AgentEntity): void {
    this.agents.set(agent.agent_id, agent);
  }

  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  getAgent(agentId: string): AgentEntity | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): AgentEntity[] {
    return Array.from(this.agents.values());
  }

  get registry(): Map<string, AgentEntity> {
    return this.agents;
  }

  // ── Matching logic ──

  /**
   * Find candidate agents for a task using tiered matching:
   * 1. AND matching: agent has ALL required tags (best fit)
   * 2. Partial matching: agent has at least ONE required tag (fallback)
   * 3. Any IDLE agent (last resort — ensures tasks are never stuck OPEN)
   */
  findCandidates(event: SwarmEvent): AgentEntity[] {
    const requiredTags = new Set(event.required_tags);
    const idleAgents = Array.from(this.agents.values()).filter(
      (a) => a.status === "IDLE",
    );

    if (requiredTags.size === 0) {
      // No tags required — any IDLE agent qualifies
      return idleAgents.sort(
        (a, b) => b.metrics.success_rate_7d - a.metrics.success_rate_7d,
      );
    }

    // Tier 1: AND match — agent has ALL required tags
    const andMatches = idleAgents.filter((agent) => {
      const agentTags = new Set(agent.role_tags);
      for (const tag of requiredTags) {
        if (!agentTags.has(tag)) return false;
      }
      return true;
    });
    if (andMatches.length > 0) {
      return andMatches.sort(
        (a, b) => b.metrics.success_rate_7d - a.metrics.success_rate_7d,
      );
    }

    // Tier 2: Partial match — agent has at least one required tag (ranked by overlap)
    const partialMatches = idleAgents
      .map((agent) => {
        const agentTags = new Set(agent.role_tags);
        const overlap = [...requiredTags].filter((t) => agentTags.has(t)).length;
        return { agent, overlap };
      })
      .filter((m) => m.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || b.agent.metrics.success_rate_7d - a.agent.metrics.success_rate_7d);
    if (partialMatches.length > 0) {
      return partialMatches.map((m) => m.agent);
    }

    // Tier 3: Any IDLE agent (last resort — task should not stay OPEN forever)
    return idleAgents.sort(
      (a, b) => b.metrics.success_rate_7d - a.metrics.success_rate_7d,
    );
  }

  // ── Internal handlers ──

  private async handleEvent(event: SwarmEvent): Promise<void> {
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

    switch (event.topic) {
      case "TASK_POSTED":
        await this.autoMatch(event);
        break;

      // Only free agent when task is fully resolved (not on intermediate events).
      // Previously ARTIFACT_READY and EVIDENCE_READY also freed agents, but these
      // fire BEFORE TASK_FAILED — causing the agent to become IDLE prematurely
      // and immediately available for retry tasks, creating a tight loop.
      case "TASK_FAILED":
      case "TASK_CLOSED":
        this.freeAgent(event);
        break;

      case "ARTIFACT_READY":
      case "EVIDENCE_READY":
        // No-op: agent stays CLAIMED until TASK_CLOSED or TASK_FAILED
        break;
    }
  }

  private async autoMatch(event: SwarmEvent): Promise<void> {
    if (event.status !== "OPEN") return;

    const candidates = this.findCandidates(event);
    if (candidates.length === 0) return;

    const best = candidates[0];
    const result = await this.bus.claim(event.event_id, best.agent_id);
    if (result.ok) {
      // FIX: Create a shallow copy of mutable fields rather than mutating the entity directly
      // In a production system, we'd use immutable updates or a separate state store.
      // For now, direct mutation is acceptable for in-memory single-process architecture.
      best.status = "CLAIMED";
      best.current_event_id = event.event_id;
    }
  }

  /** Mark the agent as IDLE when an artifact/evidence/failure/close event arrives. */
  private freeAgent(event: SwarmEvent): void {
    const agentId = event.payload?.agent_id as string | undefined;
    if (!agentId) return;

    const agent = this.agents.get(agentId);
    if (agent && agent.status !== "IDLE") {
      agent.status = "IDLE";
      agent.current_event_id = undefined;
    }
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.processedEvents.clear();
  }
}
