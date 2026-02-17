"use client";

import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ────────────────────────────────────────────
// ClickEffect — Game-like right-click marker
// Expanding ring + diamond marker + particle burst
// Uses object pool for zero-allocation spawning.
// ────────────────────────────────────────────

const POOL_SIZE = 5;
const RING_DURATION = 0.45;
const MARKER_DURATION = 0.5;
const PARTICLE_COUNT = 6;
const PARTICLE_DURATION = 0.4;

const EFFECT_COLOR = new THREE.Color("#4ade80");

interface EffectInstance {
  active: boolean;
  elapsed: number;
  x: number;
  z: number;
}

export interface ClickEffectHandle {
  spawn: (x: number, z: number) => void;
}

/** Ring geometry shared across all instances */
const sharedRingGeo = new THREE.RingGeometry(0.05, 0.12, 32);
/** Diamond/rhombus shape for the marker */
const sharedDiamondGeo = new THREE.BufferGeometry();
(() => {
  const s = 0.08;
  const verts = new Float32Array([
    0, 0, -s,
    s, 0, 0,
    0, 0, s,
    -s, 0, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  sharedDiamondGeo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  sharedDiamondGeo.setIndex(new THREE.BufferAttribute(indices, 1));
})();

/** Small particle plane for burst */
const sharedParticleGeo = new THREE.PlaneGeometry(0.06, 0.06);

// ── Single effect instance component ──

function EffectSlot({ index, instancesRef }: {
  index: number;
  instancesRef: React.RefObject<EffectInstance[]>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const markerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const particleMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const particleAngles = useRef<number[]>(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => (i / PARTICLE_COUNT) * Math.PI * 2)
  );

  useFrame((_, delta) => {
    const inst = instancesRef.current?.[index];
    if (!inst || !inst.active || !groupRef.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    inst.elapsed += delta;
    const t = inst.elapsed;
    groupRef.current.visible = true;
    groupRef.current.position.set(inst.x, 0.03, inst.z);

    // Ring: expand from scale 0.3 to 3.5, fade out
    if (ringRef.current && ringMatRef.current) {
      const ringT = Math.min(t / RING_DURATION, 1);
      const eased = 1 - (1 - ringT) * (1 - ringT); // ease-out quad
      const scale = 0.3 + eased * 3.2;
      ringRef.current.scale.setScalar(scale);
      ringMatRef.current.opacity = (1 - eased) * 0.9;
    }

    // Marker diamond: pop up then fade
    if (markerRef.current && markerMatRef.current) {
      const markerT = Math.min(t / MARKER_DURATION, 1);
      if (markerT < 0.3) {
        const rise = markerT / 0.3;
        markerRef.current.position.y = rise * 0.35;
        markerMatRef.current.opacity = 0.9;
      } else {
        const fade = (markerT - 0.3) / 0.7;
        markerRef.current.position.y = 0.35 - fade * 0.1;
        markerMatRef.current.opacity = 0.9 * (1 - fade);
      }
      markerRef.current.rotation.y += delta * 8;
    }

    // Particles: burst outward and fade
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const pMesh = particleRefs.current[i];
      const pMat = particleMatRefs.current[i];
      if (!pMesh || !pMat) continue;

      const pT = Math.min(t / PARTICLE_DURATION, 1);
      const eased = 1 - (1 - pT) * (1 - pT);
      const angle = particleAngles.current[i];
      const dist = eased * 0.6;
      pMesh.position.set(
        Math.cos(angle) * dist,
        0.1 + (1 - eased) * 0.15,
        Math.sin(angle) * dist,
      );
      pMat.opacity = (1 - eased) * 0.7;
      const pScale = 0.5 + (1 - eased) * 0.5;
      pMesh.scale.setScalar(pScale);
    }

    // Deactivate when all animations complete
    if (t > Math.max(RING_DURATION, MARKER_DURATION, PARTICLE_DURATION)) {
      inst.active = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Expanding ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={sharedRingGeo} attach="geometry" />
        <meshBasicMaterial
          ref={ringMatRef}
          color={EFFECT_COLOR}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Diamond marker */}
      <mesh ref={markerRef}>
        <primitive object={sharedDiamondGeo} attach="geometry" />
        <meshBasicMaterial
          ref={markerMatRef}
          color={EFFECT_COLOR}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Particle burst */}
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { particleRefs.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <primitive object={sharedParticleGeo} attach="geometry" />
          <meshBasicMaterial
            ref={(el) => { particleMatRefs.current[i] = el; }}
            color={EFFECT_COLOR}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Main ClickEffect manager ──

const ClickEffect = forwardRef<ClickEffectHandle>(function ClickEffect(_, ref) {
  const instancesRef = useRef<EffectInstance[]>(
    Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      elapsed: 0,
      x: 0,
      z: 0,
    })),
  );

  const spawn = useCallback((x: number, z: number) => {
    const pool = instancesRef.current;
    // Find first inactive slot, or reuse oldest
    let slot = pool.find((s) => !s.active);
    if (!slot) {
      let oldest = pool[0];
      for (const s of pool) {
        if (s.elapsed > oldest.elapsed) oldest = s;
      }
      slot = oldest;
    }
    slot.active = true;
    slot.elapsed = 0;
    slot.x = x;
    slot.z = z;
  }, []);

  useImperativeHandle(ref, () => ({ spawn }), [spawn]);

  return (
    <group>
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <EffectSlot key={i} index={i} instancesRef={instancesRef} />
      ))}
    </group>
  );
});

export default ClickEffect;
