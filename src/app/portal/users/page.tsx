import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { UsersAdmin } from "@/components/portal/radial/UsersAdmin";
import { ComingSoon } from "@/components/portal/ComingSoon";

export default async function PortalUsersPage() {
  const session = await getPortalSession();
  if (!session) redirect("/login");

  if (session.role !== "radial") {
    return <ComingSoon moduleCode="Users" moduleTitle="Staff Accounts" />;
  }

  // Service-role reads here for the same reason M-01's candidate list
  // moved to it: this page is already access-gated above by session.role
  // === "radial", so that's the real authorization check, not RLS.
  const db = createServiceRoleClient();
  const [{ data: requests }, { data: staff }, { data: centres }] = await Promise.all([
    db.from("access_requests").select("*").order("requested_at", { ascending: false }).limit(200),
    db.from("staff_profiles").select("id, full_name, title, org, cbt_centre_id, created_at").order("created_at", { ascending: false }),
    db.from("cbt_centres").select("id, name, state").order("name"),
  ]);

  return (
    <UsersAdmin
      pmName={session.user.name}
      initialRequests={requests ?? []}
      initialStaff={staff ?? []}
      centres={centres ?? []}
    />
  );
}
