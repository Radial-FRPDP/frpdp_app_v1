import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { ageFromDob, isDuplicate, isAgeIssue, isEmailIssue } from "@/lib/candidate-classification";

/**
 * Rebuilds an UploadResponse-shaped payload for an already-imported batch
 * straight from persisted candidate rows, so the M-01 wizard (Validate /
 * Review / Summary / Dispatch) can be resumed after a logout or a fresh
 * page load instead of only being reachable right after a CSV upload.
 *
 * There's no separate "what step was the PM on" state stored anywhere --
 * intentionally so, since a Programme Manager can also edit rows directly
 * (e.g. via the Supabase dashboard) between visits, and a literal stored
 * step pointer would drift out of sync with that. Instead this derives
 * duplicates / age-ineligible / no-email / ready-to-dispatch fresh, every
 * time, from validation_issues + duplicate_of + status -- the same
 * fields /api/intake/review-action and /api/intake/dispatch already treat
 * as the source of truth.
 */
export async function GET(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: staffRow } = await authed
    .from("staff_profiles")
    .select("id")
    .eq("id", user.id)
    .eq("org", "radial")
    .maybeSingle();
  if (!staffRow) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const batchId = req.nextUrl.searchParams.get("batchId");
  if (!batchId) {
    return NextResponse.json({ error: "batchId is required" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: rows, error } = await db
    .from("candidates")
    .select("id, full_name, email, jqs_number, status, validation_issues, duplicate_of, date_of_birth, discipline, state_of_origin")
    .eq("batch_id", batchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No candidates found for this batch" }, { status: 404 });
  }

  const active = rows.filter((r) => r.status !== "rejected");

  // isAgeIssue/isEmailIssue check the live date_of_birth/email columns
  // (both are selected above), not just the validation_issues text saved
  // at upload time -- otherwise editing a candidate's email or DOB
  // directly in Supabase after upload silently goes undetected here.
  const duplicateRows = active.filter(isDuplicate);
  const ageIneligibleRows = active.filter((r) => isAgeIssue(r) && !isDuplicate(r));
  const missingEmailRows = active.filter((r) => isEmailIssue(r) && !isDuplicate(r) && !isAgeIssue(r));
  const readyRows = active.filter((r) => r.status === "pending_review" && !r.duplicate_of && (r.validation_issues ?? []).length === 0);
  const invitedOrBeyond = active.filter((r) => r.status !== "pending_review");

  const unresolvedReview = duplicateRows.length + ageIneligibleRows.length + missingEmailRows.length;
  // Once a batch has nothing left to review and nothing left ready to
  // dispatch, it's fully processed -- nothing for the wizard to resume.
  const stage: "review" | "summary" | "done" = unresolvedReview > 0 ? "review" : readyRows.length > 0 ? "summary" : "done";

  return NextResponse.json({
    stage,
    batchId,
    totalRows: rows.length,
    readyCount: readyRows.length,
    duplicateCount: duplicateRows.length,
    ageIneligibleCount: ageIneligibleRows.length,
    missingEmailCount: missingEmailRows.length,
    invitedCount: invitedOrBeyond.length,
    duplicates: duplicateRows.slice(0, 20).map((r) => ({
      id: r.id,
      jqsNumber: r.jqs_number,
      name: r.full_name,
      reason: (r.validation_issues ?? []).join("; ") || "Matches an existing candidate record",
    })),
    ageIneligible: ageIneligibleRows.slice(0, 20).map((r) => ({
      id: r.id,
      jqsNumber: r.jqs_number,
      name: r.full_name,
      dob: r.date_of_birth,
      age: ageFromDob(r.date_of_birth),
      discipline: r.discipline,
    })),
    missingEmail: missingEmailRows.slice(0, 20).map((r) => ({
      id: r.id,
      jqsNumber: r.jqs_number,
      name: r.full_name,
      state: r.state_of_origin,
    })),
    preview: rows.slice(0, 10).map((r) => ({
      jqsNumber: r.jqs_number,
      name: r.full_name,
      email: r.email,
      status: r.duplicate_of || isDuplicate(r) ? "duplicate" : isAgeIssue(r) ? "age_flag" : isEmailIssue(r) ? "no_email" : "ready",
    })),
  });
}
