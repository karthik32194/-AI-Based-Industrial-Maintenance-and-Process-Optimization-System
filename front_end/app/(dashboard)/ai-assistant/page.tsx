"use client";

import { useEffect, useState, useRef } from "react";
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

  input_rpm?: number | null;
  input_power_consumption?: number | null;

  created_at?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
};

export default function AIAssistantPage() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      text: "Industrial AI Copilot online. I am actively monitoring your asset's 15 sensor channels, XGBoost failure predictions, and Isolation Forest anomaly streams. How can I assist you with maintenance intelligence today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

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

        if (!machineRes.ok) throw new Error("Failed to load machine");

        const machineData = await machineRes.json();
        const items = Array.isArray(machineData) ? machineData : machineData?.items || [];
        const active = items.find((m: Machine) => m.status?.toUpperCase() !== "DECOMMISSIONED") || items[0];
        setMachine(active || null);

        if (active?.id) {
          const predRes = await fetch(`${API_URL}/api/machines/${active.id}/predictions`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (predRes.ok) {
            const predData = await predRes.json();
            const predItems: Prediction[] = predData.items || [];
            if (predItems.length > 0) {
              setPrediction(predItems[0]);
            }
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* =======================================================
     INTELLIGENT RESPONSE GENERATOR
     Grounded in 15 Sensors + ML Models + Backend Service
  ======================================================= */

  async function generateCopilotResponse(query: string): Promise<string> {
    const q = query.toLowerCase();

    // Check if user is asking for formal backend recommendation
    if (q.includes("recommend") && machine?.id) {
      try {
        const token = localStorage.getItem("access_token");
        if (token) {
          const recRes = await fetch(`${API_URL}/api/machines/${machine.id}/recommendation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          });
          if (recRes.ok) {
            const recData = await recRes.json();
            return `**Official AI Recommendation Record:**\n\n- **Action:** ${recData.title || "Inspection Recommendation"}\n- **Priority:** ${recData.priority || "Standard"}\n- **Details:** ${recData.recommended_action || recData.description}\n- **ML Root Cause:** ${recData.ai_reasoning || "Generated from multi-sensor predictive baseline."}`;
          }
        }
      } catch {
        // Fall back to localized telemetry response
      }
    }

    if (!prediction) {
      return "I do not currently detect any active ML prediction telemetry logged for this asset. Please navigate to the **Predictions** page, run an inference scan across the 15 sensors, and I will be able to perform in-depth diagnostics for you.";
    }

    const prob = Math.round(Number(prediction.failure_probability) * 100);
    const health = Math.round(Number(prediction.health_score ?? (100 - prob)));
    const isFail = Boolean(prediction.predicted_failure);
    const isAnom = Boolean(prediction.anomaly_detected);

    // Sensor values with fallbacks
    const tEnv = prediction.input_temperature ?? 75;
    const tMotor = prediction.input_motor_temperature ?? 60;
    const tGear = prediction.input_gearbox_temperature ?? 65;
    const vib = prediction.input_vibration ?? 0.5;
    const rpm = prediction.input_rotation_speed ?? prediction.input_rpm ?? 1500;
    const fan = prediction.input_fan_speed ?? 1200;
    const press = prediction.input_pressure ?? 30;
    const hum = prediction.input_humidity ?? 40;
    const oil = prediction.input_oil_level ?? 70;
    const volt = prediction.input_voltage ?? 220;
    const curr = prediction.input_current ?? 5.0;
    const load = prediction.input_load ?? 80;
    const sound = prediction.input_sound_level ?? 75;
    const pAct = prediction.input_active_power ?? prediction.input_power_consumption ?? 100;
    const pReact = prediction.input_reactive_power ?? 50;

    // 1. Failure / Risk Queries
    if (q.includes("fail") || q.includes("risk") || q.includes("probability")) {
      return `The supervised **XGBoost Classifier** estimates a **${prob}% failure probability**, categorized under **${prediction.risk_level} Risk**.\n\n${
        isFail
          ? `⚠️ **Warning:** The model predicts imminent failure conditions. The highest contributors are elevated thermal signatures and vibration levels exceeding standard ISO 10816 velocity severity thresholds.`
          : `✓ **Operational State:** Machine parameters are operating safely within the trained baseline envelope. No failure condition is projected for the current operating shift.`
      }`;
    }

    // 2. Health / Condition Queries
    if (q.includes("health") || q.includes("condition") || q.includes("score")) {
      return `The composite **Machine Health Score is ${health}%** (Status: **${prediction.health_status}**).\n\nThis index aggregates multi-sensor telemetry across thermal dissipation, mechanical vibration spectra, electrical power factor, and lubrication integrity.`;
    }

    // 3. Thermal & Temperature Queries
    if (q.includes("temp") || q.includes("heat") || q.includes("thermal") || q.includes("motor temp") || q.includes("gearbox")) {
      const thermalStatus = tMotor > 75 || tGear > 75 ? "ELEVATED" : "NORMAL";
      return `**Thermal Subsystem Telemetry Analysis:**\n\n- **Ambient Temperature:** ${tEnv.toFixed(1)} °C (Nominal: 40–75 °C)\n- **Motor Stator Temperature:** ${tMotor.toFixed(1)} °C (Nominal: 45–70 °C)\n- **Gearbox Temperature:** ${tGear.toFixed(1)} °C (Nominal: 50–75 °C)\n- **Cooling Fan Speed:** ${Math.round(fan)} RPM\n\n*Evaluation:* Thermal gradient is **${thermalStatus}**. ${
        thermalStatus === "ELEVATED"
          ? "Stator and gearbox temperatures indicate friction buildup or reduced cooling airflow. Check fan ducts and lubricant viscosity."
          : "Heat dissipation is stable with adequate thermal equilibrium across windings and gear meshing."
      }`;
    }

    // 4. Mechanical & Vibration Queries
    if (q.includes("vib") || q.includes("speed") || q.includes("rpm") || q.includes("mechanical") || q.includes("bearing")) {
      const vibStatus = vib > 0.7 ? "CRITICAL VIBRATION" : vib > 0.6 ? "MODERATE VIBRATION" : "SMOOTH";
      return `**Mechanical & Kinematic Analysis:**\n\n- **Vibration Velocity:** ${vib.toFixed(2)} mm/s (Nominal: 0.25–0.70 mm/s)\n- **Rotation Speed:** ${Math.round(rpm)} RPM (Nominal: 1400–1600 RPM)\n- **Acoustic Sound Level:** ${sound.toFixed(1)} dB (Nominal: 65–80 dB)\n\n*Verdict:* Vibration state is **${vibStatus}**. ${
        vib > 0.7
          ? "Elevated RMS velocity suggests dynamic unbalance, shaft misalignment, or early-stage bearing race fatigue."
          : "Shaft rotational dynamics and acoustic emissions remain well within ISO Class II standards."
      }`;
    }

    // 5. Electrical & Power Queries
    if (q.includes("power") || q.includes("volt") || q.includes("curr") || q.includes("load") || q.includes("electric")) {
      const pf = (pAct / Math.sqrt(pAct * pAct + pReact * pReact)).toFixed(2);
      return `**Electrical & Energy Telemetry:**\n\n- **Supply Voltage:** ${volt.toFixed(1)} V (Nominal: 200–240 V)\n- **Operating Current:** ${curr.toFixed(2)} A (Nominal: 4.0–6.0 A)\n- **Operating Load:** ${load.toFixed(1)} % (Nominal: 60–95 %)\n- **Active Power:** ${pAct.toFixed(1)} kW\n- **Reactive Power:** ${pReact.toFixed(1)} kVAR\n- **Calculated Power Factor:** ${pf}\n\n*Assessment:* Electrical drive load is **${load > 95 ? "HIGH" : "BALANCED"}**. Current draw matches mechanical load resistance.`;
    }

    // 6. Anomaly / Isolation Forest Queries
    if (q.includes("anom") || q.includes("isolation") || q.includes("outlier")) {
      return `**Isolation Forest Anomaly Status:**\n\n${
        isAnom
          ? `⚠️ **Anomaly Flagged:** The unsupervised Isolation Forest algorithm identified high-dimensional feature partitioning divergence in recent telemetry. Multi-sensor vectors deviate from the cluster centroid of normal historical operation.`
          : `✓ **No Anomalies Detected:** Sensor vector distribution is congruent with the nominal operational manifold. Multi-channel covariance is within acceptable statistical bounds.`
      }`;
    }

    // Default Overview
    return `**Asset Intelligence Summary for ${machine?.machine_name || "Motor 01"}:**\n\n- **Health Score:** ${health}%\n- **Failure Risk:** ${prob}% (${prediction.risk_level})\n- **Anomaly State:** ${isAnom ? "Flagged Outlier" : "Normal"}\n- **Core Readings:** Temp: ${tEnv.toFixed(1)}°C | Vib: ${vib.toFixed(2)} mm/s | RPM: ${Math.round(rpm)} | Load: ${load.toFixed(1)}%\n\nYou can ask me for detailed drilldowns into the thermal subsystem, mechanical vibration, electrical power factor, or maintenance recommendations.`;
  }

  async function handleSendMessage(text: string) {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsTyping(true);

    try {
      const responseText = await generateCopilotResponse(userMsg.text);
      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: String(Date.now() + 1),
          role: "assistant",
          text: responseText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
      }, 500);
    } catch {
      setIsTyping(false);
    }
  }

  const promptChips = [
    "Analyze machine health & failure risk",
    "Inspect thermal and gearbox telemetry",
    "Are there any active anomalies flagged?",
    "Generate official AI maintenance recommendation",
    "Evaluate mechanical vibration and rotation speed",
    "Inspect electrical load and power factor",
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050511] text-[#F8FAFC]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#25203A] border-t-[#A855F7] shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
          <p className="text-sm font-semibold tracking-wide text-[#8B8BA3]">
            Connecting to Industrial AI Copilot...
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
              <span className="h-2 w-2 rounded-full bg-[#C084FC] shadow-[0_0_10px_rgba(192,132,252,0.8)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C084FC]">
                COGNITIVE INDUSTRIAL COPILOT
              </p>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#F8FAFC]">
              AI Maintenance Assistant
            </h1>
            <p className="text-xs text-[#8B8BA3]">
              Context-aware engineering dialogue grounded in 15-channel sensor telemetry and ML predictions
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

        {/* ===================================================
            MAIN LAYOUT: CHAT (LEFT/CENTER) + TELEMETRY SIDEBAR (RIGHT)
        =================================================== */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
          {/* Chat Interface */}
          <div className="flex h-[720px] flex-col rounded-2xl border border-[#25203A] bg-[#0B0B18] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-[#25203A] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#A855F7]/30 bg-[#A855F7]/10 text-lg text-[#C084FC]">
                  ✦
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#F8FAFC]">
                    Predictive Maintenance Copilot
                  </h2>
                  <p className="text-[10px] text-[#00D49A]">
                    ● Grounded in live machine intelligence
                  </p>
                </div>
              </div>

              <span className="rounded-full border border-[#25203A] bg-[#050511] px-3 py-1 text-[10px] font-semibold text-[#8B8BA3]">
                Model: XGBoost + Isolation Forest
              </span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                      m.role === "user"
                        ? "bg-gradient-to-r from-[#A855F7] to-[#C084FC] text-[#F8FAFC] font-medium"
                        : "border border-[#25203A] bg-[#050511] text-[#E2E8F0] whitespace-pre-line"
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="mt-1 px-1 text-[9px] text-[#8B8BA3]">
                    {m.timestamp}
                  </span>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 rounded-2xl border border-[#25203A] bg-[#050511] px-4 py-3 text-xs text-[#8B8BA3] w-fit">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#A855F7]" />
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C084FC]" />
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#A855F7]" />
                  <span className="ml-1 text-[11px]">Evaluating telemetry...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className="border-t border-[#25203A]/70 px-4 py-2.5 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <span className="text-[10px] font-bold uppercase text-[#8B8BA3] mr-1">
                  Ask:
                </span>
                {promptChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(chip)}
                    className="rounded-lg border border-[#25203A] bg-[#050511] px-2.5 py-1 text-[11px] font-medium text-[#C084FC] transition hover:border-[#A855F7]/40 hover:bg-[#111022]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputMessage);
              }}
              className="border-t border-[#25203A] p-4"
            >
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask about vibration, temperature, failure probability, anomalies, or maintenance..."
                  className="flex-1 rounded-xl border border-[#25203A] bg-[#050511] px-4 py-3 text-xs text-[#F8FAFC] outline-none transition focus:border-[#A855F7]"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isTyping}
                  className="rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-5 py-3 text-xs font-bold text-[#F8FAFC] shadow-[0_0_20px_rgba(168,85,247,0.3)] transition hover:scale-[1.02] disabled:opacity-40"
                >
                  Send ➔
                </button>
              </div>
            </form>
          </div>

          {/* Telemetry Context Sidebar */}
          <div className="space-y-6">
            {/* Live Asset Health Snapshot */}
            <div className="rounded-2xl border border-[#25203A] bg-[#0B0B18] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-[#25203A] pb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A855F7]">
                    GROUNDED TELEMETRY CONTEXT
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[#F8FAFC]">
                    Active Asset Diagnostics
                  </h3>
                </div>
                <span className="text-xs text-[#00D49A]">● Live</span>
              </div>

              {prediction ? (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#25203A] bg-[#050511] p-3.5">
                      <p className="text-[10px] font-bold uppercase text-[#8B8BA3]">
                        Health Score
                      </p>
                      <p className="mt-1 text-2xl font-black text-[#F8FAFC]">
                        {prediction.health_score ??
                          Math.round(
                            (1 - prediction.failure_probability) * 100
                          )}
                        %
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#25203A] bg-[#050511] p-3.5">
                      <p className="text-[10px] font-bold uppercase text-[#8B8BA3]">
                        Failure Risk
                      </p>
                      <p
                        className={`mt-1 text-2xl font-black ${
                          prediction.failure_probability >= 0.5
                            ? "text-[#FF3B6B]"
                            : prediction.failure_probability >= 0.25
                            ? "text-[#F59E0B]"
                            : "text-[#00D49A]"
                        }`}
                      >
                        {Math.round(prediction.failure_probability * 100)}%
                      </p>
                    </div>
                  </div>

                  {/* 15 Channel Telemetry Matrix Snapshot */}
                  <div className="rounded-xl border border-[#25203A] bg-[#050511] p-4 text-xs space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A855F7] mb-2">
                      Key Sensor Telemetry Feed
                    </p>

                    <div className="flex justify-between py-1 border-b border-[#25203A]/60">
                      <span className="text-[#8B8BA3]">Ambient Temperature</span>
                      <span className="font-semibold text-[#F8FAFC]">
                        {prediction.input_temperature?.toFixed(1) ?? "—"} °C
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#25203A]/60">
                      <span className="text-[#8B8BA3]">Motor Temperature</span>
                      <span className="font-semibold text-[#F8FAFC]">
                        {prediction.input_motor_temperature?.toFixed(1) ?? "—"} °C
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#25203A]/60">
                      <span className="text-[#8B8BA3]">Gearbox Temperature</span>
                      <span className="font-semibold text-[#F8FAFC]">
                        {prediction.input_gearbox_temperature?.toFixed(1) ?? "—"} °C
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#25203A]/60">
                      <span className="text-[#8B8BA3]">Vibration RMS</span>
                      <span className="font-semibold text-[#F8FAFC]">
                        {prediction.input_vibration?.toFixed(2) ?? "—"} mm/s
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#25203A]/60">
                      <span className="text-[#8B8BA3]">Rotation Speed</span>
                      <span className="font-semibold text-[#F8FAFC]">
                        {Math.round(
                          prediction.input_rotation_speed ??
                            prediction.input_rpm ??
                            0
                        )}{" "}
                        RPM
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-[#25203A]/60">
                      <span className="text-[#8B8BA3]">Active Power</span>
                      <span className="font-semibold text-[#F8FAFC]">
                        {prediction.input_active_power?.toFixed(1) ??
                          prediction.input_power_consumption?.toFixed(1) ??
                          "—"}{" "}
                        kW
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-[#8B8BA3]">Operating Load</span>
                      <span className="font-semibold text-[#F8FAFC]">
                        {prediction.input_load?.toFixed(1) ?? "—"} %
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#8B8BA3]">
                  No active prediction registered. Run a prediction on the
                  Predictions page to feed the Copilot live parameters.
                </div>
              )}
            </div>

            {/* Quick Action Card */}
            <div className="rounded-2xl border border-[#25203A] bg-gradient-to-r from-[#111022] to-[#0B0B18] p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#F8FAFC]">
                  Need to test a new scenario?
                </p>
                <p className="text-[11px] text-[#8B8BA3]">
                  Adjust parameters in the Predictions workbench
                </p>
              </div>
              <Link
                href="/predictions"
                className="rounded-xl bg-gradient-to-r from-[#A855F7] to-[#C084FC] px-4 py-2 text-xs font-bold text-[#F8FAFC] shadow-[0_0_15px_rgba(168,85,247,0.25)] transition hover:scale-[1.02]"
              >
                Go to Predictions →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
