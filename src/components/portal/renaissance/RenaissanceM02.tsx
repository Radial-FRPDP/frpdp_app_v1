import { Funnel, RenaissanceStatCards, ObserverBadge, type FunnelStep } from "./Funnel";

export interface FlagRow {
  label: string;
  count: number;
  color: string;
}

interface Props {
  invited: number;
  registered: number;
  submitted: number;
  identityVerified: number;
  docsComplete: number;
  cleared: number;
  flags: FlagRow[];
}

export function RenaissanceM02({ invited, registered, submitted, identityVerified, docsComplete, cleared, flags }: Props) {
  const pending = Math.max(0, invited - cleared);

  const steps: FunnelStep[] = [
    { label: "Invitations sent by NCDMB", count: invited, total: invited || 1 },
    { label: "Candidates registered on portal", count: registered, total: invited || 1 },
    { label: "Profiles submitted for review", count: submitted, total: invited || 1 },
    { label: "Identity verified (NIN + BVN)", count: identityVerified, total: submitted || 1 },
    { label: "Documents complete", count: docsComplete, total: submitted || 1 },
    { label: "Profiles cleared by PM", count: cleared, total: submitted || 1 },
  ];

  return (
    <div className="p-5 lg:p-8 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#05881215" }}>
            🔍
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-02 · Profile</h1>
            <p className="text-sm text-[#646464]">Verification Pipeline Observer — Renaissance</p>
          </div>
          <div className="ml-auto hidden sm:block">
            <ObserverBadge />
          </div>
        </div>

        <RenaissanceStatCards
          stats={[
            { label: "Candidates Invited", value: invited, color: "#1B4F8A" },
            { label: "Submitted Profiles", value: submitted, color: "#058812" },
            { label: "Cleared for M-03", value: cleared, color: "#058812" },
            { label: "Pending Clearance", value: pending, color: "#e05c00" },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
            <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
              <h3 className="font-heading font-bold text-sm text-[#323232]">M-02 Verification Pipeline</h3>
              <p className="text-xs text-[#969696] mt-0.5">Live verification funnel — read-only view</p>
            </div>
            <div className="p-6">
              {invited === 0 ? <p className="text-sm text-[#969696]">No candidates have been invited yet.</p> : <Funnel steps={steps} />}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
            <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
              <h3 className="font-heading font-bold text-sm text-[#323232]">Programme Report</h3>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "#f4f4f4", border: "1px solid #D8D8D8" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl" style={{ background: "white" }}>
                  🔒
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-[#323232]">Full Report Pending PM Approval</p>
                  <p className="text-xs text-[#646464] mt-1 leading-relaxed">
                    The consolidated M-02 verification report will be available to Renaissance once Radial Circle (Programme
                    Manager) approves and releases the final batch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
              <h3 className="font-heading font-bold text-sm text-[#323232]">Current Flags</h3>
              <p className="text-[11px] text-[#969696] mt-0.5">Issues blocking clearance</p>
            </div>
            <div className="p-5 space-y-3">
              {flags.every((f) => f.count === 0) ? (
                <p className="text-xs text-[#969696]">No open flags.</p>
              ) : (
                flags.map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
                    <div className="flex-1 text-[12px] font-heading font-semibold text-[#323232]">{f.label}</div>
                    <div className="font-heading font-bold text-sm" style={{ color: f.color }}>
                      {f.count}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-elev-2 p-5">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-3">Programme Contact</h3>
            <p className="text-xs text-[#646464] leading-relaxed">
              For queries about individual candidate profiles or verification status, contact the Programme Manager directly.
              Renaissance does not have write access to candidate records in this module.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
