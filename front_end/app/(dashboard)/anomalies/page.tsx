"use client";

import { useEffect, useState } from "react";

type Anomaly = {
  id: string;
  machine_id: string;
  anomaly_score: number;
  anomaly_type: string | null;
  description: string | null;
  temperature: number | null;
  vibration: number | null;
  pressure: number | null;
  rpm: number | null;
  power_consumption: number | null;
  status: string;
  detected_at: string;
};

type PredictionResult = {
  anomaly_detected: boolean;
  failure_probability: number;
  health_score: number;
};

function SensorIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    temperature: (
      <>
        <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z" />
        <path d="M12 12V6" />
      </>
    ),
    vibration: (
      <path d="M3 12h3l2-6 4 12 2-6h3l2-3 2 3" />
    ),
    pressure: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ),
    rpm: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      </>
    ),
    power: (
      <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />
    ),
  };

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10">
      <svg
        className="h-5 w-5 text-purple-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icons[type]}
      </svg>
    </div>
  );
}

function ResultIcon({ detected }: { detected: boolean }) {
  return (
    <div
      className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
        detected ? "bg-rose-500/10" : "bg-emerald-500/10"
      }`}
    >
      {detected ? (
        <svg
          className="h-7 w-7 text-rose-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v4m0 4h.01M10.3 3.8 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"
          />
        </svg>
      ) : (
        <svg
          className="h-7 w-7 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m5 12 4 4L19 6"
          />
        </svg>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const value = status?.toUpperCase() || "UNKNOWN";

  if (value === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
          <span className="relative h-2 w-2 rounded-full bg-rose-400" />
        </span>
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-500/20 bg-zinc-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
      <span className="h-2 w-2 rounded-full bg-zinc-400" />
      {value}
    </span>
  );
}

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);

  const [temperature, setTemperature] = useState("");
  const [vibration, setVibration] = useState("");
  const [pressure, setPressure] = useState("");
  const [rpm, setRpm] = useState("");
  const [powerConsumption, setPowerConsumption] = useState("");

  async function getActiveMachine() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      throw new Error("Please login first.");
    }

    const response = await fetch(
      "http://localhost:8000/api/machines",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.detail || "Failed to load machines"
      );
    }

    const machine = data.items?.find(
      (m: { status: string }) =>
        m.status !== "DECOMMISSIONED"
    );

    if (!machine) {
      throw new Error("No active machine found.");
    }

    return {
      machine,
      token,
    };
  }

  async function loadAnomalies() {
    try {
      const { machine, token } = await getActiveMachine();

      const response = await fetch(
        `http://localhost:8000/api/machines/${machine.id}/anomalies`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load anomalies"
        );
      }

      setAnomalies(data.items || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load anomalies"
      );
    } finally {
      setLoading(false);
    }
  }

  async function runAnomalyDetection() {
    try {
      setError("");
      setResult(null);

      if (
        temperature === "" ||
        vibration === "" ||
        pressure === "" ||
        rpm === "" ||
        powerConsumption === ""
      ) {
        setError("Please enter all sensor values.");
        return;
      }

      setRunning(true);

      const { machine, token } = await getActiveMachine();

      const response = await fetch(
        `http://localhost:8000/api/machines/${machine.id}/predict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            temperature: Number(temperature),
            vibration: Number(vibration),
            pressure: Number(pressure),
            rpm: Number(rpm),
            power_consumption: Number(powerConsumption),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Anomaly detection failed"
        );
      }

      setResult({
        anomaly_detected: data.anomaly_detected,
        failure_probability: data.failure_probability,
        health_score: data.health_score,
      });

      const anomalyResponse = await fetch(
        `http://localhost:8000/api/machines/${machine.id}/anomalies`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const anomalyData = await anomalyResponse.json();

      if (anomalyResponse.ok) {
        setAnomalies(anomalyData.items || []);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Anomaly detection failed"
      );
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    loadAnomalies();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050511] px-6 py-8 text-white md:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="h-10 w-52 animate-pulse rounded-lg bg-white/10" />
          <div className="mt-3 h-4 w-96 animate-pulse rounded bg-white/5" />

          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-8">
            <p className="text-sm text-zinc-500">
              Loading anomaly detection system...
            </p>
          </div>
        </div>
      </main>
    );
  }

  const activeAnomalies = anomalies.filter(
    (anomaly) =>
      anomaly.status?.toUpperCase() === "ACTIVE"
  );

  const highestScore =
    anomalies.length > 0
      ? Math.max(
          ...anomalies.map(
            (anomaly) => anomaly.anomaly_score
          )
        )
      : 0;

  return (
    <main className="min-h-screen bg-[#050511] text-white">
      <div className="pointer-events-none fixed left-1/2 top-0 -z-0 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-600/10 blur-[130px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 md:px-8 lg:px-10">
        {/* HEADER */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
              Machine Intelligence
            </p>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Anomalies
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-[15px]">
            Detect unusual machine behaviour using AI-based
            anomaly detection.
          </p>
        </div>

        {/* RUN DETECTION */}
        <section className="overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0d0c1a] shadow-xl">
          <div className="border-b border-white/[0.06] px-6 py-5 md:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
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
                    d="M12 3a9 9 0 1 0 9 9"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 7v5l3 2"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-lg font-bold">
                  Run Anomaly Detection
                </h2>

                <p className="mt-0.5 text-sm text-zinc-500">
                  Analyze current machine sensor readings.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-7">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Temperature */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <SensorIcon type="temperature" />

                  <div>
                    <p className="text-sm font-medium text-zinc-300">
                      Temperature
                    </p>
                    <p className="text-xs text-zinc-600">
                      °C
                    </p>
                  </div>
                </div>

                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  placeholder="Enter temperature"
                  onChange={(e) =>
                    setTemperature(e.target.value)
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                />
              </div>

              {/* Vibration */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <SensorIcon type="vibration" />

                  <div>
                    <p className="text-sm font-medium text-zinc-300">
                      Vibration
                    </p>
                    <p className="text-xs text-zinc-600">
                      Sensor reading
                    </p>
                  </div>
                </div>

                <input
                  type="number"
                  step="0.01"
                  value={vibration}
                  placeholder="Enter vibration"
                  onChange={(e) =>
                    setVibration(e.target.value)
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                />
              </div>

              {/* Pressure */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <SensorIcon type="pressure" />

                  <div>
                    <p className="text-sm font-medium text-zinc-300">
                      Pressure
                    </p>
                    <p className="text-xs text-zinc-600">
                      Sensor reading
                    </p>
                  </div>
                </div>

                <input
                  type="number"
                  step="0.1"
                  value={pressure}
                  placeholder="Enter pressure"
                  onChange={(e) =>
                    setPressure(e.target.value)
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                />
              </div>

              {/* RPM */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <SensorIcon type="rpm" />

                  <div>
                    <p className="text-sm font-medium text-zinc-300">
                      Rotation Speed
                    </p>
                    <p className="text-xs text-zinc-600">
                      RPM
                    </p>
                  </div>
                </div>

                <input
                  type="number"
                  value={rpm}
                  placeholder="Enter RPM"
                  onChange={(e) =>
                    setRpm(e.target.value)
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                />
              </div>

              {/* Power */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <SensorIcon type="power" />

                  <div>
                    <p className="text-sm font-medium text-zinc-300">
                      Power Consumption
                    </p>
                    <p className="text-xs text-zinc-600">
                      Active power
                    </p>
                  </div>
                </div>

                <input
                  type="number"
                  step="0.1"
                  value={powerConsumption}
                  placeholder="Enter power"
                  onChange={(e) =>
                    setPowerConsumption(e.target.value)
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                />
              </div>

              {/* Button */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={runAnomalyDetection}
                  disabled={running}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_25px_rgba(124,58,237,0.2)] transition hover:bg-purple-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {running ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="opacity-30"
                        />
                        <path
                          d="M21 12a9 9 0 0 0-9-9"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Detecting...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
                        />
                      </svg>
                      Run Detection
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 font-bold text-rose-400">
                !
              </div>

              <div>
                <p className="text-sm font-semibold text-rose-300">
                  Detection Error
                </p>

                <p className="mt-1 text-sm text-rose-400/80">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* LATEST RESULT */}
        {result && (
          <section className="mt-6 rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 md:p-7">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
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
                    d="M9 12h6m-6 4h4M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-lg font-bold">
                  Latest Detection Result
                </h2>

                <p className="mt-0.5 text-sm text-zinc-500">
                  AI analysis of the submitted sensor values.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                <p className="text-sm text-zinc-500">
                  Anomaly Status
                </p>

                <div className="mt-4 flex items-center gap-4">
                  <ResultIcon
                    detected={result.anomaly_detected}
                  />

                  <p
                    className={`text-2xl font-bold ${
                      result.anomaly_detected
                        ? "text-rose-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {result.anomaly_detected
                      ? "DETECTED"
                      : "NORMAL"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                <p className="text-sm text-zinc-500">
                  Failure Probability
                </p>

                <p className="mt-5 text-4xl font-bold">
                  {Math.round(
                    result.failure_probability * 100
                  )}
                  %
                </p>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{
                      width: `${Math.min(
                        result.failure_probability * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                <p className="text-sm text-zinc-500">
                  Machine Health
                </p>

                <p className="mt-5 text-4xl font-bold text-purple-400">
                  {result.health_score}%
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  Current health score
                </p>
              </div>
            </div>

            <div
              className={`mt-5 rounded-xl border p-4 ${
                result.anomaly_detected
                  ? "border-rose-500/20 bg-rose-500/5"
                  : "border-emerald-500/20 bg-emerald-500/5"
              }`}
            >
              <p className="text-sm leading-6 text-zinc-400">
                {result.anomaly_detected
                  ? "An unusual machine condition was detected. Investigate the current sensor readings and consider maintenance inspection."
                  : "No unusual condition was detected for these sensor values."}
              </p>
            </div>
          </section>
        )}

        {/* SUMMARY */}
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-rose-500/15 bg-[#0d0c1a] p-6">
            <p className="text-sm text-zinc-500">
              Active Anomalies
            </p>

            <p className="mt-3 text-4xl font-bold text-rose-400">
              {activeAnomalies.length}
            </p>

            <p className="mt-2 text-sm text-zinc-600">
              Require attention
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/15 bg-[#0d0c1a] p-6">
            <p className="text-sm text-zinc-500">
              Highest Anomaly Score
            </p>

            <p className="mt-3 text-4xl font-bold text-white">
              {highestScore.toFixed(2)}
            </p>

            <p className="mt-2 text-sm text-zinc-600">
              Highest detected deviation
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/15 bg-[#0d0c1a] p-6">
            <p className="text-sm text-zinc-500">
              Detection System
            </p>

            <p className="mt-3 text-2xl font-bold text-purple-400">
              Isolation Forest
            </p>

            <p className="mt-2 text-sm text-zinc-600">
              Unsupervised anomaly detection
            </p>
          </div>
        </div>

        {/* ANOMALY HISTORY */}
        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-6 md:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
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
                  d="M4 19V5m0 14h16M7 16l3-5 3 3 4-7"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-bold">
                Detected Anomalies
              </h2>

              <p className="mt-0.5 text-sm text-zinc-500">
                Recent abnormal machine conditions.
              </p>
            </div>
          </div>

          {anomalies.length === 0 ? (
            <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <svg
                  className="h-6 w-6 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m5 12 4 4L19 6"
                  />
                </svg>
              </div>

              <p className="mt-4 text-sm font-medium text-white">
                No anomalies detected
              </p>

              <p className="mt-1 text-sm text-zinc-600">
                The system has not recorded any abnormal conditions.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {anomalies.map((anomaly) => {
                const score = Math.max(
                  0,
                  Math.min(100, anomaly.anomaly_score * 100)
                );

                return (
                  <div
                    key={anomaly.id}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:border-purple-500/25 md:p-6"
                  >
                    {/* Top */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">
                            {anomaly.anomaly_type ||
                              "Machine Anomaly"}
                          </h3>

                          <StatusBadge status={anomaly.status} />
                        </div>

                        <p className="mt-2 text-sm text-zinc-500">
                          Detected{" "}
                          {new Date(
                            anomaly.detected_at
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 px-5 py-3 text-left md:text-right">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          Anomaly Score
                        </p>

                        <p className="mt-1 text-2xl font-bold text-rose-400">
                          {anomaly.anomaly_score.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {anomaly.description && (
                      <div className="mt-5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                        <p className="text-sm leading-6 text-zinc-400">
                          {anomaly.description}
                        </p>
                      </div>
                    )}

                    {/* Sensor values */}
                    <div className="mt-5 grid gap-3 md:grid-cols-5">
                      <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-4">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          Temperature
                        </p>

                        <p className="mt-2 text-lg font-semibold text-white">
                          {anomaly.temperature ?? "—"} °C
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-4">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          Vibration
                        </p>

                        <p className="mt-2 text-lg font-semibold text-white">
                          {anomaly.vibration ?? "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-4">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          Pressure
                        </p>

                        <p className="mt-2 text-lg font-semibold text-white">
                          {anomaly.pressure ?? "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-4">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          RPM
                        </p>

                        <p className="mt-2 text-lg font-semibold text-white">
                          {anomaly.rpm ?? "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-4">
                        <p className="text-xs uppercase tracking-wider text-zinc-600">
                          Power
                        </p>

                        <p className="mt-2 text-lg font-semibold text-white">
                          {anomaly.power_consumption ?? "—"}
                        </p>
                      </div>
                    </div>

                    {/* Severity */}
                    <div className="mt-5 border-t border-white/[0.06] pt-5">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">
                          Anomaly Severity
                        </span>

                        <span className="font-medium text-zinc-300">
                          {Math.round(score)}%
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full rounded-full bg-rose-500 transition-all duration-500"
                          style={{
                            width: `${score}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* HOW IT WORKS */}
        <section className="mt-6 rounded-2xl border border-purple-500/15 bg-[#0d0c1a] p-6 md:p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
              <svg
                className="h-5 w-5 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
            </div>

            <h2 className="text-lg font-bold">
              How Anomaly Detection Works
            </h2>
          </div>

          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-500">
            The system uses Isolation Forest to identify sensor
            readings that differ significantly from normal machine
            behaviour. An anomaly does not necessarily mean machine
            failure. It indicates that the current operating
            condition requires further investigation.
          </p>
        </section>
      </div>
    </main>
  );
}