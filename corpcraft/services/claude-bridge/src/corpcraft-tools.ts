// ──────────────────────────────────────────────
// CorpCraft MCP Tool Server — In-process tools for agent autonomy
//
// Defines custom tools that Claude can natively call during execution.
// Each tool handler receives structured, Zod-validated input and
// publishes events directly to the CorpCraft event bus.
//
// Tools:
//   - request_agent_summon: Request a specialist agent to join and collaborate
//   - report_progress: Submit structured progress updates
//   - save_context_snapshot: Proactively save mental state for later resumption
// ──────────────────────────────────────────────

import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// ── Tool callback context ──
// Injected at session creation time so tool handlers can interact
// with the CorpCraft system without circular dependencies.

export interface ToolCallbackContext {
  agentId: string;
  agentName: string;
  zoneId?: string;
  /** Publish an event to the CorpCraft event bus */
  publishEvent: (topic: string, intent: string, payload: Record<string, unknown>) => Promise<void>;
}

// ── Factory: creates a per-session MCP server with bound context ──

export function createCorpCraftToolServer(ctx: ToolCallbackContext) {
  return createSdkMcpServer({
    name: "corpcraft-agent-tools",
    version: "1.0.0",
    tools: [
      // ─── request_agent_summon ───
      // When an agent determines it needs help, it calls this tool.
      // The handler publishes AGENT_SUMMON_REQUEST to the event bus,
      // which triggers the Summoner → Matcher → Executor pipeline
      // to spawn or reuse a REAL agent entity.
      tool(
        "request_agent_summon",
        [
          "Request a new or idle specialist agent to join your zone and collaborate.",
          "Use this when the current task requires skills you don't possess,",
          "or when you estimate the work will take significantly longer alone.",
          "The system will dispatch a real agent with its own independent session.",
          "You can optionally suggest a specific task for the new agent,",
          "but they will still negotiate the work plan through the collaboration protocol.",
        ].join(" "),
        {
          required_tags: z
            .array(z.string())
            .min(1)
            .describe("Skill tags needed, e.g. ['frontend', 'react'] or ['database', 'sql']"),
          urgency: z
            .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
            .describe("How urgently reinforcement is needed"),
          reason: z
            .string()
            .min(5)
            .describe("Brief explanation of why help is needed — shown to the project owner"),
          suggested_task: z
            .string()
            .optional()
            .describe("Optional: a specific task for the new agent. They will still negotiate via the shared work plan."),
        },
        async (args) => {
          await ctx.publishEvent(
            "AGENT_SUMMON_REQUEST",
            `Agent ${ctx.agentName} requests reinforcement: ${args.reason}`,
            {
              requesting_agent_id: ctx.agentId,
              requesting_agent_name: ctx.agentName,
              reason: "EXPLICIT",
              required_tags: args.required_tags,
              urgency: args.urgency,
              context: args.reason,
              suggested_task: args.suggested_task,
              target_zone_id: ctx.zoneId,
            },
          );

          return {
            content: [
              {
                type: "text" as const,
                text: [
                  `Summon request submitted successfully.`,
                  `Required skills: ${args.required_tags.join(", ")}`,
                  `Urgency: ${args.urgency}`,
                  args.suggested_task
                    ? `Suggested task: ${args.suggested_task}`
                    : "",
                  `A specialist agent will be dispatched to your zone after approval.`,
                  `You can continue working on other parts of the task in the meantime.`,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            ],
          };
        },
      ),

      // ─── report_progress ───
      // Structured progress report — richer than raw text output.
      // The executor already captures streaming text, but this tool
      // provides an explicit, structured checkpoint.
      tool(
        "report_progress",
        [
          "Report your current progress on the task in a structured way.",
          "Use this at meaningful milestones (not every minor step).",
          "The report will be shown to the project owner and other collaborating agents.",
        ].join(" "),
        {
          progress_pct: z
            .number()
            .min(0)
            .max(100)
            .describe("Estimated completion percentage (0-100)"),
          summary: z
            .string()
            .describe("Brief summary of what has been accomplished so far"),
          next_steps: z
            .array(z.string())
            .optional()
            .describe("Planned next steps"),
          blockers: z
            .array(z.string())
            .optional()
            .describe("Any blockers or issues encountered"),
        },
        async (args) => {
          await ctx.publishEvent(
            "TASK_PROGRESS",
            `Progress report from ${ctx.agentName}`,
            {
              agent_id: ctx.agentId,
              progress_pct: args.progress_pct,
              message: args.summary,
              detail: [
                `## Progress: ${args.progress_pct}%`,
                "",
                args.summary,
                "",
                args.next_steps?.length
                  ? `### Next Steps\n${args.next_steps.map((s) => `- ${s}`).join("\n")}`
                  : "",
                args.blockers?.length
                  ? `### Blockers\n${args.blockers.map((b) => `- ${b}`).join("\n")}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
              kind: "result",
              structured_report: true,
            },
          );

          return {
            content: [
              {
                type: "text" as const,
                text: `Progress report recorded at ${args.progress_pct}%.`,
              },
            ],
          };
        },
      ),

      // ─── save_context_snapshot ───
      // Agent-initiated context save. Much richer than passively compiled
      // snapshots from progress events, because the agent knows its own
      // mental state, approach decisions, and partial work better than
      // we can reconstruct from output fragments.
      tool(
        "save_context_snapshot",
        [
          "Save your current work context as a checkpoint.",
          "Use this before starting a complex or risky operation,",
          "or when you sense you might be interrupted.",
          "If you are later interrupted and resumed, this snapshot",
          "will be injected into your system prompt so you can continue seamlessly.",
        ].join(" "),
        {
          summary: z
            .string()
            .describe("Markdown summary of your current progress, approach, and decisions made"),
          unresolved_issues: z
            .array(z.string())
            .describe("Open questions, bugs being investigated, or pending decisions"),
          key_files: z
            .array(z.string())
            .optional()
            .describe("Key file paths you have been working on"),
          approach_notes: z
            .string()
            .optional()
            .describe("Notes on your current approach or strategy that would be lost on context switch"),
        },
        async (args) => {
          const snapshotMarkdown = [
            `# Context Snapshot — ${ctx.agentName}`,
            `_Saved at ${new Date().toISOString()}_`,
            "",
            "## Progress Summary",
            args.summary,
            "",
            "## Unresolved Issues",
            ...args.unresolved_issues.map((issue) => `- ${issue}`),
            "",
            args.key_files?.length
              ? `## Key Files\n${args.key_files.map((f) => `- \`${f}\``).join("\n")}`
              : "",
            args.approach_notes
              ? `## Approach Notes\n${args.approach_notes}`
              : "",
          ]
            .filter(Boolean)
            .join("\n");

          await ctx.publishEvent(
            "AGENT_STATUS_REPORT",
            `Context snapshot from ${ctx.agentName}`,
            {
              agent_id: ctx.agentId,
              context_snapshot: snapshotMarkdown,
              snapshot_type: "agent_initiated",
            },
          );

          return {
            content: [
              {
                type: "text" as const,
                text: `Context snapshot saved (${snapshotMarkdown.length} chars). If you are interrupted, this will be restored on resume.`,
              },
            ],
          };
        },
      ),
    ],
  });
}

/** Tool names in MCP format for allowedTools configuration */
export const CORPCRAFT_TOOL_NAMES = [
  "mcp__corpcraft-agent-tools__request_agent_summon",
  "mcp__corpcraft-agent-tools__report_progress",
  "mcp__corpcraft-agent-tools__save_context_snapshot",
] as const;
