"use client";

import { useState, useCallback, useEffect, useRef, memo } from "react";
import type { Camera } from "three";
import type { AgentEntity } from "@corpcraft/contracts";

// ────────────────────────────────────────────
// SelectionBox — RTS-style box selection overlay
// FIX: Only activates after a minimum drag distance (10px)
// so normal clicks pass through to R3F / OrbitControls.
// ────────────────────────────────────────────

interface SelectionBoxProps {
  agents: AgentEntity[];
  onSelect: (agentIds: string[]) => void;
  /** Ref to the canvas container for coordinate mapping */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Camera for world→screen projection */
  camera?: Camera;
  /** Animated positions from AnimationController — preferred over store positions */
  animStateMapRef?: React.RefObject<Map<string, { position: { x: number; z: number } }> | null>;
}

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const MIN_DRAG_PX = 10; // must drag at least 10px before box appears

// Lazy-load THREE for projection
let THREE_MOD: typeof import("three") | null = null;
async function ensureThree() {
  if (!THREE_MOD) THREE_MOD = await import("three");
  return THREE_MOD;
}

const SelectionBox = memo(function SelectionBox({
  agents,
  onSelect,
  containerRef,
  camera,
  animStateMapRef,
}: SelectionBoxProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef(false); // true once drag exceeds threshold

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0) return;
      // Don't interfere with UI elements
      const target = e.target as HTMLElement;
      if (target.closest("button, input, [data-no-select]")) return;

      const container = containerRef.current;
      if (!container) return;

      const bounds = container.getBoundingClientRect();
      startRef.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      activeRef.current = false;
    },
    [containerRef],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!startRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      const bounds = container.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;

      const dx = Math.abs(x - startRef.current.x);
      const dy = Math.abs(y - startRef.current.y);

      // Only activate box once drag exceeds threshold
      if (!activeRef.current) {
        if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) return;
        activeRef.current = true;
      }

      setRect({
        x1: startRef.current.x,
        y1: startRef.current.y,
        x2: x,
        y2: y,
      });
    },
    [containerRef],
  );

  const handlePointerUp = useCallback(async () => {
    const wasActive = activeRef.current;
    startRef.current = null;
    activeRef.current = false;

    if (!wasActive || !rect) {
      setRect(null);
      return;
    }

    const container = containerRef.current;
    if (!container || !camera) {
      setRect(null);
      return;
    }

    const THREE = await ensureThree();
    const bounds = container.getBoundingClientRect();

    const minX = Math.min(rect.x1, rect.x2);
    const maxX = Math.max(rect.x1, rect.x2);
    const minY = Math.min(rect.y1, rect.y2);
    const maxY = Math.max(rect.y1, rect.y2);

    const selected: string[] = [];
    for (const agent of agents) {
      const anim = animStateMapRef?.current?.get(agent.agent_id);
      const px = anim?.position.x ?? agent.position.x;
      const pz = anim?.position.z ?? agent.position.z;
      const worldPos = new THREE.Vector3(px, 0, pz);
      const projected = worldPos.project(camera);
      const screenX = ((projected.x + 1) / 2) * bounds.width;
      const screenY = ((1 - projected.y) / 2) * bounds.height;

      if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
        selected.push(agent.agent_id);
      }
    }

    onSelect(selected);
    setRect(null);
  }, [rect, agents, onSelect, containerRef, camera, animStateMapRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [containerRef, handlePointerDown, handlePointerMove, handlePointerUp]);

  if (!rect) return null;

  const left = Math.min(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const width = Math.abs(rect.x2 - rect.x1);
  const height = Math.abs(rect.y2 - rect.y1);

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        border: "1px dashed #4ade80",
        backgroundColor: "rgba(74, 222, 128, 0.08)",
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
});

export default SelectionBox;
