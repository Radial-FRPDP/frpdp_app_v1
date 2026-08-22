import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { inviteEmail } from "@/lib/email/templates";

export const runtime = "nodejs";

/**
 * Stage 1 · Intake (M01) — Programme Manager sign-off & dispatch.
 * Sends invite emails to every candidate in the batch that passed
 * validation cleanly (status still `pending_review`, no validation
 * issues, not a duplicate). Duplicate / age-ineligible / no-email rows
 * are left untouched for the Review Queues to resolve first — dispatch
 * never sends an invite to a row that hasn't cleared.
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

  const { batchId } = await req.json();
  if (!batchId) {
    return NextResponse.json({ error: "batchId is required" }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: batchCandidates, error } = await db
    .from("candidates")
    .select("id, full_name, email, jqs_number, invite_token, validation_issues")
    .eq("batch_id", batchId)
    .eq("status", "pending_review")
    .is("duplicate_of", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // jsonb array equality is awkward over PostgREST — filter client-side
  // for "no validation issues at all" instead of relying on it.
  const readyCandidates = (batchCandidates ?? []).filter((c) => (c.validation_issues?.length ?? 0) === 0);

  if (readyCandidates.length === 0) {
    return NextResponse.json({ error: "No cleared candidates to dispatch in this batch." }, { status: 400 });
  }

  const results = await Promise.all(
    readyCandidates.map(async (c) => {
      const sendResult = await sendEmail({
        candidateId: c.id,
        type: "invite",
        to: c.email,
        subject: "You've been shortlisted — complete your profile",
        html: inviteEmail(c.full_name, c.invite_token, c.jqs_number),
      });
      if (sendResult.ok) {
        await db.from("candidates").update({ status: "invited" }).eq("id", c.id);
      }
      return { candidateId: c.id, ok: sendResult.ok };
    })
  );

  const sentCount = results.filter((r) => r.ok).length;

  return NextResponse.json({
    dispatchedAt: new Date().toISOString(),
    invitesSent: sentCount,
    failed: results.length - sentCount,
  });
}
