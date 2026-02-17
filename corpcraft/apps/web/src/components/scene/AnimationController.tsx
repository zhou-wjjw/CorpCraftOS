"use client";

import { useRef, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AgentEntity, SwarmEvent } from "@corpcraft/contracts";
import { ZONES, BOUNTY_BOARD_POSITION, detectZoneAtPosition } from "@/lib/zone-config";

// ────────────────────────────────────────────
// AnimationController — orchestrates agent animations
// Non-visual: drives positions + states consumed by AgentCharacter
//
// FIX: No longer calls onUpdate every frame (was causing 60fps re-renders).
// Instead, uses a shared ref that AgentCharacter reads directly.
// ────────────────────────────────────────────

export type AnimState =
  | "IDLE"
  | "WALK_TO_BOARD"
  | "WALK_TO_BENCH"
  | "WALK_TO_POINT"
  | "FORGING"
  | "ALERT"
  | "CELEBRATE"
  | "THINKING"
  | "HANDOFF"
  | "SUMMONING"
  | "ATTENTION"
  | "TELEPORTING";

export interface AnimatedAgent {
  position: THREE.Vector3;
  animState: AnimState;
  agentId: string;
  zoneId?: string;
}

/** Lookup from zone ID → anvil/bench world position (zone center + anvil offset) */
const ZONE_BENCH_POSITIONS: Record<string, THREE.Vector3> = Object.fromEntries(
  ZONES.map((z) => [
    z.id,
    new THREE.Vector3(
      z.position[0] + z.anvilOffset[0],
      z.position[1] + z.anvilOffset[1],
      z.position[2] + z.anvilOffset[2],
    ),
  ]),
);

/** BountyBoard world position — agents walk here first */
const BOARD_POS = new THREE.Vector3(...BOUNTY_BOARD_POSITION);
const ARRIVE_THRESHOLD = 0.15;
const MOVE_SPEED = 2;

/** Max processed events to keep (TTL-like cleanup) */
const MAX_PROCESSED = 500;

// ── Shared state ref that page.tsx and AgentCharacter can read ──
// This avoids 60fps React re-renders by using a mutable ref.

export type AnimStateMap = Map<string, AnimatedAgent>;

interface InternalState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  origin: THREE.Vector3;
  animState: AnimState;
  agentId: string;
  zoneId?: string;
  /** Timestamp when celebrate/alert started (for auto-timeout) */
  stateStartTime?: number;
  /** Parent event id for collaboration co-location */
  parentEventId?: string;
  /** Direct movement target for WALK_TO_POINT (free right-click movement) */
  directTarget?: THREE.Vector3;
}

/** Offset for side-by-side positioning at the anvil */
const SIDE_OFFSET = 0.6;
/** Forward/back offset when more than 2 agents share an anvil */
const ROW_OFFSET = 0.4;

/** Compute a bench target with lateral offset so agents don't stack */
function computeBenchSlot(
  benchPos: THREE.Vector3,
  slotIndex: number,
): THREE.Vector3 {
  const xOff = slotIndex % 2 === 0 ? -SIDE_OFFSET : SIDE_OFFSET;
  const zOff = Math.floor(slotIndex / 2) * ROW_OFFSET;
  return new THREE.Vector3(benchPos.x + xOff, benchPos.y, benchPos.z + zOff);
}

/** Count how many other agents are forging/walking-to-bench in a given zone */
function countAgentsAtBench(
  states: Map<string, InternalState>,
  excludeId: string,
  zoneId: string,
): number {
  let count = 0;
  for (const [id, s] of states) {
    if (id === excludeId) continue;
    if (
      (s.animState === "FORGING" || s.animState === "WALK_TO_BENCH") &&
      s.zoneId === zoneId
    ) {
      count++;
    }
  }
  return count;
}

