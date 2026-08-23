import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { M02Profile } from "@/components/portal/candidate/M02Profile";
import { M02VerificationQueue } from "@/components/portal/radial/M02VerificationQueue";
import { NCDMBM02 } from "@/components/portal/ncdmb/NCDMBM02";
import { RenaissanceM02 } from "@/components/portal/renaissance/RenaissanceM02";
import { ComingSoon } from "@/components/portal/ComingSoon";

const REQUIRED_DOC_TYPES = ["id_card", "degree_certificate", "nysc_certificate"];

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

  if (session.role === "ncdmb" || session.role === "renaissance") {
    const supabase = createServiceRoleClient();
    const { data: candidates } = await supabase
      .from("candidates")
      .select("id, status, zone, discipline, auth_user_id, profiles(nin_verification_status, bvn_verification_status, nysc_review_status, completed_at)")
      .neq("status", "pending_review");

    type Row = {
      id: string;
      status: string;
      zone: string | null;
      discipline: string | null;
      auth_user_id: string | null;
      profiles: { nin_verification_status: string; bvn_verification_status: string; nysc_review_status: string; completed_at: string | null } | null;
    };
    const rows = ((candidates ?? []) as unknown as Row[]);

    const { data: docs } = await supabase.from("documents").select("candidate_id, doc_type");
    const docsByCandidate = new Map<string, Set<string>>();
    for (const d of docs ?? []) {
      if (!docsByCandidate.has(d.candidate_id)) docsByCandidate.set(d.candidate_id, new Set());
      docsByCandidate.get(d.candidate_id)!.add(d.doc_type);
    }
    const hasAllDocs = (candidateId: string) => REQUIRED_DOC_TYPES.every((t) => docsByCandidate.get(candidateId)?.has(t));

    const submitted = rows.filter((r) => !!r.profiles?.completed_at);
    const cleared = submitted.filter(
      (r) => r.profiles?.nin_verification_status === "verified" && r.profiles?.bvn_verification_status === "verified" && r.profiles?.nysc_review_status === "verified"
    );
    const flagged = submitted.filter(
      (r) => r.profiles?.nin_verification_status === "failed" || r.profiles?.bvn_verification_status === "failed" || r.profiles?.nysc_review_status === "issue"
    );
    const ninVerified = submitted.filter((r) => r.profiles?.nin_verification_status === "verified");
    const ninMismatch = submitted.filter((r) => r.profiles?.nin_verification_status === "failed");
    const bvnVerified = submitted.filter((r) => r.profiles?.bvn_verification_status === "verified");
    const bvnMismatch = submitted.filter((r) => r.profiles?.bvn_verification_status === "failed");
    const docsCompleteRows = submitted.filter((r) => hasAllDocs(r.id));

    const zoneMap = new Map<string, { invited: number; submitted: number; cleared: number }>();
    for (const r of rows) {
      const z = r.zone ?? "Unspecified";
      if (!zoneMap.has(z)) zoneMap.set(z, { invited: 0, submitted: 0, cleared: 0 });
      const entry = zoneMap.get(z)!;
      entry.invited++;
      if (r.profiles?.completed_at) entry.submitted++;
      if (r.profiles?.nin_verification_status === "verified" && r.profiles?.bvn_verification_status === "verified" && r.profiles?.nysc_review_status === "verified")
        entry.cleared++;
    }
    const zones = [...zoneMap.entries()].map(([zone, v]) => ({ zone, ...v })).sort((a, b) => b.invited - a.invited);

    const disciplineMap = new Map<string, number>();
    for (const r of submitted) {
      if (!r.discipline) continue;
      disciplineMap.set(r.discipline, (disciplineMap.get(r.discipline) ?? 0) + 1);
    }
    const disciplines = [...disciplineMap.entries()].map(([discipline, count]) => ({ discipline, count })).sort((a, b) => b.count - a.count);

    if (session.role === "ncdmb") {
      return (
        <NCDMBM02
          totalInvited={rows.length}
          profilesSubmitted={submitted.length}
          cleared={cleared.length}
          flagged={flagged.length}
          zones={zones}
          disciplines={disciplines}
          verification={[
            { title: "NIN Verified", count: ninVerified.length, total: submitted.length, color: "#058812", icon: "🪪", detail: "Name, DOB, and gender matched NIMC records" },
            { title: "NIN Mismatch", count: ninMismatch.length, total: submitted.length, color: "#e05c00", icon: "⚠️", detail: "Candidate name on NIN does not match programme record" },
            { title: "BVN Verified", count: bvnVerified.length, total: submitted.length, color: "#058812", icon: "🏦", detail: "Name and phone verified against Paystack BVN lookup" },
            { title: "BVN Mismatch", count: bvnMismatch.length, total: submitted.length, color: "#e05c00", icon: "⚠️", detail: "Name on BVN differs from programme record" },
            { title: "All Docs Uploaded", count: docsCompleteRows.length, total: submitted.length, color: "#058812", icon: "📄", detail: "NIN slip, degree cert, and NYSC cert all present" },
            { title: "Docs Incomplete", count: submitted.length - docsCompleteRows.length, total: submitted.length, color: "#FBBD15", icon: "🔴", detail: "One or more required documents not yet uploaded" },
          ]}
          generatedAt={new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        />
      );
    }

    return (
      <RenaissanceM02
        invited={rows.length}
        registered={rows.filter((r) => !!r.auth_user_id).length}
        submitted={submitted.length}
        identityVerified={submitted.filter((r) => r.profiles?.nin_verification_status === "verified" && r.profiles?.bvn_verification_status === "verified").length}
        docsComplete={docsCompleteRows.length}
        cleared={cleared.length}
        flags={[
          { label: "NIN Identity Mismatch", count: ninMismatch.length, color: "#e05c00" },
          { label: "BVN Name Mismatch", count: bvnMismatch.length, color: "#9b2335" },
          { label: "Incomplete Documents", count: submitted.length - docsCompleteRows.length, color: "#FBBD15" },
          { label: "Profile On Hold", count: flagged.length, color: "#1B4F8A" },
        ]}
      />
    );
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
