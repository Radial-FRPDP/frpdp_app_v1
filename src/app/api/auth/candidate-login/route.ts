import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * JQS Number -> email lookup for candidate sign-in. Supabase Auth only
 * knows email addresses, and resolving JQS -> email needs to bypass RLS
 * (an unauthenticated visitor can't read the candidates table), so this
 * stays a server-side route backed by the service-role client.
 *
 * The actual signInWithPassword() call now happens in the browser (see
 * CandidateLogin in src/app/login/page.tsx) instead of here. It used to
 * run server-side against a cookie-writing client and return { ok: true
 * }, but the session cookies that write produced weren't reliably
 * reaching the browser on the very next request -- signing in straight
 * from the browser's own Supabase client writes the session cookies
 * directly, no server round-trip involved, which sidesteps that
 * failure mode entirely.
 *
 * The JQS number itself stays out of the response either way -- a
 * not-found JQS and a wrong password both need to look identical to the
 * caller, so the login form shows the same generic message for either.
 */
export async function POST(req: NextRequest) {
  const { jqsNumber } = await req.json();

  if (!jqsNumber) {
    return NextResponse.json({ error: "JQS number is required." }, { status: 400 });
  }

  const normalizedJqs = String(jqsNumber).trim().toUpperCase();

  const db = createServiceRoleClient();
  const { data: candidate } = await db
    .from("candidates")
    .select("email, auth_user_id")
    .eq("jqs_number", normalizedJqs)
    .maybeSingle();

  if (!candidate || !candidate.auth_user_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ email: candidate.email });
}
