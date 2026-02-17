"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { Text, Billboard, useCursor } from "@react-three/drei";
import * as THREE from "three";
import {
  ZONE_SIZE,
  ZONE_GAP,
  type ZoneFunctionGroup,
} from "@/lib/zone-config";
import { useSwarmStore } from "@/hooks/useSwarmStore";

// ────────────────────────────────────────────
// ZoneGroupOverlay — Cell-edge-tracing boundaries + Billboard labels
// Labels float upright above each territory (always face camera).
// ────────────────────────────────────────────

const BOUNDARY_PAD = 0.3;
const CORNER_R = 0.35;
const CORNER_SEGS = 6;
const LINE_Y = 0.025;
const LABEL_Y = 1.4;

const STRIDE = ZONE_SIZE + ZONE_GAP;

// ── Virtual grid center (must match zone-config.ts) ──
const GRID_CENTER_COL = 5.5;
const GRID_CENTER_ROW = 4.5;

/** Convert a cell (col, row) to world-space center */
function cellToWorld(col: number, row: number): [number, number] {
  return [
    (col - GRID_CENTER_COL) * STRIDE,
    (row - GRID_CENTER_ROW) * STRIDE,
  ];
}

// ── Cell-edge tracing algorithm ──

type Edge = [number, number, number, number]; // x1, z1, x2, z2

/**
 * Trace the outer boundary edges of a set of cells.
 * Returns one or more closed polylines (supports disconnected groups).
 */
function traceGroupBoundary(cells: [number, number][]): THREE.Vector3[][] {
  const cellSet = new Set(cells.map(([c, r]) => `${c},${r}`));
  const half = ZONE_SIZE / 2 + BOUNDARY_PAD;

  const edges: Edge[] = [];
  const dirs: [number, number, "h" | "v"][] = [
    [0, -1, "h"],
    [0, 1, "h"],
    [-1, 0, "v"],
    [1, 0, "v"],
  ];

  for (const [col, row] of cells) {
    const [cx, cz] = cellToWorld(col, row);

    for (const [dc, dr, orient] of dirs) {
      const nKey = `${col + dc},${row + dr}`;
      if (cellSet.has(nKey)) continue;

      if (orient === "h") {
        const z = dr === -1 ? cz - half : cz + half;
        edges.push([cx - half, z, cx + half, z]);
      } else {
        const x = dc === -1 ? cx - half : cx + half;
        edges.push([x, cz - half, x, cz + half]);
      }
    }
  }

  if (edges.length === 0) return [];
  return chainEdges(edges);
}

/** Chain a bag of edges into closed polylines */
function chainEdges(edges: Edge[]): THREE.Vector3[][] {
  const ptKey = (x: number, z: number) =>
    `${Math.round(x * 1000)},${Math.round(z * 1000)}`;

  const adj = new Map<string, number[]>();
  const addAdj = (x: number, z: number, idx: number) => {
    const k = ptKey(x, z);
    const arr = adj.get(k);
    if (arr) arr.push(idx);
    else adj.set(k, [idx]);
  };

  for (let i = 0; i < edges.length; i++) {
    const [x1, z1, x2, z2] = edges[i];
    addAdj(x1, z1, i);
    addAdj(x2, z2, i);
  }

  const used = new Set<number>();
  const contours: THREE.Vector3[][] = [];

  for (let startIdx = 0; startIdx < edges.length; startIdx++) {
    if (used.has(startIdx)) continue;

    const pts: THREE.Vector3[] = [];
    let current = startIdx;
    let [, ] = [edges[current][0], edges[current][1]];
    let [px, pz] = [edges[current][0], edges[current][1]];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      used.add(current);
      const [x1, z1, x2, z2] = edges[current];

      let nx: number, nz: number;
      const k1 = ptKey(x1, z1);
      if (ptKey(px, pz) === k1) {
        pts.push(new THREE.Vector3(x1, LINE_Y, z1));
        nx = x2; nz = z2;
      } else {
        pts.push(new THREE.Vector3(x2, LINE_Y, z2));
        nx = x1; nz = z1;
      }

      const nk = ptKey(nx, nz);
      const candidates = adj.get(nk);
      let next = -1;
      if (candidates) {
        for (const c of candidates) {
          if (!used.has(c)) { next = c; break; }
        }
      }

      if (next === -1) {
        pts.push(new THREE.Vector3(nx, LINE_Y, nz));
        break;
      }

      px = nx; pz = nz;
      current = next;
    }

    if (pts.length >= 3) {
      pts.push(pts[0].clone());
      contours.push(pts);
    }
  }

  return contours;
}

