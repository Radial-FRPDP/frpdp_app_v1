import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getNinProvider } from "@/lib/verification";

export const runtime = "nodejs";

/**
 * Stage 2 · Profile (M02) — real-time NIN check.
 * The candidate is derived from their session, never trusted from the
 * request body, so no one can verify a NIN against someone else's profile.
 */
export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { nin, fullName, dateOfBirth } = await req.json();
  if (!nin || typeof nin !== "string" || nin.trim().length < 10) {
    return NextResponse.json({ error: "A valid NIN is required" }, { status: 400 });
  }
  if (!fullName || !dateOfBirth) {
    return NextResponse.json({ error: "Full name and date of birth are required" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: candidate } = await db
    .from("candidates")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "No candidate profile linked to this account" }, { status: 404 });
  }

  await db
    .from("profiles")
    .update({ nin: nin.trim(), nin_verification_status: "pending" })
    .eq("candidate_id", candidate.id);

  // getNinProvider() throws synchronously if DOJAH_APP_ID/DOJAH_SECRET_KEY
  // aren't set (a real state right now — those accounts don't exist yet).
  // Treat "not configured" the same as a provider hiccup: don't 500 on the
  // candidate, leave them at "pending" for Radial Circle to review by hand.
  let result: Awaited<ReturnType<ReturnType<typeof getNinProvider>["verifyNin"]>>;
  let providerName = "unconfigured";
  try {
    const provider = getNinProvider();
    providerName = provider.name;
    result = await provider.verifyNin({ nin: nin.trim(), fullName, dateOfBirth });
  } catch (err) {
    result = {
      status: "error",
      matched: false,
      providerReference: null,
      raw: {},
      errorMessage: err instanceof Error ? err.message : "Verification provider is not configured",
    };
  }

  const nextStatus = result.status === "verified" ? "verified" : result.status === "failed" ? "failed" : "pending";

  await db
    .from("profiles")
    .update({
      nin_verification_status: nextStatus,
      nin_verification_payload: { provider: providerName, ...result.raw, matched: result.matched },
    })
    .eq("candidate_id", candidate.id);

  if (result.status === "error") {
    // Provider not configured, or a hiccup either way — don't block the
    // candidate. Their NIN stays "pending" for Radial Circle to check by
    // hand in the Verification Queue.
    return NextResponse.json(
      { status: "pending", message: "Automatic verification isn't available right now — Radial Circle will verify this by hand." },
      { status: 202 }
    );
  }

  return NextResponse.json({ status: result.status, matched: result.matched });
}
