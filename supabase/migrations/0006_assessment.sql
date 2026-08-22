-- M-04 Assess: CBT exam sessions, question bank, answers, and results.
--
-- Security model note: the mandate call describes a "MAC-address
-- handshake" gating exam release. A browser cannot read a device's MAC
-- address (no web API exposes it, and anything that claimed to would be
-- trivially spoofable), so that specific mechanism isn't implementable as
-- described. The real security property it's protecting — the exam only
-- unlocks after a CBT officer has physically confirmed the candidate's
-- identity at a specific workstation — is implemented here with a
-- one-time access code the officer generates at check-in and hands to
-- the candidate in person. Flagging this substitution explicitly rather
-- than pretending to do literal device-MAC binding.
--
-- exam_questions.correct_choice_id must NEVER be readable by candidate or
-- CBT-officer sessions — no RLS policy below grants them SELECT on this
-- table. All candidate-facing question delivery and grading goes through
-- service-role API routes that strip the answer key before it ever
-- reaches the browser.

create table exam_questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  prompt text not null,
  choices jsonb not null, -- [{ id: 'a', text: '...' }, ...]
  correct_choice_id text not null,
  points numeric not null default 1,
  created_by uuid references staff_profiles(id),
  created_at timestamptz not null default now()
);

create table exam_sessions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id),
  candidate_id uuid not null references candidates(id),
  cbt_centre_id uuid not null references cbt_centres(id),
  workstation_label text,
  access_code text not null unique,
  status text not null default 'checked_in'
    check (status in ('checked_in', 'in_progress', 'submitted', 'expired')),
  checked_in_by uuid references staff_profiles(id),
  checked_in_at timestamptz not null default now(),
  started_at timestamptz,
  expires_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create index exam_sessions_candidate_idx on exam_sessions (candidate_id);
create index exam_sessions_centre_idx on exam_sessions (cbt_centre_id);

create table exam_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references exam_sessions(id) on delete cascade,
  question_id uuid not null references exam_questions(id),
  selected_choice_id text,
  is_correct boolean,
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create table exam_results (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references candidates(id),
  session_id uuid references exam_sessions(id),
  subject_scores jsonb not null default '[]'::jsonb, -- [{ subject, score, maxScore }]
  total_score numeric not null default 0,
  max_score numeric not null default 0,
  passed boolean not null default false,
  entry_method text not null default 'auto' check (entry_method in ('auto', 'manual')),
  submitted_by uuid references staff_profiles(id),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table exam_questions enable row level security;
alter table exam_sessions enable row level security;
alter table exam_answers enable row level security;
alter table exam_results enable row level security;

-- exam_questions: radial manages the bank. No one else gets table access —
-- delivery to candidates/CBT officers happens only through service-role
-- API routes that omit correct_choice_id.
create policy exam_questions_radial_all on exam_questions
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- exam_sessions: radial full access; CBT officers see/manage sessions at
-- their own centre (check-in creates rows via service-role API, but the
-- officer's own portal reads live status here); candidates read their own
-- session only — state transitions (start/submit) go through API routes
-- with service-role, never a direct candidate UPDATE, so expires_at can't
-- be tampered with from the browser.
create policy exam_sessions_radial_all on exam_sessions
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy exam_sessions_cbt_own_centre_select on exam_sessions
  for select using (is_org(auth.uid(), 'cbt') and cbt_centre_id = my_cbt_centre());

create policy exam_sessions_self_select on exam_sessions
  for select using (
    exists (select 1 from candidates c where c.id = exam_sessions.candidate_id and c.auth_user_id = auth.uid())
  );

-- exam_answers: no direct browser access at all — every read/write goes
-- through service-role API routes (grading must never trust the client).
-- (No policies beyond radial, intentionally, since candidates/CBT never
-- query this table directly.)
create policy exam_answers_radial_all on exam_answers
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- exam_results: radial full; oversight orgs read all (zonal/discipline
-- reporting, consistent with candidates/profiles/bookings above); CBT
-- officers read their own centre's results; candidates read their own.
create policy exam_results_radial_all on exam_results
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy exam_results_oversight_select on exam_results
  for select using (is_org(auth.uid(), 'ncdmb') or is_org(auth.uid(), 'renaissance'));

create policy exam_results_cbt_own_centre_select on exam_results
  for select using (
    is_org(auth.uid(), 'cbt') and exists (
      select 1 from exam_sessions s where s.id = exam_results.session_id and s.cbt_centre_id = my_cbt_centre()
    )
  );

create policy exam_results_self_select on exam_results
  for select using (
    exists (select 1 from candidates c where c.id = exam_results.candidate_id and c.auth_user_id = auth.uid())
  );
