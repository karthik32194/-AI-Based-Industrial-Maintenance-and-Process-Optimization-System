"use client";

export default function MaintenancePage() {
  const records = [
    {
      id: "MR-001",
      machine: "Industrial Motor 01",
      type: "PREVENTIVE",
      status: "SCHEDULED",
      date: "10 Sep 2026",
      technician: "Maintenance Team",
      description: "Routine inspection and lubrication",
    },
    {
      id: "MR-002",
      machine: "Industrial Motor 01",
      type: "CORRECTIVE",
      status: "IN_PROGRESS",
      date: "05 Sep 2026",
      technician: "Maintenance Team",
      description: "Investigate abnormal vibration",
    },
    {
      id: "MR-003",
      machine: "Industrial Motor 01",
      type: "PREVENTIVE",
      status: "COMPLETED",
      date: "28 Aug 2026",
      technician: "Maintenance Team",
      description: "Motor inspection and sensor check",
    },
  ];

  const scheduledCount = records.filter(
    (record) => record.status === "SCHEDULED"
  ).length;

  const inProgressCount = records.filter(
    (record) => record.status === "IN_PROGRESS"
  ).length;

  const completedCount = records.filter(
    (record) => record.status === "COMPLETED"
  ).length;

  function getStatusStyle(status: string) {
    switch (status) {
      case "SCHEDULED":
        return "border-purple-500/25 bg-purple-500/10 text-purple-300";

      case "IN_PROGRESS":
        return "border-amber-500/25 bg-amber-500/10 text-amber-300";

      case "COMPLETED":
        return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";

      default:
        return "border-white/10 bg-white/[0.04] text-zinc-400";
    }
  }

  function getStatusDot(status: string) {
    switch (status) {
      case "SCHEDULED":
        return "bg-purple-400";

      case "IN_PROGRESS":
        return "bg-amber-400";

      case "COMPLETED":
        return "bg-emerald-400";

      default:
        return "bg-zinc-500";
    }
  }

  function getTypeStyle(type: string) {
    return type === "PREVENTIVE"
      ? "border-purple-500/20 bg-purple-500/10 text-purple-300"
      : "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

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
              Maintenance Management
            </p>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Maintenance
          </h1>

          <p className="mt-2 text-sm text-zinc-400 sm:text-[15px]">
            Manage preventive and corrective machine maintenance
          </p>
        </div>

        {/* =====================================================
            SUMMARY CARDS
        ===================================================== */}

        <div className="grid gap-5 md:grid-cols-3">

          {/* Scheduled */}
          <div className="rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 shadow-xl transition hover:border-purple-500/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">
                Scheduled
              </p>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
                <svg
                  className="h-5 w-5 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="17"
                    rx="2"
                  />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
            </div>

            <p className="mt-5 text-4xl font-bold text-purple-400">
              {scheduledCount}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Upcoming maintenance
            </p>
          </div>

          {/* In Progress */}
          <div className="rounded-2xl border border-amber-500/15 bg-[#0d0c1a] p-6 shadow-xl transition hover:border-amber-500/25">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">
                In Progress
              </p>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                <svg
                  className="h-5 w-5 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
            </div>

            <p className="mt-5 text-4xl font-bold text-amber-400">
              {inProgressCount}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Currently being handled
            </p>
          </div>

          {/* Completed */}
          <div className="rounded-2xl border border-emerald-500/15 bg-[#0d0c1a] p-6 shadow-xl transition hover:border-emerald-500/25">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-400">
                Completed
              </p>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                <svg
                  className="h-5 w-5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m5 12 4 4L19 6"
                  />
                </svg>
              </div>
            </div>

            <p className="mt-5 text-4xl font-bold text-emerald-400">
              {completedCount}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Recently completed
            </p>
          </div>
        </div>

        {/* =====================================================
            MAINTENANCE RECORDS
        ===================================================== */}

        <section className="mt-6 rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 shadow-xl md:p-7">

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
                    d="M9 5h6M9 3h6v2H9V3Zm-2 4h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                  />

                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m9 13 2 2 4-4"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  Maintenance Records
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Maintenance history and upcoming activities
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">

            {records.map((record) => (
              <div
                key={record.id}
                className="rounded-xl border border-white/[0.06] bg-[#090814] p-5 transition hover:border-purple-500/20 hover:bg-purple-500/[0.02]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                  {/* Record information */}
                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3 className="text-base font-semibold text-white sm:text-lg">
                        {record.description}
                      </h3>

                      {/* Maintenance Type */}
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wider ${getTypeStyle(
                          record.type
                        )}`}
                      >
                        {record.type}
                      </span>

                      {/* Status */}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wider ${getStatusStyle(
                          record.status
                        )}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${getStatusDot(
                            record.status
                          )}`}
                        />

                        {record.status.replace(
                          "_",
                          " "
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-zinc-500">
                      {record.machine}{" "}
                      <span className="text-zinc-700">
                        •
                      </span>{" "}
                      {record.id}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="shrink-0 lg:text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      Maintenance Date
                    </p>

                    <p className="mt-1 text-sm font-semibold text-zinc-200">
                      {record.date}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-5 grid gap-3 border-t border-white/[0.05] pt-5 md:grid-cols-2">

                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      Technician
                    </p>

                    <p className="mt-2 text-sm font-semibold text-zinc-200">
                      {record.technician}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      Maintenance Type
                    </p>

                    <p className="mt-2 text-sm font-semibold text-zinc-200">
                      {record.type}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            MAINTENANCE STRATEGY
        ===================================================== */}

        <section className="mt-6 rounded-2xl border border-purple-500/20 bg-[#0d0c1a] p-6 shadow-xl md:p-7">

          <div className="border-b border-white/[0.06] pb-5">
            <h2 className="text-xl font-bold">
              Maintenance Strategy
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Planned maintenance approach for machine reliability
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">

            {/* Preventive */}
            <div className="rounded-xl border border-purple-500/15 bg-[#090814] p-5 transition hover:border-purple-500/25">

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
                      d="M12 3v18M3 12h18"
                    />
                  </svg>
                </div>

                <h3 className="text-base font-semibold text-purple-300">
                  Preventive Maintenance
                </h3>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-500">
                Scheduled inspections and servicing are performed
                before equipment problems become critical.
              </p>
            </div>

            {/* Corrective */}
            <div className="rounded-xl border border-amber-500/15 bg-[#090814] p-5 transition hover:border-amber-500/25">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                  <svg
                    className="h-5 w-5 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.7 6.3 17.7 3.3a2.1 2.1 0 0 1 3 3l-3 3M13 8l3 3M4 20l5.5-5.5M4 20l1-4 3-1.5"
                    />
                  </svg>
                </div>

                <h3 className="text-base font-semibold text-amber-300">
                  Corrective Maintenance
                </h3>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-500">
                Maintenance actions are performed when abnormal
                machine behaviour or faults require investigation.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}