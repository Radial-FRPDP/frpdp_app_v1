"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GeoZone } from "@/lib/database.types";

const ZONES: GeoZone[] = ["South-South", "South-East", "South-West", "North-Central", "North-West", "North-East"];

interface Centre {
  id: string;
  name: string;
  state: string;
  zone: GeoZone;
  capacity: number;
  status: "active" | "unavailable";
}

interface Slot {
  id: string;
  starts_at: string;
  location: string | null;
  capacity: number;
  booked_count: number;
  cbt_centre_id: string | null;
}

export function M03CentresSlots({ initialCentres, initialSlots }: { initialCentres: Centre[]; initialSlots: Slot[] }) {
  const supabase = createClient();
  const [tab, setTab] = useState<"centres" | "slots">("centres");
  const [centres, setCentres] = useState(initialCentres);
  const [slots, setSlots] = useState(initialSlots);
  const [error, setError] = useState("");

  const [newCentre, setNewCentre] = useState({ name: "", state: "", zone: ZONES[0], capacity: 40 });
  const [savingCentre, setSavingCentre] = useState(false);

  const [newSlot, setNewSlot] = useState({ centreId: centres[0]?.id ?? "", date: "", time: "09:00", capacity: 40 });
  const [savingSlot, setSavingSlot] = useState(false);

  async function addCentre() {
    if (!newCentre.name || !newCentre.state) {
      setError("Centre name and state are required.");
      return;
    }
    setSavingCentre(true);
    setError("");
    const { data, error: err } = await supabase
      .from("cbt_centres")
      .insert({ name: newCentre.name, state: newCentre.state, zone: newCentre.zone, capacity: newCentre.capacity })
      .select()
      .single();
    setSavingCentre(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCentres((prev) => [...prev, data]);
    setNewCentre({ name: "", state: "", zone: ZONES[0], capacity: 40 });
  }

  async function toggleCentreStatus(centre: Centre) {
    const nextStatus = centre.status === "active" ? "unavailable" : "active";
    const { error: err } = await supabase.from("cbt_centres").update({ status: nextStatus }).eq("id", centre.id);
    if (err) {
      setError(err.message);
      return;
    }
    setCentres((prev) => prev.map((c) => (c.id === centre.id ? { ...c, status: nextStatus } : c)));
  }

  async function addSlot() {
    if (!newSlot.centreId || !newSlot.date) {
      setError("Pick a centre and a date.");
      return;
    }
    setSavingSlot(true);
    setError("");
    const startsAt = new Date(`${newSlot.date}T${newSlot.time}:00`).toISOString();
    const centre = centres.find((c) => c.id === newSlot.centreId);
    const { data, error: err } = await supabase
      .from("cbt_slots")
      .insert({ starts_at: startsAt, location: centre?.name ?? null, capacity: newSlot.capacity, cbt_centre_id: newSlot.centreId })
      .select()
      .single();
    setSavingSlot(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSlots((prev) => [...prev, data].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-03 · Book CBT</h1>
        <p className="text-sm text-[#646464]">Centres & Slot Allocation — Programme Manager</p>
      </div>

      <div className="flex rounded-2xl p-1 mb-6 shadow-elev-1 bg-white max-w-xs">
        {(["centres", "slots"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-sm font-heading font-bold transition-all"
            style={{ background: tab === t ? "#058812" : "transparent", color: tab === t ? "white" : "#969696" }}
          >
            {t === "centres" ? "Centres" : "Slots"}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      {tab === "centres" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#f4f4f4" }}>
                  {["Name", "State", "Zone", "Capacity", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-heading font-bold uppercase tracking-wider text-[#646464]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#f4f4f4" }}>
                {centres.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-heading font-semibold text-[#323232]">{c.name}</td>
                    <td className="px-4 py-3 text-[#646464]">{c.state}</td>
                    <td className="px-4 py-3 text-[#646464]">{c.zone}</td>
                    <td className="px-4 py-3 text-[#646464]">{c.capacity}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${c.status === "active" ? "badge-verified" : "badge-issue"}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleCentreStatus(c)} className="text-xs font-heading font-bold" style={{ color: "#058812" }}>
                        Mark {c.status === "active" ? "unavailable" : "active"}
                      </button>
                    </td>
                  </tr>
                ))}
                {centres.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-[#969696]">
                      No centres yet — add one below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-elev-1">
            <h4 className="font-heading font-bold text-sm text-[#323232] mb-4">Add Centre</h4>
            <div className="grid sm:grid-cols-4 gap-3">
              <input placeholder="Name" value={newCentre.name} onChange={(e) => setNewCentre({ ...newCentre, name: e.target.value })} className="input" />
              <input placeholder="State" value={newCentre.state} onChange={(e) => setNewCentre({ ...newCentre, state: e.target.value })} className="input" />
              <select value={newCentre.zone} onChange={(e) => setNewCentre({ ...newCentre, zone: e.target.value as GeoZone })} className="input">
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Capacity"
                value={newCentre.capacity}
                onChange={(e) => setNewCentre({ ...newCentre, capacity: Number(e.target.value) })}
                className="input"
              />
            </div>
            <button onClick={addCentre} disabled={savingCentre} className="btn-primary mt-4">
              {savingCentre ? "Adding…" : "Add Centre"}
            </button>
          </div>
        </div>
      )}

      {tab === "slots" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#f4f4f4" }}>
                  {["Date & Time", "Centre", "Capacity", "Booked"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-heading font-bold uppercase tracking-wider text-[#646464]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#f4f4f4" }}>
                {slots.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-[#323232]">
                      {new Date(s.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}
                    </td>
                    <td className="px-4 py-3 text-[#646464]">{s.location ?? "—"}</td>
                    <td className="px-4 py-3 text-[#646464]">{s.capacity}</td>
                    <td className="px-4 py-3 text-[#646464]">{s.booked_count}</td>
                  </tr>
                ))}
                {slots.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-[#969696]">
                      No slots yet — add one below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-elev-1">
            <h4 className="font-heading font-bold text-sm text-[#323232] mb-4">Add Slot</h4>
            <div className="grid sm:grid-cols-4 gap-3">
              <select value={newSlot.centreId} onChange={(e) => setNewSlot({ ...newSlot, centreId: e.target.value })} className="input">
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input type="date" value={newSlot.date} onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })} className="input" />
              <input type="time" value={newSlot.time} onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })} className="input" />
              <input
                type="number"
                placeholder="Capacity"
                value={newSlot.capacity}
                onChange={(e) => setNewSlot({ ...newSlot, capacity: Number(e.target.value) })}
                className="input"
              />
            </div>
            <button onClick={addSlot} disabled={savingSlot || centres.length === 0} className="btn-primary mt-4">
              {savingSlot ? "Adding…" : "Add Slot"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
