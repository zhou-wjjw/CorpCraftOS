"use client";

import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import type { AgentEntity, SwarmEvent, EventStatus, AutonomyLevel } from "@corpcraft/contracts";
import {
  useSwarmStore,
  useAgentProgressDetails,
  useSubtasks,
  useTaskArtifacts,
  useAgentWorkState,
  useAgentStatusReport,
  useZoneCollabSession,
} from "@/hooks/useSwarmStore";

// ──────────────────────────────────────────────
// AgentInspector — Right-side detail panel
// Enhanced: Evidence + Active Skill + Sandbox PiP + Skill Equip
// + Task Stage Bar + Progress Log + Subtasks + Artifacts
// ──────────────────────────────────────────────

const MONO = "'SF Mono', 'Fira Code', monospace";

const STATUS_COLORS: Record<string, string> = {
  IDLE: "#6b7280",
  EVALUATING: "#60a5fa",
  CLAIMED: "#facc15",
  EXEC_TOOL: "#a78bfa",
  EXEC_SANDBOX: "#a78bfa",
  WAIT_HUMAN: "#fb923c",
  FAILED: "#f87171",
  DONE: "#4ade80",
};

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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "4px 0",
        fontSize: 12,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span
        style={{
          color: "#4ade80",
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}
        >
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Extract evidence from events for this agent */
function useAgentEvidence(agentId: string, events: SwarmEvent[]) {
  return useMemo(() => {
    return events.filter(
      (e) =>
        e.topic === "EVIDENCE_READY" &&
        ((e.payload?.agent_id as string) === agentId || e.claimed_by === agentId),
    );
  }, [agentId, events]);
}

/** Extract active skill from current task */
function getActiveSkill(currentTask: SwarmEvent | null): string | null {
  if (!currentTask) return null;
  const payload = currentTask.payload as Record<string, unknown> | undefined;
  if (payload?.skill_id) return String(payload.skill_id);
  if (payload?.tool) return String(payload.tool);
  return null;
}

// ── Task Stage Bar ──

const TASK_STAGES: { key: EventStatus; label: string }[] = [
  { key: "OPEN", label: "Open" },
  { key: "CLAIMED", label: "Claimed" },
  { key: "RESOLVING", label: "Resolving" },
  { key: "CLOSED", label: "Closed" },
];

const STAGE_INDEX: Record<string, number> = {
  OPEN: 0,
  CLAIMED: 1,
  RESOLVING: 2,
  BLOCKED: 2,
  FAILED: -1,
  CLOSED: 3,
};

function TaskStageBar({ status, createdAt }: { status: EventStatus; createdAt: number }) {
  const currentIdx = STAGE_INDEX[status] ?? 0;
  const isFailed = status === "FAILED";
  const elapsed = Math.max(0, Date.now() - createdAt);
  const elapsedStr =
    elapsed < 60_000
      ? `${Math.floor(elapsed / 1_000)}s`
      : elapsed < 3_600_000
        ? `${Math.floor(elapsed / 60_000)}m ${Math.floor((elapsed % 60_000) / 1_000)}s`
        : `${Math.floor(elapsed / 3_600_000)}h ${Math.floor((elapsed % 3_600_000) / 60_000)}m`;

  return (
    <div style={{ marginTop: 8 }}>
      {/* Stage dots + connectors */}
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {TASK_STAGES.map((stage, i) => {
          const isActive = i === currentIdx && !isFailed;
          const isPast = i < currentIdx && !isFailed;
          const dotColor = isFailed && i <= 1
            ? "#f87171"
            : isActive
              ? "#60a5fa"
              : isPast
                ? "#4ade80"
                : "rgba(255,255,255,0.15)";
          return (
            <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: i < TASK_STAGES.length - 1 ? 1 : undefined }}>
              {/* Dot */}
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    width: isActive ? 10 : 8,
                    height: isActive ? 10 : 8,
                    borderRadius: "50%",
                    background: dotColor,
                    boxShadow: isActive ? `0 0 8px ${dotColor}` : undefined,
                    transition: "all 0.3s ease",
                  }}
                />
                {/* Label below dot */}
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 8,
                    fontFamily: MONO,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#60a5fa" : isPast ? "#4ade80" : "rgba(255,255,255,0.25)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stage.label}
                </div>
              </div>
              {/* Connector line */}
              {i < TASK_STAGES.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: isPast ? "#4ade80" : "rgba(255,255,255,0.08)",
                    borderRadius: 1,
                    margin: "0 4px",
                    transition: "background 0.3s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Failed badge */}
      {isFailed && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#f87171", fontWeight: 700, fontFamily: MONO }}>FAILED</span>
        </div>
      )}

      {/* Elapsed time */}
      <div
        style={{
          marginTop: isFailed ? 4 : 20,
          fontSize: 9,
          color: "rgba(255,255,255,0.3)",
          fontFamily: MONO,
        }}
      >
        Elapsed: {elapsedStr}
      </div>
    </div>
  );
}

// ── Progress Log ──

const PROGRESS_KIND_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  thinking: { icon: "💭", color: "#60a5fa", label: "Thinking" },
  tool_use: { icon: "🔧", color: "#facc15", label: "Tool" },
  text: { icon: "📝", color: "#a78bfa", label: "Output" },
  result: { icon: "✅", color: "#4ade80", label: "Result" },
  error: { icon: "⚠", color: "#f87171", label: "Error" },
  team_status: { icon: "👥", color: "#c084fc", label: "Team" },
};

