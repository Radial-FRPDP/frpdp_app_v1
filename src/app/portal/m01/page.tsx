import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { M01Intake } from "@/components/portal/radial/M01Intake";
import { M01Welcome } from "@/components/portal/candidate/M01Welcome";
import { ComingSoon } from "@/components/portal/ComingSoon";

export default async function PortalM01Page() {
  const session = await getPortalSession();
  if (!session) redirect("/login");

  if (session.role === "radial") {
    return <M01Intake pmName={session.user.name} />;
  }

  if (session.role === "candidate") {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, full_name, email, phone, jqs_number, gender, discipline, date_of_birth, state_of_origin, nomination_confirmed_at")
      .eq("auth_user_id", user!.id)
      .maybeSingle();
    if (!candidate) redirect("/login");
    return <M01Welcome candidate={candidate} />;
  }

  // NCDMB / Renaissance / CBT read-only oversight for M-01 isn't built yet.
  return <ComingSoon moduleCode="M-01" moduleTitle="Intake" />;
}
