"use client";

import { useMemo } from "react";
import type { ResourceBar } from "@corpcraft/contracts";
import { useSwarmStore } from "@/hooks/useSwarmStore";

// ──────────────────────────────────────────────
// HudOverlay — HP / MP / AP resource bars
// + Fullscreen alerts: HP critical red, AP overload amber
// ──────────────────────────────────────────────

interface BarConfig {
  label: string;
  key: "hp" | "mp" | "ap";
  colorFrom: string;
  colorTo: string;
  unit: string;
}

const BARS: BarConfig[] = [
  { label: "HP", key: "hp", colorFrom: "#dc2626", colorTo: "#f87171", unit: "¥" },
  { label: "MP", key: "mp", colorFrom: "#2563eb", colorTo: "#60a5fa", unit: "tok" },
  { label: "AP", key: "ap", colorFrom: "#16a34a", colorTo: "#4ade80", unit: "pts" },
];

function formatRate(rate: number): string {
  if (rate === 0) return "";
  const sign = rate > 0 ? "+" : "";
  return ` (${sign}${rate}/h)`;
}

function ResourceBarRow({ bar, data }: { bar: BarConfig; data: ResourceBar }) {
  const pct = data.max > 0 ? (data.current / data.max) * 100 : 0;
  const isLow = pct < 20;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 3,
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 11,
          letterSpacing: "0.05em",
        }}
      >
        <span style={{ color: bar.colorTo, fontWeight: 700 }}>{bar.label}</span>
        <span style={{ color: "rgba(255,255,255,0.7)" }}>
          {data.current.toLocaleString()} / {data.max.toLocaleString()} {bar.unit}
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
            {formatRate(data.rate)}
          </span>
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 10,
          borderRadius: 5,
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${Math.min(pct, 100)}%`,
            borderRadius: 5,
            background: `linear-gradient(90deg, ${bar.colorFrom}, ${bar.colorTo})`,
            transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            boxShadow: isLow
              ? `0 0 12px ${bar.colorTo}88, 0 0 24px ${bar.colorTo}44`
              : `0 0 6px ${bar.colorTo}44`,
            animation: isLow ? "hudPulse 1.2s ease-in-out infinite" : "none",
          }}
        />
      </div>
    </div>
  );
}

export default function HudOverlay() {
  const hud = useSwarmStore((s) => s.hud);

  const barData = useMemo(
    () => BARS.map((bar) => ({ bar, data: hud[bar.key] })),
    [hud],
  );

  // Critical state checks
  const hpRatio = hud.hp.max > 0 ? hud.hp.current / hud.hp.max : 1;
  const apRatio = hud.ap.max > 0 ? hud.ap.current / hud.ap.max : 1;
  const isHpCritical = hpRatio < 0.2;
  // AP overload only when current exceeds max (system genuinely overloaded)
  const isApOverload = hud.ap.current > hud.ap.max;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {/* ── Fullscreen HP Critical Red Overlay ── */}
      {isHpCritical && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at center, transparent 40%, rgba(220, 38, 38, 0.15) 100%)",
            animation: "hpCriticalPulse 1.8s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* ── Fullscreen AP Overload Amber Border ── */}
      {isApOverload && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "inset 0 0 60px rgba(251, 191, 36, 0.2), inset 0 0 120px rgba(251, 191, 36, 0.1)",
            animation: "apOverloadPulse 2.5s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Resource bars — top-left */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          width: 280,
          padding: 16,
          background: "rgba(10, 10, 15, 0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          pointerEvents: "auto",
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 10,
            fontFamily: "'SF Mono', 'Fira Code', monospace",
          }}
        >
          Resources
          {isHpCritical && (
            <span style={{ color: "#f87171", marginLeft: 8, animation: "hudPulse 1s ease-in-out infinite" }}>
              CRITICAL
            </span>
          )}
          {isApOverload && (
            <span style={{ color: "#fbbf24", marginLeft: 8 }}>OVERLOAD</span>
          )}
        </div>
        {barData.map(({ bar, data }) => (
          <ResourceBarRow key={bar.key} bar={bar} data={data} />
        ))}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes hudPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes hpCriticalPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes apOverloadPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
