"use client";

import { useState, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { AGENT_TEMPLATES } from "@corpcraft/contracts";
import type { AccessoryType } from "@corpcraft/contracts";
import { useSwarmStore } from "@/hooks/useSwarmStore";

// ────────────────────────────────────────────
// ModelLibraryModal — Appearance selector
// Choose colors + accessory for procedural characters
// ────────────────────────────────────────────

interface ModelLibraryModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Appearance presets from agent templates ──

interface AppearancePreset {
  id: string;
  name: string;
  description: string;
  colorPrimary: string;
  colorSecondary: string;
  accessory: AccessoryType;
}

const PRESETS: AppearancePreset[] = AGENT_TEMPLATES.map((t) => ({
  id: t.template_id,
  name: t.name,
  description: t.description,
  colorPrimary: t.appearance.color_primary,
  colorSecondary: t.appearance.color_secondary,
  accessory: t.appearance.accessory,
}));

// ── Mini character preview (pure CSS, no Canvas) ──

function CharacterPreview({ primary, secondary, accessory }: {
  primary: string;
  secondary: string;
  accessory: AccessoryType;
}) {
  const accessoryLabel: Record<string, string> = {
    helmet: "H",
    scarf: "~",
    star_badge: "*",
    visor: "V",
    crown: "W",
    horns: "Y",
    ninja_mask: "N",
    none: "",
  };

  return (
    <div style={{
      width: 60, height: 80, position: "relative",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-end",
    }}>
      {/* Accessory */}
      {accessory !== "none" && (
        <div style={{
          position: "absolute", top: 0, fontSize: 16, fontWeight: 900,
          color: secondary, textShadow: `0 0 6px ${secondary}88`,
          lineHeight: 1,
        }}>
          {accessoryLabel[accessory] ?? "?"}
        </div>
      )}
      {/* Head */}
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: `linear-gradient(135deg, ${primary}, ${primary}cc)`,
        border: `2px solid ${secondary}66`,
        boxShadow: `0 2px 8px ${primary}44`,
        position: "relative",
        marginBottom: -4, zIndex: 1,
      }}>
        {/* Eyes */}
        <div style={{
          position: "absolute", top: 10, left: 6,
          width: 5, height: 5, borderRadius: "50%", background: "#fff",
        }} />
        <div style={{
          position: "absolute", top: 10, right: 6,
          width: 5, height: 5, borderRadius: "50%", background: "#fff",
        }} />
      </div>
      {/* Body */}
      <div style={{
        width: 22, height: 26, borderRadius: "8px 8px 4px 4px",
        background: primary,
        boxShadow: `0 2px 8px ${primary}44`,
        position: "relative",
      }}>
        {/* Cape */}
        <div style={{
          position: "absolute", top: 2, left: -4, right: -4, bottom: 4,
          borderRadius: 4, background: secondary, opacity: 0.5,
          zIndex: -1,
        }} />
      </div>
      {/* Legs */}
      <div style={{ display: "flex", gap: 3, marginTop: 1 }}>
        <div style={{ width: 8, height: 10, borderRadius: "3px 3px 2px 2px", background: primary }} />
        <div style={{ width: 8, height: 10, borderRadius: "3px 3px 2px 2px", background: primary }} />
      </div>
    </div>
  );
}

// ── Keyframes ──

