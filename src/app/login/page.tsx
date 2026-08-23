"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORG_LOGIN_OPTIONS } from "@/lib/roles";
import type { StaffOrg } from "@/lib/database.types";

function CandidateLogin() {
  const [jqs, setJqs] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jqs || !password) {
      setError("Please enter your JQS number and password.");
      return;
    }
    if (!jqs.toUpperCase().startsWith("JQS")) {
      setError("Enter a valid JQS number (e.g. JQS-2025-0001).");
      return;
    }
    setLoading(true);
    setError("");
    const GENERIC_ERROR = "Invalid JQS number or password.";

    // Step 1: resolve JQS Number -> email server-side (RLS blocks an
    // unauthenticated read of candidates, so this has to be a route).
    const res = await fetch("/api/auth/candidate-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jqsNumber: jqs }),
    });
    if (!res.ok) {
      setLoading(false);
      setError(GENERIC_ERROR);
      return;
    }
    const { email } = await res.json();

    // Step 2: sign in from the browser's own Supabase client, not a
    // server round-trip -- this writes the session cookies directly
    // (no Next.js/Netlify response plumbing involved), which is what
    // actually fixed the "signs in, then bounces back to login" bug a
    // server-side signInWithPassword() was hitting.
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(GENERIC_ERROR);
      return;
    }
    window.location.href = "/portal";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div
        className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background: "#05881210", border: "1px solid #05881230" }}
      >
        <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-xs leading-relaxed" style={{ color: "#323232" }}>
          Use the <strong>JQS Number</strong> and password from your invitation email sent by the Radial Circle Programme Team.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">JQS Number</label>
        <input
          type="text"
          value={jqs}
          onChange={(e) => setJqs(e.target.value)}
          placeholder="e.g. JQS-2025-0001"
          className="w-full px-4 py-3 rounded-xl text-sm border-2 transition-colors font-mono"
          style={{ borderColor: "#D8D8D8", color: "#323232" }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-semibold text-[#323232] font-heading">Password</label>
          <a href="/auth/forgot-password" className="text-xs font-semibold font-heading" style={{ color: "#058812" }}>
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <input
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full px-4 py-3 pr-16 rounded-xl text-sm border-2 transition-colors"
            style={{ borderColor: "#D8D8D8", color: "#323232" }}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold font-heading"
            style={{ color: "#969696" }}
          >
            {showPwd ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl text-white text-sm font-heading font-bold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: "#058812" }}
      >
        {loading ? "Signing in…" : "Access Candidate Portal"}
      </button>

      <p className="text-center text-xs text-[#969696]">
        First time? Your invitation email contains a link to set your password.
      </p>
    </form>
  );
}

