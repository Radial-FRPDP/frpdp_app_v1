import { createServiceRoleClient } from "@/lib/supabase/server";
import { MagicLinkForm } from "@/components/MagicLinkForm";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createServiceRoleClient();
  const { data: candidate } = await db
    .from("candidates")
    .select("full_name, email")
    .eq("invite_token", token)
    .maybeSingle();

  if (!candidate) {
    return (
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="card p-8 max-w-sm text-center">
          <h1 className="text-lg font-bold mb-2">Link not recognized</h1>
          <p className="text-sm text-[var(--ink-muted)]">
            This invite link isn&apos;t valid. Contact the program coordinator if you believe this is a mistake.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="card p-8 w-full max-w-sm space-y-4">
        <h1 className="text-lg font-bold">Welcome, {candidate.full_name}</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          We&apos;ll email a secure sign-in link to <b>{candidate.email}</b>. Use it to complete your profile.
        </p>
        <MagicLinkForm
          fixedEmail={candidate.email}
          callbackParams={{ invite_token: token }}
          buttonLabel="Email me a sign-in link"
        />
      </div>
    </main>
  );
}
