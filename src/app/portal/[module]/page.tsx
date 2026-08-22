import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { MODULE_LIST, ROLE_CONFIG } from "@/lib/roles";
import { ComingSoon } from "@/components/portal/ComingSoon";

// Modules that already have a real, working production implementation —
// built before the multi-role portal shell existed. Bridged here rather
// than reimplemented, until each is migrated into /portal/[module]
// natively (tracked as separate build tasks).
const LEGACY_BRIDGES: Partial<Record<string, Partial<Record<string, string>>>> = {};

function codeFromSlug(slug: string): string | undefined {
  const match = slug.match(/^m-?(\d{2})$/i);
  if (!match) return undefined;
  return `M-${match[1]}`;
}

export default async function PortalModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const session = await getPortalSession();
  if (!session) redirect("/login");

  const code = codeFromSlug(module);
  const mod = code ? MODULE_LIST.find((m) => m.code === code) : undefined;

  if (!mod) {
    return <ComingSoon moduleCode={module.toUpperCase()} moduleTitle="Unknown module" />;
  }

  const accessible =
    session.role === "candidate"
      ? session.candidateStatus?.[mod.code] !== undefined && session.candidateStatus?.[mod.code] !== "locked"
      : (ROLE_CONFIG[session.role].modules as string[]).includes(mod.code);

  if (!accessible) {
    return <ComingSoon moduleCode={mod.code} moduleTitle={mod.title} />;
  }

  const bridge = LEGACY_BRIDGES[mod.code]?.[session.role];
  if (bridge) {
    redirect(bridge);
  }

  return <ComingSoon moduleCode={mod.code} moduleTitle={mod.title} />;
}
