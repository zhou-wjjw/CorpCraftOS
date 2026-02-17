"use client";

import { memo, useRef, useMemo, useState, useCallback, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import type { Group, Mesh as ThreeMesh } from "three";
import * as THREE from "three";
import type { AgentEntity, AgentStatus, AuraType, AccessoryType } from "@corpcraft/contracts";
import type { AnimStateMap, AnimState } from "./AnimationController";
import type { ViewMode } from "./IsometricCanvas";
import AgentModel from "./AgentModel";
import { AgentNode, type AgentNodeStatus } from "./AgentNode";
import { getAnvilPosition } from "@/lib/zone-config";
import { useLatestProgressForAgent } from "@/hooks/useSwarmStore";

// ────────────────────────────────────────────
// AgentCharacter — Hybrid renderer
// AI agents → AgentNode (星灵探机 silicon probe)
// HUMAN agents → AgentModel (Q-version chibi avatar)
// ────────────────────────────────────────────

interface AgentCharacterProps {
  agent: AgentEntity;
  onClick: () => void;
  onDoubleClick?: () => void;
  selected: boolean;
  animStateMapRef: React.RefObject<AnimStateMap>;
  viewMode?: ViewMode;
}

// ── AgentNode 硅基智能体视觉参数 ──
const AGENT_NODE_CONFIGS: Record<string, { themeColor: string; skillCount: number; defaultStatus?: AgentNodeStatus }> = {
  Claude: { themeColor: "#FF7B00", skillCount: 4 },               // 顶配模型，橙色4星环
  Gemini: { themeColor: "#8b5cf6", skillCount: 2 },               // 紫色，2星环
  Cursor: { themeColor: "#3b82f6", skillCount: 3, defaultStatus: "WORKING" }, // 蓝色，3星环，默认WORKING
  Codex:  { themeColor: "#10b981", skillCount: 1 },               // 翡翠绿，1星环
};

/** 将 AgentEntity 状态 + 动画状态映射为 AgentNode 三态 */
function getAgentNodeStatus(
  agentStatus: AgentStatus,
  animState: AnimState,
  defaultStatus?: AgentNodeStatus,
): AgentNodeStatus {
  // 动画层优先
  if (animState === "ALERT" || animState === "SUMMONING") return "ERROR";
  if (animState === "ATTENTION") return "WORKING";
  if (animState === "TELEPORTING") return "WORKING";
  if (animState === "FORGING" || animState === "THINKING" ||
      animState === "WALK_TO_BOARD" || animState === "WALK_TO_BENCH" ||
      animState === "WALK_TO_POINT") return "WORKING";
  // 实体状态层
  if (agentStatus === "FAILED") return "ERROR";
  if (agentStatus === "EVALUATING" || agentStatus === "CLAIMED" ||
      agentStatus === "EXEC_TOOL" || agentStatus === "EXEC_SANDBOX") return "WORKING";
  // 回退到配置默认值
  return defaultStatus ?? "IDLE";
}

// Fallback palettes when appearance is not set (HUMAN agents)
const FALLBACK_PALETTES: Record<string, { primary: string; secondary: string; accessory: AccessoryType }> = {
  Codex: { primary: "#e8e8e8", secondary: "#4a4a6e", accessory: "helmet" },
  Claude: { primary: "#d4a574", secondary: "#c0392b", accessory: "scarf" },
  Cursor: { primary: "#6ba3c2", secondary: "#4a9eda", accessory: "ninja_mask" },
  Gemini: { primary: "#b36fd8", secondary: "#f5a623", accessory: "star_badge" },
  Admin: { primary: "#27ae60", secondary: "#f1c40f", accessory: "crown" },
};

const DEFAULT_FALLBACK = { primary: "#60a5fa", secondary: "#3b82f6", accessory: "none" as AccessoryType };

const AURA_COLORS: Record<AuraType, string> = {
  CONTEXT: "#60a5fa",
  APPROVAL: "#4ade80",
  REVIEW: "#a78bfa",
};

function StatusIndicator({ status, animState }: { status: AgentStatus; animState?: AnimState }) {
  const effectiveState = animState === "FORGING" ? "EXEC_TOOL"
    : animState === "ALERT" ? "FAILED"
    : animState === "CELEBRATE" ? "DONE"
    : animState === "THINKING" ? "EVALUATING"
    : status;

  switch (effectiveState) {
    case "IDLE":
      return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#6b7280" }} />;
    case "CLAIMED":
    case "EVALUATING":
      return <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 14 }}>!</span>;
    case "EXEC_TOOL":
    case "EXEC_SANDBOX":
      return <span style={{ fontSize: 14 }}>⚒</span>;
    case "WAIT_HUMAN":
      return <span style={{ fontSize: 14, color: "#f87171" }}>✋</span>;
    case "FAILED":
      return <span style={{ fontSize: 14, color: "#f87171" }}>✕</span>;
    case "DONE":
      return <span style={{ color: "#4ade80", fontWeight: 700, fontSize: 14 }}>✓</span>;
    default:
      return null;
  }
}

