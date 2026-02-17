"use client";

import { useState, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { AgentTemplate } from "@corpcraft/contracts";
import { AGENT_TEMPLATES } from "@corpcraft/contracts";
import type { AccessoryType } from "@corpcraft/contracts";

// ──────────────────────────────────────────────
// RecruitAgentModal — Game-style recruit overlay
// Centered modal with agent grid, tabs, portal
// ──────────────────────────────────────────────

interface RecruitAgentModalProps {
  open: boolean;
  onClose: () => void;
  onRecruit: (template: AgentTemplate) => void;
}

type TabKey = "recruiting" | "customizations";

const ACCESSORY_LABELS: Record<AccessoryType, string> = {
  helmet: "🛡",
  scarf: "🧣",
  star_badge: "⭐",
  visor: "🥽",
  crown: "👑",
  horns: "😈",
  ninja_mask: "🥷",
  none: "",
};

const KEYFRAMES = `
@keyframes recruitModalIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes recruitOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;

function RecruitAgentModal({ open, onClose, onRecruit }: RecruitAgentModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("recruiting");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleRecruit = useCallback(() => {
    if (!selectedId) return;
    const tpl = AGENT_TEMPLATES.find((t) => t.template_id === selectedId);
    if (tpl) onRecruit(tpl);
  }, [selectedId, onRecruit]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const selectedTemplate = selectedId
    ? AGENT_TEMPLATES.find((t) => t.template_id === selectedId)
    : null;

  return createPortal(
    <>
      <style>{KEYFRAMES}</style>

      {/* Overlay */}
      <div
        onClick={handleOverlayClick}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: "recruitOverlayIn 0.2s ease-out",
        }}
      >
        {/* Modal */}
        <div
          style={{
            width: "100%",
            maxWidth: 680,
            background: "rgba(15,15,22,0.95)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "recruitModalIn 0.25s ease-out",
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              padding: "20px 24px 0 24px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(249,115,22,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                👥
              </div>
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1.2,
                  }}
                >
                  Recruit Agent
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.4)",
                    marginTop: 2,
                  }}
                >
                  Select an AI to join your team
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "rgba(255,255,255,0.5)",
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* ── Tabs ── */}
          <div
            style={{
              display: "flex",
              gap: 0,
              padding: "16px 24px 0 24px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {(
              [
                { key: "recruiting" as TabKey, label: "Recruiting", icon: "👥" },
                { key: "customizations" as TabKey, label: "Customizations", icon: "⚙" },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: isActive ? "#f97316" : "rgba(255,255,255,0.4)",
                    background: "transparent",
                    border: "none",
                    borderBottom: isActive
                      ? "2px solid #f97316"
                      : "2px solid transparent",
                    cursor: "pointer",
                    transition: "color 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                  }}
                >
                  <span style={{ fontSize: 14 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Content ── */}
          <div style={{ flex: 1, padding: 24, minHeight: 0 }}>
            {activeTab === "recruiting" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gridTemplateRows: "repeat(2, auto)",
                  gap: 16,
                }}
              >
                {AGENT_TEMPLATES.map((tpl) => {
                  const isSelected = selectedId === tpl.template_id;
                  const isHovered = hoveredId === tpl.template_id;
                  const color = tpl.appearance.color_primary;
                  const colorSec = tpl.appearance.color_secondary;

                  return (
                    <button
                      key={tpl.template_id}
                      onClick={() => setSelectedId(tpl.template_id)}
                      onMouseEnter={() => setHoveredId(tpl.template_id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: isSelected
                          ? `1px solid ${color}`
                          : isHovered
                            ? `1px solid ${color}4D`
                            : "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 12,
                        cursor: "pointer",
                        padding: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        transition: "border-color 0.15s, box-shadow 0.2s",
                        boxShadow: isSelected
                          ? `0 4px 24px ${color}33, inset 0 -2px 12px ${color}22`
                          : "none",
                        position: "relative",
                      }}
                    >
                      {/* Preview area */}
                      <div
                        style={{
                          width: "100%",
                          height: 120,
                          background: `radial-gradient(circle at 50% 60%, ${color}44, rgba(15,15,22,0.95) 70%)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                        }}
                      >
                        {/* Circle silhouette */}
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: "50%",
                            background: `linear-gradient(135deg, ${color}, ${colorSec})`,
                            boxShadow: `0 0 20px ${color}55`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 22,
                          }}
                        >
                          {ACCESSORY_LABELS[tpl.appearance.accessory] || "🤖"}
                        </div>

                        {/* Role tag badge */}
                        <div
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "rgba(0,0,0,0.5)",
                            fontSize: 9,
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.5)",
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {tpl.role_tags[0]}
                        </div>
                      </div>

                      {/* Info */}
                      <div
                        style={{
                          padding: "12px 12px 14px",
                          width: "100%",
                          textAlign: "left",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: colorSec,
                            marginBottom: 4,
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                          }}
                        >
                          {tpl.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.4)",
                            lineHeight: 1.4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {tpl.description}
                        </div>
                      </div>

                      {/* Selected glow ring at bottom */}
                      {isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                            borderRadius: "0 0 12px 12px",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 260,
                  color: "rgba(255,255,255,0.3)",
                  fontSize: 14,
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                }}
              >
                Customizations coming soon
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
              }}
            >
              {selectedTemplate
                ? `Selected: ${selectedTemplate.name}`
                : "No agent selected"}
            </div>
            <button
              onClick={handleRecruit}
              disabled={!selectedId}
              style={{
                padding: "10px 32px",
                borderRadius: 8,
                border: "none",
                background: selectedId
                  ? "linear-gradient(135deg, #f97316, #ea580c)"
                  : "rgba(255,255,255,0.06)",
                color: selectedId ? "#fff" : "rgba(255,255,255,0.25)",
                fontSize: 13,
                fontWeight: 700,
                cursor: selectedId ? "pointer" : "default",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                transition: "opacity 0.15s",
                boxShadow: selectedId
                  ? "0 2px 12px rgba(249,115,22,0.3)"
                  : "none",
              }}
            >
              Recruit
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default memo(RecruitAgentModal);
