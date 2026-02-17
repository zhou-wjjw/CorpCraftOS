"use client";

import { memo, useRef } from "react";
import type * as THREE from "three";
import { MAP_BOUNDS } from "@/lib/zone-config";

// ────────────────────────────────────────────
// GroundPlane — Invisible full-map ground mesh
// Receives right-click events and returns the
// world-space intersection point via callback.
// ────────────────────────────────────────────

interface GroundPlaneProps {
  /** Called with the world-space point when user right-clicks the ground */
  onRightClick: (point: THREE.Vector3) => void;
}

const PADDING = 4;

const GroundPlane = memo(function GroundPlane({ onRightClick }: GroundPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      onContextMenu={(e) => {
        e.stopPropagation();
        (e.nativeEvent as MouseEvent)?.preventDefault?.();
        onRightClick(e.point.clone());
      }}
    >
      <planeGeometry args={[MAP_BOUNDS.width + PADDING, MAP_BOUNDS.height + PADDING]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
});

export default GroundPlane;
