"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float, RoundedBox, Sphere, Torus, Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";

/**
 * CorpCraft - 硅基智能体：星灵探机 3D 组件
 * @param themeColor - 阵营主色调 (如 Claude 的橙色 #FF7B00, Cursor 的蓝色 #3b82f6)
 * @param name - Agent 名字
 * @param status - 状态: 'IDLE' (待命) | 'WORKING' (打铁中) | 'ERROR' (报错)
 * @param skillCount - 挂载的 skills 数量，决定外围旋转星环的数量
 */

export type AgentNodeStatus = "IDLE" | "WORKING" | "ERROR";

interface AgentNodeProps {
  position?: [number, number, number];
  scale?: number;
  themeColor?: string;
  name?: string;
  status?: AgentNodeStatus;
  skillCount?: number;
}

export function AgentNode({
  position = [0, 0, 0],
  scale = 0.7,
  themeColor = "#3b82f6",
  name = "Agent",
  status = "IDLE",
  skillCount = 2,
}: AgentNodeProps) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringGroupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  const isWorking = status === "WORKING";
  const isError = status === "ERROR";

  // 状态决定灯光颜色和算力爆发强度
  const activeColor = isError ? "#ef4444" : themeColor;
  const glowIntensity = isWorking ? 4 : 1.2;

  // 帧动画：负责悬浮呼吸、核心脉冲与星环公转
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const speed = isWorking ? 6 : 1; // 工作时星环疯狂运转

    // 内部量子核心(眼睛)呼吸闪烁
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * (isWorking ? 15 : 2)) * 0.08);
    }

    // 外部技能星环错位公转 (陀螺仪效果)
    if (ringGroupRef.current) {
      ringGroupRef.current.rotation.y += delta * (speed * 0.5);
      ringGroupRef.current.rotation.x = Math.sin(t * 0.5) * 0.2;
      // 让每个环产生错综复杂的自转
      ringGroupRef.current.children.forEach((ring, i) => {
        ring.rotation.x += delta * speed * (i % 2 === 0 ? 1 : -1) * 0.2;
      });
    }

    // 机体打铁姿态 (前倾 + 高频运算微震)
    if (bodyRef.current) {
      bodyRef.current.rotation.x = THREE.MathUtils.lerp(
        bodyRef.current.rotation.x,
        isWorking ? 0.2 : 0, // 工作时向前倾注注意力
        0.1,
      );
      if (isWorking) {
        bodyRef.current.position.y = Math.sin(t * 40) * 0.02; // 高频微震代表算力满载
      } else {
        bodyRef.current.position.y = THREE.MathUtils.lerp(bodyRef.current.position.y, 0, 0.1);
      }
    }
  });

  return (
    <group position={position}>
      {/* 顶部悬浮名字标签 — 独立于缩放组之外，保持可读性 */}
      <Text
        position={[0, 0.85, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000"
      >
        {name}
      </Text>

      {/* 缩放包裹层 — 缩小整个探机机体 */}
      <group scale={scale}>
        {/* Float 提供极其丝滑的原生上下悬浮感 */}
        <Float speed={isWorking ? 5 : 2} rotationIntensity={0.2} floatIntensity={1.2}>
          <group ref={bodyRef}>
            {/* 1. 主装甲外壳 (哑光深色金属质感) */}
            <RoundedBox args={[0.5, 0.6, 0.4]} radius={0.15} smoothness={4}>
              <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
            </RoundedBox>

            {/* 2. 全息面罩 (黑色玻璃面) */}
            <mesh position={[0, 0.1, 0.21]}>
              <planeGeometry args={[0.35, 0.2]} />
              <meshBasicMaterial color="#0b0f19" />
            </mesh>

            {/* 3. 裸露的算力核心/眼睛 (随状态发光) */}
            <Sphere ref={coreRef} args={[0.06, 16, 16]} position={[0, 0.1, 0.22]}>
              <meshStandardMaterial
                color={activeColor}
                emissive={activeColor}
                emissiveIntensity={glowIntensity}
                toneMapped={false}
              />
            </Sphere>

            {/* 4. 挂载的武器星环 (直观展示 .skills 数量) */}
            <group ref={ringGroupRef}>
              {Array.from({ length: Math.max(0, skillCount) }).map((_, i) => (
                <group key={i} rotation={[Math.PI / 2.5, (Math.PI / Math.max(1, skillCount)) * i, 0]}>
                  <Torus args={[0.55 + i * 0.1, 0.015, 16, 64]}>
                    <meshStandardMaterial
                      color={activeColor}
                      emissive={activeColor}
                      emissiveIntensity={1.5}
                      transparent
                      opacity={0.8}
                    />
                  </Torus>
                  {/* 星环上运行的数据节点(小光球) */}
                  <Sphere args={[0.03, 16, 16]} position={[0.55 + i * 0.1, 0, 0]}>
                    <meshStandardMaterial
                      color="#ffffff"
                      emissive="#ffffff"
                      emissiveIntensity={2}
                      toneMapped={false}
                    />
                  </Sphere>
                </group>
              ))}
            </group>

            {/* 5. 燃烧算力：工作时的粒子喷射特效 (极度解压) */}
            {isWorking && (
              <Sparkles
                count={30}
                scale={1.2}
                size={2}
                speed={0.6}
                position={[0, -0.3, 0]}
                color={activeColor}
                opacity={0.8}
              />
            )}
          </group>
        </Float>

        {/* 底部投射的全息抗重力光阵 (阴影替代) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
          <ringGeometry args={[0.25, 0.35, 32]} />
          <meshBasicMaterial color={activeColor} transparent opacity={isWorking ? 0.6 : 0.1} />
        </mesh>
      </group>
    </group>
  );
}
