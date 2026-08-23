"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface NCDMBM01Stats {
  totalNominated: number;
  duplicatesFlagged: number;
  ageIneligible: number;
  readyToInvite: number;
  missingEmail: number;
  invitedOrBeyond: number;
}

export interface NCDMBDuplicateRow {
  id: string;
  jqsNumber: string | null;
  name: string;
  dob: string | null;
  discipline: string | null;
  state: string | null;
  reason: string;
  decision: "pending" | "replace" | "discard";
}

export interface NCDMBDisciplineRow {
  discipline: string;
  count: number;
}

interface Props {
  batchFilename: string | null;
  stats: NCDMBM01Stats;
  duplicates: NCDMBDuplicateRow[];
  disciplines: NCDMBDisciplineRow[];
  generatedAt: string;
}

const TABS = [
  { id: "overview" as const, label: "Programme Overview" },
  { id: "duplicates" as const, label: "Duplicate Review" },
  { id: "report" as const, label: "Import Report" },
];

export function NCDMBM01({ batchFilename, stats, duplicates, disciplines, generatedAt }: Props) {
  const [activeTab, setActiveTab] = useState<"overview" | "duplicates" | "report">(
    duplicates.length > 0 ? "duplicates" : "overview"
  );
  const [rows, setRows] = useState(duplicates);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const pending = rows.filter((r) => r.decision === "pending");
  const allDecided = pending.length === 0;

  async function decide(id: string, decision: "replace" | "discard") {
    setBusyId(id);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_duplicate_decision", {
      p_candidate_id: id,
      p_decision: decision,
    });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, decision } : r)));
  }

  const totalDiscipline = disciplines.reduce((a, d) => a + d.count, 0) || 1;

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#1B4F8A15" }}>
            ⬇
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-01 · Intake</h1>
            <p className="text-sm text-[#646464]">Nomination & CSV Import — NCDMB Oversight Portal</p>
          </div>
          <div className="ml-auto">
            <span
              className="text-[11px] font-heading font-bold px-3 py-1.5 rounded-full hidden sm:inline-flex items-center gap-1.5"
              style={{ background: "#1B4F8A12", color: "#1B4F8A", border: "1px solid #1B4F8A25" }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#1B4F8A" }} />
              {pending.length > 0 ? "Read-Only · Action Required" : "Read-Only Oversight"}
            </span>
          </div>
        </div>

        {stats.totalNominated === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-elev-2 text-center">
            <p className="text-sm text-[#646464]">No candidates have been uploaded by Radial Circle yet.</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-elev-2 flex items-start gap-4 mb-5" style={{ border: "2px solid #FBBD15" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FBBD1520" }}>
                  <svg className="w-5 h-5" style={{ color: "#846205" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-heading font-bold text-base text-[#323232]">Action Required — Duplicate Record Confirmation</p>
                  <p className="text-sm text-[#646464] mt-1 leading-relaxed">
                    The Radial Circle Programme Manager has identified <strong>{pending.length}</strong> duplicate nomination
                    {pending.length === 1 ? "" : "s"} in the uploaded {batchFilename ? <>file (<strong>{batchFilename}</strong>)</> : "CSV"}.
                    NCDMB is required to confirm: should these records replace existing entries, or should the import proceed without them?
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("duplicates")}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm font-heading font-bold transition-colors"
                  style={{ background: "#FBBD15", color: "#323232" }}
                >
                  Review Now
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Nominated", value: stats.totalNominated, color: "#1B4F8A", sub: "Submitted by NCDMB" },
                { label: "Duplicates Flagged", value: stats.duplicatesFlagged, color: "#FBBD15", sub: "Confirmation required" },
                { label: "Age-Ineligible", value: stats.ageIneligible, color: "#e05c00", sub: "Quarantined" },
                { label: "Ready / Invited", value: stats.readyToInvite + stats.invitedOrBeyond, color: "#058812", sub: "Cleared candidates" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-5 shadow-elev-2" style={{ borderTop: `3px solid ${s.color}` }}>
                  <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-2">{s.label}</div>
                  <div className="font-heading font-extrabold text-3xl mb-1" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="text-xs text-[#646464]">{s.sub}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {stats.totalNominated > 0 && (
        <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden mb-5">
          <div className="flex border-b" style={{ borderColor: "#f4f4f4" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="px-5 py-4 text-sm font-heading font-bold border-b-2 transition-all flex items-center gap-2"
                style={{
                  borderBottomColor: activeTab === t.id ? "#1B4F8A" : "transparent",
                  color: activeTab === t.id ? "#1B4F8A" : "#969696",
                }}
              >
                {t.label}
                {t.id === "duplicates" && rows.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#FBBD1525", color: "#846205" }}>
                    {pending.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="p-6">
              <h3 className="font-heading font-bold text-base text-[#323232] mb-5">Discipline Breakdown</h3>
              {disciplines.length === 0 ? (
                <p className="text-sm text-[#969696]">No discipline data recorded on this batch yet.</p>
              ) : (
                <div className="space-y-3 max-w-lg">
                  {disciplines.map((d) => (
                    <div key={d.discipline}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-[#646464]">{d.discipline}</span>
                        <span className="text-xs font-heading font-bold text-[#323232]">{d.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#D8D8D8] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(d.count / totalDiscipline) * 100}%`, background: "#1B4F8A" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "duplicates" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div>
                  <h3 className="font-heading font-bold text-base text-[#323232]">Duplicate Record Review</h3>
                  <p className="text-sm text-[#646464] mt-1">
                    Confirm action for each duplicate. <strong>Replace</strong> updates the existing record; <strong>Discard</strong>{" "}
                    removes it from this import.
                  </p>
                </div>
                {allDecided && rows.length > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: "#05881212", color: "#058812" }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-heading font-bold">All Reviewed</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: "#9b233512", color: "#9b2335" }}>
                  {error}
                </div>
              )}

              {rows.length === 0 ? (
                <p className="text-sm text-[#969696] py-6 text-center">No duplicate records in this batch.</p>
              ) : (
                <div className="space-y-3">
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="p-5 rounded-2xl border-2 transition-all duration-200"
                      style={{
                        borderColor: r.decision === "replace" ? "#058812" : r.decision === "discard" ? "#969696" : "#f4f4f4",
                        background: r.decision === "replace" ? "#05881206" : r.decision === "discard" ? "#96969608" : "white",
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-[#969696]">{r.jqsNumber ?? "—"}</span>
                            <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full" style={{ background: "#FBBD1520", color: "#846205" }}>
                              Duplicate
                            </span>
                          </div>
                          <p className="font-heading font-bold text-sm text-[#323232]">{r.name}</p>
                          <p className="text-xs text-[#646464] mt-0.5">
                            {r.discipline ?? "—"} · {r.state ?? "—"} {r.dob ? `· DOB: ${r.dob}` : ""}
                          </p>
                          <p className="text-xs text-[#969696] mt-1 italic">{r.reason}</p>
                        </div>

                        {r.decision === "pending" ? (
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => decide(r.id, "replace")}
                              disabled={busyId === r.id}
                              className="px-4 py-2 rounded-xl text-xs font-heading font-bold border-2 transition-all disabled:opacity-50"
                              style={{ borderColor: "#D8D8D8", background: "white", color: "#646464" }}
                            >
                              Replace
                            </button>
                            <button
                              onClick={() => decide(r.id, "discard")}
                              disabled={busyId === r.id}
                              className="px-4 py-2 rounded-xl text-xs font-heading font-bold border-2 transition-all disabled:opacity-50"
                              style={{ borderColor: "#D8D8D8", background: "white", color: "#646464" }}
                            >
                              Discard
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-xs font-heading font-bold px-3 py-1.5 rounded-full shrink-0"
                            style={{
                              background: r.decision === "replace" ? "#05881212" : "#96969612",
                              color: r.decision === "replace" ? "#058812" : "#646464",
                            }}
                          >
                            {r.decision === "replace" ? "✓ Replace" : "✓ Discard"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "report" && (
            <div className="p-6">
              <div className="mb-5">
                <h3 className="font-heading font-bold text-base text-[#323232]">Import Summary Report</h3>
                <p className="text-sm text-[#646464] mt-1">Read-only · As of {generatedAt}</p>
              </div>

              <div className="p-5 rounded-2xl mb-5" style={{ background: "#f4f4f4" }}>
                <h4 className="font-heading font-bold text-sm text-[#323232] mb-4">Record Summary</h4>
                <div className="space-y-3">
                  {[
                    { label: "Total Records", value: stats.totalNominated },
                    { label: "Duplicates Identified", value: stats.duplicatesFlagged },
                    { label: "Age-Ineligible (>30yr)", value: stats.ageIneligible },
                    { label: "Missing Email", value: stats.missingEmail },
                    { label: "Ready / Invited", value: stats.readyToInvite + stats.invitedOrBeyond },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between items-center">
                      <span className="text-sm text-[#646464]">{r.label}</span>
                      <span className="font-heading font-bold text-sm text-[#323232]">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: "#1B4F8A08", border: "1px solid #1B4F8A20" }}>
                <svg className="w-5 h-5 shrink-0" style={{ color: "#1B4F8A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-[#1B4F8A] leading-relaxed">
                  These figures reflect the live candidate data uploaded by Radial Circle and update automatically — this is not a
                  static PDF export.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
