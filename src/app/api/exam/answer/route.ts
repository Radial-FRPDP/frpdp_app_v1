import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Saves one answer as the candidate progresses — no grading here, that only happens at submit. */
export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { questionId, selectedChoiceId } = await req.json();
  if (!questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: candidate } = await db.from("candidates").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "No candidate profile linked to this account" }, { status: 404 });
  }

  const { data: session } = await db
    .from("exam_sessions")
    .select("id, status, expires_at")
    .eq("candidate_id", candidate.id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "No exam in progress." }, { status: 409 });
  }
  if (session.expires_at && new Date(session.expires_at) < new Date()) {
    await db.from("exam_sessions").update({ status: "expired" }).eq("id", session.id);
    return NextResponse.json({ error: "Your exam time has expired." }, { status: 409 });
  }

  const { error } = await db
    .from("exam_answers")
    .upsert({ session_id: session.id, question_id: questionId, selected_choice_id: selectedChoiceId || null }, { onConflict: "session_id,question_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
