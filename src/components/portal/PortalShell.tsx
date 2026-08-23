"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MODULE_LIST, ROLE_CONFIG, type PortalRole, type CandidateModuleStatus } from "@/lib/roles";

export interface PortalNotification {
  id: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
}

export interface PortalUser {
  name: string;
  title: string;
  org: string;
  initials: string;
}

interface PortalShellProps {
  role: PortalRole;
  user: PortalUser;
  notifications: PortalNotification[];
  /** Only meaningful for role === "candidate" — real per-candidate progress. */
  candidateStatus?: Record<string, CandidateModuleStatus>;
  children: React.ReactNode;
}

function moduleHref(code: string) {
  return `/portal/${code.toLowerCase().replace("-", "")}`;
}

export function PortalShell({ role, user, notifications, candidateStatus, children }: PortalShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const config = ROLE_CONFIG[role];
  const currentModule = MODULE_LIST.find((m) => moduleHref(m.code) === pathname)?.code ?? "M-01";
  const currentMod = MODULE_LIST.find((m) => m.code === currentModule);
  const unreadCount = notifications.filter((n) => n.unread).length;

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: config.sidebarBg }}>
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="inline-block bg-white rounded-lg px-3 py-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-lockup.png" alt="FRP Platform" className="h-7 w-auto object-contain" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span
            className="text-[10px] font-heading font-bold tracking-widest uppercase px-2 py-0.5 rounded"
            style={{ background: config.accentColor, color: "white" }}
          >
            {config.label}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3">
        {role === "candidate" ? (
          <>
            <p className="text-[10px] font-heading font-bold uppercase tracking-widest px-2 mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
              My Journey
            </p>
            <nav className="space-y-0.5">
              {MODULE_LIST.map((mod, i) => {
                const status = candidateStatus?.[mod.code] ?? "locked";
                const active = mod.code === currentModule;
                const clickable = status !== "locked";
                return (
                  <Link
                    key={mod.code}
                    href={moduleHref(mod.code)}
                    onClick={(e) => {
                      if (!clickable) {
                        e.preventDefault();
                        return;
                      }
                      setSidebarOpen(false);
                    }}
                    aria-disabled={!clickable}
                    tabIndex={clickable ? undefined : -1}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      cursor: clickable ? "pointer" : "default",
                      background: active ? "rgba(255,255,255,0.12)" : "transparent",
                      borderLeft: active ? "3px solid #FBBD15" : "3px solid transparent",
                    }}
                  >
                    <div className="relative shrink-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px]"
                        style={{
                          background:
                            status === "done" || status === "current" ? "#058812" : status === "next" ? "#FBBD15" : "rgba(255,255,255,0.08)",
                        }}
                      >
                        {status === "done" || status === "current" ? (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span style={{ color: status === "next" ? "#323232" : "rgba(255,255,255,0.25)", fontSize: "10px", fontWeight: 700 }}>
                            {i + 1}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[12px] font-heading font-semibold truncate"
                        style={{ color: status === "locked" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.85)" }}
                      >
                        {mod.title}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.25)" }}>
                        {mod.subtitle}
                      </div>
                    </div>
                    {status === "next" && (
                      <span className="text-[9px] font-heading font-bold px-1.5 py-0.5 rounded" style={{ background: "#FBBD15", color: "#323232" }}>
                        NEXT
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </>
        ) : (
          <>
            <p className="text-[10px] font-heading font-bold uppercase tracking-widest px-2 mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
              Programme Modules
            </p>
            <nav className="space-y-0.5">
              {MODULE_LIST.map((mod) => {
                const accessible = (config.modules as string[]).includes(mod.code);
                const active = mod.code === currentModule;
                return (
                  <Link
                    key={mod.code}
                    href={moduleHref(mod.code)}
                    onClick={(e) => {
                      if (!accessible) {
                        e.preventDefault();
                        return;
                      }
                      setSidebarOpen(false);
                    }}
                    aria-disabled={!accessible}
                    tabIndex={accessible ? undefined : -1}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
                    style={{
                      background: active ? config.accentColor + "22" : "transparent",
                      borderLeft: active ? `3px solid ${config.accentColor}` : "3px solid transparent",
                      opacity: accessible ? 1 : 0.35,
                      cursor: accessible ? "pointer" : "not-allowed",
                    }}
                  >
                    <span className="text-sm shrink-0">{mod.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-heading font-semibold truncate" style={{ color: active ? "white" : "rgba(255,255,255,0.6)" }}>
                        {mod.code}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {mod.title}
                      </div>
                    </div>
                    {active && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: config.accentColor }} />}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>

      <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {role === "radial" && (
          <Link
            href="/portal/users"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-3 transition-colors"
            style={{
              background: pathname === "/portal/users" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <span className="text-sm">👥</span>
            <span className="text-[12px] font-heading font-semibold">Staff Users</span>
          </Link>
        )}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-heading font-bold text-white shrink-0"
            style={{ background: config.accentColor }}
          >
            {user.initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-heading font-semibold text-white truncate">{user.name}</div>
            <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
              {user.title}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-[12px] font-heading font-semibold px-3 py-2 rounded-lg transition-colors"
          style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)" }}
        >
          ↩ Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "#f4f4f4" }}>
      <aside className="hidden lg:flex flex-col w-56 shrink-0 shadow-elev-3" style={{ height: "100vh" }}>
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-60 flex flex-col shadow-elev-4" style={{ height: "100%" }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-elev-1 shrink-0 z-10">
          <div className="flex items-center gap-4 px-5 py-0 h-16">
            <button
              className="lg:hidden p-2 rounded-lg text-[#646464] hover:bg-[#f4f4f4] transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#969696] font-heading">Field Readiness Programme</span>
                <span className="text-[#D8D8D8]">/</span>
                <span className="font-heading font-bold text-[#323232]">
                  {pathname === "/portal/users" ? "Staff Users" : `${currentMod?.code} — ${currentMod?.title}`}
                </span>
              </div>
              <div className="text-[11px] text-[#969696] mt-0.5">
                {pathname === "/portal/users" ? "Access requests & staff accounts" : currentMod?.subtitle}
              </div>
            </div>

            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-heading font-bold"
              style={{ background: "#05881212", color: "#058812", border: "1px solid #05881230" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#058812]" />
              In Progress
            </div>

            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 rounded-xl hover:bg-[#f4f4f4] transition-colors">
                <svg className="w-5 h-5 text-[#646464]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "#FBBD15" }} />}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-elev-4 border z-50 overflow-hidden" style={{ borderColor: "#D8D8D8" }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
                    <h4 className="font-heading font-bold text-sm text-[#323232]">Notifications</h4>
                    <p className="text-[11px] text-[#969696] mt-0.5">{unreadCount} unread</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 && (
                      <div className="px-5 py-6 text-center text-sm text-[#969696]">You&apos;re all caught up.</div>
                    )}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-5 py-3.5 border-b hover:bg-[#f4f4f4] transition-colors"
                        style={{ borderColor: "#f4f4f4", background: n.unread ? "#FBBD1508" : "white" }}
                      >
                        <div className="flex items-start gap-3">
                          {n.unread ? (
                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "#FBBD15" }} />
                          ) : (
                            <div className="w-1.5 h-1.5 mt-1.5 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-heading font-semibold text-[#323232]">{n.title}</p>
                            <p className="text-[12px] text-[#646464] mt-0.5 leading-relaxed">{n.desc}</p>
                            <p className="text-[11px] text-[#969696] mt-1">{n.time}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-heading font-bold text-white"
                style={{ background: config.accentColor }}
              >
                {user.initials}
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-heading font-semibold text-[#323232] leading-tight">{user.name}</div>
                <div className="text-[11px] text-[#969696]">{user.org}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
