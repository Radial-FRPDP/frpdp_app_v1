import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { cbtConfirmationEmail } from "@/lib/email/templates";

export const runtime = "nodejs";

/**
 * Stage 3 · Book CBT (M03).
 * Gated to candidates whose NIN is verified — NYSC may still be pending
 * the coordinator's manual review, which is allowed to lag behind without
 * blocking booking (see Executive Brief, Process Flow / Stage 3).
 */
export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slotId } = await req.json();
  if (!slotId) {
    return NextResponse.json({ error: "slotId is required" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: candidate } = await db
    .from("candidates")
    .select("id, full_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "No candidate profile linked to this account" }, { status: 404 });
  }

  const { data: profile } = await db
    .from("profiles")
    .select("nin_verification_status")
    .eq("candidate_id", candidate.id)
    .maybeSingle();

  if (profile?.nin_verification_status !== "verified") {
    return NextResponse.json(
      { error: "Your NIN must be verified before you can book a CBT slot." },
      { status: 403 }
    );
  }

  const { data: booking, error } = await db
    .rpc("book_cbt_slot", { p_candidate_id: candidate.id, p_slot_id: slotId })
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  const { data: slot } = await db.from("cbt_slots").select("starts_at, location").eq("id", slotId).maybeSingle();

  if (slot) {
    await sendEmail({
      candidateId: candidate.id,
      type: "cbt_confirmation",
      to: candidate.email,
      subject: "Your CBT slot is confirmed",
      html: cbtConfirmationEmail(candidate.full_name, slot.starts_at, slot.location),
    });
  }

  return NextResponse.json({ booking });
}
