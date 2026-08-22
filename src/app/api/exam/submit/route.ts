import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { SubjectScore } from "@/lib/database.types";

export const runtime = "nodejs";

const SUBJECT_PASS_THRESHOLD_PCT = 40;
const OVERALL_PASS_THRESHOLD_PCT = 50;

/**
 * Grades the exam server-side (the answer key never left the server) and
 * writes the one exam_results row this candidate is allowed to have.
 * Called either by the candidate clicking Submit, or by the client-side
 * timer hitting zero — either way this endpoint is the only place
 * scoring happens.
 */
export async function POST(_req: NextRequest) {
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
    .in("status", ["in_progress", "expired"])
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "No exam to submit." }, { status: 409 });
  }

  const [{ data: answers }, { data: questions }] = await Promise.all([
    db.from("exam_answers").select("question_id, selected_choice_id").eq("session_id", session.id),
    db.from("exam_questions").select("id, subject, correct_choice_id, points"),
  ]);

  const answerMap = new Map((answers ?? []).map((a) => [a.question_id, a.selected_choice_id]));
  const bySubject = new Map<string, { score: number; maxScore: number }>();

  for (const q of questions ?? []) {
    const entry = bySubject.get(q.subject) ?? { score: 0, maxScore: 0 };
    entry.maxScore += q.points;
    const selected = answerMap.get(q.id);
    const isCorrect = selected != null && selected === q.correct_choice_id;
    if (isCorrect) entry.score += q.points;
    bySubject.set(q.subject, entry);

    if (selected != null) {
      await db.from("exam_answers").update({ is_correct: isCorrect }).eq("session_id", session.id).eq("question_id", q.id);
    }
  }

  const subjectScores: SubjectScore[] = Array.from(bySubject.entries()).map(([subject, { score, maxScore }]) => ({ subject, score, maxScore }));
  const totalScore = subjectScores.reduce((sum, s) => sum + s.score, 0);
  const maxScore = subjectScores.reduce((sum, s) => sum + s.maxScore, 0);

  const allSubjectsPass = subjectScores.every((s) => s.maxScore === 0 || (s.score / s.maxScore) * 100 >= SUBJECT_PASS_THRESHOLD_PCT);
  const overallPass = maxScore > 0 && (totalScore / maxScore) * 100 >= OVERALL_PASS_THRESHOLD_PCT;
  const passed = allSubjectsPass && overallPass;

  const { error: resultError } = await db.from("exam_results").upsert(
    {
      candidate_id: candidate.id,
      session_id: session.id,
      subject_scores: subjectScores,
      total_score: totalScore,
      max_score: maxScore,
      passed,
      entry_method: "auto",
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "candidate_id" }
  );

  if (resultError) {
    return NextResponse.json({ error: resultError.message }, { status: 500 });
  }

  await db.from("exam_sessions").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", session.id);

  return NextResponse.json({ subjectScores, totalScore, maxScore, passed });
}
