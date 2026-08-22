"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Enter the email address on your candidate profile.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/set-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "#f4f4f4" }}>
      <div className="bg-white rounded-2xl p-8 shadow-elev-4 w-full max-w-sm">
        {sent ? (
          <>
            <h1 className="font-heading font-bold text-2xl text-[#323232] mb-2">Check your inbox</h1>
            <p className="text-[#646464] text-sm">
              If <strong>{email}</strong> has an account, a reset link is on its way.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-heading font-bold text-2xl text-[#323232] mb-1">Reset your password</h1>
            <p className="text-[#646464] text-sm mb-6">Use the email address from your invitation.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl text-sm border-2"
                style={{ borderColor: "#D8D8D8", color: "#323232" }}
              />
              {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-white text-sm font-heading font-bold disabled:opacity-60"
                style={{ background: "#058812" }}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <a href="/login" className="block text-center text-sm font-heading font-semibold mt-5" style={{ color: "#058812" }}>
          ← Back to sign in
        </a>
      </div>
    </main>
  );
}
