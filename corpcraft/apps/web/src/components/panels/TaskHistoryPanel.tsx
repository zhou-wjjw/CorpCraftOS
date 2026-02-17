"use client";

import { useMemo, useState, useCallback } from "react";
import type { AgentEntity, SwarmEvent } from "@corpcraft/contracts";
import { useSwarmStore, type CompletedTaskRecord } from "@/hooks/useSwarmStore";

// ──────────────────────────────────────────────
// TaskHistoryPanel — Completed task history viewer
// Tabs: All Tasks / By Agent
// Shows task results inline with expand/collapse
// ──────────────────────────────────────────────

const MONO = "'SF Mono', 'Fira Code', monospace";

type TabId = "all" | "by-agent";

// ── Utilities ──

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 1_000) return "刚刚";
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return `${Math.floor(diff / 86_400_000)}天前`;
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 5,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.05em",
        background: `${color}18`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {text}
    </span>
  );
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.05em",
        background: "rgba(96, 165, 250, 0.15)",
        color: "#60a5fa",
        border: "1px solid rgba(96, 165, 250, 0.25)",
      }}
    >
      {tag}
    </span>
  );
}

// ── Artifact preview helpers ──

function extractArtifactContent(artifacts: SwarmEvent[]): string | null {
  if (artifacts.length === 0) return null;
  const first = artifacts[0];
  const payload = first.payload as Record<string, unknown> | undefined;
  return (payload?.content as string) ?? null;
}

function extractArtifactType(artifact: SwarmEvent): string {
  const payload = artifact.payload as Record<string, unknown> | undefined;
  return (payload?.artifact_type as string) ?? "result";
}

function extractArtifactSuccess(artifact: SwarmEvent): boolean {
  const payload = artifact.payload as Record<string, unknown> | undefined;
  return (payload?.success as boolean) !== false;
}

// ── Task History Card ──

