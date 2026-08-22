# Field Readiness Programme — Digital Platform

Candidate screening + workforce-management platform for Nigeria's local-content programme, built to
match the product design team's Figma prototype pixel-for-pixel, with every "demo click" replaced by
real backend logic. Five stakeholder portals share one codebase, gated by role:

- **Radial Circle** (Programme Manager — full read/write)
- **NCDMB** (regulator — read-only, plus the M-01 duplicate-record replace/discard decision)
- **Renaissance Africa Energy** (industry partner — fully read-only observer)
- **CBT Officer** (scoped to M-03/M-04, and only to their own assigned exam centre)
- **Candidate** (self-service, JQS Number + password sign-in)

Sign in at `/login` (Staff/Partners vs Candidate toggle, matching the design exactly); every
authenticated user lands in the role-aware shell at `/portal`, which shows a per-role sidebar and
gates each module (`M-01`…`M-09`) by real access rules — not a hardcoded demo map. Modules with a
production implementation bridge into their real page; anything not yet built shows an honest
"Coming Soon" state rather than a fake clickable demo.

Covers Stage 1–3 of the process:

- **M01 Intake** — Radial Circle bulk-uploads a candidate list (CSV/XLSX), the system validates and
  flags data issues, emails the programme coordinator a summary, and sends invite emails to valid
  candidates.
- **M02 Profile** — candidates sign in, submit personal details + NIN (verified live against Dojah) +
  NYSC certificate number and documents. NYSC review is fully manual by design — Radial Circle clears
  it from `/admin/nysc-queue`. BVN verification (Paystack) is defined in the schema
  (`profiles.bvn_verification_status` etc.) but not yet wired to a live provider — see `AGENTS.md`/task
  tracker for status. Note: an earlier instruction in this build said to drop BVN entirely; the
  Figma-exported production design reintroduces it, so it's back in the schema — flagging this in case
  it needs revisiting.
- **M03 Book CBT** — candidates with a completed profile book a computer-based-test slot from
  available capacity at a specific centre, with atomic row-locking so two people can never take the
  last seat.

Stack: Next.js 16 (App Router), Supabase (Postgres + Auth + Storage + RLS), Resend for transactional
email, Dojah for NIN verification behind a swappable provider interface
(`src/lib/verification/provider.ts`). Deployment target: AWS (handled by the client's own AWS team) —
this repo is built to be pushed to GitHub for their review/release process; it does not assume Vercel.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase/Resend/Dojah values — see DEPLOY.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying

See **[DEPLOY.md](./DEPLOY.md)** for the full account-setup and deployment checklist, including which
steps require your own login/payment vs. which can be run from a terminal.

## Project layout

- `supabase/migrations/` — schema, storage policies, and the atomic `book_cbt_slot` booking function.
  Apply in order with `supabase db push`.
- `supabase/seed.sql` — sample CBT slots for testing the booking flow.
- `src/app/api/` — the three stage endpoints (`intake/upload`, `verify/nin`, `booking`) plus
  `nysc/review` for the coordinator's manual NYSC decision.
- `src/app/admin/` — coordinator-facing dashboard, upload, and NYSC review queue.
- `src/app/(profile|book|status|invite)/` — candidate-facing pages.
- `src/lib/verification/` — NIN provider abstraction (Dojah implementation; swap without touching
  call sites).
- `src/lib/email/` — Resend wrapper + HTML templates, every send audited to `notifications_log`.
