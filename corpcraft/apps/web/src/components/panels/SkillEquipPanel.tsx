"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AgentEntity } from "@corpcraft/contracts";

// ────────────────────────────────────────────
// SkillEquipPanel — Galaxy-style skill graph
// Clustered layout · pannable canvas · elastic collision
// ────────────────────────────────────────────

interface SkillEquipPanelProps {
  agent: AgentEntity;
  onClose: () => void;
}

// ── Types ──

type EquipItemType = "skill" | "agent_md" | "agents_md";

interface SkillGroup {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  popularity: number;
}

interface EquipItem {
  id: string;
  name: string;
  type: EquipItemType;
  description: string;
  tags: string[];
  popularity: number;
  groupId: string;
}

// ── Color / label maps ──

const TYPE_COLORS: Record<EquipItemType, string> = {
  skill: "#4ade80",
  agent_md: "#60a5fa",
  agents_md: "#a78bfa",
};

const TYPE_LABELS: Record<EquipItemType, string> = {
  skill: "Skill",
  agent_md: "Agent MD",
  agents_md: "Agents MD",
};

function formatPop(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

// ── Groups ──

const SKILL_GROUPS: SkillGroup[] = [
  { id: "corpcraft", name: "corpcraft", slug: "/core", icon: "C", color: "#60a5fa", popularity: 6000 },
  { id: "data-team", name: "data-team", slug: "/data-skills", icon: "D", color: "#22d3ee", popularity: 4420 },
  { id: "dev-tools", name: "dev-tools", slug: "/dev-skills", icon: "{}", color: "#a78bfa", popularity: 7500 },
  { id: "content-lab", name: "content-lab", slug: "/writing", icon: "W", color: "#fb923c", popularity: 4200 },
  { id: "integrations", name: "integrations", slug: "/external", icon: "I", color: "#f472b6", popularity: 1960 },
];

// ── Items ──

const AVAILABLE_ITEMS: EquipItem[] = [
  { id: "agent_md_default", name: "agent.md", type: "agent_md", description: "Agent persona & instruction set", tags: ["core", "persona"], popularity: 4200, groupId: "corpcraft" },
  { id: "agents_md_team", name: "agents.md", type: "agents_md", description: "Multi-agent coordination protocol", tags: ["multi", "orchestration"], popularity: 1800, groupId: "corpcraft" },
  { id: "clean_csv", name: "clean_csv", type: "skill", description: "Clean & normalize CSV data", tags: ["data", "clean"], popularity: 820, groupId: "data-team" },
  { id: "data_analysis", name: "data_analysis", type: "skill", description: "Statistical data analysis", tags: ["data", "analysis"], popularity: 3600, groupId: "data-team" },
  { id: "code_review", name: "code_review", type: "skill", description: "Automated code review", tags: ["dev", "review"], popularity: 2800, groupId: "dev-tools" },
  { id: "api_test", name: "api_test", type: "skill", description: "API endpoint testing", tags: ["dev", "test"], popularity: 1500, groupId: "dev-tools" },
  { id: "bug_triage", name: "bug_triage", type: "skill", description: "Bug classification & triage", tags: ["bugs", "triage"], popularity: 980, groupId: "dev-tools" },
  { id: "doc_gen", name: "doc_gen", type: "skill", description: "Documentation generation", tags: ["docs", "writing"], popularity: 2200, groupId: "dev-tools" },
  { id: "write_report", name: "write_report", type: "skill", description: "Generate structured reports", tags: ["report", "writing"], popularity: 3100, groupId: "content-lab" },
  { id: "marketing_copy", name: "marketing_copy", type: "skill", description: "Marketing content generation", tags: ["marketing", "writing"], popularity: 1100, groupId: "content-lab" },
  { id: "crawl_competitor", name: "crawl_competitor", type: "skill", description: "Scrape competitor intel", tags: ["crawl", "intel"], popularity: 1400, groupId: "integrations" },
  { id: "send_email", name: "send_email", type: "skill", description: "Compose & send emails", tags: ["email", "external"], popularity: 560, groupId: "integrations" },
];

// ── Tab bar ──

const TAB_ITEMS = ["General", "Skills", "Workspace", "Advanced"] as const;
type Tab = (typeof TAB_ITEMS)[number];
const TAB_ICONS: Record<Tab, string> = {
  General: "\u2699",
  Skills: "\u2B50",
  Workspace: "\uD83D\uDCC1",
  Advanced: "\u2699",
};

// ── Virtual canvas & layout constants ──

const CANVAS_W = 1800;
const CANVAS_H = 1200;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

const SKILL_HW = 82;
const SKILL_HH = 25;
const GROUP_R = 45;
const AGENT_R = 40;

const GROUP_ORBIT = 220;
const SKILL_ORBIT = 130;

// ── Cluster layout engine ──

interface NodePos {
  x: number;
  y: number;
}

function buildClusterLayout(): Record<string, NodePos> {
  const positions: Record<string, NodePos> = {};
  const groupCount = SKILL_GROUPS.length;
  const startAngle = -Math.PI / 2;

  SKILL_GROUPS.forEach((group, gi) => {
    const gAngle = startAngle + (2 * Math.PI * gi) / groupCount;
    const gx = CX + GROUP_ORBIT * Math.cos(gAngle);
    const gy = CY + GROUP_ORBIT * Math.sin(gAngle);
    positions[`group:${group.id}`] = { x: gx, y: gy };

    const skills = AVAILABLE_ITEMS.filter((it) => it.groupId === group.id);
    const n = skills.length;
    if (n === 0) return;

    const awayAngle = Math.atan2(gy - CY, gx - CX);
    const spread = Math.min(Math.PI * 0.8, (Math.PI * 2) / groupCount * 0.85);
    const baseAngle = awayAngle - spread / 2;

    skills.forEach((skill, si) => {
      const sAngle = n === 1 ? awayAngle : baseAngle + (spread * si) / (n - 1);
      positions[skill.id] = {
        x: gx + SKILL_ORBIT * Math.cos(sAngle),
        y: gy + SKILL_ORBIT * Math.sin(sAngle),
      };
    });
  });

  return positions;
}

// ── Elastic collision (push-type) ──

function pushCollide(
  dragId: string,
  allPos: Record<string, NodePos>,
  fixedIds: Set<string>,
): Record<string, NodePos> {
  const next = { ...allPos };
  const visited = new Set<string>();

  function pushFrom(sourceId: string, depth: number) {
    if (depth > 3) return;
    const src = next[sourceId];
    if (!src) return;

    const srcHW = sourceId.startsWith("group:") ? GROUP_R : SKILL_HW;
    const srcHH = sourceId.startsWith("group:") ? GROUP_R : SKILL_HH;

    for (const [id, pos] of Object.entries(next)) {
      if (id === sourceId || id === dragId || fixedIds.has(id) || visited.has(id)) continue;

      const isGroup = id.startsWith("group:");
      const tHW = isGroup ? GROUP_R : SKILL_HW;
      const tHH = isGroup ? GROUP_R : SKILL_HH;

      const dx = pos.x - src.x;
      const dy = pos.y - src.y;
      const overX = (srcHW + tHW) - Math.abs(dx);
      const overY = (srcHH + tHH) - Math.abs(dy);

      if (overX > 0 && overY > 0 && !isGroup) {
        visited.add(id);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const pushDist = Math.max(overX, overY) * 0.6 + 8;
        const nx = dx / dist;
        const ny = dy / dist;
        next[id] = {
          x: clampX(pos.x + nx * pushDist),
          y: clampY(pos.y + ny * pushDist),
        };
        pushFrom(id, depth + 1);
      }
    }
  }

  pushFrom(dragId, 0);

  const agentDx = (next[dragId]?.x ?? CX) - CX;
  const agentDy = (next[dragId]?.y ?? CY) - CY;
  const agentOverX = (SKILL_HW + AGENT_R) - Math.abs(agentDx);
  const agentOverY = (SKILL_HH + AGENT_R) - Math.abs(agentDy);
  if (agentOverX > 0 && agentOverY > 0) {
    // no-op: agent is immovable
  }

  return next;
}

function clampX(x: number): number {
  return Math.max(SKILL_HW, Math.min(CANVAS_W - SKILL_HW, x));
}
function clampY(y: number): number {
  return Math.max(SKILL_HH, Math.min(CANVAS_H - SKILL_HH, y));
}

// ── Interaction state machine ──

type InteractionMode = "idle" | "dragNode" | "panCanvas";

interface DragNodeState {
  itemId: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

interface PanState {
  startPanX: number;
  startPanY: number;
  startClientX: number;
  startClientY: number;
}

// ── Component ──

export default function SkillEquipPanel({ agent, onClose }: SkillEquipPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Skills");

  // Equipped state — separated by type
  const [equippedSkills, setEquippedSkills] = useState<Set<string>>(
    () => new Set(agent.equipped_skills.map((s) => s.id)),
  );
  const [equippedAgentMd, setEquippedAgentMd] = useState<string | null>(
    () => agent.equipped_agent_md?.id ?? null,
  );
  const [equippedAgentsMd, setEquippedAgentsMd] = useState<string | null>(
    () => agent.equipped_agents_md?.id ?? null,
  );
  const [saving, setSaving] = useState(false);

  const isEquipped = useCallback((id: string): boolean => {
    if (equippedSkills.has(id)) return true;
    if (equippedAgentMd === id) return true;
    if (equippedAgentsMd === id) return true;
    return false;
  }, [equippedSkills, equippedAgentMd, equippedAgentsMd]);

  const equippedCount = equippedSkills.size + (equippedAgentMd ? 1 : 0) + (equippedAgentsMd ? 1 : 0);

  const toggleEquip = useCallback((item: EquipItem) => {
    if (item.type === "agent_md") {
      setEquippedAgentMd((prev) => (prev === item.id ? null : item.id));
    } else if (item.type === "agents_md") {
      setEquippedAgentsMd((prev) => (prev === item.id ? null : item.id));
    } else {
      setEquippedSkills((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/agents/${agent.agent_id}/equip`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill_ids: Array.from(equippedSkills),
          agent_md_id: equippedAgentMd,
          agents_md_id: equippedAgentsMd,
        }),
      });
    } catch {
      console.warn("[SkillEquipPanel] Save failed");
    }
    setSaving(false);
    onClose();
  }, [agent.agent_id, equippedSkills, equippedAgentMd, equippedAgentsMd, onClose]);

  // ── Positions (virtual canvas coords) ──
  const [positions, setPositions] = useState<Record<string, NodePos>>(buildClusterLayout);

  // ── Pan & Zoom (viewport) ──
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panInitialized = useRef(false);

  const ZOOM_MIN = 0.35;
  const ZOOM_MAX = 2.0;

  useEffect(() => {
    if (panInitialized.current) return;
    const el = viewportRef.current;
    if (!el) return;
    panInitialized.current = true;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    setPan({ x: vw / 2 - CX, y: vh / 2 - CY });
  }, [activeTab]);

  // Wheel zoom — zoom toward cursor position
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const delta = -e.deltaY * 0.001;
    setZoom((prevZoom) => {
      const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prevZoom + delta * prevZoom));
      const scale = newZoom / prevZoom;
      setPan((prevPan) => ({
        x: cursorX - scale * (cursorX - prevPan.x),
        y: cursorY - scale * (cursorY - prevPan.y),
      }));
      return newZoom;
    });
  }, []);

  // ── Interaction state machine ──
  const modeRef = useRef<InteractionMode>("idle");
  const dragNodeRef = useRef<DragNodeState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const rafRef = useRef<number>(0);

  // Fixed (immovable) node ids — only agent center
  const fixedIds = useRef<Set<string>>(new Set());

  // -- Node pointer down (drag node) --
  const onNodePointerDown = useCallback((e: React.PointerEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (modeRef.current !== "idle") return;
    modeRef.current = "dragNode";
    const pos = positions[itemId];
    if (!pos) return;
    dragNodeRef.current = {
      itemId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - (pos.x * zoom + pan.x),
      offsetY: e.clientY - (pos.y * zoom + pan.y),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [positions, pan, zoom]);

  // -- Background pointer down (pan canvas) --
  // Any pointerDown that wasn't captured by a node (stopPropagation) triggers pan
  const onBgPointerDown = useCallback((e: React.PointerEvent) => {
    if (modeRef.current !== "idle") return;
    e.preventDefault();
    modeRef.current = "panCanvas";
    panRef.current = {
      startPanX: pan.x,
      startPanY: pan.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  // -- Pointer move (dispatched by mode) --
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (modeRef.current === "dragNode" && dragNodeRef.current) {
      cancelAnimationFrame(rafRef.current);
      const clientX = e.clientX;
      const clientY = e.clientY;
      rafRef.current = requestAnimationFrame(() => {
        const dn = dragNodeRef.current;
        if (!dn) return;
        const rawX = (clientX - dn.offsetX - pan.x) / zoom;
        const rawY = (clientY - dn.offsetY - pan.y) / zoom;
        const cx = clampX(rawX);
        const cy = clampY(rawY);
        setPositions((prev) => {
          const updated = { ...prev, [dn.itemId]: { x: cx, y: cy } };
          // If dragging a group node, move its child skills along
          if (dn.itemId.startsWith("group:")) {
            const groupId = dn.itemId.replace("group:", "");
            const oldGp = prev[dn.itemId];
            if (oldGp) {
              const dx = cx - oldGp.x;
              const dy = cy - oldGp.y;
              for (const item of AVAILABLE_ITEMS) {
                if (item.groupId === groupId && updated[item.id]) {
                  updated[item.id] = {
                    x: clampX(updated[item.id].x + dx),
                    y: clampY(updated[item.id].y + dy),
                  };
                }
              }
            }
          }
          return pushCollide(dn.itemId, updated, fixedIds.current);
        });
      });
    } else if (modeRef.current === "panCanvas" && panRef.current) {
      cancelAnimationFrame(rafRef.current);
      const clientX = e.clientX;
      const clientY = e.clientY;
      rafRef.current = requestAnimationFrame(() => {
        const ps = panRef.current;
        if (!ps) return;
        setPan({
          x: ps.startPanX + (clientX - ps.startClientX),
          y: ps.startPanY + (clientY - ps.startClientY),
        });
      });
    }
  }, [pan, zoom]);

  // -- Pointer up --
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const mode = modeRef.current;
    if (mode === "dragNode" && dragNodeRef.current) {
      const dn = dragNodeRef.current;
      const dist = Math.hypot(e.clientX - dn.startX, e.clientY - dn.startY);
      if (dist < 4) {
        const item = AVAILABLE_ITEMS.find((it) => it.id === dn.itemId);
        if (item) toggleEquip(item);
      }
    }
    modeRef.current = "idle";
    dragNodeRef.current = null;
    panRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }, [toggleEquip]);

  // ── Helpers for group equip status ──
  const groupHasEquipped = useCallback((groupId: string): boolean => {
    return AVAILABLE_ITEMS.some((it) => it.groupId === groupId && isEquipped(it.id));
  }, [isEquipped]);

  const groupEquippedCount = useCallback((groupId: string): number => {
    return AVAILABLE_ITEMS.filter((it) => it.groupId === groupId && isEquipped(it.id)).length;
  }, [isEquipped]);

  // ── Render ──

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 960,
          height: 580,
          background: "rgba(12, 12, 18, 0.97)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 18,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* ── Tab bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "0 28px",
            flexShrink: 0,
          }}
        >
          {TAB_ITEMS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "15px 18px",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#4ade80" : "rgba(255,255,255,0.35)",
                  background: "transparent",
                  border: "none",
                  borderBottom: isActive ? "2px solid #4ade80" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  letterSpacing: "0.01em",
                }}
              >
                <span style={{ fontSize: 12, opacity: isActive ? 1 : 0.5 }}>
                  {TAB_ICONS[tab]}
                </span>
                {tab}
              </button>
            );
          })}
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.35)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Content area (viewport) ── */}
        <div
          ref={viewportRef}
          onPointerDown={onBgPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            cursor: modeRef.current === "panCanvas" ? "grabbing" : "grab",
          }}
        >
          {activeTab === "Skills" ? (
            /* Virtual canvas — translated + scaled */
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                willChange: "transform",
              }}
            >
              {/* ── SVG connection lines ── */}
              <svg
                style={{
                  position: "absolute",
                  inset: 0,
                  width: CANVAS_W,
                  height: CANVAS_H,
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              >
                <defs>
                  <filter id="glow-eq" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Layer 1: skill -> group (dashed) */}
                {AVAILABLE_ITEMS.map((item) => {
                  const sp = positions[item.id];
                  const gp = positions[`group:${item.groupId}`];
                  if (!sp || !gp) return null;
                  const group = SKILL_GROUPS.find((g) => g.id === item.groupId);
                  const isEq = isEquipped(item.id);
                  return (
                    <line
                      key={`sg-${item.id}`}
                      x1={gp.x} y1={gp.y}
                      x2={sp.x} y2={sp.y}
                      stroke={isEq && group ? group.color : "rgba(255,255,255,0.15)"}
                      strokeWidth={isEq ? 1.2 : 0.8}
                      strokeDasharray="4 5"
                      opacity={isEq ? 0.6 : 0.5}
                    />
                  );
                })}

                {/* Layer 2: group -> agent (solid, glow when group has equipped) */}
                {SKILL_GROUPS.map((group) => {
                  const gp = positions[`group:${group.id}`];
                  if (!gp) return null;
                  const hasEq = groupHasEquipped(group.id);
                  return (
                    <line
                      key={`ga-${group.id}`}
                      x1={CX} y1={CY}
                      x2={gp.x} y2={gp.y}
                      stroke={hasEq ? group.color : "rgba(255,255,255,0.04)"}
                      strokeWidth={hasEq ? 1.8 : 0.7}
                      opacity={hasEq ? 0.8 : 0.4}
                      filter={hasEq ? "url(#glow-eq)" : undefined}
                    />
                  );
                })}
              </svg>

              {/* ── Group nodes (fixed anchors) ── */}
              {SKILL_GROUPS.map((group) => {
                const gp = positions[`group:${group.id}`];
                if (!gp) return null;
                const hasEq = groupHasEquipped(group.id);
                const eqCount = groupEquippedCount(group.id);
                const gNodeId = `group:${group.id}`;
                const isGDragging = dragNodeRef.current?.itemId === gNodeId;
                return (
                  <div
                    key={`gnode-${group.id}`}
                    onPointerDown={(e) => onNodePointerDown(e, gNodeId)}
                    style={{
                      position: "absolute",
                      transform: `translate(${gp.x - 45}px, ${gp.y - 45}px)`,
                      width: 90,
                      height: 90,
                      borderRadius: "50%",
                      background: `radial-gradient(circle at 40% 35%, ${group.color}20, ${group.color}08)`,
                      border: hasEq ? `1.5px solid ${group.color}66` : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: hasEq ? `0 0 20px ${group.color}22` : "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      zIndex: 3,
                      cursor: "grab",
                      userSelect: "none",
                      touchAction: "none",
                      transition: isGDragging
                        ? "border 0.3s, box-shadow 0.3s"
                        : "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), border 0.3s, box-shadow 0.3s",
                    }}
                  >
                    <div style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: hasEq ? group.color : "rgba(255,255,255,0.4)",
                      lineHeight: 1,
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                    }}>
                      {group.icon}
                    </div>
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: hasEq ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                      marginTop: 3,
                      whiteSpace: "nowrap",
                    }}>
                      {group.name}
                    </div>
                    <div style={{
                      fontSize: 7,
                      color: "rgba(255,255,255,0.25)",
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      marginTop: 1,
                    }}>
                      {group.slug}
                      <span style={{ marginLeft: 4, fontSize: 7, opacity: 0.6 }}>
                        {formatPop(group.popularity)}
                      </span>
                    </div>
                    {eqCount > 0 && (
                      <div style={{
                        position: "absolute",
                        top: "100%",
                        marginTop: 6,
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 8,
                        fontWeight: 700,
                        color: group.color,
                        background: `${group.color}18`,
                        border: `1px solid ${group.color}30`,
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        whiteSpace: "nowrap",
                      }}>
                        {eqCount} equipped
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Skill nodes (draggable) ── */}
              {AVAILABLE_ITEMS.map((item) => {
                const pos = positions[item.id];
                if (!pos) return null;
                const typeColor = TYPE_COLORS[item.type];
                const isEq = isEquipped(item.id);
                const isDragging = dragNodeRef.current?.itemId === item.id;
                return (
                  <div
                    key={item.id}
                    onPointerDown={(e) => onNodePointerDown(e, item.id)}
                    title={item.description}
                    style={{
                      position: "absolute",
                      transform: `translate(${pos.x - 75}px, ${pos.y - 17}px)`,
                      width: 150,
                      padding: "7px 10px",
                      borderRadius: 10,
                      border: isEq ? `1px solid ${typeColor}88` : "1px solid rgba(255,255,255,0.06)",
                      background: isEq ? `${typeColor}10` : "rgba(255,255,255,0.02)",
                      boxShadow: isEq ? `0 0 16px ${typeColor}18, inset 0 0 8px ${typeColor}08` : "none",
                      cursor: "grab",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      zIndex: 4,
                      transition: isDragging
                        ? "none"
                        : "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), border 0.2s, background 0.2s, box-shadow 0.2s",
                      userSelect: "none",
                      touchAction: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: isEq ? typeColor : "rgba(255,255,255,0.15)",
                        boxShadow: isEq ? `0 0 6px ${typeColor}88` : "none",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 11,
                        fontWeight: isEq ? 700 : 500,
                        color: isEq ? typeColor : "rgba(255,255,255,0.55)",
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textAlign: "left",
                      }}
                    >
                      {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: isEq ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)",
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        flexShrink: 0,
                        background: "rgba(255,255,255,0.04)",
                        padding: "1px 5px",
                        borderRadius: 4,
                      }}
                    >
                      {formatPop(item.popularity)}
                    </span>
                  </div>
                );
              })}

              {/* ── Agent center node ── */}
              <div
                style={{
                  position: "absolute",
                  transform: `translate(${CX - 40}px, ${CY - 40}px)`,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: agent.kind === "AI"
                    ? "radial-gradient(circle at 35% 35%, #4f8cfa, #1e40af)"
                    : "radial-gradient(circle at 35% 35%, #4ade80, #166534)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid rgba(255,255,255,0.15)",
                  boxShadow: agent.kind === "AI"
                    ? "0 0 24px rgba(59,130,246,0.3), inset 0 0 12px rgba(59,130,246,0.1)"
                    : "0 0 24px rgba(74,222,128,0.3), inset 0 0 12px rgba(74,222,128,0.1)",
                  zIndex: 5,
                  pointerEvents: "none",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                  {agent.name.slice(0, 6)}
                </div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", fontFamily: "'SF Mono', 'Fira Code', monospace", marginTop: 1 }}>
                  /{agent.role_tags[0] ?? "agent"}
                </div>
              </div>

              {/* "X equipped" badge under agent */}
              <div
                style={{
                  position: "absolute",
                  transform: `translate(${CX - 36}px, ${CY + 44}px)`,
                  width: 72,
                  display: "flex",
                  justifyContent: "center",
                  zIndex: 6,
                  pointerEvents: "none",
                }}
              >
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 10,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#4ade80",
                    background: "rgba(74, 222, 128, 0.12)",
                    border: "1px solid rgba(74, 222, 128, 0.25)",
                    whiteSpace: "nowrap",
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                  }}
                >
                  {equippedCount} equipped
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: 28, color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
              {activeTab} settings — coming soon
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "12px 28px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'SF Mono', 'Fira Code', monospace", letterSpacing: "0.06em" }}>
              POWERED BY
            </span>
            <span style={{ fontSize: 14, fontWeight: 900, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>
              SKILLS
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {(Object.entries(TYPE_LABELS) as [EquipItemType, string][]).map(([type, label]) => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "rgba(255,255,255,0.3)", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_COLORS[type], opacity: 0.6 }} />
                {label}
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 32px",
              borderRadius: 10,
              border: "none",
              background: saving ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #4ade80, #22c55e)",
              color: saving ? "rgba(255,255,255,0.3)" : "#0a0a0f",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "default" : "pointer",
              letterSpacing: "0.02em",
              boxShadow: saving ? "none" : "0 4px 16px rgba(74, 222, 128, 0.25)",
              transition: "all 0.2s ease",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
