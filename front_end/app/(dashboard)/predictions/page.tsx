"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

const API_URL = "http://localhost:8000";

/* =========================================================
   TYPES
========================================================= */

type Machine = {
  id: string;
  machine_name: string;
  machine_type: string;
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

  input_rpm?: number | null;
  input_power_consumption?: number | null;
};

/* =========================================================
   SENSOR DEFINITIONS (All 15 Sensors)
========================================================= */

type SensorKey =
  | "temperature"
  | "motor_temperature"
  | "gearbox_temperature"
  | "vibration"
  | "rotation_speed"
  | "fan_speed"
  | "pressure"
  | "humidity"
  | "oil_level"
  | "voltage"
  | "current"
  | "load"
  | "sound_level"
  | "active_power"
  | "reactive_power";

interface SensorField {
  key: SensorKey;
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  criticalMin: number;
  criticalMax: number;
  subsystem: "Thermal" | "Mechanical" | "Pressure" | "Electrical";
}

const SENSOR_FIELDS: SensorField[] = [
  // Thermal
  {
    key: "temperature",
    name: "Temperature",
    unit: "°C",
    normalMin: 40,
    normalMax: 75,
    criticalMin: 28,
    criticalMax: 95,
    subsystem: "Thermal",
  },
  {
    key: "motor_temperature",
    name: "Motor Temperature",
    unit: "°C",
    normalMin: 45,
    normalMax: 70,
    criticalMin: 30,
    criticalMax: 90,
    subsystem: "Thermal",
  },
  {
    key: "gearbox_temperature",
    name: "Gearbox Temperature",
    unit: "°C",
    normalMin: 50,
    normalMax: 75,
    criticalMin: 35,
    criticalMax: 95,
    subsystem: "Thermal",
  },

  // Mechanical
  {
    key: "vibration",
    name: "Vibration",
    unit: "mm/s",
    normalMin: 0.25,
    normalMax: 0.7,
    criticalMin: 0.15,
    criticalMax: 1.2,
    subsystem: "Mechanical",
  },
  {
    key: "rotation_speed",
    name: "Rotation Speed",
    unit: "RPM",
    normalMin: 1400,
    normalMax: 1600,
    criticalMin: 1100,
    criticalMax: 1800,
    subsystem: "Mechanical",
  },
  {
    key: "fan_speed",
    name: "Fan Speed",
    unit: "RPM",
    normalMin: 1100,
    normalMax: 1300,
    criticalMin: 900,
    criticalMax: 1500,
    subsystem: "Mechanical",
  },

  // Pressure & Fluid
  {
    key: "pressure",
    name: "Pressure",
    unit: "bar",
    normalMin: 22,
    normalMax: 38,
    criticalMin: 15,
    criticalMax: 50,
    subsystem: "Pressure",
  },
  {
    key: "humidity",
    name: "Humidity",
    unit: "%",
    normalMin: 30,
    normalMax: 50,
    criticalMin: 15,
    criticalMax: 75,
    subsystem: "Pressure",
  },
  {
    key: "oil_level",
    name: "Oil Level",
    unit: "%",
    normalMin: 60,
    normalMax: 80,
    criticalMin: 40,
    criticalMax: 95,
    subsystem: "Pressure",
  },

  // Electrical & Power
  {
    key: "voltage",
    name: "Voltage",
    unit: "V",
    normalMin: 200,
    normalMax: 240,
    criticalMin: 180,
    criticalMax: 260,
    subsystem: "Electrical",
  },
  {
    key: "current",
    name: "Current",
    unit: "A",
    normalMin: 4.0,
    normalMax: 6.0,
    criticalMin: 2.5,
    criticalMax: 8.5,
    subsystem: "Electrical",
  },
  {
    key: "load",
    name: "Operating Load",
    unit: "%",
    normalMin: 60,
    normalMax: 95,
    criticalMin: 30,
    criticalMax: 115,
    subsystem: "Electrical",
  },
  {
    key: "sound_level",
    name: "Sound Level",
    unit: "dB",
    normalMin: 65,
    normalMax: 80,
    criticalMin: 50,
    criticalMax: 95,
    subsystem: "Electrical",
  },
  {
    key: "active_power",
    name: "Active Power",
    unit: "kW",
    normalMin: 80,
    normalMax: 120,
    criticalMin: 50,
    criticalMax: 150,
    subsystem: "Electrical",
  },
  {
    key: "reactive_power",
    name: "Reactive Power",
    unit: "kVAR",
    normalMin: 40,
    normalMax: 60,
    criticalMin: 25,
    criticalMax: 80,
    subsystem: "Electrical",
  },
];

