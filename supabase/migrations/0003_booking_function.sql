-- Atomic slot booking: locks the slot row so two candidates racing for the
-- last seat can't both succeed. Call via supabase.rpc('book_cbt_slot', ...)
-- rather than a read-then-write from application code.

create or replace function book_cbt_slot(p_candidate_id uuid, p_slot_id uuid)
returns bookings
language plpgsql
security definer
as $$
declare
  v_slot cbt_slots%rowtype;
  v_booking bookings%rowtype;
begin
  select * into v_slot from cbt_slots where id = p_slot_id for update;

  if not found then
    raise exception 'Slot not found';
  end if;

  if v_slot.booked_count >= v_slot.capacity then
    raise exception 'Slot is full';
  end if;

  if exists (select 1 from bookings where candidate_id = p_candidate_id and status = 'confirmed') then
    raise exception 'Candidate already has a confirmed booking';
  end if;

  update cbt_slots set booked_count = booked_count + 1 where id = p_slot_id;

  insert into bookings (candidate_id, slot_id, status)
  values (p_candidate_id, p_slot_id, 'confirmed')
  returning * into v_booking;

  update candidates set status = 'verified' where id = p_candidate_id and status <> 'verified';

  return v_booking;
end;
$$;
