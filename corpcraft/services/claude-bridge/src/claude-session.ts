// ──────────────────────────────────────────────
// ClaudeSession — Claude Agent SDK execution engine
//
// Uses the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
// with in-process MCP tool servers for native tool calling.
//
// The SDK's `query()` function replaces raw CLI subprocess spawning.
// Custom CorpCraft tools (request_agent_summon, report_progress,
// save_context_snapshot) are injected as MCP servers, allowing
// Claude to call them natively with structured input/output.
//
// Claude Code's built-in tools (Read, Write, Shell, etc.) remain
// available alongside the custom tools.
// ──────────────────────────────────────────────

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentProfile } from "./agent-profiles.js";
import {
  createCorpCraftToolServer,
  CORPCRAFT_TOOL_NAMES,
  type ToolCallbackContext,
} from "./corpcraft-tools.js";

// ── Public Types ──

export interface SessionConfig {
  agentProfile: AgentProfile;
  cwd: string;
  maxTokens?: number;
  /** Enable Claude Code's native sub-agent spawning */
  teamMode?: boolean;
  /** Callback context for MCP tools to interact with the event bus */
  toolContext?: ToolCallbackContext;
}

export interface ExecutionProgress {
  kind: "thinking" | "tool_use" | "text" | "result" | "error" | "team_status";
  content: string;
  /** For tool_use events */
  toolName?: string;
  /** Token usage so far */
  tokensUsed?: number;
  /** For team_status events */
  teamMembers?: Array<{ name: string; status: string; task?: string }>;
}

export interface ExecutionResult {
  success: boolean;
  artifact: string;
  logs: string[];
  tokensUsed: number;
  durationMs: number;
  error?: string;
}

// ── Helpers ──

function ts(): string {
  return new Date().toISOString();
}

// ── Main Execution via Agent SDK ──

/**
 * Execute a task using the Claude Agent SDK with in-process MCP tools.
 *
 * Replaces the old CLI subprocess approach (`spawn("claude", args)`)
 * with the SDK's `query()` function, which provides:
 *   - Native MCP tool calling (structured input/output)
 *   - In-process execution (no subprocess management)
 *   - Streaming via async generator
 *   - All built-in Claude Code tools remain available
 */
export async function* executeTask(
  intent: string,
  config: SessionConfig,
): AsyncGenerator<ExecutionProgress, ExecutionResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  let totalTokens = 0;
  let fullContent = "";

  try {
    yield { kind: "thinking", content: `Claude Agent SDK session starting: ${intent.slice(0, 60)}` };

    // Build MCP servers map — inject CorpCraft tools if context is provided
    const mcpServers: Record<string, ReturnType<typeof createCorpCraftToolServer>> = {};
    if (config.toolContext) {
      mcpServers["corpcraft-agent-tools"] = createCorpCraftToolServer(config.toolContext);
    }

    // Build allowed tools list — include CorpCraft MCP tools
    const allowedTools: string[] = [...CORPCRAFT_TOOL_NAMES];

    console.log(
      `[Claude SDK] Starting query: "${intent.slice(0, 60)}" | cwd=${config.cwd} | tools=${Object.keys(mcpServers).join(",")}`,
    );
    logs.push(`[${ts()}] Starting Claude Agent SDK query`);

    // Build the prompt as an async generator (required for MCP tools)
    async function* generateMessages() {
      yield {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: intent,
        },
      };
    }

    // Execute via SDK query() with streaming
    let messageCount = 0;
    for await (const message of query({
      prompt: generateMessages(),
      options: {
        systemPrompt: config.agentProfile.systemPrompt,
        mcpServers: Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
        allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
        maxTurns: config.maxTokens ? Math.ceil(config.maxTokens / 4000) : 25,
        cwd: config.cwd,
      },
    })) {
      messageCount++;

      // Map SDK message types to ExecutionProgress
      if (message.type === "assistant") {
        const content =
          typeof message.message === "string"
            ? message.message
            : message.message?.content
              ? Array.isArray(message.message.content)
                ? message.message.content
                    .filter(
                      (b: { type: string; text?: string }) =>
                        b.type === "text" && b.text,
                    )
                    .map((b: { text?: string }) => b.text!)
                    .join("")
                : String(message.message.content)
              : "";

        if (content) {
          fullContent += content + "\n";

          // Check for tool_use blocks
          const toolBlocks = Array.isArray(message.message?.content)
            ? message.message.content.filter(
                (b: { type: string; name?: string }) => b.type === "tool_use",
              )
            : [];

          if (toolBlocks.length > 0) {
            for (const tb of toolBlocks) {
              const toolName = (tb as { name?: string }).name ?? "unknown";

              // Detect sub-agent spawning (Task tool)
              if (toolName === "Task") {
                const input = (tb as { input?: Record<string, unknown> }).input;
                const desc =
                  (input?.description as string) ??
                  (input?.prompt as string) ??
                  "sub-task";
                yield {
                  kind: "team_status",
                  content: `Sub-agent started: ${desc.slice(0, 100)}`,
                  toolName: "Task",
                  tokensUsed: totalTokens,
                  teamMembers: [
                    { name: "sub-agent", status: "working", task: desc.slice(0, 80) },
                  ],
                };
              } else {
                yield {
                  kind: "tool_use",
                  content: content.slice(0, 200) || `Using tool: ${toolName}`,
                  toolName,
                  tokensUsed: totalTokens,
                };
              }
            }
          } else {
            yield {
              kind: "text",
              content: content.slice(0, 200),
              tokensUsed: totalTokens,
            };
          }
        }
      }

      // Handle result messages
      if (message.type === "result") {
        if (message.subtype === "success") {
          const resultText =
            typeof message.result === "string"
              ? message.result
              : JSON.stringify(message.result);
          fullContent = resultText || fullContent;

          // Extract cost and usage if available
          const cost = (message as Record<string, unknown>).cost_usd as number | undefined;
          const usage = (message as Record<string, unknown>).usage as
            | { input_tokens?: number; output_tokens?: number }
            | undefined;

          if (usage) {
            totalTokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
          }

          yield {
            kind: "result",
            content: `Task completed (${messageCount} messages${cost ? `, $${cost.toFixed(4)}` : ""})`,
            tokensUsed: totalTokens,
          };

          logs.push(
            `[${ts()}] Result: messages=${messageCount} tokens=${totalTokens}${cost ? ` cost=$${cost.toFixed(4)}` : ""}`,
          );
        } else if (message.subtype === "error") {
          const errText =
            typeof message.result === "string"
              ? message.result
              : "Claude returned an error";
          yield { kind: "error", content: errText };
          logs.push(`[${ts()}] Error: ${errText}`);
        }
      }
    }

    logs.push(
      `[${ts()}] Claude Agent SDK session completed in ${Date.now() - startTime}ms`,
    );

    return {
      success: !!fullContent,
      artifact: fullContent || `[Claude completed: ${intent}]`,
      logs,
      tokensUsed: totalTokens || Math.ceil(fullContent.length / 2),
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logs.push(`[ERROR] ${errMsg}`);
    console.error(`[Claude SDK] Error: ${errMsg}`);
    yield { kind: "error", content: errMsg };

    return {
      success: false,
      artifact: "",
      logs,
      tokensUsed: totalTokens,
      durationMs: Date.now() - startTime,
      error: errMsg,
    };
  }
}
