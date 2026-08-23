-- ---------------------------------------------------------------------
-- Adds "message" to notifications_log.type's check constraint -- the
-- Message Centre (0012) was deliberately shipped without an email
-- notification (see 0012's own comment: "Resend isn't wired up to notify
-- on a new message yet"). Now that Resend is being configured for
-- go-live, this lets the new /api/messages/send route log a "message"
-- notification the same way every other automated email already does.
--
-- Safe to run any time -- same drop/add pattern 0010 already used for
-- this exact constraint.
-- ---------------------------------------------------------------------

alter table notifications_log drop constraint if exists notifications_log_type_check;
alter table notifications_log add constraint notifications_log_type_check
  check (type in ('invite', 'validation_report', 'cbt_confirmation', 'cbt_reminder', 'nysc_flagged', 'staff_invite', 'access_request', 'message'));
