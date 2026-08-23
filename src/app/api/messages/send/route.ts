import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { newMessageForRadialEmail, newMessageForCandidateEmail } from "@/lib/email/templates";

export const runtime = "nodejs";

/**
 * Sends a Message Centre message and, unlike the old direct client-side
 * insert this replaces, fires the matching notification email -- a
 * candidate's message notifies the programme coordinator, a radial
 * reply notifies the candidate. Everything about who's allowed to post
 * as which sender_role is still enforced by the messages_self_insert /
 * messages_radial_all RLS policies from 0012 (this route inserts through
 * the session client, not the service-role one) -- this route's own job
 * is just figuring out candidateId/senderRole from the session rather
 * than trusting the client, and sending the email afterward.
 */
export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await req.json();
  const text = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const { data: ownCandidate } = await authed
    .from("candidates")
    .select("id, full_name, jqs_number, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  let candidateId: string;
  let senderRole: "candidate" | "radial";
  let senderStaffId: string | null = null;

  if (ownCandidate) {
    // A candidate can only ever post into their own thread -- whatever
    // candidateId the client sent is ignored in this branch, this is the
    // one place that actually matters.
    candidateId = ownCandidate.id;
    senderRole = "candidate";
  } else {
    const { data: staffRow } = await authed.from("staff_profiles").select("id").eq("id", user.id).eq("org", "radial").maybeSingle();
    if (!staffRow) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (typeof payload.candidateId !== "string" || !payload.candidateId) {
      return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
    }
    candidateId = payload.candidateId;
    senderRole = "radial";
    senderStaffId = staffRow.id;
  }

  const { data: inserted, error: insertError } = await authed
    .from("messages")
    .insert({ candidate_id: candidateId, sender_role: senderRole, sender_staff_id: senderStaffId, body: text })
    .select("id, sender_role, body, created_at")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json({ error: insertError?.message ?? "Could not send message" }, { status: 500 });
  }

  // Best-effort notification -- never blocks the send itself. sendEmail()
  // already logs its own outcome to notifications_log either way,
  // including "RESEND_API_KEY is not set" for as long as that's still
  // the case, so nothing here needs its own try/catch.
  if (senderRole === "candidate") {
    const coordinatorEmail = process.env.PROGRAM_COORDINATOR_EMAIL;
    if (coordinatorEmail && ownCandidate) {
      await sendEmail({
        candidateId,
        type: "message",
        to: coordinatorEmail,
        subject: `New message from ${ownCandidate.full_name}`,
        html: newMessageForRadialEmail(ownCandidate.full_name, ownCandidate.jqs_number, text),
      });
    }
  } else {
    const db = createServiceRoleClient();
    const { data: candidate } = await db.from("candidates").select("full_name, email").eq("id", candidateId).maybeSingle();
    if (candidate) {
      await sendEmail({
        candidateId,
        type: "message",
        to: candidate.email,
        subject: "New message from Radial Circle",
        html: newMessageForCandidateEmail(candidate.full_name, text),
      });
    }
  }

  return NextResponse.json({ message: inserted });
}
