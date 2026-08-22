import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Admin action: the program coordinator marks a candidate's NYSC
 * certificate as verified or flags an issue, after checking it manually
 * against the NYSC self-service portal (see Executive Brief, Recommendation).
 */
export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: staffRow } = await authed
    .from("staff_profiles")
    .select("id")
    .eq("id", user.id)
    .eq("org", "radial")
    .maybeSingle();
  if (!staffRow) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { candidateId, decision, note } = await req.json();
  if (!candidateId || !["verified", "issue"].includes(decision)) {
    return NextResponse.json({ error: "candidateId and a valid decision are required" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { error } = await db
    .from("profiles")
    .update({
      nysc_review_status: decision,
      nysc_reviewed_by: staffRow.id,
      nysc_reviewed_at: new Date().toISOString(),
      nysc_review_note: note ?? null,
    })
    .eq("candidate_id", candidateId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If both NIN and NYSC are now clear, promote the candidate to "verified".
  const { data: profile } = await db
    .from("profiles")
    .select("nin_verification_status, nysc_review_status")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (profile?.nin_verification_status === "verified" && profile?.nysc_review_status === "verified") {
    await db.from("candidates").update({ status: "verified" }).eq("id", candidateId);
  }

  return NextResponse.json({ ok: true });
}
