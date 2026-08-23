-- ---------------------------------------------------------------------
-- Result-letter PDF (candidate M-04) -- see design-reference-gap-
-- analysis.md Section 3.6: "downloadable PDF result letter, gated on
-- PM approval". There's nowhere today to record that a Programme
-- Manager has actually signed off on a given result before the
-- candidate can download anything.
--
-- Deliberately no new table/bucket: the letter is generated on demand
-- from exam_results + candidates data (see /api/results/letter) rather
-- than pre-rendered and stored, so all this needs is a gate.
-- ---------------------------------------------------------------------

alter table exam_results
  add column if not exists result_approved_at timestamptz,
  add column if not exists result_approved_by uuid references staff_profiles(id);

comment on column exam_results.result_approved_at is
  'Set by Radial Circle on the M-04 Results tab. The candidate result-letter download (GET /api/results/letter) refuses to generate anything until this is set -- an unapproved result is not final.';
