import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { staffInviteEmail } from "@/lib/email/templates";
import { ORG_LOGIN_OPTIONS } from "@/lib/roles";
import type { StaffOrg } from "@/lib/database.types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface ProvisionInput {
  fullName: string;
  email: string;
  org: StaffOrg;
  title?: string | null;
  cbtCentreId?: string | null;
}

export type ProvisionResult = { ok: true; staffId: string } | { ok: false; error: string };

/**
 * Creates a real, working staff login: a Supabase Auth user (via the
 * admin API -- there's no candidate-style "they visit first and trigger
 * their own magic link" here, since the account doesn't exist until a
 * Programme Manager creates it) plus the matching staff_profiles row,
 * then emails an invite link so they can set their own password.
 *
 * Shared by both paths that provision a staff account: approving a
 * pending access request, and a Programme Manager adding someone
 * directly from the Users screen with no request on file.
 */
export async function provisionStaffAccount({ fullName, email, org, title, cbtCentreId }: ProvisionInput): Promise<ProvisionResult> {
  if (org !== "cbt" && cbtCentreId) {
    return { ok: false, error: "cbtCentreId is only valid for org = cbt" };
  }

  const db = createServiceRoleClient();

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: `${APP_URL}/auth/callback?next=/portal` },
  });

  if (linkError || !linkData?.user) {
    const message = linkError?.message ?? "Failed to create the account";
    return {
      ok: false,
      error: message.toLowerCase().includes("already been registered")
        ? "An account with this email already exists."
        : message,
    };
  }

  const { error: staffError } = await db.from("staff_profiles").insert({
    id: linkData.user.id,
    full_name: fullName,
    title: title || null,
    org,
    cbt_centre_id: org === "cbt" ? cbtCentreId ?? null : null,
  });

  if (staffError) {
    return { ok: false, error: staffError.message };
  }

  const orgLabel = ORG_LOGIN_OPTIONS.find((o) => o.id === org)?.label ?? org;
  await sendEmail({
    candidateId: null,
    type: "staff_invite",
    to: email,
    subject: "Your Field Readiness Programme account is ready",
    html: staffInviteEmail(fullName, linkData.properties.action_link, orgLabel),
  });

  return { ok: true, staffId: linkData.user.id };
}
