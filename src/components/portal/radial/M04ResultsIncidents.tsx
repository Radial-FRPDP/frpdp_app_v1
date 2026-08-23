"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ResultRow {
  id: string;
  candidateName: string;
  jqsNumber: string | null;
  discipline: string | null;
  totalScore: number;
  maxScore: number;
  passed: boolean;
}

interface IncidentRow {
  id: string;
  candidateName: string | null;
  centreName: string | null;
  category: "device_failure" | "identity_mismatch" | "late_arrival" | "other";
  severity: "low" | "medium" | "high";
  description: string | null;
  status: "pending" | "reviewed" | "closed";
  createdAt: string;
  resolutionNote: string | null;
}

const CATEGORY_LABEL: Record<IncidentRow["category"], string> = {
  device_failure: "Device failure",
  identity_mismatch: "Identity mismatch",
  late_arrival: "Late arrival",
  other: "Other",
};

const SEVERITY_COLOR: Record<IncidentRow["severity"], string> = { low: "#969696", medium: "#e05c00", high: "#9b2335" };

function IncidentCard({ inc, onUpdated }: { inc: IncidentRow; onUpdated: (id: string, patch: Partial<IncidentRow>) => void }) {
  const supabase = createClient();
  const [note, setNote] = useState(inc.resolutionNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function setStatus(status: "reviewed" | "closed") {
    setBusy(true);
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: err } = await supabase
      .from("exam_incidents")
      .update({ status, resolution_note: note || null, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", inc.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onUpdated(inc.id, { status, resolutionNote: note || null });
  }

  const statusColor = inc.status === "closed" ? "#058812" : inc.status === "reviewed" ? "#1B4F8A" : "#e05c00";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-elev-2">
      <div className="flex items-center justify-between mb-1">
        <div className="font-heading font-bold text-sm text-[#323232]">{inc.candidateName ?? "Unknown candidate"}</div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full capitalize"
            style={{ background: `${SEVERITY_COLOR[inc.severity]}15`, color: SEVERITY_COLOR[inc.severity] }}
          >
            {inc.severity}
          </span>
          <span className="text-[11px] font-heading font-bold px-3 py-1 rounded-full capitalize" style={{ background: `${statusColor}15`, color: statusColor }}>
            {inc.status}
          </span>
        </div>
      </div>
      <p className="text-xs text-[#969696] mb-2">
        {CATEGORY_LABEL[inc.category]} · {inc.centreName ?? "Unknown centre"} · {new Date(inc.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
      </p>
      {inc.description && <p className="text-xs text-[#646464] mb-3">&quot;{inc.description}&quot;</p>}

      {inc.status !== "closed" && (
        <>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note" className="input text-xs py-1.5 w-full mb-2" />
          {error && <div className="mb-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</div>}
          <div className="flex gap-2">
            {inc.status === "pending" && (
              <button onClick={() => setStatus("reviewed")} disabled={busy} className="btn-secondary text-xs px-3 py-1.5">
                Mark Reviewed
              </button>
            )}
            <button onClick={() => setStatus("closed")} disabled={busy} className="btn-primary text-xs px-3 py-1.5">
              Close
            </button>
          </div>
        </>
      )}
      {inc.status === "closed" && inc.resolutionNote && <p className="text-xs text-[#969696]">Resolution: {inc.resolutionNote}</p>}
    </div>
  );
}

export function M04ResultsIncidents({ results, initialIncidents }: { results: ResultRow[]; initialIncidents: IncidentRow[] }) {
  const [tab, setTab] = useState<"results" | "incidents">("results");
  const [incidents, setIncidents] = useState(initialIncidents);

  const pendingCount = incidents.filter((i) => i.status === "pending").length;
  const passed = results.filter((r) => r.passed).length;

  function updateIncident(id: string, patch: Partial<IncidentRow>) {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-04 · Assess</h1>
        <p className="text-sm text-[#646464]">CBT Results & Exam-Day Incidents — Programme Manager</p>
      </div>

      {pendingCount > 0 && (
        <div className="mb-6 rounded-2xl px-5 py-3 text-sm flex items-center gap-2" style={{ background: "#e05c0010", border: "1px solid #e05c0030", color: "#e05c00" }}>
          <span className="font-heading font-bold">{pendingCount}</span> incident{pendingCount === 1 ? "" : "s"} still need review before this batch of
          results should be treated as final.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Sat Exam", value: results.length, color: "#1B4F8A" },
          { label: "Passed", value: passed, color: "#058812" },
          { label: "Pass Rate", value: results.length > 0 ? `${Math.round((passed / results.length) * 100)}%` : "—", color: "#058812" },
          { label: "Pending Incidents", value: pendingCount, color: pendingCount > 0 ? "#e05c00" : "#058812" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-elev-2">
            <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1">{s.label}</div>
            <div className="font-heading font-extrabold text-2xl" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex rounded-2xl p-1 mb-6 shadow-elev-1 bg-white max-w-xs">
        {(["results", "incidents"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-sm font-heading font-bold transition-all relative"
            style={{ background: tab === t ? "#058812" : "transparent", color: tab === t ? "white" : "#969696" }}
          >
            {t === "results" ? "Results" : "Incidents"}
            {t === "incidents" && pendingCount > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center text-[10px] font-heading font-bold rounded-full w-4 h-4"
                style={{ background: tab === t ? "white" : "#e05c00", color: tab === t ? "#058812" : "white" }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "results" && (
        <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f4f4f4" }}>
                {["Candidate", "JQS", "Discipline", "Score", "Result"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-heading font-bold uppercase tracking-wider text-[#646464]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#f4f4f4" }}>
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-heading font-semibold text-[#323232]">{r.candidateName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#646464]">{r.jqsNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-[#646464]">{r.discipline ?? "—"}</td>
                  <td className="px-4 py-3 text-[#646464]">
                    {r.totalScore}/{r.maxScore}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${r.passed ? "badge-verified" : "badge-issue"}`}>{r.passed ? "Passed" : "Not passed"}</span>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#969696]">
                    No results submitted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "incidents" && (
        <div className="space-y-4">
          {incidents.length === 0 && <div className="bg-white rounded-2xl p-8 shadow-elev-2 text-center text-sm text-[#969696]">No exam-day incidents logged.</div>}
          {incidents
            .slice()
            .sort((a, b) => (a.status === "pending") === (b.status === "pending") ? 0 : a.status === "pending" ? -1 : 1)
            .map((inc) => (
              <IncidentCard key={inc.id} inc={inc} onUpdated={updateIncident} />
            ))}
        </div>
      )}
    </div>
  );
}
