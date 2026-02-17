"use client";

import React, { memo, useMemo, useRef, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { ZONES, ZONE_SIZE, MAP_BOUNDS } from "@/lib/zone-config";
import ZoneGroupOverlay from "./ZoneGroupOverlay";
import { useAllCollabSessions } from "@/hooks/useSwarmStore";

// ────────────────────────────────────────────
// ZoneGrid — Clean sci-fi wireframe zone tiles
// Zones defined by edge outlines on dark ground.
// No fill patches, no inner grids — premium & clean.
// ────────────────────────────────────────────

// ── Visual Tokens ──

const VT = {
  // Active zone — visible wireframe
  activeEdgeBase: 0.3,
  activeEdgePerTask: 0.08,
  activeEdgeMax: 0.55,
  activeGlowIdle: 0.06,
  activeLabelOpacity: 0.85,

  // Inactive zone — subtle wireframe
  inactiveEdge: 0.1,
  inactiveGlow: 0.03,
  inactiveLabelOpacity: 0.55,

  // Desaturation
  desatAmount: 0.3,
  desatLightness: 0.75,
} as const;

export interface ZoneData {
  id: string;
  label: string;
  position: [number, number, number];
  color: string;
  activeTaskCount: number;
  role?: string;
}

const DEFAULT_ZONES: ZoneData[] = ZONES.map((z) => ({
  id: z.id,
  label: z.label,
  position: z.position,
  color: z.color,
  activeTaskCount: 0,
  role: z.role,
}));

interface ZoneGridProps {
  zones?: ZoneData[];
  hasSelectedAgent?: boolean;
  onZoneContextMenu?: (zoneId: string) => void;
  activeZoneIds?: string[];
}

// ── Geometry builders ──

const CORNER_RADIUS = 0.25;
const CORNER_SEGMENTS = 6;

/** Invisible fill shape — used only for pointer hit-detection */
function useHitGeometry() {
  return useMemo(() => {
    const hw = ZONE_SIZE / 2;
    const hh = ZONE_SIZE / 2;
    const r = CORNER_RADIUS;
    const shape = new THREE.Shape();

    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
    shape.lineTo(hw, hh - r);
    shape.quadraticCurveTo(hw, hh, hw - r, hh);
    shape.lineTo(-hw + r, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
    shape.lineTo(-hw, -hh + r);
    shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

    const geo = new THREE.ShapeGeometry(shape, CORNER_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.005, 0);
    return geo;
  }, []);
}

function useRectEdges() {
  return useMemo(() => {
    const hw = ZONE_SIZE / 2;
    const hh = ZONE_SIZE / 2;
    const r = CORNER_RADIUS;
    const y = 0.02;
    const segs = CORNER_SEGMENTS;
    const points: THREE.Vector3[] = [];

    function arc(cx: number, cz: number, startAngle: number) {
      for (let i = 0; i <= segs; i++) {
        const a = startAngle + (Math.PI / 2) * (i / segs);
        points.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
      }
    }

    arc(-hw + r, -hh + r, Math.PI);
    arc(hw - r, -hh + r, -Math.PI / 2);
    arc(hw - r, hh - r, 0);
    arc(-hw + r, hh - r, Math.PI / 2);
    points.push(points[0].clone());

    const arr = new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    return geo;
  }, []);
}

// ── Desaturate helper ──

const _tmpColor = new THREE.Color();

function desaturate(hex: string, amount: number): string {
  _tmpColor.set(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  _tmpColor.getHSL(hsl);
  hsl.s *= 1 - amount;
  hsl.l *= VT.desatLightness;
  _tmpColor.setHSL(hsl.h, hsl.s, hsl.l);
  return `#${_tmpColor.getHexString()}`;
}

// ── Ground plane ──

function GroundFloor() {
  return useMemo(() => {
    return (
      <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_BOUNDS.width + 8, MAP_BOUNDS.height + 8]} />
        <meshStandardMaterial color="#08080f" roughness={0.95} metalness={0} />
      </mesh>
    );
  }, []);
}

// ── Flat text rotation ──
const FLAT_ROT: [number, number, number] = [-Math.PI / 2, 0, 0];

// ── Zone Tile ──

interface ZoneTileProps {
  zone: ZoneData;
  hitGeo: THREE.ShapeGeometry;
  edgeGeo: THREE.BufferGeometry;
  hasSelectedAgent: boolean;
  active: boolean;
  onContextMenu?: (zoneId: string) => void;
  /** Number of members in active collaboration session */
  collabMemberCount: number;
  /** Name of the collaboration lead agent */
  collabLeadName?: string;
}

const ZoneTile = memo(function ZoneTile({
  zone,
  hitGeo,
  edgeGeo,
  hasSelectedAgent,
  active,
  onContextMenu,
  collabMemberCount,
  collabLeadName,
}: ZoneTileProps) {
  const { position, color, label, activeTaskCount, id, role } = zone;
  const glowMatRef = useRef<THREE.LineBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const dimColor = useMemo(() => desaturate(color, VT.desatAmount), [color]);
  const displayColor = active ? color : dimColor;

  const edgeOpacity = active
    ? VT.activeEdgeBase + Math.min(activeTaskCount * VT.activeEdgePerTask, VT.activeEdgeMax - VT.activeEdgeBase)
    : VT.inactiveEdge;

  useFrame(({ clock }) => {
    if (glowMatRef.current) {
      if (!active) {
        glowMatRef.current.opacity = VT.inactiveGlow;
        return;
      }
      if (hovered && hasSelectedAgent) {
        glowMatRef.current.opacity = 0.25 + Math.sin(clock.getElapsedTime() * 4) * 0.1;
      } else if (activeTaskCount > 0) {
        const pulse = 0.08 + Math.sin(clock.getElapsedTime() * 2 + position[0]) * 0.04;
        glowMatRef.current.opacity = pulse;
      } else {
        glowMatRef.current.opacity = VT.activeGlowIdle;
      }
    }
  });

  const handleContextMenu = useCallback(
    (e: { stopPropagation: () => void; nativeEvent?: { preventDefault?: () => void } }) => {
      e.stopPropagation();
      e.nativeEvent?.preventDefault?.();
      onContextMenu?.(id);
    },
    [id, onContextMenu],
  );

  const handlePointerOver = useCallback(() => {
    if (hasSelectedAgent) {
      setHovered(true);
      document.body.style.cursor = "pointer";
    }
  }, [hasSelectedAgent]);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  // Hover fill — only visible when agent is selected and hovering the zone
  const hoverFillOpacity = hovered && hasSelectedAgent && active ? 0.06 : 0;

  return (
    <group position={position}>
      {/* Invisible hit surface for pointer events */}
      <mesh
        geometry={hitGeo}
        receiveShadow
        onContextMenu={handleContextMenu}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <meshBasicMaterial
          color={displayColor}
          transparent
          opacity={hoverFillOpacity}
          side={THREE.FrontSide}
          depthWrite={false}
        />
      </mesh>

      {/* Edge outline — primary visual */}
      <lineLoop geometry={edgeGeo}>
        <lineBasicMaterial
          color={displayColor}
          transparent
          opacity={hovered && hasSelectedAgent && active ? 0.6 : edgeOpacity}
          linewidth={1}
        />
      </lineLoop>

      {/* Soft glow edge underneath */}
      <lineLoop geometry={edgeGeo} position={[0, -0.005, 0]}>
        <lineBasicMaterial
          ref={glowMatRef}
          color={displayColor}
          transparent
          opacity={active ? VT.activeGlowIdle : VT.inactiveGlow}
          linewidth={2}
          depthWrite={false}
        />
      </lineLoop>

      {/* Zone name */}
      <Text
        position={[0, 0.12, role ? -0.15 : 0]}
        rotation={FLAT_ROT}
        fontSize={active ? 0.42 : 0.38}
        color={displayColor}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#08080f"
        fillOpacity={active ? VT.activeLabelOpacity : VT.inactiveLabelOpacity}
        maxWidth={ZONE_SIZE * 0.85}
        textAlign="center"
      >
        {label}
      </Text>

      {/* Role sublabel */}
      {role && (
        <Text
          position={[0, 0.11, 0.45]}
          rotation={FLAT_ROT}
          fontSize={0.22}
          color={displayColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#08080f"
          fillOpacity={active ? 0.45 : 0.3}
          maxWidth={ZONE_SIZE * 0.85}
          textAlign="center"
        >
          {role}
        </Text>
      )}

      {/* Lock icon on inactive tiles */}
      {!active && (
        <Html
          position={[ZONE_SIZE / 2 - 0.4, 0.1, -ZONE_SIZE / 2 + 0.4]}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div style={{
            fontSize: 10, opacity: 0.3,
            background: "rgba(8,8,15,0.5)", borderRadius: 3, padding: "1px 3px",
            color: "rgba(255,255,255,0.45)",
            userSelect: "none",
          }}>
            🔒
          </div>
        </Html>
      )}

      {/* Collaboration indicator */}
      {active && collabMemberCount > 0 && (
        <Html
          position={[-ZONE_SIZE / 2 + 0.5, 0.1, -ZONE_SIZE / 2 + 0.4]}
          center
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: "rgba(167, 139, 250, 0.2)",
            borderRadius: 4,
            padding: "1px 5px",
            border: "1px solid rgba(167, 139, 250, 0.3)",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 8, color: "#a78bfa", fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>
              {collabMemberCount}
            </span>
            <span style={{ fontSize: 7, color: "rgba(167, 139, 250, 0.7)", fontFamily: "'SF Mono', monospace" }}>
              collab
            </span>
            {collabLeadName && (
              <span style={{ fontSize: 7, color: "rgba(250, 204, 21, 0.7)", fontFamily: "'SF Mono', monospace" }}>
                {collabLeadName}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
});

// ── Main Grid Component ──

const ZoneGrid = memo(function ZoneGrid({ zones, hasSelectedAgent, onZoneContextMenu, activeZoneIds }: ZoneGridProps) {
  const resolvedZones = zones ?? DEFAULT_ZONES;
  const hitGeo = useHitGeometry();
  const edgeGeo = useRectEdges();
  const collabSessions = useAllCollabSessions();

  const activeSet = useMemo(
    () => activeZoneIds ? new Set(activeZoneIds) : null,
    [activeZoneIds],
  );

  // Build zone -> collab info lookup
  const collabByZone = useMemo(() => {
    const map = new Map<string, { memberCount: number; leadName?: string }>();
    for (const session of collabSessions) {
      const activeMembers = session.members.filter((m) => m.join_status === "ACTIVE");
      const lead = session.members.find((m) => m.role === "LEAD");
      if (activeMembers.length > 0) {
        map.set(session.zone_id, {
          memberCount: activeMembers.length,
          leadName: lead?.agent_name,
        });
      }
    }
    return map;
  }, [collabSessions]);

  return (
    <group>
      <GroundFloor />
      <ZoneGroupOverlay />
      {resolvedZones.map((zone) => {
        const collabInfo = collabByZone.get(zone.id);
        return (
          <ZoneTile
            key={zone.id}
            zone={zone}
            hitGeo={hitGeo}
            edgeGeo={edgeGeo}
            hasSelectedAgent={hasSelectedAgent ?? false}
            active={activeSet ? activeSet.has(zone.id) : true}
            onContextMenu={onZoneContextMenu}
            collabMemberCount={collabInfo?.memberCount ?? 0}
            collabLeadName={collabInfo?.leadName}
          />
        );
      })}
    </group>
  );
});

export default ZoneGrid;
