import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { getBvnProvider } from "@/lib/verification/bvnProvider";

export const runtime = "nodejs";

/**
 * Stage 2 · Profile (M02) — BVN check via Paystack. Same shape as
 * /api/verify/nin: candidate identity comes from the session, never the
 * request body. Only a name match + last-4-of-account are ever persisted
 * (see profiles.bvn_verification_status / bank_account_last4 in
 * 0004_multi_role.sql) — the full BVN itself is stored because Paystack's
 * resolve call requires it, but it is never re-displayed in the UI.
 */
export async function POST(req: NextRequest) {
  const authed = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { bvn, fullName } = await req.json();
  if (!bvn || typeof bvn !== "string" || bvn.trim().length !== 11) {
    return NextResponse.json({ error: "A valid 11-digit BVN is required" }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  const db = createServiceRoleClient();
  const { data: candidate } = await db.from("candidates").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "No candidate profile linked to this account" }, { status: 404 });
  }

  await db.from("profiles").update({ bvn: bvn.trim(), bvn_verification_status: "pending" }).eq("candidate_id", candidate.id);

  // getBvnProvider() throws synchronously if PAYSTACK_SECRET_KEY isn't set
  // (true right now — Paystack's BVN-lookup access hasn't been approved
  // yet). Don't 500 on the candidate for that — leave them at "pending"
  // for Radial Circle to review by hand.
  let result: Awaited<ReturnType<ReturnType<typeof getBvnProvider>["verifyBvn"]>>;
  try {
    const provider = getBvnProvider();
    result = await provider.verifyBvn({ bvn: bvn.trim(), fullName });
  } catch (err) {
    result = {
      status: "error",
      matched: false,
      accountName: null,
      bankAccountLast4: null,
      bankName: null,
      providerReference: null,
      raw: {},
      errorMessage: err instanceof Error ? err.message : "Verification provider is not configured",
    };
  }

  const nextStatus = result.status === "verified" ? "verified" : result.status === "failed" ? "failed" : "pending";

  await db
    .from("profiles")
    .update({
      bvn_verification_status: nextStatus,
      bvn_verification_reference: result.providerReference,
      bank_account_name: result.accountName,
    })
    .eq("candidate_id", candidate.id);

  if (result.status === "error") {
    // Provider not configured, or a hiccup either way — don't block the
    // candidate. Their BVN stays "pending" for Radial Circle to check by
    // hand in the Verification Queue.
    return NextResponse.json(
      { status: "pending", message: "Automatic verification isn't available right now — Radial Circle will verify this by hand." },
      { status: 202 }
    );
  }

  return NextResponse.json({ status: result.status, matched: result.matched, accountName: result.accountName });
}
