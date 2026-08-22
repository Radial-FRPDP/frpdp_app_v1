import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { M03CentresSlots } from "@/components/portal/radial/M03CentresSlots";
import { M03Booking } from "@/components/portal/candidate/M03Booking";
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
