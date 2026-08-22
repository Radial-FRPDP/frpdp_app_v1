"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface CandidateRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  jqs_number: string | null;
  gender: string | null;
  discipline: string | null;
  date_of_birth: string | null;
  state_of_origin: string | null;
  nomination_confirmed_at: string | null;
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const monthDiff = now.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function formatDob(dob: string | null): string {
  if (!dob) return "Not provided";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "Not provided";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "#f4f4f4" }}>
      <div className="text-[11px] font-heading font-bold tracking-wide uppercase" style={{ color: "#969696" }}>
        {label}
      </div>
      <div className="text-sm font-semibold text-[#323232] mt-0.5">{value || "Not provided"}</div>
    </div>
  );
}

export function M01Welcome({ candidate }: { candidate: CandidateRow }) {
  const router = useRouter();
  const supabase = createClient();
  const [confirmed, setConfirmed] = useState(!!candidate.nomination_confirmed_at);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const age = ageFromDob(candidate.date_of_birth);

  async function handleConfirm() {
    setError("");
    setConfirming(true);
    const { error: err } = await supabase
      .from("candidates")
      .update({ nomination_confirmed_at: new Date().toISOString() })
      .eq("id", candidate.id);
    setConfirming(false);
    if (err) {
      setError(err.message);
      return;
    }
    setConfirmed(true);
    router.refresh();
  }

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      <div
        className="rounded-2xl p-8 mb-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #074A0E, #058812)" }}
      >
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-heading font-bold mb-4"
          style={{ background: "rgba(255,255,255,0.15)", color: "#FBBD15" }}
        >
          ✉ Nomination Received
        </div>
        <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-white mb-2">
          Welcome, {firstName(candidate.full_name)}!
        </h1>
        <p className="text-sm text-white/80 max-w-xl leading-relaxed">
          You have been nominated for the Field Readiness Programme by NCDMB. Your journey to becoming a
          field-ready oil &amp; gas engineer starts here.
        </p>
        <div className="flex flex-wrap gap-2 mt-5">
          {candidate.jqs_number && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-heading font-bold text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
              JQS {candidate.jqs_number}
            </span>
          )}
          {candidate.discipline && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-heading font-bold text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
              {candidate.discipline}
            </span>
          )}
          {candidate.state_of_origin && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-heading font-bold text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
              {candidate.state_of_origin} State
            </span>
          )}
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      {!confirmed && (
        <div className="rounded-2xl p-5 mb-6 flex items-start gap-3" style={{ background: "#FDF3D6", border: "1px solid #FBBD15" }}>
          <span className="text-lg leading-none mt-0.5">⚠</span>
          <div>
            <div className="font-heading font-bold text-sm text-[#323232]">Action Required — Confirm Your Details</div>
            <p className="text-sm text-[#646464] mt-1">
              Please review the details below. They were supplied by NCDMB at nomination. After confirming, you&apos;ll
              move on to complete the rest of your profile in M-02.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-elev-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-sm text-[#323232]">Your Nomination Details</h2>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-heading font-bold" style={{ background: "#1B4F8A15", color: "#1B4F8A" }}>
            From NCDMB
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Full Name" value={candidate.full_name} />
          <Field label="JQS Number" value={candidate.jqs_number ?? ""} />
          <Field label="Gender" value={candidate.gender ?? ""} />
          <Field label="Date of Birth" value={formatDob(candidate.date_of_birth)} />
          <Field label="Age" value={age !== null ? `${age} years` : ""} />
          <Field label="Discipline" value={candidate.discipline ?? ""} />
          <Field label="State of Origin" value={candidate.state_of_origin ?? ""} />
          <Field label="Phone Number" value={candidate.phone ?? ""} />
          <Field label="Email Address" value={candidate.email} />
        </div>
        <p className="text-xs text-[#969696] mt-4">
          Something look wrong? Contact your programme coordinator before continuing — these details come from NCDMB
          and can&apos;t be edited here.
        </p>
      </div>

      <div className="flex justify-end mt-6">
        {confirmed ? (
          <a href="/portal/m02" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-heading font-bold" style={{ background: "#058812" }}>
            Continue to Profile →
          </a>
        ) : (
          <button onClick={handleConfirm} disabled={confirming} className="btn-primary">
            {confirming ? "Confirming…" : "Confirm My Details & Continue →"}
          </button>
        )}
      </div>
    </div>
  );
}