function ProgressLog({ agentId }: { agentId: string }) {
  const details = useAgentProgressDetails(agentId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [details.length]);

  if (details.length === 0) return null;

  return (
    <Section title="Progress Log">
      <div
        ref={scrollRef}
        style={{
          maxHeight: 200,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          scrollbarWidth: "thin",
        }}
      >
        {details.map((d, i) => {
          const cfg = PROGRESS_KIND_CONFIG[d.kind] ?? { icon: "●", color: "#6b7280", label: d.kind };
          const isExpanded = expandedIdx === i;
          const relTime = formatRelativeTime(d.timestamp);

          return (
            <div
              key={`${d.eventId}-${i}`}
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
              style={{
                padding: "6px 8px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 6,
                borderLeft: `3px solid ${cfg.color}44`,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, flexShrink: 0 }}>{cfg.icon}</span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: MONO,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: isExpanded ? "pre-wrap" : "nowrap",
                    wordBreak: isExpanded ? "break-word" : undefined,
                    lineHeight: 1.4,
                  }}
                >
                  {d.kind === "tool_use" && d.toolName
                    ? d.toolName
                    : d.content.length > 60 && !isExpanded
                      ? d.content.slice(0, 60) + "..."
                      : d.content}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    color: "rgba(255,255,255,0.2)",
                    fontFamily: MONO,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {relTime}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── Subtasks list ──

function SubtasksList({
  parentEventId,
  agents,
}: {
  parentEventId: string | undefined;
  agents: AgentEntity[];
}) {
  const subtasks = useSubtasks(parentEventId);

  if (subtasks.length === 0) return null;

  return (
    <Section title={`Subtasks (${subtasks.length})`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {subtasks.map((st) => {
          const stColor = STATUS_COLORS[st.status] ?? "#6b7280";
          const claimedAgent = st.claimed_by
            ? agents.find((a) => a.agent_id === st.claimed_by)
            : undefined;
          return (
            <div
              key={st.event_id}
              style={{
                padding: "6px 10px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <Badge text={st.status} color={stColor} />
                {claimedAgent && (
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: MONO }}>
                    {claimedAgent.name}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {st.intent}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── Artifacts / Results ──

function ArtifactsList({
  taskEventId,
  taskStatus,
}: {
  taskEventId: string | undefined;
  taskStatus: string | undefined;
}) {
  const artifacts = useTaskArtifacts(taskEventId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isInProgress =
    taskStatus && !["CLOSED", "FAILED"].includes(taskStatus);

  if (artifacts.length === 0 && !isInProgress) return null;

  return (
    <Section title={`Results${artifacts.length > 0 ? ` (${artifacts.length})` : ""}`}>
      {artifacts.length === 0 ? (
        <div
          style={{
            padding: "10px 12px",
            background: "rgba(96, 165, 250, 0.05)",
            borderRadius: 8,
            border: "1px dashed rgba(96, 165, 250, 0.15)",
            fontSize: 11,
            color: "rgba(255,255,255,0.35)",
            fontFamily: MONO,
            textAlign: "center",
          }}
        >
          In progress...
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {artifacts.map((art) => {
            const payload = art.payload as Record<string, unknown> | undefined;
            const content = (payload?.content as string) ?? "";
            const artType = (payload?.artifact_type as string) ?? "result";
            const success = (payload?.success as boolean) !== false;
            const isExpanded = expandedId === art.event_id;
            const relTime = formatRelativeTime(art.created_at);

            return (
              <div
                key={art.event_id}
                style={{
                  background: success ? "rgba(74, 222, 128, 0.05)" : "rgba(248, 113, 113, 0.05)",
                  borderRadius: 8,
                  border: `1px solid ${success ? "rgba(74, 222, 128, 0.12)" : "rgba(248, 113, 113, 0.12)"}`,
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : art.event_id)}
                  style={{
                    padding: "6px 10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    borderBottom: isExpanded ? "1px solid rgba(255,255,255,0.04)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Badge text={artType} color={success ? "#4ade80" : "#f87171"} />
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: MONO }}>
                      {relTime}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.3)",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    }}
                  >
                    ▼
                  </span>
                </div>

                {/* Preview (collapsed) */}
                {!isExpanded && content && (
                  <div
                    style={{
                      padding: "6px 10px",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.5)",
                      fontFamily: MONO,
                      lineHeight: 1.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {content.slice(0, 150)}
                  </div>
                )}

                {/* Full content (expanded) */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "8px 10px",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.7)",
                      fontFamily: MONO,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 300,
                      overflowY: "auto",
                      scrollbarWidth: "thin",
                    }}
                  >
                    {content || "(empty)"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ── Relative time helper ──

function formatRelativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 1_000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  return `${Math.floor(diff / 3_600_000)}h`;
}

// ── Autonomy Level Slider ──

const AUTONOMY_LABELS: Record<number, { label: string; color: string; desc: string }> = {
  0: { label: "Manual", color: "#6b7280", desc: "User must approve all actions" },
  1: { label: "Semi-Auto", color: "#60a5fa", desc: "Agent suggests, user approves" },
  2: { label: "Auto+Notify", color: "#facc15", desc: "Agent acts, user gets notified" },
  3: { label: "Autonomous", color: "#4ade80", desc: "Fully independent operation" },
};

function AutonomySlider({ agentId, currentLevel }: { agentId: string; currentLevel: AutonomyLevel }) {
  const setAgentAutonomy = useSwarmStore((s) => s.setAgentAutonomy);
  const info = AUTONOMY_LABELS[currentLevel];

  return (
    <Section title="Autonomy Level">
      <div style={{ padding: "4px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <Badge text={info.label} color={info.color} />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: MONO }}>
            {info.desc}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={currentLevel}
          onChange={(e) => setAgentAutonomy(agentId, Number(e.target.value) as AutonomyLevel)}
          style={{
            width: "100%",
            height: 4,
            appearance: "none",
            background: `linear-gradient(to right, ${info.color}66, ${info.color})`,
            borderRadius: 2,
            outline: "none",
            cursor: "pointer",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 8,
            color: "rgba(255,255,255,0.2)",
            fontFamily: MONO,
            marginTop: 4,
          }}
        >
          <span>0</span>
          <span>1</span>
          <span>2</span>
          <span>3</span>
        </div>
      </div>
    </Section>
  );
}

// ── Work Queue Section ──

function WorkQueueSection({ agentId }: { agentId: string }) {
  const workState = useAgentWorkState(agentId);
  const report = useAgentStatusReport(agentId);

  if (!workState && !report) return null;

  const pendingTasks = workState?.pending_queue ?? [];
  const blockers = workState?.blockers ?? [];
  const currentReport = report?.current_task;

  return (
    <>
      {/* Status Report */}
      {currentReport && (
        <Section title="Status Report">
          <div
            style={{
              padding: "8px 12px",
              background: "rgba(96, 165, 250, 0.06)",
              borderRadius: 8,
              border: "1px solid rgba(96, 165, 250, 0.12)",
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
              {currentReport.intent}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 10, fontFamily: MONO }}>
              <span style={{ color: "#60a5fa" }}>
                {currentReport.progress_pct.toFixed(0)}%
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>
                ETA: {currentReport.eta_minutes.toFixed(0)}m
              </span>
            </div>
            {/* Progress bar */}
            <div
              style={{
                marginTop: 6,
                height: 3,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${currentReport.progress_pct}%`,
                  height: "100%",
                  background: "linear-gradient(to right, #60a5fa, #4ade80)",
                  borderRadius: 2,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        </Section>
      )}

      {/* Pending Work Queue */}
      {pendingTasks.length > 0 && (
        <Section title={`Work Queue (${pendingTasks.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {pendingTasks.slice(0, 5).map((task, i) => (
              <div
                key={task.event_id}
                style={{
                  padding: "6px 10px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.65)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.25)", fontFamily: MONO, fontSize: 9, marginRight: 6 }}>
                      #{i + 1}
                    </span>
                    {task.intent}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: MONO,
                      color: task.priority_score >= 80 ? "#f87171" : task.priority_score >= 60 ? "#facc15" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    P{task.priority_score}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: MONO, color: "rgba(255,255,255,0.25)" }}>
                    ~{task.estimated_minutes}m
                  </span>
                </div>
              </div>
            ))}
            {pendingTasks.length > 5 && (
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", fontFamily: MONO }}>
                +{pendingTasks.length - 5} more
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Blockers */}
      {blockers.length > 0 && (
        <Section title={`Blockers (${blockers.length})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {blockers.map((b) => (
              <div
                key={b.blocker_id}
                style={{
                  padding: "6px 10px",
                  background: "rgba(248, 113, 113, 0.06)",
                  borderRadius: 6,
                  border: "1px solid rgba(248, 113, 113, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Badge text={b.type} color="#f87171" />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                  {b.description.slice(0, 50)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Summary stats */}
      {report && (
        <div style={{ display: "flex", gap: 12, fontSize: 10, fontFamily: MONO, color: "rgba(255,255,255,0.3)" }}>
          <span>Completed today: {report.total_completed_today}</span>
          <span>Pending: {report.pending_count}</span>
        </div>
      )}
    </>
  );
}

// ── Collaboration Section ──

function CollaborationSection({ agentId, zoneId }: { agentId: string; zoneId: string | undefined }) {
  const session = useZoneCollabSession(zoneId);

  if (!session) return null;

  const myMember = session.members.find((m) => m.agent_id === agentId);
  const otherMembers = session.members.filter((m) => m.agent_id !== agentId);

  return (
    <Section title="Zone Collaboration">
      <div
        style={{
          padding: "8px 12px",
          background: "rgba(167, 139, 250, 0.06)",
          borderRadius: 8,
          border: "1px solid rgba(167, 139, 250, 0.12)",
        }}
      >
        {/* My role */}
        {myMember && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Badge
              text={myMember.role}
              color={myMember.role === "LEAD" ? "#facc15" : "#a78bfa"}
            />
            <Badge text={myMember.join_status} color="#60a5fa" />
          </div>
        )}

        {/* Other members */}
        {otherMembers.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: MONO, marginBottom: 4 }}>
              COLLABORATORS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {otherMembers.map((m) => (
                <div
                  key={m.agent_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: m.join_status === "ACTIVE" ? "#4ade80" : "#6b7280",
                    flexShrink: 0,
                  }} />
                  <span>{m.agent_name}</span>
                  <Badge text={m.role} color={m.role === "LEAD" ? "#facc15" : "rgba(255,255,255,0.3)"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Work plan summary */}
        {session.work_plan.tasks.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: MONO, marginBottom: 4 }}>
              WORK PLAN ({session.work_plan.tasks.length} tasks)
            </div>
            {session.work_plan.tasks.slice(0, 3).map((t) => {
              const statusColor = t.status === "DONE" ? "#4ade80" : t.status === "IN_PROGRESS" ? "#60a5fa" : t.status === "BLOCKED" ? "#f87171" : "rgba(255,255,255,0.3)";
              return (
                <div
                  key={t.task_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 10,
                    color: "rgba(255,255,255,0.5)",
                    padding: "2px 0",
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.intent}
                  </span>
                  <span style={{ fontSize: 8, fontFamily: MONO, color: "rgba(255,255,255,0.2)" }}>
                    P{t.priority}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}

// ── Agent Detail (main panel) ──

function AgentDetail({ agent, onClose }: { agent: AgentEntity; onClose: () => void }) {
  const events = useSwarmStore((s) => s.events);
  const agents = useSwarmStore((s) => s.agents);
  const openSettingsModal = useSwarmStore((s) => s.openSettingsModal);
  const openSkillPanel = useSwarmStore((s) => s.openSkillPanel);

  const currentTask = useMemo(
    () =>
      agent.current_event_id
        ? events.find((e) => e.event_id === agent.current_event_id)
        : null,
    [agent.current_event_id, events],
  );

  const evidenceEvents = useAgentEvidence(agent.agent_id, events);
  const activeSkill = getActiveSkill(currentTask ?? null);

  const statusColor = STATUS_COLORS[agent.status] ?? "#6b7280";
  const hasSandbox = !!(agent as unknown as Record<string, unknown>).active_sandbox;

  const handleOpenSkillPanel = useCallback(() => {
    openSkillPanel(agent.agent_id);
  }, [openSkillPanel, agent.agent_id]);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 340,
          height: "100vh",
          background: "rgba(10, 10, 15, 0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          zIndex: 100,
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
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              {agent.name}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge text={agent.kind} color={agent.kind === "AI" ? "#60a5fa" : "#4ade80"} />
              <Badge text={agent.status} color={statusColor} />
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
          {/* Quick actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => openSettingsModal(agent.agent_id)}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.6)", fontSize: 11,
                fontWeight: 600, cursor: "pointer",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
              }}
            >
              ⚙ Settings
            </button>
          </div>

          {/* Active Skill */}
          {activeSkill && (
            <Section title="Active Skill">
              <div
                style={{
                  padding: "8px 12px",
                  background: "rgba(167, 139, 250, 0.1)",
                  borderRadius: 8,
                  border: "1px solid rgba(167, 139, 250, 0.2)",
                  fontSize: 12,
                  color: "#a78bfa",
                  fontWeight: 600,
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                }}
              >
                {activeSkill}
              </div>
            </Section>
          )}

          {/* Role tags */}
          {agent.role_tags.length > 0 && (
            <Section title="Roles">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {agent.role_tags.map((tag) => (
                  <Badge key={tag} text={tag} color="#a78bfa" />
                ))}
              </div>
            </Section>
          )}

          {/* Skills with Equip button */}
          <Section
            title="Skills"
            action={
              <button
                onClick={handleOpenSkillPanel}
                style={{
                  fontSize: 9,
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: "1px solid rgba(74, 222, 128, 0.3)",
                  background: "rgba(74, 222, 128, 0.08)",
                  color: "#4ade80",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                EQUIP
              </button>
            }
          >
            {agent.equipped_skills.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {agent.equipped_skills.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 8,
                      fontSize: 12,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.7)" }}>{s.id}</span>
                    <span
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: 10,
                      }}
                    >
                      v{s.version}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>No skills equipped</div>
            )}
          </Section>

          {/* Metrics */}
          <Section title="Performance (7d)">
            <StatRow label="Success Rate" value={`${(agent.metrics.success_rate_7d * 100).toFixed(0)}%`} />
            <StatRow label="Avg Cycle" value={`${agent.metrics.avg_cycle_sec_7d.toFixed(1)}s`} />
            <StatRow label="Token Cost" value={`$${agent.metrics.token_cost_7d.toFixed(2)}`} />
            <StatRow label="Approval Wait" value={`${agent.metrics.approval_wait_sec_7d.toFixed(1)}s`} />
          </Section>

          {/* Current task + Stage Bar */}
          {currentTask && (
            <Section title="Current Task">
              <div
                style={{
                  padding: "10px 12px",
                  background: "rgba(96, 165, 250, 0.08)",
                  borderRadius: 8,
                  border: "1px solid rgba(96, 165, 250, 0.15)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "#60a5fa",
                    fontWeight: 600,
                    fontFamily: MONO,
                    marginBottom: 4,
                  }}
                >
                  {currentTask.topic} · {currentTask.status}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {currentTask.intent}
                </div>
                {currentTask.cost_delta && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: MONO,
                    }}
                  >
                    {currentTask.cost_delta.tokens_used.toLocaleString()} tokens ·
                    ${currentTask.cost_delta.cash_used.toFixed(3)}
                  </div>
                )}

                {/* Task Stage Bar */}
                <TaskStageBar
                  status={currentTask.status as EventStatus}
                  createdAt={currentTask.created_at}
                />
              </div>
            </Section>
          )}

          {/* Autonomy Level */}
          <AutonomySlider agentId={agent.agent_id} currentLevel={agent.autonomy_level ?? 1} />

          {/* Work Queue + Status Report + Blockers */}
          <WorkQueueSection agentId={agent.agent_id} />

          {/* Zone Collaboration */}
          <CollaborationSection agentId={agent.agent_id} zoneId={agent.zone_id} />

          {/* Progress Log */}
          <ProgressLog agentId={agent.agent_id} />

          {/* Subtasks */}
          <SubtasksList
            parentEventId={currentTask?.event_id}
            agents={agents}
          />

          {/* Artifacts / Results */}
          <ArtifactsList
            taskEventId={currentTask?.event_id}
            taskStatus={currentTask?.status}
          />

          {/* Evidence */}
          {evidenceEvents.length > 0 && (
            <Section title="Evidence">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {evidenceEvents.slice(0, 5).map((ev) => {
                  const payload = ev.payload as Record<string, unknown> | undefined;
                  const items = (payload?.items ?? payload?.evidence ?? []) as Array<{
                    type?: string;
                    label?: string;
                    url?: string;
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
                      <div
                        style={{
                          fontSize: 10,
                          color: "#4ade80",
                          fontWeight: 600,
                          fontFamily: "'SF Mono', 'Fira Code', monospace",
                          marginBottom: 4,
                        }}
                      >
                        {ev.intent?.slice(0, 40) || "Evidence"}
                      </div>
                      {items.length > 0 ? (
                        items.map((item, i) => (
                          <div key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                            {item.type && <Badge text={item.type} color="#60a5fa" />}{" "}
                            {item.label ?? item.url ?? "item"}
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

          {/* Sandbox PiP */}
          {hasSandbox && (
            <Section title="Sandbox">
              <button
                onClick={() => {
                  console.log("[AgentInspector] Open sandbox PiP for", agent.agent_id);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(96, 165, 250, 0.08)",
                  borderRadius: 8,
                  border: "1px solid rgba(96, 165, 250, 0.15)",
                  color: "#60a5fa",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                }}
              >
                Open PiP Viewer
              </button>
            </Section>
          )}

          {/* Position info */}
          <Section title="Position">
            <div
              style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              ({agent.position.x.toFixed(1)}, {agent.position.y.toFixed(1)},{" "}
              {agent.position.z.toFixed(1)})
              {agent.zone_id && (
                <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.25)" }}>
                  Zone: {agent.zone_id}
                </span>
              )}
            </div>
          </Section>
        </div>

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}

export default function AgentInspector() {
  const selectedIds = useSwarmStore((s) => s.selectedAgentIds);
  const agents = useSwarmStore((s) => s.agents);
  const setSelectedAgents = useSwarmStore((s) => s.setSelectedAgents);

  const selectedAgent = useMemo(
    () =>
      selectedIds.length > 0
        ? agents.find((a) => a.agent_id === selectedIds[0])
        : undefined,
    [selectedIds, agents],
  );

  if (!selectedAgent) return null;

  return (
    <AgentDetail
      agent={selectedAgent}
      onClose={() => setSelectedAgents([])}
    />
  );
}
