"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SessionRow {
  id: string;
  candidate_id: string;
  workstation_label: string | null;
  status: string;
  checked_in_at: string;
  candidates: { full_name: string; jqs_number: string | null } | null;
}

interface IncidentRow {
  id: string;
  exam_session_id: string;
  category: "device_failure" | "identity_mismatch" | "late_arrival" | "other";
  severity: "low" | "medium" | "high";
  description: string | null;
  status: "pending" | "reviewed" | "closed";
  created_at: string;
  candidateName: string | null;
}

const DEFAULT_SUBJECTS = ["Numeracy", "Verbal Reasoning", "Technical Aptitude", "Safety Awareness", "English"];

const INCIDENT_CATEGORY_LABEL: Record<IncidentRow["category"], string> = {
  device_failure: "Device failure",
  identity_mismatch: "Identity mismatch",
  late_arrival: "Late arrival",
  other: "Other",
};

const SEVERITY_COLOR: Record<IncidentRow["severity"], string> = { low: "#969696", medium: "#e05c00", high: "#9b2335" };

export function M04CbtOfficer({
  initialSessions,
  initialIncidents,
  centreName,
}: {
  initialSessions: SessionRow[];
  initialIncidents: IncidentRow[];
  centreName: string;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<"live" | "checkin" | "results" | "incidents">("live");
  const [sessions, setSessions] = useState(initialSessions);
  const [incidents, setIncidents] = useState(initialIncidents);

  // Incident logging
  const [incidentSessionId, setIncidentSessionId] = useState("");
  const [incidentCategory, setIncidentCategory] = useState<IncidentRow["category"]>("device_failure");
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentRow["severity"]>("low");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [loggingIncident, setLoggingIncident] = useState(false);

  // Check-in
  const [jqsQuery, setJqsQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string; jqs_number: string | null }[]>([]);
  const [workstation, setWorkstation] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [lastAccessCode, setLastAccessCode] = useState<{ code: string; name: string } | null>(null);
  const [error, setError] = useState("");

  // Manual results
  const [resultCandidateId, setResultCandidateId] = useState("");
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries(DEFAULT_SUBJECTS.map((s) => [s, 0])));
  const [savingResult, setSavingResult] = useState(false);
  const [resultSaved, setResultSaved] = useState<{ passed: boolean; totalScore: number; maxScore: number } | null>(null);

  async function searchJqs() {
    setError("");
    if (!jqsQuery) return;
    const { data, error: err } = await supabase.from("candidates").select("id, full_name, jqs_number").ilike("jqs_number", `%${jqsQuery}%`).limit(10);
    if (err) {
      setError(err.message);
      return;
    }
    setSearchResults(data ?? []);
  }

  async function checkIn(candidateId: string) {
    setCheckingIn(true);
    setError("");
    const res = await fetch("/api/cbt/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, workstationLabel: workstation }),
    });
    const body = await res.json();
    setCheckingIn(false);
    if (!res.ok) {
      setError(body.error ?? "Check-in failed.");
      return;
    }
    const candidate = searchResults.find((c) => c.id === candidateId);
    setLastAccessCode({ code: body.session.access_code, name: candidate?.full_name ?? "Candidate" });
    setSearchResults([]);
    setJqsQuery("");
  }

  async function submitResults() {
    if (!resultCandidateId) return;
    setSavingResult(true);
    setError("");
    const subjectScores = DEFAULT_SUBJECTS.map((s) => ({ subject: s, score: scores[s] ?? 0, maxScore: 20 }));
    const res = await fetch("/api/cbt/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: resultCandidateId, subjectScores }),
    });
    const body = await res.json();
    setSavingResult(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't save results.");
      return;
    }
    setResultSaved({ passed: body.passed, totalScore: body.totalScore, maxScore: body.maxScore });
    setSessions((prev) => prev.map((s) => (s.candidate_id === resultCandidateId ? { ...s, status: "submitted" } : s)));
  }

  async function logIncident() {
    if (!incidentSessionId) {
      setError("Pick which candidate's session this incident happened on.");
      return;
    }
    setLoggingIncident(true);
    setError("");
    const { data, error: err } = await supabase
      .from("exam_incidents")
      .insert({
        exam_session_id: incidentSessionId,
        category: incidentCategory,
        severity: incidentSeverity,
        description: incidentDescription || null,
      })
      .select()
      .single();
    setLoggingIncident(false);
    if (err) {
      setError(err.message);
      return;
    }
    const session = sessions.find((s) => s.id === incidentSessionId);
    setIncidents((prev) => [
      { ...data, candidateName: session?.candidates?.full_name ?? null },
      ...prev,
    ]);
    setIncidentSessionId("");
    setIncidentDescription("");
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-04 · Assess</h1>
        <p className="text-sm text-[#646464]">{centreName} — CBT Officer</p>
      </div>

      <div className="flex rounded-2xl p-1 mb-6 shadow-elev-1 bg-white max-w-xl">
        {([
          ["live", "Live Sessions"],
          ["checkin", "Check-in"],
          ["results", "Submit Results"],
          ["incidents", "Incidents"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 py-2 rounded-xl text-xs font-heading font-bold transition-all"
            style={{ background: tab === id ? "#646464" : "transparent", color: tab === id ? "white" : "#969696" }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      {tab === "live" && (
        <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f4f4f4" }}>
                {["Candidate", "JQS", "Workstation", "Status", "Checked in"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-heading font-bold uppercase tracking-wider text-[#646464]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#f4f4f4" }}>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-heading font-semibold text-[#323232]">{s.candidates?.full_name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#646464]">{s.candidates?.jqs_number ?? "—"}</td>
                  <td className="px-4 py-3 text-[#646464]">{s.workstation_label ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="badge badge-pending">{s.status.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-[#969696] text-xs">{new Date(s.checked_in_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-[#969696]">
                    No candidates checked in yet today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "checkin" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6 shadow-elev-2">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">Find candidate by JQS Number</h3>
            <div className="flex gap-2 mb-4">
              <input value={jqsQuery} onChange={(e) => setJqsQuery(e.target.value)} placeholder="JQS-2025-0001" className="input font-mono" />
              <input value={workstation} onChange={(e) => setWorkstation(e.target.value)} placeholder="Workstation (e.g. W-04)" className="input max-w-[160px]" />
              <button onClick={searchJqs} className="btn-secondary whitespace-nowrap">
                Search
              </button>
            </div>
            <p className="text-xs text-[#969696] mb-3">Only candidates with a confirmed booking at this centre will appear.</p>
            <div className="space-y-2">
              {searchResults.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: "#f4f4f4" }}>
                  <div>
                    <div className="font-heading font-semibold text-sm text-[#323232]">{c.full_name}</div>
                    <div className="text-xs font-mono text-[#969696]">{c.jqs_number}</div>
                  </div>
                  <button onClick={() => checkIn(c.id)} disabled={checkingIn} className="btn-primary text-xs px-4 py-2">
                    {checkingIn ? "Checking in…" : "Check In"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {lastAccessCode && (
            <div className="rounded-2xl p-6" style={{ background: "#05881210", border: "1px solid #05881230" }}>
              <p className="text-sm font-heading font-semibold text-[#323232] mb-1">{lastAccessCode.name} checked in</p>
              <p className="text-xs text-[#646464] mb-3">Read this code to the candidate — they enter it on their own screen to start:</p>
              <div className="font-heading font-extrabold text-3xl font-mono tracking-widest" style={{ color: "#058812" }}>
                {lastAccessCode.code}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "results" && (
        <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-4">
          <div>
            <label className="label">Candidate ID</label>
            <input
              value={resultCandidateId}
              onChange={(e) => setResultCandidateId(e.target.value)}
              className="input mt-1 font-mono text-xs"
              placeholder="Paste candidate id from Live Sessions"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {DEFAULT_SUBJECTS.map((subj) => (
              <div key={subj}>
                <label className="label">{subj} (out of 20)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={scores[subj]}
                  onChange={(e) => setScores((prev) => ({ ...prev, [subj]: Number(e.target.value) }))}
                  className="input mt-1"
                />
              </div>
            ))}
          </div>
          <button onClick={submitResults} disabled={savingResult || !resultCandidateId} className="btn-primary">
            {savingResult ? "Saving…" : "Submit Results"}
          </button>
          {resultSaved && (
            <div className="mt-2 text-sm px-4 py-3 rounded-xl" style={{ background: resultSaved.passed ? "#05881210" : "#9b233510", color: resultSaved.passed ? "#058812" : "#9b2335" }}>
              Saved — {resultSaved.totalScore}/{resultSaved.maxScore} ({resultSaved.passed ? "PASSED" : "NOT PASSED"})
            </div>
          )}
        </div>
      )}

      {tab === "incidents" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6 shadow-elev-2">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">Log an exam-day incident</h3>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <select value={incidentSessionId} onChange={(e) => setIncidentSessionId(e.target.value)} className="input">
                <option value="">Which candidate?</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.candidates?.full_name ?? "—"} ({s.candidates?.jqs_number ?? "no JQS"})
                  </option>
                ))}
              </select>
              <select value={incidentCategory} onChange={(e) => setIncidentCategory(e.target.value as IncidentRow["category"])} className="input">
                {(Object.keys(INCIDENT_CATEGORY_LABEL) as IncidentRow["category"][]).map((c) => (
                  <option key={c} value={c}>
                    {INCIDENT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="label">Severity</label>
              <div className="flex gap-2 mt-1">
                {(["low", "medium", "high"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setIncidentSeverity(sev)}
                    className="flex-1 py-2 rounded-xl text-xs font-heading font-bold capitalize border-2"
                    style={{
                      borderColor: incidentSeverity === sev ? SEVERITY_COLOR[sev] : "#D8D8D8",
                      background: incidentSeverity === sev ? `${SEVERITY_COLOR[sev]}10` : "white",
                      color: incidentSeverity === sev ? SEVERITY_COLOR[sev] : "#646464",
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={incidentDescription}
              onChange={(e) => setIncidentDescription(e.target.value)}
              placeholder="What happened?"
              rows={3}
              className="input w-full mb-4"
            />
            <button onClick={logIncident} disabled={loggingIncident} className="btn-primary">
              {loggingIncident ? "Logging…" : "Log Incident"}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
              <h3 className="font-heading font-bold text-sm text-[#323232]">Today&apos;s incidents at {centreName}</h3>
            </div>
            <div className="divide-y" style={{ borderColor: "#f4f4f4" }}>
              {incidents.length === 0 && <p className="px-6 py-6 text-center text-sm text-[#969696]">Nothing logged yet.</p>}
              {incidents.map((inc) => (
                <div key={inc.id} className="px-6 py-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-heading font-semibold text-sm text-[#323232]">{inc.candidateName ?? "Unknown candidate"}</span>
                      <span
                        className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: `${SEVERITY_COLOR[inc.severity]}15`, color: SEVERITY_COLOR[inc.severity] }}
                      >
                        {inc.severity}
                      </span>
                    </div>
                    <p className="text-xs text-[#969696]">
                      {INCIDENT_CATEGORY_LABEL[inc.category]} · {new Date(inc.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {inc.description && <p className="text-xs text-[#646464] mt-1">{inc.description}</p>}
                  </div>
                  <span className="badge badge-pending capitalize shrink-0">{inc.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
