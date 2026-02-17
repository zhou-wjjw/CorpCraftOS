"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AccessoryType } from "@corpcraft/contracts";

// ────────────────────────────────────────────
// AgentModel — Pure procedural Q-version chibi avatar
// No GLTF loading — all geometry-based with enhanced animations.
//
// Animation states:
//  IDLE            — gentle breathing + body sway
//  WALK_TO_BOARD/
//  WALK_TO_BENCH   — run cycle: lean forward, big arm/leg swing, cape flutter
//  FORGING         — hammer strike: body bob + one-arm swing
//  CELEBRATE       — jump + spin + arms up
//  ALERT           — rapid shake
//  THINKING        — head tilt + slow nod
//  HANDOFF         — idle-like
// ────────────────────────────────────────────

interface AgentModelProps {
  name: string;
  colorPrimary: string;
  colorSecondary: string;
  accessory: AccessoryType;
  animState?: string;
}

// ── Accessories ──

function Helmet({ color }: { color: string }) {
  return (
    <group position={[0, 1.08, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.22, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#8a8a9e" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Visor strip */}
      <mesh position={[0, -0.04, 0.16]}>
        <boxGeometry args={[0.28, 0.06, 0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.8} />
      </mesh>
    </group>
  );
}

function Scarf({ color }: { color: string }) {
  return (
    <group position={[0, 0.68, 0]}>
      <mesh castShadow>
        <torusGeometry args={[0.2, 0.05, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* Tail */}
      <mesh position={[0.15, -0.08, -0.12]} rotation={[0.3, 0, -0.4]} castShadow>
        <boxGeometry args={[0.06, 0.22, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  );
}

function StarBadge({ color }: { color: string }) {
  return (
    <group position={[0.18, 0.5, 0.14]}>
      <mesh castShadow>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} roughness={0.2} metalness={0.6} />
      </mesh>
    </group>
  );
}

function Visor({ color }: { color: string }) {
  return (
    <group position={[0, 0.92, 0.2]}>
      <mesh>
        <boxGeometry args={[0.36, 0.1, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} metalness={0.9} roughness={0.1} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function Crown({ color }: { color: string }) {
  return (
    <group position={[0, 1.14, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.16, 0.18, 0.1, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Crown points */}
      {[0, 1.05, 2.09, 3.14, 4.19, 5.24].map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 0.15, 0.08, Math.sin(angle) * 0.15]} castShadow>
          <coneGeometry args={[0.03, 0.08, 4]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Horns({ color }: { color: string }) {
  return (
    <group position={[0, 1.0, 0]}>
      <mesh position={[-0.14, 0.08, 0]} rotation={[0, 0, 0.4]} castShadow>
        <coneGeometry args={[0.04, 0.2, 6]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.14, 0.08, 0]} rotation={[0, 0, -0.4]} castShadow>
        <coneGeometry args={[0.04, 0.2, 6]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

function NinjaMask({ color }: { color: string }) {
  return (
    <group position={[0, 0.88, 0.12]}>
      <mesh>
        <boxGeometry args={[0.38, 0.12, 0.12]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>
      {/* Eye slits */}
      <mesh position={[-0.08, 0.01, 0.06]}>
        <boxGeometry args={[0.08, 0.03, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0.08, 0.01, 0.06]}>
        <boxGeometry args={[0.08, 0.03, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Accessory({ type, color }: { type: AccessoryType; color: string }) {
  switch (type) {
    case "helmet": return <Helmet color={color} />;
    case "scarf": return <Scarf color={color} />;
    case "star_badge": return <StarBadge color={color} />;
    case "visor": return <Visor color={color} />;
    case "crown": return <Crown color={color} />;
    case "horns": return <Horns color={color} />;
    case "ninja_mask": return <NinjaMask color={color} />;
    default: return null;
  }
}

// ── Enhanced Procedural Model with rich animations ──

function ProceduralModel({ colorPrimary, colorSecondary, accessory, animState }: {
  colorPrimary: string;
  colorSecondary: string;
  accessory: AccessoryType;
  animState?: string;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const capeRef = useRef<THREE.Mesh>(null);

  // Brighter version for head
  const headColor = new THREE.Color(colorPrimary).lerp(new THREE.Color("#ffffff"), 0.2).getHexString();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const isWalking = animState === "WALK_TO_BOARD" || animState === "WALK_TO_BENCH";
    const isForging = animState === "FORGING";
    const isCelebrating = animState === "CELEBRATE";
    const isAlert = animState === "ALERT";
    const isThinking = animState === "THINKING";

    // ── Body tilt & sway ──
    if (bodyRef.current) {
      if (isWalking) {
        // Lean forward while running + slight side-to-side sway
        bodyRef.current.rotation.x = 0.15;
        bodyRef.current.rotation.z = Math.sin(t * 8) * 0.06;
      } else if (isForging) {
        // Bob up and down while hammering
        bodyRef.current.rotation.x = Math.sin(t * 6) * 0.08;
        bodyRef.current.rotation.z = 0;
      } else if (isCelebrating) {
        // Spin around!
        bodyRef.current.rotation.x = 0;
        bodyRef.current.rotation.z = 0;
        bodyRef.current.rotation.y = t * 6;
      } else if (isAlert) {
        // Rapid shake
        bodyRef.current.rotation.x = 0;
        bodyRef.current.rotation.z = Math.sin(t * 20) * 0.08;
      } else if (isThinking) {
        // Gentle lean
        bodyRef.current.rotation.x = 0;
        bodyRef.current.rotation.z = Math.sin(t * 0.8) * 0.03;
      } else {
        // IDLE: gentle breathing sway
        bodyRef.current.rotation.x = 0;
        bodyRef.current.rotation.z = Math.sin(t * 1.2) * 0.02;
        bodyRef.current.rotation.y = 0;
      }
    }

    // ── Head animation ──
    if (headRef.current) {
      if (isThinking) {
        // Slow nod + tilt
        headRef.current.rotation.x = Math.sin(t * 1.5) * 0.12;
        headRef.current.rotation.z = 0.1;
      } else if (isCelebrating) {
        headRef.current.rotation.x = -0.2; // Look up
        headRef.current.rotation.z = 0;
      } else {
        headRef.current.rotation.x = 0;
        headRef.current.rotation.z = 0;
      }
    }

    // ── Leg swing ──
    if (leftLegRef.current && rightLegRef.current) {
      if (isWalking) {
        // Big running swing
        const legSwing = Math.sin(t * 10) * 0.7;
        leftLegRef.current.rotation.x = legSwing;
        rightLegRef.current.rotation.x = -legSwing;
      } else if (isCelebrating) {
        // Tiny excited kicks
        const kick = Math.sin(t * 12) * 0.3;
        leftLegRef.current.rotation.x = kick;
        rightLegRef.current.rotation.x = -kick;
      } else {
        // Idle / other
        leftLegRef.current.rotation.x = 0;
        rightLegRef.current.rotation.x = 0;
      }
    }

    // ── Arm swing ──
    if (leftArmRef.current && rightArmRef.current) {
      if (isWalking) {
        // Big alternating arm swing (opposite to legs)
        const armSwing = Math.sin(t * 10) * 0.65;
        leftArmRef.current.rotation.x = -armSwing;
        rightArmRef.current.rotation.x = armSwing;
      } else if (isForging) {
        // Hammer strike: right arm swings down hard, left steady
        rightArmRef.current.rotation.x = Math.sin(t * 6) * 0.8;
        leftArmRef.current.rotation.x = -0.2;
      } else if (isCelebrating) {
        // Arms up, slight wave
        leftArmRef.current.rotation.x = -2.0 + Math.sin(t * 6) * 0.3;
        rightArmRef.current.rotation.x = -2.0 + Math.sin(t * 6 + 1) * 0.3;
      } else if (isAlert) {
        // Tense, slightly raised
        leftArmRef.current.rotation.x = -0.3;
        rightArmRef.current.rotation.x = -0.3;
      } else if (isThinking) {
        // Hand on chin gesture (right arm up)
        rightArmRef.current.rotation.x = -0.8;
        leftArmRef.current.rotation.x = Math.sin(t * 1.5) * 0.05;
      } else {
        // Idle: gentle sway
        const idleSwing = Math.sin(t * 1.5) * 0.05;
        leftArmRef.current.rotation.x = -idleSwing;
        rightArmRef.current.rotation.x = idleSwing;
      }
    }

    // ── Cape flutter ──
    if (capeRef.current) {
      if (isWalking) {
        // Strong flutter while running
        capeRef.current.rotation.x = 0.3 + Math.sin(t * 10) * 0.15;
      } else if (isCelebrating) {
        capeRef.current.rotation.x = Math.sin(t * 8) * 0.2;
      } else {
        // Gentle idle sway
        capeRef.current.rotation.x = Math.sin(t * 1.5) * 0.03;
      }
    }
  });

  return (
    <group ref={bodyRef}>
      {/* === Body (torso) — shorter for Q-version === */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.32, 8, 16]} />
        <meshStandardMaterial
          color={colorPrimary}
          roughness={0.45}
          metalness={0.15}
          emissive={colorPrimary}
          emissiveIntensity={0.05}
        />
      </mesh>

      {/* === Head (big for Q-version) === */}
      <mesh ref={headRef} position={[0, 0.88, 0]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={`#${headColor}`} roughness={0.35} metalness={0.1} />
      </mesh>

      {/* === Eyes === */}
      {accessory !== "ninja_mask" && (
        <>
          <mesh position={[-0.1, 0.92, 0.24]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.1, 0.92, 0.24]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Pupils */}
          <mesh position={[-0.1, 0.92, 0.285]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color="#1a1a2e" />
          </mesh>
          <mesh position={[0.1, 0.92, 0.285]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color="#1a1a2e" />
          </mesh>
        </>
      )}

      {/* === Mouth === */}
      <mesh position={[0, 0.82, 0.27]}>
        <boxGeometry args={[0.08, 0.02, 0.02]} />
        <meshBasicMaterial color="#4a3728" />
      </mesh>

      {/* === Cape (animated) === */}
      <mesh ref={capeRef} position={[0, 0.44, -0.16]} castShadow>
        <boxGeometry args={[0.3, 0.4, 0.04]} />
        <meshStandardMaterial
          color={colorSecondary}
          roughness={0.55}
          metalness={0.05}
          emissive={colorSecondary}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* === Arms (animated) === */}
      <mesh ref={leftArmRef} position={[-0.26, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.16, 4, 8]} />
        <meshStandardMaterial color={colorPrimary} roughness={0.5} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.26, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.16, 4, 8]} />
        <meshStandardMaterial color={colorPrimary} roughness={0.5} />
      </mesh>

      {/* === Legs (animated) === */}
      <mesh ref={leftLegRef} position={[-0.08, 0.12, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
        <meshStandardMaterial color={colorPrimary} roughness={0.6} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.08, 0.12, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
        <meshStandardMaterial color={colorPrimary} roughness={0.6} />
      </mesh>

      {/* === Feet === */}
      <mesh position={[-0.08, 0.03, 0.03]}>
        <boxGeometry args={[0.1, 0.06, 0.14]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.7} />
      </mesh>
      <mesh position={[0.08, 0.03, 0.03]}>
        <boxGeometry args={[0.1, 0.06, 0.14]} />
        <meshStandardMaterial color="#2a2a3e" roughness={0.7} />
      </mesh>

      {/* === Accessory === */}
      <Accessory type={accessory} color={colorSecondary} />
    </group>
  );
}

// ── Main Export ──

const AgentModel = memo(function AgentModel({
  colorPrimary,
  colorSecondary,
  accessory,
  animState,
}: AgentModelProps) {
  return (
    <ProceduralModel
      colorPrimary={colorPrimary}
      colorSecondary={colorSecondary}
      accessory={accessory}
      animState={animState}
    />
  );
});

export default AgentModel;