function AuraRing({ auraType, radius, index }: { auraType: AuraType; radius: number; index: number }) {
  const meshRef = useRef<ThreeMesh>(null);
  const color = AURA_COLORS[auraType] ?? "#4ade80";

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.3 + index * Math.PI * 0.67;
    }
  });

  const inner = radius + index * 0.15;
  const outer = inner + 0.1;

  return (
    <mesh ref={meshRef} position={[0, 0.02 + index * 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[inner, outer, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.FrontSide} depthWrite={false} />
    </mesh>
  );
}

// ── Animated selection ring with rotation + pulse ──

function SelectionRing() {
  const ringRef = useRef<ThreeMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.8;
    }
    if (matRef.current) {
      matRef.current.opacity = 0.55 + Math.sin(t * 3) * 0.2;
    }
  });

  return (
    <mesh ref={ringRef} position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.52, 32]} />
      <meshBasicMaterial ref={matRef} color="#4ade80" transparent opacity={0.7} side={THREE.FrontSide} depthWrite={false} />
    </mesh>
  );
}

// ── Light pillar for selected agents ──

function SelectionPillar() {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.06 + Math.sin(clock.getElapsedTime() * 2.5) * 0.03;
    }
  });

  return (
    <mesh position={[0, 1.0, 0]}>
      <cylinderGeometry args={[0.15, 0.35, 2.0, 16, 1, true]} />
      <meshBasicMaterial ref={matRef} color="#4ade80" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// ── Head arrow indicator for selected agents ──

function SelectionArrow() {
  const groupRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = 2.2 + Math.sin(clock.getElapsedTime() * 3) * 0.08;
    }
  });

  return (
    <group ref={groupRef} position={[0, 2.2, 0]}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.1, 0.2, 4]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

// ── MOBA-style flat icon for top-down view ──

const STATUS_COLORS: Record<AgentNodeStatus, string> = {
  IDLE: "#4ade80",
  WORKING: "#60a5fa",
  ERROR: "#f87171",
};

// ── Working status indicator (floating pill above agent head) ──

const WORKING_STATUSES = new Set<AgentStatus>(["EVALUATING", "CLAIMED", "EXEC_TOOL", "EXEC_SANDBOX"]);

const WORKING_INDICATOR_COLORS: Record<string, string> = {
  thinking: "#60a5fa",
  tool_use: "#facc15",
  text: "#a78bfa",
  result: "#4ade80",
  error: "#f87171",
  team_status: "#c084fc",
};

