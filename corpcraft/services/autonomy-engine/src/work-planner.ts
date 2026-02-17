// ──────────────────────────────────────────────
// WorkPlanner — Per-agent autonomous work state manager
//
// Each agent maintains its own priority queue and work state.
// The planner:
//   - Scores and orders pending tasks by priority
//   - Proactively publishes status reports on a timer
//   - Handles user overrides (insert at top, pause current)
//   - Self-interrupts on high-priority arrivals
//   - Tracks blockers and estimated completion times
// ──────────────────────────────────────────────

import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";
import type {
  SwarmEvent,
  AgentWorkState,
  StackedTaskSnapshot,
  StatusReport,
  TaskSummary,
  Blocker,
  TaskSource,
} from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";

// ── Constants ──

const REPORT_INTERVAL_MS = 60_000;
const PRIORITY_INTERRUPT_DELTA = 30;
const MAX_PENDING_PER_AGENT = 20;
/** Max number of recent progress messages to keep per agent for snapshot generation */
const MAX_PROGRESS_BUFFER = 30;
/** Max snapshot markdown length (characters) */
const MAX_SNAPSHOT_LENGTH = 4000;

/**
 * Compute a priority score from 0–100.
 * Higher = more urgent.
 */
export function computePriority(
  source: TaskSource,
  urgency?: string,
  hasDependents?: boolean,
  waitingTimeMs?: number,
): number {
  let score = 50;
  if (source === "USER") score += 40;
  if (source === "SYSTEM") score += 20;
  if (urgency === "CRITICAL") score += 30;
  if (urgency === "HIGH") score += 20;
  if (urgency === "MEDIUM") score += 5;
  if (hasDependents) score += 10;
  if (waitingTimeMs && waitingTimeMs > 300_000) score += 15;
  return Math.min(score, 100);
}

export class WorkPlanner {
  /** Per-agent work states */
  private states = new Map<string, AgentWorkState>();
  private unsubscribe: Unsubscribe | null = null;
  private reportTimer: ReturnType<typeof setInterval> | null = null;
  /** Agent ID → name lookup */
  private agentNames = new Map<string, string>();
  /** Rolling buffer of recent progress messages per agent, used for snapshot generation */
  private progressBuffer = new Map<string, string[]>();

  constructor(private readonly bus: IEventBus) {}

