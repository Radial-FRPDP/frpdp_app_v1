import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NyscReviewRow } from "@/components/NyscReviewRow";

export default async function NyscQueuePage() {
  const supabase = await createServerSupabaseClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("nysc_cert_number, candidates!inner(id, full_name, email)")
    .eq("nysc_review_status", "pending")
    .not("nysc_cert_number", "is", null)
    .order("created_at", { ascending: true });

  const rows = (profiles ?? []) as unknown as {
    nysc_cert_number: string | null;
    candidates: { id: string; full_name: string; email: string };
  }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">NYSC manual review queue</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Check each certificate number against the{" "}
          <a
            href="https://portal.nysc.org.ng"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--ember)] font-medium"
          >
            NYSC self-service portal
          </a>{" "}
          (NGN 2,000 per certificate), then record the outcome here. This doesn&apos;t block the candidate from
          booking a CBT slot once their NIN is verified.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--background)] text-xs uppercase text-[var(--ink-muted)]">
            <tr>
              <th className="text-left px-4 py-2">Candidate</th>
              <th className="text-left px-4 py-2">Cert. number</th>
              <th className="text-left px-4 py-2">Note</th>
              <th className="text-left px-4 py-2">Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <NyscReviewRow
                key={row.candidates.id}
                candidateId={row.candidates.id}
                fullName={row.candidates.full_name}
                email={row.candidates.email}
                nyscCertNumber={row.nysc_cert_number}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--ink-muted)]">
                  Nothing pending — every submitted certificate has been reviewed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
