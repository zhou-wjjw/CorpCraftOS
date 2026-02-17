"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ZONES, getPropPosition } from "@/lib/zone-config";

// ────────────────────────────────────────────
// ZoneProps — Enhanced characteristic 3D objects (2x scale)
// - Blueprint-style file stacks
// - LED-animated servers
// - Floating/rotating idle animations
// ────────────────────────────────────────────

/** Blueprint stack — flat blue sheets with circuit line pattern */
function BlueprintStack({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.05;
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.8) * 0.015;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Base sheet */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0.12]} receiveShadow castShadow>
        <planeGeometry args={[0.9, 0.7]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>
      {/* Second sheet */}
      <mesh position={[0.04, 0.04, 0.02]} rotation={[-Math.PI / 2, 0, -0.06]} receiveShadow castShadow>
        <planeGeometry args={[0.85, 0.65]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} side={THREE.DoubleSide} transparent opacity={0.9} />
      </mesh>
      {/* Top sheet */}
      <mesh position={[-0.02, 0.06, -0.01]} rotation={[-Math.PI / 2, 0, 0.04]} receiveShadow castShadow>
        <planeGeometry args={[0.8, 0.6]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      {/* Circuit line decorations on top sheet */}
      <mesh position={[-0.1, 0.065, -0.05]} rotation={[-Math.PI / 2, 0, 0.04]}>
        <planeGeometry args={[0.35, 0.005]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.05, 0.065, 0.05]} rotation={[-Math.PI / 2, 0, 0.04]}>
        <planeGeometry args={[0.25, 0.005]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Gear icon center */}
      <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.06, 0.1, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Server rack with blinking LEDs */
function ServerBox({ color }: { color: string }) {
  const led1Ref = useRef<THREE.MeshStandardMaterial>(null);
  const led2Ref = useRef<THREE.MeshStandardMaterial>(null);
  const led3Ref = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (led1Ref.current) led1Ref.current.emissiveIntensity = 1.5 + Math.sin(t * 3) * 1.5;
    if (led2Ref.current) led2Ref.current.emissiveIntensity = 1.5 + Math.sin(t * 2.3 + 1) * 1.5;
    if (led3Ref.current) led3Ref.current.emissiveIntensity = 1.5 + Math.sin(t * 4.1 + 2) * 1.5;
  });

  return (
    <group>
      {/* Main body */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.6, 0.85]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Vent grille */}
      {[-0.15, 0, 0.15].map((z, i) => (
        <mesh key={i} position={[0.305, 0.3, z]}>
          <boxGeometry args={[0.01, 0.4, 0.08]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
        </mesh>
      ))}
      {/* LEDs */}
      <mesh position={[0.31, 0.42, 0.15]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial ref={led1Ref} color="#4ade80" emissive="#4ade80" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0.31, 0.42, -0.05]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial ref={led2Ref} color="#60a5fa" emissive="#60a5fa" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0.31, 0.42, -0.22]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshStandardMaterial ref={led3Ref} color="#fbbf24" emissive="#fbbf24" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/** Bug model with animated antennae */
function BugModel({ color }: { color: string }) {
  const ant1Ref = useRef<THREE.Mesh>(null);
  const ant2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ant1Ref.current) ant1Ref.current.rotation.z = 0.6 + Math.sin(t * 3) * 0.15;
    if (ant2Ref.current) ant2Ref.current.rotation.z = -0.6 - Math.sin(t * 3 + 0.5) * 0.15;
  });

  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Head */}
      <mesh position={[0.2, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.3, 0.32, 0.06]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.3, 0.32, -0.06]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Antennae (animated) */}
      <mesh ref={ant1Ref} position={[0.3, 0.42, 0.06]} rotation={[0, 0, 0.6]}>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={ant2Ref} position={[0.3, 0.42, -0.06]} rotation={[0, 0, 0.6]}>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Legs */}
      {[-0.12, 0, 0.12].map((z, i) => (
        <group key={i}>
          <mesh position={[-0.2, 0.1, z]} rotation={[0, 0, 0.8]}>
            <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
            <meshStandardMaterial color="#4a3020" />
          </mesh>
          <mesh position={[0.05, 0.1, z]} rotation={[0, 0, -0.8]}>
            <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
            <meshStandardMaterial color="#4a3020" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Shield with emblem */
function ShieldModel({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.6) * 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.38, 0.7, 6]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <coneGeometry args={[0.32, 0.25, 6]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Emblem star */}
      <mesh position={[0, 0.45, 0.32]}>
        <octahedronGeometry args={[0.08, 0]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.4} metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

/** Megaphone with slow rotation */
function MegaphoneModel({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = -0.5 + Math.sin(clock.getElapsedTime() * 0.4) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, -0.3]} castShadow>
        <coneGeometry args={[0.1, 0.6, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-0.25, 0.32, 0]} rotation={[0, 0, -0.3]} castShadow>
        <cylinderGeometry args={[0.2, 0.1, 0.12, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Sound waves */}
      {[0.18, 0.28].map((r, i) => (
        <mesh key={i} position={[-0.32, 0.34, 0]} rotation={[0, Math.PI / 2, 0]}>
          <ringGeometry args={[r, r + 0.02, 16, 1, 0, Math.PI * 0.6]} />
          <meshBasicMaterial color={color} transparent opacity={0.2 - i * 0.06} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Data chart with floating animation */
function DataChart({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.7) * 0.015;
    }
  });

  const heights = [0.3, 0.44, 0.24, 0.56];
  return (
    <group ref={groupRef}>
      {heights.map((h, i) => (
        <mesh key={i} position={[-0.18 + i * 0.15, h / 2, 0]} castShadow>
          <boxGeometry args={[0.1, h, 0.1]} />
          <meshStandardMaterial
            color={color}
            roughness={0.4}
            emissive={color}
            emissiveIntensity={0.15 + i * 0.06}
          />
        </mesh>
      ))}
      {/* Base line */}
      <mesh position={[0.04, 0.01, 0]}>
        <boxGeometry args={[0.7, 0.02, 0.02]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

const ZONE_PROPS = ZONES.map((z) => ({
  zoneId: z.id,
  position: getPropPosition(z.id),
  model: z.propModel,
  color: z.propColor,
}));

function renderModel(type: string, color: string) {
  switch (type) {
    case "files": return <BlueprintStack color={color} />;
    case "server": return <ServerBox color={color} />;
    case "bug": return <BugModel color={color} />;
    case "shield": return <ShieldModel color={color} />;
    case "megaphone": return <MegaphoneModel color={color} />;
    case "chart": return <DataChart color={color} />;
    default: return null;
  }
}

const ZoneProps = memo(function ZoneProps({ activeZoneIds }: { activeZoneIds?: string[] }) {
  const visible = activeZoneIds
    ? ZONE_PROPS.filter((zp) => activeZoneIds.includes(zp.zoneId))
    : ZONE_PROPS;

  return (
    <group>
      {visible.map((zp) => (
        <group key={zp.zoneId} position={zp.position}>
          {renderModel(zp.model, zp.color)}
        </group>
      ))}
    </group>
  );
});

export default ZoneProps;
