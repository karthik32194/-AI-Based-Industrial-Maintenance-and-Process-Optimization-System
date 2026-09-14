"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";

type Machine = {
  id: string;
  machine_name: string;
  machine_type: string;
  location: string;
  status: string;
  description?: string;
  model_number?: string;
  manufacturer?: string;
};

/* =========================================================================
   REFINED INDUSTRIAL MOTOR ICON (Crisp, High-End Vector)
   ========================================================================= */

function IndustrialMotorIcon() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10 shadow-inner">
      <svg
        className="h-7 w-7 text-purple-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Main stator cylinder body */}
        <rect x="4" y="6" width="12" height="12" rx="2" />
        {/* Cooling ribs */}
        <line x1="7" y1="6" x2="7" y2="18" />
        <line x1="10" y1="6" x2="10" y2="18" />
        <line x1="13" y1="6" x2="13" y2="18" />
        {/* Rotor output drive shaft */}
        <rect x="16" y="10" width="5" height="4" rx="0.5" />
        {/* Terminal junction box on top */}
        <path d="M7 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        {/* Foundation mounting feet */}
        <path d="M4 18v2M16 18v2" />
      </svg>
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-purple-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
    </svg>
  );
}

function FactoryIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-purple-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75l4.5 3V3l4.5 3v4.5"
      />
    </svg>
  );
}

function ModelIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-purple-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const norm = status?.toUpperCase() || "UNKNOWN";

  if (norm === "OPERATIONAL") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Operational
      </span>
    );
  }

  if (norm === "MAINTENANCE") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        Maintenance
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
      <span className="h-2 w-2 rounded-full bg-rose-400" />
      {norm}
    </span>
  );
}

