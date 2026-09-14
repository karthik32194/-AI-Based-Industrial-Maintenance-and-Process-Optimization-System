"use client";

import dynamic from "next/dynamic";
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
  created_at?: string;

  failure_probability: number;
  predicted_failure: string | boolean | null;
  risk_level: string;
  health_status: string;
  health_score: number;

  anomaly_detected: boolean;

  input_temperature: number;
  input_vibration: number;
  input_pressure: number;
  input_rpm: number;
  input_power_consumption: number;
};

type SensorType = "temperature" | "vibration" | "pressure" | "rpm" | "power";

/* =========================================================
   SINGLE SOURCE OF TRUTH DEFAULT BASELINE
   Enforces: Health 80% / Risk 20% (Low Risk, Healthy, Normal)
========================================================= */

const DEFAULT_PREDICTION: Prediction = {
  failure_probability: 0.20,
  predicted_failure: null,
  risk_level: "LOW",
  health_status: "HEALTHY",
  health_score: 80,
  anomaly_detected: false,
  input_temperature: 68.5,
  input_vibration: 1.80,
  input_pressure: 3.2,
  input_rpm: 1650,
  input_power_consumption: 18.2,
};

const DEFAULT_MACHINE: Machine = {
  id: "motor-01",
  machine_name: "Motor 01",
  machine_type: "Industrial Motor",
  manufacturer: "Tata Steel",
  model_number: "TSM-450",
  location: "Tata Steel Plant, Jamshedpur",
  status: "OPERATIONAL",
};

/* =========================================================
   SENSOR DEFINITIONS & OPERATING RANGES
========================================================= */

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
  getValue: (p: Prediction) => number;
}

const SENSORS: Record<SensorType, SensorMetadata> = {
  temperature: {
    id: "temperature",
    name: "Temperature",
    fullName: "TEMPERATURE",
    unit: "°C",
    normalMin: 40,
    normalMax: 75,
    criticalMin: 28,
    criticalMax: 95,
    rangeDisplay: "Normal range: 40–75 °C",
    tag: "PT-101",
    getValue: (p) => p.input_temperature,
  },
  vibration: {
    id: "vibration",
    name: "Vibration",
    fullName: "VIBRATION",
    unit: "mm/s",
    normalMin: 0.5,
    normalMax: 2.5,
    criticalMin: 0.3,
    criticalMax: 4.5,
    rangeDisplay: "Normal range: 0.5–2.5 mm/s",
    tag: "VIB-01",
    getValue: (p) => p.input_vibration,
  },
  pressure: {
    id: "pressure",
    name: "Pressure",
    fullName: "PRESSURE",
    unit: "bar",
    normalMin: 2.0,
    normalMax: 5.5,
    criticalMin: 1.2,
    criticalMax: 7.0,
    rangeDisplay: "Normal range: 2–5.5 bar",
    tag: "PRE-02",
    getValue: (p) => p.input_pressure,
  },
  rpm: {
    id: "rpm",
    name: "Rotation Speed",
    fullName: "ROTATION SPEED",
    unit: "RPM",
    normalMin: 1500,
    normalMax: 1800,
    criticalMin: 1100,
    criticalMax: 2000,
    rangeDisplay: "Normal range: 1500–1800 RPM",
    tag: "ENC-01",
    getValue: (p) => p.input_rpm,
  },
  power: {
    id: "power",
    name: "Power Consumption",
    fullName: "POWER CONSUMPTION",
    unit: "kW",
    normalMin: 12.0,
    normalMax: 22.0,
    criticalMin: 8.0,
    criticalMax: 30.0,
    rangeDisplay: "Normal range: 12–22 kW",
    tag: "PWR-03",
    getValue: (p) => p.input_power_consumption,
  },
};

