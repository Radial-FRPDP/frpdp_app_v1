import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { parseCsv, parseXlsx, isXlsxFile, type ParsedRow } from "@/lib/validation/intakeParser";
import { sendEmail } from "@/lib/email/resend";
import { validationReportEmail } from "@/lib/email/templates";

export const runtime = "nodejs";

/**
 * Stage 1 · Intake (M01), Radial Circle only.
 *
 * Parses + validates + de-dupes the NCDMB nomination CSV/XLSX (against
 * both the rest of the file and every candidate already in the database),
 * and persists every row — issue or not. Nothing is invited yet: rows
 * that pass cleanly are held as `pending_review` with no validation
 * issues ("ready to invite") until a Programme Manager reviews the queues
 * and explicitly dispatches from POST /api/intake/dispatch. This mirrors
 * the Figma design's 5-step workflow (Upload → Validate → Review →
 * Summary → Dispatch) instead of auto-inviting on upload.
 */
export async function POST(req: NextRequest) {
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

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const parsed = isXlsxFile(file.name) ? await parseXlsx(await file.arrayBuffer()) : await parseCsv(await file.text());

  if (parsed.totalRows === 0) {
    return NextResponse.json({ error: "The file has no data rows" }, { status: 400 });
  }

  const db = createServiceRoleClient();

  // Cross-check against everything already in the database — a
  // within-file duplicate isn't the only kind that matters, and this is
  // also how a re-nomination from an earlier cohort gets caught.
  const emails = parsed.rows.map((r) => r.email).filter(Boolean);
  const jqsNumbers = parsed.rows.map((r) => r.jqsNumber).filter(Boolean);
  const [{ data: existingByEmail }, { data: existingByJqs }] = await Promise.all([
    db.from("candidates").select("id, email").in("email", emails.length ? emails : ["__none__"]),
    db.from("candidates").select("id, jqs_number").in("jqs_number", jqsNumbers.length ? jqsNumbers : ["__none__"]),
  ]);
  const existingEmailToId = new Map((existingByEmail ?? []).map((c) => [c.email.toLowerCase(), c.id]));
  const existingJqsToId = new Map((existingByJqs ?? []).map((c) => [c.jqs_number as string, c.id]));

  let dbDuplicateOf: string | null;
  for (const row of parsed.rows) {
    dbDuplicateOf = null;
    if (row.jqsNumber && existingJqsToId.has(row.jqsNumber)) {
      dbDuplicateOf = existingJqsToId.get(row.jqsNumber)!;
    } else if (row.email && existingEmailToId.has(row.email)) {
      dbDuplicateOf = existingEmailToId.get(row.email)!;
    }
    if (dbDuplicateOf) {
      row.isDuplicate = true;
      row.problems.push("already exists in a previous batch");
      (row as ParsedRow & { _dbDuplicateOf?: string })._dbDuplicateOf = dbDuplicateOf;
    }
  }

  const readyRows = parsed.rows.filter((r) => r.problems.length === 0);
  const duplicateRows = parsed.rows.filter((r) => r.isDuplicate);
  const ageIneligibleRows = parsed.rows.filter((r) => r.isAgeIneligible && !r.isDuplicate);
  const missingEmailRows = parsed.rows.filter((r) => r.isMissingEmail && !r.isDuplicate && !r.isAgeIneligible);

  const { data: batch, error: batchError } = await db
    .from("batches")
    .insert({
      uploaded_by: staffRow.id,
      filename: file.name,
      total_rows: parsed.totalRows,
      valid_rows: readyRows.length,
      issue_rows: parsed.totalRows - readyRows.length,
    })
    .select()
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message ?? "Failed to create batch" }, { status: 500 });
  }

  const { data: inserted, error: insertError } = await db
    .from("candidates")
    .insert(
      parsed.rows.map((r) => ({
        batch_id: batch.id,
        full_name: r.fullName || "(missing name)",
        email: r.email || `unknown-row-${r.rowNumber}@no-email.invalid`,
        phone: r.phone || null,
        jqs_number: r.jqsNumber || null,
        source_row: r.raw,
        duplicate_of: (r as ParsedRow & { _dbDuplicateOf?: string })._dbDuplicateOf ?? null,
        validation_issues: r.problems,
        status: "pending_review" as const,
      }))
    )
    .select("id, full_name, email, jqs_number, validation_issues, duplicate_of");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Postgres preserves row order for a single multi-row INSERT ... RETURNING,
  // so the i-th inserted row corresponds to the i-th parsed row.
  const insertedWithMeta = (inserted ?? []).map((c, i) => ({ id: c.id, row: parsed.rows[i] }));

  const coordinatorEmail = process.env.PROGRAM_COORDINATOR_EMAIL;
  if (coordinatorEmail) {
    await sendEmail({
      candidateId: null,
      type: "validation_report",
      to: coordinatorEmail,
      subject:
        parsed.totalRows - readyRows.length > 0
          ? `Intake: ${parsed.totalRows - readyRows.length} record(s) need attention — ${file.name}`
          : `Intake: all ${parsed.totalRows} records passed — ${file.name}`,
      html: validationReportEmail(
        file.name,
        parsed.totalRows,
        readyRows.length,
        parsed.rows.filter((r) => r.problems.length > 0).map((r) => ({ row: r.rowNumber, name: r.fullName || "(missing name)", problems: r.problems }))
      ),
    });
  }

  const duplicateEntries = insertedWithMeta.filter((c) => c.row.isDuplicate);
  const ageIneligibleEntries = insertedWithMeta.filter((c) => c.row.isAgeIneligible && !c.row.isDuplicate);
  const missingEmailEntries = insertedWithMeta.filter((c) => c.row.isMissingEmail && !c.row.isDuplicate && !c.row.isAgeIneligible);

  return NextResponse.json({
    batchId: batch.id,
    totalRows: parsed.totalRows,
    readyCount: readyRows.length,
    duplicateCount: duplicateRows.length,
    ageIneligibleCount: ageIneligibleRows.length,
    missingEmailCount: missingEmailRows.length,
    duplicates: duplicateEntries.slice(0, 20).map((c) => ({ id: c.id, jqsNumber: c.row.jqsNumber, name: c.row.fullName, reason: c.row.problems.join("; ") })),
    ageIneligible: ageIneligibleEntries
      .slice(0, 20)
      .map((c) => ({ id: c.id, jqsNumber: c.row.jqsNumber, name: c.row.fullName, dob: c.row.dateOfBirth, age: c.row.age, discipline: c.row.discipline })),
    missingEmail: missingEmailEntries.slice(0, 20).map((c) => ({ id: c.id, jqsNumber: c.row.jqsNumber, name: c.row.fullName, state: c.row.stateOfOrigin })),
    preview: (inserted ?? []).slice(0, 10).map((c) => ({
      jqsNumber: c.jqs_number,
      name: c.full_name,
      email: c.email,
      status: c.duplicate_of ? "duplicate" : c.validation_issues.length > 0 ? (c.validation_issues.some((p: string) => p.includes("age")) ? "age_flag" : "no_email") : "ready",
    })),
  });
}
