export interface ZoneResultRow {
  zone: string;
  sat: number;
  passed: number;
  avg: number;
}

export interface DisciplineResultRow {
  discipline: string;
  sat: number;
  passed: number;
  avg: number;
}

interface Props {
  zones: ZoneResultRow[];
  disciplines: DisciplineResultRow[];
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

export function NCDMBM04({ zones, disciplines }: Props) {
  const totalSat = zones.reduce((a, z) => a + z.sat, 0);
  const totalPassed = zones.reduce((a, z) => a + z.passed, 0);
  const overallRate = pct(totalPassed, totalSat);

  const worstZones = zones.filter((z) => z.sat > 0 && pct(z.passed, z.sat) < 60).map((z) => z.zone);

  return (
    <div className="p-5 lg:p-8 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#1B4F8A15" }}>
            🖥
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-04 · Assess</h1>
            <p className="text-sm text-[#646464]">CBT Results Oversight — NCDMB</p>
          </div>
          <div className="ml-auto hidden sm:block">
            <span className="text-[11px] font-heading font-bold px-3 py-1.5 rounded-full" style={{ background: "#1B4F8A15", color: "#1B4F8A", border: "1px solid #1B4F8A25" }}>
              Read-only Oversight
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Sat Exam", value: totalSat, color: "#1B4F8A" },
            { label: "Passed", value: totalPassed, color: "#058812" },
            { label: "Failed", value: totalSat - totalPassed, color: "#e05c00" },
            { label: "Overall Pass Rate", value: `${overallRate}%`, color: "#058812" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-elev-2">
              <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1">{s.label}</div>
              <div className="font-heading font-extrabold text-2xl" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalSat === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-elev-2 text-center">
          <p className="text-sm text-[#646464]">No candidates have sat the CBT exam yet.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl p-5 shadow-elev-2 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-heading font-bold text-sm text-[#323232]">Programme Pass Rate</h3>
                <p className="text-xs text-[#969696] mt-0.5">Across all zones and disciplines</p>
              </div>
              <div className="font-heading font-extrabold text-2xl" style={{ color: "#058812" }}>
                {overallRate}%
              </div>
            </div>
            <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: "#f4f4f4" }}>
              <div className="h-3 rounded-full" style={{ width: `${overallRate}%`, background: "linear-gradient(90deg, #058812, #EDE82C)" }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-[#969696]">
              <span>{totalPassed} passed</span>
              <span>
                {totalSat - totalPassed} failed of {totalSat} sat
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
              <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
                <h3 className="font-heading font-bold text-sm text-[#323232]">Pass Rate by Zone</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #f4f4f4", background: "#f4f4f4" }}>
                      {["Zone", "Sat", "Passed", "Pass Rate", "Avg Score"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-[10px] font-heading font-bold uppercase tracking-wider text-[#969696]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zones
                      .filter((z) => z.sat > 0)
                      .map((z) => {
                        const zRate = pct(z.passed, z.sat);
                        return (
                          <tr key={z.zone} className="hover:bg-[#f4f4f4]" style={{ borderBottom: "1px solid #f4f4f4" }}>
                            <td className="px-5 py-3.5 font-heading font-bold text-[#323232]">{z.zone}</td>
                            <td className="px-5 py-3.5 text-[#646464]">{z.sat}</td>
                            <td className="px-5 py-3.5 font-heading font-semibold" style={{ color: "#058812" }}>
                              {z.passed}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className="font-heading font-bold text-xs px-2 py-0.5 rounded-full"
                                style={{
                                  color: zRate >= 70 ? "#058812" : zRate >= 60 ? "#1B4F8A" : "#e05c00",
                                  background: (zRate >= 70 ? "#058812" : zRate >= 60 ? "#1B4F8A" : "#e05c00") + "14",
                                }}
                              >
                                {zRate}%
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-[#646464]">{z.avg.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
              <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
                <h3 className="font-heading font-bold text-sm text-[#323232]">Pass Rate by Discipline</h3>
              </div>
              <div className="p-6 space-y-5">
                {disciplines
                  .filter((d) => d.sat > 0)
                  .map((d) => {
                    const dRate = pct(d.passed, d.sat);
                    return (
                      <div key={d.discipline}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-heading font-semibold text-sm text-[#323232]">{d.discipline}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-[#969696]">avg {d.avg.toFixed(1)}%</span>
                            <span className="font-heading font-bold text-sm" style={{ color: dRate >= 70 ? "#058812" : dRate >= 60 ? "#1B4F8A" : "#e05c00" }}>
                              {dRate}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: "#f4f4f4" }}>
                          <div
                            className="h-3 rounded-full"
                            style={{ width: `${dRate}%`, background: dRate >= 70 ? "#058812" : dRate >= 60 ? "#1B4F8A" : "#e05c00" }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {worstZones.length > 0 && (
                <div className="mx-6 mb-6 p-4 rounded-xl" style={{ background: "#1B4F8A08", border: "1px solid #1B4F8A20" }}>
                  <p className="text-[11px] font-heading font-bold text-[#1B4F8A] mb-1">NCDMB Observation</p>
                  <p className="text-[12px] text-[#646464] leading-relaxed">
                    Pass rates in {worstZones.join(", ")} are below 60%. NCDMB recommends Radial Circle investigate whether CBT
                    support materials were distributed equitably across all regions before M-05 selection quotas are finalised.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
