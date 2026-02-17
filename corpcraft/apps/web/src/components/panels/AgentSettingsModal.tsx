"use client";

import { useState, memo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import type { AgentEntity, AgentAppearance } from "@corpcraft/contracts";
import { useSwarmStore } from "@/hooks/useSwarmStore";

// ──────────────────────────────────────────────
// AgentSettingsModal — Agent connection config
// Left: agent preview + carousel, Right: settings
// ──────────────────────────────────────────────

interface AgentConnectionSettings {
  name: string;
  ssh_connection: string;
  gateway_url: string;
  gateway_token: string;
  auto_connect: boolean;
}

interface AgentSettingsModalProps {
  open: boolean;
  agent: AgentEntity | null;
  onClose: () => void;
  onSave: (agentId: string, settings: AgentConnectionSettings) => void;
}

export type { AgentConnectionSettings, AgentSettingsModalProps };

type TabKey = "connection" | "routing" | "monitor";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "connection", label: "Connection", icon: "🔗" },
  { key: "routing", label: "Routing", icon: "≡" },
  { key: "monitor", label: "Monitor", icon: ">_" },
];

const SEED_DOT_COUNT = 5;

const KEYFRAMES = `
@keyframes settingsModalIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes settingsOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`;

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#fff",
  fontSize: 13,
  fontFamily: "'SF Mono', 'Fira Code', monospace",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
  fontFamily: "'SF Mono', 'Fira Code', monospace",
};

