// ──────────────────────────────────────────────
// Executor: TASK_CLAIMED → execution → results
// Supports 3 modes: mock | claude | team
// Controlled at runtime via setMode() or CORPCRAFT_EXECUTION_MODE env var
//
// Multi-agent collaboration is handled at the SwarmEngine level
// via task decomposition into parallel sub-tasks, each executed
// as an independent Claude Code session.
// ──────────────────────────────────────────────

import type { SwarmEvent, CostDelta } from "@corpcraft/contracts";
import { createSwarmEvent, createEvidencePack } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";
import { HEARTBEAT_INTERVAL_MS } from "@corpcraft/event-bus";

export type ExecutionMode = "mock" | "claude" | "team";

interface ExecutionContext {
  eventId: string;
  agentId: string;
  heartbeatTimer: ReturnType<typeof setInterval>;
  executionTimer?: ReturnType<typeof setTimeout>;
  abortController?: AbortController;
}

const MAX_PROCESSED = 2000;

function parseExecutionMode(raw: string): ExecutionMode {
  if (raw === "claude" || raw === "team") return raw;
  return "mock";
}

export class Executor {
  private unsubscribe: Unsubscribe | null = null;
  private executions = new Map<string, ExecutionContext>();
  /** Idempotency guard (bounded) */
  private processedEvents = new Set<string>();
  /** Current execution mode — mutable at runtime */
  private _mode: ExecutionMode;

  constructor(private readonly bus: IEventBus) {
    this._mode = parseExecutionMode(
      process.env.CORPCRAFT_EXECUTION_MODE ?? "mock",
    );
  }

  get mode(): ExecutionMode {
    return this._mode;
  }

  /** Change execution mode at runtime */
  setMode(mode: ExecutionMode): void {
    const prev = this._mode;
    this._mode = mode;
    console.log(`[Executor] Mode changed: "${prev}" → "${mode}"`);
  }

