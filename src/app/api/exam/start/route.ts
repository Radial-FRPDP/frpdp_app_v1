import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EXAM_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Candidate enters the access code their CBT officer gave them at
 * check-in. Starting the timer server-side (expires_at) means a candidate
 * can't extend their own time by editing client state.
 */
export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { accessCode } = await req.json();
  if (!accessCode) {
    return NextResponse.json({ error: "accessCode is required" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: candidate } = await db.from("candidates").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "No candidate profile linked to this account" }, { status: 404 });
  }

  const { data: session } = await db
    .from("exam_sessions")
    .select("*")
    .eq("access_code", accessCode.trim())
    .eq("candidate_id", candidate.id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 404 });
  }

  if (session.status === "in_progress") {
    return NextResponse.json({ session });
  }
  if (session.status !== "checked_in") {
    return NextResponse.json({ error: `This session is already ${session.status}.` }, { status: 409 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXAM_DURATION_MS);

  const { data: updated, error } = await db
    .from("exam_sessions")
    .update({ status: "in_progress", started_at: now.toISOString(), expires_at: expiresAt.toISOString() })
    .eq("id", session.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: updated });
}
