"use client";

import { useState } from "react";
import { useSwarmStore } from "@/hooks/useSwarmStore";

// ──────────────────────────────────────────────
// MetricsMini — Bottom-left operational metrics mini panel
// ──────────────────────────────────────────────

export default function MetricsMini() {
  const metrics = useSwarmStore((s) => s.metrics);
  const [expanded, setExpanded] = useState(false);

  const queueDepth = metrics?.queue_depth ?? 0;
  const completedRate =
    metrics
      ? metrics.tasks_completed_1h + metrics.tasks_failed_1h > 0
        ? (
            (metrics.tasks_completed_1h /
              (metrics.tasks_completed_1h + metrics.tasks_failed_1h)) *
            100
          ).toFixed(0)
        : "—"
      : "—";
  const pendingApprovals = metrics?.approval_pending_count ?? 0;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        padding: "12px 16px",
        background: "rgba(10, 10, 15, 0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        pointerEvents: "auto",
        zIndex: 50,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
        cursor: "pointer",
        transition: "all 0.3s ease",
        minWidth: 180,
      }}
      onClick={() => setExpanded((p) => !p)}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Metrics</span>
        <span
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.2)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          ▼
        </span>
      </div>

      {/* Primary metrics — always visible */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <MetricRow label="Queue" value={String(queueDepth)} color="#60a5fa" />
        <MetricRow label="Complete" value={`${completedRate}%`} color="#4ade80" />
        <MetricRow
          label="Approvals"
          value={String(pendingApprovals)}
          color={pendingApprovals > 0 ? "#fb923c" : "#4ade80"}
        />
      </div>

      {/* Expanded details */}
      {expanded && metrics && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <MetricRow
            label="Avg Cycle"
            value={`${(metrics.avg_task_duration_ms / 1_000).toFixed(1)}s`}
            color="#a78bfa"
          />
          <MetricRow
            label="Claim Conflict"
            value={`${(metrics.claim_conflict_rate_1m * 100).toFixed(0)}%`}
            color="#f87171"
          />
          <MetricRow
            label="Approval P95"
            value={`${(metrics.approval_p95_ms / 1_000).toFixed(1)}s`}
            color="#fb923c"
          />
          {metrics.retry_storm_detected && (
            <div
              style={{
                marginTop: 4,
                padding: "4px 8px",
                background: "rgba(248,113,113,0.15)",
                borderRadius: 6,
                fontSize: 10,
                color: "#f87171",
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              ⚠ RETRY STORM DETECTED
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span style={{ fontSize: 12, color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
