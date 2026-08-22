import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Rehydrates the candidate's in-progress exam on page load/refresh:
 * session state, remaining questions (answer key stripped), and their
 * answers so far. Auto-expires a session whose timer has run out instead
 * of trusting the client to notice.
 */
export async function GET(_req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = createServiceRoleClient();
  const { data: candidate } = await db.from("candidates").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "No candidate profile linked to this account" }, { status: 404 });
  }

  const { data: session } = await db
    .from("exam_sessions")
    .select("*")
    .eq("candidate_id", candidate.id)
    .in("status", ["checked_in", "in_progress", "submitted"])
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ session: null });
  }

  if (session.status === "in_progress" && session.expires_at && new Date(session.expires_at) < new Date()) {
    await db.from("exam_sessions").update({ status: "expired" }).eq("id", session.id);
    return NextResponse.json({ session: { ...session, status: "expired" }, questions: [], answers: [] });
  }

  if (session.status !== "in_progress") {
    const { data: result } = await db.from("exam_results").select("*").eq("candidate_id", candidate.id).maybeSingle();
    return NextResponse.json({ session, questions: [], answers: [], result: result ?? null });
  }

  const [{ data: questions }, { data: answers }] = await Promise.all([
    db.from("exam_questions").select("id, subject, prompt, choices, points").order("subject"),
    db.from("exam_answers").select("question_id, selected_choice_id").eq("session_id", session.id),
  ]);

  return NextResponse.json({ session, questions: questions ?? [], answers: answers ?? [], result: null });
}
