"use client";

import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useEffect, useRef, useMemo, type ReactNode, type MutableRefObject } from "react";
import * as THREE from "three";
import type { Camera } from "three";

// ────────────────────────────────────────────
// IsometricCanvas — Enhanced main R3F wrapper
// - Post-processing: Bloom + Vignette
// - PCFSoftShadowMap for better shadows
// - Fading ground grid (opacity decreases with distance from center)
// - Ambient particle sparkles
// - Supports "iso" (isometric 3D) and "top" (top-down 2D) view modes
// ────────────────────────────────────────────

export type ViewMode = "iso" | "top";

interface IsometricCanvasProps {
  children?: ReactNode;
  containerRef?: MutableRefObject<HTMLDivElement | null>;
  cameraRef?: MutableRefObject<Camera | null>;
  viewMode?: ViewMode;
}

function CameraCapture({ cameraRef }: { cameraRef?: MutableRefObject<Camera | null> }) {
  const { camera } = useThree();
  useEffect(() => {
    if (cameraRef) cameraRef.current = camera;
  }, [camera, cameraRef]);
  return null;
}

// ── Camera position animator for view mode transitions ──
// Only animates when the view mode actually changes (iso ↔ top).
// During normal operation OrbitControls has sole control of the camera.

const ISO_POS = new THREE.Vector3(36, 36, 36);
const TOP_POS = new THREE.Vector3(0, 60, 0.001);
const ISO_ZOOM = 11;
const TOP_ZOOM = 12;

function CameraController({ viewMode }: { viewMode: ViewMode }) {
  const { camera } = useThree();
  const prevMode = useRef<ViewMode>(viewMode);
  const targetPos = useRef(new THREE.Vector3().copy(viewMode === "top" ? TOP_POS : ISO_POS));
  const targetZoom = useRef(viewMode === "top" ? TOP_ZOOM : ISO_ZOOM);
  const transitioning = useRef(false);

  useEffect(() => {
    // Only start a transition when the mode actually changes —
    // never on initial mount (camera already starts at the right position).
    if (prevMode.current === viewMode) return;
    prevMode.current = viewMode;

    if (viewMode === "top") {
      targetPos.current.copy(TOP_POS);
      targetZoom.current = TOP_ZOOM;
    } else {
      targetPos.current.copy(ISO_POS);
      targetZoom.current = ISO_ZOOM;
    }
    transitioning.current = true;
  }, [viewMode]);

  useFrame(() => {
    if (!transitioning.current) return;

    camera.position.lerp(targetPos.current, 0.08);

    const ortho = camera as THREE.OrthographicCamera;
    ortho.zoom += (targetZoom.current - ortho.zoom) * 0.08;
    ortho.updateProjectionMatrix();

    const posDist = camera.position.distanceTo(targetPos.current);
    const zoomDiff = Math.abs(ortho.zoom - targetZoom.current);
    if (posDist < 0.05 && zoomDiff < 0.15) {
      camera.position.copy(targetPos.current);
      ortho.zoom = targetZoom.current;
      ortho.updateProjectionMatrix();
      transitioning.current = false;
    }
  });

  return null;
}

/** Very subtle ground dot-grid — just enough for spatial reference */
function FadingGrid() {
  const geometry = useMemo(() => {
    const size = 50;
    const step = 5;
    const vertices: number[] = [];
    const colorArr: number[] = [];
    const c = new THREE.Color("#14142a");

    for (let x = -size; x <= size; x += step) {
      for (let z = -size; z <= size; z += step) {
        const d = Math.sqrt(x * x + z * z) / size;
        const a = Math.max(0, 1 - d * 1.4);
        // Tiny cross at each intersection (2px visual)
        const s = 0.08;
        vertices.push(x - s, 0, z, x + s, 0, z);
        vertices.push(x, 0, z - s, x, 0, z + s);
        for (let k = 0; k < 4; k++) {
          colorArr.push(c.r * a, c.g * a, c.b * a);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colorArr, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry} position={[0, -0.008, 0]}>
      <lineBasicMaterial vertexColors transparent opacity={0.3} depthWrite={false} />
    </lineSegments>
  );
}

// ── OrbitControls wrapper with RTS-standard mouse mapping ──
// LEFT: disabled (free for click-select + box-select)
// MIDDLE: ROTATE
// RIGHT: disabled (free for move command)
// Alt+LEFT: ROTATE fallback (trackpad / no-middle-button users)

// Stable constants — avoids creating new references on every render
const ORBIT_TARGET: [number, number, number] = [0, 0, 0];
const MAX_POLAR = Math.PI / 2.2;

function SceneControls({ viewMode }: { viewMode: ViewMode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const isTop = viewMode === "top";

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Remap mouse buttons: disable LEFT & RIGHT, MIDDLE = ROTATE
    controls.mouseButtons = {
      LEFT: -1,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: -1,
    };

    // Alt key toggle: hold Alt to enable left-button rotation
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && controls.mouseButtons) {
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey && controls.mouseButtons) {
        controls.mouseButtons.LEFT = -1;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      target={ORBIT_TARGET}
      enableRotate={!isTop}
      enableZoom
      enableDamping={false}
      zoomSpeed={0.8}
      enablePan={false}
      minZoom={5}
      maxZoom={80}
      minPolarAngle={isTop ? 0 : 0.1}
      maxPolarAngle={isTop ? Math.PI : MAX_POLAR}
      makeDefault
    />
  );
}

function IsometricCanvas({ children, containerRef, cameraRef, viewMode = "iso" }: IsometricCanvasProps) {
  const isTop = viewMode === "top";

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100vh", background: "#0a0a12" }}
    >
      <Canvas
        orthographic
        camera={{
          position: [36, 36, 36],
          zoom: 11,
          near: 0.1,
          far: 1000,
        }}
        shadows="soft"
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          shadowMapType: THREE.PCFSoftShadowMap,
        }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, 0, 0);
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#0a0a12"]} />

        {/* Ambient light — boost in top-down for flat icons */}
        <ambientLight intensity={isTop ? 0.9 : 0.6} color="#b0b0dd" />

        {/* Main key light — warm purple tint */}
        <directionalLight
          position={[-8, 14, 4]}
          intensity={0.9}
          color="#c4b5fd"
          castShadow
          shadow-mapSize-width={4096}
          shadow-mapSize-height={4096}
          shadow-camera-far={120}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
        />

        {/* Fill light — cool blue from opposite */}
        <directionalLight position={[6, 10, -6]} intensity={0.4} color="#60a5fa" />

        {/* Rim light — subtle warm from below-ish */}
        <directionalLight position={[0, 4, 12]} intensity={0.15} color="#f5a623" />

        {/* Fading ground grid */}
        <FadingGrid />

        {/* Ambient floating particles — hidden in top-down (would block view) */}
        {!isTop && (
          <Sparkles
            count={60}
            size={1.2}
            scale={[36, 6, 30]}
            position={[0, 3, 0]}
            speed={0.2}
            opacity={0.15}
            color="#8b8baa"
          />
        )}

        <SceneControls viewMode={viewMode} />

        <CameraController viewMode={viewMode} />
        <CameraCapture cameraRef={cameraRef} />

        {children}

        {/* Post-processing effects */}
        <EffectComposer>
          <Bloom
            luminanceThreshold={1}
            luminanceSmoothing={0.3}
            intensity={1.5}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.25} darkness={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

export default IsometricCanvas;
