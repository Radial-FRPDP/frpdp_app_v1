import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { MODULE_LIST, ROLE_CONFIG } from "@/lib/roles";

function moduleHref(code: string) {
  return `/portal/${code.toLowerCase().replace("-", "")}`;
}

export default async function PortalIndexPage() {
  const session = await getPortalSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role === "candidate" && session.candidateStatus) {
    const firstOpen = MODULE_LIST.find((m) => session.candidateStatus![m.code] !== "locked");
    redirect(moduleHref(firstOpen?.code ?? "M-01"));
  }

  const config = ROLE_CONFIG[session.role];
  redirect(moduleHref(config.modules[0]));
}
