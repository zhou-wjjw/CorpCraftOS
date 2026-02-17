"use client";

import { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSwarmStore } from "@/hooks/useSwarmStore";
import type { ZoneFunctionGroup, ZoneDef } from "@/lib/zone-config";

// ──────────────────────────────────────────────
// GroupEditorPanel — Right-slide panel for editing a zone function group
// Sections: Info · Positions · Skills · Metrics Dashboard
// ──────────────────────────────────────────────

interface GroupEditorPanelProps {
  group: ZoneFunctionGroup;
  onClose: () => void;
}

// ── Skill catalog (reused from SkillEquipPanel) ──

interface SkillItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

const SKILL_CATALOG: SkillItem[] = [
  { id: "clean_csv", name: "clean_csv", description: "Clean & normalize CSV data", tags: ["data", "clean"] },
  { id: "data_analysis", name: "data_analysis", description: "Statistical data analysis", tags: ["data", "analysis"] },
  { id: "code_review", name: "code_review", description: "Automated code review", tags: ["dev", "review"] },
  { id: "api_test", name: "api_test", description: "API endpoint testing", tags: ["dev", "test"] },
  { id: "bug_triage", name: "bug_triage", description: "Bug classification & triage", tags: ["bugs", "triage"] },
  { id: "doc_gen", name: "doc_gen", description: "Documentation generation", tags: ["docs", "writing"] },
  { id: "write_report", name: "write_report", description: "Generate structured reports", tags: ["report", "writing"] },
  { id: "marketing_copy", name: "marketing_copy", description: "Marketing content generation", tags: ["marketing", "writing"] },
  { id: "crawl_competitor", name: "crawl_competitor", description: "Scrape competitor intel", tags: ["crawl", "intel"] },
  { id: "send_email", name: "send_email", description: "Compose & send emails", tags: ["email", "external"] },
];

// ── Keyframes ──

