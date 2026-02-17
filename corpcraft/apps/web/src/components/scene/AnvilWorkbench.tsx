"use client";

import { memo } from "react";
import { Sparkles } from "@react-three/drei";

// ────────────────────────────────────────────
// AnvilWorkbench — blacksmith anvil (1.6x scale)
// Fire intensity linked to mpRatio
// ────────────────────────────────────────────

interface AnvilWorkbenchProps {
  position: [number, number, number];
  isForging: boolean;
  mpRatio?: number;
}

const AnvilWorkbench = memo(function AnvilWorkbench({
  position,
  isForging,
  mpRatio = 1,
}: AnvilWorkbenchProps) {
  const fireIntensity = Math.max(0.2, mpRatio);
  const sparkleCount = Math.max(8, Math.round(40 * fireIntensity));
  const fireColor = mpRatio > 0.4 ? "#ff6b00" : mpRatio > 0.2 ? "#cc3300" : "#881100";

  return (
    <group position={position}>
      {/* === Pedestal base === */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.4, 0.55]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* === Anvil body === */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.95, 0.3, 0.45]} />
        <meshStandardMaterial color="#555555" roughness={0.25} metalness={0.85} />
      </mesh>

      {/* === Anvil horn === */}
      <mesh position={[0.55, 0.55, 0]} castShadow rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.3, 0.18, 0.2]} />
        <meshStandardMaterial color="#555555" roughness={0.25} metalness={0.85} />
      </mesh>

      {/* === Anvil face (top) === */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.8, 0.04, 0.4]} />
        <meshStandardMaterial color="#666666" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* === Forging FX === */}
      {isForging && (
        <>
          <pointLight
            position={[0, 1.0, 0]}
            color={fireColor}
            intensity={0.8 * fireIntensity}
            distance={4}
            decay={2}
          />
          <Sparkles
            count={sparkleCount}
            scale={[1.4, 1.6, 1.4]}
            size={2.5 * fireIntensity}
            speed={0.6}
            color={fireColor}
            position={[0, 1.0, 0]}
          />
        </>
      )}
    </group>
  );
});

export default AnvilWorkbench;
