"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AnimStateMap } from "./AnimationController";
import { useSummonRequests } from "@/hooks/useSwarmStore";

// ────────────────────────────────────────────
// SummonFlareEffect — Red vertical signal flare
// Triggered when an agent emits AGENT_SUMMON_REQUEST.
// Agent enters SUMMONING state, stops work, and fires
// a rising red flare with sparkle particles.
// Auto-expires after 3 seconds.
// ────────────────────────────────────────────

const FLARE_DURATION = 3.0;
const FLARE_HEIGHT = 6;
const RING_EXPAND_RATE = 3;

const FLARE_COLOR = new THREE.Color("#ff2244");
const FLARE_EMISSIVE = new THREE.Color("#ff2244").multiplyScalar(3);

const PARTICLE_COUNT = 12;

interface FlareInstance {
  requestId: string;
  agentId: string;
  elapsed: number;
  position: THREE.Vector3;
}

interface SummonFlareEffectProps {
  animStateMapRef: React.RefObject<AnimStateMap>;
}

function SingleFlare({ instance }: { instance: FlareInstance }) {
  const groupRef = useRef<THREE.Group>(null);
  const pillarRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);

  const particleOffsets = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        angle: (i / PARTICLE_COUNT) * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  );

  useFrame((_, delta) => {
    instance.elapsed += delta;
    const t = instance.elapsed;
    const progress = Math.min(t / FLARE_DURATION, 1);

    if (!groupRef.current) return;
    groupRef.current.position.copy(instance.position);

    // Pillar: rises upward, thins and fades
    if (pillarRef.current) {
      const rise = Math.min(t * 4, 1);
      const height = rise * FLARE_HEIGHT;
      pillarRef.current.scale.set(
        0.08 * (1 - progress * 0.5),
        height,
        0.08 * (1 - progress * 0.5),
      );
      pillarRef.current.position.y = height / 2;
      const mat = pillarRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 1 - progress * 0.8;
    }

    // Base ring: expands outward
    if (ringRef.current) {
      const ringScale = 0.2 + t * RING_EXPAND_RATE;
      ringRef.current.scale.setScalar(ringScale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.8 - progress);
    }

    // Particles: rise along the pillar with spiraling motion
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particleRefs.current[i];
      if (!p) continue;
      const off = particleOffsets[i];
      const pT = (t * off.speed + off.phase) % FLARE_HEIGHT;
      const radius = 0.15 + Math.sin(t * 3 + off.phase) * 0.1;
      p.position.set(
        Math.cos(off.angle + t * 2) * radius,
        pT,
        Math.sin(off.angle + t * 2) * radius,
      );
      const mat = p.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.7 * (1 - progress);
      p.scale.setScalar(0.03 + Math.sin(t * 5 + off.phase) * 0.01);
    }
  });

  if (instance.elapsed >= FLARE_DURATION) return null;

  return (
    <group ref={groupRef}>
      {/* Vertical flare pillar */}
      <mesh ref={pillarRef}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshStandardMaterial
          color={FLARE_COLOR}
          emissive={FLARE_EMISSIVE}
          emissiveIntensity={2}
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>

      {/* Expanding base ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial
          color={FLARE_COLOR}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Rising sparkle particles */}
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { particleRefs.current[i] = el; }}
        >
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshBasicMaterial
            color="#ff6666"
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function SummonFlareEffect({ animStateMapRef }: SummonFlareEffectProps) {
  const summonRequests = useSummonRequests();
  const instancesRef = useRef<Map<string, FlareInstance>>(new Map());

  useFrame(() => {
    const animMap = animStateMapRef.current;
    if (!animMap) return;

    // Create instances for new summon requests
    for (const req of summonRequests) {
      if (instancesRef.current.has(req.request_id)) continue;
      const agentAnim = animMap.get(req.requesting_agent_id);
      if (!agentAnim) continue;
      instancesRef.current.set(req.request_id, {
        requestId: req.request_id,
        agentId: req.requesting_agent_id,
        elapsed: 0,
        position: agentAnim.position.clone(),
      });
    }

    // Clean up expired instances
    for (const [id, inst] of instancesRef.current) {
      if (inst.elapsed >= FLARE_DURATION) {
        instancesRef.current.delete(id);
      }
    }
  });

  return (
    <group>
      {[...instancesRef.current.values()].map((inst) => (
        <SingleFlare key={inst.requestId} instance={inst} />
      ))}
    </group>
  );
}
