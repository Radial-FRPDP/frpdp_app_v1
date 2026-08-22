import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="font-bold text-sm">Batch 1 — Admin</span>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/admin" className="hover:text-[var(--ember)]">
              Dashboard
            </Link>
            <Link href="/admin/upload" className="hover:text-[var(--ember)]">
              Upload
            </Link>
            <Link href="/admin/nysc-queue" className="hover:text-[var(--ember)]">
              NYSC queue
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
