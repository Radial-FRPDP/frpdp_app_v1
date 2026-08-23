-- ---------------------------------------------------------------------
-- Fixes "infinite recursion detected in policy for relation candidates"
-- -- the real cause of the "sign-in succeeds, /portal bounces back to
-- /login" bug that turned out to have nothing to do with cookies or the
-- sign-in flow at all.
--
-- The cycle (introduced in 0004_multi_role.sql):
--   candidates_cbt_centre_select (on candidates) subqueries bookings
--     -> evaluating that subquery requires evaluating bookings' own RLS
--     -> bookings_self_all (on bookings) subqueries candidates
--     -> evaluating THAT subquery re-enters candidates' RLS
--     -> candidates_cbt_centre_select fires again -> infinite recursion.
--
-- This affects EVERY read of candidates (and, transitively, profiles via
-- profiles_cbt_centre_select, which has the same bookings/cbt_slots
-- subquery shape), for every role, not just cbt officers -- Postgres has
-- to plan/evaluate all applicable SELECT policies, so the cycle exists
-- regardless of who's asking. In practice this meant getPortalSession()'s
-- `supabase.from("candidates")...maybeSingle()` call always errored,
-- data came back null (the error itself was silently discarded by the
-- destructured `{ data }`), and every candidate sign-in -- no matter how
-- correct -- looked like "no candidate found" and bounced to /login.
--
-- Fix: follow the same pattern already used for is_admin()/is_org()/
-- my_cbt_centre() -- move the cross-table check into a security-definer
-- function. A security-definer function executes as its owner (the
-- migration role, which owns these tables), so Postgres skips RLS
-- entirely for the queries inside it -- the bookings lookup no longer
-- re-enters candidates' policy set, and the cycle is broken.
-- ---------------------------------------------------------------------

create or replace function candidate_has_confirmed_booking_at_my_centre(target_candidate_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from bookings b
    join cbt_slots s on s.id = b.slot_id
    where b.candidate_id = target_candidate_id
      and b.status = 'confirmed'
      and s.cbt_centre_id = my_cbt_centre()
  );
$$;

drop policy if exists candidates_cbt_centre_select on candidates;
create policy candidates_cbt_centre_select on candidates
  for select using (
    is_org(auth.uid(), 'cbt') and candidate_has_confirmed_booking_at_my_centre(candidates.id)
  );

drop policy if exists profiles_cbt_centre_select on profiles;
create policy profiles_cbt_centre_select on profiles
  for select using (
    is_org(auth.uid(), 'cbt') and candidate_has_confirmed_booking_at_my_centre(profiles.candidate_id)
  );
