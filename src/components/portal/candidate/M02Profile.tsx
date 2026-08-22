"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DocType } from "@/lib/database.types";
import { NIGERIA_STATES } from "@/lib/nigeria-zones";

type WizardStep = "personal" | "identity" | "documents" | "submit";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "personal", label: "Personal Details" },
  { id: "identity", label: "Identity (NIN & BVN)" },
  { id: "documents", label: "Documents" },
  { id: "submit", label: "Review & Submit" },
];

interface ProfileRow {
  date_of_birth: string | null;
  address: string | null;
  lga_of_residence: string | null;
  state_of_residence: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  next_of_kin_relationship: string | null;
  next_of_kin_address: string | null;
  nin: string | null;
  nin_verification_status: string;
  bvn: string | null;
  bvn_verification_status: string;
  bank_account_name: string | null;
  nysc_cert_number: string | null;
  nysc_review_status: string;
}

interface DocumentRow {
  id: string;
  doc_type: DocType;
  storage_path: string;
}

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  date_of_birth: string | null;
}

function formatDob(dob: string | null): string {
  if (!dob) return "Not on file — contact your programme coordinator";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "Not on file — contact your programme coordinator";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const DOC_TYPES: { type: DocType; label: string; required: boolean }[] = [
  { type: "id_card", label: "NIN Slip", required: true },
  { type: "degree_certificate", label: "Degree Certificate", required: true },
  { type: "nysc_certificate", label: "NYSC Discharge / Exemption Certificate", required: true },
  { type: "other", label: "Additional Supporting Document (optional)", required: false },
];

function VerifyBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    verified: { label: "Verified", className: "badge-verified" },
    failed: { label: "Failed", className: "badge-issue" },
    pending: { label: "Pending", className: "badge-pending" },
    not_submitted: { label: "Not submitted", className: "badge-pending" },
  };
  const s = map[status] ?? map.not_submitted;
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

function StepIndicator({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-0 overflow-x-auto mb-6">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.id} className="flex items-center shrink-0">
            <div className="flex flex-col items-center text-center min-w-[100px]">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-heading font-bold mb-1.5"
                style={{ background: done || active ? "#058812" : "#f4f4f4", color: done || active ? "white" : "#969696" }}
              >
                {done ? "✓" : i + 1}
              </div>
              <div className="text-[11px] font-heading font-bold" style={{ color: active ? "#058812" : done ? "#323232" : "#969696" }}>
                {s.label}
              </div>
            </div>
            {i < STEPS.length - 1 && <div className="h-0.5 w-8 shrink-0 mx-1" style={{ background: i < idx ? "#058812" : "#D8D8D8" }} />}
          </div>
        );
      })}
    </div>
  );
}

