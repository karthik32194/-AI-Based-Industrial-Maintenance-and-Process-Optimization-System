"use client";

import { useEffect, useState } from "react";

type Prediction = {
  id: string;
  machine_id: string;
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
  created_at: string;
};

/* =========================================================
   SENSOR ICONS
   ========================================================= */

function SensorIcon({ type }: { type: string }) {
  const paths: Record<string, React.ReactNode> = {
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
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <circle cx="12" cy="12" r="4" />
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
        aria-hidden="true"
      >
        {paths[type]}
      </svg>
    </div>
  );
}

/* =========================================================
   SENSOR THRESHOLDS

   Normal range:
   - value inside this range = Normal

   Critical boundary:
   - value beyond this boundary = Critical

   Between normal range and critical boundary = Warning
   ========================================================= */

type SensorConfig = {
  key:
    | "temperature"
    | "vibration"
    | "pressure"
    | "rpm"
    | "power";
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  criticalMin: number;
  criticalMax: number;
  scaleMax: number;
  decimals: number;
};

const SENSOR_CONFIG: Record<string, SensorConfig> = {
  temperature: {
    key: "temperature",
    name: "Temperature",
    unit: "°C",
    normalMin: 40,
    normalMax: 75,
    criticalMin: 28,
    criticalMax: 120,
    scaleMax: 120,
    decimals: 1,
  },

  vibration: {
    key: "vibration",
    name: "Vibration",
    unit: "mm/s",
    normalMin: 0.5,
    normalMax: 2.5,
    criticalMin: 0.35,
    criticalMax: 4,
    scaleMax: 8,
    decimals: 2,
  },

  pressure: {
    key: "pressure",
    name: "Pressure",
    unit: "bar",
    normalMin: 2,
    normalMax: 5.5,
    criticalMin: 1.4,
    criticalMax: 7,
    scaleMax: 10,
    decimals: 1,
  },

  rpm: {
    key: "rpm",
    name: "Rotation Speed",
    unit: "RPM",
    normalMin: 1500,
    normalMax: 1800,
    criticalMin: 1050,
    criticalMax: 1950,
    scaleMax: 2400,
    decimals: 0,
  },

  power: {
    key: "power",
    name: "Power Consumption",
    unit: "kW",
    normalMin: 12,
    normalMax: 22,
    criticalMin: 8.4,
    criticalMax: 26,
    scaleMax: 35,
    decimals: 1,
  },
};

/* =========================================================
   DATA-DRIVEN SENSOR STATUS
   ========================================================= */

type SensorStatus = "Normal" | "Warning" | "Critical";

type SensorCondition = {
  status: SensorStatus;
  dotColor: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  barColor: string;
  cardBorder: string;
  percentage: number;
  ariaLabel: string;
};

