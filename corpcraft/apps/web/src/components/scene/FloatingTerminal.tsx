"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { SwarmEvent } from "@corpcraft/contracts";
import type { AnimStateMap } from "./AnimationController";
import { ZONE_MAP } from "@/lib/zone-config";

// ────────────────────────────────────────────
// FloatingTerminal — Floating log panels behind forging agents
// V3: Role display, collapsible panels with blue dot indicator
// ────────────────────────────────────────────

const AUTO_HIDE_MS = 60_000;
const FADE_DURATION_MS = 1500;

/** Progress detail from Claude execution */
interface ProgressDetail {
  eventId: string;
  agentId: string;
  kind: string;
  content: string;
  toolName?: string;
  timestamp: number;
}

interface FloatingTerminalProps {
  animStateMapRef: React.RefObject<AnimStateMap>;
  events: SwarmEvent[];
  animVersion: number;
  progressDetails?: ProgressDetail[];
  taskPanelsVisible?: boolean;
}

/** Color a log line based on its kind */
function getLogColor(kind?: string): string {
  switch (kind) {
    case "thinking": return "rgba(96, 165, 250, 0.8)";
    case "tool_use": return "rgba(250, 204, 21, 0.8)";
    case "text":     return "rgba(74, 222, 128, 0.8)";
    case "result":   return "rgba(74, 222, 128, 0.9)";
    case "error":    return "rgba(248, 113, 113, 0.9)";
    case "team_status": return "rgba(168, 85, 247, 0.8)";
    default:         return "rgba(74, 222, 128, 0.7)";
  }
}

function getKindIcon(kind?: string): string {
  switch (kind) {
    case "thinking":    return "\u{1F4AD}";
    case "tool_use":    return "\u{1F527}";
    case "text":        return "\u{1F4DD}";
    case "result":      return "\u2705";
    case "error":       return "\u274C";
    case "team_status": return "\u{1F465}";
    default:            return "\u25B8";
  }
}

// ── Pulsing blue dot (collapsed indicator) ──

