-- ---------------------------------------------------------------------
-- Fix: deleting a candidate row fails with a foreign-key violation from
-- notifications_log ("Key (id)=(...) is still referenced from table
-- notifications_log"), surfaced when a Programme Manager tried to delete
-- a bad-data candidate (e.g. wrong email) from the new Candidate List.
--
-- Every other candidate_id foreign key in the schema already cascades on
-- delete (documents, profiles, bookings, booking_exceptions) -- these
-- three were missed, most likely because notifications_log/exam_sessions/
-- exam_results were added in later migrations without carrying the same
-- convention forward. This brings them in line: deleting a candidate now
-- also removes their notification-send history and any exam session/
-- result rows tied to them, instead of blocking the delete.
--
-- Safe to run any time -- this only changes constraint behavior, it does
-- not touch existing data. Constraint names below are Postgres's default
-- auto-generated names ("<table>_<column>_fkey"), which is what the
-- error message itself already confirmed for notifications_log.
-- ---------------------------------------------------------------------

alter table notifications_log
  drop constraint notifications_log_candidate_id_fkey,
  add constraint notifications_log_candidate_id_fkey
    foreign key (candidate_id) references candidates(id) on delete cascade;

alter table exam_sessions
  drop constraint exam_sessions_candidate_id_fkey,
  add constraint exam_sessions_candidate_id_fkey
    foreign key (candidate_id) references candidates(id) on delete cascade;

alter table exam_results
  drop constraint exam_results_candidate_id_fkey,
  add constraint exam_results_candidate_id_fkey
    foreign key (candidate_id) references candidates(id) on delete cascade;
