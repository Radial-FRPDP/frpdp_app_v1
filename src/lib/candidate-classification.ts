/**
 * Shared classification helpers for turning a candidate row's persisted
 * validation_issues / duplicate_of / status into the same duplicate /
 * age-ineligible / missing-email / ready buckets used across the M-01
 * wizard, the batch-status resume endpoint, and the NCDMB oversight
 * dashboard. Keeping this in one place avoids the three call sites
 * drifting out of sync on what counts as "a duplicate" etc.
 */

const MAX_AGE = 30;

export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age;
}

export { MAX_AGE };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * candidates.email is NOT NULL + UNIQUE, so a row with no real email
 * can't just store '' or null (see the upload route's insert -- and see
 * the "candidates_email_idx" unique-constraint error you get trying to
 * force it via direct SQL). Instead the app substitutes a synthesized,
 * guaranteed-unique placeholder at upload time: unknown-row-N@no-email
 * .invalid. M01Intake.tsx already special-cases this domain for display
 * ("— missing —"); isEmailIssue below needs to recognize the exact same
 * convention or a placeholder row looks like "has a valid email" to it.
 */
const NO_EMAIL_DOMAIN = "no-email.invalid";

interface ClassifiableRow {
  duplicate_of: string | null;
  validation_issues: string[] | null;
  status: string;
  /**
   * Optional -- only present when the caller's select() included these
   * live columns. When present, they are the source of truth and win
   * over validation_issues. That matters because validation_issues is a
   * one-time snapshot written at CSV-upload time: if a candidate's email
   * or date of birth is later edited directly in Supabase (outside the
   * app entirely, e.g. via Table Editor), the stored text never gets
   * re-checked and silently goes stale -- "Missing Email: 0" while half
   * the list actually has a blank email column is exactly that failure
   * mode. Falling back to the text when the column wasn't selected keeps
   * every existing caller's behavior unchanged.
   */
  email?: string | null;
  date_of_birth?: string | null;
}

export function isDuplicate(r: ClassifiableRow): boolean {
  return !!r.duplicate_of || (r.validation_issues ?? []).some((p) => p.toLowerCase().includes("duplicate"));
}

export function isAgeIssue(r: ClassifiableRow): boolean {
  if (r.date_of_birth !== undefined) {
    const age = ageFromDob(r.date_of_birth);
    return age !== null && age > MAX_AGE;
  }
  return (r.validation_issues ?? []).some((p) => p.toLowerCase().includes("age-ineligible"));
}

export function isEmailIssue(r: ClassifiableRow): boolean {
  if (r.email !== undefined) {
    return !r.email || !EMAIL_RE.test(r.email) || r.email.toLowerCase().endsWith(NO_EMAIL_DOMAIN);
  }
  return (r.validation_issues ?? []).some((p) => p.toLowerCase().includes("missing email") || p.toLowerCase().includes("invalid email"));
}

export function isReady(r: ClassifiableRow): boolean {
  return r.status === "pending_review" && !isDuplicate(r) && !isAgeIssue(r) && !isEmailIssue(r);
}
