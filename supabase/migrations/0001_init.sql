-- Batch 1: Intake (M01) / Profile (M02) / Book CBT (M03)
-- Core schema + row-level security.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Admin / coordinator accounts (extends auth.users)
-- ---------------------------------------------------------------------
create table admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'coordinator' check (role in ('coordinator', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function is_admin(uid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from admin_profiles where id = uid);
$$;

-- ---------------------------------------------------------------------
-- Intake batches — one row per bulk upload
-- ---------------------------------------------------------------------
create table batches (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references admin_profiles(id),
  filename text not null,
  total_rows int not null default 0,
  valid_rows int not null default 0,
  issue_rows int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Candidates — one row per shortlisted person
-- ---------------------------------------------------------------------
create table candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references batches(id),
  full_name text not null,
  email text not null,
  phone text,
  source_row jsonb,                          -- raw uploaded row, for audit
  duplicate_of uuid references candidates(id),
  validation_issues jsonb not null default '[]'::jsonb,
  status text not null default 'pending_review'
    check (status in (
      'pending_review',   -- failed validation, needs coordinator attention
      'invited',          -- passed validation, invite email sent
      'profile_in_progress',
      'profile_complete',
      'verified',         -- NIN verified + NYSC manually cleared
      'rejected'
    )),
  invite_token uuid not null default gen_random_uuid(),
  auth_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index candidates_email_idx on candidates (lower(email));
create index candidates_batch_idx on candidates (batch_id);
create index candidates_status_idx on candidates (status);
create index candidates_invite_token_idx on candidates (invite_token);

-- ---------------------------------------------------------------------
-- Profiles — M02 data captured by the candidate
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references candidates(id) on delete cascade,
  date_of_birth date,
  address text,
  nin text,
  nin_verification_status text not null default 'not_submitted'
    check (nin_verification_status in ('not_submitted', 'pending', 'verified', 'failed')),
  nin_verification_payload jsonb,             -- raw provider response (no card/bank data ever stored)
  nysc_cert_number text,
  nysc_review_status text not null default 'pending'
    check (nysc_review_status in ('pending', 'verified', 'issue')),
  nysc_reviewed_by uuid references admin_profiles(id),
  nysc_reviewed_at timestamptz,
  nysc_review_note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Documents — uploaded to Supabase Storage, path referenced here
-- ---------------------------------------------------------------------
create table documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  doc_type text not null check (doc_type in ('id_card', 'nysc_certificate', 'photo', 'other')),
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- CBT slots and bookings — M03
-- ---------------------------------------------------------------------
create table cbt_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  location text,
  capacity int not null default 30,
  booked_count int not null default 0,
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references candidates(id) on delete cascade,
  slot_id uuid not null references cbt_slots(id),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Notification log — every automated email, for audit + debugging
-- ---------------------------------------------------------------------
create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references candidates(id),
  type text not null check (type in ('invite', 'validation_report', 'cbt_confirmation', 'cbt_reminder', 'nysc_flagged')),
  recipient_email text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger candidates_set_updated_at
  before update on candidates
  for each row execute function set_updated_at();

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table admin_profiles enable row level security;
alter table batches enable row level security;
alter table candidates enable row level security;
alter table profiles enable row level security;
alter table documents enable row level security;
alter table cbt_slots enable row level security;
alter table bookings enable row level security;
alter table notifications_log enable row level security;

-- admin_profiles: admins can read all; a user can read their own row
create policy admin_profiles_self_or_admin_select on admin_profiles
  for select using (id = auth.uid() or is_admin(auth.uid()));

-- batches: admin only
create policy batches_admin_all on batches
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- candidates: admin full access; candidate can select/update only their own linked row
create policy candidates_admin_all on candidates
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy candidates_self_select on candidates
  for select using (auth_user_id = auth.uid());

create policy candidates_self_update on candidates
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- profiles: admin full access; candidate can manage only their own profile
create policy profiles_admin_all on profiles
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy profiles_self_all on profiles
  for all using (
    exists (select 1 from candidates c where c.id = profiles.candidate_id and c.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from candidates c where c.id = profiles.candidate_id and c.auth_user_id = auth.uid())
  );

-- documents: admin full access; candidate can manage only their own documents
create policy documents_admin_all on documents
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy documents_self_all on documents
  for all using (
    exists (select 1 from candidates c where c.id = documents.candidate_id and c.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from candidates c where c.id = documents.candidate_id and c.auth_user_id = auth.uid())
  );

-- cbt_slots: any authenticated candidate can read availability; admin manages
create policy cbt_slots_authenticated_select on cbt_slots
  for select using (auth.uid() is not null);

create policy cbt_slots_admin_write on cbt_slots
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- bookings: admin full access; candidate can manage only their own booking
create policy bookings_admin_all on bookings
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy bookings_self_all on bookings
  for all using (
    exists (select 1 from candidates c where c.id = bookings.candidate_id and c.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from candidates c where c.id = bookings.candidate_id and c.auth_user_id = auth.uid())
  );

-- notifications_log: admin only (candidates never read this table directly)
create policy notifications_log_admin_all on notifications_log
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
