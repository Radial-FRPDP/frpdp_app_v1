import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { M04Assess } from "@/components/portal/candidate/M04Assess";
import { M04CbtOfficer } from "@/components/portal/cbt/M04CbtOfficer";
import { NCDMBM04 } from "@/components/portal/ncdmb/NCDMBM04";
import { RenaissanceM04 } from "@/components/portal/renaissance/RenaissanceM04";
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

  if (session.role === "ncdmb" || session.role === "renaissance") {
    const db = createServiceRoleClient();
    const [{ data: results }, { data: candidatesForFunnel }, { data: bookings }] = await Promise.all([
      db.from("exam_results").select("candidate_id, total_score, max_score, passed, candidates(zone, discipline)"),
      db.from("candidates").select("id, profiles(nin_verification_status, bvn_verification_status, nysc_review_status)"),
      db.from("bookings").select("candidate_id").eq("status", "confirmed"),
    ]);

    type ResultRow = { total_score: number; max_score: number; passed: boolean; candidates: { zone: string | null; discipline: string | null } | null };
    const rows = (results ?? []) as unknown as ResultRow[];

    const zoneMap = new Map<string, { sat: number; passed: number; scoreSum: number }>();
    const discMap = new Map<string, { sat: number; passed: number; scoreSum: number }>();
    for (const r of rows) {
      const scorePct = r.max_score > 0 ? (r.total_score / r.max_score) * 100 : 0;
      const zone = r.candidates?.zone ?? "Unspecified";
      const discipline = r.candidates?.discipline ?? "Unspecified";
      if (!zoneMap.has(zone)) zoneMap.set(zone, { sat: 0, passed: 0, scoreSum: 0 });
      const z = zoneMap.get(zone)!;
      z.sat++;
      z.scoreSum += scorePct;
      if (r.passed) z.passed++;
      if (!discMap.has(discipline)) discMap.set(discipline, { sat: 0, passed: 0, scoreSum: 0 });
      const d = discMap.get(discipline)!;
      d.sat++;
      d.scoreSum += scorePct;
      if (r.passed) d.passed++;
    }
    const zones = [...zoneMap.entries()].map(([zone, v]) => ({ zone, sat: v.sat, passed: v.passed, avg: v.sat > 0 ? v.scoreSum / v.sat : 0 }));
    const disciplines = [...discMap.entries()].map(([discipline, v]) => ({ discipline, sat: v.sat, passed: v.passed, avg: v.sat > 0 ? v.scoreSum / v.sat : 0 }));

    if (session.role === "ncdmb") {
      return <NCDMBM04 zones={zones} disciplines={disciplines} />;
    }

    type ClearRow = { id: string; profiles: { nin_verification_status: string; bvn_verification_status: string; nysc_review_status: string } | null };
    const clearRows = (candidatesForFunnel ?? []) as unknown as ClearRow[];
    const clearedAtM02 = clearRows.filter(
      (r) => r.profiles?.nin_verification_status === "verified" && r.profiles?.bvn_verification_status === "verified" && r.profiles?.nysc_review_status === "verified"
    ).length;
    const bookedIds = new Set((bookings ?? []).map((b) => b.candidate_id));
    const clearedIds = new Set(
      clearRows
        .filter((r) => r.profiles?.nin_verification_status === "verified" && r.profiles?.bvn_verification_status === "verified" && r.profiles?.nysc_review_status === "verified")
        .map((r) => r.id)
    );
    const bookedAtM03 = [...bookedIds].filter((id) => clearedIds.has(id)).length;
    const satExam = rows.length;
    const passed = rows.filter((r) => r.passed).length;

    return (
      <RenaissanceM04
        clearedAtM02={clearedAtM02}
        bookedAtM03={bookedAtM03}
        satExam={satExam}
        passed={passed}
        disciplines={disciplines.map((d) => ({ discipline: d.discipline, sat: d.sat, passed: d.passed }))}
      />
    );
  }

  return <ComingSoon moduleCode="M-04" moduleTitle="Assess" />;
}
