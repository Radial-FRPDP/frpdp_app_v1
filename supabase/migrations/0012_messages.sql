-- ---------------------------------------------------------------------
-- Message Centre (M-02) -- a two-way thread between Radial Circle and a
-- candidate, for exactly the case notifications_log can't cover: back-
-- and-forth about why a profile is on hold or flagged (see
-- design-reference-gap-analysis.md Section 3.6). notifications_log stays
-- what it always was -- a one-way system log of automated emails sent --
-- this is a separate, human-authored conversation, keyed to a candidate
-- rather than to any one verification field.
--
-- Kept deliberately simple for a first version: one flat thread per
-- candidate (not per-topic), no read receipts, no attachments. Resend
-- isn't wired up to notify on a new message yet -- that's the same
-- RESEND_API_KEY/EMAIL_FROM gap already flagged as ongoing/deferred, not
-- new scope from this migration.
-- ---------------------------------------------------------------------

create table messages (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  sender_role text not null check (sender_role in ('radial', 'candidate')),
  sender_staff_id uuid references staff_profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_candidate_idx on messages (candidate_id);

alter table messages enable row level security;

-- Radial Circle can read/send on any candidate's thread.
create policy messages_radial_all on messages
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- A candidate can read their own thread and send into it -- but not post
-- as sender_role = 'radial' (RLS enforces the label matches who's really
-- writing, same principle as candidates.duplicate_decision only being
-- settable by NCDMB via a security-definer function rather than a raw
-- client update).
create policy messages_self_select on messages
  for select using (
    exists (select 1 from candidates c where c.id = messages.candidate_id and c.auth_user_id = auth.uid())
  );
create policy messages_self_insert on messages
  for insert with check (
    sender_role = 'candidate'
    and exists (select 1 from candidates c where c.id = messages.candidate_id and c.auth_user_id = auth.uid())
  );
