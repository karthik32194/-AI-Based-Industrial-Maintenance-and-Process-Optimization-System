"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

const DigitalTwinViewer = dynamic(
  () => import("@/components/DigitalTwinViewer"),
  {
    ssr: false,
  }
);

const API_URL = "http://localhost:8000";

/* =========================================================
   TYPES
========================================================= */

type Machine = {
  id: string;
  machine_name: string;
  machine_type: string;
  manufacturer?: string;
  model_number?: string;
  location: string;
  status: string;
};

type Prediction = {
  id?: string;
  machine_id?: string;
  created_at?: string;

  failure_probability: number;
  predicted_failure: string | boolean | null;
  risk_level: string;
  health_status: string;
  health_score: number | null;

  anomaly_detected: boolean;

  // 15 industrial sensor inputs
  input_temperature?: number | null;
  input_vibration?: number | null;
  input_pressure?: number | null;
  input_humidity?: number | null;
  input_rotation_speed?: number | null;
  input_voltage?: number | null;
  input_current?: number | null;
  input_oil_level?: number | null;
  input_load?: number | null;
  input_motor_temperature?: number | null;
  input_gearbox_temperature?: number | null;
  input_sound_level?: number | null;
  input_fan_speed?: number | null;
  input_reactive_power?: number | null;
  input_active_power?: number | null;

  // Legacy aliases supported by backend
  input_rpm?: number | null;
  input_power_consumption?: number | null;
};

type SensorType =
  | "temperature"
  | "vibration"
  | "pressure"
  | "humidity"
  | "rotation_speed"
  | "voltage"
  | "current"
  | "oil_level"
  | "load"
  | "motor_temperature"
  | "gearbox_temperature"
  | "sound_level"
  | "fan_speed"
  | "reactive_power"
  | "active_power";

interface SensorMetadata {
  id: SensorType;
  name: string;
  fullName: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  criticalMin: number;
  criticalMax: number;
  rangeDisplay: string;
  tag: string;
  getValue: (p: Prediction) => number | null;
}

/* =========================================================
   ALL 15 SENSORS METADATA & OPERATIONAL THRESHOLDS
   Calibrated from dataset distributions
========================================================= */

const SENSORS: Record<SensorType, SensorMetadata> = {
  temperature: {
    id: "temperature",
    name: "Temperature",
    fullName: "TEMPERATURE",
    unit: "°C",
    normalMin: 40.0,
    normalMax: 75.0,
    criticalMin: 28.0,
    criticalMax: 95.0,
    rangeDisplay: "Normal range: 40–75 °C",
    tag: "PT-101",
    getValue: (p) => p.input_temperature ?? null,
  },
  vibration: {
    id: "vibration",
    name: "Vibration",
    fullName: "VIBRATION",
    unit: "mm/s",
    normalMin: 0.25,
    normalMax: 0.70,
    criticalMin: 0.15,
    criticalMax: 1.20,
    rangeDisplay: "Normal range: 0.25–0.70 mm/s",
    tag: "VIB-01",
    getValue: (p) => p.input_vibration ?? null,
  },
  pressure: {
    id: "pressure",
    name: "Pressure",
    fullName: "PRESSURE",
    unit: "bar",
    normalMin: 22.0,
    normalMax: 38.0,
    criticalMin: 15.0,
    criticalMax: 50.0,
    rangeDisplay: "Normal range: 22–38 bar",
    tag: "PRE-02",
    getValue: (p) => p.input_pressure ?? null,
  },
  humidity: {
    id: "humidity",
    name: "Humidity",
    fullName: "HUMIDITY",
    unit: "%",
    normalMin: 30.0,
    normalMax: 50.0,
    criticalMin: 15.0,
    criticalMax: 75.0,
    rangeDisplay: "Normal range: 30–50 %",
    tag: "HUM-01",
    getValue: (p) => p.input_humidity ?? null,
  },
  rotation_speed: {
    id: "rotation_speed",
    name: "Rotation Speed",
    fullName: "ROTATION SPEED",
    unit: "RPM",
    normalMin: 1400,
    normalMax: 1600,
    criticalMin: 1100,
    criticalMax: 1800,
    rangeDisplay: "Normal range: 1400–1600 RPM",
    tag: "ENC-01",
    getValue: (p) => p.input_rotation_speed ?? p.input_rpm ?? null,
  },
  voltage: {
    id: "voltage",
    name: "Voltage",
    fullName: "VOLTAGE",
    unit: "V",
    normalMin: 200.0,
    normalMax: 240.0,
    criticalMin: 180.0,
    criticalMax: 260.0,
    rangeDisplay: "Normal range: 200–240 V",
    tag: "VOLT-01",
    getValue: (p) => p.input_voltage ?? null,
  },
  current: {
    id: "current",
    name: "Current",
    fullName: "CURRENT",
    unit: "A",
    normalMin: 4.0,
    normalMax: 6.0,
    criticalMin: 2.5,
    criticalMax: 8.5,
    rangeDisplay: "Normal range: 4.0–6.0 A",
    tag: "CURR-01",
    getValue: (p) => p.input_current ?? null,
  },
  oil_level: {
    id: "oil_level",
    name: "Oil Level",
    fullName: "OIL LEVEL",
    unit: "%",
    normalMin: 60.0,
    normalMax: 80.0,
    criticalMin: 40.0,
    criticalMax: 95.0,
    rangeDisplay: "Normal range: 60–80 %",
    tag: "OIL-01",
    getValue: (p) => p.input_oil_level ?? null,
  },
  load: {
    id: "load",
    name: "Load",
    fullName: "LOAD",
    unit: "%",
    normalMin: 60.0,
    normalMax: 95.0,
    criticalMin: 30.0,
    criticalMax: 115.0,
    rangeDisplay: "Normal range: 60–95 %",
    tag: "LOD-01",
    getValue: (p) => p.input_load ?? null,
  },
  motor_temperature: {
    id: "motor_temperature",
    name: "Motor Temperature",
    fullName: "MOTOR TEMPERATURE",
    unit: "°C",
    normalMin: 45.0,
    normalMax: 70.0,
    criticalMin: 30.0,
    criticalMax: 90.0,
    rangeDisplay: "Normal range: 45–70 °C",
    tag: "MTR-T01",
    getValue: (p) => p.input_motor_temperature ?? null,
  },
  gearbox_temperature: {
    id: "gearbox_temperature",
    name: "Gearbox Temperature",
    fullName: "GEARBOX TEMPERATURE",
    unit: "°C",
    normalMin: 50.0,
    normalMax: 75.0,
    criticalMin: 35.0,
    criticalMax: 95.0,
    rangeDisplay: "Normal range: 50–75 °C",
    tag: "GBX-T01",
    getValue: (p) => p.input_gearbox_temperature ?? null,
  },
  sound_level: {
    id: "sound_level",
    name: "Sound Level",
    fullName: "SOUND LEVEL",
    unit: "dB",
    normalMin: 65.0,
    normalMax: 80.0,
    criticalMin: 50.0,
    criticalMax: 95.0,
    rangeDisplay: "Normal range: 65–80 dB",
    tag: "SND-01",
    getValue: (p) => p.input_sound_level ?? null,
  },
  fan_speed: {
    id: "fan_speed",
    name: "Fan Speed",
    fullName: "FAN SPEED",
    unit: "RPM",
    normalMin: 1100,
    normalMax: 1300,
    criticalMin: 900,
    criticalMax: 1500,
    rangeDisplay: "Normal range: 1100–1300 RPM",
    tag: "FAN-01",
    getValue: (p) => p.input_fan_speed ?? null,
  },
  reactive_power: {
    id: "reactive_power",
    name: "Reactive Power",
    fullName: "REACTIVE POWER",
    unit: "kVAR",
    normalMin: 40.0,
    normalMax: 60.0,
    criticalMin: 25.0,
    criticalMax: 80.0,
    rangeDisplay: "Normal range: 40–60 kVAR",
    tag: "PWR-Q01",
    getValue: (p) => p.input_reactive_power ?? null,
  },
  active_power: {
    id: "active_power",
    name: "Active Power",
    fullName: "ACTIVE POWER",
    unit: "kW",
    normalMin: 80.0,
    normalMax: 120.0,
    criticalMin: 50.0,
    criticalMax: 150.0,
    rangeDisplay: "Normal range: 80–120 kW",
    tag: "PWR-P01",
    getValue: (p) => p.input_active_power ?? p.input_power_consumption ?? null,
  },
};

