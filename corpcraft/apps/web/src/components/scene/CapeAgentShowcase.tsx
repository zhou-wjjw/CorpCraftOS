"use client";

import { memo, useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { CapeAgent, type FactionKey } from "./CapeAgent";

// ────────────────────────────────────────────
// CapeAgentShowcase — 阵营展示专属区域
// 在现有 zone 网格下方新增一块装饰性展示区
// 包含 5 个披风智能体 + 工作台方块
// ────────────────────────────────────────────

const SHOWCASE_POSITION: [number, number, number] = [0, 0, 5.5];

const ZONE_WIDTH = 6;
const ZONE_DEPTH = 3;
const CORNER_RADIUS = 0.25;
const CORNER_SEGMENTS = 6;
const ZONE_COLOR = "#2a1f4e";
const EDGE_COLOR = "#7c6fbb";

interface AgentSlot {
  faction: FactionKey;
  localPos: [number, number, number];
  isWorking: boolean;
  hasHood?: boolean;
}

const AGENT_SLOTS: AgentSlot[] = [
  { faction: "openai",   localPos: [-2,   0, -0.5], isWorking: false },
  { faction: "deepseek", localPos: [-1,   0,  0.1], isWorking: true, hasHood: true },
  { faction: "qwen",     localPos: [ 0,   0,  0.5], isWorking: true },
  { faction: "zhipu",    localPos: [ 1,   0,  0.1], isWorking: false },
  { faction: "minimax",  localPos: [ 2,   0, -0.5], isWorking: true },
];

const WORKBENCH_OFFSET_Z = 0.55;

function useShowcaseFloorGeometry() {
  return useMemo(() => {
    const hw = ZONE_WIDTH / 2;
    const hd = ZONE_DEPTH / 2;
    const r = CORNER_RADIUS;

    const shape = new THREE.Shape();
    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);
}

function useEdgeGeometry() {
  return useMemo(() => {
    const hw = ZONE_WIDTH / 2;
    const hd = ZONE_DEPTH / 2;
    const r = CORNER_RADIUS;
    const pts: THREE.Vector2[] = [];

    pts.push(new THREE.Vector2(-hw + r, -hd));
    pts.push(new THREE.Vector2(hw - r, -hd));
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / CORNER_SEGMENTS);
      pts.push(new THREE.Vector2(hw - r + r * Math.cos(a), -hd + r + r * Math.sin(a)));
    }
    pts.push(new THREE.Vector2(hw, hd - r));
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const a = 0 + (Math.PI / 2) * (i / CORNER_SEGMENTS);
      pts.push(new THREE.Vector2(hw - r + r * Math.cos(a), hd - r + r * Math.sin(a)));
    }
    pts.push(new THREE.Vector2(-hw + r, hd));
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const a = Math.PI / 2 + (Math.PI / 2) * (i / CORNER_SEGMENTS);
      pts.push(new THREE.Vector2(-hw + r + r * Math.cos(a), hd - r + r * Math.sin(a)));
    }
    pts.push(new THREE.Vector2(-hw, -hd + r));
    for (let i = 0; i <= CORNER_SEGMENTS; i++) {
      const a = Math.PI + (Math.PI / 2) * (i / CORNER_SEGMENTS);
      pts.push(new THREE.Vector2(-hw + r + r * Math.cos(a), -hd + r + r * Math.sin(a)));
    }

    const verts: number[] = [];
    for (const p of pts) {
      verts.push(p.x, 0, p.y);
    }
    // Close the loop
    verts.push(pts[0].x, 0, pts[0].y);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);
}

function Workbench({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[0.3, 0.3, 0.3]} />
      <meshStandardMaterial color="#6B7280" roughness={0.4} metalness={0.5} />
    </mesh>
  );
}

const CapeAgentShowcase = memo(function CapeAgentShowcase() {
  const floorGeo = useShowcaseFloorGeometry();
  const edgeGeo = useEdgeGeometry();

  return (
    <group position={SHOWCASE_POSITION}>
      {/* === 装饰性区域地板 === */}
      <mesh geometry={floorGeo} position={[0, 0.005, 0]} receiveShadow>
        <meshStandardMaterial
          color={ZONE_COLOR}
          roughness={0.9}
          metalness={0.1}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* === 发光边缘线 === */}
      <lineLoop geometry={edgeGeo} position={[0, 0.02, 0]}>
        <lineBasicMaterial color={EDGE_COLOR} transparent opacity={0.5} />
      </lineLoop>

      {/* === 区域标题 === */}
      <Text
        position={[0, 0.05, -(ZONE_DEPTH / 2 + 0.2)]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color={EDGE_COLOR}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        Faction Showcase
      </Text>

      {/* === 五大阵营披风智能体 === */}
      {AGENT_SLOTS.map((slot) => (
        <CapeAgent
          key={slot.faction}
          position={slot.localPos}
          faction={slot.faction}
          isWorking={slot.isWorking}
          hasHood={slot.hasHood}
        />
      ))}

      {/* === 工作台方块（仅 isWorking 的智能体前方） === */}
      {AGENT_SLOTS.filter((s) => s.isWorking).map((slot) => (
        <Workbench
          key={`bench-${slot.faction}`}
          position={[slot.localPos[0], 0.15, slot.localPos[2] + WORKBENCH_OFFSET_Z]}
        />
      ))}
    </group>
  );
});

export default CapeAgentShowcase;
