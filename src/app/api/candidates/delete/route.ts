import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Deletes one or more candidate rows from the Candidate List (M-01),
 * Radial Circle only. Used to clear bad test/import data (e.g. a wrong
 * email) before re-uploading corrected rows.
 *
 * Runs the delete with the service-role client rather than relying on
 * the session-bound client + RLS, matching the same trusted-backend
 * pattern already used by /api/intake/upload: this route does its own
 * staff_profiles.org == "radial" check up front, which is the real
 * authorization here, same as the other intake routes.
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

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of candidate id strings" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { error } = await db.from("candidates").delete().in("id", ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: ids.length });
}