  // ── Lifecycle ──

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      [
        "TASK_POSTED",
        "TASK_CLAIMED",
        "TASK_PROGRESS",
        "TASK_CLOSED",
        "TASK_FAILED",
        "APPROVAL_REQUIRED",
      ],
      this.handleEvent.bind(this),
    );

    // Start periodic status reporting
    this.reportTimer = setInterval(
      () => void this.publishAllReports(),
      REPORT_INTERVAL_MS,
    );
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    this.states.clear();
    this.agentNames.clear();
  }

  // ── Public API ──

  /**
   * Register an agent for work planning. Must be called when
   * an agent is recruited or enters the system.
   */
  registerAgent(agentId: string, agentName: string): void {
    this.agentNames.set(agentId, agentName);
    if (!this.states.has(agentId)) {
      this.states.set(agentId, {
        agent_id: agentId,
        current_task: null,
        task_stack: [],
        pending_queue: [],
        completed_count: 0,
        blockers: [],
        last_report_at: 0,
      });
    }
  }

  unregisterAgent(agentId: string): void {
    this.states.delete(agentId);
    this.agentNames.delete(agentId);
  }

  getWorkState(agentId: string): AgentWorkState | undefined {
    return this.states.get(agentId);
  }

  getAllWorkStates(): AgentWorkState[] {
    return [...this.states.values()];
  }

  /**
   * User forces a task onto an agent — insert at top of queue.
   * If the agent is currently working and pauseCurrent is true,
   * generates a context snapshot from recent progress and pushes
   * the interrupted task onto the task_stack for later resumption.
   */
  forceTask(
    agentId: string,
    task: TaskSummary,
    pauseCurrent: boolean,
  ): void {
    const state = this.getOrCreateState(agentId);

    // Override priority to maximum
    task.priority_score = 100;
    task.source = "USER";

    if (pauseCurrent && state.current_task) {
      // Generate context snapshot from accumulated progress buffer
      const snapshot = this.generateSnapshot(agentId, state.current_task);

      // Push interrupted task with snapshot onto the stack
      state.task_stack.push(snapshot);
      console.log(
        `[WorkPlanner] Agent ${agentId} interrupted. ` +
        `Task "${state.current_task.intent}" pushed to stack ` +
        `(depth: ${state.task_stack.length}). Snapshot: ${snapshot.context_snapshot.length} chars.`,
      );

      // Clear progress buffer for the new task
      this.progressBuffer.delete(agentId);

      state.current_task = task;
    } else if (!state.current_task) {
      state.current_task = task;
    } else {
      // Queue at top without interrupting
      state.pending_queue.unshift(task);
    }

    this.sortQueue(state);
  }

  /**
   * Generate a markdown context snapshot from the agent's recent
   * progress events. This captures thinking, tool usage, and
   * partial results to prevent "amnesia" on task resume.
   */
  private generateSnapshot(agentId: string, task: TaskSummary): StackedTaskSnapshot {
    const buffer = this.progressBuffer.get(agentId) ?? [];

    let markdown = `# Interrupted Task: ${task.intent}\n\n`;
    markdown += `- Progress: ${task.progress_pct}%\n`;
    markdown += `- Priority: ${task.priority_score}\n`;
    markdown += `- Estimated minutes remaining: ${(task.estimated_minutes * (1 - task.progress_pct / 100)).toFixed(1)}\n\n`;

    if (buffer.length > 0) {
      markdown += `## Recent Work Context\n\n`;
      for (const entry of buffer) {
        markdown += entry + "\n";
      }
    } else {
      markdown += `## Recent Work Context\n\n_No progress details captured._\n`;
    }

    // Truncate if too long
    if (markdown.length > MAX_SNAPSHOT_LENGTH) {
      markdown = markdown.slice(0, MAX_SNAPSHOT_LENGTH) + "\n\n...[truncated]";
    }

    return {
      task,
      interrupted_at: Date.now(),
      context_snapshot: markdown,
    };
  }

  /**
   * Resume the most recently interrupted task from the stack.
   * Called automatically when the current task completes and
   * the stack is non-empty. Posts a new TASK_POSTED event with
   * the snapshot injected as resume_context.
   */
  async resumeFromStack(agentId: string): Promise<boolean> {
    const state = this.states.get(agentId);
    if (!state || state.task_stack.length === 0) return false;

    const snapshot = state.task_stack.pop()!;
    const agentName = this.agentNames.get(agentId) ?? agentId;

    console.log(
      `[WorkPlanner] Agent ${agentId} resuming interrupted task: ` +
      `"${snapshot.task.intent}" (stack depth now: ${state.task_stack.length})`,
    );

    // Re-post the task with resume context so the executor can
    // inject it into the LLM system prompt
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "TASK_POSTED",
        intent: snapshot.task.intent,
        payload: {
          target_agent_id: agentId,
          agent_name: agentName,
          source: snapshot.task.source,
          resume_context: snapshot.context_snapshot,
          resumed_from_stack: true,
          original_progress_pct: snapshot.task.progress_pct,
        },
        budget: {
          max_tokens: 100_000,
          max_minutes: snapshot.task.estimated_minutes,
          max_cash: 1.0,
        },
        status: "OPEN",
      }),
    );

    return true;
  }

  /**
   * Build a status report for a specific agent.
   */
  buildStatusReport(agentId: string): StatusReport | null {
    const state = this.states.get(agentId);
    if (!state) return null;

    const agentName = this.agentNames.get(agentId) ?? agentId;

    return {
      agent_id: agentId,
      agent_name: agentName,
      current_task: state.current_task
        ? {
            intent: state.current_task.intent,
            progress_pct: state.current_task.progress_pct,
            eta_minutes: state.current_task.estimated_minutes * (1 - state.current_task.progress_pct / 100),
          }
        : null,
      pending_count: state.pending_queue.length,
      top_pending: state.pending_queue.slice(0, 5).map((t) => ({
        intent: t.intent,
        priority: t.priority_score,
        estimated_minutes: t.estimated_minutes,
      })),
      blockers: state.blockers,
      total_completed_today: state.completed_count,
      next_available_at: this.estimateNextAvailable(state),
    };
  }

  // ── Event Handler ──

  private async handleEvent(event: SwarmEvent): Promise<void> {
    switch (event.topic) {
      case "TASK_POSTED":
        this.handleTaskPosted(event);
        break;

      case "TASK_CLAIMED":
        this.handleTaskClaimed(event);
        break;

      case "TASK_PROGRESS":
        this.handleTaskProgress(event);
        break;

      case "TASK_CLOSED":
        await this.handleTaskCompleted(event, true);
        break;

      case "TASK_FAILED":
        await this.handleTaskCompleted(event, false);
        break;

      case "APPROVAL_REQUIRED":
        this.handleApprovalBlocker(event);
        break;
    }
  }

  private handleTaskPosted(event: SwarmEvent): void {
    // If this task targets a specific agent, add to their queue
    const targetAgent = event.payload?.target_agent_id as string | undefined;
    if (!targetAgent) return;

    const state = this.getOrCreateState(targetAgent);
    if (state.pending_queue.length >= MAX_PENDING_PER_AGENT) return;

    const source: TaskSource =
      (event.payload?.source as TaskSource) ?? "SYSTEM";
    const urgency = event.payload?.urgency as string | undefined;

    const task: TaskSummary = {
      event_id: event.event_id,
      intent: event.intent,
      priority_score: computePriority(source, urgency),
      source,
      estimated_minutes: (event.budget?.max_minutes ?? 5),
      progress_pct: 0,
      dependencies: [],
    };

    state.pending_queue.push(task);
    this.sortQueue(state);

    // Check if we should self-interrupt
    if (state.current_task) {
      const delta = task.priority_score - state.current_task.priority_score;
      if (delta >= PRIORITY_INTERRUPT_DELTA) {
        state.pending_queue.unshift(state.current_task);
        state.current_task = task;
        state.pending_queue = state.pending_queue.filter(
          (t) => t.event_id !== task.event_id,
        );
        this.sortQueue(state);
      }
    }
  }

  private handleTaskClaimed(event: SwarmEvent): void {
    const agentId = event.claimed_by;
    if (!agentId) return;

    const state = this.getOrCreateState(agentId);

    const task: TaskSummary = {
      event_id: event.event_id,
      intent: event.intent,
      priority_score: computePriority("SYSTEM"),
      source: "SYSTEM",
      estimated_minutes: (event.budget?.max_minutes ?? 5),
      progress_pct: 0,
      dependencies: [],
    };

    // Remove from pending if it was queued
    state.pending_queue = state.pending_queue.filter(
      (t) => t.event_id !== event.event_id,
    );

    // Set as current task
    if (!state.current_task) {
      state.current_task = task;
    } else {
      // Already working — add to queue
      state.pending_queue.unshift(task);
      this.sortQueue(state);
    }
  }

  private handleTaskProgress(event: SwarmEvent): void {
    const agentId = event.payload?.agent_id as string | undefined;
    if (!agentId) return;

    const state = this.states.get(agentId);
    if (!state?.current_task) return;

    // Update progress on current task
    const pct = event.payload?.progress_pct as number | undefined;
    if (typeof pct === "number") {
      state.current_task.progress_pct = pct;
    }

    // Accumulate progress messages into the rolling buffer for snapshot generation
    const kind = event.payload?.kind as string | undefined;
    const message = event.payload?.message as string | undefined;
    const detail = event.payload?.detail as string | undefined;
    const toolName = event.payload?.tool_name as string | undefined;

    if (message || detail) {
      let entry = "";
      if (kind === "thinking") {
        entry = `[Thinking] ${(detail ?? message ?? "").slice(0, 300)}`;
      } else if (kind === "tool_use" && toolName) {
        entry = `[Tool: ${toolName}] ${(message ?? "").slice(0, 200)}`;
      } else if (kind === "result") {
        entry = `[Result] ${(detail ?? message ?? "").slice(0, 300)}`;
      } else {
        entry = `[${kind ?? "progress"}] ${(message ?? "").slice(0, 200)}`;
      }

      if (!this.progressBuffer.has(agentId)) {
        this.progressBuffer.set(agentId, []);
      }
      const buffer = this.progressBuffer.get(agentId)!;
      buffer.push(entry);

      // Keep buffer bounded
      while (buffer.length > MAX_PROGRESS_BUFFER) {
        buffer.shift();
      }
    }
  }

  private async handleTaskCompleted(
    event: SwarmEvent,
    success: boolean,
  ): Promise<void> {
    const agentId = event.payload?.agent_id as string | undefined;
    if (!agentId) return;

    const state = this.states.get(agentId);
    if (!state) return;

    // Clear completed task
    if (
      state.current_task &&
      state.current_task.event_id === event.event_id
    ) {
      state.current_task = null;
    }

    // Remove from pending queue too
    state.pending_queue = state.pending_queue.filter(
      (t) => t.event_id !== event.event_id,
    );

    // Clear related blockers
    state.blockers = state.blockers.filter(
      (b) => b.blocked_task_id !== event.event_id,
    );

    // Clear progress buffer for the completed task
    this.progressBuffer.delete(agentId);

    if (success) state.completed_count++;

    // Check task_stack first — resume interrupted work before pulling from queue
    if (!state.current_task && state.task_stack.length > 0) {
      const resumed = await this.resumeFromStack(agentId);
      if (resumed) {
        await this.publishReport(agentId);
        return;
      }
    }

    // Promote next task from queue
    if (!state.current_task && state.pending_queue.length > 0) {
      state.current_task = state.pending_queue.shift()!;
    }

    // Publish a status report on task completion
    await this.publishReport(agentId);
  }

  private handleApprovalBlocker(event: SwarmEvent): void {
    const agentId = event.claimed_by;
    if (!agentId) return;

    const state = this.states.get(agentId);
    if (!state) return;

    const blocker: Blocker = {
      blocker_id: event.event_id,
      description: `Waiting for approval: ${event.intent}`,
      blocked_task_id: event.event_id,
      type: "WAITING_APPROVAL",
      since: Date.now(),
    };

    state.blockers.push(blocker);
  }

  // ── Status Reporting ──

  private async publishReport(agentId: string): Promise<void> {
    const report = this.buildStatusReport(agentId);
    if (!report) return;

    const state = this.states.get(agentId);
    if (state) state.last_report_at = Date.now();

    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "AGENT_STATUS_REPORT",
        intent: `Status report for ${report.agent_name}`,
        payload: { status_report: report },
        status: "CLOSED",
      }),
    );
  }

  private async publishAllReports(): Promise<void> {
    for (const agentId of this.states.keys()) {
      await this.publishReport(agentId);
    }
  }

  // ── Helpers ──

  private getOrCreateState(agentId: string): AgentWorkState {
    let state = this.states.get(agentId);
    if (!state) {
      state = {
        agent_id: agentId,
        current_task: null,
        task_stack: [],
        pending_queue: [],
        completed_count: 0,
        blockers: [],
        last_report_at: 0,
      };
      this.states.set(agentId, state);
    }
    return state;
  }

  private sortQueue(state: AgentWorkState): void {
    state.pending_queue.sort(
      (a, b) => b.priority_score - a.priority_score,
    );
  }

  private estimateNextAvailable(state: AgentWorkState): number {
    if (!state.current_task) return Date.now();

    const remainingMinutes =
      state.current_task.estimated_minutes *
      (1 - state.current_task.progress_pct / 100);

    let totalMinutes = remainingMinutes;
    for (const t of state.pending_queue) {
      totalMinutes += t.estimated_minutes;
    }

    return Date.now() + totalMinutes * 60_000;
  }
}
