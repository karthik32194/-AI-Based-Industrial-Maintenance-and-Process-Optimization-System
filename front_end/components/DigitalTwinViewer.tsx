"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { TrackballControls } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

type DigitalTwinViewerProps = {
  machineName: string;
  machineStatus: string;
  onClose: () => void;
  autoRotate?: boolean;
};

/* =========================================================
   ENHANCED 3D INDUSTRIAL MOTOR MODEL (Point 11)
   Includes:
   - Motor body / Stator core
   - Rotating Rotor & Shaft Assembly
   - DE and NDE Bearing Housings
   - Cooling Fins Array
   - Thermal / Heat Zone Glow
   - Telemetry Sensor Markers (PT-101, VIB-01, ENC-01)
========================================================= */

function MotorModel({
  autoRotate,
  machineStatus,
}: {
  autoRotate: boolean;
  machineStatus: string;
}) {
  const motorRef = useRef<THREE.Group>(null);
  const rotorShaftRef = useRef<THREE.Group>(null);

  const isOperational =
    machineStatus?.toUpperCase() === "OPERATIONAL" ||
    machineStatus?.toUpperCase() === "RUNNING";

  useFrame((_, delta) => {
    if (autoRotate && motorRef.current) {
      motorRef.current.rotation.y += delta * 0.45;
    }
    // Rotate rotor shaft when operational
    if (isOperational && rotorShaftRef.current) {
      rotorShaftRef.current.rotation.x += delta * 5.0;
    }
  });

  return (
    <group ref={motorRef} rotation={[0, 0, 0]} position={[0, 0.2, 0]}>
      {/* =================================================
          1. STATOR / MAIN MOTOR BODY
      ================================================= */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1.65, 1.65, 4.2, 64]} />
        <meshStandardMaterial
          color="#1e1c30"
          metalness={0.88}
          roughness={0.28}
        />
      </mesh>

      {/* Inner Body Shell */}
      <mesh scale={[1.015, 0.97, 1.015]}>
        <cylinderGeometry args={[1.57, 1.57, 3.85, 64]} />
        <meshStandardMaterial
          color="#0d0d1a"
          metalness={0.82}
          roughness={0.35}
        />
      </mesh>

      {/* Thermal Heat Zone Glow (Point 11: Temperature/Heat zones) */}
      <mesh scale={[1.03, 0.8, 1.03]}>
        <cylinderGeometry args={[1.66, 1.66, 3.4, 64]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#7e22ce"
          emissiveIntensity={0.65}
          transparent
          opacity={0.18}
          roughness={0.2}
        />
      </mesh>

      {/* =================================================
          2. COOLING FINS (Point 11: Cooling fins)
      ================================================= */}
      {[
        -1.65, -1.35, -1.05, -0.75, -0.45, -0.15, 0.15, 0.45, 0.75, 1.05,
        1.35, 1.65,
      ].map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.1, 3.2, 3.3]} />
          <meshStandardMaterial
            color="#2a2744"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* =================================================
          3. FRONT & REAR END CAPS
      ================================================= */}
      {/* Front End Cap (Drive End) */}
      <mesh
        position={[2.15, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[1.78, 1.78, 0.3, 64]} />
        <meshStandardMaterial
          color="#383454"
          metalness={0.92}
          roughness={0.22}
        />
      </mesh>

      {/* Back End Cap (Non-Drive End) */}
      <mesh position={[-2.15, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.78, 1.78, 0.3, 64]} />
        <meshStandardMaterial
          color="#383454"
          metalness={0.92}
          roughness={0.22}
        />
      </mesh>

      {/* =================================================
          4. BEARINGS (Point 11: Bearings - DE & NDE)
      ================================================= */}
      {/* Drive End (DE) Bearing Housing */}
      <mesh position={[2.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.9, 0.9, 0.22, 48]} />
        <meshStandardMaterial
          color="#25203A"
          metalness={0.95}
          roughness={0.15}
        />
      </mesh>
      {/* DE Bearing Race Ring */}
      <mesh position={[2.34, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.65, 0.1, 24, 48]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#6b21a8"
          emissiveIntensity={1.2}
          metalness={0.98}
          roughness={0.1}
        />
      </mesh>

      {/* Non-Drive End (NDE) Bearing Housing */}
      <mesh position={[-2.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.9, 0.9, 0.22, 48]} />
        <meshStandardMaterial
          color="#25203A"
          metalness={0.95}
          roughness={0.15}
        />
      </mesh>
      {/* NDE Bearing Race Ring */}
      <mesh position={[-2.34, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.65, 0.1, 24, 48]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#6b21a8"
          emissiveIntensity={1.2}
          metalness={0.98}
          roughness={0.1}
        />
      </mesh>

      {/* =================================================
          5. ROTATING ROTOR & SHAFT (Point 11: Rotor, Shaft, Rotation)
      ================================================= */}
      <group ref={rotorShaftRef}>
        {/* Drive Shaft */}
        <mesh
          position={[2.95, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.28, 0.28, 1.8, 48]} />
          <meshStandardMaterial
            color="#e2e8f0"
            metalness={1.0}
            roughness={0.1}
          />
        </mesh>

        {/* Shaft Keyway Slot */}
        <mesh position={[3.3, 0.28, 0]}>
          <boxGeometry args={[0.6, 0.08, 0.08]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>

        {/* Rotor / Coupling Flange */}
        <mesh position={[3.75, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.85, 0.85, 0.38, 64]} />
          <meshStandardMaterial
            color="#111827"
            metalness={0.95}
            roughness={0.15}
          />
        </mesh>

        {/* Rotor Accent Ring */}
        <mesh position={[3.94, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.64, 0.08, 20, 64]} />
          <meshStandardMaterial
            color="#c084fc"
            emissive="#a855f7"
            emissiveIntensity={1.5}
            metalness={0.9}
            roughness={0.12}
          />
        </mesh>
      </group>

      {/* =================================================
          6. TOP TERMINAL BOX & SENSORS (Point 11: Sensor points)
      ================================================= */}
      <mesh position={[0, 1.9, 0]} castShadow>
        <boxGeometry args={[1.4, 0.7, 1.2]} />
        <meshStandardMaterial
          color="#181628"
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>

      {/* Terminal Lid */}
      <mesh position={[0, 2.28, 0]}>
        <boxGeometry args={[1.1, 0.08, 0.95]} />
        <meshStandardMaterial
          color="#2d2946"
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>

      {/* PT-101 Temperature Sensor Probe */}
      <mesh position={[0, 2.36, 0.35]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial
          color="#c084fc"
          emissive="#a855f7"
          emissiveIntensity={4}
        />
      </mesh>

      {/* VIB-01 Vibration Sensor on DE Bearing */}
      <mesh position={[2.28, 1.05, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.25, 24]} />
        <meshStandardMaterial
          color="#00D49A"
          emissive="#00D49A"
          emissiveIntensity={3}
        />
      </mesh>

      {/* Machine Operational Status Indicator */}
      <mesh position={[0.48, 2.32, 0.45]}>
        <sphereGeometry args={[0.1, 24, 24]} />
        <meshStandardMaterial
          color={isOperational ? "#00D49A" : "#FF3B6B"}
          emissive={isOperational ? "#00D49A" : "#FF3B6B"}
          emissiveIntensity={5}
        />
      </mesh>

      {/* =================================================
          7. MOUNTING BASE & FOOTING
      ================================================= */}
      <mesh position={[0, -1.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.2, 0.35, 3.2]} />
        <meshStandardMaterial
          color="#121120"
          metalness={0.9}
          roughness={0.25}
        />
      </mesh>

      {/* Base Purple Trim Stripe */}
      <mesh position={[0, -1.76, 1.61]}>
        <boxGeometry args={[4.8, 0.05, 0.05]} />
        <meshStandardMaterial
          color="#a855f7"
          emissive="#7e22ce"
          emissiveIntensity={2}
        />
      </mesh>

      {/* Mounting Feet */}
      {[-1.65, 1.65].map((x) => (
        <group key={x}>
          <mesh position={[x, -2.2, 0]} castShadow>
            <boxGeometry args={[0.95, 0.35, 2.4]} />
            <meshStandardMaterial
              color="#383454"
              metalness={0.85}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[x, -2.02, 0.7]}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
            <meshStandardMaterial color="#94a3b8" metalness={1} roughness={0.15} />
          </mesh>
          <mesh position={[x, -2.02, -0.7]}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
            <meshStandardMaterial color="#94a3b8" metalness={1} roughness={0.15} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* =========================================================
   DIGITAL TWIN VIEWER MODAL
========================================================= */

export default function DigitalTwinViewer({
  machineName,
  machineStatus,
  onClose,
}: DigitalTwinViewerProps) {
  const [autoRotate, setAutoRotate] = useState(false);
  const controlsRef = useRef<any>(null);

  function resetView() {
    setAutoRotate(false);
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }

  const isOperational =
    machineStatus?.toUpperCase() === "OPERATIONAL" ||
    machineStatus?.toUpperCase() === "RUNNING";

  return (
    <div className="fixed inset-0 z-[100] bg-[#050511] text-[#F8FAFC]">
      {/* Header Bar */}
      <div className="absolute left-0 right-0 top-0 z-30 border-b border-[#25203A] bg-[#0B0B18]/95 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#A855F7] shadow-[0_0_12px_rgba(168,85,247,0.9)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#A855F7]">
                DIGITAL TWIN TELEMETRY
              </p>
            </div>
            <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
              {machineName}
            </h2>
            <p className="text-xs text-[#8B8BA3]">
              Motor body, rotor shaft, bearing housings, cooling fins & thermal inspection
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#25203A] bg-[#0B0B18] text-[#8B8BA3] transition hover:border-[#FF3B6B]/40 hover:bg-[#FF3B6B]/10 hover:text-[#FF3B6B]"
            aria-label="Close digital twin"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="h-full w-full pt-[82px]">
        <Canvas
          camera={{
            position: [0, 2.8, 10],
            fov: 42,
          }}
          shadows
        >
          <color attach="background" args={["#050511"]} />

          <ambientLight intensity={1.6} />
          <directionalLight position={[7, 10, 8]} intensity={3.2} castShadow />
          <pointLight
            position={[-6, 4, 6]}
            intensity={40}
            distance={20}
            color="#a855f7"
          />
          <pointLight
            position={[5, -2, -5]}
            intensity={25}
            distance={16}
            color="#7e22ce"
          />
          <pointLight
            position={[0, 4, 0]}
            intensity={15}
            distance={10}
            color="#c084fc"
          />

          {/* Ground Platform */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -2.45, 0]}
            receiveShadow
          >
            <planeGeometry args={[40, 40]} />
            <meshStandardMaterial
              color="#070714"
              metalness={0.2}
              roughness={0.85}
            />
          </mesh>

          {/* Hex / Grid Helper */}
          <gridHelper
            args={[40, 40, "#25203A", "#111022"]}
            position={[0, -2.42, 0]}
          />

          {/* Glowing Platform Ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.39, 0]}>
            <ringGeometry args={[3.5, 3.8, 96]} />
            <meshBasicMaterial
              color="#a855f7"
              transparent
              opacity={0.15}
            />
          </mesh>

          <MotorModel
            autoRotate={autoRotate}
            machineStatus={machineStatus}
          />

          <TrackballControls
            ref={controlsRef}
            rotateSpeed={3.5}
            zoomSpeed={1.2}
            panSpeed={0.8}
            staticMoving={false}
            dynamicDampingFactor={0.15}
            noZoom={false}
            noPan={false}
          />
        </Canvas>
      </div>

      {/* Subsystem Inspection Status Pill */}
      <div className="absolute left-6 top-[102px] z-20 rounded-xl border border-[#25203A] bg-[#0B0B18]/90 px-4 py-3 shadow-xl backdrop-blur-xl">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8B8BA3]">
          OPERATIONAL STATE
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isOperational
                ? "bg-[#00D49A] shadow-[0_0_12px_rgba(0,212,154,0.9)]"
                : "bg-[#FF3B6B] shadow-[0_0_12px_rgba(255,59,107,0.9)]"
            }`}
          />
          <span
            className={`text-xs font-bold ${
              isOperational ? "text-[#00D49A]" : "text-[#FF3B6B]"
            }`}
          >
            {machineStatus?.toUpperCase() || "OPERATIONAL"}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute right-6 top-[102px] z-20 flex flex-col gap-2">
        <button
          onClick={() => setAutoRotate((curr) => !curr)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
            autoRotate
              ? "border-[#A855F7] bg-[#A855F7]/15 text-[#C084FC]"
              : "border-[#25203A] bg-[#0B0B18]/90 text-[#8B8BA3] hover:border-[#A855F7]/40 hover:text-[#F8FAFC]"
          }`}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
            <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
          </svg>
          <span>{autoRotate ? "Auto Rotate ON" : "Auto Rotate"}</span>
        </button>

        <button
          onClick={resetView}
          className="flex items-center gap-2 rounded-xl border border-[#25203A] bg-[#0B0B18]/90 px-4 py-2.5 text-xs font-semibold text-[#8B8BA3] transition hover:border-[#A855F7]/40 hover:text-[#F8FAFC]"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v6h6" />
          </svg>
          <span>Reset Camera</span>
        </button>
      </div>

      {/* Bottom Hint Legend */}
      <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
        <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-[#25203A] bg-[#0B0B18]/95 px-5 py-2.5 text-[11px] text-[#8B8BA3] shadow-xl backdrop-blur-xl">
          <span>
            🖱️ <strong className="text-[#F8FAFC]">Left Click + Drag</strong> to Orbit
          </span>
          <span className="text-[#25203A]">•</span>
          <span>
            🖱️ <strong className="text-[#F8FAFC]">Scroll</strong> to Zoom
          </span>
          <span className="text-[#25203A]">•</span>
          <span>
            🖱️ <strong className="text-[#F8FAFC]">Right Click + Drag</strong> to Pan
          </span>
          <span className="text-[#25203A]">•</span>
          <span className="font-bold text-[#A855F7]">
            3D DIGITAL TWIN
          </span>
        </div>
      </div>
    </div>
  );
}