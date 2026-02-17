"use client";

import { memo, useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { SwarmEvent } from "@corpcraft/contracts";
import type { AnimStateMap } from "./AnimationController";

// ────────────────────────────────────────────
// SpeechBubbleSystem — floating speech bubbles above agents on events
// Shows short contextual text when TASK_CLAIMED, ARTIFACT_READY,
// SOS_ERROR, or TASK_CLOSED events fire. Auto-expires after 4 s.
// ────────────────────────────────────────────

const BUBBLE_LIFETIME_MS = 4000;
const RECENT_WINDOW_MS = 5000;

const BUBBLE_TOPICS = new Set<string>([
  "TASK_CLAIMED",
  "TASK_PROGRESS",
  "ARTIFACT_READY",
  "SOS_ERROR",
  "TASK_CLOSED",
]);

interface SpeechBubbleSystemProps {
  events: SwarmEvent[];
  animStateMapRef: React.RefObject<AnimStateMap>;
  agents: {
    agent_id: string;
    name: string;
    position: { x: number; z: number };
  }[];
  /** Global visibility toggle from store */
  taskPanelsVisible?: boolean;
}

interface ActiveBubble {
  eventId: string;
  agentId: string;
  text: string;
  bgColor: string;
  bornAt: number; // local Date.now() when bubble was created
}

// ── Derive short display text from an event ──

function getBubbleText(event: SwarmEvent): string {
  switch (event.topic) {
    case "TASK_CLAIMED": {
      const intent = event.intent ?? "";
      const truncated =
        intent.length > 20 ? intent.slice(0, 20) + "…" : intent;
      return `Claimed: ${truncated}`;
    }
    case "TASK_PROGRESS": {
      // Show Claude's thinking/tool use as speech bubbles
      const kind = event.payload?.kind as string | undefined;
      const detail = event.payload?.detail as string | undefined;
      const toolName = event.payload?.tool_name as string | undefined;

      if (kind === "thinking") {
        const text = detail ?? "Thinking...";
        return `💭 ${text.length > 30 ? text.slice(0, 30) + "…" : text}`;
      }
      if (kind === "tool_use" && toolName) {
        return `🔧 Using ${toolName}`;
      }
      if (kind === "team_status") {
        return `👥 Coordinating team`;
      }
      if (kind === "error") {
        return `⚠ ${(detail ?? "Error").slice(0, 25)}`;
      }
      // For generic progress, show message
      const msg = (event.payload?.message as string) ?? "";
      return msg.length > 30 ? msg.slice(0, 30) + "…" : msg;
    }
    case "ARTIFACT_READY": {
      const name =
        (event.payload?.artifact_name as string) || "output";
      return `Done: ${name} ✓`;
    }
    case "SOS_ERROR":
      return "Error: need help! ⚠";
    case "TASK_CLOSED":
      return "Task complete! 🎉";
    default:
      return "";
  }
}

/** Get bubble color based on event kind */
function getBubbleColor(event: SwarmEvent): string {
  if (event.topic === "TASK_PROGRESS") {
    const kind = event.payload?.kind as string | undefined;
    switch (kind) {
      case "thinking":
        return "rgba(96, 165, 250, 0.6)";
      case "tool_use":
        return "rgba(250, 204, 21, 0.6)";
      case "team_status":
        return "rgba(168, 85, 247, 0.6)";
      case "error":
        return "rgba(248, 113, 113, 0.6)";
      default:
        return "rgba(15, 18, 25, 0.6)";
    }
  }
  if (event.topic === "SOS_ERROR") return "rgba(248, 113, 113, 0.6)";
  if (event.topic === "TASK_CLOSED") return "rgba(74, 222, 128, 0.6)";
  return "rgba(15, 18, 25, 0.6)";
}

// ── Single bubble visual (Html overlay, NO distanceFactor) ──

function BubbleOverlay({
  position,
  text,
  bgColor = "rgba(15, 18, 25, 0.85)",
}: {
  position: [number, number, number];
  text: string;
  bgColor?: string;
}) {
  return (
    <Html
      position={position}
      center
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: `speechBubbleFade ${BUBBLE_LIFETIME_MS}ms ease forwards`,
        }}
      >
        {/* Bubble body */}
        <div
          style={{
            background: bgColor,
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 10,
            padding: "6px 12px",
            maxWidth: 220,
            fontFamily:
              "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: 11,
            lineHeight: 1.4,
            color: "rgba(255, 255, 255, 0.95)",
            userSelect: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
          }}
        >
          {text}
        </div>

        {/* Tail — CSS triangle pointing down */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: `6px solid ${bgColor}`,
            marginTop: -1,
          }}
        />
      </div>
    </Html>
  );
}

// ── Main system component ──

function SpeechBubbleSystem({
  events,
  animStateMapRef,
  agents,
  taskPanelsVisible = true,
}: SpeechBubbleSystemProps) {
  const bubblesRef = useRef<ActiveBubble[]>([]);
  const seenRef = useRef(new Set<string>());
  const [, setTick] = useState(0);

  // Inject CSS keyframes into document head (once)
  useEffect(() => {
    const styleId = "speech-bubble-keyframes";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes speechBubbleFade {
        0%   { opacity: 0; transform: translateY(8px); }
        8%   { opacity: 1; transform: translateY(0); }
        80%  { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  // Per-frame: ingest new events, expire old bubbles
  useFrame(() => {
    const now = Date.now();
    let changed = false;

    // Ingest new relevant events
    for (const evt of events) {
      if (seenRef.current.has(evt.event_id)) continue;
      if (!BUBBLE_TOPICS.has(evt.topic)) continue;
      if (now - evt.created_at > RECENT_WINDOW_MS) continue;

      seenRef.current.add(evt.event_id);

      const agentId =
        (evt.payload?.agent_id as string) ?? evt.claimed_by;
      if (!agentId) continue;

      const text = getBubbleText(evt);
      if (!text) continue;

      bubblesRef.current.push({
        eventId: evt.event_id,
        agentId,
        text,
        bgColor: getBubbleColor(evt),
        bornAt: now,
      });
      changed = true;
    }

    // Expire bubbles older than BUBBLE_LIFETIME_MS
    const prevLen = bubblesRef.current.length;
    bubblesRef.current = bubblesRef.current.filter(
      (b) => now - b.bornAt < BUBBLE_LIFETIME_MS,
    );
    if (bubblesRef.current.length !== prevLen) changed = true;

    // GC seen set to prevent memory leak
    if (seenRef.current.size > 300) {
      const toDelete: string[] = [];
      let count = 0;
      for (const id of seenRef.current) {
        if (count++ >= 100) break;
        toDelete.push(id);
      }
      for (const id of toDelete) seenRef.current.delete(id);
    }

    // Only trigger React re-render when bubble list changes
    if (changed) setTick((t) => t + 1);
  });

  const animMap = animStateMapRef.current;

  if (!taskPanelsVisible) return null;

  return (
    <group>
      {bubblesRef.current.map((b) => {
        // Resolve agent world position from animStateMap (preferred) or agents prop
        const anim = animMap?.get(b.agentId);
        let x = 0;
        let z = 0;

        if (anim) {
          x = anim.position.x;
          z = anim.position.z;
        } else {
          const def = agents.find((a) => a.agent_id === b.agentId);
          if (def) {
            x = def.position.x;
            z = def.position.z;
          }
        }

        return (
          <BubbleOverlay
            key={b.eventId}
            position={[x, 2.0, z]}
            text={b.text}
            bgColor={b.bgColor}
          />
        );
      })}
    </group>
  );
}

export default memo(SpeechBubbleSystem);
