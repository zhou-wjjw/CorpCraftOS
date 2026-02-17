"use client";

import { useMemo, useCallback } from "react";
import type { SwarmEvent, AgentEntity } from "@corpcraft/contracts";

// ──────────────────────────────────────────────
// TaskListPanel — Bounty board detail panel
// Shows open / in-progress / recent tasks with status
// Glassmorphism style consistent with other HUD panels
// ──────────────────────────────────────────────

interface TaskListPanelProps {
  events: SwarmEvent[];
  agents: AgentEntity[];
  open: boolean;
  onClose: () => void;
}

const RISK_COLORS: Record<string, string> = {
  LOW: "#4ade80",
  MEDIUM: "#fbbf24",
  HIGH: "#f87171",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: "OPEN", color: "#60a5fa" },
  CLAIMED: { label: "CLAIMED", color: "#fbbf24" },
  CLOSED: { label: "DONE", color: "#4ade80" },
  FAILED: { label: "FAILED", color: "#f87171" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
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

function TaskCard({
  event,
  agents,
}: {
  event: SwarmEvent;
  agents: AgentEntity[];
}) {
  const statusInfo = STATUS_LABELS[event.status] ?? STATUS_LABELS.OPEN;
  const riskColor = RISK_COLORS[event.risk_level] ?? RISK_COLORS.LOW;
  const claimedAgent = event.claimed_by
    ? agents.find((a) => a.agent_id === event.claimed_by)
    : undefined;

  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: 8,
        border: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Header row: status + time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: statusInfo.color,
            padding: "2px 6px",
            borderRadius: 4,
            background: `${statusInfo.color}18`,
            border: `1px solid ${statusInfo.color}33`,
          }}
        >
          {statusInfo.label}
        </span>
        <span
          style={{
            fontSize: 9,
            color: "rgba(255, 255, 255, 0.35)",
            fontFamily: "'SF Mono', monospace",
          }}
        >
          {timeAgo(event.created_at)}
        </span>
      </div>

      {/* Intent text */}
      <div
        style={{
          fontSize: 12,
          color: "rgba(255, 255, 255, 0.85)",
          lineHeight: 1.4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {event.intent}
      </div>

      {/* Tags + Risk + Agent */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {event.required_tags.map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
        {event.risk_level !== "LOW" && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: riskColor,
              padding: "1px 5px",
              borderRadius: 4,
              background: `${riskColor}15`,
              border: `1px solid ${riskColor}30`,
            }}
          >
            {event.risk_level}
          </span>
        )}
        {claimedAgent && (
          <span
            style={{
              fontSize: 9,
              color: "rgba(255, 255, 255, 0.5)",
              marginLeft: "auto",
            }}
          >
            → {claimedAgent.name}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TaskListPanel({
  events,
  agents,
  open,
  onClose,
}: TaskListPanelProps) {
  // Filter tasks: TASK_POSTED events, deduplicated by event_id, sorted by newest first
  const tasks = useMemo(() => {
    const seen = new Set<string>();
    return events
      .filter((e) => {
        if (e.topic !== "TASK_POSTED") return false;
        if (seen.has(e.event_id)) return false;
        seen.add(e.event_id);
        return true;
      })
      .sort((a, b) => b.created_at - a.created_at);
  }, [events]);

  const openCount = useMemo(
    () => tasks.filter((t) => t.status === "OPEN").length,
    [tasks],
  );
  const activeCount = useMemo(
    () => tasks.filter((t) => t.status === "CLAIMED").length,
    [tasks],
  );

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 60,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 70,
        width: "min(420px, calc(100vw - 160px))",
        maxHeight: "calc(100vh - 160px)",
        background: "rgba(10, 10, 18, 0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 16px 64px rgba(0, 0, 0, 0.5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#fbbf24",
              letterSpacing: "0.08em",
              fontFamily: "'SF Mono', 'Fira Code', monospace",
            }}
          >
            BOUNTY BOARD
          </span>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255, 255, 255, 0.4)",
              fontFamily: "'SF Mono', monospace",
            }}
          >
            {openCount} open / {activeCount} active
          </span>
        </div>
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
        {tasks.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 24,
              color: "rgba(255, 255, 255, 0.3)",
              fontSize: 12,
            }}
          >
            No tasks posted yet. Use the intent input below to create one.
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.event_id} event={task} agents={agents} />
          ))
        )}
      </div>

      {/* Footer summary */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: 10,
          color: "rgba(255, 255, 255, 0.3)",
          fontFamily: "'SF Mono', monospace",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {tasks.length} total tasks
      </div>
    </div>
  );
}
