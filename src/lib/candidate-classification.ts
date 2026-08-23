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

interface ClassifiableRow {
  duplicate_of: string | null;
  validation_issues: string[] | null;
  status: string;
}

export function isDuplicate(r: ClassifiableRow): boolean {
  return !!r.duplicate_of || (r.validation_issues ?? []).some((p) => p.toLowerCase().includes("duplicate"));
}

export function isAgeIssue(r: ClassifiableRow): boolean {
  return (r.validation_issues ?? []).some((p) => p.toLowerCase().includes("age-ineligible"));
}

export function isEmailIssue(r: ClassifiableRow): boolean {
  return (r.validation_issues ?? []).some((p) => p.toLowerCase().includes("missing email") || p.toLowerCase().includes("invalid email"));
}

export function isReady(r: ClassifiableRow): boolean {
  return r.status === "pending_review" && !isDuplicate(r) && !isAgeIssue(r) && !isEmailIssue(r);
}