/** Count how many other agents are present in a given zone (any active state) */
function countAgentsInZone(
  states: Map<string, InternalState>,
  excludeId: string,
  zoneId: string,
): number {
  let count = 0;
  for (const [id, s] of states) {
    if (id === excludeId) continue;
    if (s.zoneId === zoneId && s.animState !== "WALK_TO_POINT") {
      count++;
    }
  }
  return count;
}

/** Find the zone of a sibling agent working on a sub-task from the same parent */
function findSiblingZone(
  states: Map<string, InternalState>,
  excludeId: string,
  parentEventId: string,
): string | undefined {
  for (const [id, s] of states) {
    if (id === excludeId) continue;
    if (
      s.parentEventId === parentEventId &&
      s.zoneId &&
      (s.animState === "FORGING" ||
        s.animState === "WALK_TO_BENCH" ||
        s.animState === "WALK_TO_BOARD")
    ) {
      return s.zoneId;
    }
  }
  return undefined;
}

interface AnimationControllerProps {
  agents: AgentEntity[];
  events: SwarmEvent[];
  /** Mutable ref for reading animation state without causing re-renders */
  stateMapRef: React.MutableRefObject<AnimStateMap>;
  /** Called only when an animState actually changes (not every frame) */
  onStateChange?: () => void;
  /** Called when agents start collaborating in the same zone */
  onCollaboration?: (agentIds: string[], zoneId: string) => void;
  /** IDs of currently active (lit) zones — inactive zones are dimmed, not hidden */
  activeZoneIds?: string[];
  /** Called when an agent walks into an inactive zone — auto-activates it, no limits */
  onActivateZone?: (zoneId: string) => void;
}

