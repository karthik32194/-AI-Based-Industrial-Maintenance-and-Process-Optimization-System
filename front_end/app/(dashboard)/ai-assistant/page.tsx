"use client";

import { useEffect, useState } from "react";

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
  predicted_failure: boolean | null;
  risk_level: string;
  health_status: string;
  health_score: number;
  anomaly_detected: boolean;

  input_temperature: number;
  input_vibration: number;
  input_pressure: number;
  input_rpm: number;
  input_power_consumption: number;

  created_at?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export default function AIAssistantPage() {
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hello! I'm your AI Maintenance Assistant. Ask me about machine health, failures, anomalies, sensor readings, or maintenance recommendations.",
    },
  ]);

  const [machine, setMachine] =
    useState<Machine | null>(null);

  const [prediction, setPrediction] =
    useState<Prediction | null>(null);

  const [loading, setLoading] = useState(true);

  /* =====================================================
     LOAD REAL MACHINE + ML DATA
  ===================================================== */

  useEffect(() => {
    async function loadMachineData() {
      try {
        const token =
          localStorage.getItem("access_token");

        if (!token) {
          setLoading(false);
          return;
        }

        /* GET MACHINES */

        const machineResponse =
          await fetch(
            `${API_URL}/api/machines`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

        if (!machineResponse.ok) {
          setLoading(false);
          return;
        }

        const machineData =
          await machineResponse.json();

        const activeMachine =
          machineData?.items?.find(
            (item: Machine) =>
              item.status !==
              "DECOMMISSIONED"
          );

        if (!activeMachine) {
          setLoading(false);
          return;
        }

        setMachine(activeMachine);

        /* GET LATEST PREDICTION */

        const predictionResponse =
          await fetch(
            `${API_URL}/api/machines/${activeMachine.id}/predictions`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

        if (
          predictionResponse.ok
        ) {
          const predictionData =
            await predictionResponse.json();

          if (
            predictionData?.items?.length
          ) {
            setPrediction(
              predictionData.items[0]
            );
          }
        }
      } catch {
        // Keep assistant usable even if backend is unavailable.
      } finally {
        setLoading(false);
      }
    }

    loadMachineData();
  }, []);

  /* =====================================================
     RESPONSE GENERATOR
     Uses REAL BACKEND ML DATA
  ===================================================== */

  const getResponse = (
    question: string
  ) => {
    const q =
      question.toLowerCase();

    /* -----------------------------------------------
       No prediction available
    ------------------------------------------------ */

    if (!prediction) {
      if (
        q.includes("anomal") &&
        !q.includes("how")
      ) {
        return "No latest ML prediction is currently available. Run a prediction from the Predictions page first.";
      }

      return "I don't have a latest ML prediction available yet. Please run a prediction from the Predictions page, then ask me again.";
    }

    const failureProbability =
      Number(
        prediction.failure_probability
      ) * 100;

    const health =
      Number(
        prediction.health_score
      );

    const temperature =
      Number(
        prediction.input_temperature
      );

    const vibration =
      Number(
        prediction.input_vibration
      );

    const pressure =
      Number(
        prediction.input_pressure
      );

    const rpm =
      Number(
        prediction.input_rpm
      );

    const power =
      Number(
        prediction.input_power_consumption
      );

    const risk =
      prediction.risk_level ||
      "UNKNOWN";

    const anomaly =
      Boolean(
        prediction.anomaly_detected
      );

    const failure =
      Boolean(
        prediction.predicted_failure
      );

    /* -----------------------------------------------
       FAILURE / RISK
    ------------------------------------------------ */

    if (
      q.includes("failure") ||
      q.includes("risk")
    ) {
      if (failure) {
        return `The latest ML prediction estimates a ${failureProbability.toFixed(
          1
        )}% failure probability, classified as ${risk} risk. The model predicts a potential failure, so maintenance inspection is recommended.`;
      }

      return `The latest ML prediction estimates a ${failureProbability.toFixed(
        1
      )}% failure probability, classified as ${risk} risk. The model currently does not predict a failure.`;
    }

    /* -----------------------------------------------
       HEALTH
    ------------------------------------------------ */

    if (
      q.includes("health") ||
      q.includes("condition")
    ) {
      return `The current machine health score is ${health.toFixed(
        1
      )}%. The latest predictive model classifies the machine at ${risk} risk.`;
    }

    /* -----------------------------------------------
       TEMPERATURE
    ------------------------------------------------ */

    if (
      q.includes("temperature") ||
      q.includes("temp")
    ) {
      return `The latest machine temperature is ${temperature.toFixed(
        1
      )} °C. This reading is included in the ML model's current failure prediction.`;
    }

    /* -----------------------------------------------
       VIBRATION
    ------------------------------------------------ */

    if (
      q.includes("vibration")
    ) {
      return `The latest vibration reading is ${vibration.toFixed(
        2
      )} mm/s. Vibration is monitored by the predictive maintenance system because abnormal mechanical vibration can indicate developing equipment problems.`;
    }

    /* -----------------------------------------------
       PRESSURE
    ------------------------------------------------ */

    if (
      q.includes("pressure")
    ) {
      return `The latest pressure reading is ${pressure.toFixed(
        2
      )}. This sensor value is included in the machine's predictive analysis.`;
    }

    /* -----------------------------------------------
       RPM / ROTATION
    ------------------------------------------------ */

    if (
      q.includes("rpm") ||
      q.includes("rotation") ||
      q.includes("speed")
    ) {
      return `The latest rotation speed is ${rpm.toFixed(
        0
      )} RPM. This reading is included in the predictive maintenance model.`;
    }

    /* -----------------------------------------------
       POWER
    ------------------------------------------------ */

    if (
      q.includes("power") ||
      q.includes("electric")
    ) {
      return `The latest active power reading is ${power.toFixed(
        1
      )} kW. This sensor is included in the predictive analysis.`;
    }

    /* -----------------------------------------------
       ANOMALY
    ------------------------------------------------ */

    if (
      q.includes("anomal")
    ) {
      if (anomaly) {
        return "The latest Isolation Forest anomaly-detection result reports an anomaly. This means the current sensor pattern differs from the learned normal operating behaviour. An anomaly is not automatically the same as a predicted machine failure.";
      }

      return "The latest Isolation Forest anomaly-detection result does not report an anomaly. This is a separate ML result from the failure prediction model.";
    }

    /* -----------------------------------------------
       MAINTENANCE
    ------------------------------------------------ */

    if (
      q.includes("maintenance") ||
      q.includes("service") ||
      q.includes("repair")
    ) {
      if (
        risk === "HIGH" ||
        failure ||
        anomaly
      ) {
        return "Based on the latest ML results, maintenance attention is recommended. Review the current sensor readings and investigate the machine before continuing normal operation.";
      }

      if (
        risk === "MEDIUM"
      ) {
        return "The machine is currently at MEDIUM risk. A maintenance inspection should be scheduled while continuing to monitor the sensor readings.";
      }

      return "The latest ML prediction indicates LOW risk. Continue regular monitoring and follow the normal preventive maintenance schedule.";
    }

    /* -----------------------------------------------
       OPTIMIZATION
    ------------------------------------------------ */

    if (
      q.includes("optimization") ||
      q.includes("optimisation") ||
      q.includes("what if")
    ) {
      return "The Process Optimization module performs what-if analysis by changing operating parameters such as load, temperature, and vibration, then estimating how the predicted machine risk changes.";
    }

    /* -----------------------------------------------
       SENSOR SUMMARY
    ------------------------------------------------ */

    if (
      q.includes("sensor") ||
      q.includes("readings") ||
      q.includes("readings")
    ) {
      return `Latest sensor readings: Temperature ${temperature.toFixed(
        1
      )} °C, Vibration ${vibration.toFixed(
        2
      )} mm/s, Pressure ${pressure.toFixed(
        2
      )}, Rotation Speed ${rpm.toFixed(
        0
      )} RPM, and Power ${power.toFixed(
        1
      )} kW.`;
    }

    /* -----------------------------------------------
       MODEL
    ------------------------------------------------ */

    if (
      q.includes("model") ||
      q.includes("ai") ||
      q.includes("predictive")
    ) {
      return "The system uses a trained XGBoost failure-prediction model for failure probability and an Isolation Forest model for anomaly detection. These are separate ML outputs.";
    }

    /* -----------------------------------------------
       DEFAULT
    ------------------------------------------------ */

    return `For ${machine?.machine_name ?? "the current machine"}, I can provide information about failure risk, health, temperature, vibration, pressure, RPM, power, anomalies, maintenance, and process optimization.`;
  };

  /* =====================================================
     SEND MESSAGE
  ===================================================== */

  const sendMessage = () => {
    if (!message.trim()) return;

    const userMessage =
      message.trim();

    const response =
      getResponse(userMessage);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: userMessage,
      },
      {
        role: "assistant",
        text: response,
      },
    ]);

    setMessage("");
  };

  /* =====================================================
     QUICK QUESTION
  ===================================================== */

  const askQuestion = (
    question: string
  ) => {
    setMessage(question);
  };

  /* =====================================================
     VALUES FOR STATUS PANEL
  ===================================================== */

  const failureProbability =
    prediction
      ? Number(
          prediction.failure_probability
        ) * 100
      : 0;

  const health =
    prediction
      ? Number(
          prediction.health_score
        )
      : 0;

  const anomaly =
    prediction?.anomaly_detected ??
    false;

  const risk =
    prediction?.risk_level ??
    "NO DATA";

  const riskClass =
    risk === "HIGH"
      ? "text-red-400"
      : risk === "MEDIUM"
      ? "text-amber-400"
      : risk === "LOW"
      ? "text-emerald-400"
      : "text-zinc-500";

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <main className="min-h-screen bg-[#050511] text-white">

      {/* Purple glow */}

      <div className="pointer-events-none fixed left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-600/10 blur-[130px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-8 lg:px-10">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8">

          <div className="mb-3 flex items-center gap-2">

            <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,.8)]" />

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
              Machine Intelligence
            </p>

          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            AI Maintenance Assistant
          </h1>

          <p className="mt-2 text-sm text-zinc-400 sm:text-[15px]">
            Ask questions about machine health,
            failures, anomalies and maintenance
          </p>

        </div>

        {/* =================================================
            MACHINE STATUS
        ================================================= */}

        <section className="mb-5 rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-5">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-purple-400">
                Current Machine
              </p>

              <h2 className="mt-1 text-lg font-bold">
                {machine?.machine_name ??
                  "Machine"}
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                {machine?.machine_type ??
                  "Industrial Equipment"}
              </p>

            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

              {/* Health */}

              <div className="rounded-xl border border-white/[0.05] bg-[#090814] px-4 py-3">

                <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                  Health
                </p>

                <p className="mt-1 text-lg font-bold text-purple-300">
                  {loading
                    ? "..."
                    : `${Math.round(
                        health
                      )}%`}
                </p>

              </div>

              {/* Risk */}

              <div className="rounded-xl border border-white/[0.05] bg-[#090814] px-4 py-3">

                <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                  Risk
                </p>

                <p
                  className={`mt-1 text-sm font-bold ${riskClass}`}
                >
                  {loading
                    ? "..."
                    : risk}
                </p>

              </div>

              {/* Failure */}

              <div className="rounded-xl border border-white/[0.05] bg-[#090814] px-4 py-3">

                <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                  Failure
                </p>

                <p
                  className={`mt-1 text-lg font-bold ${
                    failureProbability >=
                    60
                      ? "text-red-400"
                      : failureProbability >=
                        30
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {loading
                    ? "..."
                    : `${failureProbability.toFixed(
                        1
                      )}%`}
                </p>

              </div>

              {/* Anomaly */}

              <div className="rounded-xl border border-white/[0.05] bg-[#090814] px-4 py-3">

                <p className="text-[8px] uppercase tracking-wider text-zinc-600">
                  Anomaly
                </p>

                <p
                  className={`mt-1 text-sm font-bold ${
                    anomaly
                      ? "text-red-400"
                      : "text-emerald-400"
                  }`}
                >
                  {loading
                    ? "..."
                    : anomaly
                    ? "Detected"
                    : "Normal"}
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <div className="grid gap-5 lg:grid-cols-3">

          {/* =================================================
              CHAT
          ================================================= */}

          <section className="overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0d0c1a] shadow-xl lg:col-span-2">

            {/* Chat Header */}

            <div className="border-b border-white/[0.06] p-6">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">

                  <svg
                    className="h-6 w-6 text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="3"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 10h.01M16 10h.01M8 14c1.5 1.5 6.5 1.5 8 0"
                    />
                  </svg>

                </div>

                <div>

                  <h2 className="text-lg font-bold">
                    Assistant Chat
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    Get maintenance insights from
                    the latest ML prediction
                  </p>

                </div>

              </div>

            </div>

            {/* Messages */}

            <div className="h-[480px] overflow-y-auto p-6">

              <div className="space-y-5">

                {messages.map(
                  (msg, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        msg.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >

                      <div className="flex max-w-[82%] items-start gap-3">

                        {msg.role ===
                          "assistant" && (
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">

                            <svg
                              className="h-4 w-4 text-purple-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 3v2M5.6 6.1l1.4 1.4M3 12h2m.6 5.9 1.4-1.4M12 19v2m5-2.1-1.4-1.4M19 12h2m-3.1-5.9-1.4 1.4"
                              />

                              <circle
                                cx="12"
                                cy="12"
                                r="4"
                              />
                            </svg>

                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            msg.role ===
                            "user"
                              ? "bg-purple-600 text-white"
                              : "border border-white/[0.06] bg-[#090814] text-zinc-300"
                          }`}
                        >

                          <p className="text-sm leading-6">
                            {msg.text}
                          </p>

                        </div>

                      </div>

                    </div>
                  )
                )}

              </div>

            </div>

            {/* Input */}

            <div className="border-t border-white/[0.06] p-5">

              <div className="flex gap-3">

                <input
                  type="text"
                  value={message}
                  onChange={(e) =>
                    setMessage(
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter"
                    ) {
                      sendMessage();
                    }
                  }}
                  placeholder="Ask about machine condition..."
                  className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[#090814] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                />

                <button
                  type="button"
                  onClick={sendMessage}
                  className="shrink-0 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 active:scale-[0.98]"
                >
                  Send
                </button>

              </div>

            </div>

          </section>

          {/* =================================================
              QUICK QUESTIONS
          ================================================= */}

          <section className="rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 shadow-xl">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">

                <svg
                  className="h-5 w-5 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
                  />
                </svg>

              </div>

              <div>

                <h2 className="text-lg font-bold">
                  Quick Questions
                </h2>

                <p className="mt-1 text-xs text-zinc-500">
                  Ask about current ML results
                </p>

              </div>

            </div>

            <div className="mt-6 space-y-3">

              {[
                "What is the current failure risk?",
                "What is the current machine health?",
                "What are the current sensor readings?",
                "Are there any anomalies?",
                "What maintenance is recommended?",
                "How does anomaly detection work?",
                "How does process optimization work?",
              ].map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() =>
                    askQuestion(
                      question
                    )
                  }
                  className="w-full rounded-xl border border-white/[0.05] bg-[#090814] p-4 text-left text-sm text-zinc-300 transition hover:border-purple-500/20 hover:bg-purple-500/[0.05] hover:text-purple-300"
                >
                  {question}
                </button>
              ))}

            </div>

          </section>

        </div>

        {/* =================================================
            CURRENT SENSOR SNAPSHOT
        ================================================= */}

        <section className="mt-5 rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 shadow-xl">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-purple-400">
                ML Telemetry
              </p>

              <h2 className="mt-1 text-xl font-bold">
                Current Sensor Snapshot
              </h2>

            </div>

            <span className="flex items-center gap-2 rounded-full border border-emerald-400/10 px-3 py-1.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Backend Data
            </span>

          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">

            {[
              {
                name: "Temperature",
                value:
                  prediction?.input_temperature,
                unit: "°C",
              },
              {
                name: "Vibration",
                value:
                  prediction?.input_vibration,
                unit: "mm/s",
              },
              {
                name: "Pressure",
                value:
                  prediction?.input_pressure,
                unit: "",
              },
              {
                name: "Rotation Speed",
                value:
                  prediction?.input_rpm,
                unit: "RPM",
              },
              {
                name: "Power",
                value:
                  prediction?.input_power_consumption,
                unit: "kW",
              },
            ].map((sensor) => (
              <div
                key={sensor.name}
                className="rounded-xl border border-white/[0.05] bg-[#090814] p-4"
              >

                <p className="text-[9px] uppercase tracking-wider text-zinc-600">
                  {sensor.name}
                </p>

                <p className="mt-3 text-2xl font-black text-white">
                  {sensor.value ??
                    "—"}

                  {sensor.unit && (
                    <span className="ml-1 text-xs font-normal text-zinc-600">
                      {sensor.unit}
                    </span>
                  )}
                </p>

              </div>
            ))}

          </div>

        </section>

        {/* =================================================
            AI SYSTEM CAPABILITIES
        ================================================= */}

        <section className="mt-5 rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 shadow-xl md:p-7">

          <div className="border-b border-white/[0.06] pb-5">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">

                <svg
                  className="h-5 w-5 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l2.5 2.5"
                  />
                </svg>

              </div>

              <div>

                <h2 className="text-xl font-bold">
                  AI System Capabilities
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Intelligence modules available
                  in the maintenance system
                </p>

              </div>

            </div>

          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <div className="rounded-xl border border-purple-500/10 bg-[#090814] p-5 transition hover:border-purple-500/25">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                ◇
              </div>

              <p className="mt-4 font-semibold text-purple-300">
                Failure Prediction
              </p>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                XGBoost predicts machine failure
                probability from sensor and time
                features.
              </p>

            </div>

            <div className="rounded-xl border border-purple-500/10 bg-[#090814] p-5 transition hover:border-purple-500/25">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                ◌
              </div>

              <p className="mt-4 font-semibold text-purple-300">
                Anomaly Detection
              </p>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Isolation Forest identifies unusual
                sensor behaviour.
              </p>

            </div>

            <div className="rounded-xl border border-purple-500/10 bg-[#090814] p-5 transition hover:border-purple-500/25">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                ✓
              </div>

              <p className="mt-4 font-semibold text-purple-300">
                Maintenance Advice
              </p>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Recommendations are based on the
                current predictive condition.
              </p>

            </div>

            <div className="rounded-xl border border-purple-500/10 bg-[#090814] p-5 transition hover:border-purple-500/25">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                ⇄
              </div>

              <p className="mt-4 font-semibold text-purple-300">
                Optimization
              </p>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                What-if analysis explores operating
                conditions that may reduce predicted
                machine risk.
              </p>

            </div>

          </div>

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-zinc-600">

          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

          AI Assistant Ready

        </div>

      </div>
    </main>
  );
}