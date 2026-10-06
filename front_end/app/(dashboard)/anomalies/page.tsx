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

type AnomalyRecord = {
  id: string;
  machine_id: string;
  anomaly_score: number;
  anomaly_type: string | null;
  description: string | null;
  temperature?: number | null;
  vibration?: number | null;
  pressure?: number | null;
  rpm?: number | null;
  power_consumption?: number | null;
  status: string;
  detected_at: string;
};

type Prediction = {
  id?: string;
  machine_id?: string;
  failure_probability: number;
  predicted_failure: string | boolean | null;
  risk_level: string;
  health_status: string;
  health_score: number | null;
  anomaly_detected: boolean;

  input_temperature?: number | null;
  input_motor_temperature?: number | null;
  input_gearbox_temperature?: number | null;
  input_vibration?: number | null;
  input_rotation_speed?: number | null;
  input_fan_speed?: number | null;
  input_pressure?: number | null;
  input_humidity?: number | null;
  input_oil_level?: number | null;
  input_voltage?: number | null;
  input_current?: number | null;
  input_load?: number | null;
  input_sound_level?: number | null;
  input_active_power?: number | null;
  input_reactive_power?: number | null;

  created_at?: string;
};

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

interface SensorMetadata {
  key: SensorKey;
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  criticalMin: number;
  criticalMax: number;
  category: "Thermal" | "Mechanical" | "Fluid" | "Electrical";
}

const SENSORS: SensorMetadata[] = [
  { key: "temperature", name: "Temperature", unit: "°C", normalMin: 40, normalMax: 75, criticalMin: 28, criticalMax: 95, category: "Thermal" },
  { key: "motor_temperature", name: "Motor Temperature", unit: "°C", normalMin: 45, normalMax: 70, criticalMin: 30, criticalMax: 90, category: "Thermal" },
  { key: "gearbox_temperature", name: "Gearbox Temperature", unit: "°C", normalMin: 50, normalMax: 75, criticalMin: 35, criticalMax: 95, category: "Thermal" },
  { key: "vibration", name: "Vibration", unit: "mm/s", normalMin: 0.25, normalMax: 0.70, criticalMin: 0.15, criticalMax: 1.20, category: "Mechanical" },
  { key: "rotation_speed", name: "Rotation Speed", unit: "RPM", normalMin: 1400, normalMax: 1600, criticalMin: 1100, criticalMax: 1800, category: "Mechanical" },
  { key: "fan_speed", name: "Fan Speed", unit: "RPM", normalMin: 1100, normalMax: 1300, criticalMin: 900, criticalMax: 1500, category: "Mechanical" },
  { key: "pressure", name: "Pressure", unit: "bar", normalMin: 22, normalMax: 38, criticalMin: 15, criticalMax: 50, category: "Fluid" },
  { key: "humidity", name: "Humidity", unit: "%", normalMin: 30, normalMax: 50, criticalMin: 15, criticalMax: 75, category: "Fluid" },
  { key: "oil_level", name: "Oil Level", unit: "%", normalMin: 60, normalMax: 80, criticalMin: 40, criticalMax: 95, category: "Fluid" },
  { key: "voltage", name: "Voltage", unit: "V", normalMin: 200, normalMax: 240, criticalMin: 180, criticalMax: 260, category: "Electrical" },
  { key: "current", name: "Current", unit: "A", normalMin: 4.0, normalMax: 6.0, criticalMin: 2.5, criticalMax: 8.5, category: "Electrical" },
  { key: "load", name: "Operating Load", unit: "%", normalMin: 60, normalMax: 95, criticalMin: 30, criticalMax: 115, category: "Electrical" },
  { key: "sound_level", name: "Sound Level", unit: "dB", normalMin: 65, normalMax: 80, criticalMin: 50, criticalMax: 95, category: "Electrical" },
  { key: "active_power", name: "Active Power", unit: "kW", normalMin: 80, normalMax: 120, criticalMin: 50, criticalMax: 150, category: "Electrical" },
  { key: "reactive_power", name: "Reactive Power", unit: "kVAR", normalMin: 40, normalMax: 60, criticalMin: 25, criticalMax: 80, category: "Electrical" },
];

