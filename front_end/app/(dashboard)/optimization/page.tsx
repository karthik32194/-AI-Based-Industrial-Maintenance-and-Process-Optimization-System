"use client";

import { useState } from "react";

export default function OptimizationPage() {
  const [load, setLoad] = useState(100);
  const [temperature, setTemperature] = useState(75);
  const [vibration, setVibration] = useState(0.6);

  const calculateRisk = () => {
    let risk = 25;

    if (temperature > 80) {
      risk += 25;
    } else if (temperature > 75) {
      risk += 12;
    }

    if (vibration > 0.7) {
      risk += 30;
    } else if (vibration > 0.6) {
      risk += 15;
    }

    if (load > 100) {
      risk += 20;
    } else if (load > 90) {
      risk += 10;
    }

    return Math.min(Math.round(risk), 99);
  };

  const risk = calculateRisk();

  const getRiskLabel = () => {
    if (risk < 30) return "LOW";
    if (risk < 60) return "MEDIUM";
    return "HIGH";
  };

  const getRecommendation = () => {
    if (risk < 30) {
      return "Current operating conditions are within a safe range.";
    }

    if (risk < 60) {
      return "Consider reducing machine load or temperature.";
    }

    return "Reduce operating load and investigate abnormal sensor conditions.";
  };

  const riskLabel = getRiskLabel();

  const riskColor =
    riskLabel === "LOW"
      ? "text-emerald-400"
      : riskLabel === "MEDIUM"
      ? "text-amber-400"
      : "text-rose-400";

  const riskBorder =
    riskLabel === "LOW"
      ? "border-emerald-500/20"
      : riskLabel === "MEDIUM"
      ? "border-amber-500/20"
      : "border-rose-500/20";

  const riskBg =
    riskLabel === "LOW"
      ? "bg-emerald-500/10"
      : riskLabel === "MEDIUM"
      ? "bg-amber-500/10"
      : "bg-rose-500/10";

  const riskDot =
    riskLabel === "LOW"
      ? "bg-emerald-400"
      : riskLabel === "MEDIUM"
      ? "bg-amber-400"
      : "bg-rose-400";

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
              Process Intelligence
            </p>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Process Optimization
          </h1>

          <p className="mt-2 text-sm text-zinc-400 sm:text-[15px]">
            Find safer operating conditions using AI-based what-if analysis
          </p>
        </div>

        {/* =====================================================
            CURRENT OPERATING CONDITION
        ===================================================== */}

        <section className="rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 shadow-xl md:p-7">

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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 19V5m0 14h16"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16v-5m4 5V7m4 9v-8m4 8v-4"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  Current Operating Condition
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Adjust machine parameters to simulate different operating scenarios.
                </p>
              </div>

            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            {/* Load */}
            <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-5">

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-400">
                  Load
                </span>

                <span className="text-sm font-semibold text-white">
                  {load}%
                </span>
              </div>

              <input
                type="range"
                min="40"
                max="114"
                step="1"
                value={load}
                onChange={(e) =>
                  setLoad(Number(e.target.value))
                }
                className="mt-5 w-full accent-purple-500"
                aria-label="Machine load"
              />

              <div className="mt-3 flex justify-between text-[10px] text-zinc-600">
                <span>40%</span>
                <span>114%</span>
              </div>
            </div>

            {/* Temperature */}
            <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-5">

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-400">
                  Temperature
                </span>

                <span className="text-sm font-semibold text-white">
                  {temperature} °C
                </span>
              </div>

              <input
                type="range"
                min="59"
                max="94"
                step="1"
                value={temperature}
                onChange={(e) =>
                  setTemperature(Number(e.target.value))
                }
                className="mt-5 w-full accent-purple-500"
                aria-label="Machine temperature"
              />

              <div className="mt-3 flex justify-between text-[10px] text-zinc-600">
                <span>59 °C</span>
                <span>94 °C</span>
              </div>
            </div>

            {/* Vibration */}
            <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-5">

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-400">
                  Vibration
                </span>

                <span className="text-sm font-semibold text-white">
                  {vibration.toFixed(2)} mm/s
                </span>
              </div>

              <input
                type="range"
                min="0.21"
                max="0.82"
                step="0.01"
                value={vibration}
                onChange={(e) =>
                  setVibration(Number(e.target.value))
                }
                className="mt-5 w-full accent-purple-500"
                aria-label="Machine vibration"
              />

              <div className="mt-3 flex justify-between text-[10px] text-zinc-600">
                <span>0.21</span>
                <span>0.82</span>
              </div>
            </div>

          </div>
        </section>

        {/* =====================================================
            OPTIMIZATION RESULT
        ===================================================== */}

        <section className="mt-6 grid gap-4 md:grid-cols-3">

          {/* Failure Probability */}
          <div className={`rounded-2xl border ${riskBorder} bg-[#0d0c1a] p-5 shadow-xl`}>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-400">
                Estimated Failure Probability
              </p>

              <div className="rounded-lg bg-purple-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                AI
              </div>
            </div>

            <p className={`mt-4 text-4xl font-bold ${riskColor}`}>
              {risk}%
            </p>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  riskLabel === "LOW"
                    ? "bg-emerald-500"
                    : riskLabel === "MEDIUM"
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
                style={{
                  width: `${risk}%`,
                }}
              />
            </div>

            <p className="mt-3 text-xs text-zinc-600">
              Model-estimated risk
            </p>
          </div>

          {/* Risk */}
          <div className={`rounded-2xl border ${riskBorder} bg-[#0d0c1a] p-5 shadow-xl`}>

            <p className="text-sm font-medium text-zinc-400">
              Risk Level
            </p>

            <div className="mt-4 flex items-center gap-3">

              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${riskBg}`}
              >
                <span
                  className={`h-3 w-3 rounded-full ${riskDot}`}
                />
              </span>

              <p className={`text-3xl font-bold ${riskColor}`}>
                {riskLabel}
              </p>
            </div>

            <p className="mt-4 text-xs text-zinc-600">
              Based on current parameters
            </p>
          </div>

          {/* Health */}
          <div className="rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-5 shadow-xl">

            <p className="text-sm font-medium text-zinc-400">
              Estimated Machine Health
            </p>

            <p className="mt-4 text-4xl font-bold text-purple-400">
              {100 - risk}%
            </p>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-500"
                style={{
                  width: `${100 - risk}%`,
                }}
              />
            </div>

            <p className="mt-3 text-xs text-zinc-600">
              Higher is better
            </p>
          </div>

        </section>

        {/* =====================================================
            WHAT-IF ANALYSIS
        ===================================================== */}

        <section className="mt-6 rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 shadow-xl md:p-7">

          <div className="border-b border-white/[0.06] pb-5">

            <h2 className="text-xl font-bold">
              What-If Analysis
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Explore how changing operating parameters affects predicted risk.
            </p>

          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            {/* Load adjustment */}
            <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-5">

              <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                Load Adjustment
              </p>

              <p className="mt-3 text-xl font-semibold text-white">
                {load - 100 > 0 ? "+" : ""}
                {load - 100}%
              </p>

              <p className="mt-2 text-xs text-zinc-600">
                Compared with baseline
              </p>
            </div>

            {/* Temperature adjustment */}
            <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-5">

              <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                Temperature Adjustment
              </p>

              <p className="mt-3 text-xl font-semibold text-white">
                {temperature - 75 > 0 ? "+" : ""}
                {temperature - 75} °C
              </p>

              <p className="mt-2 text-xs text-zinc-600">
                Compared with baseline
              </p>
            </div>

            {/* Vibration adjustment */}
            <div className="rounded-xl border border-white/[0.05] bg-[#090814] p-5">

              <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                Vibration Adjustment
              </p>

              <p className="mt-3 text-xl font-semibold text-white">
                {vibration - 0.6 >= 0 ? "+" : ""}
                {(vibration - 0.6).toFixed(2)} mm/s
              </p>

              <p className="mt-2 text-xs text-zinc-600">
                Compared with baseline
              </p>
            </div>

          </div>
        </section>

        {/* =====================================================
            RECOMMENDATION
        ===================================================== */}

        <section
          className={`mt-6 rounded-2xl border ${
            riskLabel === "HIGH"
              ? "border-rose-500/20"
              : riskLabel === "MEDIUM"
              ? "border-amber-500/20"
              : "border-purple-500/20"
          } bg-[#0d0c1a] p-6 shadow-xl md:p-7`}
        >

          <div className="flex items-start gap-4">

            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${riskBg}`}
            >
              <svg
                className={`h-5 w-5 ${riskColor}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2m0 14v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M3 12h2m14 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"
                />

                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>

            <div className="min-w-0">

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-400">
                Optimization Recommendation
              </p>

              <h2 className="mt-2 text-lg font-bold text-white">
                Recommended Operating Strategy
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {getRecommendation()}
              </p>

            </div>
          </div>
        </section>

        {/* =====================================================
            HOW IT WORKS
        ===================================================== */}

        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-6 shadow-xl md:p-7">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
              <svg
                className="h-5 w-5 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <circle cx="12" cy="12" r="9" />

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 11v5"
                />

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8h.01"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold">
              How Optimization Works
            </h2>

          </div>

          <p className="mt-5 text-sm leading-7 text-zinc-500">
            The system evaluates different machine operating
            conditions and estimates the corresponding failure
            probability. By comparing multiple scenarios,
            operators can identify conditions that reduce machine
            risk while maintaining productive operation.
          </p>

        </section>

      </div>
    </main>
  );
}