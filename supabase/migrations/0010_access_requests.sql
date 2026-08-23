-- ---------------------------------------------------------------------
-- Staff account provisioning: "Request Access" public form + the
-- Programme Manager's approval queue that turns a request into a real
-- staff_profiles row and a login.
--
-- Until now, every staff account (NCDMB, Renaissance, CBT officers, and
-- Radial Circle itself) had to be created by hand via direct SQL -- there
-- was no self-serve path and no in-app "Create User" screen. This adds
-- the table the request queue is built on; the accounts themselves are
-- still only ever created through a server route running as Radial
-- Circle (see /api/access-requests/[id]/approve and /api/staff/create),
-- never directly by the requester -- org/role assignment is a Programme
-- Manager decision, matching how staff-login's org-mismatch check
-- already assumes org is trustworthy.
-- ---------------------------------------------------------------------

-- Written idempotently on purpose (if not exists / do-block guards
-- throughout): this table already got created by a first, partial run of
-- this script in the Supabase SQL editor (which stops at the first
-- statement error), so re-running the original non-idempotent version
-- fails immediately with "relation access_requests already exists"
-- before ever reaching the indexes/RLS/policy/notifications_log
-- statements below it. Safe to run any number of times, on a database
-- where none, some, or all of this already applied.
create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  org text not null check (org in ('radial', 'ncdmb', 'renaissance', 'cbt')),
  title text,
  cbt_centre_id uuid references cbt_centres(id),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references staff_profiles(id),
  reviewed_at timestamptz,
  decision_note text
);

create index if not exists access_requests_status_idx on access_requests (status);
create index if not exists access_requests_email_idx on access_requests (lower(email));

alter table access_requests enable row level security;

-- Radial Circle reviews and decides every request. There is deliberately
-- no public insert/select policy here -- the public "Request Access" form
-- submits through POST /api/access-requests, which uses the service-role
-- client, so the table itself is never exposed to the anon key.
--
-- Postgres has no "create policy if not exists", so this checks
-- pg_policies itself before creating it -- re-running this script must
-- not error just because the policy is already there from a prior run.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'access_requests' and policyname = 'access_requests_radial_all'
  ) then
    create policy access_requests_radial_all on access_requests
      for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
  end if;
end $$;

-- notifications_log.type's check constraint needs two more values: one
-- for the "a new access request came in" email to the coordinator, one
-- for the "your account is ready, set your password" email sent when a
-- staff account is provisioned (approved request, or a direct Add User).
alter table notifications_log drop constraint if exists notifications_log_type_check;
alter table notifications_log add constraint notifications_log_type_check
  check (type in ('invite', 'validation_report', 'cbt_confirmation', 'cbt_reminder', 'nysc_flagged', 'staff_invite', 'access_request'));
