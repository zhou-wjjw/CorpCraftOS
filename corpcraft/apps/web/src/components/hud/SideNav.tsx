"use client";

import { memo, useState, useCallback, type CSSProperties } from "react";

// ────────────────────────────────────────────
// SideNav — left-side vertical icon navigation bar
// Fixed on the viewport, glassmorphism container, emoji icons.
// ────────────────────────────────────────────

interface SideNavProps {
  onOpenRecruit: () => void;
  onOpenSettings: () => void;
  onOpenModelLibrary?: () => void;
  onOpenAgents?: () => void;
  onOpenTaskHistory?: () => void;
}

interface NavButton {
  icon: string;
  label: string;
  action?: () => void;
}

const containerStyle: CSSProperties = {
  position: "fixed",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 50,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  background: "rgba(10, 10, 15, 0.7)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: 14,
  padding: 8,
};

const btnBase: CSSProperties = {
  width: 48,
  height: 36,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: "0.04em",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  transition: "background 0.2s ease",
  color: "rgba(255, 255, 255, 0.6)",
  padding: 0,
  fontFamily: "system-ui, -apple-system, sans-serif",
};

function NavIconButton({
  icon,
  label,
  action,
}: {
  icon: string;
  label: string;
  action?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const onEnter = useCallback(() => setHovered(true), []);
  const onLeave = useCallback(() => setHovered(false), []);

  return (
    <button
      type="button"
      title={label}
      onClick={action}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        ...btnBase,
        background: hovered
          ? "rgba(255, 255, 255, 0.08)"
          : "transparent",
      }}
    >
      {icon}
    </button>
  );
}

function SideNav({ onOpenRecruit, onOpenSettings, onOpenModelLibrary, onOpenAgents, onOpenTaskHistory }: SideNavProps) {
  const buttons: NavButton[] = [
    { icon: "主页", label: "Home" },
    { icon: "招募", label: "Recruit", action: onOpenRecruit },
    { icon: "模型", label: "Models", action: onOpenModelLibrary },
    { icon: "智体", label: "Agents", action: onOpenAgents },
    { icon: "记录", label: "History", action: onOpenTaskHistory },
    { icon: "设置", label: "Settings", action: onOpenSettings },
    { icon: "帮助", label: "Help" },
  ];

  return (
    <nav style={containerStyle}>
      {buttons.map((btn) => (
        <NavIconButton
          key={btn.label}
          icon={btn.icon}
          label={btn.label}
          action={btn.action}
        />
      ))}
    </nav>
  );
}

export default memo(SideNav);
