"use client";

import { useMemo } from "react";
import type { SwarmEvent } from "@corpcraft/contracts";
import { useSwarmStore } from "@/hooks/useSwarmStore";

// ──────────────────────────────────────────────
// TaskResultPanel — Slide-out panel showing task execution results
// Displays artifact content, evidence, cost, and execution logs
// ──────────────────────────────────────────────

const MONO = "'SF Mono', 'Fira Code', monospace";

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {text}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontFamily: MONO,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 1_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

/** Collect all related events for a task by original_event_id or parent_event_id */
function useTaskEvents(taskEventId: string, events: SwarmEvent[]) {
  return useMemo(() => {
    const rootEvent = events.find((e) => e.event_id === taskEventId);
    if (!rootEvent) return { rootEvent: null, artifacts: [], evidence: [], progress: [], subTasks: [], closed: [] };

    // Find all events related to this task
    const related = events.filter(
      (e) =>
        e.event_id === taskEventId ||
        (e.payload?.original_event_id as string) === taskEventId ||
        e.parent_event_id === taskEventId,
    );

    const artifacts = related.filter((e) => e.topic === "ARTIFACT_READY");
    const evidence = related.filter((e) => e.topic === "EVIDENCE_READY");
    const progress = related.filter((e) => e.topic === "TASK_PROGRESS");
    const subTasks = related.filter(
      (e) => e.topic === "TASK_POSTED" && e.parent_event_id === taskEventId,
    );
    const closed = related.filter(
      (e) => e.topic === "TASK_CLOSED" || e.topic === "TASK_FAILED",
    );

    return { rootEvent, artifacts, evidence, progress, subTasks, closed };
  }, [taskEventId, events]);
}

interface TaskResultDetailProps {
  taskEventId: string;
  onClose: () => void;
}