/* =========================================================
   SCENARIO PRESETS
========================================================= */

const PRESETS: Record<string, Record<SensorKey, number>> = {
  baseline: {
    temperature: 74.5,
    motor_temperature: 61.2,
    gearbox_temperature: 63.8,
    vibration: 0.52,
    rotation_speed: 1495,
    fan_speed: 1210,
    pressure: 29.5,
    humidity: 38.0,
    oil_level: 72.5,
    voltage: 221.0,
    current: 4.9,
    load: 78.5,
    sound_level: 73.2,
    active_power: 98.4,
    reactive_power: 49.5,
  },
  thermalOverheat: {
    temperature: 89.2,
    motor_temperature: 84.5,
    gearbox_temperature: 88.0,
    vibration: 0.68,
    rotation_speed: 1520,
    fan_speed: 980,
    pressure: 34.0,
    humidity: 31.0,
    oil_level: 54.0,
    voltage: 216.0,
    current: 5.8,
    load: 92.0,
    sound_level: 79.5,
    active_power: 115.0,
    reactive_power: 58.0,
  },
  mechanicalStress: {
    temperature: 76.0,
    motor_temperature: 64.0,
    gearbox_temperature: 71.0,
    vibration: 0.95,
    rotation_speed: 1680,
    fan_speed: 1250,
    pressure: 31.2,
    humidity: 42.0,
    oil_level: 68.0,
    voltage: 224.0,
    current: 5.6,
    load: 86.0,
    sound_level: 86.4,
    active_power: 108.0,
    reactive_power: 52.0,
  },
  electricalOverload: {
    temperature: 82.0,
    motor_temperature: 77.0,
    gearbox_temperature: 73.0,
    vibration: 0.72,
    rotation_speed: 1440,
    fan_speed: 1150,
    pressure: 36.5,
    humidity: 45.0,
    oil_level: 63.0,
    voltage: 248.0,
    current: 7.2,
    load: 108.0,
    sound_level: 82.0,
    active_power: 138.0,
    reactive_power: 72.0,
  },
};

