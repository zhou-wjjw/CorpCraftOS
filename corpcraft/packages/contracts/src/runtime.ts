// ──────────────────────────────────────────────
// Agent Runtime State (Compaction / 快照)
// ──────────────────────────────────────────────

export interface AgentRuntimeState {
  agent_id: string;
  compacted_memory: string;
  working_set_refs: string[];
  last_compaction_at: number;
}
