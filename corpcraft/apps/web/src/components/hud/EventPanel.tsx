"use client";

import { useEffect, useRef, useCallback } from "react";
import type { EventTopic } from "@corpcraft/contracts";
import { useSwarmStore } from "@/hooks/useSwarmStore";

/** Topics that can be clicked to view task results */
const CLICKABLE_TOPICS = new Set<string>([
  "ARTIFACT_READY",
  "TASK_CLOSED",
  "TASK_FAILED",
  "EVIDENCE_READY",
]);

// ──────────────────────────────────────────────
// EventPanel — Scrollable event log, bottom-right
// ──────────────────────────────────────────────

const TOPIC_COLORS: Record<string, string> = {
  TASK_POSTED: "#60a5fa",
  TASK_DECOMPOSED: "#60a5fa",
  TASK_CLAIMED: "#facc15",
  TASK_PROGRESS: "#facc15",
  ARTIFACT_READY: "#4ade80",
  EVIDENCE_READY: "#4ade80",
  INTEL_READY: "#4ade80",
  TASK_CLOSED: "#6b7280",
  TASK_FAILED: "#f87171",
  TASK_RETRY_SCHEDULED: "#f87171",
  SOS_ERROR: "#f87171",
  APPROVAL_REQUIRED: "#fb923c",
  APPROVAL_DECISION: "#fb923c",
  COMPACTION_TICK: "#6b7280",
  ASSET_UPDATED: "#a78bfa",
  SKILL_QUARANTINED: "#f87171",
  HUD_SYNC: "#6b7280",
};

function topicColor(topic: EventTopic): string {
  return TOPIC_COLORS[topic] ?? "#6b7280";
}

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 1_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

const DISPLAY_COUNT = 20;

export default function EventPanel() {
  const events = useSwarmStore((s) => s.events);
  const openTaskResult = useSwarmStore((s) => s.openTaskResult);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleEventClick = useCallback(
    (eventId: string, topic: string) => {
      if (!CLICKABLE_TOPICS.has(topic)) return;
      // Find the root task event (original_event_id or parent_event_id)
      const evt = events.find((e) => e.event_id === eventId);
      if (!evt) return;
      const rootId =
        (evt.payload?.original_event_id as string) ??
        evt.parent_event_id ??
        evt.event_id;
      openTaskResult(rootId);
    },
    [events, openTaskResult],
  );

  // Auto-scroll to top (newest first)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const visible = events.slice(0, DISPLAY_COUNT);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        width: 340,
        maxHeight: 300,
        display: "flex",
        flexDirection: "column",
        background: "rgba(10, 10, 15, 0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        pointerEvents: "auto",
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px 8px",
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        Event Log
      </div>

      {/* Scrollable event list */}
      <div
        ref={scrollRef}
        style={{
          overflowY: "auto",
          flex: 1,
          padding: "6px 0",
        }}
      >
        {visible.length === 0 && (
          <div
            style={{
              padding: "16px 14px",
              color: "rgba(255,255,255,0.25)",
              fontSize: 12,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            No events yet
          </div>
        )}

        {visible.map((evt, idx) => {
          const isClickable = CLICKABLE_TOPICS.has(evt.topic);
          return (
          <div
            key={`${evt.event_id}-${idx}`}
            onClick={isClickable ? () => handleEventClick(evt.event_id, evt.topic) : undefined}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "5px 14px",
              fontSize: 12,
              lineHeight: 1.4,
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              cursor: isClickable ? "pointer" : "default",
              transition: "background 0.15s ease",
              ...(isClickable ? { background: "transparent" } : {}),
            }}
            onMouseEnter={(e) => {
              if (isClickable) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={(e) => {
              if (isClickable) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {/* Colored dot */}
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: topicColor(evt.topic),
                marginTop: 4,
                flexShrink: 0,
                boxShadow: `0 0 6px ${topicColor(evt.topic)}66`,
              }}
            />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span
                  style={{
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: 10,
                    color: topicColor(evt.topic),
                    fontWeight: 600,
                  }}
                >
                  {evt.topic}
                </span>
                <span
                  style={{
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: 9,
                    color: "rgba(255,255,255,0.3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {relativeTime(evt.created_at)}
                </span>
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 11,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {evt.intent}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
