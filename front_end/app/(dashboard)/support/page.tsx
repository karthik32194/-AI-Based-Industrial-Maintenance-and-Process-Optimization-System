"use client";

import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

const faqs = [
  {
    q: "How do I get started?",
    a: "Sign in with your registered account, then open Machines to view the machines available to your account. The dashboard uses the authenticated backend data rather than requiring you to register again.",
  },
  {
    q: "What does the health score represent?",
    a: "The dashboard presents the health score returned by the prediction service. Use it together with failure probability, risk level, sensor readings, and anomaly information rather than treating one number as the complete machine condition.",
  },
  {
    q: "What should I do when an anomaly appears?",
    a: "Open Anomalies to inspect the affected machine and its prediction information. Use the Maintenance area for the available maintenance recommendations and records.",
  },
  {
    q: "Why does the dashboard say no active machine found?",
    a: "The dashboard looks for a machine returned by the backend that is not marked DECOMMISSIONED. If no such machine exists for the authenticated account, there is nothing for the dashboard to display.",
  },
  {
    q: "Why am I asked to sign in again?",
    a: "The frontend stores the access token in the browser, but the backend JWT has an expiry time. When that token expires, sign in again to obtain a fresh token. This is different from registering a new user.",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((response) => {
        if (!response.ok) throw new Error("offline");
        setApiStatus("online");
      })
      .catch(() => setApiStatus("offline"));
  }, []);

  return (
    <div className="min-h-[calc(100vh-94px)] bg-[#070611] px-5 py-8 text-zinc-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-300/60">Support center</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Help &amp; Support</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Quick guidance for monitoring machines, predictions, anomalies, maintenance, and the AI assistant.
            </p>
          </div>
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10 px-4 py-2.5 text-xs font-semibold text-purple-200 transition hover:bg-purple-500/15"
          >
            Open API documentation ↗
          </a>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-2xl border border-white/[0.08] bg-[#0d0c18] p-6 shadow-2xl shadow-black/20">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10 text-purple-300">?</div>
              <div>
                <h2 className="font-semibold text-white">Frequently asked questions</h2>
                <p className="text-xs text-zinc-500">Common questions about the monitoring platform</p>
              </div>
            </div>

            <div className="space-y-2">
              {faqs.map((faq, index) => {
                const open = openFaq === index;
                return (
                  <div key={faq.q} className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/15">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? -1 : index)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                      aria-expanded={open}
                    >
                      <span className="text-sm font-semibold text-zinc-200">{faq.q}</span>
                      <span className="text-lg text-purple-300">{open ? "−" : "+"}</span>
                    </button>
                    {open && (
                      <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                        <p className="text-xs leading-6 text-zinc-400">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-5">
            <section className="rounded-2xl border border-white/[0.08] bg-[#0d0c18] p-6 shadow-2xl shadow-black/20">
              <h2 className="font-semibold text-white">System status</h2>
              <p className="mt-1 text-xs text-zinc-500">Live check from this browser</p>
              <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/15 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Backend API</span>
                  <Status status={apiStatus} />
                </div>
                <div className="mt-3 border-t border-white/[0.06] pt-3 text-[10px] text-zinc-600">{API_URL}</div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#0d0c18] p-6 shadow-2xl shadow-black/20">
              <h2 className="font-semibold text-white">Need more help?</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                For development and integration issues, check the API documentation first. It exposes the backend endpoints, request formats, and response models used by the application.
              </p>
              <a
                href={`${API_URL}/docs`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/[0.09]"
              >
                View Swagger docs
              </a>
            </section>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-purple-400/10 bg-purple-500/[0.04] p-5">
          <p className="text-xs leading-6 text-zinc-400">
            <span className="font-semibold text-purple-200">Tip:</span> If a page cannot load machine information, first check that Docker is running and that the backend health endpoint is available. Then sign in again if your access token has expired.
          </p>
        </div>
      </div>
    </div>
  );
}

function Status({ status }: { status: "checking" | "online" | "offline" }) {
  const online = status === "online";
  const offline = status === "offline";
  return (
    <span className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${online ? "text-emerald-300" : offline ? "text-rose-300" : "text-zinc-400"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-emerald-400" : offline ? "bg-rose-400" : "bg-zinc-500"}`} />
      {status === "checking" ? "Checking" : online ? "Operational" : "Offline"}
    </span>
  );
}