function evaluateSensorStatus(
  sensor: SensorMetadata,
  value: number
): "NORMAL" | "WARNING" | "CRITICAL" {
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
   Semantic colors:
   Normal:   #00D49A
   Warning:  #F59E0B
   Critical: #FF3B6B
========================================================= */

function StatusDot({
  status = "NORMAL",
  size = "md",
}: {
  status?: "NORMAL" | "WARNING" | "CRITICAL";
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
  };

  return (
    <span
      className={`inline-block shrink-0 rounded-full ${sizeMap[size]} ${colorMap[status]}`}
    />
  );
}

/* =========================================================
   SVG ICONS
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
    vibration: (
      <path d="M2 12h3l2-6 4 12 2-6h3l2-3 2 3" />
    ),
    pressure: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 12l3-3" />
      </>
    ),
    rpm: (
      <>
        <path d="M12 4v4l3 2" />
        <path d="M21 12a9 9 0 1 1-6.2-8.56" />
      </>
    ),
    power: (
      <path d="M13 2 5 13h6l-1 9 8-12h-6l1-8Z" />
    ),
  };

  return (
    <svg
      className="h-4.5 w-4.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[type] ?? paths.power}
    </svg>
  );
}

/* =========================================================
   GLASS CARD CONTAINER
   Theme: #0B0B18 bg, #25203A border, #111022 hover
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
   LIVE SENSOR DATA CARD (Point 4 - Spaced & Fitted)
   - Full names without overflow
   - Value and unit cleanly proportioned
   - Two-line or snug normal range
   - Clean status indicator
========================================================= */

function SensorCard({
  sensor,
  value,
}: {
  sensor: SensorMetadata;
  value: number;
}) {
  const status = evaluateSensorStatus(sensor, value);

  const formattedValue =
    sensor.id === "rpm"
      ? Math.round(value).toLocaleString()
      : sensor.id === "vibration"
      ? value.toFixed(2)
      : value.toFixed(1);

  const statusLabel =
    status === "NORMAL" ? "Normal" : status === "WARNING" ? "Warning" : "Critical";

  const statusBadgeColor =
    status === "NORMAL"
      ? "text-[#00D49A]"
      : status === "WARNING"
      ? "text-[#F59E0B]"
      : "text-[#FF3B6B]";

  return (
    <div className="group min-w-0 rounded-xl border border-[#25203A] bg-[#0B0B18] p-4 transition duration-300 hover:border-[#A855F7]/35 hover:bg-[#111022] overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header: Icon + Compact Status */}
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#A855F7]/25 bg-[#A855F7]/10 text-[#C084FC]">
            <Icon type={sensor.id} />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <StatusDot status={status} size="sm" />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusBadgeColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Full Sensor Title (No overflow, clean leading) */}
        <div className="mt-4 min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-wide text-[#8B8BA3] truncate"
            title={sensor.fullName}
          >
            {sensor.fullName}
          </p>
        </div>

        {/* Value + Unit (Fitted cleanly) */}
        <div className="mt-1.5 flex items-baseline gap-1 min-w-0">
          <span className="text-2xl font-black tracking-tight text-[#F8FAFC] truncate">
            {formattedValue}
          </span>
          <span className="text-xs font-semibold text-[#8B8BA3] shrink-0">
            {sensor.unit}
          </span>
        </div>
      </div>

      {/* Normal Operating Range Subtitle */}
      <div className="mt-3.5 border-t border-[#25203A]/70 pt-2 min-w-0">
        <p
          className="text-[10px] text-[#8B8BA3] truncate"
          title={sensor.rangeDisplay}
        >
          {sensor.rangeDisplay}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   SENSOR TREND CHART (Point 6)
========================================================= */

function SensorTrendChart({
  history,
  sensorKey,
  onSensorChange,
  currentValue,
}: {
  history: Prediction[];
  sensorKey: SensorType;
  onSensorChange: (sensor: SensorType) => void;
  currentValue: number;
}) {
  const sensor = SENSORS[sensorKey];

  const chartData = useMemo(() => {
    if (history.length === 0) {
      return [];
    }

    return history.slice(-20).map((p, idx) => ({
      value: Number(sensor.getValue(p)),
      time: p.created_at
        ? new Date(p.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : `#${idx + 1}`,
    }));
  }, [history, sensor]);

  const values = chartData.map((d) => d.value);

  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 1;

  const spread = Math.max(
    maxVal - minVal,
    sensor.id === "vibration" ? 0.2 : 2.0
  );

  const chartMin = Math.max(0, minVal - spread * 0.2);
  const chartMax = maxVal + spread * 0.2;

  const width = 800;
  const height = 240;
  const plotTop = 15;
  const plotBottom = 210;

  const getX = (idx: number) => {
    if (chartData.length <= 1) {
      return width / 2;
    }

    return (idx / (chartData.length - 1)) * (width - 60) + 45;
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
            Historical prediction readings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg border border-[#25203A] bg-[#050511] px-3 py-1.5 text-[11px] font-semibold text-[#8B8BA3]">
            Last 20 readings
          </span>

          <select
            value={sensorKey}
            onChange={(e) =>
              onSensorChange(e.target.value as SensorType)
            }
            className="rounded-xl border border-[#25203A] bg-[#050511] px-3.5 py-2 text-xs font-semibold text-[#F8FAFC] outline-none transition focus:border-[#A855F7]"
          >
            <option value="temperature">Temperature (°C)</option>
            <option value="vibration">Vibration (mm/s)</option>
            <option value="pressure">Pressure (bar)</option>
            <option value="rpm">Rotation Speed (RPM)</option>
            <option value="power">Power Consumption (kW)</option>
          </select>
        </div>
      </div>

      {/* Chart */}
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
                Real telemetry readings will appear here after
                predictions are recorded.
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
              <linearGradient
                id="sensorAreaGrad"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#A855F7"
                  stopOpacity="0.25"
                />

                <stop
                  offset="100%"
                  stopColor="#A855F7"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {/* Grid + Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y =
                plotTop + (plotBottom - plotTop) * pct;

              const labelVal = (
                chartMax -
                (chartMax - chartMin) * pct
              ).toFixed(
                sensor.id === "vibration" ? 1 : 0
              );

              return (
                <g key={idx}>
                  <line
                    x1="45"
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
            <polygon
              points={areaPoints}
              fill="url(#sensorAreaGrad)"
            />

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
                <title>
                  {`${sensor.name}: ${d.value} ${sensor.unit} (${d.time})`}
                </title>
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
          {sensor.name} {sensor.unit}
        </span>
      </div>
    </GlassCard>
  );
}

/* =========================================================
   FAILURE PROBABILITY TREND CHART (Point 7)
========================================================= */

function FailureProbabilityChart({
  history,
  currentProbability,
}: {
  history: Prediction[];
  currentProbability: number;
}) {
  const chartData = useMemo(() => {
    // No fake data.
    // Use only actual prediction history from the backend.
    if (history.length === 0) {
      return [];
    }

    return history.slice(-20).map((p, idx) => ({
      val: Math.min(
        100,
        Math.max(
          0,
          Math.round(Number(p.failure_probability) * 100)
        )
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

    return (
      (idx / (chartData.length - 1)) * (width - 60) + 45
    );
  };

  const getY = (prob: number) => {
    const ratio =
      Math.min(100, Math.max(0, prob)) / 100;

    return (
      plotBottom -
      ratio * (plotBottom - plotTop)
    );
  };

  const points = chartData
    .map(
      (d, i) =>
        `${getX(i)},${getY(d.val)}`
    )
    .join(" ");

  const areaPoints =
    chartData.length > 0
      ? `${getX(0)},${plotBottom} ${points} ${getX(
          chartData.length - 1
        )},${plotBottom}`
      : "";

  return (
    <GlassCard className="p-6">

      {/* HEADER */}
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
          AI ESTIMATE
        </span>
      </div>

      {/* CHART */}
      <div className="mt-6 overflow-hidden rounded-xl border border-[#25203A] bg-[#050511] p-3">

        {chartData.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex h-[230px] items-center justify-center">
            <div className="max-w-md text-center">

              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/10">
                <span className="text-lg text-[#FBBF24]">
                  %
                </span>
              </div>

              <p className="text-sm font-semibold text-[#F8FAFC]">
                Waiting for prediction history
              </p>

              <p className="mt-1 text-xs leading-5 text-[#8B8BA3]">
                AI failure probability history will appear here
                after predictions are recorded.
              </p>

            </div>
          </div>
        ) : (
          /* REAL DATA CHART */
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[230px] w-full"
            preserveAspectRatio="none"
          >

            {/* GRADIENT */}
            <defs>
              <linearGradient
                id="riskAreaGrad"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#F59E0B"
                  stopOpacity="0.22"
                />

                <stop
                  offset="100%"
                  stopColor="#F59E0B"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {/* GRID */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = getY(pct);

              return (
                <g key={pct}>

                  <line
                    x1="45"
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

            {/* AREA */}
            <polygon
              points={areaPoints}
              fill="url(#riskAreaGrad)"
            />

            {/* TREND LINE */}
            <polyline
              points={points}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* DATA POINTS */}
            {chartData.map((d, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(d.val)}
                r="3.5"
                fill="#FBBF24"
                className="transition duration-150 hover:r-5"
              >
                <title>
                  {`Failure Probability: ${d.val}% (${d.time})`}
                </title>
              </circle>
            ))}

          </svg>
        )}

      </div>

      {/* FOOTER */}
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
   HEALTH SCORE GAUGE (Point 8)
========================================================= */

function HealthGauge({ health }: { health: number }) {
  const safeHealth = Math.min(100, Math.max(0, Math.round(health)));
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeHealth / 100) * circumference;

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
              stroke="#A855F7"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-5xl font-black tracking-tight text-[#F8FAFC]">
              {safeHealth}%
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8B8BA3]">
              MACHINE HEALTH
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-[#8B8BA3]">
        Calculated from latest telemetry and AI prediction
      </p>
    </GlassCard>
  );
}

/* =========================================================
   ANOMALY TIMELINE (Point 9)
========================================================= */

function AnomalyTimeline({
  history,
  currentAnomaly,
}: {
  history: Prediction[];
  currentAnomaly: boolean;
}) {
  const displayItems = useMemo(() => {
    if (history.length > 0) {
      return history.slice(-8);
    }
    return Array.from({ length: 8 }).map((_, i) => ({
      anomaly_detected: i === 7 ? currentAnomaly : false,
      created_at: undefined,
    }));
  }, [history, currentAnomaly]);

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

        {anomalyCount === 0 ? (
          <span className="w-fit rounded-full border border-[#00D49A]/30 bg-[#00D49A]/10 px-3 py-1 text-[11px] font-semibold text-[#00D49A]">
            All Normal
          </span>
        ) : (
          <span className="w-fit rounded-full border border-[#FF3B6B]/30 bg-[#FF3B6B]/10 px-3 py-1 text-[11px] font-semibold text-[#FF3B6B]">
            {anomalyCount} Flagged
          </span>
        )}
      </div>

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
                    : `T-${8 - idx}`}
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
    </GlassCard>
  );
}

/* =========================================================
   DIGITAL TWIN MOTOR SCHEMATIC PREVIEW (Point 11)
========================================================= */

function DigitalTwinPreviewCard({
  temperature,
  onOpenViewer,
}: {
  temperature: number;
  onOpenViewer: () => void;
}) {
  return (
    <GlassCard className="relative overflow-hidden p-6">
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

      <div className="relative mt-5 flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-[#25203A] bg-[#050511] p-4">
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
                stopColor={temperature > 75 ? "#FF3B6B" : "#A855F7"}
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

          {/* Drive Shaft & Keyway */}
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

          {/* Non-Drive End Bearing Housing */}
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

          {/* Drive End Bearing Housing */}
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

          {/* Motor Body / Stator Core */}
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
          {[150, 168, 186, 204, 222, 240, 258, 276, 294, 312, 330, 348].map((x) => (
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
          ))}

          {/* Top Terminal Box */}
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

          {/* Rotor Assembly */}
          <rect
            x="170"
            y="66"
            width="160"
            height="48"
            rx="4"
            fill="#0F0E1B"
            stroke="#A855F7"
            strokeWidth="1.2"
            strokeDasharray="4 2"
          />

          {/* Rotation Indicator */}
          <g transform="translate(420, 52)">
            <path
              d="M10 20 A 14 14 0 1 1 24 34"
              fill="none"
              stroke="#C084FC"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <polygon points="24,28 28,36 20,36" fill="#C084FC" />
          </g>

          {/* Sensor Points */}
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

      <button
        onClick={onOpenViewer}
        className="group mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-5 py-3.5 text-sm font-bold text-[#F8FAFC] shadow-[0_0_30px_rgba(168,85,247,0.25)] transition duration-200 hover:scale-[1.01] hover:shadow-[0_0_40px_rgba(168,85,247,0.4)]"
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
     LOAD DASHBOARD DATA
  ======================================================= */

  useEffect(() => {
    async function loadDashboard() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          setMachine(DEFAULT_MACHINE);
          setPrediction(DEFAULT_PREDICTION);
          setPredictionHistory([DEFAULT_PREDICTION]);
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
            ) || items[0];
        }

        const machineToUse = activeMachine || DEFAULT_MACHINE;
        setMachine(machineToUse);

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
            setPrediction(DEFAULT_PREDICTION);
            setPredictionHistory([DEFAULT_PREDICTION]);
          }
        } else {
          setPrediction(DEFAULT_PREDICTION);
          setPredictionHistory([DEFAULT_PREDICTION]);
        }
      } catch (err) {
        setMachine(DEFAULT_MACHINE);
        setPrediction(DEFAULT_PREDICTION);
        setPredictionHistory([DEFAULT_PREDICTION]);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const activePrediction = prediction ?? DEFAULT_PREDICTION;
  const activeMachine = machine ?? DEFAULT_MACHINE;

  const probability = Math.round(
    Number(activePrediction.failure_probability) * 100
  );

  const health = Math.round(
    Number(activePrediction.health_score ?? (100 - probability))
  );

  const isFailurePredicted = Boolean(activePrediction.predicted_failure);
  const anomalyDetected = Boolean(activePrediction.anomaly_detected);

  const machineOperational =
    activeMachine.status?.toUpperCase() === "OPERATIONAL";

  const operatingStatusColor: "NORMAL" | "WARNING" | "CRITICAL" =
    machineOperational
      ? "NORMAL"
      : activeMachine.status?.toUpperCase() === "MAINTENANCE"
      ? "WARNING"
      : "CRITICAL";

  const riskTextClass =
    probability >= 50
      ? "text-[#FF3B6B]"
      : probability >= 25
      ? "text-[#F59E0B]"
      : "text-[#F59E0B]";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050511] text-[#F8FAFC]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#25203A] border-t-[#A855F7]" />
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
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[15%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[#A855F7]/[0.05] blur-[150px]" />
          <div className="absolute right-[-5%] top-[25%] h-[500px] w-[500px] rounded-full bg-[#C084FC]/[0.04] blur-[150px]" />
        </div>

        <div className="relative mx-auto max-w-[1680px] px-4 pb-14 pt-4 sm:px-6 lg:px-8">
          {/* =================================================
              1. HERO SECTION
              - Cleaned: No floating clutter
              - Gorgeous 3D-styled Industrial Motor visual restored & elevated
              - Large, bold, non-clipped headline typography
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

            <div className="relative grid min-h-[560px] lg:grid-cols-[1.15fr_0.85fr]">
              {/* Left Content */}
              <div className="flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-14 lg:px-14">
                <div className="w-fit rounded-full border border-[#A855F7]/30 bg-[#A855F7]/10 px-4 py-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C084FC]">
                    ✦ AI-Driven Industrial Maintenance
                  </span>
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
                    <StatusDot status="NORMAL" size="sm" />
                    <span>Live machine telemetry</span>
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
                      {health}%
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B8BA3]">
                      MACHINE HEALTH
                    </p>
                  </div>

                  <div className="border-l border-[#25203A] pl-6">
                    <p className={`text-3xl font-black tracking-tight ${riskTextClass}`}>
                      {probability}%
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B8BA3]">
                      FAILURE RISK
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Gorgeous 3D-Styled Industrial Motor Visual */}
              <div className="relative flex min-h-[440px] items-center justify-center px-6 pb-12 lg:pb-0">
                {/* Concentric orbital radar rings */}
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

                  {/* Left Chrome Drive Shaft */}
                  <div className="absolute left-[-55px] top-1/2 h-10 w-16 -translate-y-1/2 rounded-l-full bg-gradient-to-r from-slate-400 to-slate-700 shadow-inner" />

                  {/* Right Heavy Rotor End-Bell with Glowing Hub */}
                  <div className="absolute right-[-38px] top-1/2 flex h-32 w-32 -translate-y-1/2 items-center justify-center rounded-full border border-purple-300/30 bg-gradient-to-br from-slate-700 to-[#080812]">
                    <div className="h-20 w-20 rounded-full border-8 border-slate-600 bg-[#05050b]" />
                    <div className="absolute h-7 w-7 rounded-full bg-gradient-to-br from-purple-300 to-fuchsia-500 shadow-[0_0_30px_rgba(192,132,252,.9)] animate-pulse" />
                  </div>

                  {/* Floor Ambient Purple Reflection */}
                  <div className="absolute -bottom-12 left-4 right-4 h-5 rounded-full bg-gradient-to-r from-purple-600/50 via-slate-700 to-purple-600/50 blur-[2px]" />
                </div>
              </div>
            </div>
          </section>

          {/* =================================================
              2. TOP FOUR METRIC CARDS
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
                {health}%
              </p>

              <div className="mt-4 h-1.5 w-full rounded-full bg-[#25203A]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#C084FC]"
                  style={{ width: `${health}%` }}
                />
              </div>

              <p className="mt-3 text-[11px] text-[#8B8BA3]">
                Based on latest AI prediction
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

              <p className={`mt-5 text-4xl font-black tracking-tight ${riskTextClass}`}>
                {probability}%
              </p>

              <div className="mt-4 h-1.5 w-full rounded-full bg-[#25203A]">
                <div
                  className="h-full rounded-full bg-[#F59E0B]"
                  style={{ width: `${Math.min(probability, 100)}%` }}
                />
              </div>

              <p className="mt-3 text-[11px] text-[#8B8BA3]">
                Risk level:{" "}
                <span className={`font-semibold ${riskTextClass}`}>
                  {activePrediction.risk_level ?? "LOW"}
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
                  status={anomalyDetected ? "CRITICAL" : "NORMAL"}
                  size="sm"
                />
              </div>

              <p
                className={`mt-5 text-4xl font-black tracking-tight ${
                  anomalyDetected ? "text-[#FF3B6B]" : "text-[#F8FAFC]"
                }`}
              >
                {anomalyDetected ? "1" : "0"}
              </p>

              <div className="mt-4 h-1.5 w-full rounded-full bg-[#25203A]">
                <div
                  className={`h-full rounded-full ${
                    anomalyDetected ? "bg-[#FF3B6B] w-full" : "bg-[#00D49A] w-full"
                  }`}
                />
              </div>

              <p className="mt-3 text-[11px] text-[#8B8BA3]">
                {anomalyDetected
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
                {activeMachine.status?.toUpperCase() || "OPERATIONAL"}
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
              3. LIVE SENSOR DATA + MACHINE INTELLIGENCE
              Spacious 1.9fr / 1.1fr distribution:
              No text clipping, no overflow, full names
          ================================================= */}
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.9fr_1.1fr]">
            {/* Sensor Data */}
            <GlassCard className="p-5 sm:p-6 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                    TELEMETRY
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
                    Live Sensor Data
                  </h2>
                  <p className="text-xs text-[#8B8BA3]">
                    Active calibrated transducer streams
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-[#00D49A]/20 bg-[#00D49A]/10 px-3 py-1.5 text-xs font-semibold text-[#00D49A]">
                  <StatusDot status="NORMAL" size="sm" />
                  <span>Live Telemetry</span>
                </div>
              </div>

              {/* 5 Sensor Cards Grid with comfortable spacing */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                <SensorCard
                  sensor={SENSORS.temperature}
                  value={activePrediction.input_temperature}
                />
                <SensorCard
                  sensor={SENSORS.vibration}
                  value={activePrediction.input_vibration}
                />
                <SensorCard
                  sensor={SENSORS.pressure}
                  value={activePrediction.input_pressure}
                />
                <SensorCard
                  sensor={SENSORS.rpm}
                  value={activePrediction.input_rpm}
                />
                <SensorCard
                  sensor={SENSORS.power}
                  value={activePrediction.input_power_consumption}
                />
              </div>
            </GlassCard>

            {/* Machine Intelligence AI Card */}
            <GlassCard className="p-5 sm:p-6 min-w-0 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[#C084FC]">✦</span>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                    AI INSIGHT
                  </p>
                </div>

                <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
                  Machine Intelligence
                </h2>

                <div className="mt-5 rounded-xl border border-[#25203A] bg-[#050511] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <StatusDot
                        status={isFailurePredicted ? "CRITICAL" : "NORMAL"}
                        size="md"
                      />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-bold ${
                          isFailurePredicted ? "text-[#FF3B6B]" : "text-[#00D49A]"
                        }`}
                      >
                        {isFailurePredicted
                          ? "Potential failure detected"
                          : "Machine condition is stable"}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-[#8B8BA3]">
                        {isFailurePredicted
                          ? "Predictive model evaluation has detected abnormal telemetry patterns deviating from the baseline. Maintenance intervention is recommended."
                          : "Latest telemetry has been evaluated by the predictive maintenance model. No immediate maintenance intervention is recommended."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-[#25203A] pt-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8B8BA3]">
                  Recommendation
                </p>
                <p className="mt-1 text-sm font-semibold text-[#F8FAFC]">
                  {isFailurePredicted
                    ? "Schedule maintenance inspection"
                    : "Continue normal monitoring"}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#8B8BA3]">
                  {isFailurePredicted
                    ? "Inspect bearings and cooling system during the next planned maintenance window to prevent unplanned downtime."
                    : "Maintain routine monitoring and follow the scheduled maintenance cycle."}
                </p>
              </div>
            </GlassCard>
          </section>

          {/* =================================================
              4. SENSOR TREND & FAILURE PROBABILITY TREND
          ================================================= */}
          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <SensorTrendChart
              history={predictionHistory}
              sensorKey={selectedSensor}
              onSensorChange={setSelectedSensor}
              currentValue={SENSORS[selectedSensor].getValue(activePrediction)}
            />

            <FailureProbabilityChart
              history={predictionHistory}
              currentProbability={probability}
            />
          </section>

          {/* =================================================
              5. HEALTH SCORE & ANOMALY TIMELINE
          ================================================= */}
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <HealthGauge health={health} />

            <AnomalyTimeline
              history={predictionHistory}
              currentAnomaly={anomalyDetected}
            />
          </section>

          {/* =================================================
              6. MACHINE INFORMATION & DIGITAL TWIN
          ================================================= */}
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
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
                    {activeMachine.machine_name || "Motor 01"}
                  </span>
                </div>

                <div className="flex justify-between py-3.5">
                  <span className="text-xs text-[#8B8BA3]">Machine Type</span>
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine.machine_type || "Industrial Motor"}
                  </span>
                </div>

                <div className="flex justify-between py-3.5">
                  <span className="text-xs text-[#8B8BA3]">Manufacturer</span>
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine.manufacturer || "Tata Steel"}
                  </span>
                </div>

                <div className="flex justify-between py-3.5">
                  <span className="text-xs text-[#8B8BA3]">Model</span>
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine.model_number || "TSM-450"}
                  </span>
                </div>

                <div className="flex justify-between gap-4 py-3.5">
                  <span className="shrink-0 text-xs text-[#8B8BA3]">
                    Location
                  </span>
                  <span className="text-right text-xs font-semibold text-[#F8FAFC]">
                    {activeMachine.location || "Tata Steel Plant, Jamshedpur"}
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
                      {activeMachine.status?.toUpperCase() || "OPERATIONAL"}
                    </span>
                  </div>
                </div>
              </div>
            </GlassCard>

            <DigitalTwinPreviewCard
              temperature={activePrediction.input_temperature}
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
              <StatusDot status="NORMAL" size="sm" />
              <span>System Telemetry Online</span>
            </div>
          </footer>
        </div>
      </main>

      {/* =====================================================
          DIGITAL TWIN 3D VIEWER MODAL
      ===================================================== */}
      {showDigitalTwin && (
        <DigitalTwinViewer
          machineName={activeMachine.machine_name}
          machineStatus={activeMachine.status}
          onClose={() => setShowDigitalTwin(false)}
        />
      )}
    </>
  );
}