function WorkingIndicator({ agentId, status, accentColor }: { agentId: string; status: AgentStatus; accentColor: string }) {
  const latestProgress = useLatestProgressForAgent(agentId);

  // Inject CSS keyframes once
  useEffect(() => {
    const styleId = "working-indicator-keyframes";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes workingPulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.7); }
      }
      @keyframes workingFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const isWorking = WORKING_STATUSES.has(status);
  if (!isWorking) return null;

  let label = "Working...";
  let dotColor = accentColor;

  if (latestProgress) {
    dotColor = WORKING_INDICATOR_COLORS[latestProgress.kind] ?? accentColor;
    switch (latestProgress.kind) {
      case "thinking":
        label = "Thinking...";
        break;
      case "tool_use":
        label = latestProgress.toolName ? `${latestProgress.toolName}` : "Using tool...";
        break;
      case "text": {
        const t = latestProgress.content;
        label = t.length > 18 ? t.slice(0, 18) + "..." : t;
        break;
      }
      case "result":
        label = "Finishing...";
        break;
      case "error":
        label = "Error";
        break;
      case "team_status":
        label = "Coordinating...";
        break;
      default:
        label = "Working...";
    }
  } else {
    switch (status) {
      case "EVALUATING": label = "Evaluating..."; break;
      case "CLAIMED": label = "Preparing..."; break;
      case "EXEC_TOOL": label = "Executing..."; break;
      case "EXEC_SANDBOX": label = "Running..."; break;
    }
  }

  return (
    <Html position={[0, 2.1, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "3px 10px 3px 8px",
          background: "rgba(10, 10, 18, 0.82)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 12,
          border: `1px solid ${dotColor}44`,
          boxShadow: `0 0 8px ${dotColor}22`,
          whiteSpace: "nowrap",
          userSelect: "none",
          animation: "workingFadeIn 0.3s ease-out",
          maxWidth: 180,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
            animation: "workingPulseDot 1.2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(255, 255, 255, 0.85)",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
      </div>
    </Html>
  );
}

function AgentFlatIcon({
  themeColor,
  name,
  status,
}: {
  themeColor: string;
  name: string;
  status: AgentNodeStatus;
}) {
  const statusRingRef = useRef<ThreeMesh>(null);
  const statusMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.IDLE;
  const initial = name.charAt(0).toUpperCase();

  useFrame(({ clock }) => {
    if (statusRingRef.current) {
      statusRingRef.current.rotation.z = clock.getElapsedTime() * 1.2;
    }
    if (statusMatRef.current) {
      statusMatRef.current.opacity = 0.6 + Math.sin(clock.getElapsedTime() * 3) * 0.2;
    }
  });

  return (
    <group position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer ring — faction / theme color */}
      <mesh>
        <ringGeometry args={[0.38, 0.48, 32]} />
        <meshBasicMaterial color={themeColor} transparent opacity={0.9} side={THREE.FrontSide} depthWrite={false} />
      </mesh>

      {/* Status ring — rotating, color maps to agent state */}
      <mesh ref={statusRingRef} position={[0, 0, 0.001]}>
        <ringGeometry args={[0.32, 0.37, 6]} />
        <meshBasicMaterial
          ref={statusMatRef}
          color={statusColor}
          transparent
          opacity={0.7}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner fill circle — dark background */}
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[0.32, 32]} />
        <meshBasicMaterial color="#1a1a2e" side={THREE.FrontSide} depthWrite={false} />
      </mesh>

      {/* Initial letter */}
      <Text
        position={[0, 0, 0.003]}
        fontSize={0.28}
        color={themeColor}
        anchorX="center"
        anchorY="middle"
        fontWeight={700}
      >
        {initial}
      </Text>

      {/* Name label via Html */}
      <Html position={[0, -0.7, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div style={{
          color: themeColor,
          fontSize: 10,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontWeight: 700,
          whiteSpace: "nowrap",
          textShadow: `0 0 6px ${themeColor}99`,
          padding: "1px 5px",
          background: "rgba(10, 10, 15, 0.7)",
          borderRadius: 3,
          border: `1px solid ${themeColor}44`,
        }}>
          {name}
        </div>
      </Html>
    </group>
  );
}

