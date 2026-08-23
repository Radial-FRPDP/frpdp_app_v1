"use client";

import { useState } from "react";
import { ORG_LOGIN_OPTIONS } from "@/lib/roles";
import type { StaffOrg } from "@/lib/database.types";

interface Centre {
  id: string;
  name: string;
  state: string;
}

export function RequestAccessForm({ centres }: { centres: Centre[] }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState<StaffOrg>("ncdmb");
  const [title, setTitle] = useState("");
  const [cbtCentreId, setCbtCentreId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (org === "cbt" && !cbtCentreId) {
      setError("Select your assessment centre.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, org, title, cbtCentreId: org === "cbt" ? cbtCentreId : null, note }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "#05881215" }}>
          <svg className="w-8 h-8" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-heading font-bold text-lg text-[#323232] mb-2">Request received</h2>
        <p className="text-sm text-[#646464] leading-relaxed">
          We&apos;ll email <strong>{email}</strong> once a Programme Manager reviews your request and sets up your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Full name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="w-full px-4 py-3 rounded-xl text-sm border-2"
          style={{ borderColor: "#D8D8D8", color: "#323232" }}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Work email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@organisation.com"
          className="w-full px-4 py-3 rounded-xl text-sm border-2"
          style={{ borderColor: "#D8D8D8", color: "#323232" }}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Organisation</label>
        <select
          value={org}
          onChange={(e) => setOrg(e.target.value as StaffOrg)}
          className="w-full px-4 py-3 rounded-xl text-sm border-2"
          style={{ borderColor: "#D8D8D8", color: "#323232" }}
        >
          {ORG_LOGIN_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} — {o.desc}
            </option>
          ))}
        </select>
      </div>

      {org === "cbt" && (
        <div>
          <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Assessment centre</label>
          <select
            value={cbtCentreId}
            onChange={(e) => setCbtCentreId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm border-2"
            style={{ borderColor: "#D8D8D8", color: "#323232" }}
          >
            <option value="">Select your centre…</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.state}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Role / title (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Assessment Coordinator"
          className="w-full px-4 py-3 rounded-xl text-sm border-2"
          style={{ borderColor: "#D8D8D8", color: "#323232" }}
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Note to the programme team (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Anything that helps us confirm your role"
          className="w-full px-4 py-3 rounded-xl text-sm border-2 resize-none"
          style={{ borderColor: "#D8D8D8", color: "#323232" }}
        />
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3.5 rounded-xl text-white text-sm font-heading font-bold disabled:opacity-50 transition-all"
        style={{ background: "#058812" }}
      >
        {loading ? "Submitting…" : "Submit Request"}
      </button>
    </form>
  );
}
