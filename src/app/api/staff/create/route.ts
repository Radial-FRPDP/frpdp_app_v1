import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { provisionStaffAccount } from "@/lib/staff/provision";
import type { StaffOrg } from "@/lib/database.types";

export const runtime = "nodejs";

const VALID_ORGS: StaffOrg[] = ["radial", "ncdmb", "renaissance", "cbt"];

/**
 * Radial Circle directly creating a staff account with no access request
 * on file -- the other way onto the Users screen's staff list, alongside
 * approving a pending request.
 */
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

  const body = await req.json().catch(() => null);
  const fullName: string = (body?.fullName ?? "").trim();
  const email: string = (body?.email ?? "").trim().toLowerCase();
  const org: string = body?.org ?? "";
  const title: string = (body?.title ?? "").trim();
  const cbtCentreId: string | null = body?.cbtCentreId || null;

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Enter a full name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!VALID_ORGS.includes(org as StaffOrg)) {
    return NextResponse.json({ error: "Select an organisation." }, { status: 400 });
  }
  if (org === "cbt" && !cbtCentreId) {
    return NextResponse.json({ error: "Select an assessment centre." }, { status: 400 });
  }

  const result = await provisionStaffAccount({
    fullName,
    email,
    org: org as StaffOrg,
    title: title || null,
    cbtCentreId: org === "cbt" ? cbtCentreId : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
