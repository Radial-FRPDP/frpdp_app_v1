-- Batch 2: multi-stakeholder access model.
--
-- The Figma-exported production design has five distinct portals sharing
-- one app: Radial Circle (Programme Manager, full read/write), NCDMB
-- (regulator, read-only + a single duplicate-record decision gate on
-- M-01), Renaissance Africa Energy (industry partner, fully read-only
-- observer), CBT Officer (scoped to M-03/M-04, and only to their own
-- exam centre), and Candidate (self-service, unchanged from 0001).
--
-- This replaces the single-tier admin_profiles/is_admin() model with a
-- proper org-scoped one. admin_profiles is dropped; every place that used
-- to mean "admin" now means "radial" (Radial Circle staff are the
-- operational Programme Manager team and keep full CRUD).

-- ---------------------------------------------------------------------
-- CBT exam centres — referenced by M-03 booking and M-04 exam sessions.
-- ---------------------------------------------------------------------
create table cbt_centres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state text not null,
  zone text not null check (zone in (
    'South-South', 'South-East', 'South-West',
    'North-Central', 'North-West', 'North-East'
  )),
  capacity int not null default 0,
  status text not null default 'active' check (status in ('active', 'unavailable')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Staff accounts — extends auth.users, replaces admin_profiles.
-- ---------------------------------------------------------------------
create table staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  title text,
  org text not null check (org in ('radial', 'ncdmb', 'renaissance', 'cbt')),
  -- Only set (and only meaningful) for org = 'cbt': the single exam centre
  -- this officer works from. A cbt staff row with no centre can sign in
  -- but sees nothing until an existing radial coordinator assigns one.
  cbt_centre_id uuid references cbt_centres(id),
  created_at timestamptz not null default now(),
  constraint cbt_centre_only_for_cbt_org check (
    (org = 'cbt') or (cbt_centre_id is null)
  )
);

create index staff_profiles_org_idx on staff_profiles (org);

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'admin_profiles') then
    insert into staff_profiles (id, full_name, title, org, created_at)
    select id, full_name, role, 'radial', created_at from admin_profiles
    on conflict (id) do nothing;
  end if;
end $$;

create or replace function staff_org(uid uuid)
returns text
language sql
security definer
stable
as $$
  select org from staff_profiles where id = uid;
$$;

create or replace function is_org(uid uuid, target_org text)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from staff_profiles where id = uid and org = target_org);
$$;

-- Kept as "is_admin" for compatibility with 0001's policy names / meaning:
-- Radial Circle is the Programme Manager and keeps full CRUD everywhere
-- the old single "admin" role used to.
create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select is_org(uid, 'radial');
$$;

create or replace function my_cbt_centre()
returns uuid
language sql
security definer
stable
as $$
  select cbt_centre_id from staff_profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- candidates: JQS number (assigned upstream by NCDMB, arrives in the
-- intake CSV) + the NCDMB duplicate replace/discard decision that gates
-- Radial Circle's M-01 dispatch step.
-- ---------------------------------------------------------------------
alter table candidates
  add column if not exists jqs_number text,
  add column if not exists duplicate_decision text
    check (duplicate_decision in ('pending', 'replace', 'discard')),
  add column if not exists duplicate_decision_by uuid references staff_profiles(id),
  add column if not exists duplicate_decision_at timestamptz;

create unique index if not exists candidates_jqs_number_idx
  on candidates (jqs_number) where jqs_number is not null;

-- A duplicate row always starts life needing an NCDMB decision.
update candidates set duplicate_decision = 'pending'
  where duplicate_of is not null and duplicate_decision is null;

-- security-definer RPC rather than column-level RLS: NCDMB may only ever
-- touch this one field on this one table.
create or replace function set_duplicate_decision(p_candidate_id uuid, p_decision text)
returns candidates
language plpgsql
security definer
as $$
declare
  v_row candidates%rowtype;
begin
  if not is_org(auth.uid(), 'ncdmb') then
    raise exception 'Only NCDMB staff may record a duplicate decision';
  end if;
  if p_decision not in ('replace', 'discard') then
    raise exception 'decision must be replace or discard';
  end if;

  update candidates
    set duplicate_decision = p_decision,
        duplicate_decision_by = auth.uid(),
        duplicate_decision_at = now()
    where id = p_candidate_id
    returning * into v_row;

  if not found then
    raise exception 'Candidate not found';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: BVN verification (Paystack). We deliberately do not store a
