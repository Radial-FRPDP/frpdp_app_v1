import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * TEMPORARY diagnostic route for the "sign-in succeeds, /portal bounces
 * back to /login" bug. Visit this URL directly in the browser right
 * after (attempting) to sign in -- it reports, without exposing any
 * secret values, whether the sb-* session cookies actually reached the
 * server on this request and whether the server-side Supabase client can
 * resolve a user from them. Delete this route once the bug is fixed.
 */
export async function GET(req: NextRequest) {
  const allCookieNames = req.cookies.getAll().map((c) => c.name);
  const sbCookieNames = allCookieNames.filter((n) => n.startsWith("sb-"));

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return NextResponse.json({
    allCookieCount: allCookieNames.length,
    allCookieNames,
    sbCookieNames,
    userFound: !!user,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    getUserError: error?.message ?? null,
  });
}
