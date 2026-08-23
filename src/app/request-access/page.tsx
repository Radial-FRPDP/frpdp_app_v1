import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { RequestAccessForm } from "@/components/RequestAccessForm";

// Otherwise this has no runtime API usage (no cookies/headers) and would
// get statically prerendered once at build time -- freezing the CBT
// centre list as of that build instead of reflecting centres added since.
export const dynamic = "force-dynamic";

export default async function RequestAccessPage() {
  const db = createServiceRoleClient();
  const { data: centres } = await db.from("cbt_centres").select("id, name, state").order("name");

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12" style={{ background: "#f4f4f4" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-lockup.png" alt="Field Readiness Programme" className="h-8 w-auto object-contain mx-auto mb-5" />
          <h1 className="font-heading font-extrabold text-2xl text-[#323232]">Request staff access</h1>
          <p className="text-[#646464] text-sm mt-2 max-w-sm mx-auto">
            Tell us who you are and which organisation you&apos;re with. A Programme Manager at Radial Circle reviews every
            request before an account is created.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-elev-3 p-7">
          <RequestAccessForm centres={centres ?? []} />
        </div>

        <p className="text-center text-[12px] text-[#969696] mt-5">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold" style={{ color: "#058812" }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