const KEYFRAMES = `
@keyframes modelLibIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes modelLibOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;

// ── Main Component ──

function ModelLibraryModal({ open, onClose }: ModelLibraryModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Store state
  const agents = useSwarmStore((s) => s.agents);
  const selectedAgentIds = useSwarmStore((s) => s.selectedAgentIds);
  const assignAppearance = useSwarmStore((s) => s.assignModelToAgent);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleAssign = useCallback(() => {
    const preset = PRESETS.find((p) => p.id === selectedId);
    if (!preset) return;
    const targetId = selectedAgentIds[0] ?? agents[0]?.agent_id;
    if (targetId) {
      // Pass the appearance data (assignModelToAgent now handles appearance)
      assignAppearance(targetId, JSON.stringify({
        color_primary: preset.colorPrimary,
        color_secondary: preset.colorSecondary,
        accessory: preset.accessory,
      }));
      onClose();
    }
  }, [selectedId, selectedAgentIds, agents, assignAppearance, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const targetAgentName = (() => {
    const targetId = selectedAgentIds[0] ?? agents[0]?.agent_id;
    return agents.find((a) => a.agent_id === targetId)?.name ?? "agent";
  })();

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
          animation: "modelLibOverlayIn 0.2s ease-out",
        }}
      >
        {/* Modal */}
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            maxHeight: "85vh",
            background: "rgba(15,15,22,0.95)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "modelLibIn 0.25s ease-out",
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              padding: "20px 24px 16px 24px",
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
                  background: "rgba(139,92,246,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(139,92,246,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="5" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                  Appearance Library
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  Choose a look for your agent
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

          {/* ── Content ── */}
          <div style={{ flex: 1, padding: "0 24px 24px", minHeight: 0, overflowY: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              {PRESETS.map((preset) => {
                const isSelected = selectedId === preset.id;
                const isHovered = hoveredId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedId(preset.id)}
                    onMouseEnter={() => setHoveredId(preset.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: isSelected
                        ? "1px solid #8b5cf6"
                        : isHovered
                          ? "1px solid rgba(139,92,246,0.3)"
                          : "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 12,
                      cursor: "pointer",
                      padding: 0,
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      transition: "border-color 0.15s, box-shadow 0.2s",
                      boxShadow: isSelected ? "0 4px 24px rgba(139,92,246,0.2)" : "none",
                      position: "relative",
                      textAlign: "left",
                    }}
                  >
                    {/* Character Preview */}
                    <div style={{
                      width: "100%",
                      height: 110,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `radial-gradient(circle at 50% 60%, ${preset.colorPrimary}22, rgba(15,15,22,0.95) 70%)`,
                    }}>
                      <CharacterPreview
                        primary={preset.colorPrimary}
                        secondary={preset.colorSecondary}
                        accessory={preset.accessory}
                      />
                    </div>

                    {/* Info */}
                    <div style={{ padding: "10px 12px 14px", width: "100%" }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: preset.colorSecondary,
                        marginBottom: 3,
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        textShadow: `0 0 6px ${preset.colorSecondary}44`,
                      }}>
                        {preset.name}
                      </div>
                      {/* Color swatches */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: 3,
                          background: preset.colorPrimary,
                          border: "1px solid rgba(255,255,255,0.15)",
                        }} />
                        <div style={{
                          width: 12, height: 12, borderRadius: 3,
                          background: preset.colorSecondary,
                          border: "1px solid rgba(255,255,255,0.15)",
                        }} />
                        <span style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.25)",
                          fontFamily: "'SF Mono', monospace",
                          marginLeft: 2,
                        }}>
                          {preset.accessory}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.3)",
                        lineHeight: 1.4,
                      }}>
                        {preset.description}
                      </div>
                    </div>

                    {isSelected && (
                      <div style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: `linear-gradient(90deg, transparent, ${preset.colorSecondary}, transparent)`,
                        borderRadius: "0 0 12px 12px",
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
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
            <div style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'SF Mono', 'Fira Code', monospace",
            }}>
              {selectedId
                ? `Assign to: ${targetAgentName}`
                : "Select an appearance to assign"}
            </div>
            <button
              onClick={handleAssign}
              disabled={!selectedId}
              style={{
                padding: "10px 32px",
                borderRadius: 8,
                border: "none",
                background: selectedId
                  ? "linear-gradient(135deg, #8b5cf6, #7c3aed)"
                  : "rgba(255,255,255,0.06)",
                color: selectedId ? "#fff" : "rgba(255,255,255,0.25)",
                fontSize: 13,
                fontWeight: 700,
                cursor: selectedId ? "pointer" : "default",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                transition: "opacity 0.15s",
                boxShadow: selectedId ? "0 2px 12px rgba(139,92,246,0.3)" : "none",
              }}
            >
              Assign Look
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default memo(ModelLibraryModal);
