"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AnimStateMap } from "./AnimationController";
import {
  useAllCollabSessions,
  useSummonRequests,
} from "@/hooks/useSwarmStore";
import type { ZoneCollabSession } from "@corpcraft/contracts";

// ────────────────────────────────────────────
// ZoneCollabVisualizer — 3D collaboration effects
// Replaces static collab indicators with immersive effects:
//   - Negotiation beams: flowing blue data lines between members
//   - Magic circles: rotating golden ground ring when collab is active
//   - Sparkle field: ambient particles around collaborating zone
// Mounted inside the R3F Canvas, reads state from Zustand.
// ────────────────────────────────────────────

const BEAM_COLOR = new THREE.Color("#0EA5E9");
const CIRCLE_COLOR = new THREE.Color("#ffd700");
const CIRCLE_EMISSIVE = new THREE.Color("#ffd700").multiplyScalar(2);

// ── Negotiation Beam: flowing dashed line between two agents ──

function NegotiationBeam({
  agentA,
  agentB,
  animStateMapRef,
}: {
  agentA: string;
  agentB: string;
  animStateMapRef: React.RefObject<AnimStateMap>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Line | null>(null);
  const matRef = useRef<THREE.LineDashedMaterial | null>(null);

  // Create line imperatively
  useFrame((_, delta) => {
    const group = groupRef.current;
    const animMap = animStateMapRef.current;
    if (!group || !animMap) return;

    // Lazy init
    if (!lineRef.current) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array([0, 0.5, 0, 0, 0.5, 0]), 3),
      );
      const material = new THREE.LineDashedMaterial({
        color: BEAM_COLOR,
        dashSize: 0.25,
        gapSize: 0.12,
        transparent: true,
        opacity: 0.8,
        linewidth: 1,
      });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      group.add(line);
      lineRef.current = line;
      matRef.current = material;
    }

    const a = animMap.get(agentA);
    const b = animMap.get(agentB);
    if (!a || !b) {
      if (lineRef.current) lineRef.current.visible = false;
      return;
    }

    lineRef.current.visible = true;

    const posAttr = lineRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    arr[0] = a.position.x;
    arr[1] = 0.6;
    arr[2] = a.position.z;
    arr[3] = b.position.x;
    arr[4] = 0.6;
    arr[5] = b.position.z;
    posAttr.needsUpdate = true;
    lineRef.current.computeLineDistances();

    // Animate flowing dash offset
    if (matRef.current && "dashOffset" in matRef.current) {
      (matRef.current as unknown as { dashOffset: number }).dashOffset -= delta * 0.8;
    }
  });

  return <group ref={groupRef} />;
}

// ── Magic Circle: rotating golden ground ring at zone center ──

function MagicCircle({
  center,
  radius,
}: {
  center: THREE.Vector3;
  radius: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.5 + Math.sin(t * 2) * 0.15;
    }
    if (outerRef.current) {
      outerRef.current.rotation.z = -t * 0.3;
      const mat = outerRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.3 + Math.sin(t * 3 + 1) * 0.1;
    }
  });

  return (
    <group position={[center.x, 0.03, center.z]}>
      {/* Inner ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.6, radius * 0.7, 64]} />
        <meshStandardMaterial
          color={CIRCLE_COLOR}
          emissive={CIRCLE_EMISSIVE}
          emissiveIntensity={1.5}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Outer ring */}
      <mesh ref={outerRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.85, radius * 0.9, 64]} />
        <meshStandardMaterial
          color={CIRCLE_COLOR}
          emissive={CIRCLE_EMISSIVE}
          emissiveIntensity={1}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Sparkle field around collaborating agents ──

function CollabSparkles({
  center,
  radius,
}: {
  center: THREE.Vector3;
  radius: number;
}) {
  const particlesRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 20;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = 0.2 + Math.random() * 1.5;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, [radius]);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    const t = clock.getElapsedTime();
    const posArr = particlesRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < posArr.length / 3; i++) {
      posArr[i * 3 + 1] = 0.2 + Math.sin(t * 1.5 + i) * 0.5 + 0.5;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef} position={[center.x, 0, center.z]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#0EA5E9"
        size={0.06}
        transparent
        opacity={0.6}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// ── Compute center and radius for a collaboration session ──

function computeSessionGeometry(
  session: ZoneCollabSession,
  animMap: AnimStateMap | null,
): { center: THREE.Vector3; radius: number; memberIds: string[] } | null {
  if (!animMap) return null;

  const memberIds = session.members
    .filter((m) => m.join_status === "ACTIVE")
    .map((m) => m.agent_id);

  if (memberIds.length === 0) return null;

  const positions = memberIds
    .map((id) => animMap.get(id)?.position)
    .filter((p): p is THREE.Vector3 => !!p);

  if (positions.length === 0) return null;

  const center = new THREE.Vector3();
  for (const p of positions) center.add(p);
  center.divideScalar(positions.length);

  let maxDist = 0.5;
  for (const p of positions) {
    const d = center.distanceTo(p);
    if (d > maxDist) maxDist = d;
  }

  return { center, radius: maxDist + 0.5, memberIds };
}

// ── Main Visualizer ──

export default function ZoneCollabVisualizer({
  animStateMapRef,
}: {
  animStateMapRef: React.RefObject<AnimStateMap>;
}) {
  const collabSessions = useAllCollabSessions();

  return (
    <group>
      {collabSessions.map((session) => {
        const geo = computeSessionGeometry(session, animStateMapRef.current);
        if (!geo) return null;

        // Build pairwise beam connections
        const beamPairs: [string, string][] = [];
        for (let i = 0; i < geo.memberIds.length; i++) {
          for (let j = i + 1; j < geo.memberIds.length; j++) {
            beamPairs.push([geo.memberIds[i], geo.memberIds[j]]);
          }
        }

        return (
          <group key={session.session_id}>
            {/* Negotiation beams between members */}
            {beamPairs.map(([a, b]) => (
              <NegotiationBeam
                key={`${a}:${b}`}
                agentA={a}
                agentB={b}
                animStateMapRef={animStateMapRef}
              />
            ))}

            {/* Golden magic circle on ground */}
            <MagicCircle center={geo.center} radius={geo.radius} />

            {/* Ambient sparkles */}
            <CollabSparkles center={geo.center} radius={geo.radius} />
          </group>
        );
      })}
    </group>
  );
}
