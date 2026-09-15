"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:8000";

type MaintenanceRecord = {
  id: string;
  machine_id: string;
  maintenance_type: string;
  status: string;
  scheduled_date?: string | null;
  completed_date?: string | null;
  technician_name?: string | null;
  description?: string | null;
  created_at: string;
};

type Machine = {
  id: string;
  name: string;
  status: string;
};

export default function MaintenancePage() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMaintenance();
  }, []);

  async function loadMaintenance() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      if (!token) {
        setError("Please login to view maintenance records.");
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const machineResponse = await fetch(`${API_URL}/api/machines`, {
        headers,
      });

      if (!machineResponse.ok) {
        throw new Error("Failed to load machines");
      }

      const machineData = await machineResponse.json();

      const machines = Array.isArray(machineData)
        ? machineData
        : machineData.items || [];

      const activeMachine = machines.find(
        (item: Machine) =>
          item.status?.toUpperCase() !== "DECOMMISSIONED"
      );

      if (!activeMachine) {
        setError("No active machine found.");
        return;
      }

      setMachine(activeMachine);

      const maintenanceResponse = await fetch(
        `${API_URL}/api/machines/${activeMachine.id}/maintenance?page=1&page_size=100`,
        {
          headers,
        }
      );

      if (!maintenanceResponse.ok) {
        throw new Error("Failed to load maintenance records");
      }

      const maintenanceData = await maintenanceResponse.json();

      const items = Array.isArray(maintenanceData)
        ? maintenanceData
        : maintenanceData.items || [];

      setRecords(items);
    } catch (err) {
      console.error(err);
      setError("Unable to load maintenance data.");
    } finally {
      setLoading(false);
    }
  }

  const scheduledCount = useMemo(
    () =>
      records.filter(
        (record) => record.status?.toUpperCase() === "SCHEDULED"
      ).length,
    [records]
  );

  const inProgressCount = useMemo(
    () =>
      records.filter(
        (record) => record.status?.toUpperCase() === "IN_PROGRESS"
      ).length,
    [records]
  );

  const completedCount = useMemo(
    () =>
      records.filter(
        (record) => record.status?.toUpperCase() === "COMPLETED"
      ).length,
    [records]
  );

  function formatDate(date?: string | null) {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatType(type?: string) {
    if (!type) return "—";

    return type
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatStatus(status?: string) {
    if (!status) return "—";

    return status
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function statusStyle(status: string) {
    const value = status?.toUpperCase();

    if (value === "COMPLETED") {
      return {
        text: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        dot: "bg-emerald-400",
      };
    }

    if (value === "IN_PROGRESS") {
      return {
        text: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        dot: "bg-amber-400",
      };
    }

    if (value === "CANCELLED") {
      return {
        text: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        dot: "bg-red-400",
      };
    }

    return {
      text: "text-purple-300",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      dot: "bg-purple-400",
    };
  }

  return (
    <div className="min-h-screen bg-[#050511] px-4 py-6 text-white md:px-8 lg:px-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.8)]" />

            <span className="text-xs font-bold uppercase tracking-[0.25em] text-purple-300">
              Maintenance Control
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Maintenance
          </h1>

          <p className="mt-2 text-sm text-white/45">
            Monitor and manage industrial maintenance activities.
          </p>
        </div>

        {machine && (
          <div className="rounded-2xl border border-purple-400/10 bg-[#0b0b1c] px-5 py-3 shadow-[0_0_30px_rgba(124,58,237,0.08)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Active Machine
            </p>

            <div className="mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />

              <span className="text-sm font-semibold text-white">
                {machine.name}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-purple-500/20 border-t-purple-400" />

            <p className="text-sm text-white/40">
              Loading maintenance data...
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-xl">
            ⚠
          </div>

          <h2 className="text-lg font-semibold text-white">
            Unable to load maintenance
          </h2>

          <p className="mt-2 text-sm text-red-300/70">
            {error}
          </p>

          <button
            onClick={loadMaintenance}
            className="mt-5 rounded-xl border border-purple-400/20 bg-purple-500/10 px-5 py-2.5 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/20"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Statistics */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Records"
              value={records.length}
              icon="▦"
              description="Maintenance activities"
            />

            <StatCard
              title="Scheduled"
              value={scheduledCount}
              icon="◷"
              description="Upcoming maintenance"
            />

            <StatCard
              title="In Progress"
              value={inProgressCount}
              icon="↻"
              description="Currently active"
            />

            <StatCard
              title="Completed"
              value={completedCount}
              icon="✓"
              description="Successfully completed"
            />
          </div>

          {/* Records */}
          <div className="overflow-hidden rounded-3xl border border-purple-400/10 bg-[#080817] shadow-[0_0_50px_rgba(124,58,237,0.06)]">
            <div className="flex flex-col gap-3 border-b border-purple-400/10 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Maintenance Records
                </h2>

                <p className="mt-1 text-xs text-white/35">
                  Live records retrieved from the maintenance service
                </p>
              </div>

              <button
                onClick={loadMaintenance}
                className="w-fit rounded-xl border border-purple-400/15 bg-purple-500/5 px-4 py-2 text-xs font-semibold text-purple-300 transition hover:border-purple-400/30 hover:bg-purple-500/10"
              >
                ↻ Refresh
              </button>
            </div>

            {/* Empty State */}
            {records.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/10 bg-purple-500/5 text-2xl text-purple-300">
                  ◷
                </div>

                <h3 className="text-lg font-semibold text-white">
                  No maintenance records
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm text-white/35">
                  There are currently no maintenance activities recorded for
                  this machine.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-purple-400/10 text-left">
                        <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                          ID
                        </th>

                        <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                          Type
                        </th>

                        <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                          Status
                        </th>

                        <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                          Date
                        </th>

                        <th className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                          Technician
                        </th>

                        <th className="px-7 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                          Description
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {records.map((record) => {
                        const style = statusStyle(record.status);

                        return (
                          <tr
                            key={record.id}
                            className="border-b border-purple-400/[0.06] transition hover:bg-purple-500/[0.025]"
                          >
                            <td className="px-7 py-5">
                              <span className="font-mono text-xs text-purple-300">
                                {record.id}
                              </span>
                            </td>

                            <td className="px-5 py-5">
                              <span className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-white/70">
                                {formatType(record.maintenance_type)}
                              </span>
                            </td>

                            <td className="px-5 py-5">
                              <span
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${style.bg} ${style.border} ${style.text}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                                />
                                {formatStatus(record.status)}
                              </span>
                            </td>

                            <td className="px-5 py-5 text-sm text-white/60">
                              {formatDate(
                                record.scheduled_date || record.created_at
                              )}
                            </td>

                            <td className="px-5 py-5 text-sm text-white/60">
                              {record.technician_name || "Maintenance Team"}
                            </td>

                            <td className="max-w-[300px] px-7 py-5">
                              <p
                                className="truncate text-sm text-white/45"
                                title={record.description || ""}
                              >
                                {record.description || "No description"}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="grid gap-4 p-4 lg:hidden">
                  {records.map((record) => {
                    const style = statusStyle(record.status);

                    return (
                      <div
                        key={record.id}
                        className="rounded-2xl border border-purple-400/10 bg-[#0b0b1c] p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-mono text-xs text-purple-300">
                              {record.id}
                            </p>

                            <h3 className="mt-2 text-sm font-semibold text-white">
                              {formatType(record.maintenance_type)}
                            </h3>
                          </div>

                          <span
                            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${style.bg} ${style.border} ${style.text}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
                            />

                            {formatStatus(record.status)}
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-4">
                          <InfoItem
                            label="Date"
                            value={formatDate(
                              record.scheduled_date || record.created_at
                            )}
                          />

                          <InfoItem
                            label="Technician"
                            value={
                              record.technician_name || "Maintenance Team"
                            }
                          />
                        </div>

                        <div className="mt-5 border-t border-purple-400/10 pt-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
                            Description
                          </p>

                          <p className="mt-2 text-sm leading-6 text-white/50">
                            {record.description || "No description"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-purple-400/10 bg-[#080817] p-5 shadow-[0_0_30px_rgba(124,58,237,0.04)] transition hover:border-purple-400/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
            {title}
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {value}
          </p>

          <p className="mt-1 text-xs text-white/30">
            {description}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/10 bg-purple-500/5 text-lg text-purple-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
        {label}
      </p>

      <p className="mt-1 text-sm text-white/60">
        {value}
      </p>
    </div>
  );
}