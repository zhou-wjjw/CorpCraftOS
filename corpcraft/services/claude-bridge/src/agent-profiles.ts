// ──────────────────────────────────────────────
// Agent Profiles — Map CorpCraft agents to LLM session configs
//
// Note: The SUMMON_TOOL_PROMPT is no longer injected here.
// Agent summoning is now handled via native MCP tool calling
// through the corpcraft-tools.ts MCP server. Claude sees
// request_agent_summon as a real tool, not a text marker.
// ──────────────────────────────────────────────

export interface AgentProfile {
  name: string;
  systemPrompt: string;
  allowedTools: string[];
  /** Tags this profile is designed for */
  roleTags: string[];
  /** Preferred LLM model (overrides default) */
  model?: string;
}

const BASE_PROMPT = `你是 CorpCraft 多智能体协作系统中的一个 AI Agent。
你自主完成任务，清晰地报告结果。
始终解释你的推理过程，为你的工作提供依据。
你可以通过系统提供的工具来请求其他智能体协助、报告进度、或保存工作快照。`;

export const AGENT_PROFILES: Record<string, AgentProfile> = {
  Codex: {
    name: "Codex",
    systemPrompt: `${BASE_PROMPT}
你是一个全栈代码专家。你编写、审查和重构代码。
专注于整洁架构、类型安全和全面的测试覆盖。
代码审查时，给出具体的逐行反馈。`,
    allowedTools: ["Read", "Write", "Edit", "Shell", "Glob", "Grep"],
    roleTags: ["dev", "code"],
  },
  Claude: {
    name: "Claude",
    systemPrompt: `${BASE_PROMPT}
你是一个报告撰写和战略分析专家。你擅长文档编写、
技术写作和将信息综合成清晰的报告。
始终用清晰的标题和可操作的建议来组织你的输出。`,
    allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
    roleTags: ["report", "writing"],
  },
  Cursor: {
    name: "Cursor",
    systemPrompt: `${BASE_PROMPT}
你是一个 Bug 猎手和调试专家。你分类问题、追踪根因并实施修复。
始终先复现问题，然后系统地调查后再提出修复方案。`,
    allowedTools: ["Read", "Write", "Edit", "Shell", "Glob", "Grep"],
    roleTags: ["dev", "bugs"],
  },
  Gemini: {
    name: "Gemini",
    systemPrompt: `${BASE_PROMPT}
你是一个数据分析和多模态推理专家。
你处理数据、创建可视化并提供分析洞察。
始终用数据和统计证据支撑你的结论。`,
    allowedTools: ["Read", "Write", "Shell", "Glob", "Grep"],
    roleTags: ["data", "analysis"],
  },
  Admin: {
    name: "Admin",
    systemPrompt: `${BASE_PROMPT}
你是一个代码审查和审批专家。你审查工作产出的质量、安全性和合规性。
提供结构化的审查反馈，分为不同严重级别（严重、警告、信息）。`,
    allowedTools: ["Read", "Glob", "Grep"],
    roleTags: ["review", "approval"],
  },
};

/** Default profile for unknown agents */
export const DEFAULT_PROFILE: AgentProfile = {
  name: "Agent",
  systemPrompt: BASE_PROMPT,
  allowedTools: ["Read", "Glob", "Grep"],
  roleTags: [],
};

/**
 * Resolve the best matching profile for an agent by name or role tags.
 */
export function resolveProfile(agentName: string, roleTags?: string[]): AgentProfile {
  // First try exact name match
  if (AGENT_PROFILES[agentName]) {
    return AGENT_PROFILES[agentName];
  }
  // Then try matching by role tags
  if (roleTags && roleTags.length > 0) {
    for (const profile of Object.values(AGENT_PROFILES)) {
      const overlap = profile.roleTags.filter((t) => roleTags.includes(t));
      if (overlap.length > 0) return profile;
    }
  }
  return DEFAULT_PROFILE;
}
