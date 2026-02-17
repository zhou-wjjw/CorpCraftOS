// ──────────────────────────────────────────────
// Session Strategy — Decide how many parallel sessions a task needs
//
// "single"  → one Claude Code session handles the whole task
// "parallel" → SwarmEngine decomposes into N sub-tasks,
//              each executed as an independent session
// ──────────────────────────────────────────────

export type ExecutionStrategy = "single" | "parallel";

export interface TaskAnalysis {
  complexity: "simple" | "compound" | "complex";
  suggestedStrategy: ExecutionStrategy;
  /** Number of parallel sessions recommended */
  suggestedSessionCount?: number;
  suggestedRoles?: string[];
  estimatedTokens?: number;
}

/**
 * Analyze a task intent and its metadata to decide the execution strategy.
 *
 * - simple:   single tag, straightforward task → 1 session
 * - compound: multi-tag, can be decomposed     → N parallel sessions (via SwarmEngine decomposer)
 * - complex:  very large scope or explicit ask  → N parallel sessions with coordination
 */
export function analyzeTaskStrategy(
  intent: string,
  requiredTags: string[],
  hasSubTasks: boolean,
  parentEventId?: string,
): TaskAnalysis {
  // Sub-tasks from decomposition always run as single sessions
  if (parentEventId) {
    return {
      complexity: "simple",
      suggestedStrategy: "single",
      estimatedTokens: 2000,
    };
  }

  // Check for explicit collaboration keywords → SwarmEngine should decompose
  const parallelKeywords = [
    "team", "collaborate", "parallel", "together",
    "协作", "团队", "并行", "多人", "分工",
  ];
  const wantsParallel = parallelKeywords.some((kw) =>
    intent.toLowerCase().includes(kw),
  );

  if (wantsParallel) {
    return {
      complexity: "complex",
      suggestedStrategy: "parallel",
      suggestedSessionCount: Math.min(requiredTags.length + 1, 4),
      suggestedRoles: requiredTags,
      estimatedTokens: 10000,
    };
  }

  // Multi-tag tasks that haven't been decomposed yet
  if (requiredTags.length > 2 && !hasSubTasks) {
    return {
      complexity: "compound",
      suggestedStrategy: "parallel",
      suggestedSessionCount: Math.min(requiredTags.length, 3),
      suggestedRoles: requiredTags,
      estimatedTokens: 5000,
    };
  }

  return {
    complexity: "simple",
    suggestedStrategy: "single",
    estimatedTokens: 2000,
  };
}
