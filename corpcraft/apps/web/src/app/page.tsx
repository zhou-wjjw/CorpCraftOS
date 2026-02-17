"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type KeyboardEvent,
} from "react";
import type { Camera } from "three";
import * as THREE from "three";

// ── Scene components ──
import IsometricCanvas, { type ViewMode } from "@/components/scene/IsometricCanvas";
import ZoneGrid, { type ZoneData } from "@/components/scene/ZoneGrid";
import BountyBoard from "@/components/scene/BountyBoard";
import AnvilWorkbench from "@/components/scene/AnvilWorkbench";
import AgentCharacter from "@/components/scene/AgentCharacter";
import AnimationController, {
  type AnimStateMap,
} from "@/components/scene/AnimationController";
import SelectionBox from "@/components/scene/SelectionBox";
import ZoneProps from "@/components/scene/ZoneProps";
import FloatingTerminal from "@/components/scene/FloatingTerminal";
import SpeechBubbleSystem from "@/components/scene/SpeechBubble";
import CollabLines from "@/components/scene/CollabLines";
import ClickEffect, { type ClickEffectHandle } from "@/components/scene/ClickEffect";
import SummonFlareEffect from "@/components/scene/SummonFlareEffect";
import TeleportPillar, { type TeleportPillarHandle } from "@/components/scene/TeleportPillar";
import InterruptHologram from "@/components/scene/InterruptHologram";
import ZoneCollabVisualizer from "@/components/scene/ZoneCollabVisualizer";
// import GltfAgentShowcase from "@/components/scene/GltfAgentShowcase";

// ── HUD overlay components ──
import HudOverlay from "@/components/hud/HudOverlay";
import EventPanel from "@/components/hud/EventPanel";
import CostTracker from "@/components/hud/CostTracker";
import MetricsMini from "@/components/hud/MetricsMini";
import SideNav from "@/components/hud/SideNav";

// ── Panels ──
import AgentInspector from "@/components/panels/AgentInspector";
import RecruitAgentModal from "@/components/panels/RecruitAgentModal";
import AgentSettingsModal from "@/components/panels/AgentSettingsModal";
import TaskListPanel from "@/components/panels/TaskListPanel";
import TaskResultPanel from "@/components/panels/TaskResultPanel";
import TaskHistoryPanel from "@/components/panels/TaskHistoryPanel";
import ModelLibraryModal from "@/components/panels/ModelLibraryModal";
import SkillEquipPanel from "@/components/panels/SkillEquipPanel";
import GroupEditorPanel from "@/components/panels/GroupEditorPanel";

// ── Hooks & helpers ──
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSwarmStore } from "@/hooks/useSwarmStore";
import { useDemoLoop } from "@/hooks/useDemoLoop";
import { createIntentMessage, createSetExecutionMode } from "@/lib/ws-protocol";
import type { ExecutionModeValue } from "@corpcraft/contracts";
import { ZONES, BOUNTY_BOARD_POSITION, getAnvilPosition, ZONE_MAP, MAP_BOUNDS, detectZoneAtPosition, ZONE_FUNCTION_GROUPS } from "@/lib/zone-config";
import type { AgentTemplate, AgentEntity } from "@corpcraft/contracts";
import { createAgent } from "@corpcraft/contracts";

const WS_URL = "ws://localhost:3002/ws";

const DEFAULT_ZONES: ZoneData[] = ZONES.map((z) => ({
  id: z.id,
  label: z.label,
  position: z.position,
  color: z.color,
  activeTaskCount: 0,
  role: z.role,
}));

