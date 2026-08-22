import { redirect } from "next/navigation";

/** Superseded by /portal/m04 (real CBT session + results view). */
export default function LegacyStatusRedirect() {
  redirect("/portal/m04");
}
