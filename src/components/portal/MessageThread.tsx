"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface MessageRow {
  id: string;
  sender_role: "radial" | "candidate";
  body: string;
  created_at: string;
}

/**
 * Shared two-way thread view, used from both sides of the Message Centre
 * (Radial Circle's M-02 Messages tab and the candidate's M-02 hold
 * screen) -- the only thing that differs per side is which sender_role
 * this viewer writes as, which flips which bubbles align right.
 */
export function MessageThread({
  candidateId,
  senderRole,
  initialMessages,
}: {
  candidateId: string;
  senderRole: "radial" | "candidate";
  initialMessages: MessageRow[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError("");
    const { data, error: err } = await supabase
      .from("messages")
      .insert({ candidate_id: candidateId, sender_role: senderRole, body: text })
      .select()
      .single();
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessages((prev) => [...prev, data]);
    setBody("");
  }

  return (
    <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden flex flex-col" style={{ height: 420 }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <p className="text-xs text-[#969696] text-center py-8">No messages yet — say hello.</p>}
        {messages.map((m) => {
          const mine = m.sender_role === senderRole;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm" style={{ background: mine ? "#058812" : "#f4f4f4", color: mine ? "white" : "#323232" }}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="text-[10px] mt-1" style={{ opacity: 0.7 }}>
                  {new Date(m.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t p-3" style={{ borderColor: "#f4f4f4" }}>
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message…"
            className="input flex-1 text-sm"
          />
          <button onClick={send} disabled={sending || !body.trim()} className="btn-primary text-xs px-4 whitespace-nowrap">
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
