// ──────────────────────────────────────────────
// Summoner — Agent Summon Decision Engine
//
// Detects when a working agent needs help and
// triggers an approval-gated summoning flow.
//
// Three detection modes:
//   1. Skill gap  — claimed task requires tags the agent lacks
//   2. Overload   — agent has too many pending tasks
//   3. Decomposition — TaskAnalyzer says "complex" in team mode
//
// Autonomy level controls the approval gate:
//   0/1 → always ask user
//   2   → auto-approve LOW/MEDIUM urgency
//   3   → auto-approve all, notify user
// ──────────────────────────────────────────────

import type {
  SwarmEvent,
  AgentEntity,
  HudState,
  SummonRequest,
  SummonResolution,
  SummonUrgency,
  SummonReason,
  AutonomyLevel,
} from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";
import type { Matcher } from "./matcher.js";
import type { BudgetTracker } from "./budget-tracker.js";

// ── Constants ──

const OVERLOAD_THRESHOLD = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_PENDING_SUMMONS = 20;
const MAX_PROCESSED = 2000;

export class Summoner {
  private unsubscribe: Unsubscribe | null = null;
  private processedEvents = new Set<string>();

  /** Pending summon requests awaiting resolution */
  private pendingRequests = new Map<string, SummonRequest>();
  /** Timers for auto-resolution on timeout */
  private timeoutTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Track how many tasks each agent is handling (for overload) */
  private agentTaskCounts = new Map<string, number>();

  constructor(
    private readonly bus: IEventBus,
    private readonly matcher: Matcher,
    private readonly budgetTracker: BudgetTracker,
    private readonly getExecutionMode: () => string,
  ) {}

