"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Centre {
  id: string;
  name: string;
  state: string;
  status: "active" | "unavailable";
}

interface Slot {
  id: string;
  starts_at: string;
  capacity: number;
  booked_count: number;
  cbt_centre_id: string | null;
}

interface ExistingBooking {
  startsAt: string;
  centreName: string | null;
  ref: string;
}

interface ExceptionRequest {
  id: string;
  type: "centre_change" | "missed_window" | "duplicate_booking";
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decisionNote: string | null;
}

/**
 * Self-service "something's wrong with my booking" flow (M-03, see
 * design-reference-gap-analysis.md Section 3.6). booking_exceptions
 * already has an RLS policy letting a candidate insert a row for their
 * own candidate_id (booking_exceptions_self_insert, 0008) -- so this
 * writes directly via the session-bound client, same as the rest of the
 * candidate portal, rather than needing a new API route.
 */
function ExceptionRequestPanel({
  candidateId,
  bookingId,
  centres,
  slots,
  pendingRequest,
  onRequested,
}: {
  candidateId: string;
  bookingId: string | null;
  centres: Centre[];
  slots: Slot[];
  pendingRequest: ExceptionRequest | null;
  onRequested: () => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"centre_change" | "missed_window">("centre_change");
  const [centreId, setCentreId] = useState(centres[0]?.id ?? "");
  const [slotId, setSlotId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const slotsForCentre = useMemo(() => slots.filter((s) => s.cbt_centre_id === centreId && s.booked_count < s.capacity), [slots, centreId]);

  if (pendingRequest) {
    const labels: Record<ExceptionRequest["type"], string> = {
      centre_change: "Centre change",
      missed_window: "Missed my window",
      duplicate_booking: "Duplicate booking",
    };
    const statusColor = pendingRequest.status === "approved" ? "#058812" : pendingRequest.status === "rejected" ? "#9b2335" : "#e05c00";
    return (
      <div className="mt-4 bg-white rounded-2xl p-5 shadow-elev-2 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-wider text-[#969696] mb-1">Booking Change Request</p>
            <p className="text-sm text-[#323232]">{labels[pendingRequest.type]}</p>
          </div>
          <span className="text-[11px] font-heading font-bold px-3 py-1 rounded-full capitalize" style={{ background: `${statusColor}15`, color: statusColor }}>
            {pendingRequest.status}
          </span>
        </div>
        {pendingRequest.decisionNote && <p className="text-xs text-[#646464] mt-2">Note from Radial Circle: {pendingRequest.decisionNote}</p>}
        {pendingRequest.status === "pending" && <p className="text-xs text-[#969696] mt-2">Awaiting a decision from the Programme Manager.</p>}
      </div>
    );
  }

  async function submitRequest() {
    if (type === "centre_change" && !slotId) {
      setError("Pick the new centre and time you'd like.");
      return;
    }
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase.from("booking_exceptions").insert({
      candidate_id: candidateId,
      booking_id: bookingId,
      type,
      requested_slot_id: type === "centre_change" ? slotId : null,
      reason: reason || null,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOpen(false);
    onRequested();
  }

  if (!open) {
    return (
      <div className="mt-4 text-center">
        <button onClick={() => setOpen(true)} className="text-xs font-heading font-bold underline" style={{ color: "#1B4F8A" }}>
          Need to change your centre or missed your window?
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white rounded-2xl p-6 shadow-elev-2 max-w-2xl mx-auto text-left">
      <h4 className="font-heading font-bold text-sm text-[#323232] mb-4">Request a booking change</h4>
      <div className="flex gap-2 mb-4">
        {(["centre_change", "missed_window"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="flex-1 py-2 rounded-xl text-xs font-heading font-bold border-2"
            style={{ borderColor: type === t ? "#1B4F8A" : "#D8D8D8", background: type === t ? "#1B4F8A08" : "white", color: "#323232" }}
          >
            {t === "centre_change" ? "Change centre / time" : "I missed my window"}
          </button>
        ))}
      </div>

      {type === "centre_change" && (
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <select
            value={centreId}
            onChange={(e) => {
              setCentreId(e.target.value);
              setSlotId("");
            }}
            className="input"
          >
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={slotId} onChange={(e) => setSlotId(e.target.value)} className="input">
            <option value="">Choose a slot…</option>
            {slotsForCentre.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}
              </option>
            ))}
          </select>
        </div>
      )}

      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        rows={2}
        className="input w-full mb-4"
      />

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="btn-secondary text-xs px-4 py-2">
          Cancel
        </button>
        <button onClick={submitRequest} disabled={submitting} className="btn-primary text-xs px-4 py-2">
          {submitting ? "Sending…" : "Send Request"}
        </button>
      </div>
    </div>
  );
}

export function M03Booking({
  centres,
  slots,
  ninVerified,
  existingBooking,
  candidateId,
  pendingException,
}: {
  centres: Centre[];
  slots: Slot[];
  ninVerified: boolean;
  existingBooking: (ExistingBooking & { id: string }) | null;
  candidateId: string | null;
  pendingException: ExceptionRequest | null;
}) {
  const router = useRouter();
  const [centreId, setCentreId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<(ExistingBooking & { id: string }) | null>(existingBooking);

  const centreSlots = useMemo(() => slots.filter((s) => s.cbt_centre_id === centreId), [slots, centreId]);
  const datesForCentre = useMemo(() => {
    const map = new Map<string, Slot[]>();
    centreSlots.forEach((s) => {
      const key = new Date(s.starts_at).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [centreSlots]);
  const timesForDate = dateKey ? datesForCentre.get(dateKey) ?? [] : [];
  const selectedSlot = slots.find((s) => s.id === slotId);
  const selectedCentre = centres.find((c) => c.id === centreId);

  async function confirmBooking() {
    if (!slotId) return;
    setConfirming(true);
    setError("");
    const res = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId }),
    });
    const body = await res.json();
    setConfirming(false);
    if (!res.ok) {
      setError(body.error ?? "Booking failed.");
      return;
    }
    setBooked({
      id: String(body.booking.id),
      startsAt: body.booking.starts_at ?? selectedSlot?.starts_at ?? new Date().toISOString(),
      centreName: selectedCentre?.name ?? null,
      ref: `FRP-CBT-${String(body.booking.id).slice(0, 8).toUpperCase()}`,
    });
    router.refresh();
  }

  if (booked) {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-12 shadow-elev-2 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#05881215" }}>
            <svg className="w-10 h-10" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-[#323232] mb-2">CBT Booking Confirmed</h2>
          <p className="text-[#646464] text-sm mb-1">Booking reference: <span className="font-mono font-semibold">{booked.ref}</span></p>
          <p className="text-[#646464] text-sm mb-6">
            {new Date(booked.startsAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" })}
            {booked.centreName ? ` — ${booked.centreName}` : ""}
          </p>
          <p className="text-xs text-[#969696]">A confirmation email has been sent. Arrive at least 30 minutes early with your NIN slip.</p>
        </div>
        {candidateId && (
          <ExceptionRequestPanel
            candidateId={candidateId}
            bookingId={booked.id}
            centres={centres}
            slots={slots}
            pendingRequest={pendingException}
            onRequested={() => router.refresh()}
          />
        )}
      </div>
    );
  }

  if (!ninVerified) {
    return (
      <div className="p-5 lg:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-elev-2">
          <h2 className="font-heading font-bold text-lg text-[#323232] mb-2">NIN verification required</h2>
          <p className="text-sm text-[#646464]">
            Your NIN needs to be verified before you can book a CBT slot. Go back to{" "}
            <a href="/portal/m02" className="underline" style={{ color: "#058812" }}>
              M-02 Profile
            </a>{" "}
            to finish that step.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-03 · Book CBT</h1>
        <p className="text-sm text-[#646464]">Choose a centre, date, and time for your computer-based test.</p>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6 shadow-elev-2">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">1. Select a centre</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {centres.map((c) => {
                const unavailable = c.status !== "active";
                const active = centreId === c.id;
                return (
                  <button
                    key={c.id}
                    disabled={unavailable}
                    onClick={() => {
                      setCentreId(c.id);
                      setDateKey(null);
                      setSlotId(null);
                    }}
                    className="text-left p-4 rounded-xl border-2 transition-all disabled:opacity-40"
                    style={{ borderColor: active ? "#058812" : "#D8D8D8", background: active ? "#05881208" : "white" }}
                  >
                    <div className="font-heading font-bold text-sm text-[#323232]">{c.name}</div>
                    <div className="text-xs text-[#969696]">{c.state}</div>
                    {unavailable && <div className="text-[11px] mt-1 font-semibold" style={{ color: "#e05c00" }}>Unavailable</div>}
                  </button>
                );
              })}
              {centres.length === 0 && <p className="text-sm text-[#969696]">No centres open yet — check back soon.</p>}
            </div>
          </div>

          {centreId && (
            <div className="bg-white rounded-2xl p-6 shadow-elev-2">
              <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">2. Select a date</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(datesForCentre.keys()).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDateKey(d);
                      setSlotId(null);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-heading font-bold border-2"
                    style={{ borderColor: dateKey === d ? "#058812" : "#D8D8D8", background: dateKey === d ? "#05881208" : "white", color: "#323232" }}
                  >
                    {new Date(d).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
                  </button>
                ))}
                {datesForCentre.size === 0 && <p className="text-sm text-[#969696]">No dates open at this centre yet.</p>}
              </div>
            </div>
          )}

          {dateKey && (
            <div className="bg-white rounded-2xl p-6 shadow-elev-2">
              <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">3. Select a time</h3>
              <div className="flex flex-wrap gap-2">
                {timesForDate.map((s) => {
                  const full = s.booked_count >= s.capacity;
                  return (
                    <button
                      key={s.id}
                      disabled={full}
                      onClick={() => setSlotId(s.id)}
                      className="px-4 py-2 rounded-xl text-sm font-heading font-bold border-2 disabled:opacity-40"
                      style={{ borderColor: slotId === s.id ? "#058812" : "#D8D8D8", background: slotId === s.id ? "#05881208" : "white", color: "#323232" }}
                    >
                      {new Date(s.starts_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                      <span className="text-[10px] text-[#969696] ml-1">({s.capacity - s.booked_count} left)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-elev-2 h-fit sticky top-4">
          <h4 className="font-heading font-bold text-sm text-[#323232] mb-4">Your selection</h4>
          <div className="space-y-2 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-[#969696]">Centre</span>
              <span className="font-semibold text-[#323232]">{selectedCentre?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#969696]">Date</span>
              <span className="font-semibold text-[#323232]">{dateKey ? new Date(dateKey).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#969696]">Time</span>
              <span className="font-semibold text-[#323232]">
                {selectedSlot ? new Date(selectedSlot.starts_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </div>
          </div>
          <button onClick={confirmBooking} disabled={!slotId || confirming} className="btn-primary w-full">
            {confirming ? "Booking…" : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
