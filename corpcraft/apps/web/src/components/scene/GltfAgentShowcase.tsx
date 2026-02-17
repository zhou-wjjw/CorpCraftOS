"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { GLTF_SHOWCASE_POSITION } from "@/lib/zone-config";

// ────────────────────────────────────────────
// GltfAgentShowcase — GLTF 模型展示区域
// 使用 KayKit 本地角色模型，五大阵营换色 + 骨骼动画
// ────────────────────────────────────────────

// ── 五大阵营配色与模型映射 ──

type GltfFactionKey = "openai" | "deepseek" | "qwen" | "zhipu" | "minimax";

interface GltfFactionConfig {
  name: string;
  color: string;
  glow: string;
  model: string;
}

const FACTIONS: Record<GltfFactionKey, GltfFactionConfig> = {
  openai:   { name: "OpenAI",   color: "#F8FAFC", glow: "#FFFFFF", model: "/models/agents/codex.glb" },
  deepseek: { name: "DeepSeek", color: "#1E3A8A", glow: "#0EA5E9", model: "/models/agents/cursor.glb" },
  qwen:     { name: "Qwen",     color: "#4C1D95", glow: "#D8B4FE", model: "/models/agents/gemini.glb" },
  zhipu:    { name: "Zhipu",    color: "#0F766E", glow: "#5EEAD4", model: "/models/agents/claude.glb" },
  minimax:  { name: "MiniMax",  color: "#BE185D", glow: "#F9A8D4", model: "/models/agents/admin.glb" },
};

const ALL_MODEL_URLS = Object.values(FACTIONS).map((f) => f.model);

// ── 展示区域视觉参数 ──

const ZONE_WIDTH = 8;
const ZONE_DEPTH = 3.5;
const CORNER_RADIUS = 0.25;
const CORNER_SEGMENTS = 6;
const ZONE_COLOR = "#1a1535";
const EDGE_COLOR = "#6366f1";

// ── Agent 槽位 ──

interface AgentSlot {
  faction: GltfFactionKey;
  localPos: [number, number, number];
  isWorking: boolean;
}

const AGENT_SLOTS: AgentSlot[] = [
  { faction: "openai",   localPos: [-3,   0, 0], isWorking: false },
  { faction: "deepseek", localPos: [-1.5, 0, 0], isWorking: true },
  { faction: "qwen",     localPos: [ 0,   0, 0], isWorking: true },
  { faction: "zhipu",    localPos: [ 1.5, 0, 0], isWorking: false },
  { faction: "minimax",  localPos: [ 3,   0, 0], isWorking: true },
];

// ── 圆角矩形地板几何体 ──

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

// ── 发光边缘线几何体 ──

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
      const a = (Math.PI / 2) * (i / CORNER_SEGMENTS);
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
    verts.push(pts[0].x, 0, pts[0].y);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);
}

// ── 单个 GLTF 智能体 ──

interface GltfAgentProps {
  position: [number, number, number];
  faction?: GltfFactionKey;
  isWorking?: boolean;
}

function GltfAgent({ position, faction = "openai", isWorking = false }: GltfAgentProps) {
  const config = FACTIONS[faction];
  const { scene, animations } = useGLTF(config.model);

  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const group = useRef<Group>(null);
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    clone.traverse((node: THREE.Object3D) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (mesh.material) {
          mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone();
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.color.set(config.color);

          if (isWorking) {
            mat.emissive.set(config.glow);
            mat.emissiveIntensity = 1.2;
          } else {
            mat.emissive.set("#000000");
            mat.emissiveIntensity = 0;
          }
        }
      }
    });
  }, [clone, config, isWorking]);

  useEffect(() => {
    if (!names.length) return;

    const idleAnim =
      names.find((n) => n.toLowerCase().includes("idle")) || names[0];
    const workAnim =
      names.find(
        (n) =>
          n.toLowerCase().includes("punch") ||
          n.toLowerCase().includes("attack") ||
          n.toLowerCase().includes("action"),
      ) ||
      names[1] ||
      names[0];

    const actionName = isWorking ? workAnim : idleAnim;
    const action = actions[actionName];

    if (action) {
      action.reset().fadeIn(0.3).play();
      action.setEffectiveTimeScale(isWorking ? 1.5 : 1);
      return () => {
        action.fadeOut(0.3);
      };
    }
  }, [actions, names, isWorking]);

  return (
    <group ref={group} position={position} scale={0.8}>
      <primitive object={clone} />

      {/* 阵营名称标签 */}
      <Text
        position={[0, 2.6, 0]}
        fontSize={0.2}
        color="#FFFFFF"
        outlineWidth={0.02}
        outlineColor="#000"
        fontWeight="bold"
        anchorX="center"
        anchorY="middle"
      >
        {config.name}
      </Text>

      {/* 状态标签 */}
      <Text
        position={[0, 2.3, 0]}
        fontSize={0.14}
        color={isWorking ? config.glow : "#888888"}
        anchorX="center"
        anchorY="middle"
      >
        {isWorking ? "Running" : "Idle"}
      </Text>

      {/* 底部光环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.3, 0.42, 32]} />
        <meshBasicMaterial
          color={config.glow}
          transparent
          opacity={isWorking ? 0.6 : 0.15}
        />
      </mesh>
    </group>
  );
}

for (const url of ALL_MODEL_URLS) useGLTF.preload(url);

// ── 展示区主组件 ──

const GltfAgentShowcase = memo(function GltfAgentShowcase() {
  const floorGeo = useShowcaseFloorGeometry();
  const edgeGeo = useEdgeGeometry();

  return (
    <group position={GLTF_SHOWCASE_POSITION}>
      {/* 装饰性区域地板 */}
      <mesh geometry={floorGeo} position={[0, 0.005, 0]} receiveShadow>
        <meshStandardMaterial
          color={ZONE_COLOR}
          roughness={0.9}
          metalness={0.1}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* 发光边缘线 */}
      <lineLoop geometry={edgeGeo} position={[0, 0.02, 0]}>
        <lineBasicMaterial color={EDGE_COLOR} transparent opacity={0.5} />
      </lineLoop>

      {/* 区域标题 */}
      <Text
        position={[0, 0.05, -(ZONE_DEPTH / 2 + 0.25)]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color={EDGE_COLOR}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        GLTF Agent Showcase
      </Text>

      {/* 五大阵营 GLTF 智能体 */}
      {AGENT_SLOTS.map((slot) => (
        <GltfAgent
          key={slot.faction}
          position={slot.localPos}
          faction={slot.faction}
          isWorking={slot.isWorking}
        />
      ))}
    </group>
  );
});

export default GltfAgentShowcase;
