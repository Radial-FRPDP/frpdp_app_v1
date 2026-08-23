export interface ZoneClearanceRow {
  zone: string;
  invited: number;
  submitted: number;
  cleared: number;
}

export interface DisciplineCountRow {
  discipline: string;
  count: number;
}

export interface VerificationStat {
  title: string;
  count: number;
  total: number;
  color: string;
  icon: string;
  detail: string;
}

interface Props {
  totalInvited: number;
  profilesSubmitted: number;
  cleared: number;
  flagged: number;
  zones: ZoneClearanceRow[];
  disciplines: DisciplineCountRow[];
  verification: VerificationStat[];
  generatedAt: string;
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export function NCDMBM02({ totalInvited, profilesSubmitted, cleared, flagged, zones, disciplines, verification, generatedAt }: Props) {
  const totalDiscipline = disciplines.reduce((a, d) => a + d.count, 0) || 1;
  const overallPct = pct(cleared, profilesSubmitted);

  return (
    <div className="p-5 lg:p-8 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#1B4F8A15" }}>
            📋
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-02 · Profile</h1>
            <p className="text-sm text-[#646464]">Candidate Verification Oversight — NCDMB</p>
          </div>
          <div className="ml-auto hidden sm:block">
            <span className="text-[11px] font-heading font-bold px-3 py-1.5 rounded-full" style={{ background: "#1B4F8A15", color: "#1B4F8A", border: "1px solid #1B4F8A25" }}>
              Read-only Oversight View
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total Invited", value: totalInvited, sub: totalInvited > 0 ? "100%" : "—", color: "#1B4F8A" },
            { label: "Profiles Submitted", value: profilesSubmitted, sub: `${pct(profilesSubmitted, totalInvited)}%`, color: "#058812" },
            { label: "Cleared", value: cleared, sub: `${pct(cleared, profilesSubmitted)}% of submitted`, color: "#058812" },
            { label: "Flagged / On Hold", value: flagged, sub: `${pct(flagged, profilesSubmitted)}%`, color: "#e05c00" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 shadow-elev-2">
              <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1">{s.label}</div>
              <div className="font-heading font-extrabold text-3xl mb-1" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-[11px]" style={{ color: s.color + "cc" }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-elev-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-heading font-bold text-sm text-[#323232]">Overall Programme Progress</h3>
              <p className="text-xs text-[#969696] mt-0.5">M-02 verification — as of {generatedAt}</p>
            </div>
            <div className="font-heading font-extrabold text-2xl" style={{ color: "#058812" }}>
              {overallPct}%
            </div>
          </div>
          <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: "#f4f4f4" }}>
            <div className="h-3 rounded-full transition-all" style={{ width: `${overallPct}%`, background: "linear-gradient(90deg, #058812, #EDE82C)" }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-[#969696]">
            <span>{cleared} cleared</span>
            <span>
              {profilesSubmitted} submitted / {totalInvited} total
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
            <h3 className="font-heading font-bold text-sm text-[#323232]">Zone-by-Zone Clearance Rate</h3>
            <p className="text-xs text-[#969696] mt-0.5">Invited → Submitted → Cleared</p>
          </div>
          <div className="p-6 space-y-4">
            {zones.length === 0 && <p className="text-sm text-[#969696]">No candidates recorded with a zone yet.</p>}
            {zones.map((z) => {
              const zPct = pct(z.cleared, z.invited);
              return (
                <div key={z.zone}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-heading font-semibold text-sm text-[#323232]">{z.zone}</div>
                    <div className="text-[11px] text-[#969696]">
                      {z.cleared} cleared / {z.invited} invited
                    </div>
                  </div>
                  <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: "#f4f4f4" }}>
                    <div
                      className="h-2.5 rounded-full"
                      style={{ width: `${zPct}%`, background: zPct >= 50 ? "#058812" : zPct >= 40 ? "#1B4F8A" : "#e05c00" }}
                    />
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-[#969696]">
                    <span className="font-bold" style={{ color: zPct >= 50 ? "#058812" : zPct >= 40 ? "#1B4F8A" : "#e05c00" }}>
                      {zPct}% clearance
                    </span>
                    <span>{z.submitted} submitted</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
            <h3 className="font-heading font-bold text-sm text-[#323232]">By Discipline</h3>
          </div>
          <div className="p-5 space-y-3">
            {disciplines.length === 0 && <p className="text-xs text-[#969696]">No discipline data yet.</p>}
            {disciplines.map((d, i) => {
              const colors = ["#058812", "#1B4F8A", "#FBBD15", "#e05c00", "#969696"];
              const dPct = Math.round((d.count / totalDiscipline) * 100);
              return (
                <div key={d.discipline}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] font-heading font-semibold text-[#323232]">{d.discipline}</span>
                    <span className="text-[11px] text-[#969696]">{dPct}%</span>
                  </div>
                  <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "#f4f4f4" }}>
                    <div className="h-2 rounded-full" style={{ width: `${dPct}%`, background: colors[i % colors.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {verification.map((item) => {
          const vPct = pct(item.count, item.total);
          return (
            <div key={item.title} className="bg-white rounded-2xl shadow-elev-2 p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h4 className="font-heading font-bold text-sm text-[#323232]">{item.title}</h4>
                  <p className="text-[11px] text-[#969696] mt-0.5">{item.detail}</p>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <div className="font-heading font-extrabold text-3xl" style={{ color: item.color }}>
                  {item.count}
                </div>
                <div className="text-sm font-heading font-bold" style={{ color: item.color }}>
                  {vPct}%
                </div>
              </div>
              <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "#f4f4f4" }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${vPct}%`, background: item.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
