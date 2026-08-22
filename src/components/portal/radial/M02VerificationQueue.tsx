"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QueueRow {
  candidateId: string;
  fullName: string;
  email: string;
  jqsNumber: string | null;
  nin: string | null;
  ninStatus: string;
  bvn: string | null;
  bvnStatus: string;
  nyscCertNumber: string | null;
  nyscStatus: string;
}

const FIELD_LABEL: Record<string, string> = { nin: "NIN", bvn: "BVN", nysc: "NYSC" };

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    verified: { label: "Verified", className: "badge-verified" },
    failed: { label: "Failed", className: "badge-issue" },
    issue: { label: "Flagged", className: "badge-issue" },
    pending: { label: "Pending", className: "badge-pending" },
    not_submitted: { label: "Not submitted", className: "badge-pending" },
  };
  const s = map[status] ?? map.pending;
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

function ReviewField({
  candidateId,
  field,
  value,
  status,
  positiveDecision,
  negativeDecision,
  negativeLabel,
  onDone,
}: {
  candidateId: string;
  field: "nin" | "bvn" | "nysc";
  value: string | null;
  status: string;
  positiveDecision: string;
  negativeDecision: string;
  negativeLabel: string;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: string) {
    setBusy(true);
    await fetch("/api/verify/manual-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, field, decision, note: note || undefined }),
    });
    setBusy(false);
    onDone();
  }

  const resolved = status === "verified" || status === positiveDecision;

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0" style={{ borderColor: "#f4f4f4" }}>
      <div className="w-14 shrink-0 pt-1.5 text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696]">{FIELD_LABEL[field]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-[#323232]">{value ?? "— not entered —"}</span>
          <StatusBadge status={status} />
        </div>
        {!resolved && (
          <div className="flex gap-2 mt-1.5">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (e.g. reference checked)"
              className="input text-xs py-1.5 flex-1"
            />
            <button disabled={busy || !value} onClick={() => decide(positiveDecision)} className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">
              Verify
            </button>
            <button disabled={busy || !value} onClick={() => decide(negativeDecision)} className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap">
              {negativeLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function M02VerificationQueue({ initialRows }: { initialRows: QueueRow[] }) {
  const router = useRouter();
  const [rows] = useState(initialRows);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-02 · Verification Queue</h1>
        <p className="text-sm text-[#646464] mt-1">
          Candidates self-report NIN, BVN, and NYSC and upload supporting documents — automatic verification isn&apos;t connected yet, so check each one
          against the source (NIMC, the candidate&apos;s bank, or the{" "}
          <a href="https://portal.nysc.org.ng" target="_blank" rel="noreferrer" className="font-semibold" style={{ color: "#058812" }}>
            NYSC self-service portal
          </a>
          ) and record the outcome here. A candidate is promoted to fully verified once all three clear.
        </p>
      </div>

      {rows.length === 0 && (
        <div className="bg-white rounded-2xl p-8 shadow-elev-2 text-center text-sm text-[#969696]">Nothing pending — every submitted profile has been reviewed.</div>
      )}

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.candidateId} className="bg-white rounded-2xl p-5 shadow-elev-2">
            <div className="flex items-center justify-between mb-1">
              <div className="font-heading font-bold text-sm text-[#323232]">{row.fullName}</div>
              {row.jqsNumber && <span className="font-mono text-[11px] text-[#969696]">{row.jqsNumber}</span>}
            </div>
            <div className="text-xs text-[#969696] mb-2">{row.email}</div>
            <div>
              <ReviewField
                candidateId={row.candidateId}
                field="nin"
                value={row.nin}
                status={row.ninStatus}
                positiveDecision="verified"
                negativeDecision="failed"
                negativeLabel="Mark failed"
                onDone={refresh}
              />
              <ReviewField
                candidateId={row.candidateId}
                field="bvn"
                value={row.bvn}
                status={row.bvnStatus}
                positiveDecision="verified"
                negativeDecision="failed"
                negativeLabel="Mark failed"
                onDone={refresh}
              />
              <ReviewField
                candidateId={row.candidateId}
                field="nysc"
                value={row.nyscCertNumber}
                status={row.nyscStatus}
                positiveDecision="verified"
                negativeDecision="issue"
                negativeLabel="Flag issue"
                onDone={refresh}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
