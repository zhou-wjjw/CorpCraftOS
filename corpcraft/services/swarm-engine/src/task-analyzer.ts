// ──────────────────────────────────────────────
// TaskAnalyzer: 利用 Claude 对任务进行预分析
// 在 IntentRouter → Decomposer 之间插入分析步骤
// ──────────────────────────────────────────────

import type { SwarmEvent, CostDelta } from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

export interface AnalysisResult {
  complexity: "simple" | "compound" | "complex";
  suggestedDecomposition: string[];
  suggestedAgents: string[];
  estimatedTokens: number;
  reasoning: string;
}

export class TaskAnalyzer {
  private unsubscribe: Unsubscribe | null = null;
  private readonly processedEvents = new Set<string>();
  private static readonly MAX_PROCESSED = 2000;

  constructor(private readonly bus: IEventBus) {}

  // ── Lifecycle ──

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      ["TASK_POSTED"],
      this.handleTaskPosted.bind(this),
    );
  }

  // ── Handler ──

  private async handleTaskPosted(event: SwarmEvent): Promise<void> {
    if (this.processedEvents.has(event.event_id)) return;
    this.processedEvents.add(event.event_id);

    // Bounded cleanup
    if (this.processedEvents.size > TaskAnalyzer.MAX_PROCESSED) {
      const toDelete: string[] = [];
      let count = 0;
      for (const id of this.processedEvents) {
        if (count++ >= TaskAnalyzer.MAX_PROCESSED / 4) break;
        toDelete.push(id);
      }
      for (const id of toDelete) this.processedEvents.delete(id);
    }

    // Skip sub-tasks (they're already decomposed)
    if (event.parent_event_id) return;
    // Skip retry tasks (they should re-execute directly, not be re-analyzed)
    if (event.payload?.retry_of) return;

    const analysis = await this.analyzeTask(event);

    // Publish TASK_ANALYZED event
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "TASK_ANALYZED",
        intent: event.intent,
        payload: {
          original_event_id: event.event_id,
          analysis,
        },
        parent_event_id: event.event_id,
        status: "CLOSED",
      }),
    );
  }

  /**
   * Analyze a task to determine complexity and suggest decomposition.
   *
   * In `claude` / `team` mode, this will call the Claude Agent SDK for analysis.
   * In `mock` mode (default), uses heuristic analysis.
   */
  private async analyzeTask(event: SwarmEvent): Promise<AnalysisResult> {
    const mode = process.env.CORPCRAFT_EXECUTION_MODE ?? "mock";

    if (mode === "claude" || mode === "team") {
      return this.analyzeWithClaude(event);
    }

    return this.analyzeWithHeuristics(event);
  }

  /**
   * Heuristic-based analysis for mock mode.
   * Uses keyword matching and tag counting.
   */
  private analyzeWithHeuristics(event: SwarmEvent): AnalysisResult {
    const intent = event.intent.toLowerCase();
    const tags = event.required_tags;

    // Detect complexity keywords
    const complexKeywords = [
      "refactor", "migrate", "overhaul", "redesign",
      "重构", "迁移", "重新设计", "全面",
      "team", "collaborate", "协作", "团队",
    ];
    const compoundKeywords = [
      "and", "then", "also", "plus",
      "并且", "然后", "同时", "以及",
    ];

    const hasComplexKeyword = complexKeywords.some((kw) => intent.includes(kw));
    const hasCompoundKeyword = compoundKeywords.some((kw) => intent.includes(kw));

    let complexity: AnalysisResult["complexity"] = "simple";
    if (hasComplexKeyword || tags.length > 3) {
      complexity = "complex";
    } else if (hasCompoundKeyword || tags.length > 1) {
      complexity = "compound";
    }

    // Suggest decomposition based on tags
    const suggestedDecomposition: string[] = [];
    if (complexity !== "simple" && tags.length > 1) {
      for (const tag of tags) {
        suggestedDecomposition.push(`Sub-task for ${tag}: ${event.intent}`);
      }
    }

    // Suggest agents based on tags
    const tagToAgent: Record<string, string> = {
      dev: "Codex",
      code: "Codex",
      bugs: "Cursor",
      report: "Claude",
      writing: "Claude",
      data: "Gemini",
      analysis: "Gemini",
      review: "Admin",
      approval: "Admin",
    };

    const suggestedAgents = tags
      .map((t) => tagToAgent[t])
      .filter((a): a is string => !!a);

    // Estimate tokens
    const tokenMultiplier = complexity === "complex" ? 10000 : complexity === "compound" ? 5000 : 2000;

    return {
      complexity,
      suggestedDecomposition,
      suggestedAgents: [...new Set(suggestedAgents)],
      estimatedTokens: tokenMultiplier,
      reasoning: `Heuristic analysis: ${complexity} task with ${tags.length} tags`,
    };
  }

  /**
   * Claude-powered analysis for real execution modes.
   * Calls the claude-bridge service for intelligent task decomposition.
   */
  private async analyzeWithClaude(event: SwarmEvent): Promise<AnalysisResult> {
    try {
      // Dynamic import to handle cases where claude-bridge is not installed
      const bridge = await import("@corpcraft/claude-bridge");

      const config: import("@corpcraft/claude-bridge").SessionConfig = {
        agentProfile: bridge.DEFAULT_PROFILE,
        cwd: process.env.CORPCRAFT_WORK_DIR ?? process.cwd(),
        maxTokens: 1000,
      };

      const analysisPrompt = `Analyze the following task and respond ONLY with a JSON object:

Task: "${event.intent}"
Tags: [${event.required_tags.join(", ")}]
Risk: ${event.risk_level}

JSON format:
{
  "complexity": "simple" | "compound" | "complex",
  "suggestedDecomposition": ["sub-task 1", ...],
  "suggestedAgents": ["agent-name", ...],
  "estimatedTokens": number,
  "reasoning": "brief explanation"
}`;

      let resultText = "";
      const generator = bridge.executeTask(analysisPrompt, config);

      // Iterate through the generator to get the final result
      let iterResult = await generator.next();
      while (!iterResult.done) {
        const progress = iterResult.value;
        if (progress.kind === "text") {
          resultText += progress.content;
        }
        iterResult = await generator.next();
      }

      // Try to parse JSON from the result
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult;
        return {
          complexity: parsed.complexity ?? "simple",
          suggestedDecomposition: parsed.suggestedDecomposition ?? [],
          suggestedAgents: parsed.suggestedAgents ?? [],
          estimatedTokens: parsed.estimatedTokens ?? 2000,
          reasoning: parsed.reasoning ?? "Claude analysis",
        };
      }

      // Fallback to heuristics if parsing fails
      return this.analyzeWithHeuristics(event);
    } catch {
      // Fallback to heuristics if Claude is unavailable
      console.warn("[TaskAnalyzer] Claude analysis failed, using heuristics");
      return this.analyzeWithHeuristics(event);
    }
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.processedEvents.clear();
  }
}
