-- Sample CBT slots for testing the booking flow (M03).
-- Safe to run multiple times against a fresh/dev project — NOT applied
-- automatically by `supabase db push`; run explicitly with:
--   supabase db execute -f supabase/seed.sql
-- or paste into the SQL editor in the Supabase dashboard.
--
-- Adjust dates/locations/capacity to match the real CBT schedule before
-- candidates start booking against this data.

insert into cbt_slots (starts_at, location, capacity, booked_count)
values
  (now() + interval '3 days' + interval '9 hours', 'Lagos — Victoria Island Test Centre', 50, 0),
  (now() + interval '3 days' + interval '13 hours', 'Lagos — Victoria Island Test Centre', 50, 0),
  (now() + interval '4 days' + interval '9 hours', 'Port Harcourt — GRA Test Centre', 40, 0),
  (now() + interval '5 days' + interval '9 hours', 'Abuja — Central Business District Test Centre', 40, 0),
  (now() + interval '5 days' + interval '13 hours', 'Abuja — Central Business District Test Centre', 40, 0);