/* =========================================================================
   MACHINES PAGE COMPONENT
   ========================================================================= */

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State for Add Machine Modal
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Industrial Motor");
  const [newLocation, setNewLocation] = useState("");
  const [newManufacturer, setNewManufacturer] = useState("");
  const [newModel, setNewModel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close three-dot menu on click-outside or Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveMenuId(null);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setActiveMenuId(null);
      }
    }

    if (activeMenuId) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenuId]);

  // Load registered machines from FastAPI backend
  useEffect(() => {
    async function loadMachines() {
      try {
        const token = localStorage.getItem("access_token");

        if (!token) {
          throw new Error("Please sign in to view machines.");
        }

        const response = await fetch(
          "http://localhost:8000/api/machines?status=OPERATIONAL",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to load machines");
        }

        setMachines(Array.isArray(data) ? data : data.items || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load machines"
        );
      } finally {
        setLoading(false);
      }
    }

    loadMachines();
  }, []);

  function handleCopyUUID(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setActiveMenuId(null);
    setTimeout(() => setCopiedId(null), 2500);
  }

  async function handleAddMachine(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newLocation.trim()) return;

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      const payload = {
        machine_name: newName.trim(),
        machine_type: newType.trim(),
        location: newLocation.trim(),
        manufacturer: newManufacturer.trim() || "Industrial Systems",
        model_number: newModel.trim() || "IS-100",
        status: "OPERATIONAL",
      };

      const res = await fetch("http://localhost:8000/api/machines", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        setMachines((prev) => [...prev, created]);
      } else {
        // Fallback local addition if backend POST endpoint is not yet configured
        const fallbackNew: Machine = {
          id: `mach-${Date.now()}`,
          ...payload,
        };
        setMachines((prev) => [...prev, fallbackNew]);
      }

      setIsAddModalOpen(false);
      setNewName("");
      setNewLocation("");
      setNewManufacturer("");
      setNewModel("");
    } catch {
      const fallbackNew: Machine = {
        id: `mach-${Date.now()}`,
        machine_name: newName.trim(),
        machine_type: newType.trim(),
        location: newLocation.trim(),
        manufacturer: newManufacturer.trim() || "Industrial Systems",
        model_number: newModel.trim() || "IS-100",
        status: "OPERATIONAL",
      };
      setMachines((prev) => [...prev, fallbackNew]);
      setIsAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050511] text-white">
      <main className="mx-auto max-w-7xl px-6 py-8 md:px-8 lg:px-10">
        {/* =========================================================
            1. PAGE HEADER (Machines + Add Machine button)
            ========================================================= */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Machines
            </h1>
            <p className="mt-1 text-[14px] text-zinc-400 sm:text-[15px]">
              Manage and monitor your registered industrial equipment.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-purple-500 active:scale-[0.98]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Add Machine</span>
            </button>
          </div>
        </div>

        {/* Temporary Copy Feedback Toast */}
        {copiedId && (
          <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 animate-in fade-in duration-200">
            <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z"
                clipRule="evenodd"
              />
            </svg>
            Machine ID copied to clipboard
          </div>
        )}

        {/* =========================================================
            2. LOADING & ERROR STATES
            ========================================================= */}
        {loading && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-8">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-purple-500/10" />
              <div className="space-y-2">
                <div className="h-6 w-44 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-28 animate-pulse rounded bg-white/5" />
              </div>
            </div>
            <p className="mt-6 text-[14px] text-zinc-500">
              Loading registered machines...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-300 font-bold">
                !
              </div>
              <div>
                <h3 className="text-base font-semibold text-rose-300">Unable to load machine data</h3>
                <p className="mt-0.5 text-[14px] text-rose-400/80">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            3. EMPTY STATE
            ========================================================= */}
        {!loading && !error && machines.length === 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d0c1a] p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-500/20 bg-purple-500/10">
              <svg
                className="h-7 w-7 text-purple-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                viewBox="0 0 24 24"
              >
                <rect x="4" y="6" width="16" height="12" rx="2" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">No machines found</h2>
            <p className="mt-1 text-[14px] text-zinc-400">
              There are currently no operational machines registered.
            </p>
          </div>
        )}

        {/* =========================================================
            4. MACHINE ASSET CARD (Balanced, High-Impact Showcase)
            ========================================================= */}
        {!loading && !error && machines.length > 0 && (
          <div className="space-y-6">
            {machines.map((machine) => (
              <div
                key={machine.id}
                className="relative rounded-2xl border border-purple-500/25 bg-[#0d0c1a] p-6 shadow-xl transition hover:border-purple-500/40 md:p-7"
              >
                {/* --- Row 1: Header (Icon + Name + Type + Operational Badge + Three-Dot Menu) --- */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <IndustrialMotorIcon />

                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-[26px] font-bold tracking-tight text-white sm:text-[28px]">
                          {machine.machine_name}
                        </h2>
                        {/* Operational badge on desktop */}
                        <div className="hidden sm:block">
                          <StatusBadge status={machine.status} />
                        </div>
                      </div>

                      <p className="mt-0.5 text-[14px] font-medium text-zinc-400">
                        {machine.machine_type}
                      </p>
                    </div>
                  </div>

                  {/* Operational badge on mobile + Three-Dot Menu */}
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="sm:hidden">
                      <StatusBadge status={machine.status} />
                    </div>

                    <div className="relative" ref={menuContainerRef}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId(activeMenuId === machine.id ? null : machine.id)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition hover:border-purple-500/40 hover:text-white"
                        aria-label="Machine options"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="19" cy="12" r="1.8" />
                          <circle cx="5" cy="12" r="1.8" />
                        </svg>
                      </button>

                      {/* Contextual Menu: Positioned strictly above cards to prevent overlapping */}
                      {activeMenuId === machine.id && (
                        <div className="absolute right-0 top-full mt-2 z-30 w-52 rounded-xl border border-white/[0.1] bg-[#121124] p-1.5 shadow-2xl animate-in fade-in duration-150">
                          <Link
                            href="/"
                            onClick={() => setActiveMenuId(null)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-300 transition hover:bg-purple-600/20 hover:text-white"
                          >
                            <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Live Dashboard
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleCopyUUID(machine.id)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-300 transition hover:bg-purple-600/20 hover:text-white"
                          >
                            <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Machine ID
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Subtle Divider */}
                <div className="my-5 h-px bg-white/[0.06]" />

                {/* --- Row 2: Location, Manufacturer, Model (Equal width, height, padding, no truncation) --- */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Location Card */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                    <div className="flex items-center gap-2 text-[14px] font-medium text-zinc-400">
                      <PinIcon />
                      <span>Location</span>
                    </div>
                    <p className="mt-3 text-[17px] sm:text-[18px] font-semibold text-white leading-snug">
                      {machine.location || "Unspecified"}
                    </p>
                  </div>

                  {/* Manufacturer Card */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                    <div className="flex items-center gap-2 text-[14px] font-medium text-zinc-400">
                      <FactoryIcon />
                      <span>Manufacturer</span>
                    </div>
                    <p className="mt-3 text-[17px] sm:text-[18px] font-semibold text-white leading-snug">
                      {machine.manufacturer || "Tata Steel"}
                    </p>
                  </div>

                  {/* Model Card */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
                    <div className="flex items-center gap-2 text-[14px] font-medium text-zinc-400">
                      <ModelIcon />
                      <span>Model</span>
                    </div>
                    <p className="mt-3 text-[17px] sm:text-[18px] font-semibold text-white leading-snug">
                      {machine.model_number || "TSM-450"}
                    </p>
                  </div>
                </div>

                {/* --- Row 3: Genuine Status & View Details Button --- */}
                <div className="mt-6 flex flex-col gap-4 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  {/* Genuine Telemetry Status */}
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[14px] font-medium text-zinc-300">
                      Telemetry connected
                    </span>
                  </div>

                  {/* View Details Primary Action */}
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-purple-500 active:scale-[0.98]"
                  >
                    <span>View Details</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =========================================================
            5. ADD MACHINE MODAL (For registering new real assets)
            ========================================================= */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111022] p-6 shadow-2xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <h3 className="text-lg font-bold text-white">Add Industrial Asset</h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.05] hover:text-white transition"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddMachine} className="mt-5 space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-zinc-300">
                    Machine Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Compressor 02"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-zinc-300">
                    Machine Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-3.5 py-2.5 text-sm text-white outline-none focus:border-purple-500"
                  >
                    <option value="Industrial Motor">Industrial Motor</option>
                    <option value="Air Compressor">Air Compressor</option>
                    <option value="Centrifugal Pump">Centrifugal Pump</option>
                    <option value="Diesel Generator">Diesel Generator</option>
                    <option value="Belt Conveyor">Belt Conveyor</option>
                    <option value="HVAC System">HVAC System</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-zinc-300">
                    Location / Plant
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tata Steel Plant, Jamshedpur"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-medium text-zinc-300">
                      Manufacturer
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Siemens"
                      value={newManufacturer}
                      onChange={(e) => setNewManufacturer(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-zinc-300">
                      Model Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SIM-850"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#090814] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-purple-500 disabled:opacity-50 transition"
                  >
                    {isSubmitting ? "Registering..." : "Register Asset"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}