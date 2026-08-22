import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { M04Assess } from "@/components/portal/candidate/M04Assess";
import { M04CbtOfficer } from "@/components/portal/cbt/M04CbtOfficer";
import { ComingSoon } from "@/components/portal/ComingSoon";

export default async function PortalM04Page() {
  const session = await getPortalSession();
  if (!session) redirect("/login");

  if (session.role === "candidate") {
    return <M04Assess />;
  }

  if (session.role === "cbt") {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: staffRow } = await supabase.from("staff_profiles").select("cbt_centre_id").eq("id", user!.id).maybeSingle();

    if (!staffRow?.cbt_centre_id) {
      return (
        <div className="p-8 max-w-md mx-auto text-center text-sm text-[#646464]">
          Your account isn&apos;t assigned to a centre yet — ask Radial Circle to set that up before you can check candidates in.
        </div>
      );
    }

    const [{ data: centre }, { data: sessions }] = await Promise.all([
      supabase.from("cbt_centres").select("name").eq("id", staffRow.cbt_centre_id).maybeSingle(),
      supabase
        .from("exam_sessions")
        .select("id, candidate_id, workstation_label, status, checked_in_at, candidates(full_name, jqs_number)")
        .eq("cbt_centre_id", staffRow.cbt_centre_id)
        .order("checked_in_at", { ascending: false }),
    ]);

    return <M04CbtOfficer initialSessions={(sessions ?? []) as never} centreName={centre?.name ?? "Your centre"} />;
  }

  return <ComingSoon moduleCode="M-04" moduleTitle="Assess" />;
}
