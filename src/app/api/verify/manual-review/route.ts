import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Radial Circle's manual verification call for NIN, BVN, or NYSC — the
 * Verification Queue (M-02, radial role) uses this for all three fields.
 *
 * Why this exists: live NIN (Dojah) and BVN (Paystack) verification both
 * need provider approvals that aren't in place yet, so for now candidates
 * self-report + upload supporting documents and a real person checks each
 * one by hand, the same way NYSC has always worked here. This route is
 * just that decision, recorded — not a new verification method.
 */

const FIELD_CONFIG = {
  nin: {
    statusColumn: "nin_verification_status",
    reviewedByColumn: "nin_reviewed_by",
    reviewedAtColumn: "nin_reviewed_at",
    noteColumn: "nin_review_note",
    allowedDecisions: ["verified", "failed"],
  },
  bvn: {
    statusColumn: "bvn_verification_status",
    reviewedByColumn: "bvn_reviewed_by",
    reviewedAtColumn: "bvn_reviewed_at",
    noteColumn: "bvn_review_note",
    allowedDecisions: ["verified", "failed"],
  },
  nysc: {
    statusColumn: "nysc_review_status",
    reviewedByColumn: "nysc_reviewed_by",
    reviewedAtColumn: "nysc_reviewed_at",
    noteColumn: "nysc_review_note",
    allowedDecisions: ["verified", "issue"],
  },
} as const;

type Field = keyof typeof FIELD_CONFIG;

export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: staffRow } = await authed.from("staff_profiles").select("id").eq("id", user.id).eq("org", "radial").maybeSingle();
  if (!staffRow) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { candidateId, field, decision, note } = await req.json();
  if (!candidateId || typeof field !== "string" || !(field in FIELD_CONFIG)) {
    return NextResponse.json({ error: "candidateId and a valid field (nin | bvn | nysc) are required" }, { status: 400 });
  }
  const config = FIELD_CONFIG[field as Field];
  if (!config.allowedDecisions.includes(decision)) {
    return NextResponse.json({ error: `decision must be one of: ${config.allowedDecisions.join(", ")}` }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const updatePayload: Record<string, unknown> = {
    [config.statusColumn]: decision,
    [config.reviewedByColumn]: staffRow.id,
    [config.reviewedAtColumn]: new Date().toISOString(),
    [config.noteColumn]: note ?? null,
  };
  const { error } = await db
    .from("profiles")
    .update(updatePayload as never)
    .eq("candidate_id", candidateId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Once NIN, BVN, and NYSC are all clear, promote the candidate to "verified".
  const { data: profile } = await db
    .from("profiles")
    .select("nin_verification_status, bvn_verification_status, nysc_review_status")
    .eq("candidate_id", candidateId)
    .maybeSingle();

  if (profile?.nin_verification_status === "verified" && profile?.bvn_verification_status === "verified" && profile?.nysc_review_status === "verified") {
    await db.from("candidates").update({ status: "verified" }).eq("id", candidateId);
  }

  return NextResponse.json({ ok: true });
}
