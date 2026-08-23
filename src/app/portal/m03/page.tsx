import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { M03CentresSlots } from "@/components/portal/radial/M03CentresSlots";
import { M03Booking } from "@/components/portal/candidate/M03Booking";
import { NCDMBM03 } from "@/components/portal/ncdmb/NCDMBM03";
import { RenaissanceM03 } from "@/components/portal/renaissance/RenaissanceM03";
import { ComingSoon } from "@/components/portal/ComingSoon";

export default async function PortalM03Page() {
  const session = await getPortalSession();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();

  if (session.role === "radial") {
    const [{ data: centres }, { data: slots }] = await Promise.all([
      supabase.from("cbt_centres").select("id, name, state, zone, capacity, status").order("name"),
      supabase
        .from("cbt_slots")
        .select("id, starts_at, location, capacity, booked_count, cbt_centre_id")
        .order("starts_at", { ascending: true }),
    ]);
    return <M03CentresSlots initialCentres={centres ?? []} initialSlots={slots ?? []} />;
  }

  if (session.role === "ncdmb" || session.role === "renaissance") {
    const db = createServiceRoleClient();
    const [{ data: candidates }, { data: bookings }, { data: centres }, { data: slots }] = await Promise.all([
      db.from("candidates").select("id, zone, profiles(nin_verification_status, bvn_verification_status, nysc_review_status)"),
      db.from("bookings").select("candidate_id").eq("status", "confirmed"),
      db.from("cbt_centres").select("id, name").order("name"),
      db.from("cbt_slots").select("id, cbt_centre_id, booked_count"),
    ]);

    type Row = { id: string; zone: string | null; profiles: { nin_verification_status: string; bvn_verification_status: string; nysc_review_status: string } | null };
    const rows = (candidates ?? []) as unknown as Row[];
    const cleared = rows.filter(
      (r) => r.profiles?.nin_verification_status === "verified" && r.profiles?.bvn_verification_status === "verified" && r.profiles?.nysc_review_status === "verified"
    );
    const bookedIds = new Set((bookings ?? []).map((b) => b.candidate_id));
    const bookedCleared = cleared.filter((r) => bookedIds.has(r.id));

    const zoneMap = new Map<string, { cleared: number; booked: number }>();
    for (const r of cleared) {
      const z = r.zone ?? "Unspecified";
      if (!zoneMap.has(z)) zoneMap.set(z, { cleared: 0, booked: 0 });
      const entry = zoneMap.get(z)!;
      entry.cleared++;
      if (bookedIds.has(r.id)) entry.booked++;
    }
    const zones = [...zoneMap.entries()].map(([zone, v]) => ({ zone, ...v })).sort((a, b) => b.cleared - a.cleared);

    const slotsByCentre = new Map<string, { slots: number; seated: number }>();
    for (const s of slots ?? []) {
      if (!s.cbt_centre_id) continue;
      if (!slotsByCentre.has(s.cbt_centre_id)) slotsByCentre.set(s.cbt_centre_id, { slots: 0, seated: 0 });
      const entry = slotsByCentre.get(s.cbt_centre_id)!;
      entry.slots++;
      entry.seated += s.booked_count ?? 0;
    }
    const centreRows = (centres ?? []).map((c) => ({
      name: c.name,
      slots: slotsByCentre.get(c.id)?.slots ?? 0,
      candidatesSeated: slotsByCentre.get(c.id)?.seated ?? 0,
    }));

    if (session.role === "ncdmb") {
      return <NCDMBM03 eligibleCount={cleared.length} bookingsConfirmed={bookedCleared.length} centres={centreRows} zones={zones} />;
    }

    return <RenaissanceM03 clearedForCbt={cleared.length} booked={bookedCleared.length} centreNames={(centres ?? []).map((c) => c.name)} />;
  }

  if (session.role !== "candidate") {
    return <ComingSoon moduleCode="M-03" moduleTitle="Book CBT" />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: candidate } = await supabase.from("candidates").select("id").eq("auth_user_id", user!.id).maybeSingle();
  if (!candidate) redirect("/login");

  const [{ data: profile }, { data: existingBookingRow }, { data: centres }, { data: slots }] = await Promise.all([
    supabase.from("profiles").select("nin_verification_status").eq("candidate_id", candidate.id).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, slot_id, cbt_slots(starts_at, location, cbt_centres(name))")
      .eq("candidate_id", candidate.id)
      .eq("status", "confirmed")
      .maybeSingle(),
    supabase.from("cbt_centres").select("id, name, state, status").eq("status", "active").order("name"),
    supabase
      .from("cbt_slots")
      .select("id, starts_at, capacity, booked_count, cbt_centre_id")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const ninVerified = profile?.nin_verification_status === "verified";

  type BookingJoin = { id: string; slot_id: string; cbt_slots: { starts_at: string; location: string | null; cbt_centres: { name: string } | null } | null };
  const booking = existingBookingRow as unknown as BookingJoin | null;
  const existingBooking = booking
    ? {
        startsAt: booking.cbt_slots?.starts_at ?? "",
        centreName: booking.cbt_slots?.cbt_centres?.name ?? booking.cbt_slots?.location ?? null,
        ref: `FRP-CBT-${booking.id.slice(0, 8).toUpperCase()}`,
      }
    : null;

  return <M03Booking centres={centres ?? []} slots={slots ?? []} ninVerified={ninVerified} existingBooking={existingBooking} />;
}
