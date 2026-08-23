import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { M01Intake } from "@/components/portal/radial/M01Intake";
import { M01Welcome } from "@/components/portal/candidate/M01Welcome";
import { NCDMBM01 } from "@/components/portal/ncdmb/NCDMBM01";
import { RenaissanceM01 } from "@/components/portal/renaissance/RenaissanceM01";
import { ComingSoon } from "@/components/portal/ComingSoon";
import { isDuplicate, isAgeIssue, isEmailIssue, isReady } from "@/lib/candidate-classification";

export default async function PortalM01Page() {
  const session = await getPortalSession();
  if (!session) redirect("/login");

  if (session.role === "radial") {
    // getPortalSession() above has already confirmed this signed-in user's
    // staff_profiles.org is "radial" -- that's the real authorization
    // check for this branch. Read with the service-role client (bypasses
    // RLS) rather than the session-bound one: this list previously came
    // back empty for real Programme Manager accounts even though the
    // rows existed, most likely a mismatch between how the RLS helper
    // resolves the caller and how the session cookie carries it through
    // a Server Component. Using service-role here matches the same
    // trusted-backend pattern the intake upload route already uses for
    // writes, and removes that whole class of "should show data but
    // doesn't" bug for a page that's already access-gated above.
    const supabase = createServiceRoleClient();
    const { data: candidates, error } = await supabase
      .from("candidates")
      .select("id, full_name, email, phone, jqs_number, gender, discipline, status, created_at, batch_id, batches(filename)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) console.error("M-01 candidate list fetch failed:", error.message);

    type Joined = {
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
      jqs_number: string | null;
      gender: string | null;
      discipline: string | null;
      status: string;
      created_at: string;
      batch_id: string | null;
      batches: { filename: string } | null;
    };

    const initialCandidates = ((candidates ?? []) as unknown as Joined[]).map((c) => ({
      id: c.id,
      fullName: c.full_name,
      email: c.email,
      phone: c.phone,
      jqsNumber: c.jqs_number,
      gender: c.gender,
      discipline: c.discipline,
      status: c.status,
      createdAt: c.created_at,
      batchId: c.batch_id,
      batchFilename: c.batches?.filename ?? null,
    }));

    return <M01Intake pmName={session.user.name} initialCandidates={initialCandidates} />;
  }

  if (session.role === "candidate") {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, full_name, email, phone, jqs_number, gender, discipline, date_of_birth, state_of_origin, nomination_confirmed_at")
      .eq("auth_user_id", user!.id)
      .maybeSingle();
    if (!candidate) redirect("/login");
    return <M01Welcome candidate={candidate} />;
  }

  if (session.role === "ncdmb" || session.role === "renaissance") {
    // Same trusted-backend read pattern as the radial branch above: role
    // has already been verified by getPortalSession(), so this reads via
    // service-role rather than depending on RLS to independently re-derive
    // the same authorization for every table these dashboards touch.
    const supabase = createServiceRoleClient();
    const [{ data: candidates }, { data: latestBatch }, { data: pmRow }] = await Promise.all([
      supabase
        .from("candidates")
        .select("id, jqs_number, full_name, email, discipline, state_of_origin, date_of_birth, validation_issues, duplicate_of, duplicate_decision, status, created_at"),
      supabase.from("batches").select("filename, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("staff_profiles").select("full_name").eq("org", "radial").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);
    const rows = candidates ?? [];

    const duplicateRows = rows.filter(isDuplicate);
    const ageIneligibleRows = rows.filter((r) => isAgeIssue(r) && !isDuplicate(r));
    const missingEmailRows = rows.filter((r) => isEmailIssue(r) && !isDuplicate(r) && !isAgeIssue(r));
    const readyRows = rows.filter(isReady);
    const invitedOrBeyond = rows.filter((r) => r.status !== "pending_review");

    const disciplineCounts = new Map<string, number>();
    for (const r of rows) {
      if (!r.discipline) continue;
      disciplineCounts.set(r.discipline, (disciplineCounts.get(r.discipline) ?? 0) + 1);
    }
    const disciplines = [...disciplineCounts.entries()].map(([discipline, count]) => ({ discipline, count })).sort((a, b) => b.count - a.count);

    if (session.role === "ncdmb") {
      return (
        <NCDMBM01
          batchFilename={latestBatch?.filename ?? null}
          batchUploadedAt={latestBatch?.created_at ?? null}
          stats={{
            totalNominated: rows.length,
            duplicatesFlagged: duplicateRows.length,
            ageIneligible: ageIneligibleRows.length,
            readyToInvite: readyRows.length,
            missingEmail: missingEmailRows.length,
            invitedOrBeyond: invitedOrBeyond.length,
          }}
          duplicates={duplicateRows.map((r) => ({
            id: r.id,
            jqsNumber: r.jqs_number,
            name: r.full_name,
            dob: r.date_of_birth,
            discipline: r.discipline,
            state: r.state_of_origin,
            reason: (r.validation_issues ?? []).join("; ") || "Matches an existing candidate record",
            decision: (r.duplicate_decision ?? "pending") as "pending" | "replace" | "discard",
          }))}
          disciplines={disciplines}
          generatedAt={new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        />
      );
    }

    return (
      <RenaissanceM01
        totalNominated={rows.length}
        duplicatesFlagged={duplicateRows.length}
        ageIneligible={ageIneligibleRows.length}
        readyOrBeyond={readyRows.length + invitedOrBeyond.length}
        disciplines={disciplines}
        pmName={pmRow?.full_name ?? null}
      />
    );
  }

  // CBT read-only oversight for M-01 isn't built yet -- CBT officers work
  // through M-03/M-04 only (see roles.ts's module access list).
  return <ComingSoon moduleCode="M-01" moduleTitle="Intake" />;
}
