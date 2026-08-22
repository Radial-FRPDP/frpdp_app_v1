import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { M01Intake } from "@/components/portal/radial/M01Intake";
import { ComingSoon } from "@/components/portal/ComingSoon";

export default async function PortalM01Page() {
  const session = await getPortalSession();
  if (!session) redirect("/login");

  if (session.role !== "radial") {
    // Every other role sees M-01 as read-only oversight, not yet built
    // natively into the portal shell.
    return <ComingSoon moduleCode="M-01" moduleTitle="Intake" />;
  }

  return <M01Intake pmName={session.user.name} />;
}
