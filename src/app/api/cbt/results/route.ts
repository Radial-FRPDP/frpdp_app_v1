import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { SubjectScore } from "@/lib/database.types";

export const runtime = "nodejs";

const SUBJECT_PASS_THRESHOLD_PCT = 40;
const OVERALL_PASS_THRESHOLD_PCT = 50;

/**
 * Manual results entry by a CBT officer — used until a live question bank
 * exists for auto-grading (see /api/exam/submit), or for a paper-based
 * session that needs its scores recorded.
 */
export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: staffRow } = await authed.from("staff_profiles").select("id, org, cbt_centre_id").eq("id", user.id).maybeSingle();
  if (!staffRow || staffRow.org !== "cbt") {
    return NextResponse.json({ error: "Only a CBT officer can submit results." }, { status: 403 });
  }

  const { candidateId, subjectScores } = (await req.json()) as { candidateId?: string; subjectScores?: SubjectScore[] };
  if (!candidateId || !Array.isArray(subjectScores) || subjectScores.length === 0) {
    return NextResponse.json({ error: "candidateId and subjectScores are required" }, { status: 400 });
  }

  const db = createServiceRoleClient();

  // Confirm this candidate actually has a session at this officer's centre.
  const { data: session } = await db
    .from("exam_sessions")
    .select("id, cbt_centre_id")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (!session || session.cbt_centre_id !== staffRow.cbt_centre_id) {
    return NextResponse.json({ error: "This candidate doesn't have a session at your centre." }, { status: 403 });
  }

  const totalScore = subjectScores.reduce((sum, s) => sum + s.score, 0);
  const maxScore = subjectScores.reduce((sum, s) => sum + s.maxScore, 0);
  const allSubjectsPass = subjectScores.every((s) => s.maxScore === 0 || (s.score / s.maxScore) * 100 >= SUBJECT_PASS_THRESHOLD_PCT);
  const overallPass = maxScore > 0 && (totalScore / maxScore) * 100 >= OVERALL_PASS_THRESHOLD_PCT;
  const passed = allSubjectsPass && overallPass;

  const { error } = await db.from("exam_results").upsert(
    {
      candidate_id: candidateId,
      session_id: session.id,
      subject_scores: subjectScores,
      total_score: totalScore,
      max_score: maxScore,
      passed,
      entry_method: "manual",
      submitted_by: staffRow.id,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "candidate_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("exam_sessions").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", session.id);

  return NextResponse.json({ ok: true, totalScore, maxScore, passed });
}
