-- ---------------------------------------------------------------------
-- Batch 3: candidate structured fields, next-of-kin, address breakdown,
-- geopolitical zone, and booking-exception / exam-incident logging.
--
-- Source: gap analysis against the Figma Make design reference (see
-- claude/design-reference-gap-analysis.md in the project), Sections
-- 3.1-3.4 and 3.6. This is "foundation" work — schema + the code that
-- reads/writes it — ahead of the NCDMB/Renaissance dashboards and other
-- UI that will eventually consume it.
--
-- intakeParser.ts has always read gender, discipline, date of birth, and
-- state of origin from the NCDMB CSV, and already computes age-
-- ineligibility from them — but until now none of that survived past the
-- upload route's insert into `candidates`, except buried inside the
-- source_row JSONB blob (raw CSV headers, unnormalized, not reliably
-- queryable). These columns make that data first-class, matching the
-- zone/discipline/state breakdowns the reference's M-01/M-02/M-04
-- dashboards depend on.
--
-- No backfill is attempted for existing rows: source_row's keys are
-- whatever the original CSV's column headers happened to be, which is
-- too unreliable to parse generically in SQL. Existing candidates simply
-- have these columns NULL until re-uploaded (or, for hand-created test
-- rows, updated manually).
-- ---------------------------------------------------------------------

alter table candidates
  add column if not exists gender text,
  add column if not exists discipline text,
  add column if not exists date_of_birth date,
  add column if not exists state_of_origin text,
  add column if not exists zone text check (zone in (
    'South-South', 'South-East', 'South-West',
    'North-Central', 'North-West', 'North-East'
  )),
  add column if not exists nomination_confirmed_at timestamptz;

comment on column candidates.date_of_birth is
  'NCDMB-supplied date of birth, captured at intake and treated as authoritative -- this is the value the age-eligibility gate already runs against before a candidate is ever invited. Distinct from profiles.date_of_birth (candidate self-entry during M-02, pre-existing); M-02 now shows this value read-only instead of asking for it again.';

comment on column candidates.zone is
  'Derived from state_of_origin at intake (see src/lib/nigeria-zones.ts), using the same 6-zone list as cbt_centres.zone.';

comment on column candidates.nomination_confirmed_at is
  'Set when the candidate explicitly confirms their NCDMB-supplied nomination details on the new M-01 Welcome screen. Gates M-02 -- matches the reference''s confirmation step, which the app previously had no equivalent for.';

-- ---------------------------------------------------------------------
-- Next-of-kin + address breakdown on profiles.
--
-- `address` already existed (free text, "current residential address") --
-- its meaning is unchanged. The reference separates that from LGA of
-- Residence and State of Residence as two further fields.
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists next_of_kin_name text,
  add column if not exists next_of_kin_phone text,
  add column if not exists next_of_kin_relationship text,
  add column if not exists next_of_kin_address text,
  add column if not exists lga_of_residence text,
  add column if not exists state_of_residence text;

comment on column profiles.address is
  'Current residential address (free text) -- unchanged. Paired with lga_of_residence and state_of_residence to match the reference''s 3-field address model.';

-- ---------------------------------------------------------------------
-- Booking exceptions -- M-03 centre-change / missed-window / duplicate-
-- booking requests, decided by a Programme Manager (PM Approve/Reject in
-- the reference). bookings.candidate_id is unique (one active booking per
-- candidate today), so this is what lets a change go through a decision
-- gate instead of silently needing a second bookings row.
-- ---------------------------------------------------------------------
create table booking_exceptions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  type text not null check (type in ('centre_change', 'missed_window', 'duplicate_booking')),
  requested_slot_id uuid references cbt_slots(id),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_by uuid references staff_profiles(id),
  decided_at timestamptz,
  decision_note text
);

create index booking_exceptions_candidate_idx on booking_exceptions (candidate_id);
create index booking_exceptions_status_idx on booking_exceptions (status);

-- ---------------------------------------------------------------------
-- Exam-day incidents -- M-04 invigilator panel: device failure, identity
-- mismatch, late arrival, each with a severity and a status. Per the
-- reference, a results batch can't be approved while any incident on it
-- is still 'pending' -- that gate is application logic, not enforced
-- here, but this table is what makes it checkable.
-- ---------------------------------------------------------------------
create table exam_incidents (
  id uuid primary key default gen_random_uuid(),
  exam_session_id uuid not null references exam_sessions(id) on delete cascade,
  reported_by uuid references staff_profiles(id),
  category text not null check (category in ('device_failure', 'identity_mismatch', 'late_arrival', 'other')),
  severity text not null default 'low' check (severity in ('low', 'medium', 'high')),
  description text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'closed')),
  reviewed_by uuid references staff_profiles(id),
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create index exam_incidents_session_idx on exam_incidents (exam_session_id);
create index exam_incidents_status_idx on exam_incidents (status);

-- ---------------------------------------------------------------------
-- RLS, following the exact org-scoped pattern from 0004_multi_role.sql
-- (is_admin / is_org / my_cbt_centre already exist as functions).
-- ---------------------------------------------------------------------
alter table booking_exceptions enable row level security;
alter table exam_incidents enable row level security;

-- booking_exceptions: radial decides everything; oversight orgs read;
-- a candidate may request one for their own booking and read their own
-- requests, but cannot decide them (no update/delete policy for self).
create policy booking_exceptions_radial_all on booking_exceptions
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy booking_exceptions_oversight_select on booking_exceptions
  for select using (is_org(auth.uid(), 'ncdmb') or is_org(auth.uid(), 'renaissance'));

create policy booking_exceptions_self_select on booking_exceptions
  for select using (
    exists (select 1 from candidates c where c.id = booking_exceptions.candidate_id and c.auth_user_id = auth.uid())
  );
create policy booking_exceptions_self_insert on booking_exceptions
  for insert with check (
    exists (select 1 from candidates c where c.id = booking_exceptions.candidate_id and c.auth_user_id = auth.uid())
  );

-- exam_incidents: radial full access; oversight orgs read (feeds the
-- M-04 pass-rate-disparity reporting); cbt officers manage incidents at
-- their own centre's sessions only (they're the ones logging them).
create policy exam_incidents_radial_all on exam_incidents
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy exam_incidents_oversight_select on exam_incidents
  for select using (is_org(auth.uid(), 'ncdmb') or is_org(auth.uid(), 'renaissance'));

create policy exam_incidents_cbt_own_centre on exam_incidents
  for all using (
    is_org(auth.uid(), 'cbt') and exists (
      select 1 from exam_sessions s
      where s.id = exam_incidents.exam_session_id
        and s.cbt_centre_id = my_cbt_centre()
    )
  )
  with check (
    is_org(auth.uid(), 'cbt') and exists (
      select 1 from exam_sessions s
      where s.id = exam_incidents.exam_session_id
        and s.cbt_centre_id = my_cbt_centre()
    )
  );