  // ── Lifecycle ──

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      [
        "TASK_CLAIMED",
        "TASK_PROGRESS",
        "TASK_ANALYZED",
        "TASK_CLOSED",
        "TASK_FAILED",
        "AGENT_SUMMON_RESOLVED",
      ],
      this.handleEvent.bind(this),
    );

    // Also listen for user/system resolutions published externally
    this.bus.subscribe(
      ["AGENT_SUMMON_RESOLVED"],
      this.handleResolution.bind(this),
    );
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const timer of this.timeoutTimers.values()) clearTimeout(timer);
    this.timeoutTimers.clear();
    this.pendingRequests.clear();
    this.processedEvents.clear();
    this.agentTaskCounts.clear();
  }

  // ── Public API ──

  getPendingRequests(): SummonRequest[] {
    return [...this.pendingRequests.values()];
  }

  /**
   * Resolve a summon request (called by gateway when user decides).
   */
  async resolveRequest(resolution: SummonResolution): Promise<void> {
    const request = this.pendingRequests.get(resolution.request_id);
    if (!request) return;

    // Clear timeout
    const timer = this.timeoutTimers.get(resolution.request_id);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(resolution.request_id);
    }

    this.pendingRequests.delete(resolution.request_id);

    // Publish the resolution event
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "AGENT_SUMMON_RESOLVED",
        intent: `Summon ${resolution.decision} for ${request.requesting_agent_name}`,
        payload: {
          ...resolution,
          original_request: request,
        },
        status: "CLOSED",
      }),
    );

    if (
      resolution.decision === "APPROVED" ||
      resolution.decision === "AUTO_APPROVED"
    ) {
      await this.spawnOrReuseAgent(request, resolution);
    }

    console.log(
      `[Summoner] Request ${resolution.request_id} resolved: ${resolution.decision} by ${resolution.decided_by}`,
    );
  }

  // ── Event Handlers ──

  private async handleEvent(event: SwarmEvent): Promise<void> {
    if (this.processedEvents.has(event.event_id)) return;
    this.processedEvents.add(event.event_id);
    this.boundProcessedEvents();

    switch (event.topic) {
      case "TASK_CLAIMED":
        await this.checkSkillGap(event);
        this.trackAgentTaskCount(event, 1);
        break;

      case "TASK_PROGRESS":
        await this.checkOverload(event);
        break;

      case "TASK_ANALYZED":
        await this.checkDecompositionNeed(event);
        break;

      case "TASK_CLOSED":
      case "TASK_FAILED":
        this.trackAgentTaskCount(event, -1);
        break;
    }
  }

  private async handleResolution(event: SwarmEvent): Promise<void> {
    const resolution = event.payload as unknown as SummonResolution;
    if (!resolution?.request_id) return;

    // Clean up if someone else resolved it
    const timer = this.timeoutTimers.get(resolution.request_id);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(resolution.request_id);
    }
    this.pendingRequests.delete(resolution.request_id);
  }

  // ── Detection Logic ──

  /**
   * Check if the agent that claimed a task lacks the required tags.
   */
  private async checkSkillGap(event: SwarmEvent): Promise<void> {
    const agentId = event.claimed_by;
    if (!agentId) return;

    const agent = this.matcher.getAgent(agentId);
    if (!agent) return;

    const requiredTags = new Set(event.required_tags);
    if (requiredTags.size === 0) return;

    const agentTags = new Set(agent.role_tags);
    const missingTags = [...requiredTags].filter((t) => !agentTags.has(t));

    if (missingTags.length > 0) {
      await this.createSummonRequest({
        agent,
        reason: "SKILL_GAP",
        requiredTags: missingTags,
        urgency: missingTags.length >= 2 ? "HIGH" : "MEDIUM",
        context: `Task "${event.intent}" requires tags [${missingTags.join(", ")}] that ${agent.name} doesn't have`,
        targetZoneId: agent.zone_id ?? "server",
      });
    }
  }

  /**
   * Check if an agent is overloaded (too many concurrent tasks).
   */
  private async checkOverload(event: SwarmEvent): Promise<void> {
    const agentId = event.payload?.agent_id as string | undefined;
    if (!agentId) return;

    const agent = this.matcher.getAgent(agentId);
    if (!agent) return;

    const taskCount = this.agentTaskCounts.get(agentId) ?? 0;
    if (taskCount >= OVERLOAD_THRESHOLD) {
      // Only trigger once per overload window
      const overloadKey = `overload-${agentId}-${Math.floor(Date.now() / 60_000)}`;
      if (this.processedEvents.has(overloadKey)) return;
      this.processedEvents.add(overloadKey);

      await this.createSummonRequest({
        agent,
        reason: "OVERLOAD",
        requiredTags: agent.role_tags,
        urgency: taskCount >= 5 ? "HIGH" : "MEDIUM",
        context: `${agent.name} has ${taskCount} concurrent tasks (threshold: ${OVERLOAD_THRESHOLD})`,
        targetZoneId: agent.zone_id ?? "server",
      });
    }
  }

  /**
   * Check if task analysis suggests decomposition (team mode).
   */
  private async checkDecompositionNeed(event: SwarmEvent): Promise<void> {
    if (this.getExecutionMode() !== "team") return;

    const complexity = event.payload?.complexity as string | undefined;
    if (complexity !== "complex") return;

    const suggestions = event.payload?.agent_suggestions as string[] | undefined;
    const requiredTags = event.payload?.required_tags as string[] | undefined;

    await this.createSummonRequest({
      agent: undefined,
      reason: "DECOMPOSITION",
      requiredTags: requiredTags ?? [],
      urgency: "MEDIUM",
      context: `Complex task "${event.intent}" needs decomposition. Suggested agents: ${(suggestions ?? []).join(", ")}`,
      targetZoneId: "server",
      suggestedTemplate: suggestions?.[0],
    });
  }

  // ── Summon Flow ──

  private async createSummonRequest(opts: {
    agent: AgentEntity | undefined;
    reason: SummonReason;
    requiredTags: string[];
    urgency: SummonUrgency;
    context: string;
    targetZoneId: string;
    suggestedTemplate?: string;
  }): Promise<void> {
    // Budget check: don't summon if resources are critically low
    if (!this.checkBudget()) {
      console.log(
        `[Summoner] Budget too low to summon, skipping request for: ${opts.context}`,
      );
      return;
    }

    // Enforce max pending summons
    if (this.pendingRequests.size >= MAX_PENDING_SUMMONS) {
      console.log("[Summoner] Max pending summons reached, skipping");
      return;
    }

    const request: SummonRequest = {
      request_id: crypto.randomUUID(),
      requesting_agent_id: opts.agent?.agent_id ?? "system",
      requesting_agent_name: opts.agent?.name ?? "System",
      reason: opts.reason,
      required_tags: opts.requiredTags,
      urgency: opts.urgency,
      target_zone_id: opts.targetZoneId,
      context: opts.context,
      suggested_template: opts.suggestedTemplate,
      approval_timeout_ms: DEFAULT_TIMEOUT_MS,
      created_at: Date.now(),
    };

    this.pendingRequests.set(request.request_id, request);

    // Publish event so frontend gets notified
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "AGENT_SUMMON_REQUEST",
        intent: `Summon request: ${opts.reason} — ${opts.context.slice(0, 80)}`,
        payload: { summon_request: request },
        status: "OPEN",
      }),
    );

    // Check autonomy level for auto-resolution
    const autonomyLevel: AutonomyLevel =
      opts.agent?.autonomy_level ?? 1;

    if (this.shouldAutoApprove(autonomyLevel, opts.urgency)) {
      await this.resolveRequest({
        request_id: request.request_id,
        decision: "AUTO_APPROVED",
        decided_by: "SYSTEM",
        reason: `Auto-approved: autonomy level ${autonomyLevel}, urgency ${opts.urgency}`,
      });
      return;
    }

    // Set timeout for pending requests
    const timer = setTimeout(async () => {
      this.timeoutTimers.delete(request.request_id);
      if (!this.pendingRequests.has(request.request_id)) return;

      // Timeout fallback logic
      if (opts.urgency === "CRITICAL" || opts.urgency === "HIGH") {
        await this.resolveRequest({
          request_id: request.request_id,
          decision: "AUTO_APPROVED",
          decided_by: "SYSTEM",
          reason: `Auto-approved on timeout: urgency ${opts.urgency}`,
        });
      } else {
        await this.resolveRequest({
          request_id: request.request_id,
          decision: "QUEUED",
          decided_by: "SYSTEM",
          reason: "No user response within timeout, queued for later",
        });
      }
    }, request.approval_timeout_ms);

    this.timeoutTimers.set(request.request_id, timer);

    console.log(
      `[Summoner] Created summon request ${request.request_id}: ${opts.reason} (urgency: ${opts.urgency})`,
    );
  }

  /**
   * Determine if a request should be auto-approved based on autonomy level.
   */
  private shouldAutoApprove(
    autonomyLevel: AutonomyLevel,
    urgency: SummonUrgency,
  ): boolean {
    if (autonomyLevel >= 3) return true;
    if (autonomyLevel >= 2) {
      return urgency === "LOW" || urgency === "MEDIUM";
    }
    return false;
  }

  /**
   * Check if the system has enough resources to sustain another agent.
   */
  private checkBudget(): boolean {
    const hud: HudState = this.budgetTracker.getHudState();
    // Require at least 10% of each resource
    const hpOk = hud.hp.current / hud.hp.max > 0.1;
    const mpOk = hud.mp.current / hud.mp.max > 0.1;
    return hpOk && mpOk;
  }

  /**
   * Find an idle agent with matching skills, or recruit a new one.
   */
  private async spawnOrReuseAgent(
    request: SummonRequest,
    resolution: SummonResolution,
  ): Promise<void> {
    // First, try to find an idle agent with matching tags
    const fakeEvent = {
      required_tags: request.required_tags,
    } as SwarmEvent;

    const candidates = this.matcher.findCandidates(fakeEvent);
    if (candidates.length > 0) {
      const reused = candidates[0];
      resolution.spawned_agent_id = reused.agent_id;
      console.log(
        `[Summoner] Reusing idle agent ${reused.name} (${reused.agent_id}) for summon ${request.request_id}`,
      );
      return;
    }

    // No idle agents available — publish a recruitment signal
    // The gateway/frontend can handle actual agent instantiation
    console.log(
      `[Summoner] No idle agents for tags [${request.required_tags.join(", ")}], recruitment needed`,
    );

    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "TASK_POSTED",
        intent: `[Auto-Recruit] Recruit agent with tags [${request.required_tags.join(", ")}] to zone ${request.target_zone_id}`,
        payload: {
          auto_recruit: true,
          summon_request_id: request.request_id,
          required_tags: request.required_tags,
          target_zone_id: request.target_zone_id,
          suggested_template: request.suggested_template,
        },
        required_tags: request.required_tags,
        status: "OPEN",
      }),
    );
  }

  // ── Helpers ──

  private trackAgentTaskCount(event: SwarmEvent, delta: number): void {
    const agentId =
      event.claimed_by ?? (event.payload?.agent_id as string | undefined);
    if (!agentId) return;

    const current = this.agentTaskCounts.get(agentId) ?? 0;
    const next = Math.max(0, current + delta);
    if (next === 0) {
      this.agentTaskCounts.delete(agentId);
    } else {
      this.agentTaskCounts.set(agentId, next);
    }
  }

  private boundProcessedEvents(): void {
    if (this.processedEvents.size > MAX_PROCESSED) {
      const toDelete: string[] = [];
      let count = 0;
      for (const id of this.processedEvents) {
        if (count++ >= MAX_PROCESSED / 4) break;
        toDelete.push(id);
      }
      for (const id of toDelete) this.processedEvents.delete(id);
    }
  }
}