const SENSOR_KEYS = Object.keys(SENSORS) as SensorType[];

function evaluateSensorStatus(
  sensor: SensorMetadata,
  value: number | null
): "NORMAL" | "WARNING" | "CRITICAL" | "NO_DATA" {
  if (value === null || value === undefined || isNaN(value)) {
    return "NO_DATA";
  }
  if (value < sensor.criticalMin || value > sensor.criticalMax) {
    return "CRITICAL";
  }
  if (value < sensor.normalMin || value > sensor.normalMax) {
    return "WARNING";
  }
  return "NORMAL";
}

/* =========================================================
   STATUS INDICATOR DOT
   Semantic industrial accents:
   Normal:   #00D49A
   Warning:  #F59E0B
   Critical: #FF3B6B
   No Data:  #8B8BA3
========================================================= */

function StatusDot({
  status = "NORMAL",
  size = "md",
}: {
  status?: "NORMAL" | "WARNING" | "CRITICAL" | "NO_DATA";
  size?: "sm" | "md" | "lg";
}) {
  const sizeMap = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  };

  const colorMap = {
    NORMAL: "bg-[#00D49A] shadow-[0_0_12px_rgba(0,212,154,0.8)]",
    WARNING: "bg-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.8)]",
    CRITICAL: "bg-[#FF3B6B] shadow-[0_0_12px_rgba(255,59,107,0.8)]",
    NO_DATA: "bg-[#8B8BA3] shadow-[0_0_6px_rgba(139,139,163,0.4)]",
  };

  return (
    <span
      className={`inline-block shrink-0 rounded-full ${sizeMap[size]} ${colorMap[status]}`}
    />
  );
}

/* =========================================================
   CUSTOM SENSOR & METRIC ICONS
========================================================= */

function Icon({ type }: { type: string }) {
  const paths: Record<string, React.ReactNode> = {
    health: (
      <path d="M20 12c0 4.5-8 8-8 8s-8-3.5-8-8a4 4 0 0 1 7-2.5A4 4 0 0 1 20 12Z" />
    ),
    risk: (
      <>
        <path d="M12 3 21 20H3L12 3Z" />
        <path d="M12 9v5M12 17v.01" />
      </>
    ),
    anomaly: (
      <>
        <path d="M12 8v4M12 16v.01" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
    operational: (
      <>
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        <line x1="12" y1="2" x2="12" y2="12" />
      </>
    ),
    temperature: (
      <>
        <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
      </>
    ),
    vibration: <path d="M2 12h3l2-6 4 12 2-6h3l2-3 2 3" />,
    pressure: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 12l3-3" />
      </>
    ),
    humidity: (
      <>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        <path d="M10 14a2 2 0 0 0 2 2" />
      </>
    ),
    rotation_speed: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        <path d="m19 5-2 2M7 17l-2 2M5 5l2 2M17 17l2 2" />
      </>
    ),
    voltage: (
      <>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </>
    ),
    current: (
      <>
        <path d="M3 12c3-4 6-4 9 0s6 4 9 0" />
        <path d="M3 16c3-4 6-4 9 0s6 4 9 0" opacity="0.5" />
      </>
    ),
    oil_level: (
      <>
        <path d="M12 3v5" />
        <path d="M7 10h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" />
        <line x1="5" y1="16" x2="19" y2="16" strokeDasharray="2 2" />
      </>
    ),
    load: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M12 2v3M8 12h8M12 9v6" />
      </>
    ),
    motor_temperature: (
      <>
        <rect x="3" y="7" width="14" height="12" rx="2" />
        <path d="M17 10h4v6h-4M7 3v4M11 3v4M15 3v4" />
      </>
    ),
    gearbox_temperature: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
    sound_level: (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    ),
    fan_speed: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 9c0-3.3 2.7-6 6-6v4c-2.2 0-4 1.8-4 4h-2zM9 12c-3.3 0-6-2.7-6-6h4c0 2.2 1.8 4 4 4v-2zM12 15c0 3.3-2.7 6-6 6v-4c2.2 0 4-1.8 4-4h2zM15 12c3.3 0 6 2.7 6 6h-4c0-2.2-1.8-4-4-4v2z" />
      </>
    ),
    reactive_power: (
      <>
        <path d="M18 4l-4 4 4 4M6 20l4-4-4-4" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    active_power: (
      <path d="M13 2 5 13h6l-1 9 8-12h-6l1-8Z" />
    ),
  };

  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[type] ?? paths.active_power}
    </svg>
  );
}

/* =========================================================
   GLASS CARD CONTAINER
   Pure dark theme: #050511 bg, #0B0B18 card, #25203A border
========================================================= */

