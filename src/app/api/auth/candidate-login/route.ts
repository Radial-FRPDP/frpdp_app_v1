import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Candidate sign-in by JQS Number + password. Supabase Auth only knows
 * email addresses, so this resolves JQS number -> email server-side (via
 * the service-role client, bypassing RLS) and then performs a normal
 * password sign-in with the anon/cookie-writing client so the session
 * cookie lands correctly. The JQS number itself is never exposed to the
 * browser as an enumeration oracle — every failure path returns the same
 * generic message.
 */
export async function POST(req: NextRequest) {
  const { jqsNumber, password } = await req.json();

  if (!jqsNumber || !password) {
    return NextResponse.json({ error: "JQS number and password are required." }, { status: 400 });
  }

  const GENERIC_ERROR = "Invalid JQS number or password.";
  const normalizedJqs = String(jqsNumber).trim().toUpperCase();

  const db = createServiceRoleClient();
  const { data: candidate } = await db
    .from("candidates")
    .select("email, auth_user_id")
    .eq("jqs_number", normalizedJqs)
    .maybeSingle();

  if (!candidate || !candidate.auth_user_id) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: candidate.email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
