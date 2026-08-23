import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * TEMPORARY diagnostic route for the "sign-in succeeds, /portal bounces
 * back to /login" bug. Visit this URL directly in the browser right
 * after (attempting) to sign in -- it reports, without exposing any
 * secret values, whether the sb-* session cookies actually reached the
 * server on this request, whether the server-side Supabase client can
 * resolve a user from them, and -- crucially -- runs the exact same
 * staff_profiles / candidates lookups getPortalSession() does (through
 * the RLS-enforced session client) plus a service-role cross-check, so
 * we can see exactly where the lookup diverges. Delete this route once
 * the bug is fixed.
 */
export async function GET(req: NextRequest) {
  const allCookieNames = req.cookies.getAll().map((c) => c.name);
  const sbCookieNames = allCookieNames.filter((n) => n.startsWith("sb-"));

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      allCookieCount: allCookieNames.length,
      sbCookieNames,
      userFound: false,
      getUserError: getUserError?.message ?? null,
    });
  }

  // Same queries getPortalSession() runs, through the RLS-enforced
  // session client -- this shows what the app itself sees.
  const { data: staffRow, error: staffError } = await supabase
    .from("staff_profiles")
    .select("id, full_name, org")
    .eq("id", user.id)
    .maybeSingle();

  const { data: candidateRow, error: candidateError } = await supabase
    .from("candidates")
    .select("id, jqs_number, full_name, email, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Ground truth via the service-role client (bypasses RLS entirely) --
  // if this finds a row but the RLS-enforced query above didn't, the
  // problem is an RLS policy, not the data itself.
  const db = createServiceRoleClient();
  const { data: candidateByAuthIdAdmin, error: candidateByAuthIdAdminError } = await db
    .from("candidates")
    .select("id, jqs_number, full_name, email, auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: candidateByEmailAdmin, error: candidateByEmailAdminError } = await db
    .from("candidates")
    .select("id, jqs_number, full_name, email, auth_user_id")
    .eq("email", user.email ?? "")
    .maybeSingle();

  return NextResponse.json({
    allCookieCount: allCookieNames.length,
    sbCookieNames,
    userFound: true,
    userId: user.id,
    userEmail: user.email,

    rls_staffRow: staffRow,
    rls_staffError: staffError?.message ?? null,
    rls_candidateRow: candidateRow,
    rls_candidateError: candidateError?.message ?? null,

    admin_candidateByAuthId: candidateByAuthIdAdmin,
    admin_candidateByAuthIdError: candidateByAuthIdAdminError?.message ?? null,
    admin_candidateByEmail: candidateByEmailAdmin,
    admin_candidateByEmailError: candidateByEmailAdminError?.message ?? null,
  });
}