function GlassCard({
  children,
  className = "",
  hoverable = false,
}: {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#25203A] bg-[#0B0B18] shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md transition duration-300 ${
        hoverable ? "hover:border-[#A855F7]/40 hover:bg-[#111022]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* =========================================================
   SENSOR CARD (All 15 sensors with ZERO text clipping)
========================================================= */

function SensorCard({
  sensor,
  value,
}: {
  sensor: SensorMetadata;
  value: number | null;
}) {
  const status = evaluateSensorStatus(sensor, value);

  let formattedValue = "—";
  if (value !== null && value !== undefined && !isNaN(value)) {
    if (sensor.id === "rotation_speed" || sensor.id === "fan_speed") {
      formattedValue = Math.round(value).toLocaleString();
    } else if (sensor.id === "vibration") {
      formattedValue = value.toFixed(2);
    } else {
      formattedValue = value.toFixed(1);
    }
  }

  const statusLabel =
    status === "NORMAL"
      ? "Normal"
      : status === "WARNING"
      ? "Warning"
      : status === "CRITICAL"
      ? "Critical"
      : "No Data";

  const statusBadgeColor =
    status === "NORMAL"
      ? "text-[#00D49A]"
      : status === "WARNING"
      ? "text-[#F59E0B]"
      : status === "CRITICAL"
      ? "text-[#FF3B6B]"
      : "text-[#8B8BA3]";

  return (
    <div className="group flex min-h-[190px] flex-col justify-between rounded-xl border border-[#25203A] bg-[#0B0B18] p-4 transition duration-300 hover:border-[#A855F7]/40 hover:bg-[#111022]">
      <div>
        {/* Header: Icon + Tag & Status Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#A855F7]/25 bg-[#A855F7]/10 text-[#C084FC]">
            <Icon type={sensor.id} />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 rounded-md border border-[#25203A] bg-[#050511] px-2 py-0.5">
            <StatusDot status={status} size="sm" />
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ${statusBadgeColor}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Sensor Title with full wrapping and guaranteed height */}
        <div className="mt-3.5 min-h-[2.4rem] flex items-center">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8B8BA3] leading-snug break-words">
            {sensor.fullName}
          </p>
        </div>

        {/* Numeric Value & Unit */}
        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-2xl font-black tracking-tight text-[#F8FAFC]">
            {formattedValue}
          </span>
          <span className="text-xs font-semibold text-[#8B8BA3]">
            {sensor.unit}
          </span>
        </div>
      </div>

      {/* Normal Operating Range Subtitle */}
      <div className="mt-3 border-t border-[#25203A]/70 pt-2">
        <p className="text-[10px] text-[#8B8BA3] leading-tight break-words">
          {sensor.rangeDisplay}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   SENSOR TREND CHART (All 15 Sensors Supported)
========================================================= */

function SensorTrendChart({
  history,
  sensorKey,
  onSensorChange,
}: {
  history: Prediction[];
  sensorKey: SensorType;
  onSensorChange: (sensor: SensorType) => void;
}) {
  const sensor = SENSORS[sensorKey];

  const chartData = useMemo(() => {
    if (!history || history.length === 0) {
      return [];
    }

    return history
      .slice(-20)
      .map((p, idx) => {
        const val = sensor.getValue(p);
        return {
          value: val !== null && !isNaN(val) ? Number(val) : null,
          time: p.created_at
            ? new Date(p.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : `#${idx + 1}`,
        };
      })
      .filter((d): d is { value: number; time: string } => d.value !== null);
  }, [history, sensor]);

  const values = chartData.map((d) => d.value);

  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 1;

  const spread = Math.max(
    maxVal - minVal,
    sensor.id === "vibration" ? 0.2 : 2.0
  );

  const chartMin = Math.max(0, minVal - spread * 0.15);
  const chartMax = maxVal + spread * 0.15;

  const width = 800;
  const height = 240;
  const plotTop = 15;
  const plotBottom = 210;

  const getX = (idx: number) => {
    if (chartData.length <= 1) {
      return width / 2;
    }
    return (idx / (chartData.length - 1)) * (width - 70) + 50;
  };

  const getY = (val: number) => {
    const range = chartMax - chartMin || 1;
    const ratio = (val - chartMin) / range;
    return plotBottom - ratio * (plotBottom - plotTop);
  };

  const points = chartData
    .map((d, i) => `${getX(i)},${getY(d.value)}`)
    .join(" ");

  const areaPoints =
    chartData.length > 0
      ? `${getX(0)},${plotBottom} ${points} ${getX(
          chartData.length - 1
        )},${plotBottom}`
      : "";

  return (
    <GlassCard className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
            TELEMETRY
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
            Sensor Trend
          </h2>
          <p className="text-xs text-[#8B8BA3]">
            Historical prediction telemetry from backend
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-[#25203A] bg-[#050511] px-3 py-1.5 text-[11px] font-semibold text-[#8B8BA3]">
            Last 20 readings
          </span>

          <select
            value={sensorKey}
            onChange={(e) => onSensorChange(e.target.value as SensorType)}
            className="rounded-xl border border-[#25203A] bg-[#050511] px-3.5 py-2 text-xs font-semibold text-[#F8FAFC] outline-none transition focus:border-[#A855F7]"
          >
            {SENSOR_KEYS.map((k) => (
              <option key={k} value={k}>
                {SENSORS[k].name} ({SENSORS[k].unit})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#25203A] bg-[#050511] p-3">
        {chartData.length === 0 ? (
          <div className="flex h-[230px] items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#A855F7]/20 bg-[#A855F7]/10">
                <span className="text-lg text-[#C084FC]">⌁</span>
              </div>
              <p className="text-sm font-semibold text-[#F8FAFC]">
                Waiting for sensor history
              </p>
              <p className="mt-1 text-xs leading-5 text-[#8B8BA3]">
                Real telemetry readings will appear here after predictions are
                recorded.
              </p>
            </div>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[230px] w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="sensorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid + Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = plotTop + (plotBottom - plotTop) * pct;
              const labelVal = (chartMax - (chartMax - chartMin) * pct).toFixed(
                sensor.id === "vibration" ? 2 : 0
              );

              return (
                <g key={idx}>
                  <line
                    x1="50"
                    y1={y}
                    x2={width - 15}
                    y2={y}
                    stroke="#25203A"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x="5"
                    y={y + 4}
                    fill="#8B8BA3"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {labelVal}
                  </text>
                </g>
              );
            })}

            {/* Area */}
            <polygon points={areaPoints} fill="url(#sensorAreaGrad)" />

            {/* Trend Line */}
            <polyline
              points={points}
              fill="none"
              stroke="#A855F7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {chartData.map((d, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(d.value)}
                r="3.5"
                fill="#C084FC"
                className="transition duration-150 hover:r-5"
              >
                <title>{`${sensor.name}: ${d.value} ${sensor.unit} (${d.time})`}</title>
              </circle>
            ))}
          </svg>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-col gap-1 text-[11px] text-[#8B8BA3] sm:flex-row sm:items-center sm:justify-between">
        <span>
          {chartData.length > 0
            ? `${chartData.length} real reading${
                chartData.length === 1 ? "" : "s"
              } recorded`
            : "No telemetry readings recorded"}
        </span>

        <span className="font-semibold text-[#C084FC]">
          {sensor.name} ({sensor.unit})
        </span>
      </div>
    </GlassCard>
  );
}

/* =========================================================
   FAILURE PROBABILITY TREND CHART
========================================================= */

function FailureProbabilityChart({
  history,
  currentProbability,
}: {
  history: Prediction[];
  currentProbability: number;
}) {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) {
      return [];
    }

    return history.slice(-20).map((p, idx) => ({
      val: Math.min(
        100,
        Math.max(0, Math.round(Number(p.failure_probability) * 100))
      ),
      time: p.created_at
        ? new Date(p.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : `#${idx + 1}`,
    }));
  }, [history]);

  const width = 800;
  const height = 240;
  const plotTop = 15;
  const plotBottom = 210;

  const getX = (idx: number) => {
    if (chartData.length <= 1) {
      return width / 2;
    }
    return (idx / (chartData.length - 1)) * (width - 70) + 50;
  };

  const getY = (prob: number) => {
    const ratio = Math.min(100, Math.max(0, prob)) / 100;
    return plotBottom - ratio * (plotBottom - plotTop);
  };

  const points = chartData
    .map((d, i) => `${getX(i)},${getY(d.val)}`)
    .join(" ");

  const areaPoints =
    chartData.length > 0
      ? `${getX(0)},${plotBottom} ${points} ${getX(
          chartData.length - 1
        )},${plotBottom}`
      : "";

  return (
    <GlassCard className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F59E0B]">
            PREDICTIVE MODEL
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
            Failure Probability Trend
          </h2>
          <p className="text-xs text-[#8B8BA3]">
            AI-estimated failure probability across recent predictions
          </p>
        </div>

        <span className="w-fit rounded-lg border border-[#25203A] bg-[#050511] px-3 py-1.5 text-[11px] font-semibold text-[#8B8BA3]">
          XGBOOST CLASSIFIER
        </span>
      </div>

      {/* Chart Canvas */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#25203A] bg-[#050511] p-3">
        {chartData.length === 0 ? (
          <div className="flex h-[230px] items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/10">
                <span className="text-lg text-[#FBBF24]">%</span>
              </div>
              <p className="text-sm font-semibold text-[#F8FAFC]">
                Waiting for prediction history
              </p>
              <p className="mt-1 text-xs leading-5 text-[#8B8BA3]">
                AI failure probability history will appear here after predictions
                are recorded.
              </p>
            </div>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[230px] w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = getY(pct);
              return (
                <g key={pct}>
                  <line
                    x1="50"
                    y1={y}
                    x2={width - 15}
                    y2={y}
                    stroke="#25203A"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x="8"
                    y={y + 4}
                    fill="#8B8BA3"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Area */}
            <polygon points={areaPoints} fill="url(#riskAreaGrad)" />

            {/* Trend Line */}
            <polyline
              points={points}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points */}
            {chartData.map((d, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(d.val)}
                r="3.5"
                fill="#FBBF24"
                className="transition duration-150 hover:r-5"
              >
                <title>{`Failure Probability: ${d.val}% (${d.time})`}</title>
              </circle>
            ))}
          </svg>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-col gap-1 text-[11px] text-[#8B8BA3] sm:flex-row sm:items-center sm:justify-between">
        <span>
          {chartData.length > 0
            ? `${chartData.length} real prediction${
                chartData.length === 1 ? "" : "s"
              } evaluated`
            : "No prediction history recorded"}
        </span>

        <span className="font-semibold text-[#F59E0B]">
          Current: {currentProbability}% Risk
        </span>
      </div>
    </GlassCard>
  );
}

/* =========================================================
   HEALTH SCORE GAUGE
========================================================= */

function HealthGauge({ health }: { health: number | null }) {
  const hasHealth = health !== null && health !== undefined && !isNaN(health);
  const safeHealth = hasHealth ? Math.min(100, Math.max(0, Math.round(health!))) : 0;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeHealth / 100) * circumference;

  const gaugeColor =
    !hasHealth
      ? "#8B8BA3"
      : safeHealth >= 75
      ? "#00D49A"
      : safeHealth >= 45
      ? "#F59E0B"
      : "#FF3B6B";

  return (
    <GlassCard className="p-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
        MACHINE CONDITION
      </p>
      <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">Health Score</h2>
      <p className="text-xs text-[#8B8BA3]">
        Real-time composite operational integrity
      </p>

      <div className="mt-6 flex justify-center">
        <div className="relative h-52 w-52">
          <svg viewBox="0 0 170 170" className="-rotate-90">
            <circle
              cx="85"
              cy="85"
              r={radius}
              fill="none"
              stroke="#25203A"
              strokeWidth="12"
            />
            <circle
              cx="85"
              cy="85"
              r={radius}
              fill="none"
              stroke={gaugeColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={hasHealth ? offset : circumference}
              className="transition-all duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-5xl font-black tracking-tight text-[#F8FAFC]">
              {hasHealth ? `${safeHealth}%` : "—"}
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B8BA3]">
              MACHINE HEALTH
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-[#8B8BA3]">
        {hasHealth
          ? "Calculated from latest telemetry and AI prediction"
          : "Awaiting prediction data"}
      </p>
    </GlassCard>
  );
}

/* =========================================================
   ANOMALY TIMELINE (Real Isolation Forest Events)
========================================================= */

function AnomalyTimeline({
  history,
}: {
  history: Prediction[];
}) {
  const displayItems = useMemo(() => {
    if (!history || history.length === 0) {
      return [];
    }
    return history.slice(-8);
  }, [history]);

  const anomalyCount = displayItems.filter(
    (item) => item.anomaly_detected
  ).length;

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00D49A]">
            ANOMALY DETECTION
          </p>
          <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
            Anomaly Timeline
          </h2>
          <p className="text-xs text-[#8B8BA3]">
            Isolation Forest results from prediction history
          </p>
        </div>

        {displayItems.length === 0 ? (
          <span className="w-fit rounded-full border border-[#25203A] bg-[#050511] px-3 py-1 text-[11px] font-semibold text-[#8B8BA3]">
            No History
          </span>
        ) : anomalyCount === 0 ? (
          <span className="w-fit rounded-full border border-[#00D49A]/30 bg-[#00D49A]/10 px-3 py-1 text-[11px] font-semibold text-[#00D49A]">
            All Normal
          </span>
        ) : (
          <span className="w-fit rounded-full border border-[#FF3B6B]/30 bg-[#FF3B6B]/10 px-3 py-1 text-[11px] font-semibold text-[#FF3B6B]">
            {anomalyCount} Flagged
          </span>
        )}
      </div>

      {displayItems.length === 0 ? (
        <div className="mt-6 flex h-[160px] flex-col items-center justify-center rounded-xl border border-[#25203A] bg-[#050511] p-4 text-center">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full border border-[#00D49A]/20 bg-[#00D49A]/10 text-[#00D49A]">
            ✓
          </div>
          <p className="text-sm font-semibold text-[#F8FAFC]">
            No anomaly history
          </p>
          <p className="mt-1 text-xs text-[#8B8BA3]">
            Real Isolation Forest results will appear after predictions are
            recorded.
          </p>
        </div>
      ) : (
        <>
          {anomalyCount === 0 && (
            <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#00D49A]/20 bg-[#00D49A]/[0.06] px-4 py-2.5">
              <StatusDot status="NORMAL" size="sm" />
              <p className="text-xs font-semibold text-[#00D49A]">
                No anomalies detected in recent prediction history
              </p>
            </div>
          )}

          <div className="mt-6 overflow-x-auto pb-2">
            <div className="flex min-w-[550px] items-start justify-between">
              {displayItems.map((item, idx) => {
                const isAnomaly = Boolean(item.anomaly_detected);
                return (
                  <div
                    key={idx}
                    className="relative flex flex-1 flex-col items-center"
                  >
                    {idx > 0 && (
                      <div className="absolute left-0 right-1/2 top-3 h-[1.5px] bg-[#25203A]" />
                    )}
                    {idx < displayItems.length - 1 && (
                      <div className="absolute left-1/2 right-0 top-3 h-[1.5px] bg-[#25203A]" />
                    )}

                    <div
                      className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        isAnomaly
                          ? "border-[#FF3B6B] bg-[#FF3B6B]/20 text-[#FF3B6B] shadow-[0_0_12px_rgba(255,59,107,0.7)]"
                          : "border-[#00D49A] bg-[#00D49A]/20 text-[#00D49A] shadow-[0_0_12px_rgba(0,212,154,0.3)]"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                    </div>

                    <p
                      className={`mt-2.5 text-[11px] font-bold ${
                        isAnomaly ? "text-[#FF3B6B]" : "text-[#00D49A]"
                      }`}
                    >
                      {isAnomaly ? "Anomaly" : "Normal"}
                    </p>

                    <p className="mt-0.5 text-[10px] text-[#8B8BA3]">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : `#${idx + 1}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-6 border-t border-[#25203A] pt-4 text-xs text-[#8B8BA3]">
            <div className="flex items-center gap-2">
              <StatusDot status="NORMAL" size="sm" />
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusDot status="CRITICAL" size="sm" />
              <span>Anomaly</span>
            </div>
          </div>
        </>
      )}
    </GlassCard>
  );
}

/* =========================================================
   DIGITAL TWIN MOTOR SCHEMATIC PREVIEW
========================================================= */

function DigitalTwinPreviewCard({
  temperature,
  onOpenViewer,
}: {
  temperature: number | null;
  onOpenViewer: () => void;
}) {
  const currentTemp = temperature ?? 65;

  return (
    <GlassCard className="relative overflow-hidden p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
              DIGITAL TWIN
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
              Interactive 3D Model
            </h2>
            <p className="text-xs text-[#8B8BA3]">
              Motor telemetry & subsystem inspection
            </p>
          </div>

          <span className="rounded-full border border-[#A855F7]/30 bg-[#A855F7]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C084FC]">
            3D TWIN READY
          </span>
        </div>

        <div className="relative mt-5 flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-[#25203A] bg-[#050511] p-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(#A855F7 1px, transparent 1px), linear-gradient(90deg, #A855F7 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <svg
            viewBox="0 0 500 180"
            className="relative z-10 h-36 w-full max-w-[420px]"
            fill="none"
          >
            <defs>
              <linearGradient id="heatZoneGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                <stop
                  offset="50%"
                  stopColor={currentTemp > 75 ? "#FF3B6B" : "#A855F7"}
                  stopOpacity="0.45"
                />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.3" />
              </linearGradient>

              <linearGradient id="motorBodyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2D2B44" />
                <stop offset="100%" stopColor="#131221" />
              </linearGradient>

              <linearGradient id="shaftGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E2E8F0" />
                <stop offset="50%" stopColor="#94A3B8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
            </defs>

            {/* Drive Shaft */}
            <rect
              x="40"
              y="78"
              width="420"
              height="24"
              rx="3"
              fill="url(#shaftGrad)"
              stroke="#94A3B8"
              strokeWidth="1.2"
            />
            <rect x="50" y="86" width="30" height="8" rx="1" fill="#1E293B" />
            <rect x="420" y="86" width="30" height="8" rx="1" fill="#1E293B" />

            {/* Bearing Housings */}
            <g>
              <rect
                x="100"
                y="60"
                width="24"
                height="60"
                rx="3"
                fill="#1E1C30"
                stroke="#A855F7"
                strokeWidth="1.2"
              />
              <circle cx="112" cy="74" r="5" fill="#94A3B8" />
              <circle cx="112" cy="90" r="5" fill="#94A3B8" />
              <circle cx="112" cy="106" r="5" fill="#94A3B8" />
            </g>

            <g>
              <rect
                x="376"
                y="60"
                width="24"
                height="60"
                rx="3"
                fill="#1E1C30"
                stroke="#A855F7"
                strokeWidth="1.2"
              />
              <circle cx="388" cy="74" r="5" fill="#94A3B8" />
              <circle cx="388" cy="90" r="5" fill="#94A3B8" />
              <circle cx="388" cy="106" r="5" fill="#94A3B8" />
            </g>

            {/* Stator Core */}
            <rect
              x="130"
              y="42"
              width="240"
              height="96"
              rx="8"
              fill="url(#motorBodyGrad)"
              stroke="#25203A"
              strokeWidth="2"
            />

            {/* Thermal Zone */}
            <rect
              x="138"
              y="48"
              width="224"
              height="84"
              rx="6"
              fill="url(#heatZoneGrad)"
            />

            {/* Cooling Fins */}
            {[150, 168, 186, 204, 222, 240, 258, 276, 294, 312, 330, 348].map(
              (x) => (
                <g key={x}>
                  <line
                    x1={x}
                    y1="34"
                    x2={x}
                    y2="42"
                    stroke="#A855F7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1={x}
                    y1="138"
                    x2={x}
                    y2="146"
                    stroke="#A855F7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </g>
              )
            )}

            {/* Terminal Box */}
            <rect
              x="220"
              y="18"
              width="60"
              height="24"
              rx="3"
              fill="#1E1B33"
              stroke="#A855F7"
              strokeWidth="1.2"
            />
            <circle cx="250" cy="22" r="3" fill="#00D49A" />

            {/* Sensor Indicators */}
            <g>
              <circle
                cx="250"
                cy="70"
                r="4"
                fill="#A855F7"
                stroke="#F8FAFC"
                strokeWidth="1.5"
              />
              <text x="260" y="74" fill="#C084FC" fontSize="9" fontWeight="bold">
                PT-101
              </text>
            </g>

            <g>
              <circle
                cx="388"
                cy="50"
                r="4"
                fill="#00D49A"
                stroke="#F8FAFC"
                strokeWidth="1.5"
              />
              <text x="360" y="44" fill="#00D49A" fontSize="9" fontWeight="bold">
                VIB-01
              </text>
            </g>

            <g>
              <circle
                cx="70"
                cy="68"
                r="4"
                fill="#F59E0B"
                stroke="#F8FAFC"
                strokeWidth="1.5"
              />
              <text x="50" y="60" fill="#F59E0B" fontSize="9" fontWeight="bold">
                ENC-01
              </text>
            </g>
          </svg>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px] text-[#8B8BA3]">
            <span className="rounded bg-[#25203A]/60 px-2 py-0.5">
              Stator & Rotor
            </span>
            <span className="rounded bg-[#25203A]/60 px-2 py-0.5">
              DE & NDE Bearings
            </span>
            <span className="rounded bg-[#25203A]/60 px-2 py-0.5">
              Cooling Fins
            </span>
            <span className="rounded bg-[#25203A]/60 px-2 py-0.5">
              Thermal Zones
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onOpenViewer}
        className="group mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-5 py-3.5 text-sm font-bold text-[#F8FAFC] shadow-[0_0_30px_rgba(168,85,247,0.25)] transition duration-200 hover:scale-[1.01] hover:shadow-[0_0_40px_rgba(168,85,247,0.4)]"
      >
        <span>Open Digital Twin</span>
        <span className="transition duration-200 group-hover:translate-x-1">
          →
        </span>
      </button>
    </GlassCard>
  );
}

/* =========================================================
   MAIN DASHBOARD COMPONENT
========================================================= */

export default function Dashboard() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<Prediction[]>([]);
  const [selectedSensor, setSelectedSensor] =
    useState<SensorType>("temperature");
  const [loading, setLoading] = useState(true);
  const [showDigitalTwin, setShowDigitalTwin] = useState(false);

  /* =======================================================
     LOAD REAL BACKEND DATA ONLY
  ======================================================= */

  useEffect(() => {
    async function loadDashboard() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          setLoading(false);
          return;
        }

        const machineResponse = await fetch(`${API_URL}/api/machines`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        let machineData: any = null;
        try {
          machineData = await machineResponse.json();
        } catch {
          machineData = null;
        }

        let activeMachine: Machine | null = null;

        if (machineResponse.ok && machineData) {
          const items = Array.isArray(machineData)
            ? machineData
            : machineData?.items || [];

          activeMachine =
            items.find(
              (m: Machine) => m.status?.toUpperCase() !== "DECOMMISSIONED"
            ) || items[0] || null;
        }

        setMachine(activeMachine);

        if (activeMachine?.id) {
          const predictionResponse = await fetch(
            `${API_URL}/api/machines/${activeMachine.id}/predictions`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          let predictionData: any = null;
          try {
            predictionData = await predictionResponse.json();
          } catch {
            predictionData = null;
          }

          if (predictionResponse.ok && predictionData?.items?.length > 0) {
            const items: Prediction[] = predictionData.items;
            setPrediction(items[0]);
            setPredictionHistory(items.slice(0, 20).reverse());
          } else {
            setPrediction(null);
            setPredictionHistory([]);
          }
        } else {
          setPrediction(null);
          setPredictionHistory([]);
        }
      } catch (err) {
        setPrediction(null);
        setPredictionHistory([]);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const hasPrediction = prediction !== null;
  const activeMachine = machine;

  const probability = hasPrediction
    ? Math.round(Number(prediction.failure_probability) * 100)
    : 0;

  const healthScore = hasPrediction
    ? Math.round(Number(prediction.health_score ?? (100 - probability)))
    : null;

  const isFailurePredicted = hasPrediction
    ? Boolean(prediction.predicted_failure)
    : false;

  const anomalyDetected = hasPrediction
    ? Boolean(prediction.anomaly_detected)
    : false;

  const machineStatus = activeMachine?.status?.toUpperCase() || "OPERATIONAL";
  const machineOperational = machineStatus === "OPERATIONAL";

  const operatingStatusColor: "NORMAL" | "WARNING" | "CRITICAL" =
    machineOperational
      ? "NORMAL"
      : machineStatus === "MAINTENANCE"
      ? "WARNING"
      : "CRITICAL";

  const riskTextClass =
    probability >= 50
      ? "text-[#FF3B6B]"
      : probability >= 25
      ? "text-[#F59E0B]"
      : "text-[#00D49A]";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050511] text-[#F8FAFC]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#25203A] border-t-[#A855F7] shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
          <p className="text-sm font-semibold tracking-wide text-[#8B8BA3]">
            Loading industrial telemetry intelligence...
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#050511] text-[#F8FAFC]">
        {/* Ambient atmospheric glows */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[15%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[#A855F7]/[0.05] blur-[150px]" />
          <div className="absolute right-[-5%] top-[25%] h-[500px] w-[500px] rounded-full bg-[#C084FC]/[0.04] blur-[150px]" />
        </div>

        <div className="relative mx-auto max-w-[1680px] px-4 pb-14 pt-4 sm:px-6 lg:px-8">
          {/* =================================================
              1. HERO CONTROL CENTER SECTION
          ================================================= */}
          <section className="relative overflow-hidden rounded-3xl border border-[#25203A] bg-gradient-to-br from-[#111022] via-[#0B0B18] to-[#050511]">
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(168,85,247,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,.4) 1px, transparent 1px)",
                backgroundSize: "44px 44px",
              }}
            />

            <div className="relative grid min-h-[540px] lg:grid-cols-[1.2fr_0.8fr]">
              {/* Left Content */}
              <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-fit rounded-full border border-[#A855F7]/30 bg-[#A855F7]/10 px-4 py-1.5">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C084FC]">
                      ✦ AI-Driven Industrial Maintenance
                    </span>
                  </div>

                  {activeMachine && (
                    <div className="flex items-center gap-2 rounded-full border border-[#25203A] bg-[#050511] px-3.5 py-1 text-xs font-semibold text-[#8B8BA3]">
                      <StatusDot status={operatingStatusColor} size="sm" />
                      <span>{activeMachine.machine_name}</span>
                    </div>
                  )}
                </div>

                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-[-0.03em] text-[#F8FAFC]">
                  Predict failures.
                  <br />
                  <span className="bg-gradient-to-r from-[#C084FC] via-[#A855F7] to-[#F59E0B] bg-clip-text text-transparent">
                    Prevent downtime.
                  </span>
                  <br />
                  Optimize performance.
                </h1>

                <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#8B8BA3]">
                  Real-time machine monitoring, predictive analytics and
                  intelligent maintenance for a smarter industrial environment.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowDigitalTwin(true)}
                    className="group flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-6 py-3.5 text-sm font-bold text-[#F8FAFC] shadow-[0_0_30px_rgba(168,85,247,0.25)] transition duration-200 hover:scale-[1.02]"
                  >
                    <span>Explore Digital Twin</span>
                    <span className="transition duration-200 group-hover:translate-x-1">
                      →
                    </span>
                  </button>

                  <div className="flex items-center gap-2.5 rounded-xl border border-[#25203A] bg-[#0B0B18] px-4 py-3 text-xs font-semibold text-[#8B8BA3]">
                    <StatusDot
                      status={hasPrediction ? "NORMAL" : "NO_DATA"}
                      size="sm"
                    />
                    <span>
                      {hasPrediction
                        ? "Live machine telemetry"
                        : "Waiting for telemetry"}
                    </span>
                  </div>
                </div>

                {/* 3 Key Statistics */}
                <div className="mt-10 grid grid-cols-3 gap-6 border-t border-[#25203A] pt-6 max-w-md">
                  <div>
                    <p className="text-3xl font-black tracking-tight text-[#C084FC]">
                      24/7
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B8BA3]">
                      MONITORING
                    </p>
                  </div>

                  <div className="border-l border-[#25203A] pl-6">
                    <p className="text-3xl font-black tracking-tight text-[#F8FAFC]">
                      {healthScore !== null ? `${healthScore}%` : "—"}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B8BA3]">
                      MACHINE HEALTH
                    </p>
                  </div>

                  <div className="border-l border-[#25203A] pl-6">
                    <p
                      className={`text-3xl font-black tracking-tight ${
                        hasPrediction ? riskTextClass : "text-[#8B8BA3]"
                      }`}
                    >
                      {hasPrediction ? `${probability}%` : "—"}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B8BA3]">
                      FAILURE RISK
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Industrial Motor Schematic / Twin Visual */}
              <div className="relative flex min-h-[400px] items-center justify-center px-6 pb-10 lg:pb-0">
                <div className="absolute h-[380px] w-[380px] rounded-full border border-[#A855F7]/10" />
                <div className="absolute h-[290px] w-[290px] rounded-full border border-[#A855F7]/15" />
                <div className="absolute h-[200px] w-[200px] rounded-full bg-[#A855F7]/[0.08] blur-3xl" />

                {/* 3D Physical Motor Representation */}
                <div className="relative h-40 w-72 rounded-[2.5rem] border border-purple-300/30 bg-gradient-to-br from-slate-500/40 via-[#161522] to-[#05050b] shadow-[0_0_80px_rgba(168,85,247,.25)]">
                  {/* Top Junction Terminal Box */}
                  <div className="absolute left-1/2 top-[-35px] h-9 w-16 -translate-x-1/2 rounded-lg border border-purple-400/30 bg-[#151322]">
                    <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C084FC] shadow-[0_0_20px_rgba(192,132,252,1)]" />
                  </div>

                  {/* Stator Cooling Ribs */}
                  <div className="absolute left-10 right-16 top-[-10px] flex justify-between">
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                      <span
                        key={item}
                        className="h-12 w-2 rounded-full bg-slate-600/70"
                      />
                    ))}
                  </div>

                  {/* Drive Shaft */}
                  <div className="absolute left-[-55px] top-1/2 h-10 w-16 -translate-y-1/2 rounded-l-full bg-gradient-to-r from-slate-400 to-slate-700 shadow-inner" />

                  {/* Rotor End-Bell with Glowing Hub */}
                  <div className="absolute right-[-38px] top-1/2 flex h-32 w-32 -translate-y-1/2 items-center justify-center rounded-full border border-purple-300/30 bg-gradient-to-br from-slate-700 to-[#080812]">
                    <div className="h-20 w-20 rounded-full border-8 border-slate-600 bg-[#05050b]" />
                    <div className="absolute h-7 w-7 rounded-full bg-gradient-to-br from-purple-300 to-fuchsia-500 shadow-[0_0_30px_rgba(192,132,252,.9)] animate-pulse" />
                  </div>

                  {/* Floor Reflection */}
                  <div className="absolute -bottom-12 left-4 right-4 h-5 rounded-full bg-gradient-to-r from-purple-600/50 via-slate-700 to-purple-600/50 blur-[2px]" />
                </div>
              </div>
            </div>
          </section>

          {/* =================================================
              EMPTY STATE BANNER (When no predictions recorded)
          ================================================= */}
          {!hasPrediction && (
            <section className="mt-6 rounded-2xl border border-[#25203A] bg-gradient-to-r from-[#111022] to-[#0B0B18] p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#A855F7]/30 bg-[#A855F7]/10">
                <span className="text-xl text-[#C084FC]">⚡</span>
              </div>
              <h2 className="text-lg font-bold text-[#F8FAFC]">
                No prediction data available
              </h2>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-[#8B8BA3]">
                Record a prediction from the Predictions page to populate the
                Dashboard with real machine telemetry and AI results.
              </p>
              <div className="mt-4 flex justify-center">
                <Link
                  href="/predictions"
                  className="rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-5 py-2.5 text-xs font-bold text-[#F8FAFC] shadow-[0_0_20px_rgba(168,85,247,0.25)] transition duration-200 hover:scale-[1.02]"
                >
                  Record New Prediction →
                </Link>
              </div>
            </section>
          )}

          {/* =================================================
              2. FOUR KPI CARDS
          ================================================= */}
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Health */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#A855F7]/15 text-[#C084FC]">
                    <Icon type="health" />
                  </div>
                  <span className="text-xs font-semibold text-[#8B8BA3]">
                    Machine Health
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#A855F7]">
                  ↑ AI Metric
                </span>
              </div>

              <p className="mt-5 text-4xl font-black tracking-tight text-[#F8FAFC]">
                {healthScore !== null ? `${healthScore}%` : "—"}
              </p>

              <div className="mt-4 h-1.5 w-full rounded-full bg-[#25203A]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#C084FC]"
                  style={{ width: `${healthScore ?? 0}%` }}
                />
              </div>

              <p className="mt-3 text-[11px] text-[#8B8BA3]">
                {hasPrediction
                  ? "Based on latest AI prediction"
                  : "No telemetry recorded"}
              </p>
            </GlassCard>

            {/* Risk */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/15 text-[#F59E0B]">
                    <Icon type="risk" />
                  </div>
                  <span className="text-xs font-semibold text-[#8B8BA3]">
                    Failure Risk
                  </span>
                </div>
                <span className="rounded bg-[#F59E0B]/15 px-2 py-0.5 text-[10px] font-bold text-[#F59E0B]">
                  AI ESTIMATE
                </span>
              </div>

              <p
                className={`mt-5 text-4xl font-black tracking-tight ${
                  hasPrediction ? riskTextClass : "text-[#8B8BA3]"
                }`}
              >
                {hasPrediction ? `${probability}%` : "—"}
              </p>

              <div className="mt-4 h-1.5 w-full rounded-full bg-[#25203A]">
                <div
                  className="h-full rounded-full bg-[#F59E0B]"
                  style={{
                    width: `${hasPrediction ? Math.min(probability, 100) : 0}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-[11px] text-[#8B8BA3]">
                Risk level:{" "}
                <span
                  className={`font-semibold ${
                    hasPrediction ? riskTextClass : "text-[#8B8BA3]"
                  }`}
                >
                  {prediction?.risk_level ?? "—"}
                </span>
              </p>
            </GlassCard>

            {/* Anomalies */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      anomalyDetected
                        ? "bg-[#FF3B6B]/15 text-[#FF3B6B]"
                        : "bg-[#00D49A]/15 text-[#00D49A]"
                    }`}
                  >
                    <Icon type="anomaly" />
                  </div>
                  <span className="text-xs font-semibold text-[#8B8BA3]">
                    Anomalies
                  </span>
                </div>
                <StatusDot
                  status={
                    !hasPrediction
                      ? "NO_DATA"
                      : anomalyDetected
                      ? "CRITICAL"
                      : "NORMAL"
                  }
                  size="sm"
                />
              </div>

              <p
                className={`mt-5 text-4xl font-black tracking-tight ${
                  !hasPrediction
                    ? "text-[#8B8BA3]"
                    : anomalyDetected
                    ? "text-[#FF3B6B]"
                    : "text-[#F8FAFC]"
                }`}
              >
                {!hasPrediction ? "—" : anomalyDetected ? "1" : "0"}
              </p>

              <div className="mt-4 h-1.5 w-full rounded-full bg-[#25203A]">
                <div
                  className={`h-full rounded-full ${
                    !hasPrediction
                      ? "bg-[#25203A] w-0"
                      : anomalyDetected
                      ? "bg-[#FF3B6B] w-full"
                      : "bg-[#00D49A] w-full"
                  }`}
                />
              </div>

              <p className="mt-3 text-[11px] text-[#8B8BA3]">
                {!hasPrediction
                  ? "No telemetry recorded"
                  : anomalyDetected
                  ? "Anomaly flagged — review needed"
                  : "No active anomalies detected"}
              </p>
            </GlassCard>

            {/* Operating State */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      operatingStatusColor === "NORMAL"
                        ? "bg-[#00D49A]/15 text-[#00D49A]"
                        : operatingStatusColor === "WARNING"
                        ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                        : "bg-[#FF3B6B]/15 text-[#FF3B6B]"
                    }`}
                  >
                    <Icon type="operational" />
                  </div>
                  <span className="text-xs font-semibold text-[#8B8BA3]">
                    Operating State
                  </span>
                </div>
                <StatusDot status={operatingStatusColor} size="sm" />
              </div>

              <p
                className={`mt-5 text-2xl font-black tracking-tight ${
                  operatingStatusColor === "NORMAL"
                    ? "text-[#00D49A]"
                    : operatingStatusColor === "WARNING"
                    ? "text-[#F59E0B]"
                    : "text-[#FF3B6B]"
                }`}
              >
                {machineStatus}
              </p>

              <div className="mt-4 h-1.5 w-full rounded-full bg-[#25203A]">
                <div
                  className={`h-full rounded-full ${
                    operatingStatusColor === "NORMAL"
                      ? "bg-[#00D49A] w-full"
                      : operatingStatusColor === "WARNING"
                      ? "bg-[#F59E0B] w-full"
                      : "bg-[#FF3B6B] w-full"
                  }`}
                />
              </div>

              <p className="mt-3 text-[11px] text-[#8B8BA3]">
                Continuous operational baseline
              </p>
            </GlassCard>
          </section>

          {/* =================================================
              3. ALL 15 SENSOR PARAMETERS GRID
              5 columns on desktop, 3 on tablet, 2 on sm, 1 on mobile
              NO TEXT CUT OFF, NO OVERFLOW
          ================================================= */}
          <section className="mt-8">
            <GlassCard className="p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                      TELEMETRY MATRIX
                    </p>
                    <span className="rounded bg-[#A855F7]/15 px-2 py-0.5 text-[10px] font-bold text-[#C084FC]">
                      15 CHANNELS
                    </span>
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-[#F8FAFC]">
                    Live Industrial Sensor Parameters
                  </h2>
                  <p className="text-xs text-[#8B8BA3]">
                    Active calibrated transducer streams feeding the predictive
                    maintenance pipeline
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-[#00D49A]/20 bg-[#00D49A]/10 px-3 py-1.5 text-xs font-semibold text-[#00D49A]">
                  <StatusDot
                    status={hasPrediction ? "NORMAL" : "NO_DATA"}
                    size="sm"
                  />
                  <span>
                    {hasPrediction ? "Telemetry Online" : "Awaiting Telemetry"}
                  </span>
                </div>
              </div>

              {/* 15 Sensor Cards in 5 columns on desktop */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5">
                {SENSOR_KEYS.map((k) => (
                  <SensorCard
                    key={k}
                    sensor={SENSORS[k]}
                    value={
                      prediction ? SENSORS[k].getValue(prediction) : null
                    }
                  />
                ))}
              </div>
            </GlassCard>
          </section>

          {/* =================================================
              4. AI INSIGHT SECTION
          ================================================= */}
          <section className="mt-8">
            <GlassCard className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[#C084FC]">✦</span>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                      AI INSIGHT
                    </p>
                  </div>

                  <h2 className="mt-1 text-2xl font-bold text-[#F8FAFC]">
                    {hasPrediction
                      ? isFailurePredicted
                        ? "Potential failure detected"
                        : "Machine condition is stable"
                      : "Awaiting AI telemetry evaluation"}
                  </h2>

                  <p className="mt-2 text-xs leading-relaxed text-[#8B8BA3]">
                    {hasPrediction
                      ? isFailurePredicted
                        ? "Predictive model evaluation has detected abnormal telemetry patterns deviating from the baseline. Maintenance intervention is recommended."
                        : "Latest telemetry has been evaluated by the predictive maintenance model. No immediate maintenance intervention is recommended."
                      : "Telemetry readings will be evaluated across the XGBoost failure prediction classifier and Isolation Forest anomaly detector once predictions are submitted."}
                  </p>
                </div>

                <div className="rounded-xl border border-[#25203A] bg-[#050511] p-4 lg:min-w-[320px]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                    Recommendation
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#F8FAFC]">
                    {hasPrediction
                      ? isFailurePredicted
                        ? "Schedule maintenance inspection"
                        : "Continue normal monitoring"
                      : "Submit prediction to generate advice"}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#8B8BA3]">
                    {hasPrediction
                      ? isFailurePredicted
                        ? "Inspect bearings and cooling system during the next planned maintenance window to prevent unplanned downtime."
                        : "Maintain routine monitoring and follow the scheduled maintenance cycle."
                      : "Real AI recommendations will be derived from machine health and failure risk."}
                  </p>
                </div>
              </div>
            </GlassCard>
          </section>

          {/* =================================================
              5. SENSOR TREND & FAILURE PROBABILITY TREND
          ================================================= */}
          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <SensorTrendChart
              history={predictionHistory}
              sensorKey={selectedSensor}
              onSensorChange={setSelectedSensor}
            />

            <FailureProbabilityChart
              history={predictionHistory}
              currentProbability={probability}
            />
          </section>

          {/* =================================================
              6. HEALTH SCORE & ANOMALY TIMELINE
          ================================================= */}
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <HealthGauge health={healthScore} />

            <AnomalyTimeline history={predictionHistory} />
          </section>

          {/* =================================================
              7. MACHINE INFORMATION & DIGITAL TWIN
          ================================================= */}
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Machine Information */}
            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                    ASSET INFORMATION
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
                    Machine Information
                  </h2>
                </div>
                <span className="text-[#A855F7]">◇</span>
              </div>

              <div className="mt-6 divide-y divide-[#25203A]">
                <div className="flex justify-between py-3.5">
                  <span className="text-xs text-[#8B8BA3]">Machine Name</span>
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine?.machine_name || "Motor 01"}
                  </span>
                </div>

                <div className="flex justify-between py-3.5">
                  <span className="text-xs text-[#8B8BA3]">Machine Type</span>
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine?.machine_type || "Industrial Motor"}
                  </span>
                </div>

                <div className="flex justify-between py-3.5">
                  <span className="text-xs text-[#8B8BA3]">Manufacturer</span>
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine?.manufacturer || "Tata Steel"}
                  </span>
                </div>

                <div className="flex justify-between py-3.5">
                  <span className="text-xs text-[#8B8BA3]">Model</span>
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine?.model_number || "TSM-450"}
                  </span>
                </div>

                <div className="flex justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-xs text-[#8B8BA3]">
                    Location
                  </span>
                  <span className="text-right text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine?.location || "Tata Steel Plant, Jamshedpur"}
                  </span>
                </div>

                <div className="flex justify-between py-3.5">
                  <span className="text-xs text-[#8B8BA3]">Operating Status</span>
                  <div className="flex items-center gap-2">
                    <StatusDot status={operatingStatusColor} size="sm" />
                    <span
                      className={`text-xs font-semibold ${
                        operatingStatusColor === "NORMAL"
                          ? "text-[#00D49A]"
                          : operatingStatusColor === "WARNING"
                          ? "text-[#F59E0B]"
                          : "text-[#FF3B6B]"
                      }`}
                    >
                      {machineStatus}
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Digital Twin Preview */}
            <DigitalTwinPreviewCard
              temperature={
                prediction ? prediction.input_temperature ?? null : null
              }
              onOpenViewer={() => setShowDigitalTwin(true)}
            />
          </section>

          {/* =================================================
              FOOTER
          ================================================= */}
          <footer className="mt-12 flex flex-col gap-3 border-t border-[#25203A] pt-6 text-[11px] text-[#8B8BA3] sm:flex-row sm:items-center sm:justify-between">
            <p>
              AI-Based Industrial Maintenance and Process Optimization System
            </p>
            <div className="flex items-center gap-2">
              <StatusDot
                status={hasPrediction ? "NORMAL" : "NO_DATA"}
                size="sm"
              />
              <span>
                {hasPrediction
                  ? "System Telemetry Online"
                  : "Awaiting Machine Telemetry"}
              </span>
            </div>
          </footer>
        </div>
      </main>

      {/* =====================================================
          DIGITAL TWIN 3D VIEWER MODAL
      ===================================================== */}
      {showDigitalTwin && (
        <DigitalTwinViewer
          machineName={activeMachine?.machine_name || "Motor 01"}
          machineStatus={activeMachine?.status || "OPERATIONAL"}
          onClose={() => setShowDigitalTwin(false)}
        />
      )}
    </>
  );
}