function StaffLogin() {
  const [selectedOrg, setSelectedOrg] = useState<StaffOrg | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrg) {
      setError("Please select your organisation.");
      return;
    }
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    setError("");

    // Sign in from the browser's own Supabase client -- no server round
    // trip at all now (see the matching comment + explanation in
    // CandidateLogin above; the previous server-side signInWithPassword()
    // is what was causing sign-in to appear to work and then bounce back
    // to /login).
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    // The org tile is a UX guard, not the real access boundary (RLS is)
    // -- if the account's actual org in staff_profiles doesn't match
    // what was picked, sign back out and report a clear error rather
    // than silently letting them into a portal that doesn't match the
    // tile they clicked.
    const { data: staffRow } = await supabase.from("staff_profiles").select("org").eq("id", data.user.id).maybeSingle();
    if (!staffRow) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("This account isn't set up as staff yet. Contact your programme administrator.");
      return;
    }
    if (staffRow.org !== selectedOrg) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(`This account is registered under a different organisation, not ${selectedOrg}.`);
      return;
    }

    setLoading(false);
    window.location.href = "/portal";
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/set-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setForgotSent(true);
  }

  if (forgotSent) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#05881215" }}>
          <svg className="w-7 h-7" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-heading font-bold text-lg text-[#323232] mb-2">Check your inbox</h3>
        <p className="text-sm text-[#646464] mb-5">
          If <strong>{email}</strong> has an account, a reset link is on its way.
        </p>
        <button
          onClick={() => {
            setForgotMode(false);
            setForgotSent(false);
          }}
          className="text-sm font-semibold font-heading"
          style={{ color: "#058812" }}
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  if (forgotMode) {
    return (
      <form onSubmit={handleForgot} className="space-y-4">
        <button
          onClick={() => {
            setForgotMode(false);
            setError("");
          }}
          type="button"
          className="flex items-center gap-2 text-sm text-[#646464] hover:text-[#323232] mb-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to sign in
        </button>
        <div>
          <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@organisation.com"
            className="w-full px-4 py-3 rounded-xl text-sm border-2 transition-colors"
            style={{ borderColor: "#D8D8D8", color: "#323232" }}
          />
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl text-white text-sm font-heading font-bold disabled:opacity-60"
          style={{ background: "#058812" }}
        >
          {loading ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-[#323232] mb-2 font-heading">Your Organisation</label>
        <div className="grid grid-cols-2 gap-2">
          {ORG_LOGIN_OPTIONS.map((r) => {
            const active = selectedOrg === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedOrg(r.id)}
                className="text-left p-3 rounded-xl border-2 transition-all duration-200"
                style={{ borderColor: active ? "#058812" : "#D8D8D8", background: active ? "#05881208" : "white" }}
              >
                <div className="font-heading font-bold text-sm" style={{ color: active ? "#058812" : "#323232" }}>
                  {r.label}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "#969696" }}>
                  {r.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@organisation.com"
          className="w-full px-4 py-3 rounded-xl text-sm border-2 transition-colors"
          style={{ borderColor: "#D8D8D8", color: "#323232" }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-semibold text-[#323232] font-heading">Password</label>
          <button
            type="button"
            onClick={() => {
              setForgotMode(true);
              setError("");
            }}
            className="text-xs font-semibold font-heading"
            style={{ color: "#058812" }}
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            type={showPwd ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full px-4 py-3 pr-16 rounded-xl text-sm border-2 transition-colors"
            style={{ borderColor: "#D8D8D8", color: "#323232" }}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold font-heading"
            style={{ color: "#969696" }}
          >
            {showPwd ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl text-white text-sm font-heading font-bold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ background: "#058812" }}
      >
        {loading ? "Signing in…" : "Sign In to Portal"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const [view, setView] = useState<"staff" | "candidate">("staff");

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: "#f4f4f4" }}>
      {/* Left brand panel */}
      <div
        className="lg:w-[44%] flex flex-col justify-between p-8 lg:p-14"
        style={{ background: "linear-gradient(155deg, #0D1F0E 0%, #058812 55%, #0a4a10 100%)" }}
      >
        <div>
          <div className="mb-10">
            <div className="inline-block bg-white rounded-xl px-4 py-2.5 shadow-elev-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-lockup.png" alt="NCDMB & Renaissance Africa Energy" className="h-10 w-auto object-contain" />
            </div>
          </div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{ background: "rgba(251,189,21,0.2)", border: "1px solid rgba(251,189,21,0.4)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FBBD15" }} />
            <span className="text-xs font-heading font-semibold tracking-wider uppercase" style={{ color: "#FBBD15" }}>
              Active Programme
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-white leading-tight mb-4" style={{ fontSize: "clamp(26px, 4vw, 40px)" }}>
            Field Readiness
            <br />
            Programme
          </h1>
          <p className="text-white/60 text-base leading-relaxed max-w-xs">
            Digital Platform for Candidate Management — Nigerian Oil &amp; Gas Sector, 2025 Cohort
          </p>
        </div>

        <div>
          <div className="rounded-2xl p-6 mb-8" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <p className="text-white/40 text-xs font-heading font-semibold uppercase tracking-wider mb-5">Programme Snapshot</p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="font-heading font-extrabold text-white text-3xl mb-1">900</div>
                <div className="text-white/40 text-xs">Nominated</div>
              </div>
              <div>
                <div className="font-heading font-extrabold text-3xl mb-1" style={{ color: "#FBBD15" }}>
                  300
                </div>
                <div className="text-white/40 text-xs">Selected</div>
              </div>
              <div>
                <div className="font-heading font-extrabold text-3xl mb-1" style={{ color: "#EDE82C" }}>
                  12mo
                </div>
                <div className="text-white/40 text-xs">Duration</div>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-3 gap-4">
              {[
                { label: "Intake", date: "Aug 24", dot: "#EDE82C" },
                { label: "Assessment", date: "Sep 6–10", dot: "#FBBD15" },
                { label: "OJT Ends", date: "Sep 2026", dot: "#058812" },
              ].map((m) => (
                <div key={m.label} className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ background: m.dot }} />
                  <div>
                    <div className="text-white text-xs font-semibold">{m.label}</div>
                    <div className="text-white/40 text-[11px]">{m.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-white/25 text-xs">© 2025 Radial Circle · NCDMB · Renaissance Africa Energy. Confidential.</p>
        </div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[440px]">
          <div className="flex rounded-2xl p-1 mb-6 shadow-elev-1 bg-white">
            <button
              onClick={() => setView("staff")}
              className="flex-1 py-2.5 rounded-xl text-sm font-heading font-bold transition-all duration-200"
              style={{ background: view === "staff" ? "#058812" : "transparent", color: view === "staff" ? "white" : "#969696" }}
            >
              Staff / Partners
            </button>
            <button
              onClick={() => setView("candidate")}
              className="flex-1 py-2.5 rounded-xl text-sm font-heading font-bold transition-all duration-200"
              style={{ background: view === "candidate" ? "#FBBD15" : "transparent", color: view === "candidate" ? "#323232" : "#969696" }}
            >
              Candidate
            </button>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-elev-4">
            <div className="mb-7">
              <h2 className="font-heading font-bold text-2xl text-[#323232] mb-1">
                {view === "candidate" ? "Candidate Sign In" : "Staff Sign In"}
              </h2>
              <p className="text-[#646464] text-sm">
                {view === "candidate" ? "Access your personal programme portal" : "Access your stakeholder portal"}
              </p>
            </div>

            {view === "candidate" ? <CandidateLogin /> : <StaffLogin />}
          </div>

          <p className="text-center text-xs text-[#969696] mt-5 leading-relaxed">
            For access issues, contact your programme administrator at Radial Circle.
          </p>
        </div>
      </div>
    </div>
  );
}
