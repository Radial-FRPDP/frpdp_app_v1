-- ---------------------------------------------------------------------
-- Manual-review audit trail for NIN and BVN, matching the pattern
-- nysc_reviewed_by/nysc_reviewed_at/nysc_review_note already established
-- in 0001_init.sql for NYSC.
--
-- Context: live NIN (Dojah) and BVN (Paystack) verification both require
-- provider approvals that aren't in place yet, so for the first batch
-- candidates self-report + upload supporting documents, and Radial Circle
-- verifies NIN/BVN by hand (the same way NYSC has always worked) via the
-- Verification Queue. These columns record who made that call and when,
-- not just the resulting status.
-- ---------------------------------------------------------------------

alter table profiles
  add column if not exists nin_reviewed_by uuid references staff_profiles(id),
  add column if not exists nin_reviewed_at timestamptz,
  add column if not exists nin_review_note text,
  add column if not exists bvn_reviewed_by uuid references staff_profiles(id),
  add column if not exists bvn_reviewed_at timestamptz,
  add column if not exists bvn_review_note text;
