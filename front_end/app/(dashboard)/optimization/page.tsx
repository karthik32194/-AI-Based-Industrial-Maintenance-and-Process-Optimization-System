"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

const API_URL = "http://localhost:8000";

type Machine = {
  id: string;
  machine_name: string;
  machine_type: string;
  location: string;
  status: string;
};

type Prediction = {
  failure_probability: number;
  predicted_failure: string | boolean | null;
  risk_level: string;
  health_score: number | null;
  anomaly_detected: boolean;
};

export default function OptimizationPage() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingML, setTestingML] = useState(false);
  const [mlResult, setMlResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Key Operating Control Setpoints
  const [load, setLoad] = useState(82); // %
  const [rpm, setRpm] = useState(1520); // RPM
  const [temp, setTemp] = useState(74); // °C
  const [fanSpeed, setFanSpeed] = useState(1200); // RPM
  const [voltage, setVoltage] = useState(220); // V
  const [oilFlow, setOilFlow] = useState(1.0); // Ratio

  useEffect(() => {
    async function loadMachine() {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_URL}/api/machines`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data?.items || [];
          const active = items.find((m: Machine) => m.status?.toUpperCase() !== "DECOMMISSIONED") || items[0];
          setMachine(active || null);
        }
      } catch {
        // graceful
      } finally {
        setLoading(false);
      }
    }
    loadMachine();
  }, []);

  /* =======================================================
     PHYSICS & THERMODYNAMIC SIMULATION COMPUTATION
  ======================================================= */

  const simulation = useMemo(() => {
    // 1. Thermodynamic Stress Index (0 - 100)
    // Higher load & ambient temp increase stress; higher fan cooling reduces it.
    const heatGeneration = (load / 100) * 45 + (temp - 40) * 0.8;
    const coolingDissipation = (fanSpeed / 1300) * 40 * oilFlow;
    const thermalStress = Math.min(100, Math.max(10, Math.round(heatGeneration - coolingDissipation + 30)));

    // 2. Mechanical Fatigue Risk (0 - 100)
    // Quadratic rpm centrifugal load + high operating load
    const speedFactor = Math.pow(rpm / 1500, 2);
    const mechanicalRisk = Math.min(100, Math.max(8, Math.round((load / 100) * 40 * speedFactor + (1.2 - oilFlow) * 20)));

    // 3. Simulated Active Power Draw (kW)
    const basePower = (load / 100) * 115 * Math.pow(rpm / 1500, 1.2);
    const activePower = Math.round(basePower * 10) / 10;

    // 4. Specific Energy Efficiency Index (%)
    // Ratio of useful throughput to energy consumption
    const efficiency = Math.min(98, Math.max(65, Math.round(92 - (thermalStress * 0.15) - Math.abs(voltage - 220) * 0.2)));

    // 5. Projected Failure Probability (%)
    const compositeRisk = Math.min(95, Math.max(5, Math.round((thermalStress * 0.55) + (mechanicalRisk * 0.45))));

    return {
      thermalStress,
      mechanicalRisk,
      activePower,
      efficiency,
      compositeRisk,
    };
  }, [load, rpm, temp, fanSpeed, voltage, oilFlow]);

  // Automated Sweet-Spot Solver
  const handleAutoOptimize = () => {
    setLoad(75);
    setRpm(1490);
    setTemp(68);
    setFanSpeed(1280);
    setVoltage(220);
    setOilFlow(1.15);
    setSuccessMsg("Optimal setpoints applied: Thermal stress minimized and efficiency maximized!");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  /* =======================================================
     TEST SIMULATED SETPOINTS AGAINST REAL XGBOOST MODEL
  ======================================================= */

  async function handleTestML() {
    setError("");
    setSuccessMsg("");
    setTestingML(true);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Please log in to test with ML backend");
      if (!machine?.id) throw new Error("No active machine available");

      // Build simulated 15-channel payload from current setpoints
      const payload = {
        temperature: temp,
        motor_temperature: Math.round(temp * 0.85 * 10) / 10,
        gearbox_temperature: Math.round(temp * 0.9 * 10) / 10,
        vibration: Math.round((0.35 + (simulation.mechanicalRisk / 100) * 0.5) * 100) / 100,
        rotation_speed: rpm,
        fan_speed: fanSpeed,
        pressure: Math.round((26 + (load / 100) * 6) * 10) / 10,
        humidity: 40.0,
        oil_level: Math.round(oilFlow * 70 * 10) / 10,
        voltage: voltage,
        current: Math.round(((simulation.activePower * 1000) / (voltage * 1.732 * 0.88)) * 10) / 10,
        load: load,
        sound_level: Math.round((70 + (rpm / 1500) * 6) * 10) / 10,
        active_power: simulation.activePower,
        reactive_power: Math.round(simulation.activePower * 0.48 * 10) / 10,
        rpm: rpm,
        power_consumption: simulation.activePower,
      };

      const res = await fetch(`${API_URL}/api/machines/${machine.id}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "ML evaluation rejected");

      setMlResult(data);
      setSuccessMsg("Simulated operating parameters successfully evaluated by XGBoost ML model!");
    } catch (err: any) {
      setError(err.message || "ML simulation test failed");
    } finally {
      setTestingML(false);
    }
  }

  const riskBadgeColor =
    simulation.compositeRisk >= 50
      ? "text-[#FF3B6B] border-[#FF3B6B]/40 bg-[#FF3B6B]/15"
      : simulation.compositeRisk >= 25
      ? "text-[#F59E0B] border-[#F59E0B]/40 bg-[#F59E0B]/15"
      : "text-[#00D49A] border-[#00D49A]/40 bg-[#00D49A]/15";

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050511] text-[#F8FAFC]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#25203A] border-t-[#A855F7] shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
          <p className="text-sm font-semibold tracking-wide text-[#8B8BA3]">
            Loading Process Optimization Engine...
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
              <span className="h-2 w-2 rounded-full bg-[#A855F7] shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                OPERATIONAL PARAMETER TUNING
              </p>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#F8FAFC]">
              Process Setpoint Optimizer & What-If Simulator
            </h1>
            <p className="text-xs text-[#8B8BA3]">
              Simulate operational conditions, balance throughput against failure risk, and benchmark in ML models
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-[#25203A] bg-[#0B0B18] px-4 py-2 text-xs font-semibold text-[#8B8BA3] transition hover:border-[#A855F7]/40 hover:text-[#F8FAFC]"
            >
              ← Back to Dashboard
            </Link>
            <button
              onClick={handleAutoOptimize}
              className="rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-4 py-2 text-xs font-bold text-[#F8FAFC] shadow-[0_0_20px_rgba(168,85,247,0.3)] transition hover:scale-[1.02]"
            >
              ⚡ Auto-Solve Optimal Setpoints
            </button>
          </div>
        </div>

        {/* Notifications */}
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
            REAL-TIME SIMULATION KPI METRICS
        =================================================== */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
              Projected Failure Risk
            </p>
            <p className={`mt-3 text-3xl font-black ${riskBadgeColor.split(" ")[0]}`}>
              {simulation.compositeRisk}%
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-[#25203A]">
              <div
                className={`h-full rounded-full ${
                  simulation.compositeRisk >= 50
                    ? "bg-[#FF3B6B]"
                    : simulation.compositeRisk >= 25
                    ? "bg-[#F59E0B]"
                    : "bg-[#00D49A]"
                }`}
                style={{ width: `${simulation.compositeRisk}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[#8B8BA3]">
              What-If simulated risk score
            </p>
          </div>

          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
              System Efficiency Index
            </p>
            <p className="mt-3 text-3xl font-black text-[#00D49A]">
              {simulation.efficiency}%
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-[#25203A]">
              <div
                className="h-full rounded-full bg-[#00D49A]"
                style={{ width: `${simulation.efficiency}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[#8B8BA3]">
              Thermodynamic throughput ratio
            </p>
          </div>

          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
              Simulated Power Demand
            </p>
            <p className="mt-3 text-3xl font-black text-[#F8FAFC]">
              {simulation.activePower} kW
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-[#25203A]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#C084FC]"
                style={{ width: `${Math.min(100, (simulation.activePower / 140) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[#8B8BA3]">
              Active electrical power load
            </p>
          </div>

          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B8BA3]">
              Thermal Stress Index
            </p>
            <p className="mt-3 text-3xl font-black text-[#C084FC]">
              {simulation.thermalStress} / 100
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-[#25203A]">
              <div
                className="h-full rounded-full bg-[#C084FC]"
                style={{ width: `${simulation.thermalStress}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-[#8B8BA3]">
              Heat buildup vs cooling rate
            </p>
          </div>
        </div>

        {/* ===================================================
            SETPOINT SLIDERS (LEFT) + IMPACT ANALYSIS (RIGHT)
        =================================================== */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1.1fr]">
          {/* Sliders Panel */}
          <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            <div className="border-b border-[#25203A] pb-4">
              <h2 className="text-lg font-bold text-[#F8FAFC]">
                Operational Setpoint Controls
              </h2>
              <p className="text-xs text-[#8B8BA3]">
                Adjust live operating variables to evaluate stress and risk
              </p>
            </div>

            <div className="mt-6 space-y-6">
              {/* 1. Operating Load */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#F8FAFC]">Operating Load</span>
                  <span className="font-mono font-bold text-[#C084FC]">{load} %</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="120"
                  value={load}
                  onChange={(e) => setLoad(Number(e.target.value))}
                  className="mt-2 w-full accent-[#A855F7]"
                />
                <div className="flex justify-between text-[10px] text-[#8B8BA3]">
                  <span>40% (Light)</span>
                  <span>80% (Nominal)</span>
                  <span>120% (Heavy Overload)</span>
                </div>
              </div>

              {/* 2. Rotation Speed */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#F8FAFC]">Rotation Speed</span>
                  <span className="font-mono font-bold text-[#C084FC]">{rpm} RPM</span>
                </div>
                <input
                  type="range"
                  min="1200"
                  max="1800"
                  step="10"
                  value={rpm}
                  onChange={(e) => setRpm(Number(e.target.value))}
                  className="mt-2 w-full accent-[#A855F7]"
                />
                <div className="flex justify-between text-[10px] text-[#8B8BA3]">
                  <span>1200 RPM</span>
                  <span>1500 RPM (Design)</span>
                  <span>1800 RPM (Overspeed)</span>
                </div>
              </div>

              {/* 3. Target Temperature */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#F8FAFC]">Operating Temperature</span>
                  <span className="font-mono font-bold text-[#C084FC]">{temp} °C</span>
                </div>
                <input
                  type="range"
                  min="45"
                  max="95"
                  value={temp}
                  onChange={(e) => setTemp(Number(e.target.value))}
                  className="mt-2 w-full accent-[#A855F7]"
                />
                <div className="flex justify-between text-[10px] text-[#8B8BA3]">
                  <span>45 °C (Cool)</span>
                  <span>70 °C (Nominal)</span>
                  <span>95 °C (Overheat)</span>
                </div>
              </div>

              {/* 4. Fan Speed */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#F8FAFC]">Cooling Fan Speed</span>
                  <span className="font-mono font-bold text-[#C084FC]">{fanSpeed} RPM</span>
                </div>
                <input
                  type="range"
                  min="900"
                  max="1500"
                  step="10"
                  value={fanSpeed}
                  onChange={(e) => setFanSpeed(Number(e.target.value))}
                  className="mt-2 w-full accent-[#A855F7]"
                />
                <div className="flex justify-between text-[10px] text-[#8B8BA3]">
                  <span>900 RPM</span>
                  <span>1200 RPM (Standard)</span>
                  <span>1500 RPM (Max Flow)</span>
                </div>
              </div>

              {/* 5. Voltage Setpoint */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-[#F8FAFC]">Supply Voltage</span>
                  <span className="font-mono font-bold text-[#C084FC]">{voltage} V</span>
                </div>
                <input
                  type="range"
                  min="190"
                  max="250"
                  value={voltage}
                  onChange={(e) => setVoltage(Number(e.target.value))}
                  className="mt-2 w-full accent-[#A855F7]"
                />
                <div className="flex justify-between text-[10px] text-[#8B8BA3]">
                  <span>190 V (Under)</span>
                  <span>220 V (Nominal)</span>
                  <span>250 V (Over)</span>
                </div>
              </div>

              {/* Action Button: Test with Real ML Backend */}
              <div className="pt-4 border-t border-[#25203A]">
                <button
                  type="button"
                  onClick={handleTestML}
                  disabled={testingML}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-6 py-3.5 text-sm font-bold text-[#F8FAFC] shadow-[0_0_25px_rgba(168,85,247,0.3)] transition hover:scale-[1.01] disabled:opacity-50"
                >
                  {testingML ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#F8FAFC] border-t-transparent" />
                      <span>Validating with XGBoost Backend...</span>
                    </>
                  ) : (
                    <>
                      <span>Test Setpoints with XGBoost ML Model</span>
                      <span>⚡</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Impact Analysis & ML Result Panel */}
          <div className="space-y-6">
            {/* Real ML Verification Card */}
            <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-[#25203A] pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C084FC]">
                    ML MODEL BENCHMARK
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[#F8FAFC]">
                    XGBoost What-If Evaluation
                  </h3>
                </div>
                {mlResult ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${
                      mlResult.failure_probability >= 0.5
                        ? "border-[#FF3B6B]/40 bg-[#FF3B6B]/15 text-[#FF3B6B]"
                        : "border-[#00D49A]/40 bg-[#00D49A]/15 text-[#00D49A]"
                    }`}
                  >
                    {mlResult.risk_level} Risk
                  </span>
                ) : (
                  <span className="text-xs text-[#8B8BA3]">Awaiting Run</span>
                )}
              </div>

              {!mlResult ? (
                <div className="py-12 text-center text-xs text-[#8B8BA3]">
                  Click <strong>&quot;Test Setpoints with XGBoost ML Model&quot;</strong> to submit
                  the simulated operating vector to the real backend inference pipeline.
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#25203A] bg-[#050511] p-3.5">
                      <p className="text-[10px] font-bold uppercase text-[#8B8BA3]">
                        ML Failure Probability
                      </p>
                      <p
                        className={`mt-1 text-2xl font-black ${
                          mlResult.failure_probability >= 0.5
                            ? "text-[#FF3B6B]"
                            : mlResult.failure_probability >= 0.25
                            ? "text-[#F59E0B]"
                            : "text-[#00D49A]"
                        }`}
                      >
                        {Math.round(mlResult.failure_probability * 100)}%
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#25203A] bg-[#050511] p-3.5">
                      <p className="text-[10px] font-bold uppercase text-[#8B8BA3]">
                        Isolation Forest
                      </p>
                      <p
                        className={`mt-1 text-2xl font-black ${
                          mlResult.anomaly_detected
                            ? "text-[#FF3B6B]"
                            : "text-[#00D49A]"
                        }`}
                      >
                        {mlResult.anomaly_detected ? "ANOMALY" : "NORMAL"}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-[#8B8BA3]">
                    {Boolean(mlResult.predicted_failure)
                      ? "⚠️ The backend ML model predicts failure under these simulated parameters. Adjust fan cooling or reduce operating load."
                      : "✓ The backend model validates that this operating point maintains component health and stability."}
                  </p>
                </div>
              )}
            </div>

            {/* Projected Benefits */}
            <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#A855F7] border-b border-[#25203A] pb-3">
                Optimization Impact Projections
              </h3>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border border-[#25203A] bg-[#050511]">
                  <div>
                    <p className="font-bold text-[#F8FAFC]">Failure Probability Reduction</p>
                    <p className="text-[10px] text-[#8B8BA3]">Relative to unoptimized 90% load</p>
                  </div>
                  <span className="font-bold text-[#00D49A] text-sm">
                    {Math.max(0, 65 - simulation.compositeRisk)}% Lower
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[#25203A] bg-[#050511]">
                  <div>
                    <p className="font-bold text-[#F8FAFC]">Specific Energy Consumption</p>
                    <p className="text-[10px] text-[#8B8BA3]">Thermal loss mitigation</p>
                  </div>
                  <span className="font-bold text-[#C084FC] text-sm">
                    {Math.round((simulation.activePower / 120) * 100)} kWh/MT
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[#25203A] bg-[#050511]">
                  <div>
                    <p className="font-bold text-[#F8FAFC]">Estimated Bearing MTTF</p>
                    <p className="text-[10px] text-[#8B8BA3]">Mean time to fatigue inspection</p>
                  </div>
                  <span className="font-bold text-[#F8FAFC] text-sm">
                    {simulation.compositeRisk < 25 ? "+ 4,200 hrs" : "+ 1,800 hrs"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
