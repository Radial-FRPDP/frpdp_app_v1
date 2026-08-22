import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function generateAccessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

/**
 * M-04 physical check-in, performed by a CBT officer. Confirms the
 * candidate's JQS+NIN in person (front-desk process — this endpoint just
 * records that it happened and who by), then issues a one-time access
 * code the officer hands the candidate to start their exam on the
 * assigned workstation. See 0006_assessment.sql for why this replaces
 * the "MAC-address handshake" described in the original brief.
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
  if (!staffRow || staffRow.org !== "cbt" || !staffRow.cbt_centre_id) {
    return NextResponse.json({ error: "Only a CBT officer assigned to a centre can check in candidates." }, { status: 403 });
  }

  const { candidateId, workstationLabel } = await req.json();
  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: booking } = await db
    .from("bookings")
    .select("id, slot_id, cbt_slots(cbt_centre_id)")
    .eq("candidate_id", candidateId)
    .eq("status", "confirmed")
    .maybeSingle();

  const bookingCentreId = (booking as unknown as { cbt_slots: { cbt_centre_id: string } | null } | null)?.cbt_slots?.cbt_centre_id;

  if (!booking || bookingCentreId !== staffRow.cbt_centre_id) {
    return NextResponse.json({ error: "This candidate doesn't have a confirmed booking at your centre." }, { status: 403 });
  }

  const { data: existing } = await db.from("exam_sessions").select("id, status, access_code").eq("booking_id", booking.id).maybeSingle();
  if (existing) {
    return NextResponse.json({ session: existing, alreadyCheckedIn: true });
  }

  const { data: session, error } = await db
    .from("exam_sessions")
    .insert({
      booking_id: booking.id,
      candidate_id: candidateId,
      cbt_centre_id: staffRow.cbt_centre_id,
      workstation_label: workstationLabel || null,
      access_code: generateAccessCode(),
      checked_in_by: staffRow.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session, alreadyCheckedIn: false });
}