function BlueDot({
  position,
  onClick,
}: {
  position: [number, number, number];
  onClick: () => void;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.emissiveIntensity = 1.5 + Math.sin(clock.getElapsedTime() * 2) * 0.5;
    }
  });

  return (
    <mesh position={position} onClick={onClick}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial
        ref={matRef}
        color="#60a5fa"
        emissive="#60a5fa"
        emissiveIntensity={1.5}
        toneMapped={false}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// ── Single terminal panel ──

function TerminalPanel({
  position,
  agentId,
  agentRole,
  events,
  progressDetails = [],
  visibleUntilRef,
  onCollapse,
}: {
  position: [number, number, number];
  agentId: string;
  agentRole: string;
  events: SwarmEvent[];
  progressDetails?: ProgressDetail[];
  visibleUntilRef: React.MutableRefObject<Map<string, number>>;
  onCollapse: () => void;
}) {
  const recentLogs = useMemo(() => {
    const claudeLogs = progressDetails
      .filter((d) => d.agentId === agentId)
      .slice(0, 6)
      .map((d) => ({
        text: `${getKindIcon(d.kind)} ${d.content.slice(0, 40)}${d.content.length > 40 ? "\u2026" : ""}`,
        color: getLogColor(d.kind),
        timestamp: d.timestamp,
      }));

    if (claudeLogs.length > 0) return claudeLogs;

    return events
      .filter(
        (e) =>
          e.claimed_by === agentId ||
          (e.payload?.agent_id as string) === agentId,
      )
      .slice(0, 4)
      .map((e) => {
        const ts = new Date(e.created_at).toISOString().slice(11, 19);
        const topic = e.topic.replace("TASK_", "").replace("_", " ");
        const detail = e.payload?.detail as string | undefined;
        const text = detail
          ? `[${ts}] ${detail.slice(0, 35)}${detail.length > 35 ? "\u2026" : ""}`
          : `[${ts}] ${topic}`;

        return {
          text,
          color: getLogColor(e.payload?.kind as string | undefined),
          timestamp: e.created_at,
        };
      });
  }, [events, agentId, progressDetails]);

  if (recentLogs.length === 0) return null;

  // Check auto-hide timer
  const now = Date.now();
  const deadline = visibleUntilRef.current.get(agentId) ?? 0;
  const remaining = deadline - now;
  if (remaining < -FADE_DURATION_MS) return null;

  const fading = remaining < 0;
  const hasClaudeLogs = progressDetails.some((d) => d.agentId === agentId);

  return (
    <Html
      position={position}
      center
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); onCollapse(); }}
        style={{
          width: hasClaudeLogs ? 240 : 200,
          padding: "8px 10px",
          background: "rgba(10, 15, 25, 0.5)",
          backdropFilter: "blur(8px)",
          border: `1px solid ${hasClaudeLogs ? "rgba(168, 85, 247, 0.12)" : "rgba(100, 200, 100, 0.09)"}`,
          borderRadius: 6,
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 9,
          lineHeight: 1.5,
          color: "rgba(74, 222, 128, 0.7)",
          userSelect: "none",
          boxShadow: hasClaudeLogs ? "0 2px 16px rgba(168, 85, 247, 0.06)" : "none",
          opacity: fading ? 0 : 1,
          transition: `opacity ${FADE_DURATION_MS}ms ease`,
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        {/* Terminal header */}
        <div
          style={{
            fontSize: 8,
            color: "rgba(255,255,255,0.25)",
            marginBottom: 4,
            display: "flex",
            gap: 3,
            alignItems: "center",
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171" }} />
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fbbf24" }} />
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80" }} />
          <span style={{ marginLeft: 4 }}>
            {hasClaudeLogs ? "claude.session" : "agent.log"}
          </span>
          {hasClaudeLogs && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 7,
                color: "rgba(168, 85, 247, 0.6)",
                animation: "pulse 2s infinite",
              }}
            >
              {"\u25CF"} LIVE
            </span>
          )}
          {/* Agent role (replaces old close button) */}
          <span style={{
            marginLeft: hasClaudeLogs ? 6 : "auto",
            fontSize: 8,
            color: "rgba(255,255,255,0.45)",
          }}>
            {agentRole}
          </span>
        </div>
        {recentLogs.map((line, i) => (
          <div
            key={i}
            style={{
              opacity: 1 - i * 0.12,
              color: line.color,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {line.text}
          </div>
        ))}
      </div>
    </Html>
  );
}

// ── Main component ──

export default function FloatingTerminal({
  animStateMapRef,
  events,
  animVersion,
  progressDetails = [],
  taskPanelsVisible = true,
}: FloatingTerminalProps) {
  const visibleUntilRef = useRef(new Map<string, number>());
  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(new Set());

  // Update timers based on task events
  useMemo(() => {
    const now = Date.now();
    for (const evt of events) {
      if (evt.topic !== "TASK_CLAIMED" && evt.topic !== "TASK_PROGRESS") continue;
      const agentId = (evt.payload?.agent_id as string) ?? evt.claimed_by;
      if (!agentId) continue;
      if (now - evt.created_at > AUTO_HIDE_MS + 5000) continue;

      const current = visibleUntilRef.current.get(agentId) ?? 0;
      const newDeadline = evt.created_at + AUTO_HIDE_MS;
      if (newDeadline > current) {
        visibleUntilRef.current.set(agentId, newDeadline);
        // New task event: un-collapse the panel
        setCollapsedPanels((prev) => {
          if (!prev.has(agentId)) return prev;
          const next = new Set(prev);
          next.delete(agentId);
          return next;
        });
      }
    }

    for (const d of progressDetails) {
      const current = visibleUntilRef.current.get(d.agentId) ?? 0;
      const newDeadline = d.timestamp + AUTO_HIDE_MS;
      if (newDeadline > current) {
        visibleUntilRef.current.set(d.agentId, newDeadline);
        setCollapsedPanels((prev) => {
          if (!prev.has(d.agentId)) return prev;
          const next = new Set(prev);
          next.delete(d.agentId);
          return next;
        });
      }
    }
  }, [events, progressDetails]);

  // Force re-render periodically to update fade state
  const tickRef = useRef(0);
  const setTick = useCallback(() => { tickRef.current++; }, []);
  useFrame(() => {
    setTick();
  });

  // Find all forging agents
  const forgingAgents = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    animVersion;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tickRef.current;
    const result: Array<{
      agentId: string;
      zoneId?: string;
      position: [number, number, number];
      headPos: [number, number, number];
    }> = [];
    const activeAgentIds = new Set(progressDetails.map((d) => d.agentId));

    for (const [, anim] of animStateMapRef.current ?? new Map()) {
      if (anim.animState === "FORGING" || activeAgentIds.has(anim.agentId)) {
        result.push({
          agentId: anim.agentId,
          zoneId: anim.zoneId,
          position: [
            anim.position.x - 0.6,
            2.0,
            anim.position.z - 0.8,
          ],
          headPos: [
            anim.position.x,
            2.3,
            anim.position.z,
          ],
        });
      }
    }
    return result;
  }, [animStateMapRef, animVersion, progressDetails, tickRef.current]);

  const toggleCollapse = useCallback((agentId: string) => {
    setCollapsedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }, []);

  if (!taskPanelsVisible) return null;

  return (
    <group>
      {forgingAgents.map((fa) => {
        const isCollapsed = collapsedPanels.has(fa.agentId);
        const zone = fa.zoneId ? ZONE_MAP.get(fa.zoneId) : undefined;
        const agentRole = zone?.role ?? "Agent";

        if (isCollapsed) {
          return (
            <BlueDot
              key={`dot-${fa.agentId}`}
              position={fa.headPos}
              onClick={() => toggleCollapse(fa.agentId)}
            />
          );
        }

        return (
          <TerminalPanel
            key={fa.agentId}
            agentId={fa.agentId}
            agentRole={agentRole}
            position={fa.position}
            events={events}
            progressDetails={progressDetails}
            visibleUntilRef={visibleUntilRef}
            onCollapse={() => toggleCollapse(fa.agentId)}
          />
        );
      })}
    </group>
  );
}
