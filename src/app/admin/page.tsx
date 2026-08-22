import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CandidateStatus } from "@/lib/database.types";

const STATUS_LABEL: Record<CandidateStatus, string> = {
  pending_review: "Needs review",
  invited: "Invited",
  profile_in_progress: "Profile in progress",
  profile_complete: "Profile complete",
  verified: "Verified",
  rejected: "Rejected",
};

const STATUS_BADGE: Record<CandidateStatus, string> = {
  pending_review: "badge-issue",
  invited: "badge-pending",
  profile_in_progress: "badge-pending",
  profile_complete: "badge-pending",
  verified: "badge-verified",
  rejected: "badge-issue",
};

export default async function AdminDashboard() {
  const supabase = await createServerSupabaseClient();

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, full_name, email, status, validation_issues, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const counts = (candidates ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">Candidates</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Most recent 50 records.{" "}
          <Link href="/admin/upload" className="text-[var(--ember)] font-medium">
            Upload a new batch →
          </Link>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(Object.keys(STATUS_LABEL) as CandidateStatus[]).map((status) => (
          <div key={status} className="card p-4">
            <div className="text-2xl font-bold tabular-nums">{counts[status] ?? 0}</div>
            <div className="text-xs text-[var(--ink-muted)] uppercase tracking-wide">{STATUS_LABEL[status]}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background)] text-xs uppercase text-[var(--ink-muted)]">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Issues</th>
            </tr>
          </thead>
          <tbody>
            {(candidates ?? []).map((c) => (
              <tr key={c.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-2">{c.full_name}</td>
                <td className="px-4 py-2 text-[var(--ink-muted)]">{c.email}</td>
                <td className="px-4 py-2">
                  <span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </td>
                <td className="px-4 py-2 text-[var(--risk)] text-xs">
                  {Array.isArray(c.validation_issues) && c.validation_issues.length > 0
                    ? c.validation_issues.join("; ")
                    : "—"}
                </td>
              </tr>
            ))}
            {(!candidates || candidates.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                  No candidates yet — upload a batch to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
