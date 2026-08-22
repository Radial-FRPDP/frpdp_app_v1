"use client";

import { useState } from "react";

interface UploadResult {
  totalRows: number;
  validRows: number;
  issueRows: number;
  invitesSent: number;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("uploading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/intake/upload", { method: "POST", body: formData });
    const body = await res.json();

    if (!res.ok) {
      setStatus("error");
      setErrorMessage(body.error ?? "Upload failed");
      return;
    }

    setResult(body);
    setStatus("done");
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold">Upload candidate list</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          CSV or XLSX with at least full name and email columns (phone optional). Every row is validated and
          de-duplicated; you&apos;ll get an emailed summary either way.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        <button type="submit" disabled={!file || status === "uploading"} className="btn-primary">
          {status === "uploading" ? "Processing…" : "Upload & validate"}
        </button>
        {status === "error" && <p className="text-sm text-[var(--risk)]">{errorMessage}</p>}
      </form>

      {status === "done" && result && (
        <div className="card p-6 space-y-2">
          <h2 className="font-bold">Batch processed</h2>
          <ul className="text-sm space-y-1">
            <li>Total rows: {result.totalRows}</li>
            <li className="text-[var(--done)]">Valid &amp; invited: {result.invitesSent}</li>
            <li className={result.issueRows > 0 ? "text-[var(--risk)]" : ""}>
              Needs attention: {result.issueRows}
            </li>
          </ul>
          <p className="text-xs text-[var(--ink-muted)]">
            A validation summary email has been sent to the program coordinator. Rows needing attention are also
            visible on the dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
