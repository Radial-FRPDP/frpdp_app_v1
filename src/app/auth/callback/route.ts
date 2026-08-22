import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Magic-link landing point for both admins and candidates. Exchanges the
 * OTP code for a session, then — if this login came from an invite link —
 * links the newly authenticated user to their candidate row.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite_token");
  const next = searchParams.get("next") ?? "/portal";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  if (inviteToken) {
    const db = createServiceRoleClient();
    const { data: candidate } = await db
      .from("candidates")
      .select("id, email, auth_user_id, status")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (candidate && candidate.email.toLowerCase() === data.user.email?.toLowerCase()) {
      const isFirstActivation = !candidate.auth_user_id;
      if (isFirstActivation) {
        await db
          .from("candidates")
          .update({
            auth_user_id: data.user.id,
            status: candidate.status === "invited" ? "profile_in_progress" : candidate.status,
          })
          .eq("id", candidate.id);

        // Ensure a profile row exists so later updates are simple upserts.
        await db.from("profiles").upsert({ candidate_id: candidate.id }, { onConflict: "candidate_id" });
      }
      // First activation: the candidate arrived via a magic link and has no
      // password yet. Every future sign-in uses JQS Number + password, so
      // send them to set one now before they ever reach the portal.
      return NextResponse.redirect(
        isFirstActivation ? `${origin}/auth/set-password?next=/portal` : `${origin}/portal`
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
