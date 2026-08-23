import { Funnel, RenaissanceStatCards, ObserverBadge, type FunnelStep } from "./Funnel";

export interface DisciplinePreviewRow {
  discipline: string;
  count: number;
}

interface Props {
  totalNominated: number;
  duplicatesFlagged: number;
  ageIneligible: number;
  readyOrBeyond: number;
  disciplines: DisciplinePreviewRow[];
  pmName: string | null;
}

export function RenaissanceM01({ totalNominated, duplicatesFlagged, ageIneligible, readyOrBeyond, disciplines, pmName }: Props) {
  const totalDiscipline = disciplines.reduce((a, d) => a + d.count, 0) || 1;

  const steps: FunnelStep[] = [
    { label: "CSV upload & parsing", count: totalNominated, total: totalNominated, detail: totalNominated > 0 ? `${totalNominated} records received` : "Awaiting upload" },
    {
      label: "Duplicate detection",
      count: totalNominated - duplicatesFlagged,
      total: totalNominated || 1,
      detail: `${duplicatesFlagged} duplicate${duplicatesFlagged === 1 ? "" : "s"} flagged for NCDMB`,
    },
    {
      label: "Age eligibility check",
      count: totalNominated - ageIneligible,
      total: totalNominated || 1,
      detail: `${ageIneligible} record${ageIneligible === 1 ? "" : "s"} above the age ceiling`,
    },
    {
      label: "Ready / invitation dispatch",
      count: readyOrBeyond,
      total: totalNominated || 1,
      detail: `${readyOrBeyond} cleared for invitation`,
    },
  ];

  return (
    <div className="p-5 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-7">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#05881215" }}>
            ⬇
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-01 · Intake</h1>
            <p className="text-sm text-[#646464]">Nomination & CSV Import — Renaissance Observer Portal</p>
          </div>
          <div className="ml-auto">
            <ObserverBadge />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-elev-1 flex items-start gap-4 mb-5" style={{ border: "1px solid #05881225" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#05881212" }}>
            <svg className="w-4 h-4" style={{ color: "#058812" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-heading font-bold text-sm text-[#323232]">Observer Access</p>
            <p className="text-xs text-[#646464] mt-1 leading-relaxed">
              Renaissance has read-only visibility into M-01 Intake. No individual candidate records are shown here — only
              aggregate figures. The full Import Summary Report is shared once Radial Circle approves the batch and
              invitations are dispatched.
            </p>
          </div>
        </div>

        <RenaissanceStatCards
          stats={[
            { label: "Total Nominated", value: totalNominated, color: "#058812" },
            { label: "Duplicates Flagged", value: duplicatesFlagged, color: "#FBBD15" },
            { label: "Age-Ineligible", value: ageIneligible, color: "#e05c00" },
            { label: "Ready to Invite", value: readyOrBeyond, color: "#058812" },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
            <h3 className="font-heading font-bold text-base text-[#323232]">Intake Pipeline Status</h3>
            <p className="text-sm text-[#646464] mt-1">Live status as reported by Radial Circle</p>
          </div>
          <div className="p-6">
            {totalNominated === 0 ? (
              <p className="text-sm text-[#969696]">No intake batch has been uploaded yet.</p>
            ) : (
              <Funnel steps={steps} />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-elev-2 p-5">
            <h4 className="font-heading font-bold text-sm text-[#323232] mb-3">Import Summary Report</h4>
            <div className="rounded-xl p-4 mb-4 text-center" style={{ background: "#96969610", border: "1px dashed #D8D8D8" }}>
              <div className="text-2xl mb-2">📄</div>
              <p className="text-xs font-heading font-bold text-[#646464]">Report Pending</p>
              <p className="text-[11px] text-[#969696] mt-1">Will be shared once PM approves the import</p>
            </div>
            <button disabled className="w-full py-2.5 rounded-xl text-xs font-heading font-bold text-white opacity-40 cursor-not-allowed" style={{ background: "#058812" }}>
              Download PDF Report
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-elev-1 p-5">
            <h4 className="font-heading font-bold text-sm text-[#323232] mb-3">Programme Contact</h4>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-sm text-white shrink-0" style={{ background: "#058812" }}>
                RC
              </div>
              <div>
                <div className="font-heading font-bold text-sm text-[#323232]">{pmName ?? "Radial Circle PM"}</div>
                <div className="text-[11px] text-[#646464]">Programme Manager</div>
                <div className="text-[11px] text-[#969696]">Radial Circle</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-elev-1 p-6">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-heading font-bold text-base text-[#323232]">Candidate Pool — Discipline Distribution</h4>
          <span className="text-[11px] font-heading font-bold px-2.5 py-1 rounded-full" style={{ background: "#96969615", color: "#646464" }}>
            Preview Only
          </span>
        </div>
        {disciplines.length === 0 ? (
          <p className="text-sm text-[#969696]">No discipline data recorded yet.</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {disciplines.map((d, i) => {
              const colors = ["#1B4F8A", "#058812", "#FBBD15", "#e05c00", "#969696"];
              const dPct = Math.round((d.count / totalDiscipline) * 100);
              return (
                <div key={d.discipline} className="p-5 rounded-2xl" style={{ background: "#f4f4f4" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="font-heading font-bold text-sm text-[#323232] leading-tight">{d.discipline}</div>
                    <div className="font-heading font-extrabold text-lg shrink-0 ml-2" style={{ color: colors[i % colors.length] }}>
                      {dPct}%
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[#D8D8D8] overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{ width: `${dPct}%`, background: colors[i % colors.length] }} />
                  </div>
                  <div className="text-xs text-[#646464]">{d.count} candidates nominated</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
