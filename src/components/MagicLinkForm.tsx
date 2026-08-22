"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** Pre-filled and locked when we already know who this link is for (invite flow). */
  fixedEmail?: string;
  /** Extra query params appended to the callback URL, e.g. invite_token / next. */
  callbackParams?: Record<string, string>;
  buttonLabel?: string;
}

export function MagicLinkForm({ fixedEmail, callbackParams = {}, buttonLabel = "Send sign-in link" }: Props) {
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const params = new URLSearchParams(callbackParams);
    const redirectTo = `${window.location.origin}/auth/callback${params.toString() ? `?${params.toString()}` : ""}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-[var(--done)]">
        Check <b>{email}</b> for a sign-in link. It expires shortly, so use it soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          disabled={!!fixedEmail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mt-1"
          placeholder="you@example.com"
        />
      </div>
      {status === "error" && <p className="text-sm text-[var(--risk)]">{errorMessage}</p>}
      <button type="submit" disabled={status === "sending"} className="btn-primary w-full">
        {status === "sending" ? "Sending…" : buttonLabel}
      </button>
    </form>
  );
}
