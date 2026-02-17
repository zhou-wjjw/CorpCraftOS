// ──────────────────────────────────────────────
// Autonomy Engine — Self-driving agent capabilities
//
// Five pillars:
// 1. CronScheduler   — Proactive task generation on schedule
// 2. WatchReactor    — Event-driven auto-activation
// 3. AgentComms      — Inter-agent communication (sessions_*)
// 4. CollabProtocol  — Zone-based collaboration management
// 5. WorkPlanner     — Per-agent autonomous work planning
//
// Inspired by OpenClaw's always-on gateway, cron sessions,
// and sessions_list/send/spawn/history tools.
// ──────────────────────────────────────────────

export { CronScheduler } from "./cron-scheduler.js";
export type { CronJobDef } from "./cron-scheduler.js";

export { WatchReactor } from "./watch-reactor.js";
export type { WatchPattern } from "./watch-reactor.js";

export { AgentComms } from "./agent-comms.js";
export type {
  AgentSession,
  SessionMessage,
  SessionStatus,
} from "./agent-comms.js";

export { CollabProtocol } from "./collab-protocol.js";

export { WorkPlanner, computePriority } from "./work-planner.js";
