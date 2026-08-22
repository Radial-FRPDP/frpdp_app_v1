import { MagicLinkForm } from "@/components/MagicLinkForm";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="card p-8 w-full max-w-sm space-y-4">
        <h1 className="text-lg font-bold">Program coordinator login</h1>
        {error === "not_authorized" && (
          <p className="text-sm text-[var(--risk)]">
            That account isn&apos;t set up as a Radial Circle coordinator yet. Ask an existing coordinator to add you in staff_profiles.
          </p>
        )}
        <MagicLinkForm callbackParams={{ next: "/admin" }} />
      </div>
    </main>
  );
}