function TaskResultDetail({ taskEventId, onClose }: TaskResultDetailProps) {
  const events = useSwarmStore((s) => s.events);
  const executionMode = useSwarmStore((s) => s.executionMode);
  const progressDetails = useSwarmStore((s) => s.progressDetails);
  const { rootEvent, artifacts, evidence, progress, subTasks, closed } =
    useTaskEvents(taskEventId, events);

  if (!rootEvent) return null;

  const statusColor =
    rootEvent.status === "CLOSED"
      ? "#4ade80"
      : rootEvent.status === "FAILED"
        ? "#f87171"
        : "#facc15";

  // Aggregate cost from closed events
  const totalCost = closed.reduce(
    (acc, e) => {
      if (e.cost_delta) {
        acc.tokens += e.cost_delta.tokens_used;
        acc.cash += e.cost_delta.cash_used;
        acc.minutes += e.cost_delta.minutes_used;
      }
      return acc;
    },
    { tokens: 0, cash: 0, minutes: 0 },
  );

  // Use rootEvent cost if no aggregated cost
  if (totalCost.tokens === 0 && rootEvent.cost_delta) {
    totalCost.tokens = rootEvent.cost_delta.tokens_used;
    totalCost.cash = rootEvent.cost_delta.cash_used;
    totalCost.minutes = rootEvent.cost_delta.minutes_used;
  }

  // Get relevant progress details for this task
  const taskProgress = progressDetails.filter((d) => {
    // Match by event chain
    return progress.some(
      (p) =>
        (p.payload?.agent_id as string) === d.agentId,
    );
  });

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 400,
        height: "100vh",
        background: "rgba(10, 10, 15, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        zIndex: 110,
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
        animation: "slideInRight 0.25s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontFamily: MONO,
              marginBottom: 6,
            }}
          >
            Task Result
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge text={rootEvent.status} color={statusColor} />
            <Badge text={executionMode.toUpperCase()} color="#a78bfa" />
            {subTasks.length > 0 && (
              <Badge text={`${subTasks.length} sub-tasks`} color="#60a5fa" />
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "rgba(255,255,255,0.5)",
            fontSize: 16,
          }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Intent */}
        <Section title="Intent">
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(96, 165, 250, 0.08)",
              borderRadius: 8,
              border: "1px solid rgba(96, 165, 250, 0.15)",
              fontSize: 13,
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1.5,
            }}
          >
            {rootEvent.intent}
          </div>
        </Section>

        {/* Cost & Timing */}
        {(totalCost.tokens > 0 || rootEvent.created_at) && (
          <Section title="Execution">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {totalCost.tokens > 0 && (
                <div
                  style={{
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: MONO, marginBottom: 2 }}>
                    TOKENS
                  </div>
                  <div style={{ color: "#4ade80", fontWeight: 700, fontFamily: MONO }}>
                    {totalCost.tokens.toLocaleString()}
                  </div>
                </div>
              )}
              {totalCost.cash > 0 && (
                <div
                  style={{
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: MONO, marginBottom: 2 }}>
                    COST
                  </div>
                  <div style={{ color: "#facc15", fontWeight: 700, fontFamily: MONO }}>
                    ${totalCost.cash.toFixed(4)}
                  </div>
                </div>
              )}
              <div
                style={{
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
              >
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: MONO, marginBottom: 2 }}>
                  CREATED
                </div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontFamily: MONO }}>
                  {relativeTime(rootEvent.created_at)}
                </div>
              </div>
              {rootEvent.required_tags.length > 0 && (
                <div
                  style={{
                    padding: "8px 10px",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontFamily: MONO, marginBottom: 2 }}>
                    TAGS
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {rootEvent.required_tags.map((t) => (
                      <Badge key={t} text={t} color="#a78bfa" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Artifact Content */}
        {artifacts.length > 0 && (
          <Section title="Artifacts">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {artifacts.map((art) => {
                const payload = art.payload as Record<string, unknown> | undefined;
                const content = (payload?.content as string) ?? "";
                const artifactType = (payload?.artifact_type as string) ?? "result";
                const success = payload?.success as boolean | undefined;

                return (
                  <div
                    key={art.event_id}
                    style={{
                      background: "rgba(74, 222, 128, 0.06)",
                      borderRadius: 8,
                      border: `1px solid ${success === false ? "rgba(248, 113, 113, 0.2)" : "rgba(74, 222, 128, 0.15)"}`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "6px 10px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Badge text={artifactType} color={success === false ? "#f87171" : "#4ade80"} />
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: MONO }}>
                        {relativeTime(art.created_at)}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "10px 12px",
                        fontSize: 12,
                        color: "rgba(255,255,255,0.75)",
                        lineHeight: 1.6,
                        fontFamily: MONO,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 300,
                        overflowY: "auto",
                      }}
                    >
                      {content || "(empty)"}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Sub-tasks (if decomposed) */}
        {subTasks.length > 0 && (
          <Section title="Sub-tasks">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {subTasks.map((st) => {
                const stStatus = st.status === "CLOSED" ? "#4ade80" : st.status === "FAILED" ? "#f87171" : "#facc15";
                return (
                  <div
                    key={st.event_id}
                    style={{
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Badge text={st.status} color={stStatus} />
                      {st.cost_delta && (
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: MONO }}>
                          {st.cost_delta.tokens_used} tok
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                      {st.intent}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Evidence */}
        {evidence.length > 0 && (
          <Section title="Evidence">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {evidence.map((ev) => {
                const payload = ev.payload as Record<string, unknown> | undefined;
                const pack = payload?.evidence_pack as Record<string, unknown> | undefined;
                const items = (pack?.items ?? []) as Array<{
                  type?: string;
                  note?: string;
                  created_at?: number;
                }>;
                return (
                  <div
                    key={ev.event_id}
                    style={{
                      padding: "8px 10px",
                      background: "rgba(74, 222, 128, 0.06)",
                      borderRadius: 8,
                      border: "1px solid rgba(74, 222, 128, 0.12)",
                    }}
                  >
                    {items.length > 0 ? (
                      items.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.6)",
                            padding: "2px 0",
                            fontFamily: MONO,
                          }}
                        >
                          {item.type && <Badge text={item.type} color="#60a5fa" />}{" "}
                          {item.note ?? "evidence item"}
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                        Evidence collected
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Execution Logs */}
        {taskProgress.length > 0 && (
          <Section title="Execution Logs">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {taskProgress.slice(0, 20).map((d, i) => {
                const kindColors: Record<string, string> = {
                  thinking: "#60a5fa",
                  tool_use: "#facc15",
                  text: "#4ade80",
                  result: "#4ade80",
                  error: "#f87171",
                  team_status: "#a78bfa",
                };
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      fontFamily: MONO,
                      color: kindColors[d.kind] ?? "rgba(255,255,255,0.5)",
                      padding: "3px 0",
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ opacity: 0.5 }}>[{d.kind}]</span>{" "}
                    {d.content.slice(0, 120)}
                    {d.content.length > 120 ? "..." : ""}
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function TaskResultPanel() {
  const selectedTaskEventId = useSwarmStore((s) => s.selectedTaskEventId);
  const closeTaskResult = useSwarmStore((s) => s.closeTaskResult);

  if (!selectedTaskEventId) return null;

  return (
    <TaskResultDetail
      taskEventId={selectedTaskEventId}
      onClose={closeTaskResult}
    />
  );
}
