"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { AnimStateMap } from "./AnimationController";
import {
  useSummonRequests,
  usePendingJoinRequests,
  useSwarmStore,
} from "@/hooks/useSwarmStore";

// ────────────────────────────────────────────
// InterruptHologram — 3D holographic interrupt panel
// Replaces SaaS-style Toast for in-scene interrupt decisions.
// When a ZONE_JOIN_REQUEST or summon targets an active agent:
//   - Agent transitions to ATTENTION (stands at attention, faces camera)
//   - A holographic HUD panel floats above the agent
//   - Red 15-second countdown bar
//   - Pulsing red ring around the agent
//   - User can approve/reject before timeout
// ────────────────────────────────────────────

const COUNTDOWN_SECONDS = 15;

interface HologramTarget {
  id: string;
  agentId: string;
  agentName: string;
  type: "summon" | "join";
  message: string;
  startTime: number;
}

interface InterruptHologramProps {
  animStateMapRef: React.RefObject<AnimStateMap>;
}

function PulsingRing({ position }: { position: THREE.Vector3 }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = 1 + Math.sin(t * 4) * 0.15;
    ringRef.current.scale.setScalar(pulse);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.4 + Math.sin(t * 6) * 0.2;
  });

  return (
    <mesh
      ref={ringRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[position.x, 0.06, position.z]}
    >
      <ringGeometry args={[0.4, 0.5, 32]} />
      <meshBasicMaterial
        color="#ff2244"
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function HologramPanel({
  target,
  position,
  onApprove,
  onReject,
}: {
  target: HologramTarget;
  position: THREE.Vector3;
  onApprove: (id: string, type: "summon" | "join") => void;
  onReject: (id: string, type: "summon" | "join") => void;
}) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = (Date.now() - target.startTime) / 1000;
      const left = Math.max(0, COUNTDOWN_SECONDS - elapsed);
      setRemaining(left);
      if (left <= 0) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [target.startTime]);

  const progress = remaining / COUNTDOWN_SECONDS;

  return (
    <Html
      position={[position.x, position.y + 2.2, position.z]}
      center
      distanceFactor={8}
      style={{ pointerEvents: "auto" }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 5, 25, 0.92), rgba(30, 10, 40, 0.88))",
          border: "1px solid rgba(255, 34, 68, 0.6)",
          borderRadius: 8,
          padding: "10px 14px",
          minWidth: 200,
          maxWidth: 260,
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          color: "#e0e0ff",
          fontSize: 11,
          boxShadow: "0 0 20px rgba(255, 34, 68, 0.3), inset 0 0 10px rgba(255, 34, 68, 0.05)",
          userSelect: "none",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ color: "#ff4466", fontSize: 14 }}>!</span>
          <span style={{ fontWeight: 600, fontSize: 12, color: "#ff8899" }}>
            {target.type === "summon" ? "SUMMON REQUEST" : "JOIN REQUEST"}
          </span>
        </div>

        {/* Agent name */}
        <div style={{ fontSize: 10, color: "#8888aa", marginBottom: 4 }}>
          Agent: <span style={{ color: "#ccccff" }}>{target.agentName}</span>
        </div>

        {/* Message */}
        <div style={{ fontSize: 11, lineHeight: 1.4, marginBottom: 8, color: "#ccccee" }}>
          {target.message}
        </div>

        {/* Countdown bar */}
        <div
          style={{
            height: 3,
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: 2,
            marginBottom: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: progress > 0.3
                ? "linear-gradient(90deg, #ff4466, #ff6688)"
                : "#ff2244",
              borderRadius: 2,
              transition: "width 0.1s linear",
            }}
          />
        </div>

        <div style={{ fontSize: 9, color: "#666688", marginBottom: 6, textAlign: "center" }}>
          {Math.ceil(remaining)}s before auto-resolution
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => onApprove(target.id, target.type)}
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 600,
              fontFamily: "inherit",
              background: "rgba(74, 222, 128, 0.15)",
              border: "1px solid rgba(74, 222, 128, 0.4)",
              borderRadius: 4,
              color: "#4ade80",
              cursor: "pointer",
            }}
          >
            APPROVE
          </button>
          <button
            onClick={() => onReject(target.id, target.type)}
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: 10,
              fontWeight: 600,
              fontFamily: "inherit",
              background: "rgba(255, 68, 102, 0.15)",
              border: "1px solid rgba(255, 68, 102, 0.4)",
              borderRadius: 4,
              color: "#ff4466",
              cursor: "pointer",
            }}
          >
            REJECT
          </button>
        </div>
      </div>
    </Html>
  );
}

export default function InterruptHologram({ animStateMapRef }: InterruptHologramProps) {
  const summonRequests = useSummonRequests();
  const joinRequests = usePendingJoinRequests();
  const send = useSwarmStore((s) => s.send);

  const targets = useMemo<HologramTarget[]>(() => {
    const result: HologramTarget[] = [];

    for (const req of summonRequests) {
      result.push({
        id: req.request_id,
        agentId: req.requesting_agent_id,
        agentName: req.requesting_agent_name,
        type: "summon",
        message: `Requesting ${req.required_tags.join(", ")} specialist. Urgency: ${req.urgency}. ${req.context.slice(0, 80)}`,
        startTime: req.created_at,
      });
    }

    for (const req of joinRequests) {
      result.push({
        id: req.request_id,
        agentId: req.agent_id,
        agentName: req.agent_name,
        type: "join",
        message: `Requesting to join zone ${req.zone_id}. Trigger: ${req.trigger}.`,
        startTime: req.created_at,
      });
    }

    return result;
  }, [summonRequests, joinRequests]);

  const handleApprove = useCallback(
    (id: string, type: "summon" | "join") => {
      if (type === "summon") {
        send({ type: "SUMMON_DECISION", request_id: id, approved: true });
      } else {
        send({ type: "ZONE_JOIN_DECISION", request_id: id, approved: true });
      }
    },
    [send],
  );

  const handleReject = useCallback(
    (id: string, type: "summon" | "join") => {
      if (type === "summon") {
        send({ type: "SUMMON_DECISION", request_id: id, approved: false });
      } else {
        send({ type: "ZONE_JOIN_DECISION", request_id: id, approved: false });
      }
    },
    [send],
  );

  return (
    <group>
      {targets.map((target) => {
        const animMap = animStateMapRef.current;
        const agentAnim = animMap?.get(target.agentId);
        if (!agentAnim) return null;

        return (
          <group key={target.id}>
            <PulsingRing position={agentAnim.position} />
            <HologramPanel
              target={target}
              position={agentAnim.position}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </group>
        );
      })}
    </group>
  );
}