export default function PredictionsPage() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Sensor Form State (Defaulted to Healthy Baseline)
  const [sensorValues, setSensorValues] = useState<Record<SensorKey, string>>({
    temperature: "74.5",
    motor_temperature: "61.2",
    gearbox_temperature: "63.8",
    vibration: "0.52",
    rotation_speed: "1495",
    fan_speed: "1210",
    pressure: "29.5",
    humidity: "38.0",
    oil_level: "72.5",
    voltage: "221.0",
    current: "4.9",
    load: "78.5",
    sound_level: "73.2",
    active_power: "98.4",
    reactive_power: "49.5",
  });

  const handleInputChange = (key: SensorKey, val: string) => {
    setSensorValues((prev) => ({ ...prev, [key]: val }));
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const newValues: Record<SensorKey, string> = { ...sensorValues };
    Object.keys(preset).forEach((k) => {
      const field = k as SensorKey;
      newValues[field] = String(preset[field]);
    });
    setSensorValues(newValues);
    setSuccessMsg(`Loaded ${presetKey.replace(/([A-Z])/g, " $1")} preset`);
    setTimeout(() => setSuccessMsg(""), 2500);
  };

  /* =======================================================
     LOAD INITIAL MACHINE & PREDICTIONS
  ======================================================= */

  useEffect(() => {
    async function loadData() {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          setLoading(false);
          return;
        }

        const machineRes = await fetch(`${API_URL}/api/machines`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!machineRes.ok) throw new Error("Failed to load machine data");

        const machineData = await machineRes.json();
        const items = Array.isArray(machineData)
          ? machineData
          : machineData?.items || [];
        const active =
          items.find(
            (m: Machine) => m.status?.toUpperCase() !== "DECOMMISSIONED"
          ) || items[0];

        setMachine(active || null);

        if (active?.id) {
          const predRes = await fetch(
            `${API_URL}/api/machines/${active.id}/predictions`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (predRes.ok) {
            const predData = await predRes.json();
            const predItems: Prediction[] = predData.items || [];
            if (predItems.length > 0) {
              setPrediction(predItems[0]);
              setHistory(predItems.slice(0, 15));
            }
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load prediction environment");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  /* =======================================================
     RUN PREDICTION (POST /api/machines/{id}/predict)
  ======================================================= */

  async function handleRunPrediction(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    try {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Please log in to submit predictions");
      if (!machine?.id) throw new Error("No active machine asset available");

      // Validate inputs
      const payload: Record<string, number> = {};
      for (const field of SENSOR_FIELDS) {
        const raw = sensorValues[field.key];
        if (raw === undefined || raw.trim() === "" || isNaN(Number(raw))) {
          throw new Error(`Please enter a valid numeric value for ${field.name}`);
        }
        payload[field.key] = Number(raw);
      }

      // Include legacy aliases for backward compatibility
      payload["rpm"] = payload["rotation_speed"];
      payload["power_consumption"] = payload["active_power"];

      setRunning(true);

      const response = await fetch(
        `${API_URL}/api/machines/${machine.id}/predict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Prediction request rejected by backend");
      }

      setPrediction(data);
      setHistory((prev) => [data, ...prev.slice(0, 14)]);
      setSuccessMsg("Inference completed: ML models evaluated all 15 channels!");
    } catch (err: any) {
      setError(err.message || "Failed to execute prediction");
    } finally {
      setRunning(false);
    }
  }

  const probability = prediction
    ? Math.round(Number(prediction.failure_probability) * 100)
    : 0;

  const healthScore = prediction
    ? Math.round(Number(prediction.health_score ?? (100 - probability)))
    : null;

  const riskClass =
    probability >= 50
      ? "text-[#FF3B6B]"
      : probability >= 25
      ? "text-[#F59E0B]"
      : "text-[#00D49A]";

  const riskBorder =
    probability >= 50
      ? "border-[#FF3B6B]/40 bg-[#FF3B6B]/10"
      : probability >= 25
      ? "border-[#F59E0B]/40 bg-[#F59E0B]/10"
      : "border-[#00D49A]/40 bg-[#00D49A]/10";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050511] text-[#F8FAFC]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#25203A] border-t-[#A855F7] shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
          <p className="text-sm font-semibold tracking-wide text-[#8B8BA3]">
            Loading ML Inference Workbench...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050511] text-[#F8FAFC]">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[#A855F7]/[0.05] blur-[150px]" />
        <div className="absolute right-[-5%] top-[30%] h-[500px] w-[500px] rounded-full bg-[#C084FC]/[0.04] blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {/* ===================================================
            HEADER & ACTIONS
        =================================================== */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#A855F7] shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                MACHINE LEARNING INFERENCE
              </p>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#F8FAFC]">
              Predictive Failure Diagnostics
            </h1>
            <p className="text-xs text-[#8B8BA3]">
              Supervised XGBoost failure classifier & Isolation Forest anomaly
              detector across 15 industrial sensors
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-[#25203A] bg-[#0B0B18] px-4 py-2 text-xs font-semibold text-[#8B8BA3] transition hover:border-[#A855F7]/40 hover:text-[#F8FAFC]"
            >
              ← Back to Dashboard
            </Link>

            <div className="rounded-xl border border-[#25203A] bg-[#050511] px-4 py-2 text-xs font-semibold text-[#C084FC]">
              Asset: {machine?.machine_name || "Motor 01"}
            </div>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-[#FF3B6B]/40 bg-[#FF3B6B]/10 px-4 py-3 text-xs text-[#FF3B6B]">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="font-bold hover:underline"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mt-5 rounded-xl border border-[#00D49A]/40 bg-[#00D49A]/10 px-4 py-3 text-xs font-semibold text-[#00D49A]">
            ✓ {successMsg}
          </div>
        )}

        {/* ===================================================
            MAIN WORKBENCH: FORM (LEFT) + RESULTS (RIGHT)
        =================================================== */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1.1fr]">
          {/* Left: 15-Sensor Telemetry Input Form */}
          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#25203A] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#F8FAFC]">
                  Sensor Channel Telemetry Inputs
                </h2>
                <p className="text-xs text-[#8B8BA3]">
                  Configure or load calibrated test parameters (15 total)
                </p>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                  Presets:
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset("baseline")}
                  className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-semibold text-[#00D49A] transition hover:border-[#00D49A]/40"
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("thermalOverheat")}
                  className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-semibold text-[#F59E0B] transition hover:border-[#F59E0B]/40"
                >
                  Thermal
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("mechanicalStress")}
                  className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-semibold text-[#A855F7] transition hover:border-[#A855F7]/40"
                >
                  Mechanical
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("electricalOverload")}
                  className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-semibold text-[#FF3B6B] transition hover:border-[#FF3B6B]/40"
                >
                  Overload
                </button>
              </div>
            </div>

            <form onSubmit={handleRunPrediction} className="mt-6 space-y-6">
              {/* Grouped by 4 Subsystems */}
              {(
                [
                  "Thermal",
                  "Mechanical",
                  "Pressure",
                  "Electrical",
                ] as const
              ).map((subsys) => {
                const fields = SENSOR_FIELDS.filter(
                  (f) => f.subsystem === subsys
                );
                return (
                  <div key={subsys} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#C084FC]">
                        {subsys} Subsystem
                      </span>
                      <div className="h-[1px] flex-1 bg-[#25203A]" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {fields.map((field) => (
                        <div
                          key={field.key}
                          className="rounded-xl border border-[#25203A] bg-[#050511] p-3 transition focus-within:border-[#A855F7]/50"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <label
                              htmlFor={field.key}
                              className="font-bold text-[#8B8BA3]"
                            >
                              {field.name}
                            </label>
                            <span className="font-semibold text-[#C084FC]">
                              {field.unit}
                            </span>
                          </div>

                          <input
                            id={field.key}
                            type="number"
                            step="any"
                            value={sensorValues[field.key]}
                            onChange={(e) =>
                              handleInputChange(field.key, e.target.value)
                            }
                            className="mt-2 w-full rounded-lg border border-[#25203A] bg-[#0B0B18] px-3 py-1.5 text-sm font-bold text-[#F8FAFC] outline-none transition focus:border-[#A855F7]"
                            required
                          />

                          <p className="mt-1.5 text-[9px] text-[#8B8BA3]">
                            Norm: {field.normalMin}–{field.normalMax} {field.unit}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Submit CTA */}
              <div className="pt-4 border-t border-[#25203A]">
                <button
                  type="submit"
                  disabled={running}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-6 py-3.5 text-sm font-bold text-[#F8FAFC] shadow-[0_0_30px_rgba(168,85,247,0.3)] transition duration-200 hover:scale-[1.01] disabled:opacity-50"
                >
                  {running ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#F8FAFC] border-t-transparent" />
                      <span>Executing XGBoost & Isolation Forest Models...</span>
                    </>
                  ) : (
                    <>
                      <span>Run ML Prediction (All 15 Sensors)</span>
                      <span>⚡</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right: Live Inference Output & Analytics */}
          <div className="space-y-6">
            {/* Primary Result Card */}
            <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-[#25203A] pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                    MODEL INFERENCE OUTCOME
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-[#F8FAFC]">
                    AI Diagnostic Evaluation
                  </h3>
                </div>

                {prediction ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${riskBorder} ${riskClass}`}
                  >
                    {prediction.risk_level} RISK
                  </span>
                ) : (
                  <span className="rounded-full border border-[#25203A] bg-[#050511] px-3 py-1 text-xs font-semibold text-[#8B8BA3]">
                    Awaiting Input
                  </span>
                )}
              </div>

              {!prediction ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#A855F7]/20 bg-[#A855F7]/10 text-xl text-[#C084FC]">
                    ⚡
                  </div>
                  <p className="text-sm font-semibold text-[#F8FAFC]">
                    Ready to evaluate
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#8B8BA3]">
                    Adjust sensor parameters on the left or select a preset,
                    then click Run ML Prediction to generate real-time AI results.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {/* KPI Row */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Failure Probability */}
                    <div className="rounded-xl border border-[#25203A] bg-[#050511] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                        Failure Probability
                      </p>
                      <p className={`mt-2 text-3xl font-black ${riskClass}`}>
                        {probability}%
                      </p>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-[#25203A]">
                        <div
                          className={`h-full rounded-full ${
                            probability >= 50
                              ? "bg-[#FF3B6B]"
                              : probability >= 25
                              ? "bg-[#F59E0B]"
                              : "bg-[#00D49A]"
                          }`}
                          style={{ width: `${probability}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-[#8B8BA3]">
                        {Boolean(prediction.predicted_failure)
                          ? "Failure predicted by classifier"
                          : "Within safe operational bounds"}
                      </p>
                    </div>

                    {/* Machine Health Score */}
                    <div className="rounded-xl border border-[#25203A] bg-[#050511] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                        Machine Health
                      </p>
                      <p className="mt-2 text-3xl font-black text-[#F8FAFC]">
                        {healthScore !== null ? `${healthScore}%` : "—"}
                      </p>
                      <div className="mt-3 h-1.5 w-full rounded-full bg-[#25203A]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#C084FC]"
                          style={{ width: `${healthScore ?? 0}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-[#8B8BA3]">
                        Status: {prediction.health_status}
                      </p>
                    </div>
                  </div>

                  {/* Anomaly Detection Banner */}
                  <div
                    className={`flex items-start gap-3 rounded-xl border p-4 ${
                      prediction.anomaly_detected
                        ? "border-[#FF3B6B]/40 bg-[#FF3B6B]/10"
                        : "border-[#00D49A]/40 bg-[#00D49A]/10"
                    }`}
                  >
                    <span className="text-lg">
                      {prediction.anomaly_detected ? "⚠" : "✓"}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-bold ${
                          prediction.anomaly_detected
                            ? "text-[#FF3B6B]"
                            : "text-[#00D49A]"
                        }`}
                      >
                        {prediction.anomaly_detected
                          ? "Isolation Forest: Anomaly Flagged"
                          : "Isolation Forest: Normal Signal Pattern"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[#8B8BA3]">
                        {prediction.anomaly_detected
                          ? "Multi-dimensional sensor vectors deviate from baseline industrial manifold. Component inspection recommended."
                          : "Transducer telemetry fits nominal training distribution envelope."}
                      </p>
                    </div>
                  </div>

                  {/* Recommendation Card */}
                  <div className="rounded-xl border border-[#25203A] bg-[#050511] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A855F7]">
                      AI Maintenance Action Recommendation
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#F8FAFC]">
                      {Boolean(prediction.predicted_failure)
                        ? "Schedule Immediate Maintenance Intervention"
                        : "Continue Regular Preventive Monitoring"}
                    </p>
                    <p className="mt-1.5 text-xs text-[#8B8BA3]">
                      {Boolean(prediction.predicted_failure)
                        ? "Inspect cooling circuits, bearings, and rotational alignment during next shift window."
                        : "All 15 sensor channels operating within nominal parameters. Next scheduled check is on time."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Link back to Dashboard */}
            <div className="rounded-2xl border border-[#25203A] bg-gradient-to-r from-[#111022] to-[#0B0B18] p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#F8FAFC]">
                  Ready to inspect complete telemetry?
                </p>
                <p className="text-[11px] text-[#8B8BA3]">
                  Dashboard is synced with this latest prediction
                </p>
              </div>
              <Link
                href="/"
                className="rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-4 py-2 text-xs font-bold text-[#F8FAFC] shadow-[0_0_15px_rgba(168,85,247,0.25)] transition hover:scale-[1.02]"
              >
                View in Dashboard →
              </Link>
            </div>
          </div>
        </div>

        {/* ===================================================
            PREDICTION LOG HISTORY TABLE
        =================================================== */}
        <div className="mt-10 rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between border-b border-[#25203A] pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                HISTORICAL INFERENCE LOGS
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
                Recent Prediction Audit Trail
              </h2>
            </div>
            <span className="text-xs text-[#8B8BA3]">
              {history.length} records retrieved
            </span>
          </div>

          {history.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#8B8BA3]">
              No predictions logged yet. Run a prediction above to build the
              history table.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#25203A] text-[10px] uppercase tracking-wider text-[#8B8BA3]">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Failure Prob</th>
                    <th className="py-3 px-3">Risk Level</th>
                    <th className="py-3 px-3">Health</th>
                    <th className="py-3 px-3">Anomaly</th>
                    <th className="py-3 px-3">Key Sensors (Temp / Vib / RPM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25203A]/60">
                  {history.map((row, idx) => {
                    const prob = Math.round(
                      Number(row.failure_probability) * 100
                    );
                    const isCrit = prob >= 50;
                    const isWarn = prob >= 25 && prob < 50;
                    return (
                      <tr
                        key={idx}
                        className="transition hover:bg-[#111022]"
                      >
                        <td className="py-3 px-3 font-mono text-[#8B8BA3]">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString()
                            : `#${idx + 1}`}
                        </td>
                        <td
                          className={`py-3 px-3 font-bold ${
                            isCrit
                              ? "text-[#FF3B6B]"
                              : isWarn
                              ? "text-[#F59E0B]"
                              : "text-[#00D49A]"
                          }`}
                        >
                          {prob}%
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isCrit
                                ? "bg-[#FF3B6B]/15 text-[#FF3B6B]"
                                : isWarn
                                ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                                : "bg-[#00D49A]/15 text-[#00D49A]"
                            }`}
                          >
                            {row.risk_level}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#F8FAFC]">
                          {row.health_score ?? (100 - prob)}%
                        </td>
                        <td className="py-3 px-3">
                          {row.anomaly_detected ? (
                            <span className="font-semibold text-[#FF3B6B]">
                              ⚠ Anomaly
                            </span>
                          ) : (
                            <span className="text-[#00D49A]">✓ Normal</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-[#8B8BA3]">
                          {row.input_temperature?.toFixed(1) ?? "—"}°C |{" "}
                          {row.input_vibration?.toFixed(2) ?? "—"} mm/s |{" "}
                          {Math.round(
                            row.input_rotation_speed ?? row.input_rpm ?? 0
                          )}{" "}
                          RPM
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
