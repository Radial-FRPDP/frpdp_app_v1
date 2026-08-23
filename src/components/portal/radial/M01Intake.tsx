"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type WorkflowStep = "upload" | "validate" | "review" | "summary" | "dispatch";

const WORKFLOW_STEPS: { id: WorkflowStep; label: string; desc: string }[] = [
  { id: "upload", label: "Upload CSV", desc: "Import nomination file" },
  { id: "validate", label: "Validate", desc: "Schema & data checks" },
  { id: "review", label: "Review Queues", desc: "Flags & exceptions" },
  { id: "summary", label: "Import Summary", desc: "Pre-dispatch overview" },
  { id: "dispatch", label: "Approve & Dispatch", desc: "Send invitations" },
];

interface UploadResponse {
  batchId: string;
  totalRows: number;
  readyCount: number;
  duplicateCount: number;
  ageIneligibleCount: number;
  missingEmailCount: number;
  duplicates: { id: string; jqsNumber: string; name: string; reason: string }[];
  ageIneligible: { id: string; jqsNumber: string; name: string; dob: string; age: number | null; discipline: string }[];
  missingEmail: { id: string; jqsNumber: string; name: string; state: string }[];
  preview: { jqsNumber: string | null; name: string; email: string; status: string }[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-elev-2" style={{ borderTop: `3px solid ${color}` }}>
      <div className="text-[11px] font-heading font-bold uppercase tracking-wider mb-2" style={{ color: "#969696" }}>
        {label}
      </div>
      <div className="font-heading font-extrabold text-3xl mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-[#646464]">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    ready: { label: "Ready", color: "#058812", bg: "#05881212" },
    age_flag: { label: "Age Flag", color: "#e05c00", bg: "#e05c0012" },
    no_email: { label: "No Email", color: "#646464", bg: "#64646418" },
    duplicate: { label: "Duplicate", color: "#FBBD15", bg: "#FBBD1520" },
  };
  const s = map[status] || map.ready;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-heading font-bold" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

export interface CandidateListItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  jqsNumber: string | null;
  gender: string | null;
  discipline: string | null;
  status: string;
  createdAt: string;
  batchId: string | null;
  batchFilename: string | null;
}

interface BatchStatusResponse extends UploadResponse {
  stage: "review" | "summary" | "done";
  invitedCount: number;
}

