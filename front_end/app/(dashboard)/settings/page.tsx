"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

type User = {
  name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
};

export default function SettingsPage() {
  const [user, setUser] = useState<User>({});
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedPreferences = localStorage.getItem("dashboard_preferences");
      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedPreferences) {
        const preferences = JSON.parse(storedPreferences);
        setAutoRefresh(preferences.autoRefresh ?? true);
        setNotifications(preferences.notifications ?? true);
      }
    } catch {
      // Keep safe defaults if browser storage contains invalid data.
    }

    fetch(`${API_URL}/health`)
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        setApiStatus("online");
      })
      .catch(() => setApiStatus("offline"));
  }, []);

  function savePreferences() {
    localStorage.setItem(
      "dashboard_preferences",
      JSON.stringify({ autoRefresh, notifications })
    );
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="min-h-[calc(100vh-94px)] bg-[#070611] px-5 py-8 text-zinc-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-300/60">
            System configuration
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage your profile and dashboard preferences. Changes here are stored locally in this browser.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-2xl border border-white/[0.08] bg-[#0d0c18] p-6 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-3 border-b border-white/[0.07] pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300 ring-1 ring-purple-400/20">
                <span className="text-lg font-bold">{(user.name || "U").charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h2 className="font-semibold text-white">Profile</h2>
                <p className="text-xs text-zinc-500">Authenticated account information</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoField label="Full name" value={user.name || "Not available"} />
              <InfoField label="Email" value={user.email || "Not available"} />
              <InfoField label="Role" value={(user.role || "USER").toUpperCase()} />
              <InfoField label="Account status" value={user.is_active === false ? "Inactive" : "Active"} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0d0c18] p-6 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-5">
              <div>
                <h2 className="font-semibold text-white">API connection</h2>
                <p className="mt-1 text-xs text-zinc-500">Backend service availability</p>
              </div>
              <span className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                apiStatus === "online"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                  : apiStatus === "offline"
                    ? "border-rose-400/20 bg-rose-400/10 text-rose-300"
                    : "border-white/10 bg-white/[0.03] text-zinc-400"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${apiStatus === "online" ? "bg-emerald-400" : apiStatus === "offline" ? "bg-rose-400" : "bg-zinc-500"}`} />
                {apiStatus === "checking" ? "Checking" : apiStatus === "online" ? "Operational" : "Offline"}
              </span>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">API endpoint</p>
              <p className="mt-2 break-all font-mono text-xs text-purple-200/80">{API_URL}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0d0c18] p-6 shadow-2xl shadow-black/20 lg:col-span-2">
            <div className="border-b border-white/[0.07] pb-5">
              <h2 className="font-semibold text-white">Dashboard preferences</h2>
              <p className="mt-1 text-xs text-zinc-500">Personalize how the monitoring interface behaves on this device.</p>
            </div>

            <div className="mt-5 divide-y divide-white/[0.06]">
              <PreferenceRow
                title="Automatic refresh"
                description="Keep machine and prediction views refreshed while you monitor the system."
                enabled={autoRefresh}
                onChange={setAutoRefresh}
              />
              <PreferenceRow
                title="Operational notifications"
                description="Allow the interface to highlight important anomaly and maintenance events."
                enabled={notifications}
                onChange={setNotifications}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              {saved && <span className="text-xs font-medium text-emerald-300">Preferences saved</span>}
              <button
                type="button"
                onClick={savePreferences}
                className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-950/30 transition hover:bg-purple-500 active:scale-[0.98]"
              >
                Save preferences
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#0d0c18] p-6 shadow-2xl shadow-black/20 lg:col-span-2">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                🔐
              </div>
              <div>
                <h2 className="font-semibold text-white">Security & session</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Your login session is represented by a JWT access token. The backend controls its expiry and authentication rules.
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  To end the current browser session, use <span className="text-zinc-300">Sign out</span> from the profile area in the sidebar.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/15 px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1.5 truncate text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function PreferenceRow({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition ${enabled ? "border-purple-400/40 bg-purple-600/80" : "border-white/10 bg-white/[0.06]"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
