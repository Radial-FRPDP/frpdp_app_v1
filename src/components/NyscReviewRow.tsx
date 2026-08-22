"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  candidateId: string;
  fullName: string;
  email: string;
  nyscCertNumber: string | null;
}

export function NyscReviewRow({ candidateId, fullName, email, nyscCertNumber }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function decide(decision: "verified" | "issue") {
    setBusy(true);
    await fetch("/api/nysc/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, decision, note: note || undefined }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <tr className="border-t border-[var(--line)] align-top">
      <td className="px-4 py-3">
        <div className="font-medium">{fullName}</div>
        <div className="text-xs text-[var(--ink-muted)]">{email}</div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{nyscCertNumber ?? "—"}</td>
      <td className="px-4 py-3">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note"
          className="input text-xs py-1"
        />
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          disabled={busy}
          onClick={() => decide("verified")}
          className="btn-primary text-xs px-3 py-1.5 mr-2"
        >
          Verify
        </button>
        <button
          disabled={busy}
          onClick={() => decide("issue")}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Flag issue
        </button>
      </td>
    </tr>
  );
}
