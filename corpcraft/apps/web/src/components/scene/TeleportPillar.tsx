"use client";

import { useRef, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { AnimStateMap } from "./AnimationController";

// ────────────────────────────────────────────
// TeleportPillar — Golden descent pillar effect
// Triggered when recruitAgentToZone fires (manual summon).
// A golden beam descends from the sky, the agent materializes
// at the target position, and a shockwave ring expands at ground.
// ────────────────────────────────────────────

const PILLAR_DURATION = 2.0;
const PILLAR_MAX_HEIGHT = 10;
const RING_MAX_SCALE = 4;
const DUST_COUNT = 8;

const GOLD_COLOR = new THREE.Color("#ffd700");
const GOLD_EMISSIVE = new THREE.Color("#ffd700").multiplyScalar(3);

interface PillarInstance {
  id: string;
  elapsed: number;
  position: THREE.Vector3;
}

export interface TeleportPillarHandle {
  spawn: (agentId: string, x: number, z: number) => void;
}

function SinglePillar({ instance }: { instance: PillarInstance }) {
  const groupRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const dustRefs = useRef<(THREE.Mesh | null)[]>([]);
  const innerGlowRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    instance.elapsed += delta;
    const t = instance.elapsed;
    const progress = Math.min(t / PILLAR_DURATION, 1);

    if (!groupRef.current) return;
    groupRef.current.position.copy(instance.position);

    // Phase 1 (0-40%): Beam descends from sky
    // Phase 2 (40-70%): Landing impact, ring expands
    // Phase 3 (70-100%): Fade out

    const phase1 = Math.min(progress / 0.4, 1);
    const phase2 = progress > 0.4 ? Math.min((progress - 0.4) / 0.3, 1) : 0;
    const phase3 = progress > 0.7 ? Math.min((progress - 0.7) / 0.3, 1) : 0;

    // Golden beam: descends and thins
    if (beamRef.current) {
      const height = PILLAR_MAX_HEIGHT * (1 - phase3 * 0.5);
      const baseY = PILLAR_MAX_HEIGHT * (1 - phase1);
      const width = 0.15 * (1 - phase3 * 0.7);
      beamRef.current.scale.set(width, height, width);
      beamRef.current.position.y = baseY + height / 2;
      const mat = beamRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 1 - phase3;
    }

    // Inner glow cylinder (wider, more transparent)
    if (innerGlowRef.current) {
      const glowWidth = 0.4 * (1 - phase3 * 0.5);
      const glowHeight = PILLAR_MAX_HEIGHT * 0.8 * phase1;
      innerGlowRef.current.scale.set(glowWidth, glowHeight, glowWidth);
      innerGlowRef.current.position.y = glowHeight / 2;
      const mat = innerGlowRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.3 * (1 - phase3);
    }

    // Impact ring: expands on landing
    if (ringRef.current) {
      const easeOut = 1 - (1 - phase2) * (1 - phase2);
      const ringScale = easeOut * RING_MAX_SCALE;
      ringRef.current.scale.setScalar(ringScale || 0.01);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = phase2 > 0 ? 0.7 * (1 - phase3) : 0;
    }

    // Dust particles: burst outward on landing
    for (let i = 0; i < DUST_COUNT; i++) {
      const d = dustRefs.current[i];
      if (!d) continue;
      const angle = (i / DUST_COUNT) * Math.PI * 2;
      const burstProgress = phase2;
      const easeOut = 1 - (1 - burstProgress) * (1 - burstProgress);
      const dist = easeOut * 1.5;
      const y = Math.sin(burstProgress * Math.PI) * 0.5;
      d.position.set(
        Math.cos(angle) * dist,
        y + 0.1,
        Math.sin(angle) * dist,
      );
      const mat = d.material as THREE.MeshBasicMaterial;
      mat.opacity = phase2 > 0 ? 0.6 * (1 - phase3) : 0;
      d.scale.setScalar(0.05 * (1 - phase3 * 0.5));
    }
  });

  if (instance.elapsed >= PILLAR_DURATION) return null;

  return (
    <group ref={groupRef}>
      {/* Main golden beam */}
      <mesh ref={beamRef}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial
          color={GOLD_COLOR}
          emissive={GOLD_EMISSIVE}
          emissiveIntensity={2}
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>

      {/* Inner glow (wider, softer) */}
      <mesh ref={innerGlowRef}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshStandardMaterial
          color={GOLD_COLOR}
          emissive={GOLD_EMISSIVE}
          emissiveIntensity={1}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>

      {/* Ground impact ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.7, 1.0, 32]} />
        <meshBasicMaterial
          color={GOLD_COLOR}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Cyber dust particles */}
      {Array.from({ length: DUST_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { dustRefs.current[i] = el; }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#ffe066"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function TeleportPillar({
  animStateMapRef,
  pillarRef,
}: {
  animStateMapRef: React.RefObject<AnimStateMap>;
  pillarRef: React.MutableRefObject<TeleportPillarHandle | null>;
}) {
  const instancesRef = useRef<Map<string, PillarInstance>>(new Map());

  const spawn = useCallback((agentId: string, x: number, z: number) => {
    instancesRef.current.set(agentId, {
      id: agentId,
      elapsed: 0,
      position: new THREE.Vector3(x, 0, z),
    });
  }, []);

  useEffect(() => {
    pillarRef.current = { spawn };
  }, [spawn, pillarRef]);

  // Cleanup expired
  useFrame(() => {
    for (const [id, inst] of instancesRef.current) {
      if (inst.elapsed >= PILLAR_DURATION) {
        instancesRef.current.delete(id);
      }
    }
  });

  return (
    <group>
      {[...instancesRef.current.values()].map((inst) => (
        <SinglePillar key={inst.id} instance={inst} />
      ))}
    </group>
  );
}
