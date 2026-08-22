import { Resend } from "resend";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/database.types";

let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set.");
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

interface SendArgs {
  candidateId: string | null;
  type: NotificationType;
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends a transactional email and logs the outcome to notifications_log —
 * every automated email in Batch 1 goes through this one function so the
 * audit trail (Section: Data protection note) stays complete even when a
 * send fails.
 */
export async function sendEmail({ candidateId, type, to, subject, html }: SendArgs) {
  const db = createServiceRoleClient();

  try {
    const { data, error } = await getResend().emails.send({
      from: process.env.EMAIL_FROM ?? "Batch 1 Screening <noreply@example.com>",
      to,
      subject,
      html,
    });

    if (error) throw new Error(error.message);

    await db.from("notifications_log").insert({
      candidate_id: candidateId,
      type,
      recipient_email: to,
      status: "sent",
      provider_message_id: data?.id ?? null,
    });

    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    await db.from("notifications_log").insert({
      candidate_id: candidateId,
      type,
      recipient_email: to,
      status: "failed",
      error_message: message,
    });
    return { ok: false as const, error: message };
  }
}
