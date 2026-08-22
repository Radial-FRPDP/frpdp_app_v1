import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Staff / partner sign-in: email + password, plus the organisation tile
 * the user picked on the login screen. The org tile is a UX guard, not
 * the real access boundary (RLS is) — if the account's actual org in
 * staff_profiles doesn't match what was picked, we sign the session back
 * out and report a clear error rather than silently letting them into a
 * portal that doesn't match the tile they clicked.
 */
export async function POST(req: NextRequest) {
  const { org, email, password } = await req.json();

  if (!org || !email || !password) {
    return NextResponse.json({ error: "Organisation, email, and password are required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const { data: staffRow } = await supabase
    .from("staff_profiles")
    .select("org")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!staffRow) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "This account isn't set up as staff yet. Contact your programme administrator." },
      { status: 403 }
    );
  }

  if (staffRow.org !== org) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: `This account is registered under a different organisation, not ${org}.` },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, org: staffRow.org });
}
