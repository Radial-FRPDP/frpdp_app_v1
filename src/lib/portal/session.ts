import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE_CONFIG, initialsOf, candidateModuleStatus, type PortalRole, type CandidateModuleStatus } from "@/lib/roles";
import type { PortalUser, PortalNotification } from "@/components/portal/PortalShell";

export interface PortalSession {
  role: PortalRole;
  user: PortalUser;
  notifications: PortalNotification[];
  candidateStatus?: Record<string, CandidateModuleStatus>;
  candidateId?: string;
  candidateNominationConfirmed?: boolean;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const NOTIFICATION_COPY: Record<string, { title: string; desc: (recipient: string) => string }> = {
  invite: { title: "Invitation sent", desc: () => "You were nominated for the FRP 2025 cohort and invited to complete your profile." },
  validation_report: { title: "Import validation ready", desc: () => "A new intake batch finished validating." },
  cbt_confirmation: { title: "CBT booking confirmed", desc: () => "Your assessment slot is confirmed." },
  cbt_reminder: { title: "CBT reminder", desc: () => "Your assessment date is coming up." },
  nysc_flagged: { title: "Document needs attention", desc: () => "Your NYSC certificate was flagged during review." },
};

/**
 * Resolves the signed-in user's portal role, display info, and real
 * notifications. Cached per-request (React cache()) so layout + page can
 * both call it without a duplicate round-trip. Returns null if there is
 * no session or the session belongs to a user with no staff/candidate
 * row (an orphaned auth account) — callers should redirect to /login.
 */
export const getPortalSession = cache(async (): Promise<PortalSession | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staffRow } = await supabase
    .from("staff_profiles")
    .select("full_name, title, org")
    .eq("id", user.id)
    .maybeSingle();

  if (staffRow) {
    const role = staffRow.org as PortalRole;
    const config = ROLE_CONFIG[role];

    let notifications: PortalNotification[] = [];
    if (role === "radial") {
      const { data: logRows } = await supabase
        .from("notifications_log")
        .select("id, type, recipient_email, status, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      notifications = (logRows ?? []).map((row) => {
        const copy = NOTIFICATION_COPY[row.type] ?? { title: row.type, desc: () => row.recipient_email };
        return {
          id: row.id,
          title: row.status === "failed" ? `${copy.title} (failed)` : copy.title,
          desc: copy.desc(row.recipient_email),
          time: timeAgo(row.created_at),
          unread: false,
        };
      });
    }

    return {
      role,
      user: {
        name: staffRow.full_name,
        title: staffRow.title || config.label,
        org: config.fullOrg,
        initials: initialsOf(staffRow.full_name),
      },
      notifications,
    };
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, full_name, status, nomination_confirmed_at")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (candidate) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("candidate_id", candidate.id)
      .eq("status", "confirmed")
      .maybeSingle();

    const { data: logRows } = await supabase
      .from("notifications_log")
      .select("id, type, status, created_at")
      .eq("candidate_id", candidate.id)
      .order("created_at", { ascending: false })
      .limit(8);

    const notifications: PortalNotification[] = (logRows ?? []).map((row) => {
      const copy = NOTIFICATION_COPY[row.type] ?? { title: row.type, desc: () => "" };
      return {
        id: row.id,
        title: copy.title,
        desc: copy.desc(""),
        time: timeAgo(row.created_at),
        unread: false,
      };
    });

    return {
      role: "candidate",
      user: {
        name: candidate.full_name,
        title: "Nominated Candidate",
        org: "FRP 2025",
        initials: initialsOf(candidate.full_name),
      },
      notifications,
      candidateStatus: candidateModuleStatus(candidate.status, !!booking, !!candidate.nomination_confirmed_at),
      candidateId: candidate.id,
      candidateNominationConfirmed: !!candidate.nomination_confirmed_at,
    };
  }

  return null;
});
