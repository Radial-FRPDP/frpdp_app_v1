"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ORG_LOGIN_OPTIONS } from "@/lib/roles";
import type { StaffOrg, AccessRequestStatus } from "@/lib/database.types";

interface AccessRequestRow {
  id: string;
  full_name: string;
  email: string;
  org: StaffOrg;
  title: string | null;
  cbt_centre_id: string | null;
  note: string | null;
  status: AccessRequestStatus;
  requested_at: string;
  decision_note: string | null;
}

interface StaffRow {
  id: string;
  full_name: string;
  title: string | null;
  org: StaffOrg;
  cbt_centre_id: string | null;
  created_at: string;
}

interface Centre {
  id: string;
  name: string;
  state: string;
}

function orgLabel(org: StaffOrg) {
  return ORG_LOGIN_OPTIONS.find((o) => o.id === org)?.label ?? org;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function OrgSelect({ value, onChange }: { value: StaffOrg; onChange: (v: StaffOrg) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as StaffOrg)}
      className="px-3 py-2 rounded-xl text-sm border-2"
      style={{ borderColor: "#D8D8D8", color: "#323232" }}
    >
      {ORG_LOGIN_OPTIONS.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label} — {o.desc}
        </option>
      ))}
    </select>
  );
}

function RequestRow({ req, centres, onDecided }: { req: AccessRequestRow; centres: Centre[]; onDecided: (id: string, status: AccessRequestStatus) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [org, setOrg] = useState<StaffOrg>(req.org);
  const [title, setTitle] = useState(req.title ?? "");
  const [cbtCentreId, setCbtCentreId] = useState(req.cbt_centre_id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState("");

  async function approve() {
    if (org === "cbt" && !cbtCentreId) {
      setError("Select an assessment centre.");
      return;
    }
    setBusy("approve");
    setError("");
    const res = await fetch(`/api/access-requests/${req.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org, title, cbtCentreId: org === "cbt" ? cbtCentreId : null, note }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? "Approval failed.");
      return;
    }
    onDecided(req.id, "approved");
  }

  async function reject() {
    setBusy("reject");
    setError("");
    const res = await fetch(`/api/access-requests/${req.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(body.error ?? "Failed to decline.");
      return;
    }
    onDecided(req.id, "rejected");
  }

  return (
    <div className="rounded-xl border" style={{ borderColor: "#f4f4f4" }}>
      <div className="flex items-center gap-4 p-4">
        <div className="flex-1 min-w-0">
          <div className="font-heading font-bold text-sm text-[#323232]">{req.full_name}</div>
          <div className="text-[12px] text-[#646464] mt-0.5">{req.email}</div>
          <div className="text-[11px] text-[#969696] mt-1">
            Requested {orgLabel(req.org)}
            {req.title ? ` · ${req.title}` : ""} — {fmtDate(req.requested_at)}
          </div>
          {req.note && <div className="text-[12px] text-[#646464] mt-1.5 italic">&ldquo;{req.note}&rdquo;</div>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="px-3.5 py-2 rounded-lg text-xs font-heading font-bold border-2"
            style={{ borderColor: "#D8D8D8", color: "#646464" }}
          >
            {expanded ? "Cancel" : "Review"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid #f4f4f4" }}>
          <div className="grid sm:grid-cols-2 gap-3 pt-4">
            <div>
              <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Organisation</label>
              <OrgSelect value={org} onChange={setOrg} />
            </div>
            <div>
              <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Assessment Coordinator"
                className="w-full px-3 py-2 rounded-xl text-sm border-2"
                style={{ borderColor: "#D8D8D8", color: "#323232" }}
              />
            </div>
          </div>
          {org === "cbt" && (
            <div>
              <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Assessment Centre</label>
              <select
                value={cbtCentreId}
                onChange={(e) => setCbtCentreId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border-2"
                style={{ borderColor: "#D8D8D8", color: "#323232" }}
              >
                <option value="">Select a centre…</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.state}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Note (optional, sent to requester)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="w-full px-3 py-2 rounded-xl text-sm border-2"
              style={{ borderColor: "#D8D8D8", color: "#323232" }}
            />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}
          <div className="flex gap-2 justify-end">
            <button
              disabled={busy !== null}
              onClick={reject}
              className="px-4 py-2.5 rounded-xl text-xs font-heading font-bold border-2 disabled:opacity-50"
              style={{ borderColor: "#9B2335", color: "#9B2335" }}
            >
              {busy === "reject" ? "Declining…" : "Decline"}
            </button>
            <button
              disabled={busy !== null}
              onClick={approve}
              className="px-4 py-2.5 rounded-xl text-xs font-heading font-bold text-white disabled:opacity-50"
              style={{ background: "#058812" }}
            >
              {busy === "approve" ? "Creating account…" : "Approve & Create Account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddUserForm({ centres, onCreated }: { centres: Centre[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState<StaffOrg>("radial");
  const [title, setTitle] = useState("");
  const [cbtCentreId, setCbtCentreId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (org === "cbt" && !cbtCentreId) {
      setError("Select an assessment centre.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, org, title, cbtCentreId: org === "cbt" ? cbtCentreId : null }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to create account.");
      return;
    }
    setDone(true);
    setFullName("");
    setEmail("");
    setTitle("");
    setCbtCentreId("");
    onCreated();
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setDone(false);
        }}
        className="px-5 py-3 rounded-xl text-white text-sm font-heading font-bold"
        style={{ background: "#058812" }}
      >
        + Add User
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-elev-2 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-heading font-bold text-sm text-[#323232]">Add a staff user directly</h4>
        <button onClick={() => setOpen(false)} className="text-[#969696] hover:text-[#323232]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {done && <div className="text-sm text-[#058812] bg-[#05881210] px-4 py-3 rounded-xl">Account created — an invite email was sent.</div>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm border-2" style={{ borderColor: "#D8D8D8", color: "#323232" }} />
        </div>
        <div>
          <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm border-2" style={{ borderColor: "#D8D8D8", color: "#323232" }} />
        </div>
        <div>
          <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Organisation</label>
          <OrgSelect value={org} onChange={setOrg} />
        </div>
        <div>
          <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm border-2" style={{ borderColor: "#D8D8D8", color: "#323232" }} />
        </div>
      </div>
      {org === "cbt" && (
        <div>
          <label className="block text-[11px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1.5">Assessment Centre</label>
          <select value={cbtCentreId} onChange={(e) => setCbtCentreId(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm border-2" style={{ borderColor: "#D8D8D8", color: "#323232" }}>
            <option value="">Select a centre…</option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.state}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}
      <div className="flex justify-end">
        <button
          disabled={loading || !fullName || !email}
          onClick={submit}
          className="px-6 py-3 rounded-xl text-white text-sm font-heading font-bold disabled:opacity-40"
          style={{ background: "#058812" }}
        >
          {loading ? "Creating…" : "Create Account"}
        </button>
      </div>
    </div>
  );
}

export function UsersAdmin({
  initialRequests,
  initialStaff,
  centres,
}: {
  pmName: string;
  initialRequests: AccessRequestRow[];
  initialStaff: StaffRow[];
  centres: Centre[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending").slice(0, 10);

  function handleDecided(id: string, status: AccessRequestStatus) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    router.refresh();
  }

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#05881215" }}>
          👥
        </div>
        <div>
          <h1 className="font-heading font-extrabold text-2xl text-[#323232]">Staff Users</h1>
          <p className="text-sm text-[#646464]">Review access requests and manage staff accounts across every organisation.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#f4f4f4" }}>
          <h3 className="font-heading font-bold text-sm text-[#323232]">
            Pending Requests
            {pending.length > 0 && (
              <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: "#FBBD1525", color: "#846205" }}>
                {pending.length}
              </span>
            )}
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {pending.length === 0 && <p className="text-sm text-[#969696] text-center py-8">No pending requests.</p>}
          {pending.map((r) => (
            <RequestRow key={r.id} req={r} centres={centres} onDecided={handleDecided} />
          ))}
        </div>
      </div>

      <AddUserForm centres={centres} onCreated={() => router.refresh()} />

      <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
          <h3 className="font-heading font-bold text-sm text-[#323232]">Staff Accounts ({initialStaff.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f4f4f4" }}>
                {["Name", "Organisation", "Title", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-heading font-bold uppercase tracking-wider text-[#646464]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#f4f4f4" }}>
              {initialStaff.map((s) => (
                <tr key={s.id} className="hover:bg-[#f4f4f4] transition-colors">
                  <td className="px-4 py-3 font-heading font-semibold text-[#323232]">{s.full_name}</td>
                  <td className="px-4 py-3 text-[#646464]">{orgLabel(s.org)}</td>
                  <td className="px-4 py-3 text-[#646464]">{s.title || "—"}</td>
                  <td className="px-4 py-3 text-[12px] text-[#969696]">{fmtDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {initialStaff.length === 0 && <p className="text-sm text-[#969696] text-center py-8">No staff accounts yet.</p>}
        </div>
      </div>

      {decided.length > 0 && (
        <div className="bg-white rounded-2xl shadow-elev-1 overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
            <h4 className="font-heading font-bold text-sm text-[#323232]">Recently Decided</h4>
          </div>
          <div className="divide-y" style={{ borderColor: "#f4f4f4" }}>
            {decided.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-heading font-semibold text-sm text-[#323232]">{r.full_name}</span>
                  <span className="text-[12px] text-[#969696] ml-2">{r.email}</span>
                </div>
                <span
                  className="text-[11px] font-heading font-bold px-2.5 py-1 rounded-full"
                  style={{
                    color: r.status === "approved" ? "#058812" : "#9B2335",
                    background: r.status === "approved" ? "#05881215" : "#9B233515",
                  }}
                >
                  {r.status === "approved" ? "Approved" : "Declined"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