function HistoryCard({
  record,
  agents,
  onOpenDetail,
}: {
  record: CompletedTaskRecord;
  agents: AgentEntity[];
  onOpenDetail: (eventId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { task, artifacts, costDelta, completedAt } = record;

  const isClosed = task.status === "CLOSED";
  const statusColor = isClosed ? "#4ade80" : "#f87171";
  const statusLabel = isClosed ? "DONE" : "FAILED";

  const claimedAgent = task.claimed_by
    ? agents.find((a) => a.agent_id === task.claimed_by)
    : undefined;

  const previewContent = extractArtifactContent(artifacts);

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => !prev);
  }, []);

  const handleOpenDetail = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenDetail(task.event_id);
    },
    [onOpenDetail, task.event_id],
  );

  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: 10,
        border: `1px solid ${isClosed ? "rgba(74, 222, 128, 0.08)" : "rgba(248, 113, 113, 0.08)"}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transition: "border-color 0.2s ease",
      }}
    >
      {/* Header: status + time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Badge text={statusLabel} color={statusColor} />
        <span
          style={{
            fontSize: 9,
            color: "rgba(255, 255, 255, 0.35)",
            fontFamily: MONO,
          }}
        >
          {relativeTime(completedAt)}
        </span>
      </div>

      {/* Intent text */}
      <div
        style={{
          fontSize: 12,
          color: "rgba(255, 255, 255, 0.85)",
          lineHeight: 1.4,
        }}
      >
        {task.intent}
      </div>

      {/* Result preview */}
      {previewContent && !expanded && (
        <div
          style={{
            padding: "6px 8px",
            background: "rgba(74, 222, 128, 0.05)",
            borderRadius: 6,
            border: "1px solid rgba(74, 222, 128, 0.1)",
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.55)",
            lineHeight: 1.5,
            fontFamily: MONO,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {previewContent.slice(0, 200)}
        </div>
      )}

      {/* Cost summary when no artifacts */}
      {!previewContent && costDelta && (
        <div
          style={{
            display: "flex",
            gap: 10,
            fontSize: 10,
            fontFamily: MONO,
            color: "rgba(255, 255, 255, 0.4)",
          }}
        >
          {costDelta.tokens_used > 0 && (
            <span>{costDelta.tokens_used.toLocaleString()} tok</span>
          )}
          {costDelta.cash_used > 0 && (
            <span>${costDelta.cash_used.toFixed(4)}</span>
          )}
        </div>
      )}

      {/* Expanded: full artifact content */}
      {expanded && artifacts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {artifacts.map((art) => {
            const content = (art.payload as Record<string, unknown>)?.content as string ?? "";
            const artType = extractArtifactType(art);
            const success = extractArtifactSuccess(art);
            return (
              <div
                key={art.event_id}
                style={{
                  background: "rgba(74, 222, 128, 0.05)",
                  borderRadius: 8,
                  border: `1px solid ${success ? "rgba(74, 222, 128, 0.12)" : "rgba(248, 113, 113, 0.15)"}`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "5px 8px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Badge text={artType} color={success ? "#4ade80" : "#f87171"} />
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: MONO }}>
                    {relativeTime(art.created_at)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.7)",
                    lineHeight: 1.6,
                    fontFamily: MONO,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {content || "(empty)"}
                </div>
              </div>
            );
          })}

          {/* Cost in expanded view */}
          {costDelta && (costDelta.tokens_used > 0 || costDelta.cash_used > 0) && (
            <div
              style={{
                display: "flex",
                gap: 12,
                padding: "6px 8px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 6,
                fontSize: 10,
                fontFamily: MONO,
              }}
            >
              {costDelta.tokens_used > 0 && (
                <span style={{ color: "#4ade80" }}>
                  {costDelta.tokens_used.toLocaleString()} tokens
                </span>
              )}
              {costDelta.cash_used > 0 && (
                <span style={{ color: "#facc15" }}>
                  ${costDelta.cash_used.toFixed(4)}
                </span>
              )}
              {costDelta.minutes_used > 0 && (
                <span style={{ color: "rgba(255,255,255,0.4)" }}>
                  {costDelta.minutes_used.toFixed(1)} min
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tags + Agent + Actions row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {task.required_tags.map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
        {claimedAgent && (
          <span
            style={{
              fontSize: 9,
              color: "rgba(255, 255, 255, 0.45)",
            }}
          >
            {claimedAgent.name}
          </span>
        )}

        {/* Spacer */}
        <span style={{ flex: 1 }} />

        {/* Expand / Collapse button */}
        {(artifacts.length > 0 || (record.evidence.length > 0)) && (
          <button
            onClick={toggleExpand}
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              fontFamily: MONO,
            }}
          >
            {expanded ? "收起" : "展开结果"}
          </button>
        )}

        {/* Detail button → opens TaskResultPanel */}
        <button
          onClick={handleOpenDetail}
          style={{
            fontSize: 9,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid rgba(96, 165, 250, 0.25)",
            background: "rgba(96, 165, 250, 0.08)",
            color: "#60a5fa",
            cursor: "pointer",
            fontFamily: MONO,
          }}
        >
          详情
        </button>
      </div>
    </div>
  );
}

// ── Agent selector pill ──

function AgentPill({
  agent,
  count,
  selected,
  onClick,
}: {
  agent: AgentEntity;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 12,
        border: selected
          ? "1px solid rgba(96, 165, 250, 0.5)"
          : "1px solid rgba(255, 255, 255, 0.08)",
        background: selected
          ? "rgba(96, 165, 250, 0.12)"
          : "rgba(255, 255, 255, 0.04)",
        color: selected ? "#60a5fa" : "rgba(255, 255, 255, 0.6)",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: selected ? 700 : 500,
        fontFamily: MONO,
        transition: "all 0.15s ease",
      }}
    >
      <span>{agent.name}</span>
      <span
        style={{
          fontSize: 9,
          opacity: 0.6,
          background: selected
            ? "rgba(96, 165, 250, 0.2)"
            : "rgba(255, 255, 255, 0.08)",
          padding: "1px 5px",
          borderRadius: 8,
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ── Main Panel ──

export default function TaskHistoryPanel() {
  const taskHistoryOpen = useSwarmStore((s) => s.taskHistoryOpen);
  const closeTaskHistory = useSwarmStore((s) => s.closeTaskHistory);
  const completedTaskMap = useSwarmStore((s) => s.completedTaskMap);
  const agents = useSwarmStore((s) => s.agents);
  const events = useSwarmStore((s) => s.events);
  const openTaskResult = useSwarmStore((s) => s.openTaskResult);

  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Build completed records list: merge completedTaskMap + any current CLOSED/FAILED from events
  const allRecords = useMemo(() => {
    const map = new Map(completedTaskMap);

    // Also include TASK_POSTED events with CLOSED/FAILED status from events that
    // might not have been captured by the pushEvent aggregator yet
    const seen = new Set(map.keys());
    for (const ev of events) {
      if (
        ev.topic === "TASK_POSTED" &&
        (ev.status === "CLOSED" || ev.status === "FAILED") &&
        !seen.has(ev.event_id)
      ) {
        // Build a lightweight record from current events
        const related = events.filter(
          (e) =>
            e.event_id === ev.event_id ||
            (e.payload?.original_event_id as string) === ev.event_id ||
            e.parent_event_id === ev.event_id,
        );
        map.set(ev.event_id, {
          task: ev,
          artifacts: related.filter((e) => e.topic === "ARTIFACT_READY"),
          evidence: related.filter((e) => e.topic === "EVIDENCE_READY"),
          subTasks: related.filter(
            (e) => e.topic === "TASK_POSTED" && e.event_id !== ev.event_id,
          ),
          closedEvent:
            related.find(
              (e) => e.topic === "TASK_CLOSED" || e.topic === "TASK_FAILED",
            ) ?? null,
          costDelta: ev.cost_delta ?? null,
          completedAt: ev.updated_at,
        });
      }
    }

    // Sort by completedAt descending
    return Array.from(map.values()).sort(
      (a, b) => b.completedAt - a.completedAt,
    );
  }, [completedTaskMap, events]);

  // Per-agent counts
  const agentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rec of allRecords) {
      const agentId = rec.task.claimed_by;
      if (agentId) {
        counts.set(agentId, (counts.get(agentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [allRecords]);

  // Agents that have completed tasks (sorted by count desc), plus all other agents
  const agentList = useMemo(() => {
    const withCounts = agents
      .map((a) => ({ agent: a, count: agentCounts.get(a.agent_id) ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
    const withoutCounts = agents
      .filter((a) => !agentCounts.has(a.agent_id))
      .map((a) => ({ agent: a, count: 0 }));
    return [...withCounts, ...withoutCounts];
  }, [agents, agentCounts]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (activeTab === "all" || !selectedAgentId) return allRecords;
    return allRecords.filter((r) => r.task.claimed_by === selectedAgentId);
  }, [activeTab, selectedAgentId, allRecords]);

  const doneCount = useMemo(
    () => filteredRecords.filter((r) => r.task.status === "CLOSED").length,
    [filteredRecords],
  );
  const failedCount = useMemo(
    () => filteredRecords.filter((r) => r.task.status === "FAILED").length,
    [filteredRecords],
  );

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      closeTaskHistory();
    },
    [closeTaskHistory],
  );

  const handleOpenDetail = useCallback(
    (eventId: string) => {
      openTaskResult(eventId);
    },
    [openTaskResult],
  );

  if (!taskHistoryOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 60,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 75,
        width: "min(500px, calc(100vw - 140px))",
        maxHeight: "calc(100vh - 140px)",
        background: "rgba(10, 10, 18, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 16px 64px rgba(0, 0, 0, 0.55)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "taskHistoryFadeIn 0.2s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 0",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#4ade80",
              letterSpacing: "0.08em",
              fontFamily: MONO,
            }}
          >
            TASK HISTORY
          </span>
          <button
            onClick={handleClose}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 6,
              color: "rgba(255, 255, 255, 0.5)",
              cursor: "pointer",
              padding: "2px 8px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 2,
            background: "rgba(255, 255, 255, 0.04)",
            borderRadius: 10,
            padding: 3,
            marginBottom: 10,
          }}
        >
          {([
            { id: "all" as TabId, label: "全部任务" },
            { id: "by-agent" as TabId, label: "按智能体" },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                border: "none",
                fontSize: 11,
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontFamily: MONO,
                color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.4)",
                background: activeTab === tab.id
                  ? "rgba(255, 255, 255, 0.1)"
                  : "transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Agent selector (by-agent tab) */}
        {activeTab === "by-agent" && (
          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              paddingBottom: 10,
              scrollbarWidth: "thin",
            }}
          >
            {/* "All" pill */}
            <AgentPill
              agent={{ agent_id: "__all__", name: "全部", kind: "AI", role_tags: [], status: "IDLE", position: { x: 0, y: 0, z: 0 }, equipped_skills: [], metrics: { success_rate_7d: 0, avg_cycle_sec_7d: 0, token_cost_7d: 0, approval_wait_sec_7d: 0 } } as AgentEntity}
              count={allRecords.length}
              selected={!selectedAgentId}
              onClick={() => setSelectedAgentId(null)}
            />
            {agentList.map(({ agent, count }) => (
              <AgentPill
                key={agent.agent_id}
                agent={agent}
                count={count}
                selected={selectedAgentId === agent.agent_id}
                onClick={() =>
                  setSelectedAgentId(
                    selectedAgentId === agent.agent_id ? null : agent.agent_id,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />

      {/* Task list */}
      <div
        style={{
          padding: "10px 12px",
          overflowY: "auto",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {filteredRecords.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 32,
              color: "rgba(255, 255, 255, 0.25)",
              fontSize: 12,
              fontFamily: MONO,
            }}
          >
            {activeTab === "by-agent" && selectedAgentId
              ? "该智能体暂无已完成的任务"
              : "暂无已完成的任务"}
          </div>
        ) : (
          filteredRecords.map((record) => (
            <HistoryCard
              key={record.task.event_id}
              record={record}
              agents={agents}
              onOpenDetail={handleOpenDetail}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: 10,
          color: "rgba(255, 255, 255, 0.3)",
          fontFamily: MONO,
          textAlign: "center",
          flexShrink: 0,
          display: "flex",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <span>
          <span style={{ color: "#4ade80" }}>{doneCount}</span> 已完成
        </span>
        {failedCount > 0 && (
          <span>
            <span style={{ color: "#f87171" }}>{failedCount}</span> 已失败
          </span>
        )}
        <span>{filteredRecords.length} 总计</span>
      </div>

      <style>{`
        @keyframes taskHistoryFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
