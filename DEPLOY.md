# Deploying the Field Readiness Programme platform

Stack: **Next.js (App Router) on your AWS hosting + Supabase (Postgres/Auth/Storage, RLS-enforced) +
Resend (email) + Dojah (NIN verification) + Paystack Identity (BVN verification)**.

This app is provider-agnostic about *where it runs* (Vercel, AWS Amplify/ECS/App Runner, any Node host —
your AWS team's call) but currently depends on Supabase specifically for auth, database, storage, and
row-level-security-based authorization. See `architecture-supabase-vs-aws.md` in the SP1 project for the
full Supabase-vs-AWS-native comparison and the decision record (Supabase now, AWS-native migration is a
later, separately-scoped project if ever needed).

For the complete, sequenced, checkable list of everything below plus the non-technical steps (domain,
content readiness, security review, launch cutover), see the **go-live readiness checklist** published
alongside this doc. This file covers the technical mechanics only.

---

## Part A — Accounts only you (or your AWS/IT team) can create

I cannot create accounts, register domains, or pay for anything. For each one below, the only thing I
need back is the resulting key/URL/token — paste it into chat or directly into `.env.local`.

| # | Where | What to do | What to send back |
|---|-------|-------------|--------------------|
| 1 | [supabase.com](https://supabase.com) | Create a project (pick a region close to Nigeria — `eu-west-1` or `af-south-1` if offered) — save the DB password | Project URL, `anon` key, `service_role` key (Settings → API) |
| 2 | [resend.com](https://resend.com) | Create an account → **API Keys** → create one → verify a sending domain (Part D) | The API key (starts `re_`) |
| 3 | Domain registrar | A domain for the app URL and the sending address — ideally one Radial Circle controls long-term, not a personal domain | The domain name |
| 4 | [dojah.io](https://dojah.io) | Create a business account, complete KYB for production (sandbox works immediately with test data) | Sandbox `App ID` + `Secret Key` now; production keys once KYB clears |
| 5 | [paystack.com](https://paystack.com) | Create a business account, complete KYC. BVN lookup (`resolve_bvn`) is a **gated Identity product** — request access from Paystack support/your account manager; this can take longer than standard KYC | Test secret key (`sk_test_...`) now; live secret key once BVN-lookup access is approved |
| 6 | [github.com](https://github.com) | Create (or designate) an org/repo for this codebase, add your AWS team as collaborators | Repo URL + who should get push access |
| 7 | Your AWS team | Decide the hosting target (Amplify Hosting is the closest like-for-like to a Vercel-style deploy for Next.js; App Runner/ECS if they want more control) and who owns the AWS account this runs under | Confirmation of hosting choice — informs the exact deploy steps below |

**Never send passwords.** Keys, URLs, and tokens only — and only the values above, nothing more
sensitive.

---

## Part B — Environment variables

Every variable in `.env.example`, current as of this build:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-only — never expose to the browser, never commit
RESEND_API_KEY
EMAIL_FROM
PROGRAM_COORDINATOR_EMAIL
NIN_PROVIDER=dojah
DOJAH_APP_ID
DOJAH_SECRET_KEY
DOJAH_ENV=sandbox                # switch to "production" once Dojah KYB clears
PAYSTACK_SECRET_KEY              # BVN lookup — sk_test_... until Paystack approves live BVN access
NEXT_PUBLIC_APP_URL
```

Set these in whatever your AWS team's hosting target uses for env config (Amplify Console env vars,
ECS task definition secrets via Secrets Manager, etc.) — not committed to the repo. `service_role` and
both provider secret keys should go through Secrets Manager or an equivalent if your AWS team has one,
rather than plain env vars, once this leaves a dev/staging environment.

---

## Part C — Database: push the schema

```bash
npx supabase login                       # opens a browser to authorize the CLI
npx supabase link --project-ref <your-project-ref>
npx supabase db push                     # applies supabase/migrations/*.sql in order
```

If you're pushing from an environment with restricted network egress (no raw Postgres port access,
common in sandboxed CI/build environments), `supabase db push` and `--db-url` will both fail to
connect even with a correct connection string. The fallback that always works: concatenate the
migration files in order and paste the result into Supabase Dashboard → SQL Editor → New query → Run.
That's exactly how this project's schema was actually first deployed. One caveat: doing it that way
skips the CLI's own migration-history bookkeeping (the `supabase_migrations.schema_migrations` table),
so before anyone runs `supabase db push` from a normal networked environment for the *next* new
migration, reconcile history first with `supabase migration repair --status applied <version>` for each
of 0001–0007 (or `supabase db pull` to resync from the live schema) — otherwise it will try to
re-run migrations that already applied and error on "already exists".

Current migrations, applied in order:

| File | What it does |
|---|---|
| `0001_init.sql` | Core schema: `candidates`, `profiles`, `documents`, `cbt_slots`, `bookings`, `notifications_log`, base RLS |
| `0002_storage.sql` | Supabase Storage bucket + policies for document uploads |
| `0003_booking_function.sql` | `book_slot()` — atomic slot-capacity-checked booking RPC |
| `0004_multi_role.sql` | The 5-role model: `cbt_centres`, `staff_profiles` (replaces the old `admin_profiles`), `is_admin`/`is_org`/`staff_org`/`my_cbt_centre` helpers, `jqs_number` + duplicate-decision fields on `candidates`, BVN fields on `profiles`, `cbt_centre_id` on `cbt_slots`, `set_duplicate_decision()` RPC, full RLS rewrite for all 5 roles |
| `0005_documents.sql` | Adds `degree_certificate` to the allowed document types |
| `0006_assessment.sql` | `exam_questions`, `exam_sessions`, `exam_answers`, `exam_results` — CBT delivery/grading, with RLS that deliberately withholds the answer key from candidates and CBT officers |
| `0007_verification_review_audit.sql` | Adds `nin_reviewed_by/at/note` and `bvn_reviewed_by/at/note` to `profiles`, matching the audit columns NYSC already had — records who manually verified a candidate's NIN/BVN and when, now that M-02 has a real Verification Queue for this |

After the first push, regenerate the TypeScript types from the live schema so `database.types.ts` (currently
hand-written) never drifts:

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts
```

`supabase/seed.sql` inserts 5 sample `cbt_slots` rows for dev/staging booking tests — **it does not set
`cbt_centre_id`**, so those slots won't show up in a CBT officer's centre-scoped queue. It's fine for
testing the candidate booking flow in isolation; for a real end-to-end test (including check-in and
exam delivery) create centres and slots through the actual Radial Circle **M-03 → Centres & Slots**
screen instead, which is the real production path. Don't run `seed.sql` against production.

---

## Part D — Domain, email, and DNS

1. In Resend, **Domains → Add Domain** using the domain from Part A #3, and add the SPF/DKIM/DMARC
   records it gives you at your registrar. Sending should be from a Radial-Circle-controlled domain, not
   a personal or throwaway one — candidates and staff will be trusting invite/notification emails from
   this address for the life of the programme.
2. Update `EMAIL_FROM` to an address on the verified domain (e.g. `"Field Readiness Programme
   <noreply@yourdomain>"`).
3. Point `NEXT_PUBLIC_APP_URL` at the real app URL once hosting is live, and update it in whatever env
   config your AWS team uses.
4. Once your AWS team has a hosting target live, point the app domain at it (CNAME/A record per their
   hosting choice) and add the domain in that service's console.
5. **Configure custom SMTP for Supabase Auth**: Supabase Dashboard → **Authentication → Emails → SMTP
   Settings** → point it at Resend's SMTP credentials (Resend dashboard → SMTP, same API key from Part A
   #2). Two flows go through Supabase's own mailer rather than the app's Resend integration — password
   reset links and the legacy `/admin/login` magic link — and Supabase's default mailer is rate-limited
   hard enough (a handful of sends per hour) to fail under any real usage until this is set.

---

## Part E — Deploy

The build is a standard Next.js 16 app (`npm run build && npm run start`, or your AWS team's preferred
container/serverless packaging). No Vercel-specific config is in the repo — this is intentionally left to
whatever your AWS team decides in Part A #7. Whichever target they pick, the env vars in Part B are the
full list it needs.

---

## Part F — Bootstrapping the first account for each role

There's no self-serve signup for staff roles by design — `staff_profiles` rows are added directly, so
only people explicitly promoted can sign in as Radial Circle, NCDMB, Renaissance, or a CBT officer.
Candidates are the only self-service role, and even they only get an account once NCDMB's nomination
data has been loaded (Part G) and Radial Circle has dispatched invites.

The staff sign-in form on `/login` is email + password only — it has no "send me a link" option, so for
a brand-new person there's no password yet to sign in with. The reliable way to create the very first
account (and every one after it) is straight from the Supabase dashboard, which sidesteps needing email
delivery configured at all for this step:

1. Supabase Dashboard → **Authentication → Users → Add user** → enter their email and a temporary
   password directly (tick "Auto Confirm User").
2. **SQL Editor**, run (adjust `org` — one of `radial`, `ncdmb`, `renaissance`, `cbt` — and
   `cbt_centre_id`, which only applies to `cbt`):
   ```sql
   insert into staff_profiles (id, full_name, org, cbt_centre_id)
   select id, 'Full Name Here', 'radial', null
   from auth.users
   where email = 'person@yourdomain.example';
   ```
   (`staff_profiles` has no `role` column — `org` alone is what RLS keys off; `title` is optional free
   text if you want to record a job title, and `cbt_centre_id` only applies to `org = 'cbt'`.)
3. Give them the temporary password out of band (not email, not chat) and have them sign in at `/login`
   → the matching org tile → then immediately use **Forgot password?** to set their own. That reset email
   only sends correctly once custom SMTP is configured (Part D.5 below) — without it, Supabase's default
   mailer is capped low enough (a handful of emails/hour) to be unreliable for anything beyond this one
   bootstrap step.
4. The very first Radial Circle account is the one that matters most — every other account, including
   every other org's first person, can be added the same way, or later through Radial Circle's own admin
   tooling once it exists. There's no separate super-admin path.

There is a second, older entry point at `/admin/login` (email-only magic link, pre-dating the multi-role
`/login` page) that still works against the `org='radial'` check on `/admin` — it's legacy and worth
retiring once nothing depends on it, not a recommended path for new bootstrapping.

---

## Part G — Smoke test before real candidates touch it

1. `/login` → Radial Circle → sign in as the bootstrap coordinator.
2. `/portal/m01` → upload a small test CSV (a few rows, including one bad email and one duplicate JQS
   number, to confirm validation flagging) → review the flagged rows → dispatch invites to the clean rows
   only.
3. Check the invited test candidate's inbox, and check `notifications_log` in Supabase if anything looks
   like it didn't send.
4. As that candidate: `/login` → candidate tile → JQS Number + password (set via the first-login flow) →
   `/portal/m02` → fill profile, upload documents. If Dojah/Paystack keys are configured, verify with a
   **Dojah sandbox test NIN** and a **Paystack test BVN** (both providers publish working sandbox values
   in their docs) and confirm the verified/failed states render. If they're not configured — the expected
   state for a first batch — clicking Verify should degrade to "pending" without erroring, and the
   candidate can still submit; NIN/BVN move to Radial Circle's Verification Queue for manual review.
5. As Radial Circle: `/portal/m02` → the Verification Queue lists that candidate's self-reported NIN,
   BVN, and NYSC — mark each verified (or failed/flagged) and confirm the candidate's status promotes to
   `verified` once all three clear.
6. `/portal/m03` as Radial Circle → create a test centre and a slot. As the candidate → book that slot.
7. `/portal/m04` as a CBT-org staff account assigned to that centre → check the candidate in → read them
   the generated 6-digit access code. As the candidate → enter the code → confirm the 2-hour timer starts
   and (if the question bank has content — see the go-live checklist) the exam renders → submit.
8. As the CBT officer → confirm the session shows submitted, and that results either auto-graded or
   entered manually save correctly.

---

## Known gaps / follow-ups (see the go-live checklist for the full, current list)

- **Dojah and Paystack access isn't live yet, by design for now**: with no keys configured, candidates
  still self-report NIN/BVN and upload supporting documents, and submission isn't blocked on live
  verification — Radial Circle reviews and marks each one verified/failed by hand in the M-02
  Verification Queue (`/portal/m02` as Radial). NYSC has always worked this way; NIN and BVN now do too
  until the provider approvals clear. Once they do, the Verify buttons in M-02 start returning real
  results automatically — no code change needed, just the env vars.
- **NYSC verification stays fully manual** per programme instruction — no API integration exists or is
  planned; it goes through the same Verification Queue as NIN/BVN.
- **CBT reminder emails**: the template exists (`cbtReminderEmail`) but nothing schedules it yet — needs
  a scheduled job (whatever your AWS team's equivalent of a cron trigger is) calling a small reminder
  route ahead of each slot.
- No automated test suite yet — Part G above is the manual smoke test standing in for one.
- Several dashboards/screens described in the original brief are not yet built natively (NCDMB and
  Renaissance oversight dashboards, Radial's M-02 review queue, the CBT officer's full M-03 tooling) —
  tracked as go/no-go items in the go-live checklist, not silently shipped as done.
