// ──────────────────────────────────────────────
// SwarmEngine: 主入口 — 组装所有模块
// ──────────────────────────────────────────────

import type { SwarmMetrics, HudState, AgentEntity } from "@corpcraft/contracts";
import type { IEventBus } from "@corpcraft/event-bus";

import { IntentRouter } from "./intent-router.js";
import { Decomposer } from "./decomposer.js";
import { Matcher } from "./matcher.js";
import { Executor, type ExecutionMode } from "./executor.js";
import { Recovery } from "./recovery.js";
import { CompactionService } from "./compaction.js";
import { BudgetTracker } from "./budget-tracker.js";
import { MetricsCollector } from "./metrics-collector.js";
import { TaskAnalyzer } from "./task-analyzer.js";
import { Summoner } from "./summoner.js";

export class SwarmEngine {
  readonly router: IntentRouter;
  readonly decomposer: Decomposer;
  readonly matcher: Matcher;
  readonly executor: Executor;
  readonly recovery: Recovery;
  readonly compaction: CompactionService;
  readonly budgetTracker: BudgetTracker;
  readonly metricsCollector: MetricsCollector;
  readonly taskAnalyzer: TaskAnalyzer;
  readonly summoner: Summoner;

  constructor(bus: IEventBus) {
    this.router = new IntentRouter(bus);
    this.executor = new Executor(bus);
    // Decomposer receives a mode getter: decompose only in "team" mode
    this.decomposer = new Decomposer(bus, () => this.executor.mode);
    this.matcher = new Matcher(bus);
    this.recovery = new Recovery(bus);
    this.compaction = new CompactionService(bus);
    this.budgetTracker = new BudgetTracker(bus);
    this.metricsCollector = new MetricsCollector(bus, this.recovery);
    this.taskAnalyzer = new TaskAnalyzer(bus);
    this.summoner = new Summoner(
      bus,
      this.matcher,
      this.budgetTracker,
      () => this.executor.mode,
    );
  }

  /**
   * Wire up all event subscriptions.
   * Order matters: TaskAnalyzer → Decomposer → Matcher → Executor → Summoner
   * TaskAnalyzer subscribes BEFORE Decomposer to analyze first.
   * Summoner subscribes last — it reacts to claimed/progress/analyzed events.
   */
  init(): void {
    this.taskAnalyzer.init();
    this.decomposer.init();
    this.matcher.init();
    this.executor.init();
    this.recovery.init();
    this.compaction.init();
    this.budgetTracker.init();
    this.summoner.init();
  }

  async shutdown(): Promise<void> {
    this.summoner.shutdown();
    this.taskAnalyzer.shutdown();
    this.decomposer.shutdown();
    this.matcher.shutdown();
    this.executor.shutdown();
    this.recovery.shutdown();
    this.compaction.shutdown();
    this.budgetTracker.shutdown();
  }

  // ── Public queries ──

  getHudState(): HudState {
    return this.budgetTracker.getHudState();
  }

  getMetrics(): SwarmMetrics {
    return this.metricsCollector.getMetrics();
  }

  getAgents(): AgentEntity[] {
    return this.matcher.getAllAgents();
  }

  get matcherRegistry(): Map<string, AgentEntity> {
    return this.matcher.registry;
  }

  // ── Execution mode runtime control ──

  getExecutionMode(): ExecutionMode {
    return this.executor.mode;
  }

  setExecutionMode(mode: ExecutionMode): void {
    this.executor.setMode(mode);
  }
}

// ── Re-exports for convenience ──

export { IntentRouter } from "./intent-router.js";
export type { RouteIntentOptions } from "./intent-router.js";
export { Decomposer } from "./decomposer.js";
export { Matcher } from "./matcher.js";
export { Executor, type ExecutionMode } from "./executor.js";
export { Recovery } from "./recovery.js";
export { CompactionService } from "./compaction.js";
export { BudgetTracker } from "./budget-tracker.js";
export { MetricsCollector } from "./metrics-collector.js";
export { TaskAnalyzer } from "./task-analyzer.js";
export { Summoner } from "./summoner.js";