  // ── Lifecycle ──

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      ["TASK_CLAIMED"],
      this.handleTaskClaimed.bind(this),
    );
    console.log(`[Executor] Initialized in "${this.mode}" mode`);
  }

  // ── Handlers ──

  private async handleTaskClaimed(event: SwarmEvent): Promise<void> {
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

    const originalEventId = event.payload?.original_event_id as
      | string
      | undefined;
    const agentId = event.payload?.agent_id as string | undefined;
    if (!originalEventId || !agentId) return;

    const originalEvent = await this.bus.getEvent(originalEventId);
    if (!originalEvent) return;

    // ── Start heartbeat ──
    const heartbeatTimer = setInterval(() => {
      void this.bus.heartbeat(originalEventId, agentId);
    }, HEARTBEAT_INTERVAL_MS);

    // Publish initial progress
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "TASK_PROGRESS",
        intent: originalEvent.intent,
        payload: {
          original_event_id: originalEventId,
          agent_id: agentId,
          progress: 0,
          message: "Execution started",
          detail: `Mode: ${this.mode}`,
        },
        parent_event_id: originalEventId,
        status: "CLOSED",
      }),
    );

    // Dispatch based on execution mode
    if (this.mode === "claude" || this.mode === "team") {
      // Real Claude execution
      const abortController = new AbortController();
      this.executions.set(originalEventId, {
        eventId: originalEventId,
        agentId,
        heartbeatTimer,
        abortController,
      });

      // Run async — don't block the event handler
      void this.executeWithClaude(
        originalEventId,
        agentId,
        originalEvent,
      );
    } else {
      // Mock execution: 2-5 seconds
      const execTimeMs = 2000 + Math.random() * 3000;
      const executionTimer = setTimeout(() => {
        void this.completeMockExecution(
          originalEventId,
          agentId,
          originalEvent,
          execTimeMs,
        );
      }, execTimeMs);

      this.executions.set(originalEventId, {
        eventId: originalEventId,
        agentId,
        heartbeatTimer,
        executionTimer,
      });
    }
  }

  // ── Claude Execution ──

  private async executeWithClaude(
    eventId: string,
    agentId: string,
    originalEvent: SwarmEvent,
  ): Promise<void> {
    const startTime = Date.now();
    const logs: string[] = [];
    let totalTokens = 0;

    try {
      const bridge = await import("@corpcraft/claude-bridge");

      // Resolve agent profile
      const agentName = (originalEvent.payload?.agent_name as string) ?? "Agent";
      const profile = bridge.resolveProfile(agentName, originalEvent.required_tags);

      // Check for resume context from an interrupted task snapshot
      const resumeCtx = originalEvent.payload?.resume_context as string | undefined;
      const effectiveProfile = resumeCtx
        ? {
            ...profile,
            systemPrompt: [
              "## Resumed Task — Previous Work Context",
              "",
              "You were previously interrupted while working on this task.",
              "Below is a snapshot of your progress at the time of interruption.",
              "Continue from where you left off.",
              "",
              resumeCtx,
              "",
              "---",
              "",
              profile.systemPrompt,
            ].join("\n"),
          }
        : profile;

      // Build tool context so MCP tools can publish events to the bus
      const toolContext: import("@corpcraft/claude-bridge").ToolCallbackContext = {
        agentId,
        agentName: agentName,
        zoneId: originalEvent.payload?.zone_id as string | undefined,
        publishEvent: async (topic, intent, payload) => {
          await this.bus.publish(
            createSwarmEvent({
              event_id: crypto.randomUUID(),
              topic,
              intent,
              payload: { ...payload, original_event_id: eventId },
              parent_event_id: eventId,
              status: "CLOSED",
            }),
          );
        },
      };

      const config: import("@corpcraft/claude-bridge").SessionConfig = {
        agentProfile: effectiveProfile,
        cwd: process.env.CORPCRAFT_WORK_DIR ?? process.cwd(),
        maxTokens: originalEvent.budget?.max_tokens,
        teamMode: this.mode === "team",
        toolContext,
      };

      // Each task runs as an independent Claude session with MCP tools
      const generator = bridge.executeTask(originalEvent.intent, config);

      // Stream progress events — no summon marker interception needed,
      // agent summoning is now handled natively via MCP tool calling
      let iterResult = await generator.next();
      let progressCount = 0;

      while (!iterResult.done) {
        const progress = iterResult.value;
        progressCount++;

        // Publish progress event with Claude's thinking/output
        await this.bus.publish(
          createSwarmEvent({
            event_id: crypto.randomUUID(),
            topic: "TASK_PROGRESS",
            intent: originalEvent.intent,
            payload: {
              original_event_id: eventId,
              agent_id: agentId,
              progress: Math.min(progressCount * 10, 90),
              message: progress.content.slice(0, 200),
              detail: progress.content,
              kind: progress.kind,
              tool_name: progress.toolName,
              team_members: progress.teamMembers,
            },
            parent_event_id: eventId,
            status: "CLOSED",
          }),
        );

        if (progress.tokensUsed) totalTokens = progress.tokensUsed;
        iterResult = await generator.next();
      }

      // Final result
      const result = iterResult.value;
      totalTokens = result.tokensUsed || totalTokens;
      logs.push(...result.logs);

      // Complete execution with real results
      await this.completeClaudeExecution(
        eventId,
        agentId,
        originalEvent,
        result,
        totalTokens,
        Date.now() - startTime,
        logs,
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Executor] Claude execution failed: ${errMsg}`);
      logs.push(`[ERROR] ${errMsg}`);

      // Clean up execution context
      const ctx = this.executions.get(eventId);
      if (ctx) {
        clearInterval(ctx.heartbeatTimer);
        this.executions.delete(eventId);
      }

      // Release lease and mark as FAILED (not mock fallback — let Recovery handle retry)
      await this.bus.release(eventId, agentId);
      const storedEvent = await this.bus.getEvent(eventId);
      if (storedEvent) {
        storedEvent.status = "FAILED";
        storedEvent.updated_at = Date.now();
      }

      await this.bus.publish(
        createSwarmEvent({
          event_id: crypto.randomUUID(),
          topic: "TASK_FAILED",
          intent: originalEvent.intent,
          payload: {
            original_event_id: eventId,
            agent_id: agentId,
            reason: errMsg,
            error: errMsg,
          },
          parent_event_id: originalEvent.parent_event_id,
          status: "CLOSED",
        }),
      );
    }
  }

  private async completeClaudeExecution(
    eventId: string,
    agentId: string,
    originalEvent: SwarmEvent,
    result: import("@corpcraft/claude-bridge").ExecutionResult,
    tokensUsed: number,
    durationMs: number,
    logs: string[],
  ): Promise<void> {
    // Clean up
    const ctx = this.executions.get(eventId);
    if (ctx) {
      clearInterval(ctx.heartbeatTimer);
      this.executions.delete(eventId);
    }

    // Real cost from Claude
    const costDelta: CostDelta = {
      tokens_used: tokensUsed,
      minutes_used: +(durationMs / 60_000).toFixed(4),
      cash_used: +(tokensUsed * 0.000015).toFixed(6), // ~$15/M tokens estimate
    };

    await this.bus.release(eventId, agentId);
    const storedEvent = await this.bus.getEvent(eventId);
    if (storedEvent) {
      storedEvent.status = result.success ? "CLOSED" : "FAILED";
      storedEvent.updated_at = Date.now();
      storedEvent.cost_delta = costDelta;
    }

    // ── ARTIFACT_READY with real content ──
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "ARTIFACT_READY",
        intent: originalEvent.intent,
        payload: {
          original_event_id: eventId,
          agent_id: agentId,
          artifact_id: crypto.randomUUID(),
          artifact_type: "result",
          content: result.artifact || `[Claude result for: ${originalEvent.intent}]`,
          success: result.success,
        },
        parent_event_id: eventId,
        cost_delta: costDelta,
        status: "CLOSED",
      }),
    );

    // ── EVIDENCE_READY with real logs ──
    const evidencePack = createEvidencePack(
      crypto.randomUUID(),
      logs.map((log) => ({
        type: "LOG" as const,
        note: log,
        created_at: Date.now(),
      })),
      agentId,
    );

    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "EVIDENCE_READY",
        intent: originalEvent.intent,
        payload: {
          original_event_id: eventId,
          agent_id: agentId,
          evidence_pack: evidencePack,
        },
        parent_event_id: eventId,
        status: "CLOSED",
      }),
    );

    // ── TASK_CLOSED or TASK_FAILED ──
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: result.success ? "TASK_CLOSED" : "TASK_FAILED",
        intent: originalEvent.intent,
        payload: {
          original_event_id: eventId,
          agent_id: agentId,
          message: result.success
            ? "Task completed via Claude"
            : `Task failed: ${result.error}`,
          // Distinguish permanent execution failures from transient errors.
          // Claude completed the session but reported failure → non-retryable.
          ...(!result.success && {
            reason: "execution_failed",
            error: result.error ?? "Claude execution completed with failure",
          }),
        },
        parent_event_id: originalEvent.parent_event_id,
        cost_delta: costDelta,
        status: "CLOSED",
      }),
    );

    if (originalEvent.parent_event_id) {
      await this.checkParentCompletion(originalEvent.parent_event_id);
    }
  }

  // ── Mock Completion flow ──

  private async completeMockExecution(
    eventId: string,
    agentId: string,
    originalEvent: SwarmEvent,
    execTimeMs: number,
  ): Promise<void> {
    // Clean up timers
    const ctx = this.executions.get(eventId);
    if (ctx) {
      clearInterval(ctx.heartbeatTimer);
      this.executions.delete(eventId);
    }

    // Mock cost
    const costDelta: CostDelta = {
      tokens_used: Math.floor(50 + Math.random() * 450),
      minutes_used: +(execTimeMs / 60_000).toFixed(4),
      cash_used: +(Math.random() * 0.05).toFixed(4),
    };

    // Release lease first (clears timer), then mark CLOSED
    await this.bus.release(eventId, agentId);
    const storedEvent = await this.bus.getEvent(eventId);
    if (storedEvent) {
      storedEvent.status = "CLOSED";
      storedEvent.updated_at = Date.now();
      storedEvent.cost_delta = costDelta;
    }

    // ── Publish ARTIFACT_READY ──
    const artifactId = crypto.randomUUID();
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "ARTIFACT_READY",
        intent: originalEvent.intent,
        payload: {
          original_event_id: eventId,
          agent_id: agentId,
          artifact_id: artifactId,
          artifact_type: "result",
          content: `[Mock artifact for: ${originalEvent.intent}]`,
        },
        parent_event_id: eventId,
        cost_delta: costDelta,
        status: "CLOSED",
      }),
    );

    // ── Publish EVIDENCE_READY ──
    const evidencePack = createEvidencePack(
      crypto.randomUUID(),
      [
        {
          type: "LOG",
          note: `Execution completed in ${Math.round(execTimeMs)}ms`,
          created_at: Date.now(),
        },
      ],
      agentId,
    );

    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "EVIDENCE_READY",
        intent: originalEvent.intent,
        payload: {
          original_event_id: eventId,
          agent_id: agentId,
          evidence_pack: evidencePack,
        },
        parent_event_id: eventId,
        status: "CLOSED",
      }),
    );

    // ── Publish TASK_CLOSED for this task ──
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "TASK_CLOSED",
        intent: originalEvent.intent,
        payload: {
          original_event_id: eventId,
          agent_id: agentId,
          message: "Task completed",
        },
        parent_event_id: originalEvent.parent_event_id,
        cost_delta: costDelta,
        status: "CLOSED",
      }),
    );

    // ── If sub-task, check parent completion ──
    if (originalEvent.parent_event_id) {
      await this.checkParentCompletion(originalEvent.parent_event_id);
    }
  }

  /**
   * Query all sibling sub-tasks. If every one is CLOSED or FAILED,
   * publish a TASK_CLOSED for the parent.
   */
  private async checkParentCompletion(parentEventId: string): Promise<void> {
    const siblings = await this.bus.query({
      parent_event_id: parentEventId,
      topic: "TASK_POSTED",
    });

    if (siblings.length === 0) return;

    const allDone = siblings.every(
      (s) => s.status === "CLOSED" || s.status === "FAILED",
    );

    if (!allDone) return;

    const parentEvent = await this.bus.getEvent(parentEventId);
    if (!parentEvent || parentEvent.status === "CLOSED") return;

    // Aggregate cost
    const totalCost: CostDelta = { tokens_used: 0, minutes_used: 0, cash_used: 0 };
    for (const sibling of siblings) {
      if (sibling.cost_delta) {
        totalCost.tokens_used += sibling.cost_delta.tokens_used;
        totalCost.minutes_used += sibling.cost_delta.minutes_used;
        totalCost.cash_used += sibling.cost_delta.cash_used;
      }
    }

    // Mark parent CLOSED
    parentEvent.status = "CLOSED";
    parentEvent.updated_at = Date.now();
    parentEvent.cost_delta = totalCost;

    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "TASK_CLOSED",
        intent: parentEvent.intent,
        payload: {
          original_event_id: parentEventId,
          sub_task_count: siblings.length,
          message: "All sub-tasks completed",
        },
        parent_event_id: parentEventId,
        cost_delta: totalCost,
        status: "CLOSED",
      }),
    );
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const ctx of this.executions.values()) {
      clearInterval(ctx.heartbeatTimer);
      clearTimeout(ctx.executionTimer);
    }
    this.executions.clear();
    this.processedEvents.clear();
  }
}