const PRESETS: Record<string, Record<SensorKey, number>> = {
  cleanSignal: {
    temperature: 74.5, motor_temperature: 61.2, gearbox_temperature: 63.8,
    vibration: 0.52, rotation_speed: 1495, fan_speed: 1210,
    pressure: 29.5, humidity: 38.0, oil_level: 72.5,
    voltage: 221.0, current: 4.9, load: 78.5, sound_level: 73.2,
    active_power: 98.4, reactive_power: 49.5,
  },
  thermalSpike: {
    temperature: 92.4, motor_temperature: 87.5, gearbox_temperature: 89.0,
    vibration: 0.65, rotation_speed: 1530, fan_speed: 950,
    pressure: 33.0, humidity: 32.0, oil_level: 52.0,
    voltage: 218.0, current: 5.7, load: 91.0, sound_level: 78.0,
    active_power: 112.0, reactive_power: 57.0,
  },
  vibrationAnomaly: {
    temperature: 77.0, motor_temperature: 65.0, gearbox_temperature: 72.0,
    vibration: 1.15, rotation_speed: 1720, fan_speed: 1260,
    pressure: 31.0, humidity: 41.0, oil_level: 66.0,
    voltage: 222.0, current: 5.8, load: 88.0, sound_level: 89.5,
    active_power: 110.0, reactive_power: 53.0,
  },
  multiDivergence: {
    temperature: 88.0, motor_temperature: 82.0, gearbox_temperature: 81.0,
    vibration: 0.98, rotation_speed: 1650, fan_speed: 1020,
    pressure: 42.0, humidity: 55.0, oil_level: 48.0,
    voltage: 245.0, current: 7.1, load: 109.0, sound_level: 84.0,
    active_power: 135.0, reactive_power: 68.0,
  },
};