-- full bank account number — only enough to let the candidate visually
-- confirm the account Paystack resolved, and the verification reference
-- for audit. Raw BVN itself is required by the design for the Paystack
-- resolve call; it is never displayed back in full anywhere in the UI.
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists bvn text,
  add column if not exists bvn_verification_status text not null default 'not_submitted'
    check (bvn_verification_status in ('not_submitted', 'pending', 'verified', 'failed')),
  add column if not exists bvn_verification_reference text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_last4 text,
  add column if not exists bank_name text;

-- ---------------------------------------------------------------------
-- cbt_slots: tie every slot to a physical centre.
-- ---------------------------------------------------------------------
alter table cbt_slots
  add column if not exists cbt_centre_id uuid references cbt_centres(id);

-- ---------------------------------------------------------------------
-- Drop the old single-tier admin policies; they're superseded below.
-- ---------------------------------------------------------------------
drop policy if exists admin_profiles_self_or_admin_select on admin_profiles;
drop policy if exists batches_admin_all on batches;
drop policy if exists candidates_admin_all on candidates;
drop policy if exists candidates_self_select on candidates;
drop policy if exists candidates_self_update on candidates;
drop policy if exists profiles_admin_all on profiles;
drop policy if exists profiles_self_all on profiles;
drop policy if exists documents_admin_all on documents;
drop policy if exists documents_self_all on documents;
drop policy if exists cbt_slots_authenticated_select on cbt_slots;
drop policy if exists cbt_slots_admin_write on cbt_slots;
drop policy if exists bookings_admin_all on bookings;
drop policy if exists bookings_self_all on bookings;
drop policy if exists notifications_log_admin_all on notifications_log;

alter table staff_profiles enable row level security;
alter table cbt_centres enable row level security;

-- staff_profiles: any staff member can read their own row + org roster
-- (needed for the org picker / directory); radial can manage everyone.
create policy staff_profiles_self_select on staff_profiles
  for select using (id = auth.uid() or is_admin(auth.uid()));

create policy staff_profiles_radial_write on staff_profiles
  for insert with check (is_admin(auth.uid()));
create policy staff_profiles_radial_update on staff_profiles
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- cbt_centres: any authenticated staff or candidate can read (needed for
-- the M-03 centre picker); only radial manages the list.
create policy cbt_centres_authenticated_select on cbt_centres
  for select using (auth.uid() is not null);
create policy cbt_centres_radial_write on cbt_centres
  for insert with check (is_admin(auth.uid()));
create policy cbt_centres_radial_update on cbt_centres
  for update using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy cbt_centres_radial_delete on cbt_centres
  for delete using (is_admin(auth.uid()));

-- batches: radial full access; ncdmb + renaissance read-only.
create policy batches_radial_all on batches
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy batches_oversight_select on batches
  for select using (is_org(auth.uid(), 'ncdmb') or is_org(auth.uid(), 'renaissance'));

-- candidates: radial full access. ncdmb read-only (duplicate decisions go
-- through set_duplicate_decision(), not direct UPDATE). renaissance
-- read-only. cbt officers may read only candidates with a confirmed
-- booking at their own centre (needed for physical JQS+NIN check-in).
create policy candidates_radial_all on candidates
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy candidates_oversight_select on candidates
  for select using (is_org(auth.uid(), 'ncdmb') or is_org(auth.uid(), 'renaissance'));

create policy candidates_cbt_centre_select on candidates
  for select using (
    is_org(auth.uid(), 'cbt') and exists (
      select 1 from bookings b
      join cbt_slots s on s.id = b.slot_id
      where b.candidate_id = candidates.id
        and b.status = 'confirmed'
        and s.cbt_centre_id = my_cbt_centre()
    )
  );

create policy candidates_self_select on candidates
  for select using (auth_user_id = auth.uid());
create policy candidates_self_update on candidates
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- profiles: radial full access; candidate manages their own; cbt officers
-- may read only the NIN field's presence for check-in at their centre
-- (exposed via the nin_verification_status + last verified fact, not the
-- raw NIN, by scoping the same row-level policy — the app layer chooses
-- which columns to select).
create policy profiles_radial_all on profiles
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy profiles_oversight_select on profiles
  for select using (is_org(auth.uid(), 'ncdmb') or is_org(auth.uid(), 'renaissance'));

