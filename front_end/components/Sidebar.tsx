"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: number;
}

const platformLinks: NavItem[] = [
  { name: "Dashboard", href: "/", icon: "dashboard" },
  { name: "Machines", href: "/machines", icon: "machine" },
  { name: "Predictions", href: "/predictions", icon: "prediction" },
  { name: "Anomalies", href: "/anomalies", icon: "anomaly", badge: 3 },
  { name: "Maintenance", href: "/maintenance", icon: "maintenance" },
  { name: "Optimization", href: "/optimization", icon: "optimization" },
  { name: "AI Assistant", href: "/ai-assistant", icon: "assistant" },
];

const supportLinks: NavItem[] = [
  { name: "Settings", href: "/settings", icon: "settings" },
  { name: "Help & Support", href: "/support", icon: "support" },
];

function NavIcon({ type, className = "h-[21px] w-[21px]" }: { type: string; className?: string }) {
  switch (type) {
    case "dashboard":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "machine":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="8" x="2" y="2" rx="2" />
          <rect width="20" height="8" x="2" y="14" rx="2" />
          <line x1="6" x2="6.01" y1="6" y2="6" strokeWidth="2.5" />
          <line x1="6" x2="6.01" y1="18" y2="18" strokeWidth="2.5" />
        </svg>
      );
    case "prediction":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20V10" />
          <path d="M18 20V4" />
          <path d="M6 20v-4" />
        </svg>
      );
    case "anomaly":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "maintenance":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "optimization":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      );
    case "assistant":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v2" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      );
    case "settings":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "support":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return null;
  }
}

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const userName = user?.name || "Karthik";
  const userRole = user?.role || "ADMIN";
  const userInitial = userName.charAt(0).toUpperCase();

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setShowLogoutConfirm(false);
    router.replace("/login");
  }

  return (
    <>
      <aside
        className={`sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-white/[0.08] bg-[#070611] font-sans text-zinc-100 transition-all duration-200 ease-in-out select-none ${
          collapsed ? "w-[72px]" : "w-[270px]"
        }`}
      >
        {/* =========================================
            1. BRAND HEADER
            ========================================= */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Hex Industrial Gear Glyph */}
            <div 
              onClick={collapsed ? onToggle : undefined}
              className={`flex h-8 w-8 shrink-0 items-center justify-center text-purple-400 ${
                collapsed ? "cursor-pointer hover:text-purple-300" : ""
              }`}
              title={collapsed ? "Expand sidebar" : undefined}
            >
              <svg className="h-6 w-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 21.5 7.5 21.5 18.5 12 24 2.5 18.5 2.5 7.5 12 2" />
                <circle cx="12" cy="13" r="3.5" strokeWidth="2" />
              </svg>
            </div>

            {/* INDUSTRIAL AI (22px, 700 bold, -0.5px letter spacing, white) */}
            {!collapsed && (
              <span className="truncate text-[22px] font-bold tracking-[-0.5px] text-white">
                INDUSTRIAL AI
              </span>
            )}
          </div>

          {/* Top-Right Collapse Button */}
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="4" y2="18" />
              <polyline points="14 6 8 12 14 18" />
            </svg>
          </button>
        </div>

        {/* =========================================
            2. SCROLLABLE NAVIGATION
            ========================================= */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-thin scrollbar-thumb-white/10">
          
          {/* Section Title: PLATFORM (12px, 600 weight, 2px spacing, uppercase, muted) */}
          {!collapsed && (
            <div className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-[2px] text-purple-300/60">
              PLATFORM
            </div>
          )}

          <ul className="space-y-1">
            {platformLinks.map((link) => {
              const active = pathname === link.href;

              return (
                <li key={link.href} className="relative group">
                  <Link
                    href={link.href}
                    className={`relative flex h-11 items-center rounded-xl text-[16.5px] tracking-[-0.1px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                      collapsed ? "justify-center px-0" : "px-3.5 gap-3.5"
                    } ${
                      active
                        ? "border border-purple-500/25 bg-purple-600/15 font-semibold text-white shadow-sm"
                        : "border border-transparent font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                    }`}
                  >
                    {/* Active Accent Left Edge Bar */}
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-md bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                    )}

                    {/* Icon */}
                    <span className={`shrink-0 transition-colors ${active ? "text-purple-300" : "text-zinc-400 group-hover:text-zinc-200"}`}>
                      <NavIcon type={link.icon} className="h-[21px] w-[21px]" />
                    </span>

                    {/* Navigation Name & Badge */}
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{link.name}</span>
                        {link.badge && link.badge > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e11d48] text-[11px] font-bold text-white shadow-sm">
                            {link.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>

                  {/* Tooltip on Collapsed Mode */}
                  {collapsed && (
                    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <div className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.12] bg-[#121122] px-3 py-1.5 text-sm font-medium text-white shadow-2xl">
                        <span>{link.name}</span>
                        {link.badge && link.badge > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e11d48] text-[10px] font-bold text-white">
                            {link.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Divider */}
          <div className="my-3.5 border-t border-white/[0.06]" />

          {/* Section Title: SUPPORT (12px, 600 weight, 2px spacing, uppercase, muted) */}
          {!collapsed && (
            <div className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-[2px] text-purple-300/60">
              SUPPORT
            </div>
          )}

          <ul className="space-y-1">
            {supportLinks.map((link) => {
              const active = pathname === link.href;

              return (
                <li key={link.href} className="relative group">
                  <Link
                    href={link.href}
                    className={`relative flex h-11 items-center rounded-xl text-[16.5px] tracking-[-0.1px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                      collapsed ? "justify-center px-0" : "px-3.5 gap-3.5"
                    } ${
                      active
                        ? "border border-purple-500/25 bg-purple-600/15 font-semibold text-white shadow-sm"
                        : "border border-transparent font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-md bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                    )}

                    <span className={`shrink-0 transition-colors ${active ? "text-purple-300" : "text-zinc-400 group-hover:text-zinc-200"}`}>
                      <NavIcon type={link.icon} className="h-[21px] w-[21px]" />
                    </span>

                    {!collapsed && <span className="flex-1 truncate">{link.name}</span>}
                  </Link>

                  {collapsed && (
                    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <div className="whitespace-nowrap rounded-lg border border-white/[0.12] bg-[#121122] px-3 py-1.5 text-sm font-medium text-white shadow-2xl">
                        {link.name}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* =========================================
            3. STATUS: SYSTEM OPERATIONAL (13.5px, 600 weight, green)
            ========================================= */}
        <div className="shrink-0 border-t border-white/[0.06] px-4 py-2.5">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[13.5px] font-semibold text-emerald-400">
                System operational
              </span>
            </div>
          ) : (
            <div className="group relative flex justify-center py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <div className="whitespace-nowrap rounded-lg border border-white/[0.12] bg-[#121122] px-3 py-1.5 text-xs font-semibold text-emerald-400 shadow-xl">
                  System operational
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================
            4. USER PROFILE & LOGOUT
            ========================================= */}
        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
            
            {/* User Details */}
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Clean Avatar Circle */}
              <div 
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 text-sm font-bold text-white shadow-sm"
                title={collapsed ? userName : undefined}
              >
                {userInitial}
              </div>

              {!collapsed && (
                <div className="min-w-0">
                  {/* Name: 15px, 600 semi-bold */}
                  <span className="block truncate text-[15px] font-semibold text-white">
                    {userName}
                  </span>
                  {/* Role: 11px, 500 medium, uppercase, tracking-wider */}
                  <span className="block truncate text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    {userRole}
                  </span>
                </div>
              )}
            </div>

            {/* Logout Trigger Button */}
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign out"
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
              </button>
            ) : (
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  title="Sign out"
                  aria-label="Sign out"
                  className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-white"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" x2="9" y1="12" y2="12" />
                  </svg>
                </button>
                <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <div className="whitespace-nowrap rounded-lg border border-white/[0.12] bg-[#121122] px-3 py-1.5 text-xs font-medium text-rose-300 shadow-xl">
                    Sign out
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </aside>

      {/* =========================================
          ACCESSIBLE LOGOUT CONFIRMATION MODAL
          ========================================= */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.12] bg-[#11101d] p-6 shadow-2xl shadow-black/80 font-sans">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" x2="9" y1="12" y2="12" />
              </svg>
            </div>

            {/* Modal Heading & Subtitle System */}
            <h3 className="text-xl font-bold tracking-[-0.5px] text-white">Sign Out?</h3>
            <p className="mt-1.5 text-[14px] font-normal leading-relaxed text-zinc-400">
              Are you sure you want to end your session? You will need to sign back in to access telemetry and maintenance dashboards.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}