// ── Toggle Switch Component ──
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked
          ? "linear-gradient(135deg, #4ade80, #22c55e)"
          : "rgba(255,255,255,0.12)",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
        border: checked
          ? "1px solid rgba(74,222,128,0.3)"
          : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}
      />
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
        padding: "12px 14px",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AgentSettingsModal({
  open,
  agent,
  onClose,
  onSave,
}: AgentSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("connection");
  const [activeDot, setActiveDot] = useState(0);
  const [showToken, setShowToken] = useState(false);
  const openModelLibrary = useSwarmStore((s) => s.openModelLibrary);
  const openSkillPanel = useSwarmStore((s) => s.openSkillPanel);

  // Form state
  const [name, setName] = useState("");
  const [sshConnection, setSshConnection] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [autoConnect, setAutoConnect] = useState(true);

  // Reset form when agent changes
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setSshConnection("");
      setGatewayToken("");
      setAutoConnect(true);
      setActiveTab("connection");
      setShowToken(false);
    }
  }, [agent]);

  const handleSave = useCallback(() => {
    if (!agent) return;
    onSave(agent.agent_id, {
      name,
      ssh_connection: sshConnection,
      gateway_url: "ws://127.0.0.1:18789",
      gateway_token: gatewayToken,
      auto_connect: autoConnect,
    });
  }, [agent, name, sshConnection, gatewayToken, autoConnect, onSave]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open || !agent) return null;
  if (typeof document === "undefined") return null;

  const appearance: AgentAppearance = agent.appearance ?? {
    color_primary: "#6b7280",
    color_secondary: "#9ca3af",
    accessory: "none",
  };

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
          animation: "settingsOverlayIn 0.2s ease-out",
        }}
      >
        {/* Modal */}
        <div
          style={{
            width: "100%",
            maxWidth: 780,
            background: "rgba(15,15,22,0.95)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "settingsModalIn 0.25s ease-out",
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
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#fff",
                  lineHeight: 1.2,
                }}
              >
                {agent.name}{" "}
                <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>{" "}
                <span style={{ color: "rgba(255,255,255,0.5)" }}>Settings</span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 4,
                }}
              >
                Agent connection configuration
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
            {TABS.map((tab) => {
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
                  <span style={{ fontSize: 13, opacity: 0.8 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Body: Left + Right ── */}
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* LEFT SIDE — Agent Preview (40%) */}
            <div
              style={{
                width: "40%",
                padding: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                borderRight: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Agent color preview */}
              <div
                style={{
                  width: "100%",
                  height: 260,
                  borderRadius: 12,
                  background: `radial-gradient(circle at 50% 55%, ${appearance.color_primary}55, rgba(15,15,22,0.95) 75%)`,
                  border: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                {/* Agent silhouette */}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${appearance.color_primary}, ${appearance.color_secondary})`,
                    boxShadow: `0 0 40px ${appearance.color_primary}44, 0 0 80px ${appearance.color_primary}22`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.25)",
                    }}
                  />
                </div>

                {/* Agent name overlay */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 12,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    color: appearance.color_secondary,
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    letterSpacing: "0.05em",
                  }}
                >
                  {agent.name}
                </div>
              </div>

              {/* Carousel dots + arrows */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <button
                  onClick={() =>
                    setActiveDot((d) =>
                      d > 0 ? d - 1 : SEED_DOT_COUNT - 1,
                    )
                  }
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 14,
                  }}
                >
                  ←
                </button>
                <div style={{ display: "flex", gap: 6 }}>
                  {Array.from({ length: SEED_DOT_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveDot(i)}
                      style={{
                        width: activeDot === i ? 16 : 8,
                        height: 8,
                        borderRadius: 4,
                        background:
                          activeDot === i
                            ? appearance.color_primary
                            : "rgba(255,255,255,0.15)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() =>
                    setActiveDot((d) =>
                      d < SEED_DOT_COUNT - 1 ? d + 1 : 0,
                    )
                  }
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 14,
                  }}
                >
                  →
                </button>
              </div>

              {/* Change 3D Model button */}
              <button
                onClick={() => {
                  onClose();
                  openModelLibrary();
                }}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(139,92,246,0.3)",
                  background: "rgba(139,92,246,0.08)",
                  color: "#c4b5fd",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  transition: "background 0.15s, border-color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                Change 3D Model
              </button>

              {/* Equip Skills button */}
              <button
                onClick={() => {
                  if (agent) {
                    onClose();
                    openSkillPanel(agent.agent_id);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(74,222,128,0.3)",
                  background: "rgba(74,222,128,0.08)",
                  color: "#4ade80",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  transition: "background 0.15s, border-color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Equip Skills
              </button>
            </div>

            {/* RIGHT SIDE — Settings (60%) */}
            <div
              style={{
                width: "60%",
                padding: 24,
                overflowY: "auto",
                maxHeight: 440,
              }}
            >
              {activeTab === "connection" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 18,
                  }}
                >
                  {/* Name */}
                  <div>
                    <div style={LABEL_STYLE}>Name</div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Agent display name"
                      style={INPUT_STYLE}
                    />
                  </div>

                  {/* SSH Connection */}
                  <div>
                    <div style={LABEL_STYLE}>SSH Connection</div>
                    <input
                      type="text"
                      value={sshConnection}
                      onChange={(e) => setSshConnection(e.target.value)}
                      placeholder="user@host:port"
                      style={INPUT_STYLE}
                    />
                  </div>

                  {/* Local Gateway URL */}
                  <div>
                    <div style={LABEL_STYLE}>Local Gateway URL (auto)</div>
                    <input
                      type="text"
                      value="ws://127.0.0.1:18789"
                      readOnly
                      style={{
                        ...INPUT_STYLE,
                        color: "rgba(255,255,255,0.4)",
                        cursor: "default",
                        background: "rgba(255,255,255,0.03)",
                      }}
                    />
                  </div>

                  {/* Gateway Token */}
                  <div>
                    <div style={LABEL_STYLE}>Gateway Token</div>
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type={showToken ? "text" : "password"}
                        value={gatewayToken}
                        onChange={(e) => setGatewayToken(e.target.value)}
                        placeholder="Enter gateway token"
                        style={{
                          ...INPUT_STYLE,
                          paddingRight: 42,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken((s) => !s)}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: showToken
                            ? "rgba(255,255,255,0.6)"
                            : "rgba(255,255,255,0.3)",
                          fontSize: 16,
                          padding: 4,
                          lineHeight: 1,
                        }}
                      >
                        👁
                      </button>
                    </div>
                  </div>

                  {/* Auto-connect toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "rgba(255,255,255,0.75)",
                          fontWeight: 600,
                        }}
                      >
                        Auto-connect on agent start
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.3)",
                          marginTop: 2,
                        }}
                      >
                        Automatically establish gateway connection
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={autoConnect}
                      onChange={setAutoConnect}
                    />
                  </div>
                </div>
              )}

              {activeTab === "routing" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 300,
                    color: "rgba(255,255,255,0.3)",
                    fontSize: 14,
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                  }}
                >
                  Route configuration coming soon
                </div>
              )}

              {activeTab === "monitor" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <MetricCard
                    label="Success Rate"
                    value={`${(agent.metrics.success_rate_7d * 100).toFixed(0)}%`}
                    color="#4ade80"
                  />
                  <MetricCard
                    label="Avg Cycle"
                    value={`${agent.metrics.avg_cycle_sec_7d.toFixed(1)}s`}
                    color="#60a5fa"
                  />
                  <MetricCard
                    label="Token Cost"
                    value={`$${agent.metrics.token_cost_7d.toFixed(2)}`}
                    color="#f97316"
                  />
                  <MetricCard
                    label="Approval Wait"
                    value={`${agent.metrics.approval_wait_sec_7d.toFixed(1)}s`}
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
            {/* Test */}
            <button
              onClick={() =>
                console.log("[AgentSettings] Test connection", agent.agent_id)
              }
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                transition: "border-color 0.15s",
              }}
            >
              Test
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: "rgba(255,255,255,0.6)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                transition: "border-color 0.15s",
              }}
            >
              Cancel
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              style={{
                padding: "9px 24px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #4ade80, #22c55e)",
                color: "#0a0a0f",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                boxShadow: "0 2px 12px rgba(74,222,128,0.25)",
                transition: "opacity 0.15s",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default memo(AgentSettingsModal);