const KEYFRAMES = `
@keyframes groupPanelSlideIn {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes groupOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;

// ── Shared styles ──

const MONO: React.CSSProperties = {
  fontFamily: "'SF Mono', 'Fira Code', monospace",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#fff",
  fontSize: 13,
  outline: "none",
  ...MONO,
};

// ── Section Header ──

function SectionHeader({
  title,
  count,
  accentColor,
  collapsed,
  onToggle,
}: {
  title: string;
  count?: number;
  accentColor: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        cursor: onToggle ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 3,
            height: 14,
            borderRadius: 2,
            background: accentColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            ...MONO,
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(255,255,255,0.8)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        {count !== undefined && (
          <span
            style={{
              ...MONO,
              fontSize: 10,
              color: accentColor,
              opacity: 0.7,
              background: `${accentColor}18`,
              padding: "1px 6px",
              borderRadius: 8,
            }}
          >
            {count}
          </span>
        )}
      </div>
      {onToggle && (
        <span
          style={{
            ...MONO,
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            transition: "transform 0.2s",
            transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
          }}
        >
          ▼
        </span>
      )}
    </div>
  );
}

// ── Metric Card ──

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          ...MONO,
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          ...MONO,
          fontSize: 18,
          fontWeight: 700,
          color,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Zone Row ──

function ZoneRow({
  zone,
  agentCount,
  isActive,
  accentColor,
  onRemove,
}: {
  zone: ZoneDef;
  agentCount: number;
  isActive: boolean;
  accentColor: string;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background: hovered ? "rgba(255,255,255,0.04)" : "transparent",
        transition: "background 0.15s",
      }}
    >
      {/* Active indicator */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isActive ? "#4ade80" : "rgba(255,255,255,0.15)",
          boxShadow: isActive ? "0 0 6px #4ade8088" : "none",
          flexShrink: 0,
        }}
      />
      {/* Zone label + role */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...MONO,
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {zone.label}
        </div>
        <div
          style={{
            ...MONO,
            fontSize: 10,
            color: "rgba(255,255,255,0.35)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {zone.role}
        </div>
      </div>
      {/* Capacity badge */}
      <span
        style={{
          ...MONO,
          fontSize: 9,
          color: accentColor,
          background: `${accentColor}15`,
          padding: "2px 6px",
          borderRadius: 6,
          flexShrink: 0,
        }}
      >
        {agentCount}/{zone.capacity}
      </span>
      {/* Remove button (show on hover) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          ...MONO,
          width: 20,
          height: 20,
          borderRadius: 4,
          border: "none",
          background: hovered ? "rgba(239,68,68,0.15)" : "transparent",
          color: hovered ? "#f87171" : "transparent",
          fontSize: 12,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.15s",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Skill Chip ──

function SkillChip({
  skill,
  equipped,
  accentColor,
  onToggle,
}: {
  skill: SkillItem;
  equipped: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={skill.description}
      style={{
        ...MONO,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 8,
        border: equipped
          ? `1px solid ${accentColor}60`
          : "1px solid rgba(255,255,255,0.08)",
        background: equipped
          ? `${accentColor}18`
          : hovered
            ? "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.03)",
        color: equipped ? accentColor : "rgba(255,255,255,0.5)",
        fontSize: 11,
        fontWeight: equipped ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
        letterSpacing: "0.02em",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: equipped ? accentColor : "rgba(255,255,255,0.2)",
          flexShrink: 0,
        }}
      />
      {skill.name}
    </button>
  );
}

// ════════════════════════════════════════════════
// Main Panel
// ════════════════════════════════════════════════

export default function GroupEditorPanel({ group, onClose }: GroupEditorPanelProps) {
  const agents = useSwarmStore((s) => s.agents);
  const activeZoneIds = useSwarmStore((s) => s.activeZoneIds);
  const zoneRegistry = useSwarmStore((s) => s.zoneRegistry);
  const completedTaskMap = useSwarmStore((s) => s.completedTaskMap);
  const updateGroupInfo = useSwarmStore((s) => s.updateGroupInfo);
  const updateGroupSkills = useSwarmStore((s) => s.updateGroupSkills);
  const addZoneToGroup = useSwarmStore((s) => s.addZoneToGroup);
  const removeZoneFromGroup = useSwarmStore((s) => s.removeZoneFromGroup);

  // Local editing state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(group.label);
  const [descValue, setDescValue] = useState(group.description ?? "");
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneLabel, setNewZoneLabel] = useState("");
  const [newZoneRole, setNewZoneRole] = useState("");
  const [metricsCollapsed, setMetricsCollapsed] = useState(true);

  // Zones belonging to this group
  const groupZones = useMemo(() => {
    return group.zoneIds
      .map((id) => zoneRegistry.find((z) => z.id === id))
      .filter(Boolean) as ZoneDef[];
  }, [group.zoneIds, zoneRegistry]);

  // Agents in group zones
  const groupAgents = useMemo(() => {
    const zoneSet = new Set(group.zoneIds);
    return agents.filter((a) => a.zone_id && zoneSet.has(a.zone_id));
  }, [agents, group.zoneIds]);

  // Agent counts per zone
  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of agents) {
      if (a.zone_id) counts[a.zone_id] = (counts[a.zone_id] ?? 0) + 1;
    }
    return counts;
  }, [agents]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const activeZones = groupZones.filter((z) => activeZoneIds.includes(z.id));
    const avgSuccess =
      groupAgents.length > 0
        ? groupAgents.reduce((acc, a) => acc + a.metrics.success_rate_7d, 0) / groupAgents.length
        : 0;
    const totalCost = groupAgents.reduce((acc, a) => acc + a.metrics.token_cost_7d, 0);

    // Count completed tasks from agents in this group
    let completedTasks = 0;
    const zoneSet = new Set(group.zoneIds);
    for (const [, record] of completedTaskMap) {
      const claimedBy = record.task.claimed_by;
      if (claimedBy) {
        const agent = agents.find((a) => a.agent_id === claimedBy);
        if (agent?.zone_id && zoneSet.has(agent.zone_id)) {
          completedTasks++;
        }
      }
    }

    return {
      agentCount: groupAgents.length,
      activeZoneCount: activeZones.length,
      totalZones: groupZones.length,
      avgSuccess,
      totalCost,
      completedTasks,
    };
  }, [groupAgents, groupZones, activeZoneIds, completedTaskMap, agents, group.zoneIds]);

  // Equipped skill IDs
  const equippedSkillIds = useMemo(() => {
    return new Set((group.baseSkills ?? []).map((s) => s.id));
  }, [group.baseSkills]);

  const handleSaveName = useCallback(() => {
    if (nameValue.trim() && nameValue !== group.label) {
      updateGroupInfo(group.id, { label: nameValue.trim() });
    }
    setEditingName(false);
  }, [nameValue, group.label, group.id, updateGroupInfo]);

  const handleSaveDesc = useCallback(() => {
    if (descValue !== (group.description ?? "")) {
      updateGroupInfo(group.id, { description: descValue });
    }
  }, [descValue, group.description, group.id, updateGroupInfo]);

  const handleAddZone = useCallback(() => {
    if (!newZoneLabel.trim() || !newZoneRole.trim()) return;
    addZoneToGroup(group.id, newZoneLabel.trim(), newZoneRole.trim());
    setNewZoneLabel("");
    setNewZoneRole("");
    setShowAddZone(false);
  }, [newZoneLabel, newZoneRole, group.id, addZoneToGroup]);

  const handleToggleSkill = useCallback(
    (skillId: string) => {
      const current = group.baseSkills ?? [];
      let next: { id: string; version: string }[];
      if (equippedSkillIds.has(skillId)) {
        next = current.filter((s) => s.id !== skillId);
      } else {
        next = [...current, { id: skillId, version: "1.0" }];
      }
      updateGroupSkills(group.id, next);
    },
    [group.id, group.baseSkills, equippedSkillIds, updateGroupSkills],
  );

  const ac = group.accentColor;

  return createPortal(
    <>
      <style>{KEYFRAMES}</style>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 900,
          background: "rgba(0,0,0,0.35)",
          animation: "groupOverlayIn 0.2s ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          zIndex: 901,
          display: "flex",
          flexDirection: "column",
          background: "rgba(10,10,15,0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: `1px solid ${ac}20`,
          boxShadow: `
            -20px 0 60px rgba(0,0,0,0.5),
            inset 1px 0 0 rgba(255,255,255,0.04)
          `,
          animation: "groupPanelSlideIn 0.25s ease",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            {/* Color indicator */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${ac}25`,
                border: `1px solid ${ac}40`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: ac,
                  boxShadow: `0 0 10px ${ac}60`,
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingName ? (
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  style={{
                    ...INPUT_STYLE,
                    fontSize: 16,
                    fontWeight: 700,
                    padding: "4px 8px",
                  }}
                />
              ) : (
                <div
                  onClick={() => setEditingName(true)}
                  style={{
                    ...MONO,
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    cursor: "pointer",
                    letterSpacing: "0.02em",
                  }}
                  title="Click to edit"
                >
                  {group.label}
                </div>
              )}
              <div
                style={{
                  ...MONO,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 2,
                }}
              >
                {group.labelEn} · {groupZones.length} zones · {groupAgents.length} agents
              </div>
            </div>
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              ...MONO,
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "rgba(255,255,255,0.4)",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 24px 24px",
          }}
        >
          {/* ── Section A: Description ── */}
          <div style={{ marginTop: 16 }}>
            <SectionHeader title="Description" accentColor={ac} />
            <textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onBlur={handleSaveDesc}
              placeholder="Add group description..."
              rows={3}
              style={{
                ...INPUT_STYLE,
                marginTop: 10,
                resize: "vertical",
                minHeight: 60,
              }}
            />
          </div>

          {/* ── Section B: Positions (Zones) ── */}
          <div style={{ marginTop: 20 }}>
            <SectionHeader
              title="Positions"
              count={groupZones.length}
              accentColor={ac}
            />
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {groupZones.map((zone) => (
                <ZoneRow
                  key={zone.id}
                  zone={zone}
                  agentCount={agentCounts[zone.id] ?? 0}
                  isActive={activeZoneIds.includes(zone.id)}
                  accentColor={ac}
                  onRemove={() => removeZoneFromGroup(group.id, zone.id)}
                />
              ))}
            </div>

            {/* Add Zone form */}
            {showAddZone ? (
              <div
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <input
                  autoFocus
                  value={newZoneLabel}
                  onChange={(e) => setNewZoneLabel(e.target.value)}
                  placeholder="Position name (e.g. DevOps)"
                  style={INPUT_STYLE}
                />
                <input
                  value={newZoneRole}
                  onChange={(e) => setNewZoneRole(e.target.value)}
                  placeholder="Role title (e.g. DevOps Engineer)"
                  style={INPUT_STYLE}
                  onKeyDown={(e) => e.key === "Enter" && handleAddZone()}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowAddZone(false)}
                    style={{
                      ...MONO,
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "transparent",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddZone}
                    disabled={!newZoneLabel.trim() || !newZoneRole.trim()}
                    style={{
                      ...MONO,
                      padding: "5px 14px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        newZoneLabel.trim() && newZoneRole.trim()
                          ? `linear-gradient(135deg, ${ac}, ${ac}cc)`
                          : "rgba(255,255,255,0.06)",
                      color:
                        newZoneLabel.trim() && newZoneRole.trim()
                          ? "#0a0a0f"
                          : "rgba(255,255,255,0.2)",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor:
                        newZoneLabel.trim() && newZoneRole.trim()
                          ? "pointer"
                          : "default",
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddZone(true)}
                style={{
                  ...MONO,
                  marginTop: 10,
                  width: "100%",
                  padding: "8px 0",
                  borderRadius: 8,
                  border: `1px dashed ${ac}30`,
                  background: "transparent",
                  color: ac,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: 0.7,
                  transition: "opacity 0.15s",
                  letterSpacing: "0.04em",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "0.7"; }}
              >
                + Add Position
              </button>
            )}
          </div>

          {/* ── Section C: Group Skills ── */}
          <div style={{ marginTop: 20 }}>
            <SectionHeader
              title="Base Skills"
              count={equippedSkillIds.size}
              accentColor={ac}
            />
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {SKILL_CATALOG.map((skill) => (
                <SkillChip
                  key={skill.id}
                  skill={skill}
                  equipped={equippedSkillIds.has(skill.id)}
                  accentColor={ac}
                  onToggle={() => handleToggleSkill(skill.id)}
                />
              ))}
            </div>
            <div
              style={{
                ...MONO,
                marginTop: 8,
                fontSize: 10,
                color: "rgba(255,255,255,0.25)",
                lineHeight: 1.5,
              }}
            >
              Base skills are inherited by agents recruited into this group.
            </div>
          </div>

          {/* ── Section D: Performance Dashboard ── */}
          <div style={{ marginTop: 20, marginBottom: 8 }}>
            <SectionHeader
              title="Performance"
              accentColor={ac}
              collapsed={metricsCollapsed}
              onToggle={() => setMetricsCollapsed((v) => !v)}
            />
            {!metricsCollapsed && (
              <div
                style={{
                  marginTop: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <MetricCard
                  label="Agents"
                  value={`${metrics.agentCount}`}
                  color={ac}
                />
                <MetricCard
                  label="Active Zones"
                  value={`${metrics.activeZoneCount}/${metrics.totalZones}`}
                  color="#4ade80"
                />
                <MetricCard
                  label="Success Rate"
                  value={
                    metrics.agentCount > 0
                      ? `${(metrics.avgSuccess * 100).toFixed(0)}%`
                      : "—"
                  }
                  color="#60a5fa"
                />
                <MetricCard
                  label="Tasks Done"
                  value={`${metrics.completedTasks}`}
                  color="#a78bfa"
                />
                <MetricCard
                  label="Token Cost"
                  value={`$${metrics.totalCost.toFixed(2)}`}
                  color="#f97316"
                />
                <MetricCard
                  label="Total Zones"
                  value={`${metrics.totalZones}`}
                  color="#facc15"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              ...MONO,
              padding: "9px 20px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