/** Smooth convex corners with small arcs */
function smoothContour(pts: THREE.Vector3[]): THREE.Vector3[] {
  if (pts.length < 4) return pts;
  const r = CORNER_R;
  const n = CORNER_SEGS;
  const result: THREE.Vector3[] = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const prev = pts[(i - 1 + pts.length - 1) % (pts.length - 1)];
    const curr = pts[i];
    const next = pts[(i + 1) % (pts.length - 1)];

    const dx1 = prev.x - curr.x;
    const dz1 = prev.z - curr.z;
    const dx2 = next.x - curr.x;
    const dz2 = next.z - curr.z;

    const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1);
    const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);

    if (len1 < 0.01 || len2 < 0.01) {
      result.push(curr.clone());
      continue;
    }

    const maxR = Math.min(r, len1 / 3, len2 / 3);
    if (maxR < 0.05) {
      result.push(curr.clone());
      continue;
    }

    const sx = curr.x + (dx1 / len1) * maxR;
    const sz = curr.z + (dz1 / len1) * maxR;
    const ex = curr.x + (dx2 / len2) * maxR;
    const ez = curr.z + (dz2 / len2) * maxR;

    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const x = sx + (ex - sx) * t;
      const z = sz + (ez - sz) * t;
      result.push(new THREE.Vector3(x, LINE_Y, z));
    }
  }

  if (result.length > 0) result.push(result[0].clone());
  return result;
}

// ── Single group boundary ──

function GroupBoundary({ group }: { group: ZoneFunctionGroup }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const openGroupEditor = useSwarmStore((s) => s.openGroupEditor);

  const handleClick = useCallback((e: THREE.Event) => {
    (e as unknown as { stopPropagation: () => void }).stopPropagation();
    openGroupEditor(group.id);
  }, [group.id, openGroupEditor]);

  const { contours, labelAnchor, connectorBase } = useMemo(() => {
    const rawContours = traceGroupBoundary(group.cells);
    const smoothed = rawContours.map(smoothContour);

    let minX = Infinity, maxX = -Infinity, minZ = Infinity;
    for (const [col, row] of group.cells) {
      const [wx, wz] = cellToWorld(col, row);
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz);
    }

    const topEdgeZ = minZ - ZONE_SIZE / 2 - BOUNDARY_PAD - 0.15;
    const centerX = (minX + maxX) / 2;

    return {
      contours: smoothed,
      labelAnchor: [centerX, LABEL_Y, topEdgeZ] as [number, number, number],
      connectorBase: [centerX, topEdgeZ] as [number, number],
    };
  }, [group.cells]);

  const lineObjects = useMemo(() => {
    return contours.map((pts) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineDashedMaterial({
        color: group.accentColor,
        dashSize: 0.3,
        gapSize: 0.4,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      });
      const obj = new THREE.Line(geo, mat);
      obj.computeLineDistances();
      return obj;
    });
  }, [contours, group.accentColor]);

  const connectorObj = useMemo(() => {
    const [cx, cz] = connectorBase;
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      cx, LINE_Y, cz,
      cx, LABEL_Y - 0.3, cz,
    ]);
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: group.accentColor,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    return new THREE.Line(geo, mat);
  }, [connectorBase, group.accentColor]);

  const labelScale = hovered ? 1.12 : 1;

  return (
    <group>
      {lineObjects.map((obj, i) => (
        <primitive key={`line-${i}`} object={obj} />
      ))}

      <primitive object={connectorObj} />

      {/* Interactive label plaque */}
      <Billboard position={labelAnchor}>
        <group
          scale={[labelScale, labelScale, 1]}
          onClick={handleClick}
          onPointerOver={(e) => { (e as unknown as { stopPropagation: () => void }).stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
        >
          {/* Invisible hit-area mesh behind the text */}
          <mesh>
            <planeGeometry args={[group.label.length * 0.42 + 0.6, 0.7]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* Subtle background plaque on hover */}
          {hovered && (
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[group.label.length * 0.42 + 0.6, 0.7]} />
              <meshBasicMaterial
                color={group.accentColor}
                transparent
                opacity={0.12}
                depthWrite={false}
              />
            </mesh>
          )}
          <Text
            fontSize={0.5}
            color={group.accentColor}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.045}
            outlineColor="#08080f"
            fillOpacity={hovered ? 1 : 0.75}
            letterSpacing={0.06}
          >
            {group.label}
          </Text>
        </group>
      </Billboard>
    </group>
  );
}

// ── Main overlay ──

const ZoneGroupOverlay = memo(function ZoneGroupOverlay() {
  const groupRegistry = useSwarmStore((s) => s.groupRegistry);
  return (
    <group>
      {groupRegistry.map((g) => (
        <GroupBoundary key={g.id} group={g} />
      ))}
    </group>
  );
});

export default ZoneGroupOverlay;