export default function AnimationController({
  agents,
  events,
  stateMapRef,
  onStateChange,
  onCollaboration,
  activeZoneIds,
  onActivateZone,
}: AnimationControllerProps) {
  const stateRef = useRef<Map<string, InternalState>>(new Map());
  const processedEventsRef = useRef<Set<string>>(new Set());
  const lastPublishedRef = useRef<string>(""); // fingerprint to detect changes

  const processEvents = useCallback(
    (evts: SwarmEvent[]) => {
      const states = stateRef.current;
      const processed = processedEventsRef.current;

      for (const evt of evts) {
        if (processed.has(evt.event_id)) continue;
        processed.add(evt.event_id);

        // Cleanup old processed events to prevent memory leak
        if (processed.size > MAX_PROCESSED) {
          const iter = processed.values();
          for (let i = 0; i < 100; i++) iter.next();
          // Actually delete the first 100
          const toDelete: string[] = [];
          let count = 0;
          for (const id of processed) {
            if (count++ >= 100) break;
            toDelete.push(id);
          }
          for (const id of toDelete) processed.delete(id);
        }

        if (evt.topic === "TASK_CLAIMED") {
          const agentId = (evt.payload?.agent_id as string) ?? evt.claimed_by;
          if (agentId) {
            const state = states.get(agentId);
            if (state) {
              // Store parent event id for collaboration co-location
              state.parentEventId = evt.parent_event_id;

              // B2: If this is a sub-task, try to co-locate with sibling agents
              if (evt.parent_event_id) {
                const siblingZone = findSiblingZone(
                  states,
                  agentId,
                  evt.parent_event_id,
                );
                if (siblingZone) {
                  state.zoneId = siblingZone;
                }
              }

              state.animState = "WALK_TO_BOARD";
              state.target.copy(BOARD_POS);
            }
          }
        }

        if (evt.topic === "ARTIFACT_READY") {
          const agentId = (evt.payload?.agent_id as string) ?? evt.claimed_by;
          if (agentId) {
            const state = states.get(agentId);
            if (state) {
              state.animState = "IDLE";
              state.target.copy(state.origin);
            }
          }
        }

        if (evt.topic === "TASK_CLOSED") {
          const agentId = (evt.payload?.agent_id as string) ?? evt.claimed_by;
          if (agentId) {
            const state = states.get(agentId);
            if (state && state.animState === "FORGING") {
              state.animState = "CELEBRATE";
              // After a short celebrate, go IDLE (handled in frame loop)
            }
          }
        }

        if (evt.topic === "SOS_ERROR" || evt.topic === "TASK_FAILED") {
          const agentId = (evt.payload?.agent_id as string) ?? evt.claimed_by;
          if (agentId) {
            const state = states.get(agentId);
            if (state) {
              state.animState = "ALERT";
              state.target.copy(state.origin);
            }
          }
        }

        // EVALUATING → show thinking state
        if (evt.topic === "TASK_PROGRESS") {
          const agentId = (evt.payload?.agent_id as string) ?? evt.claimed_by;
          if (agentId) {
            const state = states.get(agentId);
            if (state && state.animState === "FORGING") {
              // Stay in FORGING but could add sub-states
            }
          }
        }

        // AGENT_SUMMON_REQUEST → agent stops forging, looks up (SUMMONING)
        if ((evt.topic as string) === "AGENT_SUMMON_REQUEST") {
          const agentId = evt.payload?.requesting_agent_id as string;
          if (agentId) {
            const state = states.get(agentId);
            if (state) {
              state.animState = "SUMMONING";
              state.stateStartTime = Date.now();
            }
          }
        }

        // ZONE_JOIN_REQUEST → target agent stands at attention facing camera
        if ((evt.topic as string) === "ZONE_JOIN_REQUEST") {
          const agentId = evt.payload?.agent_id as string;
          if (agentId) {
            const state = states.get(agentId);
            if (state) {
              state.animState = "ATTENTION";
              state.stateStartTime = Date.now();
            }
          }
        }

        // AGENT_TELEPORT_IN → new agent spawns with teleport animation
        if ((evt.topic as string) === "AGENT_TELEPORT_IN") {
          const agentId = evt.payload?.agent_id as string;
          if (agentId) {
            const state = states.get(agentId);
            if (state) {
              state.animState = "TELEPORTING";
              state.stateStartTime = Date.now();
            }
          }
        }

        // DISPATCH_MOVE → direct point movement (right-click ground)
        if ((evt.topic as string) === "DISPATCH_MOVE") {
          const agentId = evt.payload?.agent_id as string;
          const targetX = evt.payload?.target_x as number;
          const targetZ = evt.payload?.target_z as number;
          const targetZoneId = evt.payload?.target_zone_id as string | undefined;
          if (agentId && Number.isFinite(targetX) && Number.isFinite(targetZ)) {
            const state = states.get(agentId);
            if (state) {
              const dest = new THREE.Vector3(targetX, 0, targetZ);
              state.directTarget = dest;
              state.target.copy(dest);
              state.animState = "WALK_TO_POINT";
              if (targetZoneId) {
                state.zoneId = targetZoneId;
              }
            }
          }
        }
      }
    },
    [],
  );

  // Initialize/sync agent states (also sync zone_id changes for dispatch)
  useEffect(() => {
    const states = stateRef.current;
    for (const agent of agents) {
      const existing = states.get(agent.agent_id);
      if (!existing) {
        const pos = new THREE.Vector3(agent.position.x, 0, agent.position.z);
        states.set(agent.agent_id, {
          position: pos.clone(),
          target: pos.clone(),
          origin: pos.clone(),
          animState: "IDLE",
          agentId: agent.agent_id,
          zoneId: agent.zone_id,
        });
      } else if (agent.zone_id && existing.zoneId !== agent.zone_id) {
        // Zone changed (e.g. right-click dispatch) — update internal zoneId
        existing.zoneId = agent.zone_id;
      }
    }
    const agentIds = new Set(agents.map((a) => a.agent_id));
    for (const key of states.keys()) {
      if (!agentIds.has(key)) states.delete(key);
    }
  }, [agents]);

  // Per-frame: process events, lerp, publish to ref (NOT React state)
  useFrame((_, delta) => {
    const states = stateRef.current;
    processEvents(events);

    let fingerprint = "";

    for (const [id, state] of states) {
      const dist = state.position.distanceTo(state.target);

      if (dist > ARRIVE_THRESHOLD) {
        // Ease-out: faster when far, slower when approaching target
        const speedFactor = Math.max(0.3, Math.min(1.0, dist / 2.0));
        const step = Math.min(MOVE_SPEED * speedFactor * delta, dist);
        const dir = new THREE.Vector3()
          .subVectors(state.target, state.position)
          .normalize();
        state.position.addScaledVector(dir, step);
      } else {
        state.position.copy(state.target);

        if (state.animState === "WALK_TO_BOARD") {
          state.animState = "WALK_TO_BENCH";
          const benchPos = ZONE_BENCH_POSITIONS[state.zoneId ?? "server"]
            ?? ZONE_BENCH_POSITIONS.server;

          // B1: Offset so multiple agents stand side-by-side at the anvil
          const slot = countAgentsAtBench(states, id, state.zoneId ?? "server");
          const slottedPos = computeBenchSlot(benchPos, slot);
          state.target.copy(slottedPos);
        } else if (state.animState === "WALK_TO_BENCH") {
          state.animState = "FORGING";
        } else if (state.animState === "WALK_TO_POINT") {
          // Arrived at direct target — detect zone and update state
          const zone = detectZoneAtPosition(state.position.x, state.position.z);
          if (zone) {
            // Activate zone if not yet active
            if (activeZoneIds && !activeZoneIds.includes(zone.id)) {
              onActivateZone?.(zone.id);
            }

            state.zoneId = zone.id;
            state.origin.copy(state.position);

            // Check if other agents are already present in this zone
            const othersInZone = countAgentsInZone(states, id, zone.id);
            if (othersInZone > 0) {
              state.animState = "FORGING";
              // Collect all collaborating agent IDs
              const collabIds = [id];
              for (const [otherId, otherState] of states) {
                if (otherId === id) continue;
                if (otherState.zoneId === zone.id && otherState.animState !== "WALK_TO_POINT") {
                  if (otherState.animState === "IDLE") {
                    otherState.animState = "FORGING";
                  }
                  collabIds.push(otherId);
                }
              }
              // Notify page to generate collaboration events
              onCollaboration?.(collabIds, zone.id);
            } else {
              state.animState = "IDLE";
            }
          } else {
            state.origin.copy(state.position);
            state.animState = "IDLE";
            state.zoneId = undefined;
          }
          state.directTarget = undefined;
        }
      }

      // Auto-return from timed states
      const now = Date.now();
      const TIMED_STATES: Record<string, number> = {
        CELEBRATE: 2000,
        ALERT: 2000,
        SUMMONING: 3000,
        ATTENTION: 15000,
        TELEPORTING: 2000,
      };
      const timeoutMs = TIMED_STATES[state.animState];
      if (timeoutMs !== undefined) {
        if (!state.stateStartTime) {
          state.stateStartTime = now;
        } else if (now - state.stateStartTime > timeoutMs) {
          state.animState = "IDLE";
          state.target.copy(state.origin);
          state.stateStartTime = undefined;
        }
      } else {
        state.stateStartTime = undefined;
      }

      fingerprint += `${id}:${state.animState},`;
    }

    // Update shared ref (no React re-render)
    const outputMap = stateMapRef.current;
    outputMap.clear();
    for (const [id, state] of states) {
      outputMap.set(id, {
        position: state.position, // share the ref, no clone
        animState: state.animState,
        agentId: state.agentId,
        zoneId: state.zoneId,
      });
    }

    // Only trigger React re-render when animStates change (not position)
    if (fingerprint !== lastPublishedRef.current) {
      lastPublishedRef.current = fingerprint;
      onStateChange?.();
    }
  });

  return null;
}
