-- ---------------------------------------------------------------------
-- RPC for deciding a booking exception (M-03) -- mirrors the pattern
-- set_duplicate_decision (0004_multi_role.sql) already established for
-- an NCDMB-style decision-recording action: a security-definer function
-- that re-checks authorization itself rather than trusting RLS alone,
-- callable directly from the browser via supabase.rpc(...).
--
-- booking_exceptions_radial_all (0008) already lets a signed-in Radial
-- Circle (is_admin) row-level update the record directly -- but a
-- centre_change/missed_window approval isn't just a status flip, it has
-- to move the candidate's actual booking (cancel the old one, book the
-- new slot), which needs the same row-locking safety book_cbt_slot
-- already uses so it can't race a candidate's own concurrent booking
-- attempt or another approval. Hence a dedicated function instead of a
-- plain client-side update.
-- ---------------------------------------------------------------------

create or replace function approve_booking_exception(
  p_exception_id uuid,
  p_decision text,
  p_decision_note text default null
)
returns booking_exceptions
language plpgsql
security definer
as $$
declare
  v_exc booking_exceptions%rowtype;
  v_slot cbt_slots%rowtype;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid decision';
  end if;

  select * into v_exc from booking_exceptions where id = p_exception_id for update;
  if not found then
    raise exception 'Exception request not found';
  end if;
  if v_exc.status <> 'pending' then
    raise exception 'This request has already been decided';
  end if;

  if p_decision = 'approved' and v_exc.type in ('centre_change', 'missed_window') and v_exc.requested_slot_id is not null then
    -- Free the seat on whatever slot the candidate currently holds (if
    -- any) before booking the new one -- nothing else in the app cancels
    -- a booking today, so this is the first place booked_count needs to
    -- come back down as well as go up.
    update cbt_slots s set booked_count = greatest(0, s.booked_count - 1)
    from bookings b
    where b.candidate_id = v_exc.candidate_id and b.status = 'confirmed' and b.slot_id = s.id;

    update bookings set status = 'cancelled'
    where candidate_id = v_exc.candidate_id and status = 'confirmed';

    select * into v_slot from cbt_slots where id = v_exc.requested_slot_id for update;
    if not found then
      raise exception 'Requested slot no longer exists';
    end if;
    if v_slot.booked_count >= v_slot.capacity then
      raise exception 'Requested slot is now full -- pick a different one before approving';
    end if;

    update cbt_slots set booked_count = booked_count + 1 where id = v_exc.requested_slot_id;
    insert into bookings (candidate_id, slot_id, status) values (v_exc.candidate_id, v_exc.requested_slot_id, 'confirmed');
  end if;

  update booking_exceptions
  set status = p_decision, decided_by = auth.uid(), decided_at = now(), decision_note = p_decision_note
  where id = p_exception_id
  returning * into v_exc;

  return v_exc;
end;
$$;
