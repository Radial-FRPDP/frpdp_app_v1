"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/portal";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    // Hard navigation — see the matching comment on the login forms
    // (src/app/login/page.tsx): a client-side push right after an auth
    // change can land on a stale Router Cache entry and bounce back to
    // wherever it thought the user belonged before the password was set.
    window.location.href = next;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "#f4f4f4" }}>
      <div className="bg-white rounded-2xl p-8 shadow-elev-4 w-full max-w-sm">
        <h1 className="font-heading font-bold text-2xl text-[#323232] mb-1">Set your password</h1>
        <p className="text-[#646464] text-sm mb-6">
          This becomes your sign-in password from now on — for candidates, alongside your JQS Number.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm border-2"
              style={{ borderColor: "#D8D8D8", color: "#323232" }}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[#323232] mb-1.5 font-heading">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm border-2"
              style={{ borderColor: "#D8D8D8", color: "#323232" }}
            />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-white text-sm font-heading font-bold disabled:opacity-60"
            style={{ background: "#058812" }}
          >
            {loading ? "Saving…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
