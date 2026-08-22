import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

type ReviewAction = "keep" | "remove" | "hold" | "request_update";

/**
 * Radial Circle's M-01 review-queue actions on a single flagged
 * candidate row. Every action here is a real, persisted effect — there
 * is no "demo click" state that only exists in the browser.
 *
 *  - remove:         permanently excludes the row (status -> rejected).
 *  - keep:            overrides a false-positive duplicate flag so the
 *                      row rejoins the ready-to-invite pool.
 *  - hold:            leaves the row out of dispatch but annotates why,
 *                      for audit.
 *  - request_update:  emails the programme coordinator asking NCDMB for
 *                      corrected contact details (used for missing-email
 *                      rows, which by definition can't be emailed
 *                      directly).
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

  const { candidateId, action } = (await req.json()) as { candidateId?: string; action?: ReviewAction };
  if (!candidateId || !action) {
    return NextResponse.json({ error: "candidateId and action are required" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: candidate } = await db
    .from("candidates")
    .select("id, full_name, jqs_number, validation_issues, duplicate_of")
    .eq("id", candidateId)
    .maybeSingle();

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (action === "remove") {
    await db
      .from("candidates")
      .update({
        status: "rejected",
        validation_issues: [...candidate.validation_issues, "removed by Radial Circle review"],
      })
      .eq("id", candidateId);
    return NextResponse.json({ ok: true });
  }

  if (action === "keep") {
    await db
      .from("candidates")
      .update({
        duplicate_of: null,
        validation_issues: candidate.validation_issues.filter((p: string) => !p.toLowerCase().includes("duplicate")),
      })
      .eq("id", candidateId);
    return NextResponse.json({ ok: true });
  }

  if (action === "hold") {
    await db
      .from("candidates")
      .update({
        validation_issues: candidate.validation_issues.map((p: string) =>
          p.toLowerCase().includes("email") ? `${p} — held by Radial Circle pending update` : p
        ),
      })
      .eq("id", candidateId);
    return NextResponse.json({ ok: true });
  }

  if (action === "request_update") {
    const coordinatorEmail = process.env.PROGRAM_COORDINATOR_EMAIL;
    if (coordinatorEmail) {
      await sendEmail({
        candidateId: candidate.id,
        type: "validation_report",
        to: coordinatorEmail,
        subject: `Missing contact details — ${candidate.full_name} (${candidate.jqs_number ?? "no JQS number"})`,
        html: `<p>Radial Circle needs updated contact details for <b>${candidate.full_name}</b> (${
          candidate.jqs_number ?? "no JQS number"
        }) before an invitation can be sent. Please confirm with NCDMB.</p>`,
      });
    }
    return NextResponse.json({ ok: true, emailed: !!coordinatorEmail });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
