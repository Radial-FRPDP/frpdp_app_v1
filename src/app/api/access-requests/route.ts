import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { accessRequestReceivedEmail } from "@/lib/email/templates";
import { ORG_LOGIN_OPTIONS } from "@/lib/roles";
import type { StaffOrg } from "@/lib/database.types";

export const runtime = "nodejs";

const VALID_ORGS: StaffOrg[] = ["radial", "ncdmb", "renaissance", "cbt"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public "Request Access" submission from the landing page -- no auth
 * required, this is the whole point. Never creates a login by itself:
 * it only queues a row for a Radial Circle Programme Manager to review
 * and, on approval, provision the real account with the org/role they
 * confirm. Runs entirely through the service-role client so the
 * access_requests table itself never needs to be exposed to the anon
 * key / RLS.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName: string = (body?.fullName ?? "").trim();
  const email: string = (body?.email ?? "").trim().toLowerCase();
  const org: string = body?.org ?? "";
  const title: string = (body?.title ?? "").trim();
  const cbtCentreId: string | null = body?.cbtCentreId || null;
  const note: string = (body?.note ?? "").trim();

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!VALID_ORGS.includes(org as StaffOrg)) {
    return NextResponse.json({ error: "Select an organisation." }, { status: 400 });
  }
  if (org === "cbt" && !cbtCentreId) {
    return NextResponse.json({ error: "Select your assessment centre." }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: existingRequest } = await db
    .from("access_requests")
    .select("id")
    .eq("status", "pending")
    .ilike("email", email)
    .maybeSingle();

  if (existingRequest) {
    return NextResponse.json(
      { error: "A request from this email is already pending review." },
      { status: 409 }
    );
  }

  const { error: insertError } = await db.from("access_requests").insert({
    full_name: fullName,
    email,
    org: org as StaffOrg,
    title: title || null,
    cbt_centre_id: org === "cbt" ? cbtCentreId : null,
    note: note || null,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const coordinatorEmail = process.env.PROGRAM_COORDINATOR_EMAIL;
  if (coordinatorEmail) {
    const orgLabel = ORG_LOGIN_OPTIONS.find((o) => o.id === org)?.label ?? org;
    await sendEmail({
      candidateId: null,
      type: "access_request",
      to: coordinatorEmail,
      subject: `New access request — ${fullName} (${orgLabel})`,
      html: accessRequestReceivedEmail(fullName, email, orgLabel, note || null),
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Radial Circle only -- lists requests for the Users screen's review
 * queue. Session-bound (not service-role): the RLS policy on
 * access_requests is the real gate here since this is an ordinary
 * authenticated read, not a public-form submission.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: staffRow } = await supabase.from("staff_profiles").select("id").eq("id", user.id).eq("org", "radial").maybeSingle();
  if (!staffRow) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data, error } = await supabase.from("access_requests").select("*").order("requested_at", { ascending: false }).limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ requests: data ?? [] });
}