const AgentCharacter = memo(function AgentCharacter({
  agent,
  onClick,
  onDoubleClick,
  selected,
  animStateMapRef,
  viewMode = "iso",
}: AgentCharacterProps) {
  const groupRef = useRef<Group>(null);
  const currentAnimState = useRef<AnimState>("IDLE");
  const [hovered, setHovered] = useState(false);

  // Click guard: track pointerDown position to distinguish click from drag
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const CLICK_THRESHOLD_SQ = 25; // 5px squared

  const handlePointerDown = useCallback((e: { clientX: number; clientY: number }) => {
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerOver = useCallback(() => {
    document.body.style.cursor = "pointer";
    setHovered(true);
  }, []);

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = "auto";
    setHovered(false);
  }, []);

  const handleClick = useCallback((e: { stopPropagation: () => void; clientX: number; clientY: number }) => {
    e.stopPropagation();
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    if (dx * dx + dy * dy > CLICK_THRESHOLD_SQ) return;
    onClick();
  }, [onClick]);

  const handleDoubleClick = useCallback((e: { stopPropagation: () => void; clientX: number; clientY: number }) => {
    e.stopPropagation();
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    if (dx * dx + dy * dy > CLICK_THRESHOLD_SQ) return;
    onDoubleClick?.();
  }, [onDoubleClick]);

  // Resolve appearance (colors + accessory only — no model URLs)
  const { colorPrimary, colorSecondary, accessory } = useMemo(() => {
    if (agent.appearance) {
      return {
        colorPrimary: agent.appearance.color_primary,
        colorSecondary: agent.appearance.color_secondary,
        accessory: agent.appearance.accessory,
      };
    }
    const fb = FALLBACK_PALETTES[agent.name] ?? DEFAULT_FALLBACK;
    return { colorPrimary: fb.primary, colorSecondary: fb.secondary, accessory: fb.accessory };
  }, [agent.name, agent.appearance]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const animData = animStateMapRef.current?.get(agent.agent_id);
    if (animData) {
      const pos = animData.position;
      if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return;

      const breathOffset = Math.sin(clock.getElapsedTime() * 2) * 0.03;
      let walkBob = 0;
      if (
        animData.animState === "WALK_TO_BOARD" ||
        animData.animState === "WALK_TO_BENCH" ||
        animData.animState === "WALK_TO_POINT"
      ) {
        walkBob = Math.abs(Math.sin(clock.getElapsedTime() * 8)) * 0.06;
      }

      let forgeAnim = 0;
      if (animData.animState === "FORGING") {
        forgeAnim = Math.abs(Math.sin(clock.getElapsedTime() * 6)) * 0.1;
      }

      let celebrateJump = 0;
      if (animData.animState === "CELEBRATE") {
        celebrateJump = Math.abs(Math.sin(clock.getElapsedTime() * 10)) * 0.2;
      }

      let alertShake = 0;
      if (animData.animState === "ALERT") {
        alertShake = Math.sin(clock.getElapsedTime() * 20) * 0.02;
      }

      groupRef.current.position.set(
        pos.x + alertShake,
        breathOffset + walkBob + forgeAnim + celebrateJump,
        pos.z,
      );

      // Face walking direction (including WALK_TO_POINT)
      if (
        animData.animState === "WALK_TO_BOARD" ||
        animData.animState === "WALK_TO_BENCH" ||
        animData.animState === "WALK_TO_POINT"
      ) {
        const cur = groupRef.current.position;
        const dx = pos.x - cur.x;
        const dz = pos.z - cur.z;
        if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
          const targetAngle = Math.atan2(dx, dz);
          groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetAngle, 0.1);
        }
      }

      // Face anvil center while forging
      if (animData.animState === "FORGING" && animData.zoneId) {
        const anvilPos = getAnvilPosition(animData.zoneId);
        const dx = anvilPos[0] - pos.x;
        const dz = anvilPos[2] - pos.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          const faceAngle = Math.atan2(dx, dz);
          groupRef.current.rotation.y = THREE.MathUtils.lerp(
            groupRef.current.rotation.y,
            faceAngle,
            0.08,
          );
        }
      }

      currentAnimState.current = animData.animState;
    } else {
      const px = agent.position.x;
      const pz = agent.position.z;
      if (!Number.isFinite(px) || !Number.isFinite(pz)) return;
      groupRef.current.position.set(px, Math.sin(clock.getElapsedTime() * 2) * 0.03, pz);
    }
  });

  // ── 视觉阶级判定 ──
  const isAI = agent.kind === "AI";
  const nodeConfig = isAI
    ? (AGENT_NODE_CONFIGS[agent.name] ?? {
        themeColor: colorSecondary,
        skillCount: Math.max(1, agent.equipped_skills.length),
      })
    : null;

  const hasAura = agent.aura && agent.aura.types.length > 0;
  const auraRadius = agent.aura?.radius ?? 0.8;
  const ix = Number.isFinite(agent.position.x) ? agent.position.x : 0;
  const iz = Number.isFinite(agent.position.z) ? agent.position.z : 0;

  return (
    <group ref={groupRef} position={[ix, 0, iz]}>
      {/* ── Enlarged hitbox for easy clicking (transparent but raycastable) ── */}
      <mesh
        position={[0, 1.0, 0]}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <cylinderGeometry args={[0.6, 0.6, 2.2, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {viewMode === "top" ? (
        /* ══════ 俯视平面模式：MOBA 风格图标 ══════ */
        <AgentFlatIcon
          themeColor={isAI ? (nodeConfig?.themeColor ?? colorSecondary) : colorSecondary}
          name={agent.name}
          status={getAgentNodeStatus(
            agent.status,
            currentAnimState.current,
            isAI ? nodeConfig?.defaultStatus : undefined,
          )}
        />
      ) : isAI && nodeConfig ? (
        /* ══════ 硅基智能体：星灵探机 AgentNode ══════ */
        <AgentNode
          position={[0, 0.7, 0]}
          themeColor={nodeConfig.themeColor}
          name={agent.name}
          status={getAgentNodeStatus(agent.status, currentAnimState.current, nodeConfig.defaultStatus)}
          skillCount={nodeConfig.skillCount}
        />
      ) : (
        /* ══════ 碳基人类长官：Q版胶囊小人 AgentModel ══════ */
        <>
          <AgentModel
            name={agent.name}
            colorPrimary={colorPrimary}
            colorSecondary={colorSecondary}
            accessory={accessory}
            animState={currentAnimState.current}
          />

          {/* === Floating label + status (HUMAN only — AgentNode has built-in Text) === */}
          <Html position={[0, 1.5, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, userSelect: "none" }}>
              <div style={{ lineHeight: 1 }}>
                <StatusIndicator status={agent.status} animState={currentAnimState.current} />
              </div>
              <div style={{
                color: colorSecondary,
                fontSize: 11, fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontWeight: 700, whiteSpace: "nowrap",
                textShadow: `0 0 8px ${colorSecondary}99`,
                padding: "2px 6px",
                background: "rgba(10, 10, 15, 0.6)",
                borderRadius: 4,
                border: `1px solid ${colorSecondary}33`,
              }}>
                {agent.name}
              </div>
            </div>
          </Html>
        </>
      )}

      {/* === Hover highlight ring === */}
      {hovered && !selected && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.42, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.25} side={THREE.FrontSide} depthWrite={false} />
        </mesh>
      )}

      {/* === Animated selection ring + pillar + arrow (pillar/arrow only in 3D) === */}
      {selected && (
        <>
          <SelectionRing />
          {viewMode !== "top" && <SelectionPillar />}
          {viewMode !== "top" && <SelectionArrow />}
        </>
      )}

      {/* === Aura rings (HUMAN agents only) === */}
      {hasAura && agent.aura!.types.map((auraType, i) => (
        <AuraRing key={auraType} auraType={auraType} radius={auraRadius} index={i} />
      ))}

      {/* === Floating working-status indicator (all agent types) === */}
      {viewMode !== "top" && (
        <WorkingIndicator
          agentId={agent.agent_id}
          status={agent.status}
          accentColor={isAI ? (nodeConfig?.themeColor ?? colorSecondary) : colorSecondary}
        />
      )}
    </group>
  );
});

export default AgentCharacter;
