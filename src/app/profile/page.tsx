import { redirect } from "next/navigation";

/**
 * Superseded by /portal/m02 (the real, pixel-matched M-02 wizard). Kept as
 * a redirect so any old bookmark/link (including invite emails sent
 * before this existed) still lands somewhere useful.
 */
export default function LegacyProfileRedirect() {
  redirect("/portal/m02");
}
