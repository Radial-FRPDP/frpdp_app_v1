import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Batch 1 Candidate Screening</h1>
        <p className="text-[var(--ink-muted)]">
          Candidates: use the link from your invite email to get started.
        </p>
        <Link href="/admin/login" className="btn-secondary inline-block mt-2">
          Program coordinator login
        </Link>
      </div>
    </main>
  );
}
