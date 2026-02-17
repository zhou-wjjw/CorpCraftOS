// ──────────────────────────────────────────────
// Claude Bridge — Agent SDK integration layer
//
// Uses the Claude Agent SDK with in-process MCP tool servers
// for native custom tool calling. Each agent runs as an
// independent session with access to CorpCraft-specific tools
// (request_agent_summon, report_progress, save_context_snapshot).
//
// SwarmEngine handles multi-agent coordination via
// task decomposition + parallel sessions.
// ──────────────────────────────────────────────

export { executeTask } from "./claude-session.js";
export type { SessionConfig, ExecutionProgress, ExecutionResult } from "./claude-session.js";

export { AGENT_PROFILES, DEFAULT_PROFILE, resolveProfile } from "./agent-profiles.js";
export type { AgentProfile } from "./agent-profiles.js";

export { createCorpCraftToolServer, CORPCRAFT_TOOL_NAMES } from "./corpcraft-tools.js";
export type { ToolCallbackContext } from "./corpcraft-tools.js";

export { analyzeTaskStrategy } from "./session-strategy.js";
export type { TaskAnalysis, ExecutionStrategy } from "./session-strategy.js";
