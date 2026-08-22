import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { PortalShell } from "@/components/portal/PortalShell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <PortalShell role={session.role} user={session.user} notifications={session.notifications} candidateStatus={session.candidateStatus}>
      {children}
    </PortalShell>
  );
}
