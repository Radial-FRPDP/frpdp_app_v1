import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { provisionStaffAccount } from "@/lib/staff/provision";
import { sendEmail } from "@/lib/email/resend";
import { accessRequestDecisionEmail } from "@/lib/email/templates";
import type { StaffOrg } from "@/lib/database.types";

export const runtime = "nodejs";

/**
 * Approves a pending access request: provisions the real staff account
 * (auth user + staff_profiles row + invite email), then marks the
 * request approved. The Programme Manager can override the org/title/
 * centre the requester originally picked -- what they typed on the
 * public form is a claim, not a grant.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: reviewer } = await authed.from("staff_profiles").select("id").eq("id", user.id).eq("org", "radial").maybeSingle();
  if (!reviewer) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const db = createServiceRoleClient();

  const { data: request } = await db.from("access_requests").select("*").eq("id", id).maybeSingle();
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: `This request was already ${request.status}.` }, { status: 400 });
  }

  const org: StaffOrg = body.org ?? request.org;
  const title: string | null = body.title !== undefined ? body.title : request.title;
  const cbtCentreId: string | null = org === "cbt" ? body.cbtCentreId ?? request.cbt_centre_id ?? null : null;

  const result = await provisionStaffAccount({
    fullName: request.full_name,
    email: request.email,
    org,
    title,
    cbtCentreId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await db
    .from("access_requests")
    .update({
      status: "approved",
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
      decision_note: body.note || null,
    })
    .eq("id", id);

  await sendEmail({
    candidateId: null,
    type: "access_request",
    to: request.email,
    subject: "Your access request was approved",
    html: accessRequestDecisionEmail(request.full_name, true, body.note || null),
  });

  return NextResponse.json({ ok: true });
}