export default function AnomaliesPage() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [latestResult, setLatestResult] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [sensorValues, setSensorValues] = useState<Record<SensorKey, string>>({
    temperature: "74.5", motor_temperature: "61.2", gearbox_temperature: "63.8",
    vibration: "0.52", rotation_speed: "1495", fan_speed: "1210",
    pressure: "29.5", humidity: "38.0", oil_level: "72.5",
    voltage: "221.0", current: "4.9", load: "78.5", sound_level: "73.2",
    active_power: "98.4", reactive_power: "49.5",
  });

  const handleInputChange = (key: SensorKey, val: string) => {
    setSensorValues((prev) => ({ ...prev, [key]: val }));
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const newVals = { ...sensorValues };
    Object.keys(preset).forEach((k) => {
      newVals[k as SensorKey] = String(preset[k as SensorKey]);
    });
    setSensorValues(newVals);
    setSuccessMsg(`Applied ${presetKey.replace(/([A-Z])/g, " $1")} configuration`);
    setTimeout(() => setSuccessMsg(""), 2500);
  };

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

        if (!machineRes.ok) throw new Error("Failed to load machine asset");

        const machineData = await machineRes.json();
        const items = Array.isArray(machineData) ? machineData : machineData?.items || [];
        const active = items.find((m: Machine) => m.status?.toUpperCase() !== "DECOMMISSIONED") || items[0];
        setMachine(active || null);

        if (active?.id) {
          const [anomRes, predRes] = await Promise.all([
            fetch(`${API_URL}/api/machines/${active.id}/anomalies`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_URL}/api/machines/${active.id}/predictions`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

          if (anomRes.ok) {
            const anomData = await anomRes.json();
            setAnomalies(anomData.items || []);
          }

          if (predRes.ok) {
            const predData = await predRes.json();
            const predItems: Prediction[] = predData.items || [];
            setPredictions(predItems);
            if (predItems.length > 0) {
              setLatestResult(predItems[0]);
            }
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load anomaly detection center");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  async function handleScanAnomalies(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    try {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Please log in to run anomaly scan");
      if (!machine?.id) throw new Error("No active machine asset available");

      const payload: Record<string, number> = {};
      for (const field of SENSORS) {
        const val = sensorValues[field.key];
        if (val === undefined || val.trim() === "" || isNaN(Number(val))) {
          throw new Error(`Please enter a valid numeric value for ${field.name}`);
        }
        payload[field.key] = Number(val);
      }
      payload["rpm"] = payload["rotation_speed"];
      payload["power_consumption"] = payload["active_power"];

      setRunning(true);

      const response = await fetch(`${API_URL}/api/machines/${machine.id}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Anomaly detection rejected by backend");
      }

      setLatestResult(data);

      // Refresh anomaly list
      const anomRes = await fetch(`${API_URL}/api/machines/${machine.id}/anomalies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (anomRes.ok) {
        const anomData = await anomRes.json();
        setAnomalies(anomData.items || []);
      }

      setSuccessMsg(
        data.anomaly_detected
          ? "Isolation Forest Scan: Anomaly Detected!"
          : "Isolation Forest Scan: Normal Behavior Confirmed"
      );
    } catch (err: any) {
      setError(err.message || "Anomaly scan execution failed");
    } finally {
      setRunning(false);
    }
  }

  // Calculate flagged sensors from sensorValues
  const flaggedSensors = useMemo(() => {
    return SENSORS.filter((s) => {
      const val = Number(sensorValues[s.key]);
      return val < s.normalMin || val > s.normalMax;
    });
  }, [sensorValues]);

  const totalAnomaliesCount = useMemo(() => {
    const fromRecords = anomalies.length;
    const fromPredictions = predictions.filter((p) => p.anomaly_detected).length;
    return Math.max(fromRecords, fromPredictions);
  }, [anomalies, predictions]);

  const anomalyRate = useMemo(() => {
    if (predictions.length === 0) return 0;
    const count = predictions.filter((p) => p.anomaly_detected).length;
    return Math.round((count / predictions.length) * 100);
  }, [predictions]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050511] text-[#F8FAFC]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#25203A] border-t-[#A855F7] shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
          <p className="text-sm font-semibold tracking-wide text-[#8B8BA3]">
            Loading Isolation Forest Anomaly Workbench...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050511] text-[#F8FAFC]">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[15%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[#A855F7]/[0.05] blur-[150px]" />
        <div className="absolute right-[-5%] top-[25%] h-[500px] w-[500px] rounded-full bg-[#C084FC]/[0.04] blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-[1680px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00D49A] shadow-[0_0_10px_rgba(0,212,154,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00D49A]">
                UNSUPERVISED ANOMALY DETECTION
              </p>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#F8FAFC]">
              Isolation Forest Anomaly Workbench
            </h1>
            <p className="text-xs text-[#8B8BA3]">
              High-dimensional outlier partitioning across 15 industrial sensor channels
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
              Machine: {machine?.machine_name || "Motor 01"}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-5 rounded-xl border border-[#FF3B6B]/40 bg-[#FF3B6B]/10 px-4 py-3 text-xs text-[#FF3B6B]">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-5 rounded-xl border border-[#00D49A]/40 bg-[#00D49A]/10 px-4 py-3 text-xs font-semibold text-[#00D49A]">
            ✓ {successMsg}
          </div>
        )}

        {/* ===================================================
            KPI SUMMARY STATS
        =================================================== */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
              Active Anomaly State
            </p>
            <p
              className={`mt-3 text-3xl font-black ${
                latestResult?.anomaly_detected
                  ? "text-[#FF3B6B]"
                  : "text-[#00D49A]"
              }`}
            >
              {latestResult
                ? latestResult.anomaly_detected
                  ? "FLAGGED"
                  : "NOMINAL"
                : "—"}
            </p>
            <p className="mt-2 text-[10px] text-[#8B8BA3]">
              Latest Isolation Forest evaluation
            </p>
          </div>

          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
              Total Flagged Events
            </p>
            <p className="mt-3 text-3xl font-black text-[#F8FAFC]">
              {totalAnomaliesCount}
            </p>
            <p className="mt-2 text-[10px] text-[#8B8BA3]">
              Historical logged outliers
            </p>
          </div>

          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
              Historical Anomaly Rate
            </p>
            <p className="mt-3 text-3xl font-black text-[#F59E0B]">
              {anomalyRate}%
            </p>
            <p className="mt-2 text-[10px] text-[#8B8BA3]">
              Relative to evaluated predictions
            </p>
          </div>

          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
              Model Contamination
            </p>
            <p className="mt-3 text-3xl font-black text-[#C084FC]">0.05</p>
            <p className="mt-2 text-[10px] text-[#8B8BA3]">
              5% outlier expected threshold
            </p>
          </div>
        </div>

        {/* ===================================================
            MAIN WORKBENCH: SCANNER (LEFT) + DIAGNOSTICS (RIGHT)
        =================================================== */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1.1fr]">
          {/* Scanner Form */}
          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#25203A] pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#F8FAFC]">
                  Multi-Sensor Anomaly Scanner
                </h2>
                <p className="text-xs text-[#8B8BA3]">
                  Inject or simulate test vectors across all 15 transducer channels
                </p>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
                  Presets:
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset("cleanSignal")}
                  className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-semibold text-[#00D49A] hover:border-[#00D49A]/40"
                >
                  Clean
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("thermalSpike")}
                  className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-semibold text-[#F59E0B] hover:border-[#F59E0B]/40"
                >
                  Thermal Spike
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("vibrationAnomaly")}
                  className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-semibold text-[#A855F7] hover:border-[#A855F7]/40"
                >
                  Vibration
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("multiDivergence")}
                  className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-semibold text-[#FF3B6B] hover:border-[#FF3B6B]/40"
                >
                  Divergence
                </button>
              </div>
            </div>

            <form onSubmit={handleScanAnomalies} className="mt-6 space-y-6">
              {(["Thermal", "Mechanical", "Fluid", "Electrical"] as const).map(
                (cat) => {
                  const fields = SENSORS.filter((s) => s.category === cat);
                  return (
                    <div key={cat} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#C084FC]">
                          {cat} Transducers
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
                              Range: {field.normalMin}–{field.normalMax} {field.unit}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              )}

              <div className="pt-4 border-t border-[#25203A]">
                <button
                  type="submit"
                  disabled={running}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-6 py-3.5 text-sm font-bold text-[#F8FAFC] shadow-[0_0_30px_rgba(168,85,247,0.3)] transition duration-200 hover:scale-[1.01] disabled:opacity-50"
                >
                  {running ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#F8FAFC] border-t-transparent" />
                      <span>Scanning Multi-Sensor Manifold...</span>
                    </>
                  ) : (
                    <>
                      <span>Scan for Anomalies (Isolation Forest)</span>
                      <span>🔎</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Diagnostics Panel */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-[#25203A] pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00D49A]">
                    DETECTION VERDICT
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-[#F8FAFC]">
                    Isolation Forest Diagnosis
                  </h3>
                </div>

                {latestResult && (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                      latestResult.anomaly_detected
                        ? "border-[#FF3B6B]/40 bg-[#FF3B6B]/15 text-[#FF3B6B]"
                        : "border-[#00D49A]/40 bg-[#00D49A]/15 text-[#00D49A]"
                    }`}
                  >
                    {latestResult.anomaly_detected ? "ANOMALY" : "NORMAL"}
                  </span>
                )}
              </div>

              {!latestResult ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#00D49A]/20 bg-[#00D49A]/10 text-xl text-[#00D49A]">
                    ✓
                  </div>
                  <p className="text-sm font-semibold text-[#F8FAFC]">
                    Scanner Ready
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#8B8BA3]">
                    Execute an anomaly scan on the left to verify if current
                    telemetry vector deviates from baseline.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-6">
                  {/* Verdict Banner */}
                  <div
                    className={`rounded-xl border p-4 ${
                      latestResult.anomaly_detected
                        ? "border-[#FF3B6B]/40 bg-[#FF3B6B]/10"
                        : "border-[#00D49A]/40 bg-[#00D49A]/10"
                    }`}
                  >
                    <p
                      className={`text-sm font-bold ${
                        latestResult.anomaly_detected
                          ? "text-[#FF3B6B]"
                          : "text-[#00D49A]"
                      }`}
                    >
                      {latestResult.anomaly_detected
                        ? "Isolation Forest Outlier Detected"
                        : "Nominal Operating State Verified"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#8B8BA3]">
                      {latestResult.anomaly_detected
                        ? "Sensor readings exhibit significant partition depth divergence from the training manifold. Telemetry indicates atypical physical stress."
                        : "Transducer telemetry correlates cleanly with normal baseline distributions. No unexpected variance identified."}
                    </p>
                  </div>

                  {/* Channel Divergence Table */}
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#8B8BA3]">
                        Channel Range Divergence
                      </p>
                      <span className="text-[11px] font-semibold text-[#C084FC]">
                        {flaggedSensors.length} of 15 channels out of range
                      </span>
                    </div>

                    {flaggedSensors.length === 0 ? (
                      <p className="mt-3 text-xs text-[#00D49A]">
                        ✓ All 15 channels are currently within normal operating
                        boundaries.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {flaggedSensors.map((s) => {
                          const val = Number(sensorValues[s.key]);
                          const isHigh = val > s.normalMax;
                          return (
                            <div
                              key={s.key}
                              className="flex items-center justify-between rounded-lg border border-[#25203A] bg-[#050511] px-3 py-2 text-xs"
                            >
                              <div>
                                <span className="font-bold text-[#F8FAFC]">
                                  {s.name}
                                </span>
                                <span className="ml-2 font-mono text-[#8B8BA3]">
                                  ({val} {s.unit})
                                </span>
                              </div>
                              <span
                                className={`font-semibold ${
                                  val > s.criticalMax || val < s.criticalMin
                                    ? "text-[#FF3B6B]"
                                    : "text-[#F59E0B]"
                                }`}
                              >
                                {isHigh ? "Above Normal" : "Below Normal"} (Norm:{" "}
                                {s.normalMin}–{s.normalMax})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Link back to Dashboard */}
            <div className="rounded-2xl border border-[#25203A] bg-gradient-to-r from-[#111022] to-[#0B0B18] p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#F8FAFC]">
                  Inspect anomaly timeline on Dashboard?
                </p>
                <p className="text-[11px] text-[#8B8BA3]">
                  Real-time timeline tracks all recent evaluations
                </p>
              </div>
              <Link
                href="/"
                className="rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-4 py-2 text-xs font-bold text-[#F8FAFC] shadow-[0_0_15px_rgba(168,85,247,0.25)] transition hover:scale-[1.02]"
              >
                Go to Dashboard →
              </Link>
            </div>
          </div>
        </div>

        {/* ===================================================
            ANOMALY LOG TABLE
        =================================================== */}
        <div className="mt-10 rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between border-b border-[#25203A] pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00D49A]">
                REGISTERED ANOMALY RECORDS
              </p>
              <h2 className="mt-1 text-xl font-bold text-[#F8FAFC]">
                Historical Outlier Audit Trail
              </h2>
            </div>
            <span className="text-xs text-[#8B8BA3]">
              {anomalies.length} anomaly records registered
            </span>
          </div>

          {anomalies.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#8B8BA3]">
              No standalone anomaly records recorded yet. Anomalies flagged
              during prediction scans will be logged automatically.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#25203A] text-[10px] uppercase tracking-wider text-[#8B8BA3]">
                    <th className="py-3 px-3">Detected At</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Score</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#25203A]/60">
                  {anomalies.map((a, idx) => (
                    <tr key={idx} className="transition hover:bg-[#111022]">
                      <td className="py-3 px-3 font-mono text-[#8B8BA3]">
                        {new Date(a.detected_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#F8FAFC]">
                        {a.anomaly_type || "Isolation Outlier"}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#FF3B6B]">
                        {a.anomaly_score?.toFixed(3) ?? "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-[#FF3B6B]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#FF3B6B]">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#8B8BA3]">
                        {a.description || "Unusual multi-channel sensor variance."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
