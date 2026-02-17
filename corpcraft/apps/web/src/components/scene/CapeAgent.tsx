"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere, Cylinder, RoundedBox, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";

// ────────────────────────────────────────────
// CapeAgent — Q版披风智能体 3D 组件
// 五大模型阵营化身，带披风飘动和打铁动画
// ────────────────────────────────────────────

export type FactionKey = "openai" | "deepseek" | "zhipu" | "minimax" | "qwen";

interface FactionConfig {
  name: string;
  cape: string;
  logo: string;
  logoColor: string;
  suit: string;
}

const FACTIONS: Record<FactionKey, FactionConfig> = {
  openai:   { name: "OpenAI",   cape: "#F5F5F5", logo: "✺", logoColor: "#1A1A1A", suit: "#4B5563" },
  deepseek: { name: "DeepSeek", cape: "#1E3A8A", logo: "🐳", logoColor: "#38BDF8", suit: "#0F172A" },
  zhipu:    { name: "Zhipu",    cape: "#0D9488", logo: "⎈", logoColor: "#CCFBF1", suit: "#134E4A" },
  minimax:  { name: "MiniMax",  cape: "#DB2777", logo: "∞", logoColor: "#FCE7F3", suit: "#831843" },
  qwen:     { name: "Qwen",     cape: "#6B21A8", logo: "◎", logoColor: "#E9D5FF", suit: "#3B0764" },
};

export interface CapeAgentProps {
  position?: [number, number, number];
  faction?: FactionKey;
  isWorking?: boolean;
  hasHood?: boolean;
}

export function CapeAgent({
  position = [0, 0, 0],
  faction = "deepseek",
  isWorking = false,
  hasHood = false,
}: CapeAgentProps) {
  const config = FACTIONS[faction] ?? FACTIONS.openai;

  const bodyRef = useRef<Group>(null);
  const capeRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (bodyRef.current) {
      if (isWorking) {
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0.25, 0.1);
        bodyRef.current.position.y = Math.sin(t * 25) * 0.03;
        if (rightArmRef.current) rightArmRef.current.rotation.x = Math.sin(t * 20) * 1.5;
      } else {
        bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, 0, 0.1);
        bodyRef.current.position.y = Math.sin(t * 3) * 0.02;
        if (rightArmRef.current) rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, 0.1);
      }
    }

    if (capeRef.current) {
      let flap = Math.sin(t * 3) * 0.08;
      if (isWorking) flap += Math.sin(t * 15) * 0.12;
      capeRef.current.rotation.x = -0.15 + flap;
    }
  });

  return (
    <group position={position}>
      {/* 头部悬浮的名字标签 */}
      <Text
        position={[0, 1.4, 0]}
        fontSize={0.12}
        color="#FFFFFF"
        outlineWidth={0.015}
        outlineColor="#000"
        fontWeight="bold"
      >
        {config.name}
      </Text>

      <group ref={bodyRef}>
        {/* --- 1. Q版大圆头 --- */}
        <group position={[0, 0.65, 0]}>
          <Sphere args={[0.26, 32, 32]}>
            <meshStandardMaterial color="#FFD3B6" roughness={0.4} />
          </Sphere>

          {/* 黑豆豆眼 */}
          <Sphere args={[0.035, 16, 16]} position={[-0.1, 0.05, 0.24]}>
            <meshBasicMaterial color="#111" />
          </Sphere>
          <Sphere args={[0.035, 16, 16]} position={[0.1, 0.05, 0.24]}>
            <meshBasicMaterial color="#111" />
          </Sphere>

          {/* 兜帽系统 */}
          {hasHood ? (
            <Sphere args={[0.275, 32, 32]} position={[0, 0.05, -0.04]}>
              <meshStandardMaterial color={config.suit} roughness={0.9} />
            </Sphere>
          ) : (
            <Sphere args={[0.26, 32, 32]} position={[0, 0.1, -0.02]} scale={[1, 0.8, 1]}>
              <meshStandardMaterial color="#451A03" roughness={0.9} />
            </Sphere>
          )}
        </group>

        {/* --- 2. 圆润的身躯 --- */}
        <Cylinder args={[0.13, 0.16, 0.35, 16]} position={[0, 0.3, 0]}>
          <meshStandardMaterial color={config.suit} roughness={0.7} />
        </Cylinder>

        {/* --- 3. 动态阵营披风 --- */}
        <group position={[0, 0.5, -0.12]} ref={capeRef}>
          <group position={[0, -0.3, -0.05]}>
            <RoundedBox args={[0.38, 0.65, 0.02]} radius={0.01}>
              <meshStandardMaterial color={config.cape} roughness={0.7} side={THREE.DoubleSide} />
            </RoundedBox>

            {/* 披风背面的阵营 Logo */}
            <Text
              position={[0, -0.05, -0.015]}
              rotation={[0, Math.PI, 0]}
              fontSize={0.22}
              color={config.logoColor}
            >
              {config.logo}
            </Text>
          </group>
        </group>

        {/* --- 4. 小手与工具 --- */}
        {/* 左手 */}
        <Cylinder args={[0.04, 0.04, 0.2]} position={[-0.2, 0.28, 0]} rotation={[0, 0, 0.3]}>
          <meshStandardMaterial color={config.suit} />
        </Cylinder>

        {/* 右手 (挂载打铁动画) */}
        <group position={[0.2, 0.4, 0]}>
          <group ref={rightArmRef}>
            <Cylinder args={[0.04, 0.04, 0.25]} position={[0, -0.12, 0]}>
              <meshStandardMaterial color={config.suit} />
            </Cylinder>

            {/* 工作时手持小铁锤 */}
            {isWorking && (
              <group position={[0, -0.28, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
                <Cylinder args={[0.015, 0.015, 0.2]}>
                  <meshStandardMaterial color="#8B4513" />
                </Cylinder>
                <RoundedBox args={[0.1, 0.08, 0.1]} position={[0, 0.1, 0]} radius={0.02}>
                  <meshStandardMaterial color="#9CA3AF" metalness={0.6} />
                </RoundedBox>
              </group>
            )}
          </group>
        </group>
      </group>

      {/* 底部全息光环阵法 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.2, 0.28, 32]} />
        <meshBasicMaterial color={config.cape} transparent opacity={isWorking ? 0.8 : 0.2} />
      </mesh>
    </group>
  );
}

export default CapeAgent;
