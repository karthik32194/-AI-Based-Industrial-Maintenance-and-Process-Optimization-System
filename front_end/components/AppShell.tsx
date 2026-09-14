"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Login page should be completely separate
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#050511]">

      {/* SIDEBAR */}
      <div className="h-screen shrink-0">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* RIGHT SIDE */}
      <div className="min-w-0 flex-1 h-screen overflow-y-auto overflow-x-hidden">

        {/* TOP BAR */}
        <header className="sticky top-0 z-40 border-b border-purple-400/[0.10] bg-[#080817]/95 backdrop-blur-xl">
          <div className="flex h-[94px] items-center justify-between px-5 md:px-8">

            {/* LEFT SIDE */}
            <div className="flex items-center gap-4">

             

              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,.9)]" />

                 <h2 className="text-xl font-bold text-white md:text-2xl">
  AI-Based Industrial Maintenance
</h2>
                </div>

                <p className="mt-2 pl-4 text-xs font-medium uppercase tracking-[0.2em] text-purple-300/50">
  Predictive Maintenance • Process Optimization
</p>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="flex items-center gap-3">

              <div className="hidden rounded-full border border-purple-400/10 bg-purple-500/[0.04] px-4 py-2 text-[10px] text-purple-200/60 sm:block">
                Motor 01
              </div>

              <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />

                <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                  Live System
                </span>
              </div>

            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main>
          {children}
        </main>

      </div>
    </div>
  );
}