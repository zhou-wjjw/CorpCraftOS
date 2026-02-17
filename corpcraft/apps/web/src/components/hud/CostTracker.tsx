"use client";

import { useSwarmStore } from "@/hooks/useSwarmStore";

// ──────────────────────────────────────────────
// CostTracker — Top-right corner cost/metrics mini display
// ──────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function CostTracker() {
  const metrics = useSwarmStore((s) => s.metrics);
  const events = useSwarmStore((s) => s.events);

  const activeTasks = events.filter(
    (e) => e.status === "CLAIMED" || e.status === "RESOLVING",
  ).length;

  const tokensUsed = metrics?.total_tokens_1h ?? 0;
  const totalCost = metrics?.total_cost_1h ?? 0;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        padding: "12px 16px",
        background: "rgba(10, 10, 15, 0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        pointerEvents: "auto",
        zIndex: 50,
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 10,
        }}
      >
        Cost Tracker
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Tokens */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Tokens</span>
          <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
            {formatTokens(tokensUsed)}
          </span>
        </div>

        {/* Cost */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Cost</span>
          <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
            {formatCost(totalCost)}
          </span>
        </div>

        {/* Active Tasks */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Active</span>
          <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
            {activeTasks}
          </span>
        </div>
      </div>
    </div>
  );
}