export function M02Profile({ candidate, profile, documents }: { candidate: Candidate; profile: ProfileRow | null; documents: DocumentRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<WizardStep>("personal");

  const [phone, setPhone] = useState(candidate.phone ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [lgaOfResidence, setLgaOfResidence] = useState(profile?.lga_of_residence ?? "");
  const [stateOfResidence, setStateOfResidence] = useState(profile?.state_of_residence ?? "");
  const [nokName, setNokName] = useState(profile?.next_of_kin_name ?? "");
  const [nokPhone, setNokPhone] = useState(profile?.next_of_kin_phone ?? "");
  const [nokRelationship, setNokRelationship] = useState(profile?.next_of_kin_relationship ?? "");
  const [nokAddress, setNokAddress] = useState(profile?.next_of_kin_address ?? "");
  const [savingPersonal, setSavingPersonal] = useState(false);

  const [nin, setNin] = useState(profile?.nin ?? "");
  const [ninStatus, setNinStatus] = useState(profile?.nin_verification_status ?? "not_submitted");
  const [verifyingNin, setVerifyingNin] = useState(false);
  const [bvn, setBvn] = useState(profile?.bvn ?? "");
  const [bvnStatus, setBvnStatus] = useState(profile?.bvn_verification_status ?? "not_submitted");
  const [bankAccountName, setBankAccountName] = useState(profile?.bank_account_name ?? "");
  const [verifyingBvn, setVerifyingBvn] = useState(false);
  const [nyscCertNumber, setNyscCertNumber] = useState(profile?.nysc_cert_number ?? "");

  const [uploadedDocs, setUploadedDocs] = useState<DocumentRow[]>(documents);
  const [uploading, setUploading] = useState<DocType | null>(null);

  const [certify, setCertify] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(candidate.status === "profile_complete" || candidate.status === "verified");
  const [error, setError] = useState("");

  async function savePersonal() {
    setError("");
    setSavingPersonal(true);
    const [{ error: profErr }, { error: candErr }] = await Promise.all([
      supabase.from("profiles").upsert(
        {
          candidate_id: candidate.id,
          address,
          lga_of_residence: lgaOfResidence || null,
          state_of_residence: stateOfResidence || null,
          next_of_kin_name: nokName,
          next_of_kin_phone: nokPhone,
          next_of_kin_relationship: nokRelationship,
          next_of_kin_address: nokAddress || null,
        },
        { onConflict: "candidate_id" }
      ),
      supabase.from("candidates").update({ phone: phone || null }).eq("id", candidate.id),
    ]);
    setSavingPersonal(false);
    if (profErr || candErr) {
      setError(profErr?.message ?? candErr?.message ?? "Couldn't save.");
      return;
    }
    setStep("identity");
  }

  async function verifyNin() {
    setError("");
    if (!candidate.date_of_birth) {
      setError("Your date of birth isn't on file yet — contact your programme coordinator before verifying your NIN.");
      return;
    }
    setVerifyingNin(true);
    await supabase.from("profiles").upsert({ candidate_id: candidate.id, nin }, { onConflict: "candidate_id" });
    const res = await fetch("/api/verify/nin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nin, fullName: candidate.full_name, dateOfBirth: candidate.date_of_birth }),
    });
    const body = await res.json();
    setVerifyingNin(false);
    setNinStatus(body.status ?? "pending");
    if (!res.ok && res.status !== 202) setError(body.error ?? "NIN verification failed.");
  }

  async function verifyBvnNumber() {
    setError("");
    setVerifyingBvn(true);
    const res = await fetch("/api/verify/bvn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bvn, fullName: candidate.full_name }),
    });
    const body = await res.json();
    setVerifyingBvn(false);
    setBvnStatus(body.status ?? "pending");
    if (body.accountName) setBankAccountName(body.accountName);
    if (!res.ok && res.status !== 202) setError(body.error ?? "BVN verification failed.");
  }

  async function saveNyscAndContinue() {
    setError("");
    const { error: err } = await supabase.from("profiles").upsert({ candidate_id: candidate.id, nysc_cert_number: nyscCertNumber }, { onConflict: "candidate_id" });
    if (err) {
      setError(err.message);
      return;
    }
    setStep("documents");
  }

  async function handleFileUpload(docType: DocType, file: File) {
    setError("");
    setUploading(docType);
    const path = `${candidate.id}/${docType}-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("candidate-documents").upload(path, file, { upsert: false });
    if (uploadError) {
      setUploading(null);
      setError(uploadError.message);
      return;
    }
    const { data, error: insertError } = await supabase.from("documents").insert({ candidate_id: candidate.id, doc_type: docType, storage_path: path }).select().single();
    setUploading(null);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setUploadedDocs((prev) => [...prev.filter((d) => d.doc_type !== docType), data]);
  }

  const requiredDocsPresent = DOC_TYPES.filter((d) => d.required).every((d) => uploadedDocs.some((u) => u.doc_type === d.type));

  async function handleSubmit() {
    if (!certify || !requiredDocsPresent) return;
    setSubmitting(true);
    setError("");
    const { error: err } = await supabase
      .from("candidates")
      .update({ status: "profile_complete" })
      .eq("id", candidate.id);
    if (!err) {
      await supabase.from("profiles").update({ completed_at: new Date().toISOString() }).eq("candidate_id", candidate.id);
    }
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSubmitted(true);
    router.refresh();
  }

  if (submitted) {
    return (
      <div className="p-5 lg:p-8 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl p-12 shadow-elev-2 text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#05881215" }}>
            <svg className="w-10 h-10" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-[#323232] mb-2">Profile Submitted</h2>
          <p className="text-[#646464] text-sm mb-6">
            Your details are with Radial Circle for review. NIN: <VerifyBadge status={ninStatus} /> · BVN: <VerifyBadge status={bvnStatus} /> · NYSC:
            manual review by the programme team.
          </p>
          <a href="/portal/m03" className="inline-block px-6 py-3 rounded-xl text-white text-sm font-heading font-bold" style={{ background: "#058812" }}>
            Continue to CBT Booking →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-02 · Profile</h1>
        <p className="text-sm text-[#646464]">Confirm your details, verify your identity, and upload your documents.</p>
      </div>

      <StepIndicator current={step} />

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100">{error}</div>}

      {step === "personal" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full name</label>
                <input value={candidate.full_name} disabled className="input mt-1 opacity-60" />
              </div>
              <div>
                <label className="label">Email</label>
                <input value={candidate.email} disabled className="input mt-1 opacity-60" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input mt-1" placeholder="0803xxxxxxx" />
              </div>
              <div>
                <label className="label">Date of birth</label>
                <input value={formatDob(candidate.date_of_birth)} disabled className="input mt-1 opacity-60" />
                <p className="text-[11px] text-[#969696] mt-1">From your NCDMB nomination — confirmed on M-01.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-4">
            <h3 className="font-heading font-bold text-sm text-[#323232]">Residential Address</h3>
            <div>
              <label className="label">Current Residential Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="input mt-1" placeholder="Street address, city" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">LGA of Residence</label>
                <input value={lgaOfResidence} onChange={(e) => setLgaOfResidence(e.target.value)} className="input mt-1" placeholder="e.g. Ikeja" />
              </div>
              <div>
                <label className="label">State of Residence</label>
                <select value={stateOfResidence} onChange={(e) => setStateOfResidence(e.target.value)} className="input mt-1">
                  <option value="">Select state…</option>
                  {NIGERIA_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-4">
            <h3 className="font-heading font-bold text-sm text-[#323232]">Next of Kin</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input value={nokName} onChange={(e) => setNokName(e.target.value)} className="input mt-1" />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} className="input mt-1" placeholder="0803xxxxxxx" />
              </div>
            </div>
            <div>
              <label className="label">Relationship</label>
              <input value={nokRelationship} onChange={(e) => setNokRelationship(e.target.value)} className="input mt-1" placeholder="e.g. Mother, Spouse, Sibling" />
            </div>
            <div>
              <label className="label">Address (optional)</label>
              <input value={nokAddress} onChange={(e) => setNokAddress(e.target.value)} className="input mt-1" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={savePersonal} disabled={savingPersonal || !nokName || !nokPhone || !nokRelationship} className="btn-primary">
              {savingPersonal ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {step === "identity" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="label">National Identification Number (NIN)</label>
              <VerifyBadge status={ninStatus} />
            </div>
            <div className="flex gap-2">
              <input value={nin} onChange={(e) => setNin(e.target.value)} maxLength={11} inputMode="numeric" className="input" placeholder="11-digit NIN" />
              <button onClick={verifyNin} disabled={verifyingNin || nin.length !== 11} className="btn-secondary whitespace-nowrap">
                {verifyingNin ? "Checking…" : "Verify"}
              </button>
            </div>
            <p className="text-xs text-[#969696]">If automatic verification isn&apos;t available, this doesn&apos;t block you from continuing — Radial Circle reviews it by hand.</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="label">Bank Verification Number (BVN)</label>
              <VerifyBadge status={bvnStatus} />
            </div>
            <div className="flex gap-2">
              <input value={bvn} onChange={(e) => setBvn(e.target.value)} maxLength={11} inputMode="numeric" className="input" placeholder="11-digit BVN" />
              <button onClick={verifyBvnNumber} disabled={verifyingBvn || bvn.length !== 11} className="btn-secondary whitespace-nowrap">
                {verifyingBvn ? "Checking…" : "Verify"}
              </button>
            </div>
            {bankAccountName && <p className="text-xs text-[#646464]">Registered name on file: {bankAccountName}</p>}
            <p className="text-xs text-[#969696]">If automatic verification isn&apos;t available, this doesn&apos;t block you from continuing — Radial Circle reviews it by hand.</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="label">NYSC Certificate Number</label>
              <VerifyBadge status={profile?.nysc_review_status ?? "pending"} />
            </div>
            <input value={nyscCertNumber} onChange={(e) => setNyscCertNumber(e.target.value)} className="input" placeholder="e.g. A00XXXXXXX" />
            <p className="text-xs text-[#969696]">Reviewed manually by Radial Circle — this doesn&apos;t block you from continuing.</p>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep("personal")} className="btn-secondary">
              ← Back
            </button>
            <button onClick={saveNyscAndContinue} className="btn-primary">
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === "documents" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-4">
            {DOC_TYPES.map((d) => {
              const existing = uploadedDocs.find((u) => u.doc_type === d.type);
              return (
                <div key={d.type} className="flex items-center justify-between gap-4 py-3 border-b last:border-0" style={{ borderColor: "#f4f4f4" }}>
                  <div>
                    <div className="text-sm font-heading font-semibold text-[#323232]">
                      {d.label} {d.required && <span style={{ color: "#e05c00" }}>*</span>}
                    </div>
                    <div className="text-xs text-[#969696]">{existing ? "Uploaded" : "Not uploaded yet"}</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={uploading === d.type}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(d.type, file);
                    }}
                    className="text-xs max-w-[160px]"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep("identity")} className="btn-secondary">
              ← Back
            </button>
            <button onClick={() => setStep("submit")} disabled={!requiredDocsPresent} className="btn-primary">
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === "submit" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6 shadow-elev-2 space-y-3">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-2">Review</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[#969696]">NIN</span> <VerifyBadge status={ninStatus} />
              </div>
              <div>
                <span className="text-[#969696]">BVN</span> <VerifyBadge status={bvnStatus} />
              </div>
              <div>
                <span className="text-[#969696]">Documents</span>{" "}
                <span className="font-semibold text-[#323232]">
                  {uploadedDocs.length} of {DOC_TYPES.length} uploaded
                </span>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-4 cursor-pointer bg-white rounded-2xl p-6 shadow-elev-2">
            <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} className="mt-1" />
            <span className="text-sm text-[#323232]">
              I, {candidate.full_name}, certify that the information and documents I&apos;ve provided are accurate and complete.
            </span>
          </label>

          <div className="flex justify-between">
            <button onClick={() => setStep("documents")} className="btn-secondary">
              ← Back
            </button>
            <button onClick={handleSubmit} disabled={!certify || !requiredDocsPresent || submitting} className="btn-primary">
              {submitting ? "Submitting…" : "Submit Profile"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