function BatchesPanel({ candidates, onContinue, busyBatchId }: { candidates: CandidateListItem[]; onContinue: (batchId: string) => void; busyBatchId: string | null }) {
  type BatchGroup = { batchId: string; filename: string; total: number; pending: number; latest: string };
  const groups = new Map<string, BatchGroup>();
  for (const c of candidates) {
    if (!c.batchId) continue;
    const g = groups.get(c.batchId) ?? { batchId: c.batchId, filename: c.batchFilename || "Unnamed import", total: 0, pending: 0, latest: c.createdAt };
    g.total += 1;
    if (c.status === "pending_review") g.pending += 1;
    if (c.createdAt > g.latest) g.latest = c.createdAt;
    groups.set(c.batchId, g);
  }
  const pendingBatches = Array.from(groups.values())
    .filter((g) => g.pending > 0)
    .sort((a, b) => (a.latest < b.latest ? 1 : -1));

  if (pendingBatches.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-elev-1 overflow-hidden mb-5">
      <div className="px-5 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
        <h4 className="font-heading font-bold text-sm text-[#323232]">Imports in progress</h4>
        <p className="text-[12px] text-[#646464] mt-0.5">Not yet fully reviewed and dispatched — pick up where you left off.</p>
      </div>
      <div className="divide-y" style={{ borderColor: "#f4f4f4" }}>
        {pendingBatches.map((g) => (
          <div key={g.batchId} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-sm text-[#323232] truncate">{g.filename}</div>
              <div className="text-[12px] text-[#646464] mt-0.5">
                {g.pending} of {g.total} candidate{g.total === 1 ? "" : "s"} still need review or dispatch
              </div>
            </div>
            <button
              disabled={busyBatchId === g.batchId}
              onClick={() => onContinue(g.batchId)}
              className="px-4 py-2.5 rounded-xl text-white text-xs font-heading font-bold shrink-0 disabled:opacity-50"
              style={{ background: "#058812" }}
            >
              {busyBatchId === g.batchId ? "Loading…" : "Continue →"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const CANDIDATE_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: "Pending Review", color: "#646464", bg: "#64646415" },
  invited: { label: "Invited", color: "#1B4F8A", bg: "#1B4F8A15" },
  profile_in_progress: { label: "Profile In Progress", color: "#846205", bg: "#FBBD1520" },
  profile_complete: { label: "Profile Complete", color: "#058812", bg: "#05881215" },
  verified: { label: "Verified", color: "#058812", bg: "#05881220" },
  rejected: { label: "Rejected", color: "#9B2335", bg: "#9B233515" },
};

function CandidateStatusBadge({ status }: { status: string }) {
  const s = CANDIDATE_STATUS_META[status] ?? CANDIDATE_STATUS_META.pending_review;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-heading font-bold whitespace-nowrap" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function CandidateListView({
  candidates,
  onDeleted,
  onStartUpload,
  onContinueBatch,
  continuingBatchId,
  continueError,
}: {
  candidates: CandidateListItem[];
  onDeleted: (ids: string[]) => void;
  onStartUpload: () => void;
  onContinueBatch: (batchId: string) => void;
  continuingBatchId: string | null;
  continueError: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const filtered = candidates.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.jqsNumber ?? "").toLowerCase().includes(q)
    );
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleAll() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((c) => next.add(c.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    const ids = Array.from(selected);
    const res = await fetch("/api/candidates/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Delete failed" }));
      const message: string = body.error ?? "Delete failed";
      setError(
        message.includes("foreign key")
          ? "Couldn't delete one or more of these — another record (e.g. a duplicate flagged against one of them) still references it."
          : message
      );
      return;
    }
    onDeleted(ids);
    setSelected(new Set());
    setConfirming(false);
  }

  return (
    <div className="space-y-5">
      <BatchesPanel candidates={candidates} onContinue={onContinueBatch} busyBatchId={continuingBatchId} />
      {continueError && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{continueError}</div>}
      <div className="bg-white rounded-2xl p-5 shadow-elev-2">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or JQS number…"
              className="input"
              style={{ maxWidth: 320 }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input" style={{ maxWidth: 200 }}>
              <option value="all">All statuses</option>
              {Object.entries(CANDIDATE_STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selected.size > 0 && !confirming && (
              <button
                onClick={() => setConfirming(true)}
                className="px-4 py-2.5 rounded-xl text-sm font-heading font-bold border-2 transition-colors"
                style={{ borderColor: "#9B2335", color: "#9B2335" }}
              >
                Delete Selected ({selected.size})
              </button>
            )}
            <button onClick={onStartUpload} className="btn-primary">
              + New CSV Import
            </button>
          </div>
        </div>

        {confirming && (
          <div className="mb-4 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap" style={{ background: "#9B233510", border: "1px solid #9B233530" }}>
            <p className="text-sm text-[#323232]">
              Permanently delete <strong>{selected.size}</strong> candidate record{selected.size === 1 ? "" : "s"}, including their profile, documents,
              and booking data? This can&apos;t be undone.
            </p>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setConfirming(false)} disabled={deleting} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-heading font-bold text-white transition-colors disabled:opacity-50"
                style={{ background: "#9B2335" }}
              >
                {deleting ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        )}

        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

        {candidates.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-heading font-bold text-[#323232] mb-1">No candidates yet</p>
            <p className="text-sm text-[#969696] mb-6">Start your first CSV import to bring candidates into the programme.</p>
            <button onClick={onStartUpload} className="btn-primary">
              + New CSV Import
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#f4f4f4" }}>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
                  </th>
                  {["JQS Number", "Full Name", "Email", "Gender / Discipline", "Status", "Batch", "Imported"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-heading font-bold uppercase tracking-wider text-[#646464]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#f4f4f4" }}>
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#f4f4f4] transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#323232] font-medium">{c.jqsNumber || "—"}</td>
                    <td className="px-4 py-3 font-heading font-semibold text-[#323232]">{c.fullName}</td>
                    <td className="px-4 py-3 text-[12px] text-[#646464]">{c.email}</td>
                    <td className="px-4 py-3 text-[12px] text-[#646464]">
                      {c.gender || "—"} {c.discipline ? `· ${c.discipline}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <CandidateStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#969696]">{c.batchFilename || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-[#969696]">{new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-sm text-[#969696] text-center py-10">No candidates match your search.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadStep({ onDone }: { onDone: (result: UploadResponse) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function pick(f: File | undefined | null) {
    if (f) setFile(f);
  }

  async function runValidation() {
    if (!file) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/intake/upload", { method: "POST", body: formData });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Upload failed.");
      return;
    }
    onDone(body as UploadResponse);
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-6 shadow-elev-2">
        <h3 className="font-heading font-bold text-lg text-[#323232] mb-1">Upload Candidate CSV</h3>
        <p className="text-sm text-[#646464] mb-6">
          Upload the nomination CSV received from NCDMB. Required columns: Name, Gender, Discipline, Phone, Date of Birth, JQS Number, Email, State of
          Origin.
        </p>

        {!file ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            onClick={() => document.getElementById("csv-input")?.click()}
            className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200"
            style={{ borderColor: dragging ? "#058812" : "#D8D8D8", background: dragging ? "#05881208" : "#f4f4f4" }}
          >
            <input id="csv-input" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#05881210" }}>
              <svg className="w-7 h-7" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="font-heading font-bold text-[#323232] mb-1">Drop CSV file here</p>
            <p className="text-sm text-[#969696] mb-4">or click to browse</p>
            <span className="inline-block px-5 py-2.5 rounded-xl text-sm font-heading font-bold text-white" style={{ background: "#058812" }}>
              Browse Files
            </span>
            <p className="text-[11px] text-[#969696] mt-4">Supported: .csv, .xlsx — Maximum file size 10MB</p>
          </div>
        ) : (
          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: "#05881210", border: "1px solid #05881230" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#058812" }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-heading font-bold text-sm text-[#323232]">{file.name}</p>
              <p className="text-[12px] text-[#646464] mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to validate</p>
            </div>
            <button onClick={() => setFile(null)} className="text-[#969696] hover:text-[#323232] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-elev-1">
        <h4 className="font-heading font-bold text-sm text-[#323232] mb-4">Required CSV Columns</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["Full Name", "Gender", "Discipline", "Phone Number", "Date of Birth", "JQS Number", "Email Address", "State of Origin"].map((col) => (
            <div key={col} className="flex items-center gap-2 py-2 px-3 rounded-xl" style={{ background: "#f4f4f4" }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#058812" }} />
              <span className="text-xs font-heading font-semibold text-[#323232]">{col}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={runValidation}
          disabled={!file || loading}
          className="px-7 py-3.5 rounded-xl text-white text-sm font-heading font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ background: "#058812" }}
        >
          {loading ? "Validating…" : "Run Validation"}
          {!loading && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function ValidateStep({ result, onNext }: { result: UploadResponse; onNext: () => void }) {
  const needsAttention = result.duplicateCount + result.ageIneligibleCount + result.missingEmailCount;
  const checks = [
    { label: "Schema & data type checks", desc: "Names, dates, phone, and email formats", status: "pass" as const, count: `${result.totalRows} records` },
    { label: "Duplicate detection", desc: "JQS Number and email composite key, checked against existing records too", status: result.duplicateCount ? "warn" : ("pass" as const), count: `${result.duplicateCount} duplicates` },
    { label: "Age eligibility gate", desc: "Candidates must be ≤30 years old", status: result.ageIneligibleCount ? "warn" : ("pass" as const), count: `${result.ageIneligibleCount} flagged` },
    { label: "Email completeness", desc: "Email required for invitation dispatch", status: result.missingEmailCount ? "warn" : ("pass" as const), count: `${result.missingEmailCount} missing` },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
        <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
          <h3 className="font-heading font-bold text-lg text-[#323232]">Validation Results</h3>
          <p className="text-sm text-[#646464] mt-1">System parsed and validated all {result.totalRows} records. Review flagged issues below.</p>
        </div>
        <div className="divide-y" style={{ borderColor: "#f4f4f4" }}>
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-4 px-6 py-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.status === "pass" ? "#05881218" : "#FBBD1520" }}>
                {c.status === "pass" ? (
                  <svg className="w-4 h-4" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" style={{ color: "#FBBD15" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <div className="font-heading font-bold text-sm text-[#323232]">{c.label}</div>
                <div className="text-[12px] text-[#646464] mt-0.5">{c.desc}</div>
              </div>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-heading font-bold"
                style={{ color: c.status === "pass" ? "#058812" : "#846205", background: c.status === "pass" ? "#05881212" : "#FBBD1520" }}
              >
                {c.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-elev-1 overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "#f4f4f4" }}>
          <h4 className="font-heading font-bold text-sm text-[#323232]">Record Preview</h4>
          <span className="text-xs text-[#969696]">
            Showing {result.preview.length} of {result.totalRows}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f4f4f4" }}>
                {["JQS Number", "Full Name", "Email", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-heading font-bold uppercase tracking-wider text-[#646464]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#f4f4f4" }}>
              {result.preview.map((r, i) => (
                <tr key={i} className="hover:bg-[#f4f4f4] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#323232] font-medium">{r.jqsNumber || "—"}</td>
                  <td className="px-4 py-3 font-heading font-semibold text-[#323232] text-sm">{r.name}</td>
                  <td className="px-4 py-3 text-[12px]" style={{ color: r.email.endsWith("no-email.invalid") ? "#e05c00" : "#646464" }}>
                    {r.email.endsWith("no-email.invalid") ? "— missing —" : r.email}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-3">
        {needsAttention > 0 ? (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-heading font-bold" style={{ background: "#FBBD1520", color: "#846205", border: "1px solid #FBBD1540" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
            {needsAttention} records need attention before dispatch
          </div>
        ) : (
          <div />
        )}
        <button
          onClick={onNext}
          className="px-7 py-3.5 rounded-xl text-white text-sm font-heading font-bold flex items-center gap-2"
          style={{ background: "#058812" }}
        >
          Review Queues
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ReviewStep({ result, onNext }: { result: UploadResponse; onNext: () => void }) {
  const [activeTab, setActiveTab] = useState<"duplicates" | "age" | "incomplete">("duplicates");
  const [duplicates, setDuplicates] = useState(result.duplicates);
  const [missingEmail, setMissingEmail] = useState(result.missingEmail);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());

  async function act(candidateId: string, action: "keep" | "remove" | "hold" | "request_update") {
    setBusyKey(candidateId);
    const res = await fetch("/api/intake/review-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, action }),
    });
    setBusyKey(null);
    if (res.ok) {
      setDoneKeys((prev) => new Set(prev).add(candidateId));
      if (action === "remove" || action === "keep") {
        setDuplicates((prev) => prev.filter((d) => d.id !== candidateId));
      }
      if (action === "hold" || action === "request_update") {
        setMissingEmail((prev) => prev.filter((d) => d.id !== candidateId));
      }
    }
  }

  const tabs = [
    { id: "duplicates" as const, label: "Duplicates", count: result.duplicateCount, color: "#FBBD15" },
    { id: "age" as const, label: "Age-Ineligible", count: result.ageIneligibleCount, color: "#e05c00" },
    { id: "incomplete" as const, label: "No Email", count: result.missingEmailCount, color: "#646464" },
  ];

  return (
    <div className="space-y-5">
      {result.duplicateCount > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-elev-1 flex items-start gap-4" style={{ border: "1px solid #FBBD1530" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FBBD1520" }}>
            <svg className="w-5 h-5" style={{ color: "#846205" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-sm text-[#323232]">NCDMB Confirmation Needed</p>
            <p className="text-xs text-[#646464] mt-1 leading-relaxed">
              {result.duplicateCount} duplicate record(s) detected. Records you Keep or Remove here are settled immediately; anything you leave will wait
              for NCDMB&apos;s replace/discard decision in their own portal.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
        <div className="flex border-b" style={{ borderColor: "#f4f4f4" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-heading font-bold transition-all duration-150 border-b-2"
              style={{ borderBottomColor: activeTab === t.id ? t.color : "transparent", color: activeTab === t.id ? "#323232" : "#969696", background: activeTab === t.id ? t.color + "08" : "transparent" }}
            >
              {t.label}
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: t.color + "25", color: t.color === "#FBBD15" ? "#846205" : t.color }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "duplicates" && (
            <div className="space-y-3">
              <p className="text-xs text-[#646464] mb-4">Deduplication ran on JQS Number and email. Review each record and decide action.</p>
              {duplicates.length === 0 && <p className="text-sm text-[#969696] py-6 text-center">No duplicates left to review.</p>}
              {duplicates.map((d) => (
                <div key={d.id} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: "#f4f4f4", background: "#FBBD1506" }}>
                  <div className="flex-1">
                    <span className="font-mono text-xs text-[#969696]">{d.jqsNumber || "—"}</span>
                    <div className="font-heading font-bold text-sm text-[#323232]">{d.name}</div>
                    <div className="text-xs text-[#646464] mt-0.5">{d.reason}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      disabled={busyKey === d.id}
                      onClick={() => act(d.id, "remove")}
                      className="px-3.5 py-2 rounded-lg text-xs font-heading font-bold border-2 transition-colors disabled:opacity-50"
                      style={{ borderColor: "#D8D8D8", color: "#646464" }}
                    >
                      Remove
                    </button>
                    <button
                      disabled={busyKey === d.id}
                      onClick={() => act(d.id, "keep")}
                      className="px-3.5 py-2 rounded-lg text-xs font-heading font-bold text-white transition-colors disabled:opacity-50"
                      style={{ background: "#058812" }}
                    >
                      Keep
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "age" && (
            <div className="space-y-3">
              <p className="text-xs text-[#646464] mb-4">Candidates above 30 years old are quarantined and excluded from invitation automatically.</p>
              {result.ageIneligible.length === 0 && <p className="text-sm text-[#969696] py-6 text-center">No age-ineligible records.</p>}
              {result.ageIneligible.map((a) => (
                <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: "#f4f4f4", background: "#e05c0006" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm" style={{ background: "#e05c0015" }}>
                    🚫
                  </div>
                  <div className="flex-1">
                    <div className="font-heading font-bold text-sm text-[#323232]">{a.name}</div>
                    <div className="text-xs text-[#646464] mt-0.5">
                      {a.jqsNumber || "—"} · {a.discipline || "—"}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "#e05c00" }}>
                      DOB: {a.dob || "—"} — Age: {a.age ?? "—"} years
                    </div>
                  </div>
                  <span className="text-[11px] font-heading font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: "#e05c0012", color: "#e05c00" }}>
                    Quarantined
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "incomplete" && (
            <div className="space-y-3">
              <p className="text-xs text-[#646464] mb-4">Records without an email address cannot receive invitations. Decide: hold, or request updated data from NCDMB.</p>
              {missingEmail.length === 0 && <p className="text-sm text-[#969696] py-6 text-center">No records left to review.</p>}
              {missingEmail.map((i) => (
                <div key={i.id} className="flex items-center gap-4 p-4 rounded-xl border" style={{ borderColor: "#f4f4f4", background: "#64646408" }}>
                  <div className="flex-1">
                    <div className="font-heading font-bold text-sm text-[#323232]">{i.name}</div>
                    <div className="text-xs text-[#646464] mt-0.5">
                      {i.jqsNumber || "—"} · {i.state || "—"}
                    </div>
                    <div className="text-xs mt-1 font-semibold" style={{ color: "#646464" }}>
                      Missing: Email address
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      disabled={busyKey === i.id}
                      onClick={() => act(i.id, "hold")}
                      className="px-3.5 py-2 rounded-lg text-xs font-heading font-bold border-2 transition-colors disabled:opacity-50"
                      style={{ borderColor: "#D8D8D8", color: "#646464" }}
                    >
                      Hold
                    </button>
                    <button
                      disabled={busyKey === i.id}
                      onClick={() => act(i.id, "request_update")}
                      className="px-3.5 py-2 rounded-lg text-xs font-heading font-bold transition-colors disabled:opacity-50"
                      style={{ background: "#FBBD15", color: "#323232" }}
                    >
                      Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {doneKeys.size > 0 && <p className="text-[11px] text-[#058812] mt-3 font-heading font-semibold">{doneKeys.size} record(s) updated.</p>}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onNext} className="px-7 py-3.5 rounded-xl text-white text-sm font-heading font-bold flex items-center gap-2" style={{ background: "#058812" }}>
          View Import Summary
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SummaryStep({ result, onNext }: { result: UploadResponse; onNext: () => void }) {
  const bars = [
    { label: "Ready for Invitation", count: result.readyCount, color: "#058812" },
    { label: "Duplicates Flagged", count: result.duplicateCount, color: "#FBBD15" },
    { label: "Age-Ineligible", count: result.ageIneligibleCount, color: "#e05c00" },
    { label: "No Email (Excluded)", count: result.missingEmailCount, color: "#969696" },
  ];
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
        <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
          <h3 className="font-heading font-bold text-lg text-[#323232]">Import Summary Report</h3>
          <p className="text-sm text-[#646464] mt-1">Generated {new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })} — requires Programme Manager sign-off</p>
        </div>

        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: "Total CSV Records", value: result.totalRows, color: "#1B4F8A" },
            { label: "Duplicates Flagged", value: result.duplicateCount, color: "#FBBD15" },
            { label: "Age-Ineligible", value: result.ageIneligibleCount, color: "#e05c00" },
            { label: "No Email (Excluded)", value: result.missingEmailCount, color: "#969696" },
            { label: "Ready for Invitation", value: result.readyCount, color: "#058812" },
            { label: "Dispatch Date", value: "Today", color: "#323232" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl" style={{ background: "#f4f4f4" }}>
              <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1">{s.label}</div>
              <div className="font-heading font-extrabold text-2xl" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <h4 className="font-heading font-bold text-sm text-[#323232] mb-4">Record Disposition</h4>
          <div className="space-y-3">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <div className="w-40 text-xs font-heading font-semibold text-[#646464] shrink-0">{b.label}</div>
                <div className="flex-1 h-7 bg-[#f4f4f4] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center px-3 transition-all duration-700"
                    style={{ width: `${result.totalRows ? (b.count / result.totalRows) * 100 : 0}%`, background: b.color }}
                  >
                    <span className="text-[11px] font-heading font-bold text-white">{b.count}</span>
                  </div>
                </div>
                <div className="w-10 text-xs text-right font-mono text-[#969696]">{result.totalRows ? Math.round((b.count / result.totalRows) * 100) : 0}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={onNext} className="px-7 py-3.5 rounded-xl text-white text-sm font-heading font-bold flex items-center gap-2" style={{ background: "#058812" }}>
          Proceed to Dispatch
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DispatchStep({ result, pmName, onFinished }: { result: UploadResponse; pmName: string; onFinished: () => void }) {
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dispatched, setDispatched] = useState<{ invitesSent: number; failed: number; dispatchedAt: string } | null>(null);
  const [error, setError] = useState("");

  async function handleDispatch() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/intake/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: result.batchId }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Dispatch failed.");
      return;
    }
    setDispatched(body);
  }

  if (dispatched) {
    return (
      <div className="bg-white rounded-2xl p-12 shadow-elev-2 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#05881215" }}>
          <svg className="w-10 h-10" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-heading font-extrabold text-2xl text-[#323232] mb-2">Invitations Dispatched</h3>
        <p className="text-[#646464] text-base mb-2">{dispatched.invitesSent} personalised invitation emails have been sent.</p>
        {dispatched.failed > 0 && <p className="text-sm text-[#e05c00] mb-2">{dispatched.failed} failed to send — check notifications_log.</p>}
        <p className="text-sm text-[#969696] mb-8">Each email includes the candidate&apos;s JQS number and a secure profile completion link.</p>
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-4">
          {[
            { label: "Emails Sent", value: dispatched.invitesSent, color: "#058812" },
            { label: "Dispatched At", value: new Date(dispatched.dispatchedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }), color: "#1B4F8A" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl" style={{ background: "#f4f4f4" }}>
              <div className="font-heading font-extrabold text-xl" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-[11px] text-[#969696] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <button onClick={onFinished} className="btn-primary mt-2">
          Back to Candidates →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-6 shadow-elev-2">
        <h3 className="font-heading font-bold text-lg text-[#323232] mb-1">Programme Manager Sign-Off</h3>
        <p className="text-sm text-[#646464] mb-6">Review the final dispatch summary. Your sign-off is required before any invitation emails are sent to candidates.</p>

        <div className="grid sm:grid-cols-2 gap-5 mb-6">
          <div className="p-5 rounded-2xl" style={{ background: "#f4f4f4" }}>
            <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-3">To Be Dispatched</div>
            <div className="font-heading font-extrabold text-4xl mb-1" style={{ color: "#058812" }}>
              {result.readyCount}
            </div>
            <div className="text-sm text-[#646464]">personalised invitation emails</div>
          </div>
          <div className="p-5 rounded-2xl space-y-3" style={{ background: "#f4f4f4" }}>
            <div className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-3">Email Details</div>
            <div className="flex justify-between text-sm">
              <span className="text-[#646464]">Subject line</span>
              <span className="font-semibold text-[#323232]">You&apos;ve been shortlisted…</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#646464]">Excluded (flagged)</span>
              <span className="font-semibold text-[#646464]">{result.totalRows - result.readyCount} candidates</span>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-4 cursor-pointer group">
          <div
            className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200"
            style={{ borderColor: approved ? "#058812" : "#D8D8D8", background: approved ? "#058812" : "white" }}
            onClick={() => setApproved(!approved)}
          >
            {approved && (
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <p className="font-heading font-bold text-sm text-[#323232]">
              I, {pmName}, approve this import and authorise the dispatch of {result.readyCount} invitation emails.
            </p>
            <p className="text-xs text-[#969696] mt-1">This action is timestamped and logged as a formal programme record.</p>
          </div>
        </label>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      <div className="flex justify-end">
        <button
          onClick={handleDispatch}
          disabled={!approved || loading}
          className="px-8 py-3.5 rounded-xl text-white text-sm font-heading font-bold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: approved ? "#058812" : "#969696" }}
        >
          {loading ? "Dispatching…" : "Dispatch Invitations"}
        </button>
      </div>
    </div>
  );
}

export function M01Intake({ pmName, initialCandidates }: { pmName: string; initialCandidates: CandidateListItem[] }) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "wizard">("list");
  const [candidates, setCandidates] = useState(initialCandidates);
  const [step, setStep] = useState<WorkflowStep>("upload");
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [continuingBatchId, setContinuingBatchId] = useState<string | null>(null);
  const [continueError, setContinueError] = useState("");
  const stepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === step);

  // Resumes an already-uploaded batch instead of starting a fresh CSV
  // import: rebuilds the review/summary data straight from the DB
  // (persisted validation_issues / duplicate_of / status, not the
  // in-memory result of the original upload, which is long gone once
  // you've navigated away) and lands on Review Queues if anything's
  // still unresolved, or Import Summary if it's just waiting on dispatch.
  async function continueBatch(batchId: string) {
    setContinuingBatchId(batchId);
    setContinueError("");
    const res = await fetch(`/api/intake/batch-status?batchId=${encodeURIComponent(batchId)}`);
    const body = await res.json();
    setContinuingBatchId(null);
    if (!res.ok) {
      setContinueError(body.error ?? "Couldn't load this import.");
      return;
    }
    const { stage, ...rest } = body as BatchStatusResponse;
    setResult(rest);
    setStep(stage === "review" ? "review" : "summary");
    setView("wizard");
  }

  // Server-fetched candidate list only reflects what was on the page at
  // load time — resync whenever a router.refresh() brings fresh props in
  // (e.g. after returning from a new import/dispatch).
  useEffect(() => {
    setCandidates(initialCandidates);
  }, [initialCandidates]);

  function backToList() {
    setView("list");
    setStep("upload");
    setResult(null);
    router.refresh();
  }

  if (view === "list") {
    return (
      <div className="p-5 lg:p-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#05881215" }}>
            ⬇
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-01 · Intake</h1>
            <p className="text-sm text-[#646464]">
              {candidates.length} candidate{candidates.length === 1 ? "" : "s"} in the programme — Programme Manager Portal
            </p>
          </div>
        </div>
        <CandidateListView
          candidates={candidates}
          onDeleted={(ids) => setCandidates((prev) => prev.filter((c) => !ids.includes(c.id)))}
          onStartUpload={() => {
            setStep("upload");
            setResult(null);
            setView("wizard");
          }}
          onContinueBatch={continueBatch}
          continuingBatchId={continuingBatchId}
          continueError={continueError}
        />
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-7">
        <button
          onClick={backToList}
          className="inline-flex items-center gap-1.5 text-sm font-heading font-bold mb-4 transition-colors"
          style={{ color: "#646464" }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Candidates
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#05881215" }}>
            ⬇
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-01 · Intake</h1>
            <p className="text-sm text-[#646464]">Nomination & CSV Import — Programme Manager Portal</p>
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total Records" value={result.totalRows} sub="In uploaded CSV" color="#1B4F8A" />
            <StatCard label="Duplicates Detected" value={result.duplicateCount} sub="Pending NCDMB confirmation" color="#FBBD15" />
            <StatCard label="Age-Ineligible" value={result.ageIneligibleCount} sub="Above 30 years — quarantined" color="#e05c00" />
            <StatCard label="No Email" value={result.missingEmailCount} sub="Needs attention queue" color="#646464" />
            <StatCard label="Ready to Invite" value={result.readyCount} sub="Cleared for dispatch" color="#058812" />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-elev-1 mb-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {WORKFLOW_STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            const reachable = result !== null || i === 0;
            return (
              <div key={s.id} className="flex items-center shrink-0">
                <button
                  onClick={() => reachable && setStep(s.id)}
                  disabled={!reachable}
                  className="flex flex-col items-center text-center min-w-[90px] px-2 py-1 rounded-xl transition-all disabled:opacity-40"
                  style={{ background: current ? "#05881210" : "transparent" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-heading font-bold mb-1.5 transition-all"
                    style={{ background: done || current ? "#058812" : "#f4f4f4", color: done || current ? "white" : "#969696" }}
                  >
                    {done ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div className="text-[12px] font-heading font-bold" style={{ color: current ? "#058812" : done ? "#323232" : "#969696" }}>
                    {s.label}
                  </div>
                  <div className="text-[10px] text-[#969696]">{s.desc}</div>
                </button>
                {i < WORKFLOW_STEPS.length - 1 && <div className="h-0.5 w-8 shrink-0 mx-1" style={{ background: i < stepIndex ? "#058812" : "#D8D8D8" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {step === "upload" && (
        <UploadStep
          onDone={(r) => {
            setResult(r);
            setStep("validate");
          }}
        />
      )}
      {step === "validate" && result && <ValidateStep result={result} onNext={() => setStep("review")} />}
      {step === "review" && result && <ReviewStep result={result} onNext={() => setStep("summary")} />}
      {step === "summary" && result && <SummaryStep result={result} onNext={() => setStep("dispatch")} />}
      {step === "dispatch" && result && <DispatchStep result={result} pmName={pmName} onFinished={backToList} />}
    </div>
  );
}
