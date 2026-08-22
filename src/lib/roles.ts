import type { StaffOrg } from "@/lib/database.types";

/**
 * Role/portal configuration — matches the brand system and module map from
 * the product design team's Figma export (data/stakeholders.ts) exactly.
 * Unlike the Figma demo, `user` display info is NOT hardcoded here: it is
 * read from staff_profiles / candidates for whoever is actually signed in.
 */

export type PortalRole = StaffOrg | "candidate";

export const MODULE_LIST = [
  { code: "M-01", title: "Intake", subtitle: "Nomination & CSV Import", icon: "⬇" },
  { code: "M-02", title: "Profile", subtitle: "Candidate Verification", icon: "👤" },
  { code: "M-03", title: "Book CBT", subtitle: "Assessment Scheduling", icon: "📅" },
  { code: "M-04", title: "Assess", subtitle: "Computer-Based Test", icon: "🖥" },
  { code: "M-05", title: "Select", subtitle: "Scoring & Quotas", icon: "⭐" },
  { code: "M-06", title: "Medical", subtitle: "Health Clearance", icon: "🏥" },
  { code: "M-07", title: "Onboard", subtitle: "Offers & Contracts", icon: "📋" },
  { code: "M-08", title: "Training", subtitle: "3-Month Residential", icon: "🎓" },
  { code: "M-09", title: "OJT", subtitle: "On-the-Job Training", icon: "🏗" },
] as const;

export type ModuleCode = (typeof MODULE_LIST)[number]["code"];

interface RoleConfig {
  label: string;
  fullOrg: string;
  sidebarBg: string;
  accentColor: string;
  tagColor: string;
  modules: ModuleCode[];
}

export const ROLE_CONFIG: Record<PortalRole, RoleConfig> = {
  radial: {
    label: "Radial Circle",
    fullOrg: "Programme Manager — Radial Circle",
    sidebarBg: "#0D1F0E",
    accentColor: "#058812",
    tagColor: "#FBBD15",
    modules: ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "M-07", "M-08", "M-09"],
  },
  ncdmb: {
    label: "NCDMB",
    fullOrg: "Nigerian Content Development and Monitoring Board",
    sidebarBg: "#0D1A2E",
    accentColor: "#1B4F8A",
    tagColor: "#FBBD15",
    modules: ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "M-09"],
  },
  renaissance: {
    label: "Renaissance",
    fullOrg: "Renaissance Africa Energy Company Limited",
    sidebarBg: "#0A1A0B",
    accentColor: "#058812",
    tagColor: "#FBBD15",
    modules: ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "M-07", "M-08", "M-09"],
  },
  cbt: {
    label: "CBT Officer",
    fullOrg: "Accredited Assessment Centre",
    sidebarBg: "#1A1A1A",
    accentColor: "#646464",
    tagColor: "#969696",
    modules: ["M-03", "M-04"],
  },
  candidate: {
    label: "Candidate",
    fullOrg: "Field Readiness Programme — 2025 Cohort",
    sidebarBg: "#0D1F0E",
    accentColor: "#058812",
    tagColor: "#FBBD15",
    modules: ["M-01", "M-02", "M-03", "M-04", "M-05", "M-06", "M-07", "M-08", "M-09"],
  },
};

export const ORG_LOGIN_OPTIONS: { id: StaffOrg; label: string; desc: string }[] = [
  { id: "radial", label: "Radial Circle", desc: "Programme Manager" },
  { id: "ncdmb", label: "NCDMB", desc: "Programme Oversight" },
  { id: "renaissance", label: "Renaissance", desc: "Industry Partner" },
  { id: "cbt", label: "CBT Officer", desc: "Assessment Centre" },
];

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type CandidateModuleStatus = "done" | "current" | "next" | "locked";

/** Real progress derivation — replaces the Figma demo's hardcoded map. */
export function candidateModuleStatus(
  candidateStatus: string,
  hasConfirmedBooking: boolean
): Record<string, CandidateModuleStatus> {
  const profileDone = candidateStatus === "profile_complete" || candidateStatus === "verified";
  const profileStarted = candidateStatus === "profile_in_progress";

  const m02: CandidateModuleStatus = profileDone ? "done" : "current";
  const m03: CandidateModuleStatus = !profileDone ? "locked" : hasConfirmedBooking ? "done" : "current";
  const m04: CandidateModuleStatus = hasConfirmedBooking ? "current" : "locked";

  return {
    "M-01": "done",
    "M-02": profileStarted || !profileDone ? "current" : m02,
    "M-03": m03,
    "M-04": m04,
    "M-05": "locked",
    "M-06": "locked",
    "M-07": "locked",
    "M-08": "locked",
    "M-09": "locked",
  };
}
