import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { M02Profile } from "@/components/portal/candidate/M02Profile";
import { M02VerificationQueue } from "@/components/portal/radial/M02VerificationQueue";
import { ComingSoon } from "@/components/portal/ComingSoon";

export default async function PortalM02Page() {
  const session = await getPortalSession();
  if (!session) redirect("/login");

  if (session.role === "radial") {
    const supabase = await createServerSupabaseClient();
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, full_name, email, jqs_number, profiles(nin, nin_verification_status, bvn, bvn_verification_status, nysc_cert_number, nysc_review_status, completed_at)")
      .eq("status", "profile_complete")
      .order("id");

    type Joined = {
      id: string;
      full_name: string;
      email: string;
      jqs_number: string | null;
      profiles: {
        nin: string | null;
        nin_verification_status: string;
        bvn: string | null;
        bvn_verification_status: string;
        nysc_cert_number: string | null;
        nysc_review_status: string;
        completed_at: string | null;
      } | null;
    };

    const rows = ((candidates ?? []) as unknown as Joined[])
      .map((c) => ({
        candidateId: c.id,
        fullName: c.full_name,
        email: c.email,
        jqsNumber: c.jqs_number,
        nin: c.profiles?.nin ?? null,
        ninStatus: c.profiles?.nin_verification_status ?? "not_submitted",
        bvn: c.profiles?.bvn ?? null,
        bvnStatus: c.profiles?.bvn_verification_status ?? "not_submitted",
        nyscCertNumber: c.profiles?.nysc_cert_number ?? null,
        nyscStatus: c.profiles?.nysc_review_status ?? "pending",
        completedAt: c.profiles?.completed_at ?? "",
      }))
      .filter((r) => r.ninStatus !== "verified" || r.bvnStatus !== "verified" || r.nyscStatus !== "verified")
      .sort((a, b) => (a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0));

    return <M02VerificationQueue initialRows={rows} />;
  }

  if (session.role !== "candidate") {
    return <ComingSoon moduleCode="M-02" moduleTitle="Profile" />;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, full_name, email, phone, status, date_of_birth")
    .eq("auth_user_id", user!.id)
    .maybeSingle();

  if (!candidate) redirect("/login");
  // M-01's nomination-confirmation gate — a candidate who hasn't confirmed
  // yet shouldn't be able to jump straight here via a direct URL.
  if (!session.candidateNominationConfirmed) redirect("/portal/m01");

  const [{ data: profile }, { data: documents }] = await Promise.all([
    supabase.from("profiles").select("*").eq("candidate_id", candidate.id).maybeSingle(),
    supabase.from("documents").select("id, doc_type, storage_path").eq("candidate_id", candidate.id),
  ]);

  return <M02Profile candidate={candidate} profile={profile} documents={documents ?? []} />;
}
