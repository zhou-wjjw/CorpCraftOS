"use client";

import { memo, useRef, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { PointLight as PointLightType } from "three";

// ────────────────────────────────────────────
// BountyBoard — Enhanced quest board with company sign
// - Company signage on top
// - Task card pins on the board
// - Ground glow circle
// - Clickable: opens task list panel
// NO distanceFactor on Html (ortho camera zoom bug)
// ────────────────────────────────────────────

interface BountyBoardProps {
  openTaskCount: number;
  position?: [number, number, number];
  onClick?: () => void;
}

const BountyBoard = memo(function BountyBoard({
  openTaskCount,
  position = [0, 0, 0],
  onClick,
}: BountyBoardProps) {
  const glowRef = useRef<PointLightType>(null);
  const [hovered, setHovered] = useState(false);

  const handlePointerOver = useCallback(() => {
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "default";
  }, []);

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onClick?.();
    },
    [onClick],
  );

  useFrame(({ clock }) => {
    if (glowRef.current && openTaskCount > 0) {
      const pulse = 0.6 + Math.sin(clock.getElapsedTime() * 3) * 0.3;
      glowRef.current.intensity = pulse;
    } else if (glowRef.current) {
      glowRef.current.intensity = 0;
    }
  });

  return (
    <group position={position}>
      {/* === Ground glow circle === */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 1.2, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.06} depthWrite={false} />
      </mesh>

      {/* === Left leg === */}
      <mesh position={[-0.55, 0.7, 0]} castShadow>
        <boxGeometry args={[0.08, 1.4, 0.08]} />
        <meshStandardMaterial color="#2a1d14" roughness={0.8} />
      </mesh>

      {/* === Right leg === */}
      <mesh position={[0.55, 0.7, 0]} castShadow>
        <boxGeometry args={[0.08, 1.4, 0.08]} />
        <meshStandardMaterial color="#2a1d14" roughness={0.8} />
      </mesh>

      {/* === Board surface (clickable) === */}
      <mesh
        position={[0, 1.55, 0]}
        castShadow
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[1.4, 1.0, 0.06]} />
        <meshStandardMaterial
          color={hovered ? "#5a4030" : "#3d2b1f"}
          roughness={0.65}
          metalness={0.05}
          emissive={hovered ? "#fbbf24" : "#000000"}
          emissiveIntensity={hovered ? 0.15 : 0}
        />
      </mesh>

      {/* === Board top trim === */}
      <mesh position={[0, 2.1, 0]} castShadow>
        <boxGeometry args={[1.5, 0.08, 0.08]} />
        <meshStandardMaterial color="#5a3d2b" roughness={0.7} />
      </mesh>

      {/* === Task card pins (small colored rectangles on board) === */}
      {openTaskCount > 0 && (
        <>
          <mesh position={[-0.35, 1.65, 0.035]}>
            <boxGeometry args={[0.22, 0.28, 0.01]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.7} />
          </mesh>
          <mesh position={[-0.35, 1.8, 0.04]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
      {openTaskCount > 1 && (
        <>
          <mesh position={[0.05, 1.58, 0.035]}>
            <boxGeometry args={[0.22, 0.25, 0.01]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.7} />
          </mesh>
          <mesh position={[0.05, 1.72, 0.04]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
      {openTaskCount > 2 && (
        <>
          <mesh position={[0.38, 1.62, 0.035]}>
            <boxGeometry args={[0.2, 0.22, 0.01]} />
            <meshStandardMaterial color="#dcfce7" roughness={0.7} />
          </mesh>
          <mesh position={[0.38, 1.74, 0.04]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}

      {/* === Company sign on top === */}
      <group position={[0.9, 1.6, 0.6]}>
        {/* Sign legs */}
        <mesh position={[-0.4, 0.4, 0]} castShadow>
          <boxGeometry args={[0.04, 0.8, 0.04]} />
          <meshStandardMaterial color="#555555" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0.4, 0.4, 0]} castShadow>
          <boxGeometry args={[0.04, 0.8, 0.04]} />
          <meshStandardMaterial color="#555555" roughness={0.6} metalness={0.4} />
        </mesh>
        {/* Sign board */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <boxGeometry args={[1.0, 0.4, 0.04]} />
          <meshStandardMaterial color="#2a2a3e" roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Sign frame */}
        <mesh position={[0, 0.85, 0.025]}>
          <boxGeometry args={[1.05, 0.45, 0.01]} />
          <meshStandardMaterial color="#444466" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Company logo box */}
        <mesh position={[-0.32, 0.85, 0.035]}>
          <boxGeometry args={[0.18, 0.18, 0.01]} />
          <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.3} />
        </mesh>
        {/* Sign label */}
        <Html position={[0.08, 0.85, 0.04]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div style={{
            fontFamily: "'SF Mono', monospace", fontSize: 9, fontWeight: 700,
            color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", userSelect: "none",
          }}>
            Company Inc.
          </div>
        </Html>
      </group>

      {/* === Labels (NO distanceFactor) === */}
      <Html position={[0, 1.88, 0.04]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontWeight: 900, fontSize: 14, letterSpacing: "0.1em",
          color: "#fbbf24",
          textShadow: "0 0 10px rgba(251,191,36,0.4)",
          userSelect: "none",
          padding: "2px 8px",
          background: "rgba(10, 10, 15, 0.5)",
          borderRadius: 4,
        }}>
          BOUNTY
        </div>
      </Html>
      {openTaskCount > 0 && (
        <Html position={[0, 1.4, 0.04]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div style={{
            fontFamily: "'SF Mono', monospace", fontSize: 11, fontWeight: 700,
            color: "#f87171", background: "rgba(10, 10, 15, 0.6)",
            padding: "1px 8px", borderRadius: 8, userSelect: "none",
            border: "1px solid rgba(248, 113, 113, 0.3)",
          }}>
            {openTaskCount} open
          </div>
        </Html>
      )}

      {/* === Hover glow === */}
      <pointLight
        ref={glowRef}
        position={[0, 2.0, 0.4]}
        color="#fbbf24"
        intensity={0}
        distance={4}
        decay={2}
      />
    </group>
  );
});

export default BountyBoard;
