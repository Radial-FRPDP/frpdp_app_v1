import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { M01Intake } from "@/components/portal/radial/M01Intake";
import { M01Welcome } from "@/components/portal/candidate/M01Welcome";
import { ComingSoon } from "@/components/portal/ComingSoon";

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
      .select("id, full_name, email, phone, jqs_number, gender, discipline, status, created_at, batches(filename)")
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

  // NCDMB / Renaissance / CBT read-only oversight for M-01 isn't built yet.
  return <ComingSoon moduleCode="M-01" moduleTitle="Intake" />;
}
