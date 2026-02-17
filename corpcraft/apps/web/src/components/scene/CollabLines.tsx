"use client";

import { memo, useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SwarmEvent } from "@corpcraft/contracts";
import type { AnimStateMap } from "./AnimationController";

// ────────────────────────────────────────────
// CollabLines — glowing dashed lines between collaborating agents
// Agents are paired when their events share a parent_event_id
// (e.g. ARTIFACT_READY from one feeds TASK_CLAIMED of another).
// ────────────────────────────────────────────

interface TeamStatus {
  teamName: string;
  members: Array<{
    name: string;
    status: "idle" | "working" | "done" | "error";
    currentTask?: string;
  }>;
}

interface CollabLinesProps {
  events: SwarmEvent[];
  animStateMapRef: React.RefObject<AnimStateMap>;
  animVersion: number;
  /** Active Claude Agent Teams for team-mode visualization */
  teamStatuses?: TeamStatus[];
  /** Agent name → agent_id mapping for resolving team member positions */
  agentNameMap?: Map<string, string>;
}

interface CollabPair {
  agentA: string;
  agentB: string;
  color: string;
  /** Whether this is a team connection (renders differently) */
  isTeamLink?: boolean;
}

/** Extract unique collaboration pairs from events grouped by parent chain. */
function deriveCollabPairs(events: SwarmEvent[]): CollabPair[] {
  // Group events by parent_event_id
  const byParent = new Map<string, SwarmEvent[]>();

  for (const evt of events) {
    if (!evt.parent_event_id) continue;
    let group = byParent.get(evt.parent_event_id);
    if (!group) {
      group = [];
      byParent.set(evt.parent_event_id, group);
    }
    group.push(evt);
  }

  const pairs: CollabPair[] = [];
  const seen = new Set<string>();

  for (const [, group] of byParent) {
    // Collect unique agent IDs involved in this parent chain
    const agentIds = [
      ...new Set(
        (
          group
            .map(
              (e) => (e.payload?.agent_id as string) ?? e.claimed_by,
            )
            .filter(Boolean) as string[]
        ),
      ),
    ];

    if (agentIds.length < 2) continue;

    // Determine line color from the most significant status in the group
    const hasError = group.some(
      (e) => e.topic === "SOS_ERROR" || e.topic === "TASK_FAILED",
    );
    const hasSuccess = group.some(
      (e) => e.topic === "ARTIFACT_READY" || e.topic === "TASK_CLOSED",
    );
    const color = hasError
      ? "#f87171"
      : hasSuccess
        ? "#4ade80"
        : "#60a5fa";

    // Build pairwise connections (deduplicated)
    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        const key = [agentIds[i], agentIds[j]].sort().join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({
          agentA: agentIds[i]!,
          agentB: agentIds[j]!,
          color,
        });
      }
    }
  }

  return pairs;
}

/**
 * Derive collaboration pairs from active Agent Teams.
 * Each team creates connections between all members with a purple team color.
 */
function deriveTeamPairs(
  teamStatuses: TeamStatus[],
  agentNameMap: Map<string, string>,
): CollabPair[] {
  const pairs: CollabPair[] = [];
  const seen = new Set<string>();

  for (const team of teamStatuses) {
    // Map team member names to agent IDs
    const memberIds = team.members
      .map((m) => agentNameMap.get(m.name))
      .filter((id): id is string => !!id);

    if (memberIds.length < 2) continue;

    // Determine color based on team activity
    const hasError = team.members.some((m) => m.status === "error");
    const allDone = team.members.every((m) => m.status === "done");
    const color = hasError ? "#f87171" : allDone ? "#4ade80" : "#a855f7"; // purple for active teams

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const key = [memberIds[i], memberIds[j]].sort().join(":team:");
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({
          agentA: memberIds[i]!,
          agentB: memberIds[j]!,
          color,
          isTeamLink: true,
        });
      }
    }
  }

  return pairs;
}

// ── Single dashed line between two agents ──

function CollabLine({
  agentA,
  agentB,
  color,
  isTeamLink,
  animStateMapRef,
}: {
  agentA: string;
  agentB: string;
  color: string;
  isTeamLink?: boolean;
  animStateMapRef: React.RefObject<AnimStateMap>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Line | null>(null);
  const matRef = useRef<THREE.LineDashedMaterial | null>(null);

  // Create THREE.Line imperatively to avoid JSX <line> / SVG ambiguity
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([0, 0.5, 0, 0, 0.5, 0]),
        3,
      ),
    );

    const material = new THREE.LineDashedMaterial({
      color,
      dashSize: isTeamLink ? 0.3 : 0.2,
      gapSize: isTeamLink ? 0.15 : 0.1,
      transparent: true,
      opacity: isTeamLink ? 0.9 : 0.7,
      linewidth: 1,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();

    group.add(line);
    lineRef.current = line;
    matRef.current = material;

    return () => {
      group.remove(line);
      geometry.dispose();
      material.dispose();
      lineRef.current = null;
      matRef.current = null;
    };
  }, [color]);

  // Per-frame: sync line endpoints to agent positions & animate dash
  useFrame((_, delta) => {
    const animMap = animStateMapRef.current;
    const line = lineRef.current;
    const mat = matRef.current;
    if (!animMap || !line) return;

    const a = animMap.get(agentA);
    const b = animMap.get(agentB);
    if (!a || !b) return;

    // Update vertex positions
    const posAttr = line.geometry.attributes
      .position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    arr[0] = a.position.x;
    arr[1] = 0.5;
    arr[2] = a.position.z;
    arr[3] = b.position.x;
    arr[4] = 0.5;
    arr[5] = b.position.z;
    posAttr.needsUpdate = true;

    // Recompute distances so the dash pattern stays consistent
    line.computeLineDistances();

    // Animate flowing dash offset
    if (mat && "dashOffset" in mat) {
      (mat as unknown as { dashOffset: number }).dashOffset -= delta * 0.5;
    }
  });

  return <group ref={groupRef} />;
}

// ── Main wrapper ──

function CollabLines({
  events,
  animStateMapRef,
  animVersion,
  teamStatuses = [],
  agentNameMap = new Map(),
}: CollabLinesProps) {
  const pairs = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    animVersion; // dependency — triggers recalculation when anim states change

    // Standard event-based collaboration pairs
    const eventPairs = deriveCollabPairs(events);

    // Team-based collaboration pairs (from Claude Agent Teams)
    const teamPairs = deriveTeamPairs(teamStatuses, agentNameMap);

    return [...eventPairs, ...teamPairs];
  }, [events, animVersion, teamStatuses, agentNameMap]);

  return (
    <group>
      {pairs.map((p) => (
        <CollabLine
          key={`${p.agentA}:${p.agentB}:${p.isTeamLink ? "team" : "event"}`}
          agentA={p.agentA}
          agentB={p.agentB}
          color={p.color}
          isTeamLink={p.isTeamLink}
          animStateMapRef={animStateMapRef}
        />
      ))}
    </group>
  );
}

export default memo(CollabLines);