function getSensorCondition(
  value: number | undefined,
  config: SensorConfig
): SensorCondition {
  if (value === undefined || !Number.isFinite(Number(value))) {
    return {
      status: "Normal",
      dotColor: "bg-zinc-500",
      textColor: "text-zinc-400",
      badgeBg: "bg-white/[0.04]",
      badgeBorder: "border-white/[0.08]",
      barColor: "bg-zinc-600",
      cardBorder: "border-white/[0.06]",
      percentage: 0,
      ariaLabel: `${config.name}: no reading available`,
    };
  }

  const numericValue = Number(value);

  const percentage = Math.min(
    100,
    Math.max(0, (numericValue / config.scaleMax) * 100)
  );

  /*
   * NORMAL
   * Value is inside the configured normal operating range.
   */
  if (
    numericValue >= config.normalMin &&
    numericValue <= config.normalMax
  ) {
    return {
      status: "Normal",
      dotColor: "bg-emerald-400",
      textColor: "text-emerald-400",
      badgeBg: "bg-emerald-500/10",
      badgeBorder: "border-emerald-500/25",
      barColor: "bg-emerald-500",
      cardBorder: "border-white/[0.06]",
      percentage,
      ariaLabel: `${config.name}: Normal`,
    };
  }

  /*
   * CRITICAL
   * Value has crossed the configured critical boundary.
   */
  if (
    numericValue < config.criticalMin ||
    numericValue > config.criticalMax
  ) {
    return {
      status: "Critical",
      dotColor: "bg-rose-400",
      textColor: "text-rose-400",
      badgeBg: "bg-rose-500/10",
      badgeBorder: "border-rose-500/25",
      barColor: "bg-rose-500",
      cardBorder: "border-rose-500/30",
      percentage,
      ariaLabel: `${config.name}: Critical`,
    };
  }

  /*
   * WARNING
   * Value is outside normal range but has not crossed
   * the critical boundary.
   */
  return {
    status: "Warning",
    dotColor: "bg-amber-400",
    textColor: "text-amber-400",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/25",
    barColor: "bg-amber-500",
    cardBorder: "border-amber-500/30",
    percentage,
    ariaLabel: `${config.name}: Warning`,
  };
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function SensorStatusBadge({
  condition,
}: {
  condition: SensorCondition;
}) {
  return (
    <span
      role="status"
      aria-label={condition.ariaLabel}
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${condition.badgeBg} ${condition.badgeBorder} ${condition.textColor}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${condition.dotColor}`}
        aria-hidden="true"
      />

      <span>{condition.status}</span>
    </span>
  );
}

/* =========================================================
   RISK BADGE
   ========================================================= */

function RiskBadge({ risk }: { risk: string }) {
  const value = risk?.toUpperCase() || "UNKNOWN";

  if (value === "LOW") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        Low Risk
      </span>
    );
  }

  if (value === "MEDIUM") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Medium Risk
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
      <span className="h-2 w-2 rounded-full bg-rose-400" />
      High Risk
    </span>
  );
}

/* =========================================================
   HEALTH GAUGE
   ========================================================= */

function HealthGauge({ score }: { score: number }) {
  const safeScore = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  const circumference = 2 * Math.PI * 44;
  const offset =
    circumference - (safeScore / 100) * circumference;

  return (
    <div className="relative flex h-48 w-48 items-center justify-center">
      <svg
        className="h-48 w-48 -rotate-90"
        viewBox="0 0 100 100"
        aria-label={`Machine health ${Math.round(safeScore)} percent`}
      >
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-white/5"
        />

        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-purple-500 transition-all duration-700"
        />
      </svg>

      <div className="absolute text-center">
        <p className="text-4xl font-bold text-white">
          {Math.round(safeScore)}%
        </p>

        <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
          Health
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function PredictionsPage() {
  const [prediction, setPrediction] =
    useState<Prediction | null>(null);

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [temperature, setTemperature] = useState("");
  const [vibration, setVibration] = useState("");
  const [pressure, setPressure] = useState("");
  const [rpm, setRpm] = useState("");
  const [powerConsumption, setPowerConsumption] =
    useState("");

  async function getActiveMachine(token: string) {
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
        data.detail || "Failed to load machine"
      );
    }

    const machines = Array.isArray(data)
      ? data
      : data.items || [];

    const machine = machines.find(
      (m: { status: string }) =>
        m.status?.toUpperCase() !== "DECOMMISSIONED"
    );

    if (!machine) {
      throw new Error("No active machine found.");
    }

    return machine;
  }

  /* =========================================================
     RUN PREDICTION
     ========================================================= */

  async function runPrediction() {
    try {
      setError("");

      if (
        temperature.trim() === "" ||
        vibration.trim() === "" ||
        pressure.trim() === "" ||
        rpm.trim() === "" ||
        powerConsumption.trim() === ""
      ) {
        setError(
          "Please enter all sensor values."
        );
        return;
      }

      setRunning(true);

      const token =
        localStorage.getItem("access_token");

      if (!token) {
        throw new Error("Please login first.");
      }

      const machine =
        await getActiveMachine(token);

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
            power_consumption: Number(
              powerConsumption
            ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Prediction failed"
        );
      }

      setPrediction(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Prediction failed"
      );
    } finally {
      setRunning(false);
    }
  }

  /* =========================================================
     LOAD LATEST PREDICTION
     ========================================================= */

  useEffect(() => {
    async function loadPrediction() {
      try {
        const token =
          localStorage.getItem("access_token");

        if (!token) {
          throw new Error("Please login first.");
        }

        const machine =
          await getActiveMachine(token);

        const response = await fetch(
          `http://localhost:8000/api/machines/${machine.id}/predictions`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Failed to load prediction"
          );
        }

        const items = Array.isArray(data)
          ? data
          : data.items || [];

        if (items.length > 0) {
          const latest = items[0];

          setPrediction(latest);

          if (
            latest.input_temperature !==
            undefined
          ) {
            setTemperature(
              String(latest.input_temperature)
            );

            setVibration(
              String(latest.input_vibration)
            );

            setPressure(
              String(latest.input_pressure)
            );

            setRpm(
              String(latest.input_rpm)
            );

            setPowerConsumption(
              String(
                latest.input_power_consumption
              )
            );
          }
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load prediction"
        );
      } finally {
        setLoading(false);
      }
    }

    loadPrediction();
  }, []);

  /* =========================================================
     LOADING
     ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050511] px-6 py-8 text-white md:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div className="h-10 w-56 animate-pulse rounded-lg bg-white/10" />

            <div className="mt-3 h-4 w-80 animate-pulse rounded bg-white/5" />
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-8">
            <p className="text-sm text-zinc-500">
              Loading machine intelligence...
            </p>
          </div>
        </div>
      </main>
    );
  }

  const probability = prediction
    ? Math.round(
        prediction.failure_probability * 100
      )
    : 0;

  /*
   * Sensor status is calculated from the actual
   * prediction input values.
   */
  const temperatureCondition = getSensorCondition(
    prediction?.input_temperature,
    SENSOR_CONFIG.temperature
  );

  const vibrationCondition = getSensorCondition(
    prediction?.input_vibration,
    SENSOR_CONFIG.vibration
  );

  const pressureCondition = getSensorCondition(
    prediction?.input_pressure,
    SENSOR_CONFIG.pressure
  );

  const rpmCondition = getSensorCondition(
    prediction?.input_rpm,
    SENSOR_CONFIG.rpm
  );

  const powerCondition = getSensorCondition(
    prediction?.input_power_consumption,
    SENSOR_CONFIG.power
  );

  return (
    <main className="min-h-screen bg-[#050511] text-white">
      {/* Ambient purple glow */}
      <div className="pointer-events-none fixed left-1/2 top-0 -z-0 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-600/10 blur-[130px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 md:px-8 lg:px-10">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">
              Machine Intelligence
            </p>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Predictions
          </h1>

          <p className="mt-2 text-sm text-zinc-400 sm:text-[15px]">
            AI-powered machine failure prediction and health analysis.
          </p>
        </div>

        {/* =====================================================
            SENSOR INPUT
        ===================================================== */}

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
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 7h10v10H7V7Z"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 10h4v4h-4v-4Z"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-lg font-bold">
                  Run New Prediction
                </h2>

                <p className="mt-0.5 text-sm text-zinc-500">
                  Enter current machine sensor readings.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-7">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Temperature */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <SensorIcon type="temperature" />

                  <div className="min-w-0">
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

                  <div className="min-w-0">
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

                  <div className="min-w-0">
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

              {/* Rotation Speed */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <SensorIcon type="rpm" />

                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-zinc-300">
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

              {/* Power Consumption */}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3">
                  <SensorIcon type="power" />

                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-zinc-300">
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
                    setPowerConsumption(
                      e.target.value
                    )
                  }
                  className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20"
                />
              </div>

              {/* Run Button */}
<div className="flex items-end lg:col-span-1">
                  <button
                  type="button"
                  onClick={runPrediction}
                  disabled={running}
className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-purple-400/20 bg-purple-600 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(124,58,237,0.25)] transition-all duration-200 hover:bg-purple-500 hover:shadow-[0_8px_35px_rgba(124,58,237,0.35)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"                >
                  {running ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
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

                      Running Prediction...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
                        />
                      </svg>

                      Run New Prediction
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="mt-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 font-bold text-rose-400">
                !
              </div>

              <div>
                <p className="text-sm font-semibold text-rose-300">
                  Prediction Error
                </p>

                <p className="mt-1 text-sm text-rose-400/80">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            RESULTS
        ===================================================== */}

        {prediction && (
          <>
            <div className="mb-5 mt-8 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/[0.06]" />

              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                AI Analysis Result
              </span>

              <span className="h-px flex-1 bg-white/[0.06]" />
            </div>

            {/* Main Result Cards */}
            <div className="grid gap-5 md:grid-cols-3">

              {/* Failure Probability */}
              <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6">
                <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-purple-600/10 blur-3xl" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-400">
                      Failure Probability
                    </p>

                    <div className="rounded-lg bg-purple-500/10 px-2 py-1 text-xs text-purple-400">
                      AI
                    </div>
                  </div>

<div className="mt-5 flex items-end gap-2">
  <p className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
    {probability}%
  </p>

  <span className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
    predicted
  </span>
</div>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-700"
                      style={{
                        width: `${Math.min(
                          probability,
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4">
                    <RiskBadge
                      risk={prediction.risk_level}
                    />
                  </div>
                </div>
              </div>

              {/* Prediction */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-6">
                <p className="text-sm font-medium text-zinc-400">
                  Predicted Condition
                </p>

<div className="mt-5 flex min-h-[92px] items-center gap-4">
                    <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                      prediction.predicted_failure
                        ? "bg-rose-500/10"
                        : "bg-emerald-500/10"
                    }`}
                  >
                    {prediction.predicted_failure ? (
                      <svg
                        className="h-7 w-7 text-rose-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
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
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m5 12 4 4L19 6"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-xl font-bold tracking-tight sm:text-2xl ${
                        prediction.predicted_failure
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {prediction.predicted_failure
                        ? "FAILURE"
                        : "NO FAILURE"}
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      {prediction.health_status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Health Score */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-6">
                <p className="text-sm font-medium text-zinc-400">
                  Machine Health
                </p>

<div className="mt-2 flex items-center gap-4">                
  <div className="origin-left scale-75">
  <HealthGauge score={prediction.health_score} />
</div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      Overall Condition
                    </p>

                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      Health score calculated from the
                      latest AI prediction.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* =====================================================
                SENSOR READINGS
            ===================================================== */}

            <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-6 md:p-7">

              {/* Header */}
              <div className="border-b border-white/[0.06] pb-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
                      <svg
                        className="h-5 w-5 text-purple-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 19V5m0 14h16M7 16v-4m4 4V8m4 8v-7m4 7v-3"
                        />
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-lg font-bold">
                        Sensor Readings
                      </h2>

                      <p className="mt-0.5 text-sm text-zinc-500">
                        Current values used for this prediction.
                      </p>
                    </div>
                  </div>

                  {/* ACTUAL BACKEND ANOMALY RESULT */}
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-zinc-500">
                      Anomaly Analysis:
                    </span>

                    <span
                      role="status"
                      aria-label={
                        prediction.anomaly_detected
                          ? "Backend anomaly detected"
                          : "Backend anomaly status normal"
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        prediction.anomaly_detected
                          ? "border-rose-500/25 bg-rose-500/10 text-rose-400"
                          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          prediction.anomaly_detected
                            ? "bg-rose-400"
                            : "bg-emerald-400"
                        }`}
                        aria-hidden="true"
                      />

                      {prediction.anomaly_detected
                        ? "Detected"
                        : "Normal"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ===================================================
                  FIVE SENSOR CARDS
                  Status badge has its own row, so it cannot overlap
                  the sensor name.
              =================================================== */}

<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {/* Temperature */}
                <div
                  className={`flex min-w-0 flex-col rounded-xl border bg-white/[0.02] p-4 transition ${temperatureCondition.cardBorder}`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <SensorIcon type="temperature" />

                      <p className="min-w-0 break-words text-[13px] font-medium leading-5 text-zinc-300">
                        Temperature
                      </p>
                    </div>

                    {/* Dedicated status row */}
                    <div className="mt-3">
                      <SensorStatusBadge
                        condition={temperatureCondition}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline">
                   <span className="text-xl font-bold tracking-tight text-white">
  {prediction.input_temperature}
</span>

                    <span className="ml-1.5 text-xs font-semibold text-zinc-400">
                      °C
                    </span>
                  </div>

                  <div className="mt-4 border-t border-white/[0.04] pt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${temperatureCondition.barColor}`}
                        style={{
                          width: `${temperatureCondition.percentage}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-zinc-400">
                      Normal range: 40–75 °C
                    </p>
                  </div>
                </div>

                {/* Vibration */}
                <div
                  className={`flex min-w-0 flex-col rounded-xl border bg-white/[0.02] p-4 transition ${vibrationCondition.cardBorder}`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <SensorIcon type="vibration" />

                      <p className="min-w-0 break-words text-[13px] font-medium leading-5 text-zinc-300">
                        Vibration
                      </p>
                    </div>

                    <div className="mt-3">
                      <SensorStatusBadge
                        condition={vibrationCondition}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      {prediction.input_vibration}
                    </span>

                    <span className="ml-1.5 text-xs font-semibold text-zinc-400">
                      mm/s
                    </span>
                  </div>

                  <div className="mt-4 border-t border-white/[0.04] pt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${vibrationCondition.barColor}`}
                        style={{
                          width: `${vibrationCondition.percentage}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-zinc-400">
                      Normal range: 0.5–2.5 mm/s
                    </p>
                  </div>
                </div>

                {/* Pressure */}
                <div
                  className={`flex min-w-0 flex-col rounded-xl border bg-white/[0.02] p-4 transition ${pressureCondition.cardBorder}`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <SensorIcon type="pressure" />

                      <p className="min-w-0 break-words text-[13px] font-medium leading-5 text-zinc-300">
                        Pressure
                      </p>
                    </div>

                    <div className="mt-3">
                      <SensorStatusBadge
                        condition={pressureCondition}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      {prediction.input_pressure}
                    </span>

                    <span className="ml-1.5 text-xs font-semibold text-zinc-400">
                      bar
                    </span>
                  </div>

                  <div className="mt-4 border-t border-white/[0.04] pt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pressureCondition.barColor}`}
                        style={{
                          width: `${pressureCondition.percentage}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-zinc-400">
                      Normal range: 2.0–5.5 bar
                    </p>
                  </div>
                </div>

                {/* Rotation Speed */}
                <div
                  className={`flex min-w-0 flex-col rounded-xl border bg-white/[0.02] p-4 transition ${rpmCondition.cardBorder}`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <SensorIcon type="rpm" />

                      <p className="min-w-0 break-words text-[13px] font-medium leading-5 text-zinc-300">
                        Rotation Speed
                      </p>
                    </div>

                    <div className="mt-3">
                      <SensorStatusBadge
                        condition={rpmCondition}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      {prediction.input_rpm}
                    </span>

                    <span className="ml-1.5 text-xs font-semibold text-zinc-400">
                      RPM
                    </span>
                  </div>

                  <div className="mt-4 border-t border-white/[0.04] pt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${rpmCondition.barColor}`}
                        style={{
                          width: `${rpmCondition.percentage}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-zinc-400">
                      Normal range: 1500–1800 RPM
                    </p>
                  </div>
                </div>

                {/* Power Consumption */}
                <div
                  className={`flex min-w-0 flex-col rounded-xl border bg-white/[0.02] p-4 transition ${powerCondition.cardBorder}`}
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <SensorIcon type="power" />

                      <p className="min-w-0 break-words text-[13px] font-medium leading-5 text-zinc-300">
                        Power Consumption
                      </p>
                    </div>

                    <div className="mt-3">
                      <SensorStatusBadge
                        condition={powerCondition}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      {prediction.input_power_consumption}
                    </span>

                    <span className="ml-1.5 text-xs font-semibold text-zinc-400">
                      kW
                    </span>
                  </div>

                  <div className="mt-4 border-t border-white/[0.04] pt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${powerCondition.barColor}`}
                        style={{
                          width: `${powerCondition.percentage}%`,
                        }}
                      />
                    </div>

                    <p className="mt-2 text-[11px] text-zinc-400">
                      Normal range: 12.0–22.0 kW
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* =====================================================
                MAINTENANCE RECOMMENDATION
            ===================================================== */}

            <section
              className={`mt-6 rounded-2xl border p-6 md:p-7 ${
                prediction.predicted_failure
                  ? "border-rose-500/20 bg-rose-500/[0.04]"
                  : "border-purple-500/20 bg-[#0d0c1a]"
              }`}
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-400">
                    Maintenance Recommendation
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-white">
                    {prediction.predicted_failure
                      ? "Maintenance inspection recommended"
                      : prediction.risk_level?.toUpperCase() ===
                        "HIGH"
                      ? "Immediate maintenance inspection"
                      : prediction.risk_level?.toUpperCase() ===
                        "MEDIUM"
                      ? "Schedule maintenance inspection"
                      : "Continue normal monitoring"}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                    Recommendation generated from the latest
                    machine prediction, failure probability,
                    and health condition.
                  </p>
                </div>

                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                    prediction.predicted_failure
                      ? "bg-rose-500/10"
                      : "bg-purple-500/10"
                  }`}
                >
                  <svg
                    className={`h-7 w-7 ${
                      prediction.predicted_failure
                        ? "text-rose-400"
                        : "text-purple-400"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5h6M9 3h6v2H9V3Zm-2 4h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                    />

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m9 13 2 2 4-4"
                    />
                  </svg>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}