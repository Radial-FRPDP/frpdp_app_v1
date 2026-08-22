import { redirect } from "next/navigation";

/** Superseded by /portal/m03 (real centre/date/time picker). */
export default function LegacyBookRedirect() {
  redirect("/portal/m03");
}