export default function Page() {
  const { connected, send } = useWebSocket(WS_URL);
  useDemoLoop();
  const [intentText, setIntentText] = useState("");
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("iso");
  const [legendOpen, setLegendOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animation state
  const animStateMapRef = useRef<AnimStateMap>(new Map());
  const [animVersion, setAnimVersion] = useState(0);

  // Refs for SelectionBox
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera | null>(null);

  // Store selectors
  const agents = useSwarmStore((s) => s.agents);
  const events = useSwarmStore((s) => s.events);
  const hud = useSwarmStore((s) => s.hud);
  const selectedAgentIds = useSwarmStore((s) => s.selectedAgentIds);
  const setSelectedAgents = useSwarmStore((s) => s.setSelectedAgents);

  // Claude Agent Teams state
  const teamStatuses = useSwarmStore((s) => s.teamStatuses);
  const progressDetails = useSwarmStore((s) => s.progressDetails);

  // Right-click dispatch
  const moveAgentToPoint = useSwarmStore((s) => s.moveAgentToPoint);

  // Zone activation
  const activeZoneIds = useSwarmStore((s) => s.activeZoneIds);
  const activateZone = useSwarmStore((s) => s.activateZone);

  // Click effect ref
  const clickEffectRef = useRef<ClickEffectHandle>(null);
  // Teleport pillar ref (golden descent beam for manual recruitment)
  const teleportPillarRef = useRef<TeleportPillarHandle | null>(null);

  // Execution mode
  const executionMode = useSwarmStore((s) => s.executionMode);
  const setExecutionMode = useSwarmStore((s) => s.setExecutionMode);

  // Fetch initial execution mode from gateway on connect
  useEffect(() => {
    if (!connected) return;
    fetch("http://localhost:3002/api/execution-mode")
      .then((r) => r.json())
      .then((data: { mode: ExecutionModeValue }) => {
        if (data.mode) setExecutionMode(data.mode);
      })
      .catch(() => { /* gateway may not be up yet */ });
  }, [connected, setExecutionMode]);

  // Toast state for offline mode warnings
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const handleModeChange = useCallback(
    (mode: ExecutionModeValue) => {
      if (mode === "mock") {
        // Mock works offline — just set local state
        setExecutionMode(mode);
        if (connected) send(createSetExecutionMode(mode));
      } else if (connected) {
        // Claude / Team need gateway
        send(createSetExecutionMode(mode));
      } else {
        // Offline + non-mock → show toast
        showToast(mode === "claude"
          ? "需要启动 Gateway 服务才能使用 Claude 模式"
          : "需要启动 Gateway 服务才能使用 Team 模式");
      }
    },
    [connected, send, setExecutionMode, showToast],
  );

  // Build name→id map for team visualization
  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) {
      map.set(a.name, a.agent_id);
    }
    return map;
  }, [agents]);

  // Modal states
  const recruitModalOpen = useSwarmStore((s) => s.recruitModalOpen);
  const settingsModalOpen = useSwarmStore((s) => s.settingsModalOpen);
  const settingsAgentId = useSwarmStore((s) => s.settingsAgentId);
  const openRecruitModal = useSwarmStore((s) => s.openRecruitModal);
  const closeRecruitModal = useSwarmStore((s) => s.closeRecruitModal);
  const openSettingsModal = useSwarmStore((s) => s.openSettingsModal);
  const closeSettingsModal = useSwarmStore((s) => s.closeSettingsModal);
  const recruitAgentAction = useSwarmStore((s) => s.recruitAgent);

  // Model library modal
  const modelLibraryOpen = useSwarmStore((s) => s.modelLibraryOpen);
  const openModelLibrary = useSwarmStore((s) => s.openModelLibrary);
  const closeModelLibrary = useSwarmStore((s) => s.closeModelLibrary);

  // Skill equip panel
  const skillPanelAgentId = useSwarmStore((s) => s.skillPanelAgentId);
  const closeSkillPanel = useSwarmStore((s) => s.closeSkillPanel);

  // Group editor panel
  const groupEditorGroupId = useSwarmStore((s) => s.groupEditorGroupId);
  const groupRegistry = useSwarmStore((s) => s.groupRegistry);
  const closeGroupEditor = useSwarmStore((s) => s.closeGroupEditor);

  // Task history panel
  const openTaskHistory = useSwarmStore((s) => s.openTaskHistory);

  // Task panel visibility toggle
  const taskPanelsVisible = useSwarmStore((s) => s.taskPanelsVisible);
  const toggleTaskPanels = useSwarmStore((s) => s.toggleTaskPanels);

  const settingsAgent = useMemo(
    () => settingsAgentId ? agents.find((a) => a.agent_id === settingsAgentId) ?? null : null,
    [settingsAgentId, agents],
  );

  const skillPanelAgent = useMemo(
    () => skillPanelAgentId ? agents.find((a) => a.agent_id === skillPanelAgentId) ?? null : null,
    [skillPanelAgentId, agents],
  );

  const editorGroup = useMemo(
    () => groupEditorGroupId ? groupRegistry.find((g) => g.id === groupEditorGroupId) ?? null : null,
    [groupEditorGroupId, groupRegistry],
  );

  const openTaskCount = useMemo(
    () => events.filter((e) => e.topic === "TASK_POSTED" && e.status === "OPEN").length,
    [events],
  );

  const zonesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const agent of agents) {
      if (agent.zone_id && agent.status !== "IDLE") {
        counts[agent.zone_id] = (counts[agent.zone_id] ?? 0) + 1;
      }
    }
    return DEFAULT_ZONES.map((z) => ({
      ...z,
      activeTaskCount: counts[z.id] ?? 0,
    }));
  }, [agents]);

  const forgingZones = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    animVersion;
    const forging = new Set<string>();
    for (const [, anim] of animStateMapRef.current) {
      if (anim.animState === "FORGING" && anim.zoneId) {
        forging.add(anim.zoneId);
      }
    }
    return forging;
  }, [animVersion]);

  const mpRatio = hud.mp.max > 0 ? hud.mp.current / hud.mp.max : 1;

  const handleSend = useCallback(() => {
    const text = intentText.trim();
    if (!text) return;
    send(createIntentMessage(text, crypto.randomUUID()));
    setIntentText("");
    inputRef.current?.focus();
  }, [intentText, send]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleAgentClick = useCallback(
    (agentId: string) => {
      setSelectedAgents(selectedAgentIds.includes(agentId) ? [] : [agentId]);
    },
    [selectedAgentIds, setSelectedAgents],
  );

  const handleAgentDoubleClick = useCallback(
    (agentId: string) => {
      openSettingsModal(agentId);
    },
    [openSettingsModal],
  );

  const handleAnimStateChange = useCallback(() => {
    setAnimVersion((v) => v + 1);
  }, []);

  // Global T-key toggle for task panels (with input focus guard)
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        toggleTaskPanels();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleTaskPanels]);

  const handleBoxSelect = useCallback(
    (ids: string[]) => {
      setSelectedAgents(ids);
    },
    [setSelectedAgents],
  );

  const handleRecruit = useCallback(
    (template: AgentTemplate) => {
      // Find a zone to place the new agent (pick least populated or random)
      const zoneIds = ZONES.map((z) => z.id);
      const counts: Record<string, number> = {};
      for (const a of agents) {
        if (a.zone_id) counts[a.zone_id] = (counts[a.zone_id] ?? 0) + 1;
      }
      const bestZone = zoneIds.reduce((a, b) =>
        (counts[a] ?? 0) <= (counts[b] ?? 0) ? a : b,
      );
      const zone = ZONE_MAP.get(bestZone);
      const pos = zone
        ? { x: zone.position[0] + 0.3 + Math.random() * 0.6, y: 0, z: zone.position[2] + 0.3 + Math.random() * 0.6 }
        : { x: 0, y: 0, z: 0 };

      const newAgent: AgentEntity = createAgent({
        agent_id: `recruited-${template.template_id}-${Date.now()}`,
        name: template.name,
        kind: template.kind,
        role_tags: template.role_tags,
        zone_id: bestZone,
        position: pos,
        equipped_skills: template.default_skills,
        appearance: template.appearance,
      });
      recruitAgentAction(newAgent);
    },
    [agents, recruitAgentAction],
  );

  const handleOpenSettings = useCallback(() => {
    // Open settings for first selected agent, or first agent
    const targetId = selectedAgentIds[0] ?? agents[0]?.agent_id;
    if (targetId) openSettingsModal(targetId);
  }, [selectedAgentIds, agents, openSettingsModal]);

  const handleOpenAgents = useCallback(() => {
    // Select all agents to show the agent inspector
    const allIds = agents.map((a) => a.agent_id);
    if (allIds.length > 0) {
      // If all are already selected, deselect; otherwise select all
      const allSelected = allIds.length === selectedAgentIds.length && allIds.every((id) => selectedAgentIds.includes(id));
      setSelectedAgents(allSelected ? [] : allIds);
    }
  }, [agents, selectedAgentIds, setSelectedAgents]);

  const handleBountyBoardClick = useCallback(() => {
    setTaskPanelOpen((prev) => !prev);
  }, []);

  const pushEvent = useSwarmStore((s) => s.pushEvent);

  const handleActivateZone = useCallback(
    (zoneId: string) => {
      activateZone(zoneId);
    },
    [activateZone],
  );

  const handleCollaboration = useCallback(
    (agentIds: string[], zoneId: string) => {
      if (agentIds.length < 2) return;
      const now = Date.now();
      const collabId = `collab-${zoneId}-${now}`;

      // Push events with shared parent_event_id so CollabLines renders connections
      for (const agentId of agentIds) {
        pushEvent({
          event_id: `${collabId}-${agentId}`,
          topic: "TASK_CLAIMED",
          intent: `Collaborating in ${zoneId}`,
          payload: { agent_id: agentId, zone_id: zoneId },
          required_tags: [],
          risk_level: "LOW",
          budget: { max_tokens: 0, max_minutes: 0, max_cash: 0 },
          status: "CLAIMED",
          claimed_by: agentId,
          parent_event_id: collabId,
          created_at: now,
          updated_at: now,
        });
      }
    },
    [pushEvent],
  );

  // ── HTML-level right-click handler (bypasses R3F raycaster) ──
  // Uses refs to avoid stale closures in the event listener.
  const selectedIdsRef = useRef(selectedAgentIds);
  selectedIdsRef.current = selectedAgentIds;
  const moveAgentToPointRef = useRef(moveAgentToPoint);
  moveAgentToPointRef.current = moveAgentToPoint;

  const FORMATION_RADIUS = 0.5;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (e: MouseEvent) => {
      const ids = selectedIdsRef.current;
      if (ids.length === 0) return;

      const camera = cameraRef.current;
      if (!camera) return;

      e.preventDefault();

      // Convert screen coords to NDC
      const rect = container.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast to the y=0 ground plane
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const target = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, target) === null) return;

      const clampedX = THREE.MathUtils.clamp(target.x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
      const clampedZ = THREE.MathUtils.clamp(target.z, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);
      const targetZone = detectZoneAtPosition(clampedX, clampedZ);
      const count = ids.length;
      const moveFn = moveAgentToPointRef.current;

      for (let i = 0; i < count; i++) {
        let tx = clampedX;
        let tz = clampedZ;
        if (count > 1) {
          const angle = (i / count) * Math.PI * 2;
          tx += Math.cos(angle) * FORMATION_RADIUS;
          tz += Math.sin(angle) * FORMATION_RADIUS;
        }
        moveFn(ids[i], tx, tz, targetZone?.id);
      }

      clickEffectRef.current?.spawn(clampedX, clampedZ);
    };

    container.addEventListener("contextmenu", handleContextMenu);
    return () => container.removeEventListener("contextmenu", handleContextMenu);
  }, []); // Stable — reads from refs

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* ── 3D Scene ── */}
      <IsometricCanvas containerRef={containerRef} cameraRef={cameraRef} viewMode={viewMode}>
        <ZoneGrid
          zones={zonesWithCounts}
          hasSelectedAgent={selectedAgentIds.length > 0}
          activeZoneIds={activeZoneIds}
        />

        <BountyBoard openTaskCount={openTaskCount} position={BOUNTY_BOARD_POSITION} onClick={handleBountyBoardClick} />

        {/* 3D props — only for active zones, hidden in top-down flat view */}
        {viewMode === "iso" && <ZoneProps activeZoneIds={activeZoneIds} />}
        {viewMode === "iso" && ZONES.filter((z) => activeZoneIds.includes(z.id)).map((zone) => (
          <AnvilWorkbench
            key={zone.id}
            position={getAnvilPosition(zone.id)}
            isForging={forgingZones.has(zone.id)}
            mpRatio={mpRatio}
          />
        ))}

        {agents.map((agent) => (
          <AgentCharacter
            key={agent.agent_id}
            agent={agent}
            selected={selectedAgentIds.includes(agent.agent_id)}
            onClick={() => handleAgentClick(agent.agent_id)}
            onDoubleClick={() => handleAgentDoubleClick(agent.agent_id)}
            animStateMapRef={animStateMapRef}
            viewMode={viewMode}
          />
        ))}

        <FloatingTerminal
          animStateMapRef={animStateMapRef}
          events={events}
          animVersion={animVersion}
          progressDetails={progressDetails}
          taskPanelsVisible={taskPanelsVisible}
        />

        <SpeechBubbleSystem
          events={events}
          animStateMapRef={animStateMapRef}
          agents={agents}
          taskPanelsVisible={taskPanelsVisible}
        />

        <CollabLines
          events={events}
          animStateMapRef={animStateMapRef}
          animVersion={animVersion}
          teamStatuses={teamStatuses}
          agentNameMap={agentNameMap}
        />

        {/* <GltfAgentShowcase /> */}

        {/* ── 3D Gamified Effects ── */}
        <SummonFlareEffect animStateMapRef={animStateMapRef} />
        <TeleportPillar animStateMapRef={animStateMapRef} pillarRef={teleportPillarRef} />
        <InterruptHologram animStateMapRef={animStateMapRef} />
        <ZoneCollabVisualizer animStateMapRef={animStateMapRef} />

        <ClickEffect ref={clickEffectRef} />

        <AnimationController
          agents={agents}
          events={events}
          stateMapRef={animStateMapRef}
          onStateChange={handleAnimStateChange}
          onCollaboration={handleCollaboration}
          activeZoneIds={activeZoneIds}
          onActivateZone={handleActivateZone}
        />
      </IsometricCanvas>

      {/* ── RTS Selection Box ── */}
      <SelectionBox
        agents={agents}
        onSelect={handleBoxSelect}
        containerRef={containerRef}
        camera={cameraRef.current ?? undefined}
        animStateMapRef={animStateMapRef}
      />

      {/* ── Left Navigation ── */}
      <SideNav
        onOpenRecruit={openRecruitModal}
        onOpenSettings={handleOpenSettings}
        onOpenModelLibrary={openModelLibrary}
        onOpenAgents={handleOpenAgents}
        onOpenTaskHistory={openTaskHistory}
      />

      {/* ── HUD ── */}
      <HudOverlay />
      <EventPanel />
      <CostTracker />
      <MetricsMini />

      {/* ── Agent Inspector ── */}
      <AgentInspector />

      {/* ── Task Result Panel ── */}
      <TaskResultPanel />

      {/* ── Task History Panel ── */}
      <TaskHistoryPanel />

      {/* ── Task List Panel (bounty board detail) ── */}
      <TaskListPanel
        events={events}
        agents={agents}
        open={taskPanelOpen}
        onClose={() => setTaskPanelOpen(false)}
      />

      {/* ── Modals ── */}
      <RecruitAgentModal
        open={recruitModalOpen}
        onClose={closeRecruitModal}
        onRecruit={handleRecruit}
      />
      <AgentSettingsModal
        open={settingsModalOpen}
        agent={settingsAgent}
        onClose={closeSettingsModal}
        onSave={(agentId, settings) => {
          console.log("[Settings] Save:", agentId, settings);
          closeSettingsModal();
        }}
      />
      <ModelLibraryModal
        open={modelLibraryOpen}
        onClose={closeModelLibrary}
      />
      {skillPanelAgent && (
        <SkillEquipPanel
          agent={skillPanelAgent}
          onClose={closeSkillPanel}
        />
      )}
      {editorGroup && (
        <GroupEditorPanel
          group={editorGroup}
          onClose={closeGroupEditor}
        />
      )}

      {/* ── Status Bar: Connection + Execution Mode ── */}
      <div style={{
        position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 60, display: "flex", alignItems: "center", gap: 10,
        padding: "4px 6px", background: "rgba(10,10,15,0.7)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* Connection dot + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 8px", pointerEvents: "none" }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? "#4ade80" : "#f87171",
            boxShadow: connected ? "0 0 8px #4ade8088" : "0 0 8px #f8717188",
          }} />
          <span style={{
            fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 10,
            color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em",
          }}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />

        {/* Mode pills */}
        {(["mock", "claude", "team"] as const).map((mode) => {
          const isActive = executionMode === mode;
          const colors: Record<string, { active: string; glow: string }> = {
            mock: { active: "#6b7280", glow: "#6b728044" },
            claude: { active: "#60a5fa", glow: "#60a5fa44" },
            team: { active: "#a78bfa", glow: "#a78bfa44" },
          };
          const c = colors[mode];
          const labels: Record<string, string> = {
            mock: "Mock",
            claude: "Claude",
            team: "Team",
          };
          return (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 14,
                border: isActive
                  ? `1px solid ${c.active}88`
                  : "1px solid transparent",
                background: isActive
                  ? `${c.active}18`
                  : "transparent",
                boxShadow: isActive ? `0 0 12px ${c.glow}` : "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? c.active : "rgba(255,255,255,0.35)",
                letterSpacing: "0.04em",
                opacity: isActive ? 1 : (!connected && mode !== "mock") ? 0.45 : 0.7,
              }}
            >
              {/* Status dot for active mode */}
              {isActive && (
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: c.active,
                  boxShadow: `0 0 6px ${c.active}88`,
                }} />
              )}
              {labels[mode]}
              {!connected && mode !== "mock" && !isActive && (
                <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 1 }}>
                  (offline)
                </span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />

        {/* View mode toggle: 3D / 2D */}
        {(["iso", "top"] as const).map((vm) => {
          const isActive = viewMode === vm;
          const label = vm === "iso" ? "◇ 3D" : "◫ 2D";
          const activeColor = vm === "iso" ? "#c4b5fd" : "#60a5fa";
          return (
            <button
              key={vm}
              onClick={() => setViewMode(vm)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 14,
                border: isActive
                  ? `1px solid ${activeColor}88`
                  : "1px solid transparent",
                background: isActive
                  ? `${activeColor}18`
                  : "transparent",
                boxShadow: isActive ? `0 0 12px ${activeColor}44` : "none",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? activeColor : "rgba(255,255,255,0.35)",
                letterSpacing: "0.04em",
                opacity: isActive ? 1 : 0.7,
              }}
            >
              {isActive && (
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: activeColor,
                  boxShadow: `0 0 6px ${activeColor}88`,
                }} />
              )}
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Zone Group Legend ── */}
      <div style={{
        position: "fixed", bottom: 80, right: 20, zIndex: 55,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
      }}>
        <button
          onClick={() => setLegendOpen((o) => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 10px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            background: legendOpen ? "rgba(255,255,255,0.08)" : "rgba(10,10,15,0.6)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            cursor: "pointer", color: "rgba(255,255,255,0.5)",
            fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 10,
            letterSpacing: "0.04em", transition: "all 0.2s ease",
          }}
        >
          <span style={{ fontSize: 12 }}>&#9638;</span> {legendOpen ? "Hide" : "Map"}
        </button>
        {legendOpen && (
          <div style={{
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(10,10,15,0.8)",
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", flexDirection: "column", gap: 5,
          }}>
            {ZONE_FUNCTION_GROUPS.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: g.accentColor, opacity: 0.8, flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 10, color: g.accentColor, opacity: 0.7,
                  letterSpacing: "0.03em", whiteSpace: "nowrap",
                }}>
                  {g.label}
                  <span style={{ opacity: 0.5, marginLeft: 4 }}>{g.labelEn}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Toast notification ── */}
      {toastMsg && (
        <div style={{
          position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)",
          zIndex: 70, padding: "8px 16px",
          background: "rgba(239, 68, 68, 0.15)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 10, color: "#fca5a5",
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 11, letterSpacing: "0.02em",
          animation: "fadeIn 0.2s ease",
        }}>
          {toastMsg}
        </div>
      )}

      {/* ── Intent Input ── */}
      <div style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        zIndex: 60, width: "min(560px, calc(100vw - 400px))", pointerEvents: "auto",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          background: "rgba(10,10,15,0.75)", backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
          padding: "4px 4px 4px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <input
            ref={inputRef}
            type="text"
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入任务意图..."
            style={{
              flex: 1, padding: "10px 0", fontSize: 14, color: "#fff",
              background: "transparent", border: "none", outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!intentText.trim() || !connected}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 10, border: "none",
              cursor: intentText.trim() && connected ? "pointer" : "default",
              background: intentText.trim() && connected
                ? "linear-gradient(135deg, #4ade80, #22c55e)"
                : "rgba(255,255,255,0.06)",
              color: intentText.trim() && connected ? "#0a0a0f" : "rgba(255,255,255,0.2)",
              fontSize: 18, fontWeight: 700, flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
