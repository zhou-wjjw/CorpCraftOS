"use client";

import { useState, useEffect, useCallback } from "react";
import type { SummonRequest, SummonResolution } from "@corpcraft/contracts";
import { useSwarmStore, useSummonRequests, usePendingJoinRequests } from "@/hooks/useSwarmStore";

// ──────────────────────────────────────────────
// SummonRequestPanel — Toast-style notification UI
//
// Displays pending summon requests and zone join requests
// from agents that need help or want to join a zone.
// Stacks vertically at top-right corner.
// ──────────────────────────────────────────────

const MONO = "'SF Mono', 'Fira Code', monospace";

const URGENCY_COLORS: Record<string, string> = {
  LOW: "#6b7280",
  MEDIUM: "#60a5fa",
  HIGH: "#facc15",
  CRITICAL: "#f87171",
};

const REASON_LABELS: Record<string, string> = {
  SKILL_GAP: "Skill Gap",
  OVERLOAD: "Overloaded",
  DECOMPOSITION: "Task Decomposition",
  EXPLICIT: "Explicit Request",
};

function CountdownBar({ createdAt, timeoutMs }: { createdAt: number; timeoutMs: number }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - createdAt;
      const remaining = Math.max(0, 1 - elapsed / timeoutMs) * 100;
      setPct(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [createdAt, timeoutMs]);

  const color = pct > 60 ? "#4ade80" : pct > 30 ? "#facc15" : "#f87171";

  return (
    <div
      style={{
        height: 2,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 1,
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 1,
          transition: "width 0.2s linear",
        }}
      />
    </div>
  );
}

function SummonCard({ request }: { request: SummonRequest }) {
  const resolveSummonRequest = useSwarmStore((s) => s.resolveSummonRequest);
  const urgencyColor = URGENCY_COLORS[request.urgency] ?? "#6b7280";
  const reasonLabel = REASON_LABELS[request.reason] ?? request.reason;

  const handleApprove = useCallback(() => {
    const resolution: SummonResolution = {
      request_id: request.request_id,
      decision: "APPROVED",
      decided_by: "USER",
    };
    resolveSummonRequest(request.request_id, resolution);
  }, [request.request_id, resolveSummonRequest]);

  const handleReject = useCallback(() => {
    const resolution: SummonResolution = {
      request_id: request.request_id,
      decision: "REJECTED",
      decided_by: "USER",
      reason: "User rejected",
    };
    resolveSummonRequest(request.request_id, resolution);
  }, [request.request_id, resolveSummonRequest]);

  return (
    <div
      style={{
        background: "rgba(10, 10, 15, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 12,
        border: `1px solid ${urgencyColor}33`,
        padding: "12px 16px",
        width: 320,
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${urgencyColor}15`,
        animation: "slideInFromRight 0.3s ease-out",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.05em",
              background: `${urgencyColor}22`,
              color: urgencyColor,
              border: `1px solid ${urgencyColor}44`,
            }}
          >
            {request.urgency}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              fontFamily: MONO,
            }}
          >
            {reasonLabel}
          </span>
        </div>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: MONO }}>
          SUMMON
        </span>
      </div>

      {/* Agent info */}
      <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 4 }}>
        {request.requesting_agent_name} needs help
      </div>

      {/* Context */}
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.5,
          marginBottom: 8,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {request.context}
      </div>

      {/* Required tags */}
      {request.required_tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          {request.required_tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 600,
                background: "rgba(167, 139, 250, 0.15)",
                color: "#a78bfa",
                border: "1px solid rgba(167, 139, 250, 0.25)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleApprove}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(74, 222, 128, 0.3)",
            background: "rgba(74, 222, 128, 0.12)",
            color: "#4ade80",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: MONO,
          }}
        >
          Approve
        </button>
        <button
          onClick={handleReject}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(248, 113, 113, 0.3)",
            background: "rgba(248, 113, 113, 0.08)",
            color: "#f87171",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: MONO,
          }}
        >
          Reject
        </button>
      </div>

      {/* Countdown */}
      <CountdownBar createdAt={request.created_at} timeoutMs={request.approval_timeout_ms} />
    </div>
  );
}

function JoinRequestCard({ request }: { request: { request_id: string; agent_name: string; zone_id: string; trigger: string; created_at: number; timeout_ms: number } }) {
  const resolveJoinRequest = useSwarmStore((s) => s.resolveJoinRequest);

  return (
    <div
      style={{
        background: "rgba(10, 10, 15, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 12,
        border: "1px solid rgba(167, 139, 250, 0.25)",
        padding: "12px 16px",
        width: 320,
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        animation: "slideInFromRight 0.3s ease-out",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            color: "#a78bfa",
            fontFamily: MONO,
            fontWeight: 600,
          }}
        >
          ZONE JOIN REQUEST
        </span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 4,
            fontSize: 9,
            background: "rgba(167, 139, 250, 0.15)",
            color: "#a78bfa",
          }}
        >
          {request.trigger}
        </span>
      </div>

      <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 4 }}>
        {request.agent_name} wants to join
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
        Zone: {request.zone_id}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => resolveJoinRequest(request.request_id)}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(74, 222, 128, 0.3)",
            background: "rgba(74, 222, 128, 0.12)",
            color: "#4ade80",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: MONO,
          }}
        >
          Allow
        </button>
        <button
          onClick={() => resolveJoinRequest(request.request_id)}
          style={{
            flex: 1,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(248, 113, 113, 0.3)",
            background: "rgba(248, 113, 113, 0.08)",
            color: "#f87171",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: MONO,
          }}
        >
          Deny
        </button>
      </div>

      <CountdownBar createdAt={request.created_at} timeoutMs={request.timeout_ms} />
    </div>
  );
}

export default function SummonRequestPanel() {
  const summonRequests = useSummonRequests();
  const joinRequests = usePendingJoinRequests();

  if (summonRequests.length === 0 && joinRequests.length === 0) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 200,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          pointerEvents: "auto",
        }}
      >
        {summonRequests.map((req) => (
          <SummonCard key={req.request_id} request={req} />
        ))}
        {joinRequests.map((req) => (
          <JoinRequestCard key={req.request_id} request={req} />
        ))}
      </div>
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </>
  );
}