create policy profiles_cbt_centre_select on profiles
  for select using (
    is_org(auth.uid(), 'cbt') and exists (
      select 1 from bookings b
      join cbt_slots s on s.id = b.slot_id
      where b.candidate_id = profiles.candidate_id
        and b.status = 'confirmed'
        and s.cbt_centre_id = my_cbt_centre()
    )
  );

create policy profiles_self_all on profiles
  for all using (
    exists (select 1 from candidates c where c.id = profiles.candidate_id and c.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from candidates c where c.id = profiles.candidate_id and c.auth_user_id = auth.uid())
  );

-- documents: radial full access; candidate manages their own. No other
-- org reads original documents directly (manual authenticity review is a
-- Radial Circle / programme-staff-only process per the mandate call).
create policy documents_radial_all on documents
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy documents_self_all on documents
  for all using (
    exists (select 1 from candidates c where c.id = documents.candidate_id and c.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from candidates c where c.id = documents.candidate_id and c.auth_user_id = auth.uid())
  );

-- cbt_slots: candidates + all staff can read availability; radial manages
-- every centre; cbt officers manage only their own centre's slots
-- (attendance/session state during M-03/M-04).
create policy cbt_slots_authenticated_select on cbt_slots
  for select using (auth.uid() is not null);
create policy cbt_slots_radial_write on cbt_slots
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy cbt_slots_cbt_own_centre_update on cbt_slots
  for update using (is_org(auth.uid(), 'cbt') and cbt_centre_id = my_cbt_centre())
  with check (is_org(auth.uid(), 'cbt') and cbt_centre_id = my_cbt_centre());

-- bookings: radial full access; candidate manages their own; cbt officers
-- read/update bookings at their own centre only (check-in); oversight
-- orgs read all (zonal reporting).
create policy bookings_radial_all on bookings
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy bookings_oversight_select on bookings
  for select using (is_org(auth.uid(), 'ncdmb') or is_org(auth.uid(), 'renaissance'));
create policy bookings_cbt_own_centre on bookings
  for select using (
    is_org(auth.uid(), 'cbt') and exists (
      select 1 from cbt_slots s where s.id = bookings.slot_id and s.cbt_centre_id = my_cbt_centre()
    )
  );
create policy bookings_cbt_own_centre_update on bookings
  for update using (
    is_org(auth.uid(), 'cbt') and exists (
      select 1 from cbt_slots s where s.id = bookings.slot_id and s.cbt_centre_id = my_cbt_centre()
    )
  )
  with check (
    is_org(auth.uid(), 'cbt') and exists (
      select 1 from cbt_slots s where s.id = bookings.slot_id and s.cbt_centre_id = my_cbt_centre()
    )
  );
create policy bookings_self_all on bookings
  for all using (
    exists (select 1 from candidates c where c.id = bookings.candidate_id and c.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from candidates c where c.id = bookings.candidate_id and c.auth_user_id = auth.uid())
  );

-- notifications_log: radial full access (audit trail is Programme
-- Manager's to review; other staff orgs get computed reports, not the
-- raw send log). Candidates may read only their own notifications, so the
-- portal's notification bell can show real sends instead of mock data.
create policy notifications_log_radial_all on notifications_log
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy notifications_log_self_select on notifications_log
  for select using (
    exists (select 1 from candidates c where c.id = notifications_log.candidate_id and c.auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- admin_profiles is superseded by staff_profiles. Drop it now that data
-- has been migrated above and every policy that referenced it is gone.
-- profiles.nysc_reviewed_by still carries its original FK to
-- admin_profiles(id) from 0001_init.sql — repoint it at staff_profiles
-- first, or the drop below fails once this migration runs against a real
-- database with that constraint in place.
-- ---------------------------------------------------------------------
alter table profiles drop constraint if exists profiles_nysc_reviewed_by_fkey;
alter table profiles add constraint profiles_nysc_reviewed_by_fkey
  foreign key (nysc_reviewed_by) references staff_profiles(id);

alter table batches drop constraint if exists batches_uploaded_by_fkey;
alter table batches add constraint batches_uploaded_by_fkey
  foreign key (uploaded_by) references staff_profiles(id);

drop table if exists admin_profiles;
